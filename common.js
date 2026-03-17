
const STORAGE_KEY='hkfo_tasks_v1_7', SESSION_KEY='hkfo_session_v1_7';
const STATUSES=['New','Assigned','In Progress','Waiting Approval','Approved','Rework'];
const USERS=window.APP_USERS||[];
const fmtDate=d=>d?new Date(d).toLocaleString('th-TH'):'-';
const uid=()=>Math.random().toString(36).slice(2,10);
const nowIsoLocal=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function escapeHtml(str){return String(str??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
function logout(){localStorage.removeItem(SESSION_KEY);location.href='index.html';}
function login(code){const u=USERS.find(x=>x.code===String(code).trim());if(!u)return false;saveSession({name:u.name,role:u.role,code:u.code,department:u.department||'',loginAt:new Date().toISOString()});location.href=u.role==='supervisor'?'supervisor.html':'board.html';return true;}
function requireRole(role){const s=loadSession();if(!s){location.href='index.html';throw new Error('No session')}if(role&&s.role!==role){location.href=s.role==='supervisor'?'supervisor.html':'board.html';throw new Error('Wrong role')}return s;}
function loadLocalTasks(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return []}}
function saveLocalTasks(tasks){localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks))}
function isFirebaseReady(){return !!window.FIREBASE_ENABLED&&!!window.firebaseHelpers}
async function getTasks(){return isFirebaseReady()?await window.firebaseHelpers.getTasks():loadLocalTasks()}
async function saveTasks(tasks){if(isFirebaseReady())return await window.firebaseHelpers.replaceAllTasks(tasks);saveLocalTasks(tasks)}
async function updateTask(task){if(isFirebaseReady())return await window.firebaseHelpers.upsertTask(task);const tasks=loadLocalTasks();const i=tasks.findIndex(t=>t.id===task.id);if(i>=0)tasks[i]=task;else tasks.unshift(task);saveLocalTasks(tasks)}
async function deleteTaskById(id){if(isFirebaseReady())return await window.firebaseHelpers.deleteTask(id);saveLocalTasks(loadLocalTasks().filter(t=>t.id!==id))}
function isOverdue(task){return task.dueAt&&!['Approved'].includes(task.status)&&new Date(task.dueAt).getTime()<Date.now()}
function statusBadge(task){return `<span class="badge">${escapeHtml(task.status)}</span>${task.priority==='Urgent'?'<span class="badge urgent">Urgent</span>':''}${isOverdue(task)?'<span class="badge urgent">Overdue</span>':''}${task.pushEnabled?'<span class="badge ok">Push</span>':''}`}
function readFiles(files){return Promise.all([...files].map(f=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve({name:f.name,data:r.result});r.readAsDataURL(f)})))}
async function seedData(force=false){
  const current=await getTasks();
  if(current.length&&!force)return;
  const demo=[
    { title:'ห้อง A105 เร่งทำ Room Ready', outlet:'Hotel', building:'A', floor:'1', roomNumber:'105', room:'A105', desc:'แขกจะ arrive เร็ว ให้เตรียมห้องด่วน', department:'HouseKeeping', taskType:'Room Ready', assignee:'Staff A', priority:'Urgent', dueAt:nowIsoLocal(), roomStatus:'Vacant Dirty', status:'Assigned', images:[], comments:[{at:new Date().toISOString(),by:'หัวหน้า HK',text:'สร้างงานตัวอย่าง'}], createdBy:'หัวหน้า HK', pushEnabled:true },
    { title:'นำผ้าเช็ดตัวเพิ่มห้อง D308', outlet:'Hotel', building:'D', floor:'3', roomNumber:'308', room:'D308', desc:'Guest Request จาก Front Office', department:'Front Office', taskType:'Guest Request', assignee:'Staff B', priority:'High', dueAt:nowIsoLocal(), roomStatus:'Occupied', status:'In Progress', images:[], comments:[{at:new Date().toISOString(),by:'หัวหน้า FO',text:'สร้างงานตัวอย่าง'}], createdBy:'หัวหน้า FO', pushEnabled:true },
    { title:'อัปเดตห้อง C212 เป็น Vacant Clean', outlet:'Hotel', building:'C', floor:'2', roomNumber:'212', room:'C212', desc:'หลังแม่บ้านทำเสร็จ ให้แจ้ง FO อัปเดตสถานะห้อง', department:'Front Office', taskType:'Room Status Update', assignee:'Staff C', priority:'Medium', dueAt:nowIsoLocal(), roomStatus:'Vacant Clean', status:'Waiting Approval', images:[], comments:[{at:new Date().toISOString(),by:'หัวหน้า HK',text:'สร้างงานตัวอย่าง'}], createdBy:'หัวหน้า HK', pushEnabled:true }
  ].map(t=>({id:uid(),createdAt:new Date().toISOString(),...t}));
  await saveTasks(demo);
}
function taskLocationText(t){return [t.outlet,t.building?'ตึก '+t.building:'',t.floor?'ชั้น '+t.floor:'',t.room?'ห้อง '+t.room:''].filter(Boolean).join(' • ')}
async function renderTaskDetail(id,targetId='taskDetail'){const t=(await getTasks()).find(x=>x.id===id);if(!t)return;document.getElementById(targetId).innerHTML=`<h2 style="margin-top:0">${escapeHtml(t.title)}</h2><div class="small">${escapeHtml(taskLocationText(t))} • ผู้รับผิดชอบ: ${escapeHtml(t.assignee||'-')}</div><p><strong>รายละเอียด:</strong> ${escapeHtml(t.desc||'-')}</p><p><strong>แผนก:</strong> ${escapeHtml(t.department||'-')} • <strong>ประเภทงาน:</strong> ${escapeHtml(t.taskType||'-')}</p><p><strong>สถานะห้อง:</strong> ${escapeHtml(t.roomStatus||'-')} • <strong>กำหนด:</strong> ${fmtDate(t.dueAt)}</p><div class="badges">${statusBadge(t)}</div><h3>รูปผลงาน</h3><div>${(t.images||[]).length?t.images.map(img=>`<img class="preview" src="${img.data}" alt="${escapeHtml(img.name)}">`).join(''):'<div class="small">ยังไม่มีรูป</div>'}</div><h3>คอมเมนต์</h3><div>${(t.comments||[]).length?t.comments.map(c=>`<div class="task"><div><strong>${escapeHtml(c.by||'-')}</strong> <span class="small">${fmtDate(c.at)}</span></div><div>${escapeHtml(c.text)}</div></div>`).join(''):'<div class="small">ยังไม่มีคอมเมนต์</div>'}</div>`}
function applyBoardFilters(tasks,f){return tasks.filter(t=>{if(f.status&&t.status!==f.status)return false;if(f.outlet&&(t.outlet||'')!==f.outlet)return false;if(f.building&&(t.building||'')!==f.building)return false;if(f.floor&&String(t.floor||'')!==String(f.floor))return false;if(f.room&&!String(t.room||'').toLowerCase().includes(String(f.room).toLowerCase()))return false;return true})}
function toast(msg){alert(msg)}
