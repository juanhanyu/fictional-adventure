'use strict';
/**
 * 代理健壮性与全量文风审校防火墙 (proxy_and_personas_v2.js)
 * 覆盖：gemini-proxy.mjs /healthz、Range 音频流切片、extractJsonObject 边界、
 *       /api/gemini/chat 504 超时、以及 tools/novel_linter.py --strict 对第四卷与模块化叙事 JS 全扫描。
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

(async () => {
  console.log('\n===== 代理健壮性 (Range / /healthz / 504) & 模块化文风严审防火墙 =====');
  const proxyMod = await import('../server/gemini-proxy.mjs');

  // 1) extractJsonObject 多种异常包装鲁棒性
  const directObj = proxyMod.extractJsonObject({ action: '颔首', reply: '嗯。', emotion: 'normal' });
  const multiBlocks = proxyMod.extractJsonObject('先说明{"meta":1}再给正文：\n```\n{"action":"收剑","reply":"准备出发。","emotion":"serious"}\n```');
  const escapedStr = proxyMod.extractJsonObject('说明：{"action":"她说\\"别怕\\"","reply":"放心，有我在。","emotion":"smile"}');
  ok('extractJsonObject 正确处理对象直传、多 JSON 块与转义引号字符串',
    JSON.parse(directObj).reply === '嗯。'
    && JSON.parse(multiBlocks).reply === '准备出发。'
    && JSON.parse(escapedStr).reply === '放心，有我在。');

  // 2) /healthz 元信息 + Music Range 206 切片 + /api/gemini/chat 504 超时
  const srv = proxyMod.createGeminiProxyServer({
    apiKey: 'gemini-timeout-test',
    timeoutMs: 60,
    codexTimeoutMs: 80,
    fetchImpl: (_url, init) => new Promise((_resolve) => {
      const tm = setTimeout(() => _resolve({ ok: true, status: 200, json: async () => ({}) }), 500);
      if (init && init.signal) {
        init.signal.addEventListener('abort', () => { clearTimeout(tm); });
      }
    }),
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;
    const origin = `http://127.0.0.1:${port}`;

    const healthRes = await fetch(`${base}/healthz`, { headers: { Origin: origin } });
    const healthJson = await healthRes.json();
    ok('/healthz 返回 200 并汇报超时配置与服务标识',
      healthRes.status === 200 && healthJson.ok === true
      && healthJson.timeoutMs === 60 && healthJson.codexTimeoutMs === 80);

    // 验证音频 Range 分片返回 206 Partial Content
    const musicFiles = fs.readdirSync(path.join(ROOT, 'Music')).filter((f) => f.endsWith('.mp3'));
    const sampleMp3 = musicFiles[0];
    const rangeRes = await fetch(`${base}/Music/${encodeURIComponent(sampleMp3)}`, {
      headers: { Range: 'bytes=0-127' },
    });
    const rangeBuf = await rangeRes.arrayBuffer();
    ok('静态代理对 Music/*.mp3 支持 HTTP 206 Range 音频分片',
      rangeRes.status === 206 && rangeBuf.byteLength === 128
      && /^bytes 0-127\//.test(rangeRes.headers.get('content-range') || ''),
      `status=${rangeRes.status}, len=${rangeBuf.byteLength}`);

    // 验证 /api/gemini/chat 上游超时精准返回 HTTP 504
    const gemTimeoutRes = await fetch(`${base}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        characterId: 'noelle',
        text: '测试 Gemini 超时',
        snapshot: {
          playing: true,
          phase: 'academy',
          location: '图书馆',
          player: { name: '希尔维亚', age: 13 },
          people: [{ id: 'noelle', name: '诺艾儿', role: '同学' }],
        },
      }),
    });
    const gemTimeoutJson = await gemTimeoutRes.json();
    ok('/api/gemini/chat 上游超时返回 HTTP 504 并给出中文超时提示',
      gemTimeoutRes.status === 504 && /超时/.test(gemTimeoutJson.error || ''),
      `status=${gemTimeoutRes.status}, err=${gemTimeoutJson.error}`);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }

  // 3) tools/novel_linter.py --strict 全量审校第四卷与 3 份模块化叙事 JS (0 error, 0 warning)
  const lintTargets = [
    'js/story-vol4.js',
    'js/relics-and-events.js',
    'js/vn-ux.js',
    'js/ai-personas.js',
  ].map((rel) => path.join(ROOT, rel));
  const lr = spawnSync('python', [path.join(ROOT, 'tools', 'novel_linter.py'), '--strict', ...lintTargets], { encoding: 'utf8' });
  let report = {};
  try { report = JSON.parse(lr.stdout || '{}'); } catch (e) {}
  ok('tools/novel_linter.py --strict 扫描 story-vol4 / relics-and-events / vn-ux / ai-personas 全部 0 违规',
    lr.status === 0 && report.ok === true && report.summary && report.summary.total_issues === 0,
    lr.status === 0 ? '' : `exit=${lr.status}, issues=${JSON.stringify((report.issues || []).slice(0, 3))}`);

  console.log(`\n通过: ${pass} | 失败: ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
