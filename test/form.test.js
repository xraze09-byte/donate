// Runs the REAL index.html JS in jsdom. Run: node test/form.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function boot({health='ok',hash='',pp='0812345678'}={}){
 const errors=[],sent=[],fetched=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   class FakeWS{constructor(u){this.url=u;this.readyState=1;FakeWS.all.push(this);setTimeout(()=>this.onopen&&this.onopen(),0)}send(d){sent.push(JSON.parse(d))}close(){this.readyState=3}}
   FakeWS.all=[];w.WebSocket=FakeWS;
   w.fetch=(u)=>{fetched.push(String(u));
    if(String(u).includes('/health')){
     if(health==='ok')return Promise.resolve({ok:true,json:()=>Promise.resolve({ok:true})});
     if(health==='hang')return new Promise(()=>{});
     return Promise.reject(new Error('down'))}
    return Promise.reject(new Error('blocked in test'))};
   w.AbortController=undefined;                                   // exercise the no-abort branch too
   w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
   w.HTMLCanvasElement.prototype.getContext=()=>null;
   w.scrollTo=()=>{};
   w.tailwind={};                                   // the CDN script can't load in jsdom; stub what it defines
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({pp,payee:'RZ',min:20,reqSlip:false,key:'testkey123'}));
  }});
 return {dom,w:dom.window,errors,sent,fetched};
}
const set=(w,id,v)=>{const e=w.document.getElementById(id);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}))};
const submit=w=>w.document.getElementById('dForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
async function donate(t,{name='Somchai',amt='60',q=null}={}){
 const w=t.w;set(w,'dName',name);set(w,'dAmt',amt);
 if(q){const c=w.document.getElementById('dQ');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));
  if(q.name!=null)set(w,'dQName',q.name);set(w,'dQUid',q.uid)}
 submit(w);await sleep(50);
 const modalOpen=w.document.getElementById('pay').classList.contains('on');
 if(modalOpen){w.document.getElementById('bSubmit').click();await sleep(150)}
 return modalOpen}
const donations=t=>t.sent.filter(m=>m.t==='donation');

(async()=>{
 // 1) page boots with zero script errors
 let t=boot();await sleep(300);
 ok(t.errors.length===0,'page loads: 0 script errors '+(t.errors[0]||''));
 ok(!!t.w.document.getElementById('dQ'),'queue checkbox present');
 ok(t.w.document.getElementById('qFields').style.display==='none','queue fields hidden by default');

 // 2) REGRESSION: normal donation without queue behaves exactly like before
 t=boot();await sleep(300);
 ok(await donate(t),'no-queue donation: pay modal opens');
 let d=donations(t)[0];
 ok(!!d&&d.d.rec.amount===60&&d.d.rec.name==='Somchai','no-queue donation: emitted with right name/amount');
 ok(d&&d.d.rec.q===undefined,'no-queue donation: NO q field attached');
 ok(d&&d.d.rec.status==='pending','no-queue donation: status pending');

 // 3) donation WITH queue
 t=boot();await sleep(300);
 ok(await donate(t,{q:{name:'SomchaiFF',uid:'123456789482'}}),'queue donation: pay modal opens');
 d=donations(t)[0];
 ok(d&&d.d.rec.q&&d.d.rec.q.uid==='123456789482'&&d.d.rec.q.name==='SomchaiFF','queue donation: q{name,uid} in emitted record');
 ok(d&&d.d.rec.amount===60,'queue donation: amount unchanged');

 // 4) nickname blank => falls back to donor name
 t=boot();await sleep(300);
 await donate(t,{q:{name:'',uid:'987654321'}});d=donations(t)[0];
 ok(d&&d.d.rec.q&&d.d.rec.q.name==='Somchai','blank game name => falls back to donor name');

 // 5) bad UID => blocked BEFORE payment modal; nothing emitted
 for(const bad of ['123','abc','12345','']){
  t=boot();await sleep(300);
  const opened=await donate(t,{q:{name:'x',uid:bad}});
  ok(!opened&&donations(t).length===0,`bad UID "${bad}" => no modal, nothing sent`);
  ok(t.w.document.getElementById('eQUid').classList.contains('on'),`bad UID "${bad}" => error shown`)}

 // 6) UID input strips non-digits, caps at 14
 t=boot();await sleep(300);
 set(t.w,'dQUid','12-34 56abc789012345678');
 ok(t.w.document.getElementById('dQUid').value==='12345678901234','UID field keeps digits only, max 14');

 // 7) ticked then UNticked => q not sent even if UID text remains
 t=boot();await sleep(300);
 t.w.document.getElementById('dQ').checked=true;set(t.w,'dQUid','123456789');
 t.w.document.getElementById('dQ').checked=false;
 await donate(t);d=donations(t)[0];
 ok(d&&d.d.rec.q===undefined,'unticked box => no q even if UID typed earlier');

 // 8) validation of payment fields unchanged
 t=boot();await sleep(300);
 ok(!(await donate(t,{name:'',amt:'60'})),'empty name still blocked');
 t=boot();await sleep(300);
 ok(!(await donate(t,{amt:'5'})),'below minimum still blocked');
 t=boot({pp:''});await sleep(300);
 ok(!(await donate(t)),'PromptPay not configured => still blocked');

 // 9) form resets queue block after submit
 t=boot();await sleep(300);
 await donate(t,{q:{name:'a',uid:'123456789'}});
 ok(t.w.document.getElementById('qFields').style.display==='none','queue fields collapse after submit');

 // 10) circuit breaker: queue healthy => iframe shown, src correct
 t=boot({health:'ok'});await sleep(400);
 const f=t.w.document.getElementById('qF');
 ok(/^https:\/\/queue-system-r517\.onrender\.com\/embed\?ch=rzc_testkey123&parent=/.test(f.src),'healthy: iframe src -> /embed with ch + parent');
 f.onload&&f.onload();
 ok(t.w.document.getElementById('qBox').style.display==='','healthy + loaded: box visible');

 // 11) queue DOWN: box stays hidden, payment still works, 0 errors
 t=boot({health:'down'});await sleep(400);
 ok(t.w.document.getElementById('qBox').style.display==='none','queue down: box hidden');
 ok(!t.w.document.getElementById('qF').getAttribute('src'),'queue down: iframe never loaded');
 ok(await donate(t),'queue down: donation still works');
 ok(donations(t).length===1,'queue down: donation emitted');
 ok(t.errors.length===0,'queue down: 0 script errors');

 // 12) queue HANGS: breaker gives up at 6s, box never shown
 t=boot({health:'hang'});await sleep(6400);
 ok(t.w.document.getElementById('qBox').style.display==='none','queue hangs: box hidden after 6s');
 ok(await donate(t),'queue hangs: donation still works');
 ok(t.errors.length===0,'queue hangs: 0 script errors');

 // 13) never mounts on OBS overlay / admin views
 for(const h of ['#overlay?k=testkey123','#admin']){
  t=boot({hash:h});await sleep(400);
  ok(!t.fetched.some(u=>u.includes('queue-system-r517')),`${h}: queue not contacted`)}

 // 14) resize message: only from queue origin, clamped
 t=boot();await sleep(400);
 const fr=t.w.document.getElementById('qF');
 t.w.dispatchEvent(new t.w.MessageEvent('message',{origin:'https://evil.test',data:{type:'rzq:height',h:500}}));
 ok(fr.style.height==='210px','resize from foreign origin ignored');
 t.w.dispatchEvent(new t.w.MessageEvent('message',{origin:'https://queue-system-r517.onrender.com',data:{type:'rzq:height',h:320}}));
 ok(fr.style.height==='320px','resize from queue origin applied');
 t.w.dispatchEvent(new t.w.MessageEvent('message',{origin:'https://queue-system-r517.onrender.com',data:{type:'rzq:height',h:99999}}));
 ok(fr.style.height==='320px','absurd height rejected');

 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH',e);process.exit(2)});
