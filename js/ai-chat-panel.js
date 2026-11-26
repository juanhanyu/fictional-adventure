/* =========================================================================
   转生千金 · 原生游戏内 Galgame 角色灵魂交谈抽屉（内置桥接 / 自定义通道）
   一次返回 { action, reply, emotion, causal_deltas, memory_echo }
   实时驱动舞台立绘表情切换与 S.causal 命运暗流演化
   ========================================================================= */
(function (root) {
  'use strict';

  var CFG_KEY = 'ojousama_gemini_cfg_v1';
  var CONV_KEY = 'ojousama_native_ai_conv_v1';

  var EMO_LABELS = {
    normal: '平静',
    smile: '浅笑',
    happy: '欣喜',
    shy: '微赧',
    serious: '凝重',
    sad: '黯然',
    surprised: '微怔',
    teary: '含泪',
    wink: '狡黠'
  };

  var activeAbort = null;
  var busy = false;
  var vignetteSession = null;        // 抽屉开启小场景横幅期间的活跃会话
  var pendingVignetteContext = null; // 跨抽屉收起保留至舞台继续按钮消费的累积结果
  var drawerEl = null;
  var lastEmotionByChar = Object.create(null);
  var viewportBound = false;

  function mergeSessionOutcome(prev, cur) {
    if (!cur) return prev;
    if (!prev) return Object.assign({}, cur);
    return {
      applied: !!(prev.applied || cur.applied),
      emotion: cur.emotion || prev.emotion || 'normal',
      axisChanged: !!(prev.axisChanged || cur.axisChanged),
      clueUnlocked: !!(prev.clueUnlocked || cur.clueUnlocked),
      echoSaved: !!(prev.echoSaved || cur.echoSaved)
    };
  }

  function currentSceneId() {
    return (typeof currentScene !== 'undefined' && currentScene) || 'free-roam';
  }

  /**
   * 解除小场景对抽屉下拉框与横幅的锁定（关闭抽屉、切换场景、开新档时均会调用）
   */
  function clearVignetteLock(wipePending) {
    vignetteSession = null;
    if (wipePending) pendingVignetteContext = null;
    if (drawerEl) {
      var banner = drawerEl.querySelector('#aid-vignette-banner');
      if (banner) banner.classList.add('hidden');
    }
  }

  function loadConfig() {
    var onLocalServer = (typeof location !== 'undefined' && /^https?:/i.test(location.protocol) && location.port === '8787');
    var defaultProxy = onLocalServer ? '/api/chat' : 'http://localhost:8787/api/chat';
    var base = {
      provider: onLocalServer ? 'codex' : 'openai', // 本机 8787 默认走本地内置共鸣桥接（免密钥）
      mode: onLocalServer ? 'proxy' : 'direct',     // 'proxy' | 'direct'
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      proxyUrl: defaultProxy,
      model: 'gpt-4.1'
    };
    try {
      var raw = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
      if (raw && typeof raw === 'object') return Object.assign(base, raw);
    } catch (e) {}
    return base;
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function loadConversations() {
    try {
      var data = JSON.parse(localStorage.getItem(CONV_KEY) || '{}');
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    } catch (e) {}
    return {};
  }

  function saveConversations(convs) {
    var entries = Object.entries(convs || {}).slice(-36);
    try { localStorage.setItem(CONV_KEY, JSON.stringify(Object.fromEntries(entries))); } catch (e) {}
  }

  /**
   * 实时采集当前舞台与探索状态快照（安全隔离，不含未来剧本，仅附带安全布尔进度标记）
   */
  function collectLiveSnapshot() {
    var gs = typeof document !== 'undefined' ? document.getElementById('game-screen') : null;
    var playing = !!(gs && !gs.classList.contains('hidden'));
    var st = (typeof S !== 'undefined' && S) ? S : root.S;
    if (!st) return { playing: false, people: [] };

    var curSc = currentSceneId();
    if (vignetteSession && (st.freeRoam || (vignetteSession.sceneAtStart && curSc !== vignetteSession.sceneAtStart))) {
      clearVignetteLock(true);
    } else if (pendingVignetteContext && (st.freeRoam || (pendingVignetteContext.sceneAtStart && curSc !== pendingVignetteContext.sceneAtStart))) {
      pendingVignetteContext = null;
    }

    var stageIds = [];
    if (typeof stage !== 'undefined' && Array.isArray(stage)) {
      stage.forEach(function (p) {
        if (p && p.id && p.id !== 'sylvia' && stageIds.indexOf(p.id) === -1) stageIds.push(p.id);
      });
    }
    if (!stageIds.length && st.freeRoam && typeof whoIsHere === 'function') {
      whoIsHere().forEach(function (id) {
        if (id && id !== 'sylvia' && stageIds.indexOf(id) === -1) stageIds.push(id);
      });
    }
    if (vignetteSession && vignetteSession.charId && stageIds.indexOf(vignetteSession.charId) === -1) {
      stageIds.unshift(vignetteSession.charId);
    }

    var charsDict = (typeof CHARS !== 'undefined' && CHARS) ? CHARS : (root.__CHARS || {});
    var locsDict = (typeof LOCS !== 'undefined' && LOCS) ? LOCS : (root.__LOCS || {});
    var todsArr = (typeof TODS !== 'undefined' && TODS) ? TODS : ['清晨', '上午', '下午', '傍晚', '夜晚'];
    var tiersArr = (typeof TIERS !== 'undefined' && TIERS) ? TIERS : ['无', '初级', '中级', '高级', '圣级', '王级', '帝级', '神级'];

    var people = stageIds.filter(function (id) { return !!charsDict[id]; }).map(function (id) {
      return {
        id: id,
        name: charsDict[id].name,
        short: charsDict[id].short,
        role: charsDict[id].role,
        age: id === 'beatrice' ? st.ageY + 2 : id === 'alice' ? Math.max(0, st.ageY - 2) : null,
        know: (st.know && st.know[id]) || 0,
        love: (st.love && st.love[id]) || 0
      };
    });

    var spkEl = typeof document !== 'undefined' ? document.getElementById('speaker') : null;
    var txtEl = typeof document !== 'undefined' ? document.getElementById('text') : null;
    var rawSpk = spkEl ? String(spkEl.textContent || '').trim() : '';
    var curSpk = (typeof curSpeakerId !== 'undefined' && curSpeakerId && charsDict[curSpeakerId])
      ? charsDict[curSpeakerId].name
      : rawSpk;
    var curTxt = (typeof fullText !== 'undefined' && fullText)
      ? fullText
      : (txtEl ? txtEl.textContent : '');

    var safeFlags = (root.AI_PERSONAS && typeof root.AI_PERSONAS.extractSafeFlags === 'function')
      ? root.AI_PERSONAS.extractSafeFlags(st.flags)
      : {};

    return {
      playing: playing,
      scene: curSc,
      location: (locsDict[st.loc] && locsDict[st.loc].name) || st.loc || '',
      description: (locsDict[st.loc] && locsDict[st.loc].desc) || '',
      phase: st.phase || 'prologue',
      flags: safeFlags,
      player: {
        name: st.alias || st.name || '希尔维亚',
        age: st.ageY || 0,
        year: st.year || 0,
        month: st.month || 3,
        day: st.day || 1,
        time: todsArr[st.tod] || '',
        tier: tiersArr[st.tier] || '无',
        hp: st.hp,
        mp: st.mp,
        stamina: st.st,
        level: st.lv
      },
      speaker: curSpk || '',
      rawSpeaker: rawSpk || '',
      text: String(curTxt || '').slice(0, 2500),
      people: people,
      causal: root.BranchingDirector ? root.BranchingDirector.getCausalSnapshot(st) : undefined
    };
  }

  function convKeyFor(snap, charId) {
    if (!snap || !charId) return '';
    return JSON.stringify([snap.scene, snap.location, snap.player && snap.player.year, snap.player && snap.player.month, charId]);
  }

  /**
   * 从可能夹带代码块围栏（```json / ```）或前后旁白的文本中精准提取最外层平衡 JSON 对象
   */
  function extractBalancedJsonText(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';

    // 优先尝试代码块内部内容
    var fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
    var candidates = [];
    var m;
    while ((m = fenceRe.exec(text)) !== null) {
      if (m[1] && m[1].trim()) candidates.push(m[1].trim());
    }
    var stripped = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    if (stripped) candidates.push(stripped);
    if (text !== stripped) candidates.push(text);

    function scanBalancedObjects(src) {
      var found = [];
      var depth = 0;
      var start = -1;
      var inStr = false;
      var escaped = false;
      for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        if (inStr) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inStr = false;
          }
          continue;
        }
        if (ch === '"') {
          inStr = true;
        } else if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          if (depth > 0) {
            depth--;
            if (depth === 0 && start >= 0) {
              found.push(src.slice(start, i + 1));
              start = -1;
            }
          }
        }
      }
      return found;
    }

    var fallbackValid = '';
    for (var ci = 0; ci < candidates.length; ci++) {
      var blocks = scanBalancedObjects(candidates[ci]);
      for (var bi = 0; bi < blocks.length; bi++) {
        try {
          var parsed = JSON.parse(blocks[bi]);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            if (typeof parsed.reply === 'string') return blocks[bi];
            if (!fallbackValid) fallbackValid = blocks[bi];
          }
        } catch (e) {}
      }
    }
    return fallbackValid || stripped;
  }

  /**
   * 解析并净水结构化模型输出
   */
  function parseStructuredModelOutput(rawTextOrObj, charId) {
    var obj = rawTextOrObj;
    if (typeof obj === 'string') {
      var extracted = extractBalancedJsonText(obj);
      obj = JSON.parse(extracted);
    }
    if (!obj || typeof obj !== 'object') {
      throw new Error('灵语回音微弱散乱，请重新传音。');
    }
    var Personas = root.AI_PERSONAS;
    var sanitize = (Personas && Personas.sanitizeNarrativeOutput) ? Personas.sanitizeNarrativeOutput : function (s) { return String(s || '').trim(); };
    var normEmo = (Personas && Personas.normalizeEmotion) ? Personas.normalizeEmotion : function (_, e) { return e || 'normal'; };

    var action = sanitize(String(obj.action || '')).slice(0, 300);
    var reply = sanitize(String(obj.reply || '')).slice(0, 800);
    if (!reply) throw new Error('眼前之人一时默然，未能传来回音，请再试一次。');

    var deltas = (obj.causal_deltas && typeof obj.causal_deltas === 'object') ? obj.causal_deltas : {};
    return {
      action: action,
      reply: reply,
      emotion: normEmo(charId, obj.emotion),
      causal_deltas: {
        axis: String(deltas.axis || 'none').trim(),
        delta: Math.max(0, Math.min(2, Math.round(Number(deltas.delta) || 0))),
        clue: String(deltas.clue || 'none').trim()
      },
      memory_echo: sanitize(String(obj.memory_echo || '')).slice(0, 80)
    };
  }

  /**
   * 发起结构化对话请求（支持 Proxy 代理与 Direct 直连双模）
   */
  async function requestStructuredDialogue(params) {
    var snap = params.snapshot;
    var charId = params.characterId;
    var history = params.history || [];
    var userText = params.text;
    var cfg = params.config || loadConfig();
    var signal = params.signal;
    var fetchImpl = params.fetchImpl || root.fetch.bind(root);

    var Personas = root.AI_PERSONAS;
    if (!Personas) throw new Error('灵语心镜尚未就绪，请稍候再试。');
    if (!snap || !snap.playing) throw new Error('请先开始游戏或继续存档。');
    var person = (snap.people || []).find(function (p) { return p.id === charId; });
    if (!person) throw new Error('当前角色不在场，请先走近角色或切换对象。');
    if (!userText || !String(userText).trim()) throw new Error('请先输入想对角色说的话。');

    var activeHint = params.vignetteHint || (vignetteSession ? vignetteSession.hint : (pendingVignetteContext ? pendingVignetteContext.hint : undefined));

    if (cfg.mode === 'proxy') {
      var url = String(cfg.proxyUrl || '').trim();
      if (!url) throw new Error('灵语信标尚未指定，请先在「共鸣设置」高级配置中填写中转地址。');
      var headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey && cfg.apiKey.trim()) {
        headers['X-OpenAI-Api-Key'] = cfg.apiKey.trim();
        headers['X-Gemini-Api-Key'] = cfg.apiKey.trim();
      }
      if (cfg.baseUrl && cfg.baseUrl.trim()) {
        headers['X-OpenAI-Base-Url'] = cfg.baseUrl.trim();
      }
      var resp = await fetchImpl(url, {
        method: 'POST',
        headers: headers,
        signal: signal,
        body: JSON.stringify({
          provider: cfg.provider || 'codex',
          baseUrl: String(cfg.baseUrl || '').trim(),
          snapshot: snap,
          characterId: charId,
          history: history.slice(-12),
          text: String(userText).trim().slice(0, 2000),
          causal: snap.causal,
          vignetteHint: activeHint,
          model: cfg.model || 'gpt-4.1'
        })
      });
      var respJson = await resp.json().catch(function () { return {}; });
      if (!resp.ok) {
        throw new Error(respJson.error || '灵语传音未能送达，请稍候重试或检查共鸣设置。');
      }
      return parseStructuredModelOutput(respJson, charId);
    }

    var key = String(cfg.apiKey || '').trim();
    if (!key) {
      throw new Error('尚未填入共鸣凭证，请在「共鸣设置」中填写或切回内置灵语共鸣。');
    }
    var model = String(cfg.model || 'gpt-4.1').trim();
    var isCustomRelay = !!(cfg.baseUrl && !/api\.openai\.com/i.test(cfg.baseUrl));
    var useLegacyGemini = (cfg.provider === 'gemini') || (/^gemini/i.test(model) && !isCustomRelay);
    var sysText = Personas.buildPersonaSystemPrompt(charId, snap, snap.causal);
    var sceneContextObj = {
      scene: snap.scene,
      location: snap.location,
      description: snap.description,
      phase: snap.phase,
      flags: snap.flags,
      player: snap.player,
      people: snap.people,
      speaker: snap.speaker,
      text: snap.text,
      causal: snap.causal,
      vignetteHint: activeHint,
      target: person
    };

    if (!useLegacyGemini) {
      // 主通道：直连 GPT / OpenAI 兼容 Chat Completions API（支持官方 OpenAI 及任意兼容中转站）
      var baseUrl = String(cfg.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
      var openaiUrl = /\/chat\/completions$/i.test(baseUrl) ? baseUrl : (baseUrl + '/chat/completions');
      var jsonContract = '\n\n【严格 JSON 输出格式】仅输出一个合法 JSON 对象，字段必须包含：' +
        '{"action":"简洁舞台神态动作","reply":"角色台词（贴合原著口吻、不出现禁词）","emotion":"normal|smile|happy|shy|serious|sad|surprised|teary|wink",' +
        '"causal_deltas":{"axis":"none或有效因果轴键","delta":0,"clue":"none或有效线索键"},"memory_echo":"20字以内留白回声或空字符串"}。';
      var messages = [
        { role: 'system', content: sysText + jsonContract },
        { role: 'user', content: '当前游戏场景资料：\n' + JSON.stringify(sceneContextObj) + '\n请严格按上述 JSON 格式回应。' },
        {
          role: 'assistant',
          content: JSON.stringify({
            action: person.name + '在原地停下动作，抬眼望了过来。',
            reply: '……嗯。',
            emotion: 'normal',
            causal_deltas: { axis: 'none', delta: 0, clue: 'none' },
            memory_echo: ''
          })
        }
      ];
      history.slice(-12).forEach(function (turn) {
        messages.push({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: turn.structured ? JSON.stringify(turn.structured) : String(turn.content || '').slice(0, 3000)
        });
      });
      messages.push({ role: 'user', content: String(userText).trim().slice(0, 2000) });

      var gptResp = await fetchImpl(openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        signal: signal,
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.72,
          max_tokens: 768,
          response_format: { type: 'json_object' }
        })
      });
      if (!gptResp.ok) {
        throw new Error(gptResp.status === 429
          ? '此刻灵语共鸣略显拥挤，请片刻后再试传音。'
          : '灵语传音受阻（' + gptResp.status + '），请确认「共鸣设置」中的凭证与信标地址。');
      }
      var gptData = await gptResp.json();
      var gptText = (((gptData.choices || [])[0] || {}).message || {}).content || '';
      return parseStructuredModelOutput(gptText, charId);
    }

    // 兼容旧配置：显式指定 gemini 时保留回退支持
    var contents = [
      {
        role: 'user',
        parts: [{ text: '当前游戏场景资料：\n' + JSON.stringify(sceneContextObj) + '\n请严格按 JSON Schema 返回物理动作、角色台词、舞台表情与因果微澜。' }]
      },
      {
        role: 'model',
        parts: [{ text: JSON.stringify({
          action: person.name + '在原地停下动作，抬眼望了过来。',
          reply: '……嗯。',
          emotion: 'normal',
          causal_deltas: { axis: 'none', delta: 0, clue: 'none' },
          memory_echo: ''
        }) }]
      }
    ];

    history.slice(-12).forEach(function (turn) {
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.structured ? JSON.stringify(turn.structured) : String(turn.content || '').slice(0, 3000) }]
      });
    });
    contents.push({
      role: 'user',
      parts: [{ text: String(userText).trim().slice(0, 2000) }]
    });

    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    var directResp = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      signal: signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysText }] },
        contents: contents,
        generationConfig: {
          temperature: 0.72,
          maxOutputTokens: 768,
          responseMimeType: 'application/json',
          responseSchema: Personas.RESPONSE_SCHEMA
        }
      })
    });

    if (!directResp.ok) {
      throw new Error(directResp.status === 429
        ? '此刻灵语共鸣略显拥挤，请片刻后再试传音。'
        : '灵语传音受阻（' + directResp.status + '），请确认「共鸣设置」中的凭证是否有效。');
    }
    var directData = await directResp.json();
    var rawText = (((directData.candidates || [])[0] || {}).content || {}).parts
      ? directData.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('')
      : '';
    return parseStructuredModelOutput(rawText, charId);
  }

  // =========================================================================
  // UI 构建与实时交互绑定
  // =========================================================================

  var SVG_CAUSAL_ICON =
    '<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="10" cy="10" r="6.8"/>' +
      '<ellipse cx="10" cy="10" rx="6.8" ry="2.6" transform="rotate(-24 10 10)"/>' +
      '<circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none"/>' +
    '</svg>';

  var SVG_SPARK_ICON =
    '<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10 2.5L11.9 8.1L17.5 10L11.9 11.9L10 17.5L8.1 11.9L2.5 10L8.1 8.1Z"/>' +
    '</svg>';

  var SVG_GEAR_ICON =
    '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="10" cy="10" r="2.8"/>' +
      '<path d="M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.2 5.2l1.1 1.1M13.7 13.7l1.1 1.1M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1"/>' +
    '</svg>';

  var SVG_SIGIL_CREST =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polygon points="12,2.5 20,12 12,21.5 4,12"/>' +
      '<circle cx="12" cy="12" r="3.4"/>' +
      '<path d="M12 5.5v3M12 15.5v3M5.5 12h3M15.5 12h3"/>' +
    '</svg>';

  function ensureHUDButtons() {
    if (typeof document === 'undefined') return;
    var hudRight = document.querySelector('#hud .hud-right');
    if (!hudRight) return;

    if (!document.getElementById('btn-causal-quick')) {
      var btnCausal = document.createElement('button');
      btnCausal.id = 'btn-causal-quick';
      btnCausal.className = 'chip chip-causal';
      btnCausal.title = '命运暗流星盘';
      btnCausal.setAttribute('aria-label', '命运暗流星盘');
      btnCausal.innerHTML = SVG_CAUSAL_ICON;
      btnCausal.onclick = function () {
        if (typeof openPanel === 'function') openPanel('causal');
      };
      hudRight.insertBefore(btnCausal, hudRight.firstChild);
    }

    var btnAi = document.getElementById('btn-ai-drawer');
    if (!btnAi) {
      btnAi = document.createElement('button');
      btnAi.id = 'btn-ai-drawer';
      btnAi.className = 'chip chip-ai';
      btnAi.title = '灵语 · 角色灵魂交谈';
      btnAi.setAttribute('aria-label', '灵语');
      btnAi.innerHTML = SVG_SPARK_ICON + '<span class="chip-lbl">灵语</span>';
      btnAi.onclick = function () {
        toggleDrawer();
      };
      hudRight.insertBefore(btnAi, hudRight.firstChild);
    } else {
      btnAi.title = '灵语 · 角色灵魂交谈';
      btnAi.setAttribute('aria-label', '灵语');
      var aiLbl = btnAi.querySelector('.chip-lbl');
      if (!aiLbl) {
        aiLbl = document.createElement('span');
        aiLbl.className = 'chip-lbl';
        btnAi.appendChild(aiLbl);
      }
      aiLbl.textContent = '灵语';
    }
  }

  /**
   * 统一收束当前小场景自由对话（抽屉收束按钮与舞台继续按钮共用，保留已产生的因果倾向）
   */
  function finishActiveVignette() {
    var ctx = vignetteSession || pendingVignetteContext;
    clearVignetteLock(true);
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('ai-drawer-open', false);
    }
    if (drawerEl) {
      drawerEl.classList.add('hidden');
      drawerEl.style.height = '';
      drawerEl.style.top = '';
      refreshBadge();
    }
    if (typeof document !== 'undefined') {
      var chBox = document.getElementById('choices');
      if (chBox) chBox.innerHTML = '';
    }
    if (typeof awaitingChoice !== 'undefined') awaitingChoice = false;
    if (ctx && typeof ctx.onComplete === 'function') {
      ctx.onComplete(ctx.lastOutcome || null);
      return true;
    }
    return false;
  }

  function syncDrawerViewport() {
    if (!drawerEl) return;
    var win = typeof window !== 'undefined' ? window : null;
    if (!win) return;
    if (
      !drawerEl.classList.contains('hidden') &&
      (win.innerWidth <= 820 || win.innerHeight <= 500) &&
      win.visualViewport
    ) {
      drawerEl.style.height = Math.max(240, Math.round(win.visualViewport.height)) + 'px';
      drawerEl.style.top = Math.max(0, Math.round(win.visualViewport.offsetTop)) + 'px';
    } else {
      drawerEl.style.height = '';
      drawerEl.style.top = '';
    }
  }

  function bindViewportListeners() {
    if (viewportBound || typeof window === 'undefined') return;
    viewportBound = true;
    window.addEventListener('resize', syncDrawerViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncDrawerViewport);
      window.visualViewport.addEventListener('scroll', syncDrawerViewport);
    }
  }

  function updateCfgSummary() {
    if (!drawerEl) return;
    var summaryEl = drawerEl.querySelector('#aid-cfg-summary');
    if (!summaryEl) return;
    var modeEl = drawerEl.querySelector('#aid-mode');
    var keyEl = drawerEl.querySelector('#aid-apikey');
    var modelEl = drawerEl.querySelector('#aid-model');
    var selMode = modeEl ? modeEl.value : 'codex';
    var hasKey = !!(keyEl && keyEl.value.trim());
    var modelName = (modelEl && modelEl.value.trim()) || 'gpt-4.1';
    if (selMode === 'codex') {
      summaryEl.textContent = '✦ 当前共鸣：内置灵语共鸣（默认就绪）';
    } else if (selMode === 'direct') {
      summaryEl.textContent = '✦ 当前共鸣：自定义信标（' + (hasKey ? '已备凭证' : '待填凭证') + ' · ' + modelName + '）';
    } else {
      summaryEl.textContent = '✦ 当前共鸣：中转信标（' + modelName + '）';
    }
  }

  function ensureDrawerDOM() {
    if (typeof document === 'undefined') return null;
    if (drawerEl) return drawerEl;
    var app = document.getElementById('app') || document.body;
    if (!app) return null;

    var cfg = loadConfig();
    var aside = document.createElement('aside');
    aside.id = 'ai-drawer';
    aside.className = 'ai-drawer hidden';
    aside.setAttribute('aria-label', '角色灵魂交谈抽屉');
    aside.innerHTML =
      '<div class="aid-head">' +
        '<div class="aid-title-wrap">' +
          '<span class="aid-spark">' + SVG_SPARK_ICON + '</span>' +
          '<div><h3 class="aid-title">灵魂交谈</h3><p class="aid-sub" id="aid-gate-tag">等待角色登场</p></div>' +
        '</div>' +
        '<div class="aid-head-btns">' +
          '<button type="button" id="aid-btn-cfg" class="aid-icon-btn aid-cfg-toggle" title="共鸣设置" aria-label="共鸣设置" data-tip="共鸣设置">' + SVG_GEAR_ICON + '<span class="aid-icon-label">设置</span></button>' +
          '<button type="button" id="aid-btn-close" class="aid-icon-btn" title="收起抽屉" aria-label="收起抽屉">×</button>' +
        '</div>' +
      '</div>' +
      '<div id="aid-cfg-box" class="aid-cfg hidden">' +
        '<div class="aid-cfg-summary" id="aid-cfg-summary"></div>' +
        '<details class="aid-dev-disclosure" id="aid-dev-disclosure">' +
          '<summary>高级共鸣配置（自定义信标 / 凭证）</summary>' +
          '<div class="aid-dev-fields">' +
            '<div class="aid-cfg-row">' +
              '<label>共鸣通道</label>' +
              '<select id="aid-mode">' +
                '<option value="codex"' + (cfg.mode === 'proxy' && cfg.provider === 'codex' ? ' selected' : '') + '>内置灵语共鸣（默认就绪 · 免凭证）</option>' +
                '<option value="direct"' + (cfg.mode === 'direct' ? ' selected' : '') + '>自定义直连信标（需填写凭证）</option>' +
                '<option value="proxy"' + (cfg.mode === 'proxy' && cfg.provider !== 'codex' ? ' selected' : '') + '>自定义中转信标</option>' +
              '</select>' +
            '</div>' +
            '<div class="aid-cfg-row" id="aid-baseurl-row">' +
              '<label>信标地址 <small>（兼容通用接口地址）</small></label>' +
              '<input type="text" id="aid-baseurl" placeholder="https://api.openai.com/v1"/>' +
            '</div>' +
            '<div class="aid-cfg-row" id="aid-key-row">' +
              '<label>共鸣凭证 <small>（仅存本机）</small></label>' +
              '<input type="password" id="aid-apikey" placeholder="粘贴访问凭证" autocomplete="off"/>' +
            '</div>' +
            '<div class="aid-cfg-row" id="aid-proxy-row">' +
              '<label>中转地址</label>' +
              '<input type="text" id="aid-proxy" placeholder="http://localhost:8787/api/chat"/>' +
            '</div>' +
            '<div class="aid-cfg-row">' +
              '<label>灵语模型 <small>（可按需调整）</small></label>' +
              '<input type="text" id="aid-model" list="aid-model-list" placeholder="gpt-4.1"/>' +
              '<datalist id="aid-model-list">' +
                '<option value="gpt-5"></option>' +
                '<option value="gpt-4.1"></option>' +
                '<option value="gpt-4o"></option>' +
                '<option value="gpt-5-mini"></option>' +
              '</datalist>' +
            '</div>' +
            '<div class="aid-cfg-foot">' +
              '<button type="button" id="aid-cfg-save" class="aid-btn primary">保存设置</button>' +
            '</div>' +
          '</div>' +
        '</details>' +
      '</div>' +
      '<div class="aid-target-bar">' +
        '<div class="aid-sigil-badge" id="aid-sigil-badge" aria-hidden="true">' + SVG_SIGIL_CREST + '</div>' +
        '<div id="aid-avatar-wrap" class="aid-avatar hidden"><img id="aid-avatar" class="hidden" alt=""/></div>' +
        '<div class="aid-target-meta">' +
          '<select id="aid-target" aria-label="选择在场对话角色"></select>' +
          '<div id="aid-axis-mini" class="aid-axis-mini"></div>' +
        '</div>' +
      '</div>' +
      '<div id="aid-vignette-banner" class="aid-vignette-banner hidden">' +
        '<span id="aid-vignette-text"></span>' +
        '<button type="button" id="aid-vignette-finish" class="aid-btn gold">织入命运并继续剧情 ▸</button>' +
      '</div>' +
      '<div id="aid-log" class="aid-log" role="log" aria-live="polite"></div>' +
      '<div id="aid-status" class="aid-status">聆听中 · 你的每句回应都将牵动心境与因果</div>' +
      '<div class="aid-compose">' +
        '<textarea id="aid-input" maxlength="2000" rows="2" placeholder="对眼前的角色说点什么……（Ctrl + Enter 发送）"></textarea>' +
        '<div class="aid-actions">' +
          '<button type="button" id="aid-send" class="aid-btn primary">发送</button>' +
          '<button type="button" id="aid-cancel" class="aid-btn hidden">取消</button>' +
          '<button type="button" id="aid-clear" class="aid-btn ghost">清空</button>' +
        '</div>' +
      '</div>';

    app.appendChild(aside);
    drawerEl = aside;
    bindViewportListeners();

    // 初始化表单值
    aside.querySelector('#aid-baseurl').value = cfg.baseUrl || 'https://api.openai.com/v1';
    aside.querySelector('#aid-apikey').value = cfg.apiKey || '';
    aside.querySelector('#aid-proxy').value = cfg.proxyUrl || '';
    aside.querySelector('#aid-model').value = cfg.model || 'gpt-4.1';
    syncCfgRows();

    var cfgBox = aside.querySelector('#aid-cfg-box');
    var disclosure = aside.querySelector('#aid-dev-disclosure');
    if (cfgBox && typeof MutationObserver === 'function') {
      var cfgObserver = new MutationObserver(function () {
        if (!cfgBox.classList.contains('hidden')) {
          updateCfgSummary();
        }
      });
      cfgObserver.observe(cfgBox, { attributes: true, attributeFilter: ['class'] });
    }

    // 绑定事件
    aside.querySelector('#aid-btn-close').onclick = function () { closeDrawer(); };
    aside.querySelector('#aid-btn-cfg').onclick = function () {
      var willOpen = cfgBox.classList.contains('hidden');
      cfgBox.classList.toggle('hidden');
      if (willOpen) {
        if (disclosure) disclosure.open = false;
        updateCfgSummary();
      }
    };
    aside.querySelector('#aid-mode').onchange = syncCfgRows;
    aside.querySelector('#aid-apikey').addEventListener('input', updateCfgSummary);
    aside.querySelector('#aid-model').addEventListener('input', updateCfgSummary);
    aside.querySelector('#aid-cfg-save').onclick = function () {
      var selMode = aside.querySelector('#aid-mode').value;
      var nextCfg = {
        provider: selMode === 'codex' ? 'codex' : 'openai',
        mode: selMode === 'direct' ? 'direct' : 'proxy',
        baseUrl: aside.querySelector('#aid-baseurl').value.trim() || 'https://api.openai.com/v1',
        apiKey: aside.querySelector('#aid-apikey').value.trim(),
        proxyUrl: aside.querySelector('#aid-proxy').value.trim() || '/api/chat',
        model: aside.querySelector('#aid-model').value.trim() || 'gpt-4.1'
      };
      saveConfig(nextCfg);
      updateCfgSummary();
      cfgBox.classList.add('hidden');
      setStatus(selMode === 'codex'
        ? '已切回内置灵语共鸣'
        : '已更新共鸣设置（' + (nextCfg.mode === 'proxy' ? '中转信标' : '直连信标') + ' · ' + nextCfg.model + '）');
    };
    aside.querySelector('#aid-target').onchange = function () {
      refreshBadge();
      renderTranscript();
    };
    aside.querySelector('#aid-send').onclick = function () { handleSend(); };
    aside.querySelector('#aid-cancel').onclick = function () {
      if (activeAbort) activeAbort.abort();
    };
    aside.querySelector('#aid-clear').onclick = function () {
      var snap = collectLiveSnapshot();
      var cid = aside.querySelector('#aid-target').value;
      var convs = loadConversations();
      delete convs[convKeyFor(snap, cid)];
      saveConversations(convs);
      renderTranscript();
      setStatus('已清空当前场景交谈记录');
    };
    aside.querySelector('#aid-vignette-finish').onclick = function () {
      finishActiveVignette();
    };
    // 抽屉容器级键盘隔离：阻止所有输入/选择控件按键穿透到底层游戏快捷键，并支持 Escape 关闭抽屉
    aside.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        ev.preventDefault();
        closeDrawer({ wipePending: true });
        return;
      }
      ev.stopPropagation();
    });
    var inputEl = aside.querySelector('#aid-input');
    inputEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') return;
      ev.stopPropagation();
      if (ev.ctrlKey && ev.key === 'Enter' && !ev.isComposing) {
        ev.preventDefault();
        handleSend();
      }
    });

    // 开始新游戏时重置对话缓存、角色表情记忆与小场景锁定状态，并同步关闭抽屉与移除 ai-drawer-open
    var btnNew = document.getElementById('btn-new');
    if (btnNew && !btnNew.__aidBound) {
      btnNew.__aidBound = true;
      btnNew.addEventListener('click', function () {
        lastEmotionByChar = Object.create(null);
        clearVignetteLock(true);
        saveConversations({});
        closeDrawer({ wipePending: true });
        if (typeof document !== 'undefined' && document.body) {
          document.body.classList.toggle('ai-drawer-open', false);
        }
        if (drawerEl) {
          refreshBadge();
          renderTranscript();
        }
      });
    }

    // 返回标题界面时收起抽屉并彻底同步清理 ai-drawer-open
    var btnTitle = document.getElementById('btn-title');
    if (btnTitle && !btnTitle.__aidBound) {
      btnTitle.__aidBound = true;
      btnTitle.addEventListener('click', function () {
        closeDrawer({ wipePending: true });
        if (typeof document !== 'undefined' && document.body) {
          document.body.classList.toggle('ai-drawer-open', false);
        }
      });
    }

    return drawerEl;
  }

  function syncCfgRows() {
    if (!drawerEl) return;
    var mode = drawerEl.querySelector('#aid-mode').value;
    drawerEl.querySelector('#aid-proxy-row').classList.toggle('hidden', mode === 'direct');
    drawerEl.querySelector('#aid-baseurl-row').classList.toggle('hidden', mode === 'codex');
    drawerEl.querySelector('#aid-key-row').classList.toggle('hidden', mode === 'codex');
    updateCfgSummary();
  }

  function setStatus(msg) {
    if (!drawerEl) return;
    var el = drawerEl.querySelector('#aid-status');
    if (el) el.textContent = msg;
  }

  function isMysterySpeakerRaw(raw) {
    var s = String(raw || '').trim();
    return s === '？？？' || s === '???' || /^？+$/.test(s) || /^\?+$/.test(s);
  }

  function isIdentityHidden(charId, snap, st) {
    if (!charId) return false;
    var stateObj = st || ((typeof S !== 'undefined' && S) ? S : root.S);
    var flags = (stateObj && stateObj.flags) || (snap && snap.flags) || {};
    var age = snap && snap.player ? snap.player.age : (stateObj ? (stateObj.ageY || 0) : 0);
    var spkMystery = snap ? (isMysterySpeakerRaw(snap.rawSpeaker) || isMysterySpeakerRaw(snap.speaker)) : false;
    // 婴儿期（0岁尚未取名）或当前台词仍处于「？？？」盲声期：严禁剧透全名与家族身份
    if (!flags.named && age === 0 && (charId === 'sophia' || charId === 'claude')) return true;
    if (spkMystery && typeof curSpeakerId !== 'undefined' && curSpeakerId === charId) return true;
    if (spkMystery && stateObj && !flags.named && (charId === 'sophia' || charId === 'claude')) return true;
    var knowVal = (stateObj && stateObj.know && stateObj.know[charId]) || 0;
    if (spkMystery && knowVal <= 0) return true;
    return false;
  }

  function maskedPersonLabel(charId) {
    if (charId === 'sophia') return '温柔的陌生声音（???）';
    if (charId === 'claude') return '低沉的陌生声音（???）';
    return '陌生声音（???）';
  }

  function maskedPersonShort(charId) {
    if (charId === 'sophia') return '温柔的声音（???）';
    if (charId === 'claude') return '低沉的声音（???）';
    return '？？？';
  }

  function updateDrawerAvatar(avatar, sigil, cid, hiddenId, emo, altText) {
    if (!avatar) return;
    var wrap = (avatar.parentElement && avatar.parentElement.id === 'aid-avatar-wrap') ? avatar.parentElement : null;
    if (cid && !hiddenId && typeof resolvePortrait === 'function') {
      var emoKey = emo || 'normal';
      var src = resolvePortrait(cid, emoKey) || resolvePortrait(cid, 'normal') || '';
      if (src) {
        avatar.onerror = null;
        avatar.dataset.fallbackTried = '';
        avatar.dataset.charId = cid;
        avatar.onerror = function () {
          var targetCid = avatar.dataset.charId || cid;
          var failedSrc = avatar.getAttribute('src');
          if (failedSrc && typeof FAILED_PORTRAIT_URLS !== 'undefined' && FAILED_PORTRAIT_URLS && typeof FAILED_PORTRAIT_URLS.add === 'function') {
            FAILED_PORTRAIT_URLS.add(failedSrc);
          }
          if (!avatar.dataset.fallbackTried && typeof resolvePortrait === 'function') {
            var norm = resolvePortrait(targetCid, 'normal');
            if (norm && avatar.getAttribute('src') !== norm) {
              avatar.dataset.fallbackTried = '1';
              avatar.src = norm;
              return;
            }
          }
          avatar.classList.add('hidden');
          if (wrap) wrap.classList.add('hidden');
          if (sigil) sigil.classList.remove('hidden');
        };
        avatar.src = src;
        avatar.alt = altText || cid;
        avatar.classList.remove('hidden');
        if (wrap) wrap.classList.remove('hidden');
        if (sigil) sigil.classList.add('hidden');
        return;
      }
    }
    avatar.onerror = null;
    avatar.dataset.fallbackTried = '';
    avatar.dataset.charId = '';
    avatar.removeAttribute('src');
    avatar.alt = '';
    avatar.classList.add('hidden');
    if (wrap) wrap.classList.add('hidden');
    if (sigil) sigil.classList.remove('hidden');
  }

  function refreshBadge() {
    if (typeof document !== 'undefined') {
      var btnAiNow = document.getElementById('btn-ai-drawer');
      if (btnAiNow) {
        btnAiNow.setAttribute('aria-label', '灵语');
        var lblNow = btnAiNow.querySelector('.chip-lbl');
        if (lblNow && lblNow.textContent !== '灵语') lblNow.textContent = '灵语';
      }
    }
    if (!drawerEl) return;
    var snap = collectLiveSnapshot();
    var st = (typeof S !== 'undefined' && S) ? S : root.S;
    var sel = drawerEl.querySelector('#aid-target');
    var prev = sel.value;
    sel.innerHTML = '';
    (snap.people || []).forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = isIdentityHidden(p.id, snap, st)
        ? maskedPersonLabel(p.id)
        : (p.name + (p.role ? ' · ' + p.role : ''));
      sel.appendChild(opt);
    });
    if (vignetteSession && vignetteSession.charId && Array.from(sel.options).some(function (o) { return o.value === vignetteSession.charId; })) {
      sel.value = vignetteSession.charId;
    } else if (Array.from(sel.options).some(function (o) { return o.value === prev; })) {
      sel.value = prev;
    }
    if (!sel.options.length) {
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '当前场景暂无可交谈人物';
      sel.appendChild(emptyOpt);
    }

    var cid = sel.value;
    var avatar = drawerEl.querySelector('#aid-avatar');
    var sigil = drawerEl.querySelector('#aid-sigil-badge');
    var gateTag = drawerEl.querySelector('#aid-gate-tag');
    var axisMini = drawerEl.querySelector('#aid-axis-mini');
    var hiddenId = !!(cid && isIdentityHidden(cid, snap, st));
    var matchedPerson = cid ? (snap.people || []).find(function (p) { return p.id === cid; }) : null;
    var avatarAlt = matchedPerson ? (matchedPerson.short || matchedPerson.name || cid) : (cid || '');

    updateDrawerAvatar(avatar, sigil, cid, hiddenId, lastEmotionByChar[cid] || 'normal', avatarAlt);

    if (hiddenId) {
      gateTag.textContent = '初生时分 · 声影朦胧';
    } else if (cid && root.AI_PERSONAS) {
      var gate = root.AI_PERSONAS.getTemporalGate(cid, snap, snap.causal);
      if (cid === 'aino' && gate.stageLabel === '赫兰冰封峡谷前线重逢期') {
        gateTag.textContent = '冰封峡谷 · 化名「渔」隐踪中';
      } else if (gate.isChenglanDisguise && (cid === 'lein' || cid === 'peilin')) {
        gateTag.textContent = '塞北商路 · 世人唯识「渔」';
      } else if (gate.isChenglanDisguise && cid === 'musa') {
        gateTag.textContent = '北风堡 · 世人唯识冰剑士「渔」';
      } else if (gate.isChenglanDisguise && (cid === 'jilan' || cid === 'ji' || cid === 'masha' || cid === 'kyle' || cid === 'mage_aurora')) {
        gateTag.textContent = '澄岚镇 · 世人唯识「渔」';
      } else {
        gateTag.textContent = snap.player.age + '岁 · ' + (snap.location || '当前场景');
      }
    } else {
      gateTag.textContent = snap.playing ? (snap.location + ' · 等待角色登场') : '请先进入游戏场景';
    }

    if (hiddenId) {
      axisMini.innerHTML = '<span class="aid-axis-hint">✧ 声线尚浅 · 身份未明</span>';
    } else if (cid && root.BranchingDirector) {
      var summary = root.BranchingDirector.getAxisSummary(cid);
      if (summary) {
        axisMini.innerHTML = '<span>' + summary.leftLabel + ' <b>' + summary.leftVal + '</b></span>' +
          '<i class="aid-mini-bar"><b style="left:' + summary.ratio + '%"></b></i>' +
          '<span><b>' + summary.rightVal + '</b> ' + summary.rightLabel + '</span>';
      } else {
        axisMini.innerHTML = '<span class="aid-axis-hint">✧ 心意灵犀已通</span>';
      }
    } else {
      axisMini.innerHTML = '';
    }

    var bannerEl = drawerEl.querySelector('#aid-vignette-banner');
    if (bannerEl) bannerEl.classList.toggle('hidden', !vignetteSession);

    drawerEl.querySelector('#aid-send').disabled = busy || !snap.playing || !cid;
    sel.disabled = busy || !snap.people.length || !!vignetteSession;
    drawerEl.querySelector('#aid-input').disabled = busy;
    drawerEl.querySelector('#aid-cancel').classList.toggle('hidden', !busy);
  }

  /**
   * 计算某角色在传入 causal 快照中的主导关系轴与最新匹配回声
   */
  function resolveCausalContextForChar(charId, causal) {
    var c = causal || null;
    var dominant = 'balanced';
    if (c && c.axes && c.axes[charId]) {
      var ax = c.axes[charId];
      var keys = Object.keys(ax);
      if (keys.length >= 2) {
        var v1 = Number(ax[keys[0]] || 0);
        var v2 = Number(ax[keys[1]] || 0);
        if (v1 > v2) dominant = keys[0];
        else if (v2 > v1) dominant = keys[1];
      }
    }
    var latestEcho = '';
    if (c && Array.isArray(c.echoes)) {
      var hit = c.echoes.find(function (e) { return e && e.charId === charId && e.quote; });
      if (hit) latestEcho = String(hit.quote).trim();
    }
    return { dominant: dominant, latestEcho: latestEcho };
  }

  /**
   * 生成贴合当前地点、阶段锁与 S.causal 命运暗流的活态主动开场白卡片（绝不泄漏隐藏身份）
   */
  function buildProactiveOpening(charId, snap, causal) {
    var liveSnap = snap || collectLiveSnapshot();
    var stObj = (typeof S !== 'undefined' && S) ? S : root.S;
    var maskState = (snap && snap.flags)
      ? { flags: snap.flags, ageY: (snap.player && snap.player.age) || 0, know: (stObj && stObj.know) || {} }
      : stObj;
    var hidden = isIdentityHidden(charId, liveSnap, maskState);
    var causalObj = causal || (liveSnap && liveSnap.causal) || (stObj && stObj.causal) || null;

    if (hidden) {
      var isSophiaVoice = charId === 'sophia';
      var isClaudeVoice = charId === 'claude';
      return {
        hidden: true,
        speaker: maskedPersonShort(charId),
        stageLabel: '初生盲听 · 尚未识名',
        emotion: 'normal',
        action: isSophiaVoice
          ? '柔和的脚步声在摇篮旁停住，一只温热的手轻轻拢住了你露在襁褓外的指尖。'
          : isClaudeVoice
            ? '沉稳的脚步放得很轻，一道高大身影在摇篮边微微俯身，呼吸克制而温和。'
            : '光影晃动了一下，一道尚未辨明来历的声音在近处轻声响起。',
        greeting: isSophiaVoice
          ? '醒了呀，小家伙？睁着眼睛四处瞧什么呢，乖，这里很暖和。'
          : isClaudeVoice
            ? '……嗯，醒过来了。眼睛倒亮得很，先安静待着吧。'
            : '……醒过来了吗？先慢慢看看四周吧。',
        echoQuote: '',
        starters: [
          '眨眨眼睛，顺着声音的方向望过去',
          '轻轻动了动手指，发出一声细微的咿呀',
          '安安静静盯着半空中晃动的光斑'
        ]
      };
    }

    var Personas = root.AI_PERSONAS;
    var personMeta = (liveSnap.people || []).find(function (p) { return p.id === charId; }) || null;
    var gate = Personas ? Personas.getTemporalGate(charId, liveSnap, causalObj) : null;
    var stageLabel = (gate && gate.stageLabel) || '当前阶段';
    var persona = Personas ? Personas.getPersona(charId, personMeta) : null;
    var speaker = (personMeta && personMeta.short) || (persona && persona.short) || charId || '在场人物';
    var loc = String((liveSnap && liveSnap.location) || '');
    var ageY = (liveSnap && liveSnap.player && typeof liveSnap.player.age === 'number') ? liveSnap.player.age : 12;
    var cc = resolveCausalContextForChar(charId, causalObj);
    var dom = cc.dominant;
    var echoQuote = cc.latestEcho;

    var out = {
      hidden: false,
      speaker: speaker,
      stageLabel: stageLabel,
      emotion: 'normal',
      action: speaker + '在' + (loc || '原地') + '停下脚步，抬眼朝你望了过来。',
      greeting: '正好碰上了，有什么想聊的吗？',
      echoQuote: '',
      starters: [
        '打个招呼，聊聊眼下这边的情况',
        '顺口问问对方刚才在忙些什么'
      ]
    };

    if (charId === 'charlotte') {
      var isEarly = stageLabel.indexOf('初') !== -1;
      var inMemorial = loc.indexOf('纪念林') !== -1;
      out.emotion = dom === 'candor' ? 'shy' : 'normal';
      if (isEarly) {
        out.action = '夏洛特咔哒合拢蓝宝石折扇，下巴微微抬高，目光落在你身上时耳根悄然泛起一层薄红。';
        out.greeting = '哼，本小姐才没有特地等你……路过罢了，维斯特利亚。期中考核的账我可还没算完呢。';
        out.starters = [
          '「期末实战考核，贝尔蒙小姐打算怎么赢回来？」',
          '「刚才在书架拐角小声嘀咕什么呢？」',
          '「折扇收这么紧，风都扇不到自己了吧。」'
        ];
      } else if (inMemorial || dom === 'candor') {
        out.action = '夏洛特换了身素净的深灰旧外套，折扇在掌心轻叩一下，视线故意往旁边树冠移了半寸。';
        out.greeting = '哼，本小姐才没有特地等你……只是顺路来瞧瞧纪念林这边有没有被你浇水漫过树根。' +
          (echoQuote ? '……那句「' + echoQuote + '」，我可还记得清清楚楚。' : '');
        out.echoQuote = echoQuote;
        out.starters = [
          '「两棵树中间那道排水浅沟，是你顺手挖的吧？」',
          '「最近城郊调防和关口盘查，贝尔蒙家那边有风声吗？」',
          '「风有点凉，要不要去喝杯热的薄荷茶？」'
        ];
      } else {
        out.action = '夏洛特扬起下巴拢住折扇，眉眼间带着一丝寸步不让的锋芒，在廊下停住脚步。';
        out.greeting = '哼，本小姐才没有特地等你。维斯特利亚，可别在榜单上松懈了，赢过你的人只能是我。';
        out.echoQuote = echoQuote;
        out.starters = [
          '「那下一次实战考核，就全力比一场吧。」',
          '「王都近来不太平，你家里一切还稳妥吗？」',
          '「你每次说顺路，好像总刚好撞见我。」'
        ];
      }
    } else if (charId === 'aino') {
      var isFront = stageLabel === '赫兰冰封峡谷前线重逢期' || loc.indexOf('冰封峡谷') !== -1;
      var isDay1 = stageLabel === '课堂初遇挑刺期';
      var isSpar = stageLabel === '周六陪练与花坊期';
      if (isFront) {
        out.emotion = 'normal';
        out.action = '艾诺披着灰狼毛领深蓝冬衣从东侧冰墙走下，自然挡住峡谷风口卷来的碎雪，右手食指悬在温热的麦汤碗上方压平烫气。';
        out.greeting = '风口雪势紧了。三号药箱左下角那道冰膜略薄了一丝，待会儿顺手补匀。热麦汤先喝，凉一点刚好，魔剑士。';
        out.echoQuote = echoQuote;
        out.starters = [
          '「药箱里的白苔和止血青藓温度还稳着，放心。」',
          '「东侧冰墙外的冻土魔物，今夜动静大吗？」',
          '「多谢替我压凉热汤，风口这边交给我守一班吧。」'
        ];
      } else if (isDay1) {
        out.emotion = 'normal';
        out.action = '艾诺靠窗单手托腮，目光从窗外麻雀身上收回来，垂眸淡淡扫了一眼你桌上的冰球。';
        out.greeting = '……气泡还在。凝冰慢半拍，在赫兰会送命。有事直说。';
        out.starters = [
          '「请教一下，无手凝冰怎么才能彻底排空气泡？」',
          '「赫兰那边的冬天，比阿斯拉冷很多吗？」',
          '「刚才看窗外的麻雀，它在这儿待很久了。」'
        ];
      } else if (isSpar || loc.indexOf('花坊') !== -1) {
        out.emotion = 'shy';
        out.action = '艾诺把小喷壶迅速往花架后收了半寸，耳尖掠过极浅的红，顺手捻掉银白发梢沾到的一点真雪花。';
        out.greeting = '……只是路过花坊。北极铃兰怕热，别把暖风带进来。' + (dom === 'kinship' ? '周六对练完，咖喱别放太多胡椒。' : '周六训练场，别迟到。');
        out.echoQuote = echoQuote;
        out.starters = [
          '「这盆北极铃兰的恒温冰膜，教我怎么控薄吧。」',
          '「阿琼今天煮了不辣的奶香咖喱，要不要一起尝尝？」',
          '「周六的实战对练，我想试着提快半拍。」'
        ];
      } else {
        out.emotion = dom === 'kinship' ? 'smile' : 'serious';
        out.action = '艾诺指尖轻触冰系教室石窗台上的薄冰层，银白发尾在午后微光里安静垂落。';
        out.greeting = dom === 'kinship'
          ? '……还行，窗台这层冰膜稳得很。赫兰深冬的湖冰也是这种淡淡的蓝。' + (echoQuote ? '你之前说过的「' + echoQuote + '」，我记下了。' : '')
          : '左下角还薄一丝。下次交手之前，把这处习惯改利落了。';
        out.echoQuote = echoQuote;
        out.starters = [
          '「霍尔老师清晨来铺冻土白霜的事，你也早知道了吧？」',
          '「回赫兰之后，那边下大雪记得捎封信过来。」',
          '「趁离开前，再认真切磋最后一局吧。」'
        ];
      }
    } else if (charId === 'alice') {
      if (stageLabel === '风神亲传凛冬历练期') {
        out.emotion = 'serious';
        out.action = '爱丽丝立在松林风口边，指尖平静地摩挲右腕磨得发亮的白色碎贝壳手绳，迎着高处气流抬起清亮的蓝眸。';
        out.greeting = dom === 'obsession'
          ? '……风从北边吹过来了。手绳系得很紧，日记也收好了。无论隔着几道风雪，姐姐大人，我一定会走到你身边。'
          : '……北风的压强变稳了。师父教的大风步子我已经跟得上，姐姐大人，等我们在风暴眼之上重逢吧。';
        out.echoQuote = echoQuote;
        out.starters = [
          '「风神前辈的凛冬历练，最近辛苦吗？」',
          '「右腕的碎贝壳手绳还牢靠吗？」',
          '「北边风声捎去了我的平安，照着自己的步子往前走。」'
        ];
      } else if (stageLabel.indexOf('幼童') !== -1) {
        out.emotion = 'shy';
        out.action = '爱丽丝抱着比自己半身还宽的绘本走到椅边，小手在裙摆侧面攥了攥，又轻轻扯住你的袖角。';
        out.greeting = '……姐姐大人。这里的光暖暖的，可以陪我一起看这页画吗？';
        out.starters = [
          '「好呀，坐到姐姐旁边来，我念给你听。」',
          '「爱丽丝最喜欢这一页上的哪只小鸟？」',
          '「发呆晒会儿太阳也很舒服哦。」'
        ];
      } else if (stageLabel.indexOf('少年风感期') !== -1) {
        out.emotion = 'normal';
        out.action = '爱丽丝安静坐在树影边，手指在裙侧轻轻收拢又松开，指尖试着托起一片晃悠飘落的树叶。';
        out.greeting = dom === 'independence'
          ? '……姐姐大人。按照你说的“顺着引导风”，树叶这次落得很稳。'
          : '……姐姐大人。午后树荫下很安静，我想离你坐近一点。';
        out.echoQuote = echoQuote;
        out.starters = [
          '「闭上眼睛听听，今天风从哪边院墙吹过来的？」',
          '「小本子里又夹进新落叶了吗？」',
          '「坐累了的话，咱们去花园里吹会儿风吧。」'
        ];
      } else {
        out.emotion = 'shy';
        out.action = '爱丽丝抱着上锁的小笔记本走近几步，临近前又立刻稳住恒定步速，指尖轻碰了一下右腕的碎贝壳手绳。';
        out.greeting = dom === 'independence'
          ? '……姐姐大人。风系课的压强推导我独立完成了。' + (echoQuote ? '一直记着「' + echoQuote + '」。' : '下午一起去图书馆吗？')
          : '……姐姐大人。你的外套领口有一点卷边，我帮你理好。' + (echoQuote ? '「' + echoQuote + '」……我每天都记着。' : '');
        out.echoQuote = echoQuote;
        out.starters = [
          '「学院风系课还习惯吗？有听不懂的地方随时问我。」',
          '「听说你最近在借赫兰语辞典？」',
          '「下午没课，要不要一起去食堂买块甜点？」'
        ];
      }
    } else if (charId === 'beatrice') {
      var beaChild = stageLabel.indexOf('童年') !== -1;
      out.emotion = 'normal';
      if (beaChild) {
        out.action = '贝阿特丽丝把木剑往肩头一扛，双手叉腰扬起下巴，金发在阳光下晃得像一团小太阳。';
        out.greeting = '希尔维亚！别总坐在树下发呆啦！贝阿特丽丝大人今天的控火练习可有大突破，快跟我去练武场验收！';
        out.starters = [
          '「姐姐手上的红印，刚才练火焰兔子又急了吧？」',
          '「去练武场之前，要不要先绕路去厨房拿松饼？」',
          '「那我认真看着，贝阿特丽丝大人可要露一手哦。」'
        ];
      } else {
        out.action = '贝阿特丽丝风风火火跑过来刹住脚，嘴里还叼着差点咬出牙印的笔帽，一眼见着你立刻笑开。';
        out.greeting = stageLabel.indexOf('论文') !== -1
          ? '呼——边贸外交论文改得头都要冒火啦！希尔维亚快救救姐姐，陪我去食堂吃口甜的换换脑子！'
          : '希尔维亚！水系课没被谁找茬吧？有事尽管报贝阿特丽丝大人的名字，我替你撑腰！';
        out.starters = [
          '「论文里关于边境商贸的条款，写到哪一段卡住了？」',
          '「姐姐放心，我在水系班和冰系班都过得很稳当。」',
          '「今天食堂有焦糖布丁，我请姐姐吃一份吧。」'
        ];
      }
    } else if (charId === 'noelle') {
      var noelleEarly = stageLabel === '新生初识防备期';
      out.emotion = noelleEarly ? 'normal' : (dom === 'partnership' ? 'smile' : 'serious');
      if (noelleEarly) {
        out.action = '诺艾儿把厚如砖头的魔导书抱在胸前，挽起的袖口露出一截利落手腕，投来冷静审视的一瞥。';
        out.greeting = '刚才你的控水很稳，不过实战变招还少了一步。有学术问题可以直接问，客套就免了。';
        out.starters = [
          '「水幕术式怎么压缩魔力消耗，可以请教你吗？」',
          '「你每次都挑食堂最便宜的两样菜，吃得够不够？」',
          '「这本理论书的第三章推导，我有点拿不准。」'
        ];
      } else {
        out.action = loc.indexOf('钟塔') !== -1
          ? '诺艾儿在钟塔风口边僵硬地伸着手，刚摸过蹭腿的流浪橘猫，见你过来下意识抬起左手背扫了眼密密麻麻的日程表。'
          : '诺艾儿抬手瞥了一眼左手背用墨水写满的日程表，把厚重的《公式推导》合上抱紧。';
        out.greeting = dom === 'partnership'
          ? '……希尔维亚。今天下午两点到三点空出来了，水盾省魔改良式你要一起核对吗？' + (echoQuote ? '上次那句「' + echoQuote + '」挺有道理。' : '')
          : '……正好。上次借你的参考书笔记我已经整理完双份了，人情算清，别再多客气。';
        out.echoQuote = echoQuote;
        out.starters = [
          '「左手背上今天的日程表，有把吃饭时间写进去吗？」',
          '「钟塔那只橘猫，今天让你多摸两下了吧？」',
          '「一起把水盾省魔回路重新算一遍吧。」'
        ];
      }
    } else if (charId === 'helena') {
      out.emotion = 'happy';
      out.action = '海伦娜提起差点踩到的白色神官袍下摆稳稳站定，绿眸弯成暖融融的月牙，手里攥着一张画着小星星的折纸。';
      out.greeting = '希尔维亚！正好在这儿遇到你啦！神殿今天的早课刚结束，午后阳光这么好，要不要一起坐着聊会儿天呀？';
      out.echoQuote = echoQuote;
      out.starters = [
        '「小心长袍下摆哦，今天神殿里的功课闷不闷？」',
        '「纸条末尾这次又多画了几颗小星星？」',
        '「听说最近边境驿站盘查严了，神殿那边有消息吗？」'
      ];
    } else if (charId === 'emma') {
      out.emotion = 'happy';
      out.action = '艾玛反手合上门板，瞬间卸下走廊里端庄淑女的微笑面具，揉着发酸的腮帮子长长舒了口气。';
      out.greeting = '天哪希尔维亚，快救命！刚才在走廊端着标准礼仪笑了整整一刻钟！快跟我说今天食堂还有焦糖布丁剩着！';
      out.starters = [
        '「走吧，趁午休前去食堂抢最后两份提拉米苏。」',
        '「你那套一秒切换贵族淑女腔的绝活，到底怎么练的？」',
        '「昨天夜里说梦话又在编排新戏剧了吧？」'
      ];
    } else if (charId === 'ajun') {
      out.emotion = 'happy';
      out.action = '阿琼系着粉红碎花围裙拿木勺颠了颠铁锅，满屋顿时飘起滚烫浓郁的香料香气，他兴奋地拍拍胸口的小本子。';
      out.greeting = '希尔维亚！来得太巧啦！这锅改良版不辣奶香咖喱火候刚刚好！对了，我刚在后厨听采购师傅聊了不少学院冬宴的新鲜事，快坐下边喝红叶茶边听！';
      out.starters = [
        '「香味都飘出厨房门了，今天放了什么新香料？」',
        '「后厨和你的小本子上，最近又记了什么宴会见闻？」',
        '「外头风冷，谢谢你的红叶茶，今天没又迷路吧？」'
      ];
    } else if (charId === 'hol') {
      var holRevealed = stageLabel.indexOf('揭晓') !== -1;
      out.emotion = 'normal';
      out.action = '霍尔懒洋洋往椅背上一靠，一根手指夹在《赫兰雪地温泉一百选》书页里，慢吞吞掀了下眼皮。';
      out.greeting = holRevealed
        ? '石窗台那边根底的霜我清早试过了，左下角记得补匀。没事就自己琢磨，别吵我翻书。'
        : '哟，来挺早。冰球别再砸坏窗户就行，有啥问题简短说，快到下课点了。';
      out.starters = holRevealed
        ? [
            '「老师，这盆北极铃兰的冰膜厚度今天够稳吗？」',
            '「赫兰那边真的有书里写得那么好的雪地温泉吗？」',
            '「冰系无手瞬发还有什么实战诀窍？」'
          ]
        : [
            '「老师，这本《赫兰美食指南》里哪道菜最推荐？」',
            '「无手凝冰怎么把魔力损耗压到最低？」',
            '「那我安静在窗边自己练习，不打扰您看书。」'
          ];
    } else if (charId === 'jilan') {
      out.emotion = 'happy';
      out.action = '霁岚把竹剑往砂地上一杵，黑发高马尾上的亮紫蝴蝶跟着一翘，顺手撸起练功短衫袖口冲你挥手。';
      out.greeting = dom === 'wanderlust'
        ? '渔！刚练完这轮生根步吧？北边风雪听着就带劲，等我剑法再深一层，肯定也要走出澄岚去见识见识！'
        : '渔！快歇会儿，院里的热粥我给你温在锅边了！今天东街那帮人又吹花架子，真该让他们见识见识我爸的慢功夫！';
      out.echoQuote = echoQuote;
      out.starters = [
        '「今天晚饭是你热饼子，还是霁叔下厨炒“火焰鼠尾”？」',
        '「院角那棵修剪得极整齐的老树，听说是霁叔一直照看的？」',
        '「再来砂地上走几合竹剑吧，我正好活动活动手腕。」'
      ];
    } else if (charId === 'ji') {
      out.emotion = 'smile';
      out.action = '老霁端着一盘红彤彤的细丝笑眯眯走回廊下，眼角笑纹深如年轮，顺手朝院心砂地抬了抬下巴。';
      out.greeting = '哟，渔丫头，吃了没？刚出锅一盘“爆炒火焰鼠尾”——虽说其实是胡萝卜。吃完歇半晌，再把那套走路与挥剑的「不想」功夫练顺溜咯。';
      out.echoQuote = echoQuote;
      out.starters = [
        '「霁叔，这盘“爆炒火焰鼠尾”听起来霁岚又要举勺子追您了。」',
        '「刚才练生根步，感觉手腕还是差一点没彻底松开。」',
        '「院里的粥香得很，今天清汤面和杂粮粥都没糊吧？」'
      ];
    } else if (charId === 'lein') {
      out.emotion = 'happy';
      out.action = '莱恩坐在驿站矮墙上，手指不低头看草茎便熟练折出一只小巧的草叶船，顺手从大行囊里摸出旧皮水囊递过来。';
      out.greeting = '渔，要喝水吗？早上刚接的井水。前面过了镇子就是往苏秦去的商路了——咳，有什么不懂尽管问，我莱恩好歹走了两年商路了！';
      out.starters = [
        '「谢谢水囊。你手上这只草叶船折得真快。」',
        '「沛霖师父又钻进镇上的茶馆喝苦茶去了？」',
        '「你刚说的苏秦路边摊酸辣霜粉，真比店里的好吃？」'
      ];
    } else if (charId === 'peilin') {
      out.emotion = 'smile';
      out.action = '沛霖穿着齐整的灰蓝长衫坐在茶馆靠窗木桌旁，慢悠悠斟满两杯色泽极淡的苦茶，推了一杯过来。';
      out.greeting = '哟，渔。坐下喝口珞叶青吧，不好喝，走长路提神。前头驿站的房钱我已经跟掌柜谈平了，你那份算莱恩的学徒补贴里了。';
      out.starters = [
        '「多谢沛霖先生，这茶苦归苦，回甘倒挺清神。」',
        '「前面岑水关的两道边境盘查，最近查得严吗？」',
        '「莱恩要是知道又多了学徒补贴，怕是又要找您抗议了。」'
      ];
    } else if (charId === 'musa') {
      out.emotion = 'smile';
      out.action = '穆萨拍净旧羊皮袄上的硬雪粒，细心摸过尾车药箱的油布封条，从棉袖里掏出半张带孜然香的圆馕递过来。';
      out.greeting = '渔姑娘，手冷了吧？先垫口干粮！这几箱白苔和止血青藓全靠你那层无气泡恒温冰膜保鲜，一片叶子都没冻裂，真是帮了前线大忙！';
      out.starters = [
        '「我再去检查一遍药箱四角的冰膜，免得颠簸裂缝。」',
        '「老人家，怀里的黄铜手炉怎么连半块炭也没点？」',
        '「冰封峡谷伤兵营那边，最急缺的是止血青藓还是白藓膏？」'
      ];
    } else if (charId === 'sophia') {
      out.emotion = 'smile';
      out.action = '索菲亚放下手边书卷，微笑着伸手将你额前一缕银灰碎发轻轻拨到耳后，眉眼温柔如午后红茶。';
      out.greeting = ageY < 12
        ? '希尔维亚，今天在花园晒够太阳了吗？厨房刚温好牛奶和茶点，过来陪妈妈坐一会儿吧。'
        : '慢慢按自己的步调走就好，家里从不急着催你。红茶刚沏好，在学院过得还舒心吗？';
      out.starters = ageY < 12
        ? [
            '「母亲，花园那棵银杏树下今天风很舒服。」',
            '「父亲该不会又在书房偷偷夹带公文看啦？」',
            '「陪母亲在壁炉边多坐一会儿吧。」'
          ]
        : [
            '「母亲放心，学院的室友和同学都很好相处。」',
            '「您发间这根霜杉木簪，父亲看着总要笑呢。」',
            '「有空我想帮家里多整理几本藏书。」'
          ];
    } else if (charId === 'claude') {
      out.emotion = 'normal';
      out.action = '克劳德将背在身后的双手微微放缓，目光落在你身上时温和了几分，轻咳一声端起桌上的温茶。';
      out.greeting = ageY < 12
        ? '希尔维亚。在图书室待久了记得出来活动，傍晚起风，多披一件外衣。'
        : '回来了。学业固然要紧，也别熬坏了身子，缺什么书或盘缠直接写信回府里。';
      out.starters = ageY < 12
        ? [
            '「父亲，书房的灯昨晚又亮到很晚，注意歇息。」',
            '「姐姐今天在练武场很认真，就是又烤焦了一小撮草。」',
            '「我想再去图书室借两本水系基础图谱。」'
          ]
        : [
            '「父亲，最近王都外务和边贸那边还稳妥吗？」',
            '「姐姐的毕业论文写得热火朝天，我帮她校过几页。」',
            '「您别又背着母亲在度假箱子里塞公文哦。」'
          ];
    } else if (charId === 'reno') {
      out.emotion = 'smile';
      out.action = '雷纳德斜靠着门框晃了晃肩头那只磨旧的皮旅行包，从衣兜里摸出一枚亮晶晶的怪石朝你眨了眨眼。';
      out.greeting = '哟，咱们最爱发呆的小希尔维亚！叔叔刚从北边风雪堆里钻回来，想听岩鼠偷干粮的段子，还是想问实战施法的门道？';
      out.starters = [
        '「叔叔这次去北境，路上关口太平吗？」',
        '「听说您年轻时还欠过法神大人一笔旧账？」',
        '「没有天赋亲和也能练这么多系魔法，有什么诀窍吗？」'
      ];
    } else if (charId === 'anna') {
      out.emotion = 'smile';
      out.action = '安娜合上水系教案，指尖轻抬在讲台边托起一缕澄澈起伏的透明水环，眉眼弯弯望过来。';
      out.greeting = '希尔维亚同学，课后还留在这里练习控水呀？水之帷幕或者移动施法有哪里拿不准，尽管问我哦。';
      out.starters = [
        '「安娜老师，移动中怎么让水之帷幕边缘不散开？」',
        '「水系魔法在实战里怎么兼顾卸力和反击？」',
        '「谢谢老师，我再把水球压缩练习稳固几遍。」'
      ];
    }

    return out;
  }

  function renderTranscript() {
    if (!drawerEl) return;
    var log = drawerEl.querySelector('#aid-log');
    log.innerHTML = '';
    var snap = collectLiveSnapshot();
    var cid = drawerEl.querySelector('#aid-target').value;
    var convs = loadConversations();
    var turns = convs[convKeyFor(snap, cid)] || [];

    if (!turns.length) {
      if (!cid) {
        var emptyHint = document.createElement('div');
        emptyHint.className = 'aid-empty';
        emptyHint.textContent = '当场景中有其他角色登场时，可在此展开自由对话。';
        log.appendChild(emptyHint);
        return;
      }

      var opening = buildProactiveOpening(cid, snap, snap.causal);
      var card = document.createElement('div');
      card.className = 'aid-proactive-greeting';
      card.setAttribute('data-char', cid);

      var pgHead = document.createElement('div');
      pgHead.className = 'aid-pg-head';
      var pgLeft = document.createElement('div');
      pgLeft.className = 'aid-pg-left';
      var pgName = document.createElement('strong');
      pgName.textContent = opening.speaker;
      pgLeft.appendChild(pgName);
      var pgStage = document.createElement('span');
      pgStage.className = 'aid-pg-stage';
      pgStage.textContent = opening.stageLabel;
      pgLeft.appendChild(pgStage);
      pgHead.appendChild(pgLeft);

      if (opening.emotion) {
        var pgEmo = document.createElement('span');
        pgEmo.className = 'aid-emo-tag';
        pgEmo.textContent = EMO_LABELS[opening.emotion] || opening.emotion;
        pgHead.appendChild(pgEmo);
      }
      card.appendChild(pgHead);

      if (opening.action) {
        var pgAct = document.createElement('p');
        pgAct.className = 'aid-turn-action';
        pgAct.textContent = opening.action;
        card.appendChild(pgAct);
      }

      var pgBody = document.createElement('p');
      pgBody.className = 'aid-turn-reply';
      pgBody.textContent = opening.greeting;
      card.appendChild(pgBody);

      if (opening.echoQuote) {
        var pgEcho = document.createElement('div');
        pgEcho.className = 'aid-pg-echo';
        pgEcho.textContent = '✦ 往昔回声共鸣：「' + opening.echoQuote + '」';
        card.appendChild(pgEcho);
      }

      if (Array.isArray(opening.starters) && opening.starters.length) {
        var starterWrap = document.createElement('div');
        starterWrap.className = 'aid-pg-starters';
        opening.starters.slice(0, 3).forEach(function (starterText) {
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'aid-starter-chip';
          chip.textContent = starterText;
          chip.onclick = function () {
            if (busy || !drawerEl) return;
            var inp = drawerEl.querySelector('#aid-input');
            if (!inp) return;
            inp.value = starterText.replace(/^「|」$/g, '');
            handleSend();
          };
          starterWrap.appendChild(chip);
        });
        card.appendChild(starterWrap);
      }

      var pgTip = document.createElement('div');
      pgTip.className = 'aid-pg-tip';
      pgTip.textContent = '✦ 点选上方话头直接搭话，或在下方自由输入；角色神态与命运暗流将实时响应';
      card.appendChild(pgTip);

      log.appendChild(card);
      return;
    }

    turns.forEach(function (t) {
      var item = document.createElement('div');
      item.className = 'aid-turn ' + (t.role === 'user' ? 'is-user' : 'is-ai');

      var head = document.createElement('div');
      head.className = 'aid-turn-head';
      var speakerStrong = document.createElement('strong');
      var stObj = (typeof S !== 'undefined' && S) ? S : root.S;
      var aiLabel = (cid && isIdentityHidden(cid, snap, stObj)) ? maskedPersonShort(cid) : (t.name || '角色');
      speakerStrong.textContent = t.role === 'user' ? (snap.player.name || '希尔维亚') : aiLabel;
      head.appendChild(speakerStrong);

      if (t.structured && t.structured.emotion) {
        var emoBadge = document.createElement('span');
        emoBadge.className = 'aid-emo-tag';
        emoBadge.textContent = EMO_LABELS[t.structured.emotion] || t.structured.emotion;
        head.appendChild(emoBadge);
      }
      item.appendChild(head);

      if (t.structured && t.structured.action) {
        var actP = document.createElement('p');
        actP.className = 'aid-turn-action';
        actP.textContent = t.structured.action;
        item.appendChild(actP);
      }

      var bodyP = document.createElement('p');
      bodyP.className = 'aid-turn-reply';
      bodyP.textContent = t.structured ? t.structured.reply : t.content;
      item.appendChild(bodyP);

      if (t.causalNote) {
        var cNote = document.createElement('div');
        cNote.className = 'aid-turn-causal';
        cNote.textContent = t.causalNote;
        item.appendChild(cNote);
      }

      log.appendChild(item);
    });
    log.scrollTop = log.scrollHeight;
  }

  async function handleSend() {
    if (busy || !drawerEl) return;
    var inputEl = drawerEl.querySelector('#aid-input');
    var text = inputEl.value.trim();
    if (!text) return;

    var snap = collectLiveSnapshot();
    var cid = drawerEl.querySelector('#aid-target').value;
    if (!cid) return;

    var cfg = loadConfig();
    if (cfg.mode === 'direct' && !cfg.apiKey) {
      var cfgBox = drawerEl.querySelector('#aid-cfg-box');
      var disclosure = drawerEl.querySelector('#aid-dev-disclosure');
      if (cfgBox) cfgBox.classList.remove('hidden');
      if (disclosure) disclosure.open = true;
      updateCfgSummary();
      setStatus('尚未填入共鸣凭证，请在「共鸣设置」中填写或切回内置灵语共鸣。');
      return;
    }

    busy = true;
    var reqAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    activeAbort = reqAbort;
    refreshBadge();
    setStatus('角色正在思索与回应……');

    try {
      var cKey = convKeyFor(snap, cid);
      var convs = loadConversations();
      var prevTurns = Array.isArray(convs[cKey]) ? convs[cKey] : [];
      var structured = await requestStructuredDialogue({
        snapshot: snap,
        characterId: cid,
        history: prevTurns,
        text: text,
        config: cfg,
        signal: reqAbort ? reqAbort.signal : undefined
      });
      if (reqAbort && reqAbort.signal && reqAbort.signal.aborted) {
        var abortErr = new Error('aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      var person = (snap.people || []).find(function (p) { return p.id === cid; }) || { name: cid };
      var outcomeRes = root.BranchingDirector
        ? root.BranchingDirector.applyAIOutcome(cid, structured)
        : { emotion: structured.emotion };

      if (vignetteSession && vignetteSession.charId === cid) {
        vignetteSession.lastOutcome = mergeSessionOutcome(vignetteSession.lastOutcome, outcomeRes);
      }
      if (pendingVignetteContext && pendingVignetteContext.charId === cid) {
        pendingVignetteContext.lastOutcome = mergeSessionOutcome(pendingVignetteContext.lastOutcome, outcomeRes);
      }

      var stNow = (typeof S !== 'undefined' && S) ? S : root.S;
      var hiddenNow = !!(cid && isIdentityHidden(cid, snap, stNow));
      lastEmotionByChar[cid] = structured.emotion || 'normal';

      // 更新抽屉头像为最新表情（防剧透盲听期保持隐藏，并附带安全回退）
      var avatar = drawerEl.querySelector('#aid-avatar');
      var sigil = drawerEl.querySelector('#aid-sigil-badge');
      updateDrawerAvatar(avatar, sigil, cid, hiddenNow, lastEmotionByChar[cid], person.short || person.name || cid);

      var notes = [];
      if (outcomeRes && outcomeRes.axisChanged && structured.causal_deltas && structured.causal_deltas.axis !== 'none') {
        notes.push('✦ 命运倾向变动：' + structured.causal_deltas.axis + ' +' + structured.causal_deltas.delta);
      }
      if (outcomeRes && outcomeRes.clueUnlocked) {
        notes.push('✦ 点亮关键暗线拼图');
      }
      if (outcomeRes && outcomeRes.echoSaved) {
        notes.push('✦ 往昔回声已铭刻');
      }

      var saveName = hiddenNow ? maskedPersonShort(cid) : (person.short || person.name);

      convs[cKey] = prevTurns.concat([
        { role: 'user', content: text },
        {
          role: 'assistant',
          name: saveName,
          content: (structured.action ? structured.action + ' ' : '') + structured.reply,
          structured: structured,
          causalNote: notes.join(' · ')
        }
      ]).slice(-24);
      saveConversations(convs);

      inputEl.value = '';
      renderTranscript();
      setStatus('已回应 · 舞台神态已切至「' + (EMO_LABELS[structured.emotion] || structured.emotion) + '」');
    } catch (err) {
      if (err && err.name === 'AbortError') {
        setStatus('已取消发送 · 输入文字已保留');
      } else {
        setStatus((err && err.message) ? err.message : '灵语回音未能接通，请稍后再试或检查共鸣设置。输入已保留。');
      }
    } finally {
      if (activeAbort === reqAbort) {
        busy = false;
        activeAbort = null;
      }
      refreshBadge();
    }
  }

  function openDrawer(preferCharId) {
    ensureHUDButtons();
    var el = ensureDrawerDOM();
    if (!el) return;
    el.classList.remove('hidden');
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('ai-drawer-open', true);
    }
    syncDrawerViewport();
    refreshBadge();
    if (preferCharId) {
      var sel = el.querySelector('#aid-target');
      if (Array.from(sel.options).some(function (o) { return o.value === preferCharId; })) {
        sel.value = preferCharId;
        refreshBadge();
      }
    }
    renderTranscript();
  }

  function closeDrawer(opts) {
    var options = opts || {};
    if (options.wipePending && activeAbort) {
      try { activeAbort.abort(); } catch (e) {}
    }
    clearVignetteLock(!!options.wipePending);
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('ai-drawer-open', false);
    }
    if (!drawerEl) return;
    drawerEl.classList.add('hidden');
    drawerEl.style.height = '';
    drawerEl.style.top = '';
    refreshBadge();
  }

  function toggleDrawer() {
    var el = ensureDrawerDOM();
    if (!el) return;
    if (el.classList.contains('hidden')) openDrawer();
    else closeDrawer();
  }

  /**
   * 供小场景「灵魂交谈」分支调用：打开抽屉并绑定收束剧情按钮
   */
  function openForVignette(opts) {
    var curSc = currentSceneId();
    var sessObj = {
      vignetteId: opts.vignetteId,
      charId: opts.charId,
      hint: opts.hint || '',
      onComplete: opts.onComplete,
      lastOutcome: null,
      sceneAtStart: curSc
    };
    vignetteSession = sessObj;
    pendingVignetteContext = sessObj;
    openDrawer(opts.charId);
    if (drawerEl) {
      var banner = drawerEl.querySelector('#aid-vignette-banner');
      var txt = drawerEl.querySelector('#aid-vignette-text');
      txt.textContent = '此刻正可畅所欲言：多聊几句后，点击下方即可续写后事';
      banner.classList.remove('hidden');
      drawerEl.querySelector('#aid-input').focus();
    }
  }

  function init() {
    ensureHUDButtons();
    ensureDrawerDOM();
  }

  var API = {
    init: init,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    toggleDrawer: toggleDrawer,
    openForVignette: openForVignette,
    finishActiveVignette: finishActiveVignette,
    clearVignetteLock: clearVignetteLock,
    refreshBadge: refreshBadge,
    buildProactiveOpening: buildProactiveOpening,
    collectLiveSnapshot: collectLiveSnapshot,
    parseStructuredModelOutput: parseStructuredModelOutput,
    requestStructuredDialogue: requestStructuredDialogue,
    loadConfig: loadConfig,
    saveConfig: saveConfig
  };

  root.AIChatPanel = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }

  if (typeof document !== 'undefined') {
    init();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
