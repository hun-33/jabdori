/* =========================================================
   잡도리앱 프로토타입 — "물 올린다" 시안
   01-core: 유틸, 아이콘, 정책, 페르소나, 저장소, 도메인 로직
   ========================================================= */
'use strict';

/* ---------- 유틸 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN = 60000;
const DAY = 86400000;
/* 요일 값은 저장 형식 그대로 1=월 … 7=일 (기존 일정 데이터를 바꾸지 않기 위해).
   화면에 보이는 순서만 일요일부터: WEEK_ORDER */
const WD = ['', '월', '화', '수', '목', '금', '토', '일'];
const WEEK_ORDER = [7, 1, 2, 3, 4, 5, 6];
function dayRank(d) { return d % 7; } // 화면 순서: 일=0, 월=1 … 토=6

function ymd(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function at(dateStr, hm) { const d = parseYmd(dateStr); const [h, mi] = hm.split(':').map(Number); d.setHours(h, mi, 0, 0); return d.getTime(); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / DAY); }
function weekday(s) { const w = parseYmd(s).getDay(); return w === 0 ? 7 : w; }
function weekStartOf(s) { return addDays(s, -(weekday(s) % 7)); } // 그 날이 속한 주의 일요일
function fmtDateLong(s) { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[weekday(s)]}요일`; }
function fmtDateShort(s) { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[weekday(s)]})`; }
function fmtMD(s) { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; }
function fmtHM(ms) { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function hmToMin(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; }
function minToHm(n) { n = ((Math.round(n) % 1440) + 1440) % 1440; return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`; }
function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}
function jo(word, pair) { return josa(word, pair).slice(String(word).length); }
function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
/* 숫자로 끝나는 말의 받침: 마지막 숫자를 한국어로 읽은 소리 기준 (2 이·4 사·5 오·9 구만 받침 없음, 1 일·7 칠·8 팔은 ㄹ) */
const DIGIT_JONG = { 0: 21, 1: 8, 2: 0, 3: 16, 4: 0, 5: 0, 6: 1, 7: 8, 8: 8, 9: 0 };
function josa(word, pair) { // pair: '을/를', '이/가', '은/는', '와/과', '으로/로', '이에요/예요', '이야/야' 등 (받침 있을 때/없을 때)
  const last = String(word).trim().slice(-1), c = last.charCodeAt(0);
  const [a, b] = pair.split('/');
  if (/[0-9]/.test(last)) {
    const jong = DIGIT_JONG[last];
    if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? b : a);
    return word + (jong ? a : b);
  }
  if (c < 0xac00 || c > 0xd7a3) return word + b;
  const jong = (c - 0xac00) % 28;
  if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? b : a);
  return word + (jong ? a : b);
}

/* ---------- 아이콘 (단일 세트: 24 그리드, 1.8 선, 둥근 끝) ---------- */
const ICON_PATHS = {
  today: '<path d="M7 9.5c0-1.4 1.1-2.5 2.5-2.5h5c1.4 0 2.5 1.1 2.5 2.5l.7 7.3c.1 1.2-.8 2.2-2 2.2H8.3c-1.2 0-2.1-1-2-2.2L7 9.5Z"/><path d="M8.5 7C8.5 4.5 15.5 4.5 15.5 7"/><path d="M17.3 11.5c1.6-.3 2.4-1.4 2.9-2.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  record: '<path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V3.5Z"/><path d="M9 11.5l2 2 4-4.5M9 17h6"/>',
  me: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  prev: '<path d="M14.5 6l-6 6 6 6"/>',
  next: '<path d="M9.5 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  repeat: '<path d="M4.5 11V9.5A3.5 3.5 0 0 1 8 6h11.5M16.5 3l3 3-3 3"/><path d="M19.5 13v1.5A3.5 3.5 0 0 1 16 18H4.5M7.5 21l-3-3 3-3"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.2c.1.8.7 1.3 1.5 1.3h6.2c.8 0 1.4-.5 1.5-1.3L17.5 7"/>',
  edit: '<path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5Z"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
  dust: '<path d="M7.5 16.5h9.2a3.3 3.3 0 0 0 .3-6.6 5 5 0 0 0-9.5-1.2 3.9 3.9 0 0 0 0 7.8Z"/><path d="M7 20h.1M11.5 20.5h.1M16 20h.1"/>',
  flame: '<path d="M12 21c3.6 0 6-2.4 6-5.6 0-3.4-2.5-5.4-3.6-8.9-2.4 1.6-3.2 3.6-3.3 5.4-1-.7-1.6-1.8-1.8-3C7.4 10.4 6 12.6 6 15.4 6 18.6 8.4 21 12 21Z"/>',
  coffee: '<path d="M5 9.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9.5Z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v3M12 3.5v3"/>',
  logout: '<path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
  unlink: '<path d="M9.5 14.5l-2 2a3.2 3.2 0 0 1-4.5-4.5l2-2M14.5 9.5l2-2a3.2 3.2 0 0 1 4.5 4.5l-2 2M4 4l16 16"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  dot: '<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  speaker: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  shirt: '<path d="M8.5 4.5L4 7l1.8 4 2.2-1V20h8V10l2.2 1L20 7l-4.5-2.5c-.6 1.6-2 2.5-3.5 2.5s-2.9-.9-3.5-2.5z"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
};
function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ''}</svg>`;
}
const KAKAO_SYMBOL = '<svg class="kakao-sym" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-.9 3.4c-.1.3.3.6.6.4l4-2.7h1.1c5 0 9-3.1 9-7s-4-7-9-7Z"/></svg>';

/* ---------- 잡도리 정책 (확정되지 않은 값은 여기서만 바꾼다) ---------- */
const HEAT_POLICY = {
  progressShare: 0.6,   // 시간 경과로 오르는 몫 (남은 여유 대비)
  urgentShare: 0.4,     // 마감 임박 구간에서 오르는 몫
  urgentWindow: 30,     // 마감 임박 기준 (분)
  urgentBump: 5,        // 임박 진입 즉시 가산
  latePerMin: 0.25,     // 미시작 1분당 가산
  lateMax: 15,
  slackBump: 10,        // 딴짓(응답 전) 가산
  slackRest: 3,         // '잠깐 쉴게' 선택 시
  slackFocus: 6,        // '다시 집중할게' 선택 시
  slackDecay: 20,       // 딴짓 가산이 사라지는 시간 (분)
  studyRecheck: 10,     // '공부 중' 선택 후 다시 확인까지 (분)
  breakMinutes: 5,
  overBreakPerMin: 1,
  overBreakMax: 10,
  failStep: 10,         // 실패 1회당 최저 시작값 상승 (미루먼지: 먼지 +10)
  floorMax: 90,
  coolStreak: 3,        // 연속 성공 n회 시 가산 1단계 해제
  sliderMin: 20,
  initialHeat: 50,
};
/* ---------- 강도 눈금: 숫자(0~100)는 하나, 그 숫자를 부르는 이름은 눈금마다 다르다 ----------
   - 캐릭터 눈금: 캐릭터마다 자기 세계관으로 부른다 (미루먼지 = 먼지 농도, 좋음~최악)
   - 공통 눈금: 어떤 캐릭터든 같은 중립 이름 (순한맛~최고 매운맛)
   어느 쪽을 쓸지는 회원 설정 m.scaleMode ('character' | 'common') — 나 탭 > 단계 이름
   단계 경계(min)와 행동 설명(desc)은 모든 눈금이 공유하고, 이름·문구만 갈아 끼운다. */
const STAGE_BANDS = [
  { id: 1, min: 0, desc: '살살 달래요. 시작만 챙겨 줘요.' },
  { id: 2, min: 30, desc: '가볍게 잔소리해요.' },
  { id: 3, min: 50, desc: '미루면 바로 재촉해요.' },
  { id: 4, min: 70, desc: '도발 섞인 독촉이 들어가요.' },
  { id: 5, min: 90, desc: '봐주는 거 없어요. 최고 수위예요.' },
];
function makeScale(def) { return { ...def, stages: STAGE_BANDS.map((b, i) => ({ ...b, name: def.names[i], ...(def.moods ? { mood: def.moods[i] } : {}), ...(def.descs ? { desc: def.descs[i] } : {}) })) }; }
const SCALES = {
  mireum: makeScale({
    id: 'mireum',
    title: '미루먼지 농도',   // 값의 이름 (큰 숫자 위 제목)
    short: '농도',            // 문장 속 짧은 이름 ("농도 60")
    unit: '',                 // 숫자 뒤 단위 (온도 캐릭터라면 '°')
    floor: '시작 농도',       // 새 잡도리가 시작하는 값 (= 기본 농도 + 쌓인 먼지). 실패하면 올라감
    base: '기본 농도',        // 실패가 없을 때의 시작값 (나 탭에서 정함)
    extra: '쌓인 먼지', extraUnit: '겹', // 실패 한 번에 쌓이는 한 칸 ("쌓인 먼지 2겹")
    clear: '먼지 털기',       // 연속 성공으로 가산 한 칸을 푸는 일
    icon: 'dust',
    names: ['좋음', '보통', '나쁨', '매우 나쁨', '최악'],
    // 몸 상태 이름 — 표정·발성의 기준 (모양을 바꾸지 않고 표정·자세·먼지 효과로만 보여 준다)
    moods: ['몽글', '갸웃', '뭉게뭉게', '쭈뼛', '빵빵'],
    descs: ['몽글 · 작고 말랑해요. 시작만 살짝 챙겨요.', '갸웃 · 어라? 하고 가볍게 콕 찔러요.', '뭉게뭉게 · 답답해져요. 미루면 바로 재촉해요.', '쭈뼛 · 털이 곤두서요. 세게 독촉해요.', '빵빵 · 터지기 직전! 봐주는 거 없어요.'],
    blurb: '미루먼지가 얼마나 짙게 퍼졌는지로 잡도리 세기를 보여 줘요. 미룰수록 짙어지고 미루먼지도 커져요.',
    onbIntro: '잡도리 세기는 내 먼지 농도로 보여 줘. 미룰수록 짙어지고, 나도 커져. 단계를 눌러 봐.',
    onbFailTitle: '끝내면 도장,<br>놓치면 먼지가 쌓여.',
    onbFailBody: '끝내면 칭찬 도장을 찍어 줄게. 놓치면 <b>먼지가 {step}만큼 쌓여서</b> 다음에 올리는 잡도리 일정은 그 농도부터 시작해. 그 아래로는 못 내려. {streak}번 연속 해내면 먼지를 한 겹 털어 줄게.',
  }),
  common: makeScale({
    id: 'common',
    title: '잡도리 강도', short: '강도', unit: '',
    floor: '시작 강도', base: '기본 강도',
    extra: '벌칙', extraUnit: '단계',
    clear: '벌칙 풀기',
    icon: 'flame',
    names: ['순한맛', '보통맛', '매운맛', '아주 매운맛', '최고 매운맛'],
    blurb: '어떤 캐릭터든 같은 이름으로 잡도리 세기를 보여 줘요. 캐릭터를 바꿔도 단계 이름은 그대로예요.',
    onbIntro: '잡도리 세기는 {first}부터 {last}까지 다섯 단계야. 단계를 눌러 봐.',
    onbFailTitle: '끝내면 도장,<br>놓치면 더 맵게 시작해.',
    onbFailBody: '끝내면 칭찬 도장을 찍어 줄게. 놓치면 <b>최저 강도가 {step} 올라서</b> 다음에 올리는 잡도리 일정은 그 강도부터 시작해. 그 아래로는 못 내려. {streak}번 연속 해내면 벌칙을 한 단계 풀어 줄게.',
  }),
};
/* 지금 회원이 보는 눈금 (설정 > 단계 이름) */
function scaleOf(m = member()) { return m && m.scaleMode === 'common' ? SCALES.common : charOf(m).scale; }
/* 숫자 → 단계 (id는 눈금과 상관없이 같다) */
function stageOf(h, m) { const S = scaleOf(m); let s = S.stages[0]; for (const st of S.stages) if (h >= st.min) s = st; return s; }
/* 숫자 + 단위: "60" (단위 있는 눈금이면 "60°") */
function lv(h, m) { return `${h}${scaleOf(m).unit}`; }
/* 짧은 이름 + 숫자: "농도 60" / "강도 60" */
function lvs(h, m) { const S = scaleOf(m); return `${S.short} ${h}${S.unit}`; }
/* 실패 가산 n칸: "쌓인 먼지 2겹 (+20)" / "벌칙 2단계 (+20)" */
function extraText(n, m) { const S = scaleOf(m); return `${S.extra} ${n}${S.extraUnit} (+${n * HEAT_POLICY.failStep})`; }

/* ---------- 캐릭터: 미루먼지 (공식 마스코트, 그림은 01b-mireum.js) ---------- */
/* ---------- 미루먼지 발성 사전 (말버릇은 여기 한 곳에서만 관리) ----------
   새 발성을 넣을 때는 뜻이 겹치지 않는지 먼저 확인한다. 대사는 아래 lines에서 이 발성을 골라 쓴다 */
const MIREUM_VOCALS = {
  '퐁!': '등장, 새 일정 발견, 시작',
  '폴폴…': '평상시, 심심함, 대기',
  '어라라?': '의심, 예상과 다른 상황',
  '킁킁': '딴짓 냄새 감지',
  '사각사각': '공부·작업 소리, 집중 중',
  '뭉게뭉게': '답답함이 쌓이는 상태 (3단계)',
  '쭈뼛쭈뼛': '긴장, 강한 독촉 직전 (4단계)',
  '빵빵!': '최고 단계, 터지기 직전 (5단계)',
  '털털!': '완료·성공, 먼지가 털려 나감',
  '푸흐흐': '장난스러운 웃음',
  '히잉…': '실망, 시무룩함',
  '뿌우?': '궁금함, 재촉, 가벼운 항의',
};
/* 미루먼지 말투 원칙 (DESIGN.md 23절)
   1 몸 상태로 반응 (몽글 → 갸웃 → 뭉게뭉게 → 쭈뼛 → 빵빵)   2 먼지의 감각(냄새·소리·털림)으로 세상을 본다
   3 감탄사 먼저, 한 줄 15자 안팎   4 잔소리 이유도 먼지답게 ("나 터진다아!")   5 말끝을 늘이고 튄다(~다아 ~잖아아)
   6 사람식 조언(시간 관리 팁·공부법)은 하지 않는다. 일정명·시각·남은 시간은 정확히. 모욕은 하지 않는다 */
const CHAR_MIREUM = {
  id: 'mireum',
  name: '미루먼지',
  role: '1:1 전담 잡도리 먼지',
  traits: ['미룬 일에서 폴폴 태어난 작은 먼지 구름', '미룰수록 뭉게뭉게 커지고 털이 쭈뼛', '끝내면 털털 작아짐', '독설은 해도 모욕은 안 함'],
  vocals: MIREUM_VOCALS,
  intro: {
    tagline: '미루는 너와 함께하는 작은 구름, 미루먼지!',
    helloTitle: '퐁! 먼지 불렀어어?<br>오늘도 미룰 거야아?',
    helloBody: '먼지는 네가 미룬 일에서 폴폴 태어났어. 일을 맡기면 시작부터 마감까지 옆에 붙어 있을게. 미루면 먼지가 뭉게뭉게 커지고, 끝내면 털털 작아져.',
    meetBody: '평소엔 몽글몽글 말랑해. 근데 네가 미루면 털이 쭈뼛, 몸이 빵빵! 그럼 먼지 갑갑하거든!',
  },
  /* 대사 틀 (DESIGN.md 26절)
     - 대사에는 정보를 넣지 않는다. 일정 이름·시간은 말풍선 아래 '정보 줄'(lineFor의 fact)로 따로 보여 준다
       → 화면 글자와 녹음 목소리가 언제나 같다
     - 자기를 '먼지'라고 부른다 · 감탄사와 말끝 늘이기를 세게 · 한 줄 12자 안팎 · 상황마다 3개 이상 */
  lines: {
    empty: ['폴폴… 심심해애애!', '뿌우우? 할 일 없어어?', '킁킁… 미룬 일 냄새 어디 있지이?', '먼지한테 하나만 던져 줘어!'],
    noneToday: ['오늘은 쉬는 날이다아!', '폴폴… 먼지도 낮잠 잔다아.', '쿨쿨… 오늘은 조용하다아.'],
    allDone: ['털털! 오늘 몫 끝이다아!', '우와아! 먼지 홀쭉해졌어어!', '먼지 한 톨도 없다아! 최고오!'],
    upcoming: ['폴폴… 곧이다아?', '먼지 대기 중이다아!', '두근두근… 곧 시작이야아!'],
    due: ['퐁! 시간이다아!', '퐁퐁! 가자 가자아!', '땡! 시작이야아! 열기만 해애!'],
    late: {
      1: ['어라라? 아직이야아?', '살짝만 열어 볼래애?', '폴폴… 먼지 기다린다아.'],
      2: ['뿌우우? 아직도오?', '갸웃갸웃… 왜 안 열어어?', '킁킁… 미루는 냄새 난다아!'],
      3: ['뭉게뭉게… 답답해애애!', '먼지 부풀기 시작했어어!', '뿌우! 혼자선 안 끝난다구우!'],
      4: ['털이 쭈뼛쭈뼛! 폰 내려놔아!', '따끔따끔! 먼지 못 참겠어어!', '으으으! 큰일 난다구우!'],
      5: ['빵빵! 먼지 터진다아!', '으아아아! 당장 열어어!', '빵빵빵! 더는 못 참아아!'],
    },
    justStarted: ['오오? 시작했다아!', '먼지 쪼끄매진다아!', '푸흐흐, 봤다아! 출발이다아!'],
    running: {
      1: ['사각사각… 좋아아.', '몽글몽글… 딱 좋아아.', '쉿… 먼지 조용히 떠다닐게에.'],
      2: ['사각사각! 리듬 좋다아!', '먼지 살짝 작아졌다아?', '킁킁… 집중 냄새 좋아아!'],
      3: ['조금만 더 빨리이!', '손 멈추면 먼지 뭉게뭉게애!', '아직 남았다아? 힘내애!'],
      4: ['빠듯해애애!', '쭈뼛! 딴생각 금지이!', '먼지 짙어진다아! 속도오!'],
      5: ['지금 아니면 없어어!', '빵빵! 끝까지 가아!', '여기서 딴짓하면 먼지 터진다아!'],
    },
    studying: ['사각사각… 강의 듣는 중이지이?', '먼지 10분 뒤에 또 온다아?', '킁킁… 공부 냄새 맞지이?'],
    urgent: ['마무리, 마무리이!', '쭈뼛! 다듬지 말고 끝내애!', '으아아! 마감 온다아!', '빵빵! 일단 내고 보자아!', '제출할 곳 열어 놨어어?'],
    overdue: ['땡! 마감이다아!', '끝냈어? 못 끝냈어어?', '뿌우? 솔직하게 말해 줘어!'],
    missedStart: ['히잉… 시작도 못 했어어.', '어라라… 마감이 먼저 왔다아.', '히잉… 먼지 무거워어.'],
    overPlan: ['어라? 예정 시간 지났다아?', '뿌우? 끝났으면 말해 줘어!', '폴폴… 어디까지 할 거야아?'],
    break: ['후우우~ 둥실 쉬자아.', '물 한 모금! 먼지가 이따 콕!', '몽글… 딱 그만큼만이다아?'],
    breakOver: ['뿌우? 이제 다시 콕!', '쉬는 시간 끝났다아!', '어라라? 너무 오래 쉬었다아!'],
    slackAsk: ['킁킁! 딴짓 냄새 난다아!', '어라라? 지금 뭐 해애?', '킁킁킁… 수상하다아!'],
    slackStudy: ['공부용이면 인정이다아!', '푸흐흐, 믿어 볼게에! 10분 뒤에 또 킁킁!', '사각사각 소리 나는 거 맞지이?'],
    slackRest: ['5분만이다아?', '후우~ 5분! 넘기면 뭉게뭉게!', '좋아아! 5분 뒤에 콕!'],
    slackFocus: ['좋아아! 바로 돌아가아!', '퐁! 창 닫고 출발!', '푸흐흐, 다시 사각사각!'],
    slackIdle: ['지금은 봐준다아!', '폴폴… 지금은 자유 시간!', '킁킁… 지금은 괜찮아아.'],
    slackBreak: ['쉬는 시간이니까 통과아!', '후우~ 휴식 중엔 괜찮아아.', '몽글… 끝나면 바로 닫기이!'],
    studyCheck: ['10분 지났다아! 아직 강의야아?', '킁킁… 아직 공부 영상이야아?', '뿌우? 아직도 보는 중이야아?'],
    studyMore: ['딱 10분만 더어!', '먼지 또 킁킁하러 온다아?', '푸흐흐, 10분만이다아!'],
    studyBack: ['퐁! 이제 진짜 과제다아!', '사각사각 시작이다아!', '털털! 영상 끄고 출발!'],
    doneEarly: ['우와아아! 일찍 해냈다아!', '털털털! 먼지 다 날아갔어어!', '봐아! 되잖아아! 먼지 쪼끄매졌어어!'],
    doneClose: ['휴우우… 아슬아슬! 해냈다아!', '심장 쫄깃했어어! 그래도 골인!', '다음엔 덜 빵빵하게 해 줘어!'],
    doneNone: ['우와아! 끝이다아!', '털털! 하나 지웠다아!', '퐁! 먼지 홀쭉해졌어어!'],
    doneProud: ['우와아! 연속이야아!', '털털털! 요즘 완전 달라졌어어!', '푸흐흐, 이대로 가자아!'],
    dayFail: ['히잉… 먼지 한 겹 더 쌓였어어.', '으에에… 내일은 털어 보자아?', '히잉… 오늘은 무거워어.'],
    failed: ['히잉… 한 겹 더 쌓였어어.', '으에에… 또 한 겹이야아…', '히잉… 그래도 먼지 안 떠나아!'],
    cooled: ['털털! 세 번 연속이다아!', '우와아! 먼지 한 겹 털털!', '푸흐흐! 약속대로 한 겹 날려 줄게에!'],
    saved: ['오잉! 새 일정이다아!', '퐁! 먼지가 콕 부를게에!', '킁킁… 냄새 기억했어어!'],
    welcome: ['퐁! 먼지 불렀어어?', '왔다아! 먼지 기다렸어어!', '폴폴… 반가워어!'],
    poke: ['푸흐흐, 간지러워어!', '퐁! 먼지 불렀어어?', '뿌우? 왜애애?', '몽글몽글~ 좋아아!'],
    excuse: {
      time: '시간이 모자랐구나아… 다음엔 더 일찍 콕!',
      slack: '솔직해서 좋아아! 다음엔 바로 킁킁!',
      condition: '아팠구나아… 먼저 푹 쉬어어.',
      hard: '어려웠구나아… 다음엔 첫 단계만 맡겨어!',
      none: '괜찮아아. 다음 판 가자아!',
    },
    sample: { // 단계 설명용 예시 (온보딩·등록 화면)
      1: '어라라? 살짝만 열어 볼래애?',
      2: '뿌우우? 아직도오?',
      3: '뭉게뭉게… 답답해애애!',
      4: '털이 쭈뼛쭈뼛! 폰 내려놔아!',
      5: '빵빵! 먼지 터진다아!',
    },
    // 앱 안 배너 (상태가 바뀌는 순간). 일정 이름은 배너의 정보 줄에 따로
    banner: {
      start: '퐁! 시간이다아! 가자 가자아!',
      urgent: '쭈뼛! 마감 코앞이다아!',
      due: '땡! 마감이다아! 결과 알려 줘어!',
      lateHard: '빵빵! 폰 내려놓고 열어어!',
      breakOver: '뿌우? 쉬는 시간 끝! 다시 콕!',
    },
    // 폰 알림 [제목 = 정보, 본문 = 먼지 말]. 소리로 읽지 않아서 제목에는 일정 이름을 넣는다
    notif: {
      start: ['{title} · 시작 시간', '퐁! 시간이다아! 가자 가자아!'],
      late: ['{title} · 10분 지남', '뿌우우? 아직도오?'],
      urgent: ['{title} · 마감 30분 전', '쭈뼛! 마무리, 마무리이!'],
      due: ['{title} · 마감', '땡! 끝냈어? 못 끝냈어어?'],
      alarm: ['{title} · {before} 시작', '폴폴… 먼지가 미리 알려 주는 거야아.'],
    },
  },
};

/* ---------- 캐릭터 목록 ----------
   새 캐릭터를 넣을 때 채울 칸:
   - id·name·role·traits : 이름과 소개
   - lines               : 상황별 대사 (CHAR_MIREUM.lines와 같은 키를 모두 채운다)
   - scale               : 자기 세계관 눈금 (SCALES에 하나 추가)
   - voice               : TTS 목소리 { pitch 높낮이, rate 빠르기 } — 기기 목소리를 이 값으로 바꿔 캐릭터처럼 들리게
   - art(o)              : 그림 함수. o = { expr 표정, pose 자세, motion 동작, fluff 단계 0~1, label }
                           모양(실루엣)은 언제나 같다. 표정·자세·작은 동작·먼지 효과로만 감정을 보여 준다
                           표정·자세·동작 이름은 EXPR_LABEL·mascotFor()가 쓰는 이름을 그대로 그려 낸다
   (옷 갈아입기·변신 기능은 없앴다 — 디자인 기준) */
CHAR_MIREUM.scale = SCALES.mireum;
CHAR_MIREUM.voice = { pitch: 1.3, rate: 1.05 };
CHAR_MIREUM.art = (o) => mireumSVG(o);
const CHARACTERS = { mireum: CHAR_MIREUM };
const DEFAULT_CHARACTER = 'mireum';
/* 회원에게 배정된 캐릭터 (없거나 지워진 id면 기본 캐릭터) */
function charOf(m = member()) { return CHARACTERS[m && m.characterId] || CHARACTERS[DEFAULT_CHARACTER]; }
/* 지금 화면에서 말하는 캐릭터 */
function persona() { return charOf(); }

/* 상황 키마다 마지막으로 고른 문장을 기억해 같은 문장 연속 반복을 피한다 */
const lineMemo = {};
function pickLine(ctx, arr, bucket = 0) {
  if (!arr || !arr.length) return { tpl: '', id: ctx };
  const m = lineMemo[ctx];
  if (m && m.bucket === bucket && m.len === arr.length) return { tpl: arr[m.idx], id: ctx + '#' + m.idx };
  let idx;
  if (arr.length === 1) idx = 0;
  else if (m) idx = (m.idx + 1 + Math.floor(Math.random() * (arr.length - 1))) % arr.length;
  else idx = Math.floor(Math.random() * arr.length);
  lineMemo[ctx] = { idx, bucket, len: arr.length };
  return { tpl: arr[idx], id: ctx + '#' + idx };
}
function fillLine(tpl, v) { return tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? '')); }

/* ---------- 저장소 ---------- */
const STORE_KEY = 'jabdori.proto.v1';
const TEST_KAKAO = { id: '4100231', nickname: '테스트 사용자', email: 'test.user@example.com' };
const BASE_CLOCK = new Date(2026, 10, 23, 18, 0, 0, 0).getTime();

function freshState() {
  return {
    v: 1,
    clock: BASE_CLOCK,
    realTime: false,
    auto: false,
    session: null,            // { kakaoId, memberId, method, at, expired? }
    kakao: {},                // kakaoId -> { linked, token, consent }  (카카오 쪽 상태 재현)
    members: {},              // memberId -> member
    memberByKakao: {},        // kakaoId -> memberId  (내부 계정은 카카오 고유 ID로만 연결)
    scenario: 'normal',
    talkInstalled: true,
    ignoredClicks: 0,
    reduceMotion: false,
    voice: { mode: 'off', speed: 'normal' }, // 목소리 설정 (04c-voice.js)
    settledDay: ymd(BASE_CLOCK),
  };
}
let storageOK = true;
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) {
        if (!s.voice && 'ttsAuto' in s) s.voice = { mode: s.ttsAuto ? 'all' : 'off', speed: 'normal' }; // 옛 '멘트 소리로 듣기' 켜짐 → 모든 멘트
        delete s.ttsAuto;
        // 옛 일정 구조 변환. 한 일정이 이상해도 나머지 데이터(세션·기록)는 절대 버리지 않는다
        for (const mm of Object.values(s.members || {})) (mm.tasks || []).forEach((t) => { try { migrateTask(t); } catch (e) { console.warn('일정 변환 건너뜀', t && t.id, e); } });
        return Object.assign(freshState(), s);
      }
    }
  } catch (e) { storageOK = false; }
  return freshState();
}
function save() {
  // 동작마다 바로 저장한다 (지연 저장은 새로고침·앱 종료 때 마지막 동작을 잃을 수 있음)
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); storageOK = true; } catch (e) { storageOK = false; }
  if (typeof afterSave === 'function') afterSave(); // 진짜 앱: 알림 다시 예약 (05-native)
}
function now() { return state.clock; }
function today() { return ymd(state.clock); }
function member() { const s = state.session; return s && !s.expired ? state.members[s.memberId] || null : null; }

/* ---------- 회원·최저 시작값 (미루먼지: 쌓인 먼지) ---------- */
function floorOf(m) { return Math.min(HEAT_POLICY.floorMax, m.initialHeat + HEAT_POLICY.failStep * m.penalty); }
function maxPenalty(m) { return Math.floor((HEAT_POLICY.floorMax - m.initialHeat) / HEAT_POLICY.failStep); }
function sliderMinFor(m, editTask) {
  if (m.penalty > 0) {
    const f = floorOf(m);
    return editTask ? Math.min(editTask.heat, f) : f;
  }
  return HEAT_POLICY.sliderMin;
}
function createMember(kakaoId, profile, consent) {
  const id = uid('m');
  state.members[id] = {
    id, kakaoId,
    nickname: profile.nickname,
    email: consent.email ? profile.email : null,
    profileImage: !!consent.profile,
    consent,
    createdAt: now(),
    onboarded: false,
    characterId: DEFAULT_CHARACTER, // 전담 캐릭터
    scaleMode: 'character',          // 단계 이름: 'character' 캐릭터별 | 'common' 공통
    initialHeat: HEAT_POLICY.initialHeat,
    penalty: 0,
    streak: 0,
    tasks: [],
    runs: {},
  };
  state.memberByKakao[kakaoId] = id;
  return state.members[id];
}

/* ---------- 일정·회차 ---------- */
function occKey(taskId, date) { return taskId + '|' + date; }
function splitKey(k) { const i = k.lastIndexOf('|'); return [k.slice(0, i), k.slice(i + 1)]; }
function findTask(m, id) { return m.tasks.find((t) => t.id === id); }
/* 일정이 며칠에 걸치는지 (0 = 하루 안에 끝남) */
function spanDays(task) { return task.endDate ? Math.max(0, daysBetween(task.date, task.endDate)) : 0; }
/* 반복 규칙: { kind: none|daily|weekly|monthly|yearly, every: N, days?: [1~7] }
   매월은 시작일과 같은 날짜(그 달에 그 날짜가 없으면 건너뜀), 매년은 같은 월·일 */
function occursOn(task, date) {
  if (date < task.date) return false;
  if (task.until && date > task.until) return false;
  const r = task.repeat, every = Math.max(1, r.every || 1);
  const a = parseYmd(task.date), b = parseYmd(date);
  switch (r.kind) {
    case 'none': return date === task.date;
    case 'interval': // 예전 저장 형식 (n일마다)
    case 'daily': return daysBetween(task.date, date) % (r.kind === 'interval' ? r.every : every) === 0;
    case 'weekly': return r.days.includes(weekday(date)) && Math.floor(daysBetween(weekStartOf(task.date), weekStartOf(date)) / 7) % every === 0;
    case 'monthly': return b.getDate() === a.getDate() && ((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()) % every === 0;
    case 'yearly': return b.getDate() === a.getDate() && b.getMonth() === a.getMonth() && (b.getFullYear() - a.getFullYear()) % every === 0;
  }
  return false;
}
/* 회차의 시작·종료·마감 시각 (ms). 종일 일정은 시작일 0시 ~ 종료일 다음 날 0시 */
function occWindow(task, date) {
  const start = at(date, task.allDay ? '00:00' : task.start);
  const end = start + durOf(task) * MIN;
  let deadline = null;
  if (task.type === 'jab' && task.deadline && task.deadline.enabled) {
    if (task.deadline.sameAsEnd) deadline = end;
    else deadline = at(addDays(date, daysBetween(task.date, task.deadline.date)), task.deadline.time);
  }
  return { start, end, deadline };
}
/* 걸리는 시간(분) — 시작·종료 일시에서 계산 (옛 일정은 저장된 duration) */
function durOf(task) {
  if (task.endDate && task.end) {
    const s = at(task.date, task.allDay ? '00:00' : task.start);
    const e = task.allDay ? at(addDays(task.endDate, 1), '00:00') : at(task.endDate, task.end);
    return Math.max(1, Math.round((e - s) / MIN));
  }
  return task.duration || 60;
}
const REPEAT_UNIT = { daily: '일', weekly: '주', monthly: '달', yearly: '년' };
function repeatText(task) {
  const r = task.repeat;
  if (r.kind === 'none') return '반복 안 함';
  if (r.kind === 'interval') return r.every === 1 ? '매일' : `${r.every}일마다`;
  const every = Math.max(1, r.every || 1);
  const head = every === 1 ? { daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년' }[r.kind] : `${every}${REPEAT_UNIT[r.kind]}마다`;
  if (r.kind === 'weekly') {
    const d = [...r.days].sort((x, y) => dayRank(x) - dayRank(y));
    if (every === 1 && d.length === 7) return '매일';
    if (every === 1 && d.join() === '1,2,3,4,5') return '평일마다';
    if (every === 1 && [...d].sort().join() === '6,7') return '주말마다';
    return `${head} ${d.map((x) => WD[x]).join('·')}요일`;
  }
  if (r.kind === 'monthly') return `${head} ${parseYmd(task.date).getDate()}일`;
  if (r.kind === 'yearly') return `${head} ${fmtMD(task.date)}`;
  return head;
}
/* 옛 일정(날짜 + 시작 + 걸리는 시간)을 새 구조(시작·종료 일시)로 바꾼다. 이미 바뀐 일정은 그대로 */
function migrateTask(t) {
  if (!t.repeat) t.repeat = { kind: 'none' };
  if (!t.start) t.start = '18:00';
  if (!t.endDate) {
    const endMin = hmToMin(t.start) + (t.duration || 60);
    t.endDate = addDays(t.date, Math.floor(endMin / 1440));
    t.end = minToHm(endMin);
  }
  if (t.allDay === undefined) t.allDay = false;
  if (!t.alarms) t.alarms = [];
  if (!t.color) t.color = t.type === 'jab' ? 'coral' : 'sky';
  if (t.memo === undefined) t.memo = '';
  if (t.repeat.kind === 'interval') t.repeat = { kind: 'daily', every: t.repeat.every || 1 };
  if (!t.repeat.every) t.repeat.every = 1;
  if (t.deadline && t.deadline.sameAsEnd === undefined) t.deadline.sameAsEnd = false;
  if (t.type === 'jab' && t.jabOn === undefined) t.jabOn = true;
  t.duration = durOf(t);
  return t;
}
/* 그 날짜에 걸쳐 있는 회차 (여러 날 일정은 둘째 날부터도 보인다). dayNo = 일정 며칠째 (1부터) */
function occurrencesCovering(m, date) {
  const out = [];
  for (const t of m.tasks) {
    for (let k = 0; k <= spanDays(t); k++) {
      const sd = addDays(date, -k);
      if (occursOn(t, sd)) { out.push({ ...occState(m, t, sd), dayNo: k + 1, days: spanDays(t) + 1 }); break; }
    }
  }
  return out.sort((a, b) => (b.task.allDay - a.task.allDay) || (a.dayNo > 1) - (b.dayNo > 1) || a.w.start - b.w.start);
}
/* 회차의 현재 상태: upcoming / late / running / urgent / break / breakOver / overPlan / overdue / missedStart / done / failed / past (일반 일정: todo / done) */
function occState(m, task, date, t = now()) {
  const key = occKey(task.id, date);
  const run = m.runs[key];
  const w = occWindow(task, date);
  const base = { key, task, date, w, run };
  if (task.type === 'normal' || task.jabOn === false) return { ...base, kind: run && run.status === 'done' ? 'done' : 'todo' };
  if (run && run.status === 'done') return { ...base, kind: 'done' };
  if (run && run.status === 'failed') return { ...base, kind: 'failed' };
  const td = ymd(t);
  if (run && run.status === 'running') {
    if (w.deadline && t >= w.deadline) return { ...base, kind: 'overdue' };
    if (run.brk && !run.brk.ended) return { ...base, kind: t < run.brk.until ? 'break' : 'breakOver' };
    if (w.deadline && w.deadline - t <= HEAT_POLICY.urgentWindow * MIN) return { ...base, kind: 'urgent' };
    if (!w.deadline && t > w.end) return { ...base, kind: 'overPlan' };
    return { ...base, kind: 'running' };
  }
  if (date > td) return { ...base, kind: 'upcoming' };
  if (date < td) return { ...base, kind: 'past' };
  if (t < w.start) return { ...base, kind: 'upcoming' };
  if (w.deadline && t >= w.deadline) return { ...base, kind: 'missedStart' };
  return { ...base, kind: 'late' };
}
const ACTIVE_KINDS = ['running', 'urgent', 'break', 'breakOver', 'overPlan', 'overdue'];
const KIND_LABEL = {
  upcoming: '예정', late: '시작 전', running: '진행 중', urgent: '마감 임박', break: '휴식 중', breakOver: '휴식 초과',
  overPlan: '예정 시간 지남', overdue: '마감 도달', missedStart: '마감 지남', done: '완료', failed: '실패', past: '지난 회차', todo: '할 일',
};
function occurrencesOn(m, date) {
  return m.tasks.filter((t) => occursOn(t, date)).map((t) => occState(m, t, date))
    .sort((a, b) => a.w.start - b.w.start);
}
function runningOcc(m) {
  for (const [k, r] of Object.entries(m.runs)) {
    if (r.status !== 'running') continue;
    const [tid, d] = splitKey(k);
    const t = findTask(m, tid);
    if (t) return occState(m, t, d);
  }
  return null;
}

/* ---------- 잡도리 세기 계산 (FN04) — 0~100 숫자 하나. 이름은 scaleOf()가 붙인다 ---------- */
function heatOf(st, t = now()) {
  const P = HEAT_POLICY, task = st.task;
  const H0 = task.heat, room = 100 - H0, w = st.w, run = st.run;
  if (st.kind === 'done' || st.kind === 'failed') return { total: run.endHeat ?? H0, parts: [] };
  const parts = [{ label: '시작 ' + scaleOf().short, v: H0, base: true }];
  if (st.kind === 'upcoming' || st.kind === 'past') return { total: H0, parts };
  if (st.kind === 'overdue' || st.kind === 'missedStart') {
    parts.push({ label: '마감 시각 도달', v: 100 - H0 });
    return { total: 100, parts };
  }
  const winEnd = w.deadline ?? w.end;
  const span = Math.max(1, (winEnd - w.start) / MIN);
  const elapsed = Math.max(0, (t - w.start) / MIN);
  const p = Math.min(1, elapsed / span);
  if (p > 0) parts.push({ label: `시간 경과 ${Math.round(p * 100)}%`, v: room * P.progressShare * p });
  if (w.deadline) {
    const rem = (w.deadline - t) / MIN;
    if (rem <= P.urgentWindow && rem > 0) parts.push({ label: '마감 임박', v: room * P.urgentShare * (1 - rem / P.urgentWindow) + P.urgentBump });
  }
  if (st.kind === 'late') {
    const late = (t - w.start) / MIN;
    const v = Math.min(P.lateMax, late * P.latePerMin);
    if (v > 0) parts.push({ label: `시작 안 함 ${Math.round(late)}분`, v });
  }
  if (run && run.slack && run.slack.length) {
    let s = 0;
    for (const e of run.slack) {
      const since = (t - e.at) / MIN;
      const bump = e.choice === 'study' ? 0 : e.choice === 'rest' ? P.slackRest : e.choice === 'focus' ? P.slackFocus : P.slackBump;
      if (since >= 0 && since < P.slackDecay) s += bump * (1 - since / P.slackDecay);
    }
    if (s > 0.5) parts.push({ label: `딴짓 ${run.slack.length}회`, v: s });
  }
  if (st.kind === 'breakOver') {
    const over = (t - run.brk.until) / MIN;
    parts.push({ label: `휴식 초과 ${Math.round(over)}분`, v: Math.min(P.overBreakMax, over * P.overBreakPerMin) });
  }
  const total = clamp(Math.round(parts.reduce((a, b) => a + b.v, 0)), 0, 100);
  return { total, parts };
}

/* ---------- 캐릭터 반응 고르기: 일정 상태 → 표정·자세·동작·부풂 (모든 캐릭터 공통 약속) ---------- */
// ctx: { lateMin, elapsedMin, penalty, streak, early, bucket }
function mascotFor(kind, stage, ctx = {}) {
  const pen = Math.max(0, (ctx.penalty || 0) - 1) * 0.25; // 반복 실패: 평소에도 조금 부풀어 있음
  const F = (v) => clamp(v + pen, 0, 1);
  const idle = (ctx.bucket || 0) % 2 ? 'look' : 'breathe'; // 같은 상태에서도 동작을 번갈아
  switch (kind) {
    case 'done':
      if ((ctx.streak || 0) >= 2) return { expr: 'proud', pose: 'flag', motion: 'jump', fluff: 0 };
      if (ctx.early) return { expr: 'surprised', pose: 'cheer', motion: 'jump', fluff: 0 };
      return { expr: 'happy', pose: 'cheer', motion: 'jump', fluff: 0 };
    case 'failed': return { expr: 'disappointed', pose: 'idle', motion: 'breathe', fluff: F(0.1) };
    case 'break': return { expr: 'sleepy', pose: 'curl', motion: 'sleep', fluff: 0 };
    case 'breakOver': return { expr: 'suspicious', pose: 'nag', motion: 'nag', fluff: F(0.2) };
    case 'overPlan': return { expr: 'suspicious', pose: 'nag', motion: 'nag', fluff: F(0.2) };
    case 'overdue': case 'missedStart': return { expr: 'furious', pose: 'puff', motion: 'puff', fluff: 1 };
    case 'upcoming': return { expr: 'default', pose: 'idle', motion: 'look', fluff: F(0) };
    case 'urgent': return stage >= 5 ? { expr: 'furious', pose: 'puff', motion: 'puff', fluff: 1 } : { expr: 'angry', pose: 'puff', motion: 'puff', fluff: F(0.6) };
    case 'late':
      if ((ctx.lateMin ?? 99) < 3) return { expr: 'focus', pose: 'nag', motion: 'nag', fluff: F(0) };
      if (stage <= 2) return { expr: 'suspicious', pose: 'idle', motion: 'look', fluff: F(0.1) };
      if (stage === 3) return { expr: 'suspicious', pose: 'nag', motion: 'nag', fluff: F(0.3) };
      if (stage === 4) return { expr: 'angry', pose: 'puff', motion: 'puff', fluff: F(0.65) };
      return { expr: 'furious', pose: 'puff', motion: 'puff', fluff: 1 };
    case 'running':
      if ((ctx.elapsedMin ?? 99) < 5) return { expr: 'happy', pose: 'cheer', motion: 'bounce', fluff: 0 };
      if (stage <= 2) return { expr: 'focus', pose: 'check', motion: 'check', fluff: 0 };
      if (stage === 3) return { expr: 'focus', pose: 'idle', motion: idle, fluff: F(0.05) };
      if (stage === 4) return { expr: 'angry', pose: 'nag', motion: 'nag', fluff: F(0.5) };
      return { expr: 'furious', pose: 'puff', motion: 'puff', fluff: 1 };
    default: return { expr: 'default', pose: 'idle', motion: idle, fluff: F(0) };
  }
}
/* 강도 단계별 예시 반응 (온보딩·등록 화면) */
function mascotForStage(sg) {
  return [null,
    { expr: 'default', pose: 'idle', motion: 'breathe', fluff: 0 },
    { expr: 'suspicious', pose: 'idle', motion: 'look', fluff: 0.1 },
    { expr: 'suspicious', pose: 'nag', motion: 'nag', fluff: 0.3 },
    { expr: 'angry', pose: 'puff', motion: 'puff', fluff: 0.65 },
    { expr: 'furious', pose: 'puff', motion: 'puff', fluff: 1 }][sg];
}
/* 현재 회원의 캐릭터로 그리기 */
function mascot(m, o = {}) {
  const c = charOf(m); // 옷 갈아입기는 없앴다 — 언제나 기본 모습
  const label = o.label || `${c.name}, ${EXPR_LABEL[o.expr] || '기본'}`;
  return c.art({ ...o, label });
}

/* ---------- 페르소나 말 만들기 ---------- */
function leftText(st, t = now()) {
  if (st.w.deadline) {
    const r = (st.w.deadline - t) / MIN;
    return r > 0 ? `마감까지 ${fmtDur(r)}` : '마감 지남';
  }
  const r = (st.w.end - t) / MIN;
  return r > 0 ? `예정 종료까지 ${fmtDur(r)}` : '예정 시간 지남';
}
function lineFor(st, heat, t = now()) {
  const L = persona().lines, stage = stageOf(heat).id, title = st.task.title, run = st.run;
  const elapsedMin = Math.max(0, (t - (run && run.startedAt ? run.startedAt : st.w.start)) / MIN);
  const bucket = Math.floor(elapsedMin / 10);
  const v = {
    title, app: '',
    startIn: fmtDur((st.w.start - t) / MIN),
    late: fmtDur((t - st.w.start) / MIN),
    left: leftText(st, t),
    remain: st.w.deadline ? fmtDur((st.w.deadline - t) / MIN) : '',
    elapsed: fmtDur(elapsedMin),
    breakLeft: run && run.brk ? fmtDur(Math.max(0, (run.brk.until - t) / MIN)) : '',
    over: run && run.brk ? fmtDur(Math.max(0, (t - run.brk.until) / MIN)) : '',
  };
  let pick, fact = title;
  const k = st.key;
  switch (st.kind) {
    case 'upcoming': pick = pickLine(k + ':up', L.upcoming, 0); fact = `${title} · ${v.startIn} 뒤 시작`; break;
    case 'late': {
      const lateMin = (t - st.w.start) / MIN;
      pick = lateMin < 3 ? pickLine(k + ':due', L.due, 0) : pickLine(k + ':late' + stage, L.late[stage], bucket);
      fact = lateMin < 3 ? `${title} · 지금 시작` : `${title} · ${v.late} 지남${st.w.deadline ? ' · ' + v.left : ''}`;
      break;
    }
    case 'running':
      if (run && run.studyUntil && t < run.studyUntil) { pick = pickLine(k + ':study', L.studying, 0); fact = `${title} · 강의 확인 ${fmtDur(Math.max(1, (run.studyUntil - t) / MIN))} 뒤`; break; }
      pick = elapsedMin < 5 ? pickLine(k + ':js', L.justStarted, 0) : pickLine(k + ':run' + stage, L.running[stage], bucket);
      fact = elapsedMin < 5 ? `${title} · 시작함` : `${title} · ${v.elapsed} 함 · ${v.left}`;
      break;
    case 'urgent': pick = pickLine(k + ':urg', L.urgent, Math.floor(elapsedMin / 5)); fact = `${title} · 마감까지 ${v.remain}`; break;
    case 'break': pick = pickLine(k + ':brk', L.break, 0); fact = `휴식 ${v.breakLeft} 남음`; break;
    case 'breakOver': pick = pickLine(k + ':brko', L.breakOver, 0); fact = `휴식 ${v.over} 넘김`; break;
    case 'overPlan': pick = pickLine(k + ':over', L.overPlan, 0); fact = `${title} · 예정 종료 지남`; break;
    case 'overdue': pick = pickLine(k + ':od', L.overdue, 0); fact = `${title} · 마감 시각`; break;
    case 'missedStart': pick = pickLine(k + ':ms', L.missedStart, 0); fact = `${title} · 시작 못 하고 마감 지남`; break;
    case 'done': pick = { tpl: run.line || L.doneNone[0], id: k + ':done' }; break;
    case 'failed': pick = { tpl: run.line || L.failed[0], id: k + ':fail' }; break;
    default: pick = { tpl: '', id: k };
  }
  // 대사는 정보 없이 그대로(녹음과 같은 글자), 일정 이름·시간은 fact(정보 줄)로
  return { id: pick.id, text: fillLine(pick.tpl, v), fact };
}

/* ---------- 실행 기록 조작 ---------- */
/* 로그는 숫자를 따로 저장해 두고(data), 보여 줄 때 지금 눈금 이름으로 문장을 만든다 (logText) */
function logRun(run, kind, text, data) { run.log.push({ at: now(), kind, text, ...(data || {}) }); }
function logText(e) {
  if (e.kind === 'heat' && e.h != null) return `${lvs(e.h)} — ${stageOf(e.h).name} 단계로 올라감`;
  if (e.kind === 'floor' && e.a != null) return `${scaleOf().floor} ${lv(e.a)} → ${lv(e.b)}`;
  return e.text;
}
function startOcc(m, st) {
  const run = m.runs[st.key] = m.runs[st.key] || {};
  Object.assign(run, {
    status: 'running', startedAt: now(), slack: [], log: [], peak: 0, lastStage: 0,
    title: st.task.title, startHeat: st.task.heat, plan: { start: st.w.start, end: st.w.end, deadline: st.w.deadline },
  });
  const late = Math.round((now() - st.w.start) / MIN);
  logRun(run, 'start', late > 0 ? `${late}분 늦게 시작` : late < 0 ? `${-late}분 일찍 시작` : '제시간에 시작');
  return run;
}
function trackHeat(m) {
  // 진행 중 회차의 최고값과 단계 변화를 기록 (시간이 흐를 때마다 호출)
  for (const [k, r] of Object.entries(m.runs)) {
    if (r.status !== 'running') continue;
    const [tid, d] = splitKey(k);
    const t = findTask(m, tid); if (!t) continue;
    const st = occState(m, t, d);
    const h = heatOf(st).total;
    r.peak = Math.max(r.peak || 0, h);
    const sg = stageOf(h).id;
    if (sg > (r.lastStage || 0)) {
      if (r.lastStage) logRun(r, 'heat', `${h} — ${sg}단계로 올라감`, { h });
      r.lastStage = sg;
    }
    if (st.kind === 'urgent' && !r.urgentLogged) { r.urgentLogged = true; logRun(r, 'urgent', '마감 30분 전 — 마감 임박'); }
    if (st.kind === 'overdue' && !r.overdueLogged) { r.overdueLogged = true; logRun(r, 'deadline', '마감 시각 도달'); }
  }
}
function finishOcc(m, st, success, extra = {}) {
  const t = now();
  let run = m.runs[st.key];
  if (!run || run.status !== 'running') {
    run = m.runs[st.key] = Object.assign(run || {}, {
      startedAt: null, slack: [], log: [], peak: 0, title: st.task.title, startHeat: st.task.heat,
      plan: { start: st.w.start, end: st.w.end, deadline: st.w.deadline },
    });
  }
  const h = heatOf(st, t).total;
  run.endHeat = h;
  run.peak = Math.max(run.peak || 0, h);
  run.endedAt = t;
  run.floorBefore = floorOf(m);
  run.penaltyBefore = m.penalty;
  run.streakBefore = m.streak;
  const L = persona().lines;
  if (success) {
    run.status = 'done';
    m.streak += 1;
    run.cooled = false;
    if (m.streak >= HEAT_POLICY.coolStreak && m.penalty > 0) { m.penalty -= 1; m.streak = 0; run.cooled = true; }
    let pool = L.doneNone;
    if (st.w.deadline) pool = (st.w.deadline - t) / MIN >= 20 ? L.doneEarly : L.doneClose;
    if (m.streak >= 2 && !(m.streak >= HEAT_POLICY.coolStreak && m.penalty > 0)) pool = L.doneProud;
    const span = (st.w.deadline ?? st.w.end) - st.w.start;
    run.early = span > 0 && ((st.w.deadline ?? st.w.end) - t) / span >= 0.5; // 예상보다 훨씬 빨리 끝냄 → 놀람
    const pk = pickLine(st.key + ':result', pool, 1);
    run.line = run.cooled ? L.cooled[0] : pk.tpl; // 대사는 정보 없이 (마감까지 남았던 시간은 결과 화면에 따로)
    logRun(run, 'done', '완료');
  } else {
    run.status = 'failed';
    m.penalty = Math.min(maxPenalty(m), m.penalty + 1);
    m.streak = 0;
    run.excuse = extra.excuse || null;
    run.reason = extra.reason || null;
    run.line = pickLine(st.key + ':result', L.failed, 1).tpl;
    logRun(run, 'fail', extra.reason ? `실패 — ${extra.reason}` : '실패');
  }
  run.floorAfter = floorOf(m);
  if (run.floorAfter !== run.floorBefore) logRun(run, 'floor', `${run.floorBefore} → ${run.floorAfter}`, { a: run.floorBefore, b: run.floorAfter });
  return run;
}
function undoRun(m, key) {
  const r = m.runs[key]; if (!r) return;
  if (r.status === 'done' || r.status === 'failed') { m.penalty = r.penaltyBefore ?? m.penalty; m.streak = r.streakBefore ?? m.streak; }
  delete m.runs[key];
}

/* 날이 바뀌면, 결과 없이 지나간 잡도리 회차를 실패로 정리 (정책 예시) */
function settleDays(m) {
  const td = today();
  if (!m) return [];
  const settled = [];
  const from = state.settledDay && state.settledDay < td ? state.settledDay : null;
  if (!from) { state.settledDay = td; return settled; }
  const startD = daysBetween(from, td) > 14 ? addDays(td, -14) : from;
  for (let d = startD; d < td; d = addDays(d, 1)) {
    for (const task of m.tasks) {
      if (task.type !== 'jab' || !occursOn(task, d)) continue;
      if (at(d, '23:59') < task.createdAt) continue;
      const st = occState(m, task, d, at(d, '23:59'));
      if (st.kind === 'done' || st.kind === 'failed' || st.kind === 'upcoming') continue;
      const keep = state.clock;
      state.clock = at(d, '23:59');
      finishOcc(m, occState(m, task, d), false, { reason: '결과 없이 날이 바뀜' });
      state.clock = keep;
      settled.push(task.title);
    }
  }
  state.settledDay = td;
  return settled;
}
