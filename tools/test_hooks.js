/* 자동 검사 전용 도우미 (앱에는 들어가지 않음)
   예전 '시연 도구'에 있던 가상 시각·테스트 일정·딴짓 흉내를 검사 스크립트에서만 쓴다.
   Playwright: ctx.add_init_script(path='tools/test_hooks.js')
   - 앱 스크립트가 읽힌 뒤, 앱의 init()보다 먼저(DOMContentLoaded) ACT에 붙인다.
   - 웹(브라우저) 검사는 가상 시각 2026-11-23(월) 18:00에서 시작한다. 진짜 앱 흉내(NATIVE.on)는 실제 시각 그대로. */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof ACT === 'undefined') return;
  if (!NATIVE.on && !state.testClock) {
    state.testClock = true;
    state.realTime = false;
    state.clock = BASE_CLOCK;
    state.settledDay = ymd(BASE_CLOCK);
    save();
  }
  const testTaskSpec = () => ({ type: 'jab', title: '데이터베이스 과제', date: '2026-11-23', repeatKind: 'weekly', days: [1], every: 1, start: '18:00', endDate: '2026-11-23', end: '20:00', heat: 50, dlMode: 'custom', dlDate: '2026-11-23', dlTime: '20:00', more: true });
  const needMember = () => { const m = member(); return m && m.onboarded ? m : null; };
  Object.assign(ACT, {
    /* 가상 시각 */
    cTime: (t) => { state.realTime = false; setClockHM(t.dataset.hm); },
    cBase: () => { state.realTime = false; setClock(BASE_CLOCK); },
    cShift: (t) => { state.realTime = false; setClock(now() + Number(t.dataset.min) * MIN); },
    cReal: () => { state.realTime = true; syncRealClock(true); },
    /* 흉내 로그인 결과 */
    cScenario: (v) => { state.scenario = v; if (v === 'noTalk') state.talkInstalled = true; save(); },
    cTalk: () => { state.talkInstalled = !state.talkInstalled; save(); },
    cExpire: () => {
      if (!state.session) return;
      state.session.expired = true; if (state.kakao[kakaoId()]) state.kakao[kakaoId()].token = false;
      Object.assign(ui, { focusKey: null, sheet: null, result: null, popup: null, form: null });
      save(); render();
    },
    /* 딴짓 흉내 (실제 감지와 같은 처리 함수) */
    cSlack: (t) => { const m = needMember(); if (m) slackDetected(m, t.dataset.app, false); },
    /* 테스트 일정 */
    cSeed: () => {
      const m = needMember(); if (!m || m.tasks.some((t) => t.title === '데이터베이스 과제')) return;
      const s = testTaskSpec();
      m.tasks.push(migrateTask({ id: uid('t'), type: 'jab', title: s.title, date: s.date, repeat: { kind: 'weekly', days: [1] }, start: s.start, duration: 120, heat: 50, deadline: { enabled: true, date: s.date, time: s.dlTime }, createdAt: now() }));
      ui.selDate = today(); save(); render();
    },
    cSeedExtra: () => {
      const m = needMember(); if (!m) return;
      const add = (title, days, start, duration) => { if (!m.tasks.some((t) => t.title === title)) m.tasks.push(migrateTask({ id: uid('t'), type: 'normal', title, date: '2026-11-23', repeat: { kind: 'weekly', days }, start, duration, heat: null, deadline: null, createdAt: now() })); };
      add('자료구조 스터디', [2], '19:00', 90); add('팀 프로젝트 회의', [4], '16:00', 60); add('편의점 아르바이트', [6], '13:00', 300);
      save(); render();
    },
    cFill: () => {
      const m = needMember(); if (!m) return;
      if (!ui.form || !ui.sheet || ui.sheet.type !== 'form') ui.form = newDraft(m, '2026-11-23');
      Object.assign(ui.form, testTaskSpec(), { errors: {}, _dlTouched: true });
      ui.form.heat = Math.max(50, ui.form.minHeat); ui.focusKey = null;
      openSheet({ type: 'form', id: ui.form.id });
    },
    cUndo: () => {
      const m = member(); if (!m) return;
      for (const k of Object.keys(m.runs)) if (splitKey(k)[1] === today()) undoRun(m, k);
      Object.assign(ui, { focusKey: null, result: null, popup: null }); save(); render();
    },
  });
});
