/* =========================================================================
   转生千金 · 轻量级结构化角色对话代理服务（默认 chatgpt-2 Codex 桥接 + OpenAI 兼容主通道）
   安全策略：前端运行时静态文件严格白名单隔离 + 同源/本机/显式授权 CORS 保护 + 超时/断连中止传播
   启动方式：node server/gemini-proxy.mjs
   ========================================================================= */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../js/ai-personas.js';

const Personas = globalThis.AI_PERSONAS;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

export const DEFAULT_PROVIDER = 'codex';
export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
export const ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash'
];
export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * 严格静态资源白名单：仅暴露浏览器前端运行必需资源，彻底封锁原稿 .txt、服务端源码、测试与配置文档
 */
const ROOT_FILE_ALLOWLIST = new Set([
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
  'tavern-extension.js',
  'tavern-extension.css',
  'tavern-prompt.mjs'
]);

const SUBDIR_ALLOWLIST = ['js/', 'css/', 'assets/', 'Music/'];

const EXT_MIME_ALLOWLIST = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};

const LOOPBACK_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

/**
 * 校验请求路径是否属于允许公开访问的前端运行时资源
 */
export function isAllowedStaticPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  if (pathname.includes('\0') || pathname.includes('\\')) return false;

  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!rel) return false;

  const segments = rel.split('/');
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..' || seg.startsWith('.')) {
      return false;
    }
  }

  const ext = path.extname(rel).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(EXT_MIME_ALLOWLIST, ext)) {
    return false;
  }

  if (segments.length === 1) {
    return ROOT_FILE_ALLOWLIST.has(rel);
  }

  return SUBDIR_ALLOWLIST.some(prefix => rel.startsWith(prefix));
}

/**
 * 校验跨域 Origin 是否受信任（同源 Host / 本机 localhost,127.0.0.1 / ALLOWED_ORIGINS 环境变量）
 */
export function isOriginAllowed(origin, reqHost, extraAllowedOrigins = []) {
  if (!origin) return true;
  const normalized = String(origin).trim().replace(/\/+$/, '');
  if (LOOPBACK_ORIGIN_RE.test(normalized)) return true;

  if (reqHost) {
    const cleanHost = String(reqHost).trim().toLowerCase();
    if (normalized.toLowerCase() === `http://${cleanHost}` || normalized.toLowerCase() === `https://${cleanHost}`) {
      return true;
    }
  }

  for (const item of extraAllowedOrigins) {
    const allowed = String(item || '').trim().replace(/\/+$/, '');
    if (allowed && allowed.toLowerCase() === normalized.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function parseAllowedOriginsList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * 从可能包含 ```json / ``` 代码围栏、前后说明文字或嵌套花括号的文本中提取合法 JSON 对象字符串
 */
export function extractJsonObject(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return JSON.stringify(raw);
  }
  const text = String(raw || '').trim();
  if (!text) return '';

  const candidates = [];
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    if (match[1] && match[1].trim()) candidates.push(match[1].trim());
  }
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (stripped) candidates.push(stripped);
  if (text !== stripped) candidates.push(text);

  function scanBalancedObjects(src) {
    const blocks = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        if (depth > 0) {
          depth--;
          if (depth === 0 && start >= 0) {
            blocks.push(src.slice(start, i + 1));
            start = -1;
          }
        }
      }
    }
    return blocks;
  }

  let fallbackValid = '';
  for (const cand of candidates) {
    const blocks = scanBalancedObjects(cand);
    for (const block of blocks) {
      try {
        const obj = JSON.parse(block);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          if (typeof obj.reply === 'string') return block;
          if (!fallbackValid) fallbackValid = block;
        }
      } catch {}
    }
  }
  return fallbackValid || stripped;
}

/**
 * 解析并净水校验模型返回的结构化 JSON
 */
export function normalizeStructuredReply(raw, charId) {
  let parsed = raw;
  if (typeof raw === 'string') {
    const extracted = extractJsonObject(raw);
    parsed = JSON.parse(extracted);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('模型返回格式异常');
  }
  const sanitize = Personas?.sanitizeNarrativeOutput || (s => String(s || '').trim());
  const normalizeEmo = Personas?.normalizeEmotion || ((_, e) => e || 'normal');

  const action = sanitize(String(parsed.action || '')).slice(0, 300);
  const reply = sanitize(String(parsed.reply || '')).slice(0, 800);
  if (!reply) {
    throw new Error('模型回复内容为空');
  }
  const emotion = normalizeEmo(charId, parsed.emotion);
  const rawDeltas = parsed.causal_deltas && typeof parsed.causal_deltas === 'object' ? parsed.causal_deltas : {};
  const causal_deltas = {
    axis: String(rawDeltas.axis || 'none').trim(),
    delta: Math.max(0, Math.min(2, Math.round(Number(rawDeltas.delta) || 0))),
    clue: String(rawDeltas.clue || 'none').trim()
  };
  const memory_echo = sanitize(String(parsed.memory_echo || '')).slice(0, 80);

  return {
    action,
    reply,
    emotion,
    causal_deltas,
    memory_echo
  };
}

/**
 * 组装发送给 Gemini generateContent REST API 的 Payload（旧端点兼容）
 */
export function buildGeminiRequestBody({ snapshot, characterId, history = [], text, causal, vignetteHint }) {
  if (!snapshot?.playing) throw new Error('请先开始游戏或继续存档。');
  const person = snapshot.people?.find(p => p.id === characterId);
  if (!person) throw new Error('这个角色已离开当前场景，请重新选择在场人物。');
  if (!text || !String(text).trim()) throw new Error('请先输入想说的话。');

  const mergedCausal = causal || snapshot.causal || undefined;
  const activeHint = vignetteHint || snapshot.vignetteHint || undefined;
  const systemText = Personas.buildPersonaSystemPrompt(characterId, snapshot, mergedCausal);
  const safeContext = {
    scene: snapshot.scene,
    location: snapshot.location,
    description: snapshot.description,
    phase: snapshot.phase,
    player: snapshot.player,
    people: snapshot.people,
    speaker: snapshot.speaker,
    text: snapshot.text,
    flags: snapshot.flags || undefined,
    causal: mergedCausal,
    ...(activeHint ? { vignetteHint: String(activeHint).slice(0, 400) } : {}),
    target: person
  };

  const contents = [
    {
      role: 'user',
      parts: [{ text: `当前游戏场景快照：\n${JSON.stringify(safeContext)}\n请严格遵循灵魂卡设定与细粒度时间认知锁，以 JSON 结构回应玩家。` }]
    },
    {
      role: 'model',
      parts: [{ text: JSON.stringify({
        action: `${person.name}在当前场景中停下动作，望了过来。`,
        reply: '……嗯。',
        emotion: 'normal',
        causal_deltas: { axis: 'none', delta: 0, clue: 'none' },
        memory_echo: ''
      }) }]
    }
  ];

  for (const turn of (Array.isArray(history) ? history.slice(-12) : [])) {
    const role = turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user';
    const contentText = turn.structured
      ? JSON.stringify(turn.structured)
      : String(turn.content || '').slice(0, 3000);
    contents.push({ role, parts: [{ text: contentText }] });
  }

  contents.push({
    role: 'user',
    parts: [{ text: String(text).trim().slice(0, 2000) }]
  });

  return {
    systemInstruction: {
      parts: [{ text: systemText }]
    },
    contents,
    generationConfig: {
      temperature: 0.72,
      maxOutputTokens: 768,
      responseMimeType: 'application/json',
      responseSchema: Personas.RESPONSE_SCHEMA
    }
  };
}

/**
 * 组装发送给 GPT / OpenAI 兼容 Chat Completions API（及 chatgpt-2 Codex 桥接）的 Payload
 */
export function buildOpenAIRequestBody({ snapshot, characterId, history = [], text, causal, model, vignetteHint }) {
  if (!snapshot?.playing) throw new Error('请先开始游戏或继续存档。');
  const person = snapshot.people?.find(p => p.id === characterId);
  if (!person) throw new Error('这个角色已离开当前场景，请重新选择在场人物。');
  if (!text || !String(text).trim()) throw new Error('请先输入想说的话。');

  const mergedCausal = causal || snapshot.causal || undefined;
  const activeHint = vignetteHint || snapshot.vignetteHint || undefined;
  const systemText = Personas.buildPersonaSystemPrompt(characterId, snapshot, mergedCausal);
  const jsonContract = '\n\n【严格 JSON 输出格式】仅输出一个合法 JSON 对象，字段必须包含：' +
    '{"action":"简洁舞台神态动作","reply":"角色台词（贴合原著口吻、不出现禁词）","emotion":"normal|smile|happy|shy|serious|sad|surprised|teary|wink",' +
    '"causal_deltas":{"axis":"none或有效因果轴键","delta":0,"clue":"none或有效线索键"},"memory_echo":"20字以内留白回声或空字符串"}。';
  const safeContext = {
    scene: snapshot.scene,
    location: snapshot.location,
    description: snapshot.description,
    phase: snapshot.phase,
    player: snapshot.player,
    people: snapshot.people,
    speaker: snapshot.speaker,
    text: snapshot.text,
    flags: snapshot.flags || undefined,
    causal: mergedCausal,
    ...(activeHint ? { vignetteHint: String(activeHint).slice(0, 400) } : {}),
    target: person
  };

  const messages = [
    { role: 'system', content: systemText + jsonContract },
    { role: 'user', content: `当前游戏场景快照：\n${JSON.stringify(safeContext)}\n请严格遵循灵魂卡设定与细粒度时间认知锁，以 JSON 结构回应玩家。` },
    {
      role: 'assistant',
      content: JSON.stringify({
        action: `${person.name}在当前场景中停下动作，望了过来。`,
        reply: '……嗯。',
        emotion: 'normal',
        causal_deltas: { axis: 'none', delta: 0, clue: 'none' },
        memory_echo: ''
      })
    }
  ];

  for (const turn of (Array.isArray(history) ? history.slice(-12) : [])) {
    const role = turn.role === 'assistant' || turn.role === 'model' ? 'assistant' : 'user';
    const contentText = turn.structured
      ? JSON.stringify(turn.structured)
      : String(turn.content || '').slice(0, 3000);
    messages.push({ role, content: contentText });
  }

  messages.push({ role: 'user', content: String(text).trim().slice(0, 2000) });

  return {
    model: String(model || DEFAULT_OPENAI_MODEL).trim(),
    messages,
    temperature: 0.72,
    max_tokens: 768,
    response_format: { type: 'json_object' }
  };
}

function applyCorsHeaders(req, res, allowedOrigins) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!isOriginAllowed(origin, req.headers.host, allowedOrigins)) {
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OpenAI-Api-Key, X-OpenAI-Base-Url, X-Gemini-Api-Key');
  return true;
}

function sendJson(res, status, obj) {
  if (!res || res.writableEnded || res.destroyed) return;
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
}

function readRequestBody(req, maxBytes = 128 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('请求内容过长。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createRequestAbortScope(req, res, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  let timedOut = false;
  let clientClosed = false;
  const safeTimeout = Math.max(50, Number(timeoutMs) || 60000);

  const onTimeout = () => {
    if (clientClosed) return;
    timedOut = true;
    const err = new Error(timeoutMessage || '模型服务响应超时，请稍后重试。');
    err.code = 'ETIMEDOUT';
    err.isTimeout = true;
    controller.abort(err);
  };

  const onClientClose = () => {
    if (res.writableEnded || timedOut || clientClosed) return;
    clientClosed = true;
    const err = new Error('客户端已中断连接。');
    err.name = 'AbortError';
    err.isClientAbort = true;
    controller.abort(err);
  };

  const onReqClose = () => {
    if (res.writableEnded || timedOut) return;
    if (!req.complete || req.aborted || (req.socket && req.socket.destroyed)) {
      onClientClose();
    }
  };

  const timer = setTimeout(onTimeout, safeTimeout);
  if (typeof timer.unref === 'function') timer.unref();

  req.on('aborted', onClientClose);
  req.on('close', onReqClose);
  res.on('close', onClientClose);

  function raceWithSignal(workPromise) {
    if (controller.signal.aborted) {
      Promise.resolve(workPromise).catch(() => {});
      return Promise.reject(controller.signal.reason || new Error('请求已中止。'));
    }
    let onAbort;
    const abortPromise = new Promise((_, reject) => {
      onAbort = () => {
        reject(controller.signal.reason || new Error('请求已中止。'));
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const safeWork = Promise.resolve(workPromise);
    safeWork.catch(() => {});
    return Promise.race([safeWork, abortPromise]).finally(() => {
      if (onAbort) controller.signal.removeEventListener('abort', onAbort);
    });
  }

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    isClientClosed: () => clientClosed,
    raceWithSignal,
    cleanup: () => {
      clearTimeout(timer);
      req.off('aborted', onClientClose);
      req.off('close', onReqClose);
      res.off('close', onClientClose);
    }
  };
}

const DEFAULT_CODEX_HOME = process.env.CODEX_CHAT_HOME || process.env.CODEX_IMGGEN_HOME || path.join(os.homedir(), 'ChatGPT-Accounts', '2', 'codex');

function resolveCodexBin() {
  const candidates = [
    process.env.CODEX_CMD,
    path.join(os.homedir(), '.ai-loop', 'npm', 'codex.cmd'),
    path.join(os.homedir(), '.ai-loop', 'npm', 'codex')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return '';
}

/**
 * 通过本机已登录 chatgpt-2 订阅的官方 Codex CLI 桥接 GPT 结构化角色扮演（零 API Key）
 * 支持 configurable timeoutMs 与 AbortSignal（客户端断连或超时自动终止子进程）
 */
export function runCodexBridgeChat(payload, options = {}) {
  const codexHome = options.codexHome || DEFAULT_CODEX_HOME;
  const codexBin = options.codexBin || resolveCodexBin();
  const timeoutMs = Math.max(50, Number(options.timeoutMs || process.env.CODEX_TIMEOUT_MS || 90000));
  const externalSignal = options.signal || null;

  if (!codexBin || !fs.existsSync(codexHome)) {
    return Promise.reject(new Error('本机 chatgpt-2 订阅桥接未就绪，请检查 ChatGPT-Accounts/2/codex 与 codex.cmd。'));
  }
  if (externalSignal && externalSignal.aborted) {
    const preErr = externalSignal.reason instanceof Error ? externalSignal.reason : new Error('客户端已中断连接。');
    if (!preErr.isTimeout && !preErr.code) preErr.name = 'AbortError';
    return Promise.reject(preErr);
  }

  const sysMsg = payload.messages.find(m => m.role === 'system')?.content || '';
  const historyLines = payload.messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role === 'assistant' ? '角色' : '玩家'}]\n${m.content}`)
    .join('\n\n');
  const prompt = `${sysMsg}\n\n【对话记录与当前输入】\n${historyLines}\n\n请仅输出严格合法的单行或多行 JSON 对象，不要输出任何额外解释、不要调用任何工具。`;

  const tmpOut = path.join(os.tmpdir(), `ojousama_codex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
  const args = [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '-c', 'mcp_servers={}',
    '-c', 'notify=[]',
    '-s', 'read-only',
    '-o', tmpOut,
    '-'
  ];
  const env = { ...process.env, CODEX_HOME: codexHome };

  return new Promise((resolve, reject) => {
    const isWinCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(codexBin);
    const child = isWinCmd
      ? spawn('cmd.exe', ['/d', '/s', '/c', `"${codexBin}" ${args.map(a => `"${String(a).replace(/"/g, '""')}"`).join(' ')}`], { env, windowsHide: true, windowsVerbatimArguments: true })
      : spawn(codexBin, args, { env, windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let killGraceTimer = null;

    const terminateChild = () => {
      try { child.kill('SIGTERM'); } catch {}
      killGraceTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 1500);
      if (typeof killGraceTimer.unref === 'function') killGraceTimer.unref();
    };

    const cleanup = () => {
      clearTimeout(timer);
      if (killGraceTimer) clearTimeout(killGraceTimer);
      if (externalSignal && onExternalAbort) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    };

    const finishReject = err => {
      if (settled) return;
      settled = true;
      cleanup();
      try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
      reject(err);
    };

    const finishResolve = val => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const onExternalAbort = () => {
      terminateChild();
      const reason = externalSignal?.reason;
      if (reason instanceof Error && (reason.isTimeout || reason.code === 'ETIMEDOUT')) {
        finishReject(reason);
        return;
      }
      const abortErr = new Error('客户端已中断连接。');
      abortErr.name = 'AbortError';
      abortErr.isClientAbort = true;
      finishReject(abortErr);
    };

    if (externalSignal) {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const timer = setTimeout(() => {
      terminateChild();
      const timeoutErr = new Error('chatgpt-2 桥接响应超时，请稍后重试。');
      timeoutErr.code = 'ETIMEDOUT';
      timeoutErr.isTimeout = true;
      finishReject(timeoutErr);
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.on('error', err => {
      finishReject(new Error(`chatgpt-2 桥接启动失败：${err.message}`));
    });
    child.on('close', code => {
      let outText = '';
      try {
        if (fs.existsSync(tmpOut)) {
          outText = fs.readFileSync(tmpOut, 'utf8').trim();
          fs.unlinkSync(tmpOut);
        }
      } catch {}
      if (settled) return;
      if (code !== 0 && !outText) {
        finishReject(new Error(`chatgpt-2 桥接调用失败 (exit ${code})：${(stderr || stdout).slice(0, 180)}`));
        return;
      }
      const raw = outText || stdout.trim();
      const extracted = extractJsonObject(raw);
      finishResolve(extracted || raw);
    });

    child.stdin.on('error', () => {});
    child.stdin.write(prompt, 'utf8');
    child.stdin.end();
  });
}

export function createGeminiProxyServer(options = {}) {
  const fetchFn = options.fetchImpl || globalThis.fetch;
  const codexRunner = options.codexRunner || runCodexBridgeChat;
  const serverApiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? '';
  const serverOpenAIKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '';
  const serverOpenAIBase = String(options.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const allowedOrigins = parseAllowedOriginsList(options.allowedOrigins ?? process.env.ALLOWED_ORIGINS ?? '');
  const hasCodexBridge = Boolean(resolveCodexBin() && fs.existsSync(DEFAULT_CODEX_HOME));
  const upstreamTimeoutMs = Math.max(50, Number(options.timeoutMs || process.env.PROXY_TIMEOUT_MS || 60000));
  const codexTimeoutMs = Math.max(50, Number(options.codexTimeoutMs || process.env.CODEX_TIMEOUT_MS || 90000));

  return http.createServer(async (req, res) => {
    const corsOk = applyCorsHeaders(req, res, allowedOrigins);

    if (req.method === 'OPTIONS') {
      if (!corsOk) {
        sendJson(res, 403, { error: '禁止未授权的跨域请求来源。' });
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    let pathname = '/';
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      pathname = decodeURIComponent(parsedUrl.pathname);
    } catch {
      sendJson(res, 400, { error: '请求路径格式无效。' });
      return;
    }

    if (req.method === 'GET' && pathname === '/healthz') {
      if (!corsOk) {
        sendJson(res, 403, { error: '禁止未授权的跨域请求来源。' });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        service: 'fictional-adventure-gpt-proxy',
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_OPENAI_MODEL,
        hasCodexBridge,
        hasOpenAIKey: Boolean(serverOpenAIKey),
        hasServerKey: Boolean(hasCodexBridge || serverOpenAIKey || serverApiKey),
        timeoutMs: upstreamTimeoutMs,
        codexTimeoutMs
      });
      return;
    }

    // 主对话通道：默认 chatgpt-2 订阅桥接（provider: 'codex'，零 API Key），亦支持 GPT / OpenAI 兼容 API
    if (req.method === 'POST' && (pathname === '/api/chat' || pathname === '/api/openai/chat')) {
      if (!corsOk) {
        sendJson(res, 403, { error: '禁止未授权的跨域请求来源。' });
        return;
      }
      let scope = null;
      try {
        const rawBody = await readRequestBody(req);
        const body = JSON.parse(rawBody || '{}');
        const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        const activeKey = String(serverOpenAIKey || req.headers['x-openai-api-key'] || bearer || body.apiKey || '').trim();
        const openaiPayload = buildOpenAIRequestBody(body);

        const wantCodex = body.provider === 'codex'
          || (!body.provider && !activeKey && (hasCodexBridge || options.codexRunner));
        if (wantCodex) {
          scope = createRequestAbortScope(req, res, codexTimeoutMs, 'chatgpt-2 桥接响应超时，请稍后重试。');
          const candidateText = await scope.raceWithSignal(
            codexRunner(openaiPayload, {
              codexHome: options.codexHome,
              codexBin: options.codexBin,
              timeoutMs: codexTimeoutMs,
              signal: scope.signal
            })
          );
          if (scope.isClientClosed() || res.writableEnded) return;
          const structured = normalizeStructuredReply(candidateText, body.characterId);
          sendJson(res, 200, { ...structured, model: 'chatgpt-2-codex-bridge' });
          return;
        }

        if (!activeKey) {
          sendJson(res, 401, { error: '请先配置 OPENAI_API_KEY 环境变量，或在面板中填写您的 GPT API Key。' });
          return;
        }
        const rawBase = String(req.headers['x-openai-base-url'] || body.baseUrl || serverOpenAIBase).trim().replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(rawBase)) {
          sendJson(res, 400, { error: 'Base URL 必须以 http:// 或 https:// 开头。' });
          return;
        }
        const endpoint = /\/chat\/completions$/i.test(rawBase) ? rawBase : `${rawBase}/chat/completions`;

        scope = createRequestAbortScope(req, res, upstreamTimeoutMs, 'GPT 模型服务响应超时，请稍后重试。');
        const upstream = await scope.raceWithSignal(
          fetchFn(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeKey}`
            },
            signal: scope.signal,
            body: JSON.stringify(openaiPayload)
          })
        );
        if (scope.isClientClosed() || res.writableEnded) return;
        if (!upstream.ok) {
          sendJson(res, upstream.status === 429 ? 429 : 502, {
            error: upstream.status === 429
              ? 'GPT API 请求过于频繁或额度受限，请稍后再试。'
              : '连接 GPT 模型服务失败，请检查 API Key、Base URL 与模型名。'
          });
          return;
        }
        const data = await scope.raceWithSignal(upstream.json());
        if (scope.isClientClosed() || res.writableEnded) return;
        const candidateText = data?.choices?.[0]?.message?.content || '';
        const structured = normalizeStructuredReply(candidateText, body.characterId);
        sendJson(res, 200, { ...structured, model: openaiPayload.model });
      } catch (err) {
        if ((scope && scope.isClientClosed()) || err?.isClientAbort || res.writableEnded) {
          return;
        }
        if ((scope && scope.isTimedOut()) || err?.isTimeout || err?.code === 'ETIMEDOUT' || err?.name === 'TimeoutError') {
          sendJson(res, 504, { error: (err instanceof Error && err.message) ? err.message : '模型服务响应超时，请稍后重试。' });
          return;
        }
        const safeMsg = err instanceof Error && /^(请|这个|请求|模型|Base|本机|chatgpt-2)/.test(err.message)
          ? err.message
          : '对话生成失败，请稍后重试。';
        sendJson(res, 400, { error: safeMsg });
      } finally {
        if (scope) scope.cleanup();
      }
      return;
    }

    // 兼容旧测试端点：显式请求 /api/gemini/chat 时保留原有支持
    if (req.method === 'POST' && pathname === '/api/gemini/chat') {
      if (!corsOk) {
        sendJson(res, 403, { error: '禁止未授权的跨域请求来源。' });
        return;
      }
      let scope = null;
      try {
        const rawBody = await readRequestBody(req);
        const body = JSON.parse(rawBody || '{}');
        const activeKey = String(serverApiKey || req.headers['x-gemini-api-key'] || body.apiKey || '').trim();
        if (!activeKey) {
          sendJson(res, 401, { error: '请先配置 GEMINI_API_KEY 环境变量，或在面板中填写您的 Gemini API Key。' });
          return;
        }
        const requestedModel = String(body.model || DEFAULT_MODEL).trim();
        const safeModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;
        const geminiPayload = buildGeminiRequestBody(body);

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent`;
        scope = createRequestAbortScope(req, res, upstreamTimeoutMs, '模型服务响应超时，请稍后重试。');
        const upstream = await scope.raceWithSignal(
          fetchFn(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': activeKey
            },
            signal: scope.signal,
            body: JSON.stringify(geminiPayload)
          })
        );
        if (scope.isClientClosed() || res.writableEnded) return;

        if (!upstream.ok) {
          sendJson(res, upstream.status === 429 ? 429 : 502, {
            error: upstream.status === 429
              ? 'Gemini API 请求过于频繁或额度受限，请稍后再试。'
              : '连接 Gemini 模型服务失败，请检查 API Key 与网络状态。'
          });
          return;
        }

        const data = await scope.raceWithSignal(upstream.json());
        if (scope.isClientClosed() || res.writableEnded) return;
        const candidateText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        const structured = normalizeStructuredReply(candidateText, body.characterId);
        sendJson(res, 200, { ...structured, model: safeModel });
      } catch (err) {
        if ((scope && scope.isClientClosed()) || err?.isClientAbort || res.writableEnded) {
          return;
        }
        if ((scope && scope.isTimedOut()) || err?.isTimeout || err?.code === 'ETIMEDOUT' || err?.name === 'TimeoutError') {
          sendJson(res, 504, { error: (err instanceof Error && err.message) ? err.message : '模型服务响应超时，请稍后重试。' });
          return;
        }
        const safeMsg = err instanceof Error && /^(请|这个|请求|模型)/.test(err.message)
          ? err.message
          : '对话生成失败，请稍后重试。';
        sendJson(res, 400, { error: safeMsg });
      } finally {
        if (scope) scope.cleanup();
      }
      return;
    }

    // 静态文件托管（严格前端白名单模式，拒绝原稿 .txt、server/、tests/、隐藏文件与文档）
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (!isAllowedStaticPath(pathname)) {
        sendJson(res, 403, { error: '禁止访问非公开前端运行时资源。' });
        return;
      }
      const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const absPath = path.resolve(ROOT_DIR, relPath);
      const relCheck = path.relative(ROOT_DIR, absPath);
      if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
        sendJson(res, 403, { error: '禁止路径越界访问。' });
        return;
      }
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        const stat = fs.statSync(absPath);
        const ext = path.extname(absPath).toLowerCase();
        const mime = EXT_MIME_ALLOWLIST[ext];
        if (!mime) {
          sendJson(res, 403, { error: '禁止访问该类型文件。' });
          return;
        }
        const totalSize = stat.size;
        const rangeHeader = req.headers.range;
        if (rangeHeader && /^bytes=/.test(rangeHeader) && totalSize > 0) {
          const [rawStart, rawEnd] = rangeHeader.replace(/^bytes=/, '').split('-');
          const start = rawStart ? parseInt(rawStart, 10) : 0;
          const end = rawEnd ? Math.min(totalSize - 1, parseInt(rawEnd, 10)) : (totalSize - 1);
          if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || end >= totalSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
            res.end();
            return;
          }
          res.writeHead(206, {
            'Content-Type': mime,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1),
            'X-Content-Type-Options': 'nosniff'
          });
          if (req.method === 'HEAD') { res.end(); return; }
          const stream = fs.createReadStream(absPath, { start, end });
          stream.on('error', () => { try { res.destroy(); } catch {} });
          res.on('close', () => { try { stream.destroy(); } catch {} });
          stream.pipe(res);
          return;
        }
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'X-Content-Type-Options': 'nosniff'
        });
        if (req.method === 'HEAD') { res.end(); return; }
        const stream = fs.createReadStream(absPath);
        stream.on('error', () => { try { res.destroy(); } catch {} });
        res.on('close', () => { try { stream.destroy(); } catch {} });
        stream.pipe(res);
        return;
      }
      sendJson(res, 404, { error: '未找到前端静态资源。' });
      return;
    }

    sendJson(res, 405, { error: '不支持的请求方法。' });
  });
}

// 直接通过 CLI 启动时监听端口
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 8787);
  const srv = createGeminiProxyServer();
  srv.listen(port, () => {
    console.log(`[转生千金 Gemini Proxy] 已启动：http://localhost:${port}`);
  });
}
