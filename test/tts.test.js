// TTS path in the REAL index.html (jsdom). Simulates browsers that BLOCK autoplay until a user gesture.
// Run: node test/tts.test.js
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),path=require('path');
const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(hash,{blockAutoplay=false}={}){
 const fetched=[],played=[],errors=[],socks=[];let w0,unlocked=!blockAutoplay;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e.message||e)));
 const mk=ET=>{class WS extends ET{constructor(u){super();this.url=u;this.readyState=0;this._h={};socks.push(this);setTimeout(()=>{this.readyState=1;this.dispatchEvent(new w0.Event('open'))},0)}send(){}close(){}}
  for(const n of['onopen','onclose','onerror','onmessage'])Object.defineProperty(WS.prototype,n,{configurable:true,get(){return this._h[n]||null},set(fn){if(this._h[n])this.removeEventListener(n.slice(2),this._h[n]);this._h[n]=typeof fn==='function'?fn:null;if(this._h[n])this.addEventListener(n.slice(2),this._h[n])}});return WS};
 const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://donate.test/'+hash,virtualConsole:vc,
  beforeParse(w){w0=w;w.WebSocket=mk(w.EventTarget);
   w.fetch=u=>{fetched.push(decodeURIComponent(String(u)));return Promise.resolve({ok:true,headers:{get:k=>/content-type/i.test(k)?'audio/mpeg':null},blob:()=>Promise.resolve({size:20000})})};
   w.URL.createObjectURL=()=>'blob:x'+fetched.length;
   // real-browser autoplay policy: unmuted play() rejects (NotAllowedError) until a user gesture; muted play always allowed
   w.HTMLMediaElement.prototype.play=function(){
     if(!unlocked&&!this.muted){const e=new Error('blocked');e.name='NotAllowedError';return Promise.reject(e)}
     if(!this.muted)played.push(this.src);
     const el=this;setTimeout(()=>el.dispatchEvent(new w.Event('playing')),0);return Promise.resolve()};
   w.HTMLMediaElement.prototype.pause=function(){};
   w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k in o?o[k]:(k==='canvas'?{width:1,height:1}:()=>{}),set:(o,k,v)=>{o[k]=v;return true}});
   w.scrollTo=()=>{};w.tailwind={};
   w.localStorage.setItem('rzc_cfg_v4',JSON.stringify({pp:'0812345678',payee:'RZ',min:20,key:'k123',ws:'wss://relay.test/ws'}));
  }});
 const w=dom.window;
 return {w,fetched,played,errors,unlock:()=>{unlocked=true},
  alert:d=>socks.forEach(s=>s.dispatchEvent(new w.MessageEvent('message',{data:JSON.stringify({t:'alert',d})})))};
}
(async()=>{
 // 1) normal browser: alert => /tts fetched with Thai amount text => audio played exactly once
 let t=boot('#overlay?k=k123');await sleep(700);
 t.alert({name:'Aom',amount:100,message:'ขอบคุณครับ'});await sleep(3200);
 ok(t.fetched.length===1&&/\/tts\?q=Aom, บริจาค หนึ่งร้อยบาท/.test(t.fetched[0]),'alert => one /tts request with spoken amount ('+t.fetched.length+')');
 ok(t.played.length===1,'audio played once ('+t.played.length+')');
 ok(t.errors.length===0,'0 script errors '+(t.errors[0]||''));
 // 2) autoplay BLOCKED (OBS / fresh browser): sound must not be lost; plays after a gesture
 t=boot('#overlay?k=k123',{blockAutoplay:true});await sleep(700);
 t.alert({name:'Bee',amount:50,message:''});await sleep(3000);
 ok(t.fetched.length===1,'blocked: /tts still fetched');
 ok(t.played.length===0,'blocked: nothing audible yet (as the browser forbids)');
 t.unlock();t.w.dispatchEvent(new t.w.Event('pointerdown'));await sleep(300);
 ok(t.played.length===1,'blocked: audio plays after the first user gesture instead of being dropped ('+t.played.length+')');
 // 3) blocked, gesture arrives too late (queue item expired) => stale speech is NOT replayed
 t=boot('#overlay?k=k123',{blockAutoplay:true});await sleep(700);
 t.alert({name:'Cee',amount:50,message:''});await sleep(3000+4000+40*140);
 t.unlock();t.w.dispatchEvent(new t.w.Event('pointerdown'));await sleep(300);
 ok(t.played.length===0,'expired blocked item is not replayed late ('+t.played.length+')');
 // 4) after unlock, later alerts play normally
 t.alert({name:'Dee',amount:60,message:''});await sleep(3300);
 ok(t.played.length===1,'after unlock a new alert plays ('+t.played.length+')');
 console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.log('TEST CRASH',e);process.exit(2)});
