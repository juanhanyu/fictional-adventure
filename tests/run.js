'use strict';
// 统一测试入口：npm test
const { spawnSync } = require('child_process');
const path = require('path');
const cases = ['validate.js','smoke.js','gate_flow.js','full_playthrough.js','panel_consistency.js','npc_presence.js','bgm_mapping.js','bgm_flow.js','bgm_roam_trace.js','bgm_child.js','bgm_action.js','bgm_sametype.js','bgm_comedy.js','bgm_micro_gate.js','continue_scene_bgm.js','ui_changes.js','story_polish.js','cg_test.js','cg_turnpoint.js','cg_cooloff.js','portrait_age.js','gate_seven.js','no_long_lines.js'];
let fail = 0;
for (const f of cases){
  const r = spawnSync('node', [path.join(__dirname, f)], { encoding:'utf8', cwd: __dirname });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  const ok = r.status === 0;
  console.log(`[${ok?'PASS':'FAIL'}] ${f} (exit ${r.status})`);
  if(!ok) fail++;
}
console.log(fail===0 ? '\n✅ 全部测试通过' : `\n❌ ${fail} 个测试失败`);
process.exit(fail?1:0);
