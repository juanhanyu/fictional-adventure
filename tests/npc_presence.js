'use strict';
// 学院角色出现规则测试：海伦娜不随机出现；艾诺在离开(冰融之际)后不随机出现
const h = require('./harness.js');
const win = h.win;
const $ = (id)=>win.document.getElementById(id);
let sd=0;
win.setTimeout=(fn)=>{ if(++sd>80000){sd--;return 0;} try{fn();}finally{sd--;} return 0; };
win.setInterval=()=>0;win.clearInterval=()=>0;win.clearTimeout=()=>0;
win.__setTypingDrain();

function setState(over){
  win.__resetS();
  const s = win.__getS();
  Object.assign(s, {ageY:12, year:12, month:9, day:1, phase:'academy', tod:1}, over||{});
  // 固定 seasonChars 归属，避免随机扰动：直接在各 loc 重新计算
  s.seasonChars = {};
  win.__setS(s);
}
// whoIsHere 是函数声明，可直接调用；随机归属通过 S.seasonChars 缓存。
// 为稳定测试，将 seasonChars 预填为所有目标 loc，直接断言「某角色是否可能出现在某 loc」。

let fail=0;
function ok(label, cond){ console.log(`  ${cond?'✓':'✗'} ${label}`); if(!cond) fail++; }

// 海伦娜：ch_helena 置位后，也不应出现在食堂（不随机出现）
setState({ flags:{met_noelle:1, met_ajun:1, ch_helena:1}, loc:'cafeteria' });
let who = win.whoIsHere();
ok('海伦娜在 ch_helena 置位后不随机出现在食堂', !who.includes('helena'));

// 艾诺：met_aino 置位、未离开，应出现在冰系教室
setState({ flags:{met_aino:1}, loc:'ice_class' });
win.__getS().seasonChars = {};
who = win.whoIsHere();
// 艾诺可能被分配到 ice_class/training_field，重跑几次看能否覆盖 ice_class
const ainoAppearsBefore = (()=>{ for(let i=0;i<30;i++){ win.__getS().seasonChars={}; if(win.whoIsHere().includes('aino')) return true; } return false; })();
ok('艾诺在离开前可能随机出现在冰系教室', ainoAppearsBefore);

// 艾诺：met_aino 置位、ch_ice_melt_1（已回赫兰）置位，不应出现
setState({ flags:{met_aino:1, ch_ice_melt_1:1}, loc:'ice_class' });
win.__getS().seasonChars = {};
const ainoAfter = (()=>{ for(let i=0;i<30;i++){ win.__getS().seasonChars={}; if(win.whoIsHere().includes('aino')) return true; } return false; })();
ok('艾诺在 ch_ice_melt_1(回赫兰)后不再随机出现', !ainoAfter);

console.log('\n失败:', fail);
process.exit(fail?1:0);
