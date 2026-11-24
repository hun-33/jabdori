/* ============================================================
   04c-voice.js — 캐릭터 목소리 (TTS, 기기 음성 엔진 사용)
   ① 설정값      : state.voice = { mode 소리 모드, speed 말 빠르기 }
   ② 읽기 다듬기 : speakable() — 화면용 글자를 귀로 듣기 좋은 말로 (18:30 → 18시 30분)
   ③ 말하기      : TTS.say(text, { pri, stage }) — 모드·중복·우선순위를 보고 읽을지 정한다
                   TTS.speak(text)                  — 버튼으로 직접 듣기 (모드와 상관없이)
   ④ 한국어 음성 : TTS.check() — 기기에 한국어 음성이 있는지 확인, 없으면 안내
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

function voicePrefs() {
  if (!state.voice || typeof state.voice !== 'object') state.voice = { mode: 'off', speed: 'normal' };
  if (!VOICE_MODES.some(([id]) => id === state.voice.mode)) state.voice.mode = 'off';
  if (!VOICE_SPEEDS[state.voice.speed]) state.voice.speed = 'normal';
  return state.voice;
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
    return this.speak(text, { ...o, pri });
  },
  /* 실제로 읽기 */
  speak(text, o = {}) {
    const t = speakable(text);
    if (!this.ok() || !t) return false;
    const ms = Date.now(), pri = o.pri || 'manual';
    if (pri !== 'manual') {
      if (t === this.last.text && ms - this.last.at < 15000) return true;              // 같은 말을 15초 안에 또 읽지 않음
      if (pri === 'all' && this.lastPri === 'key' && ms < this.busyUntil) return false; // 중요한 말 읽는 중엔 끼어들지 않음
    }
    this.last = { text: t, at: ms }; this.lastPri = pri;
    const { rate, pitch } = this.params(o.stage || 0);
    this.busyUntil = ms + Math.min(15000, 500 + (t.length * 150) / rate);
    if (NATIVE.on) { // 진짜 앱: 안드로이드 기기 음성 엔진
      const S = NATIVE.Speech;
      const go = (retry) => S.speak({ text: t, lang: 'ko-KR', rate, pitch, volume: 1.0, category: 'ambient' })
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
      u.rate = rate; u.pitch = pitch;
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
  const ok = TTS.ok();
  let status;
  if (!ok) status = NATIVE.on ? '음성 기능을 불러오지 못했어요. 앱을 다시 열어 주세요.' : '이 브라우저는 음성 읽기를 지원하지 않아요.';
  else if (TTS.koOK === false) status = NATIVE.on ? '기기에 한국어 음성이 없어요. 아래 버튼으로 설치해 주세요.' : '한국어 음성이 없어 기본 음성으로 읽어요.';
  else if (TTS.koOK) status = `${esc(josa(TTS.voiceName || '한국어 음성', '으로/로'))} 읽어요.`;
  else status = '기기 음성으로 읽어요.';
  const seg = (name, act, items, curV) => `<div class="seg wide" role="radiogroup" aria-label="${name}">${items.map(([id, label]) => `<button role="radio" class="seg-btn ${curV === id ? 'on' : ''}" aria-checked="${curV === id}" data-act="${act}" data-v="${id}" ${ok ? '' : 'disabled'}>${label}</button>`).join('')}</div>`;
  const modeDesc = (VOICE_MODES.find(([id]) => id === v.mode) || VOICE_MODES[0])[2];
  return `<h2 class="sec-label">목소리</h2>
    <div class="set-block">
      <p class="set-title">소리 모드</p>
      ${seg('소리 모드', 'voiceMode', VOICE_MODES, v.mode)}
      <p class="set-desc">${modeDesc}</p>
      <p class="set-title">말 빠르기</p>
      ${seg('말 빠르기', 'voiceSpeed', Object.entries(VOICE_SPEEDS).map(([id, s]) => [id, s.label]), v.speed)}
      <div class="set-row"><button class="btn secondary sm" data-act="voiceTest" ${ok ? '' : 'disabled'}>${icon('speaker')}${esc(c.name)} 목소리 들어 보기</button>
        ${NATIVE.on && TTS.koOK === false ? `<button class="btn ghost sm" data-act="voiceInstall">음성 설치</button>` : ''}</div>
      <p class="set-desc">${status} 앱 화면이 켜져 있을 때만 소리로 읽고, 화면이 꺼져 있으면 알림으로 알려요.</p>
    </div>`;
}

Object.assign(ACT, {
  /* 말풍선 옆 스피커 버튼: 모드와 상관없이 지금 말 듣기 */
  speak: () => {
    const sp = el.screen.querySelector('.speech');
    if (!TTS.speak(sp ? sp.textContent : '', { stage: Number(sp && sp.dataset.stage) || 0 })) toast('이 기기에서는 음성 읽기를 쓸 수 없어요.');
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
  /* 온보딩·강도 미리보기: 단계 예시 멘트 듣기 */
  speakSample: (t) => {
    const sg = Number(t.dataset.s) || 1;
    if (!TTS.speak(persona().lines.sample[sg], { stage: sg })) toast('이 기기에서는 음성 읽기를 쓸 수 없어요.');
  },
});
