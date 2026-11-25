/* ============================================================
   04c-voice.js — 캐릭터 목소리 (TTS, 기기 음성 엔진 사용)
   ① 설정값      : state.voice = { mode 소리 모드, speed 말 빠르기 }
   ② 읽기 다듬기 : speakable() — 화면용 글자를 귀로 듣기 좋은 말로 (18:30 → 18시 30분)
   ③ 말하기      : TTS.say(text, { pri, stage }) — 모드·중복·우선순위를 보고 읽을지 정한다
                   TTS.speak(text)                  — 버튼으로 직접 듣기 (모드와 상관없이)
   ④ 한국어 음성 : TTS.check() — 기기에 한국어 음성이 있는지 확인, 없으면 안내
   ⑤ 캐릭터 목소리 파일 : VOICE_PACKS(05b-voice-pack.js) — 미리 만든 음성 파일이 있는 대사는 파일을 틀고,
                          파일이 없는 말(일정 이름이 들어간 문장 등)만 기기 음성으로 읽는다
   캐릭터마다 목소리 높낮이·빠르기가 다르다 (01-core.js CHARACTERS[].voice)
   ============================================================ */

/* 소리 모드: 언제 소리 내어 읽을지 */
const VOICE_MODES = [
  ['off', '끄기', '소리 없이 글자로만 보여 줘요. 말풍선 옆 스피커 버튼으로는 언제든 들을 수 있어요.'],
  ['key', '중요할 때만', '시작 시간·마감 임박·마감·딴짓 감지·휴식 초과·결과만 소리로 읽어요.'],
  ['all', '모든 멘트', '말풍선이 바뀔 때마다 읽어요. 중요한 말을 읽는 중에는 끼어들지 않아요.'],
];
/* 말 빠르기: 캐릭터 기본 빠르기에 곱한다 */
const VOICE_SPEEDS = { slow: { label: '느리게', k: 0.85 }, normal: { label: '보통', k: 1 }, fast: { label: '빠르게', k: 1.2 } };

/* 상황별로 소리 낼지 (소리 모드가 켜져 있을 때만 의미 있음) */
const VOICE_EVENTS = [
  ['start', '시작·지각'], ['deadline', '마감 임박·마감'], ['slack', '딴짓·공부 확인'], ['result', '완료·실패 결과'], ['speech', '말풍선 변화'],
];
function voicePrefs() {
  if (!state.voice || typeof state.voice !== 'object') state.voice = { mode: 'off', speed: 'normal' };
  const v = state.voice;
  if (!VOICE_MODES.some(([id]) => id === v.mode)) v.mode = 'off';
  if (!VOICE_SPEEDS[v.speed]) v.speed = 'normal';
  if (!(v.volume >= 0 && v.volume <= 1)) v.volume = 1;            // 음량 0~1
  if (!v.events || typeof v.events !== 'object') v.events = {};
  for (const [id] of VOICE_EVENTS) if (typeof v.events[id] !== 'boolean') v.events[id] = true;
  if (typeof v.useClips !== 'boolean') v.useClips = true;          // 캐릭터 목소리 파일 쓰기
  return v;
}

/* ---------- ⑤ 캐릭터 목소리 파일 ---------- */
// 대사 틀(템플릿) → 정규식. {title} 같은 빈칸은 아무 글자나 맞춘다
const clipIndex = {};
function clipsFor(charId) {
  if (clipIndex[charId]) return clipIndex[charId];
  const pack = typeof VOICE_PACKS !== 'undefined' ? VOICE_PACKS[charId] : null;
  const list = [];
  if (pack && Array.isArray(pack.clips)) {
    for (const [tpl, file, mood] of pack.clips) {
      const re = new RegExp('^' + tpl.trim().replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c).replace(/\\\{\w+\\\}/g, '(.+?)') + '$');
      list.push({ tpl, re, src: pack.dir + file + '.mp3', mood: mood || '' });
    }
  }
  return (clipIndex[charId] = { pack, list });
}
// 화면에 나온 문장 → 미리 만든 음성 파일 (없으면 null)
function clipFor(text, charId = (persona() || {}).id) {
  const t = String(text || '').trim();
  if (!t) return null;
  const { list } = clipsFor(charId);
  return list.find((c) => c.re.test(t)) || null;
}

/* 화면 글자 → 읽기 좋은 말 */
function speakable(text) {
  return String(text || '')
    .replace(/(\d{1,2}):(\d{2})/g, (_, h, mm) => `${Number(h)}시${Number(mm) ? ' ' + Number(mm) + '분' : ''}`) // 18:30 → 18시 30분
    .replace(/(\d)\s*[–~]\s*(\d)/g, '$1에서 $2')     // 18시–20시 → 18시에서 20시
    .replace(/\s*[–~]\s*/g, '에서 ')
    .replace(/…+/g, ', ')
    .replace(/[·•|]/g, ', ')
    .replace(/[“”"‘’'«»()[\]{}<>]/g, ' ')
    .replace(/\+(\d)/g, '플러스 $1')
    .replace(/[!?.]{2,}/g, (s) => s[0])
    .replace(/\s+/g, ' ')
    .trim();
}

const TTS = {
  voice: null,          // 웹: 고른 한국어 음성
  koOK: null,           // 한국어 음성: null 모름 · true 있음 · false 없음
  voiceName: '',        // 설정 화면에 보여 줄 음성 이름
  busyUntil: 0,         // 지금 읽는 말이 끝날 예상 시각 (ms)
  lastPri: '',          // 마지막으로 읽은 말의 우선순위
  last: { text: '', at: 0 },
  warned: false,        // '한국어 음성 없음' 안내를 이미 했는지
  blocked: false,       // 웹: 화면을 누르기 전이라 브라우저가 소리를 막음

  ok() {
    if (NATIVE.on) return !!NATIVE.Speech;
    try { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; } catch (e) { return false; }
  },
  init() {
    voicePrefs();
    if (!this.ok()) return;
    if (NATIVE.on) { setTimeout(() => this.check(), 1500); return; } // 기기 음성 엔진은 켜지는 데 시간이 걸린다
    const pick = () => {
      try {
        const vs = speechSynthesis.getVoices();
        if (!vs.length) return; // 목록이 아직 안 옴 (voiceschanged 때 다시)
        this.voice = vs.find((v) => /^ko(-|_|$)/i.test(v.lang) && v.localService) || vs.find((v) => /^ko/i.test(v.lang)) || null;
        this.koOK = !!this.voice; this.voiceName = this.voice ? this.voice.name : '';
      } catch (e) { /* 무시 */ }
    };
    pick();
    try { speechSynthesis.addEventListener('voiceschanged', pick); } catch (e) { /* 무시 */ }
    try { document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); }); } catch (e) { /* 무시 */ }
  },
  /* 한국어 음성이 있는지 다시 확인 (설정 화면 진입·앱 복귀 때) */
  async check() {
    if (!this.ok()) { this.koOK = false; return false; }
    if (!NATIVE.on) { try { this.voice = speechSynthesis.getVoices().find((v) => /^ko/i.test(v.lang)) || this.voice; } catch (e) { /* 무시 */ } this.koOK = !!this.voice; this.voiceName = this.voice ? this.voice.name : ''; return this.koOK; }
    try {
      const r = await NATIVE.Speech.isLanguageSupported({ lang: 'ko-KR' });
      this.koOK = !!(r && r.supported); this.voiceName = this.koOK ? '기기 한국어 음성' : '';
    } catch (e) { this.koOK = null; } // 엔진이 아직 준비 안 됨 → 모름
    return this.koOK;
  },
  /* 캐릭터 목소리 × 말 빠르기 × 단계 (4·5단계는 살짝 빠르고 높게 — 부풀어 오른 느낌) */
  params(stage = 0) {
    const c = persona().voice || { pitch: 1, rate: 1 };
    const k = VOICE_SPEEDS[voicePrefs().speed].k;
    const hot = Math.max(0, stage - 3);
    return { rate: clamp(c.rate * k * (1 + hot * 0.05), 0.5, 2), pitch: clamp(c.pitch + hot * 0.05, 0.5, 2) };
  },
  allowed(pri) {
    const mode = voicePrefs().mode;
    if (pri === 'manual') return true;
    if (mode === 'off') return false;
    return mode === 'all' || pri === 'key';
  },
  /* 자동으로 읽을 때: pri 'key' 중요한 순간 · 'all' 그 밖의 멘트 */
  say(text, o = {}) {
    const pri = o.pri || 'all';
    if (!this.allowed(pri)) return false;
    if (o.ev && voicePrefs().events[o.ev] === false) return false; // 상황별 설정에서 끈 상황
    return this.speak(text, { ...o, pri });
  },
  /* 실제로 읽기 */
  speak(text, o = {}) {
    const t = speakable(text);
    if (!t) return false;
    // 캐릭터 목소리 파일이 있는 대사면 파일을 튼다. 실패하면 기기 음성으로 대신 읽는다
    const clip = voicePrefs().useClips && !o.device ? clipFor(text) : null;
    if (!clip && !this.ok()) return false;
    const ms = Date.now(), pri = o.pri || 'manual';
    if (pri !== 'manual') {
      if (t === this.last.text && ms - this.last.at < 15000) return true;              // 같은 말을 15초 안에 또 읽지 않음
      if (pri === 'all' && this.lastPri === 'key' && ms < this.busyUntil) return false; // 중요한 말 읽는 중엔 끼어들지 않음
    }
    this.last = { text: t, at: ms }; this.lastPri = pri;
    const { rate, pitch } = this.params(o.stage || 0);
    this.busyUntil = ms + Math.min(15000, 500 + (t.length * 150) / rate);
    if (clip) { this.playClip(clip, t, o); return true; }
    return this.speakDevice(t, rate, pitch);
  },
  /* 미리 만든 음성 파일 재생 (말 빠르기는 재생 속도로, 음량은 설정값으로) */
  playClip(clip, t, o) {
    this.stopDevice();
    try {
      if (this.audio) { this.audio.pause(); this.audio = null; }
      const a = new Audio(clip.src);
      a.volume = voicePrefs().volume;
      a.playbackRate = VOICE_SPEEDS[voicePrefs().speed].k;
      try { a.preservesPitch = true; } catch (e) { /* 무시 */ }
      a.onended = () => { if (this.audio === a) { this.audio = null; this.busyUntil = 0; } };
      a.onerror = () => { if (this.audio === a) { this.audio = null; this.clipFail = (this.clipFail || 0) + 1; const p = this.params(o.stage || 0); this.speakDevice(t, p.rate, p.pitch); } };
      this.audio = a; this.lastClip = clip.src;
      const pr = a.play();
      if (pr && pr.catch) pr.catch((e) => {
        if (this.audio !== a) return;
        this.audio = null;
        if (e && e.name === 'NotAllowedError') { this.blocked = true; return; } // 브라우저가 자동 재생을 막음 → 다음 터치 뒤에 재생됨
        const p = this.params(o.stage || 0); this.speakDevice(t, p.rate, p.pitch);
      });
    } catch (e) { const p = this.params(o.stage || 0); this.speakDevice(t, p.rate, p.pitch); }
  },
  /* 기기 음성으로 읽기 */
  speakDevice(t, rate, pitch) {
    if (!this.ok()) return false;
    const vol = voicePrefs().volume;
    if (NATIVE.on) { // 진짜 앱: 안드로이드 기기 음성 엔진
      const S = NATIVE.Speech;
      const go = (retry) => S.speak({ text: t, lang: 'ko-KR', rate, pitch, volume: vol, category: 'ambient' })
        .then(() => { this.koOK = true; })
        .catch((e) => {
          const msg = String((e && e.message) || e || '');
          if (/not supported/i.test(msg)) { this.koOK = false; this.warnNoKorean(); }
          else if (/not yet initialized|not available/i.test(msg) && retry) setTimeout(() => go(false), 900); // 엔진 준비 중 → 한 번 더
        });
      S.stop().catch(() => {}).then(() => go(true));
      return true;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ko-KR'; if (this.voice) u.voice = this.voice;
      u.rate = rate; u.pitch = pitch; u.volume = vol;
      u.onerror = (e) => {
        if (e && e.error === 'not-allowed') this.blocked = true; // 화면을 한 번도 안 눌러 브라우저가 막음
        else if (e && (e.error === 'language-unavailable' || e.error === 'voice-unavailable')) { this.koOK = false; this.warnNoKorean(); }
      };
      u.onstart = () => { this.blocked = false; };
      speechSynthesis.speak(u);
      if (this.koOK === false) this.warnNoKorean();
      return true;
    } catch (e) { return false; }
  },
  stop() {
    this.busyUntil = 0; this.lastPri = '';
    if (this.audio) { try { this.audio.pause(); } catch (e) { /* 무시 */ } this.audio = null; }
    this.stopDevice();
  },
  stopDevice() {
    if (!this.ok()) return;
    if (NATIVE.on) { NATIVE.Speech.stop().catch(() => {}); return; }
    try { speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
  },
  warnNoKorean() {
    if (this.warned) return;
    this.warned = true;
    toast(NATIVE.on ? '기기에 한국어 음성이 없어요. 나 탭 > 목소리에서 음성 설치를 눌러 주세요.' : '이 브라우저에 한국어 음성이 없어서 다른 음성으로 읽어요.');
  },
  /* 안드로이드: 음성 데이터 설치 화면 열기 */
  install() {
    if (!NATIVE.on || !NATIVE.Speech) return;
    NATIVE.Speech.openInstall().catch(() => toast('음성 설정을 열지 못했어요. 폰 설정 > 일반 > 텍스트 음성 변환에서 바꿔 주세요.'));
  },
};

/* 나 탭 > 목소리 구역 */
function voiceSection() {
  const v = voicePrefs(), c = persona();
  const pack = clipsFor(c.id);
  const nClips = pack.list.length;
  const ok = TTS.ok() || nClips > 0;
  let status;
  if (!TTS.ok()) status = NATIVE.on ? '기기 음성 기능을 불러오지 못했어요. 앱을 다시 열어 주세요.' : '이 브라우저는 기기 음성 읽기를 지원하지 않아요.';
  else if (TTS.koOK === false) status = NATIVE.on ? '기기에 한국어 음성이 없어요. 아래 버튼으로 설치해 주세요.' : '한국어 음성이 없어 기본 음성으로 읽어요.';
  else if (TTS.koOK) status = `${esc(josa(TTS.voiceName || '한국어 음성', '으로/로'))} 읽어요.`;
  else status = '기기 음성으로 읽어요.';
  const seg = (name, act, items, curV) => `<div class="seg wide" role="radiogroup" aria-label="${name}">${items.map(([id, label]) => `<button role="radio" class="seg-btn ${curV === id ? 'on' : ''}" aria-checked="${curV === id}" data-act="${act}" data-v="${id}" ${ok ? '' : 'disabled'}>${label}</button>`).join('')}</div>`;
  const modeDesc = (VOICE_MODES.find(([id]) => id === v.mode) || VOICE_MODES[0])[2];
  const vol = Math.round(v.volume * 100);
  return `<h2 class="sec-label">목소리</h2>
    <div class="set-block">
      <p class="set-title">소리 모드</p>
      ${seg('소리 모드', 'voiceMode', VOICE_MODES, v.mode)}
      <p class="set-desc">${modeDesc}</p>
      ${v.mode !== 'off' ? `<p class="set-title">상황별로 소리 내기</p>
      <div class="chips" role="group" aria-label="상황별로 소리 내기">${VOICE_EVENTS.map(([id, l]) => `<button class="chip ${v.events[id] ? 'on' : ''}" aria-pressed="${!!v.events[id]}" data-act="voiceEvent" data-v="${id}">${l}</button>`).join('')}</div>` : ''}
      <p class="set-title">말 빠르기</p>
      ${seg('말 빠르기', 'voiceSpeed', Object.entries(VOICE_SPEEDS).map(([id, s]) => [id, s.label]), v.speed)}
      <p class="set-title">음량 <b class="vol-val">${vol}%</b></p>
      <input type="range" class="vol-range" min="0" max="100" step="10" value="${vol}" data-act-input="voiceVolume" aria-label="목소리 음량" aria-valuetext="${vol}%">
      <div class="set-row"><button class="btn secondary sm" data-act="voiceTest" ${ok ? '' : 'disabled'}>${icon('speaker')}${esc(c.name)} 목소리 들어 보기</button>
        ${TTS.audio || (TTS.busyUntil > Date.now()) ? `<button class="btn ghost sm" data-act="voiceStop">멈추기</button>` : ''}
        ${NATIVE.on && TTS.koOK === false ? `<button class="btn ghost sm" data-act="voiceInstall">음성 설치</button>` : ''}</div>
      ${nClips ? `<div class="list-btn as-row"><span class="lb-text"><b>${esc(c.name)} 전용 목소리</b><small>미리 만든 목소리 ${nClips}개를 써요. 일정 이름처럼 그때그때 바뀌는 말만 기기 음성으로 읽어요.${pack.pack && pack.pack.credit ? ' · ' + esc(pack.pack.credit) : ''}</small></span>
        <button class="switch ${v.useClips ? 'on' : ''}" role="switch" aria-checked="${v.useClips}" aria-label="${esc(c.name)} 전용 목소리 쓰기" data-act="voiceClips"><i></i></button></div>` : ''}
      <p class="set-desc">${nClips && v.useClips ? '전용 목소리 + ' : ''}${status} 앱 화면이 켜져 있을 때만 소리로 읽고, 화면이 꺼져 있으면 알림으로 알려요.</p>
    </div>`;
}

Object.assign(ACT, {
  /* 말풍선 옆 스피커 버튼: 모드와 상관없이 지금 말 듣기 */
  speak: () => {
    const sp = el.screen.querySelector('.speech');
    if (!TTS.speak(speechText(sp), { stage: Number(sp && sp.dataset.stage) || 0 })) toast('이 기기에서는 음성 읽기를 쓸 수 없어요.');
  },
  voiceMode: (t) => {
    const v = voicePrefs(); v.mode = t.dataset.v; save(); render();
    if (v.mode === 'off') TTS.stop();
    else TTS.speak(v.mode === 'key' ? '중요할 때만 말로 부를게.' : '이제 말로도 잔소리할게.');
  },
  voiceSpeed: (t) => { voicePrefs().speed = t.dataset.v; save(); render(); TTS.speak('이 빠르기로 말할게.'); },
  voiceTest: () => {
    const L = persona().lines;
    const pk = pickLine('voiceTest', [L.sample[1], L.sample[3], L.sample[5]]);
    const sg = pk.id.endsWith('#2') ? 5 : pk.id.endsWith('#1') ? 3 : 1;
    if (!TTS.speak(pk.tpl, { stage: sg })) toast('이 기기에서는 음성 읽기를 쓸 수 없어요.');
  },
  voiceInstall: () => TTS.install(),
  voiceStop: () => { TTS.stop(); render(); },
  voiceClips: () => { const v = voicePrefs(); v.useClips = !v.useClips; save(); render(); TTS.speak(v.useClips ? (persona().lines.welcome || ['기기 목소리로 바꿨어.'])[0] : '기기 목소리로 바꿨어.'); }, // 켤 때는 녹음된 인사로 바로 들려준다
  voiceEvent: (t) => { const v = voicePrefs(); v.events[t.dataset.v] = !v.events[t.dataset.v]; save(); render(); },
  /* 온보딩·강도 미리보기: 단계 예시 멘트 듣기 */
  speakSample: (t) => {
    const sg = Number(t.dataset.s) || 1;
    if (!TTS.speak(persona().lines.sample[sg], { stage: sg })) toast('이 기기에서는 음성 읽기를 쓸 수 없어요.');
  },
});

/* 음량 막대: 끄는 동안에는 숫자만 바꾸고, 손을 떼면 저장하고 짧게 들려준다 */
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (!t || !t.dataset || t.dataset.actInput !== 'voiceVolume') return;
  const v = voicePrefs(); v.volume = clamp(Number(t.value) / 100, 0, 1);
  t.setAttribute('aria-valuetext', `${Math.round(v.volume * 100)}%`);
  const lb = document.querySelector('.vol-val'); if (lb) lb.textContent = `${Math.round(v.volume * 100)}%`;
  if (TTS.audio) TTS.audio.volume = v.volume;
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (!t || !t.dataset || t.dataset.actInput !== 'voiceVolume') return;
  save();
  if (voicePrefs().volume > 0) TTS.speak('이 정도 크기로 말할게.');
});
