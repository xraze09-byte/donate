// Rank Lookup (donor page) in the REAL index.html. Run: node test/rank.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const NOW=Date.now(),DAY=864e5;
const rec=(i,name,amount,status='approved',ts=NOW-i*1000)=>({id:'id'+i,ref:'R'+i,name,amount,message:'',ts,status});
function boot(dons){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/',virtualConsole:vc,
  beforeParse(w){
   w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
   class FakeWS{constructor(u){this.url=u;this.readyState=1;setTimeout(()=>this.onopen&&this.onopen(),0)}send(){}close(){this.readyState=3}}
   w.WebSocket=FakeWS;w.fetch=()=>Promise.reject(new Error('blocked'));
   w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({pp:'0812345678',payee:'RZ',min:20,reqSlip:false,key:'k123',goal:10000}));
   w.localStorage.setItem('rzc_db_v4',JSON.stringify({don:dons,slip:{}}));
  }});
 return {w:dom.window,d:dom.window.document,errors};
}
const type=(t,id,v)=>{const e=t.d.getElementById(id);e.value=v;e.dispatchEvent(new t.w.Event('input',{bubbles:true}))};
const card=t=>t.d.getElementById('rkCard');
(async()=>{
 const DONS=[
  rec(1,'Alice',1200),rec(2,'Bob',150),rec(3,'alice',400),            // Alice total 1600 => ELITE ; case-insensitive
  rec(4,'Ghost',9999,'pending'),                                      // pending never counts
  rec(5,'<img src=x onerror=window.__pwn=1>',600),
  // Dan: 3 consecutive days ending today => streak 3, 3 drops => REPEATER
  rec(6,'Dan',50,'approved',NOW),rec(7,'Dan',50,'approved',NOW-DAY),rec(8,'Dan',50,'approved',NOW-2*DAY),
  // Eve: donated 5 days ago only => streak 0
  rec(9,'Eve',100,'approved',NOW-5*DAY)];
 let t=boot(DONS);await sleep(1800);
 ok(t.errors.length===0,'donor page boots with 0 script errors '+(t.errors[0]||''));
 ok(!!t.d.getElementById('rkName')&&!!card(t),'Rank Lookup panel is mounted on the donor page');
 ok(t.d.querySelectorAll('#rkName').length===1,'mounted exactly once');
 ok(!card(t).classList.contains('on'),'card hidden until a name is typed');

 type(t,'rkName','ALICE');
 ok(card(t).classList.contains('on')&&/ELITE/.test(card(t).textContent),'case-insensitive lookup merges Alice+alice => ELITE ('+card(t).querySelector('.rkl-name').textContent+')');
 ok(/฿1,600/.test(card(t).textContent),'total is 1,600');
 ok(/อีก ฿3,400 ถึงยศ CHAMPION/.test(card(t).textContent),'XP hint: 3,400 to CHAMPION');
 ok(/#1\/\d/.test(card(t).textContent),'leaderboard position #1');
 ok(/REPEATER ×3/.test(card(t).textContent)&&card(t).querySelectorAll('.rkl-b.on').length>=3,'badges unlocked');

 type(t,'rkName','Ghost');
 ok(/ยังไม่พบ/.test(card(t).textContent),'pending-only donor is NOT ranked (unknown)');
 type(t,'rkName','nobody');
 ok(/ยังไม่พบ/.test(card(t).textContent)&&/ROOKIE/.test(card(t).textContent),'unknown name => friendly "not found" + ROOKIE hint');

 type(t,'rkName','Dan');
 ok(/3d/.test(card(t).textContent),'3 consecutive days => streak 3d');
 ok(/STREAK 3 วัน/.test(card(t).innerHTML)&&/rkl-b on">✓ STREAK 3/.test(card(t).innerHTML),'STREAK badge unlocked');
 type(t,'rkName','Eve');
 ok(/0d/.test(card(t).textContent),'old donation => streak 0d');

 type(t,'rkName','<img src=x onerror=window.__pwn=1>');
 ok(!t.w.__pwn&&!card(t).querySelector('img'),'XSS: name is escaped, nothing executes');

 // nudge in the donate form
 type(t,'rkName','');
 ok(!card(t).classList.contains('on'),'clearing the box hides the card');
 type(t,'dName','Alice');type(t,'dAmt','3400');
 const n=t.d.getElementById('rkNudge');
 ok(n.classList.contains('on')&&/ELITE → CHAMPION/.test(n.textContent),'form nudge: this amount promotes ELITE → CHAMPION ('+n.textContent+')');
 type(t,'dAmt','100');
 ok(/อีก ฿3,300 จะถึงยศ CHAMPION/.test(n.textContent),'form nudge: remaining amount shown ('+n.textContent+')');
 type(t,'dName','');
 ok(!n.classList.contains('on'),'nudge hidden without a name');
 type(t,'dName','Brandnew');type(t,'dAmt','100');
 ok(/ROOKIE → OPERATOR/.test(n.textContent),'new donor with 100 => ROOKIE → OPERATOR');
 ok(t.errors.length===0,'0 script errors after all interactions '+(t.errors[0]||''));
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(2)});
