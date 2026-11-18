/* Talks to the Netlify Function at /api so accounts + boards are shared on every PC. */
const TK='sct_token_v2';
try{const t=localStorage.getItem('sct_theme');if(['white','dark','pink','cepalco'].includes(t)&&document.body)document.body.className=document.body.className.replace(/\bth-\w+/,'th-'+t)}catch(e){}
async function api(path,method='GET',body){
  let r;
  try{r=await fetch(path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem(TK)||'')},body:body?JSON.stringify(body):undefined})}
  catch(x){const e=new Error('No connection to the server');e.status=0;throw e}
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(d.error||('Server error '+r.status));e.status=r.status;e.data=d;throw e}
  return d;
}
async function login(u,p){const d=await api('/api/login','POST',{username:u,password:p});localStorage.setItem(TK,d.token);return d.user}
async function currentUser(){try{return await api('/api/me')}catch(e){if(e.status===401)return null;throw e}} // {user,board} | null (throws if server unreachable)
async function logout(){try{await api('/api/logout','POST')}catch(e){}localStorage.removeItem(TK);location.href='login.html'}
