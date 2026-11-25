"""아이폰 앱(Capacitor iOS) 환경을 브라우저에서 흉내 내 아이폰 전용 분기를 검사한다.
- window.webkit.messageHandlers.bridge 를 넣으면 Capacitor가 플랫폼을 'ios'로 본다.
- 실제 아이폰 빌드(Swift 컴파일, 카카오 서버)는 여기서 검사할 수 없다 (GitHub macOS 빌드에서 컴파일만 확인).
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

# 안드로이드 흉내(run_native_mock.py)의 MOCK 문자열을 그대로 가져와 플랫폼만 바꾼다
_src = (Path(__file__).resolve().parent / 'run_native_mock.py').read_text(encoding='utf-8')
class base: MOCK = re.search(r'MOCK = r"""(.*?)"""', _src, re.S).group(1)

URL = 'file:///home/claude/jabdori-app/www/index.html'
log, errors = [], []
def check(name, cond, extra=None): log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra is not None and not cond else ''))

MOCK = base.MOCK.replace("window.androidBridge = { postMessage() {} };", "window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };") \
    .replace("keyHash: '+NLMMnMAs9uu+AA/aQ5qYLC3q6U=', packageName: 'com.jabdori.app' }", "keyHash: '', packageName: 'com.jabdori.app', platform: 'ios' }")
assert 'webkit' in MOCK and "platform: 'ios'" in MOCK

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR')
    ctx.add_init_script(MOCK)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    ev = lambda code: (lambda r: (pg.wait_for_timeout(150), r)[1])(pg.evaluate(code))
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)

    check('아이폰으로 인식', ev('NATIVE.on && NATIVE.ios && NATIVE.platform') == 'ios')
    check('html에 pf-ios 표시', ev("document.documentElement.classList.contains('pf-ios')"))
    check('딴짓 감지 플러그인 없음 (아이폰)', ev('NATIVE.Watch') is None)
    check('진단 1단계 이름: 번들 ID', '번들 ID' in ev('DIAG_STEPS[0][1]'))

    # 카카오 키 없음 → 안내에 번들 ID
    ev("localStorage.setItem('__cfg', JSON.stringify({configured:false})); window.__cfg.configured = false")
    pg.click('.btn-kakao'); pg.wait_for_timeout(900)
    lg = ev('ui.login')
    check('키 없음 안내: 번들 ID 표시, 키 해시 없음', lg.get('error') == 'notConfigured' and lg.get('detail', '').startswith('번들 ID com.jabdori.app') and '키 해시' not in lg.get('detail', ''), lg)
    # 카카오 앱 설정 오류 → 아이폰 안내
    ev("window.__cfg.configured = true; localStorage.removeItem('__cfg'); window.__cfg.loginError = { code: 'AUTH_Misconfigured', message: 'misconfigured' }")
    ev("ui.login = { busy: false }; render()")
    pg.click('.btn-kakao'); pg.wait_for_timeout(900)
    t = pg.inner_text('.login')
    check('설정 오류 안내: iOS 플랫폼·번들 ID', ev('ui.login.error') == 'keyHash' and '번들 ID' in t and 'gradle' not in t, t[:200])

    # 정상 로그인
    ev("window.__cfg.loginError = null; ui.login = { busy: false }; render()")
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800)
    check('카카오 로그인 성공 (같은 플러그인 이름 KakaoLogin)', ev('state.session && state.session.real') is True)
    pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(500)

    # 알림: 아이폰은 앱당 예약 64개까지 → 60개 이하로 자름
    ev("""(() => { const m = member(); for (let i = 0; i < 30; i++) { const d = new Date(Date.now() + (2 + i) * 3600e3);
      m.tasks.push({ id: uid('t'), type: 'jab', title: '과제' + i, date: ymd(d.getTime()), repeat: { kind: 'daily' }, start: String(d.getHours()).padStart(2,'0') + ':00', duration: 30, heat: 50, alarms: [10], createdAt: now() }); }
      save(); render(); })()""")
    pg.wait_for_timeout(1200)
    n = len(pg.evaluate('window.__scheduled || []'))
    check('알림 예약 64개 이하', 0 < n <= 64, n)

    # 나 탭
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(700)
    t = pg.inner_text('#app')
    check('나: 아이폰 앱 문구', '잡도리 아이폰 앱' in t and '잡도리 안드로이드 앱' not in t)
    check('나 첫 화면: 아이폰은 "알림" 메뉴 (딴짓 감지 없음)', ev("document.querySelector('[data-act=meOpen][data-v=alerts] b').textContent") == '알림', t)
    pg.click('[data-act=meOpen][data-v=alerts]'); pg.wait_for_timeout(400)
    t = pg.inner_text('#app')
    check('나 > 알림: 딴짓 감지는 아이폰에서 안 된다는 안내', '딴짓 감지' in t and '아이폰에서는 쓸 수 없어요' in t, t[-600:])
    check('나 > 알림: 딴짓 감지 스위치·권한 버튼 없음', pg.query_selector('[data-act=watchToggle]') is None and pg.query_selector('[data-act=watchOpenUsage]') is None)
    ev("NOTIF.perm = 'denied'; state.notifOff = false; render()")
    t = pg.inner_text('#app')
    check('알림 꺼짐 안내: 아이폰 설정 경로', '아이폰 설정 > 알림 > 잡도리' in t and '애플리케이션' not in t)
    ev("NOTIF.perm = 'granted'; render()")

    # 음성 설치 안내
    ev("TTS.install()"); pg.wait_for_timeout(200)
    check('음성 설치: 아이폰 설정 경로 안내', '읽기 및 말하기' in pg.inner_text('body'))

    calls = pg.evaluate('window.__calls')
    check('Distraction 플러그인을 한 번도 부르지 않음', not any(c.startswith('Distraction') for c in calls))
    check('openInstall(안드로이드 전용) 부르지 않음', not any('openInstall' in c for c in calls))
    pg.screenshot(path='/home/claude/jabdori-app/shots/ios_me.png')
    b.close()

print('\n'.join(log))
print('errors:', errors)
print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
