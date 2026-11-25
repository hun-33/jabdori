/* =========================================================
   05-native: 진짜 안드로이드 앱에서만 쓰는 기능
   ① 진짜 카카오 로그인 (카카오톡 → 동의 화면 → 개인정보 받기)
   ② 로그인 유지 확인 / 로그아웃 / 카카오 로그아웃 / 연결 끊기 / 탈퇴
   ③ 시작·마감 로컬 알림 (앱이 꺼져 있어도 울림)
   ④ 기기 음성(TTS), 상태 표시줄, 안드로이드 뒤로 가기 버튼
   브라우저에서는 NATIVE.on 이 false 라서 아무 일도 하지 않는다.
   ========================================================= */

/* ---------- ① 진짜 카카오 로그인 ---------- */
// 카카오 쪽 실패 코드 → 로그인 화면에 보여 줄 안내 종류
function kakaoErrorToLogin(e) {
  const code = (e && e.code) || 'UNKNOWN';
  const msg = (e && e.message) || '';
  const detail = `${code}${msg ? ' · ' + msg : ''}`;
  if (code === 'CANCELLED') return { note: 'cancel' };
  if (code === 'ACCESS_DENIED') return { note: 'denyRequired' };
  if (code === 'NOT_CONFIGURED') return { error: 'notConfigured', detail };
  if (code === 'NETWORK') return { error: 'network', detail };
  if (/Misconfigured|InvalidClient|key_hash|KOE0?0[49]|KOE101|disabled/i.test(detail)) return { error: 'keyHash', detail };
  return { error: 'loginFailed', detail };
}

async function nativeLogin(opt = {}) {
  if (ui.login.busy) { state.ignoredClicks++; save(); renderConsole(); return; }
  ui.login = { busy: true, step: opt.forceAccount ? 'account' : 'opening' };
  render();
  diagBegin('real', 'login'); // 단계별 결과 기록 시작 (개발자 진단에서 확인)
  try {
    const st = await NATIVE.Kakao.status();
    if (!st.configured) { diagFail('config', 'NOT_CONFIGURED'); ui.login = { busy: false, error: 'notConfigured', detail: st.platform === 'ios' ? `번들 ID ${st.packageName}` : `패키지 ${st.packageName} · 키 해시 ${st.keyHash}` }; render(); return; }
    diagStep('config');
    // 카카오 토큰이 남아 있으면(앱 로그아웃만 했던 경우) 카카오톡을 다시 열지 않고 바로 들어간다
    if (st.hasToken && !opt.forceAccount) {
      try { const u = await NATIVE.Kakao.me(); diagStep('auth'); await completeNativeLogin({ ...u, method: 'token' }); return; } catch (e) { /* 토큰 만료 → 아래에서 새로 로그인 */ }
    }
    if (!opt.forceAccount && !st.talkAvailable) { ui.login.step = 'account'; render(); }
    // 여기서 카카오톡(또는 브라우저)이 열리고, 카카오의 진짜 동의 화면이 뜬다
    const u = await NATIVE.Kakao.login({ mode: opt.forceAccount ? 'account' : 'auto' });
    diagStep('auth');
    await completeNativeLogin(u);
  } catch (e) {
    const r = kakaoErrorToLogin(e);
    diagFail(r.note === 'cancel' || r.note === 'denyRequired' ? 'auth' : null, (e && e.code) || 'UNKNOWN', e && e.message);
    ui.login = { busy: false, ...r };
    render();
  }
}

// 카카오가 돌려준 사용자 정보로 잡도리 회원을 찾거나 새로 만든다 (내부 계정은 카카오 회원번호로만 연결)
async function completeNativeLogin(u) {
  // ② 토큰이 실제로 발급·저장됐는지 카카오 서버에 확인 (토큰 값은 받지 않음)
  const tk = await kakaoTokenCheck();
  if (!tk.ok) { diagFail('token', tk.code, tk.msg); ui.login = { busy: false, error: 'loginFailed', detail: `토큰 확인 실패 · ${tk.code}` }; render(); return; }
  diagStep('token', { expiresIn: tk.expiresIn ?? null });
  // ③ 사용자 정보(/v2/user/me)를 받았는지, ④ 회원번호가 토큰 주인과 같은지
  if (!u || u.id == null || u.id === '') { diagFail('me', 'NO_USER'); ui.login = { busy: false, error: 'loginFailed', detail: '사용자 정보를 받지 못했어요' }; render(); return; }
  diagStep('me');
  if (tk.id && tk.id !== String(u.id)) { diagFail('kakaoId', 'ID_MISMATCH'); ui.login = { busy: false, error: 'loginFailed', detail: '토큰 주인과 사용자 정보가 달라요' }; render(); return; }
  diagStep('kakaoId', { kakaoId: String(u.id) });
  const kid = 'kakao:' + u.id;
  const consent = { terms: true, privacy: true, email: !!u.email, profile: !!u.profileImage };
  state.kakao[kid] = { linked: true, token: true, consent, real: true };
  ui.login = { busy: true, step: 'authok' }; render(); await wait(350);
  ui.login.step = 'member'; render(); await wait(300);
  let mid = state.memberByKakao[kid];
  let isNew = false;
  if (!mid || !state.members[mid]) {
    ui.login.step = 'create'; render(); await wait(350);
    mid = createMember(kid, { nickname: u.nickname || '카카오 사용자', email: u.email || null }, consent).id;
    isNew = true;
  }
  const mm = state.members[mid];
  // ⑤ 잡도리 회원 확인: 카카오 회원번호 ↔ 회원이 제대로 이어졌는지
  if (!mm || state.memberByKakao[kid] !== mid) { diagFail('member', 'MEMBER_LINK'); ui.login = { busy: false, error: 'loginFailed', detail: '회원 연결을 확인하지 못했어요' }; render(); return; }
  diagStep('member');
  const relinked = !!mm.unlinked;
  applyKakaoProfile(mm, u);
  mm.unlinked = false;
  state.session = { kakaoId: kid, memberId: mid, method: u.method || 'talk', at: now(), realAt: Date.now(), real: true };
  // ⑥ 서비스 세션: 저장소에 실제로 남았는지 다시 읽어서 확인 (앱을 껐다 켜도 유지되는지)
  save();
  let persisted = false;
  try { const back = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); persisted = !!(back && back.session && back.session.memberId === mid && back.session.kakaoId === kid); } catch (e) { persisted = false; }
  if (persisted) diagStep('session'); else diagFail('session', 'STORAGE', '세션을 저장하지 못했어요 (앱을 다시 켜면 로그아웃될 수 있음)');
  diagDone();
  ui.login = { busy: false };
  ui.tab = 'today'; ui.selDate = today(); ui.onb = { step: 0, stage: 3 }; ui.focusKey = null;
  ui.scopes = null;
  state.settledDay = today();
  save(); render();
  if (persisted) showLoginWelcome(mm, 'real'); // 모든 단계가 확인됐을 때만 성공 안내
  else toast('로그인은 됐지만 저장소에 기록하지 못했어요. 설정 탭 > 로그인 진단을 확인해 주세요.');
  if (!isNew && relinked) toast('다시 연결됐어요. 기록은 그대로예요.');
}

// 카카오에서 받은 최신 개인정보를 회원 정보에 반영 (동의 안 한 항목은 빈 값)
function applyKakaoProfile(mm, u) {
  mm.kakaoUserId = String(u.id);
  if (u.nickname) mm.nickname = u.nickname;
  mm.email = u.email || null;
  mm.profileImageUrl = u.profileImage || '';
  mm.thumbnailUrl = u.thumbnail || '';
  mm.profileImage = !!u.profileImage;
  mm.connectedAt = u.connectedAt || mm.connectedAt || 0;
  mm.consent = { terms: true, privacy: true, email: !!u.email, profile: !!u.profileImage };
  mm.realKakao = true;
}

// 앱을 다시 켰을 때: 카카오 토큰이 아직 살아 있는지 확인하고 프로필을 새로 받아 온다
async function nativeRestoreSession() {
  const s = state.session;
  if (!s || !s.real || s.expired) return;
  const r = await checkRealLogin('restore'); // 토큰 → 사용자 정보 → 회원 → 세션 순서로 다시 확인
  if (r.ok) {
    const mm = state.members[s.memberId];
    if (mm) applyKakaoProfile(mm, r.user);
    save(); render();
    return;
  }
  if (r.network) return; // 오프라인이면 그대로 쓰게 둔다
  if (['config', 'auth', 'token', 'me', 'kakaoId', 'member'].includes(r.failStep)) {
    state.session = { ...s, expired: true };
    ui.login = { busy: false, error: 'tokenExpired' };
  }
  save(); render();
}

// 동의 내역 (설정 > 계정 관리에서 보여 줌)
async function loadKakaoScopes() {
  if (!NATIVE.on || !state.session || !state.session.real || ui.scopesLoading) return;
  ui.scopesLoading = true;
  try { const r = await NATIVE.Kakao.scopes(); ui.scopes = r.scopes || []; }
  catch (e) { ui.scopes = { error: (e && e.code) || 'UNKNOWN' }; }
  ui.scopesLoading = false;
  render();
}

/* ---------- ② 계정 처리 (진짜 카카오 API 호출) ---------- */
async function nativeAccount(v) {
  const m = member();
  const kid = state.session && state.session.kakaoId;
  try {
    if (v === 'kakaoLogout') await NATIVE.Kakao.logout();
    if (v === 'unlink' || v === 'withdraw') await NATIVE.Kakao.unlink();
  } catch (e) {
    const code = (e && e.code) || '';
    if (code === 'NETWORK') { toast('인터넷이 연결돼야 카카오에 알릴 수 있어요. 연결 후 다시 해 주세요.'); return false; }
    // 이미 연결이 끊겼거나 토큰이 없으면 그대로 진행
    if (!/NO_TOKEN|TokenNotFound|InvalidToken|NotRegisteredUser/i.test(code + ' ' + (e && e.message))) { toast(`카카오 처리 중 문제가 생겼어요 (${code || '오류'}).`); return false; }
  }
  if (kid) {
    if (v === 'kakaoLogout' && state.kakao[kid]) state.kakao[kid].token = false;
    if (v === 'unlink') { state.kakao[kid] = { linked: false, token: false }; if (m) m.unlinked = true; }
    if (v === 'withdraw') { if (m) delete state.members[m.id]; delete state.memberByKakao[kid]; state.kakao[kid] = { linked: false, token: false }; }
  }
  return true;
}

/* ---------- ③ 시작·마감 알림 (로컬 알림) ---------- */
const NOTIF = {
  CHANNEL: 'jabdori-nag',
  sig: null,
  perm: 'unknown',       // granted | denied | prompt | unknown
  pending: 0,
  timer: null,
  async init() {
    if (!NATIVE.on || !NATIVE.Notif) return;
    try {
      await NATIVE.Notif.createChannel({ id: this.CHANNEL, name: '미루먼지 잔소리', description: '잡도리 일정 시작·마감 알림', importance: 4, visibility: 1, vibration: true });
    } catch (e) { /* 이미 있음 */ }
    try { const p = await NATIVE.Notif.checkPermissions(); this.perm = p.display; } catch (e) { /* 무시 */ }
    // 알림을 누르면 그 일정의 집중 모드로
    try {
      NATIVE.Notif.addListener('localNotificationActionPerformed', (a) => {
        const key = a && a.notification && a.notification.extra && a.notification.extra.key;
        if (!key || !member()) return;
        const st = curOcc(key);
        ui.sheet = null; ui.result = null;
        ui.focusKey = st && ACTIVE_KINDS.includes(st.kind) ? key : null; // 진행 중이면 집중 모드, 아니면 오늘 화면(시작 버튼)
        ui.tab = 'today'; ui.selDate = splitKey(key)[1];
        render();
      });
    } catch (e) { /* 무시 */ }
    this.schedule(true);
  },
  async ask() {
    if (!NATIVE.on || !NATIVE.Notif) return false;
    try { const r = await NATIVE.Notif.requestPermissions(); this.perm = r.display; } catch (e) { /* 무시 */ }
    this.schedule(true); render();
    return this.perm === 'granted';
  },
  // 앞으로 7일 동안 울릴 알림 목록 만들기 (잡도리 일정만, 이미 끝낸 회차는 제외)
  plan() {
    const m = member();
    if (!m || !m.onboarded || !state.realTime || state.notifOff) return [];
    const nowMs = Date.now();
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(ymd(nowMs), i);
      for (const t of m.tasks) {
        if (!occursOn(t, d)) continue;
        const key = occKey(t.id, d);
        const run = m.runs[key];
        if (run && (run.status === 'done' || run.status === 'failed')) continue;
        const w = occWindow(t, d);
        const started = run && run.startedAt;
        const N = persona().lines.notif; // 알림 문구도 캐릭터 말투로 (01-core.js lines.notif)
        const add = (ms, kind, tpl, extra = {}) => { if (ms > nowMs + 30 * 1000) out.push({ ms, kind, key, title: fillLine(tpl[0], { title: t.title, ...extra }), body: fillLine(tpl[1], { title: t.title, ...extra }) }); };
        // 사용자가 고른 알림 (일반·잡도리 모두): 시작 n분 전
        for (const a of t.alarms || []) add(w.start - a * MIN, 'alarm' + a, N.alarm, { before: a ? (a >= 1440 ? '하루' : fmtDur(a)) + ' 뒤' : '지금' });
        if (t.type !== 'jab' || t.jabOn === false) continue; // 아래는 잡도리 일정만
        if (!started && !(t.alarms || []).includes(0)) add(w.start, 'start', N.start);
        if (!started) add(w.start + 10 * MIN, 'late', N.late);
        const dl = w.deadline || w.end;
        add(dl - 30 * MIN, 'urgent', N.urgent);
        add(dl, 'due', N.due);
      }
    }
    return out.sort((a, b) => a.ms - b.ms).slice(0, 60);
  },
  idOf(n) { // 안드로이드 알림 번호는 32비트 정수여야 함
    let h = 7;
    const s = n.key + ':' + n.kind;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2000000000 + 1;
  },
  // 저장할 때마다 불리지만, 알림 목록이 바뀌었을 때만 실제로 다시 예약한다
  schedule(force) {
    if (!NATIVE.on || !NATIVE.Notif) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(force), 400);
  },
  async apply(force) {
    const list = this.plan();
    const sig = list.map((n) => n.key + n.kind + n.ms).join(',');
    if (!force && sig === this.sig) return;
    this.sig = sig;
    try {
      const p = await NATIVE.Notif.getPending();
      if (p && p.notifications && p.notifications.length) await NATIVE.Notif.cancel({ notifications: p.notifications.map((n) => ({ id: n.id })) });
      if (this.perm !== 'granted' || !list.length) { this.pending = 0; return; }
      await NATIVE.Notif.schedule({
        notifications: list.map((n) => ({
          id: this.idOf(n), title: n.title, body: n.body, channelId: this.CHANNEL, smallIcon: 'ic_stat_mireum', iconColor: '#D4532A',
          schedule: { at: new Date(n.ms), allowWhileIdle: true }, extra: { key: n.key, kind: n.kind },
        })),
      });
      this.pending = list.length;
    } catch (e) { this.pending = 0; }
  },
};

/* ---------- ④ 기기 음성 · 상태 표시줄 · 뒤로 가기 ---------- */
let lastBarStyle = null;
function nativeBars(dark) {
  if (!NATIVE.on || !NATIVE.Bars) return;
  // 웹뷰가 상태 표시줄 밑까지 그려지면(최신 웹뷰) 화면 색에 맞춰 글자색을 바꾸고,
  // 옛 웹뷰처럼 상태 표시줄 아래에서 시작하면 바탕이 늘 숯색이라 밝은 글자로 고정한다
  const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0;
  const edge = inset > 0 || NATIVE.ios; // 아이폰 웹뷰는 늘 상태 표시줄 밑까지 그린다
  const style = dark || !edge ? 'DARK' : 'LIGHT'; // DARK = 어두운 바탕 위 밝은 글자
  if (style === lastBarStyle) return;
  lastBarStyle = style;
  try { NATIVE.Bars.setStyle({ style }); } catch (e) { /* 무시 */ }
}
function nativeBack() {
  if (ui.input) { ACT.wheelInputCancel(); return; }
  if (document.body.classList.contains('console-open')) { ACT.cToggle(); return; }
  if (ui.popup) return; // 딴짓 팝업은 답을 골라야 닫힘
  if (ui.sheet) { ACT.sheetScrim(); return; }
  if (ui.result) { ACT.resultClose(); return; }
  if (ui.focusKey) { ACT.exitFocus(); return; }
  if (ui.tab === 'me' && ui.meSub) { ACT.meBack(); return; } // 설정 하위 화면 → 설정 첫 화면
  if (member() && ui.tab !== 'today') { ui.tab = 'today'; render(); return; }
  try { NATIVE.App.minimizeApp(); } catch (e) { /* 무시 */ }
}

// 저장 직후마다 불림 (01-core save 끝)
function afterSave() {
  if (NATIVE.on) NOTIF.schedule(false);
}

/* ---------- 시작 ---------- */
// 스크립트가 읽히자마자(화면 그리기 전에) 실행: 진짜 앱은 처음부터 실제 시각으로 동작
(function nativeBoot() {
  if (!NATIVE.on) return;
  if (!state.nativeInit) {
    state.nativeInit = true;
    state.realTime = true;
    state.auto = false;
    state.clock = Math.floor(Date.now() / MIN) * MIN;
    state.settledDay = ymd(state.clock);
    save();
  }
})();
// init() 끝에서 불림
function nativeInit() {
  if (!NATIVE.on) return;
  document.body.classList.toggle('demo', !!state.showDemo);
  NOTIF.init();
  WATCH.init();
  nativeRestoreSession();
  try {
    NATIVE.App.addListener('backButton', nativeBack);
    NATIVE.App.addListener('resume', () => { if (state.realTime) syncRealClock(true); nativeRestoreSession(); NOTIF.schedule(true); TTS.check(); WATCH.onResume(); });
    NATIVE.App.addListener('pause', () => TTS.stop()); // 앱을 내리면 읽던 말도 멈춘다
  } catch (e) { /* 무시 */ }
}

/* ---------- 설정 탭에 쓰는 조각 ---------- */
// 카카오 동의 내역 → [이름, 표시, 동의 여부] 줄 목록
function kakaoConsentRows(m) {
  // 이메일(account_email)은 동의항목 권한이 없어 받지 않으므로 보여 주지 않는다
  const MAIN = ['profile_nickname', 'profile_image'];
  if (Array.isArray(ui.scopes)) {
    const list = ui.scopes.filter((s) => s.id !== 'account_email' && (s.agreed || MAIN.includes(s.id)));
    if (list.length) return list.map((s) => [s.name, '', !!s.agreed]);
  }
  // 동의 내역을 아직 못 받았으면(불러오는 중·오프라인) 받은 정보로 대신 표시
  return [['닉네임', ui.scopesLoading ? '확인 중' : '', !!m.nickname], ['프로필 사진', '', !!m.profileImageUrl]];
}
function notifRow() {
  const on = !state.notifOff;
  let sub = `앱을 꺼 둬도 시작·10분 지각·마감 30분 전·마감 때 알려요 · 예약 ${NOTIF.pending}개`;
  if (on && NOTIF.perm === 'denied') sub = NATIVE.ios ? '알림 권한이 꺼져 있어요. 아이폰 설정 > 알림 > 잡도리에서 알림 허용을 켜 주세요' : '알림 권한이 꺼져 있어요. 스위치를 다시 켜거나 휴대폰 설정 > 애플리케이션 > 잡도리 > 알림에서 켜 주세요';
  else if (on && !state.realTime) sub = '시연용 가상 시각을 쓰는 중이라 알림을 예약하지 않아요 (시연 도구에서 실제 시각 쓰기를 켜면 예약)';
  else if (!on) sub = '알림을 껐어요. 앱 안에서만 잔소리해요';
  return `<h2 class="sec-label">알림</h2>
      <div class="list-btn as-row"><span class="lb-text"><b>시작·마감 알림</b><small>${sub}</small></span>
        <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="시작·마감 알림" data-act="notifToggle"><i></i></button></div>`;
}

Object.assign(ACT, {
  notifToggle: async () => {
    state.notifOff = !state.notifOff; save();
    if (!state.notifOff && NOTIF.perm !== 'granted') await NOTIF.ask();
    NOTIF.schedule(true); render();
    setTimeout(render, 900); // 예약 개수 반영
  },
  demoToggle: () => { state.showDemo = !state.showDemo; document.body.classList.toggle('demo', state.showDemo); save(); render(); if (state.showDemo) toast("오른쪽 가장자리의 '시연' 탭을 눌러 보세요."); },
  // 카카오 설정 전에도 앱을 둘러볼 수 있게: 흉내 로그인으로 바로 들어가기
  loginFake: () => { state.fakeLogin = true; ui.login = { busy: false }; save(); startLogin(); },
  realLogin: () => { state.fakeLogin = false; ui.login = { busy: false }; save(); render(); },
  cFake: () => { state.fakeLogin = !state.fakeLogin; save(); renderConsole(true); toast(state.fakeLogin ? '다음 로그인부터 흉내 모드예요 (카카오에 연결하지 않음).' : '다음 로그인부터 진짜 카카오 로그인이에요.'); },
});
