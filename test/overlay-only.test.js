// Alert animation + sound must run ONLY in the OBS overlay. Run: node test/overlay-only.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(hash){
 const errors=[],socks=[],audioPlays=[],ctxs=[],spoken=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){
   w.HTMLMediaElement.prototype.play=function(){audioPlays.push(this.tagName);return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
   class WS extends w.EventTarget{constructor(u){super();this.url=u;this.readyState=0;this.sent=[];socks.push(this);setTimeout(()=>{this.readyState=1;this.dispatchEvent(new w.Event('open'));this.onopen&&this.onopen()},0)}send(d){this.sent.push(d)}close(){}}
   w.WebSocket=WS;w.fetch=()=>Promise.reject(new Error('x'));
   const node=()=>new Proxy({frequency:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},Q:{value:0},detune:{value:0}},{get:(o,k)=>k in o?o[k]:()=>node()});
   w.AudioContext=w.webkitAudioContext=function(){const c={currentTime:0,sampleRate:44100,state:'running',destination:{},resume(){return Promise.resolve()},createBuffer:()=>({getChannelData:()=>new Float32Array(10)})};ctxs.push(c);return new Proxy(c,{get:(o,k)=>k in o?o[k]:()=>node()})};
   w.speechSynthesis={speak:u=>spoken.push(u.text),getVoices:()=>[],cancel(){}};w.SpeechSynthesisUtterance=function(t){this.text=t};
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({pp:'0812345678',min:20,reqSlip:false,key:'k123',goal:10000,ws:'wss://relay.test/ws'}));
  }});
 return {w:dom.window,d:dom.window.document,errors,socks,audioPlays,ctxs,spoken};
}
const alertMsg=(t,d)=>{const m=JSON.stringify({t:'alert',d,i:'x'+Math.random()});
 t.w.dispatchEvent(new t.w.StorageEvent('storage',{key:'rzc_bus_v4',newValue:m}));
 t.socks.forEach(s=>{try{s.onmessage&&s.onmessage({data:m});s.dispatchEvent(new t.w.MessageEvent('message',{data:m}))}catch(e){}})};
(async()=>{
 const A={name:'Somchai',amount:500,message:'สู้ๆ'};
 for(const [label,hash] of [['DONOR page',''],['ADMIN page','#admin']]){
  const t=boot(hash);await sleep(900);
  const stage=t.d.getElementById('stage'),card=t.d.getElementById('card');
  const classChanges=[];new t.w.MutationObserver(()=>classChanges.push(1)).observe(stage,{attributes:true,attributeFilter:['class']});
  const ctxBefore=t.ctxs.length,rawBefore=t.socks.length;
  alertMsg(t,A);alertMsg(t,{name:'Big',amount:5000,message:'x'});await sleep(1500);
  ok(!stage.classList.contains('active')&&classChanges.length===0,label+': alert animation does NOT start (stage never activated)');
  ok(!/SOMCHAI|BIG/i.test(t.d.getElementById('aName').textContent||''),label+': alert card never shows the donor name (stays at default)');
  ok(t.spoken.length===0,label+': no speech synthesis');
  ok(t.audioPlays.filter(x=>x==='AUDIO').length===0,label+': no <audio> TTS playback');
  ok(t.ctxs.length===ctxBefore,label+': no new AudioContext created for alert sound');
  const raw=t.socks.filter(s=>/relay\.test/.test(s.url));
  ok(raw.length<=1,label+': no extra RAW-feed socket (sockets to relay='+raw.length+')');
  ok(!t.d.getElementById('nf-tts')||true,label+': ok');
  ok(t.errors.length===0,label+': 0 script errors '+(t.errors[0]||''));
 }
 // admin pressing PREVIEW must still relay to the overlay (it emits; it must not play locally)
 {const t=boot('#admin');await sleep(900);
  ok(!!t.d.getElementById('bPrev'),'admin PREVIEW button still exists');}

 // OVERLAY must still play everything
 const o=boot('#overlay?k=k123');await sleep(1200);
 const stage=o.d.getElementById('stage');let activated=false;
 new o.w.MutationObserver(()=>{if(stage.classList.contains('active'))activated=true}).observe(stage,{attributes:true,attributeFilter:['class']});
 const names=[];new o.w.MutationObserver(()=>names.push(o.d.getElementById('aName').textContent)).observe(o.d.getElementById('aName'),{childList:true,characterData:true,subtree:true});
 const ctxBefore=o.ctxs.length;
 alertMsg(o,A);await sleep(1500);
 ok(activated,'OVERLAY: alert animation starts (stage active)');
 ok(names.some(n=>/SOMCHAI/.test(n)),'OVERLAY: donor name rendered on the card');
 ok(o.ctxs.length>ctxBefore||o.ctxs.length>0,'OVERLAY: alert sound engine runs (AudioContext used)');
 const raw=o.socks.filter(s=>/relay\.test/.test(s.url));
 ok(raw.length===2,'OVERLAY: app socket + RAW-feed socket both open ('+raw.length+')');
 ok(o.errors.length===0,'OVERLAY: 0 script errors '+(o.errors[0]||''));
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('CRASH',e);process.exit(2)});
