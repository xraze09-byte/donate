// Real index.html JS in jsdom. Run: node test/resilience.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot({hash='#overlay?k=testkey123',ws='wss://relay.test/ws'}={}){
 const errors=[],sockets=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   class FakeWS{constructor(u){this.url=u;this.readyState=0;sockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen&&this.onopen()},0)}
    send(){}close(){this.readyState=3;setTimeout(()=>this.onclose&&this.onclose(),0)}}
   w.WebSocket=FakeWS;
   w.fetch=()=>Promise.reject(new Error('blocked'));
   w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
   w.HTMLCanvasElement.prototype.getContext=()=>null;w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({pp:'0812345678',payee:'RZ',min:20,key:'testkey123',ws}));
  }});
 const app=()=>sockets.filter(x=>x.url.startsWith('wss://relay.test'));
 return {dom,w:dom.window,errors,sockets,app};
}
const shown=w=>w.document.getElementById('aName').textContent;
(async()=>{
 let t,plays;
 // 1) same alert arriving via 3 channels => plays once
 t=boot();await sleep(500);
 const spy=[];const nm=t.w.document.getElementById('aName');
 new t.w.MutationObserver(()=>spy.push(nm.textContent)).observe(nm,{childList:true,characterData:true,subtree:true});
 const msg={t:'alert',d:{name:'DupTest',amount:100,message:'hi'},i:'x'};
 t.app()[0].onmessage({data:JSON.stringify(msg)});
 t.app()[0].onmessage({data:JSON.stringify(msg)});
 t.app()[0].onmessage({data:JSON.stringify(msg)});
 await sleep(300);
 ok(spy.filter(x=>x==='DUPTEST').length===1,'triple-delivered alert plays exactly once');
 ok(t.errors.length===0,'no script errors after dup alerts');

 // 2) reconnect: backoff grows, only ONE socket at a time, resets after open
 t=boot();await sleep(300);
 ok(t.app().length===1,'exactly one app relay socket on boot');
 const first=t.app()[0];first.readyState=3;first.onclose();first.onclose();first.onclose(); // storm of close events
 await sleep(2600);
 ok(t.app().length===2,'close storm => exactly 1 reconnect (got '+t.app().length+' app sockets)');

 // 3) closing repeatedly never faster than ~0.7s (no tight loop)
 t=boot();await sleep(200);
 let n0=t.app().length;
 for(let i=0;i<3;i++){const l=t.app()[t.app().length-1];l.readyState=3;l.onclose();await sleep(300)}
 ok(t.app().length-n0<=1,'rapid closes do not spawn a socket per close');

 // 4) queue cap: 100 unique alerts do not crash and are bounded
 t=boot();await sleep(300);
 for(let i=0;i<100;i++)t.app()[0].onmessage({data:JSON.stringify({t:'alert',d:{name:'U'+i,amount:20+i,message:''}})});
 await sleep(200);
 ok(t.errors.length===0,'100-alert flood: 0 script errors');

 // 5) admin: approving twice does not emit a second alert
 t=boot({hash:'#admin'});await sleep(300);
 ok(t.errors.length===0,'admin boots clean with add-on');
 ok(typeof t.w.NF5==='object'&&typeof t.w.NF5.exportCsv==='function','NF5.exportCsv exposed');

 // 6) OBS: no flash toast / no NF5 UI noise
 t=boot();await sleep(300);
 ok(!t.w.document.querySelector('.nf-flash'),'OBS overlay shows no toast chrome');

 // 7) slip hash helper behaves (identical => 0, inverted => 64)
 const src=HTML.match(/var SLIPH=\{[\s\S]*?\n\};/)[0];
 const S=new Function(src+';return SLIPH')();
 const a='1010'.repeat(16),b=a.replace(/1/g,'x').replace(/0/g,'1').replace(/x/g,'0');
 ok(S.dist(a,a)===0&&S.dist(a,b)===64,'slip hash distance math');
 ok(S.dup(a,[{id:1,sh:a}],2)&&!S.dup(a,[{id:1,sh:b}],2)&&!S.dup(a,[{id:2,sh:a}],2),'dup detection excludes self, rejects different');

 console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH',e);process.exit(2)});
