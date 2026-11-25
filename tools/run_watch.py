"""딴짓 감지(실제 앱 사용) 검수 — 안드로이드 플러그인은 흉내, 웹 코드 흐름만 확인.
코틀린 서비스(사용 정보 읽기·알림·앞으로 불러오기)는 여기서 검사할 수 없고 CI 컴파일 + 실제 폰에서 확인해야 한다."""
import json, zlib, struct, base64
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/www/index.html'
OUT = '/home/claude/jabdori-app/shots/watch'
import os; os.makedirs(OUT, exist_ok=True)
HOOKS = __import__('pathlib').Path(__file__).resolve().parent / 'test_hooks.js'  # 검사 전용 도우미 (가상 시각·테스트 일정)
log, errors = [], []
def check(name, cond, extra=None): log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra is not None and not cond else ''))

def png(rgb):  # 작은 단색 PNG (흉내 앱 아이콘)
    w = h = 8
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')).decode()
APPS = [  # 이 폰의 앱 서랍 (네이티브처럼 이름순)
    ('com.supercell.brawlstars', '브롤스타즈', 'game', (240, 190, 40)),
    ('com.google.android.youtube', 'YouTube', 'video', (230, 40, 40)),
    ('com.instagram.android', 'Instagram', 'social', (200, 60, 150)),
    ('com.discord', 'Discord', 'social', (90, 100, 240)),
    ('com.sec.android.app.popupcalculator', '계산기', '', (90, 90, 90)),
    ('com.kakao.talk', '카카오톡', 'social', (250, 225, 0)),
    ('com.spotify.music', 'Spotify', 'audio', (30, 200, 90)),
]
APPS_JS = json.dumps([{'id': i, 'label': l, 'category': c, 'icon': png(rgb)} for i, l, c, rgb in APPS], ensure_ascii=False)

MOCK = r"""
(() => {
  const calls = []; window.__calls = calls;
  const cfg = window.__cfg = Object.assign({ configured: true, talk: true, hasToken: false, loginError: null, meError: null, tokenError: null, perm: 'granted', usage: false, overlay: false, installed: __APPS__.map((a) => a.id) }, JSON.parse(localStorage.getItem('__cfg') || '{}'));
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
      apps: (o) => ({ apps: __APPS__.filter((a) => cfg.installed.includes(a.id)).map((a) => ({ ...a, icon: o.iconSize === 0 ? undefined : a.icon })) }),
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
""".replace('__APPS__', APPS_JS)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR', timezone_id='Asia/Seoul')
    ctx.add_init_script(path=str(HOOKS))
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
    check('앱 목록은 아이콘 없이 가볍게 먼저 읽음', any(c.startswith('Distraction.apps') and '"iconSize":0' in c for c in ev('window.__calls')), [c for c in ev('window.__calls') if 'apps' in c])
    row = pg.query_selector('[data-act=meOpen][data-v=watchApps]')
    check('지켜볼 앱 줄: 개수와 이름 (폰에 보이는 이름)', row is not None and '2개 앱을 지켜보는 중' in row.inner_text() and 'YouTube, Instagram' in row.inner_text(), row and row.inner_text())
    check('예전 칩 목록 없음', pg.query_selector('.chip[data-act=watchApp]') is None)
    check('다른 앱 위 표시 설명: 미루먼지 창', '미루먼지 창이 떠서' in pg.inner_text('#app'))

    # ---------- 1b) 지켜볼 앱 화면 (이 폰의 앱 전부) ----------
    row.click(); pg.wait_for_timeout(700)
    check('지켜볼 앱 화면 열림 + 아이콘까지 읽음', ev('ui.meSub') == 'watchApps' and any(c.startswith('Distraction.apps') and '"iconSize":96' in c for c in ev('window.__calls')))
    names = ev("[...document.querySelectorAll('.app-row b')].map(b => b.textContent)")
    check('앱 서랍의 앱 전부 (7개, 이름순 그대로)', names == [a[1] for a in APPS], names)
    check('아이콘은 blob 주소 그림', ev("[...document.querySelectorAll('.app-row img.app-ic')].filter(i => i.src.startsWith('blob:')).length") == 7)
    check('아이콘이 실제로 그려짐', ev("[...document.querySelectorAll('.app-row img.app-ic')].every(i => i.complete && i.naturalWidth === 8)"))
    sub = lambda pkg: ev(f"(document.querySelector('[data-v=\"{pkg}\"]').closest('.app-row').querySelector('small') || {{}}).textContent || ''")
    check('줄 설명: 알려진 딴짓 앱 · 분류', sub('com.google.android.youtube') == '자주 딴짓하는 앱 · 동영상' and sub('com.supercell.brawlstars') == '게임' and sub('com.sec.android.app.popupcalculator') == '', [sub('com.google.android.youtube'), sub('com.supercell.brawlstars')])
    sw = lambda pkg: ev(f"document.querySelector('[data-act=watchApp][data-v=\"{pkg}\"]').getAttribute('aria-checked')")
    check('기본: 유튜브·인스타 켜짐, 디스코드·카톡 꺼짐', [sw('com.google.android.youtube'), sw('com.instagram.android'), sw('com.discord'), sw('com.kakao.talk')] == ['true', 'true', 'false', 'false'])
    check('구분선 + 스위치 구조', ev("document.querySelectorAll('.app-row .app-sep + .switch').length") == 7)
    check('개수 표시', '2개 앱을 지켜보는 중' in pg.inner_text('#wa-count'))
    pg.screenshot(path=f'{OUT}/01b_watch_apps.png')
    ev("document.querySelector('.app-list').dataset.mark = '1'")
    pg.click('[data-act=watchApp][data-v="com.discord"]'); pg.wait_for_timeout(300)
    check('스위치: 그 줄만 바뀜 (목록 다시 안 그림)', ev("document.querySelector('.app-list').dataset.mark") == '1' and sw('com.discord') == 'true' and ev("watchPrefs().apps['com.discord']") is True)
    check('스위치: 개수 바로 갱신 + 이름 저장', '3개' in pg.inner_text('#wa-count') and ev("watchPrefs().labels['com.discord']") == 'Discord')
    ev('render()'); pg.wait_for_timeout(200)
    check('다른 이유로 render() 해도 그대로 (깜빡임 없음)', ev("document.querySelector('.app-list').dataset.mark") == '1')
    pg.click('#app-q'); pg.keyboard.type('카카'); pg.wait_for_timeout(250)
    vis = ev("[...document.querySelectorAll('.app-row')].filter(r => !r.hidden).map(r => r.querySelector('b').textContent)")
    check('검색: 이름으로 걸러짐', vis == ['카카오톡'], vis)
    ev('render()'); pg.wait_for_timeout(200)
    check('검색 중 render() 해도 글자·포커스 유지', ev("document.activeElement && document.activeElement.id") == 'app-q' and ev("document.querySelector('#app-q').value") == '카카')
    pg.screenshot(path=f'{OUT}/01c_watch_apps_search.png')
    pg.fill('#app-q', 'youtube'); pg.wait_for_timeout(200)
    check('검색: 영문 대소문자 무시', ev("[...document.querySelectorAll('.app-row')].filter(r => !r.hidden).length") == 1)
    pg.fill('#app-q', '없는앱'); pg.wait_for_timeout(200)
    check('검색 결과 없으면 안내', ev("document.querySelector('#wa-none').hidden") is False and ev("[...document.querySelectorAll('.app-row')].filter(r => !r.hidden).length") == 0)
    pg.fill('#app-q', ''); pg.wait_for_timeout(200)
    pg.click('[data-act=watchApp][data-v="com.discord"]'); pg.wait_for_timeout(200)
    check('뒤로 버튼 이름: 알림·딴짓 감지로', ev("document.querySelector('[data-act=meBack]').getAttribute('aria-label')") == '알림·딴짓 감지로 돌아가기')
    pg.click('[data-act=meBack]'); pg.wait_for_timeout(400)
    check('뒤로 → 알림·딴짓 감지 화면', ev('ui.meSub') == 'alerts' and '2개 앱을 지켜보는 중' in pg.inner_text('[data-v=watchApps]'))
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
    check('미루먼지 창 켬 + 잡도리 앱으로 안 넘김', bool(w) and w.get('overlay') is True and w.get('bringToFront') is False, w and (w.get('overlay'), w.get('bringToFront')))
    check('시작 전 창 설정 (late · 둘째 줄)', bool(w) and w.get('late') is True and '{app}' in w.get('popInfo', '') and '자료구조 과제 시작 전' in w.get('popInfo', '') and len(w.get('popLine', '')) > 0, w and (w.get('late'), w.get('popInfo')))
    check('답 뒤 한마디 · 시간 전달', bool(w) and all(w.get('replies', {}).get(k) for k in ('study', 'rest', 'focus', 'later')) and w.get('studyMin') == 10 and w.get('restMin') == 5, w and w.get('replies'))
    check('이름은 이 폰에 보이는 이름 그대로', bool(w) and w['labels'] == {'com.google.android.youtube': 'YouTube', 'com.instagram.android': 'Instagram'}, w and w['labels'])
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
    w = ev('window.__watching')
    check('진행 중 창 설정 (late 아님 · 진행 중)', w.get('late') is False and '자료구조 과제 진행 중' in w.get('popInfo', ''), (w.get('late'), w.get('popInfo')))

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

    # ---------- 5b) 미루먼지 창(다른 앱 위)에서 답 → 앱 안 팝업 없이 기록만 ----------
    n0 = ev("runningOcc(member()).run.slack.length")
    t1 = ev('Date.now()')
    emit = lambda o: ev(f"(window.__listeners['Distraction:distraction']||[]).forEach(f => f({json.dumps(o, ensure_ascii=False)}))")
    emit({'type': 'detect', 'pkg': 'com.google.android.youtube', 'app': '유튜브', 'at': t1, 'usedSec': 61, 'overlay': True, 'late': False})
    pg.wait_for_timeout(300)
    check('창이 떴으면 앱 안 팝업 없음 + 딴짓 기록', ev("ui.popup") is None and ev("runningOcc(member()).run.slack.length") == n0 + 1 and ev("runningOcc(member()).run.slack.at(-1).nativeAt") == t1)
    check('기록 줄: 미루먼지 창 표시', '미루먼지 창' in ev("runningOcc(member()).run.log.map(l => l.text || l.msg || JSON.stringify(l)).join('|')"))
    emit({'type': 'choice', 'at': t1, 'choice': 'study', 'app': '유튜브', 'choiceAt': t1 + 4000})
    pg.wait_for_timeout(400)
    run = ev("runningOcc(member()).run")
    check('창에서 "공부 중이야" → 10분 확인 + 답 기록', abs(run['studyUntil'] - (t1 + 4000 + 600000)) < 1000 and run['slack'][-1]['choice'] == 'study', (run.get('studyUntil'), run['slack'][-1]))
    check('공부 확인 시간을 서비스에 다시 전달', ev('window.__watching.quietUntilMs') >= run['studyUntil'] - 1000)
    emit({'type': 'choice', 'at': t1, 'choice': 'study', 'app': '유튜브', 'choiceAt': t1 + 4000})
    pg.wait_for_timeout(200)
    check('같은 답이 또 와도 한 번만', ev("runningOcc(member()).run.log.filter(l => JSON.stringify(l).includes('공부 중이야') && JSON.stringify(l).includes('미루먼지 창')).length") == 1)
    # 앱이 꺼져 있던 동안: 감지(창) + 답이 pending으로 함께 옴
    ev("runningOcc(member()).run.studyUntil = null; save()")
    t2 = t1 + 20000
    ev(f"window.__pendingEvents = [{{ type: 'detect', pkg: 'com.instagram.android', app: '인스타그램', at: {t2}, overlay: true }}, {{ type: 'choice', at: {t2}, choice: 'rest', app: '인스타그램', choiceAt: {t2} + 3000 }}]")
    resume()
    run = ev("runningOcc(member()) && runningOcc(member()).run")
    check('복귀: 창에서 답한 감지는 다시 묻지 않음', ev("ui.popup") is None)
    check('복귀: 창에서 "잠깐 쉴게" → 5분 휴식 반영', bool(run) and run.get('brk') and abs(run['brk']['until'] - (t2 + 3000 + 300000)) < 1000 and run['slack'][-1]['choice'] == 'rest', run and run.get('brk'))
    ev("(() => { const r = runningOcc(member()).run; r.brk = null; save(); render(); })()")

    # ---------- 6) 지켜볼 앱 모두 끄기 / 잡도리 끝 / 기능 끄기 → 감시 멈춤 ----------
    stops = ev('window.__stops') or 0
    ev("(() => { const st = runningOcc(member()); member().runs[st.key].status = 'done'; member().runs[st.key].endedAt = now(); ui.focusKey = null; save(); render(); })()")
    pg.wait_for_timeout(500)
    check('잡도리가 끝나면 감시 멈춤', (ev('window.__stops') or 0) > stops and not ev('window.__watching'))
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    pg.click('[data-act=meOpen][data-v=alerts]'); pg.wait_for_timeout(300)
    pg.click('[data-act=watchToggle]'); pg.wait_for_timeout(300)
    check('기능 끄면 설정 줄 숨김', pg.query_selector('[data-act=watchDelay]') is None and ev('watchPrefs().on') is False)

    # ---------- 7) 시작 전 + 미루먼지 창 '지금 시작할게' → 잡도리 시작 ----------
    pg.click('[data-act=watchToggle]'); pg.wait_for_timeout(500)
    ev("""(() => { const m = member(); const d = new Date(now()); const s = d.getHours() * 60 + d.getMinutes();
      m.tasks.push(migrateTask({ id: 'w2', type: 'jab', title: '이산수학 복습', date: today(), start: minToHm(Math.max(0, s - 10)), endDate: today(), end: '23:56', heat: 40, repeat: { kind: 'none' }, alarms: [], memo: '', deadline: null }));
      save(); render(); })()""")
    pg.wait_for_timeout(600)
    w = ev('window.__watching')
    check('새 지각 잡도리 → 시작 전 창으로 감시', bool(w) and w.get('late') is True and '이산수학 복습 시작 전' in w.get('popInfo', ''), w and w.get('popInfo'))
    t3 = ev('Date.now()')
    emit({'type': 'detect', 'pkg': 'com.google.android.youtube', 'app': '유튜브', 'at': t3, 'overlay': True, 'late': True})
    pg.wait_for_timeout(300)
    check('시작 전 + 창: 앱 안 팝업 없음', ev("ui.popup") is None and not ev("runningOcc(member())"))
    emit({'type': 'choice', 'at': t3, 'choice': 'start', 'app': '유튜브', 'choiceAt': t3 + 2000})
    pg.wait_for_timeout(500)
    check('창에서 "지금 시작할게" → 잡도리 시작', ev("runningOcc(member()) && runningOcc(member()).task.id") == 'w2' and ev('ui.focusKey') is not None)
    check('처리 함수 공유', ev("typeof slackDetected") == 'function' and ev("typeof watchChoice") == 'function')
    b.close()

print('\n'.join(log)); print('errors:', errors[:5]); print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
