// RZX donor extras (live status, milestones, ranks, donor wall, share card, admin overlay button).
// Runs the REAL index.html in jsdom. Run: node test/extras.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const NOW=Date.now();
const rec=(i,name,amount,status='approved',message='')=>({id:'id'+i,ref:'R'+i,name,amount,message,ts:NOW-i*1000,status});

function boot({hash='',url='https://donate.test/',cfg={},dons=[]}={}){
 const errors=[],opened=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:url+hash,virtualConsole:vc,
  beforeParse(w){
   class FakeWS{constructor(u){this.url=u;this.readyState=1;setTimeout(()=>this.onopen&&this.onopen(),0)}send(){}close(){this.readyState=3}}
   w.WebSocket=FakeWS;w.fetch=()=>Promise.reject(new Error('blocked'));
   w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
   w.HTMLCanvasElement.prototype.getContext=()=>null;w.scrollTo=()=>{};w.tailwind={};
   w.open=(u,t,f)=>{opened.push({u,t,f});return null};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify(Object.assign({pp:'0812345678',payee:'RZ',min:20,reqSlip:false,key:'testkey123',goal:10000},cfg)));
   w.localStorage.setItem('rzc_db_v4',JSON.stringify({don:dons,slip:{}}));
  }});
 return {dom,w:dom.window,d:dom.window.document,errors,opened};
}
const DONS=[rec(1,'Alice',1200),rec(2,'Bob',150),rec(3,'Alice',300),rec(4,'Pending Guy',9999,'pending'),
            rec(5,'<img src=x onerror=window.__pwn=1>',600,'approved','<b>hi</b>'),rec(6,'Carol',50)];

(async()=>{
 // 1) boot: no errors; new panels mounted; pending not counted
 let t=boot({dons:DONS});await sleep(2200);
 ok(t.errors.length===0,'donor page: 0 script errors '+(t.errors[0]||''));
 ok(!!t.d.getElementById('rzxSec'),'extras section mounted');
 ok(!!t.d.getElementById('rzxLive'),'live status strip mounted');
 ok(['rzxMsP','rzxWallP','rzxShP'].every(id=>t.d.getElementById(id)),'milestones + wall + share panels present');
 ok(t.d.querySelectorAll('#rzxSec').length===1,'mounted exactly once');

 // 2) milestones from goal=10000: 1000,2500,5000,7500,10000 ; approved total = 2300 (pending excluded)
 const ms=[...t.d.querySelectorAll('#rzxMs .rzx-m')];
 ok(ms.length===5,'5 auto milestones (got '+ms.length+')');
 ok(ms.filter(m=>m.classList.contains('done')).length===1,'only the 1,000 milestone is unlocked at 2,300 total');
 ok(ms.filter(m=>m.classList.contains('next')).length===1&&ms[1].classList.contains('next'),'next milestone highlighted (2,500)');

 // 3) ranks: Alice total 1500 => GOLD ; Bob etc none/bronze
 const board=t.d.getElementById('board').textContent;
 ok(/GOLD/.test(board),'Alice (฿1,500) shows GOLD rank in Top Donators');
 ok(t.d.querySelectorAll('#board .rzx-rank').length>=2,'ranks added to several rows without duplicating on re-tick');
 await sleep(3200);
 const nRanks=t.d.querySelectorAll('#board .rzx-rank').length;
 ok(t.d.querySelectorAll('#board .rk').length>=nRanks&&[...t.d.querySelectorAll('#board .rk')].every(r=>r.querySelectorAll('.rzx-rank').length<=1),'no duplicate rank badges after more ticks');

 // 4) donor wall + XSS
 const wall=t.d.getElementById('rzxWall');
 ok(wall.querySelectorAll('span').length===4,'wall lists 4 unique approved supporters (got '+wall.querySelectorAll('span').length+')');
 ok(!wall.innerHTML.includes('<img'),'wall escapes hostile name (no <img> element)');
 ok(!t.w.__pwn&&!t.d.querySelector('#rzxSec img[src="x"]'),'XSS payload did not execute');
 ok(!/Pending Guy/.test(wall.textContent),'pending donor not on wall');

 // 5) live status default OFFLINE ; countdown from link param
 ok(/OFFLINE/.test(t.d.getElementById('rzxLive').textContent),'defaults to OFFLINE');
 const nxt=NOW+3*3600*1000+5000;
 t=boot({dons:DONS,hash:'#?live=0&next='+nxt});await sleep(2200);
 ok(/NEXT STREAM IN 0[23]:/.test(t.d.getElementById('rzxLive').textContent),'countdown renders ~3h ('+t.d.getElementById('rzxLive').textContent.trim()+')');
 t=boot({dons:DONS,hash:'#?live=1&stream='+encodeURIComponent('https://twitch.tv/rz')});await sleep(2200);
 const lv=t.d.getElementById('rzxLive');
 ok(/LIVE NOW/.test(lv.textContent),'LIVE NOW from link param');
 const a=lv.querySelector('a');ok(a&&a.href.startsWith('https://twitch.tv/')&&/noopener/.test(a.rel),'watch link https + noopener');
 t=boot({dons:DONS,hash:'#?live=1&stream='+encodeURIComponent('javascript:alert(1)')});await sleep(2200);
 ok(!t.d.getElementById('rzxLive').querySelector('a'),'non-https stream link rejected');

 // 6) custom milestones from link
 t=boot({dons:DONS,hash:'#?ms=500,2000,99999999999,abc'});await sleep(2200);
 ok(t.d.querySelectorAll('#rzxMs .rzx-m').length===2,'custom milestones parsed, invalid ones dropped');

 // 7) share card: with no canvas context it fails soft (jsdom), no crash
 t=boot({dons:DONS});await sleep(2200);
 t.d.getElementById('rzxShName').value='Alice';t.d.getElementById('rzxMk').click();await sleep(200);
 ok(t.errors.length===0,'create-card click: 0 script errors');
 ok(/สร้างรูปไม่ได้/.test(t.d.getElementById('rzxCardOut').textContent),'share card fails soft when canvas unavailable');

 // 8) admin: overlay editor button uses CFG.key, opens ?edit=1#overlay?k=..., noopener
 t=boot({dons:DONS,hash:'#admin',cfg:{key:'adminkey999',ws:'wss://x.test/ws'}});await sleep(2200);
 const btn=t.d.getElementById('rzxEdBtn');
 ok(!!btn,'OPEN OVERLAY EDITOR button exists in admin SYSTEM tab');
 btn&&btn.click();
 ok(t.opened.length===1&&/\?edit=1#overlay\?k=adminkey999/.test(t.opened[0].u),'button opens ?edit=1#overlay?k=<CFG.key> ('+(t.opened[0]&&t.opened[0].u)+')');
 ok(t.opened[0]&&/noopener/.test(t.opened[0].f||''),'opened with noopener');
 ok(!/fce4afe701527d17fbef394d/.test(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').split('RZX DONOR EXTRAS')[1]||''),'extras module does not hard-code the secret key');

 // 9) admin save -> DONATE LINK carries live/next/stream/ms
 t.d.getElementById('rzxLiveCk').checked=true;t.d.getElementById('rzxStreamUrl').value='https://twitch.tv/rz';
 t.d.getElementById('rzxMsIn').value='500, 1000,2500';t.d.getElementById('rzxSaveX').click();await sleep(1500);
 const du=t.d.getElementById('donUrl').value;
 ok(/[&?]live=1/.test(du)&&/stream=https%3A%2F%2Ftwitch\.tv%2Frz/.test(du)&&/ms=500%2C1000%2C2500/.test(du),'DONATE LINK includes live/stream/ms ('+du.slice(-90)+')');
 t.d.getElementById('rzxSaveX').click();await sleep(1500);
 ok((t.d.getElementById('donUrl').value.match(/live=1/g)||[]).length===1,'saving twice does not duplicate params');
 t.d.getElementById('rzxStreamUrl').value='http://bad';t.d.getElementById('rzxSaveX').click();await sleep(200);
 ok(!/stream=http%3A%2F%2Fbad/.test(t.d.getElementById('donUrl').value),'non-https stream link refused on save');

 // 10) OBS overlay untouched
 t=boot({dons:DONS,hash:'#overlay?k=testkey123'});await sleep(2200);
 ok(t.errors.length===0,'overlay: 0 script errors '+(t.errors[0]||''));
 ok(!t.d.getElementById('rzxSec')&&!t.d.getElementById('rzxLive')&&!t.d.getElementById('rzxAdm'),'overlay: no extras injected');

 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(2)});
