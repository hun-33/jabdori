"""캘린더 일요일 시작 + 로그인 상태 화면·진단(웹/흉내 모드) 검수."""
import re
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots'
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra and not cond else ''))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    ev = lambda c: pg.evaluate(c)

    # ---------- 순수 계산 ----------
    # 2026-11: 1일이 일요일, 2026-12: 화요일, 2027-02: 월요일, 2026-03: 일요일, 2027-05: 토요일
    for month, col in [('2026-11', 0), ('2026-12', 2), ('2027-02', 1), ('2026-03', 0), ('2027-05', 6)]:
        start = ev(f"weekStartOf('{month}-01')")
        check(f'{month}-01 이 {"일월화수목금토"[col]}요일 칸', ev(f"daysBetween('{start}', '{month}-01')") == col and ev(f"parseYmd('{start}').getDay()") == 0)
    allsun = all(ev(f"parseYmd(weekStartOf(addDays('2026-11-01', {i}))).getDay()") == 0 for i in range(0, 60))
    check('60일 모두 그 주의 시작이 일요일', allsun)
    check('토요일의 주 시작 = 6일 전 일요일', ev("weekStartOf('2026-11-28')") == '2026-11-22')
    check('일요일의 주 시작 = 그날', ev("weekStartOf('2026-11-29')") == '2026-11-29')
    check('저장 요일 값은 그대로 (월=1 … 일=7)', ev("weekday('2026-11-23')") == 1 and ev("weekday('2026-11-29')") == 7)

    # ---------- 로그인(흉내) ----------
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2300)
    bn = pg.inner_text('#layer-banner')
    check('흉내 로그인 안내는 "실제 인증 아님"으로 구분', '흉내 로그인' in bn and '실제 카카오 인증은 하지 않았어요' in bn and '카카오 계정으로 로그인했어요' not in bn, bn)
    d = ev('state.diag')
    check('진단(흉내): 카카오 단계는 흉내, 회원·세션은 실제 확인', d['mode'] == 'fake' and d['steps']['auth'] == 'sim' and d['steps']['member'] == 'ok' and d['steps']['session'] == 'ok', d)
    pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(300)
    ev("ACT.cSeed()"); pg.wait_for_timeout(300)

    # ---------- 주간(오늘 탭) ----------
    t = pg.inner_text('.wk')
    heads = [x for x in re.findall(r'[일월화수목금토]', t)][:7]
    check('오늘 탭 이번 주: 일~토 순서', ''.join(heads) == '일월화수목금토', ''.join(heads))
    days = ev("[...document.querySelectorAll('.wk-cell')].map(b => b.dataset.date)")
    check('이번 주 첫 칸 날짜 = 일요일 11/22', days[0] == '2026-11-22' and days[6] == '2026-11-28', days)

    # ---------- 달력 탭: 월간 ----------
    pg.click('[data-act=tab][data-tab=calendar]'); pg.wait_for_timeout(300)
    if ev('ui.calMode') != 'month': pg.click('[data-act=calMode][data-v=month]'); pg.wait_for_timeout(200)
    head = pg.inner_text('.mo-head').replace('\n', '').replace(' ', '')
    check('월간 머리: 일월화수목금토', head == '일월화수목금토', head)
    first = ev("document.querySelector('.mo-cell').dataset.date")
    check('11월 달력 첫 칸 = 11/1 (일요일)', first == '2026-11-01', first)
    pg.click('[data-act=calNav][data-delta="1"]'); pg.wait_for_timeout(200)
    cells = ev("[...document.querySelectorAll('.mo-cell')].map(b => b.dataset.date)")
    check('12월 달력: 1일(화)이 셋째 칸', cells[2] == '2026-12-01' and cells[0] == '2026-11-29', cells[:3])
    pg.screenshot(path=f'{OUT}/cal_01_month_dec.png')
    pg.click('[data-act=calToday]'); pg.wait_for_timeout(200)
    # 날짜를 누르면 그날 일정
    pg.click('.mo-cell[data-date="2026-11-30"]'); pg.wait_for_timeout(200)
    check('11/30(월) 선택 → 월요일 반복 일정 보임', '데이터베이스 과제' in pg.inner_text('#screen') and ev('ui.selDate') == '2026-11-30')
    pg.click('.mo-cell[data-date="2026-11-29"]'); pg.wait_for_timeout(200)
    check('11/29(일) 선택 → 월요일 일정 없음', ev('ui.selDate') == '2026-11-29' and not ev("occurrencesOn(member(), '2026-11-29').some(o => o.task.title === '데이터베이스 과제')"))

    # ---------- 달력 탭: 주간 + 이동 ----------
    pg.click('[data-act=calMode][data-v=week]'); pg.wait_for_timeout(200)
    check('주간 시작 = 선택한 날이 속한 일요일', ev('weekStartOf(ui.selDate)') == '2026-11-29')
    t = pg.inner_text('.cal-title')
    check('주간 제목 11월 29일 – 12월 5일', '11월 29일' in t and '12월 5일' in t, t)
    ags = ev("[...document.querySelectorAll('.ag-date b')].map(b => b.textContent).join('')")
    check('주간 줄 순서 일~토', ags == '일월화수목금토', ags)
    pg.click('[data-act=calNav][data-delta="-1"]'); pg.wait_for_timeout(200)
    check('이전 주 = 11/22(일)', ev('weekStartOf(ui.selDate)') == '2026-11-22')
    pg.click('[data-act=calNav][data-delta="1"]'); pg.click('[data-act=calNav][data-delta="1"]'); pg.wait_for_timeout(200)
    check('다음 주 두 번 = 12/6(일)', ev('weekStartOf(ui.selDate)') == '2026-12-06')
    pg.screenshot(path=f'{OUT}/cal_02_week.png')

    # ---------- 반복 요일 칩 ----------
    ev("ACT.openAdd({dataset:{date:'2026-11-23'}})"); pg.wait_for_timeout(400)
    pg.click('[data-act=formMore]'); pg.wait_for_timeout(150)
    pg.click('[data-act=formRepeat][data-v=weekly]'); pg.wait_for_timeout(200)
    chips = ev("[...document.querySelectorAll('[data-act=formDay]')].map(b => b.textContent + b.dataset.d).join(' ')")
    check('반복 요일 칩: 일7 월1 … 토6', chips == '일7 월1 화2 수3 목4 금5 토6', chips)
    pg.click('[data-act=formDay][data-d="7"]'); pg.wait_for_timeout(150)
    hint = pg.inner_text('#rep-hint')
    check('요일 안내도 일요일부터 (일·월요일)', '일·월요일' in hint, hint)
    pg.fill('#f-title', '일요일 테스트'); pg.click('[data-act=formSave]'); pg.wait_for_timeout(400)
    if pg.query_selector('[data-act=formForce]'): pg.click('[data-act=formForce]'); pg.wait_for_timeout(300)
    task = ev("member().tasks.find(t => t.title === '일요일 테스트')")
    check('저장된 요일 값 [1,7] (월·일)', task and sorted(task['repeat']['days']) == [1, 7], task and task['repeat'])
    check('일요일에 실제로 반복', ev("occursOn(member().tasks.find(t => t.title === '일요일 테스트'), '2026-11-29')") and not ev("occursOn(member().tasks.find(t => t.title === '일요일 테스트'), '2026-11-28')"))
    check('반복 문구 "매주 일·월요일"', ev("repeatText(member().tasks.find(t => t.title === '일요일 테스트'))") == '매주 일·월요일')
    check('기존 일정 날짜·요일 그대로', ev("member().tasks.find(t => t.title === '데이터베이스 과제').repeat.days.join()") == '1' and ev("member().tasks.find(t => t.title === '데이터베이스 과제').date") == '2026-11-23')

    # ---------- 나 탭: 로그인 상태 ----------
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    t = pg.inner_text('#screen')
    check('나: 로그인 방식·연결·앱 로그인 상태 + 흉내 표시', '로그인 방식' in t and '흉내 모드' in t and '연결됨' in t and '로그인 중' in t)
    check('나: 회원번호 노출 없음', '회원 번호' not in t and '회원번호' not in t and '4100231' not in t)
    check('나: 로그아웃 버튼이 상태 구역에', pg.query_selector('.acct-state + [data-act=acct][data-v=logout]') is not None)
    pg.screenshot(path=f'{OUT}/acct_01_me.png')
    # 콘솔에서 진단 열기
    ev("ACT.openDiag()"); pg.wait_for_timeout(300)
    t = pg.inner_text('#layer-sheet')
    check('진단 화면: 흉내 모드 표시 + 단계 7개', '흉내 모드' in t and t.count('흉내') >= 5 and '서비스 로그인 세션' in t, t[:300])
    check('진단 화면: 토큰 값 없음 안내', '토큰' in t and 'eyJ' not in t)
    pg.screenshot(path=f'{OUT}/acct_02_diag_fake.png')
    pg.click('#layer-sheet [data-act=diagRecheck]'); pg.wait_for_timeout(300)
    check('재검증(흉내): 세션 활성', ev('state.diag.kind') == 'recheck' and ev('state.diag.steps.session') == 'ok')
    pg.click('#layer-sheet [data-act=closeSheet]'); pg.wait_for_timeout(200)
    # 로그아웃 → 로그아웃 상태가 분명히 보임 → 진단에 세션 비활성
    pg.click('.acct-state + [data-act=acct][data-v=logout]'); pg.click('[data-act=doAcct]'); pg.wait_for_timeout(400)
    check('로그아웃 → 로그인 화면 "로그인 안 됨"', '로그인 안 됨' in pg.inner_text('.login'))
    check('로그아웃 → 진단 세션 비활성', ev('state.diag.steps.session') == 'fail' and ev('state.diag.code') == 'LOGOUT')
    pg.reload(); pg.wait_for_timeout(600)
    check('새로고침해도 로그아웃 유지', pg.query_selector('.login') is not None and ev('state.session') is None)
    pg.click('.btn-kakao'); pg.wait_for_timeout(2600)
    check('다시 로그인 → 기존 회원으로', ev('!!member()') and ev("member().tasks.some(t => t.title === '일요일 테스트')"))
    pg.reload(); pg.wait_for_timeout(600)
    check('새로고침해도 로그인 유지', ev('!!member()') and pg.query_selector('.login') is None)
    b.close()
print('\n'.join(log))
print('ERRORS:', '\n'.join(errors) if errors else 'none')
