// OBS overlay hardening: regression tests for every bug found while stress-testing the overlay. Run: node test/obs-hardening.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(hash){
 const errors=[],socks=[],urls=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
   class WS extends w.EventTarget{constructor(u){super();this.url=u;this.readyState=0;socks.push(this);setTimeout(()=>{this.readyState=1;this.dispatchEvent(new w.Event('open'));this.onopen&&this.onopen()},0)}send(){}close(){this.readyState=3;this.onclose&&this.onclose()}}
   w.WebSocket=WS;
   w.fetch=u=>{const s=String(u);if(/\/tts/.test(s)){urls.push(decodeURIComponent(s).replace(/^.*q=/,'').replace(/&v=.*/,''));return Promise.reject(new Error('no net'))}return Promise.reject(new Error('x'))};
   const node=()=>new Proxy({frequency:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},Q:{value:0},detune:{value:0}},{get:(o,k)=>k in o?o[k]:()=>node()});
   w.AudioContext=w.webkitAudioContext=function(){return new Proxy({currentTime:0,sampleRate:44100,state:'running',destination:{},resume(){return Promise.resolve()},createBuffer:()=>({getChannelData:()=>new Float32Array(10)})},{get:(o,k)=>k in o?o[k]:()=>node()})};
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({min:20,key:'k123',goal:10000,ws:'wss://relay.test/ws'}));}});
 const w=dom.window,d=dom.window.document;const shown=[],amts=[];
 new w.MutationObserver(()=>shown.push(d.getElementById('aName').textContent)).observe(d.getElementById('aName'),{childList:true,characterData:true,subtree:true});
 new w.MutationObserver(()=>amts.push(d.getElementById('aAmt').textContent)).observe(d.getElementById('aAmt'),{childList:true,characterData:true,subtree:true});
 const bus=(dd,id)=>w.dispatchEvent(new w.StorageEvent('storage',{key:'rzc_bus_v4',newValue:JSON.stringify({t:'alert',d:dd,i:id})}));
 const wsend=(dd,id)=>{const m=JSON.stringify({t:'alert',d:dd,i:id});socks.forEach(s=>{try{s.onmessage&&s.onmessage({data:m})}catch(e){}})};
 return {w,d,errors,socks,urls,shown,amts,bus,wsend};
}
const spoken=t=>t.urls.join(' || ');
(async()=>{
 // 1) legit repeat donation (same donor/amount/msg, distinct message ids) must show BOTH times
 let t=boot('#overlay?k=k123');await sleep(1100);
 t.bus({name:'Rep',amount:50,message:'r'},'id-1');await sleep(7600);t.bus({name:'Rep',amount:50,message:'r'},'id-2');await sleep(7600);
 ok(t.shown.filter(x=>/REP/.test(x)).length===2,'same donor+amount+msg with DIFFERENT ids => both alerts shown');
 // 2) one donation delivered over 3 channels with the SAME id => once (card and voice)
 t=boot('#overlay?k=k123');await sleep(1100);const M={name:'Once',amount:777,message:'dup'};
 t.bus(M,'sid');t.wsend(M,'sid');t.bus(M,'sid');await sleep(9000);
 ok(t.shown.filter(x=>/ONCE/.test(x)).length===1,'same id via storage+ws+storage => card shown once');
 ok(t.urls.filter(u=>/Once/.test(u)).length===1,'same id via 2 sockets => spoken once');
 // 3) profanity never reaches the voice path
 t=boot('#overlay?k=k123');await sleep(1100);
 t.wsend({name:'fuck bot',amount:100,message:'ไอ้สัตว์ มึงตาย shit'},'p1');await sleep(3500);
 ok(!/fuck|shit|ไอ้สัตว์|มึงตาย/i.test(spoken(t)),'TTS never speaks profanity (name or message) ['+spoken(t)+']');
 ok(t.urls.length===1&&/บริจาค/.test(t.urls[0]),'alert is still announced (amount) with the bad words removed');
 t.w.localStorage.setItem('rzc_shield',JSON.stringify({names:'troll'}));t.urls.length=0;
 t.wsend({name:'TrollKing',amount:100,message:'hi'},'p2');await sleep(2500);
 ok(t.urls.length===0,'blacklisted name is not spoken');
 // 4) amounts: <=0 / non-numeric dropped on card AND voice; huge amounts never read "undefined"
 t=boot('#overlay?k=k123');await sleep(1100);
 for(const [i,a] of [[1,-500],[2,0],[3,'abc'],[4,NaN],[5,null]]){t.bus({name:'Bad'+i,amount:a,message:'x'},'b'+i);t.wsend({name:'Bad'+i,amount:a,message:'x'},'bw'+i)}
 await sleep(1500);
 ok(!t.shown.some(x=>/BAD/.test(x)),'amount <=0 / NaN / non-numeric: no card');
 ok(t.urls.length===0,'amount <=0 / NaN / non-numeric: nothing spoken');
 ok(!t.amts.some(x=>/^-/.test(x)),'negative amount is never displayed');
 t.urls.length=0;
 for(const [i,a] of [[1,10000000],[2,12345678],[3,99999999],[4,1e12]]){t.wsend({name:'Big',amount:a,message:''},'g'+i);await sleep(150)}
 await sleep(3500);
 ok(t.urls.length>=3&&!t.urls.some(u=>/undefined|NaN|Infinity/.test(u)),'huge amounts never spoken as undefined/NaN ['+t.urls.length+' spoken]');
 // 5) html in names is stripped before speech and never executes
 t=boot('#overlay?k=k123');await sleep(1100);
 t.wsend({name:'<b onmouseover=1>Tom</b>',amount:100,message:'<script>window.__x=1</script>hello'},'h1');await sleep(3000);
 ok(/^Tom, /.test(t.urls[0]||'')&&!/onmouseover|script|window/i.test(t.urls[0]||''),'HTML tags removed before speech ['+(t.urls[0]||'')+']');
 ok(!t.w.__x,'no script execution from donor text');
 // 6) a quiet but healthy socket is NOT recycled (relay pings are invisible to JS; silence is normal)
 t=boot('#overlay?k=k123');await sleep(1100);
 const n0=t.socks.length;const real=t.w.Date.now;let off=0;t.w.Date.now=()=>real()+off;off=300000;await sleep(16500);
 ok(t.socks.length===n0,'200s+ of silence does not cycle the sockets ('+n0+' -> '+t.socks.length+')');
 // 7) a socket that really died is brought back (app + RAW feed)
 const app=t.socks[0],raw=t.socks[1];app.readyState=3;raw.readyState=3;
 await sleep(17000);
 const live=t.socks.filter(x=>x.readyState<=1);
 ok(live.length===2,'dead sockets are re-opened, exactly 1 app + 1 RAW (no duplicates): live='+live.length+' total opened='+t.socks.length);
 ok(t.errors.length===0,'0 script errors '+(t.errors[0]||''));
 // 8) inflected profanity caught, innocent words untouched
 t=boot('');await sleep(900);const S=t.w.__RZ_SHIELD.SHIELD;
 for(const w of ['you fucking idiot','fucked up','shitty day','bitches','assholes'])ok(!!S.hit(w),'filter catches inflection: "'+w+'"');
 for(const w of ['Scunthorpe','Dickson','classic','assistant','Hancock','passion','Essex'])ok(!S.hit(w),'filter leaves innocent word: "'+w+'"');
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e);process.exit(2)});
