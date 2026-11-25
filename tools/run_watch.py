"""딴짓 감지(실제 앱 사용) 검수 — 안드로이드 플러그인은 흉내, 웹 코드 흐름만 확인.
코틀린 서비스(사용 정보 읽기·알림·앞으로 불러오기)는 여기서 검사할 수 없고 CI 컴파일 + 실제 폰에서 확인해야 한다."""
import json
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/www/index.html'
OUT = '/home/claude/jabdori-app/shots/watch'
import os; os.makedirs(OUT, exist_ok=True)
log, errors = [], []
def check(name, cond, extra=None): log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra is not None and not cond else ''))

MOCK = r"""
(() => {
  const calls = []; window.__calls = calls;
  const cfg = window.__cfg = Object.assign({ configured: true, talk: true, hasToken: false, loginError: null, meError: null, tokenError: null, perm: 'granted', usage: false, overlay: false, installed: ['com.google.android.youtube', 'com.instagram.android'] }, JSON.parse(localStorage.getItem('__cfg') || '{}'));
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
    Distraction: {
      status: () => ({ usageAccess: cfg.usage, overlay: cfg.overlay, watching: !!window.__watching }),
      openUsageSettings: () => { (window.__opened = window.__opened || []).push('usage'); return {}; },
      openOverlaySettings: () => { (window.__opened = window.__opened || []).push('overlay'); return {}; },
      installed: (o) => ({ apps: o.packages.filter((p) => cfg.installed.includes(p)).map((p) => ({ id: p, label: p })) }),
      start: (o) => { if (!cfg.usage) throw { code: 'NO_USAGE_ACCESS', message: 'no usage' }; window.__watching = o; window.__starts = (window.__starts || 0) + 1; return {}; },
      stop: () => { window.__watching = null; window.__stops = (window.__stops || 0) + 1; return {}; },
      pending: () => { const e = window.__pendingEvents || []; window.__pendingEvents = []; return { events: e }; },
    },
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
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR', timezone_id='Asia/Seoul')
    ctx.add_init_script(MOCK)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    ev = lambda code: (lambda r: (pg.wait_for_timeout(150), r)[1])(pg.evaluate(code))
    resume = lambda: (ev("(window.__listeners['App:resume']||[]).forEach(f => f({}))"), pg.wait_for_timeout(500))
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800)
    if pg.query_selector('[data-act=onbSkip]'): pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)

    # ---------- 1) 나 탭 설정 ----------
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(400)
    t = pg.inner_text('#app')
    check('나 첫 화면: 알림·딴짓 감지 메뉴 (딴짓 감지 꺼짐)', '알림·딴짓 감지' in t and '딴짓 감지 꺼짐' in t and ev("watchPrefs().on") is False, t)
    pg.click('[data-act=meOpen][data-v=alerts]'); pg.wait_for_timeout(400)
    t = pg.inner_text('#app')
    check('나 > 알림·딴짓 감지: 딴짓 감지 구역', '딴짓 감지' in t and pg.query_selector('[data-act=watchToggle]') is not None)
    pg.click('[data-act=watchToggle]'); pg.wait_for_timeout(700)
    check('켜면 권한 없을 때 사용 정보 접근 설정을 엶', 'usage' in (ev('window.__opened') or []))
    check('권한 줄: 사용 정보 접근 "허용하러 가기"', pg.query_selector('[data-act=watchOpenUsage]') is not None)
    ev("window.__cfg.usage = true; window.__cfg.overlay = true"); resume()
    t = pg.inner_text('#app')
    check('설정에서 돌아오면 허용됨으로 바뀜', pg.query_selector('[data-act=watchOpenUsage]') is None and pg.query_selector('[data-act=watchOpenOverlay]') is None and '허용됨' in t)
    check('지켜볼 앱: 이 폰에 깔린 것만 (유튜브·인스타그램)', ev("[...document.querySelectorAll('[data-act=watchApp]')].map(b => b.textContent)") == ['유튜브', '인스타그램'], ev("[...document.querySelectorAll('[data-act=watchApp]')].map(b => b.textContent)"))
    check('알리는 때 기본 1분 뒤', ev("watchPrefs().delay") == 60 and '1분 뒤' in pg.inner_text('[data-act=watchDelay].on'))
    pg.screenshot(path=f'{OUT}/01_me_watch.png', full_page=False)
    pg.evaluate("document.querySelector('.watch-perm').scrollIntoView()"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}/02_me_watch_section.png')
    check('지켜볼 잡도리가 없으면 감시 안 함', not ev('window.__watching'))

    # ---------- 2) 지각(시작 전) 잡도리 → 감시 시작 ----------
    ev("""(() => { const m = member(); const d = new Date(now()); const s = d.getHours() * 60 + d.getMinutes();
      m.tasks = [migrateTask({ id: 'w1', type: 'jab', title: '자료구조 과제', date: today(), start: minToHm(Math.max(0, s - 20)), endDate: today(), end: '23:55', heat: 40, repeat: { kind: 'none' }, alarms: [], memo: '', deadline: null })];
      save(); render(); })()""")
    pg.wait_for_timeout(600)
    w = ev('window.__watching')
    check('지각 중이면 감시 시작', bool(w) and w['packages'] == ['com.google.android.youtube', 'com.instagram.android'] and w['delaySec'] == 60, w)
    check('감시 알림 문구에 일정 이름', bool(w) and '자료구조 과제' in w['watchTitle'] and '1분' in w['watchText'], w and (w['watchTitle'], w['watchText']))
    check('감시 끝 시각 = 일정 종료', bool(w) and abs(w['untilMs'] - ev("at(today(), '23:55')")) < 1000, w and w['untilMs'])
    starts = ev('window.__starts')
    ev('render()'); pg.wait_for_timeout(400)
    check('같은 설정이면 다시 부르지 않음', ev('window.__starts') == starts)
    pg.click('[data-act=watchDelay][data-v="0"]'); pg.wait_for_timeout(500)
    check('알리는 때를 바꾸면 새 설정으로 다시 시작', ev('window.__starts') == starts + 1 and ev('window.__watching.delaySec') == 0 and '바로' in ev('window.__watching.watchText'))

    # ---------- 3) 지각 중 감지 → '지금 시작할게' 팝업 ----------
    ev("(window.__listeners['Distraction:distraction']||[]).forEach(f => f({ pkg: 'com.google.android.youtube', app: '유튜브', at: Date.now(), usedSec: 3 }))")
    pg.wait_for_timeout(400)
    check('지각 중 감지 → 시작 전 팝업', ev("ui.popup && ui.popup.type") == 'slackLate' and '아직 시작 전' in pg.inner_text('#layer-popup') and '유튜브' in pg.inner_text('#layer-popup'))
    check('실제 감지 팝업에는 "시뮬레이션" 없음', '시뮬레이션' not in pg.inner_text('#layer-popup'))
    pg.screenshot(path=f'{OUT}/03_late_popup.png')
    pg.click('[data-act=slackLateStart]'); pg.wait_for_timeout(700)
    check('"지금 시작할게" → 잡도리 시작 + 집중 화면', ev("ui.popup") is None and ev("runningOcc(member()) && runningOcc(member()).task.id") == 'w1' and ev('ui.focusKey') is not None)
    pg.wait_for_timeout(300)
    check('진행 중으로 바뀌면 감시 다시 맞춤', bool(ev('window.__watching')) and ev('window.__starts') >= starts + 2)

    # ---------- 4) 진행 중 감지 → 딴짓 팝업 + 기록 ----------
    t0 = ev('Date.now()')
    ev(f"(window.__listeners['Distraction:distraction']||[]).forEach(f => f({{ pkg: 'com.instagram.android', app: '인스타그램', at: {t0}, usedSec: 70 }}))")
    pg.wait_for_timeout(400)
    check('진행 중 감지 → 딴짓 팝업', ev("ui.popup && ui.popup.type") == 'slack' and '인스타그램' in pg.inner_text('#layer-popup') and '시뮬레이션' not in pg.inner_text('#layer-popup'))
    check('딴짓 기록 1회 (실제 감지 표시)', ev("runningOcc(member()).run.slack.length") == 1 and ev("runningOcc(member()).run.slack[0].real") is True)
    pg.screenshot(path=f'{OUT}/04_run_popup.png')
    # 같은 감지가 앱 복귀 때 pending으로 또 와도 한 번만
    ev(f"window.__pendingEvents = [{{ pkg: 'com.instagram.android', app: '인스타그램', at: {t0}, usedSec: 70 }}]")
    pg.click('[data-act=slackChoose][data-v=study]'); pg.wait_for_timeout(400)
    pg.click('[data-act=popupClose]'); pg.wait_for_timeout(300)
    resume()
    check('같은 감지는 두 번 묻지 않음', ev("ui.popup") is None and ev("runningOcc(member()).run.slack.length") == 1)
    check('"공부 중이야" 동안은 조용히 (quietUntil 전달)', ev('window.__watching.quietUntilMs') >= ev("runningOcc(member()).run.studyUntil") - 1000)
    ev(f"(window.__listeners['Distraction:distraction']||[]).forEach(f => f({{ pkg: 'com.google.android.youtube', app: '유튜브', at: {t0} + 5000 }}))")
    pg.wait_for_timeout(300)
    check('공부 중 확인 시간 안의 감지는 팝업 없음', ev("ui.popup") is None and ev("runningOcc(member()).run.slack.length") == 1)

    # ---------- 5) 앱이 꺼져 있던 동안 감지 → 복귀 때 pending으로 ----------
    ev("runningOcc(member()).run.studyUntil = null; save()")
    ev(f"window.__pendingEvents = [{{ pkg: 'com.google.android.youtube', app: '유튜브', at: {t0} + 9000 }}]")
    resume()
    check('복귀하면 그동안의 감지를 물어봄', ev("ui.popup && ui.popup.type") == 'slack' and '유튜브' in pg.inner_text('#layer-popup'))
    pg.click('[data-act=slackChoose][data-v=focus]'); pg.wait_for_timeout(300); pg.click('[data-act=popupClose]'); pg.wait_for_timeout(300)

    # ---------- 6) 지켜볼 앱 모두 끄기 / 잡도리 끝 / 기능 끄기 → 감시 멈춤 ----------
    stops = ev('window.__stops') or 0
    ev("(() => { const st = runningOcc(member()); member().runs[st.key].status = 'done'; member().runs[st.key].endedAt = now(); ui.focusKey = null; save(); render(); })()")
    pg.wait_for_timeout(500)
    check('잡도리가 끝나면 감시 멈춤', (ev('window.__stops') or 0) > stops and not ev('window.__watching'))
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    pg.click('[data-act=meOpen][data-v=alerts]'); pg.wait_for_timeout(300)
    pg.click('[data-act=watchToggle]'); pg.wait_for_timeout(300)
    check('기능 끄면 설정 줄 숨김', pg.query_selector('[data-act=watchDelay]') is None and ev('watchPrefs().on') is False)

    # ---------- 7) 시연 콘솔 딴짓 버튼은 그대로 '시뮬레이션' ----------
    check('시연용 처리 함수 공유', ev("typeof slackDetected") == 'function')
    b.close()

print('\n'.join(log)); print('errors:', errors[:5]); print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
