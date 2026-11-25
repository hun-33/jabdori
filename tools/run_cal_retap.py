"""달력 '고른 날짜 한 번 더 누르면 새 일정' + 이메일 제거 검수."""
import os
from playwright.sync_api import sync_playwright
HOOKS = __import__('pathlib').Path(__file__).resolve().parent / 'test_hooks.js'  # 검사 전용 도우미 (가상 시각·테스트 일정)
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots/cal_retap'; os.makedirs(OUT, exist_ok=True)
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra and not cond else ''))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    _ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ko-KR', timezone_id='Asia/Seoul')
    _ctx.add_init_script(path=str(HOOKS))
    pg = _ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    ev = lambda c: pg.evaluate(c)
    pg.goto(URL); ev('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    # 흉내 로그인 동의 창: 이메일 항목이 없어야
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800)
    t = pg.inner_text('#layer-sheet') if pg.query_selector('#layer-sheet') else ''
    check('동의 창에 이메일 항목 없음', '이메일' not in t and '프로필 사진' in t, t[:120])
    pg.screenshot(path=f'{OUT}/00_consent.png')
    pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2300); pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)
    check('회원 이메일 저장 안 함', ev('member().email') is None)
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    t = pg.inner_text('#app')
    check('나 탭: 이메일 문구·버튼 없음', '이메일' not in t and pg.query_selector('[data-act=askEmail]') is None, [l for l in t.split('\n') if '이메일' in l])

    td = ev('today()'); fut = ev('addDays(today(), 3)'); past = ev('addDays(today(), -2)')
    sheet = lambda: ev("ui.sheet && ui.sheet.type")
    pg.click('[data-act=tab][data-tab=calendar]'); pg.wait_for_timeout(300)
    if ev('ui.calMode') != 'month': pg.click('[data-act=calMode][data-v=month]'); pg.wait_for_timeout(300)
    # 월간: 처음 누르면 고르기만, 한 번 더 → 새 일정
    pg.click(f'.mo-cell[data-date="{fut}"]'); pg.wait_for_timeout(250)
    check('월간: 처음 누르면 날짜만 고름', ev('ui.selDate') == fut and sheet() is None)
    pg.screenshot(path=f'{OUT}/01_month_selected.png')
    pg.click(f'.mo-cell[data-date="{fut}"]'); pg.wait_for_timeout(450)
    check('월간: 한 번 더 누르면 그 날로 새 일정', sheet() == 'form' and ev('ui.form.id') is None and ev('ui.form.date') == fut, (sheet(), ev('ui.form && ui.form.date')))
    pg.screenshot(path=f'{OUT}/02_month_new.png')
    pg.click('[data-act=formClose]'); pg.wait_for_timeout(400)
    # 다른 날을 누르면 고르기로 돌아감
    other = ev('addDays(today(), 4)')
    pg.click(f'.mo-cell[data-date="{other}"]'); pg.wait_for_timeout(250)
    check('월간: 다른 날을 누르면 다시 고르기만', ev('ui.selDate') == other and sheet() is None)
    # 지난 날짜: 고르기 → 한 번 더 누르면 안내만
    pg.click(f'.mo-cell[data-date="{past}"]'); pg.wait_for_timeout(250)
    pg.click(f'.mo-cell[data-date="{past}"]'); pg.wait_for_timeout(300)
    check('월간: 지난 날짜는 새 일정 대신 안내', sheet() is None and '지난 날짜' in (pg.inner_text('#toast') if pg.query_selector('#toast') else pg.inner_text('body')))
    # 기간 정해서 올리기 모드에서는 기존대로
    pg.click(f'.mo-cell[data-date="{fut}"]'); pg.wait_for_timeout(200)
    pg.click('[data-act=rangeStart]'); pg.wait_for_timeout(200)
    pg.click(f'.mo-cell[data-date="{fut}"]'); pg.wait_for_timeout(200)
    check('기간 모드: 첫 탭은 시작 날만 (새 일정 아님)', sheet() is None and ev('ui.range && ui.range.a') == fut)
    pg.click('[data-act=rangeCancel]'); pg.wait_for_timeout(200)
    # 주간
    pg.click('[data-act=calMode][data-v=week]'); pg.wait_for_timeout(300)
    wd = ev("[...document.querySelectorAll('.ag-date')].map(b => b.dataset.date).find(d => d >= today() && d !== ui.selDate)")
    pg.click(f'.ag-date[data-date="{wd}"]'); pg.wait_for_timeout(250)
    check('주간: 처음 누르면 날짜만 고름', ev('ui.selDate') == wd and sheet() is None)
    pg.click(f'.ag-date[data-date="{wd}"]'); pg.wait_for_timeout(450)
    check('주간: 한 번 더 누르면 그 날로 새 일정', sheet() == 'form' and ev('ui.form.date') == wd)
    pg.click('[data-act=formClose]'); pg.wait_for_timeout(400)
    # 일간: 같은 칸 두 번 → 1시간 새 일정 (원래 기능)
    pg.click('[data-act=calMode][data-v=day]'); pg.wait_for_timeout(400)
    ev("ui.selDate = addDays(today(), 1); render()"); pg.wait_for_timeout(300)
    pg.click('.tg-slot[data-min="600"]'); pg.wait_for_timeout(200)
    check('일간: 첫 칸은 시작만', sheet() is None and ev('ui.slot && ui.slot.from') == 600)
    pg.click('.tg-slot[data-min="600"]'); pg.wait_for_timeout(450)
    check('일간: 같은 칸 한 번 더 → 10:00–11:00 새 일정', sheet() == 'form' and ev('ui.form.start') == '10:00' and ev('ui.form.end') == '11:00')
    pg.click('[data-act=formClose]'); pg.wait_for_timeout(300)
    hs = pg.inner_text('.hdr-sub')
    check('일간: 제목 아래는 조작 설명 대신 일정 수', hs.startswith('이 날 일정') and '누르면' not in hs, hs)
    check('일간: 시간표 위 안내는 그대로', '한 번 더 누르면 종료' in pg.inner_text('.tg-tip'), pg.inner_text('.tg-tip'))
    pg.click('[data-act=calMode][data-v=month]'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/03_month_hdr.png')
    w = ev("document.querySelector('.hdr-sub').getBoundingClientRect().height")
    check('월간 제목 아래 한 줄', w < 24, w)
    check('월간: 고른 날짜 줄에 "이 날 일정" 버튼', pg.query_selector('.sec-acts [data-act=openAdd]') is not None)
    sel = ev('ui.selDate')
    pg.click('.sec-acts [data-act=openAdd]'); pg.wait_for_timeout(400)
    check('"이 날 일정" → 고른 날짜로 새 일정', sheet() == 'form' and ev('ui.form.date') == sel)
    b.close()
print('\n'.join(log)); print('errors:', errors[:5]); print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
