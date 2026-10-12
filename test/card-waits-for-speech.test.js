// The alert card must stay on screen until the spoken announcement finishes (bounded). Run: node test/card-waits-for-speech.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(speechMs,opts){
 opts=opts||{};const errors=[],socks=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/#overlay?k=k123',virtualConsole:vc,
  beforeParse(w){
   w.HTMLMediaElement.prototype.play=function(){const el=this;if(el.muted)return Promise.resolve();
     if(opts.blocked)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));
     setTimeout(()=>el.dispatchEvent(new w.Event('playing')),5);setTimeout(()=>el.dispatchEvent(new w.Event('ended')),speechMs);return Promise.resolve()};
   w.HTMLMediaElement.prototype.pause=()=>{};
   class WS extends w.EventTarget{constructor(u){super();this.url=u;this.readyState=0;socks.push(this);setTimeout(()=>{this.readyState=1;this.dispatchEvent(new w.Event('open'));this.onopen&&this.onopen()},0)}send(){}close(){this.readyState=3}}
   w.WebSocket=WS;
   w.fetch=u=>/\/tts/.test(String(u))?Promise.resolve({ok:true,headers:{get:k=>/content-type/i.test(k)?'audio/mpeg':''},blob:()=>Promise.resolve({size:5000})}):Promise.reject(new Error('x'));
   w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
   const node=()=>new Proxy({frequency:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},Q:{value:0},detune:{value:0}},{get:(o,k)=>k in o?o[k]:()=>node()});
   w.AudioContext=w.webkitAudioContext=function(){return new Proxy({currentTime:0,sampleRate:44100,state:'running',destination:{},resume(){return Promise.resolve()},createBuffer:()=>({getChannelData:()=>new Float32Array(10)})},{get:(o,k)=>k in o?o[k]:()=>node()})};
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({min:20,key:'k123',goal:10000,ws:'wss://relay.test/ws'}));
   if(opts.ttsOff)w.localStorage.setItem('nfx.cfg.v1',JSON.stringify({tts:0}));}});
 return {w:dom.window,d:dom.window.document,errors,socks};
}
async function measure(speechMs,opts,amount){
 const t=boot(speechMs,opts);await sleep(1200);const stage=t.d.getElementById('stage');let on=null,off=null;const T0=Date.now();
 new t.w.MutationObserver(()=>{const a=stage.classList.contains('active');if(a&&on==null)on=Date.now()-T0;if(!a&&on!=null&&off==null)off=Date.now()-T0}).observe(stage,{attributes:true,attributeFilter:['class']});
 const m=JSON.stringify({t:'alert',d:{name:'Tester',amount:amount||100,message:'hello'},i:'q'+Math.random()});
 t.socks.forEach(s=>{try{s.onmessage&&s.onmessage({data:m})}catch(e){}});
 for(let i=0;i<160&&off==null;i++)await sleep(250);
 return {ms:off==null?null:off-on,errors:t.errors};
}
(async()=>{
 let r=await measure(3000);
 ok(r.ms!=null&&r.ms>=6000&&r.ms<=8200,'short speech: card keeps its normal duration, not stretched ('+r.ms+'ms)');
 r=await measure(14000);
 ok(r.ms!=null&&r.ms>=14000,'long speech (14s): card stays until the reading finishes ('+r.ms+'ms)');
 ok(r.ms!=null&&r.ms<=17500,'long speech: card closes shortly after the reading ends, not later ('+r.ms+'ms)');
 r=await measure(1e9);
 ok(r.ms!=null&&r.ms<=31000,'speech that never ends (stuck TTS): card still closes, bounded ('+r.ms+'ms)');
 r=await measure(14000,{blocked:true});
 ok(r.ms!=null&&r.ms<=9000,'autoplay blocked (no sound possible): card does not wait for speech ('+r.ms+'ms)');
 r=await measure(14000,{ttsOff:true});
 ok(r.ms!=null&&r.ms<=8200,'TTS switched off: card keeps normal duration ('+r.ms+'ms)');
 ok(r.errors.length===0,'0 script errors');
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e);process.exit(2)});
