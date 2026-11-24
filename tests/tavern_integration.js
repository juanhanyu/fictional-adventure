'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

(async () => {
  const promptModule = await import('../tavern-prompt.mjs');
  const snapshot = { playing: true, scene: 'test', location: '花园', player: { age: 5, year: 5, month: 3, day: 1, name: '希尔维亚' },
    people: [{ id: 'beatrice', name: '贝阿特丽丝', role: '姐姐' }], text: '当前台词' };
  assert.throws(() => promptModule.buildPrompt({ playing: false }, 'beatrice', [], '你好'), /开始游戏/);
  assert.throws(() => promptModule.buildPrompt(snapshot, 'alice', [], '你好'), /离开/);
  const prompt = promptModule.buildPrompt(snapshot, 'beatrice', Array.from({ length: 20 }, () => ({ role: 'user', content: '旧对话' })), '你好');
  assert.equal(prompt.length, 14);
  assert.match(prompt[0].content, /当前台词/);
  assert.doesNotMatch(prompt[0].content, /SCENES|storyPending/);

  const dom = new JSDOM('<!DOCTYPE html><body><button id="mes_stop" hidden></button></body>', {
    url: 'http://localhost:8000/', runScripts: 'dangerously', pretendToBeVisual: true,
  });
  const win = dom.window;
  win.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  win.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => {};
  win.__prompt = promptModule;
  let requests = [];
  let fail = false;
  let hold = false;
  let release;
  let stopCalls = 0;
  let locked = 0;
  win.SillyTavern = { getContext: () => ({ onlineStatus: 'connected', deactivateSendButtons: () => locked++, activateSendButtons: () => locked--,
    stopGeneration: () => { stopCalls++; release?.('cancelled reply'); },
    generateRaw: async args => { requests.push(args); if (fail) throw new Error('provider failure');
      if (hold) return new Promise(resolve => { release = resolve; });
      return '<script>unsafe</script>姐姐在这里。'; } }) };
  win.eval(read('tavern-extension.js').replace(/^import .*;\r?\n/, 'const { SYSTEM_PROMPT, sceneKey, buildPrompt } = window.__prompt;\n')
    .replace('import.meta.url', JSON.stringify('http://localhost:8000/scripts/extensions/third-party/fictional-adventure/tavern-extension.js')));
  win.document.getElementById('fa-launch').click();
  const frame = win.document.getElementById('fa-game');
  const child = frame.contentWindow;
  const emit = (type, payload, source = child, origin = win.location.origin) => win.dispatchEvent(new win.MessageEvent('message', {
    source, origin, data: { channel: 'fictional-adventure-v1', type, payload },
  }));
  emit('context', snapshot, win, 'http://evil.example');
  assert.equal(win.document.getElementById('fa-send').disabled, true);
  emit('context', snapshot);
  assert.equal(win.document.getElementById('fa-send').disabled, false);
  child.postMessage = data => { if (data.type === 'context-request') emit('context', snapshot); };
  const input = win.document.getElementById('fa-input');
  const send = win.document.getElementById('fa-send');
  const tick = () => new Promise(resolve => setTimeout(resolve, 15));
  win.localStorage.setItem('ojousama_save_v1', 'original-save');
  input.value = '姐姐，陪我走走吧。'; send.click(); send.click(); await tick();
  assert.equal(requests.length, 1, 'duplicate requests are blocked');
  assert.match(requests[0].systemPrompt, /额外 AI/);
  assert.match(win.document.getElementById('fa-transcript').textContent, /姐姐在这里/);
  assert.equal(win.document.querySelector('#fa-transcript script'), null, 'model output is plain text');
  assert.equal(locked, 0);
  assert.equal(win.localStorage.getItem('ojousama_save_v1'), 'original-save');
  fail = true; input.value = '重试时保留'; send.click(); await tick();
  assert.equal(input.value, '重试时保留');
  assert.match(win.document.getElementById('fa-status').textContent, /回复失败/);
  assert.equal(locked, 0);
  fail = false; hold = true;
  const savedConversation = win.localStorage.getItem('fictional_adventure_ai_v1');
  input.value = '取消后保留'; send.click(); await tick();
  win.document.getElementById('fa-stop').click(); await tick();
  assert.equal(stopCalls, 1);
  assert.equal(input.value, '取消后保留');
  assert.equal(win.localStorage.getItem('fictional_adventure_ai_v1'), savedConversation);
  assert.match(win.document.getElementById('fa-status').textContent, /已取消/);
  assert.equal(locked, 0);
  const elsewhere = { ...snapshot, scene: 'another-scene', people: [] };
  emit('context', elsewhere);
  assert.equal(send.disabled, true);
  assert.equal(win.document.getElementById('fa-transcript').textContent, '');
  emit('context', snapshot);
  assert.match(win.document.getElementById('fa-transcript').textContent, /姐姐在这里/);
  win.document.getElementById('fa-return').click();
  win.document.getElementById('fa-launch').click();
  assert.equal(frame.contentWindow, child, 'return preserves game frame');

  // Load the real engine as classic scripts, exactly as the browser does.
  child.document.open();
  child.document.write(read('index.html').replace(/<script[\s\S]*?<\/script>/g, ''));
  child.document.close();
  child.HTMLMediaElement.prototype.play = () => Promise.resolve();
  child.HTMLMediaElement.prototype.pause = () => {};
  child.AudioContext = class {
    constructor() { this.currentTime = 0; }
    createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
  };
  for (const file of ['js/story.js', 'js/story-vol3.js', 'js/ai-personas.js', 'game.js', 'js/branching-director.js', 'js/combat-engine.js', 'js/ai-chat-panel.js', 'js/tavern-bridge.js']) {
    const script = child.document.createElement('script'); script.textContent = read(file); child.document.body.append(script);
  }
  child.postMessage = data => child.dispatchEvent(new child.MessageEvent('message', {
    source: win, origin: win.location.origin, data,
  }));
  let observed;
  win.addEventListener('message', event => { if (event.data?.type === 'context') observed = event.data.payload; });
  // A test-only classic script starts a real scene with both sisters.
  const setup = child.document.createElement('script');
  setup.textContent = `S.ageY=5; S.year=5; S.loc='garden'; show('game-screen',1); stage=[{id:'sylvia'},{id:'beatrice'}]; fullText='当前画面';`;
  child.document.body.append(setup);
  child.postMessage({ channel: 'fictional-adventure-v1', type: 'context-request' });
  await tick();
  assert.equal(observed.location, '花园');
  assert.equal(observed.people[0].name, '贝阿特丽丝·维斯特利亚');
  assert.equal(observed.people[0].age, 7);
  assert.equal(observed.text, '当前画面');
  assert.equal(observed.player.age, 5);
  win.document.getElementById('fa-clear').click();
  assert.equal(win.localStorage.getItem('ojousama_save_v1'), 'original-save');
  dom.window.close();
  console.log('✅ 酒馆桥接、上下文、模型调用、重复发送、失败恢复、输出安全及存档隔离通过');
})().catch(error => { console.error(error); process.exit(1); });
