// Runs every *.test.js in parallel and fails if any exits non-zero or prints a FAIL line.
const {spawn}=require('child_process'),fs=require('fs'),path=require('path');
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort();
let bad=0,done=0;
files.forEach(f=>{
  let out='';const p=spawn(process.execPath,[path.join(__dirname,f)]);
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);
  const t=setTimeout(()=>p.kill(),120000);
  p.on('close',code=>{
    clearTimeout(t);
    const pass=(out.match(/^PASS/gm)||[]).length,fail=(out.match(/^FAIL/gm)||[]).length;
    const ok=code===0&&fail===0;if(!ok){bad++;console.log(out.split('\n').filter(l=>/^FAIL|Error/.test(l)).join('\n'))}
    console.log((ok?'ok   ':'FAIL ')+f+'  pass='+pass+' fail='+fail+' exit='+code);
    if(++done===files.length){console.log(bad?bad+' file(s) failed':'all '+files.length+' files passed');process.exit(bad?1:0)}
  });
});
