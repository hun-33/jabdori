/* =========================================================
   02-views: 화면 그리기
   ========================================================= */

/* UI 상태 (저장하지 않음) */
const ui = {
  tab: 'today',
  selDate: null,
  calMode: 'month',
  calMonth: null,      // 'YYYY-MM'
  calWeek: null,       // 월요일 날짜
  focusKey: null,
  sheet: null,
  popup: null,
  result: null,
  receiptOpen: false,
  login: { busy: false },
  onb: { step: 0, stage: 3 },
  form: null,
  consoleOpen: false,
  lastScreen: null,
};

/* 실시간으로 바뀌는 값(시간·잡도리 세기)은 화면 전체를 다시 그리지 않고 이 값만 바꾼다 */
let LIVE = {}, LIVES = {};
function L(k, v, cls = '') { LIVE[k] = String(v); return `<span data-live="${k}"${cls ? ` class="${cls}"` : ''}>${esc(v)}</span>`; }
function LS(k, prop, val) { LIVES[k] = { prop, val: String(val) }; return `data-ls="${k}" style="${prop}:${val}"`; }
function sigOf(html) {
  return html
    .replace(/(<span data-live="[^"]*"[^>]*>)[^<]*(<\/span>)/g, '$1$2')
    .replace(/data-ls="([^"]*)" style="[^"]*"/g, 'data-ls="$1"');
}

function heatVar(stage) { return `var(--heat-${stage})`; }
/* 큰 숫자 (단위가 있는 눈금이면 작은 단위 글자를 붙인다) */
function degHTML(h, liveKey, cls = '') {
  const u = scaleOf().unit;
  return `<span class="deg ${cls}">${liveKey ? L(liveKey, h) : esc(h)}${u ? `<span class="deg-u">${esc(u)}</span>` : ''}</span>`;
}
function stageChip(h, dark) {
  const s = stageOf(h);
  return `<span class="stage-chip ${dark ? 'on-dark' : ''}" style="--hc:${heatVar(s.id)}"><i aria-hidden="true"></i>${s.name}</span>`;
}

/* ---------- 공통 조각 ---------- */
function rowMark(st) {
  const k = st.kind;
  if (st.task.type === 'normal') return '';
  const s = stageOf(st.task.heat).id;
  let ic = scaleOf().icon, cls = 'mk-heat';
  if (k === 'done') { ic = 'check'; cls = 'mk-ok'; }
  else if (k === 'failed') { ic = 'x'; cls = 'mk-bad'; }
  else if (ACTIVE_KINDS.includes(k)) { ic = 'dot'; cls = 'mk-live'; }
  else if (k === 'late' || k === 'missedStart') { ic = 'alert'; cls = 'mk-late'; }
  else if (k === 'past') { ic = 'clock'; cls = 'mk-past'; }
  return `<span class="row-mark ${cls}" style="--hc:${heatVar(s)}">${icon(ic)}</span>`;
}
function rowSide(st, t = now()) {
  const k = st.kind;
  if (k === 'upcoming' && st.date === today()) return `${fmtDur((st.w.start - t) / MIN)} 뒤`;
  if (k === 'late') return (t - st.w.start) / MIN < 1 ? '지금 시작' : `${fmtDur((t - st.w.start) / MIN)} 늦음`;
  if (k === 'running' || k === 'urgent' || k === 'overPlan') return KIND_LABEL[k] + ' · ' + stageOf(heatOf(st, t).total).name;
  return KIND_LABEL[k] || '';
}
function timeRange(task) {
  const e = hmToMin(task.start) + task.duration;
  return `${task.start}–${minToHm(e)}${e >= 1440 ? '(+1)' : ''}`;
}
function rowOcc(st) {
  const task = st.task;
  const meta = [timeRange(task)];
  if (task.type === 'jab') {
    meta.push(st.w.deadline ? `마감 ${fmtHM(st.w.deadline)}${ymd(st.w.deadline) !== st.date ? '(' + fmtMD(ymd(st.w.deadline)) + ')' : ''}` : '마감 없음');
    meta.push(`${lvs(task.heat)}부터`);
  } else if (task.repeat.kind !== 'none') meta.push(repeatText(task));
  const sideCls = `row-side k-${st.kind}`;
  const main = `<button class="row-btn" data-act="openTask" data-key="${st.key}">
      ${rowMark(st)}
      <span class="row-main"><span class="row-title ${st.kind === 'done' && task.type === 'normal' ? 'is-done' : ''}">${esc(task.title)}</span><span class="row-meta">${esc(meta.join(' · '))}</span></span>
      <span class="${sideCls}">${L('row:' + st.key, rowSide(st))}</span>
    </button>`;
  if (task.type === 'normal') {
    const done = st.kind === 'done';
    return `<li class="row normal"><button class="check ${done ? 'on' : ''}" data-act="normalToggle" data-key="${st.key}" role="checkbox" aria-checked="${done}" aria-label="${esc(task.title)} ${done ? '완료 취소' : '완료 표시'}">${icon('check')}</button>${main}</li>`;
  }
  return `<li class="row jab">${main}</li>`;
}
function dayMarks(m, date) {
  const occs = occurrencesOn(m, date);
  const jab = occs.filter((o) => o.task.type === 'jab');
  const normal = occs.length - jab.length;
  const failed = jab.some((o) => o.kind === 'failed');
  const allDone = jab.length > 0 && jab.every((o) => o.kind === 'done');
  const live = jab.some((o) => ACTIVE_KINDS.includes(o.kind));
  let mark = '', label = '';
  if (failed) { mark = `<span class="dm bad">${icon('x')}</span>`; label = '실패 있음'; }
  else if (allDone) { mark = `<span class="dm ok">${icon('check')}</span>`; label = '모두 완료'; }
  else if (jab.length) { mark = `<span class="dm heat ${live ? 'live' : ''}"></span>`; label = `잡도리 ${jab.length}개`; }
  else if (normal) { mark = '<span class="dm plain"></span>'; label = `일반 ${normal}개`; }
  return { mark, label, n: occs.length };
}
function weekStrip(m, sel, actName = 'selDate') {
  const mon = mondayOf(sel), td = today();
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), dm = dayMarks(m, d);
    const isSel = d === sel, isToday = d === td;
    cells += `<button class="wk-cell ${isSel ? 'sel' : ''} ${isToday ? 'today' : ''}" data-act="${actName}" data-date="${d}" aria-pressed="${isSel}" aria-label="${fmtDateLong(d)}${isToday ? ', 오늘' : ''}${dm.label ? ', ' + dm.label : ''}">
      <span class="wk-d">${WD[i + 1]}</span><span class="wk-n">${parseYmd(d).getDate()}</span><span class="wk-m">${dm.mark}</span></button>`;
  }
  return `<div class="wk">${cells}</div>`;
}
function dayList(m, date, opts = {}) {
  const occs = occurrencesOn(m, date);
  const jab = occs.filter((o) => o.task.type === 'jab');
  const normal = occs.filter((o) => o.task.type === 'normal');
  if (!occs.length) {
    return `<div class="empty-inline">
      <p>${date === today() ? '오늘은 비어 있어요.' : fmtDateShort(date) + '에는 일정이 없어요.'}</p>
      <button class="btn ghost sm" data-act="openAdd" data-date="${date}">${icon('plus')}이날에 올리기</button></div>`;
  }
  let h = '';
  if (jab.length) h += `<h3 class="sec-label">${icon(scaleOf().icon)}${josa(persona().name, '이/가')} 맡은 일</h3><ul class="rows">${jab.map(rowOcc).join('')}</ul>`;
  if (normal.length) h += `<h3 class="sec-label">${icon('edit')}적어 둔 일</h3><ul class="rows">${normal.map(rowOcc).join('')}</ul>`;
  return h;
}
function sheetBtn(label, act, cls = 'secondary', extra = '') { return `<button class="btn ${cls}" data-act="${act}" ${extra}>${label}</button>`; }

/* ---------- 로그인 ---------- */
const LOGIN_ERR = {
  network: { t: '인터넷 연결이 끊겼어요', b: '와이파이나 데이터를 켠 뒤 다시 시도해 주세요.', a: [['다시 시도', 'login']] },
  server: { t: '카카오 인증 서버가 잠깐 응답하지 않아요', b: '잠시 뒤 다시 시도해 주세요. 계속되면 조금 있다가 들어와 주세요.', a: [['다시 시도', 'login']] },
  timeout: { t: '응답이 너무 오래 걸려요', b: '15초 동안 응답이 없어서 멈췄어요. 다시 시도해 주세요.', a: [['다시 시도', 'login']] },
  authFail: { t: '인증에 실패했어요', b: '카카오 인증 정보를 확인하지 못했어요. 처음부터 다시 로그인해 주세요.', a: [['다시 로그인', 'login']] },
  talkFail: { t: '카카오톡을 열지 못했어요', b: '카카오계정으로 바로 로그인할 수 있어요.', a: [['카카오계정으로 로그인', 'loginAccount'], ['다시 시도', 'login']] },
  returnFail: { t: '카카오톡에서 돌아오지 못했어요', b: '인증은 끝났을 수도 있어요. 카카오계정으로 한 번 더 확인할게요.', a: [['카카오계정으로 로그인', 'loginAccount']] },
  tokenExpired: { t: '로그인이 만료됐어요', b: '다시 로그인하면 일정과 기록은 그대로예요.', a: [], info: true },
  // ↓ 진짜 앱(카카오 공식 SDK)에서만 나오는 안내
  notConfigured: { t: '카카오 앱 키가 아직 설정되지 않았어요', b: '개발자 안내: android/gradle.properties의 KAKAO_NATIVE_APP_KEY에 카카오 디벨로퍼스의 네이티브 앱 키를 넣고 다시 빌드해 주세요. 그 전에는 흉내 모드로 둘러볼 수 있어요.', a: [['흉내 모드로 둘러보기', 'loginFake']], dev: true },
  keyHash: { t: '카카오 앱 설정이 맞지 않아요', b: '개발자 안내: ① 카카오 로그인 > 사용 설정이 ON인지 ② 앱 > 플랫폼 키 > 네이티브 앱 키에 패키지명 com.jabdori.app 과 키 해시가 등록됐는지 ③ gradle.properties의 키가 같은지 확인해 주세요.', a: [['다시 시도', 'login'], ['흉내 모드로 둘러보기', 'loginFake']], dev: true },
  loginFailed: { t: '카카오 로그인에 실패했어요', b: '잠시 뒤 다시 시도해 주세요. 카카오톡이 안 되면 카카오계정으로 로그인할 수 있어요.', a: [['다시 시도', 'login'], ['카카오계정으로 로그인', 'loginAccount']], dev: true },
};
const LOGIN_NOTE = {
  cancel: '로그인을 취소했어요. 준비되면 다시 눌러 주세요.',
  denyRequired: '필수 항목에 동의해야 잡도리를 시작할 수 있어요. 언제든 다시 시도할 수 있어요.',
  loggedOut: '로그아웃했어요. 일정과 기록은 그대로 남아 있어요.',
  kakaoLoggedOut: '카카오 로그아웃까지 했어요. 다음엔 카카오 인증부터 다시 해요.',
  unlinked: '카카오 연결을 끊었어요. 다시 시작하면 동의부터 받아요.',
  withdrawn: '탈퇴했어요. 잡도리 기록을 모두 지웠어요.',
};
function viewLogin() {
  const lg = ui.login;
  const STEP = { opening: '카카오톡 여는 중…', account: '카카오계정 확인 중…', consent: '동의 기다리는 중…', authok: '카카오 인증 완료', member: '회원 정보 확인 중…', create: '잡도리 회원 만드는 중…' };
  const err = lg.error ? LOGIN_ERR[lg.error] : null;
  const note = lg.note ? LOGIN_NOTE[lg.note] : null;
  const mc = lg.busy ? { expr: 'focus', pose: 'check', motion: 'check' } : err && !err.info ? { expr: 'disappointed', pose: 'idle', motion: 'breathe' } : { expr: 'happy', pose: 'wave', motion: 'bounce' };
  const steps = ['카카오 인증', '회원 확인', '시작'];
  const stepIdx = { opening: 0, account: 0, consent: 0, authok: 1, member: 1, create: 1 }[lg.step] ?? -1;
  return {
    id: 'login',
    html: `<section class="scr login on-stove" aria-labelledby="login-title">
      <div class="login-top">
        <p class="eyebrow">미루는 사람 곁에 붙는 1:1 잡도리</p>
        <h1 id="login-title" class="wordmark">잡도리</h1>
        <p class="tagline">오늘도 미룰 거야?</p>
        <p class="tag-sub">${persona().intro.tagline}</p>
      </div>
      <div class="login-mascot">${mascot(null, { ...mc, label: `${persona().name}, ${EXPR_LABEL[mc.expr]}` })}</div>
      <div class="login-bottom">
        ${err ? `<div class="notice ${err.info ? 'info' : 'err'}" role="alert">${icon(err.info ? 'info' : 'alert')}<div><b>${err.t}</b><p>${err.b}</p>${err.dev && lg.detail ? `<p class="dev-detail">${esc(lg.detail)}</p>` : ''}${err.a.length ? `<div class="notice-acts">${err.a.map(([l, a], i) => `<button class="btn ${i === 0 ? 'light' : 'ghost-light'} sm" data-act="${a}">${l}</button>`).join('')}</div>` : ''}</div></div>` : ''}
        ${note && !err ? `<p class="soft-note" role="status">${note}</p>` : ''}
        <button class="btn-kakao" data-act="login" ${lg.busy ? 'aria-disabled="true" aria-busy="true"' : ''}>
          ${lg.busy ? '<span class="spin" aria-hidden="true"></span>' : KAKAO_SYMBOL}
          <span>${lg.busy ? STEP[lg.step] || '확인 중…' : '카카오로 시작하기'}</span>
        </button>
        <ol class="login-steps ${lg.busy ? 'show' : ''}" aria-label="로그인 진행 단계">${steps.map((s, i) => `<li class="${i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}">${s}</li>`).join('')}</ol>
        <p class="fine">${NATIVE.on && !state.fakeLogin ? '카카오에서 동의한 정보(닉네임·프로필 사진·이메일)만 받아요. 받은 정보는 이 폰에만 저장돼요.' : NATIVE.on ? `지금은 흉내 모드예요(카카오에 연결하지 않음). <button class="link-btn" data-act="realLogin">진짜 카카오 로그인 쓰기</button>` : '처음이면 자동으로 가입돼요. 따로 입력할 건 없어요.'}</p>
      </div>
    </section>`,
  };
}

/* ---------- 온보딩 ---------- */
function viewOnboarding(m) {
  const s = ui.onb.step, N = 4;
  let body = '', art = '';
  if (s === 0) {
    art = mascot(m, { expr: 'happy', pose: 'wave', motion: 'bounce' });
    const I = persona().intro;
    body = `<h1 class="onb-title">${I.helloTitle}</h1>
      <p class="onb-body">${I.helloBody}</p>`;
  } else if (s === 1) {
    art = mascot(m, { expr: 'happy', pose: 'cheer', motion: 'bounce' });
    body = `<p class="assign">${icon('check')}${esc(m.nickname)} 님 전담으로 배정됐어요</p>
      <h1 class="onb-title">오늘부터 네 전담은<br>나, ${josa(persona().name, '이야/야')}.</h1>
      <p class="onb-body">${persona().intro.meetBody}</p>
      <p class="onb-sub">어떤 모습으로 붙어 있을까? 나중에 바꿀 수 있어.</p>
      ${costumeRow(m)}`;
  } else if (s === 2) {
    const S = scaleOf(m), sg = ui.onb.stage, st = S.stages[sg - 1];
    art = mascot(m, { ...mascotForStage(sg), label: `${persona().name}, ${st.name} 단계` });
    body = `<h1 class="onb-title">맡긴 일만 내가 관리해.</h1>
      <p class="onb-body">일정을 올릴 때 <b>${persona().name}한테 맡기기</b>를 고르면 잡도리 일정이 돼. <b>그냥 적어두기</b>는 조용히 달력에만 남아.</p>
      <p class="onb-sub">${fillLine(S.onbIntro, { first: S.stages[0].name, last: S.stages[4].name })}</p>
      <div class="scale" role="radiogroup" aria-label="${S.title} 단계">${S.stages.map((x) => `<button role="radio" aria-checked="${x.id === sg}" class="scale-step ${x.id === sg ? 'on' : ''}" style="--hc:${heatVar(x.id)}" data-act="onbStage" data-s="${x.id}"><i></i><b>${x.name}</b><span>${lv(x.min)}~</span></button>`).join('')}</div>
      <p class="scale-desc"><b>${st.name}</b> · ${st.desc}<br><q>${persona().lines.sample[sg]}</q>${TTS.ok() ? `<button class="say-mini light" data-act="speakSample" data-s="${sg}" aria-label="${st.name} 단계 목소리 들어 보기">${icon('speaker')}</button>` : ''}</p>`;
  } else {
    art = mascot(m, { expr: 'proud', pose: 'flag', motion: 'breathe' });
    const S = scaleOf(m);
    body = `<h1 class="onb-title">${S.onbFailTitle}</h1>
      <div class="stamps"><span class="stamp ok sm">참 잘했어</span><span class="stamp bad sm">넘쳤다</span></div>
      <p class="onb-body">${fillLine(S.onbFailBody, { step: HEAT_POLICY.failStep, streak: HEAT_POLICY.coolStreak })}</p>`;
  }
  const dots = Array.from({ length: N }, (_, i) => `<i class="${i <= s ? 'on' : ''}"></i>`).join('');
  const foot = s < N - 1
    ? `${s > 0 ? '<button class="btn ghost-light" data-act="onbPrev">이전</button>' : '<span></span>'}<button class="btn light" data-act="onbNext">다음</button>`
    : `<button class="btn ghost-light" data-act="onbFinish" data-to="home">둘러볼게</button><button class="btn light" data-act="onbFinish" data-to="add">첫 일정 올리기</button>`;
  return {
    id: 'onb' + s,
    html: `<section class="scr onb on-stove" aria-labelledby="onb-h">
      <div class="onb-bar"><div class="onb-dots" role="progressbar" aria-valuemin="1" aria-valuemax="${N}" aria-valuenow="${s + 1}" aria-label="소개 ${s + 1}/${N}단계">${dots}</div>
        <button class="btn ghost-light sm" data-act="onbSkip">건너뛰기</button></div>
      <div class="onb-mascot">${art}</div>
      <div class="onb-text" id="onb-h">${body}</div>
      <div class="onb-foot">${foot}</div>
    </section>`,
  };
}

/* ---------- 오늘 ---------- */
function pickTicket(m) {
  const td = today();
  const jabs = occurrencesOn(m, td).filter((o) => o.task.type === 'jab');
  let tk = jabs.find((o) => ACTIVE_KINDS.includes(o.kind))
    || jabs.find((o) => o.kind === 'late' || o.kind === 'missedStart')
    || jabs.filter((o) => o.kind === 'upcoming').sort((a, b) => a.w.start - b.w.start)[0];
  let next = null;
  if (!tk) {
    for (let i = 1; i <= 14 && !next; i++) {
      const d = addDays(td, i);
      next = occurrencesOn(m, d).find((o) => o.task.type === 'jab') || null;
    }
  }
  return { tk, next, jabs };
}
function personaForToday(m) {
  const t = now();
  const { tk, next, jabs } = pickTicket(m);
  const ctx = { penalty: m.penalty, streak: m.streak };
  let res;
  if (tk) {
    const h = heatOf(tk, t).total, sg = stageOf(h).id;
    const ln = lineFor(tk, h, t);
    const elapsedMin = tk.run && tk.run.startedAt ? (t - tk.run.startedAt) / MIN : 0;
    ctx.lateMin = (t - tk.w.start) / MIN; ctx.elapsedMin = elapsedMin; ctx.bucket = Math.floor(Math.max(0, (t - tk.w.start) / MIN) / 10);
    res = { tk, next, heat: h, stage: sg, mc: mascotFor(tk.kind, sg, ctx), line: ln };
  } else {
    const L = persona().lines, f = floorOf(m);
    let pk, mc;
    if (!m.tasks.length) { pk = pickLine('empty', L.empty); mc = { expr: 'default', pose: 'idle', motion: 'look', fluff: 0 }; }
    else if (jabs.length && jabs.every((o) => o.kind === 'done' || o.kind === 'failed')) {
      if (jabs.some((o) => o.kind === 'failed')) { pk = pickLine('dayFail', L.dayFail); mc = mascotFor('failed', 1, ctx); }
      else { pk = pickLine('allDone', L.allDone); mc = { expr: 'proud', pose: 'flag', motion: 'breathe', fluff: 0 }; }
    } else { pk = pickLine('noneToday', L.noneToday); mc = { expr: 'sleepy', pose: 'curl', motion: 'sleep', fluff: 0 }; }
    if (m.penalty >= 2 && mc.expr !== 'proud') mc.fluff = Math.max(mc.fluff, (m.penalty - 1) * 0.25); // 반복 실패: 부풀어 있음
    res = { tk: null, next, heat: f, stage: stageOf(f).id, mc, line: { id: pk.id, text: pk.tpl }, idle: true };
  }
  // 방금 일정을 올렸거나 캐릭터를 눌렀을 때의 짧은 반응
  if (ui.react && ui.react.until > Date.now()) {
    res.mc = { ...res.mc, ...ui.react.mc };
    if (ui.react.line) res.line = { id: 'react:' + ui.react.id, text: ui.react.line };
  }
  return res;
}
function ticketHTML(st) {
  const t = now(), k = st.kind, task = st.task;
  const label = { upcoming: '곧 시작', late: '지금 붙잡힌 일', urgent: '마감 임박', overPlan: '예정 시간 지남', missedStart: '마감 지난 일', overdue: '마감 도달 · 결과 입력', break: '휴식 중', breakOver: '휴식 초과' }[k] || '지금 붙잡힌 일';
  let big = '';
  if (k === 'upcoming') big = `시작까지 ${fmtDur((st.w.start - t) / MIN)}`;
  else if (k === 'late') big = `${(t - st.w.start) / MIN < 1 ? '시작 시간이에요' : fmtDur((t - st.w.start) / MIN) + ' 늦음'} · ${leftText(st, t)}`;
  else if (k === 'missedStart' || k === 'overdue') big = '마감 시각이 지났어요';
  else big = leftText(st, t);
  let cta;
  if (k === 'upcoming' || k === 'late') cta = `<button class="btn primary" data-act="startOcc" data-key="${st.key}">${icon('play')}${k === 'upcoming' ? '미리 시작하기' : '시작하기'}</button>`;
  else if (k === 'missedStart' || k === 'overdue') cta = `<button class="btn primary" data-act="openFocus" data-key="${st.key}">결과 입력하기</button>`;
  else cta = `<button class="btn primary" data-act="openFocus" data-key="${st.key}">이어서 보기</button>`;
  const end = minToHm(hmToMin(task.start) + task.duration);
  return `<div class="ticket">
    <div class="tk-stub" aria-hidden="true"><b>${task.start}</b><span>${end}</span></div>
    <div class="tk-main">
      <p class="tk-label">${label}</p>
      <h2 class="tk-title">${esc(task.title)}</h2>
      <p class="tk-meta">${icon('clock')}${timeRange(task)} · ${st.w.deadline ? '마감 ' + fmtHM(st.w.deadline) : '마감 없음'}</p>
      <p class="tk-left">${L('tkLeft', big)}</p>
      ${cta}
    </div>
  </div>`;
}
function heatPips(h) {
  const sg = stageOf(h).id;
  return `<span class="pips" aria-hidden="true">${scaleOf().stages.map((x) => `<i class="${x.id <= sg ? 'on' : ''}" style="--hc:${heatVar(x.id)}"></i>`).join('')}</span>`;
}
/* 말풍선. stage = 지금 단계 (소리로 읽을 때 4·5단계는 더 빠르고 높게) */
function speechHTML(line, cls = 'on-dark', stage = 0) {
  return `<div class="speech-wrap"><p class="speech ${cls}" data-tpl="${esc(line.id)}" data-stage="${stage}" aria-live="polite">${L('speech', line.text)}</p>${TTS.ok() ? `<button class="say-btn ${cls}" data-act="speak" aria-label="${persona().name} 말 소리로 듣기">${icon('speaker')}</button>` : ''}</div>`;
}
function personaMenu() {
  if (!ui.menuOpen) return '';
  const items = [['menuAdd', 'plus', '잡도리 일정 올리기'], ['menuHeat', 'sliders', scaleOf().title], ['openMonth', 'calendar', '월간 달력'], ['openCloset', 'shirt', '옷 갈아입기']];
  const fresh = ui.menuFresh; ui.menuFresh = false; // 메뉴를 막 열었을 때만 펼치는 애니메이션
  return `<div class="p-menu ${fresh ? 'fresh' : ''}" role="group" aria-label="${persona().name} 메뉴">${items.map(([a, ic, l]) => `<button class="p-menu-item" data-act="${a}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`;
}
function viewToday(m) {
  const td = today(), t = now();
  if (!ui.selDate) ui.selDate = td;
  const p = personaForToday(m);
  const f = floorOf(m);
  const sel = ui.selDate;
  let tk = '';
  if (p.tk) tk = ticketHTML(p.tk);
  else if (!m.tasks.length) tk = `<div class="ticket empty"><div class="tk-main"><p class="tk-label">맡긴 일 없음</p><h2 class="tk-title">미루고 있는 일 하나만 맡겨 주세요</h2><p class="tk-meta">시간을 정해 두면 ${josa(persona().name, '이/가')} 시작부터 마감까지 붙잡아요.</p><button class="btn primary" data-act="openAdd" data-date="${td}">${icon('plus')}할 일 맡기기</button></div></div>`;
  else if (p.next) tk = `<div class="ticket quiet"><div class="tk-main"><p class="tk-label">다음 잡도리</p><h2 class="tk-title">${esc(p.next.task.title)}</h2><p class="tk-meta">${icon('clock')}${fmtDateShort(p.next.date)} ${timeRange(p.next.task)}</p><button class="btn secondary" data-act="openTask" data-key="${p.next.key}">일정 보기</button></div></div>`;
  else tk = `<div class="ticket quiet"><div class="tk-main"><p class="tk-label">오늘 몫 끝</p><h2 class="tk-title">새로 맡길 일이 생기면 올려 주세요</h2><button class="btn secondary" data-act="openAdd" data-date="${td}">${icon('plus')}올리기</button></div></div>`;
  const S = scaleOf(m);
  // 큰 숫자 위 이름: 곧 시작 = 시작값 / 진행 중 = 지금 세기 / 맡은 일 없음 = 다음 일정의 최저 시작값
  const heatLabel = p.tk ? (p.tk.kind === 'upcoming' ? '시작 ' + S.short : S.title) : S.floor;
  const selTitle = sel === td ? '오늘 할 일' : fmtDateLong(sel);
  const html = `<section class="scr today" aria-labelledby="today-h">
    <div class="stove-band">
      <header class="hdr on-dark">
        <div><h1 id="today-h" class="hdr-title">${fmtDateLong(td)}</h1><p class="hdr-sub">${L('clock', fmtHM(t))} · ${esc(m.nickname)} 님 전담 ${persona().name}</p></div>
        <button class="btn ghost-light sm" data-act="openAdd" data-date="${sel}">${icon('plus')}올리기</button>
      </header>
      <div class="persona-row">
        <button class="persona-mascot" data-act="mascotTap" aria-expanded="${!!ui.menuOpen}" aria-label="${persona().name} 메뉴 ${ui.menuOpen ? '닫기' : '열기'}">${mascot(m, { ...p.mc, label: `${persona().name}, ${EXPR_LABEL[p.mc.expr]}, ${lvs(p.heat)}` })}</button>
        <div class="persona-temp">
          <p class="pt-label">${heatLabel}</p>
          ${degHTML(p.heat, 'heat', 'xl')}
          ${heatPips(p.heat)}
          <p class="pt-stage">${stageChip(p.heat, true)}<span>${stageOf(p.heat).desc}</span></p>
        </div>
      </div>
      ${personaMenu()}
      ${speechHTML(p.line, 'on-dark', p.stage)}
      ${tk}
    </div>
    <div class="paper">
      <div class="sec-head"><h2 class="sec-title">이번 주</h2><button class="link-btn" data-act="openMonth" aria-label="월간 달력 펼치기">월간 보기${icon('down')}</button></div>
      <div class="wk-swipe" data-swipe="month">${weekStrip(m, sel)}<p class="wk-hint" aria-hidden="true">${icon('down')}아래로 쓸면 월간 달력</p></div>
      <div class="sec-head mt"><h2 class="sec-title">${selTitle}</h2>${sel !== td ? `<button class="link-btn" data-act="selDate" data-date="${td}">오늘로</button>` : ''}</div>
      ${dayList(m, sel)}
      <button class="floor-note" data-act="openFloorInfo">${icon(S.icon)}<span>${S.floor} <b>${lv(f)}</b>${m.penalty ? ` · ${S.extra} ${m.penalty}${S.extraUnit}` : ''} · 실패하면 +${HEAT_POLICY.failStep}</span>${icon('chevron')}</button>
    </div>
  </section>`;
  return { id: 'today', html };
}

/* ---------- 달력 ---------- */
function monthGridHTML(m, month, sel, act) {
  const td = today();
  const [y, mo] = month.split('-').map(Number);
  const first = `${y}-${pad(mo)}-01`;
  const start = mondayOf(first);
  const lastDay = new Date(y, mo, 0).getDate();
  const cellsN = Math.ceil((daysBetween(start, first) + lastDay) / 7) * 7;
  let cells = '';
  for (let i = 0; i < cellsN; i++) {
    const d = addDays(start, i), out = d.slice(0, 7) !== month;
    const dm = dayMarks(m, d);
    cells += `<button class="mo-cell ${out ? 'out' : ''} ${d === sel ? 'sel' : ''} ${d === td ? 'today' : ''}" data-act="${act}" data-date="${d}" aria-pressed="${d === sel}" aria-label="${fmtDateLong(d)}${d === td ? ', 오늘' : ''}${dm.label ? ', ' + dm.label : ''}"><span class="mo-n">${parseYmd(d).getDate()}</span><span class="mo-m">${dm.mark}</span></button>`;
  }
  return `<div class="mo-head" aria-hidden="true">${WD.slice(1).map((w) => `<span>${w}</span>`).join('')}</div><div class="mo-grid">${cells}</div>`;
}
function viewCalendar(m) {
  const td = today();
  if (!ui.selDate) ui.selDate = td;
  const sel = ui.selDate;
  if (!ui.calMonth) ui.calMonth = sel.slice(0, 7);
  if (!ui.calWeek) ui.calWeek = mondayOf(sel);
  const mode = ui.calMode;
  let nav, grid;
  if (mode === 'month') {
    const [y, mo] = ui.calMonth.split('-').map(Number);
    nav = `<button class="icon-btn" data-act="calNav" data-delta="-1" aria-label="이전 달">${icon('prev')}</button><h2 class="cal-title">${y}년 ${mo}월</h2><button class="icon-btn" data-act="calNav" data-delta="1" aria-label="다음 달">${icon('next')}</button>`;
    grid = `${monthGridHTML(m, ui.calMonth, sel, 'calPick')}
      <div class="sec-head mt"><h2 class="sec-title">${fmtDateLong(sel)}</h2><button class="link-btn" data-act="openAdd" data-date="${sel}">${icon('plus')}이날에 올리기</button></div>
      ${dayList(m, sel)}`;
  } else {
    const mon = ui.calWeek, sun = addDays(mon, 6);
    nav = `<button class="icon-btn" data-act="weekNav" data-delta="-1" aria-label="이전 주">${icon('prev')}</button><h2 class="cal-title">${fmtMD(mon)} – ${fmtMD(sun)}</h2><button class="icon-btn" data-act="weekNav" data-delta="1" aria-label="다음 주">${icon('next')}</button>`;
    let days = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i), occs = occurrencesOn(m, d);
      days += `<div class="ag-day ${d === sel ? 'sel' : ''} ${d === td ? 'today' : ''}">
        <button class="ag-date" data-act="calPick" data-date="${d}" aria-pressed="${d === sel}"><b>${WD[i + 1]}</b><span>${parseYmd(d).getDate()}</span></button>
        <div class="ag-items">${occs.length ? `<ul class="rows tight">${occs.map(rowOcc).join('')}</ul>` : `<button class="ag-empty" data-act="openAdd" data-date="${d}">비어 있음 · 올리기</button>`}</div>
      </div>`;
    }
    grid = `<div class="agenda">${days}</div>`;
  }
  const html = `<section class="scr calendar" aria-labelledby="cal-h">
    <header class="hdr"><div><h1 id="cal-h" class="hdr-title">달력</h1><p class="hdr-sub">날짜를 누르면 그날 일정이 보여요</p></div>
      <button class="btn secondary sm" data-act="openAdd" data-date="${sel}">${icon('plus')}올리기</button></header>
    <div class="paper">
      <div class="cal-bar">
        <div class="seg" role="tablist" aria-label="달력 보기 방식">
          <button role="tab" aria-selected="${mode === 'week'}" class="${mode === 'week' ? 'on' : ''}" data-act="calMode" data-v="week">주간</button>
          <button role="tab" aria-selected="${mode === 'month'}" class="${mode === 'month' ? 'on' : ''}" data-act="calMode" data-v="month">월간</button>
        </div>
        ${sel !== td || (mode === 'month' && ui.calMonth !== td.slice(0, 7)) || (mode === 'week' && ui.calWeek !== mondayOf(td)) ? '<button class="link-btn" data-act="calToday">오늘로</button>' : ''}
      </div>
      <div class="cal-nav">${nav}</div>
      ${grid}
      <p class="legend"><span><span class="dm heat"></span>잡도리</span><span><span class="dm plain"></span>일반</span><span><span class="dm ok">${icon('check')}</span>완료</span><span><span class="dm bad">${icon('x')}</span>실패</span></p>
    </div>
  </section>`;
  return { id: 'calendar-' + mode, html };
}

/* ---------- 집중 모드 ---------- */
function viewFocus(m) {
  const [tid, d] = splitKey(ui.focusKey);
  const task = findTask(m, tid);
  if (!task) { ui.focusKey = null; return null; }
  const st = occState(m, task, d), t = now();
  // 시작하지 않았거나 끝난 회차는 집중 모드 대상이 아니다 (마감 지난 미시작 회차는 결과 입력용으로 허용)
  if (['done', 'failed', 'upcoming', 'late', 'past'].includes(st.kind)) { ui.focusKey = null; return null; }
  const hp = heatOf(st, t), h = hp.total, sg = stageOf(h).id;
  const slackOpen = ui.popup && ui.popup.type === 'slack' && !ui.popup.answer;
  const elapsedMin0 = st.run && st.run.startedAt ? (t - st.run.startedAt) / MIN : 0;
  const mc = slackOpen ? { expr: 'surprised', pose: 'idle', motion: 'none', fluff: 0.2 }
    : mascotFor(st.kind, sg, { lateMin: (t - st.w.start) / MIN, elapsedMin: elapsedMin0, penalty: m.penalty, streak: m.streak, bucket: Math.floor(elapsedMin0 / 10) });
  const ln = lineFor(st, h, t);
  const w = st.w, endAt = w.deadline ?? w.end;
  const span = Math.max(1, endAt - w.start);
  const prog = clamp((t - w.start) / span, 0, 1);
  const planPos = w.deadline && w.end < w.deadline ? clamp((w.end - w.start) / span, 0, 1) : null;
  const elapsed = st.run && st.run.startedAt ? (t - st.run.startedAt) / MIN : 0;
  const chip = KIND_LABEL[st.kind];
  const S = scaleOf(m);
  let actions = '';
  if (st.kind === 'break' || st.kind === 'breakOver') {
    actions = `<p class="fx-note">${st.kind === 'break' ? `휴식 ${L('brkLeft', fmtDur((st.run.brk.until - t) / MIN))} 남음` : `휴식 ${L('brkOver', fmtDur((t - st.run.brk.until) / MIN))} 초과 — ${S.short}${jo(S.short, '이/가')} 오르는 중`}</p>
      <button class="btn light block" data-act="endBreak">${icon('play')}휴식 끝, 다시 하기</button>`;
  } else if (st.kind === 'overdue' || st.kind === 'missedStart') {
    actions = `<p class="fx-note">마감 시각이 지났어요. 결과를 알려 주세요.</p>
      <div class="fx-two"><button class="btn light" data-act="finishOcc" data-key="${st.key}">${icon('check')}끝냈어</button><button class="btn danger-light" data-act="failNow" data-key="${st.key}">${icon('x')}못 끝냈어</button></div>`;
  } else {
    actions = `<button class="btn light block" data-act="finishOcc" data-key="${st.key}">${icon('check')}끝냈어</button>
      <div class="fx-two"><button class="btn ghost-light" data-act="takeBreak">${icon('coffee')}${HEAT_POLICY.breakMinutes}분 쉬었다 할게</button><button class="btn ghost-light" data-act="giveUp" data-key="${st.key}">${icon('flag')}포기할래</button></div>`;
  }
  const receipt = `<div class="receipt ${ui.receiptOpen ? 'open' : ''}">
    <button class="receipt-toggle" data-act="toggleReceipt" aria-expanded="${ui.receiptOpen}">${icon('receipt')}<span>왜 ${S.short}${jo(S.short, '이/가')} ${L('rcHeat', h)}${esc(S.unit)}일까?</span>${icon('chevron', 'rot')}</button>
    ${ui.receiptOpen ? `<dl class="receipt-body">${hp.parts.map((p, i) => `<div><dt>${esc(p.label)}</dt><dd>${L('rc' + i, (p.base ? '' : '+') + Math.round(p.v) + S.unit)}</dd></div>`).join('')}<div class="sum"><dt>지금 ${S.short}</dt><dd>${L('rcSum', h + S.unit)}</dd></div></dl>
    <p class="receipt-foot">계산식은 프로토타입용 예시예요. 시작 ${S.short} + 시간 경과 + 마감 임박 + 딴짓·휴식 초과.</p>` : ''}
  </div>`;
  const html = `<section class="scr focus on-stove s${sg}" aria-labelledby="fx-title" style="--hc:${heatVar(sg)}">
    <header class="fx-top">
      <button class="icon-btn on-dark" data-act="exitFocus" aria-label="오늘 화면으로 나가기 (일정은 계속 진행돼요)">${icon('back')}</button>
      <div class="fx-head"><p class="fx-kicker">집중 모드 · ${L('clock', fmtHM(t))}</p><h1 id="fx-title" class="fx-title">${esc(task.title)}</h1></div>
      <span class="state-chip k-${st.kind}">${chip}</span>
    </header>
    <div class="fx-hero">
      <div class="fx-mascot">${mascot(m, { ...mc, label: `${persona().name}, ${EXPR_LABEL[mc.expr]}, ${lvs(h)}` })}</div>
      <div class="fx-temp">${degHTML(h, 'heat', 'xxl')}${heatPips(h)}<p>${stageChip(h, true)}</p></div>
    </div>
    <div class="fx-speech">${speechHTML(ln, 'on-dark big', sg)}</div>
    <div class="tl" aria-label="진행 시간 막대">
      <div class="tl-track"><div class="tl-fill" ${LS('tlFill', '--p', prog.toFixed(4))}></div>${planPos != null ? `<i class="tl-plan" style="left:${(planPos * 100).toFixed(2)}%"></i>` : ''}<i class="tl-now" ${LS('tlNow', '--p', prog.toFixed(4))}></i></div>
      <div class="tl-labels"><span>${fmtHM(w.start)} 시작</span>${planPos != null ? `<span class="mid">${fmtHM(w.end)} 예정 종료</span>` : ''}<span>${fmtHM(endAt)} ${w.deadline ? '마감' : '예정 종료'}</span></div>
      <p class="tl-sum">${L('fxElapsed', elapsed < 1 ? '방금 시작' : '진행 ' + fmtDur(elapsed))} · ${L('fxLeft', leftText(st, t))}${st.run && st.run.slack.length ? ` · 딴짓 ${st.run.slack.length}회` : ''}</p>
    </div>
    ${receipt}
    <div class="fx-actions">${actions}</div>
  </section>`;
  return { id: 'focus:' + ui.focusKey, html };
}

/* ---------- 기록 ---------- */
function allRecords(m) {
  return Object.entries(m.runs).filter(([, r]) => (r.status === 'done' || r.status === 'failed') && r.startHeat != null) // 잡도리 일정 기록만
    .map(([k, r]) => ({ key: k, run: r, date: splitKey(k)[1] }))
    .sort((a, b) => (b.run.endedAt || 0) - (a.run.endedAt || 0));
}
function viewRecords(m) {
  const recs = allRecords(m);
  const ok = recs.filter((r) => r.run.status === 'done').length, bad = recs.length - ok;
  const f = floorOf(m);
  const changes = recs.filter((r) => r.run.floorAfter !== r.run.floorBefore).slice(0, 4);
  let list = '';
  if (!recs.length) {
    list = `<div class="empty-block">${mascot(m, { expr: 'sleepy', pose: 'curl', motion: 'sleep', label: `${persona().name}, 졸림` })}<p class="eb-title">아직 남은 기록이 없어요</p><p class="eb-body">잡도리 일정을 끝내거나 놓치면 여기에 도장과 함께 남아요.</p><button class="btn secondary" data-act="tab" data-tab="today">오늘 일정 보기</button></div>`;
  } else {
    let lastDate = '';
    list = '<ul class="rec-list">';
    for (const r of recs) {
      if (r.date !== lastDate) { list += `<li class="rec-date">${fmtDateLong(r.date)}</li>`; lastDate = r.date; }
      const done = r.run.status === 'done';
      list += `<li><button class="rec-row" data-act="openRecord" data-key="${r.key}">
        <span class="rec-stamp ${done ? 'ok' : 'bad'}">${icon(done ? 'check' : 'x')}<span class="sr">${done ? '완료' : '실패'}</span></span>
        <span class="row-main"><span class="row-title">${esc(r.run.title)}</span><span class="row-meta">${done ? '완료' : '실패'} · ${r.run.endedAt ? fmtHM(r.run.endedAt) : ''} · 최고 ${lvs(r.run.peak || r.run.endHeat)}${r.run.slack && r.run.slack.length ? ` · 딴짓 ${r.run.slack.length}회` : ''}${r.run.excuse ? ' · 핑계: ' + EXCUSES[r.run.excuse] : ''}</span></span>
        ${icon('chevron', 'muted')}</button></li>`;
    }
    list += '</ul>';
  }
  const pct = (x) => `${x}%`;
  const S = scaleOf(m);
  const html = `<section class="scr records" aria-labelledby="rec-h">
    <header class="hdr"><div><h1 id="rec-h" class="hdr-title">기록</h1><p class="hdr-sub">끝낸 일도, 놓친 일도 남겨 둬요</p></div></header>
    <div class="paper">
      <div class="floor-panel">
        <div class="fp-top"><div><p class="fp-label">지금 ${S.floor}</p>${degHTML(f, null, 'lg')}</div>
          <dl class="fp-stats"><div><dt>완료</dt><dd>${ok}</dd></div><div><dt>실패</dt><dd>${bad}</dd></div><div><dt>연속 성공</dt><dd>${m.streak}/${HEAT_POLICY.coolStreak}</dd></div></dl></div>
        <div class="thermo" role="img" aria-label="${S.floor} ${lv(f)}, 처음 ${lv(m.initialHeat)}">
          <div class="thermo-track">${S.stages.map((s, i, a) => `<i style="--hc:${heatVar(s.id)};left:${s.min}%;width:${(a[i + 1] ? a[i + 1].min : 100) - s.min}%"></i>`).join('')}</div>
          <span class="thermo-floor" style="left:${pct(f)}">${icon('lock')}</span>
          <span class="thermo-init" style="left:${pct(m.initialHeat)}">처음 ${lv(m.initialHeat)}</span>
        </div>
        <p class="fp-note">${m.penalty ? `지금 ${extraText(m.penalty, m)}. 잡도리 일정을 ${HEAT_POLICY.coolStreak - m.streak}번 더 연속으로 끝내면 ${josa(S.clear, '으로/로')} 한 ${S.extraUnit} 내려가요.` : `실패 가산이 없어요. 놓치면 다음에 올리는 잡도리 일정부터 ${HEAT_POLICY.failStep}씩 올라가요.`}</p>
        ${changes.length ? `<ul class="fp-changes">${changes.map((c) => `<li>${fmtMD(c.date)} ${esc(c.run.title)} ${c.run.status === 'failed' ? '실패' : S.clear} · ${lv(c.run.floorBefore)} → <b>${lv(c.run.floorAfter)}</b></li>`).join('')}</ul>` : ''}
      </div>
      <h2 class="sec-title mt">지난 잡도리</h2>
      ${list}
    </div>
  </section>`;
  return { id: 'records', html };
}
const EXCUSES = { time: '시간이 모자랐어', slack: '딴짓했어', condition: '컨디션이 안 좋았어', hard: '생각보다 어려웠어', none: '말 안 할래' };

/* ---------- 나 ---------- */
/* 단계 이름 설정: 캐릭터별(미루먼지 농도: 좋음~최악) ↔ 공통(잡도리 강도: 순한맛~최고 매운맛) */
function scaleModeBlock(m) {
  const mode = m.scaleMode === 'common' ? 'common' : 'character';
  const own = charOf(m).scale, S = scaleOf(m);
  const opts = [['character', '캐릭터별', own.title], ['common', '공통', SCALES.common.title]];
  return `<div class="set-block">
      <p class="set-title">단계 이름</p>
      <div class="seg wide two" role="radiogroup" aria-label="단계 이름">${opts.map(([id, l, sub]) => `<button role="radio" class="seg-btn ${mode === id ? 'on' : ''}" aria-checked="${mode === id}" data-act="scaleMode" data-v="${id}"><b>${l}</b><small>${sub}</small></button>`).join('')}</div>
      <p class="stage-names" aria-label="지금 쓰는 단계 이름">${S.stages.map((x) => `<span style="--hc:${heatVar(x.id)}"><i aria-hidden="true"></i>${x.name}</span>`).join('')}</p>
      <p class="set-desc">${S.blurb} 숫자와 잔소리 세기는 똑같고 이름만 바뀌어요.</p>
    </div>`;
}
function viewMe(m) {
  const c = m.consent;
  // 진짜 앱 + 진짜 카카오 로그인: 카카오에서 받은 정보와 동의 내역을 그대로 보여 준다
  const real = NATIVE.on && !!(state.session && state.session.real);
  if (real && ui.scopes == null && !ui.scopesLoading) setTimeout(loadKakaoScopes, 0);
  const rows = real ? kakaoConsentRows(m) : [
    ['서비스 이용약관', '필수', c.terms], ['개인정보 수집·이용', '필수', c.privacy],
    ['카카오계정 이메일', '선택', c.email], ['프로필 사진', '선택', c.profile],
  ];
  const acct = real ? [
    ['logout', 'logout', '로그아웃', '이 폰에서만 나가요. 카카오 연결은 남아 있어 다음엔 동의 없이 바로 들어와요.'],
    ['kakaoLogout', 'logout', '카카오 로그아웃', '카카오 로그인 토큰까지 지워요. 다음엔 카카오톡 인증부터 다시 해요.'],
    ['unlink', 'unlink', '카카오 연결 끊기', '카카오 계정과 잡도리의 연결을 끊고 동의도 철회해요. 기록은 탈퇴 전까지 남아요.'],
    ['withdraw', 'trash', '회원 탈퇴', '이 폰의 잡도리 기록을 지우고 카카오 연결도 함께 끊어요.'],
  ] : [
    ['logout', 'logout', '로그아웃', '이 기기에서만 나가요. 카카오 인증은 남아 있어 다음엔 바로 들어와요.'],
    ['kakaoLogout', 'logout', '카카오 로그아웃', '카카오 인증까지 끝내요. 다음엔 카카오 인증부터 다시 해요.'],
    ['unlink', 'unlink', '카카오 연결 끊기', '카카오와 잡도리의 연결만 끊어요. 기록은 탈퇴 전까지 남아요.'],
    ['withdraw', 'trash', '회원 탈퇴', '잡도리 기록을 지우고 카카오 연결도 함께 끊어요.'],
  ];
  const photo = real && (m.thumbnailUrl || m.profileImageUrl);
  const since = real && m.connectedAt ? `${fmtDateShort(ymd(m.connectedAt))} 연결` : '';
  const S = scaleOf(m), C = charOf(m);
  const html = `<section class="scr me" aria-labelledby="me-h">
    <header class="hdr"><div><h1 id="me-h" class="hdr-title">나</h1><p class="hdr-sub">계정과 잡도리 설정</p></div></header>
    <div class="paper">
      <div class="profile">
        <span class="avatar" aria-hidden="true">${esc(m.nickname.slice(0, 1))}${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
        <div><p class="pf-name">${esc(m.nickname)}</p><p class="pf-sub">${KAKAO_SYMBOL}카카오로 연결됨 · ${real ? `카카오 회원번호 ${esc(m.kakaoUserId || '')}` : `회원 번호 ${esc(m.id.slice(2, 8))}`}</p><p class="pf-sub">이메일 ${m.email ? esc(m.email) : '제공 안 함 (선택 항목)'}${since ? ` · ${since}` : ''}</p></div>
      </div>
      <h2 class="sec-label">${real ? '카카오에서 동의한 항목' : '동의한 항목'}</h2>
      <ul class="kv">${rows.map(([n, r, v]) => `<li><span>${esc(n)} <em>${esc(r)}</em></span><b class="${v ? 'yes' : 'no'}">${icon(v ? 'check' : 'x')}${v ? '동의' : '동의 안 함'}</b></li>`).join('')}</ul>
      ${real && !m.email ? `<button class="list-btn" data-act="askEmail">${icon('plus')}<span class="lb-text"><b>이메일 제공에 동의하기</b><small>카카오 동의 화면이 다시 열려요 (선택 항목)</small></span>${icon('chevron', 'muted')}</button>` : ''}
      ${real ? `<p class="fine dark">받은 정보는 이 폰 안에만 저장하고 서버로 보내지 않아요. 동의 철회는 아래 '카카오 연결 끊기'나 카카오 계정 설정의 연결된 서비스 관리에서 할 수 있어요.</p>` : ''}
      <h2 class="sec-label">${S.title}</h2>
      <ul class="kv">
        <li><span>처음 ${S.short}</span><b>${lv(m.initialHeat)}</b></li>
        <li><span>실패 가산</span><b>${m.penalty ? extraText(m.penalty, m) : '없음'}</b></li>
        <li><span>${S.floor} <em>새 잡도리 일정은 여기부터</em></span><b>${lv(floorOf(m))}</b></li>
      </ul>
      <button class="list-btn" data-act="openFloorInfo">${icon('info')}<span>${josa(S.floor, '은/는')} 어떻게 정해지나요?</span>${icon('chevron', 'muted')}</button>
      <h2 class="sec-label">${C.name}</h2>
      <button class="list-btn closet-row" data-act="openCloset"><span class="closet-thumb">${mascot(m, { expr: 'happy', motion: 'none', shadow: false })}</span><span class="lb-text"><b>옷장 · ${(C.costumes()[m.costume] || C.costumes().basic).name}</b><small>${C.name}의 모습을 바꿔요. 표정과 반응은 그대로예요</small></span>${icon('chevron', 'muted')}</button>
      ${scaleModeBlock(m)}
      ${voiceSection()}
      ${NATIVE.on ? notifRow() : `<h2 class="sec-label">앱 설치</h2>
      ${installRow()}`}
      <h2 class="sec-label">화면</h2>
      <div class="list-btn as-row"><span class="lb-text"><b>움직임 줄이기</b><small>${C.name} 숨쉬기·흔들림 같은 반복 애니메이션을 멈춰요</small></span>
        <button class="switch ${state.reduceMotion ? 'on' : ''}" role="switch" aria-checked="${state.reduceMotion}" aria-label="움직임 줄이기" data-act="reduceMotion"><i></i></button></div>
      <button class="list-btn" data-act="replayOnboarding">${icon('eye')}<span>${C.name} 소개 다시 보기</span>${icon('chevron', 'muted')}</button>
      ${NATIVE.on ? `<div class="list-btn as-row"><span class="lb-text"><b>발표용 시연 도구 보이기</b><small>오른쪽 가장자리에 '시연' 탭을 띄워 시간을 바꾸거나 딴짓을 흉내 내요</small></span>
        <button class="switch ${state.showDemo ? 'on' : ''}" role="switch" aria-checked="${!!state.showDemo}" aria-label="발표용 시연 도구 보이기" data-act="demoToggle"><i></i></button></div>` : ''}
      <h2 class="sec-label">계정</h2>
      <ul class="acct">${acct.map(([a, ic, t, d]) => `<li><button class="list-btn ${a === 'withdraw' ? 'danger' : ''}" data-act="acct" data-v="${a}">${icon(ic)}<span class="lb-text"><b>${t}</b><small>${d}</small></span>${icon('chevron', 'muted')}</button></li>`).join('')}</ul>
      <p class="fine dark">${NATIVE.on ? '잡도리 안드로이드 앱 · 데이터는 이 폰 안에만 저장돼요. 앱을 지우면 함께 지워져요.' : `잡도리 프로토타입 · 데이터는 이 브라우저(LocalStorage)에만 저장돼요${storageOK ? '' : ' — 지금은 저장소를 쓸 수 없어 새로고침하면 사라져요'}.`}</p>
    </div>
  </section>`;
  return { id: 'me', html };
}

/* ---------- 탭 바 ---------- */
function viewTabbar() {
  const tabs = [['today', '오늘', 'today'], ['calendar', '달력', 'calendar'], ['records', '기록', 'record'], ['me', '나', 'me']];
  return `<nav class="tabbar" aria-label="주요 메뉴">${tabs.map(([id, l, ic]) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></button>`).join('')}</nav>`;
}
