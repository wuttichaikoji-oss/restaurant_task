
const STORAGE_KEY='hk_tasks_v1_9', SESSION_KEY='hk_session_v1_9', USER_STORAGE_KEY='hk_users_v2_0_3';
const STATUSES=['New from FO','In Progress','Done by HK'];
const ACTIVE_STATUSES = new Set(STATUSES);
const USERS=window.APP_USERS||[];
const fmtDate=d=>d?new Date(d).toLocaleString('th-TH'):'-';
const uid=()=>Math.random().toString(36).slice(2,10);
const nowIsoLocal=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function escapeHtml(str){return String(str??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}

function cloneData(v){return JSON.parse(JSON.stringify(v));}
function defaultUsers(){return cloneData(window.APP_DEFAULT_USERS||[]);}
function normalizeUser(user){
  const role = ['fo','hk','supervisor'].includes(String(user?.role||'')) ? String(user.role) : 'hk';
  const department = user?.department || (role==='fo' ? 'Front Office' : role==='supervisor' ? 'Management' : 'HouseKeeping');
  return {
    code: String(user?.code||'').trim(),
    name: String(user?.name||'').trim(),
    role,
    department,
    position: String(user?.position||department).trim()
  };
}
function setUsersInMemory(users){
  window.APP_USERS ||= [];
  window.APP_USERS.splice(0, window.APP_USERS.length, ...(users||[]).map(normalizeUser).filter(u=>u.code && u.name));
  window.USERS = window.APP_USERS;
  return window.APP_USERS;
}
function loadLocalUsers(){
  try{
    const raw = JSON.parse(localStorage.getItem(USER_STORAGE_KEY)||'[]');
    if(Array.isArray(raw) && raw.length) return setUsersInMemory(raw);
  }catch{}
  const defaults = defaultUsers();
  saveLocalUsers(defaults);
  return defaults;
}
function saveLocalUsers(users){
  const normalized = (users||[]).map(normalizeUser).filter(u=>u.code && u.name);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
  return setUsersInMemory(normalized);
}
function getUsersSnapshot(){
  if(!Array.isArray(window.APP_USERS) || !window.APP_USERS.length) return loadLocalUsers();
  return window.APP_USERS;
}
function findUserByCode(code){
  return getUsersSnapshot().find(x=>x.code===String(code).trim());
}
function usersByRole(role){
  return getUsersSnapshot().filter(u=>u.role===role);
}

function isPermissionDeniedError(err){
  const msg = String(err?.message||err||'').toLowerCase();
  const code = String(err?.code||'').toLowerCase();
  return code.includes('permission-denied') || msg.includes('missing or insufficient permissions');
}
async function waitForFirebaseUsersHelper(maxTries=25){
  let tries=0;
  while(window.FIREBASE_ENABLED && (!window.firebaseHelpers || !window.firebaseHelpers.getUsers) && tries<maxTries){
    await new Promise(r=>setTimeout(r,200));
    tries++;
  }
}
async function ensureUsersReady(force=false){
  if(window.__usersReadyPromise && !force) return window.__usersReadyPromise;
  window.__usersReadyPromise = (async()=>{
    loadLocalUsers();
    await waitForFirebaseUsersHelper();
    try{
      if(window.FIREBASE_ENABLED && window.firebaseHelpers?.getUsers){
        const remote = await window.firebaseHelpers.getUsers();
        if(remote.length){
          saveLocalUsers(remote);
          return getUsersSnapshot();
        }
        const defaults = defaultUsers();
        for(const user of defaults){ await window.firebaseHelpers.upsertUser(user); }
        saveLocalUsers(defaults);
        return getUsersSnapshot();
      }
    }catch(err){
      console.warn('ensureUsersReady fallback to local users:', err);
    }
    if(!getUsersSnapshot().length){
      saveLocalUsers(defaultUsers());
    }
    return getUsersSnapshot();
  })();
  try{
    return await window.__usersReadyPromise;
  }catch(err){
    console.warn('ensureUsersReady recovered from error:', err);
    window.__usersReadyPromise = null;
    if(!getUsersSnapshot().length) saveLocalUsers(defaultUsers());
    return getUsersSnapshot();
  }
}
async function createOrUpdateUser(user){
  const normalized = normalizeUser(user);
  if(!normalized.code || !normalized.name) throw new Error('กรุณากรอก ID และชื่อพนักงาน');
  const current = [...getUsersSnapshot()];
  const idx = current.findIndex(u=>u.code===normalized.code);
  if(idx>=0) current[idx] = normalized; else current.push(normalized);
  current.sort((a,b)=>{
    const order={fo:0,supervisor:1,hk:2};
    return (order[a.role]??9)-(order[b.role]??9) || a.code.localeCompare(b.code,'en');
  });
  if(window.FIREBASE_ENABLED && window.firebaseHelpers?.upsertUser){
    try{
      await window.firebaseHelpers.upsertUser(normalized);
      const remote = await window.firebaseHelpers.getUsers();
      saveLocalUsers(remote);
      return normalized;
    }catch(err){
      if(!isPermissionDeniedError(err)) throw err;
      saveLocalUsers(current);
      return {...normalized, __localOnly:true};
    }
  }
  saveLocalUsers(current);
  return normalized;
}
async function removeUser(code){
  const target = String(code||'').trim();
  if(!target) return { __removed:false };
  const current = [...getUsersSnapshot()];
  const targetUser = current.find(u=>u.code===target);
  if(targetUser?.role==='fo') throw new Error('FO หลักถูกล็อกไว้ ไม่สามารถลบได้');
  if(targetUser?.role==='supervisor' && current.filter(u=>u.role==='supervisor').length<=1) throw new Error('ต้องมี Supervisor อย่างน้อย 1 ID');
  const next = current.filter(u=>u.code!==target);
  if(window.FIREBASE_ENABLED && window.firebaseHelpers?.deleteUser){
    try{
      await window.firebaseHelpers.deleteUser(target);
      const remote = await window.firebaseHelpers.getUsers();
      saveLocalUsers(remote);
      return { __removed:true };
    }catch(err){
      if(!isPermissionDeniedError(err)) throw err;
      saveLocalUsers(next);
      return { __removed:true, __localOnly:true };
    }
  }
  saveLocalUsers(next);
  return { __removed:true };
}
function roleLabel(role){
  if(role==='fo') return 'FO';
  if(role==='supervisor') return 'Supervisor';
  return 'HK';
}
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
function logout(){localStorage.removeItem(SESSION_KEY);location.href='index.html';}
function destinationForRole(role){
  if(role==='hk') return 'hk.html';
  if(role==='fo' || role==='supervisor') return 'fo.html';
  return 'index.html';
}
function login(code){
  const u=findUserByCode(code);
  if(!u)return false;
  saveSession({name:u.name,role:u.role,code:u.code,department:u.department||'',position:u.position||'',loginAt:new Date().toISOString()});
  location.href = destinationForRole(u.role);
  return true;
}
function requireRole(roles){
  const s=loadSession();
  if(!s){location.href='index.html';throw new Error('No session')}
  const allowed = Array.isArray(roles)?roles:[roles];
  if(roles && !allowed.includes(s.role)){
    location.href = destinationForRole(s.role);
    throw new Error('Wrong role');
  }
  return s;
}
async function clearAllAppData(confirmCode){
  const expected = '943003';
  if(String(confirmCode||'').trim() !== expected) throw new Error('รหัสล้างข้อมูลไม่ถูกต้อง');
  if(isFirebaseReady() && window.firebaseHelpers?.replaceAllData){
    await window.firebaseHelpers.replaceAllData({tasks:[], logs:[]});
  }else{
    saveLocalData({tasks:[], logs:[]});
  }
  return true;
}
function loadLocalData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{"tasks":[],"logs":[]}')}catch{return {"tasks":[],"logs":[]}}}
function saveLocalData(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function isFirebaseReady(){return !!window.FIREBASE_ENABLED&&!!window.firebaseHelpers}
async function getData(){return isFirebaseReady()?await window.firebaseHelpers.getData():loadLocalData()}
async function saveData(data){if(isFirebaseReady())return await window.firebaseHelpers.replaceAllData(data);saveLocalData(data)}
async function getTasks(){const d=await getData();return d.tasks||[]}
async function getLogs(){const d=await getData();return d.logs||[]}
async function updateTask(task){
  if(isFirebaseReady()) return await window.firebaseHelpers.upsertTask(task);
  const d=loadLocalData(); const i=d.tasks.findIndex(t=>t.id===task.id);
  if(i>=0)d.tasks[i]=task; else d.tasks.unshift(task);
  saveLocalData(d);
}
async function deleteTaskById(id){
  if(isFirebaseReady()) return await window.firebaseHelpers.deleteTask(id);
  const d=loadLocalData(); d.tasks=d.tasks.filter(t=>t.id!==id); saveLocalData(d);
}
async function addLog(logItem){
  if(isFirebaseReady()) return await window.firebaseHelpers.addLog(logItem);
  const d=loadLocalData(); d.logs.unshift(logItem); saveLocalData(d);
}
async function closeTaskToLog(id, closedBy){
  const data = await getData();
  const t = (data.tasks||[]).find(x=>x.id===id);
  if(!t) return;
  const now = new Date().toISOString();
  const closed = {
    ...t,
    closedAt: now,
    closedByFO: closedBy,
    lifecycleStatus: 'Closed by FO',
    totalMinutes: calculateTotalMinutes(t.createdAt, now)
  };
  data.tasks = (data.tasks||[]).filter(x=>x.id!==id);
  data.logs = data.logs||[];
  data.logs.unshift(closed);
  await saveData(data);
}
function calculateTotalMinutes(start,end){
  if(!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end)-new Date(start))/60000));
}
function isOverdue(task){return task.dueAt&&!['Closed by FO'].includes(task.status)&&new Date(task.dueAt).getTime()<Date.now()}
function statusBadge(task){
  const status = normalizeStatus(task.status||task.lifecycleStatus||'-');
  let statusCls = 'badge';
  if(status==='New from FO') statusCls += ' status-new';
  else if(status==='In Progress') statusCls += ' status-progress';
  else if(status==='Done by HK' || status==='Closed by FO') statusCls += ' status-done';
  return `<span class="${statusCls}">${escapeHtml(task.status||task.lifecycleStatus||'-')}</span>${task.priority==='Urgent'?'<span class="badge urgent">Urgent</span>':''}${isOverdue(task)?'<span class="badge urgent">Overdue</span>':''}${task.pushEnabled?'<span class="badge alert">Popup Alert</span>':''}`
}
function fileToDataURL(file){
  return new Promise(resolve=>{
    const r=new FileReader();
    r.onload=()=>resolve({name:file.name,data:r.result,originalSize:file.size,compressed:false});
    r.readAsDataURL(file);
  });
}
function loadImageElement(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{ URL.revokeObjectURL(url); resolve(img); };
    img.onerror=(e)=>{ URL.revokeObjectURL(url); reject(e); };
    img.src=url;
  });
}
async function compressImageFile(file, opts={}){
  if(!(file?.type||'').startsWith('image/')) return fileToDataURL(file);
  const settings={maxWidth: opts.maxWidth||1600, maxHeight: opts.maxHeight||1600, quality: opts.quality||0.78};
  try{
    const img=await loadImageElement(file);
    const ratio=Math.min(1, settings.maxWidth/img.width, settings.maxHeight/img.height);
    const width=Math.max(1, Math.round(img.width*ratio));
    const height=Math.max(1, Math.round(img.height*ratio));
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d', {alpha:false});
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(img,0,0,width,height);
    const data=canvas.toDataURL('image/jpeg', settings.quality);
    return {name:file.name.replace(/\.[^.]+$/, '') + '.jpg', data, originalSize:file.size, compressed:true, width, height};
  }catch(err){
    console.warn('compressImageFile fallback', err);
    return fileToDataURL(file);
  }
}
async function readFiles(files){
  return Promise.all([...files].map(file=>compressImageFile(file)));
}
async function seedData(force=false){
  const current=await getData();
  if((current.tasks||[]).length&&!force)return;
  const demoTasks=[
    { title:'Room Ready ด่วน', outlet:'Hotel', roomNumber:'A105', room:'A105', desc:'แขก Early Check-in จะมาถึงภายใน 20 นาที', department:'Front Office', taskType:'Room Ready', requestedBy:'FO Main', assignee:'HK Team', priority:'Urgent', dueAt:nowIsoLocal(), roomStatus:'Vacant Dirty', status:'In Progress', images:[], comments:[{at:new Date().toISOString(),by:'FO Main',text:'FO เปิดงานตัวอย่าง'},{at:new Date().toISOString(),by:'HK Team',text:'เริ่มดำเนินการแล้ว'}], createdBy:'FO Main', createdAt:new Date().toISOString(), pushEnabled:true, startedAt:new Date().toISOString() },
    { title:'ส่งผ้าเช็ดตัวเพิ่ม', outlet:'Hotel', roomNumber:'D308', room:'D308', desc:'แขกขอผ้าเพิ่ม 2 ผืน', department:'Front Office', taskType:'Guest Request', requestedBy:'FO Main', assignee:'HK Team', priority:'High', dueAt:nowIsoLocal(), roomStatus:'Occupied', status:'In Progress', images:[], comments:[{at:new Date().toISOString(),by:'FO Main',text:'FO เปิดงานตัวอย่าง'}], createdBy:'FO Main', createdAt:new Date().toISOString(), pushEnabled:true, startedAt:new Date().toISOString() },
    { title:'อัปเดตห้องพร้อมขาย', outlet:'Hotel', roomNumber:'C212', room:'C212', desc:'HK แจ้งว่าแม่บ้านทำเสร็จแล้ว รอ FO ปิดงาน', department:'Front Office', taskType:'Room Status Update', requestedBy:'FO Main', assignee:'HK Team', priority:'Medium', dueAt:nowIsoLocal(), roomStatus:'Vacant Clean', status:'Done by HK', images:[], comments:[{at:new Date().toISOString(),by:'HK Team',text:'ทำเสร็จแล้ว'}], createdBy:'FO Main', createdAt:new Date().toISOString(), pushEnabled:true, startedAt:new Date().toISOString(), doneAt:new Date().toISOString() },
    { title:'ทำความสะอาดห้องด่วน', outlet:'Hotel', roomNumber:'A103', room:'A103', desc:'แขกกำลังจะ check-in', department:'Front Office', taskType:'Room Ready', requestedBy:'FO Main', assignee:'', priority:'High', dueAt:nowIsoLocal(), roomStatus:'Vacant Dirty', status:'New from FO', images:[], comments:[{at:new Date().toISOString(),by:'FO Main',text:'เปิดงานใหม่'}], createdBy:'FO Main', createdAt:new Date().toISOString(), pushEnabled:true }
  ].map(t=>({id:uid(),...t}));
  const demoLog=[{
    id: uid(), title:'งานตัวอย่างปิดแล้ว', outlet:'Hotel', roomNumber:'B201', room:'B201',
    desc:'งานนี้ถูกปิดและย้ายเข้า log แล้ว', taskType:'Guest Request', requestedBy:'FO Main', assignee:'HK Team',
    priority:'Medium', createdAt:new Date(Date.now()-3600_000).toISOString(),
    startedAt:new Date(Date.now()-3000_000).toISOString(),
    doneAt:new Date(Date.now()-1800_000).toISOString(),
    closedAt:new Date(Date.now()-900_000).toISOString(),
    closedByFO:'FO Main', lifecycleStatus:'Closed by FO', totalMinutes:45, comments:[]
  }];
  await saveData({tasks:demoTasks, logs:demoLog});
}
function taskLocationText(t){return [t.outlet,t.room?'ห้อง '+t.room:''].filter(Boolean).join(' • ')}
async function renderTaskDetail(id,targetId='taskDetail', source='tasks'){
  const d=await getData(); const arr=source==='logs'?(d.logs||[]):(d.tasks||[]);
  const t=arr.find(x=>x.id===id);if(!t)return;
  document.getElementById(targetId).innerHTML=`<div class="detail-shell">
    <div class="detail-header">
      <div class="room-chip detail-room-chip">${escapeHtml(t.room||'-')}</div>
      <div class="detail-head-copy">
        <h2>${escapeHtml(t.title)}</h2>
        <div class="small">${escapeHtml(taskLocationText(t))}</div>
      </div>
    </div>
    <div class="badges">${statusBadge(t)}</div>
    <div class="detail-grid">
      <div class="detail-card detail-card-wide">
        <div class="detail-label">รายละเอียด</div>
        <div class="detail-value">${escapeHtml(t.desc||'-')}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">ผู้เกี่ยวข้อง</div>
        <div class="detail-value"><strong>FO:</strong> ${escapeHtml(t.requestedBy||'-')}<br><strong>HK:</strong> ${escapeHtml(t.assignee||'-')}</div>
      </div>
      <div class="detail-card">
        <div class="detail-label">ข้อมูลงาน</div>
        <div class="detail-value"><strong>ประเภทงาน:</strong> ${escapeHtml(t.taskType||'-')}<br><strong>Priority:</strong> ${escapeHtml(t.priority||'-')}</div>
      </div>
      <div class="detail-card detail-card-wide">
        <div class="detail-label">Timeline</div>
        <div class="detail-value"><strong>เปิดงาน:</strong> ${fmtDate(t.createdAt)}<br><strong>เริ่มงาน:</strong> ${fmtDate(t.startedAt)}<br><strong>เสร็จ:</strong> ${fmtDate(t.doneAt)}<br><strong>ปิดงาน:</strong> ${fmtDate(t.closedAt)}${t.totalMinutes!==undefined?`<br><strong>รวมเวลา:</strong> ${t.totalMinutes} นาที`:''}</div>
      </div>
    </div>
    <h3>รูปผลงาน</h3>
    <div class="detail-media">${(t.images||[]).length?t.images.map(img=>`<img class="preview" src="${img.data}" alt="${escapeHtml(img.name)}">`).join(''):'<div class="small">ยังไม่มีรูป</div>'}</div>
    <h3>คอมเมนต์</h3>
    <div class="detail-comments">${(t.comments||[]).length?t.comments.map(c=>`<div class="task detail-comment"><div><strong>${escapeHtml(c.by||'-')}</strong> <span class="small">${fmtDate(c.at)}</span></div><div>${escapeHtml(c.text)}</div></div>`).join(''):'<div class="small">ยังไม่มีคอมเมนต์</div>'}</div>
  </div>`;
}
function toast(msg){alert(msg)}
function firebaseStatusHTML(state, detail=''){
  const map = {
    checking: {label:'กำลังตรวจสอบ Firebase...', cls:'badge'},
    connected: {label:'เชื่อม Firebase สำเร็จ', cls:'badge ok'},
    config_only: {label:'พบ config แล้ว แต่ Firebase ยังไม่พร้อม', cls:'badge urgent'},
    local: {label:'กำลังใช้ Local Mode', cls:'badge urgent'},
    error: {label:'Firebase มีปัญหา', cls:'badge urgent'}
  };
  const item = map[state] || map.error;
  return `<span class="${item.cls}">${item.label}</span>${detail ? ` <span class="small">${escapeHtml(detail)}</span>` : ''}`;
}
function setFirebaseStatus(elId, state, detail=''){
  const el = document.getElementById(elId);
  if(!el) return;
  el.innerHTML = firebaseStatusHTML(state, detail);
}
async function checkFirebaseConnection(){
  try{
    if(!window.FIREBASE_ENABLED){
      return {ok:false, mode:'local', detail:'ยังไม่ได้ใส่ค่า Firebase config ครบ'};
    }
    let tries = 0;
    while((!window.firebaseHelpers || !window.firebaseHelpers.getData) && tries < 30){
      await new Promise(r=>setTimeout(r, 200));
      tries++;
    }
    if(!window.firebaseHelpers || !window.firebaseHelpers.getData){
      return {ok:false, mode:'config_only', detail:'โหลด Firebase helper ไม่สำเร็จ'};
    }
    const info = window.firebaseHelpers.getConnectionInfo ? window.firebaseHelpers.getConnectionInfo() : null;
    const detail = info ? `พร้อมใช้งาน${info.cacheEnabled ? ' • cache on' : ''} • Tasks: ${info.taskCount} • Logs: ${info.logCount}` : 'พร้อมใช้งาน';
    return { ok:true, mode:'connected', detail };
  }catch(err){
    return {ok:false, mode:'error', detail: err?.message || 'เชื่อมต่อไม่ได้'};
  }
}


function normalizeStatus(status){
  return typeof status === 'string' ? status.trim() : '';
}
function isActiveBoardStatus(status){
  return ACTIVE_STATUSES.has(normalizeStatus(status));
}
function splitActiveAndLegacyTasks(tasks){
  const active = [];
  const legacy = [];
  for(const t of (tasks||[])){
    if(isActiveBoardStatus(t.status)) active.push(t);
    else legacy.push(t);
  }
  return {active, legacy};
}

async function enableNotificationsForCurrentUser(session, elId){
  try{
    if(!isFirebaseReady()) throw new Error('ยังไม่ได้เชื่อม Firebase');
    setFirebaseStatus(elId,'checking','กำลังเปิดการแจ้งเตือน...');
    await window.firebaseHelpers.registerDeviceToken(session);
    const fb = await checkFirebaseConnection();
    if(fb.ok) setFirebaseStatus(elId,'connected', (fb.detail ? fb.detail + ' • เปิดแจ้งเตือนแล้ว' : 'เปิดแจ้งเตือนแล้ว'));
    else setFirebaseStatus(elId,'connected','เปิดแจ้งเตือนแล้ว');
    alert('เปิดแจ้งเตือนสำเร็จ');
  }catch(err){
    setFirebaseStatus(elId,'error', err?.message || 'เปิดแจ้งเตือนไม่สำเร็จ');
    alert('เปิดแจ้งเตือนไม่สำเร็จ: ' + (err?.message || 'unknown'));
  }
}

async function loadTokenStatus(){
  if(!isFirebaseReady() || !window.firebaseHelpers?.listDeviceTokens){
    return {ok:false, tokens:[], hk:[], fo:[], supervisor:[]};
  }
  try{
    const tokens = await window.firebaseHelpers.listDeviceTokens();
    return {
      ok:true,
      tokens,
      hk: tokens.filter(t => (t.role||'') === 'hk' && t.enabled !== false),
      fo: tokens.filter(t => (t.role||'') === 'fo' && t.enabled !== false),
      supervisor: tokens.filter(t => (t.role||'') === 'supervisor' && t.enabled !== false),
    };
  }catch(err){
    return {ok:false, error: err?.message || 'โหลด token ไม่สำเร็จ', tokens:[], hk:[], fo:[], supervisor:[]};
  }
}
function renderTokenRows(tokens){
  if(!tokens?.length) return '<div class="small">ยังไม่มีเครื่องที่ลงทะเบียน</div>';
  return tokens.map((t, i)=>`<div class="token-row"><div><strong>${escapeHtml(t.userName||'ไม่ระบุชื่อ')}</strong> <span class="small">(${escapeHtml(t.role||'-')})</span></div><div class="small">${escapeHtml(t.userAgent||'-')}</div><div class="small">อัปเดตล่าสุด: ${fmtDate(t.updatedAt)}</div></div>`).join('');
}

function forceHKOnly(session){
  if(session.role !== 'hk'){
    window.location.href = 'hk.html';
  }
}

let __lastSeenTaskIds = new Set();
function initializeSeenTasks(tasks){
  __lastSeenTaskIds = new Set((tasks||[]).map(t => t.id));
}
function playNewTaskAlert(){
  return;
}
function vibrateNewTask(){
  try{
    if(navigator.vibrate) navigator.vibrate([200,100,200,100,200,100,200,100,200]);
  }catch(e){}
}
function alertForNewTasks(tasks, filterFn){
  const list = (tasks||[]).filter(t => !filterFn || filterFn(t));
  const currentIds = new Set(list.map(t => t.id));
  let hasNew = false;
  for(const t of list){
    if(!__lastSeenTaskIds.has(t.id)){
      hasNew = true;
      break;
    }
  }
  if(hasNew){
    playNewTaskAlert();
    vibrateNewTask();
  }
  __lastSeenTaskIds = currentIds;
}

async function runNotificationDiagnostics(){
  const result = {
    location: window.location.href,
    origin: window.location.origin,
    permission: ('Notification' in window) ? Notification.permission : 'unsupported',
    serviceWorkerSupported: 'serviceWorker' in navigator,
    firebaseEnabled: !!window.FIREBASE_ENABLED,
    helperReady: !!window.firebaseHelpers,
    registrations: 0,
    swScriptExpected: window.location.origin + '/HK_task/firebase-messaging-sw.js'
  };
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      result.registrations = regs.length;
      result.registrationScopes = regs.map(r => r.scope);
    }
  }catch(err){
    result.registrationError = err && err.message ? err.message : String(err);
  }
  return result;
}
function diagnosticsHTML(d){
  const lines = [
    'Permission: ' + escapeHtml(String(d.permission)),
    'SW Support: ' + (d.serviceWorkerSupported ? 'Yes' : 'No'),
    'Firebase: ' + (d.firebaseEnabled ? 'Enabled' : 'Disabled'),
    'Helper: ' + (d.helperReady ? 'Ready' : 'Not Ready'),
    'SW Registered: ' + String(d.registrations || 0)
  ];
  return '<div class="small">' + lines.join(' • ') + '</div>';
}

function vibrateStatusUpdate(){
  try{
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
  }catch(e){}
}


window.createOrUpdateUser = createOrUpdateUser;
window.removeUser = removeUser;
window.ensureUsersReady = ensureUsersReady;
window.getUsersSnapshot = getUsersSnapshot;
window.findUserByCode = findUserByCode;
window.usersByRole = usersByRole;
window.roleLabel = roleLabel;

