const $=s=>document.querySelector(s);
let ME={id:'none',role:'user'};
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLORS={Now:['#cbfec9','#ebd3ff','#dfc3ff'],Next:['#fff3a1','#c3e2ff'],Later:['#ffd1ea','#cbfec9']};
let S={tasks:[],theme:'white'},saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>api('/api/board','PUT',S).catch(e=>{if(e.status===401)location.replace('login.html');else toast('⚠️ Not saved: '+e.message)}),350)}
const pad=n=>String(n).padStart(2,'0');
const key=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const todayStr=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,undo)=>{const d=document.createElement('div');d.textContent=m;if(undo){const b=document.createElement('button');b.textContent='↩ Undo';b.className='mini';b.onclick=()=>{undo();d.remove()};d.append(b)}$('#toast').append(d);setTimeout(()=>d.remove(),undo?6000:2500)};
const uid=()=>'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

/* ---------- Philippine holidays (common list; movable/Islamic ones need yearly proclamation) ---------- */
const hCache={};
function holidays(y){
  if(hCache[y])return hCache[y];
  const h={},add=(m,d,n)=>h[key(y,m-1,d)]=n;
  add(1,1,"New Year's Day");add(2,25,'EDSA Revolution Anniv.');add(4,9,'Araw ng Kagitingan');
  add(5,1,'Labor Day');add(6,12,'Independence Day');add(8,21,'Ninoy Aquino Day');
  add(11,1,"All Saints' Day");add(11,2,"All Souls' Day");add(11,30,'Bonifacio Day');
  add(12,8,'Immaculate Conception');add(12,24,'Christmas Eve');add(12,25,'Christmas Day');
  add(12,30,'Rizal Day');add(12,31,"New Year's Eve");
  const cny={2026:[2,17],2027:[2,6],2028:[1,26]};if(cny[y])add(cny[y][0],cny[y][1],'Chinese New Year');
  const d=new Date(Date.UTC(y,7,31));while(d.getUTCDay()!==1)d.setUTCDate(d.getUTCDate()-1);
  add(8,d.getUTCDate(),'National Heroes Day');
  // Easter (Gregorian) -> Holy Week
  const a=y%19,b=Math.floor(y/100),c=y%100,dd=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
  hh=(19*a+b-dd-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-hh-k)%7,m=Math.floor((a+11*hh+22*l)/451),
  mo=Math.floor((hh+l-7*m+114)/31),da=((hh+l-7*m+114)%31)+1;
  [[-3,'Maundy Thursday'],[-2,'Good Friday'],[-1,'Black Saturday'],[0,'Easter Sunday']].forEach(([o,n])=>{
    const t=new Date(Date.UTC(y,mo-1,da+o));add(t.getUTCMonth()+1,t.getUTCDate(),n)});
  return hCache[y]=h;
}

/* ---------- state ---------- */
const t0=todayStr().split('-').map(Number);
let vy=t0[0],vm=t0[1]-1,openDate=null,view='board',editId=null,dragId=null,calMode='month',wkStart=null;
const act=d=>S.tasks.filter(t=>t.date===d&&t.status==='active');
const PO={Now:0,Next:1,Later:2};
const sortAct=l=>l.slice().sort((a,b)=>(b.pinned-a.pinned)||(a.time||'99').localeCompare(b.time||'99')||PO[a.priority]-PO[b.priority]);

/* ---------- calendar ---------- */
function cellHTML(k,tds,wk){
  const list=sortAct(act(k)),hol=holidays(+k.slice(0,4))[k],lim=wk?99:2;
  return `<div class="cell${wk?' wk':''}${hol?' hol':''}${k===tds?' tdy':''}" role="button" tabindex="0" data-d="${k}" data-drop="date">
    <span class="n"><span>${wk?DN[wd(k)]+' ':''}${+k.slice(8)}</span>${list.length?`<em>${list.length}</em>`:''}</span>
    ${hol?`<span class="h">${esc(hol)}</span>`:''}
    ${list.slice(0,lim).map(t=>`<span class="chip" draggable="true" data-id="${t.id}" style="background:${t.color}">${t.time?fmtT(t.time)+' ':''}${esc(t.title)}</span>`).join('')}
    ${list.length>lim?`<span class="h">+${list.length-lim} more</span>`:''}</div>`;
}
function renderCal(){
  const tds=todayStr();let out='';
  if(calMode==='week'){
    const ws=wkStart||(wkStart=addDays(tds,-wd(tds))),we=addDays(ws,6);
    [ws,we].forEach(k=>ensureMonth(+k.slice(0,4),+k.slice(5,7)-1));
    const f=(k,o)=>new Date(k+'T00:00:00').toLocaleDateString('en-PH',o);
    $('#monthTitle').textContent=`${f(ws,{month:'short',day:'numeric'})} – ${f(we,{month:'short',day:'numeric',year:'numeric'})}`;
    for(let i=0;i<7;i++)out+=cellHTML(addDays(ws,i),tds,true);
  }else{
    ensureMonth();
    $('#monthTitle').textContent=`${MONTHS[vm]} ${vy}`;
    const first=new Date(vy,vm,1).getDay(),dim=new Date(vy,vm+1,0).getDate();
    for(let i=0;i<first;i++)out+='<div></div>';
    for(let d=1;d<=dim;d++)out+=cellHTML(key(vy,vm,d),tds,false);
  }
  $('#days').innerHTML=out;
  document.querySelectorAll('.grid').forEach(g=>g.classList.toggle('weekmode',calMode==='week'));
  const A=S.tasks.filter(t=>t.status==='active');
  $('#sActive').textContent=A.length;
  $('#sDone').textContent=S.tasks.filter(t=>t.status==='done').length;
  $('#sOver').textContent=A.filter(t=>t.date&&t.date<tds).length;
  renderDash();
}
$('#days').onclick=e=>{const c=e.target.closest('.cell');if(c)openBoard(c.dataset.d)};
function step(n){if(calMode==='week'){wkStart=addDays(wkStart,7*n)}else{vm+=n;if(vm<0){vm=11;vy--}if(vm>11){vm=0;vy++}}renderCal()}
$('#prev').onclick=()=>step(-1);$('#next').onclick=()=>step(1);
$('#goToday').onclick=()=>{vy=t0[0];vm=t0[1]-1;wkStart=null;if(calMode==='week'){const t=todayStr();wkStart=addDays(t,-wd(t))}renderCal()};
function setMode(m){
  if(m==='week'&&!wkStart){const k=(vy===t0[0]&&vm===t0[1]-1)?todayStr():key(vy,vm,1);wkStart=addDays(k,-wd(k))}
  if(m==='month'&&wkStart){vy=+wkStart.slice(0,4);vm=+wkStart.slice(5,7)-1}
  calMode=m;$('#vMonth').classList.toggle('on',m==='month');$('#vWeek').classList.toggle('on',m==='week');renderCal()}
$('#vMonth').onclick=()=>setMode('month');$('#vWeek').onclick=()=>setMode('week');
$('#days').onkeydown=e=>{if(e.key==='Enter'&&e.target.classList.contains('cell'))openBoard(e.target.dataset.d)};

/* ---------- board modal ---------- */
function openBoard(d){openDate=d;view='board';editId=null;$('#modal').hidden=false;renderBoard()}
function closeBoard(){$('#modal').hidden=true;openDate=null;renderCal()}
$('#bClose').onclick=closeBoard;
$('#modal').onclick=e=>{if(e.target.id==='modal')closeBoard()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openDate)closeBoard()});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{view=b.dataset.v;editId=null;renderBoard()});

function renderBoard(){
  const [y,m,d]=openDate.split('-').map(Number);
  $('#bTitle').textContent=new Date(y,m-1,d).toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  $('#bHol').textContent=holidays(y)[openDate]?'🇵🇭 '+holidays(y)[openDate]:'';
  const mine=s=>S.tasks.filter(t=>t.date===openDate&&t.status===s);
  $('#cDone').textContent=mine('done').length;$('#cTrash').textContent=mine('trash').length;
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  const B=$('#bBody');
  if(view==='board'){
    B.innerHTML=`<div class="add">
      <input id="nTitle" placeholder="What needs to be done? (Enter to add)">
      <input id="nDesc" placeholder="Description (optional)">
      <input type="time" id="nTime" title="Time (optional)"><select id="nPri"><option value="Now">🔴 Now</option><option value="Next">🟡 Next</option><option value="Later">🟢 Later</option></select>
      <button class="btn pri" id="nAdd">＋ Add</button></div>
      <label class="repl"><input type="checkbox" id="nRep"> 🔁 Repeat on my working days (${S.workDays.map(i=>DN[i]).join(', ')})</label>
      <div class="cols">${['Now','Next','Later'].map(p=>{const l=sortAct(act(openDate).filter(t=>t.priority===p));
        return `<div class="col ${p}" data-p="${p}"><h3>${p} <small>${l.length}</small></h3><div class="list">${l.length?l.map(noteHTML).join(''):'<div class="empty">No sticky notes</div>'}</div></div>`}).join('')}</div>
      <div class="zones"><div class="zone t" data-z="trash"><b>🗑</b>Trash</div><div class="zone c" data-z="done"><b>✔</b>Complete</div></div>`;
    $('#nAdd').onclick=addTask;$('#nTitle').onkeydown=e=>{if(e.key==='Enter')addTask()};
    wireDrag();
  }else{
    const l=mine(view);
    B.innerHTML=l.length?l.map(t=>`<div class="item"><div><h4>${esc(t.title)}</h4><small>${esc(t.description)} · ${t.priority}</small></div>
      <div class="nact"><button data-a="restore" data-id="${t.id}">↩ Restore</button>
      ${view==='done'?`<button data-a="trash" data-id="${t.id}">🗑 Trash</button>`:`<button data-a="erase" data-id="${t.id}">❌ Erase</button>`}</div></div>`).join('')
      :`<div class="empty">${view==='done'?'Nothing completed on this date yet 🎉':'Trash is empty ♻️'}</div>`;
  }
}
function noteHTML(t){
  const edit=editId===t.id;
  return `<div class="note" draggable="true" data-id="${t.id}" style="background:${t.color}"><div class="tape"></div>
  ${edit?`<input class="eT" value="${esc(t.title)}"><textarea class="eD" rows="2">${esc(t.description)}</textarea><input type="time" class="eTm" value="${t.time||''}">
    <div class="nact"><button data-a="cancel">Cancel</button><span class="sp"></span><button data-a="save" data-id="${t.id}">💾 Save</button></div>`
  :`<h4>${t.repeatId?'🔁 ':''}${esc(t.title)}</h4>${t.time?`<p>⏰ ${fmtT(t.time)}</p>`:''}${t.description?`<p>${esc(t.description)}</p>`:''}
    <div class="nact"><button data-a="pin" data-id="${t.id}">${t.pinned?'📌':'📍'}</button><button data-a="fav" data-id="${t.id}">${t.favorite?'⭐':'☆'}</button>
    <button data-a="edit" data-id="${t.id}">✏️</button><label class="mvl" title="Move to another date…">📅<input type="date" class="mv" data-id="${t.id}"></label><button data-a="inbox" data-id="${t.id}" title="Move to Inbox">📥</button><span class="sp"></span>
    <button data-a="done" data-id="${t.id}" title="Complete">✔</button><button data-a="trash" data-id="${t.id}" title="Trash">🗑</button></div>`}</div>`;
}
function addTask(){
  const title=$('#nTitle').value.trim();if(!title)return toast('Please type a task title!');
  const p=$('#nPri').value,pal=COLORS[p],desc=$('#nDesc').value.trim(),color=pal[S.tasks.length%pal.length];
  if($('#nRep').checked){
    S.repeats.push({id:'r'+Date.now(),title,description:desc,time:$('#nTime').value,priority:p,color,active:true,start:openDate});
    const [y,m]=openDate.split('-').map(Number);ensureMonth(y,m-1);
    toast(S.workDays.includes(wd(openDate))?'🔁 Repeating task added to your working days':'🔁 Saved — starts on your next working day');
  }else{
    S.tasks.push({id:uid(),date:openDate,title,description:desc,time:$('#nTime').value,priority:p,status:'active',pinned:false,favorite:false,color,created:todayStr()});toast('Task added');
  }
  save();renderBoard();
}
const find=id=>S.tasks.find(t=>t.id===id);
$('#bBody').onclick=e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const t=find(b.dataset.id),a=b.dataset.a;
  if(a==='cancel'){editId=null}
  else if(!t)return;
  else if(a==='edit'){editId=t.id}
  else if(a==='save'){const n=b.closest('.note').querySelector('.eT').value.trim();if(!n)return toast('Title cannot be empty');
    t.title=n;t.description=b.closest('.note').querySelector('.eD').value.trim();t.time=b.closest('.note').querySelector('.eTm').value;editId=null}
  else if(a==='inbox'){t.date='';toast('Moved to Inbox')}
  else if(a==='pin')t.pinned=!t.pinned;
  else if(a==='fav')t.favorite=!t.favorite;
  else if(a==='done'){t.status='done';t.completed=todayStr();toast('Checked off ✔')}
  else if(a==='trash'){t.status='trash';toast('Moved to Trash')}
  else if(a==='restore'){t.status='active';toast('Restored to board')}
  else if(a==='erase'){S.tasks=S.tasks.filter(x=>x!==t);toast('Erased')}
  save();renderBoard();
};

/* ---------- drag & drop (columns, Complete, Trash) ---------- */
function wireDrag(){
  const B=$('#bBody');
  B.querySelectorAll('.note').forEach(n=>{
    n.ondragstart=e=>{dragId=n.dataset.id;n.classList.add('drag');e.dataTransfer.setData('text/plain',dragId)};
    n.ondragend=()=>{n.classList.remove('drag');dragId=null};
  });
  B.querySelectorAll('.col,.zone').forEach(z=>{
    z.ondragover=e=>{e.preventDefault();z.classList.add('over')};
    z.ondragleave=()=>z.classList.remove('over');
    z.ondrop=e=>{e.preventDefault();z.classList.remove('over');
      const t=find(e.dataTransfer.getData('text/plain')||dragId);if(!t)return;
      if(z.dataset.z==='done'){t.status='done';t.completed=todayStr();toast('Checked off ✔')}
      else if(z.dataset.z==='trash'){t.status='trash';toast('Moved to Trash')}
      else{t.priority=z.dataset.p;toast('Moved to '+t.priority)}
      save();renderBoard()};
  });
}

/* ---------- themes ---------- */
function setTheme(t){S.theme=t;document.body.className='th-'+t;save()}
document.querySelectorAll('.sw').forEach(b=>b.onclick=()=>setTheme(b.dataset.th));


/* ---------- repeating tasks, work days, completed (all days) ---------- */
const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const wd=k=>new Date(k+'T00:00:00').getDay();
function ensureMonth(y=vy,m=vm){
  if(!S.repeats)return;let ch=0;const dim=new Date(y,m+1,0).getDate();
  S.repeats.filter(r=>r.active).forEach(r=>{for(let d=1;d<=dim;d++){
    const k=key(y,m,d);
    if(k<r.start||!S.workDays.includes(new Date(y,m,d).getDay())||S.gen[r.id+'|'+k])continue;
    S.gen[r.id+'|'+k]=1;ch=1;
    S.tasks.push({id:'t'+Date.now()+Math.random().toString(36).slice(2,7),date:k,title:r.title,description:r.description,time:r.time||'',priority:r.priority,status:'active',pinned:false,favorite:false,color:r.color,created:todayStr(),repeatId:r.id});
  }});
  if(ch)save();
}
function purge(f){ // remove untouched repeat instances from today onward that match f
  const td=todayStr();
  S.tasks=S.tasks.filter(t=>{if(!t.repeatId||t.status!=='active'||t.date<td||!f(t))return true;delete S.gen[t.repeatId+'|'+t.date];return false});
}
let m2=null,editRep=null;
function openM2(kind){m2=kind;editRep=null;$('#modal2').hidden=false;renderM2()}
function closeM2(){$('#modal2').hidden=true;m2=null;renderCal()}
$('#m2Close').onclick=closeM2;
$('#modal2').onclick=e=>{if(e.target.id==='modal2')closeM2()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m2)closeM2()});
$('#openDone').onclick=()=>openM2('done');$('#openRep').onclick=()=>openM2('rep');
$('#sDone').parentElement.onclick=()=>openM2('done');
function renderM2(){
  if(m2==='rep'){$('#m2Title').textContent='🔁 Repeating tasks & work days';$('#m2Body').innerHTML=repHTML()}
  else{$('#m2Title').textContent='✅ Completed — all days';$('#m2Body').innerHTML='<input id="dq" placeholder="Search completed tasks…" style="width:100%;margin-bottom:6px"><div id="dList"></div>';fillDone()}
}
function repHTML(){
  const e=editRep&&S.repeats.find(r=>r.id===editRep);
  return `<h4 style="margin-bottom:4px">Working days</h4><p class="sub">Repeating tasks are only added on the days you work.</p>
  <div class="row" style="margin:6px 0 16px">${DN.map((n,i)=>`<button class="wd${S.workDays.includes(i)?' on':''}" data-w="${i}">${n}</button>`).join('')}</div>
  <h4 style="margin-bottom:6px">${e?'Edit repeating task':'New repeating task'}</h4>
  <div class="add rep"><input id="rT" placeholder="Task title" value="${esc(e?e.title:'')}"><input id="rD" placeholder="Description (optional)" value="${esc(e?e.description:'')}">
  <select id="rP">${['Now','Next','Later'].map(p=>`<option${e&&e.priority===p?' selected':''}>${p}</option>`).join('')}</select>
  <input type="date" id="rS" value="${e?e.start:todayStr()}" ${e?'disabled':''} title="Start date">
  <button class="btn pri" data-a="rsave">${e?'💾 Save':'＋ Add'}</button>${e?'<button class="btn" data-a="rcancel">Cancel</button>':''}</div>
  <h4 style="margin:14px 0 6px">Your repeating tasks (${S.repeats.length})</h4>
  ${S.repeats.length?S.repeats.map(r=>`<div class="item"><div><h4>🔁 ${esc(r.title)}</h4><small>${esc(r.description)} · ${r.priority} · from ${r.start}${r.active?'':' · ⏸ paused'}</small></div>
  <div class="nact"><button data-a="redit" data-id="${r.id}">✏️</button><button data-a="rpause" data-id="${r.id}">${r.active?'⏸ Pause':'▶ Resume'}</button><button data-a="rdel" data-id="${r.id}">🗑</button></div></div>`).join('')
  :'<div class="empty">No repeating tasks yet. You can also tick “Repeat” when adding a task on any date.</div>'}`;
}
function fillDone(){
  const q=($('#dq')?.value||'').toLowerCase();
  const l=S.tasks.filter(t=>t.status==='done'&&(t.title+' '+t.description).toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
  let h='',cur='';
  l.forEach(t=>{if(t.date!==cur){cur=t.date;const [y,m,d]=t.date.split('-').map(Number);
    h+=`<h4 style="margin:12px 0 6px">📅 ${new Date(y,m-1,d).toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric',year:'numeric'})}</h4>`}
    h+=`<div class="item"><div><h4>${t.repeatId?'🔁 ':''}${esc(t.title)}</h4><small>${esc(t.description)}${t.completed?' · done '+t.completed:''}</small></div>
    <div class="nact"><button data-a="dopen" data-d="${t.date}">📂 Open day</button><button data-a="drestore" data-id="${t.id}">↩ Restore</button><button data-a="dtrash" data-id="${t.id}">🗑</button></div></div>`});
  $('#dList').innerHTML=l.length?`<p class="sub">${l.length} completed task${l.length>1?'s':''} across ${new Set(l.map(t=>t.date)).size} day(s)</p>`+h:'<div class="empty">No completed tasks found 🎉</div>';
}
$('#m2Body').oninput=e=>{if(e.target.id==='dq')fillDone()};
$('#m2Body').onclick=e=>{
  const w=e.target.closest('[data-w]');
  if(w){const i=+w.dataset.w,A=S.workDays;
    if(A.includes(i)){if(A.length<2)return toast('Keep at least one working day');S.workDays=A.filter(x=>x!==i)}else S.workDays=[...A,i].sort();
    purge(t=>!S.workDays.includes(wd(t.date)));renderCal();save();renderM2();return}
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,r=S.repeats.find(x=>x.id===b.dataset.id);
  if(a==='dopen'){const d=b.dataset.d;closeM2();return openBoard(d)}
  if(a==='drestore'||a==='dtrash'){const t=find(b.dataset.id);if(!t)return;t.status=a==='drestore'?'active':'trash';save();fillDone();renderCal();return toast(a==='drestore'?'Restored to its day':'Moved to Trash')}
  if(a==='rsave'){
    const title=$('#rT').value.trim();if(!title)return toast('Please type a title');
    const desc=$('#rD').value.trim(),p=$('#rP').value;
    if(editRep){const x=S.repeats.find(q=>q.id===editRep);x.title=title;x.description=desc;x.priority=p;
      S.tasks.forEach(t=>{if(t.repeatId===x.id&&t.status==='active'&&t.date>=todayStr()){t.title=title;t.description=desc;t.priority=p}});editRep=null;toast('Updated')}
    else{const pal=COLORS[p];S.repeats.push({id:'r'+Date.now(),title,description:desc,priority:p,color:pal[S.repeats.length%pal.length],active:true,start:$('#rS').value||todayStr()});toast('🔁 Repeating task added')}
  }
  else if(a==='rcancel')editRep=null;
  else if(a==='redit')editRep=r.id;
  else if(a==='rpause'){if(r.active){r.active=false;purge(t=>t.repeatId===r.id)}else r.active=true}
  else if(a==='rdel'){if(!confirm(`Delete repeating task "${r.title}"? Upcoming copies are removed; completed ones stay in history.`))return;purge(t=>t.repeatId===r.id);S.repeats=S.repeats.filter(x=>x!==r)}
  renderCal();save();renderM2();
};

/* ---------- dashboard: today / overdue / next 7 / inbox, quick add, reminders ---------- */
const addDays=(k,n)=>{const [y,m,d]=k.split('-').map(Number),t=new Date(Date.UTC(y,m-1,d+n));return `${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}`};
const fmtT=t=>{const [h,m]=t.split(':').map(Number);return `${h%12||12}:${pad(m)} ${h<12?'AM':'PM'}`};
const fmtD=k=>new Date(k+'T00:00:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'});
const nowT=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
const PRI={Now:'🔴',Next:'🟡',Later:'🟢'};

function moveTask(t,d){const snap={...t};t.date=d;save();renderCal();if(openDate)renderBoard();
  toast(d?`Moved to ${fmtD(d)}`:'Moved to Inbox',()=>{Object.assign(t,snap);save();renderCal();if(openDate)renderBoard()})}

function dItem(t,showDate){
  const tds=todayStr();
  return `<div class="di ${t.priority}" draggable="true" data-id="${t.id}">
   <button class="dk" data-a="d-done" data-id="${t.id}" title="Complete">✔</button>
   <div class="dm"><b>${t.repeatId?'🔁 ':''}${esc(t.title)}</b><small>${showDate&&t.date?fmtD(t.date):''}${t.time?(showDate&&t.date?' · ':'')+'⏰ '+fmtT(t.time):''}${t.description?' · '+esc(t.description):''}</small></div>
   <div class="da">${t.date&&t.date!==tds?`<button data-a="d-today" data-id="${t.id}" title="Move to today">⤵</button>`:''}<label class="mvl" title="Move to…">📅<input type="date" class="mv" data-id="${t.id}"></label><button data-a="d-trash" data-id="${t.id}" title="Trash">🗑</button></div></div>`;
}
function renderDash(){
  if(!S.tasks||!S.workDays)return;
  const tds=todayStr(),end=addDays(tds,7);
  [tds,end].forEach(k=>ensureMonth(+k.slice(0,4),+k.slice(5,7)-1));
  const A=S.tasks.filter(t=>t.status==='active');
  const over=A.filter(t=>t.date&&t.date<tds).sort((a,b)=>a.date.localeCompare(b.date)||PO[a.priority]-PO[b.priority]);
  const today=sortAct(A.filter(t=>t.date===tds));
  const next=A.filter(t=>t.date>tds&&t.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99')||PO[a.priority]-PO[b.priority]);
  const inbox=A.filter(t=>!t.date);
  const col=(cls,title,list,showDate,empty,extra='',drop='')=>`<div class="dc ${cls}" ${drop} id="${cls==='O'?'dOver':''}"><h3>${title} <small>${list.length}</small>${extra}</h3>${list.length?list.map(t=>dItem(t,showDate)).join(''):`<div class="empty">${empty}</div>`}</div>`;
  $('#dcols').innerHTML=
    col('O','⚠️ Overdue',over,true,'All caught up 🎉',over.length?'<button class="mini" data-a="d-allToday">⤵ All to today</button>':'')+
    col('T','📌 Today',today,false,'Nothing for today — add one above ✨','','data-drop="today"')+
    col('N','🗓 Next 7 days',next,true,'Nothing scheduled this week')+
    col('I','📥 Inbox',inbox,false,'Unscheduled ideas land here. Type <b>!inbox</b> or drag a task here.','','data-drop="inbox"');
  const nt=today.filter(t=>t.time&&t.time>=nowT())[0];
  $('#dDigest').textContent=`${today.length} today · ${over.length} overdue · ${next.length} in the next 7 days · ${inbox.length} in inbox`+(nt?` · Next up: ${fmtT(nt.time)} ${nt.title}`:'');
}

$('#dash').onclick=e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,tds=todayStr();
  if(a==='d-allToday'){
    const l=S.tasks.filter(x=>x.status==='active'&&x.date&&x.date<tds),snaps=l.map(x=>[x,{...x}]);
    l.forEach(x=>x.date=tds);save();renderCal();
    return toast(`${l.length} moved to today`,()=>{snaps.forEach(([x,s])=>Object.assign(x,s));save();renderCal()})}
  const t=find(b.dataset.id);if(!t)return;
  const snap={...t},undo=()=>{Object.assign(t,snap);save();renderCal()};
  if(a==='d-done'){t.status='done';t.completed=tds;if(!t.date)t.date=tds;toast('Checked off ✔',undo)}
  else if(a==='d-trash'){t.status='trash';if(!t.date)t.date=tds;toast('Moved to Trash',undo)}
  else if(a==='d-today'){t.date=tds;toast('Moved to today',undo)}
  save();renderCal();
};
$('#sOver').parentElement.style.cursor='pointer';
$('#sOver').parentElement.onclick=()=>{const el=$('#dOver');if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400)};

/* date picker on any 📅 control */
document.addEventListener('change',e=>{const i=e.target;if(i.classList&&i.classList.contains('mv')){const t=find(i.dataset.id);if(t&&i.value)moveTask(t,i.value)}});
document.addEventListener('click',e=>{if(e.target.classList&&e.target.classList.contains('mv')){try{e.target.showPicker()}catch(_){}}});

/* drag tasks (dashboard rows or calendar chips) onto calendar days / Today / Inbox */
let dragT=null;
const zoneOf=e=>e.target.closest?e.target.closest('[data-drop]'):null;
document.addEventListener('dragstart',e=>{const el=e.target.closest&&e.target.closest('[data-id][draggable="true"]');if(!el||el.closest('#bBody'))return;dragT=el.dataset.id;e.dataTransfer.setData('text/plain',dragT);e.dataTransfer.effectAllowed='move'});
document.addEventListener('dragover',e=>{const z=zoneOf(e);if(!z||!dragT)return;e.preventDefault();z.classList.add('dover')});
document.addEventListener('dragleave',e=>{const z=zoneOf(e);if(z)z.classList.remove('dover')});
document.addEventListener('drop',e=>{const z=zoneOf(e);if(!z||!dragT)return;e.preventDefault();z.classList.remove('dover');
  const t=find(dragT);dragT=null;if(!t)return;
  const d=z.dataset.drop==='inbox'?'':z.dataset.drop==='today'?todayStr():z.dataset.d;
  if(t.date!==d)moveTask(t,d)});
document.addEventListener('dragend',()=>{dragT=null;document.querySelectorAll('.dover').forEach(x=>x.classList.remove('dover'))});

/* ---------- smart quick-add ---------- */
const MI={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const WI={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
const MR='(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
function parseQuick(s){
  let x=' '+String(s||'')+' ',date=null,time='',pri='',inbox=false;
  const tds=todayStr(),T=new Date(tds+'T00:00:00'),setD=n=>date=addDays(tds,n);
  const eat=(re,fn)=>{const m=x.match(re);if(!m)return false;x=x.replace(m[0],' ');fn(m);return true};
  const mdY=(m,d,y)=>{const yr=y?(+y<100?2000+ +y:+y):T.getFullYear();let k=key(yr,m,d);if(!y&&k<tds)k=key(yr+1,m,d);return k};
  eat(/\s!(now|next|later)(?![\w])/i,m=>pri=m[1][0].toUpperCase()+m[1].slice(1).toLowerCase());
  eat(/\s!(inbox|someday)(?![\w])/i,()=>inbox=true);
  eat(/\s(?:at\s+|@\s*)?(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?(?![\w])/i,m=>{let h=+m[1]%12;if(m[3].toLowerCase()==='p')h+=12;time=pad(h)+':'+(m[2]||'00')})
   ||eat(/\s(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)(?![\w:])/,m=>time=pad(+m[1])+':'+m[2])
   ||eat(/\s(?:at\s+)?noon(?![\w])/i,()=>time='12:00');
  eat(/\s(today|tonight)(?![\w])/i,()=>date=tds)
   ||eat(/\s(tomorrow|tmrw|tmr)(?![\w])/i,()=>setD(1))
   ||eat(/\sin\s+(\d{1,3})\s*(d|days?|w|weeks?)(?![\w])/i,m=>setD(+m[1]*(/^w/i.test(m[2])?7:1)))
   ||eat(/\snext\s+week(?![\w])/i,()=>setD(7))
   ||eat(/\s(\d{4})-(\d{2})-(\d{2})(?![\w])/,m=>date=m[1]+'-'+m[2]+'-'+m[3])
   ||eat(new RegExp('\\s'+MR+'\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\w])','i'),m=>date=mdY(MI[m[1].slice(0,3).toLowerCase()],+m[2]))
   ||eat(new RegExp('\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+'+MR+'(?![\\w])','i'),m=>date=mdY(MI[m[2].slice(0,3).toLowerCase()],+m[1]))
   ||eat(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\w\/])/,m=>date=mdY(+m[1]-1,+m[2],m[3]))
   ||eat(/\s(?:this\s+|next\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thurs?|thu|fri|sat)(?![\w])/i,m=>setD((WI[m[1].slice(0,3).toLowerCase()]-T.getDay()+7)%7||7));
  const title=x.replace(/\s+/g,' ').trim().replace(/\s+(at|on|by|due)$/i,'').replace(/^(on|at)\s+/i,'');
  if(!title)return null;
  return {title,date:inbox?'':(date||tds),time,priority:pri||'Next'};
}
$('#qa').oninput=()=>{const p=parseQuick($('#qa').value);
  $('#qprev').innerHTML=p?`<span>📝 ${esc(p.title)}</span><span>${p.date?'📅 '+fmtD(p.date):'📥 Inbox'}</span>${p.time?`<span>⏰ ${fmtT(p.time)}</span>`:''}<span>${PRI[p.priority]} ${p.priority}</span>`:''};
$('#qa').onkeydown=e=>{if(e.key==='Enter')quickAdd()};$('#qaGo').onclick=quickAdd;
function quickAdd(){
  const p=parseQuick($('#qa').value);if(!p)return toast('Type a task first');
  const pal=COLORS[p.priority];
  S.tasks.push({id:uid(),date:p.date,title:p.title,description:'',time:p.time,priority:p.priority,status:'active',pinned:false,favorite:false,color:pal[S.tasks.length%pal.length],created:todayStr()});
  $('#qa').value='';$('#qprev').innerHTML='';save();renderCal();
  toast(p.date?`Added for ${fmtD(p.date)}${p.time?' at '+fmtT(p.time):''}`:'Added to Inbox');
}

/* ---------- morning rollover, reminders, daily digest ---------- */
function rollover(){
  const tds=todayStr();if(!S.rollover||S.lastRoll===tds)return;let n=0;
  S.tasks.forEach(t=>{if(t.status==='active'&&t.priority==='Now'&&t.date&&t.date<tds){t.date=tds;n++}});
  S.lastRoll=tds;save();if(n)toast(`🌅 ${n} unfinished “Now” task${n>1?'s':''} rolled over to today`);
}
$('#optRoll').onchange=()=>{S.rollover=$('#optRoll').checked;S.lastRoll=null;rollover();save();renderCal()};
const notifOn=()=>S.notify&&'Notification' in window&&Notification.permission==='granted';
function syncNotif(){$('#optNotif').textContent=notifOn()?'🔔 Reminders on':'🔕 Reminders off';$('#optLead').value=String(S.lead||0)}
$('#optNotif').onclick=async()=>{
  if(!('Notification' in window))return toast('This browser doesn’t support notifications');
  if(notifOn())S.notify=false;
  else{
    if(Notification.permission==='default')await Notification.requestPermission();
    if(Notification.permission!=='granted')return toast('Notifications are blocked — allow them in the browser’s site settings');
    S.notify=true;toast('🔔 Reminders on — keep this tab open');
  }
  save();syncNotif()};
$('#optLead').onchange=()=>{S.lead=+$('#optLead').value;save()};
function ping(t,b){toast(t+' — '+b);try{if(notifOn())new Notification(t,{body:b})}catch(e){}}
const fired=()=>{try{return JSON.parse(localStorage.getItem('sct_fired')||'{}')}catch(e){return{}}};
let lastDay=todayStr();
function tick(){
  if(!S.tasks)return;const tds=todayStr();
  if(tds!==lastDay){lastDay=tds;rollover();renderCal();digest()}
  if(!notifOn())return;
  const [h,m]=nowT().split(':').map(Number),nowM=h*60+m,lead=+S.lead||0,F=fired();let ch=0;
  S.tasks.forEach(t=>{if(t.status!=='active'||t.date!==tds||!t.time)return;
    const [th,tm]=t.time.split(':').map(Number),due=th*60+tm,k=t.id+'|'+tds;
    if(nowM>=due-lead&&nowM<due+30&&!F[k]){F[k]=1;ch=1;ping('⏰ '+t.title,(lead?`In ${lead} min · `:'Now · ')+fmtT(t.time)+(t.description?' · '+t.description:''))}});
  if(ch){for(const k in F)if(!k.endsWith('|'+tds))delete F[k];localStorage.setItem('sct_fired',JSON.stringify(F))}
}
setInterval(tick,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
function digest(){
  const tds=todayStr();if(localStorage.getItem('sct_digest')===tds)return;localStorage.setItem('sct_digest',tds);
  const A=S.tasks.filter(t=>t.status==='active'),td=A.filter(t=>t.date===tds),od=A.filter(t=>t.date&&t.date<tds),first=sortAct(td.filter(t=>t.time))[0];
  ping('☀️ Daily digest',`${td.length} task${td.length===1?'':'s'} today, ${od.length} overdue`+(first?` · first: ${fmtT(first.time)} ${first.title}`:''));
}

/* ---------- boot: load this user's board from the server ---------- */
(async()=>{
  const m=await currentUser();if(!m)return location.replace('login.html');
  ME=m.user;S=m.board||{tasks:[],theme:'white'};
  const old=localStorage.getItem('smart_calendar_taskboard_v1_u_admin'); // one-time import of pre-server admin data
  if(ME.role==='admin'&&!S.tasks.length&&!S.seeded&&old){try{S=JSON.parse(old);S.seeded=1;save()}catch(e){}}
  if(ME.role==='admin'&&!S.tasks.length&&!S.seeded){S.seeded=1;const d=todayStr();
    S.tasks=[['Call ricardo magsacay','Discuss pending collections','Now','#ebd3ff'],['Send follow-up emails','Contact all billing addresses','Next','#c3e2ff'],['Update contact list','Sync files to cloud','Later','#ffd1ea']]
    .map((x,i)=>({id:'seed'+i,date:d,title:x[0],description:x[1],priority:x[2],status:'active',pinned:false,favorite:false,color:x[3],created:d}));save()}
  $('#who').innerHTML=`<b style="font-size:.75rem">${esc(ME.name||ME.username)}</b>${ME.role}`;$('#usersLink').hidden=ME.role!=='admin';
  S.workDays=S.workDays||[1,2,3,4,5];S.repeats=S.repeats||[];S.gen=S.gen||{};
  setTheme(S.theme||'white');$('#optRoll').checked=!!S.rollover;syncNotif();rollover();renderCal();digest();tick();
})();
