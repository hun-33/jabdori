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
const WD = ['', '월', '화', '수', '목', '금', '토', '일'];

function ymd(d) { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function at(dateStr, hm) { const d = parseYmd(dateStr); const [h, mi] = hm.split(':').map(Number); d.setHours(h, mi, 0, 0); return d.getTime(); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / DAY); }
function weekday(s) { const w = parseYmd(s).getDay(); return w === 0 ? 7 : w; }
function mondayOf(s) { return addDays(s, 1 - weekday(s)); }
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
function josa(word, pair) { // pair: '을/를', '이/가', '은/는', '와/과', '으로/로'
  const c = String(word).trim().slice(-1).charCodeAt(0);
  const [a, b] = pair.split('/');
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
  progressShare: 0.6,   // 시간 경과로 오르는 몫 (여유 온도 대비)
  urgentShare: 0.4,     // 마감 임박 구간에서 오르는 몫
  urgentWindow: 30,     // 마감 임박 기준 (분)
  urgentBump: 5,        // 임박 진입 즉시 가산
  latePerMin: 0.25,     // 미시작 1분당 가산
  lateMax: 15,
  slackBump: 10,        // 딴짓(응답 전) 가산
  slackRest: 3,         // '잠깐 쉴게' 선택 시
  slackFocus: 6,        // '다시 집중할게' 선택 시
  slackDecay: 20,       // 딴짓 가산이 식는 시간 (분)
  studyRecheck: 10,     // '공부 중' 선택 후 다시 확인까지 (분)
  breakMinutes: 5,
  overBreakPerMin: 1,
  overBreakMax: 10,
  failStep: 10,         // 실패 1회당 바닥 온도 상승
  floorMax: 90,
  coolStreak: 3,        // 연속 성공 n회 시 가산 1단계 해제
  sliderMin: 20,
  initialHeat: 50,
};
const STAGES = [
  { id: 1, name: '미지근', min: 0, desc: '살살 달래요. 시작만 챙겨 줘요.' },
  { id: 2, name: '따끈', min: 30, desc: '가볍게 잔소리해요.' },
  { id: 3, name: '뜨끈', min: 50, desc: '미루면 바로 재촉해요.' },
  { id: 4, name: '부글', min: 70, desc: '도발 섞인 독촉이 들어가요.' },
  { id: 5, name: '펄펄', min: 90, desc: '봐주는 거 없어요. 최고 수위예요.' },
];
function stageOf(h) { let s = STAGES[0]; for (const st of STAGES) if (h >= st.min) s = st; return s; }

/* ---------- 페르소나: 미루먼지 (공식 마스코트, 그림은 01b-mireum.js) ---------- */
const PERSONA = {
  id: 'mireum',
  name: '미루먼지',
  role: '1:1 전담 잡도리 매니저',
  traits: ['미룬 일에서 태어난 작은 구름', '미룰수록 부풀고 털이 곤두섬', '잘하면 진심으로 기뻐함', '모욕은 안 함'],
  lines: {
    empty: ['오늘도 미룰 거야? 맡길 일부터 하나 올려 봐.', '할 일 없어? 진짜로? 미뤄 둔 거 하나쯤은 있을 텐데.', '심심하다… 미루는 일 생기면 바로 나한테 맡겨.'],
    noneToday: ['오늘은 내가 맡은 일이 없어. 쉬는 날이면 제대로 쉬어.', '오늘 잡도리는 없음. 다음 일정은 내가 기억하고 있어.'],
    allDone: ['오늘 맡긴 일 다 끝냈어. 나 오늘은 작아져서 쉰다.', '다 했네! 이런 날만 있으면 내가 사라지겠다.', '오늘 몫은 끝. 남은 시간은 마음 편히 써.'],
    upcoming: ['{title}, {startIn} 뒤 시작이야. 기다리고 있을게.', '{startIn} 남았어. 시작할 때 딴소리하기 없기.', '곧 {title} 시간이야. 내가 계속 보고 있다?'],
    due: ['{title} 시작할 시간이야. 지금 바로 가자.', '이제 슬슬 움직여야 하지 않아?', '땡. {title} 시작 시간이다.'],
    late: {
      1: ['{late} 지났어. 천천히라도 시작해 볼까?', '아직 시작 전이네. 부담 갖지 말고 하나만 열어 봐.', '이제 슬슬 움직여야 하지 않아?'],
      2: ['아직 시작 안 했어? {late} 지났다.', '슬슬 시작하자. {title} 혼자 안 끝난다.', '미루는 거 다 보여. 지금 열기만 해.'],
      3: ['아직 시작 안 했어? {late}째 기다리는 중이야.', '오늘도 미룰 거야? 앉기만 해.', '{late} 늦었어. 더 늦으면 나 부풀어 오른다.'],
      4: ['{late}째 그대로네. 나 점점 커진다.', '핑계 생각할 시간에 첫 줄 써. 폰 내려놔.', '{left}. 이 속도면 진짜 큰일 나.'],
      5: ['{left}인데 아직도 시작 전이야?', '이제 진짜 시작해. 더는 안 봐준다.', '털 다 곤두섰어. 당장 열어.'],
    },
    justStarted: ['좋아, 시작했네! 첫 10분만 버티면 탄력 붙는다.', '시작한 거 봤다. 이제 딴 데 보지 마.', '출발 좋다. 나는 옆에서 체크하고 있을게.'],
    running: {
      1: ['좋아, 이 페이스면 충분해.', '조용히 지켜볼게. 하던 거 계속해.', '천천히 가도 돼. 멈추지만 마.'],
      2: ['잘 가고 있어. 중간에 딴 데 새지 말고.', '내가 계속 보고 있다? 리듬 좋아.', '{elapsed} 했어. 리듬 좋다.'],
      3: ['{elapsed} 했어. 아직 갈 길 남았다?', '손 멈추지 마. 지금 리듬 좋아.', '{left}. 속도 조금만 더 내 보자.'],
      4: ['{left}. 이대로면 빠듯해.', '폰 내려놔. 딴생각 들면 한 줄 더 써.', '슬슬 열 오른다. 속도 올려.'],
      5: ['{left}. 지금 아니면 없다.', '나 지금 터지기 직전이야. 끝까지 밀어붙여.', '마지막 스퍼트. 여기서 딴짓하면 진짜 화낸다.'],
    },
    urgent: ['마감 {remain} 전. 이제 다듬지 말고 마무리부터 해.', '{remain} 남았다. 제출할 곳은 열어 놨지?', '털 곤두선다. {remain} 안에 끝내.', '여기서 놓치면 다음 판은 더 세게 간다.', '완벽 말고 완료. {remain} 남았어.'],
    overdue: ['마감 시간이야. 끝냈어, 못 끝냈어? 솔직하게.', '땡. 마감이다. 결과부터 말해 봐.'],
    missedStart: ['시작도 안 했는데 마감이 지났어. 결과 정리하자.', '또 미뤘네… 이번 건 솔직하게 기록하자.'],
    overPlan: ['예정 시간 지났어. 끝났으면 끝났다고 말해.', '예정보다 길어지네. 마무리 지점 정하고 가자.'],
    break: ['쉬는 중. {breakLeft} 남았어. 딱 그만큼만.', '물 한 잔 마시고 와. {breakLeft} 뒤에 부른다.', '숨 돌려. 대신 {breakLeft} 뒤엔 바로 돌아와.'],
    breakOver: ['휴식 {over} 넘겼어. 이제 돌아와.', '5분이라며. 벌써 {over} 더 쉬었다.', '쉬는 시간 끝난 지 {over}. 나 다시 부푼다?'],
    slackAsk: ['잠깐, 지금 {app} 켰지?', '{title} 하다가 {app}? 설명해 봐.', '딴짓 감지! {app}에서 뭐 하는 중이야?'],
    slackStudy: ['강의 영상이면 인정. 대신 10분 뒤에 다시 확인한다.', '공부용이라니 믿어 볼게. 10분 뒤에 또 볼 거야.'],
    slackRest: ['5분만이다. 시계 보고 있을게.', '좋아, 5분 휴식. 넘기면 나 다시 커진다.'],
    slackFocus: ['좋아. 그 말 믿는다. 바로 돌아가.', '그래, 그거면 됐어. 창 닫고 이어서 해.'],
    slackIdle: ['지금은 맡긴 일이 없으니 봐줄게. 대신 시작 시간엔 안 봐준다.'],
    slackBreak: ['쉬는 시간이니까 봐줄게. 휴식 끝나면 바로 닫아.'],
    studyCheck: ['10분 지났어. 아직 강의 보는 중이야?'],
    studyMore: ['좋아, 딱 10분만 더. 그다음엔 과제다.'],
    studyBack: ['그래, 이제 진짜 과제다. 가자.'],
    doneEarly: ['오! 드디어 해냈어! 마감 {margin} 전이야.', '이번에는 진짜 잘했어!', '봐, 하면 되잖아. 나 지금 엄청 작아졌어.'],
    doneClose: ['아슬아슬했지만 해냈다. 다음엔 조금만 일찍 하자.', '마감 직전에 끝냈네. 심장 쫄깃했다.', '해냈으면 됐어. 다음엔 덜 부풀게 해 줘.'],
    doneNone: ['오! 드디어 해냈어! {title} 끝.', '끝냈네. 오늘 할 일 하나 지웠다.'],
    doneProud: ['연속으로 해냈어! 나 너무 뿌듯해.', '이번에는 진짜 잘했어! 이 흐름 그대로 가자.'],
    failed: ['또 미뤘네… 다음엔 봐주지 않는다.', '이번 건 놓쳤다. 다음 판은 강도부터 올리고 간다.', '실망이야… 그래도 포기 안 해. 다음에 갚아.'],
    cooled: ['세 번 연속 해냈네! 약속대로 바닥 한 칸 내려 줄게.'],
    saved: ['오, 새 일정이다. {title}, 내가 확인했어.', '{title} 접수. {start}에 내가 부를게.'],
    welcome: ['반가워! 오늘도 미룰 거야?', '왔구나. 내가 계속 보고 있었어.'],
    excuse: {
      time: '시간이 모자랐으면 다음엔 더 일찍 시작하자. 내가 일찍 부를게.',
      slack: '솔직해서 좋다. 다음엔 딴짓하는 순간 바로 잡는다.',
      condition: '몸 상태가 안 좋았으면 어쩔 수 없지. 회복부터 해.',
      hard: '어려웠으면 쪼개서 가자. 다음엔 첫 단계만 맡겨 봐.',
      none: '말 안 해도 알아. 다음엔 기록 바꿔 보자.',
    },
    sample: { // 강도 설명용 예시 (온보딩·등록 화면)
      1: '시간 됐어. 천천히라도 시작해 볼까?',
      2: '아직 시작 안 했어? 슬슬 하자.',
      3: '오늘도 미룰 거야? 10분째 기다리는 중이야.',
      4: '핑계 생각할 시간에 첫 줄 써. 폰 내려놔.',
      5: '털 다 곤두섰어. 당장 해.',
    },
  },
};

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
    ttsAuto: false,
    settledDay: ymd(BASE_CLOCK),
  };
}
let storageOK = true;
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return Object.assign(freshState(), s); }
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

/* ---------- 회원·바닥 온도 ---------- */
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
    costume: 'basic',
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
function occursOn(task, date) {
  if (date < task.date) return false;
  const r = task.repeat;
  switch (r.kind) {
    case 'none': return date === task.date;
    case 'weekly': return r.days.includes(weekday(date));
    case 'daily': return true;
    case 'interval': return daysBetween(task.date, date) % r.every === 0;
  }
  return false;
}
function occWindow(task, date) {
  const start = at(date, task.start);
  const end = start + task.duration * MIN;
  let deadline = null;
  if (task.type === 'jab' && task.deadline && task.deadline.enabled) {
    const off = daysBetween(task.date, task.deadline.date);
    deadline = at(addDays(date, off), task.deadline.time);
  }
  return { start, end, deadline };
}
function repeatText(task) {
  const r = task.repeat;
  if (r.kind === 'none') return '반복 안 함';
  if (r.kind === 'daily') return '매일';
  if (r.kind === 'interval') return `${r.every}일마다`;
  const d = [...r.days].sort();
  if (d.length === 7) return '매일';
  if (d.join() === '1,2,3,4,5') return '평일마다';
  if (d.join() === '6,7') return '주말마다';
  return '매주 ' + d.map((x) => WD[x]).join('·') + '요일';
}
/* 회차의 현재 상태: upcoming / late / running / urgent / break / breakOver / overPlan / overdue / missedStart / done / failed / past (일반 일정: todo / done) */
function occState(m, task, date, t = now()) {
  const key = occKey(task.id, date);
  const run = m.runs[key];
  const w = occWindow(task, date);
  const base = { key, task, date, w, run };
  if (task.type === 'normal') return { ...base, kind: run && run.status === 'done' ? 'done' : 'todo' };
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

/* ---------- 잡도리 온도 계산 (FN04) ---------- */
function heatOf(st, t = now()) {
  const P = HEAT_POLICY, task = st.task;
  const H0 = task.heat, room = 100 - H0, w = st.w, run = st.run;
  if (st.kind === 'done' || st.kind === 'failed') return { total: run.endHeat ?? H0, parts: [] };
  const parts = [{ label: '시작 온도', v: H0, base: true }];
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

/* ---------- 미루먼지 반응 고르기: 일정 상태 → 표정·자세·동작·부풂 ---------- */
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
/* 현재 회원의 코스튬을 넣어 그리기 */
function mascot(m, o = {}) {
  const costume = o.costume || (m && m.costume) || 'basic';
  const label = o.label || `${PERSONA.name}, ${EXPR_LABEL[o.expr] || '기본'}`;
  return mireumSVG({ ...o, costume, label });
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
  const L = PERSONA.lines, stage = stageOf(heat).id, title = st.task.title, run = st.run;
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
  let pick;
  const k = st.key;
  switch (st.kind) {
    case 'upcoming': pick = pickLine(k + ':up', L.upcoming, 0); break;
    case 'late': {
      const lateMin = (t - st.w.start) / MIN;
      pick = lateMin < 3 ? pickLine(k + ':due', L.due, 0) : pickLine(k + ':late' + stage, L.late[stage], bucket);
      break;
    }
    case 'running':
      if (run && run.studyUntil && t < run.studyUntil) { pick = { tpl: '강의 보는 중이라며. 10분 뒤에 다시 물어본다.', id: k + ':studying' }; break; }
      pick = elapsedMin < 5 ? pickLine(k + ':js', L.justStarted, 0) : pickLine(k + ':run' + stage, L.running[stage], bucket); break;
    case 'urgent': pick = pickLine(k + ':urg', L.urgent, Math.floor(elapsedMin / 5)); break;
    case 'break': pick = pickLine(k + ':brk', L.break, 0); break;
    case 'breakOver': pick = pickLine(k + ':brko', L.breakOver, 0); break;
    case 'overPlan': pick = pickLine(k + ':over', L.overPlan, 0); break;
    case 'overdue': pick = pickLine(k + ':od', L.overdue, 0); break;
    case 'missedStart': pick = pickLine(k + ':ms', L.missedStart, 0); break;
    case 'done': pick = { tpl: run.line || L.doneNone[0], id: k + ':done' }; break;
    case 'failed': pick = { tpl: run.line || L.failed[0], id: k + ':fail' }; break;
    default: pick = { tpl: '', id: k };
  }
  return { id: pick.id, text: fillLine(pick.tpl, v) };
}

/* ---------- 실행 기록 조작 ---------- */
function logRun(run, kind, text) { run.log.push({ at: now(), kind, text }); }
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
  // 진행 중 회차의 최고 온도와 단계 변화를 기록 (시간이 흐를 때마다 호출)
  for (const [k, r] of Object.entries(m.runs)) {
    if (r.status !== 'running') continue;
    const [tid, d] = splitKey(k);
    const t = findTask(m, tid); if (!t) continue;
    const st = occState(m, t, d);
    const h = heatOf(st).total;
    r.peak = Math.max(r.peak || 0, h);
    const sg = stageOf(h).id;
    if (sg > (r.lastStage || 0)) {
      if (r.lastStage) logRun(r, 'heat', `${h}° — ${stageOf(h).name} 단계로 올라감`);
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
  const L = PERSONA.lines;
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
    run.line = run.cooled ? L.cooled[0] : fillLine(pk.tpl, { title: st.task.title, margin: st.w.deadline ? fmtDur((st.w.deadline - t) / MIN) : '' });
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
  if (run.floorAfter !== run.floorBefore) logRun(run, 'floor', `바닥 온도 ${run.floorBefore}° → ${run.floorAfter}°`);
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
