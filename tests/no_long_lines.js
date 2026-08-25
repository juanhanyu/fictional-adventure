'use strict';
// 校验：对话引擎会按实际宽度自动分页；剧情无底部 UI 时每页最多 3 排，
// 自由探索最多 2 排。窄屏也不得依赖滚动或把文字裁到框外。
const h=require('./harness.js');
const win=h.win;
let fail=0;
const ok=(label,cond)=>{
  console.log('  '+(cond?'✓':'✗')+' '+label);
  if(!cond) fail++;
};

const texts=[];
function collect(lines,scene,where){
  (Array.isArray(lines)?lines:[]).forEach((line,i)=>{
    if(typeof line==='string') texts.push({scene,where:where+i,text:line});
    if(!line || typeof line!=='object') return;
    if(typeof line.text==='string') texts.push({scene,where:where+i,text:line.text});
    if(Array.isArray(line.choices)){
      line.choices.forEach((choice,j)=>{
        if(typeof choice.text==='string') texts.push({scene,where:where+i+'.choice'+j,text:choice.text});
        if(choice.lines) collect(choice.lines,scene,where+i+'.choice'+j+'.');
      });
    }
  });
}
Object.entries(win.SCENES).forEach(([id,scene])=>collect(scene.lines,id,'L'));

const layouts=[
  {name:'桌面',cols:45,rows:3},
  {name:'窄屏',cols:20,rows:3},
  {name:'最窄屏',cols:11,rows:3},
];
for(const layout of layouts){
  const bad=[];
  for(const item of texts){
    const pages=win.__paginateDialogText(item.text,layout.rows,layout.cols);
    pages.forEach((page,p)=>{
      const rows=win.__measureDialogRows(page,layout.cols);
      if(rows>layout.rows) bad.push(item.scene+'.'+item.where+'.p'+p+'='+rows);
    });
  }
  ok(layout.name+'剧情分页全部 ≤'+layout.rows+' 排',bad.length===0);
  if(bad.length) console.log('    '+bad.slice(0,8).join(', '));
}

// 自由探索的框更矮：任意剧情文本交给 2 排分页器也必须能安全拆分。
const roamBad=[];
for(const item of texts){
  const pages=win.__paginateDialogText(item.text,2,20);
  pages.forEach((page,p)=>{
    const rows=win.__measureDialogRows(page,20);
    if(rows>2) roamBad.push(item.scene+'.'+item.where+'.p'+p+'='+rows);
  });
}
ok('自由探索分页全部 ≤2 排',roamBad.length===0);

// 确认测试确实覆盖了需要分页的长文本，而不是所有文本本来就很短。
const longest=texts.reduce((a,b)=>Array.from(a.text).length>=Array.from(b.text).length?a:b,{text:''});
const longPages=win.__paginateDialogText(longest.text,3,20);
ok('长文本会自动拆成多个对话页',longPages.length>1);
ok('每个桌面对话页不超过 105 字',texts.every(item=>
  win.__paginateDialogText(item.text,3,45).every(page=>Array.from(page).length<=105)
));

// 真实打字机流程：每页需要一次“显示全文”与一次“下一页”，最后一页后才触发剧情回调。
let completed=0;
win.__origTypeText('分页测试。'.repeat(60),()=>completed++);
const paging=win.__dialogPaging();
for(let i=0;i<paging.pages.length;i++){
  win.__skipType();
  win.__advanceDialog();
}
ok('自动分页逐页推进后只回调一次',paging.pages.length>1 && completed===1);

console.log(fail===0?'\n  ✓ 对话分页与字数上限全部通过':'\n  ✗ '+fail+' 处失败');
process.exit(fail?1:0);
