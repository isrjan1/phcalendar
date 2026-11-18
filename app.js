const $=s=>document.querySelector(s);
let ME={id:'none',role:'user'};
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLORS={Now:['#cbfec9','#ebd3ff','#dfc3ff'],Next:['#fff3a1','#c3e2ff'],Later:['#ffd1ea','#cbfec9']};
let S={tasks:[],theme:'white'},saveT,dirty=false,inflight=false;
const setSaved=t=>{const el=$('#saveState');if(el)el.textContent=t};
function save(){dirty=true;setSaved('Saving…');clearTimeout(saveT);saveT=setTimeout(flush,350)}
async function flush(){
  if(!dirty||inflight||ME.id==='none')return;
  clearTimeout(saveT);dirty=false;inflight=true;let failed=false;
  try{const r=await api('/api/board','PUT',S);S._rev=r.rev;if(!dirty)setSaved('✓ Saved')}
  catch(e){
    if(e.status===401)return location.replace('login.html');
    if(e.status===409&&e.data&&e.data.board){adopt(e.data.board);toast('🔄 This board was changed on another device — loaded the latest version')}
    else{failed=true;dirty=true;setSaved('⚠ Not saved — retrying');toast('⚠️ Not saved: '+e.message);saveT=setTimeout(flush,8000)}
  }finally{inflight=false;if(dirty&&!failed){clearTimeout(saveT);saveT=setTimeout(flush,350)}}
}
function adopt(b){S=b;norm();setTheme(S.theme||'white',true);$('#optRoll').checked=!!S.rollover;syncNotif();setSaved('✓ Saved');renderCal();if(openDate)renderBoard();if(m2)renderM2()}
async function syncFromServer(){ // pick up edits made on another PC when this tab regains focus
  if(dirty||inflight||document.hidden||ME.id==='none'||openDate||m2)return;
  try{const m=await api('/api/me?rev='+(S._rev||0));const b=m.unchanged?null:m.board;if(b&&(b._rev||0)>(S._rev||0)&&!dirty&&!inflight&&!openDate&&!m2){adopt(b);toast('🔄 Synced the latest changes')}}
  catch(e){if(e.status===401)location.replace('login.html')}
}
window.addEventListener('pagehide',()=>{if(!dirty||ME.id==='none')return;try{fetch('/api/board',{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem(TK)||'')},body:JSON.stringify(S)})}catch(e){}});
window.addEventListener('beforeunload',e=>{if(dirty||inflight){e.preventDefault();e.returnValue=''}});
const pad=n=>String(n).padStart(2,'0');
const key=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const _fDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'});
const todayStr=()=>_fDay.format(new Date());
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,undo)=>{const T=$('#toast');while(T.children.length>3)T.firstChild.remove();const d=document.createElement('div');d.textContent=m;if(undo){const b=document.createElement('button');b.textContent='↩ Undo';b.className='mini';b.onclick=()=>{undo();d.remove()};d.append(b)}$('#toast').append(d);setTimeout(()=>d.remove(),undo?6000:2500)};
const uid=()=>'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const safeColor=c=>/^#[0-9a-f]{3,8}$/i.test(c||'')?c:'#fff3a1';
function norm(){ // make any loaded board (old, restored or hand-edited) safe to render
  S.tasks=Array.isArray(S.tasks)?S.tasks.filter(t=>t&&typeof t==='object'):[];
  S.workDays=Array.isArray(S.workDays)&&S.workDays.length?S.workDays:[1,2,3,4,5];
  S.repeats=Array.isArray(S.repeats)?S.repeats:[];S.gen=S.gen&&typeof S.gen==='object'?S.gen:{};
  S.tasks.forEach(t=>{t.id=t.id||uid();t.title=String(t.title||'(untitled)');t.description=String(t.description||'');t.date=t.date||'';t.time=t.time||'';
    if(!(t.priority in PO))t.priority='Next';if(!['active','done','trash'].includes(t.status))t.status='active';
    t.pinned=!!t.pinned;t.favorite=!!t.favorite;t.color=safeColor(t.color)});
  S.repeats.forEach(r=>{r.color=safeColor(r.color);r.description=r.description||'';if(!(r.priority in PO))r.priority='Next'});
  const cut=new Date(Date.now()-400*864e5).toISOString().slice(0,10); // forget generation markers older than ~13 months
  for(const k in S.gen){if(k.slice(k.lastIndexOf('|')+1)<cut)delete S.gen[k]}
}

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
const sortAct=l=>l.slice().sort((a,b)=>((+!!b.pinned)-(+!!a.pinned))||(a.time||'99').localeCompare(b.time||'99')||PO[a.priority]-PO[b.priority]);

/* ---------- calendar ---------- */
let IDX={};
function buildIdx(){IDX={};for(const t of S.tasks)if(t.status==='active'&&t.date)(IDX[t.date]||(IDX[t.date]=[])).push(t)}
function cellHTML(k,tds,wk){
  const list=sortAct(IDX[k]||[]),hol=holidays(+k.slice(0,4))[k],lim=wk?99:2,dow=wd(k);
  const label=new Date(k+'T00:00:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric'})+(hol?', '+hol:'')+`, ${list.length} task${list.length===1?'':'s'}`;
  return `<div class="cell${wk?' wk':''}${hol?' hol':''}${k===tds?' tdy':''}${dow===0?' sun':''}" role="button" tabindex="0" data-d="${k}" data-drop="date" aria-label="${esc(label)}">
    <span class="n"><span class="dn">${wk?DN[dow]+' ':''}${+k.slice(8)}</span>${list.length?`<em>${list.length}</em>`:''}</span>
    ${hol?`<span class="h">${esc(hol)}</span>`:''}
    ${list.slice(0,lim).map(t=>`<span class="chip" draggable="true" data-id="${t.id}" title="${esc(t.title)}" style="background:${safeColor(t.color)}">${t.time?fmtT(t.time)+' ':''}${esc(t.title)}</span>`).join('')}
    ${list.length>lim?`<span class="h">+${list.length-lim} more</span>`:''}
    <span class="dots">${list.slice(0,4).map(t=>`<i style="background:${safeColor(t.color)}"></i>`).join('')}</span></div>`;
}
function renderCal(){
  const tds=todayStr();let out='';
  if(calMode==='week'){
    const ws=wkStart||(wkStart=addDays(tds,-wd(tds))),we=addDays(ws,6);
    [ws,we].forEach(k=>ensureMonth(+k.slice(0,4),+k.slice(5,7)-1));
    const f=(k,o)=>new Date(k+'T00:00:00').toLocaleDateString('en-PH',o);
    $('#monthTitle').textContent=`${f(ws,{month:'short',day:'numeric'})} – ${f(we,{month:'short',day:'numeric',year:'numeric'})}`;
    buildIdx();for(let i=0;i<7;i++)out+=cellHTML(addDays(ws,i),tds,true);
  }else{
    ensureMonth();
    $('#monthTitle').textContent=`${MONTHS[vm]} ${vy}`;
    const first=new Date(vy,vm,1).getDay(),dim=new Date(vy,vm+1,0).getDate();
    buildIdx();for(let i=0;i<first;i++)out+='<div></div>';
    for(let d=1;d<=dim;d++)out+=cellHTML(key(vy,vm,d),tds,false);
  }
  $('#days').innerHTML=out;
  document.querySelectorAll('.grid').forEach(g=>g.classList.toggle('weekmode',calMode==='week'));
  let na=0,nd=0,no=0;for(const t of S.tasks){if(t.status==='active'){na++;if(t.date&&t.date<tds)no++}else if(t.status==='done')nd++}
  $('#sActive').textContent=na;$('#sDone').textContent=nd;$('#sOver').textContent=no;
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
$('#days').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('cell')){e.preventDefault();openBoard(e.target.dataset.d)}};

/* ---------- board modal ---------- */
const lockBody=()=>document.body.classList.toggle('lock',!$('#modal').hidden||!$('#modal2').hidden);
const refreshAll=()=>{renderCal();if(openDate)renderBoard()};
function openBoard(d){openDate=d;view='board';editId=null;$('#modal').hidden=false;lockBody();renderBoard();
  if(matchMedia('(pointer:fine)').matches){const t=$('#nTitle');if(t)t.focus()}}
function closeBoard(){const d=openDate;$('#modal').hidden=true;openDate=null;lockBody();renderCal();
  const c=d&&document.querySelector(`.cell[data-d="${d}"]`);if(c)c.focus({preventScroll:true})}
$('#bClose').onclick=closeBoard;
$('#modal').onclick=e=>{if(e.target.id==='modal')closeBoard()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openDate&&!m2)closeBoard()});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{view=b.dataset.v;editId=null;renderBoard()});

function renderBoard(){
  if(!openDate)return;
  const [y,m,d]=openDate.split('-').map(Number);
  $('#bTitle').textContent=new Date(y,m-1,d).toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  $('#bHol').textContent=holidays(y)[openDate]?'🇵🇭 '+holidays(y)[openDate]:'';
  const mine=s=>S.tasks.filter(t=>t.date===openDate&&t.status===s);
  $('#cDone').textContent=mine('done').length;$('#cTrash').textContent=mine('trash').length;
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  const B=$('#bBody');
  if(view==='board'){
    const keep=['nTitle','nDesc','nTime','nPri','nRep'].map(id=>{const el=$('#'+id);return el?[id,el.type==='checkbox'?el.checked:el.value]:null}).filter(Boolean);
    B.innerHTML=`<div class="add">
      <input id="nTitle" maxlength="200" placeholder="What needs to be done? (Enter to add)" aria-label="Task title">
      <input id="nDesc" maxlength="500" placeholder="Description (optional)" aria-label="Description">
      <input type="time" id="nTime" title="Time (optional)" aria-label="Time"><select id="nPri" aria-label="Priority"><option value="Now">🔴 Now</option><option value="Next">🟡 Next</option><option value="Later">🟢 Later</option></select>
      <button class="btn pri" id="nAdd">＋ Add</button></div>
      <label class="repl"><input type="checkbox" id="nRep"> 🔁 Repeat on my working days (${S.workDays.map(i=>DN[i]).join(', ')})</label>
      <div class="cols">${['Now','Next','Later'].map(p=>{const l=sortAct(act(openDate).filter(t=>t.priority===p));
        return `<div class="col ${p}" data-p="${p}"><h3>${p} <small>${l.length}</small></h3><div class="list">${l.length?l.map(noteHTML).join(''):'<div class="empty">No sticky notes</div>'}</div></div>`}).join('')}</div>
      <div class="zones"><div class="zone t" data-z="trash"><b>🗑</b>Trash</div><div class="zone c" data-z="done"><b>✔</b>Complete</div></div>`;
    keep.forEach(([id,v])=>{const el=$('#'+id);if(el){if(el.type==='checkbox')el.checked=v;else el.value=v}}); // survive re-renders while typing
    $('#nAdd').onclick=addTask;$('#nTitle').onkeydown=e=>{if(e.key==='Enter')addTask()};$('#nDesc').onkeydown=e=>{if(e.key==='Enter')addTask()};
    wireDrag();
  }else{
    const l=mine(view);
    B.innerHTML=(l.length&&view==='trash'?`<div class="row" style="margin:0 0 10px"><button class="mini" data-a="emptytrash">🧹 Empty trash (${l.length})</button></div>`:'')+
      (l.length?l.map(t=>`<div class="item"><div><h4>${esc(t.title)}</h4><small>${t.description?esc(t.description)+' · ':''}${t.priority}</small></div>
      <div class="nact"><button data-a="restore" data-id="${t.id}">↩ Restore</button>
      ${view==='done'?`<button data-a="trash" data-id="${t.id}">🗑 Trash</button>`:`<button data-a="erase" data-id="${t.id}">❌ Erase</button>`}</div></div>`).join('')
      :`<div class="empty">${view==='done'?'Nothing completed on this date yet 🎉':'Trash is empty ♻️'}</div>`);
  }
}
function noteHTML(t){
  const edit=editId===t.id;
  return `<div class="note" draggable="${!edit}" data-id="${t.id}" style="background:${safeColor(t.color)}"><div class="tape"></div>
  ${edit?`<input class="eT" maxlength="200" value="${esc(t.title)}" aria-label="Title"><textarea class="eD" maxlength="500" rows="2" aria-label="Description">${esc(t.description)}</textarea><input type="time" class="eTm" value="${t.time||''}" aria-label="Time">
    <div class="nact"><button data-a="cancel">Cancel</button><span class="sp"></span><button data-a="save" data-id="${t.id}">💾 Save</button></div>`
  :`<h4>${t.repeatId?'🔁 ':''}${esc(t.title)}</h4>${t.time?`<p>⏰ ${fmtT(t.time)}</p>`:''}${t.description?`<p>${esc(t.description)}</p>`:''}
    <div class="nact"><button data-a="pin" data-id="${t.id}" title="Pin to top" aria-label="Pin">${t.pinned?'📌':'📍'}</button><button data-a="fav" data-id="${t.id}" title="Favourite" aria-label="Favourite">${t.favorite?'⭐':'☆'}</button>
    <button data-a="edit" data-id="${t.id}" title="Edit" aria-label="Edit">✏️</button><label class="mvl" title="Move to another date…">📅<input type="date" class="mv" data-id="${t.id}" aria-label="Move to date"></label><button data-a="inbox" data-id="${t.id}" title="Move to Inbox" aria-label="Move to Inbox">📥</button><span class="sp"></span>
    <button data-a="done" data-id="${t.id}" title="Complete" aria-label="Complete">✔</button><button data-a="trash" data-id="${t.id}" title="Trash" aria-label="Trash">🗑</button></div>`}</div>`;
}
function addTask(){
  const title=$('#nTitle').value.trim();if(!title){toast('Please type a task title!');return $('#nTitle').focus()}
  const p=$('#nPri').value,pal=COLORS[p],desc=$('#nDesc').value.trim(),color=pal[S.tasks.length%pal.length];
  if($('#nRep').checked){
    const td=todayStr(),start=openDate<td?td:openDate; // a repeat never back-fills the past
    S.repeats.push({id:'r'+Date.now(),title,description:desc,time:$('#nTime').value,priority:p,color,active:true,start});
    const [y,m]=start.split('-').map(Number);ensureMonth(y,m-1);
    toast(S.workDays.includes(wd(start))?'🔁 Repeating task added to your working days':'🔁 Saved — starts on your next working day');
  }else{
    S.tasks.push({id:uid(),date:openDate,title,description:desc,time:$('#nTime').value,priority:p,status:'active',pinned:false,favorite:false,color,created:todayStr()});toast('Task added');
  }
  save();$('#nTitle').value='';$('#nDesc').value='';renderBoard();renderCal();
  if(matchMedia('(pointer:fine)').matches)$('#nTitle').focus();
}
const find=id=>S.tasks.find(t=>t.id===id);
function setStatus(t,status,msg){const snap={...t};t.status=status;if(status==='done')t.completed=todayStr();else if(status==='active')delete t.completed;
  save();refreshAll();toast(msg,()=>{Object.assign(t,snap);save();refreshAll()})}
$('#bBody').onclick=e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a;
  if(a==='cancel'){editId=null;return renderBoard()}
  if(a==='emptytrash'){const l=S.tasks.filter(t=>t.date===openDate&&t.status==='trash');if(!l.length||!confirm(`Permanently erase ${l.length} trashed task${l.length>1?'s':''}?`))return;
    S.tasks=S.tasks.filter(t=>!l.includes(t));save();toast('Trash emptied');return refreshAll()}
  const t=find(b.dataset.id);if(!t)return;
  if(a==='edit'){editId=t.id;renderBoard();const i=document.querySelector('.note .eT');if(i){i.focus();i.select()}return}
  if(a==='save'){const n=b.closest('.note'),title=n.querySelector('.eT').value.trim();if(!title)return toast('Title cannot be empty');
    t.title=title;t.description=n.querySelector('.eD').value.trim();t.time=n.querySelector('.eTm').value;editId=null;save();return refreshAll()}
  if(a==='inbox')return moveTask(t,'');
  if(a==='pin'){t.pinned=!t.pinned;save();return refreshAll()}
  if(a==='fav'){t.favorite=!t.favorite;save();return refreshAll()}
  if(a==='done')return setStatus(t,'done','Checked off ✔');
  if(a==='trash')return setStatus(t,'trash','Moved to Trash');
  if(a==='restore')return setStatus(t,'active','Restored to board');
  if(a==='erase'){const i=S.tasks.indexOf(t);S.tasks.splice(i,1);save();refreshAll();
    return toast('Erased',()=>{S.tasks.splice(Math.min(i,S.tasks.length),0,t);save();refreshAll()})}
};
$('#bBody').onkeydown=e=>{if(e.key==='Enter'&&e.target.classList.contains('eT')){const s=e.target.closest('.note').querySelector('[data-a="save"]');if(s)s.click()}
  if(e.key==='Escape'&&editId){e.stopPropagation();editId=null;renderBoard()}};

/* ---------- drag & drop (columns, Complete, Trash) ---------- */
function wireDrag(){
  const B=$('#bBody');
  B.querySelectorAll('.note').forEach(n=>{
    n.ondragstart=e=>{dragId=n.dataset.id;n.classList.add('drag');e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move'};
    n.ondragend=()=>{n.classList.remove('drag');dragId=null};
  });
  B.querySelectorAll('.col,.zone').forEach(z=>{
    z.ondragover=e=>{e.preventDefault();z.classList.add('over')};
    z.ondragleave=e=>{if(!z.contains(e.relatedTarget))z.classList.remove('over')};
    z.ondrop=e=>{e.preventDefault();z.classList.remove('over');
      const t=find(e.dataTransfer.getData('text/plain')||dragId);if(!t)return;
      if(z.dataset.z==='done')return setStatus(t,'done','Checked off ✔');
      if(z.dataset.z==='trash')return setStatus(t,'trash','Moved to Trash');
      if(t.priority===z.dataset.p)return;
      const snap={...t};t.priority=z.dataset.p;save();refreshAll();toast('Moved to '+t.priority,()=>{Object.assign(t,snap);save();refreshAll()})};
  });
}

/* ---------- themes ---------- */
function setTheme(t,quiet){S.theme=t;document.body.className=document.body.className.replace(/\bth-\w+/,'th-'+t);try{localStorage.setItem('sct_theme',t)}catch(e){}
  document.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.th===t)));if(!quiet)save()}
document.querySelectorAll('.sw').forEach(b=>b.onclick=()=>setTheme(b.dataset.th));


/* ---------- repeating tasks, work days, completed (all days) ---------- */
const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const wd=k=>new Date(k+'T00:00:00').getDay();
function ensureMonth(y=vy,m=vm){
  if(!S.repeats)return;let ch=0;const dim=new Date(y,m+1,0).getDate();
  if(key(y,m,1)>addDays(todayStr(),550))return; // don't generate repeats more than ~18 months ahead (keeps the board small)
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
let m2=null,editRep=null,m2Opener=null;
function openM2(kind){m2Opener=document.activeElement;m2=kind;editRep=null;$('#modal2').hidden=false;lockBody();renderM2();
  if(kind==='acct'&&matchMedia('(pointer:fine)').matches)$('#pwC').focus()}
function closeM2(){m2=null;$('#modal2').hidden=true;lockBody();renderCal();if(openDate)renderBoard();if(m2Opener&&document.contains(m2Opener))m2Opener.focus({preventScroll:true})}
$('#m2Close').onclick=closeM2;
$('#modal2').onclick=e=>{if(e.target.id==='modal2')closeM2()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m2)closeM2()});
$('#openDone').onclick=()=>openM2('done');$('#openRep').onclick=()=>openM2('rep');$('#openAcct').onclick=()=>openM2('acct');
$('#banner button').onclick=()=>openM2('acct');
$('#sDone').parentElement.onclick=()=>openM2('done');
function renderM2(){
  if(m2==='rep'){$('#m2Title').textContent='🔁 Repeating tasks & work days';$('#m2Body').innerHTML=repHTML()}
  else if(m2==='acct'){$('#m2Title').textContent='🔑 My account';$('#m2Body').innerHTML=acctHTML()}
  else{$('#m2Title').textContent='✅ Completed — all days';$('#m2Body').innerHTML='<input id="dq" placeholder="Search completed tasks…" aria-label="Search completed tasks" style="width:100%;margin-bottom:6px"><div id="dList"></div>';fillDone()}
}
function acctHTML(){
  return `<p class="sub" style="margin-bottom:12px">Signed in as <b>${esc(ME.username)}</b> · ${esc(ME.role)}</p>
  <div class="stack"><h4>Change password</h4>
  <input id="pwC" type="password" autocomplete="current-password" placeholder="Current password" aria-label="Current password">
  <input id="pwN" type="password" autocomplete="new-password" placeholder="New password (min 6 characters)" aria-label="New password">
  <input id="pwN2" type="password" autocomplete="new-password" placeholder="Repeat new password" aria-label="Repeat new password">
  <div class="bad msg" id="pwErr" role="alert"></div><button class="btn pri" data-a="pwsave">💾 Change password</button>
  <p class="sub">Changing your password signs out your other devices.</p></div>`;
}
function repHTML(){
  const e=editRep&&S.repeats.find(r=>r.id===editRep);
  return `<h4 style="margin-bottom:4px">Working days</h4><p class="sub">Repeating tasks are only added on the days you work.</p>
  <div class="row" style="margin:6px 0 16px">${DN.map((n,i)=>`<button class="wd${S.workDays.includes(i)?' on':''}" data-w="${i}" aria-pressed="${S.workDays.includes(i)}">${n}</button>`).join('')}</div>
  <h4 style="margin-bottom:6px">${e?'Edit repeating task':'New repeating task'}</h4>
  <div class="add rep"><input id="rT" maxlength="200" placeholder="Task title" aria-label="Task title" value="${esc(e?e.title:'')}"><input id="rD" maxlength="500" placeholder="Description (optional)" aria-label="Description" value="${esc(e?e.description:'')}">
  <input type="time" id="rM" title="Time (optional)" aria-label="Time" value="${e?e.time||'':''}">
  <select id="rP" aria-label="Priority">${['Now','Next','Later'].map(p=>`<option${e&&e.priority===p?' selected':''}>${p}</option>`).join('')}</select>
  <input type="date" id="rS" value="${e?e.start:todayStr()}" ${e?'disabled':''} title="Start date" aria-label="Start date">
  <button class="btn pri" data-a="rsave">${e?'💾 Save':'＋ Add'}</button>${e?'<button class="btn" data-a="rcancel">Cancel</button>':''}</div>
  <h4 style="margin:14px 0 6px">Your repeating tasks (${S.repeats.length})</h4>
  ${S.repeats.length?S.repeats.map(r=>`<div class="item"><div><h4>🔁 ${esc(r.title)}</h4><small>${r.description?esc(r.description)+' · ':''}${r.time?fmtT(r.time)+' · ':''}${r.priority} · from ${r.start}${r.active?'':' · ⏸ paused'}</small></div>
  <div class="nact"><button data-a="redit" data-id="${r.id}" aria-label="Edit">✏️</button><button data-a="rpause" data-id="${r.id}">${r.active?'⏸ Pause':'▶ Resume'}</button><button data-a="rdel" data-id="${r.id}" aria-label="Delete">🗑</button></div></div>`).join('')
  :'<div class="empty">No repeating tasks yet. You can also tick “Repeat” when adding a task on any date.</div>'}`;
}
function fillDone(){
  const q=($('#dq')?.value||'').toLowerCase();
  const l=S.tasks.filter(t=>t.status==='done'&&(t.title+' '+t.description).toLowerCase().includes(q)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  let h='',cur=null;
  l.forEach(t=>{if(t.date!==cur){cur=t.date;
    h+=`<h4 style="margin:12px 0 6px">📅 ${t.date?(([y,m,d])=>new Date(y,m-1,d).toLocaleDateString('en-PH',{weekday:'short',month:'long',day:'numeric',year:'numeric'}))(t.date.split('-').map(Number)):'No date'}</h4>`}
    h+=`<div class="item"><div><h4>${t.repeatId?'🔁 ':''}${esc(t.title)}</h4><small>${esc(t.description)}${t.completed?(t.description?' · ':'')+'done '+t.completed:''}</small></div>
    <div class="nact">${t.date?`<button data-a="dopen" data-d="${t.date}">📂 Open day</button>`:''}<button data-a="drestore" data-id="${t.id}">↩ Restore</button><button data-a="dtrash" data-id="${t.id}" aria-label="Trash">🗑</button></div></div>`});
  $('#dList').innerHTML=l.length?`<p class="sub">${l.length} completed task${l.length>1?'s':''} across ${new Set(l.map(t=>t.date)).size} day(s)</p>`+h:'<div class="empty">No completed tasks found 🎉</div>';
}
$('#m2Body').oninput=e=>{if(e.target.id==='dq')fillDone()};
$('#m2Body').onkeydown=e=>{if(e.key==='Enter'&&e.target.id&&/^(pw|rT|rD)/.test(e.target.id)){const b=$('#m2Body').querySelector('[data-a="pwsave"],[data-a="rsave"]');if(b)b.click()}};
$('#m2Body').onclick=async e=>{
  const w=e.target.closest('[data-w]');
  if(w){const i=+w.dataset.w,A=S.workDays;
    if(A.includes(i)){if(A.length<2)return toast('Keep at least one working day');S.workDays=A.filter(x=>x!==i)}else S.workDays=[...A,i].sort();
    purge(t=>!S.workDays.includes(wd(t.date)));renderCal();save();renderM2();return}
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,r=S.repeats.find(x=>x.id===b.dataset.id);
  if(a==='pwsave'){
    const c=$('#pwC').value,n=$('#pwN').value,n2=$('#pwN2').value,err=t=>{$('#pwErr').textContent=t};
    if(!c)return err('Enter your current password.');if(n.length<6)return err('New password must be at least 6 characters.');if(n!==n2)return err('The new passwords don’t match.');
    b.disabled=true;
    try{await api('/api/password','POST',{current:c,password:n});ME.mustChange=false;$('#banner').hidden=true;toast('🔑 Password changed');closeM2()}
    catch(x){if(x.status===401)return location.replace('login.html');err(x.message);b.disabled=false}
    return}
  if(a==='dopen'){const d=b.dataset.d;closeM2();return openBoard(d)}
  if(a==='drestore'||a==='dtrash'){const t=find(b.dataset.id);if(!t)return;t.status=a==='drestore'?'active':'trash';if(a==='drestore')delete t.completed;save();fillDone();renderCal();return toast(a==='drestore'?'Restored to its day':'Moved to Trash')}
  if(a==='rsave'){
    const title=$('#rT').value.trim();if(!title)return toast('Please type a title');
    const desc=$('#rD').value.trim(),p=$('#rP').value,tm=$('#rM').value;
    if(editRep){const x=S.repeats.find(q=>q.id===editRep);x.title=title;x.description=desc;x.priority=p;x.time=tm;
      S.tasks.forEach(t=>{if(t.repeatId===x.id&&t.status==='active'&&t.date>=todayStr()){t.title=title;t.description=desc;t.priority=p;t.time=tm}});editRep=null;toast('Updated')}
    else{const pal=COLORS[p],td=todayStr(),st=$('#rS').value||td;S.repeats.push({id:'r'+Date.now(),title,description:desc,time:tm,priority:p,color:pal[S.repeats.length%pal.length],active:true,start:st<td?td:st});toast('🔁 Repeating task added')}
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
const _fTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const nowT=()=>_fTime.format(new Date());
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
  const col=(cls,title,list,showDate,empty,extra='',drop='')=>`<div class="dc ${cls}" ${drop}${cls==='O'?' id="dOver"':''}><h3>${title} <small>${list.length}</small>${extra}</h3>${list.length?list.map(t=>dItem(t,showDate)).join(''):`<div class="empty">${empty}</div>`}</div>`;
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
document.addEventListener('dragleave',e=>{const z=zoneOf(e);if(z&&!z.contains(e.relatedTarget))z.classList.remove('dover')});
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
  const okD=(yr,m,d)=>{const t=new Date(Date.UTC(yr,m,d));return t.getUTCMonth()===m&&t.getUTCDate()===d};
  const mdY=(m,d,y)=>{const yr=y?(+y<100?2000+ +y:+y):T.getFullYear();let k=okD(yr,m,d)?key(yr,m,d):null;if(!y&&k&&k<tds)k=okD(yr+1,m,d)?key(yr+1,m,d):null;return k};
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
  const tds=todayStr();const dk='sct_digest_'+ME.id;if(localStorage.getItem(dk)===tds)return;localStorage.setItem(dk,tds);
  const A=S.tasks.filter(t=>t.status==='active'),td=A.filter(t=>t.date===tds),od=A.filter(t=>t.date&&t.date<tds),first=sortAct(td.filter(t=>t.time))[0];
  ping('☀️ Daily digest',`${td.length} task${td.length===1?'':'s'} today, ${od.length} overdue`+(first?` · first: ${fmtT(first.time)} ${first.title}`:''));
}

/* ---------- boot: load this user's board from the server ---------- */
function showFatal(e){document.querySelectorAll('.top,#dash,.cal').forEach(x=>x.hidden=true);
  document.body.insertAdjacentHTML('afterbegin',`<div class="panel fatal"><h2>😕 Can’t reach the server</h2><p class="sub">${esc(e.message)}. Your data is safe — check your connection and try again.</p><button class="btn pri" onclick="location.reload()">Retry</button></div>`)}
async function boot(){
  let m;try{m=await currentUser()}catch(e){return showFatal(e)}
  if(!m)return location.replace('login.html');
  ME=m.user;S=m.board||{tasks:[],theme:'white'};
  const old=localStorage.getItem('smart_calendar_taskboard_v1_u_admin'); // one-time import of pre-server admin data
  if(ME.role==='admin'&&!(S.tasks||[]).length&&!S.seeded&&old){try{S=JSON.parse(old);S.seeded=1;dirty=true}catch(e){}}
  if(ME.role==='admin'&&!(S.tasks||[]).length&&!S.seeded){S.seeded=1;const d=todayStr();
    S.tasks=[['Call ricardo magsacay','Discuss pending collections','Now','#ebd3ff'],['Send follow-up emails','Contact all billing addresses','Next','#c3e2ff'],['Update contact list','Sync files to cloud','Later','#ffd1ea']]
    .map((x,i)=>({id:'seed'+i,date:d,title:x[0],description:x[1],priority:x[2],status:'active',pinned:false,favorite:false,color:x[3],created:d}));dirty=true}
  norm();
  $('#who').innerHTML=`<b>${esc(ME.name||ME.username)}</b> ${esc(ME.role)}`;$('#usersLink').hidden=ME.role!=='admin';$('#banner').hidden=!ME.mustChange;
  setTheme(S.theme||'white',true);$('#optRoll').checked=!!S.rollover;syncNotif();rollover();renderCal();digest();tick();
  if(dirty)save();else setSaved('✓ Saved');
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncFromServer()});window.addEventListener('focus',syncFromServer);setInterval(syncFromServer,60000);
}
boot();

/* ---------- keep keyboard focus inside the open dialog ---------- */
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const ov=[...document.querySelectorAll('.overlay')].filter(o=>!o.hidden).pop();if(!ov)return;
  const f=[...ov.querySelectorAll('button,[href],input,select,textarea')].filter(x=>!x.disabled&&x.type!=='hidden'&&x.offsetParent!==null);if(!f.length)return;
  const a=f[0],z=f[f.length-1];
  if(!ov.contains(document.activeElement)){e.preventDefault();a.focus()}
  else if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
  else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});
