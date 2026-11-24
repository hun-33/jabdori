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

// 날짜: 오늘 · 내일 · 모레 · 글피 · 3일 뒤 · 12/3 · 12.3 · 12-3 · 12월 3일 · 1203 · 2026-12-03 · 20261203 · 3일
function parseDateInput(raw, base) {
  let s = normInput(raw).replace(/\s+/g, '').replace(/\([^)]*\)$/, '').replace(/[월화수목금토일]요일$/, '').replace(/\.$/, '');
  if (!s) return { ok: false, error: '날짜를 입력해 주세요.' };
  const rel = { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 };
  if (s in rel) return { ok: true, ymd: addDays(base, rel[s]) };
  let mt;
  if ((mt = s.match(/^\+?(\d{1,3})일(?:뒤|후)$/)) || (mt = s.match(/^\+(\d{1,3})$/))) return { ok: true, ymd: addDays(base, +mt[1]) };
  let y = null, mo, d;
  if ((mt = s.match(/^(\d{4})[-./년](\d{1,2})[-./월](\d{1,2})일?$/))) { y = +mt[1]; mo = +mt[2]; d = +mt[3]; }
  else if ((mt = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +mt[1]; mo = +mt[2]; d = +mt[3]; }
  else if ((mt = s.match(/^(\d{1,2})[-./월](\d{1,2})일?$/))) { mo = +mt[1]; d = +mt[2]; }
  else if ((mt = s.match(/^(\d{1,2})(\d{2})$/))) { mo = +mt[1]; d = +mt[2]; }
  else if ((mt = s.match(/^(\d{1,2})일$/))) {
    const [by, bm] = base.split('-').map(Number);
    y = by; mo = bm; d = +mt[1];
    if (d >= 1 && d <= 31 && `${y}-${pad(mo)}-${pad(d)}` < base) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
  }
  else return { ok: false, error: '날짜 형식을 알아보지 못했어요. 예) 12/3, 12월 3일, 내일, 2026-12-03' };
  if (mo < 1 || mo > 12) return { ok: false, error: '월은 1~12 사이로 적어 주세요.' };
  const inferYear = y == null;
  if (inferYear) y = +base.slice(0, 4);
  const valid = (yy) => { const dt = new Date(yy, mo - 1, d); return d >= 1 && dt.getFullYear() === yy && dt.getMonth() === mo - 1 && dt.getDate() === d; };
  if (!valid(y)) {
    // 2/29처럼 올해엔 없는 날짜: 연도를 안 적었으면 그 날짜가 있는 가장 가까운 해(윤년)로
    const next = inferYear && mo === 2 && d === 29 ? [1, 2, 3, 4].map((k) => y + k).find(valid) : null;
    if (next) y = next;
    else return { ok: false, error: `${mo}월에는 ${d}일이 없어요.` };
  }
  let ymdStr = `${y}-${pad(mo)}-${pad(d)}`;
  // 연도 없이 지난 날짜를 적으면 내년으로 본다 (11월에 '1/5' → 내년 1월 5일)
  if (inferYear && ymdStr < base) { y += 1; if (!valid(y)) return { ok: false, error: `${mo}월에는 ${d}일이 없어요.` }; ymdStr = `${y}-${pad(mo)}-${pad(d)}`; }
  return { ok: true, ymd: ymdStr };
}

/* ---------- 입력 대상별 규칙 ---------- */
const INPUT_SPEC = {
  date: { kind: 'date', title: '날짜 직접 입력', ph: '예) 12/3 · 12월 3일 · 내일', help: '연도를 안 쓰면 가장 가까운 날로 맞춰요. 지난 날짜면 내년으로 봐요.' },
  start: { kind: 'time', title: '시작 시각 직접 입력', ph: '예) 18:30 · 1830 · 오후 6시 반', help: '24시간제나 오전·오후 둘 다 돼요. 1분 단위로 정할 수 있어요.' },
  end: { kind: 'time', title: '끝 시각 직접 입력', ph: '예) 20:00 · 90분 · 1시간 30분', help: '끝 시각이나 걸리는 시간(90분, 1시간 반)을 적어 주세요. 시작보다 이르면 다음 날로 봐요.' },
  dl: { kind: 'datetime', title: '마감 직접 입력', ph: '예) 12/3 20:00 · 20:00 · 내일 9시', help: '날짜만 적으면 시각은 그대로, 시각만 적으면 날짜는 그대로 둬요.' },
};
const INPUT_MAX_DAYS = 365;

function inputCurrent(target) {
  const f = ui.form;
  if (target === 'date') return fmtMD(f.date).replace('월 ', '/').replace('일', '');
  if (target === 'start') return f.start;
  if (target === 'end') return f.end;
  if (target === 'dl') return `${fmtMD(f.dlDate).replace('월 ', '/').replace('일', '')} ${f.dlTime}`;
  return '';
}

// 입력값을 검사해서 { ok, patch } 또는 { ok:false, error } 를 돌려준다 (폼은 아직 바꾸지 않음)
function evalInput(target, raw) {
  const f = ui.form;
  const td = today();
  const minDate = f.id ? (f.origDate && f.origDate < td ? f.origDate : td) : td;
  const maxDate = addDays(td, INPUT_MAX_DAYS);
  if (target === 'date') {
    const r = parseDateInput(raw, td);
    if (!r.ok) return r;
    if (r.ymd < minDate) return { ok: false, error: '지난 날짜에는 새 일정을 올릴 수 없어요.' };
    if (r.ymd > maxDate) return { ok: false, error: '1년 안의 날짜만 정할 수 있어요.' };
    return { ok: true, patch: { date: r.ymd }, label: fmtDateShort(r.ymd) };
  }
  if (target === 'start' || target === 'end') {
    if (target === 'end') {
      const du = parseDurationInput(raw);
      if (du.ok) {
        if (du.min < 5) return { ok: false, error: '5분 이상으로 적어 주세요.' };
        if (du.min > 12 * 60) return { ok: false, error: '한 번에 12시간 넘게 잡을 수는 없어요. 나눠서 올려 주세요.' };
        const endMin = (hmToMin(f.start) + du.min) % 1440;
        return { ok: true, patch: { end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}` }, label: `${du.min}분 동안` };
      }
    }
    const r = parseTimeInput(raw);
    if (!r.ok) return r;
    if (target === 'end') {
      if (r.hm === f.start) return { ok: false, error: '끝 시각이 시작 시각과 같아요.' };
      let d = hmToMin(r.hm) - hmToMin(f.start); if (d <= 0) d += 1440;
      if (d > 12 * 60) return { ok: false, error: `시작 ${f.start}부터 ${r.hm}까지는 12시간이 넘어요. 시각을 다시 확인해 주세요.` };
      return { ok: true, patch: { end: r.hm }, label: r.hm };
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
    <input id="in-field" class="txt in-field" type="text" inputmode="${sp.kind === 'time' && st.target !== 'end' ? 'numeric' : 'text'}" autocomplete="off" enterkeyhint="done"
      value="${esc(st.value)}" placeholder="${esc(sp.ph)}" aria-describedby="in-help${err ? ' in-err' : ''}" ${err ? 'aria-invalid="true"' : ''} data-input-box="1">
    ${err ? `<p id="in-err" class="field-err" role="alert">${icon('alert')}${esc(err)}</p>` : ''}
    <p id="in-help" class="hint">${sp.help}</p>
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
  ui.input = { target, value: inputCurrent(target), error: '', preview: '' };
  render();
}
Object.assign(ACT, {
  wheelInput: (t) => openWheelInput(t.dataset.target),
  wheelInputCancel: () => { const tg = ui.input && ui.input.target; ui.input = null; render(); focusWheelGroup(tg); },
  wheelInputOk: () => {
    const st = ui.input; if (!st || !ui.form) return;
    const field = $('#in-field'); if (field) st.value = field.value;
    const r = evalInput(st.target, st.value);
    if (!r.ok) { st.error = r.error; st.preview = ''; render(); return; }
    Object.assign(ui.form, r.patch);
    const f = ui.form;
    if (r.patch.date) {
      if (f.repeatKind === 'weekly' && f.days.length === 1) f.days = [weekday(f.date)];
      if (!f._dlTouched || f.dlDate < f.date) f.dlDate = f.date;
      delete f.errors.date;
    }
    if (r.patch.end) f.durMode = 'custom';
    if (r.patch.start || r.patch.end) delete f.errors.time;
    if (r.patch.dlDate) delete f.errors.deadline;
    const tg = st.target;
    ui.input = null;
    rerenderForm();
    toast(`${INPUT_SPEC[tg].title.replace(' 직접 입력', '')}: ${r.label}`);
    focusWheelGroup(tg);
  },
});
function focusWheelGroup(target) {
  if (!target) return;
  const id = { date: 'date', start: 'start-h', end: 'end-h', dl: 'dl-date' }[target];
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
  ui.input.value = ev.target.value;
  const r = ev.target.value.trim() ? evalInput(ui.input.target, ev.target.value) : { ok: false };
  const pv = $('#in-preview'); if (pv) pv.textContent = r.ok ? `→ ${r.label}` : '';
});
