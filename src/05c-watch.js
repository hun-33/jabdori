'use strict';
/* =========================================================
   05c-watch: 딴짓 감지 (진짜 앱에서만)
   - 잡도리 일정이 진행 중이거나 시작 시간이 지났는데 아직 시작 전(지각)일 때,
     지켜볼 앱(유튜브·인스타그램 등)을 정해 둔 시간 넘게 쓰면 미루먼지가 알린다.
   - 안드로이드 쪽: DistractionPlugin + WatchService (사용 정보 접근 권한 필요)
   - 아이폰은 다른 앱 실행을 알아낼 수 없어서 NATIVE.Watch가 없고, 설정 > 알림에 안내만 보여 준다
   - '다른 앱 위에 표시'까지 허용하면 딴짓 앱 위에 미루먼지 창이 떠서 그 자리에서 답을 고른다 (잡도리 앱으로 넘어가지 않음).
     허용하지 않으면 알림으로 알리고, 잡도리를 다시 열면 앱 안 팝업으로 묻는다.
   - 지켜볼 앱: 이 폰의 앱 서랍에 보이는 앱 전부에서 고른다 (설정 > 알림·딴짓 감지 > 지켜볼 앱)
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
  if (!w.labels || typeof w.labels !== 'object') w.labels = {};   // 고른 앱 이름 (감지 알림·창에 씀)
  for (const [id, label, def] of WATCH_APPS) {
    if (typeof w.apps[id] !== 'boolean') w.apps[id] = def;
    if (!w.labels[id]) w.labels[id] = label;
  }
  return w;
}
/* 앱 분류 → 목록에 보여 줄 짧은 설명 */
const APP_CATS = { video: '동영상', social: 'SNS', game: '게임', audio: '음악·오디오', image: '사진', news: '뉴스', maps: '지도', productivity: '생산성' };
function appSubText(a) {
  const known = WATCH_APPS.some(([id]) => id === a.id);
  return [known ? '자주 딴짓하는 앱' : '', APP_CATS[a.category] || ''].filter(Boolean).join(' · ');
}
/* 네이티브가 준 아이콘(data URL)을 짧은 blob 주소로 (화면을 다시 그려도 큰 글자를 매번 만들지 않게) */
function iconUrl(data) {
  if (!data || !/^data:image\/png;base64,/.test(data)) return '';
  try {
    const bin = atob(data.slice(data.indexOf(',') + 1)); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: 'image/png' }));
  } catch (e) { return ''; }
}
/* 지금 지켜보는 앱 (설치돼 있다고 알고 있는 것만) */
function watchedIds() {
  const W = watchPrefs();
  return Object.keys(W.apps).filter((id) => W.apps[id] && (!WATCH.installed || WATCH.installed.has(id)));
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
  apps: null,          // 이 폰의 앱 서랍 앱 [{id, label, category, icon(blob 주소)}] — 지켜볼 앱 화면을 열 때 불러옴
  installed: null,     // 깔린 앱 패키지 Set (아이콘 없이 가볍게)
  appsLoading: false,
  sig: null,           // 마지막으로 서비스에 넘긴 설정 (같으면 다시 안 부름)
  seen: new Set(),     // 이미 처리한 감지 (at)
  timer: null,
  ready: false,

  async init() {
    if (!NATIVE.Watch || WATCH.ready) return;
    WATCH.ready = true;
    // 플러그인이 없는 빌드면 addListener가 거부된 약속을 돌려준다 → 잡아서 조용히 넘긴다
    try { const p = NATIVE.Watch.addListener('distraction', (ev) => WATCH.onEvent(ev)); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 무시 */ }
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
    if (!WATCH.installed) {
      try {
        const r = await NATIVE.Watch.apps({ iconSize: 0 });
        WATCH.installed = new Set((r.apps || []).map((a) => a.id));
        // 이름은 이 폰에 보이는 그대로 (YouTube, Instagram …) — 설정·알림·미루먼지 창이 모두 같은 이름을 쓰게
        const W = watchPrefs(); for (const a of r.apps || []) if (a.label && a.id in W.apps) W.labels[a.id] = a.label;
      } catch (e) { WATCH.installed = null; }
    }
    if (JSON.stringify(WATCH.perm) !== before && ui.tab === 'me') render();
  },
  /* 지켜볼 앱 화면용: 아이콘까지 불러온다 */
  async loadApps() {
    if (!NATIVE.Watch || WATCH.appsLoading) return;
    WATCH.appsLoading = true; WATCH.appsError = false;
    try {
      const r = await NATIVE.Watch.apps({ iconSize: 96 });
      for (const a of WATCH.apps || []) if (a.icon) URL.revokeObjectURL(a.icon);
      WATCH.apps = (r.apps || []).map((a) => ({ id: a.id, label: a.label || a.id, category: a.category || '', icon: iconUrl(a.icon) }));
      WATCH.installed = new Set(WATCH.apps.map((a) => a.id));
      const W = watchPrefs(); for (const a of WATCH.apps) if (a.id in W.apps) W.labels[a.id] = a.label;
    } catch (e) { WATCH.appsError = true; if (!WATCH.apps) WATCH.apps = []; }
    WATCH.appsLoading = false;
    if (ui.tab === 'me') render();
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
      // 미루먼지 창에서 고른 답은 모두 반영하고, 창 없이 감지만 된 것은 마지막 하나만 앱 안 팝업으로 묻는다
      const lastPlain = [...evs].reverse().find((e) => (e.type || 'detect') === 'detect' && !e.overlay && !evs.some((c) => c.type === 'choice' && c.at === e.at));
      for (const e of evs) { if ((e.type || 'detect') === 'detect' && !e.overlay && e !== lastPlain) WATCH.seen.add(`${e.at}:detect`); WATCH.onEvent(e); }
    } catch (e) { /* 무시 */ }
  },
  onEvent(ev) {
    if (!ev || !ev.at) return;
    const k = `${ev.at}:${ev.type || 'detect'}`;
    if (WATCH.seen.has(k)) return;
    WATCH.seen.add(k);
    if (Date.now() - ev.at > 3 * 3600 * 1000) return;   // 오래된 기록은 묻지 않는다
    const m = member();
    if (!m || !m.onboarded || !watchPrefs().on) return;
    if (ev.type === 'choice') { watchChoice(m, ev); return; }
    slackDetected(m, ev.app || ev.pkg, true, { at: ev.at, overlay: !!ev.overlay });
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
    const pk = watchedIds();
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
    const labels = {}; for (const id of pk) labels[id] = W.labels[id] || id;
    const late = st.kind === 'late';
    const line = pickLine(st.key + ':watch', late ? L.late[Math.max(1, st.stage || 1)] || L.slackAsk : L.slackAsk).tpl;
    try {
      await NATIVE.Watch.start({
        packages: pk, labels, delaySec: W.delay, repeatSec: 300, untilMs: until, quietUntilMs: quiet,
        watchTitle: `${st.task.title} · ${josa(C.name, '이/가')} 지켜보는 중`,
        watchText: W.delay ? `딴짓 앱을 ${W.delay / 60}분 넘게 쓰면 알려요` : '딴짓 앱을 열면 바로 알려요',
        alertTitle: `{app} 딴짓 감지 · ${st.task.title}`,
        alertText: line,
        // 다른 앱 위 미루먼지 창 (잡도리 앱으로 넘기지 않음)
        overlay: true, bringToFront: false, late,
        popLine: line,
        popInfo: `{app} · ${st.task.title} ${late ? '시작 전' : '진행 중'}`,
        replies: { study: pickLine(st.key + ':ws', L.slackStudy).tpl, rest: pickLine(st.key + ':wr', L.slackRest).tpl, focus: pickLine(st.key + ':wf', L.slackFocus).tpl, later: pickLine(st.key + ':wl2', L.slackRest).tpl },
        studyMin: HEAT_POLICY.studyRecheck, restMin: HEAT_POLICY.breakMinutes,
      });
      WATCH.sig = sig;
    } catch (e) {
      WATCH.sig = null;   // 앱이 뒤에 있을 때는 시작이 막힐 수 있다 → 다음에 다시
    }
  },
};

/* 딴짓을 찾았을 때 (실제 감지 · 자동 검사의 딴짓 흉내 모두 여기로)
   opt.overlay: 딴짓 앱 위에 미루먼지 창이 이미 떴음 → 앱 안 팝업은 띄우지 않고 기록만 (답은 watchChoice로) */
function slackDetected(m, app, real, opt = {}) {
  const quiet = !!opt.overlay;
  if (ui.popup && !quiet) return false;
  const st = runningOcc(m);
  if (st && st.kind === 'break') {
    if (real) return false;   // 쉬는 중엔 실제 감지는 조용히
    ui.popup = { type: 'slack', app, key: null, brk: true }; render(); return true;
  }
  if (st) {
    if (real && st.run.studyUntil && now() < st.run.studyUntil) return false;
    st.run.slack.push({ at: now(), app, choice: null, real: !!real, ...(opt.at ? { nativeAt: opt.at } : {}) });
    logRun(st.run, 'slack', `딴짓 감지 — ${app} ${real ? '사용' : '실행'}${quiet ? ' (미루먼지 창)' : ''}`);
    if (quiet) { save(); render(); return true; }
    ui.popup = { type: 'slack', app, key: st.key, real: !!real, askTpl: pickLine(st.key + ':ask', persona().lines.slackAsk, st.run.slack.length).tpl };
    save(); render(); return true;
  }
  if (real) {
    if (quiet) return false;   // 시작 전: 창에서 '지금 시작할게'를 고르면 watchChoice가 시작한다
    const lt = watchTarget(m);
    if (!lt || lt.kind !== 'late') return false;
    const L = persona().lines;
    ui.popup = { type: 'slackLate', app, key: lt.key, real: true, line: pickLine(lt.key + ':wl', L.late[Math.max(1, lt.stage || 1)] || L.slackAsk).tpl };
    render(); return true;
  }
  ui.popup = { type: 'slack', app, key: null }; render(); return true;
}

/* 미루먼지 창(다른 앱 위)에서 고른 답을 기록에 반영 */
function watchChoice(m, ev) {
  if (ev.choice === 'start') {
    const lt = watchTarget(m);
    if (lt && lt.kind === 'late') ACT.startOcc({ dataset: { key: lt.key } });
    return;
  }
  const st = runningOcc(m);
  if (!st || !st.run) return;
  const run = st.run, t = ev.choiceAt || now();
  const e = (run.slack || []).find((x) => x.nativeAt === ev.at) || (run.slack || [])[run.slack.length - 1];
  if (e && e.choice == null) e.choice = ev.choice;
  if (ev.choice === 'study') { run.studyUntil = t + HEAT_POLICY.studyRecheck * MIN; logRun(run, 'slack', '“공부 중이야” — 10분 뒤 다시 확인 (미루먼지 창)'); }
  else if (ev.choice === 'rest') {
    if (!run.brk || run.brk.ended || now() > run.brk.until) run.brk = { start: t, until: t + HEAT_POLICY.breakMinutes * MIN, ended: false };
    logRun(run, 'break', '“잠깐 쉴게” — 5분 휴식 (미루먼지 창)');
  } else if (ev.choice === 'focus') logRun(run, 'slack', '“다시 집중할게” (미루먼지 창)');
  else if (ev.choice === 'dismiss') logRun(run, 'slack', '미루먼지 창을 닫음');
  save(); render();
  WATCH.sig = null; WATCH.schedule();
}

/* 설정 > 알림·딴짓 감지의 딴짓 감지 구역 (진짜 앱에서만) */
function watchSection(m) {
  // 아이폰: 앱이 다른 앱(유튜브 등)이 열렸는지 알 수 있는 방법을 Apple이 열어 두지 않았다
  if (!NATIVE.Watch) {
    return NATIVE.ios ? `<h2 class="sec-label">딴짓 감지</h2>
      <div class="list-btn as-row"><span class="lb-text"><b>실제 앱 사용 감지</b><small>아이폰에서는 쓸 수 없어요. Apple이 앱끼리 어떤 앱을 여는지 알 수 없게 막아 두었어요 (안드로이드 앱에서만 돼요)</small></span></div>` : '';
  }
  const W = watchPrefs(), P = WATCH.perm, C = charOf(m);
  const row = (ok, name, tag, act, desc) => `<li><span>${name} <em>${tag}</em></span>${ok ? `<b class="yes">${icon('check')}허용됨</b>` : `<button class="link-btn" data-act="${act}">허용하러 가기${icon('chevron')}</button>`}</li>`;
  return `<h2 class="sec-label">딴짓 감지</h2>
      <div class="list-btn as-row"><span class="lb-text"><b>실제 앱 사용 감지</b><small>잡도리 중에 유튜브·인스타그램 같은 앱을 열면 ${josa(C.name, '이/가')} 알려요</small></span>
        <button class="switch ${W.on ? 'on' : ''}" role="switch" aria-checked="${W.on}" aria-label="실제 앱 사용 감지" data-act="watchToggle"><i></i></button></div>
      ${W.on ? `<ul class="kv watch-perm">
        ${row(P.usage, '사용 정보 접근', '필수', 'watchOpenUsage')}
        ${row(P.overlay, '다른 앱 위에 표시', '선택', 'watchOpenOverlay')}
      </ul>
      <p class="fine dark">사용 정보 접근은 어떤 앱이 열렸는지만 확인하고, 앱 안의 내용은 보지 않아요. 다른 앱 위에 표시를 허용하면 딴짓 앱 위에 ${C.name} 창이 떠서 그 자리에서 답할 수 있어요. 허용하지 않으면 알림으로 알려요. 기록은 이 폰에만 남아요.</p>
      <p class="set-label" id="lb-wdelay">알리는 때</p>
      <div class="chips" role="radiogroup" aria-labelledby="lb-wdelay">${WATCH_DELAYS.map(([s, l]) => `<button role="radio" aria-checked="${W.delay === s}" class="chip ${W.delay === s ? 'on' : ''}" data-act="watchDelay" data-v="${s}">${l}</button>`).join('')}</div>
      <p class="set-label">지켜볼 앱</p>
      <button class="list-btn" data-act="meOpen" data-v="watchApps">${icon('eye')}<span class="lb-text"><b>${watchCountText()}</b><small>${watchNamesText()}</small></span>${icon('chevron', 'muted')}</button>
      <p class="fine dark">휴식 중이거나 "공부 중이야"라고 답한 동안은 알리지 않아요. 계속 쓰면 5분마다 다시 알려요.</p>` : ''}`;
}

function watchCountText() { const n = watchedIds().length; return n ? `${n}개 앱을 지켜보는 중` : '지켜보는 앱 없음'; }
function watchNamesText() {
  const W = watchPrefs(), ids = watchedIds();
  if (!ids.length) return '눌러서 이 폰의 앱 중에 골라요';
  const names = ids.map((id) => W.labels[id] || id);
  return esc(names.slice(0, 3).join(', ') + (names.length > 3 ? ` 외 ${names.length - 3}개` : ''));
}
/* 화면 일부를 직접 바꿨을 때: 다음 render()가 같은 화면을 통째로 다시 그리지 않게 기준을 맞춘다 */
function keepScreen() { cur.sig = sigOf(computeScreen().html); }

/* 설정 > 알림·딴짓 감지 > 지켜볼 앱: 이 폰의 앱 서랍 앱 전부 (아이콘 · 이름 · 분류 · 스위치) */
function watchAppsPage() {
  const W = watchPrefs(), C = charOf(member());
  const apps = WATCH.apps || [];
  const q = (ui.appQ || '').trim().toLowerCase();
  const hits = apps.filter((a) => !q || a.label.toLowerCase().includes(q));
  const head = `<label class="app-search">${icon('search', 'muted')}<input id="app-q" type="search" inputmode="search" enterkeyhint="search" placeholder="앱 이름으로 찾기" aria-label="앱 이름으로 찾기" value="${esc(ui.appQ || '')}" autocomplete="off"></label>
    <p class="wa-meta"><b id="wa-count">${watchCountText()}</b> · 고른 앱을 잡도리 중에 오래 쓰면 ${josa(C.name, '이/가')} 나타나요</p>`;
  if (!apps.length) {
    return head + `<p class="fine dark">${WATCH.appsLoading || !WATCH.appsError ? '이 폰의 앱 목록을 불러오는 중이에요.' : '앱 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'}</p>`;
  }
  const rows = apps.map((a) => {
    const on = !!W.apps[a.id], sub = appSubText(a), hit = hits.includes(a);
    return `<li class="app-row" data-name="${esc(a.label.toLowerCase())}"${hit ? '' : ' hidden'}>
      ${a.icon ? `<img class="app-ic" src="${a.icon}" alt="" loading="lazy" decoding="async">` : `<span class="app-ic none" aria-hidden="true">${esc(a.label.slice(0, 1))}</span>`}
      <span class="lb-text"><b>${esc(a.label)}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      <i class="app-sep" aria-hidden="true"></i>
      <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(a.label)} 지켜보기" data-act="watchApp" data-v="${esc(a.id)}"><i></i></button>
    </li>`;
  }).join('');
  return head + `<ul class="app-list" aria-label="이 폰의 앱">${rows}</ul>
    <p class="fine dark" id="wa-none"${hits.length ? ' hidden' : ''}>‘${esc(ui.appQ || '')}’ 이름의 앱이 없어요.</p>
    <p class="fine dark">앱 서랍에 보이는 앱만 나와요. 앱을 새로 깔았다면 이 화면을 다시 열어 주세요.</p>`;
}
/* 검색: 목록을 다시 그리지 않고 줄만 숨긴다 (입력 중 글자판이 닫히지 않게) */
document.addEventListener('input', (ev) => {
  if (!ev.target || ev.target.id !== 'app-q') return;
  ui.appQ = ev.target.value;
  const q = ui.appQ.trim().toLowerCase();
  let n = 0;
  for (const li of document.querySelectorAll('.app-row')) { const hit = !q || li.dataset.name.includes(q); li.hidden = !hit; if (hit) n++; }
  const none = $('#wa-none');
  if (none) { none.hidden = n > 0; none.textContent = `‘${ui.appQ}’ 이름의 앱이 없어요.`; }
  keepScreen();
});

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
  // 지켜볼 앱 화면의 스위치: 화면을 다시 그리지 않고 그 줄만 바꾼다 (긴 목록 · 검색 글자 · 스크롤 유지)
  watchApp: (t) => {
    const W = watchPrefs(), id = t.dataset.v, on = !W.apps[id];
    W.apps[id] = on;
    const a = (WATCH.apps || []).find((x) => x.id === id); if (a) W.labels[id] = a.label;
    save();
    t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on));
    const c = $('#wa-count'); if (c) c.textContent = watchCountText();
    keepScreen();
    WATCH.schedule();
  },
  slackLateStart: (t) => { ui.popup = null; ACT.startOcc(t); },
});
