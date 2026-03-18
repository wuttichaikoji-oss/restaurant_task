
const STORAGE_KEY='hk_tasks_v1_9', SESSION_KEY='hk_session_v1_9';
const STATUSES=['New from FO','In Progress','Done by HK'];
const ACTIVE_STATUSES = new Set(STATUSES);
const USERS=window.APP_USERS||[];
const fmtDate=d=>d?new Date(d).toLocaleString('th-TH'):'-';
const uid=()=>Math.random().toString(36).slice(2,10);
const nowIsoLocal=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function escapeHtml(str){return String(str??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
function logout(){localStorage.removeItem(SESSION_KEY);location.href='index.html';}
function login(code){
  const u=USERS.find(x=>x.code===String(code).trim());
  if(!u)return false;
  saveSession({name:u.name,role:u.role,code:u.code,department:u.department||'',loginAt:new Date().toISOString()});
  if(u.role==='fo') location.href='fo.html';
  else if(u.role==='hk') location.href='hk.html';
  else location.href='board.html';
  return true;
}
function requireRole(roles){
  const s=loadSession();
  if(!s){location.href='index.html';throw new Error('No session')}
  const allowed = Array.isArray(roles)?roles:[roles];
  if(roles && !allowed.includes(s.role)){
    if(s.role==='fo') location.href='fo.html';
    else if(s.role==='hk') location.href='hk.html';
    else location.href='board.html';
    throw new Error('Wrong role');
  }
  return s;
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
function statusBadge(task){return `<span class="badge">${escapeHtml(task.status||task.lifecycleStatus||'-')}</span>${task.priority==='Urgent'?'<span class="badge urgent">Urgent</span>':''}${isOverdue(task)?'<span class="badge urgent">Overdue</span>':''}${task.pushEnabled?'<span class="badge ok">Push</span>':''}`}
function readFiles(files){return Promise.all([...files].map(f=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve({name:f.name,data:r.result});r.readAsDataURL(f)})))}
async function seedData(force=false){
  const current=await getData();
  if((current.tasks||[]).length&&!force)return;
  const demoTasks=[
    { title:'Room Ready ด่วน', outlet:'Hotel', roomNumber:'A105', room:'A105', desc:'แขก Early Check-in จะมาถึงภายใน 20 นาที', department:'Front Office', taskType:'Room Ready', requestedBy:'FO A', assignee:'HK A', priority:'Urgent', dueAt:nowIsoLocal(), roomStatus:'Vacant Dirty', status:'In Progress', images:[], comments:[{at:new Date().toISOString(),by:'FO A',text:'FO เปิดงานตัวอย่าง'},{at:new Date().toISOString(),by:'HK A',text:'เริ่มดำเนินการแล้ว'}], createdBy:'FO A', createdAt:new Date().toISOString(), pushEnabled:true, startedAt:new Date().toISOString() },
    { title:'ส่งผ้าเช็ดตัวเพิ่ม', outlet:'Hotel', roomNumber:'D308', room:'D308', desc:'แขกขอผ้าเพิ่ม 2 ผืน', department:'Front Office', taskType:'Guest Request', requestedBy:'FO B', assignee:'HK B', priority:'High', dueAt:nowIsoLocal(), roomStatus:'Occupied', status:'In Progress', images:[], comments:[{at:new Date().toISOString(),by:'FO B',text:'FO เปิดงานตัวอย่าง'}], createdBy:'FO B', createdAt:new Date().toISOString(), pushEnabled:true, startedAt:new Date().toISOString() },
    { title:'อัปเดตห้องพร้อมขาย', outlet:'Hotel', roomNumber:'C212', room:'C212', desc:'HK แจ้งว่าแม่บ้านทำเสร็จแล้ว รอ FO ปิดงาน', department:'Front Office', taskType:'Room Status Update', requestedBy:'FO A', assignee:'HK A', priority:'Medium', dueAt:nowIsoLocal(), roomStatus:'Vacant Clean', status:'Done by HK', images:[], comments:[{at:new Date().toISOString(),by:'HK A',text:'ทำเสร็จแล้ว'}], createdBy:'FO A', createdAt:new Date().toISOString(), pushEnabled:true, startedAt:new Date().toISOString(), doneAt:new Date().toISOString() },
    { title:'ทำความสะอาดห้องด่วน', outlet:'Hotel', roomNumber:'A103', room:'A103', desc:'แขกกำลังจะ check-in', department:'Front Office', taskType:'Room Ready', requestedBy:'FO A', assignee:'HK AAAA', priority:'High', dueAt:nowIsoLocal(), roomStatus:'Vacant Dirty', status:'New from FO', images:[], comments:[{at:new Date().toISOString(),by:'FO A',text:'เปิดงานใหม่'}], createdBy:'FO A', createdAt:new Date().toISOString(), pushEnabled:true }
  ].map(t=>({id:uid(),...t}));
  const demoLog=[{
    id: uid(), title:'งานตัวอย่างปิดแล้ว', outlet:'Hotel', roomNumber:'B201', room:'B201',
    desc:'งานนี้ถูกปิดและย้ายเข้า log แล้ว', taskType:'Guest Request', requestedBy:'FO B', assignee:'HK B',
    priority:'Medium', createdAt:new Date(Date.now()-3600_000).toISOString(),
    startedAt:new Date(Date.now()-3000_000).toISOString(),
    doneAt:new Date(Date.now()-1800_000).toISOString(),
    closedAt:new Date(Date.now()-900_000).toISOString(),
    closedByFO:'FO B', lifecycleStatus:'Closed by FO', totalMinutes:45, comments:[]
  }];
  await saveData({tasks:demoTasks, logs:demoLog});
}
function taskLocationText(t){return [t.outlet,t.room?'ห้อง '+t.room:''].filter(Boolean).join(' • ')}
async function renderTaskDetail(id,targetId='taskDetail', source='tasks'){
  const d=await getData(); const arr=source==='logs'?(d.logs||[]):(d.tasks||[]);
  const t=arr.find(x=>x.id===id);if(!t)return;
  document.getElementById(targetId).innerHTML=`<h2 style="margin-top:0">${escapeHtml(t.title)}</h2>
  <div class="small">${escapeHtml(taskLocationText(t))}</div>
  <p><strong>รายละเอียด:</strong> ${escapeHtml(t.desc||'-')}</p>
  <p><strong>FO:</strong> ${escapeHtml(t.requestedBy||'-')} • <strong>HK:</strong> ${escapeHtml(t.assignee||'-')}</p>
  <p><strong>ประเภทงาน:</strong> ${escapeHtml(t.taskType||'-')} • <strong>สถานะห้อง:</strong> ${escapeHtml(t.roomStatus||'-')}</p>
  <p><strong>เปิดงาน:</strong> ${fmtDate(t.createdAt)} • <strong>เริ่มงาน:</strong> ${fmtDate(t.startedAt)} • <strong>เสร็จ:</strong> ${fmtDate(t.doneAt)} • <strong>ปิดงาน:</strong> ${fmtDate(t.closedAt)}</p>
  ${t.totalMinutes!==undefined?`<p><strong>รวมเวลา:</strong> ${t.totalMinutes} นาที</p>`:''}
  <div class="badges">${statusBadge(t)}</div>
  <h3>รูปผลงาน</h3>
  <div>${(t.images||[]).length?t.images.map(img=>`<img class="preview" src="${img.data}" alt="${escapeHtml(img.name)}">`).join(''):'<div class="small">ยังไม่มีรูป</div>'}</div>
  <h3>คอมเมนต์</h3>
  <div>${(t.comments||[]).length?t.comments.map(c=>`<div class="task"><div><strong>${escapeHtml(c.by||'-')}</strong> <span class="small">${fmtDate(c.at)}</span></div><div>${escapeHtml(c.text)}</div></div>`).join(''):'<div class="small">ยังไม่มีคอมเมนต์</div>'}</div>`;
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
    const data = await window.firebaseHelpers.getData();
    return {
      ok:true,
      mode:'connected',
      detail:`Tasks: ${(data.tasks||[]).length}, Logs: ${(data.logs||[]).length}`
    };
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
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.36);
  }catch(e){}
}
function vibrateNewTask(){
  try{
    if(navigator.vibrate) navigator.vibrate([180,80,180]);
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
