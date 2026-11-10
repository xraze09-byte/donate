// index.html must be a complete document and every inline script must parse.
const fs=require('fs'),path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let pass=0,fail=0;const ok=(c,l)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+l)};
ok(/<\/html>\s*$/.test(H),'document ends with a complete </html>');
ok(/<\/body>\s*<\/html>\s*$/.test(H),'</body> precedes </html>');
const re=/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;let m,n=0,bad=0;
while((m=re.exec(H))){n++;try{new Function(m[1])}catch(e){bad++;console.log('  script #'+n+': '+e.message)}}
ok(n>0&&bad===0,'all '+n+' inline scripts parse');
const ids={};for(const x of H.matchAll(/\sid="([^"]+)"/g))ids[x[1]]=(ids[x[1]]||0)+1;
ok(Object.keys(ids).every(k=>ids[k]===1),'no duplicate element ids');
console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0);
