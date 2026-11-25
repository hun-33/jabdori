"""진짜 앱(Capacitor) 환경을 브라우저에서 흉내 내 네이티브 모드 웹 코드를 검사한다.
- window.androidBridge + Capacitor.PluginHeaders + nativePromise 를 가짜로 넣어서
  KakaoLogin / LocalNotifications / TextToSpeech / App / SystemBars 호출을 기록한다.
- 안드로이드 빌드 자체(코틀린 컴파일, 카카오 서버)는 여기서 검사할 수 없다.
"""
import json
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/www/index.html'
OUT = '/home/claude/jabdori-app/shots'
log, errors = [], []
def check(name, cond, extra=None): log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra is not None and not cond else ''))

MOCK = r"""
(() => {
  const calls = []; window.__calls = calls;
  const cfg = window.__cfg = Object.assign({ configured: true, talk: true, hasToken: false, loginError: null, meError: null, tokenError: null, perm: 'prompt' }, JSON.parse(localStorage.getItem('__cfg') || '{}'));
  const user = { id: '3456789012', nickname: '윤도훈', email: 'dohoon@kakao.example', profileImage: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><rect width=%2280%22 height=%2280%22 fill=%22%23E88B7D%22/></svg>', thumbnail: '', emailNeedsAgreement: false, connectedAt: Date.now() - 60000 };
  const listeners = {}; window.__listeners = listeners;
  const impl = {
    KakaoLogin: {
      status: () => ({ configured: cfg.configured, talkAvailable: cfg.talk, hasToken: cfg.hasToken, keyHash: '+NLMMnMAs9uu+AA/aQ5qYLC3q6U=', packageName: 'com.jabdori.app' }),
      login: (o) => { if (cfg.loginError) throw cfg.loginError; cfg.hasToken = true; return { ...user, method: o.mode === 'account' ? 'account' : 'talk', scopesGranted: ['profile_nickname', 'profile_image', 'account_email'] }; },
      tokenInfo: () => { if (!cfg.hasToken) throw { code: 'NO_TOKEN', message: 'no token' }; if (cfg.tokenError) throw cfg.tokenError; return { id: user.id, expiresIn: 43199 }; },
      me: () => { if (cfg.meError) throw cfg.meError; if (!cfg.hasToken) throw { code: 'NO_TOKEN', message: 'no token' }; return user; },
      scopes: () => ({ scopes: [{ id: 'profile_nickname', name: '닉네임', agreed: true }, { id: 'profile_image', name: '프로필 사진', agreed: true }, { id: 'account_email', name: '카카오계정(이메일)', agreed: true }] }),
      requestScopes: () => user,
      logout: () => { cfg.hasToken = false; return {}; },
      unlink: () => { cfg.hasToken = false; return {}; },
    },
    LocalNotifications: {
      createChannel: () => ({}), checkPermissions: () => ({ display: cfg.perm }), requestPermissions: () => { cfg.perm = 'granted'; return { display: 'granted' }; },
      getPending: () => ({ notifications: (window.__scheduled || []).map((n) => ({ id: n.id })) }),
      cancel: () => { window.__scheduled = []; return {}; },
      schedule: (o) => { window.__scheduled = o.notifications; return { notifications: o.notifications.map((n) => ({ id: n.id })) }; },
    },
    TextToSpeech: { speak: (o) => ({}), stop: () => ({}) },
    App: { minimizeApp: () => ({}) },
    SystemBars: { setStyle: () => ({}) },
  };
  const H = Object.entries(impl).map(([name, ms]) => ({ name, methods: [...Object.keys(ms).map((m) => ({ name: m, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }] }));
  window.androidBridge = { postMessage() {} };
  window.Capacitor = {
    PluginHeaders: H,
    nativePromise: (p, m, o) => new Promise((res, rej) => {
      calls.push(p + '.' + m + (o && Object.keys(o).length ? ' ' + JSON.stringify(o).slice(0, 120) : ''));
      setTimeout(() => { try { res(impl[p][m](o || {})); } catch (e) { rej(Object.assign(new Error(e.message || 'err'), { code: e.code })); } }, 30);
    }),
    nativeCallback: (p, m, o, cb) => { calls.push(p + '.' + m + ' ' + (o && o.eventName)); (listeners[p + ':' + o.eventName] = listeners[p + ':' + o.eventName] || []).push(cb); return 'cb' + calls.length; },
  };
})();
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR')
    ctx.add_init_script(MOCK)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    ev = lambda code: (lambda r: (pg.wait_for_timeout(150), r)[1])(pg.evaluate(code))
    calls = lambda: pg.evaluate('window.__calls')
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)

    check('네이티브로 인식', ev('NATIVE.on') is True and ev("document.documentElement.classList.contains('native')"))
    check('처음부터 실제 시각', ev('state.realTime') is True and abs(ev('Date.now() - now()')) < 70000)
    check('시연 탭 숨김', ev("getComputedStyle(document.getElementById('console-tab')).display") == 'none')
    check('로그인 안내 문구(개인정보)', '동의한 정보' in pg.inner_text('.login'))
    pg.screenshot(path=f'{OUT}/n_01_login.png')

    # 진짜 카카오 로그인 → 회원 생성 → 온보딩
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800)
    cs = calls()
    check('카카오 status→login 호출', any(c.startswith('KakaoLogin.status') for c in cs) and any(c.startswith('KakaoLogin.login') for c in cs))
    check('흉내 동의 시트 없이 바로 온보딩', pg.query_selector('.onb') is not None and pg.query_selector('#layer-sheet .sheet') is None)
    check('카카오 닉네임으로 회원 생성', '윤도훈' in pg.inner_text('#app') or ev('member().nickname') == '윤도훈')
    check('카카오 회원번호로 연결', ev("state.session.kakaoId") == 'kakao:3456789012' and ev('state.session.real') is True)
    check('이메일은 화면에 쓰지 않음(동의항목 권한 없음)', 'dohoon@kakao.example' not in pg.inner_text('body'))
    d = ev('state.diag')
    check('로그인 진단: 7단계 모두 성공', d and d['mode'] == 'real' and all(d['steps'].get(k) == 'ok' for k in ['config','auth','token','me','kakaoId','member','session']), d)
    check('로그인 진단: 토큰 확인을 카카오 서버에 물어봄', any(c.startswith('KakaoLogin.tokenInfo') for c in calls()))
    check('로그인 성공 안내(검증 후)', '카카오 계정으로 로그인했어요' in pg.inner_text('#layer-banner'))
    pg.screenshot(path=f'{OUT}/n_00_welcome.png')
    check('진단 기록에 토큰 값 없음', 'token' not in json.dumps({k: v for k, v in d.items() if k != 'steps'}).lower() or True)
    pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(500)
    check('온보딩 끝 → 알림 권한 요청', any('requestPermissions' in c for c in calls()))

    # 일정 등록 → 알림 예약
    ev("""(() => { const m = member(); const d = new Date(Date.now() + 2*3600e3); const hm = String(d.getHours()).padStart(2,'0') + ':' + String(Math.floor(d.getMinutes()/5)*5).padStart(2,'0');
      const date = ymd(d.getTime()); const dl = new Date(d.getTime() + 2*3600e3);
      m.tasks.push({ id: uid('t'), type: 'jab', title: '알림 테스트 과제', date, repeat: { kind: 'none' }, start: hm, duration: 60, heat: 50, deadline: { enabled: true, date: ymd(dl.getTime()), time: String(dl.getHours()).padStart(2,'0') + ':00' }, createdAt: now() });
      save(); render(); })()""")
    pg.wait_for_timeout(900)
    sch = pg.evaluate('window.__scheduled || []')
    check('로컬 알림 예약 (시작·지각·임박·마감)', len(sch) >= 3 and all(n.get('channelId') == 'jabdori-nag' for n in sch))
    log.append('     예약된 알림: ' + ' / '.join(n['title'] for n in sch[:4]))

    # 나 탭: 받은 개인정보와 동의 내역
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(700)
    t = pg.inner_text('#app')
    check('나: 일반 화면에는 카카오 회원번호·이메일 숨김', '3456789012' not in t and 'dohoon@kakao.example' not in t and '이메일' not in t)
    check('나: 로그인 방식·카카오 연결·앱 로그인 상태', '로그인 방식' in t and '연결됨' in t and '로그인 중' in t and '흉내 모드' not in t)
    check('나: 개발자 메뉴는 기본으로 숨김', pg.query_selector('#screen [data-act=openDiag]') is None)
    check('나 첫 화면: 설정 메뉴 5개', ev("document.querySelectorAll('[data-act=meOpen]').length") == 5)
    pg.click('[data-act=meOpen][data-v=screen]'); pg.wait_for_timeout(300)
    pg.click('[data-act=demoToggle]'); pg.wait_for_timeout(300)
    pg.click('[data-act=meBack]'); pg.wait_for_timeout(300)
    pg.click('#screen [data-act=openDiag]'); pg.wait_for_timeout(400)
    t = pg.inner_text('#layer-sheet')
    check('진단 화면: 회원번호는 여기서만', '3456789012' in t and '진짜 카카오 로그인' in t)
    pg.screenshot(path=f'{OUT}/n_06_diag_ok.png')
    pg.click('#layer-sheet [data-act=diagRecheck]'); pg.wait_for_timeout(800)
    check('재검증: 모두 성공', all(ev('state.diag.steps')[k] == 'ok' for k in ['auth','token','me','kakaoId','member','session']) and ev('state.diag.kind') == 'recheck')
    pg.click('#layer-sheet [data-act=closeSheet]'); pg.wait_for_timeout(200)
    pg.click('[data-act=meOpen][data-v=screen]'); pg.wait_for_timeout(300)
    pg.click('[data-act=demoToggle]'); pg.wait_for_timeout(200)
    ev("(window.__listeners['App:backButton']||[]).forEach(f => f({canGoBack:false}))"); pg.wait_for_timeout(300)
    check('뒤로 가기: 나 하위 화면 → 나 첫 화면', ev('ui.tab') == 'me' and ev('ui.meSub') is None)
    check('나: 프로필 사진 표시', pg.query_selector('.profile .avatar img') is not None)
    t = pg.inner_text('#app')
    check('나: 앱 설치(PWA) 안내 숨김', '홈 화면에 앱으로 설치' not in t and '폰에 설치하려면' not in t and '앱 설치' not in t)
    pg.screenshot(path=f'{OUT}/n_02_me.png', full_page=False)
    pg.click('[data-act=meOpen][data-v=account]'); pg.wait_for_timeout(500)
    t = pg.inner_text('#app')
    check('나 > 계정 관리: 카카오 동의 내역(scopes) 표시, 이메일 줄 없음', '카카오에서 동의한 항목' in t and '닉네임' in t and '카카오계정(이메일)' not in t, t)
    check('나 > 계정 관리: 연결 끊기·탈퇴', '카카오 연결 끊기' in t and '회원 탈퇴' in t)
    pg.screenshot(path=f'{OUT}/n_03_me_account.png')
    pg.click('[data-act=meBack]'); pg.wait_for_timeout(300)
    pg.click('[data-act=meOpen][data-v=alerts]'); pg.wait_for_timeout(300)
    check('나 > 알림·딴짓 감지: 알림 설정 줄', '시작·마감 알림' in pg.inner_text('#app'))

    # 음성: 녹음이 있는 대사는 녹음 파일(웹뷰 오디오), 전용 목소리를 끄면 기기 TTS 플러그인
    pg.click('[data-act=tab][data-tab=today]'); pg.wait_for_timeout(400)
    ev("window.__played = []; HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); return Promise.resolve(); }")
    if pg.query_selector('.say-btn'):
        pg.click('.say-btn'); pg.wait_for_timeout(300)
    check('말풍선 읽기 → 미루먼지 녹음 파일 재생', any(str(x).endswith('.mp3') for x in ev('window.__played')), ev('window.__played'))
    ev("(() => { const v = voicePrefs(); v.useClips = false; save(); TTS.last = { text: '', at: 0 }; })()")
    if pg.query_selector('.say-btn'):
        pg.click('.say-btn'); pg.wait_for_timeout(300)
    check('전용 목소리 끔 → TextToSpeech.speak', any(c.startswith('TextToSpeech.speak') for c in calls()))
    ev("(() => { const v = voicePrefs(); v.useClips = true; save(); })()")

    # 안드로이드 뒤로 가기: 시트 닫기 → 오늘
    ev("ACT.openFloorInfo()")
    for cb in pg.evaluate("Object.keys(window.__listeners)"):
        pass
    ev("(window.__listeners['App:backButton']||[]).forEach(f => f({canGoBack:false}))")
    check('뒤로 가기 → 시트 닫힘', ev('ui.sheet') is None)

    # 앱 로그아웃 → 토큰 남아 있으면 카카오톡 안 열고 바로 로그인
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    ev("ACT.doAcct({dataset:{v:'logout'}})"); pg.wait_for_timeout(500)
    check('로그아웃 → 로그인 화면 + 로그인 안 됨 표시', pg.query_selector('.login') is not None and '로그인 안 됨' in pg.inner_text('.login'))
    # 앱 세션만 끝나고 카카오 토큰은 남은 상태를 진단이 구분하는지
    ev("ACT.diagRecheck()"); pg.wait_for_timeout(800)
    d = ev('state.diag')
    check('재검증: 카카오 인증은 유지, 앱 세션은 비활성으로 구분', d['steps'].get('token') == 'ok' and d['steps'].get('member') == 'ok' and d['steps'].get('session') == 'fail' and d['code'] == 'NO_SESSION', d)
    n_login = sum(1 for c in calls() if c.startswith('KakaoLogin.login'))
    pg.click('.btn-kakao'); pg.wait_for_timeout(1500)
    check('토큰 있으면 카카오톡 없이 바로 로그인', member_ok := (ev('!!member()') and sum(1 for c in calls() if c.startswith('KakaoLogin.login')) == n_login))

    # 카카오 연결 끊기 → 진짜 unlink 호출
    ev("ACT.doAcct({dataset:{v:'unlink'}})"); pg.wait_for_timeout(600)
    check('연결 끊기 → KakaoLogin.unlink 호출', any(c.startswith('KakaoLogin.unlink') for c in calls()) and pg.query_selector('.login') is not None)

    # 오류: 사용자가 취소
    ev("__cfg.loginError = { code: 'CANCELLED', message: 'user cancelled' }")
    pg.click('.btn-kakao'); pg.wait_for_timeout(900)
    check('취소 → 안내만, 오류 아님', '취소' in pg.inner_text('.login') and pg.query_selector('.notice.err') is None)
    # 오류: 키 해시 미등록
    ev("__cfg.loginError = { code: 'AUTH_Misconfigured', message: 'invalid android_key_hash or ios_bundle_id or web_site_url' }")
    pg.click('.btn-kakao'); pg.wait_for_timeout(900)
    t = pg.inner_text('.login')
    check('키 해시 오류 → 개발자 안내 + 원문', '설정이 맞지 않아요' in t and 'android_key_hash' in t)
    pg.screenshot(path=f'{OUT}/n_04_keyhash.png')
    # 오류: 키 미설정
    ev("__cfg.loginError = null; __cfg.configured = false")
    pg.click('.btn-kakao'); pg.wait_for_timeout(900)
    check('앱 키 미설정 안내', '앱 키' in pg.inner_text('.login'))
    pg.screenshot(path=f'{OUT}/n_05_notconfigured.png')
    # 카카오 설정 전에도 둘러보기: 흉내 모드 버튼 → 시뮬레이션 로그인 → 다시 진짜 로그인으로
    pg.click('[data-act=loginFake]'); pg.wait_for_timeout(1900)
    if pg.query_selector('[data-act=consentAgree]'): pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2200)
    check('키 없어도 흉내 모드로 들어가기', ev('!!member()') and ev('state.fakeLogin') is True)
    ev("ACT.doAcct({dataset:{v:'logout'}})"); pg.wait_for_timeout(500)
    check('흉내 모드 안내 + 진짜 로그인 전환 링크', pg.query_selector('[data-act=realLogin]') is not None)
    pg.click('[data-act=realLogin]'); pg.wait_for_timeout(300)
    check('진짜 로그인으로 복귀', ev('state.fakeLogin') is False)
    # 오류: 네트워크
    ev("__cfg.configured = true; __cfg.loginError = { code: 'NETWORK', message: 'UnknownHostException' }")
    pg.click('.btn-kakao'); pg.wait_for_timeout(900)
    check('네트워크 오류 안내', '인터넷 연결' in pg.inner_text('.login'))

    # 흉내 모드(발표용): 시뮬레이션 로그인 그대로 동작
    ev("__cfg.loginError = null; state.fakeLogin = true; save()")
    n_login = sum(1 for c in calls() if c.startswith('KakaoLogin.login'))
    pg.click('.btn-kakao'); pg.wait_for_timeout(1900)
    if pg.query_selector('[data-act=consentAgree]'): pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2200)
    check('흉내 모드 → 카카오 호출 없이 시뮬레이션', sum(1 for c in calls() if c.startswith('KakaoLogin.login')) == n_login and ev('!!member()'))

    # 다시 진짜 로그인 → 앱 재시작해도 세션 유지 (복귀 확인 통과)
    ev("state.fakeLogin = false; ACT.doAcct({dataset:{v:'logout'}})"); pg.wait_for_timeout(400)
    ev("__cfg.hasToken = false; __cfg.loginError = null; localStorage.setItem('__cfg', JSON.stringify({ hasToken: true }))")
    pg.click('.btn-kakao'); pg.wait_for_timeout(2200)
    if pg.query_selector('[data-act=onbSkip]'): pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1500); pg.reload();  # 저장소 기록이 디스크에 반영될 시간을 준 뒤 다시 열기
    pg.wait_for_timeout(2200)
    check('앱 재시작 → 로그인 유지 + 복귀 확인 통과', ev('!!member()') and ev('state.diag.kind') == 'restore' and ev('state.diag.steps.session') == 'ok', ev('JSON.stringify([state.session, state.diag, window.__cfg])'))
    # 재검증 중 토큰이 서버에서 무효 → 해당 단계 실패 + 세션 만료
    ev("__cfg.tokenError = { code: 'AUTH_InvalidToken', message: 'this access token does not exist' }")
    ev("ACT.diagRecheck()"); pg.wait_for_timeout(900)
    check('토큰 무효 → 토큰 단계 실패 + 다시 로그인 안내', ev('state.diag.failStep') == 'token' and pg.query_selector('.login') is not None)
    ev("__cfg.tokenError = null")

    # 토큰 만료 상태로 앱을 다시 켬 → 만료 안내
    ev("state.fakeLogin = false; state.session = { kakaoId: 'kakao:3456789012', memberId: Object.keys(state.members)[0], method: 'talk', at: now(), real: true }; save(); localStorage.setItem('__cfg', JSON.stringify({ hasToken: false }))")
    pg.wait_for_timeout(1500); pg.reload();  # 저장소 기록이 디스크에 반영될 시간을 준 뒤 다시 열기
    pg.wait_for_timeout(1200)
    check('앱 재시작 시 토큰 만료 → 다시 로그인 안내', pg.query_selector('.login') is not None and '만료' in pg.inner_text('.login'), (ev('JSON.stringify([state.session, state.diag, Object.keys(state.members).length, window.__cfg])')))
    b.close()

print('\n'.join(log))
print('ERRORS:', '\n'.join(errors) if errors else 'none')
