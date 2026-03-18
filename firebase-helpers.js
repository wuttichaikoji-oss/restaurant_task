window.firebaseHelpers = null;
(async function(){
  if(!window.FIREBASE_ENABLED) return;
  try{
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const msgMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");
    const app = appMod.initializeApp(window.FIREBASE_CONFIG);
    const db = fsMod.getFirestore(app);
    const tasksCol = fsMod.collection(db, window.FIREBASE_TASKS_COLLECTION || "hk_tasks_v19");
    const logsCol = fsMod.collection(db, window.FIREBASE_LOGS_COLLECTION || "hk_logs_v19");
    const tokenCol = window.FIREBASE_DEVICE_TOKENS_COLLECTION || "device_tokens";
    let messaging = null; try { messaging = msgMod.getMessaging(app); } catch (e) {}
    window.firebaseHelpers = {
      async getData(){
        const [tasksSnap, logsSnap] = await Promise.all([fsMod.getDocs(fsMod.query(tasksCol)), fsMod.getDocs(fsMod.query(logsCol))]);
        return {
          tasks: tasksSnap.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)),
          logs: logsSnap.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>new Date(b.closedAt||b.createdAt||0)-new Date(a.closedAt||a.createdAt||0)),
        };
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
        const unsub1 = fsMod.onSnapshot(fsMod.query(tasksCol), async ()=>{ onChange(await this.getData()); });
        const unsub2 = fsMod.onSnapshot(fsMod.query(logsCol), async ()=>{ onChange(await this.getData()); });
        return ()=>{unsub1();unsub2();};
      },
      async registerDeviceToken(session){
        if(!messaging) throw new Error("Messaging unavailable");
        if(!window.FIREBASE_VAPID_KEY || window.FIREBASE_VAPID_KEY === 'REPLACE_ME') throw new Error("ยังไม่ได้ใส่ VAPID key");
        const permission = await Notification.requestPermission();
        if(permission !== 'granted') throw new Error("ผู้ใช้ยังไม่อนุญาต notification");
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
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