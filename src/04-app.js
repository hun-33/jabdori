/* =========================================================
   04-app: 렌더링 엔진, 사용자 동작, 로그인 시뮬레이션, 시연 콘솔
   ========================================================= */

let el = {};
let cur = { id: null, sig: null, tpl: null };
const layerState = { sheetKey: null, sheetHtml: '', popupHtml: '', resultHtml: '', tabHtml: '', consoleHtml: '' };
let formDirty = false;
let lastFocus = null;

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
function render(force = false) {
  const v = computeScreen();
  const live = LIVE, lives = LIVES;
  const sig = sigOf(v.html);
  if (force || v.id !== cur.id || sig !== cur.sig) {
    const same = v.id === cur.id;
    const top = el.screen.scrollTop;
    el.screen.innerHTML = v.html;
    if (same) el.screen.scrollTop = top;
    else {
      el.screen.scrollTop = 0;
      el.screen.classList.remove('enter'); void el.screen.offsetWidth; el.screen.classList.add('enter');
    }
    const sp = el.screen.querySelector('.speech[data-tpl]');
    const tpl = sp ? sp.dataset.tpl : null;
    if (sp && tpl !== cur.tpl) { sp.classList.add('say'); if (state.ttsAuto && cur.tpl !== null) TTS.speak(sp.textContent); }
    cur = { id: v.id, sig, tpl };
  } else patchLive(live, lives);

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
  renderLayers(m);
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
    else if (s.type === 'month' && m) sh = viewMonthSheet(m);
    else if (s.type === 'closet' && m) sh = viewCloset(m);
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
    if (rh && isNew) el.result.querySelector('.res-title')?.setAttribute('tabindex', '-1'), el.result.querySelector('.res-title')?.focus({ preventScroll: true });
  }
  // 팝업
  const ph = ui.popup && m ? viewSlackPopup(m) : '';
  if (ph !== layerState.popupHtml) {
    const isNew = !layerState.popupHtml;
    el.popup.innerHTML = ph; layerState.popupHtml = ph;
    if (ph && !isNew) el.popup.querySelector('.popup')?.classList.add('still');
    if (ph) (el.popup.querySelector('.opt') || el.popup.querySelector('.btn'))?.focus({ preventScroll: true });
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
      ui.calMonth = null; ui.calWeek = null;
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
  m.tasks.push(tA, tB, tC);
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
  ui.login = { busy: false };
  ui.tab = 'today'; ui.selDate = today(); ui.onb = { step: 0, stage: 3 }; ui.focusKey = null;
  state.settledDay = today();
  save(); render();
  if (!isNew) toast(relinked ? '다시 연결됐어요. 기록은 그대로예요.' : `다시 왔네요, ${mm.nickname} 님. 기록은 그대로예요.`);
}

/* ---------- 테스트 데이터 ---------- */
function testTaskSpec() {
  return { type: 'jab', title: '데이터베이스 과제', date: '2026-11-23', repeatKind: 'weekly', days: [1], every: 2, start: '18:00', durMode: 120, end: '20:00', heat: 50, dlOn: true, dlDate: '2026-11-23', dlTime: '20:00' };
}
function seedCommon(m) {
  if (m.tasks.some((t) => t.title === '데이터베이스 과제')) { toast('데이터베이스 과제가 이미 있어요.'); return; }
  const s = testTaskSpec();
  m.tasks.push({ id: uid('t'), type: 'jab', title: s.title, date: s.date, repeat: { kind: 'weekly', days: [1] }, start: s.start, duration: 120, heat: 50, deadline: { enabled: true, date: s.date, time: s.dlTime }, createdAt: now() });
  ui.selDate = today();
  toast('공통 테스트 일정을 넣었어요 · 데이터베이스 과제');
}
function seedExtra(m) {
  const add = (title, days, start, duration) => { if (!m.tasks.some((t) => t.title === title)) m.tasks.push({ id: uid('t'), type: 'normal', title, date: '2026-11-23', repeat: { kind: 'weekly', days }, start, duration, heat: null, deadline: null, createdAt: now() }); };
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
  tab: (t) => { ui.tab = t.dataset.tab; ui.focusKey = null; ui.sheet = null; if (ui.tab === 'calendar') { ui.calMonth = (ui.selDate || today()).slice(0, 7); ui.calWeek = mondayOf(ui.selDate || today()); } render(); },
  selDate: (t) => { ui.selDate = t.dataset.date; render(); },
  calPick: (t) => { ui.selDate = t.dataset.date; ui.calWeek = mondayOf(ui.selDate); if (ui.calMode === 'month' && ui.selDate.slice(0, 7) !== ui.calMonth) ui.calMonth = ui.selDate.slice(0, 7); render(); },
  calMode: (t) => { ui.calMode = t.dataset.v; ui.calMonth = ui.selDate.slice(0, 7); ui.calWeek = mondayOf(ui.selDate); render(); },
  calNav: (t) => { const [y, mo] = ui.calMonth.split('-').map(Number); const d = new Date(y, mo - 1 + Number(t.dataset.delta), 1); ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); },
  weekNav: (t) => { ui.calWeek = addDays(ui.calWeek, 7 * Number(t.dataset.delta)); render(); },
  calToday: () => { ui.selDate = today(); ui.calMonth = today().slice(0, 7); ui.calWeek = mondayOf(today()); render(); },

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
  exitFocus: () => { ui.focusKey = null; ui.tab = 'today'; render(); },
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
      body: `‘${esc(st.task.title)}’${jo(st.task.title, '을/를')} 실패로 기록해요. 다음에 올리는 잡도리 일정의 바닥 온도가 <b>${f}° → ${nf}°</b>로 올라가요.`,
      okLabel: '실패로 기록하기', okAct: 'confirmFail', okData: `data-key="${t.dataset.key}"`, danger: true, cancelLabel: '다시 해볼게',
    });
  },
  failNow: (t) => openSheet({ type: 'excuse', key: t.dataset.key }),
  confirmFail: (t) => openSheet({ type: 'excuse', key: t.dataset.key }),
  excuse: (t) => doFail(t.dataset.v),
  excuseSkip: () => doFail(null),
  resultClose: () => { ui.result = null; ui.tab = 'today'; render(); },
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
  formType: (t) => { const f = ui.form; f.type = t.dataset.v; if (f.type === 'jab') f.heat = Math.max(f.heat, f.minHeat); rerenderForm(); },
  formRepeat: (t) => { const f = ui.form; f.repeatKind = t.dataset.v; if (f.repeatKind === 'weekly' && !f.days.length) f.days = [weekday(f.date)]; if (f.repeatKind === 'interval' && !(f.every >= 1)) f.every = 1; delete f.errors.days; rerenderForm(); },
  formDay: (t) => { const f = ui.form, d = Number(t.dataset.d); f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d]; if (f.days.length) delete f.errors.days; rerenderForm(); },
  formEvery: (t) => { const f = ui.form; f.every = clamp(f.every + Number(t.dataset.delta), 1, 30); rerenderForm(); },
  formDur: (t) => {
    const f = ui.form, v = t.dataset.v;
    if (v === 'custom') { f.end = minToHm(hmToMin(f.start) + draftDuration(f)); f.durMode = 'custom'; } else f.durMode = Number(v);
    delete f.errors.time; rerenderForm();
  },
  formDl: (t) => {
    const f = ui.form; f.dlOn = t.dataset.v === 'on';
    if (f.dlOn && (!f.dlDate || f.dlDate < f.date)) f.dlDate = f.date;
    if (f.dlOn && !f._dlTouched) { f.dlTime = minToHm(hmToMin(f.start) + draftDuration(f)); f.dlDate = hmToMin(f.start) + draftDuration(f) >= 1440 ? addDays(f.date, 1) : f.date; }
    delete f.errors.deadline; rerenderForm();
  },
  formFitDeadline: () => {
    const f = ui.form;
    const d = Math.round((at(f.dlDate, f.dlTime) - at(f.date, f.start)) / MIN);
    if (d <= 0) { f.errors.deadline = '마감이 시작 시각보다 앞이라 맞출 수 없어요.'; rerenderForm(); return; }
    if (d > 12 * 60) { toast('12시간이 넘어서 끝나는 시간을 마감에 맞출 수 없어요.'); return; }
    f.durMode = [30, 60, 90, 120].includes(d) ? d : 'custom'; f.end = minToHm(hmToMin(f.start) + d);
    delete f.errors.time; rerenderForm();
  },
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
    const L = PERSONA.lines;
    if (v === 'study') { run.studyUntil = now() + HEAT_POLICY.studyRecheck * MIN; logRun(run, 'slack', '“공부 중이야” — 10분 뒤 다시 확인'); p.answer = pickLine(p.key + ':ss', L.slackStudy).tpl; }
    if (v === 'rest') { run.brk = { start: now(), until: now() + HEAT_POLICY.breakMinutes * MIN, ended: false }; logRun(run, 'break', '“잠깐 쉴게” — 5분 휴식'); p.answer = pickLine(p.key + ':sr', L.slackRest).tpl; }
    if (v === 'focus') { logRun(run, 'slack', '“다시 집중할게”'); p.answer = pickLine(p.key + ':sf', L.slackFocus).tpl; }
    p.choice = v; save(); render();
  },
  studyChoose: (t) => {
    const m = member(), p = ui.popup, run = m.runs[p.key]; const L = PERSONA.lines;
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
      withdraw: ['정말 탈퇴할까요?', '잡도리 일정·기록·바닥 온도가 모두 지워지고 카카오 연결도 함께 끊겨요. 되돌릴 수 없어요.', '탈퇴하기', true],
    }[v];
    openSheet({ type: 'confirm', title: C[0], body: C[1], okLabel: C[2], danger: C[3], okAct: 'doAcct', okData: `data-v="${v}"` });
  },
  doAcct: async (t) => {
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
      ui.popup = { type: 'slack', app, key: st.key, askTpl: pickLine(st.key + ':ask', PERSONA.lines.slackAsk, st.run.slack.length).tpl };
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
    Object.assign(ui, { tab: 'today', selDate: null, calMonth: null, calWeek: null, focusKey: null, sheet: null, popup: null, result: null, form: null, login: { busy: false }, onb: { step: 0, stage: 3 } });
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
  const task = {
    id: f.id || uid('t'), type: f.type, title: f.title.trim(), date: f.date,
    repeat: f.repeatKind === 'interval' && f.every === 1 ? { kind: 'daily' } : { kind: f.repeatKind, ...(f.repeatKind === 'weekly' ? { days: [...f.days].sort() } : {}), ...(f.repeatKind === 'interval' ? { every: f.every } : {}) },
    start: f.start, duration: draftDuration(f),
    heat: f.type === 'jab' ? Math.max(f.heat, f.minHeat) : null,
    deadline: f.type === 'jab' ? { enabled: f.dlOn, date: f.dlDate, time: f.dlTime } : null,
    createdAt: prev ? prev.createdAt : now(),
  };
  if (prev) m.tasks[m.tasks.indexOf(prev)] = task; else m.tasks.push(task);
  if (!prev) {
    const pk = pickLine('saved', PERSONA.lines.saved);
    ui.react = { id: task.id, until: Date.now() + 3200, mc: { expr: 'focus', pose: 'check', motion: 'check', fluff: 0 }, line: fillLine(pk.tpl, { title: task.title, start: task.start }) };
    setTimeout(() => { if (ui.react && ui.react.id === task.id) { ui.react = null; render(); } }, 3300);
  }
  ui.form = null; ui.sheet = null;
  ui.selDate = task.date;
  if (ui.tab === 'calendar') { ui.calMonth = task.date.slice(0, 7); ui.calWeek = mondayOf(task.date); }
  trackHeat(m);
  save(); render();
  toast(prev ? '고친 내용을 저장했어요.' : task.type === 'jab' ? `맡았어. ${fmtMD(task.date)} ${task.start}부터 내가 볼게.` : '달력에 적어 뒀어요.');
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
const DEMO_STEPS = ['가상 카카오 로그인', '최초 회원 온보딩', '메인 화면 확인', '데이터베이스 과제 등록 (콘솔: 폼에 테스트 값 채우기)', '주간·월간 달력에서 확인', '일정 시작', '미루먼지 반응 확인', '시간 바꿔 마감 임박 확인 (19:30)', '딴짓 팝업 (YouTube 실행)', '성공 처리 → 오늘 회차 되돌리기', '실패 처리', '새 일정 올리기에서 바닥 온도 60° 확인'];
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
    <div><dt>바닥 온도</dt><dd>${m ? floorOf(m) + '° (가산 ' + m.penalty + '단계, 연속 성공 ' + m.streak + ')' : '-'}</dd></div>
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

/* ---------- 미루먼지 목소리 (TTS, 기기 음성 사용) ---------- */
const TTS = {
  voice: null,
  ok() { if (NATIVE.on) return !!NATIVE.Speech; try { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; } catch (e) { return false; } },
  init() {
    if (NATIVE.on || !this.ok()) return;
    const pick = () => { try { const vs = speechSynthesis.getVoices(); this.voice = vs.find((v) => /^ko/i.test(v.lang)) || null; } catch (e) { /* 무시 */ } };
    pick();
    try { speechSynthesis.addEventListener('voiceschanged', pick); } catch (e) { /* 무시 */ }
  },
  speak(text) {
    if (!this.ok() || !text) return false;
    if (NATIVE.on) { // 진짜 앱: 안드로이드 기기 음성 엔진
      const S = NATIVE.Speech;
      S.stop().catch(() => {}).then(() => S.speak({ text, lang: 'ko-KR', rate: 1.0, pitch: 1.3, volume: 1.0, category: 'ambient' })).catch(() => toast('기기에 한국어 음성이 없어서 읽지 못했어요.'));
      return true;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; if (this.voice) u.voice = this.voice;
      u.rate = 1.05; u.pitch = 1.35;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  },
};

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
      w.scrollTo({ top: i * WHEEL_H, behavior: 'smooth' });
    });
  }
}
function commitWheel(w) {
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
    f.date = v; delete f.errors.date;
    if (f.repeatKind === 'weekly' && f.days.length === 1) f.days = [weekday(v)];
    if (!f._dlTouched || f.dlDate < f.date) f.dlDate = f.date;
    rerenderForm(); return;
  }
  if (id === 'start-h') setHM('start', 'h', v);
  if (id === 'start-m') setHM('start', 'm', v);
  if (id === 'end-h') setHM('end', 'h', v);
  if (id === 'end-m') setHM('end', 'm', v);
  if (id === 'dl-date') { f.dlDate = v; f._dlTouched = true; }
  if (id === 'dl-h') { setHM('dlTime', 'h', v); f._dlTouched = true; }
  if (id === 'dl-m') { setHM('dlTime', 'm', v); f._dlTouched = true; }
  if (id.startsWith('start') || id.startsWith('end')) delete f.errors.time;
  if (id.startsWith('dl')) delete f.errors.deadline;
  const sum = $('#time-summary span'); if (sum) sum.textContent = draftSummary(f);
  const dh = $('#dl-hint'); if (dh) dh.textContent = draftDeadlineHint(f);
  const sh = $('#start-hint'); if (sh) sh.textContent = f.date === today() && at(f.date, f.start) < now() ? '시작 시각이 이미 지났어요. 올리면 바로 잡도리가 시작돼요.' : '';
}

/* ---------- 실시간 멘트 알림 (FN03 · 앱 안 알림 배너) ---------- */
let bannerTimer = null;
function showBanner(text, key, mc) {
  const b = $('#layer-banner'); if (!b) return;
  const m = member();
  b.innerHTML = `<button class="banner" data-act="bannerTap" data-key="${key || ''}"><span class="bn-mascot">${mascot(m, { ...mc, motion: 'none', shadow: false })}</span><span class="bn-text"><b>${PERSONA.name}</b><span>${esc(text)}</span></span></button>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 4200);
  if (state.ttsAuto) TTS.speak(text);
}
function hideBanner() { clearTimeout(bannerTimer); $('#layer-banner')?.classList.remove('show'); }
function alertTransitions(m, before, after) {
  for (const [k, a] of Object.entries(after)) {
    const b = before[k]; if (!b) continue;
    const st = a.st, title = st.task.title;
    if (b.kind === 'upcoming' && a.kind === 'late') return showBanner(`${title} 시작할 시간이야. 이제 슬슬 움직여야 하지 않아?`, k, { expr: 'focus', pose: 'nag' });
    if (b.kind !== 'urgent' && a.kind === 'urgent') return showBanner(`${title} 마감 30분 전이야. 마무리부터 해!`, k, { expr: 'angry', pose: 'puff', fluff: 0.6 });
    if ((a.kind === 'overdue' || a.kind === 'missedStart') && b.kind !== a.kind) return showBanner(`${title} 마감 시간이야. 결과 알려 줘.`, k, { expr: 'furious', pose: 'puff', fluff: 1 });
    if (a.kind === 'late' && a.stage > b.stage && a.stage >= 4) return showBanner(`아직 시작 안 했지? ${title}, 폰 내려놓고 지금 열어.`, k, { expr: 'angry', pose: 'nag', fluff: 0.6 });
  }
}

Object.assign(ACT, {
  /* 캐릭터 터치 → 메뉴바 (기획안 v5) */
  mascotTap: () => {
    ui.menuOpen = !ui.menuOpen;
    if (ui.menuOpen) ui.react = { id: 'tap', until: Date.now() + 1600, mc: { expr: 'surprised', pose: 'wave', motion: 'bounce' } };
    render();
  },
  menuAdd: () => { ui.menuOpen = false; ACT.openAdd({ dataset: { date: ui.selDate || today() } }); },
  menuHeat: () => {
    ui.menuOpen = false; ACT.openAdd({ dataset: { date: ui.selDate || today() } });
    setTimeout(() => { const h = $('#sec-heat'); if (h) { h.scrollIntoView({ block: 'start', behavior: 'smooth' }); $('#f-heat')?.focus({ preventScroll: true }); } }, 380);
  },
  openMonth: () => { ui.menuOpen = false; ui.calMonth = (ui.selDate || today()).slice(0, 7); openSheet({ type: 'month' }); },
  monthNav: (t) => { const [y, mo] = ui.calMonth.split('-').map(Number); const d = new Date(y, mo - 1 + Number(t.dataset.delta), 1); ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); },
  monthPick: (t) => { ui.selDate = t.dataset.date; render(); },
  openCloset: () => { ui.menuOpen = false; openSheet({ type: 'closet' }); },
  setCostume: (t) => {
    const m = member(); m.costume = t.dataset.v; save();
    if (ui.sheet && ui.sheet.type === 'closet') render(); else render(true);
    toast(`${COSTUMES[m.costume].name}으로 갈아입었어.`);
  },
  speak: () => {
    const sp = el.screen.querySelector('.speech');
    if (!TTS.speak(sp ? sp.textContent : '')) toast('이 기기에서는 음성 읽기를 쓸 수 없어요.');
  },
  ttsAuto: () => { state.ttsAuto = !state.ttsAuto; save(); render(); if (state.ttsAuto) TTS.speak('이제 내가 말로도 잔소리할게.'); },
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
    if (ui.menuOpen && !['mascotTap', 'menuAdd', 'menuHeat', 'openMonth', 'openCloset'].includes(t.dataset.act)) ui.menuOpen = false;
    if (fn) { ev.preventDefault(); fn(t, ev); }
  });
  document.addEventListener('click', (ev) => { if (ui.menuOpen && !ev.target.closest('[data-act]')) { ui.menuOpen = false; render(); } });
  document.addEventListener('input', onField);
  document.addEventListener('change', (ev) => {
    if (ev.target.name === 'scn') { state.scenario = ev.target.value; if (state.scenario === 'noTalk') state.talkInstalled = true; save(); renderConsole(true); return; }
    onField(ev, true);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (ui.menuOpen) { ui.menuOpen = false; render(); return; }
    if (ui.popup) return; // 딴짓 팝업은 답을 골라야 닫힘
    if (ui.sheet) { ACT.sheetScrim(); ev.preventDefault(); }
    else if (document.body.classList.contains('console-open')) ACT.cToggle();
  });
  // 주간 달력을 아래로 쓸면 월간 달력 (기획안 v5 '하단 추가 화면')
  let sw = null;
  document.addEventListener('touchstart', (ev) => { const z = ev.target.closest('[data-swipe="month"]'); sw = z ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null; }, { passive: true });
  document.addEventListener('touchend', (ev) => {
    if (!sw) return; const t = ev.changedTouches[0]; const dx = t.clientX - sw.x, dy = t.clientY - sw.y; sw = null;
    if (dy > 50 && Math.abs(dx) < 40) ACT.openMonth();
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
    t.setAttribute('aria-valuetext', `${v}도, ${stageOf(v).name}`);
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
