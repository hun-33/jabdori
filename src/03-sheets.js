/* =========================================================
   03-sheets: 시트·팝업·결과·일정 등록 폼
   ========================================================= */

function sheetWrap(inner, { full = false, label = 'sheet-title', cls = '' } = {}) {
  return `<div class="scrim" data-act="sheetScrim"></div>
  <div class="sheet ${full ? 'full' : ''} ${cls}" role="dialog" aria-modal="true" aria-labelledby="${label}"><span class="grab" aria-hidden="true"></span>${inner}</div>`;
}
function sheetHead(title, closeAct = 'closeSheet', sub = '') {
  return `<div class="sheet-head"><div><h2 id="sheet-title" class="sheet-title">${title}</h2>${sub ? `<p class="sheet-sub">${sub}</p>` : ''}</div>
    <button class="icon-btn" data-act="${closeAct}" aria-label="닫기">${icon('close')}</button></div>`;
}

/* ---------- 카카오 동의 (시뮬레이션) ---------- */
function viewConsent(s) {
  const c = s.consent;
  const items = [['terms', '서비스 이용약관', true], ['privacy', '개인정보 수집·이용', true], ['profile', '프로필 사진', false]];
  const all = items.every(([k]) => c[k]);
  const reqOK = c.terms && c.privacy;
  return sheetWrap(`${sheetHead('카카오 동의 단계', 'consentCancel', '시뮬레이션 · 실제 서비스에서는 카카오가 띄우는 화면이에요')}
    <div class="sheet-body">
      <p class="consent-lead">잡도리가 카카오에 아래 정보를 요청해요. 닉네임과 고유 번호는 기본으로 받아요.</p>
      <button class="cbox all ${all ? 'on' : ''}" role="checkbox" aria-checked="${all}" data-act="consentAll">${icon('check')}<span>전체 동의</span></button>
      <ul class="cbox-list">${items.map(([k, n, req]) => `<li><button class="cbox ${c[k] ? 'on' : ''}" role="checkbox" aria-checked="${!!c[k]}" data-act="consentToggle" data-k="${k}">${icon('check')}<span><em class="${req ? 'tg-req' : 'tg-opt'}">${req ? '필수' : '선택'}</em>${n}</span></button></li>`).join('')}</ul>
      ${!reqOK ? `<p class="field-err" role="alert">${icon('alert')}필수 항목 두 개에 동의해야 계속할 수 있어요.</p>` : `<p class="hint">프로필 사진 없이도 잡도리는 그대로 쓸 수 있어요.</p>`}
    </div>
    <div class="sheet-foot col">
      <button class="btn primary block" data-act="consentAgree" ${reqOK ? '' : 'disabled aria-disabled="true"'}>동의하고 계속하기</button>
      <button class="btn ghost block" data-act="consentDecline">동의하지 않고 나가기</button>
    </div>`);
}
function viewKakaoAccount() {
  return sheetWrap(`${sheetHead('카카오계정으로 로그인', 'acctCancel', '시뮬레이션 · 카카오톡을 쓸 수 없을 때의 대체 경로')}
    <div class="sheet-body">
      <div class="flow">
        <p><span class="flow-n">1</span>카카오톡 로그인 사용 가능 여부 확인 <b class="bad">${icon('x')}불가</b></p>
        <p><span class="flow-n">2</span>카카오계정 로그인으로 전환 <b class="ok">${icon('check')}전환됨</b></p>
        <p><span class="flow-n">3</span>브라우저에서 카카오계정 확인 <b>대기 중</b></p>
      </div>
      <p class="hint">실제 앱에서는 카카오 로그인 웹 페이지가 열리고, 사용자가 그 페이지에서 직접 확인해요. 이 프로토타입은 아이디·비밀번호를 받지 않아요.</p>
    </div>
    <div class="sheet-foot col">
      <button class="btn primary block" data-act="acctContinue">확인을 마친 것으로 진행</button>
      <button class="btn ghost block" data-act="acctCancel">취소</button>
    </div>`);
}

/* ---------- 일정 상세 ---------- */
function viewTaskSheet(m, key) {
  const [tid, d] = splitKey(key);
  const task = findTask(m, tid);
  if (!task) return '';
  const st = occState(m, task, d);
  const jab = task.type === 'jab';
  const h = jab ? heatOf(st).total : null;
  const run = st.run;
  const facts = [
    ['날짜', spanDays(task) ? `${fmtDateShort(d)} – ${fmtDateShort(addDays(d, spanDays(task)))}` : fmtDateLong(d)],
    ['시간', task.allDay ? '종일' : `${timeRange(task)} (${fmtDur(durOf(task))})`],
    ['반복', repeatText(task)],
    ...(task.memo ? [['메모', esc(task.memo)]] : []),
  ];
  if (jab) {
    facts.push(['마감', st.w.deadline ? `${fmtDateShort(ymd(st.w.deadline))} ${fmtHM(st.w.deadline)}` : '마감 없음']);
    facts.push(['시작 ' + scaleOf().short, `${lv(task.heat)} · ${stageOf(task.heat).name}`]);
  }
  let primary = '';
  const td = today();
  if (jab) {
    if (st.kind === 'done' || st.kind === 'failed') primary = `<button class="btn primary block" data-act="openRecord" data-key="${key}">결과 다시 보기</button>`;
    else if (ACTIVE_KINDS.includes(st.kind) || st.kind === 'missedStart') primary = `<button class="btn primary block" data-act="openFocus" data-key="${key}">${st.kind === 'missedStart' || st.kind === 'overdue' ? '결과 입력하기' : '집중 모드로 보기'}</button>`;
    else if (d === td) primary = `<button class="btn primary block" data-act="startOcc" data-key="${key}">${icon('play')}${st.kind === 'upcoming' ? '미리 시작하기' : '시작하기'}</button>`;
    else if (d > td) primary = `<p class="hint center">${fmtDateShort(d)} 당일에 시작할 수 있어요.</p>`;
    else primary = `<p class="hint center">지난 회차예요. 기록이 없으면 날이 바뀔 때 실패로 정리돼요.</p>`;
  } else {
    primary = `<button class="btn ${st.kind === 'done' ? 'secondary' : 'primary'} block" data-act="normalToggle" data-key="${key}">${icon('check')}${st.kind === 'done' ? '완료 취소' : '완료로 표시'}</button>`;
  }
  return sheetWrap(`${sheetHead(esc(task.title), 'closeSheet', jab ? `${josa(persona().name, '이/가')} 맡은 잡도리 일정` : '적어 둔 일반 일정')}
    <div class="sheet-body">
      <p class="state-line"><span class="state-chip light k-${st.kind}">${KIND_LABEL[st.kind]}</span>${jab && st.kind !== 'done' && st.kind !== 'failed' ? `<span>지금 ${scaleOf().short} <b>${lv(h)}</b></span>` : ''}${run && run.status !== 'running' && run.endHeat != null ? `<span>최고 ${lvs(run.peak || run.endHeat)}</span>` : ''}</p>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </div>
    <div class="sheet-foot col">
      ${primary}
      <div class="two"><button class="btn secondary" data-act="editTask" data-id="${task.id}">${icon('edit')}고치기</button><button class="btn danger-outline" data-act="deleteTask" data-id="${task.id}">${icon('trash')}지우기</button></div>
    </div>`);
}

/* ---------- 확인 시트 (공용) ---------- */
function viewConfirm(s) {
  return sheetWrap(`${sheetHead(s.title, 'closeSheet')}
    <div class="sheet-body"><p class="confirm-body">${s.body}</p>${s.extra || ''}</div>
    <div class="sheet-foot col">
      <button class="btn ${s.danger ? 'danger' : 'primary'} block" data-act="${s.okAct}" ${s.okData || ''}>${s.okLabel}</button>
      <button class="btn ghost block" data-act="${s.cancelAct || 'closeSheet'}">${s.cancelLabel || '취소'}</button>
    </div>`);
}

/* ---------- 핑계 노트 ---------- */
function viewExcuse(s) {
  return sheetWrap(`${sheetHead('핑계 한 줄만 남겨 줘', 'excuseSkip', '실패 기록에 같이 남아요. 건너뛰어도 돼요')}
    <div class="sheet-body"><div class="opt-list">${Object.entries(EXCUSES).map(([k, v]) => `<button class="opt" data-act="excuse" data-v="${k}">${esc(v)}${icon('chevron', 'muted')}</button>`).join('')}</div></div>`);
}

/* ---------- 최저 시작값 안내 (미루먼지: 쌓인 먼지) ---------- */
function viewFloorInfo(m) {
  const P = HEAT_POLICY, S = scaleOf(m), f = floorOf(m);
  return sheetWrap(`${sheetHead(S.floor, 'closeSheet', '실패하면 다음 잡도리가 더 세게 시작해요')}
    <div class="sheet-body prose">
      <p class="formula">지금 ${S.floor} <b>${lv(f)}</b> = ${S.base} ${lv(m.initialHeat)} + ${m.penalty ? extraText(m.penalty, m) : `${S.extra} 없음`}</p>
      <p>새로 올리는 잡도리 일정은 <b>${lvs(f)}</b>부터 시작해요.</p>
      <ul class="dash">
        <li>잡도리 일정을 실패하면 ${S.extra} 한 ${S.extraUnit}(+${P.failStep})${jo(S.extraUnit, '이/가')} 더해져 ${josa(S.floor, '이/가')} ${P.failStep} 올라가요. 최대 ${lv(P.floorMax)}.</li>
        <li>새로 올리는 잡도리 일정은 ${S.floor}에서 시작하고, 가산이 있는 동안은 그 아래로 내릴 수 없어요.</li>
        <li>이미 올려 둔 일정과 일반 일정은 바뀌지 않아요.</li>
        <li>잡도리 일정을 ${P.coolStreak}번 연속으로 끝내면 ${josa(S.clear, '으로/로')} 가산이 한 ${S.extraUnit} 풀려요. ${S.base} 아래로는 내려가지 않아요.</li>
        <li>마감이 지나고 결과를 안 남긴 채 날이 바뀌면 실패로 기록돼요.</li>
      </ul>
      <p class="hint">이 값들은 프로토타입용 예시 정책이에요.</p>
    </div>
    <div class="sheet-foot"><button class="btn primary block" data-act="closeSheet">알겠어요</button></div>`);
}

/* ---------- 기록 상세 ---------- */
function viewRecordSheet(m, key) {
  const run = m.runs[key];
  if (!run) return '';
  const [, d] = splitKey(key);
  const done = run.status === 'done';
  const dur = run.startedAt ? fmtDur((run.endedAt - run.startedAt) / MIN) : '시작 안 함';
  const S = scaleOf(m);
  const facts = [
    ['결과', done ? '완료' : '실패'], ['시작 ' + S.short, lv(run.startHeat)], ['최고 ' + S.short, lv(run.peak || run.endHeat)], ['걸린 시간', dur],
    ['딴짓', (run.slack ? run.slack.length : 0) + '회'], [S.floor, run.floorBefore === run.floorAfter ? `${lv(run.floorAfter)} 그대로` : `${lv(run.floorBefore)} → ${lv(run.floorAfter)}`],
  ];
  if (!done) facts.push(['핑계', run.excuse ? EXCUSES[run.excuse] : run.reason || '남기지 않음']);
  return sheetWrap(`${sheetHead(esc(run.title), 'closeSheet', fmtDateLong(d))}
    <div class="sheet-body">
      <div class="rec-head"><span class="stamp ${done ? 'ok' : 'bad'} sm still">${done ? '참 잘했어' : '넘쳤다'}</span><p class="rec-line">“${esc(run.line || '')}”</p></div>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <h3 class="sec-label">잡도리 로그</h3>
      <ol class="log">${(run.log || []).map((e) => `<li class="lg-${e.kind}"><time>${fmtHM(e.at)}</time><span>${esc(logText(e))}</span></li>`).join('') || '<li><span>남은 로그가 없어요.</span></li>'}</ol>
    </div>
    <div class="sheet-foot"><button class="btn secondary block" data-act="closeSheet">닫기</button></div>`);
}

/* ---------- 결과 화면 (FN05) ---------- */
function viewResult(m) {
  const r = ui.result;
  const run = m.runs[r.key];
  if (!run) return '';
  const done = run.status === 'done';
  const margin = run.plan && run.plan.deadline ? (run.plan.deadline - run.endedAt) / MIN : null;
  const facts = [
    ['걸린 시간', run.startedAt ? fmtDur((run.endedAt - run.startedAt) / MIN) : '시작 안 함'],
    ['최고 ' + scaleOf(m).short, lv(run.peak || run.endHeat, m)],
    ['딴짓', (run.slack ? run.slack.length : 0) + '회'],
    ['마감', margin == null ? '마감 없음' : Math.abs(margin) < 1 ? '마감 시각에' : margin > 0 ? `${fmtDur(margin)} 남기고` : `${fmtDur(-margin)} 지나서`],
  ];
  let floor = '';
  const S = scaleOf(m);
  if (done) {
    if (run.cooled) floor = `<div class="floor-change cool"><p class="fc-title">${icon('lock')}${S.clear} · ${S.floor} ${lv(run.floorBefore)} → ${lv(run.floorAfter)}</p>${floorBars(run.floorBefore, run.floorAfter)}</div>`;
    else {
      const need = HEAT_POLICY.coolStreak;
      floor = `<div class="floor-change"><p class="fc-title">연속 성공 ${m.streak}/${need}</p><div class="streak">${Array.from({ length: need }, (_, i) => `<i class="${i < m.streak ? 'on' : ''}"></i>`).join('')}</div>
        <p class="fc-note">${m.penalty ? `${need - m.streak}번 더 연속으로 끝내면 ${josa(S.clear, '으로/로')} ${josa(S.floor, '이/가')} 한 ${S.extraUnit} 내려가요.` : `${josa(S.extra, '이/가')} 없어요. 이대로만 가요.`}</p></div>`;
    }
  } else {
    const up = run.floorAfter - run.floorBefore;
    floor = `<div class="floor-change up"><p class="fc-title">${icon(S.icon)}${up > 0 ? `${S.extra} +${up} · ${S.floor} ${lv(run.floorBefore)} → ${lv(run.floorAfter)}` : `${S.floor} ${lv(run.floorAfter)} 그대로 (최대)`}</p>${floorBars(run.floorBefore, run.floorAfter)}
      <p class="fc-note">새로 올리는 잡도리 일정은 <b>${lvs(run.floorAfter)}</b>부터 시작해요. 일반 일정과 이미 올린 일정은 그대로예요.</p></div>`;
  }
  return `<div class="result ${done ? 'r-ok' : 'r-bad'}" role="dialog" aria-modal="true" aria-labelledby="res-title">
    <div class="res-scroll">
      <div class="res-top">
        <span class="stamp ${done ? 'ok' : 'bad'}" aria-hidden="true">${done ? '참 잘했어' : '넘쳤다'}</span>
        <div class="res-mascot">${resultMascot(m, run, done)}</div>
      </div>
      <h1 id="res-title" class="res-title">${esc(run.title)} ${done ? '완료' : '실패'}</h1>
      <p class="speech paper-speech">${esc(run.line)}</p>
      <dl class="res-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${floor}
      ${!done && run.excuse ? `<p class="hint">핑계: ${EXCUSES[run.excuse]} — ${persona().lines.excuse[run.excuse]}</p>` : ''}
    </div>
    <div class="res-actions"><button class="btn primary block" data-act="resultClose">오늘로 돌아가기</button><button class="btn ghost block" data-act="resultRecord">기록 탭에서 보기</button></div>
  </div>`;
}
function resultMascot(m, run, done) {
  if (!done) return mascot(m, { expr: 'sad', pose: 'cry', motion: 'cry', fluff: 0.15 });
  if (run.cooled) return mascot(m, { expr: 'proud', pose: 'flag', motion: 'jump' });
  return mascot(m, mascotFor('done', 1, { streak: m.streak, early: run.early }));
}
function floorBars(a, b) {
  const S = scaleOf();
  return `<div class="fbars" role="img" aria-label="${S.floor} ${lv(a)}에서 ${lv(b)}로">
    <div class="fbar"><span>전</span><div class="fb-track"><i style="width:${a}%;--hc:${heatVar(stageOf(a).id)}"></i></div><b>${lv(a)}</b></div>
    <div class="fbar now"><span>지금</span><div class="fb-track"><i style="width:${b}%;--hc:${heatVar(stageOf(b).id)}"></i></div><b>${lv(b)}</b></div></div>`;
}

/* ---------- 딴짓 팝업 (FN07, 시뮬레이션) ---------- */
function viewSlackPopup(m) {
  const p = ui.popup;
  const L = persona().lines;
  const st = p.key ? (() => { const [tid, d] = splitKey(p.key); const t = findTask(m, tid); return t ? occState(m, t, d) : null; })() : null;
  if (p.type === 'studyCheck') {
    return `<div class="pop-scrim"><div class="popup" role="alertdialog" aria-modal="true" aria-labelledby="pop-t">
      <div class="pop-src">${icon('clock')}<span>공부 중 확인 · 10분 지남</span></div>
      <div class="pop-persona">${mascot(m, p.answer ? (p.choice === 'back' ? { expr: 'happy', pose: 'cheer', motion: 'bounce' } : { expr: 'suspicious', pose: 'check', motion: 'check' }) : { expr: 'suspicious', pose: 'nag', motion: 'chase' })}<p id="pop-t" class="pop-line">${p.answer ? esc(p.answer) : L.studyCheck[0]}</p></div>
      ${p.answer ? '<div class="pop-choices"><button class="btn primary block" data-act="popupClose">이어서 하기</button></div>' : `<div class="pop-choices">
        <button class="opt" data-act="studyChoose" data-v="more"><span><b>응, 거의 다 봤어</b><small>10분 더 · 그다음엔 과제</small></span></button>
        <button class="opt" data-act="studyChoose" data-v="back"><span><b>이제 과제로 돌아갈게</b><small>바로 돌아가기</small></span></button></div>`}
    </div></div>`;
  }
  if (p.type === 'slackLate') {
    // 시작 시간이 지났는데 시작도 안 하고 딴짓 앱을 쓰는 중 (실제 감지)
    return `<div class="pop-scrim"><div class="popup" role="alertdialog" aria-modal="true" aria-labelledby="pop-t">
      <div class="pop-src">${icon('phone')}<span>다른 앱 사용 감지 · 아직 시작 전</span><b>${esc(p.app)}</b></div>
      <div class="pop-persona">${mascot(m, { expr: 'angry', pose: 'nag', motion: 'chase', fluff: 0.4 })}<p id="pop-t" class="pop-line">${esc(p.line)}</p></div>
      ${st ? `<p class="pop-result">${esc(st.task.title)} · 시작 시간 ${fmtHM(st.w.start)}</p>` : ''}
      <div class="pop-choices">
        <button class="btn primary block" data-act="slackLateStart" data-key="${p.key}">${icon('play')}지금 시작할게</button>
        <button class="btn ghost block" data-act="popupClose">알겠어</button></div>
    </div></div>`;
  }
  if (!st) {
    return `<div class="pop-scrim"><div class="popup" role="alertdialog" aria-modal="true" aria-labelledby="pop-t">
      <div class="pop-src">${icon('phone')}<span>${p.real ? '다른 앱 사용 감지' : '다른 앱 사용 감지 · 시뮬레이션'}</span><b>${esc(p.app)}</b></div>
      <div class="pop-persona">${mascot(m, p.brk ? { expr: 'sleepy', pose: 'curl', motion: 'sleep' } : { expr: 'default', pose: 'wave', motion: 'chase' })}<p id="pop-t" class="pop-line">${p.brk ? L.slackBreak[0] : L.slackIdle[0]}</p></div>
      <div class="pop-choices"><button class="btn primary block" data-act="popupClose">알겠어</button></div>
    </div></div>`;
  }
  const answered = !!p.answer;
  const mc = !answered ? { expr: 'surprised', pose: 'chase', motion: 'chase', fluff: 0.3 }
    : p.choice === 'focus' ? { expr: 'happy', pose: 'cheer', motion: 'bounce' } : p.choice === 'rest' ? { expr: 'sleepy', pose: 'curl', motion: 'sleep' } : { expr: 'suspicious', pose: 'check', motion: 'check' };
  const ask = fillLine(p.askTpl, { app: p.app, title: st.task.title });
  return `<div class="pop-scrim"><div class="popup" role="alertdialog" aria-modal="true" aria-labelledby="pop-t">
    <div class="pop-src">${icon('phone')}<span>${p.real ? '다른 앱 사용 감지' : '다른 앱 사용 감지 · 시뮬레이션'}</span><b>${esc(p.app)}</b></div>
    <div class="pop-persona">${mascot(m, mc)}<p id="pop-t" class="pop-line">${esc(answered ? p.answer : ask)}</p></div>
    ${answered ? `<p class="pop-result">${{ study: '공부 중으로 기록했어요. 10분 뒤 다시 확인해요.', rest: `${HEAT_POLICY.breakMinutes}분 휴식을 시작했어요.`, focus: '다시 집중으로 기록했어요. 딴짓 가산이 조금 붙었어요.' }[p.choice]}</p>
      <div class="pop-choices"><button class="btn primary block" data-act="popupClose">${p.choice === 'rest' ? '쉬러 가기' : '이어서 하기'}</button></div>`
    : `<div class="pop-choices">
      <button class="opt" data-act="slackChoose" data-v="study"><span><b>공부 중이야</b><small>강의·자료 영상이면 봐줘요 · 10분 뒤 다시 확인</small></span></button>
      <button class="opt" data-act="slackChoose" data-v="rest"><span><b>잠깐 쉴게</b><small>${HEAT_POLICY.breakMinutes}분 휴식 · 넘기면 ${josa(scaleOf().short, '이/가')} 올라가요</small></span></button>
      <button class="opt" data-act="slackChoose" data-v="focus"><span><b>다시 집중할게</b><small>바로 돌아가기 · 딴짓 가산 조금</small></span></button></div>`}
  </div></div>`;
}

/* ---------- 일정 등록·수정 폼 (FN02) — 기획안 v5 '상단 추가 화면' ---------- */
// 순서: 종류 → 이름 → 반복 주기(주/일) → 날짜 → 수행 시간(스크롤) → 잡도리 강도 → 데드라인(최하단)
/* ---------- 일정 입력 초안 ----------
   한 폼으로 빠른 등록(제목·종류·시작·종료)과 상세 설정(반복·알림·색상·메모·강도·마감)을 같이 다룬다.
   f.more = 상세 설정 펼침, f.pick = 지금 열린 날짜·시간 선택기('start' | 'end' | 'dl' | null) */
const COLORS = [['coral', '산호'], ['sun', '노랑'], ['mint', '민트'], ['sky', '하늘'], ['lilac', '라일락'], ['stone', '회색']];
const ALARMS = [[0, '정각'], [5, '5분 전'], [10, '10분 전'], [30, '30분 전'], [60, '1시간 전'], [1440, '하루 전']];
function newDraft(m, date, type = 'jab', range) {
  const f = floorOf(m);
  const d = date && date >= today() ? date : today();
  const r = range || {};
  return {
    id: null, type, title: '', date: d, start: r.start || '18:00', endDate: r.endDate || d, end: r.end || '20:00', allDay: false,
    repeatKind: 'none', days: [weekday(d)], every: 1,
    heat: f, minHeat: sliderMinFor(m), jabOn: true,
    dlMode: 'off', dlDate: d, dlTime: '20:00',
    alarms: [], color: type === 'jab' ? 'coral' : 'sky', memo: '',
    more: false, pick: 'start', calMonth: d.slice(0, 7), errors: {},
  };
}
function draftFromTask(m, t) {
  const kind = t.repeat.kind === 'interval' ? 'daily' : t.repeat.kind;
  const dl = t.deadline && t.deadline.enabled ? (t.deadline.sameAsEnd ? 'end' : 'custom') : 'off';
  return {
    id: t.id, type: t.type, title: t.title, date: t.date, origDate: t.date,
    start: t.start, endDate: t.endDate || t.date, end: t.end || minToHm(hmToMin(t.start) + durOf(t)), allDay: !!t.allDay,
    repeatKind: kind, days: t.repeat.days ? [...t.repeat.days] : [weekday(t.date)], every: t.repeat.every || 1,
    heat: t.heat ?? floorOf(m), minHeat: sliderMinFor(m, t.type === 'jab' ? t : null), jabOn: t.jabOn !== false,
    dlMode: dl, dlDate: t.deadline ? t.deadline.date : t.date, dlTime: t.deadline ? t.deadline.time : '20:00',
    alarms: [...(t.alarms || [])], color: t.color || (t.type === 'jab' ? 'coral' : 'sky'), memo: t.memo || '',
    more: true, pick: null, calMonth: t.date.slice(0, 7), errors: {},
  };
}
/* 초안의 시작·종료 시각(ms)과 걸리는 시간(분) */
function draftStartMs(f) { return at(f.date, f.allDay ? '00:00' : f.start); }
function draftEndMs(f) { return f.allDay ? at(addDays(f.endDate, 1), '00:00') : at(f.endDate, f.end); }
function draftDuration(f) { return Math.round((draftEndMs(f) - draftStartMs(f)) / MIN); }
function draftSummary(f) {
  const days = daysBetween(f.date, f.endDate) + 1;
  if (f.allDay) return days > 1 ? `종일 · ${days}일 동안` : '종일';
  const d = draftDuration(f);
  if (d <= 0) return '종료가 시작보다 앞이에요';
  return days > 1 ? `${fmtDur(d)} · ${days}일에 걸친 일정` : fmtDur(d);
}
/* 마감: 'off' 없음 | 'end' 종료 일시가 곧 마감 | 'custom' 따로 정함 */
function draftDeadlineMs(f) { return f.dlMode === 'end' ? draftEndMs(f) : f.dlMode === 'custom' ? at(f.dlDate, f.dlTime) : null; }
function draftDeadlineHint(f) {
  if (f.type !== 'jab') return '';
  if (f.dlMode === 'off') return '마감이 없으면 종료 시각까지 천천히 부풀어요.';
  const start = draftStartMs(f), dl = draftDeadlineMs(f);
  if (dl <= start) return '';
  let s = f.dlMode === 'end' ? `종료 시각(${fmtHM(dl)})이 마감이에요.` : `시작하고 ${fmtDur((dl - start) / MIN)} 뒤가 마감이에요.`;
  if (f.repeatKind !== 'none') s += ' 반복 회차마다 같은 간격으로 적용돼요.';
  return s;
}
/* 화면에 보일 날짜·시간 문구 */
function whenText(dateStr, hm, allDay) { return allDay ? fmtDateShort(dateStr) : `${fmtDateShort(dateStr)} ${hm}`; }
function heatPreview(h) {
  const s = stageOf(h);
  return `<div class="hp-mascot">${mascot(member(), { ...mascotForStage(s.id), label: `${persona().name} ${s.name} 단계` })}</div>
    <div class="hp-text"><p class="hp-deg">${degHTML(h, null, 'md')}${stageChip(h, true)}</p><p class="hp-desc">${s.desc}</p><p class="hp-sample">“${persona().lines.sample[s.id]}”${TTS.ok() ? `<button class="say-mini" data-act="speakSample" data-s="${s.id}" aria-label="${s.name} 단계 목소리 들어 보기">${icon('speaker')}</button>` : ''}</p></div>`;
}
function fieldErr(f, k) { return f.errors[k] ? `<p class="field-err" id="err-${k}" role="alert">${icon('alert')}${f.errors[k]}</p>` : ''; }

/* ---------- 스크롤 휠 선택기 (기획안 v5: 스크롤 방식으로 시간 선택) ---------- */
const WHEEL_H = 44;
function wheelCol(id, items, value, label, unit = '') {
  const idx = Math.max(0, items.findIndex((it) => String(it.v) === String(value)));
  const cur = items[idx] || items[0];
  return `<div class="wheel-col">
    <div class="wheel" data-wheel="${id}" role="spinbutton" tabindex="0" aria-label="${esc(label)}" aria-valuetext="${esc(cur.t + unit)}" data-idx="${idx}">
      <div class="wheel-pad"></div>${items.map((it, i) => `<div class="wheel-item ${i === idx ? 'sel' : ''}" data-v="${it.v}">${it.t}</div>`).join('')}<div class="wheel-pad"></div>
    </div>${unit ? `<span class="wheel-unit" aria-hidden="true">${unit}</span>` : ''}</div>`;
}
const HOURS = Array.from({ length: 24 }, (_, h) => ({ v: pad(h), t: pad(h) }));
const MINS = Array.from({ length: 12 }, (_, i) => ({ v: pad(i * 5), t: pad(i * 5) }));
function dateItems(from, n, todayStr) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(from, i);
    return { v: d, t: `${d === todayStr ? '오늘 · ' : ''}${fmtDateShort(d)}` };
  });
}
function roundMin(hm) { const [h, m] = hm.split(':').map(Number); const r = Math.min(55, Math.round(m / 5) * 5); return [pad(h), pad(r)]; }
// 분 선택기: 5분 단위 목록에, 직접 입력한 분(예: 37분)이 있으면 그 자리에 끼워 넣는다
function minsWith(mm) { return MINS.some((x) => x.v === mm) ? MINS : [...MINS, { v: mm, t: mm }].sort((a, b) => a.v.localeCompare(b.v)); }
function splitHM(hm) { const [h, m] = (hm || '00:00').split(':'); return [pad(+h), pad(+m)]; }
function timeWheels(prefix, hm, label) {
  const [h, mm] = splitHM(hm);
  return `<div class="wheels" role="group" aria-label="${label}">${wheelCol(prefix + '-h', HOURS, h, label + ' 시', '시')}${wheelCol(prefix + '-m', minsWith(mm), mm, label + ' 분', '분')}</div>`;
}
// 라벨 줄 오른쪽 '직접 입력' 버튼
function subLabel(text, target) {
  return `<div class="sub-row"><p class="sub-label">${text}</p><button class="in-link" data-act="wheelInput" data-target="${target}" aria-label="${text} 직접 입력">${icon('edit')}직접 입력</button></div>`;
}
/* 시작·종료·마감 한 줄: 누르면 그 아래에 날짜·시간 선택기가 열린다 */
function whenRow(f, key, label, dateStr, hm) {
  const open = f.pick === key;
  return `<button class="when-row ${open ? 'open' : ''}" data-act="formPick" data-v="${key}" aria-expanded="${open}"><span class="wr-label">${label}</span><span class="wr-date">${fmtDateShort(dateStr)}</span>${f.allDay && key !== 'dl' ? '' : `<span class="wr-time">${hm}</span>`}</button>`;
}
function pickerFor(f, key) {
  if (f.pick !== key) return '';
  const td = today();
  if (key === 'start') {
    const from = f.id && f.date < td ? f.date : td;
    return `<div class="picker"><div class="sub-row"><p class="sub-label">시작 날짜·시각</p><span class="in-links"><button class="in-link" data-act="wheelInput" data-target="date" aria-label="시작 날짜 직접 입력">${icon('edit')}날짜</button>${f.allDay ? '' : `<button class="in-link" data-act="wheelInput" data-target="start" aria-label="시작 시각 직접 입력">${icon('edit')}시각</button>`}</span></div><div class="wheels ${f.allDay ? 'one' : 'dl'}" role="group" aria-label="시작 날짜와 시각">${wheelCol('date', dateItems(from, Math.max(366, daysBetween(from, f.date) + 30), td), f.date, '시작 날짜')}${f.allDay ? '' : wheelCol('start-h', HOURS, splitHM(f.start)[0], '시작 시', '시') + wheelCol('start-m', minsWith(splitHM(f.start)[1]), splitHM(f.start)[1], '시작 분', '분')}</div></div>`;
  }
  if (key === 'end') {
    return `<div class="picker">${f.allDay ? '<p class="sub-label">종료 날짜</p>' : subLabel('종료 날짜·시각', 'end')}<div class="wheels ${f.allDay ? 'one' : 'dl'}" role="group" aria-label="종료 날짜와 시각">${wheelCol('end-date', dateItems(f.date, Math.max(32, daysBetween(f.date, f.endDate) + 15), td), f.endDate, '종료 날짜')}${f.allDay ? '' : wheelCol('end-h', HOURS, splitHM(f.end)[0], '종료 시', '시') + wheelCol('end-m', minsWith(splitHM(f.end)[1]), splitHM(f.end)[1], '종료 분', '분')}</div>
      <div class="chips quick-dur" role="group" aria-label="걸리는 시간으로 종료 정하기">${[[30, '30분'], [60, '1시간'], [120, '2시간'], [180, '3시간']].map(([v, l]) => `<button class="chip" data-act="formDur" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  }
  return `<div class="picker">${subLabel('마감 날짜·시각', 'dl')}<div class="wheels dl" role="group" aria-label="마감 날짜와 시각">${wheelCol('dl-date', dateItems(f.date, f.repeatKind !== 'none' ? 7 : Math.max(61, daysBetween(f.date, f.dlDate) + 15), td), f.dlDate, '마감 날짜')}${wheelCol('dl-h', HOURS, splitHM(f.dlTime)[0], '마감 시', '시')}${wheelCol('dl-m', minsWith(splitHM(f.dlTime)[1]), splitHM(f.dlTime)[1], '마감 분', '분')}</div></div>`;
}
/* ---------- 시작 → 종료 한 줄 + 폼 안 달력 (삼성 캘린더 방식) ----------
   f.pick: 'start' | 'end' → 아래 달력이 그쪽 날짜를 정함 / 'start-time' | 'end-time' → 시각 선택기 / 'dl' 마감
   f.calMonth: 폼 달력에 보이는 달 'YYYY-MM' */
function formCalHTML(f) {
  const td = today();
  const month = f.calMonth || (f.pick === 'end' ? f.endDate : f.date).slice(0, 7);
  const [y, mo] = month.split('-').map(Number);
  const first = `${y}-${pad(mo)}-01`, start = weekStartOf(first);
  const cellsN = Math.ceil((daysBetween(start, first) + new Date(y, mo, 0).getDate()) / 7) * 7;
  const minDate = f.id ? (f.origDate && f.origDate < td ? f.origDate : td) : td;
  let cells = '';
  for (let i = 0; i < cellsN; i++) {
    const d = addDays(start, i);
    const cls = [d.slice(0, 7) !== month ? 'out' : '', d === td ? 'today' : '', `wd${i % 7}`,
      d === f.date ? 'a' : '', d === f.endDate ? 'b' : '', d > f.date && d < f.endDate ? 'in' : '', f.date !== f.endDate && d === f.date ? 'ra' : '', f.date !== f.endDate && d === f.endDate ? 'rb' : ''].filter(Boolean).join(' ');
    const off = d < minDate;
    cells += `<button class="fcal-cell ${cls}" data-act="formCalPick" data-date="${d}" ${off ? 'disabled' : ''} aria-label="${fmtDateLong(d)}${d === f.date ? ', 시작' : ''}${d === f.endDate ? ', 종료' : ''}"><span>${parseYmd(d).getDate()}</span></button>`;
  }
  return `<div class="fcal" data-swipe="fcal">
    <div class="fcal-nav"><button class="icon-btn" data-act="formCalNav" data-delta="-1" aria-label="이전 달">${icon('prev')}</button><b>${y}년 ${mo}월</b><button class="icon-btn" data-act="formCalNav" data-delta="1" aria-label="다음 달">${icon('next')}</button>
      ${f.pick === 'start' ? `<button class="in-link" data-act="wheelInput" data-target="date" aria-label="시작 날짜 직접 입력">${icon('edit')}입력</button>` : ''}</div>
    <p class="fcal-tip">${f.pick === 'start' ? '시작 날짜를 누르세요' : '끝나는 날짜를 누르세요'}</p>
    <div class="fcal-head" aria-hidden="true">${WEEK_ORDER.map((w, i) => `<span class="wd${i}">${WD[w]}</span>`).join('')}</div>
    <div class="fcal-grid">${cells}</div></div>`;
}
function whenBlock(f) {
  const side = (k, label, d, hm) => `<div class="wb-side"><span class="wb-label">${label}</span>
      <button class="wb-date ${f.pick === k ? 'on' : ''}" data-act="formPick" data-v="${k}" aria-pressed="${f.pick === k}">${fmtDateShort(d)}</button>
      ${f.allDay ? '<span class="wb-time muted">종일</span>' : `<button class="wb-time ${f.pick === k + '-time' ? 'on' : ''}" data-act="formPick" data-v="${k}-time" aria-pressed="${f.pick === k + '-time'}">${hm}</button>`}</div>`;
  let below = '';
  if (f.pick === 'start' || f.pick === 'end') below = formCalHTML(f);
  else if (f.pick === 'start-time') below = `<div class="picker">${subLabel('시작 시각', 'start')}${timeWheels('start', f.start, '시작')}</div>`;
  else if (f.pick === 'end-time') below = `<div class="picker">${subLabel('종료 시각', 'end')}${timeWheels('end', f.end, '종료')}
      <div class="chips quick-dur" role="group" aria-label="걸리는 시간으로 종료 정하기">${[[30, '30분'], [60, '1시간'], [120, '2시간'], [180, '3시간']].map(([v, l]) => `<button class="chip" data-act="formDur" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return `<div class="wb-row">${side('start', '시작', f.date, f.start)}<span class="wb-arrow" aria-hidden="true">→</span>${side('end', '종료', f.endDate, f.end)}</div>${below}`;
}
function viewForm(m) {
  const f = ui.form;
  const jab = f.type === 'jab';
  const td = today();
  const minH = f.minHeat;
  const floor = floorOf(m);
  const S = scaleOf(m);
  const P = persona();
  const rk = [['none', '안 함'], ['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년']];
  const unit = { daily: '일', weekly: '주', monthly: '달', yearly: '년' }[f.repeatKind];
  const repeatSub = f.repeatKind === 'none' ? '' : `
        <div class="stepper" role="group" aria-label="반복 간격"><button class="icon-btn" data-act="formEvery" data-delta="-1" aria-label="간격 줄이기" ${f.every <= 1 ? 'disabled' : ''}>−</button><b aria-live="polite">${f.every === 1 ? rk.find((x) => x[0] === f.repeatKind)[1] : f.every + unit + '마다'}</b><button class="icon-btn" data-act="formEvery" data-delta="1" aria-label="간격 늘리기" ${f.every >= 30 ? 'disabled' : ''}>+</button></div>
        ${f.repeatKind === 'weekly' ? `<p class="sub-label">반복할 요일</p><div class="days" role="group" aria-label="반복할 요일">${WEEK_ORDER.map((d) => `<button class="day ${f.days.includes(d) ? 'on' : ''}" aria-pressed="${f.days.includes(d)}" data-act="formDay" data-d="${d}">${WD[d]}</button>`).join('')}</div>${fieldErr(f, 'days')}` : ''}
        <p class="hint" id="rep-hint">${fmtMD(f.date)}부터 ${repeatText({ date: f.date, repeat: { kind: f.repeatKind, every: f.every, days: f.days } })} 반복해요.</p>`;
  const heatSec = jab ? `
      <section class="f-sec" aria-labelledby="lb-heat" id="sec-heat">
        <div class="f-row-head"><h3 id="lb-heat" class="f-label">${S.title}</h3><span class="f-aside">${m.penalty ? `${icon('lock')}${S.floor} ${lv(floor)}` : `기본 ${lv(floor)}`}</span></div>
        <div class="heat-pick">
          <div class="heat-preview" id="heat-preview">${heatPreview(f.heat)}</div>
          <div class="slider-wrap" style="--min:${minH}">
            <div class="slider-track" aria-hidden="true">${S.stages.map((s, i, a) => `<i style="--hc:${heatVar(s.id)};left:${s.min}%;width:${(a[i + 1] ? a[i + 1].min : 100) - s.min}%"></i>`).join('')}<b class="slider-lock" style="width:${minH}%"></b></div>
            <input type="range" id="f-heat" class="slider" min="0" max="100" step="5" value="${f.heat}" data-field="heat" aria-label="잡도리 시작 ${S.short} (${S.title})" aria-valuetext="${lvs(f.heat)}, ${stageOf(f.heat).name}">
            <div class="slider-scale" aria-hidden="true">${S.stages.map((s) => `<span style="left:${s.min}%">${s.name}</span>`).join('')}</div>
          </div>
        </div>
        ${m.penalty && !f.id ? `<p class="compare">${icon(S.icon)}<span>지난 실패로 ${josa(S.floor, '이/가')} <b>${lv(m.initialHeat)} → ${lv(floor)}</b>${jo(lv(floor), '으로/로')} 올랐어요. 이 일정은 ${lvs(floor)} 아래로 못 내려요.</span></p>` : `<p class="hint">${minH > HEAT_POLICY.sliderMin ? `${lvs(minH)} 아래로는 내릴 수 없어요.` : `${lvs(HEAT_POLICY.sliderMin)}부터 고를 수 있어요. 실패하면 다음 일정부터 ${josa(S.floor, '이/가')} 올라가요.`}</p>`}
      </section>
      <section class="f-sec" aria-labelledby="lb-dl">
        <h3 id="lb-dl" class="f-label">마감</h3>
        <div class="seg wide three" role="radiogroup" aria-labelledby="lb-dl">
          ${[['off', '마감 없음'], ['end', '종료 = 마감'], ['custom', '따로 정하기']].map(([v, l]) => `<button role="radio" aria-checked="${f.dlMode === v}" class="${f.dlMode === v ? 'on' : ''}" data-act="formDl" data-v="${v}">${l}</button>`).join('')}
        </div>
        ${f.dlMode === 'custom' ? whenRow(f, 'dl', '마감', f.dlDate, f.dlTime) + pickerFor(f, 'dl') : ''}
        ${fieldErr(f, 'deadline')}
        <p class="hint" id="dl-hint">${draftDeadlineHint(f)}</p>
      </section>
      ${f.id ? `<section class="f-sec"><div class="f-row-head"><h3 class="f-label">잡도리 켜기</h3><button class="switch ${f.jabOn ? 'on' : ''}" role="switch" aria-checked="${f.jabOn}" aria-label="잡도리 켜기" data-act="formJabOn"><i></i></button></div><p class="hint">끄면 설정은 그대로 두고 일반 일정처럼 조용히 달력에만 남아요.</p></section>` : ''}` : '';
  const more = f.more ? `
      <section class="f-sec" aria-labelledby="lb-rep">
        <h3 id="lb-rep" class="f-label">반복</h3>
        <div class="chips" role="radiogroup" aria-labelledby="lb-rep">${rk.map(([v, l]) => `<button role="radio" aria-checked="${f.repeatKind === v}" class="chip ${f.repeatKind === v ? 'on' : ''}" data-act="formRepeat" data-v="${v}">${l}</button>`).join('')}</div>
        ${repeatSub}
      </section>
      <section class="f-sec" aria-labelledby="lb-alarm">
        <h3 id="lb-alarm" class="f-label">알림</h3>
        <div class="chips" role="group" aria-labelledby="lb-alarm">${ALARMS.map(([v, l]) => `<button class="chip ${f.alarms.includes(v) ? 'on' : ''}" aria-pressed="${f.alarms.includes(v)}" data-act="formAlarm" data-v="${v}">${l}</button>`).join('')}</div>
        <p class="hint">${f.alarms.length ? '시작 ' + [...f.alarms].sort((a, b) => b - a).map((v) => ALARMS.find((x) => x[0] === v)[1]).join(', ') + '에 알려요.' : '따로 알리지 않아요.'}${jab ? ' 잡도리 일정은 시작·마감 때 미루먼지가 따로 불러요.' : ''}</p>
      </section>
      <section class="f-sec" aria-labelledby="lb-color">
        <h3 id="lb-color" class="f-label">색상</h3>
        <div class="swatches" role="radiogroup" aria-labelledby="lb-color">${COLORS.map(([v, l]) => `<button role="radio" aria-checked="${f.color === v}" class="sw c-${v} ${f.color === v ? 'on' : ''}" data-act="formColor" data-v="${v}" aria-label="${l}">${f.color === v ? icon('check') : ''}</button>`).join('')}</div>
      </section>
      <section class="f-sec">
        <label for="f-memo" class="f-label">메모</label>
        <textarea id="f-memo" class="txt memo" data-field="memo" maxlength="200" rows="2" placeholder="필요한 것만 짧게">${esc(f.memo)}</textarea>
      </section>
      ${heatSec}` : '';
  return sheetWrap(`<div class="sheet-head"><div><h2 id="sheet-title" class="sheet-title">${f.id ? '일정 고치기' : '새 일정'}</h2></div></div>
    <div class="sheet-body form-body">
      ${f.id ? '' : `<section class="f-sec quick">
        <div class="f-row-head"><label for="f-quick" class="f-label">한 줄로 쓰기</label><span class="f-aside">선택</span></div>
        <div class="quick-row"><input id="f-quick" class="txt" data-field="quick" enterkeyhint="done" autocomplete="off" placeholder="예: 내일 3시 과제 2시간" value="${esc(f.quick || '')}"><button class="btn secondary sm" data-act="quickApply">채우기</button></div>
        <p class="hint" id="quick-hint" aria-live="polite">${esc(quickPreview(f, f.quick))}</p>
      </section>`}
      <section class="f-sec">
        <div class="f-row-head"><label for="f-title" class="f-label">제목</label><span class="f-aside" id="title-count">${f.title.length}/30</span></div>
        <input id="f-title" class="txt" data-field="title" maxlength="30" autocomplete="off" placeholder="예: 데이터베이스 과제" value="${esc(f.title)}" ${f.errors.title ? 'aria-invalid="true" aria-describedby="err-title"' : ''}>
        ${fieldErr(f, 'title')}
      </section>
      <section class="f-sec" aria-labelledby="lb-type">
        <h3 id="lb-type" class="f-label">종류</h3>
        <div class="seg wide" role="radiogroup" aria-labelledby="lb-type">
          <button role="radio" aria-checked="${jab}" class="${jab ? 'on' : ''}" data-act="formType" data-v="jab" ${f.id ? 'disabled' : ''}>${P.name} 잡도리</button>
          <button role="radio" aria-checked="${!jab}" class="${!jab ? 'on' : ''}" data-act="formType" data-v="normal" ${f.id ? 'disabled' : ''}>일반 일정</button>
        </div>
        <p class="hint">${f.id ? '종류는 올린 뒤에는 바꿀 수 없어요. 잡도리는 아래에서 끌 수 있어요.' : jab ? `시작부터 마감까지 ${P.name}${jo(P.name, '이/가')} 붙어서 잔소리해요.` : '달력에만 조용히 남아요.'}</p>
      </section>
      <section class="f-sec when" aria-labelledby="lb-time">
        <div class="f-row-head"><h3 id="lb-time" class="f-label">시간</h3>
          <span class="allday"><span>종일</span><button class="switch sm ${f.allDay ? 'on' : ''}" role="switch" aria-checked="${f.allDay}" aria-label="종일 일정" data-act="formAllDay"><i></i></button></span></div>
        ${f.allDay && f._autoNormal ? `<p class="hint note top" role="status">종일 일정은 시작 시각이 없어서 <b>일반 일정</b>으로 바꿨어요. ${P.name} 잡도리를 받으려면 종일을 끄세요.</p>` : ''}
        ${f.allDay && f._autoJabOff ? `<p class="hint note top" role="status">종일로 바꿔서 <b>잡도리를 껐어요</b>. 종일을 끄면 다시 켜져요.</p>` : ''}
        ${whenBlock(f)}
        <p class="summary" id="time-summary">${icon('clock')}<span>${draftSummary(f)}</span></p>
        ${fieldErr(f, 'date')}${fieldErr(f, 'time')}
        <p class="hint" id="start-hint">${jab ? (f.date === td && !f.allDay && at(f.date, f.start) < now() ? '시작 시각이 이미 지났어요. 올리면 바로 잡도리가 시작돼요.' : '') : ''}</p>
      </section>
      <button class="more-btn" data-act="formMore" aria-expanded="${f.more}">${f.more ? '상세 설정 접기' : `상세 설정 · 반복, 알림, 색상, 메모${jab ? `, ${S.short}, 마감` : ''}`}${icon(f.more ? 'prev' : 'next')}</button>
      ${more}
    </div>
    <div class="sheet-foot"><div class="pill-actions"><button data-act="formClose">취소</button><i aria-hidden="true"></i><button class="save" data-act="formSave">${f.id ? '저장' : jab ? '맡기기' : '저장'}</button></div></div>`, { full: true, cls: 'form-sheet from-top' });
}
function validateDraft(m, f) {
  const e = {};
  const title = f.title.trim();
  if (!title) e.title = '제목을 적어 주세요.';
  else if (title.length > 30) e.title = '제목은 30자까지 쓸 수 있어요.';
  if (!f.date || !f.endDate) e.date = '시작·종료 날짜를 골라 주세요.';
  else if (!f.id && f.date < today()) e.date = '지난 날짜에는 새 일정을 올릴 수 없어요.';
  else if (f.endDate < f.date) e.date = '종료 날짜가 시작 날짜보다 앞이에요.';
  if (!e.date) {
    const d = draftDuration(f);
    if (d <= 0) e.time = '종료 시각이 시작 시각보다 뒤여야 해요.';
    else if (daysBetween(f.date, f.endDate) > 31) e.time = '한 일정은 32일까지 이어질 수 있어요. 나눠서 올려 주세요.';
  }
  if (f.repeatKind === 'weekly' && !f.days.length) e.days = '반복할 요일을 하나 이상 골라 주세요.';
  if (f.type === 'jab' && f.dlMode === 'custom') {
    if (!f.dlDate || !f.dlTime) e.deadline = '마감 날짜와 시각을 모두 정해 주세요.';
    else if (at(f.dlDate, f.dlTime) <= draftStartMs(f)) e.deadline = '마감은 시작 시각보다 뒤여야 해요.';
    else if (f.repeatKind !== 'none' && daysBetween(f.date, f.dlDate) > 6) e.deadline = '반복 일정의 마감은 시작일부터 7일 안으로 정해 주세요.';
  }
  return e;
}
function findDuplicate(m, f) {
  const title = f.title.trim();
  return m.tasks.find((t) => t.id !== f.id && t.title.trim() === title && t.type === f.type && (t.allDay ? f.allDay : t.start === f.start) && (occursOn(t, f.date) || t.date === f.date));
}

/* ---------- 앱 설치 안내 (PWA) ---------- */
function installRow() {
  const P = PWA.status();
  if (P === 'installed') return `<div class="list-btn as-row"><span class="lb-text"><b>설치된 앱으로 실행 중</b><small>홈 화면 아이콘으로 열면 주소창 없이 앱처럼 동작해요</small></span>${icon('check')}</div>`;
  if (P === 'prompt') return `<button class="list-btn" data-act="installApp">${icon('download')}<span class="lb-text"><b>홈 화면에 앱으로 설치</b><small>한 번 설치하면 인터넷이 없어도 열려요</small></span>${icon('chevron', 'muted')}</button>`;
  if (P === 'ios') return `<div class="list-btn as-row"><span class="lb-text"><b>아이폰에 설치하기</b><small>사파리 아래쪽 공유 버튼 → 홈 화면에 추가 → 추가</small></span>${icon('download')}</div>`;
  if (P === 'android') return `<div class="list-btn as-row"><span class="lb-text"><b>안드로이드에 설치하기</b><small>크롬 오른쪽 위 ⋮ 메뉴 → 앱 설치(또는 홈 화면에 추가)</small></span>${icon('download')}</div>`;
  return `<div class="list-btn as-row"><span class="lb-text"><b>폰에 설치하려면</b><small>이 화면은 미리보기라 설치할 수 없어요. GitHub Pages 같은 https 주소로 열면 '앱 설치'가 나타나요</small></span>${icon('info')}</div>`;
}
