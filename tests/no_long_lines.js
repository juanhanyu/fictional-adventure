'use strict';
// 校验：所有对话框文本不应超过 3 行（无UI剧情栏上限；以 45 字/行为准，兼顾中小窗口）
const fs=require('fs'); const path=require('path');
const CHARS=45, MAX=3;
let fail=0;
function est(t){let n=0;for(const x of String(t).split('\\n')){n+=Math.max(1,Math.ceil(x.length/CHARS));}return n;}
const ROOT=path.join(__dirname,'..'); const files=[path.join(ROOT,'js/story.js'),path.join(ROOT,'js/story-vol3.js'),path.join(ROOT,'game.js'),path.join(ROOT,'js/branching-director.js')];
for(const file of files){
  const src=fs.readFileSync(file,'utf8');
  const re=/'((?:[^'\\]|\\.)*)'/g;
  let m, count=0;
  while((m=re.exec(src))){
    const s=m[1];
    if(s.includes('\\n') && !s.includes('${')){
      const n=est(s);
      if(n>MAX){
        const before=src.slice(0,m.index);
        const line=before.split('\n').length;
        console.log(`  超长: ${file}:${line} (~${n}行) ${s.slice(0,25)}...`);
        fail++; count++;
      }
    }
  }
  if(count) console.log(`  ${file}: ${count} 处`);
}
console.log(fail===0?'\n  ✓ 所有对话框 ≤3 行':`\n  ✗ ${fail} 处超长`);
process.exit(fail?1:0);
