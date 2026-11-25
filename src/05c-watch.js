'use strict';
/* =========================================================
   05c-watch: 딴짓 감지 (진짜 앱에서만)
   - 잡도리 일정이 진행 중이거나 시작 시간이 지났는데 아직 시작 전(지각)일 때,
     지켜볼 앱(유튜브·인스타그램 등)을 정해 둔 시간 넘게 쓰면 미루먼지가 알린다.
   - 안드로이드 쪽: DistractionPlugin + WatchService (사용 정보 접근 권한 필요)
   - '다른 앱 위에 표시'까지 허용하면 딴짓 앱 위로 잡도리 화면이 바로 뜨고, 아니면 알림으로 알린다.
   - 휴식 중이거나 '공부 중이야'라고 답한 동안은 알리지 않는다.
   ========================================================= */
const WATCH_APPS = [
  ['com.google.android.youtube', '유튜브', true],
  ['com.instagram.android', '인스타그램', true],
  ['com.zhiliaoapp.musically', '틱톡', true],
  ['com.ss.android.ugc.trill', '틱톡', true],
  ['com.facebook.katana', '페이스북', true],
  ['com.twitter.android', 'X(트위터)', true],
  ['com.netflix.mediaclient', '넷플릭스', true],
  ['com.nhn.android.webtoon', '네이버 웹툰', true],
  ['com.kakao.page', '카카오페이지', true],
  ['tv.twitch.android.app', '트위치', true],
  ['com.reddit.frontpage', '레딧', true],
  ['com.discord', '디스코드', false],
];
const WATCH_DELAYS = [[0, '바로'], [60, '1분 뒤'], [180, '3분 뒤'], [300, '5분 뒤']];

function watchPrefs() {
  if (!state.watch || typeof state.watch !== 'object') state.watch = {};
  const w = state.watch;
  if (typeof w.on !== 'boolean') w.on = false;
  if (!WATCH_DELAYS.some(([s]) => s === w.delay)) w.delay = 60;
  if (!w.apps || typeof w.apps !== 'object') w.apps = {};
  for (const [id, , def] of WATCH_APPS) if (typeof w.apps[id] !== 'boolean') w.apps[id] = def;
  return w;
}

/* 지금 지켜봐야 할 잡도리 (없으면 null): 진행 중인 것 → 오늘 시작 시간이 지났는데 아직 시작 전인 것 */
function watchTarget(m) {
  if (!m || !m.onboarded) return null;
  const run = runningOcc(m);
  if (run && run.task.jabOn !== false) return run;
  return occurrencesOn(m, today()).find((o) => o.task.type === 'jab' && o.task.jabOn !== false && o.kind === 'late') || null;
}

const WATCH = {
  perm: { usage: false, overlay: false, known: false },
  apps: null,          // 이 폰에 깔린 지켜볼 앱 [{id, label}]
  sig: null,           // 마지막으로 서비스에 넘긴 설정 (같으면 다시 안 부름)
  seen: new Set(),     // 이미 처리한 감지 (at)
  timer: null,
  ready: false,

  async init() {
    if (!NATIVE.Watch || WATCH.ready) return;
    WATCH.ready = true;
    try { NATIVE.Watch.addListener('distraction', (ev) => WATCH.onEvent(ev)); } catch (e) { /* 무시 */ }
    await WATCH.refresh();
    await WATCH.takePending();
    WATCH.schedule();
  },
  /* 권한 상태·깔린 앱 목록 새로고침 (앱으로 돌아올 때마다: 설정에서 권한을 켜고 왔을 수 있다) */
  async refresh() {
    if (!NATIVE.Watch) return;
    const before = JSON.stringify(WATCH.perm);
    try {
      const s = await NATIVE.Watch.status();
      WATCH.perm = { usage: !!s.usageAccess, overlay: !!s.overlay, known: true };
    } catch (e) { WATCH.perm = { usage: false, overlay: false, known: true }; }
    if (!WATCH.apps) {
      try { const r = await NATIVE.Watch.installed({ packages: WATCH_APPS.map(([id]) => id) }); WATCH.apps = (r.apps || []).map((a) => ({ id: a.id, label: (WATCH_APPS.find(([id]) => id === a.id) || [])[1] || a.label })); }
      catch (e) { WATCH.apps = []; }
    }
    if (JSON.stringify(WATCH.perm) !== before && state.tab === 'me') render();
  },
  async onResume() {
    if (!NATIVE.Watch) return;
    await WATCH.refresh();
    await WATCH.takePending();
    WATCH.sig = null;  // 앱이 내려가 있던 동안 서비스가 멈췄을 수 있어 다시 맞춘다
    WATCH.schedule();
  },
  async takePending() {
    try {
      const r = await NATIVE.Watch.pending();
      const evs = (r.events || []).filter((e) => e && e.at);
      if (evs.length) WATCH.onEvent(evs[evs.length - 1]);  // 여러 번 감지됐으면 마지막 것만 묻는다
      for (const e of evs) WATCH.seen.add(e.at);
    } catch (e) { /* 무시 */ }
  },
  onEvent(ev) {
    if (!ev || !ev.at || WATCH.seen.has(ev.at)) return;
    WATCH.seen.add(ev.at);
    if (Date.now() - ev.at > 3 * 3600 * 1000) return;   // 오래된 기록은 묻지 않는다
    const m = member();
    if (!m || !m.onboarded || !watchPrefs().on) return;
    slackDetected(m, ev.app || ev.pkg, true);
  },
  /* 화면이 바뀔 때마다 부르되, 실제 서비스 호출은 설정이 달라졌을 때만 */
  schedule() {
    if (!NATIVE.Watch) return;
    clearTimeout(WATCH.timer);
    WATCH.timer = setTimeout(() => WATCH.sync(), 50);
  },
  async sync() {
    if (!NATIVE.Watch) return;
    const m = member(), W = watchPrefs();
    const st = W.on && WATCH.perm.usage ? watchTarget(m) : null;
    const pk = (WATCH.apps || []).filter((a) => W.apps[a.id]).map((a) => a.id);
    if (!st || !pk.length) {
      if (WATCH.sig !== 'off') { WATCH.sig = 'off'; try { await NATIVE.Watch.stop(); } catch (e) { /* 무시 */ } }
      return;
    }
    const t = now(), w = st.w, run = st.run;
    const until = Math.round(w.deadline && w.deadline > t ? w.deadline : w.end > t ? w.end : t + 60 * MIN);
    const quiet = Math.round(Math.max(
      run && run.studyUntil ? run.studyUntil : 0,
      st.kind === 'break' && run && run.brk ? run.brk.until : 0,
    ));
    const sig = JSON.stringify([st.key, st.kind === 'late' ? 'late' : 'run', pk, W.delay, until, quiet]);
    if (sig === WATCH.sig) return;
    const L = persona().lines, C = charOf(m);
    const labels = {}; for (const a of WATCH.apps || []) labels[a.id] = a.label;
    try {
      await NATIVE.Watch.start({
        packages: pk, labels, delaySec: W.delay, repeatSec: 300, untilMs: until, quietUntilMs: quiet,
        watchTitle: `${st.task.title} · ${josa(C.name, '이/가')} 지켜보는 중`,
        watchText: W.delay ? `딴짓 앱을 ${W.delay / 60}분 넘게 쓰면 알려요` : '딴짓 앱을 열면 바로 알려요',
        alertTitle: `{app} 딴짓 감지 · ${st.task.title}`,
        alertText: pickLine(st.key + ':watch', st.kind === 'late' ? L.late[Math.max(1, st.stage || 1)] || L.slackAsk : L.slackAsk).tpl,
        bringToFront: true,
      });
      WATCH.sig = sig;
    } catch (e) {
      WATCH.sig = null;   // 앱이 뒤에 있을 때는 시작이 막힐 수 있다 → 다음에 다시
    }
  },
};

/* 딴짓을 찾았을 때 (시연 콘솔 버튼과 실제 감지 모두 여기로) */
function slackDetected(m, app, real) {
  if (ui.popup) return false;
  const st = runningOcc(m);
  if (st && st.kind === 'break') {
    if (real) return false;   // 쉬는 중엔 실제 감지는 조용히
    ui.popup = { type: 'slack', app, key: null, brk: true }; render(); return true;
  }
  if (st) {
    if (real && st.run.studyUntil && now() < st.run.studyUntil) return false;
    st.run.slack.push({ at: now(), app, choice: null, real: !!real });
    logRun(st.run, 'slack', `딴짓 감지 — ${app} ${real ? '사용' : '실행'}`);
    ui.popup = { type: 'slack', app, key: st.key, real: !!real, askTpl: pickLine(st.key + ':ask', persona().lines.slackAsk, st.run.slack.length).tpl };
    save(); render(); return true;
  }
  if (real) {
    const lt = watchTarget(m);
    if (!lt || lt.kind !== 'late') return false;
    const L = persona().lines;
    ui.popup = { type: 'slackLate', app, key: lt.key, real: true, line: pickLine(lt.key + ':wl', L.late[Math.max(1, lt.stage || 1)] || L.slackAsk).tpl };
    render(); return true;
  }
  ui.popup = { type: 'slack', app, key: null }; render(); return true;
}

/* 나 탭 '딴짓 감지' 구역 (진짜 앱에서만) */
function watchSection(m) {
  const W = watchPrefs(), P = WATCH.perm, C = charOf(m);
  const row = (ok, name, tag, act, desc) => `<li><span>${name} <em>${tag}</em></span>${ok ? `<b class="yes">${icon('check')}허용됨</b>` : `<button class="link-btn" data-act="${act}">허용하러 가기${icon('chevron')}</button>`}</li>`;
  const apps = WATCH.apps || [];
  return `<h2 class="sec-label">딴짓 감지</h2>
      <div class="list-btn as-row"><span class="lb-text"><b>실제 앱 사용 감지</b><small>잡도리 중에 유튜브·인스타그램 같은 앱을 열면 ${josa(C.name, '이/가')} 알려요</small></span>
        <button class="switch ${W.on ? 'on' : ''}" role="switch" aria-checked="${W.on}" aria-label="실제 앱 사용 감지" data-act="watchToggle"><i></i></button></div>
      ${W.on ? `<ul class="kv watch-perm">
        ${row(P.usage, '사용 정보 접근', '필수', 'watchOpenUsage')}
        ${row(P.overlay, '다른 앱 위에 표시', '선택', 'watchOpenOverlay')}
      </ul>
      <p class="fine dark">사용 정보 접근은 어떤 앱이 열렸는지만 확인하고, 앱 안의 내용은 보지 않아요. 다른 앱 위에 표시를 허용하면 딴짓 앱 위로 잡도리 화면이 바로 뜨고, 허용하지 않으면 알림으로 알려요. 기록은 이 폰에만 남아요.</p>
      <p class="set-label" id="lb-wdelay">알리는 때</p>
      <div class="chips" role="radiogroup" aria-labelledby="lb-wdelay">${WATCH_DELAYS.map(([s, l]) => `<button role="radio" aria-checked="${W.delay === s}" class="chip ${W.delay === s ? 'on' : ''}" data-act="watchDelay" data-v="${s}">${l}</button>`).join('')}</div>
      <p class="set-label" id="lb-wapps">지켜볼 앱</p>
      ${apps.length ? `<div class="chips" role="group" aria-labelledby="lb-wapps">${apps.map((a) => `<button class="chip ${W.apps[a.id] ? 'on' : ''}" aria-pressed="${!!W.apps[a.id]}" data-act="watchApp" data-v="${a.id}">${esc(a.label)}</button>`).join('')}</div>`
        : `<p class="fine dark">${WATCH.apps ? '지켜볼 앱(유튜브·인스타그램·틱톡 등)이 이 폰에 없어요.' : '앱 목록을 확인하는 중이에요.'}</p>`}
      <p class="fine dark">휴식 중이거나 "공부 중이야"라고 답한 동안은 알리지 않아요. 계속 쓰면 5분마다 다시 알려요.</p>` : ''}`;
}

Object.assign(ACT, {
  watchToggle: async () => {
    const W = watchPrefs();
    W.on = !W.on; save();
    if (W.on) {
      await WATCH.refresh();
      if (!WATCH.perm.usage) {
        toast('설정 목록에서 잡도리를 찾아 "사용 정보 접근 허용"을 켜 주세요.');
        try { await NATIVE.Watch.openUsageSettings(); } catch (e) { /* 무시 */ }
      }
    }
    WATCH.sig = null; render(); WATCH.schedule();
  },
  watchOpenUsage: async () => {
    toast('목록에서 잡도리를 찾아 "사용 정보 접근 허용"을 켜 주세요.');
    try { await NATIVE.Watch.openUsageSettings(); } catch (e) { toast('설정 화면을 열 수 없어요.'); }
  },
  watchOpenOverlay: async () => {
    toast('"다른 앱 위에 표시"를 켜 주세요.');
    try { await NATIVE.Watch.openOverlaySettings(); } catch (e) { toast('설정 화면을 열 수 없어요.'); }
  },
  watchDelay: (t) => { watchPrefs().delay = Number(t.dataset.v); save(); render(); WATCH.schedule(); },
  watchApp: (t) => { const W = watchPrefs(); W.apps[t.dataset.v] = !W.apps[t.dataset.v]; save(); render(); WATCH.schedule(); },
  slackLateStart: (t) => { ui.popup = null; ACT.startOcc(t); },
});
