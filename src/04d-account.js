/* ============================================================
   04d-account.js — 로그인 상태 확인
   ① 로그인 기록      : diagBegin / diagStep / diagFail / diagDone
                        로그인·앱 복귀·재검증 때 단계마다 성공/실패를 남긴다 (토큰 값은 절대 저장하지 않음)
   ② 진짜 로그인 확인 : checkRealLogin(kind) — 카카오 서버에 토큰·사용자 정보를 다시 물어보고 앱 회원·세션과 맞춰 본다
   ③ 로그인 성공 안내 : showLoginWelcome(m, mode) — 모든 단계가 확인됐을 때만 "카카오 계정으로 로그인했어요!"
   ④ 나 탭 계정 상태  : accountStatusBlock(m) — 로그인 방식·카카오 연결·앱 세션 (회원번호는 보여 주지 않음)
   ⑤ 개발자 진단      : viewLoginDiag() + ACT.diagRecheck — 단계별 결과, 실패 위치, 카카오 회원번호(여기서만)
   ============================================================ */

/* 진단 단계: [키, 이름, 성공 글자, 실패 글자] */
const DIAG_STEPS = [
  ['config', '앱 설정 (앱 키·키 해시)', '정상', '설정 안 됨'],
  ['auth', '카카오 인증', '성공', '실패'],
  ['token', '액세스 토큰 발급', '성공', '실패'],
  ['me', '사용자 정보 조회', '성공', '실패'],
  ['kakaoId', '카카오 회원번호', '확인', '미확인'],
  ['member', '잡도리앱 회원 확인', '성공', '실패'],
  ['session', '서비스 로그인 세션', '활성', '비활성'],
];
const DIAG_KIND = { login: '로그인', restore: '앱 실행·복귀 확인', recheck: '재검증', logout: '로그아웃' };
let diagCur = null; // 지금 진행 중인 단계 (실패했을 때 어느 단계인지 알기 위해)

/* ① 로그인 기록 */
function diagBegin(mode, kind) {
  state.diag = { mode, kind, at: Date.now(), steps: {}, failStep: null, code: null, msg: null, kakaoId: null, expiresIn: null, done: false };
  diagCur = DIAG_STEPS[0][0];
  return state.diag;
}
// 단계 성공 → 다음 단계를 진행 중으로
function diagStep(key, extra) {
  const d = state.diag; if (!d) return;
  d.steps[key] = 'ok';
  if (extra) Object.assign(d, extra);
  const i = DIAG_STEPS.findIndex(([k]) => k === key);
  diagCur = DIAG_STEPS[i + 1] ? DIAG_STEPS[i + 1][0] : null;
}
// 흉내 모드: 실제 카카오와 통신하지 않은 단계
function diagSim(key) { const d = state.diag; if (d) d.steps[key] = 'sim'; }
// 단계 실패 → 그 뒤 단계는 확인하지 않음. 메시지에서 토큰처럼 보이는 긴 문자열은 지운다
function diagFail(key, code, msg) {
  const d = state.diag; if (!d) return;
  const k = key || diagCur || 'auth';
  d.steps[k] = 'fail';
  d.failStep = k; d.code = code || 'UNKNOWN';
  d.msg = msg ? String(msg).replace(/[A-Za-z0-9_\-.]{30,}/g, '[가림]').slice(0, 160) : null;
  let after = false;
  for (const [s] of DIAG_STEPS) { if (after && !d.steps[s]) d.steps[s] = 'skip'; if (s === k) after = true; }
  d.done = true; diagCur = null;
  save();
}
function diagDone() { const d = state.diag; if (d) { d.done = true; diagCur = null; save(); } }

/* ② 진짜 카카오 로그인 상태 확인 (앱 실행·복귀·재검증 공용)
   돌려주는 값: { ok, failStep, code, network } */
async function kakaoTokenCheck() {
  try {
    const ti = await NATIVE.Kakao.tokenInfo();
    return { ok: true, id: ti && ti.id ? String(ti.id) : '', expiresIn: ti && ti.expiresIn };
  } catch (e) {
    const code = (e && e.code) || '', msg = String((e && e.message) || '');
    // 예전 APK(이 기능이 없는 버전)면 토큰 보유 여부로 대신 판단
    if (code === 'UNIMPLEMENTED' || /not implemented/i.test(msg)) {
      try { const st = await NATIVE.Kakao.status(); return st.hasToken ? { ok: true, id: '', legacy: true } : { ok: false, code: 'NO_TOKEN' }; } catch (e2) { return { ok: false, code: 'UNKNOWN' }; }
    }
    return { ok: false, code: code || 'UNKNOWN', msg };
  }
}
async function checkRealLogin(kind) {
  diagBegin('real', kind);
  const fail = (step, code, msg) => { diagFail(step, code, msg); return { ok: false, failStep: step, code, network: code === 'NETWORK' }; };
  let st;
  try { st = await NATIVE.Kakao.status(); } catch (e) { return fail('config', (e && e.code) || 'UNKNOWN', e && e.message); }
  if (!st.configured) return fail('config', 'NOT_CONFIGURED');
  diagStep('config');
  if (!st.hasToken) return fail('auth', 'NO_TOKEN', '이 기기에 카카오 로그인 기록이 없어요');
  diagStep('auth');
  const tk = await kakaoTokenCheck();
  if (!tk.ok) return fail('token', tk.code, tk.msg);
  diagStep('token', { expiresIn: tk.expiresIn ?? null });
  let u;
  try { u = await NATIVE.Kakao.me(); } catch (e) { return fail('me', (e && e.code) || 'UNKNOWN', e && e.message); }
  diagStep('me');
  if (!u || u.id == null || u.id === '') return fail('kakaoId', 'NO_USER_ID');
  if (tk.id && tk.id !== String(u.id)) return fail('kakaoId', 'ID_MISMATCH', '토큰 주인과 사용자 정보가 달라요');
  diagStep('kakaoId', { kakaoId: String(u.id) });
  const kid = 'kakao:' + u.id, mid = state.memberByKakao[kid];
  if (!mid || !state.members[mid]) return fail('member', 'NO_MEMBER', '이 카카오 계정으로 가입한 잡도리 회원이 없어요');
  diagStep('member');
  const s = state.session;
  if (!s) return fail('session', 'NO_SESSION', '잡도리앱에서 로그아웃한 상태예요 (카카오 로그인은 남아 있음)');
  if (s.expired) return fail('session', 'EXPIRED');
  if (s.kakaoId !== kid || s.memberId !== mid) return fail('session', 'MISMATCH', '세션의 회원과 카카오 계정이 달라요');
  diagStep('session');
  diagDone();
  return { ok: true, user: u };
}

/* 흉내 모드(웹 미리보기·앱의 흉내 로그인) 진단: 카카오 단계는 '흉내', 회원·세션은 실제로 확인 */
function checkFakeLogin(kind) {
  diagBegin('fake', kind);
  ['config', 'auth', 'token', 'me', 'kakaoId'].forEach(diagSim);
  const s = state.session;
  const mid = s && state.memberByKakao[s.kakaoId];
  if (!s || !mid || !state.members[mid]) { diagFail(s ? 'member' : 'session', s ? 'NO_MEMBER' : 'NO_SESSION'); return false; }
  diagStep('member');
  if (s.expired) { diagFail('session', 'EXPIRED'); return false; }
  diagStep('session');
  diagDone();
  return true;
}
function isRealSession() { return !!(NATIVE.on && state.session && state.session.real); }

/* ③ 로그인 성공 안내 (모든 단계가 확인됐을 때만 부른다) */
let welcomeTimer = null;
function showLoginWelcome(m, mode) {
  const b = $('#layer-banner'); if (!b || !m) return;
  const real = mode === 'real';
  const photo = real && (m.thumbnailUrl || m.profileImageUrl);
  const name = m.nickname || '카카오 사용자';
  b.innerHTML = `<div class="banner login-ok" role="status">
      <span class="avatar sm" aria-hidden="true">${esc(name.slice(0, 1))}${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
      <span class="bn-text"><b>${real ? '카카오 계정으로 로그인했어요!' : '흉내 로그인으로 들어왔어요'}</b><span>${esc(name)} 님${real ? '' : ' · 실제 카카오 인증은 하지 않았어요'}</span></span>
      <span class="ok-mark">${icon(real ? 'check' : 'info')}</span></div>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(welcomeTimer); clearTimeout(bannerTimer);
  welcomeTimer = setTimeout(() => b.classList.remove('show'), 3600);
}

/* ④ 나 탭 계정 상태 */
function accountStatusBlock(m) {
  const real = isRealSession();
  const s = state.session;
  const link = s && state.kakao[s.kakaoId];
  const linked = real ? !m.unlinked : !!(link && link.linked);
  const active = !!(s && !s.expired && s.memberId === m.id);
  const photo = real && (m.thumbnailUrl || m.profileImageUrl);
  const since = s && s.at ? `${fmtDateShort(ymd(real ? s.realAt || s.at : s.at))}부터` : '';
  return `<div class="profile">
        <span class="avatar" aria-hidden="true">${esc((m.nickname || '카').slice(0, 1))}${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>
        <div><p class="pf-name">${esc(m.nickname || '카카오 사용자')}</p><p class="pf-sub">이메일 ${m.email ? esc(m.email) : '제공 안 함 (선택 항목)'}</p></div>
      </div>
      <ul class="kv acct-state" aria-label="로그인 상태">
        <li><span>로그인 방식</span><b>${KAKAO_SYMBOL}카카오${real ? '' : ' <em class="sim-tag">흉내 모드 · 실제 인증 아님</em>'}</b></li>
        <li><span>카카오 계정 연결</span><b class="${linked ? 'yes' : 'no'}">${icon(linked ? 'check' : 'x')}${linked ? '연결됨' : '끊김'}</b></li>
        <li><span>잡도리앱 로그인</span><b class="${active ? 'yes' : 'no'}">${icon(active ? 'check' : 'x')}${active ? `로그인 중${since ? ' · ' + since : ''}` : '로그아웃됨'}</b></li>
      </ul>
      <button class="list-btn" data-act="acct" data-v="logout">${icon('logout')}<span class="lb-text"><b>로그아웃</b><small>${real ? '이 폰에서만 나가요. 카카오 연결은 남아 있어 다음엔 동의 없이 바로 들어와요.' : '이 기기에서만 나가요. 카카오 인증은 남아 있어 다음엔 바로 들어와요.'}</small></span>${icon('chevron', 'muted')}</button>`;
}

/* ⑤ 개발자 진단 화면 */
function viewLoginDiag() {
  const d = state.diag;
  const real = NATIVE.on && !state.fakeLogin;
  const modeTxt = d ? (d.mode === 'real' ? '진짜 카카오 로그인 (카카오 서버에 확인함)' : '흉내 모드 — 카카오 서버에 연결하지 않았어요') : (real ? '진짜 카카오 로그인' : '흉내 모드');
  const row = ([k, name, okT, failT]) => {
    const v = d && d.steps[k];
    const [cls, ic, txt] = v === 'ok' ? ['ok', 'check', okT] : v === 'fail' ? ['bad', 'x', failT] : v === 'sim' ? ['sim', 'info', '흉내'] : v === 'skip' ? ['skip', 'dot', '확인 안 함'] : ['skip', 'dot', '기록 없음'];
    return `<li class="dg-row dg-${cls}"><span class="dg-ic">${icon(ic)}</span><span class="dg-name">${name}</span><b>${txt}</b></li>`;
  };
  const failName = d && d.failStep ? (DIAG_STEPS.find(([k]) => k === d.failStep) || [])[1] : '';
  const time = d ? new Date(d.at) : null;
  const hhmmss = time ? `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}` : '';
  return sheetWrap(`${sheetHead('로그인 진단 (개발자용)', 'closeSheet', '실제로 어디까지 로그인됐는지 단계별로 확인해요')}
    <div class="sheet-body">
      <p class="dg-mode ${d && d.mode === 'real' ? 'real' : 'sim'}">${icon(d && d.mode === 'real' ? 'lock' : 'info')}${modeTxt}</p>
      ${d ? `<p class="hint">마지막 확인: ${DIAG_KIND[d.kind] || d.kind} · ${hhmmss}</p>` : '<p class="hint">아직 기록이 없어요. 아래 \'다시 확인\'을 눌러 주세요.</p>'}
      <ul class="dg-list">${DIAG_STEPS.map(row).join('')}</ul>
      ${d && d.failStep ? `<div class="notice err dg-fail">${icon('alert')}<div><b>${failName} 단계에서 멈췄어요</b><p>코드 ${esc(d.code || '')}${d.msg ? ' · ' + esc(d.msg) : ''}</p></div></div>` : ''}
      <dl class="facts">
        <div><dt>카카오 회원번호</dt><dd>${d && d.kakaoId ? esc(d.kakaoId) : '-'}</dd></div>
        <div><dt>토큰 남은 시간</dt><dd>${d && d.expiresIn ? fmtDur(Math.round(d.expiresIn / 60)) : '-'}</dd></div>
        <div><dt>잡도리 세션</dt><dd>${state.session ? (state.session.expired ? '만료' : `있음 · ${state.session.method || ''}`) : '없음'}</dd></div>
      </dl>
      <p class="fine dark">액세스 토큰·리프레시 토큰 같은 인증 값은 화면과 기록에 남기지 않아요. 카카오 회원번호는 이 화면에서만 보여요.</p>
    </div>
    <div class="sheet-foot"><div class="two"><button class="btn secondary" data-act="closeSheet">닫기</button><button class="btn primary" data-act="diagRecheck" ${ui.diagBusy ? 'aria-busy="true" disabled' : ''}>${icon('repeat')}${ui.diagBusy ? '확인 중…' : '다시 확인'}</button></div></div>`);
}

Object.assign(ACT, {
  openDiag: () => { openSheet({ type: 'diag' }); },
  diagRecheck: async () => {
    if (ui.diagBusy) return;
    ui.diagBusy = true; render();
    let r;
    if (NATIVE.on && !state.fakeLogin) {
      r = await checkRealLogin('recheck');
      // 카카오 쪽 인증이 확실히 끝났으면(네트워크 문제 제외) 앱 세션도 만료로 돌린다
      if (!r.ok && state.session && state.session.real && ['token', 'me', 'kakaoId'].includes(r.failStep) && !r.network) {
        state.session = { ...state.session, expired: true }; ui.login = { busy: false, error: 'tokenExpired' };
      }
    } else r = { ok: checkFakeLogin('recheck') };
    ui.diagBusy = false;
    save(); render();
    toast(r.ok ? '모든 단계가 확인됐어요.' : '멈춘 단계를 확인해 주세요.');
  },
});
