/* Bidirectional bridge between game stage and SillyTavern extension. */
(() => {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('tavern') !== '1') return;
  const channel = 'fictional-adventure-v1';
  const send = (type, payload) => window.parent.postMessage({ channel, type, payload }, location.origin);
  let previous = '';

  function snapshot() {
    const visible = !document.getElementById('game-screen').classList.contains('hidden');
    const ids = visible ? [...new Set(stage.map(p => p.id).filter(id => CHARS[id] && id !== 'sylvia'))] : [];
    const people = ids.map(id => ({
      id,
      name: CHARS[id].name,
      short: CHARS[id].short,
      role: CHARS[id].role,
      age: id === 'beatrice' ? S.ageY + 2 : id === 'alice' ? Math.max(0, S.ageY - 2) : null,
      know: S.know[id] || 0,
      love: S.love[id] || 0
    }));
    const out = {
      playing: visible,
      scene: currentScene || 'free-roam',
      location: LOCS[S.loc]?.name || S.loc,
      description: LOCS[S.loc]?.desc || '',
      phase: S.phase,
      player: {
        name: S.alias || S.name,
        age: S.ageY,
        year: S.year,
        month: S.month,
        day: S.day,
        time: TODS[S.tod],
        tier: TIERS[S.tier],
        hp: S.hp,
        mp: S.mp,
        stamina: S.st,
        level: S.lv
      },
      speaker: CHARS[curSpeakerId]?.name || document.getElementById('speaker').textContent,
      text: (fullText || document.getElementById('text').textContent || '').slice(0, 2500),
      people
    };
    if (window.AI_PERSONAS && typeof window.AI_PERSONAS.extractSafeFlags === 'function') {
      out.flags = window.AI_PERSONAS.extractSafeFlags(S.flags);
    }
    if (window.BranchingDirector && typeof window.BranchingDirector.getCausalSnapshot === 'function') {
      out.causal = window.BranchingDirector.getCausalSnapshot(S);
    }
    return out;
  }

  function applyIncomingEffect(data) {
    if (!data || !data.charId) return;
    if (window.BranchingDirector && typeof window.BranchingDirector.applyAIOutcome === 'function') {
      const canPersist = Boolean(S && S.flags && S.flags.named);
      window.BranchingDirector.applyAIOutcome(data.charId, data, { silent: !canPersist });
      return;
    }
    // 轻量兜底：仅切换在场角色立绘表情，不触碰存档
    if (data.emotion && Array.isArray(stage) && stage.some(p => p.id === data.charId) && typeof applyStage === 'function') {
      applyStage(stage.map(p => ({
        id: p.id,
        emo: p.id === data.charId ? data.emotion : (p.emo || 'normal'),
        active: p.id === data.charId
      })));
    }
  }

  function publish(force = false) {
    const data = snapshot();
    const serialized = JSON.stringify(data);
    if (force || serialized !== previous) {
      previous = serialized;
      send('context', data);
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin || event.data?.channel !== channel) return;
    if (event.data.type === 'context-request') publish(true);
    if (event.data.type === 'ai-effect') applyIncomingEffect(event.data.payload);
  });

  document.getElementById('btn-new').addEventListener('click', () => send('new-game'), true);
  setInterval(publish, 500);
  publish(true);
})();
