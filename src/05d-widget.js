/* =========================================================
   05d-widget: 안드로이드 홈 화면 위젯 (오늘의 일정 · 다음 일정 · 미루먼지 · 잡도리 통계)
   - 위젯은 웹 화면의 저장소(localStorage)를 직접 읽지 못한다. 그래서 앱이 '위젯 묶음'(스냅숏)을 만들어
     네이티브 Widget 플러그인(WidgetPlugin.kt)에 넘기고, 위젯은 그 묶음을 지금 시각 기준으로 다시 계산해 그린다.
   - 묶음 내용: 오늘부터 7일 치 회차(앱의 오늘 목록과 같은 함수 occurrencesCovering), 최근 14일 잡도리 기록 수,
     연속 성공, 앞으로 48시간의 미루먼지 표정·대사·농도(앱의 personaForToday를 그 시각으로 돌려 미리 계산)
   - 위젯에서 일반 일정을 체크하면 네이티브가 바로 위젯을 고치고 '할 일'을 쌓아 둔다 → 앱이 그 할 일을
     받아 기록에 반영(applyWidgetActions)하고 확인(ack)한다. 잡도리 일정은 위젯에서 바꾸지 않고 앱을 연다.
   - 로그아웃·탈퇴하면 일정이 없는 묶음(login: false)을 넘겨 홈 화면에서도 바로 사라지게 한다.
   - 아이폰·웹에는 이 플러그인이 없다 (NATIVE.Widget === null → 아무것도 안 함)
   ========================================================= */
NATIVE.Widget = NATIVE.on && !NATIVE.ios && typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.registerPlugin === 'function'
  ? (() => { try { return window.Capacitor.registerPlugin('Widget'); } catch (e) { return null; } })() : null;

const WIDGET_DAYS = 7;          // 오늘부터 며칠 치 회차를 넘길지 (앱을 며칠 안 열어도 목록이 맞게)
const WIDGET_MOOD_HOURS = 48;   // 미루먼지 표정·대사를 미리 계산해 둘 시간
const WIDGET_COLORS = { coral: '#E58A6E', sun: '#E2B04A', mint: '#5FAE8E', sky: '#6FA3D6', lilac: '#A48BD0', stone: '#9A8F82' };
const WIDGET_KINDS = [
  ['today', '오늘의 일정', '오늘 날짜, 완료 수와 진행률, 일정 목록. 일반 일정은 위젯에서 바로 체크해요', '4×2'],
  ['month', '달력', '한 달 일정을 색 막대로. 여러 날 일정은 이어서, 넘치면 +N. 날짜를 누르면 앱 달력이 그 날로 열려요', '4×4'],
  ['next', '다음 일정', '다음 일정 이름, 시작 시각, 남은 시간. 진행 중인 잡도리도 따로 보여 줘요', '2×2'],
  ['mireum', '미루먼지', '오늘 상황에 맞는 미루먼지 표정과 한마디, 지금 농도', '2×2'],
  ['stats', '잡도리 통계', '오늘 완료율, 이번 주 잡도리 성공률, 연속 성공', '2×2'],
];


function widgetItem(st) {
  const task = st.task, run = st.run;
  const jab = task.type === 'jab' && task.jabOn !== false;
  let status = 'todo';
  if (run && run.status === 'done') status = 'done';
  else if (jab && run && run.status === 'failed') status = 'failed';
  else if (jab && run && run.status === 'running') status = 'running';
  return {
    k: st.key, t: String(task.title || '').slice(0, 40), j: jab, ad: !!task.allDay,
    s: st.w.start, e: st.w.end, dl: jab && st.w.deadline ? st.w.deadline : 0,
    st: status, bu: status === 'running' && run.brk && !run.brk.ended ? run.brk.until : 0,
    c: WIDGET_COLORS[taskColor(task)] || WIDGET_COLORS.sky, d: st.date,
    dn: st.dayNo || 1, dd: st.days || 1, tm: occTimeText(st),
  };
}
/* 앱 '오늘' 목록과 같은 순서: 잡도리 먼저, 그다음 적어 둔 일 (각각 occurrencesCovering 순서) */
function widgetDay(m, date) {
  const occs = occurrencesCovering(m, date);
  const jab = occs.filter((o) => o.task.type === 'jab' && o.task.jabOn !== false);
  return [...jab, ...occs.filter((o) => !jab.includes(o))].map(widgetItem);
}
/* 최근 기록에서 거꾸로 세어 이어진 성공 횟수 (기록 탭과 같은 allRecords 기준) */
function widgetStreak(recs) { let n = 0; for (const r of recs) { if (r.run.status === 'done') n++; else break; } return n; }

/* 앞으로 48시간 동안 미루먼지가 어떤 표정으로 무슨 말을 할지: 앱의 오늘 화면 계산(personaForToday)을 그 시각으로 돌린다.
   시간만 흐를 때 바뀌는 것(시작 시간·지각·마감·농도 단계)은 여기서 다 정해진다. 앱에서 시작·완료하면 다시 계산해 넘긴다 */
function widgetMoods(m) {
  const t0 = Math.floor(now() / (30 * MIN)) * 30 * MIN;   // 앱 시각 기준 (실제 앱에서는 기기 시각과 같음)
  const pts = new Set();
  for (let t = t0; t < t0 + WIDGET_MOOD_HOURS * 3600e3; ) {
    pts.add(t);
    const h = (t - t0) / 3600e3;
    t += (h < 6 ? 5 : h < 24 ? 15 : 60) * MIN;
  }
  // 시작·마감·종료 직후 (곧 시작 → 지금 시작 → 지각, 마감 임박 등 바뀌는 순간)
  for (let i = 0; i < 3; i++) {
    for (const o of occurrencesOn(m, addDays(ymd(t0), i))) {
      if (o.task.type !== 'jab' || o.task.jabOn === false) continue;
      for (const x of [o.w.start, o.w.start + 3 * MIN, o.w.end, o.w.deadline, o.w.deadline ? o.w.deadline - HEAT_POLICY.urgentWindow * MIN : null]) {
        if (x && x > t0 && x < t0 + WIDGET_MOOD_HOURS * 3600e3) pts.add(Math.ceil(x / MIN) * MIN);
      }
    }
  }
  const keepClock = state.clock, keepReact = ui.react, S = scaleOf(m);
  const out = [];
  LINE_SEED = 'w' + ymd(t0); ui.react = null;
  try {
    for (const t of [...pts].sort((a, b) => a - b)) {
      state.clock = t;
      const p = personaForToday(m);
      const heat = Math.round(p.heat);
      const e = {
        at: t, img: 'mireum_' + (p.mc && p.mc.expr ? p.mc.expr : 'default'), line: (p.line && p.line.text) || '',
        heat, stage: stageOf(heat).id, sname: stageOf(heat).name,
        kind: p.tk ? p.tk.kind : 'idle', key: p.tk ? p.tk.key : '', title: p.tk ? String(p.tk.task.title).slice(0, 40) : '',
        ctx: p.tk ? (p.tk.kind === 'upcoming' ? '시작 전' : '지금') : '쉬는 중',
      };
      const last = out[out.length - 1];
      if (last && last.img === e.img && last.line === e.line && last.heat === e.heat && last.kind === e.kind && last.key === e.key) continue;
      out.push(e);
    }
  } finally {
    state.clock = keepClock; ui.react = keepReact; LINE_SEED = null;
  }
  return { list: out, title: S.title, unit: S.unit || '' };
}

/* 달력 위젯: 지난달부터 3달 뒤까지 (위젯에서 < > 로 넘겨 볼 범위). 주마다 앱 월간 달력과 같은 줄 배치(weekLanes).
   s: [요일 칸, 칸 수, 줄, 제목, 색, 표시(1 여러 날 · 2 지난주에서 이어짐 · 4 다음 주로 이어짐 · 8 완료 · 16 실패)]
   n: 요일 칸마다 걸린 일정 수 (위젯이 보여 줄 수 있는 줄보다 많으면 +N으로) */
const WIDGET_MONTHS = [-1, 3];
const WIDGET_LANES_MAX = 6;
function widgetMonths(m) {
  const [y, mo] = today().split('-').map(Number);
  const out = {}, cache = new Map();
  for (let k = WIDGET_MONTHS[0]; k <= WIDGET_MONTHS[1]; k++) {
    const d = new Date(y, mo - 1 + k, 1);
    const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const first = month + '-01', start = weekStartOf(first);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const weeksN = Math.ceil((daysBetween(start, first) + lastDay) / 7);
    const weeks = [];
    for (let w = 0; w < weeksN; w++) {
      const ws = addDays(start, w * 7);
      if (!cache.has(ws)) {
        const segs = weekLanes(m, ws);
        const n = Array(7).fill(0);
        for (const g of segs) for (let c = g.col; c < g.col + g.span; c++) n[c]++;
        cache.set(ws, {
          ws, n,
          s: segs.filter((g) => g.lane < WIDGET_LANES_MAX).map((g) => [g.col, g.span, g.lane, String(g.o.task.title).slice(0, 14),
            WIDGET_COLORS[taskColor(g.o.task)] || WIDGET_COLORS.sky,
            (g.multi ? 1 : 0) | (g.contL ? 2 : 0) | (g.contR ? 4 : 0) | (g.o.kind === 'done' ? 8 : 0) | (g.o.kind === 'failed' ? 16 : 0)]),
        });
      }
      weeks.push(cache.get(ws));
    }
    out[month] = weeks;
  }
  return out;
}

function widgetSnapshot() {
  const m = member();
  const base = { v: 1, at: Date.now(), name: persona().name };
  if (!m || !m.onboarded) return { ...base, login: false };
  const td = today();
  const days = {};
  for (let i = 0; i < WIDGET_DAYS; i++) { const d = addDays(td, i); days[d] = widgetDay(m, d); }
  const recs = allRecords(m);
  const rec = {};
  const from = addDays(td, -13);
  for (const r of recs) {
    if (r.date < from || r.date > td) continue;
    const v = rec[r.date] || (rec[r.date] = [0, 0]);
    v[r.run.status === 'done' ? 0 : 1]++;
  }
  return { ...base, login: true, today: td, hasTasks: m.tasks.length > 0, days, rec, recTotal: recs.length, streak: widgetStreak(recs), mood: widgetMoods(m), cal: widgetMonths(m) };
}

const WIDGET = {
  sig: null, timer: null, busy: false, pushedAt: 0,
  applied: [],            // 이미 반영한 위젯 할 일 id (같은 할 일을 두 번 반영하지 않게)
  placed: null,           // 홈 화면에 놓인 위젯 수 { today, next, mireum, stats }
  async init() {
    if (!NATIVE.Widget) return;
    try { const p = NATIVE.Widget.addListener('action', () => WIDGET.takeActions()); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 무시 */ }
    try { const p = NATIVE.Widget.addListener('launch', (ev) => WIDGET.openFrom(ev && ev.target)); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 무시 */ }
    await WIDGET.takeActions();
    await WIDGET.takeLaunch();
    WIDGET.push(true);
    WIDGET.refreshPlaced();
    try { NATIVE.App.addListener('pause', () => WIDGET.push(false)); } catch (e) { /* 무시 */ }
  },
  async onResume() {
    if (!NATIVE.Widget) return;
    await WIDGET.takeActions();
    await WIDGET.takeLaunch();
    WIDGET.schedule();
    WIDGET.refreshPlaced();
  },
  // 저장할 때마다 불림 → 잠깐 모았다가 한 번만 계산 (묶음이 그대로면 넘기지 않음)
  schedule() {
    if (!NATIVE.Widget) return;
    clearTimeout(WIDGET.timer);
    // 로그아웃·탈퇴처럼 로그인 상태가 바뀌면 기다리지 않고 바로 (홈 화면에 일정이 남지 않게)
    const on = !!(member() && member().onboarded);
    if (WIDGET.lastLogin !== undefined && on !== WIDGET.lastLogin) { WIDGET.lastLogin = on; WIDGET.push(true); return; }
    WIDGET.lastLogin = on;
    WIDGET.timer = setTimeout(() => WIDGET.push(false), 1200);
  },
  async push(force) {
    if (!NATIVE.Widget) return;
    if (WIDGET.busy) { WIDGET.again = true; return; }   // 넘기는 중이면 끝나고 한 번 더
    let snap;
    try { snap = widgetSnapshot(); } catch (e) { return; } // 계산이 실패해도 앱은 그대로 쓴다 (위젯은 지난 묶음 유지)
    const { at, ...rest } = snap;
    const sig = JSON.stringify(rest);
    if (!force && sig === WIDGET.sig && Date.now() - WIDGET.pushedAt < 6 * 3600e3) return;
    WIDGET.busy = true;
    try { await NATIVE.Widget.update({ data: JSON.stringify(snap) }); WIDGET.sig = sig; WIDGET.pushedAt = Date.now(); }
    catch (e) { /* 플러그인이 없거나 실패: 다음 저장 때 다시 */ }
    WIDGET.busy = false;
    if (WIDGET.again) { WIDGET.again = false; WIDGET.push(false); }
  },
  async takeActions() {
    if (!NATIVE.Widget) return;
    let acts = [];
    try { const r = await NATIVE.Widget.pending(); acts = Array.isArray(r && r.actions) ? r.actions : []; } catch (e) { return; }
    if (!acts.length) return;
    const res = applyWidgetActions(acts);
    try { await NATIVE.Widget.ack({ ids: acts.map((a) => a.id).filter(Boolean) }); } catch (e) { /* 다음에 다시 받아도 id로 거른다 */ }
    if (res.changed) { save(); render(); }
    if (res.skipped) toast(res.skipped === 1 ? '위젯에서 체크한 일정 하나가 그새 바뀌어서 반영하지 못했어요.' : `위젯에서 체크한 일정 ${res.skipped}개가 그새 바뀌어서 반영하지 못했어요.`);
    WIDGET.push(true);
  },
  async takeLaunch() {
    if (!NATIVE.Widget) return;
    try { const r = await NATIVE.Widget.consumeLaunch(); if (r && r.target) WIDGET.openFrom(r.target); } catch (e) { /* 무시 */ }
  },
  // 위젯을 눌러 앱이 열렸을 때 갈 곳: open:<회차 key> · add · today · records · day:<날짜> · month:<YYYY-MM>
  openFrom(target) {
    const m = member();
    if (!target || !m || !m.onboarded) return;
    ui.popup = ui.popup && ui.popup.type && ui.popup.type.startsWith('slack') ? ui.popup : null;
    ui.result = null; ui.meSub = null; ui.input = null;
    if (target === 'add') { ui.focusKey = null; ui.tab = 'today'; ACT.openAdd({ dataset: { date: today() } }); return; }
    if (target === 'records') { ui.sheet = null; ui.focusKey = null; ui.tab = 'records'; render(); return; }
    // 달력 위젯: 날짜 칸 → 앱 월간 달력에서 그 날을 고른 채로 (아래에 그 날 일정), 제목(11월) → 그 달
    const dm = target.match(/^day:(\d{4}-\d{2}-\d{2})$/) || target.match(/^month:(\d{4}-\d{2})$/);
    const realDate = (x) => { try { return ymd(parseYmd(x.length === 7 ? x + '-01' : x)) === (x.length === 7 ? x + '-01' : x); } catch (e) { return false; } };
    if (dm && realDate(dm[1])) {
      const v = dm[1], isDay = v.length === 10;
      ui.sheet = null; ui.focusKey = null; ui.tab = 'calendar'; ui.calMode = 'month';
      ui.calMonth = v.slice(0, 7);
      ui.selDate = isDay ? v : (today().slice(0, 7) === v ? today() : v + '-01');
      render(); return;
    }
    if (target.startsWith('open:')) {
      const key = target.slice(5), st = curOcc(key);
      ui.tab = 'today'; ui.sheet = null;
      if (!st) { ui.focusKey = null; render(); toast('그 일정은 지워졌거나 바뀌었어요.'); return; }
      ui.selDate = st.date >= today() ? st.date : today();
      if (st.run && st.run.status === 'running') { ui.focusKey = key; render(); return; }  // 진행 중 잡도리 → 집중 화면
      ui.focusKey = null; openSheet({ type: 'task', key }); return;
    }
    ui.sheet = null; ui.focusKey = null; ui.tab = 'today'; render();
  },
  async refreshPlaced() {
    if (!NATIVE.Widget) return;
    try { const r = await NATIVE.Widget.status(); WIDGET.placed = r && r.placed ? r.placed : null; WIDGET.pinOK = !!(r && r.pinSupported); } catch (e) { WIDGET.placed = null; }
    if (ui.tab === 'me' && ui.meSub === 'widgets') render();
  },
};

SAVE_HOOKS.push(() => WIDGET.schedule());   // 저장할 때마다 위젯 묶음 갱신 예약 (05-native afterSave)

/* 위젯에서 쌓인 할 일을 기록에 반영 (순수 계산 + state 변경, 화면은 부른 쪽에서)
   지금은 일반 일정 완료 표시(normalDone)만 있다. 대상 일정이 지워졌거나 잡도리로 바뀌었으면 건너뛴다 */
function applyWidgetActions(acts) {
  const m = member();
  let changed = false, skipped = 0;
  if (!m) return { changed, skipped: 0 };
  if (!Array.isArray(state.widgetApplied)) state.widgetApplied = [];
  const seen = new Set(state.widgetApplied);
  for (const a of acts) {
    if (!a || !a.id || seen.has(a.id)) continue;
    seen.add(a.id); state.widgetApplied.push(a.id);
    if (a.type !== 'normalDone' || typeof a.key !== 'string') { skipped++; continue; }
    const [tid, d] = splitKey(a.key);
    const task = findTask(m, tid);
    const okTask = task && (task.type === 'normal' || task.jabOn === false) && /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    if (!okTask || !occursOn(task, d)) { skipped++; continue; }   // key의 날짜 = 회차 시작일 (여러 날 일정도 같음)
    const done = !!a.done;
    const cur = m.runs[a.key] && m.runs[a.key].status === 'done';
    if (done && !cur) { m.runs[a.key] = { status: 'done', endedAt: Number(a.at) || Date.now(), via: 'widget' }; changed = true; }
    else if (!done && cur) { delete m.runs[a.key]; changed = true; }
  }
  if (state.widgetApplied.length > 200) state.widgetApplied = state.widgetApplied.slice(-200);
  return { changed, skipped };
}

/* ---------- 설정 > 홈 화면 위젯 (안드로이드) ---------- */
function widgetsPage() {
  const P = WIDGET.placed || {};
  const total = Object.values(P).reduce((a, b) => a + (Number(b) || 0), 0);
  const rows = WIDGET_KINDS.map(([id, name, desc, size]) => {
    const n = Number(P[id]) || 0;
    return `<li class="wg-row"><span class="lb-text"><b>${name} <em>${size}</em></b><small>${desc}${n ? ` · 홈 화면에 ${n}개` : ''}</small></span>
      ${WIDGET.pinOK ? `<button class="btn secondary sm" data-act="widgetPin" data-v="${id}">${n ? '하나 더' : '추가'}</button>` : ''}</li>`;
  }).join('');
  return `<p class="wa-meta">${total ? `<b>홈 화면에 위젯 ${total}개</b> · ` : ''}앱을 열지 않아도 홈 화면에서 오늘 일정을 보고 일반 일정을 체크해요</p>
    <ul class="wg-list">${rows}</ul>
    <h2 class="sec-label">알아 둘 것</h2>
    <ul class="kv wg-notes">
      <li class="sub"><span>${WIDGET.pinOK ? '추가 버튼이 안 되면 홈 화면 빈 곳을 길게 누르고 위젯 > 잡도리에서 골라요' : '홈 화면 빈 곳을 길게 누르고 위젯 > 잡도리에서 골라요'}</span></li>
      <li class="sub"><span>잡도리 일정은 위젯에서 바꾸지 않아요. 누르면 앱이 열려 시작·끝내기를 해요</span></li>
      <li class="sub"><span>앱에서 일정을 바꾸면 위젯도 바로 바뀌어요. 시작까지 남은 시간은 위젯이 스스로 줄여 가요</span></li>
      <li class="sub"><span>'예정 → 시작 전'처럼 시간이 지나 바뀌는 상태는 안드로이드 배터리 규칙 때문에 몇 분 늦게 바뀔 수 있어요</span></li>
      <li class="sub"><span>앱을 오래 열지 않으면(미루먼지는 이틀, 일정 목록은 7일) 앱을 한 번 열어 달라고 해요</span></li>
    </ul>`;
}
Object.assign(ACT, {
  widgetPin: async (t) => {
    if (!NATIVE.Widget) return;
    try {
      const r = await NATIVE.Widget.pin({ kind: t.dataset.v });
      if (!r || !r.ok) toast('이 홈 화면 앱은 바로 추가를 지원하지 않아요. 홈 화면 빈 곳을 길게 눌러 위젯 > 잡도리에서 골라 주세요.');
    } catch (e) { toast('위젯을 추가하지 못했어요. 홈 화면 빈 곳을 길게 눌러 위젯 > 잡도리에서 골라 주세요.'); }
    setTimeout(() => WIDGET.refreshPlaced(), 1500);
  },
});
