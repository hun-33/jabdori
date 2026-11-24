/* =========================================================
   04-app: 렌더링 엔진, 사용자 동작, 로그인 시뮬레이션, 시연 콘솔
   ========================================================= */

let el = {};
let cur = { id: null, sig: null, tpl: null };
const layerState = { sheetKey: null, sheetHtml: '', popupHtml: '', resultHtml: '', tabHtml: '', consoleHtml: '' };
let formDirty = false;
let lastFocus = null;
let enterTimer = null;

/* ---------- 렌더링 ---------- */
function computeScreen() {
  LIVE = {}; LIVES = {};
  if (state.session && (state.session.expired || !state.members[state.session.memberId])) {
    const expired = state.session.expired;
    state.session = null;
    if (expired) ui.login = { busy: false, error: 'tokenExpired' };
    save();
  }
  const m = member();
  if (!m) return viewLogin();
  if (!m.onboarded) return viewOnboarding(m);
  if (ui.focusKey) { const v = viewFocus(m); if (v) return v; }
  if (ui.tab === 'calendar') return viewCalendar(m);
  if (ui.tab === 'records') return viewRecords(m);
  if (ui.tab === 'me') return viewMe(m);
  return viewToday(m);
}
function patchLive(live, lives) {
  for (const n of el.screen.querySelectorAll('[data-live]')) {
    const v = live[n.dataset.live];
    if (v != null && n.textContent !== v) n.textContent = v;
  }
  for (const n of el.screen.querySelectorAll('[data-ls]')) {
    const s = lives[n.dataset.ls];
    if (s) n.style.setProperty(s.prop, s.val);
  }
}
/* 말풍선에서 먼지 말만 (정보 줄은 소리로 읽지 않는다) */
function speechText(sp) { const t = sp && sp.querySelector('[data-live="speech"]'); return t ? t.textContent : sp ? sp.textContent : ''; }
function render(force = false) {
  const v = computeScreen();
  const live = LIVE, lives = LIVES;
  const sig = sigOf(v.html);
  if (force || v.id !== cur.id || sig !== cur.sig) {
    const same = v.id === cur.id;
    const top = el.screen.scrollTop;
    // 같은 화면을 다시 그릴 때는 등장 애니메이션을 다시 틀지 않는다 (탭할 때마다 화면이 내려오는 문제)
    if (same) el.screen.classList.remove('enter');
    el.screen.innerHTML = v.html;
    if (same) el.screen.scrollTop = top;
    else {
      el.screen.scrollTop = 0;
      // 일간 시간표는 아침 8시(오늘이면 지금 한 시간 전)부터 보이게
      const g = el.screen.querySelector('#tgrid');
      if (g) { const h = ui.selDate === today() ? Math.max(0, new Date(now()).getHours() - 1) : 8; el.screen.scrollTop = Math.max(0, g.offsetTop + h * HOUR_H - 90); }
      el.screen.classList.remove('enter'); void el.screen.offsetWidth; el.screen.classList.add('enter');
      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => el.screen.classList.remove('enter'), 400);
    }
    const sp = el.screen.querySelector('.speech[data-tpl]');
    const tpl = sp ? sp.dataset.tpl : null;
    if (sp && tpl !== cur.tpl) { sp.classList.add('say'); if (cur.tpl !== null) TTS.say(speechText(sp), { pri: 'all', stage: Number(sp.dataset.stage) || 0, ev: 'speech' }); }
    cur = { id: v.id, sig, tpl };
  } else patchLive(live, lives);
  // 추가 버튼(+)은 오늘·달력 화면에만, 화면 위에 떠 있게 (스크롤과 상관없이 같은 자리)
  const fabWant = /^(today|calendar)/.test(v.id) && member() ? fabHTML(ui.selDate || today()) : '';
  let fs = $('#fab-slot');
  if (!fs) { fs = document.createElement('div'); fs.id = 'fab-slot'; el.app.insertBefore(fs, el.sheet); }
  if (fs.innerHTML !== fabWant) fs.innerHTML = fabWant;

  const m = member();
  const showTabs = !!m && m.onboarded && !ui.focusKey;
  const tabHtml = showTabs ? viewTabbar() : '';
  if (tabHtml !== layerState.tabHtml) { el.tabbar.innerHTML = tabHtml; layerState.tabHtml = tabHtml; }
  el.app.classList.toggle('no-tabs', !showTabs);
  el.app.classList.toggle('layer-open', !!(ui.sheet || ui.popup || ui.result));
  const dark = /^(login|onb|today|focus)/.test(cur.id) && !ui.result;
  if (el.device) el.device.classList.toggle('dark-top', dark);
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', dark ? '#2B2622' : '#F3EEE5');
  nativeBars(dark);
  if (!(ui.sheet && ui.sheet.type === 'form')) ui.input = null;
  renderLayers(m);
  renderInputLayer();
  renderConsole();
  renderStatus();
}
function renderLayers(m) {
  // 시트
  let sh = '', key = null;
  const s = ui.sheet;
  if (s) {
    key = s.type + ':' + (s.key || s.id || '');
    if (s.type === 'form') {
      if (formDirty || layerState.sheetKey !== key) { sh = viewForm(m); formDirty = false; } else sh = null; // 입력 중에는 다시 그리지 않음
    } else if (s.type === 'consent') sh = viewConsent(s);
    else if (s.type === 'kakaoAccount') sh = viewKakaoAccount();
    else if (s.type === 'task' && m) sh = viewTaskSheet(m, s.key);
    else if (s.type === 'record' && m) sh = viewRecordSheet(m, s.key);
    else if (s.type === 'confirm') sh = viewConfirm(s);
    else if (s.type === 'excuse') sh = viewExcuse(s);
    else if (s.type === 'floorInfo' && m) sh = viewFloorInfo(m);
    else if (s.type === 'diag') sh = viewLoginDiag();
  }
  if (sh !== null && sh !== layerState.sheetHtml) {
    const keepScroll = layerState.sheetKey === key ? (el.sheet.querySelector('.sheet-body') || {}).scrollTop : 0;
    el.sheet.innerHTML = sh;
    const sheetEl = el.sheet.querySelector('.sheet');
    if (sheetEl) {
      if (layerState.sheetKey === key) { sheetEl.classList.add('still'); const b = sheetEl.querySelector('.sheet-body'); if (b) b.scrollTop = keepScroll || 0; }
      else { const h = sheetEl.querySelector('.sheet-title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    }
    layerState.sheetHtml = sh;
    if (s && s.type === 'form') initWheels();
  }
  if (!s && layerState.sheetHtml) { el.sheet.innerHTML = ''; layerState.sheetHtml = ''; if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); }
  layerState.sheetKey = key;
  // 결과
  const rh = ui.result && m ? viewResult(m) : '';
  if (rh !== layerState.resultHtml) {
    const isNew = !layerState.resultHtml;
    el.result.innerHTML = rh; layerState.resultHtml = rh;
    if (rh && !isNew) el.result.querySelector('.result')?.classList.add('still');
    if (rh && isNew) {
      el.result.querySelector('.res-title')?.setAttribute('tabindex', '-1'), el.result.querySelector('.res-title')?.focus({ preventScroll: true });
      const run = m.runs[ui.result.key];
      if (run && run.line) TTS.say(run.line, { pri: 'key', stage: run.status === 'done' ? 1 : 4, ev: 'result' }); // 결과 한마디 = 중요한 순간
    }
  }
  // 팝업
  const ph = ui.popup && m ? viewSlackPopup(m) : '';
  if (ph !== layerState.popupHtml) {
    const isNew = !layerState.popupHtml;
    el.popup.innerHTML = ph; layerState.popupHtml = ph;
    if (ph && !isNew) el.popup.querySelector('.popup')?.classList.add('still');
    if (ph) (el.popup.querySelector('.opt') || el.popup.querySelector('.btn'))?.focus({ preventScroll: true });
    // 팝업 대사: 처음 묻는 말(딴짓 감지·공부 확인)은 중요한 순간, 내 선택에 대한 대답은 일반 멘트
    const line = el.popup.querySelector('.pop-line');
    const lt = line ? line.textContent : '';
    if (lt && lt !== layerState.popupLine) TTS.say(lt, { pri: ui.popup && ui.popup.answer ? 'all' : 'key', stage: 3, ev: 'slack' });
    layerState.popupLine = lt;
  }
}
function renderStatus() {
  if (el.status) el.status.textContent = fmtHM(now());
}
let toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('show'); void el.toast.offsetWidth; el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2800);
}
function openSheet(s) {
  if (!ui.sheet) lastFocus = document.activeElement;
  ui.sheet = s;
  if (s.type === 'form') formDirty = true;
  render();
}
function closeSheet() { ui.sheet = null; render(); }
let swipeGuard = 0;
function rerenderForm() { formDirty = true; render(); }

/* ---------- 시간 ---------- */
function studyChecks(m) {
  for (const [k, r] of Object.entries(m.runs)) {
    if (r.status === 'running' && r.studyUntil && now() >= r.studyUntil && !ui.popup) {
      r.studyUntil = null;
      logRun(r, 'slack', '10분 지나 다시 확인');
      ui.popup = { type: 'studyCheck', key: k };
    }
  }
}
function jabSnapshot(m) {
  const snap = {};
  if (!m) return snap;
  for (const o of occurrencesOn(m, today())) {
    if (o.task.type !== 'jab') continue;
    snap[o.key] = { kind: o.kind, stage: stageOf(heatOf(o).total).id, st: o };
  }
  return snap;
}
function setClock(ms) {
  const prevDay = today();
  const m0 = member();
  const before = m0 && m0.onboarded ? jabSnapshot(m0) : {};
  state.clock = ms;
  const m = member();
  if (m && m.onboarded && today() === prevDay) alertTransitions(m, before, jabSnapshot(m));
  if (m) {
    if (today() !== prevDay) {
      const s = settleDays(m);
      if (s.length) toast(`결과를 남기지 않은 ‘${s[0]}’${s.length > 1 ? ` 외 ${s.length - 1}개` : ''}를 실패로 기록했어요.`);
      if (ui.selDate === prevDay) ui.selDate = today();
      ui.calMonth = null;
    }
    trackHeat(m);
    studyChecks(m);
  } else state.settledDay = today();
  save();
  render();
}
function setClockHM(hm) { setClock(at(today(), hm)); }

/* ---------- 로그인 시뮬레이션 (FN01) ---------- */
function kakaoId() { return TEST_KAKAO.id; }
function ensureExistingMember() {
  const kid = kakaoId();
  if (state.memberByKakao[kid] && state.members[state.memberByKakao[kid]]) return;
  const consent = { terms: true, privacy: true, email: true, profile: true };
  state.kakao[kid] = { linked: true, token: true, consent };
  const m = createMember(kid, TEST_KAKAO, consent);
  m.onboarded = true;
  m.createdAt = at('2026-11-09', '10:00');
  m.streak = 1;
  const tA = { id: uid('t'), type: 'jab', title: '운영체제 퀴즈 준비', date: '2026-11-20', repeat: { kind: 'none' }, start: '19:00', duration: 60, heat: 50, deadline: { enabled: true, date: '2026-11-20', time: '21:00' }, createdAt: at('2026-11-19', '21:00') };
  const tB = { id: uid('t'), type: 'normal', title: '자료구조 스터디', date: '2026-11-10', repeat: { kind: 'weekly', days: [2] }, start: '19:00', duration: 90, heat: null, deadline: null, createdAt: at('2026-11-09', '10:30') };
  const tC = { id: uid('t'), type: 'normal', title: '편의점 아르바이트', date: '2026-11-14', repeat: { kind: 'weekly', days: [6] }, start: '13:00', duration: 300, heat: null, deadline: null, createdAt: at('2026-11-09', '10:31') };
  m.tasks.push(...[tA, tB, tC].map(migrateTask));
  m.runs[occKey(tA.id, '2026-11-20')] = {
    status: 'done', startedAt: at('2026-11-20', '19:06'), endedAt: at('2026-11-20', '20:12'), slack: [{ at: at('2026-11-20', '19:40'), app: 'YouTube', choice: 'focus' }],
    peak: 74, endHeat: 72, title: tA.title, startHeat: 50, plan: occWindow(tA, '2026-11-20'), floorBefore: 50, floorAfter: 50, penaltyBefore: 0, streakBefore: 0,
    line: '좋아. 운영체제 퀴즈 준비 끝냈네. 마감 48분 전이야.',
    log: [{ at: at('2026-11-20', '19:06'), kind: 'start', text: '6분 늦게 시작' }, { at: at('2026-11-20', '19:40'), kind: 'slack', text: '딴짓 감지 — YouTube 실행' }, { at: at('2026-11-20', '19:40'), kind: 'slack', text: '다시 집중하겠다고 답함' }, { at: at('2026-11-20', '20:12'), kind: 'done', text: '완료' }],
  };
  m.runs[occKey(tB.id, '2026-11-17')] = { status: 'done', endedAt: at('2026-11-17', '20:30') };
}
async function startLogin(opt = {}) {
  if (NATIVE.on && !state.fakeLogin) return nativeLogin(opt); // 진짜 앱: 카카오 공식 SDK (05-native)
  if (ui.login.busy) { state.ignoredClicks++; save(); renderConsole(); return; }
  const sc = state.scenario;
  const kid = kakaoId();
  if (sc === 'existing') ensureExistingMember();
  const link = state.kakao[kid];
  const viaAccount = opt.forceAccount || !state.talkInstalled || sc === 'noTalk';
  ui.login = { busy: true, step: viaAccount ? 'account' : 'opening' };
  render();
  await wait(650);
  if (['network', 'server', 'timeout', 'authFail'].includes(sc)) {
    await wait(sc === 'timeout' ? 1300 : 350);
    state.scenario = 'normal';
    ui.login = { busy: false, error: sc }; save(); render(); return;
  }
  if (sc === 'cancel') { state.scenario = 'normal'; ui.login = { busy: false, note: 'cancel' }; save(); render(); return; }
  if (!viaAccount && (sc === 'talkFail' || sc === 'returnFail')) { state.scenario = 'normal'; ui.login = { busy: false, error: sc }; save(); render(); return; }
  if (viaAccount) {
    if (!opt.forceAccount) toast('카카오톡을 쓸 수 없어서 카카오계정 로그인으로 바꿨어요.');
    openSheet({ type: 'kakaoAccount' });
    return;
  }
  afterKakaoAuth('talk', link);
}
function afterKakaoAuth(method) {
  const kid = kakaoId();
  const link = state.kakao[kid];
  if (!link || !link.linked) {
    ui.login.step = 'consent';
    const sc = state.scenario;
    const preset = sc === 'denyRequired' ? { terms: false, privacy: false, email: false, profile: false }
      : sc === 'optionalOff' ? { terms: true, privacy: true, email: false, profile: false }
        : { terms: true, privacy: true, email: true, profile: true };
    if (sc === 'denyRequired' || sc === 'optionalOff') state.scenario = 'normal';
    openSheet({ type: 'consent', consent: preset, method });
    return;
  }
  completeLogin(kid, method);
}
async function completeLogin(kid, method) {
  ui.login = { busy: true, step: 'authok' }; render(); await wait(500);
  ui.login.step = 'member'; render(); await wait(420);
  let mid = state.memberByKakao[kid];
  let isNew = false;
  if (!mid || !state.members[mid]) {
    ui.login.step = 'create'; render(); await wait(520);
    mid = createMember(kid, TEST_KAKAO, state.kakao[kid].consent).id; isNew = true;
  }
  const mm = state.members[mid];
  const relinked = !!mm.unlinked;
  mm.unlinked = false;
  mm.consent = { ...state.kakao[kid].consent };
  mm.email = mm.consent.email ? TEST_KAKAO.email : null;
  mm.profileImage = !!mm.consent.profile;
  state.kakao[kid].token = true;
  state.session = { kakaoId: kid, memberId: mid, method, at: now() };
  if (state.scenario !== 'noTalk') state.scenario = 'normal';
  checkFakeLogin('login'); // 흉내 모드: 카카오 단계는 '흉내'로, 회원·세션은 실제로 확인해서 기록
  ui.login = { busy: false };
  ui.tab = 'today'; ui.selDate = today(); ui.onb = { step: 0, stage: 3 }; ui.focusKey = null;
  state.settledDay = today();
  save(); render();
  if (state.diag && state.diag.done && !state.diag.failStep) showLoginWelcome(mm, 'fake'); // 회원·세션이 확인됐을 때만
  if (!isNew) toast(relinked ? '다시 연결됐어요. 기록은 그대로예요.' : `다시 왔네요, ${mm.nickname} 님. 기록은 그대로예요.`);
}

/* ---------- 테스트 데이터 ---------- */
function testTaskSpec() {
  return { type: 'jab', title: '데이터베이스 과제', date: '2026-11-23', repeatKind: 'weekly', days: [1], every: 1, start: '18:00', endDate: '2026-11-23', end: '20:00', heat: 50, dlMode: 'custom', dlDate: '2026-11-23', dlTime: '20:00', more: true };
}
function seedCommon(m) {
  if (m.tasks.some((t) => t.title === '데이터베이스 과제')) { toast('데이터베이스 과제가 이미 있어요.'); return; }
  const s = testTaskSpec();
  m.tasks.push(migrateTask({ id: uid('t'), type: 'jab', title: s.title, date: s.date, repeat: { kind: 'weekly', days: [1] }, start: s.start, duration: 120, heat: 50, deadline: { enabled: true, date: s.date, time: s.dlTime }, createdAt: now() }));
  ui.selDate = today();
  toast('공통 테스트 일정을 넣었어요 · 데이터베이스 과제');
}
function seedExtra(m) {
  const add = (title, days, start, duration) => { if (!m.tasks.some((t) => t.title === title)) m.tasks.push(migrateTask({ id: uid('t'), type: 'normal', title, date: '2026-11-23', repeat: { kind: 'weekly', days }, start, duration, heat: null, deadline: null, createdAt: now() })); };
  add('자료구조 스터디', [2], '19:00', 90);
  add('팀 프로젝트 회의', [4], '16:00', 60);
  add('편의점 아르바이트', [6], '13:00', 300);
  toast('일반 일정 3개를 넣었어요');
}

/* ---------- 사용자 동작 ---------- */
function curOcc(key) {
  const m = member(); if (!m) return null;
  const [tid, d] = splitKey(key);
  const t = findTask(m, tid);
  return t ? occState(m, t, d) : null;
}
const ACT = {
  /* 로그인 */
  login: () => startLogin(),
  loginAccount: () => startLogin({ forceAccount: true }),
  consentToggle: (t) => { ui.sheet.consent[t.dataset.k] = !ui.sheet.consent[t.dataset.k]; render(); },
  consentAll: () => { const c = ui.sheet.consent; const all = c.terms && c.privacy && c.email && c.profile; for (const k of ['terms', 'privacy', 'email', 'profile']) c[k] = !all; render(); },
  consentAgree: () => {
    const s = ui.sheet; if (!s.consent.terms || !s.consent.privacy) return;
    state.kakao[kakaoId()] = { linked: true, token: false, consent: { ...s.consent } };
    ui.sheet = null; completeLogin(kakaoId(), s.method);
  },
  consentDecline: () => { ui.sheet = null; ui.login = { busy: false, note: 'denyRequired' }; render(); },
  consentCancel: () => { ui.sheet = null; ui.login = { busy: false, note: 'cancel' }; render(); },
  acctContinue: () => { ui.sheet = null; afterKakaoAuth('account'); },
  acctCancel: () => { ui.sheet = null; ui.login = { busy: false, note: 'cancel' }; render(); },

  /* 온보딩 */
  onbNext: () => { ui.onb.step = Math.min(3, ui.onb.step + 1); render(); },
  onbPrev: () => { ui.onb.step = Math.max(0, ui.onb.step - 1); render(); },
  onbStage: (t) => { ui.onb.stage = Number(t.dataset.s); render(); },
  onbSkip: () => ACT.onbFinish({ dataset: { to: 'home' } }),
  onbFinish: (t) => {
    const m = member(); m.onboarded = true; save();
    if (NATIVE.on && NOTIF.perm !== 'granted') NOTIF.ask(); // 진짜 앱: 시작·마감 알림 권한
    ui.tab = 'today'; ui.selDate = today();
    if (t.dataset.to === 'add') { ui.form = newDraft(m, today()); openSheet({ type: 'form' }); } else render();
  },

  /* 탐색 */
  tab: (t) => { if (ui.tab !== t.dataset.tab) TTS.stop(); ui.tab = t.dataset.tab; ui.focusKey = null; ui.sheet = null; if (ui.tab === 'calendar') { ui.calMonth = (ui.selDate || today()).slice(0, 7);  } render(); },
  selDate: (t) => { ui.selDate = t.dataset.date; render(); },
  calPick: (t) => { ui.selDate = t.dataset.date; if (ui.calMode === 'month' && ui.selDate.slice(0, 7) !== ui.calMonth) ui.calMonth = ui.selDate.slice(0, 7); render(); },
  calMode: (t) => { ui.calMode = t.dataset.v; ui.calMonth = ui.selDate.slice(0, 7); ui.range = null; ui.slot = null; render(); },
  /* 이전·다음: 월간은 달, 주간은 7일, 일간은 하루. 달을 넘기면 그 달 1일(오늘이 있는 달이면 오늘)을 고른다 */
  calNav: (t) => {
    const dl = Number(t.dataset.delta);
    ui.slot = null;
    if (ui.calMode === 'month') {
      const [y, mo] = ui.calMonth.split('-').map(Number); const d = new Date(y, mo - 1 + dl, 1);
      ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      ui.selDate = today().slice(0, 7) === ui.calMonth ? today() : ui.calMonth + '-01';
    } else ui.selDate = addDays(ui.selDate, ui.calMode === 'week' ? 7 * dl : dl);
    render();
  },
  weekNav: (t) => { ui.selDate = addDays(ui.selDate, 7 * Number(t.dataset.delta)); render(); },
  calToday: () => { ui.selDate = today(); ui.calMonth = today().slice(0, 7); ui.slot = null; render(); },
  goCalendar: (t) => { ui.tab = 'calendar'; ui.calMode = t.dataset.mode || 'month'; ui.calMonth = (ui.selDate || today()).slice(0, 7); render(); },
  /* 월간: 기간 정해서 올리기 — 시작 날짜, 끝 날짜를 차례로 누르면 종일 일정 폼이 열린다 */
  rangeStart: () => { ui.range = { a: null }; render(); },
  rangeCancel: () => { ui.range = null; render(); },
  rangePick: (t) => {
    const d = t.dataset.date;
    if (!ui.range.a) { ui.range.a = d; render(); return; }
    const [a, b] = [ui.range.a, d].sort();
    ui.range = null; ui.selDate = a;
    const m = member();
    ui.form = newDraft(m, a, 'normal', { endDate: b });
    ui.form.allDay = true;
    openSheet({ type: 'form' });
  },
  /* 일간 시간표: 첫 칸 = 시작, 다음 칸 = 종료(그 칸 끝). 같은 칸을 두 번 누르면 1시간 */
  slotTap: (t) => {
    const d = t.dataset.date, mn = Number(t.dataset.min);
    if (!ui.slot || ui.slot.date !== d) { ui.slot = { date: d, from: mn }; render(); return; }
    const a = Math.min(ui.slot.from, mn), b = Math.max(ui.slot.from, mn) + 60;
    ui.slot = null;
    const m = member();
    ui.form = newDraft(m, d, 'jab', { start: minToHm(a), end: minToHm(b % 1440), endDate: b >= 1440 ? addDays(d, 1) : d });
    openSheet({ type: 'form' });
  },

  /* 일정 보기 */
  openTask: (t) => openSheet({ type: 'task', key: t.dataset.key }),
  openRecord: (t) => openSheet({ type: 'record', key: t.dataset.key }),
  openFloorInfo: () => openSheet({ type: 'floorInfo' }),
  closeSheet: () => closeSheet(),
  sheetScrim: () => {
    const ty = ui.sheet && ui.sheet.type;
    if (ty === 'consent') return ACT.consentCancel();
    if (ty === 'kakaoAccount') return ACT.acctCancel();
    if (ty === 'form') return ACT.formClose();
    if (ty === 'excuse') return ACT.excuseSkip();
    closeSheet();
  },
  normalToggle: (t) => {
    const m = member(), k = t.dataset.key;
    if (m.runs[k] && m.runs[k].status === 'done') delete m.runs[k];
    else m.runs[k] = { status: 'done', endedAt: now() };
    save(); render();
  },

  /* 잡도리 진행 (FN03) */
  startOcc: (t) => {
    const m = member(), st = curOcc(t.dataset.key);
    if (!st) return;
    const other = runningOcc(m);
    if (other && other.key !== st.key) { toast(`‘${other.task.title}’${jo(other.task.title, '이/가')} 진행 중이에요. 먼저 끝내 주세요.`); return; }
    if (st.kind === 'upcoming' || st.kind === 'late') startOcc(m, st);
    trackHeat(m);
    ui.focusKey = st.key; ui.receiptOpen = false; ui.sheet = null;
    save(); render();
  },
  openFocus: (t) => { ui.focusKey = t.dataset.key; ui.sheet = null; ui.receiptOpen = false; render(); },
  exitFocus: () => { TTS.stop(); ui.focusKey = null; ui.tab = 'today'; render(); },
  toggleReceipt: () => { ui.receiptOpen = !ui.receiptOpen; render(); },
  takeBreak: () => {
    const m = member(), st = curOcc(ui.focusKey); if (!st || !st.run) return;
    st.run.brk = { start: now(), until: now() + HEAT_POLICY.breakMinutes * MIN, ended: false };
    logRun(st.run, 'break', `${HEAT_POLICY.breakMinutes}분 휴식 시작`);
    save(); render();
  },
  endBreak: () => {
    const st = curOcc(ui.focusKey); if (!st || !st.run || !st.run.brk) return;
    const over = Math.round((now() - st.run.brk.until) / MIN);
    st.run.brk.ended = true;
    logRun(st.run, 'break', over > 0 ? `휴식 끝 · ${over}분 초과` : '휴식 끝');
    save(); render();
  },
  finishOcc: (t) => {
    const m = member(), st = curOcc(t.dataset.key); if (!st) return;
    finishOcc(m, st, true);
    ui.focusKey = null; ui.result = { key: st.key }; ui.sheet = null; hideBanner();
    save(); render();
  },
  giveUp: (t) => {
    const m = member(), f = floorOf(m), nf = Math.min(HEAT_POLICY.floorMax, f + HEAT_POLICY.failStep), st = curOcc(t.dataset.key);
    openSheet({
      type: 'confirm', title: '여기서 접을까요?',
      body: `‘${esc(st.task.title)}’${jo(st.task.title, '을/를')} 실패로 기록해요. 다음에 올리는 잡도리 일정의 ${josa(scaleOf(m).floor, '이/가')} <b>${lv(f)} → ${lv(nf)}</b>${jo(lv(nf), '으로/로')} 올라가요.`,
      okLabel: '실패로 기록하기', okAct: 'confirmFail', okData: `data-key="${t.dataset.key}"`, danger: true, cancelLabel: '다시 해볼게',
    });
  },
  failNow: (t) => openSheet({ type: 'excuse', key: t.dataset.key }),
  confirmFail: (t) => openSheet({ type: 'excuse', key: t.dataset.key }),
  excuse: (t) => doFail(t.dataset.v),
  excuseSkip: () => doFail(null),
  resultClose: () => { TTS.stop(); ui.result = null; ui.tab = 'today'; render(); },
  resultRecord: () => { ui.result = null; ui.tab = 'records'; render(); },

  /* 일정 등록·수정 (FN02) */
  openAdd: (t) => { const m = member(); ui.form = newDraft(m, t.dataset.date || ui.selDate || today()); openSheet({ type: 'form' }); },
  editTask: (t) => { const m = member(), task = findTask(m, t.dataset.id); ui.form = draftFromTask(m, task); openSheet({ type: 'form', id: task.id }); },
  deleteTask: (t) => {
    const task = findTask(member(), t.dataset.id);
    openSheet({
      type: 'confirm', title: '일정을 지울까요?',
      body: `‘${esc(task.title)}’${task.repeat.kind !== 'none' ? '의 앞으로 모든 회차가' : jo(task.title, '이/가')} 사라져요. 끝냈거나 놓친 기록은 기록 탭에 남아요.`,
      okLabel: '지우기', okAct: 'confirmDelete', okData: `data-id="${task.id}"`, danger: true,
    });
  },
  confirmDelete: (t) => {
    const m = member(), id = t.dataset.id;
    m.tasks = m.tasks.filter((x) => x.id !== id);
    for (const k of Object.keys(m.runs)) { if (splitKey(k)[0] === id && m.runs[k].status !== 'done' && m.runs[k].status !== 'failed') delete m.runs[k]; }
    if (ui.focusKey && splitKey(ui.focusKey)[0] === id) ui.focusKey = null;
    ui.sheet = null; save(); render(); toast('지웠어요.');
  },
  formType: (t) => {
    const f = ui.form; f.type = t.dataset.v;
    if (f.type === 'jab') { f.heat = Math.max(f.heat, f.minHeat); f.allDay = false; } // 잡도리는 시작 시각이 있어야 한다
    if (!f._colorTouched) f.color = f.type === 'jab' ? 'coral' : 'sky';
    rerenderForm();
  },
  formRepeat: (t) => {
    const f = ui.form; f.repeatKind = t.dataset.v === 'interval' ? 'daily' : t.dataset.v; // 'interval'은 예전 이름
    if (f.repeatKind === 'weekly' && !f.days.length) f.days = [weekday(f.date)];
    if (!(f.every >= 1)) f.every = 1;
    delete f.errors.days; rerenderForm();
  },
  formDay: (t) => { const f = ui.form, d = Number(t.dataset.d); f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d]; if (f.days.length) delete f.errors.days; rerenderForm(); },
  formEvery: (t) => { const f = ui.form; f.every = clamp(f.every + Number(t.dataset.delta), 1, 30); rerenderForm(); },
  /* 걸리는 시간 버튼: 종료 = 시작 + n분 (날짜를 넘기면 종료 날짜도 넘어간다) */
  formDur: (t) => {
    const f = ui.form, v = t.dataset.v;
    if (v === 'custom') { f.pick = 'end'; rerenderForm(); return; }
    const e = draftStartMs(f) + Number(v) * MIN;
    f.endDate = ymd(e); f.end = fmtHM(e); f.allDay = false;
    delete f.errors.time; rerenderForm();
  },
  formDl: (t) => {
    const f = ui.form; const v = t.dataset.v === 'on' ? 'custom' : t.dataset.v; // 'on'은 예전 이름
    f.dlMode = v;
    if (v === 'custom') {
      if (!f._dlTouched) { const e = draftEndMs(f); f.dlDate = ymd(e); f.dlTime = fmtHM(e); }
      f.pick = 'dl';
    } else if (f.pick === 'dl') f.pick = null;
    delete f.errors.deadline; rerenderForm();
  },
  formPick: (t) => { const f = ui.form; f.pick = f.pick === t.dataset.v ? null : t.dataset.v; rerenderForm(); },
  formAllDay: () => { const f = ui.form; if (f.type === 'jab') return; f.allDay = !f.allDay; if (f.endDate < f.date) f.endDate = f.date; delete f.errors.time; rerenderForm(); },
  formMore: () => { const f = ui.form; f.more = !f.more; rerenderForm(); },
  formAlarm: (t) => { const f = ui.form, v = Number(t.dataset.v); f.alarms = f.alarms.includes(v) ? f.alarms.filter((x) => x !== v) : [...f.alarms, v]; rerenderForm(); },
  formColor: (t) => { const f = ui.form; f.color = t.dataset.v; f._colorTouched = true; rerenderForm(); },
  formJabOn: () => { const f = ui.form; f.jabOn = !f.jabOn; rerenderForm(); },
  formClose: () => {
    const f = ui.form;
    if (f && f.title.trim() && !f.id) {
      openSheet({ type: 'confirm', title: '작성을 그만둘까요?', body: '지금까지 적은 내용이 사라져요.', okLabel: '그만두기', okAct: 'formDiscard', danger: true, cancelLabel: '계속 쓰기', cancelAct: 'formResume' });
      return;
    }
    ui.form = null; closeSheet();
  },
  formDiscard: () => { ui.form = null; closeSheet(); },
  formResume: () => { openSheet({ type: 'form', id: ui.form && ui.form.id }); },
  formSave: () => saveForm(false),
  formSaveDup: () => saveForm(true),

  /* 딴짓 (FN07 시뮬레이션) */
  slackChoose: (t) => {
    const m = member(), p = ui.popup, run = m.runs[p.key]; if (!run) { ui.popup = null; render(); return; }
    const ev = run.slack[run.slack.length - 1]; const v = t.dataset.v; ev.choice = v;
    const L = persona().lines;
    if (v === 'study') { run.studyUntil = now() + HEAT_POLICY.studyRecheck * MIN; logRun(run, 'slack', '“공부 중이야” — 10분 뒤 다시 확인'); p.answer = pickLine(p.key + ':ss', L.slackStudy).tpl; }
    if (v === 'rest') { run.brk = { start: now(), until: now() + HEAT_POLICY.breakMinutes * MIN, ended: false }; logRun(run, 'break', '“잠깐 쉴게” — 5분 휴식'); p.answer = pickLine(p.key + ':sr', L.slackRest).tpl; }
    if (v === 'focus') { logRun(run, 'slack', '“다시 집중할게”'); p.answer = pickLine(p.key + ':sf', L.slackFocus).tpl; }
    p.choice = v; save(); render();
  },
  studyChoose: (t) => {
    const m = member(), p = ui.popup, run = m.runs[p.key]; const L = persona().lines;
    if (t.dataset.v === 'more') { run.studyUntil = now() + HEAT_POLICY.studyRecheck * MIN; logRun(run, 'slack', '강의 10분 더'); p.answer = L.studyMore[0]; }
    else { logRun(run, 'slack', '과제로 돌아감'); p.answer = L.studyBack[0]; }
    save(); render();
  },
  popupClose: () => {
    const p = ui.popup; ui.popup = null;
    if (p && p.key && p.answer && curOcc(p.key) && ACTIVE_KINDS.includes(curOcc(p.key).kind)) { ui.focusKey = p.key; ui.sheet = null; }
    render();
  },

  /* 나 */
  reduceMotion: () => { state.reduceMotion = !state.reduceMotion; applyMotionPref(); save(); render(); },
  replayOnboarding: () => { member().onboarded = false; ui.onb = { step: 0, stage: 3 }; save(); render(); },
  acct: (t) => {
    const v = t.dataset.v;
    const C = {
      logout: ['로그아웃할까요?', '이 기기에서만 나가요. 카카오 인증은 남아 있어서 다음엔 동의 없이 바로 들어와요. 일정과 기록은 그대로예요.', '로그아웃', false],
      kakaoLogout: ['카카오 로그아웃까지 할까요?', '잡도리에서 나가고 카카오 인증도 끝내요. 다음에 들어올 때 카카오 인증을 다시 거쳐요. 카카오 연결과 기록은 그대로예요.', '카카오 로그아웃', false],
      unlink: ['카카오 연결을 끊을까요?', '카카오 계정과 잡도리의 연결을 끊어요. 다음에 들어오면 동의부터 다시 받아요.<br><br><b>연결을 끊는 것과 탈퇴는 달라요.</b> 잡도리 기록은 탈퇴하기 전까지 남아 있고, 같은 카카오 계정으로 다시 연결하면 이어서 쓸 수 있어요. (정식 서비스에서는 연결이 끊긴 계정을 일정 기간 뒤 정리하는 정책이 따로 필요해요.)', '연결 끊기', true],
      withdraw: ['정말 탈퇴할까요?', '잡도리 일정·기록·설정이 모두 지워지고 카카오 연결도 함께 끊겨요. 되돌릴 수 없어요.', '탈퇴하기', true],
    }[v];
    openSheet({ type: 'confirm', title: C[0], body: C[1], okLabel: C[2], danger: C[3], okAct: 'doAcct', okData: `data-v="${v}"` });
  },
  doAcct: async (t) => {
    TTS.stop();
    const v = t.dataset.v, kid = kakaoId(), m = member();
    if (NATIVE.on && state.session && state.session.real) {
      // 진짜 앱: 카카오 서버에 로그아웃·연결 끊기를 실제로 요청 (05-native)
      ui.sheet = null; render();
      if (!(await nativeAccount(v))) return;
    } else {
      if (v === 'kakaoLogout' && state.kakao[kid]) state.kakao[kid].token = false;
      if (v === 'unlink') { state.kakao[kid] = { linked: false, token: false }; if (m) m.unlinked = true; }
      if (v === 'withdraw') { if (m) delete state.members[m.id]; delete state.memberByKakao[kid]; state.kakao[kid] = { linked: false, token: false }; }
    }
    state.session = null; ui.scopes = null;
    // 잡도리 세션은 확실히 끝났다고 진단 기록에도 남긴다 (카카오 쪽 상태는 '다시 확인'으로 확인)
    state.diag = { mode: NATIVE.on && !state.fakeLogin ? 'real' : 'fake', kind: 'logout', at: Date.now(), steps: { session: 'fail' }, failStep: 'session', code: v.toUpperCase(), msg: { logout: '잡도리앱에서 로그아웃함', kakaoLogout: '카카오 로그아웃함', unlink: '카카오 연결을 끊음', withdraw: '회원 탈퇴함' }[v], kakaoId: null, done: true };
    Object.assign(ui, { focusKey: null, sheet: null, result: null, popup: null, form: null, tab: 'today' });
    ui.login = { busy: false, note: { logout: 'loggedOut', kakaoLogout: 'kakaoLoggedOut', unlink: 'unlinked', withdraw: 'withdrawn' }[v] };
    save(); render();
  },

  /* 시연 콘솔 */
  cTime: (t) => { state.realTime = false; setClockHM(t.dataset.hm); renderConsole(true); },
  cBase: () => { state.realTime = false; setClock(BASE_CLOCK); renderConsole(true); },
  cShift: (t) => { state.realTime = false; setClock(now() + Number(t.dataset.min) * MIN); renderConsole(true); },
  cAuto: () => { state.auto = !state.auto; if (state.auto) state.realTime = false; save(); renderConsole(true); },
  cReal: () => { state.realTime = !state.realTime; if (state.realTime) { state.auto = false; syncRealClock(); toast('이제 이 기기의 실제 시각을 따라가요.'); } else save(); renderConsole(true); },
  cTalk: () => { state.talkInstalled = !state.talkInstalled; save(); renderConsole(true); },
  cExpire: () => {
    if (!state.session) { toast('로그인한 상태에서만 만료시킬 수 있어요.'); return; }
    state.session.expired = true; if (state.kakao[kakaoId()]) state.kakao[kakaoId()].token = false;
    Object.assign(ui, { focusKey: null, sheet: null, result: null, popup: null, form: null });
    save(); render();
  },
  cSlack: (t) => {
    const m = member();
    if (!m || !m.onboarded) { toast('로그인과 소개를 마친 뒤 시연할 수 있어요.'); return; }
    if (ui.popup) return;
    const app = t.dataset.app;
    const st = runningOcc(m);
    if (st && (st.kind === 'break')) { ui.popup = { type: 'slack', app, key: null, brk: true }; render(); return; }
    if (st) {
      st.run.slack.push({ at: now(), app, choice: null });
      logRun(st.run, 'slack', `딴짓 감지 — ${app} 실행`);
      ui.popup = { type: 'slack', app, key: st.key, askTpl: pickLine(st.key + ':ask', persona().lines.slackAsk, st.run.slack.length).tpl };
      save(); render(); return;
    }
    ui.popup = { type: 'slack', app, key: null }; render();
  },
  cSeed: () => { const m = member(); if (!m || !m.onboarded) { toast('로그인과 소개를 마친 뒤 넣을 수 있어요.'); return; } seedCommon(m); save(); render(); },
  cSeedExtra: () => { const m = member(); if (!m || !m.onboarded) { toast('로그인과 소개를 마친 뒤 넣을 수 있어요.'); return; } seedExtra(m); save(); render(); },
  cFill: () => {
    const m = member(); if (!m || !m.onboarded) { toast('로그인과 소개를 마친 뒤 쓸 수 있어요.'); return; }
    if (!ui.form || !ui.sheet || ui.sheet.type !== 'form') ui.form = newDraft(m, '2026-11-23');
    Object.assign(ui.form, testTaskSpec(), { errors: {}, _dlTouched: true });
    ui.form.heat = Math.max(50, ui.form.minHeat);
    ui.focusKey = null;
    openSheet({ type: 'form', id: ui.form.id });
  },
  cUndo: () => {
    const m = member(); if (!m) return;
    let n = 0;
    for (const k of Object.keys(m.runs)) if (splitKey(k)[1] === today()) { undoRun(m, k); n++; }
    Object.assign(ui, { focusKey: null, result: null, popup: null });
    save(); render(); toast(n ? `오늘 회차 ${n}개를 처음 상태로 되돌렸어요.` : '되돌릴 오늘 회차가 없어요.');
  },
  cReset: (t) => {
    if (!t.classList.contains('armed')) { t.classList.add('armed'); t.textContent = '한 번 더 누르면 모두 지워요'; setTimeout(() => { t.classList.remove('armed'); t.textContent = '전체 초기화'; }, 3000); return; }
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 저장소 없음 */ }
    state = freshState();
    for (const k of Object.keys(lineMemo)) delete lineMemo[k];
    Object.assign(ui, { tab: 'today', selDate: null, calMonth: null, focusKey: null, sheet: null, popup: null, result: null, form: null, login: { busy: false }, onb: { step: 0, stage: 3 } });
    applyMotionPref(); save(); render(true); renderConsole(true); toast('처음 상태로 돌렸어요.');
  },
  cToggle: () => { if (tabDrag.moved) { tabDrag.moved = false; return; } ui.consoleOpen = !ui.consoleOpen; document.body.classList.toggle('console-open', ui.consoleOpen); },
};
function doFail(excuse) {
  const m = member(), key = ui.sheet && ui.sheet.key;
  const st = key && curOcc(key); if (!st) { closeSheet(); return; }
  finishOcc(m, st, false, { excuse, reason: st.kind === 'missedStart' ? '시작하지 못하고 마감이 지남' : null });
  ui.focusKey = null; ui.result = { key }; ui.sheet = null; hideBanner();
  save(); render();
}
function saveForm(dupOK) {
  const m = member(), f = ui.form;
  f.errors = validateDraft(m, f);
  if (Object.keys(f.errors).length) {
    if (!ui.sheet || ui.sheet.type !== 'form') openSheet({ type: 'form', id: f.id }); else rerenderForm();
    const first = el.sheet.querySelector('[aria-invalid="true"], .field-err');
    if (first) { first.scrollIntoView({ block: 'center' }); if (first.focus) first.focus({ preventScroll: true }); }
    return;
  }
  if (!dupOK) {
    const dup = findDuplicate(m, f);
    if (dup) {
      openSheet({ type: 'confirm', title: '비슷한 일정이 이미 있어요', body: `‘${esc(dup.title)}’ (${repeatText(dup)} ${dup.start})${jo(dup.title, '이/가')} 이미 있어요. 그래도 하나 더 올릴까요?`, okLabel: '그래도 올리기', okAct: 'formSaveDup', cancelLabel: '돌아가서 고치기', cancelAct: 'formResume' });
      return;
    }
  }
  const prev = f.id ? findTask(m, f.id) : null;
  const jab = f.type === 'jab';
  const task = migrateTask({
    id: f.id || uid('t'), type: f.type, title: f.title.trim(),
    date: f.date, start: f.allDay ? '00:00' : f.start, endDate: f.endDate, end: f.allDay ? '23:59' : f.end, allDay: !!f.allDay,
    repeat: { kind: f.repeatKind, every: f.repeatKind === 'none' ? 1 : f.every, ...(f.repeatKind === 'weekly' ? { days: [...f.days].sort() } : {}) },
    alarms: [...f.alarms].sort((a, b) => a - b), color: f.color, memo: (f.memo || '').trim(),
    heat: jab ? Math.max(f.heat, f.minHeat) : null,
    jabOn: jab ? f.jabOn !== false : undefined,
    // 마감: 종료와 같으면 sameAsEnd만 켜 두고(같은 값을 두 번 저장하지 않음), 따로 정하면 날짜·시각을 저장
    deadline: jab ? { enabled: f.dlMode !== 'off', sameAsEnd: f.dlMode === 'end', date: f.dlMode === 'end' ? f.endDate : f.dlDate, time: f.dlMode === 'end' ? f.end : f.dlTime } : null,
    createdAt: prev ? prev.createdAt : now(),
  });
  if (prev) m.tasks[m.tasks.indexOf(prev)] = task; else m.tasks.push(task);
  if (!prev) {
    const pk = pickLine('saved', persona().lines.saved);
    ui.react = { id: task.id, until: Date.now() + 3200, mc: { expr: 'focus', pose: 'check', motion: 'check', fluff: 0 }, line: pk.tpl, fact: `${task.title} · ${fmtMD(task.date)} ${task.allDay ? '종일' : task.start}` };
    setTimeout(() => { if (ui.react && ui.react.id === task.id) { ui.react = null; render(); } }, 3300);
  }
  ui.form = null; ui.sheet = null;
  ui.selDate = task.date;
  if (ui.tab === 'calendar') ui.calMonth = task.date.slice(0, 7);
  trackHeat(m);
  save(); render();
  toast(prev ? '고친 내용을 저장했어요.' : task.type === 'jab' ? `${fmtMD(task.date)} ${task.start}부터 ${persona().name}${jo(persona().name, '이/가')} 붙어요.` : '달력에 적어 뒀어요.');
}

/* ---------- 시연 콘솔 ---------- */
const SCENARIOS = [
  ['normal', '정상 (최초 → 신규 가입 / 다음부터 → 기존 회원)'],
  ['existing', '기존 회원 (기록 있는 계정으로 로그인)'],
  ['noTalk', '카카오톡 미설치 → 카카오계정 로그인'],
  ['talkFail', '카카오톡 실행 실패 → 대체 경로 안내'],
  ['cancel', '사용자가 로그인 취소'],
  ['denyRequired', '동의 화면: 필수 항목 미동의 상태로 시작'],
  ['optionalOff', '동의 화면: 선택 항목 끄고 시작'],
  ['network', '네트워크 끊김 → 재시도'],
  ['server', '카카오 인증 서버 오류'],
  ['timeout', '요청 시간 초과'],
  ['authFail', '인증 실패'],
  ['returnFail', '카카오톡에서 앱 복귀 실패'],
];
const DEMO_STEPS = ['가상 카카오 로그인', '최초 회원 온보딩', '메인 화면 확인', '데이터베이스 과제 등록 (콘솔: 폼에 테스트 값 채우기)', '주간·월간 달력에서 확인', '일정 시작', '미루먼지 반응 확인', '시간 바꿔 마감 임박 확인 (19:30)', '딴짓 팝업 (YouTube 실행)', '성공 처리 → 오늘 회차 되돌리기', '실패 처리', '새 일정 올리기에서 쌓인 먼지 60 확인', '나 > 단계 이름을 공통으로 바꿔 보기'];
function consoleBody() {
  const m = member();
  const sess = state.session && !state.session.expired ? (m ? `${m.nickname} · ${m.onboarded ? '이용 중' : '온보딩 중'}` : '없음') : '로그인 전';
  const T = (hm, l) => `<button class="cs-btn" data-act="cTime" data-hm="${hm}">${hm}<small>${l}</small></button>`;
  return `<div class="cs-head"><div><b>시연 콘솔</b><p>앱 화면이 아니에요 · 테스트·발표 전용 도구</p></div><button class="cs-x" data-act="cToggle" aria-label="시연 콘솔 닫기">${icon('close')}</button></div>
  <section class="cs-sec"><h3>가상 시각</h3>
    <p class="cs-clock"><span id="cs-date"></span> <b id="cs-time"></b></p>
    <div class="cs-grid five">${T('18:00', '시작')}${T('19:00', '진행')}${T('19:30', '임박')}${T('19:50', '끓기 직전')}${T('20:00', '마감')}</div>
    <div class="cs-grid five">${[[-10, '−10분'], [1, '+1분'], [10, '+10분'], [60, '+1시간'], [1440, '+1일']].map(([v, l]) => `<button class="cs-btn" data-act="cShift" data-min="${v}">${l}</button>`).join('')}</div>
    <div class="cs-row"><button class="cs-toggle ${state.auto ? 'on' : ''}" data-act="cAuto" role="switch" aria-checked="${state.auto}"><i></i>시간 흐르게 (1초 = 1분)</button><button class="cs-btn ghost" data-act="cBase">11/23 18:00로</button></div>
    <div class="cs-row"><button class="cs-toggle ${state.realTime ? 'on' : ''}" data-act="cReal" role="switch" aria-checked="${!!state.realTime}"><i></i>실제 시각 쓰기 (폰에서 진짜로 써 보기)</button></div>
    <p class="cs-note">켜면 가상 시각 대신 이 기기의 지금 시각을 따라가요. 위의 시각 버튼을 누르면 다시 가상 시각으로 돌아가요.</p>
  </section>
  ${NATIVE.on ? `<section class="cs-sec"><h3>진짜 앱</h3>
    <div class="cs-row"><button class="cs-toggle ${state.fakeLogin ? 'on' : ''}" data-act="cFake" role="switch" aria-checked="${!!state.fakeLogin}"><i></i>카카오 로그인 흉내 모드 (인터넷 없이 발표할 때)</button></div>
    <p class="cs-note">끄면 진짜 카카오 로그인, 켜면 아래 '다음 로그인 결과' 시나리오로 흉내만 내요. 알림은 '실제 시각 쓰기'가 켜져 있을 때만 예약돼요.</p>
  </section>` : ''}
  <section class="cs-sec"><h3>다음 로그인 결과${NATIVE.on ? ' (흉내 모드일 때)' : ''}</h3>
    <div class="cs-radios" role="radiogroup" aria-label="다음 로그인 시나리오">${SCENARIOS.map(([v, l]) => `<label class="cs-radio"><input type="radio" name="scn" value="${v}" ${state.scenario === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="cs-row"><button class="cs-toggle ${state.talkInstalled ? 'on' : ''}" data-act="cTalk" role="switch" aria-checked="${state.talkInstalled}"><i></i>카카오톡 설치됨</button><button class="cs-btn ghost" data-act="cExpire">토큰 만료시키기</button></div>
    <div class="cs-row"><button class="cs-btn" data-act="openDiag">로그인 진단 열기 (개발자용)</button></div>
    <p class="cs-note">중복 클릭 무시: <b>${state.ignoredClicks}회</b> · 로그인 중 버튼을 여러 번 눌러 보세요.</p>
  </section>
  <section class="cs-sec"><h3>딴짓 시뮬레이션</h3>
    <div class="cs-grid two"><button class="cs-btn" data-act="cSlack" data-app="YouTube">YouTube 실행</button><button class="cs-btn" data-act="cSlack" data-app="Instagram">Instagram 실행</button></div>
    <p class="cs-note">실제 앱 감지·오버레이 권한은 쓰지 않아요. 진행 중인 잡도리 일정이 있으면 팝업이 떠요.</p>
  </section>
  <section class="cs-sec"><h3>테스트 데이터</h3>
    <div class="cs-grid two"><button class="cs-btn" data-act="cFill">등록 폼에 테스트 값 채우기</button><button class="cs-btn" data-act="cSeed">공통 테스트 일정 바로 넣기</button>
    <button class="cs-btn" data-act="cSeedExtra">보조 샘플 (일반 일정 3개)</button><button class="cs-btn" data-act="cUndo">오늘 회차 되돌리기</button></div>
    <button class="cs-btn danger block" data-act="cReset">전체 초기화</button>
  </section>
  <section class="cs-sec"><h3>지금 상태</h3>
    <dl class="cs-state"><div><dt>세션</dt><dd>${esc(sess)}</dd></div><div><dt>가입 회원</dt><dd>${Object.keys(state.members).length}명</dd></div>
    <div><dt>${scaleOf(m).floor}</dt><dd>${m ? lv(floorOf(m), m) + ' (가산 ' + m.penalty + '칸, 연속 성공 ' + m.streak + ')' : '-'}</dd></div>
    <div><dt>카카오 연결</dt><dd>${state.kakao[kakaoId()] && state.kakao[kakaoId()].linked ? '연결됨' : '없음'}${state.kakao[kakaoId()] && state.kakao[kakaoId()].token ? ' · 토큰 있음' : ''}</dd></div>
    <div><dt>저장</dt><dd>${storageOK ? 'LocalStorage (새로고침해도 유지)' : '메모리 (새로고침하면 사라짐)'}</dd></div></dl>
  </section>
  <section class="cs-sec"><h3>공통 시연 순서</h3><ol class="cs-steps">${DEMO_STEPS.map((s) => `<li>${s}</li>`).join('')}</ol></section>`;
}
function renderConsole(force) {
  if (!el.console) return;
  const html = consoleBody();
  if (force || html !== layerState.consoleHtml) {
    const top = el.console.scrollTop;
    el.console.innerHTML = html; layerState.consoleHtml = html;
    el.console.scrollTop = top;
  }
  const d = new Date(now());
  const dEl = $('#cs-date'), tEl = $('#cs-time');
  if (dEl) dEl.textContent = `${d.getFullYear()}년 ${fmtDateShort(today())}`;
  if (tEl) tEl.textContent = fmtHM(now());
}

/* 목소리(TTS)는 04c-voice.js */

/* ---------- 설치형 앱 (PWA) ---------- */
const PWA = {
  deferred: null,
  standalone() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } },
  framed() { try { return window.self !== window.top; } catch (e) { return true; } },
  status() {
    if (NATIVE.on) return 'native';
    if (this.standalone()) return 'installed';
    if (this.deferred) return 'prompt';
    const secure = location.protocol === 'https:' && !this.framed();
    if (!secure) return 'preview';
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'preview';
  },
  init() {
    if (NATIVE.on) return; // 진짜 앱에서는 서비스 워커·설치 안내가 필요 없음
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.deferred = e; render(); });
    window.addEventListener('appinstalled', () => { this.deferred = null; toast('홈 화면에 설치했어요.'); render(); });
    // 서비스 워커: https(또는 localhost)에서, 미리보기 액자 밖일 때만 등록 → 오프라인 실행
    try {
      const okHost = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if ('serviceWorker' in navigator && okHost && !this.framed()) navigator.serviceWorker.register('./sw.js').catch(() => { /* 미지원 환경 */ });
    } catch (e) { /* 미지원 환경 */ }
  },
};

/* ---------- 스크롤 휠 선택기 ---------- */
const wheelTimers = new WeakMap();
function wheelItems(w) { return Array.from(w.querySelectorAll('.wheel-item')); }
function initWheels() {
  for (const w of el.sheet.querySelectorAll('.wheel')) {
    const idx = Number(w.dataset.idx) || 0;
    w.scrollTop = idx * WHEEL_H;
    w.addEventListener('scroll', () => {
      clearTimeout(wheelTimers.get(w));
      wheelTimers.set(w, setTimeout(() => commitWheel(w), 110));
    }, { passive: true });
    w.addEventListener('keydown', (ev) => {
      const map = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
      if (ev.key in map) { ev.preventDefault(); w.scrollTo({ top: w.scrollTop + map[ev.key] * WHEEL_H, behavior: 'smooth' }); }
      if (ev.key === 'Home') { ev.preventDefault(); w.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (ev.key === 'End') { ev.preventDefault(); w.scrollTo({ top: w.scrollHeight, behavior: 'smooth' }); }
    });
    w.addEventListener('click', (ev) => {
      const it = ev.target.closest('.wheel-item'); if (!it) return;
      const i = wheelItems(w).indexOf(it);
      // 이미 선택된 가운데 줄을 누르면 직접 입력창
      if (String(i) === w.dataset.idx) { openWheelInput(wheelTarget(w.dataset.wheel)); return; }
      w.scrollTo({ top: i * WHEEL_H, behavior: 'smooth' });
    });
    w.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openWheelInput(wheelTarget(w.dataset.wheel)); } });
  }
}
function commitWheel(w) {
  // 폼을 다시 그리면 옛 휠은 화면에서 떨어져 나간다. 떨어진 휠은 scrollTop이 0이라
  // 늦게 도착한 스크롤 타이머가 값을 00으로 덮어쓰는 문제가 있었다 → 화면에 붙어 있는 휠만 반영
  if (!w.isConnected) return;
  const items = wheelItems(w);
  const i = clamp(Math.round(w.scrollTop / WHEEL_H), 0, items.length - 1);
  if (String(i) !== w.dataset.idx) {
    items.forEach((it, j) => it.classList.toggle('sel', j === i));
    w.dataset.idx = i;
    w.setAttribute('aria-valuetext', items[i].textContent + (w.parentElement.querySelector('.wheel-unit') ? w.parentElement.querySelector('.wheel-unit').textContent : ''));
    onWheel(w.dataset.wheel, items[i].dataset.v);
  }
}
/* 테스트·시연용: 휠 값을 바로 지정 */
function setWheel(id, v) {
  const w = el.sheet.querySelector(`.wheel[data-wheel="${id}"]`); if (!w) return false;
  const i = wheelItems(w).findIndex((it) => it.dataset.v === String(v)); if (i < 0) return false;
  w.scrollTop = i * WHEEL_H; commitWheel(w); return true;
}
function onWheel(id, v) {
  const f = ui.form; if (!f) return;
  const setHM = (key, part, val) => { const [h, mm] = (f[key] || '00:00').split(':'); f[key] = part === 'h' ? `${val}:${mm}` : `${h}:${val}`; };
  if (id === 'date') {
    const span = daysBetween(f.date, f.endDate); // 시작 날짜를 옮기면 종료 날짜도 같은 간격으로 따라간다
    f.date = v; f.endDate = addDays(v, Math.max(0, span)); delete f.errors.date;
    if (f.repeatKind === 'weekly' && f.days.length === 1) f.days = [weekday(v)];
    if (!f._dlTouched || f.dlDate < f.date) f.dlDate = f.date;
    rerenderForm(); return;
  }
  if (id === 'start-h') setHM('start', 'h', v);
  if (id === 'start-m') setHM('start', 'm', v);
  if (id === 'end-date') { f.endDate = v; delete f.errors.date; delete f.errors.time; }
  if (id === 'end-h') setHM('end', 'h', v);
  if (id === 'end-m') setHM('end', 'm', v);
  if (id === 'dl-date') { f.dlDate = v; f._dlTouched = true; }
  if (id === 'dl-h') { setHM('dlTime', 'h', v); f._dlTouched = true; }
  if (id === 'dl-m') { setHM('dlTime', 'm', v); f._dlTouched = true; }
  if (id.startsWith('start') || id.startsWith('end')) delete f.errors.time;
  if (id.startsWith('dl')) delete f.errors.deadline;
  const sum = $('#time-summary span'); if (sum) sum.textContent = draftSummary(f);
  const dh = $('#dl-hint'); if (dh) dh.textContent = draftDeadlineHint(f);
  const sh = $('#start-hint'); if (sh) sh.textContent = f.type === 'jab' && f.date === today() && !f.allDay && at(f.date, f.start) < now() ? '시작 시각이 이미 지났어요. 올리면 바로 잡도리가 시작돼요.' : '';
  // 시작·종료 줄의 글자도 바로 바꾼다 (선택기는 그대로 둔 채)
  for (const [k, d, hm] of [['start', f.date, f.start], ['end', f.endDate, f.end], ['dl', f.dlDate, f.dlTime]]) {
    const r = el.sheet.querySelector(`.when-row[data-v="${k}"]`); if (!r) continue;
    const dd = r.querySelector('.wr-date'), tt = r.querySelector('.wr-time');
    if (dd) dd.textContent = fmtDateShort(d); if (tt) tt.textContent = hm;
  }
}

/* ---------- 실시간 멘트 알림 (FN03 · 앱 안 알림 배너) ---------- */
let bannerTimer = null;
function showBanner(text, key, mc, stage = 0, ev = 'start', fact = '') {
  const b = $('#layer-banner'); if (!b) return;
  const m = member();
  b.innerHTML = `<button class="banner" data-act="bannerTap" data-key="${key || ''}"><span class="bn-mascot">${mascot(m, { ...mc, motion: 'none', shadow: false })}</span><span class="bn-text"><b>${persona().name}</b><span>${esc(text)}</span>${fact ? `<small>${esc(fact)}</small>` : ''}</span></button>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 4200);
  TTS.say(text, { pri: 'key', stage, ev }); // 배너 = 중요한 순간
}
function hideBanner() { clearTimeout(bannerTimer); $('#layer-banner')?.classList.remove('show'); }
function alertTransitions(m, before, after) {
  for (const [k, a] of Object.entries(after)) {
    const b = before[k]; if (!b) continue;
    const st = a.st, title = st.task.title, B = persona().lines.banner;
    if (b.kind === 'upcoming' && a.kind === 'late') return showBanner(B.start, k, { expr: 'focus', pose: 'nag' }, a.stage, 'start', `${title} · 시작 시간`);
    if (b.kind !== 'urgent' && a.kind === 'urgent') return showBanner(B.urgent, k, { expr: 'angry', pose: 'puff', fluff: 0.6 }, a.stage, 'deadline', `${title} · 마감 ${HEAT_POLICY.urgentWindow}분 전`);
    if ((a.kind === 'overdue' || a.kind === 'missedStart') && b.kind !== a.kind) return showBanner(B.due, k, { expr: 'furious', pose: 'puff', fluff: 1 }, 5, 'deadline', `${title} · 마감`);
    if (a.kind === 'late' && a.stage > b.stage && a.stage >= 4) return showBanner(B.lateHard, k, { expr: 'angry', pose: 'nag', fluff: 0.6 }, a.stage, 'start', `${title} · 아직 시작 전`);
    if (b.kind === 'break' && a.kind === 'breakOver') return showBanner(B.breakOver, k, { expr: 'suspicious', pose: 'nag', fluff: 0.2 }, a.stage, 'start', `${title} · 휴식 끝`);
  }
}

Object.assign(ACT, {
  /* 캐릭터 터치 → 메뉴바 (기획안 v5) */
  mascotTap: () => {
    const m = member(), pk = pickLine('poke', persona().lines.poke || persona().lines.welcome);
    ui.react = { id: 'tap', until: Date.now() + 2200, mc: { expr: 'happy', pose: 'wave', motion: 'bounce' }, line: pk.tpl };
    TTS.say(pk.tpl, { ev: 'speech' });
    setTimeout(() => { if (ui.react && ui.react.id === 'tap') { ui.react = null; render(); } }, 2300);
    render();
  },

  /* 나 > 단계 이름: 캐릭터별 ↔ 공통 (숫자·잔소리는 그대로, 이름만 바뀐다) */
  scaleMode: (t) => {
    const m = member(); if (!m) return;
    m.scaleMode = t.dataset.v === 'common' ? 'common' : 'character'; save(); render();
    const S = scaleOf(m);
    toast(`이제 ${josa(S.title, "으로/로")} 보여 줘요 · ${S.stages[0].name} ~ ${S.stages[4].name}`);
  },
  installApp: async () => {
    if (!PWA.deferred) return;
    try { PWA.deferred.prompt(); await PWA.deferred.userChoice; } catch (e) { /* 취소 */ }
    PWA.deferred = null; render();
  },
  bannerTap: (t) => {
    $('#layer-banner')?.classList.remove('show');
    const k = t.dataset.key; const st = k && curOcc(k);
    if (st && (ACTIVE_KINDS.includes(st.kind) || st.kind === 'missedStart')) { ui.focusKey = k; ui.sheet = null; }
    else { ui.focusKey = null; ui.tab = 'today'; }
    render();
  },
});

/* ---------- 시작 ---------- */
function applyMotionPref() { document.documentElement.classList.toggle('reduce', !!state.reduceMotion); }
function init() {
  el = { device: $('#device'), app: $('#app'), screen: $('#screen'), tabbar: $('#tabbar'), sheet: $('#layer-sheet'), popup: $('#layer-popup'), result: $('#layer-result'), toast: $('#toast'), console: $('#console'), status: $('#sb-time') };
  applyMotionPref();
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    if (t.disabled) return;
    if (t.getAttribute('aria-disabled') === 'true') {
      if (t.dataset.act === 'login') { state.ignoredClicks++; save(); renderConsole(); }
      return;
    }
    const fn = ACT[t.dataset.act];
    if (Date.now() - swipeGuard < 400 && t.closest('[data-swipe]')) return; // 방금 쓸어 넘긴 손가락이 칸을 누른 것으로 잡히지 않게
    if (fn) { ev.preventDefault(); fn(t, ev); }
  });
  document.addEventListener('input', onField);
  document.addEventListener('change', (ev) => {
    if (ev.target.name === 'scn') { state.scenario = ev.target.value; if (state.scenario === 'noTalk') state.talkInstalled = true; save(); renderConsole(true); return; }
    onField(ev, true);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (ui.popup) return; // 딴짓 팝업은 답을 골라야 닫힘
    if (ui.sheet) { ACT.sheetScrim(); ev.preventDefault(); }
    else if (document.body.classList.contains('console-open')) ACT.cToggle();
  });
  // 달력을 옆으로 쓸면 이전·다음 (월간 = 달, 주간 = 주, 일간 = 날). 세로 스크롤과 헷갈리지 않게 가로로 충분히 움직였을 때만
  let sw = null;
  document.addEventListener('touchstart', (ev) => { const z = ev.target.closest('[data-swipe="cal"]'); sw = z ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
  document.addEventListener('touchend', (ev) => {
    if (!sw) return; const t = ev.changedTouches[0]; const dx = t.clientX - sw.x, dy = t.clientY - sw.y, quick = Date.now() - sw.t < 600; sw = null;
    if (quick && Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) { swipeGuard = Date.now(); ACT.calNav({ dataset: { delta: dx < 0 ? 1 : -1 } }); }
  }, { passive: true });
  TTS.init();
  PWA.init();
  render(true);
  renderConsole(true);
  setInterval(() => { if (state.auto) setClock(now() + MIN); else if (state.realTime) syncRealClock(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.realTime) syncRealClock(true); });
  initTabDrag();
  nativeInit();
}
/* 실제 시각 모드: 폰에 설치해서 실제로 쓸 때 가상 시각 대신 기기 시각을 따라감 (분 단위로만 갱신) */
function syncRealClock(force) {
  const t = Math.floor(Date.now() / MIN) * MIN;
  if (force || t !== now()) setClock(t);
}
/* 시연 탭 끌어서 옮기기: 좁은 폰에서 내용을 가리면 위아래로 치울 수 있게 */
const tabDrag = { moved: false };
function initTabDrag() {
  const tab = $('#console-tab'); if (!tab) return;
  try { const y = Number(localStorage.getItem('jabdori-tab-y')); if (y > 0) tab.style.top = y + '%'; } catch (e) { /* 저장소 없음 */ }
  let start = null;
  tab.addEventListener('pointerdown', (ev) => { start = { y: ev.clientY, top: tab.getBoundingClientRect().top }; tabDrag.moved = false; tab.setPointerCapture(ev.pointerId); });
  tab.addEventListener('pointermove', (ev) => {
    if (!start) return; const dy = ev.clientY - start.y;
    if (Math.abs(dy) > 6) tabDrag.moved = true;
    if (tabDrag.moved) { const pct = clamp((start.top + dy) / innerHeight * 100, 8, 86); tab.style.top = pct + '%'; }
  });
  const end = () => { if (start && tabDrag.moved) { try { localStorage.setItem('jabdori-tab-y', parseFloat(tab.style.top)); } catch (e) { /* 무시 */ } } start = null; };
  tab.addEventListener('pointerup', end); tab.addEventListener('pointercancel', end);
}
function onField(ev, isChange) {
  const t = ev.target, k = t.dataset && t.dataset.field;
  if (!k || !ui.form) return;
  const f = ui.form;
  if (k === 'heat') {
    let v = Number(t.value);
    if (v < f.minHeat) { v = f.minHeat; t.value = v; }
    f.heat = v;
    t.setAttribute('aria-valuetext', `${lvs(v)}, ${stageOf(v).name}`);
    const pv = $('#heat-preview'); if (pv) pv.innerHTML = heatPreview(v);
    return;
  }
  f[k] = t.value;
  if (k === 'dlDate' || k === 'dlTime') f._dlTouched = true;
  if (k === 'title') {
    const c = $('#title-count'); if (c) c.textContent = `${t.value.length}/30`;
    if (f.errors.title) { delete f.errors.title; t.removeAttribute('aria-invalid'); const e = $('#err-title'); if (e) e.remove(); }
    return;
  }
  if (k === 'date' && isChange) {
    if (f.dlDate < f.date) f.dlDate = f.date;
    delete f.errors.date;
    rerenderForm(); return;
  }
  const sum = $('#time-summary span'); if (sum && f.start) sum.textContent = draftSummary(f);
  const dh = $('#dl-hint'); if (dh) dh.textContent = draftDeadlineHint(f);
  const sh = $('#start-hint'); if (sh) sh.textContent = f.date === today() && f.start && at(f.date, f.start) < now() ? '시작 시각이 이미 지났어요. 올리면 바로 잡도리가 시작돼요.' : '';
}
document.addEventListener('DOMContentLoaded', init);
