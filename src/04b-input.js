/* =========================================================
   04b-input: 스크롤 선택기 '직접 입력'
   - 선택기 가운데(선택된 줄)를 누르거나 '직접 입력'을 누르면 입력창이 뜬다
   - 여러 형식을 받아들이고(18:30, 1830, 오후 6시 반, 12/3, 내일 …) 범위·순서를 모두 검사한다
   ========================================================= */

/* ---------- 문자열 → 값 (순수 함수: 테스트하기 쉽게 화면과 분리) ---------- */
// 전각 숫자·기호를 보통 문자로, 공백 정리
function normInput(raw) {
  return String(raw || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[：﹕]/g, ':').replace(/[．。]/g, '.').replace(/[／]/g, '/').replace(/[－‐–—]/g, '-')
    .trim().toLowerCase();
}

// 시각: 18:30 · 1830 · 930 · 18시 30분 · 6시 반 · 오후 6:30 · 6:30pm · 정오 · 자정
function parseTimeInput(raw) {
  let s = normInput(raw).replace(/\s+/g, '');
  if (!s) return { ok: false, error: '시각을 입력해 주세요.' };
  if (/^(정오|낮12시)$/.test(s)) return { ok: true, hm: '12:00' };
  if (/^(자정|밤12시)$/.test(s)) return { ok: true, hm: '00:00' };
  let mer = null; // 'am' | 'pm'
  if (/(오후|pm|p\.m\.|저녁|밤)/.test(s)) mer = 'pm';
  if (/(오전|am|a\.m\.|새벽|아침)/.test(s)) mer = mer ? 'both' : 'am';
  if (mer === 'both') return { ok: false, error: '오전·오후 중 하나만 적어 주세요.' };
  s = s.replace(/(오후|오전|pm|am|p\.m\.|a\.m\.|저녁|밤|새벽|아침)/g, '');
  s = s.replace(/시반$/, '시30분').replace(/반$/, '30');
  let h, m;
  let mt;
  if ((mt = s.match(/^(\d{1,2})(?:[:.h]|시)(\d{1,2})?(?:분)?$/))) { h = +mt[1]; m = mt[2] != null ? +mt[2] : 0; }
  else if ((mt = s.match(/^(\d{1,2})시?$/))) { h = +mt[1]; m = 0; }
  else if ((mt = s.match(/^(\d{1,2})(\d{2})$/))) { h = +mt[1]; m = +mt[2]; }
  else return { ok: false, error: '시각 형식을 알아보지 못했어요. 예) 18:30, 1830, 오후 6시 30분' };
  if (m > 59) return { ok: false, error: '분은 0~59 사이로 적어 주세요.' };
  if (mer) {
    if (h < 1 || h > 12) return { ok: false, error: `${mer === 'pm' ? '오후' : '오전'}는 1~12시로 적어 주세요.` };
    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
  }
  if (h === 24 && m === 0) return { ok: false, error: '24시는 0시(00:00)로 적어 주세요. 하루를 넘기는 마감은 날짜를 다음 날로 바꿔 주세요.' };
  if (h > 23) return { ok: false, error: '시는 0~23 사이로 적어 주세요.' };
  return { ok: true, hm: `${pad(h)}:${pad(m)}` };
}

// 걸리는 시간: 90분 · 1시간 30분 · 1시간 반 · 2시간 · 1.5시간
function parseDurationInput(raw) {
  const s = normInput(raw).replace(/\s+/g, '');
  let mt;
  if ((mt = s.match(/^(\d+(?:\.\d+)?)시간(?:(\d{1,3})분|반)?$/))) {
    const min = Math.round(parseFloat(mt[1]) * 60) + (mt[2] ? +mt[2] : /반$/.test(s) ? 30 : 0);
    return { ok: true, min };
  }
  if ((mt = s.match(/^\+?(\d{1,4})분$/)) || (mt = s.match(/^\+(\d{1,4})$/))) return { ok: true, min: +mt[1] };
  return { ok: false };
}

// 날짜: 오늘 · 내일 · 모레 · 글피 · 3일 뒤 · +7 · 12/3 · 12.3 · 12-3 · 12월 3일 · 2026-12-03 · 26/12/03 · 3일
//  숫자만 적으면 4자리(MMDD → 11/28)·6자리(YYMMDD → 26/11/28)만 날짜로 본다. 그 밖의 자리 수는 바꾸지 않고 안내만
//  연도를 안 적으면 base 앞뒤로 가장 가까운 날 (11/25에 '1120' → 올해 11/20, '0105' → 내년 1/5). 6자리 연도는 20YY
const DATE_DIGITS_ERR = '숫자만 적을 때는 4자리(1128 → 11/28)나 6자리(261128 → 26/11/28)로 적어 주세요.';
function nearestYmd(cands, base) {
  let best = null, bd = Infinity;
  for (const c of cands) { const d = daysBetween(base, c), a = Math.abs(d); if (a < bd || (a === bd && d > 0)) { best = c; bd = a; } }
  return best;
}
function parseDateInput(raw, base) {
  let s = normInput(raw).replace(/\s+/g, '').replace(/\([^)]*\)$/, '').replace(/[월화수목금토일]요일$/, '').replace(/\.$/, '');
  if (!s) return { ok: false, error: '날짜를 입력해 주세요.' };
  if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) base = ymd(Date.now());
  if (s.length > 20) return { ok: false, error: '날짜를 짧게 적어 주세요. 예) 1128, 261128' };
  const rel = { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 };
  if (s in rel) return { ok: true, ymd: addDays(base, rel[s]) };
  let mt;
  if ((mt = s.match(/^\+?(\d{1,3})일(?:뒤|후)$/)) || (mt = s.match(/^\+(\d{1,3})$/))) return { ok: true, ymd: addDays(base, +mt[1]) };
  let y = null, mo = null, d;
  if (/^\d+$/.test(s)) {
    if (s.length === 4) { mo = +s.slice(0, 2); d = +s.slice(2); }
    else if (s.length === 6) { y = 2000 + +s.slice(0, 2); mo = +s.slice(2, 4); d = +s.slice(4); }
    else return { ok: false, error: DATE_DIGITS_ERR };
  }
  else if ((mt = s.match(/^(\d{4})[-./년](\d{1,2})[-./월](\d{1,2})일?$/))) { y = +mt[1]; mo = +mt[2]; d = +mt[3]; }
  else if ((mt = s.match(/^(\d{2})[-./년](\d{1,2})[-./월](\d{1,2})일?$/))) { y = 2000 + +mt[1]; mo = +mt[2]; d = +mt[3]; }
  else if ((mt = s.match(/^(\d{1,2})[-./월](\d{1,2})일?$/))) { mo = +mt[1]; d = +mt[2]; }
  else if ((mt = s.match(/^(\d{1,2})일$/))) { d = +mt[1]; }
  else return { ok: false, error: '날짜 형식을 알아보지 못했어요. 예) 1128, 261128, 12/18, 내일' };
  if (mo != null && (mo < 1 || mo > 12)) return { ok: false, error: '월은 1~12 사이로 적어 주세요.' };
  if (!(d >= 1 && d <= 31)) return { ok: false, error: '일은 1~31 사이로 적어 주세요.' };
  const ymdOf = (yy, mm) => `${yy}-${pad(mm)}-${pad(d)}`;
  const valid = (yy, mm) => { const dt = new Date(yy, mm - 1, d); return dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === d; };
  const [by, bm] = base.split('-').map(Number);
  if (mo == null) {
    // 'N일'만: 지난달·이번 달·다음 달 중 가장 가까운 그 날
    const cands = [-1, 0, 1].map((k) => new Date(by, bm - 1 + k, 1)).map((t) => [t.getFullYear(), t.getMonth() + 1]).filter(([yy, mm]) => valid(yy, mm)).map(([yy, mm]) => ymdOf(yy, mm));
    return cands.length ? { ok: true, ymd: nearestYmd(cands, base) } : { ok: false, error: `${d}일이 있는 달을 찾지 못했어요.` };
  }
  if (y != null) return valid(y, mo) ? { ok: true, ymd: ymdOf(y, mo) } : { ok: false, error: `${mo}월에는 ${d}일이 없어요.` };
  // 연도 없음: 앞뒤 해 중 가장 가까운 날 (2/29는 가장 가까운 윤년)
  const cands = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => by + k).filter((yy) => valid(yy, mo)).map((yy) => ymdOf(yy, mo));
  return cands.length ? { ok: true, ymd: nearestYmd(cands, base) } : { ok: false, error: `${mo}월에는 ${d}일이 없어요.` };
}

/* ---------- 입력 대상별 규칙 ---------- */
const INPUT_SPEC = {
  date: { kind: 'date', title: '시작 날짜 직접 입력', ph: '예) 1128 · 261128 · 내일', help: '숫자 4자리(1128 → 11/28)나 6자리(261128 → 26/11/28)로 적으면 "/"는 저절로 들어가요. 연도를 안 쓰면 앞뒤로 가장 가까운 날로 맞춰요.', quick: [['오늘', '오늘'], ['내일', '내일'], ['모레', '모레']] },
  endDate: { kind: 'date', title: '종료 날짜 직접 입력', ph: '예) 1128 · 261128', help: '숫자 4자리(1128 → 11/28)나 6자리(261128 → 26/11/28)로 적으면 "/"는 저절로 들어가요. 시작 날짜보다 앞설 수 없고, 32일까지 이어질 수 있어요.', quick: [['same', '시작과 같은 날'], ['next', '다음 날']] },
  start: { kind: 'time', title: '시작 시각 직접 입력', ph: '예) 18:30 · 1830 · 오후 6시 반', help: '24시간제나 오전·오후 둘 다 돼요. 1분 단위로 정할 수 있어요.' },
  end: { kind: 'time', title: '종료 시각 직접 입력', ph: '예) 20:00 · 90분 · 1시간 30분', help: '종료 시각이나 걸리는 시간(90분, 1시간 반)을 적어 주세요. 같은 날 시작보다 이르면 다음 날로 봐요.' },
  dl: { kind: 'datetime', title: '마감 직접 입력', ph: '예) 12/3 20:00 · 20:00 · 내일 9시', help: '날짜만 적으면 시각은 그대로, 시각만 적으면 날짜는 그대로 둬요.' },
};
const INPUT_MAX_DAYS = 365;

/* 날짜 칸에 미리 채울 값: 자동 모양과 같은 MM/DD (연도를 빼면 다른 해로 읽히는 날이면 YY/MM/DD) */
function dateFieldValue(dateStr, base) {
  const [y, m, d] = dateStr.split('-');
  const four = `${m}/${d}`;
  return parseDateInput(m + d, base).ymd === dateStr ? four : `${y.slice(2)}/${four}`;
}
function inputCurrent(target) {
  const f = ui.form;
  if (target === 'date') return dateFieldValue(f.date, today());
  if (target === 'endDate') return dateFieldValue(f.endDate, f.date);
  if (target === 'start') return f.start;
  if (target === 'end') return f.end;
  if (target === 'dl') return `${fmtMD(f.dlDate).replace('월 ', '/').replace('일', '')} ${f.dlTime}`;
  return '';
}

// 입력값을 검사해서 { ok, patch } 또는 { ok:false, error } 를 돌려준다 (폼은 아직 바꾸지 않음)
function evalInput(target, raw) {
  const f = ui.form;
  const td = today();
  const maxDate = addDays(td, INPUT_MAX_DAYS);
  if (target === 'date') {
    const r = parseDateInput(raw, td);
    if (!r.ok) return r;
    // 지난 날짜도 된다 (일반 일정). 고치는 잡도리 일정만 지난 날짜로 옮길 수 없다
    const mn = jabEditMin(f);
    if (mn && r.ymd < mn) return { ok: false, error: '잡도리 일정은 지난 날짜로 옮길 수 없어요.' };
    if (r.ymd > maxDate) return { ok: false, error: '앞으로는 1년 안의 날짜만 정할 수 있어요.' };
    const toNormal = !f.id && f.type === 'jab' && r.ymd < td;
    return { ok: true, patch: { date: r.ymd }, label: fmtDateShort(r.ymd) + (toNormal ? ' · 지난 날짜라 일반 일정으로 올려요' : '') };
  }
  if (target === 'endDate') {
    const s = normInput(raw);
    // 빠른 버튼 값 (시작과 같은 날 / 다음 날)
    const r = s === 'same' ? { ok: true, ymd: f.date } : s === 'next' ? { ok: true, ymd: addDays(f.date, 1) } : parseDateInput(raw, f.date);
    if (!r.ok) return r;
    if (r.ymd < f.date) return { ok: false, error: `종료 날짜는 시작 날짜(${fmtDateShort(f.date)})보다 앞설 수 없어요.` };
    if (daysBetween(f.date, r.ymd) > 31) return { ok: false, error: '한 일정은 32일까지 이어질 수 있어요. 나눠서 올려 주세요.' };
    const patch = { endDate: r.ymd };
    // 같은 날로 바꿨는데 종료 시각이 시작보다 이르면 시작 + 1시간
    if (!f.allDay && r.ymd === f.date && hmToMin(f.end) <= hmToMin(f.start)) { const e = at(f.date, f.start) + 60 * MIN; patch.endDate = ymd(e); patch.end = fmtHM(e); }
    return { ok: true, patch, label: fmtDateShort(patch.endDate) };
  }
  if (target === 'start' || target === 'end') {
    if (target === 'end') {
      const du = parseDurationInput(raw);
      if (du.ok) { // 걸리는 시간으로 적으면 종료 = 시작 + 그 시간 (날짜를 넘기면 종료 날짜도 넘어간다)
        if (du.min < 5) return { ok: false, error: '5분 이상으로 적어 주세요.' };
        if (du.min > 31 * 1440) return { ok: false, error: '한 일정은 32일까지 이어질 수 있어요.' };
        const e = at(f.date, f.start) + du.min * MIN;
        return { ok: true, patch: { end: fmtHM(e), endDate: ymd(e) }, label: `${fmtDur(du.min)} 동안` };
      }
    }
    const r = parseTimeInput(raw);
    if (!r.ok) return r;
    if (target === 'end') {
      // 시각만 적으면 종료 날짜는 그대로. 같은 날인데 시작보다 이르면 다음 날로 본다
      if (f.endDate === f.date && r.hm === f.start) return { ok: false, error: '종료 시각이 시작 시각과 같아요.' };
      const endDate = f.endDate === f.date && hmToMin(r.hm) < hmToMin(f.start) ? addDays(f.date, 1) : f.endDate;
      return { ok: true, patch: { end: r.hm, endDate }, label: endDate !== f.date ? `${fmtMD(endDate)} ${r.hm}` : r.hm };
    }
    return { ok: true, patch: { start: r.hm }, label: r.hm };
  }
  if (target === 'dl') {
    const s = normInput(raw);
    if (!s.trim()) return { ok: false, error: '마감 날짜나 시각을 입력해 주세요.' };
    // "12/3 20:00", "내일 9시", "20:00", "12/3" 모두 받기
    const parts = s.split(/\s+/);
    let dPart = null, tPart = null;
    if (parts.length >= 2) { dPart = parts[0]; tPart = parts.slice(1).join(''); }
    else if (/[:시]|^(오전|오후|정오|자정)|(am|pm)$/.test(s) || /^\d{1,2}$/.test(s)) tPart = s;
    else dPart = s;
    let dl = f.dlDate, tm = f.dlTime;
    if (dPart) { const r = parseDateInput(dPart, f.date); if (!r.ok) return r; dl = r.ymd; }
    if (tPart) { const r = parseTimeInput(tPart); if (!r.ok) return r; tm = r.hm; }
    if (dl < f.date) return { ok: false, error: '마감 날짜는 시작 날짜보다 앞설 수 없어요.' };
    if (f.repeatKind !== 'none' && daysBetween(f.date, dl) > 6) return { ok: false, error: '반복 일정의 마감은 시작일부터 7일 안으로 정해 주세요.' };
    if (dl > maxDate) return { ok: false, error: '1년 안의 날짜만 정할 수 있어요.' };
    if (at(dl, tm) <= at(f.date, f.start)) return { ok: false, error: `마감은 시작(${fmtMD(f.date)} ${f.start})보다 뒤여야 해요.` };
    return { ok: true, patch: { dlDate: dl, dlTime: tm, _dlTouched: true }, label: `${fmtMD(dl)} ${tm}` };
  }
  return { ok: false, error: '알 수 없는 입력이에요.' };
}

/* ---------- 입력창 화면 ---------- */
function viewWheelInput() {
  const st = ui.input; if (!st || !ui.form) return '';
  const sp = INPUT_SPEC[st.target];
  const err = st.error;
  return `<div class="in-scrim" data-act="wheelInputCancel"></div>
  <div class="in-box" role="dialog" aria-modal="true" aria-labelledby="in-title">
    <h2 id="in-title" class="in-title">${sp.title}</h2>
    <input id="in-field" class="txt in-field" type="text" inputmode="${(sp.kind === 'time' && st.target !== 'end') || sp.kind === 'date' ? 'numeric' : 'text'}" autocomplete="off" enterkeyhint="done"
      value="${esc(st.value)}" placeholder="${esc(sp.ph)}" aria-describedby="in-help${err ? ' in-err' : ''}" ${err ? 'aria-invalid="true"' : ''} data-input-box="1">
    ${err ? `<p id="in-err" class="field-err" role="alert">${icon('alert')}${esc(err)}</p>` : ''}
    <p id="in-help" class="hint">${sp.help}</p>
    ${sp.quick ? `<div class="chips in-quick" role="group" aria-label="빠르게 고르기">${sp.quick.map(([v, l]) => `<button class="chip" data-act="wheelInputQuick" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
    <p class="in-preview" id="in-preview" aria-live="polite">${st.preview ? esc(st.preview) : ''}</p>
    <div class="in-actions"><button class="btn ghost" data-act="wheelInputCancel">취소</button><button class="btn primary" data-act="wheelInputOk">확인</button></div>
  </div>`;
}
let inputHtml = '';
function renderInputLayer() {
  const host = $('#layer-input'); if (!host) return;
  const h = ui.input && ui.sheet && ui.sheet.type === 'form' ? viewWheelInput() : '';
  if (h === inputHtml) return;
  const isNew = !inputHtml && h;
  const caret = (() => { const f = $('#in-field'); return f ? f.selectionStart : null; })();
  host.innerHTML = h; inputHtml = h;
  const field = $('#in-field');
  if (field) {
    field.focus({ preventScroll: true });
    if (isNew) field.select(); else if (caret != null) field.setSelectionRange(caret, caret);
  }
}

/* ---------- 동작 ---------- */
// 선택기 id → 입력 대상
function wheelTarget(id) {
  if (id === 'date') return 'date';
  if (id.startsWith('start')) return 'start';
  if (id.startsWith('end')) return 'end';
  if (id.startsWith('dl')) return 'dl';
  return null;
}
function openWheelInput(target) {
  if (!ui.form || !INPUT_SPEC[target]) return;
  const value = inputCurrent(target);
  // manual: 글자·기호를 직접 적었으면 true → 날짜 칸 자동 모양(2자리마다 '/')을 멈춘다. digits: 지금 숫자들
  ui.input = { target, value, error: '', preview: '', manual: false, digits: value.replace(/\D/g, '') };
  render();
}
/* ---------- 날짜 칸 자동 모양 ----------
   숫자만 적는 동안 2자리마다 '/'를 넣어 보여 준다 (1128 → 11/28, 261128 → 26/11/28).
   '/'·글자를 직접 적으면(12/3, 내일, 12월 3일 …) 그때부터 손대지 않고 적은 그대로 읽는다. 칸을 비우면 다시 자동 */
function fmtDateDigits(dg) { return dg.length <= 6 ? (dg.match(/.{1,2}/g) || []).join('/') : dg; }
function autoDateField(ev, st) {
  const el = ev.target, v = el.value;
  if (!v) { st.manual = false; st.digits = ''; return; }
  if (st.manual) return;
  const it = ev.inputType || '', typed = ev.data == null ? '' : String(ev.data);
  if (/[^\d/]/.test(v) || (it.startsWith('insert') && /\D/.test(typed))) { st.manual = true; return; }
  let before = v.slice(0, el.selectionStart == null ? v.length : el.selectionStart).replace(/\D/g, '').length;
  let dg = v.replace(/\D/g, '');
  // 자동으로 넣은 '/' 바로 뒤에서 지우기 → 그 앞 숫자를 지운다 (안 그러면 '/'가 다시 생겨 안 지워짐)
  if (it === 'deleteContentBackward' && dg === (st.digits || '') && before > 0) { dg = dg.slice(0, before - 1) + dg.slice(before); before -= 1; }
  st.digits = dg;
  const out = fmtDateDigits(dg);
  if (out !== v) {
    el.value = out;
    let pos = 0, seen = 0;
    while (pos < out.length && seen < before) { if (/\d/.test(out[pos])) seen++; pos++; }
    try { el.setSelectionRange(pos, pos); } catch (e) { /* 무시 */ }
  }
}
/* 확인할 때 읽을 글자: 날짜 칸이 자동 모양이면 '/'를 뺀 숫자 그대로 (4·6자리 규칙이 그대로 걸리게) */
function inputRaw(st) {
  const sp = INPUT_SPEC[st.target];
  const v = String(st.value || '');
  return sp && sp.kind === 'date' && !st.manual && /^[\d/]+$/.test(v) ? v.replace(/\//g, '') : v;
}
Object.assign(ACT, {
  wheelInput: (t) => openWheelInput(t.dataset.target),
  // 날짜 입력창의 빠른 버튼 (오늘·내일·모레 / 시작과 같은 날·다음 날): 그 값으로 바로 확인
  wheelInputQuick: (t) => { if (!ui.input) return; ui.input.value = t.dataset.v; const fd = $('#in-field'); if (fd) fd.value = t.dataset.v; ACT.wheelInputOk(); },
  wheelInputCancel: () => { const tg = ui.input && ui.input.target; ui.input = null; render(); focusWheelGroup(tg); },
  wheelInputOk: () => {
    const st = ui.input; if (!st || !ui.form) return;
    const field = $('#in-field'); if (field) st.value = field.value;
    const r = evalInput(st.target, inputRaw(st));
    if (!r.ok) { st.error = r.error; st.preview = ''; render(); return; }
    const span = daysBetween(ui.form.date, ui.form.endDate); // 시작 날짜를 바꾸면 종료 날짜도 같은 간격으로 따라간다
    const dur = draftDurMs(ui.form);                          // 시작 시각을 바꾸면 걸리는 시간 그대로 종료도 따라간다
    Object.assign(ui.form, r.patch);
    const f = ui.form;
    if (r.patch.start) keepDuration(f, dur);
    if (r.patch.date) {
      f.endDate = addDays(f.date, Math.max(0, span));
      f.calMonth = f.date.slice(0, 7); // 폼 달력도 그 달로
      if (f.repeatKind === 'weekly' && f.days.length === 1) f.days = [weekday(f.date)];
      if (!f._dlTouched || f.dlDate < f.date) f.dlDate = f.date;
      delete f.errors.date;
      syncPastRule(f);   // 지난 날짜면 일반 일정으로 (다시 오늘 이후로 옮기면 잡도리로)
    }
    if (r.patch.endDate) { delete f.errors.date; f.calMonth = f.endDate.slice(0, 7); }
    if (r.patch.start || r.patch.end || r.patch.endDate) delete f.errors.time;
    if (r.patch.dlDate) delete f.errors.deadline;
    const tg = st.target;
    ui.input = null;
    f._calRise = 0;   // 달력·휠은 열어 둔 채 고른 값을 보여 준다
    rerenderForm();
    toast(`${INPUT_SPEC[tg].title.replace(' 직접 입력', '')}: ${r.label}`);
    focusWheelGroup(tg);
  },
});
function focusWheelGroup(target) {
  if (!target) return;
  const id = { date: 'date', start: 'start-h', end: 'end-h', dl: 'dl-date' }[target];
  if (!id) return;
  setTimeout(() => { const w = el.sheet && el.sheet.querySelector(`.wheel[data-wheel="${id}"]`); if (w) w.focus({ preventScroll: true }); }, 30);
}
// 입력창 안 키보드: Enter 확인, Esc 취소, 입력하면서 미리보기
document.addEventListener('keydown', (ev) => {
  if (!ev.target || !ev.target.dataset || !ev.target.dataset.inputBox) return;
  if (ev.key === 'Enter') { ev.preventDefault(); ACT.wheelInputOk(); }
  if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ACT.wheelInputCancel(); }
}, true);
document.addEventListener('input', (ev) => {
  if (!ev.target || !ev.target.dataset || !ev.target.dataset.inputBox || !ui.input) return;
  const sp = INPUT_SPEC[ui.input.target];
  if (sp && sp.kind === 'date') autoDateField(ev, ui.input);
  ui.input.value = ev.target.value;
  const raw = inputRaw(ui.input);
  const r = raw.trim() ? evalInput(ui.input.target, raw) : { ok: false };
  let text = r.ok ? `→ ${r.label}` : '';
  // 숫자만 적는 중: 4·6자리가 될 때까지 안내, 4·6자리인데 없는 날짜면 그 까닭
  if (!r.ok && sp && sp.kind === 'date' && /^\d+$/.test(raw)) text = raw.length === 4 || raw.length === 6 ? r.error : '숫자 4자리(1128)나 6자리(261128)까지 적어 주세요';
  const pv = $('#in-preview'); if (pv) { pv.textContent = text; pv.classList.toggle('warn', !r.ok && !!text); }
});

