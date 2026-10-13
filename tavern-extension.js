import { SYSTEM_PROMPT, sceneKey, buildPrompt } from './tavern-prompt.mjs';

const CHANNEL = 'fictional-adventure-v1';
const STORAGE_KEY = 'fictional_adventure_ai_v1';
const GAME_URL = new URL('./index.html?tavern=1', import.meta.url).href;
let snapshot = null;
let busy = false;
let cancelled = false;
let session = 0;
let requestedContext = null;
let conversations;
try { conversations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
catch { conversations = {}; }
if (!conversations || typeof conversations !== 'object' || Array.isArray(conversations)) conversations = {};

const dialog = document.createElement('dialog');
dialog.id = 'fa-dialog';
dialog.setAttribute('aria-label', '转生千金游戏与 AI 对话');
dialog.innerHTML = `
  <header class="fa-toolbar"><strong>✧ 转生千金</strong><button id="fa-toggle" aria-expanded="true">收起 AI 对话</button><button id="fa-return">返回酒馆</button></header>
  <div class="fa-layout"><iframe id="fa-game" title="转生千金游戏" allow="autoplay"></iframe>
  <aside class="fa-chat" aria-label="AI 对话面板">
    <h2>场景里的交谈</h2><p class="fa-note">使用酒馆当前连接的模型。AI 交谈独立保存，原作剧情与游戏数值按原玩法推进。</p>
    <label for="fa-target">对话对象 · 当前在场</label><select id="fa-target"></select>
    <div id="fa-transcript" role="log" aria-live="polite"></div>
    <p id="fa-status" role="status">正在加载游戏……</p>
    <label for="fa-input">你想说的话</label><textarea id="fa-input" maxlength="2000" placeholder="和眼前的人聊一聊……（Ctrl + Enter 发送）"></textarea>
    <div class="fa-actions"><button id="fa-send">发送</button><button id="fa-stop" hidden>取消</button><button id="fa-clear">清空对话</button></div>
  </aside></div>`;
document.body.append(dialog);
const find = id => dialog.querySelector(`#${id}`);
const frame = find('fa-game');
const target = find('fa-target');
const input = find('fa-input');
const status = find('fa-status');
const send = find('fa-send');
const transcript = find('fa-transcript');
const launch = document.createElement('button');
launch.id = 'fa-launch';
launch.textContent = '✧ 转生千金';
launch.title = '打开游戏与 AI 对话';
document.body.append(launch);

function key() { return snapshot ? `${sceneKey(snapshot)}:${target.value}` : ''; }
function history() { const data = conversations[key()]; return Array.isArray(data) ? data : []; }
function persist() {
  // Bound both disk storage and prompt history; retain the most recent scenes.
  conversations = Object.fromEntries(Object.entries(conversations).slice(-40));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); } catch { /* Game saves remain independent. */ }
}
function render() {
  transcript.replaceChildren();
  for (const turn of history()) {
    const bubble = document.createElement('div');
    bubble.className = `fa-turn ${turn.role === 'user' ? 'fa-user' : ''}`;
    const name = document.createElement('strong');
    name.textContent = turn.role === 'user' ? (snapshot?.player?.name || '你') : (turn.name || 'AI');
    const body = document.createElement('span');
    body.textContent = turn.content;
    bubble.append(name, body);
    transcript.append(bubble);
  }
  transcript.scrollTop = transcript.scrollHeight;
}
function updateControls() {
  send.disabled = busy || !snapshot?.playing || !target.value;
  target.disabled = busy || !snapshot?.people?.length;
  find('fa-clear').disabled = busy;
  input.disabled = busy;
  find('fa-return').disabled = busy;
  find('fa-stop').hidden = !busy;
}
function receiveContext(data) {
  const oldKey = key();
  snapshot = data;
  const selected = target.value;
  target.replaceChildren();
  for (const person of snapshot.people || []) target.add(new Option(person.name, person.id));
  if ([...target.options].some(option => option.value === selected)) target.value = selected;
  if (!target.options.length) target.add(new Option('等待角色登场', ''));
  if (key() !== oldKey) render();
  if (!busy) status.textContent = !snapshot.playing ? '开始新生活或继续存档后，就能与在场人物交谈。'
    : !snapshot.people.length ? `${snapshot.location} · 等待角色登场` : `${snapshot.location} · ${snapshot.player.age}岁 · 已同步场景`;
  updateControls();
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.channel !== CHANNEL) return;
  if (event.data.type === 'context') {
    receiveContext(event.data.payload);
    if (requestedContext) { requestedContext.resolve(snapshot); requestedContext = null; }
  }
  if (event.data.type === 'new-game') { session++; conversations = {}; persist(); render(); }
});
function freshContext() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { requestedContext = null; reject(new Error('游戏场景尚未准备好，请稍后再试。')); }, 3000);
    requestedContext = { resolve: data => { clearTimeout(timer); resolve(data); } };
    frame.contentWindow.postMessage({ channel: CHANNEL, type: 'context-request' }, location.origin);
  });
}
async function generate() {
  if (busy || !input.value.trim()) return;
  const text = input.value.trim();
  const characterId = target.value;
  const originalSession = session;
  busy = true; cancelled = false; updateControls(); status.textContent = '正在回应……';
  let context;
  let controlsLocked = false;
  try {
    await freshContext();
    if (cancelled) { status.textContent = '已取消 · 输入已保留'; return; }
    const conversationKey = `${sceneKey(snapshot)}:${characterId}`;
    const person = snapshot.people.find(p => p.id === characterId);
    const turns = Array.isArray(conversations[conversationKey]) ? conversations[conversationKey] : [];
    const prompt = buildPrompt(snapshot, characterId, turns, text);
    context = SillyTavern.getContext();
    if (!context.onlineStatus || context.onlineStatus === 'no_connection') throw new Error('请返回酒馆，在 API 连接中连接模型后再试。');
    const stopButton = document.getElementById('mes_stop');
    if (stopButton && stopButton.getClientRects().length) throw new Error('酒馆正在生成回复，请等它完成后再试。');
    context.deactivateSendButtons(); controlsLocked = true;
    const reply = await context.generateRaw({ systemPrompt: SYSTEM_PROMPT, prompt, responseLength: 500, trimNames: false });
    if (cancelled) { status.textContent = '已取消 · 输入已保留'; return; }
    if (session !== originalSession) { status.textContent = '已开始新游戏，本次回复已丢弃。'; return; }
    conversations[conversationKey] = [...turns, { role: 'user', content: text }, { role: 'assistant', content: reply, name: person.name }].slice(-24);
    persist(); input.value = ''; render();
    status.textContent = '已回复 · AI 交谈已保存';
  } catch (error) {
    // Do not expose raw provider errors, headers, or credentials in the game UI.
    status.textContent = cancelled ? '已取消 · 输入已保留' : error instanceof Error && /^(请|这个|游戏|酒馆)/.test(error.message)
      ? error.message : '回复失败，请检查酒馆的模型连接后重试。输入已保留。';
    console.warn('[转生千金] AI 对话失败');
  } finally {
    if (controlsLocked) context.activateSendButtons();
    busy = false; updateControls();
  }
}
launch.onclick = () => {
  if (!frame.getAttribute('src')) frame.src = GAME_URL;
  dialog.showModal();
  frame.contentWindow?.postMessage({ channel: CHANNEL, type: 'context-request' }, location.origin);
};
find('fa-return').onclick = () => {
  dialog.close();
  // Pause sound while hidden; the game's next user gesture restores music.
  frame.contentDocument?.querySelectorAll('audio').forEach(audio => audio.pause());
  launch.focus();
};
dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) find('fa-return').click(); });
find('fa-toggle').onclick = () => {
  const panel = dialog.querySelector('.fa-chat');
  panel.hidden = !panel.hidden;
  dialog.querySelector('.fa-layout').classList.toggle('fa-game-only', panel.hidden);
  find('fa-toggle').textContent = panel.hidden ? '打开 AI 对话' : '收起 AI 对话';
  find('fa-toggle').setAttribute('aria-expanded', String(!panel.hidden));
};
target.onchange = render;
send.onclick = generate;
find('fa-stop').onclick = () => { cancelled = true; SillyTavern.getContext().stopGeneration(); status.textContent = '正在取消……'; };
input.addEventListener('keydown', event => {
  event.stopPropagation();
  if (event.ctrlKey && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); generate(); }
});
find('fa-clear').onclick = () => { delete conversations[key()]; persist(); render(); status.textContent = '当前场景对话已清空'; };
updateControls();
if (window.innerWidth <= 800) find('fa-toggle').click();
