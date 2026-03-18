window.firebaseHelpers = null;
(async function(){
  if(!window.FIREBASE_ENABLED) return;
  try{
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const msgMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");
    const app = appMod.initializeApp(window.FIREBASE_CONFIG);
    let db;
    try{
      if(fsMod.initializeFirestore && fsMod.persistentLocalCache){
        db = fsMod.initializeFirestore(app, {
          localCache: fsMod.persistentLocalCache({
            tabManager: fsMod.persistentMultipleTabManager ? fsMod.persistentMultipleTabManager() : undefined
          })
        });
      }else{
        db = fsMod.getFirestore(app);
      }
    }catch(cacheErr){
      console.warn('Firestore persistent cache unavailable, fallback to default cache:', cacheErr);
      db = fsMod.getFirestore(app);
    }
    const tasksCol = fsMod.collection(db, window.FIREBASE_TASKS_COLLECTION || "hk_tasks_v19");
    const logsCol = fsMod.collection(db, window.FIREBASE_LOGS_COLLECTION || "hk_logs_v19");
    const tokenCol = window.FIREBASE_DEVICE_TOKENS_COLLECTION || "device_tokens";
    const usersColName = window.FIREBASE_USERS_COLLECTION || "hk_users_v1";
    const usersCol = fsMod.collection(db, usersColName);
    const tasksQuery = fsMod.query(tasksCol, fsMod.orderBy('createdAt', 'desc'));
    const logsQuery = fsMod.query(logsCol, fsMod.orderBy('closedAt', 'desc'));
    const hkTasksQueryFor = (assignee)=>fsMod.query(tasksCol, fsMod.where('assignee','==',String(assignee||'')), fsMod.orderBy('createdAt', 'desc'));
    const hkTasksFallbackQuery = fsMod.query(tasksCol, fsMod.orderBy('createdAt', 'desc'));
    let taskCache = null;
    let logCache = null;
    let userCache = null;
    function mapTasksSnapshot(snap){
      return snap.docs.map(doc=>({id:doc.id, ...doc.data()})).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    }
    function mapLogsSnapshot(snap){
      return snap.docs.map(doc=>({id:doc.id, ...doc.data()})).sort((a,b)=>new Date(b.closedAt||b.createdAt||0)-new Date(a.closedAt||a.createdAt||0));
    }
    async function readTasks(force=false){
      if(taskCache && !force) return taskCache;
      const snap = await fsMod.getDocs(tasksQuery);
      taskCache = mapTasksSnapshot(snap);
      return taskCache;
    }
    async function readLogs(force=false){
      if(logCache && !force) return logCache;
      const snap = await fsMod.getDocs(logsQuery);
      logCache = mapLogsSnapshot(snap);
      return logCache;
    }
    let messaging = null; try { messaging = msgMod.getMessaging(app); } catch (e) {}
    window.firebaseHelpers = {
      async getData(force=false){
        const [tasks, logs] = await Promise.all([readTasks(force), readLogs(force)]);
        return { tasks:[...tasks], logs:[...logs] };
      },
      async replaceAllData(data){
        const current = await this.getData();
        for(const t of current.tasks){ await fsMod.deleteDoc(fsMod.doc(db, window.FIREBASE_TASKS_COLLECTION || "hk_tasks_v19", t.id)); }
        for(const l of current.logs){ await fsMod.deleteDoc(fsMod.doc(db, window.FIREBASE_LOGS_COLLECTION || "hk_logs_v19", l.id)); }
        for(const t of (data.tasks||[])){ await this.upsertTask(t); }
        for(const l of (data.logs||[])){ await this.addLog(l); }
      },
      async upsertTask(task){
        const id=task.id||crypto.randomUUID();
        const payload={...task,id,updatedAt:new Date().toISOString()};
        await fsMod.setDoc(fsMod.doc(db, window.FIREBASE_TASKS_COLLECTION || "hk_tasks_v19", id), payload);
        return payload;
      },
      async deleteTask(id){ await fsMod.deleteDoc(fsMod.doc(db, window.FIREBASE_TASKS_COLLECTION || "hk_tasks_v19", id)); },
      async addLog(logItem){
        const id=logItem.id||crypto.randomUUID();
        await fsMod.setDoc(fsMod.doc(db, window.FIREBASE_LOGS_COLLECTION || "hk_logs_v19", id), {...logItem,id});
      },
      subscribe(onChange){
        let readyTasks = false;
        let readyLogs = false;
        const emit = ()=>{
          if(readyTasks && readyLogs){
            onChange({ tasks:[...(taskCache||[])], logs:[...(logCache||[])] });
          }
        };
        const unsub1 = fsMod.onSnapshot(tasksQuery, (snap)=>{
          taskCache = mapTasksSnapshot(snap);
          readyTasks = true;
          emit();
        }, (err)=>console.error('tasks onSnapshot error:', err));
        const unsub2 = fsMod.onSnapshot(logsQuery, (snap)=>{
          logCache = mapLogsSnapshot(snap);
          readyLogs = true;
          emit();
        }, (err)=>console.error('logs onSnapshot error:', err));
        return ()=>{unsub1();unsub2();};
      },
      async getTasksByAssignee(assignee){
        const name = String(assignee||'').trim();
        if(!name) return [];
        try{
          const snap = await fsMod.getDocs(hkTasksQueryFor(name));
          return mapTasksSnapshot(snap);
        }catch(err){
          console.warn('getTasksByAssignee fallback to full tasks query:', err);
          const snap = await fsMod.getDocs(hkTasksFallbackQuery);
          return mapTasksSnapshot(snap).filter(t => String(t.assignee||'').trim() === name);
        }
      },
      subscribeTasksByAssignee(assignee, onChange){
        const name = String(assignee||'').trim();
        const queryToUse = name ? hkTasksQueryFor(name) : hkTasksFallbackQuery;
        return fsMod.onSnapshot(queryToUse, (snap)=>{
          let tasks = mapTasksSnapshot(snap);
          if(name) tasks = tasks.filter(t => String(t.assignee||'').trim() === name);
          onChange(tasks);
        }, async(err)=>{
          console.error('subscribeTasksByAssignee error:', err);
          try{
            const all = await this.getTasksByAssignee(name);
            onChange(all);
          }catch(fallbackErr){
            console.error('subscribeTasksByAssignee fallback failed:', fallbackErr);
          }
        });
      },

      async getUsers(force=false){
        if(userCache && !force) return [...userCache];
        const snap = await fsMod.getDocs(fsMod.query(usersCol));
        userCache = snap.docs.map(doc=>({code:doc.id, ...doc.data()}))
          .filter(u=>u.code && u.name)
          .sort((a,b)=>{
            const order={fo:0,supervisor:1,hk:2};
            return (order[a.role]??9)-(order[b.role]??9) || String(a.code).localeCompare(String(b.code),'en');
          });
        return [...userCache];
      },
      async upsertUser(user){
        const code = String(user?.code||'').trim();
        if(!code) throw new Error('missing user code');
        const payload = {...user, code, updatedAt:new Date().toISOString()};
        await fsMod.setDoc(fsMod.doc(db, usersColName, code), payload);
        userCache = null;
        return payload;
      },
      async deleteUser(code){
        const id = String(code||'').trim();
        if(!id) return;
        await fsMod.deleteDoc(fsMod.doc(db, usersColName, id));
        userCache = null;
      },
      getConnectionInfo(){
        return {
          cacheEnabled: !!fsMod.persistentLocalCache,
          taskCount: (taskCache||[]).length,
          logCount: (logCache||[]).length
        };
      },
      async listDeviceTokens(){
        const snap = await fsMod.getDocs(fsMod.query(fsMod.collection(db, tokenCol)));
        return snap.docs.map(doc => ({id:doc.id, ...doc.data()}))
          .sort((a,b)=> new Date(b.updatedAt||0) - new Date(a.updatedAt||0));
      },
      async registerDeviceToken(session){
        if(!messaging) throw new Error("Messaging unavailable");
        if(!window.FIREBASE_VAPID_KEY || window.FIREBASE_VAPID_KEY === 'REPLACE_ME') throw new Error("ยังไม่ได้ใส่ VAPID key");
        if (!('serviceWorker' in navigator)) throw new Error("เบราว์เซอร์ไม่รองรับ service worker");
        if (!('Notification' in window)) throw new Error("เบราว์เซอร์ไม่รองรับ notification");
        const permission = await Notification.requestPermission();
        if(permission !== 'granted') throw new Error("ผู้ใช้ยังไม่อนุญาต notification");
        const swReg = await navigator.serviceWorker.register('/HK_task/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
        const token = await msgMod.getToken(messaging,{vapidKey:window.FIREBASE_VAPID_KEY,serviceWorkerRegistration:swReg});
        if(!token) throw new Error("ไม่สามารถสร้าง token ได้");
        await fsMod.setDoc(fsMod.doc(db, tokenCol, token), {
          token,
          userName:session?.name||'',
          role:session?.role||'',
          department:session?.department||'',
          updatedAt:new Date().toISOString(),
          userAgent:navigator.userAgent,
          enabled:true
        });
        msgMod.onMessage(messaging,(payload)=>{
          const title = payload?.notification?.title || 'มีงานใหม่จาก Front Office';
          const body = payload?.notification?.body || '';
          if(Notification.permission==='granted'){ new Notification(title,{body}); }
        });
        return token;
      }
    };
  }catch(err){console.error("Firebase init error:", err);}
})();