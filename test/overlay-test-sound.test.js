// Sound on the overlay when alerts arrive over the LOCAL channels (admin PREVIEW/SIMULATE/REPLAY, relay offline). Run: node test/overlay-test-sound.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BUS={};   // channel name -> Set of instances (shared across jsdom windows = same browser profile)
function makeBC(w){return class BC{constructor(n){this.name=n;this._l=[];(BUS[n]=BUS[n]||new Set()).add(this)}
  postMessage(d){for(const o of BUS[this.name])if(o!==this)setTimeout(()=>{const ev={data:JSON.parse(JSON.stringify(d))};o.onmessage&&o.onmessage(ev);o._l.forEach(f=>f(ev))},0)}
  addEventListener(t,f){if(t==='message')this._l.push(f)} removeEventListener(){} close(){BUS[this.name].delete(this)}}}
function boot(hash,opts){
 opts=opts||{};const errors=[],socks=[],urls=[];let audible=0;const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   w.HTMLMediaElement.prototype.play=function(){const el=this;if(el.muted)return Promise.resolve();
     if(opts.blocked)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));
     audible++;setTimeout(()=>el.dispatchEvent(new w.Event('playing')),5);setTimeout(()=>el.dispatchEvent(new w.Event('ended')),800);return Promise.resolve()};
   w.HTMLMediaElement.prototype.pause=()=>{};
   class WS extends w.EventTarget{constructor(u){super();this.url=u;this.readyState=opts.offline?3:0;socks.push(this);if(!opts.offline)setTimeout(()=>{this.readyState=1;this.dispatchEvent(new w.Event('open'));this.onopen&&this.onopen()},0)}send(){}close(){this.readyState=3}}
   w.WebSocket=WS;w.BroadcastChannel=makeBC(w);
   w.fetch=u=>{const s=String(u);if(/\/tts/.test(s)){urls.push(decodeURIComponent(s).replace(/^.*q=/,'').replace(/&v=.*/,''));return Promise.resolve({ok:true,headers:{get:k=>/content-type/i.test(k)?'audio/mpeg':''},blob:()=>Promise.resolve({size:5000})})}return Promise.reject(new Error('x'))};
   w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
   const node=()=>new Proxy({frequency:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},Q:{value:0},detune:{value:0}},{get:(o,k)=>k in o?o[k]:()=>node()});
   w.AudioContext=w.webkitAudioContext=function(){return new Proxy({currentTime:0,sampleRate:44100,state:'running',destination:{},resume(){return Promise.resolve()},createBuffer:()=>({getChannelData:()=>new Float32Array(10)})},{get:(o,k)=>k in o?o[k]:()=>node()})};
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({min:20,key:'k123',goal:10000,ws:'wss://relay.test/ws'}));}});
 const w=dom.window,d=dom.window.document;const shown=[];
 new w.MutationObserver(()=>shown.push(d.getElementById('aName').textContent)).observe(d.getElementById('aName'),{childList:true,characterData:true,subtree:true});
 return {w,d,errors,socks,urls,shown,audible:()=>audible,
  storage:(dd,id)=>w.dispatchEvent(new w.StorageEvent('storage',{key:'rzc_bus_v4',newValue:JSON.stringify({t:'alert',d:dd,i:id})})),
  ws:(dd,id)=>{const m=JSON.stringify({t:'alert',d:dd,i:id});socks.forEach(s=>{try{s.onmessage&&s.onmessage({data:m})}catch(e){}})}};
}
const PV={name:'PREVIEW',amount:1234,message:'ทดสอบ'};
(async()=>{
 // 1) admin PREVIEW arrives via storage (same browser, no relay needed): card AND voice
 let t=boot('#overlay?k=k123',{offline:true});await sleep(1100);
 t.storage(PV,'pv1');await sleep(5000);
 ok(t.shown.some(x=>/PREVIEW/.test(x)),'relay OFFLINE: card shows PREVIEW');
 ok(t.urls.length===1&&/บริจาค/.test(t.urls[0]),'relay OFFLINE: PREVIEW is spoken ('+t.urls.length+')');
 ok(t.audible()===1,'relay OFFLINE: speech audio actually plays ('+t.audible()+')');
 // 2) BroadcastChannel path (another tab, same browser)
 t=boot('#overlay?k=k123',{offline:true});await sleep(1100);
 const bc=new t.w.BroadcastChannel('rzc_k123');bc.postMessage({t:'alert',d:PV,i:'bc1'});await sleep(5000);
 ok(t.urls.length===1,'BroadcastChannel alert is spoken ('+t.urls.length+')');
 // 3) the SAME alert arrives on every path (relay + storage + BroadcastChannel) => card once, voice once
 t=boot('#overlay?k=k123');await sleep(1100);
 const bc2=new t.w.BroadcastChannel('rzc_k123');
 t.storage(PV,'all1');t.ws(PV,'all1');bc2.postMessage({t:'alert',d:PV,i:'all1'});await sleep(6500);
 ok(t.urls.length===1,'same id over relay+storage+BroadcastChannel => spoken once ('+t.urls.length+')');
 ok(t.shown.filter(x=>/PREVIEW/.test(x)).length===1,'same id over all paths => card once');
 // 4) profanity / bad amount still blocked on the local path
 t=boot('#overlay?k=k123',{offline:true});await sleep(1100);
 t.storage({name:'fuck bot',amount:100,message:'shit'},'x1');t.storage({name:'Neg',amount:-5,message:''},'x2');await sleep(3500);
 ok(t.urls.length===1&&!/fuck|shit/i.test(t.urls[0]),'local path: profanity masked, bad amount dropped ['+t.urls.join('|')+']');
 // 5) ?mute=1 silences the voice too
 t=boot('#overlay?k=k123&mute=1',{offline:true});await sleep(1100);
 t.storage(PV,'m1');await sleep(4500);
 ok(t.shown.some(x=>/PREVIEW/.test(x)),'mute=1: card still shows');
 ok(t.urls.length===0&&t.audible()===0,'mute=1: no speech ('+t.urls.length+' fetched, '+t.audible()+' played)');
 // 6) donate / admin pages never speak
 for(const h of ['#','#admin']){t=boot(h);await sleep(1100);t.storage(PV,'n'+h);await sleep(2500);ok(t.urls.length===0,'page "'+h+'" does not speak local alerts')}
 ok(t.errors.length===0,'0 script errors '+(t.errors[0]||''));
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e);process.exit(2)});
