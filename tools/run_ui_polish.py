"""UI 다듬기 검수: 농도 숫자 이름 · 기록 요약 · 설정 하위 화면 · 달력 '이 날 일정' · 토스트 · 월간 막대 · 지운 것(시연 도구·한 줄로 쓰기·예시 문구) · 도장 문구."""
import json
from playwright.sync_api import sync_playwright
HOOKS = __import__('pathlib').Path(__file__).resolve().parent / 'test_hooks.js'  # 검사 전용 도우미 (가상 시각·테스트 일정)
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots'
log, errors = [], []
def check(name, cond, extra=None): log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra is not None and not cond else ''))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR')
    ctx.add_init_script(path=str(HOOKS))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    ev = lambda c: (lambda r: (pg.wait_for_timeout(120), r)[1])(pg.evaluate(c))
    pg.goto(URL); ev('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2200); pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)

    # 1) 큰 숫자는 언제나 '미루먼지 농도' + 지금 어떤 값인지
    check('오늘: 맡은 일 없음 → 미루먼지 농도 · 쉬는 중', pg.inner_text('.pt-label') == '미루먼지 농도 · 쉬는 중', pg.inner_text('.pt-label'))
    check('오늘: 아래 안내 = 다음 잡도리 시작 농도', '다음 잡도리 시작 농도 50' in pg.inner_text('.floor-note'), pg.inner_text('.floor-note'))
    ev("ACT.cSeed()"); pg.wait_for_timeout(300); ev("hideBanner()")
    check('오늘: 시작 시간 됨 → 미루먼지 농도 · 지금', pg.inner_text('.pt-label') == '미루먼지 농도 · 지금', pg.inner_text('.pt-label'))
    ev("ACT.cTime({dataset:{hm:'17:30'}})"); pg.wait_for_timeout(300); ev("hideBanner()")
    check('오늘: 곧 시작 → 미루먼지 농도 · 시작 전', pg.inner_text('.pt-label') == '미루먼지 농도 · 시작 전', pg.inner_text('.pt-label'))
    ev("ACT.cTime({dataset:{hm:'18:00'}})"); pg.wait_for_timeout(300); ev("hideBanner()")

    # 2) 토스트: + 버튼을 덮지 않음, 화면을 옮기면 사라짐
    ev("toast('토스트 위치 확인')"); pg.wait_for_timeout(350)
    tb = ev("(() => { const t = document.getElementById('toast').getBoundingClientRect(), f = document.querySelector('.fab').getBoundingClientRect(); return [t.right, f.left, t.bottom, f.top]; })()")
    check('토스트가 + 버튼을 덮지 않음 (버튼 왼쪽)', tb[0] <= tb[1] or tb[2] <= tb[3], tb)
    pg.wait_for_timeout(800)
    pg.click('[data-act=tab][data-tab=records]'); pg.wait_for_timeout(300)
    check('다른 화면으로 가면 지난 토스트는 사라짐', not ev("document.getElementById('toast').classList.contains('show')"))
    ev("ui.tab = 'today'; render()"); pg.wait_for_timeout(200)
    ev("toast('바로 띄운 안내'); ui.tab = 'calendar'; render()"); pg.wait_for_timeout(100)
    check('방금 띄운 토스트는 화면이 바뀌어도 남음', ev("document.getElementById('toast').classList.contains('show')"))

    # 3) 달력: 설명 문장 대신 일정 수, 고른 날짜 줄에 '이 날 일정'
    ev("ui.calMode = 'month'; ui.selDate = today(); ui.calMonth = today().slice(0, 7); render()"); pg.wait_for_timeout(300)
    hs = pg.inner_text('.hdr-sub')
    check('달력 제목 아래: N월 일정 N개', hs.endswith('개') and '월 일정' in hs and '누르면' not in hs, hs)
    check('월간 막대: 제목 그대로 (말줄임표 대신 끝 흐리기)', ev("(() => { const t = document.querySelector('.mo-bar .mo-t'); return !!t && t.textContent.length > 3 && getComputedStyle(t).webkitMaskImage !== 'none' && !t.textContent.includes('…'); })()"))
    bars = ev("[...document.querySelectorAll('.mo-bar')].slice(0, 4).map(b => { const t = b.querySelector('.mo-t'); return [t.textContent, t.scrollWidth, t.clientWidth]; })")
    log.append('     월간 막대 (제목, 글자 폭, 보이는 폭): ' + json.dumps(bars, ensure_ascii=False))
    pg.screenshot(path=f'{OUT}/up_01_month.png')

    # 4) 새 일정: 한 줄로 쓰기·제목 예시 문구는 없음
    ev("ACT.openAdd({dataset:{date: today()}})"); pg.wait_for_timeout(500)
    check('새 일정: 한 줄로 쓰기 칸 없음', pg.query_selector('#f-quick') is None and 'quickApply' not in pg.content())
    check('새 일정: 제목 칸 예시 문구 없음', not pg.get_attribute('#f-title', 'placeholder'))
    check('한 줄 해석 함수도 없음', ev("typeof parseQuickAdd") == 'undefined')
    ev("ACT.formClose()"); pg.wait_for_timeout(200)
    if pg.query_selector('[data-act=formDiscard]'): pg.click('[data-act=formDiscard]'); pg.wait_for_timeout(200)

    # 5) 기록 요약: 4주치 기록을 넣고 확인 (화요일 저녁에 자주 밀림)
    ev("""(() => {
      const m = member(); const ws = weekStartOf(today());
      const mk = (date, hm, status, delay, app) => { const t = m.tasks[0]; const st = at(date, hm);
        m.runs[occKey('h' + date + hm, date)] = { status, title: '샘플', startHeat: 50, plan: { start: st, end: st + 3600e3, deadline: st + 3600e3 },
          startedAt: status === 'failed' && delay == null ? null : st + (delay || 0) * 60e3, endedAt: st + 3600e3, slack: app ? [{ at: st + 600e3, app, choice: 'focus' }] : [], excuse: status === 'failed' ? 'time' : null, log: [], peak: 70, floorBefore: 50, floorAfter: 50 }; };
      for (let w = 0; w < 4; w++) { const s = addDays(ws, -7 * w);
        mk(addDays(s, 2), '19:00', w % 2 ? 'failed' : 'done', w % 2 ? null : 25, 'YouTube');   // 화요일 저녁: 밀림
        mk(addDays(s, 4), '10:00', 'done', 0, null); }                                            // 목요일 아침: 제때
      save(); ui.tab = 'records'; render(); })()""")
    pg.wait_for_timeout(400)
    t = pg.inner_text('#screen')
    check('기록: 이번 주 카드 + 4주 막대', '이번 주' in t and ev("document.querySelectorAll('.wb-col').length") == 4)
    check('기록: 막대 높이 = 기록 수 비율', ev("[...document.querySelectorAll('.wb-stack')].every(s => s.children.length >= 1)"))
    check('기록: 화요일에 자주 밀려요', '화요일에 자주 밀려요' in t, t[:600])
    check('기록: 저녁 일정이 자주 밀려요', '저녁 일정이 자주 밀려요' in t)
    check('기록: 딴짓 횟수·앱', '딴짓' in t and 'YouTube' in t)
    check('기록: 실패 이유', '시간이 모자랐어' in t)
    check('기록: 시작 평균 지각', '시작이 평균' in t)
    check('기록: 시작 농도 구역 이름', '시작 농도' in t and '지금 쌓인 먼지' not in t)
    pg.screenshot(path=f'{OUT}/up_03_records.png')
    pg.evaluate("document.querySelector('#screen').scrollTop = 520"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}/up_04_records_2.png')

    # 도장 문구: 성공 '훌륭해!' · 실패 '아쉽네!'
    rows = pg.query_selector_all('.rec-row')
    stamps = []
    for r in rows[:6]:
        r.click(); pg.wait_for_timeout(250)
        stamps.append(pg.inner_text('#layer-sheet .stamp'))
        pg.click('#layer-sheet [data-act=closeSheet]'); pg.wait_for_timeout(200)
    check('기록 도장: 훌륭해! / 아쉽네!', set(stamps) <= {'훌륭해!', '아쉽네!'} and '훌륭해!' in stamps and '아쉽네!' in stamps, stamps)

    # 6) 나 탭: 첫 화면 짧게, 하위 화면으로
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(400)
    h = ev("document.querySelector('#screen .paper').scrollHeight")
    check('설정 첫 화면: 메뉴 5개', ev("document.querySelectorAll('[data-act=meOpen]').length") == 5)
    check('시연 도구 없음 (탭·콘솔)', ev("!document.getElementById('console-tab') && !document.getElementById('console')"))
    check('나 첫 화면 높이가 한 화면 남짓 (≤ 900px)', h <= 900, h)
    pg.screenshot(path=f'{OUT}/up_05_me.png')
    for k, want in [('mireum', '시작 농도'), ('voice', '소리 모드'), ('alerts', '설치'), ('screen', '움직임 줄이기'), ('account', '회원 탈퇴')]:
        pg.click(f'[data-act=meOpen][data-v={k}]'); pg.wait_for_timeout(300)
        t = pg.inner_text('#screen')
        check(f'나 > {k}: 내용 보임 + 뒤로 버튼', want in t and pg.query_selector('[data-act=meBack]') is not None, t[:200])
        if k == 'mireum': pg.screenshot(path=f'{OUT}/up_06_me_mireum.png')
        pg.click('[data-act=meBack]'); pg.wait_for_timeout(250)
    pg.click('[data-act=meOpen][data-v=voice]'); pg.wait_for_timeout(200)
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(200)
    check('나 탭을 다시 누르면 첫 화면으로', ev('ui.meSub') is None)
    b.close()

print('\n'.join(log)); print('errors:', errors[:5]); print(f"{sum(1 for l in log if l.startswith('OK'))}/{sum(1 for l in log if l[:4] in ('OK  ', 'FAIL'))} OK")
