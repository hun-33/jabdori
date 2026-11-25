"""홈 화면 위젯(안드로이드) 화면 코드 검수 — 네이티브 Widget 플러그인은 흉내.
위젯에 넘기는 묶음(오늘 목록·다음 일정·미루먼지·기록), 위젯 체크 반영, 위젯에서 앱 열기, 로그아웃, 설정 화면을 본다.
RemoteViews 그리기·알람·크기별 배치(WidgetRender.kt)는 여기서 볼 수 없고 CI 컴파일 + 실제 폰에서 확인해야 한다."""
import json, os, pathlib
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/www/index.html'
OUT = '/home/claude/jabdori-app/shots/widget'; os.makedirs(OUT, exist_ok=True)
HOOKS = pathlib.Path(__file__).resolve().parent / 'test_hooks.js'
PNG_DIR = pathlib.Path(__file__).resolve().parent.parent / 'www/assets/mireum/png'
log, errors = [], []
def check(name, cond, extra=None): log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra is not None and not cond else ''))

MOCK = r"""
(() => {
  const calls = []; window.__calls = calls;
  const cfg = window.__cfg = Object.assign({ configured: true, talk: true, hasToken: false, loginError: null, meError: null, tokenError: null, perm: 'granted', usage: false, overlay: false, installed: [] }, JSON.parse(localStorage.getItem('__cfg') || '{}'));
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
      apps: () => ({ apps: [] }),
      start: (o) => { if (!cfg.usage) throw { code: 'NO_USAGE_ACCESS', message: 'no usage' }; window.__watching = o; window.__starts = (window.__starts || 0) + 1; return {}; },
      stop: () => { window.__watching = null; window.__stops = (window.__stops || 0) + 1; return {}; },
      pending: () => { const e = window.__pendingEvents || []; window.__pendingEvents = []; return { events: e }; },
    },
    App: { minimizeApp: () => ({}) },
    Widget: {
      update: (o) => { const s = JSON.parse(o.data); window.__wsnap = s; window.__wupdates = (window.__wupdates || 0) + 1; return {}; },
      pending: () => ({ actions: (window.__wactions || []).slice() }),
      ack: (o) => { window.__wacked = (window.__wacked || []).concat(o.ids || []); window.__wactions = (window.__wactions || []).filter((a) => !(o.ids || []).includes(a.id)); return {}; },
      consumeLaunch: () => { const t = window.__wlaunch; window.__wlaunch = null; return t ? { target: t } : {}; },
      status: () => ({ placed: { today: 1, next: 0, mireum: 2, stats: 0 }, pinSupported: true }),
      pin: (o) => { (window.__wpins = window.__wpins || []).push(o.kind); return { ok: true }; },
    },
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
    ctx.add_init_script(path=str(HOOKS))
    ctx.add_init_script(MOCK)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    ev = lambda code: (lambda r: (pg.wait_for_timeout(120), r)[1])(pg.evaluate(code))
    resume = lambda: (ev("(window.__listeners['App:resume']||[]).forEach(f => f({}))"), pg.wait_for_timeout(500))
    snap = lambda: ev('window.__wsnap')
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(700)

    # ---------- 1) 로그인 전 ----------
    s = snap()
    check('로그인 전: 일정 없는 묶음(login:false)', bool(s) and s['login'] is False and 'days' not in s, s)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800)
    if pg.query_selector('[data-act=onbSkip]'): pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)
    pg.wait_for_timeout(1600)
    s = snap()
    check('로그인하면 바로 일정 묶음(login:true, 7일)', s['login'] is True and len(s['days']) == 7 and s['today'] == ev('today()'), s and s.get('login'))
    check('일정이 없으면 오늘 목록 비어 있음 + hasTasks false', s['days'][s['today']] == [] and s['hasTasks'] is False)

    # ---------- 2) 일정 넣기 → 묶음에 반영 ----------
    ev("""(() => { const m = member(); const d = new Date(now()); const s = d.getHours() * 60 + d.getMinutes(); const td = today();
      const mk = (o) => migrateTask({ repeat: { kind: 'none' }, alarms: [], memo: '', deadline: null, date: td, endDate: td, createdAt: now() - 3600e3, ...o });
      m.tasks = [
        mk({ id: 'wj1', type: 'jab', title: '자료구조 과제', start: minToHm(Math.max(0, s - 20)), end: '23:50', heat: 40 }),
        mk({ id: 'wn1', type: 'normal', title: '편의점 아르바이트', start: minToHm(Math.min(1439, s + 30)), end: '23:58', heat: null, color: 'mint' }),
        mk({ id: 'wn2', type: 'normal', title: '엄마 생일', allDay: true, start: '00:00', end: '00:00', heat: null }),
        mk({ id: 'wj2', type: 'jab', title: '이산수학 복습', date: addDays(td, 1), endDate: addDays(td, 1), start: '09:00', end: '10:00', heat: 40 }),
        // 토요일에 시작해 다음 주 월요일까지 (주를 넘는 막대)
        mk({ id: 'wn3', type: 'normal', title: 'MT 숙소', allDay: true, date: addDays(weekStartOf(td), 6), endDate: addDays(weekStartOf(td), 8), start: '00:00', end: '00:00', heat: null, color: 'sun' }),
      ];
      save(); render(); })()""")
    pg.wait_for_timeout(1700)
    s = snap(); items = s['days'][s['today']]
    check('오늘 목록 = 앱 오늘 목록 (잡도리 먼저, 그다음 적어 둔 일)', [i['t'] for i in items] == ['자료구조 과제', '엄마 생일', '편의점 아르바이트'], [i['t'] for i in items])
    j = items[0]; n = [i for i in items if i['t'] == '편의점 아르바이트'][0]; ad = [i for i in items if i['ad']][0]
    check('잡도리 줄: j=true, 시간 글자, 색, 상태 todo', j['j'] is True and j['st'] == 'todo' and '–23:50' in j['tm'] and j['c'].startswith('#'), j)
    check('일반 줄: j=false, 고른 색(민트)', n['j'] is False and n['c'] == '#5FAE8E', n)
    check('종일 줄: ad=true, "종일"', ad['ad'] is True and ad['tm'] == '종일', ad)
    check('내일 잡도리는 내일 칸에', [i['t'] for i in s['days'][ev('addDays(today(),1)')]] == ['이산수학 복습'])
    # 달력 위젯 묶음
    cal = s['cal']; y, mo = map(int, s['today'].split('-')[:2])
    months = [f"{(y + (mo - 1 + k) // 12):04d}-{((mo - 1 + k) % 12) + 1:02d}" for k in range(-1, 4)]
    check('달력: 지난달 ~ 3달 뒤 (5달)', sorted(cal.keys()) == months, sorted(cal.keys()))
    cm = s['today'][:7]
    weeks_n = ev(f"(() => {{ const f = '{cm}-01', st = weekStartOf(f), [yy, mm] = '{cm}'.split('-').map(Number); return Math.ceil((daysBetween(st, f) + new Date(yy, mm, 0).getDate()) / 7); }})()")
    check('달력: 이번 달 주 수 = 앱 월간 달력과 같음', len(cal[cm]) == weeks_n and all(ev(f"weekday('{w['ws']}')") == 7 for w in cal[cm]), (len(cal[cm]), weeks_n))
    ws0 = ev('weekStartOf(today())'); wk = [w for w in cal[cm] if w['ws'] == ws0][0]
    app = ev(f"weekLanes(member(), '{ws0}').map(g => [g.col, g.span, g.lane, g.o.task.title])")
    check('달력: 이번 주 막대 = 앱 weekLanes (칸·길이·줄)', [x[:4] for x in wk['s']] == app, (wk['s'], app))
    mt = [x for x in wk['s'] if x[3] == 'MT 숙소']
    check('달력: 주를 넘는 막대는 토요일 한 칸 + 다음 주로 이어짐 표시', bool(mt) and mt[0][0] == 6 and mt[0][1] == 1 and mt[0][5] & 1 and mt[0][5] & 4, mt)
    nxt = [w for w in cal[ev(f"addDays('{ws0}', 7)").__str__()[:7]] if w['ws'] == ev(f"addDays('{ws0}', 7)")]
    mt2 = [x for x in nxt[0]['s'] if x[3] == 'MT 숙소'] if nxt else []
    check('달력: 다음 주 칸에는 일·월 2칸 + 지난주에서 이어짐', bool(mt2) and mt2[0][0] == 0 and mt2[0][1] == 2 and mt2[0][5] & 2, mt2)
    check('달력: 요일 칸마다 일정 수(n)', wk['n'][ev('weekday(today()) % 7')] >= 3, wk['n'])
    check('메모 같은 다른 내용은 넘기지 않음', all(set(i.keys()) <= {'k','t','j','ad','s','e','dl','st','bu','c','d','dn','dd','tm'} for i in items))
    md = s['mood']['list']
    check('미루먼지: 지금(30분 단위 시작)부터 미리 계산', len(md) >= 3 and md[0]['at'] <= ev('now()') and all(md[i]['at'] < md[i+1]['at'] for i in range(len(md)-1)), len(md))
    check('미루먼지: 지금은 지각 잡도리 표정·대사', any(e['kind'] == 'late' and e['key'] == j['k'] for e in md if e['at'] <= ev('now()')), [e['kind'] for e in md[:3]])
    check('미루먼지 그림 파일이 앱 안에 있음', all((PNG_DIR / (e['img'] + '.png')).exists() for e in md), sorted({e['img'] for e in md}))
    check('미루먼지 대사는 캐릭터 대사 목록에서', all(any(e['line'] in v if isinstance(v, list) else any(e['line'] in vv for vv in v.values()) for v in ev("Object.values(persona().lines).filter(x => Array.isArray(x) || (x && typeof x === 'object' && Object.values(x).every(Array.isArray)))")) for e in md if e['line']), [e['line'] for e in md[:3]])
    check('농도 이름·단위 함께', s['mood']['title'] == ev('scaleOf().title') and all('sname' in e for e in md))
    t = ev("(() => { const a = performance.now(); widgetSnapshot(); return performance.now() - a; })()")
    check('묶음 계산 시간 (일정 4개) 200ms 안', t < 200, t)
    check('두 번 계산해도 같은 내용 (대사를 무작위로 안 바꿈)', ev("(() => { const a = widgetSnapshot(), b = widgetSnapshot(); delete a.at; delete b.at; return JSON.stringify(a) === JSON.stringify(b); })()") is True)
    check('계산 뒤 앱 시각·대사 씨앗 원래대로', ev('LINE_SEED') is None and abs(ev('now()') - ev('Math.floor(Date.now()/60000)*60000')) <= 60000)
    ups = ev('window.__wupdates')
    ev('render(); save()'); pg.wait_for_timeout(1600)
    check('바뀐 게 없으면 다시 넘기지 않음', ev('window.__wupdates') == ups, (ups, ev('window.__wupdates')))

    # ---------- 3) 위젯에서 일반 일정 체크 → 앱에 반영 ----------
    key = n['k']
    ev(f"window.__wactions = [{{ id: 'a1', type: 'normalDone', key: {json.dumps(key)}, done: true, at: Date.now() - 60000 }}]; (window.__listeners['Widget:action']||[]).forEach(f => f({{}}))")
    pg.wait_for_timeout(900)
    check('위젯 체크 → 앱 기록에 완료', ev(f"member().runs[{json.dumps(key)}] && member().runs[{json.dumps(key)}].status") == 'done')
    check('완료 시각 = 위젯에서 누른 시각', abs(ev(f"member().runs[{json.dumps(key)}].endedAt") - ev('Date.now()') + 60000) < 5000)
    check('반영한 할 일은 확인(ack)', 'a1' in (ev('window.__wacked') or []) and not ev('window.__wactions'))
    s = snap()
    check('반영 뒤 새 묶음에도 완료', [i for i in s['days'][s['today']] if i['k'] == key][0]['st'] == 'done')
    check('앱 오늘 화면도 체크됨', ev(f"!!document.querySelector('.check.on[data-key={json.dumps(key)}]')"))
    ev(f"window.__wactions = [{{ id: 'a1', type: 'normalDone', key: {json.dumps(key)}, done: false, at: Date.now() }}]")
    resume()
    check('같은 id가 또 오면 무시', ev(f"member().runs[{json.dumps(key)}] && member().runs[{json.dumps(key)}].status") == 'done')
    ev(f"window.__wactions = [{{ id: 'a2', type: 'normalDone', key: {json.dumps(key)}, done: false, at: Date.now() }}]")
    resume()
    check('위젯에서 완료 취소 → 앱에서도 취소', not ev(f"member().runs[{json.dumps(key)}]"))
    ev(f"window.__wactions = [{{ id: 'a3', type: 'normalDone', key: {json.dumps(j['k'])}, done: true, at: Date.now() }}, {{ id: 'a4', type: 'normalDone', key: 'nope|2026-01-01', done: true, at: Date.now() }}, {{ id: 'a5', type: 'weird' }}]")
    resume()
    check('잡도리·지워진 일정·모르는 할 일은 반영 안 함', not ev(f"member().runs[{json.dumps(j['k'])}]") and not ev("member().runs['nope|2026-01-01']"))
    check('반영 못 한 것도 확인해서 쌓이지 않음 + 안내', all(x in ev('window.__wacked') for x in ['a3', 'a4', 'a5']) and '반영하지 못했어요' in pg.inner_text('#toast'), pg.inner_text('#toast'))

    # ---------- 4) 위젯을 눌러 앱 열기 ----------
    ev(f"window.__wlaunch = {json.dumps('open:' + n['k'])}"); resume()
    check('일반 일정 줄 → 그 일정 시트', ev("ui.sheet && ui.sheet.type") == 'task' and ev("ui.sheet.key") == n['k'])
    pg.screenshot(path=f'{OUT}/01_open_task.png')
    ev("closeSheet()")
    ev("(() => { const m = member(), st = curOcc('" + j['k'] + "'); startOcc(m, st); save(); })()")
    ev(f"(window.__listeners['Widget:launch']||[]).forEach(f => f({{ target: {json.dumps('open:' + j['k'])} }}))"); pg.wait_for_timeout(300)
    check('진행 중 잡도리 → 집중 화면', ev('ui.focusKey') == j['k'])
    pg.wait_for_timeout(1600)
    check('진행 중이면 묶음 상태 running', [i for i in snap()['days'][s['today']] if i['k'] == j['k']][0]['st'] == 'running')
    ev("(window.__listeners['Widget:launch']||[]).forEach(f => f({ target: 'add' }))"); pg.wait_for_timeout(400)
    check('+ → 새 일정 폼', ev("ui.sheet && ui.sheet.type") == 'form' and ev('ui.focusKey') is None)
    ev("ui.form = null; closeSheet()")
    ev("(window.__listeners['Widget:launch']||[]).forEach(f => f({ target: 'records' }))"); pg.wait_for_timeout(300)
    check('통계 위젯 → 기록 탭', ev('ui.tab') == 'records')
    ev("(window.__listeners['Widget:launch']||[]).forEach(f => f({ target: 'day:' + addDays(today(), 3) }))"); pg.wait_for_timeout(300)
    check('달력 위젯 날짜 → 앱 월간 달력에서 그 날', ev('ui.tab') == 'calendar' and ev('ui.calMode') == 'month' and ev('ui.selDate') == ev('addDays(today(),3)') and ev('ui.calMonth') == ev('addDays(today(),3).slice(0,7)'))
    pg.screenshot(path=f'{OUT}/03_open_day.png')
    nm = months[3]
    ev(f"(window.__listeners['Widget:launch']||[]).forEach(f => f({{ target: 'month:{nm}' }}))"); pg.wait_for_timeout(300)
    check('달력 위젯 제목 → 그 달 (1일 선택)', ev('ui.calMonth') == nm and ev('ui.selDate') == nm + '-01')
    ev("(window.__listeners['Widget:launch']||[]).forEach(f => f({ target: 'day:2026-13-99' }))"); pg.wait_for_timeout(200)
    check('이상한 날짜는 무시하고 오늘 화면', ev('ui.tab') == 'today')
    ev("(window.__listeners['Widget:launch']||[]).forEach(f => f({ target: 'open:gone|2026-01-01' }))"); pg.wait_for_timeout(300)
    check('지워진 일정 → 오늘 화면 + 안내', ev('ui.tab') == 'today' and '지워졌거나' in pg.inner_text('#toast'))

    # ---------- 5) 기록 · 연속 성공 ----------
    ev("(() => { const m = member(); finishOcc(m, curOcc('" + j['k'] + "'), true); ui.focusKey = null; ui.result = null; save(); render(); })()")
    pg.wait_for_timeout(1600)
    s = snap()
    check('잡도리 성공 → 오늘 기록 1성공, 연속 1', s['rec'].get(s['today']) == [1, 0] and s['streak'] == 1 and s['recTotal'] == 1, (s['rec'], s['streak']))
    check('미루먼지: 오늘 몫 끝 표정(뿌듯)', any(e['img'] in ('mireum_proud', 'mireum_happy') for e in s['mood']['list'][:2]), [e['img'] for e in s['mood']['list'][:3]])

    # ---------- 6) 설정 > 홈 화면 위젯 ----------
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    check('설정 첫 화면에 홈 화면 위젯 메뉴 (안드로이드)', pg.query_selector('[data-act=meOpen][data-v=widgets]') is not None)
    pg.click('[data-act=meOpen][data-v=widgets]'); pg.wait_for_timeout(500)
    tx = pg.inner_text('#app')
    check('위젯 5종 + 놓인 수', all(w in tx for w in ['오늘의 일정', '달력', '다음 일정', '미루먼지', '잡도리 통계']) and '홈 화면에 위젯 3개' in tx and '홈 화면에 2개' in tx, tx[:300])
    pg.screenshot(path=f'{OUT}/02_settings_widgets.png')
    pg.click('[data-act=widgetPin][data-v=next]'); pg.wait_for_timeout(300)
    check('추가 버튼 → 홈 화면에 추가 요청', ev('window.__wpins') == ['next'])
    pg.click('[data-act=meBack]'); pg.wait_for_timeout(300)

    # ---------- 7) 로그아웃 → 바로 일정 없는 묶음 ----------
    ev("ACT.doAcct({dataset:{v:'logout'}})"); pg.wait_for_timeout(900)
    s = snap()
    check('로그아웃 → 홈 화면에서도 일정이 사라짐', s['login'] is False and 'days' not in s, s.get('login'))

    # ---------- 8) 많은 일정 ----------
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.wait_for_timeout(1500)
    ev("""(() => { const m = member(); const td = today();
      for (let i = 0; i < 40; i++) m.tasks.push(migrateTask({ id: 'bulk' + i, type: i % 3 ? 'normal' : 'jab', title: '반복 일정 ' + i, date: td, endDate: td, start: minToHm(360 + i * 20), end: minToHm(380 + i * 20), heat: 40, repeat: { kind: 'daily', every: 1 }, alarms: [], memo: '', deadline: null, createdAt: now() - 3600e3 }));
      save(); })()""")
    t = ev("(() => { const a = performance.now(); const s = widgetSnapshot(); return [performance.now() - a, JSON.stringify(s).length]; })()")
    check(f'일정 40개 반복: 계산 {t[0]:.0f}ms (1초 안), 크기 {t[1] // 1024}KB (500KB 안)', t[0] < 1000 and t[1] < 500000, t)
    b.close()

print('\n'.join(log)); print('errors:', errors[:5]); print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
