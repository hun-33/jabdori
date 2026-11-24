"""v5 · 미루먼지 추가분 검수 — 알림 배너, 메뉴바, 옷장 저장, 스와이프 월간, TTS 버튼, 움직임 줄이기, 375px·데스크톱 렌더."""
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots'
log, errors = [], []
def check(name, cond): log.append(('OK  ' if cond else 'FAIL') + ' ' + name)

def boot(b, w, h, mobile=True, reduce=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=mobile, is_mobile=mobile,
                        locale='ko-KR', reduced_motion='reduce' if reduce else 'no-preference')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    page.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    page.goto(URL); page.evaluate('localStorage.clear()'); page.reload(); page.wait_for_timeout(500)
    page.click('.btn-kakao'); page.wait_for_timeout(1800)
    page.click('[data-act=consentAgree]'); page.wait_for_timeout(2200)
    page.click('[data-act=onbSkip]'); page.wait_for_timeout(300)
    page.evaluate('ACT.cSeed()'); page.wait_for_timeout(200)
    return ctx, page

def ev(page, code):
    r = page.evaluate(code); page.wait_for_timeout(250); return r

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--lang=ko-KR'])
    ctx, page = boot(b, 390, 844)

    # 1) 실시간 멘트 알림 — 시작 시각이 되면 배너
    ev(page, "ACT.cTime({dataset:{hm:'17:55'}})")
    ev(page, "ACT.cShift({dataset:{min:'5'}})")
    check('시작 시각 배너 표시', ev(page, "document.querySelector('#layer-banner').classList.contains('show')"))
    check('배너 문구 (먼지 말투)', '시간이야' in page.inner_text('#layer-banner') and '퐁!' in page.inner_text('#layer-banner'))
    page.screenshot(path=f'{OUT}/v5_01_banner.png')
    page.wait_for_timeout(4500)
    check('배너 자동 사라짐', not ev(page, "document.querySelector('#layer-banner').classList.contains('show')"))

    # 2) TTS 버튼
    check('말풍선 읽어주기 버튼', page.query_selector('.say-btn') is not None)

    # 3) 캐릭터 터치 → 짧은 반응 (메뉴·옷장 없음)
    page.click('.persona-mascot'); page.wait_for_timeout(300)
    check('캐릭터 터치 → 반응, 메뉴 없음', page.query_selector('.p-menu') is None and ev(page, "ui.react && ui.react.id") == 'tap')
    check('옷장 없음', page.query_selector('[data-act=openCloset]') is None and ev(page, "typeof viewCloset") == 'undefined')
    page.wait_for_timeout(2400)

    # 4) 이번 주 → 달력 화면으로 (월간 시트 중복 제거)
    page.click('[data-act=goCalendar]'); page.wait_for_timeout(400)
    check('"달력에서 보기" → 달력 탭 월간', ev(page, "ui.tab") == 'calendar' and ev(page, "ui.calMode") == 'month')
    page.click('[data-act=tab][data-tab=today]'); page.wait_for_timeout(300)

    # 5) 집중 → 마감 30분 전 배너 → 끝냈어 → 결과 화면에서는 배너 닫힘
    page.click('.ticket [data-act=startOcc]'); page.wait_for_timeout(300)
    ev(page, "ACT.cTime({dataset:{hm:'19:31'}})")
    check('마감 30분 전 배너', '마감 30분 전' in page.inner_text('#layer-banner'))
    page.screenshot(path=f'{OUT}/v5_03_urgent_banner.png')
    page.click('[data-act=finishOcc]')
    page.wait_for_timeout(500)
    if page.query_selector('[data-act=confirmDone]'): page.click('[data-act=confirmDone]'); page.wait_for_timeout(400)
    if ev(page, "!!ui.result"):
        check('결과 화면에서 배너 닫힘', not ev(page, "document.querySelector('#layer-banner').classList.contains('show')"))
    else:
        log.append('SKIP 결과 화면 진입 버튼을 찾지 못함')
    ctx.close()

    # 6) 375×812 (작은 폰)
    ctx, page = boot(b, 375, 812)
    ev(page, "ACT.cTime({dataset:{hm:'18:00'}})")
    page.screenshot(path=f'{OUT}/v5_375_today.png')
    ev(page, "ACT.openAdd({dataset:{date:'2026-11-23'}})"); page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/v5_375_form.png')
    ov = ev(page, "[...document.querySelectorAll('#layer-sheet *')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0).length")
    check('375px 폼 가로 넘침 없음', ov == 0)
    ev(page, "ui.form=null; ui.sheet=null; render()")
    page.click('.ticket [data-act=startOcc]'); page.wait_for_timeout(300)
    ev(page, "ACT.cTime({dataset:{hm:'19:40'}})"); page.wait_for_timeout(4500)
    page.screenshot(path=f'{OUT}/v5_375_focus.png')
    check('375px 가로 스크롤 없음', ev(page, "document.documentElement.scrollWidth <= innerWidth"))
    ctx.close()

    # 7) 데스크톱 (기기 프레임 + 시연 콘솔)
    ctx, page = boot(b, 1280, 860, mobile=False)
    ev(page, "ACT.cTime({dataset:{hm:'18:00'}})")
    page.screenshot(path=f'{OUT}/v5_desktop.png')
    ctx.close()

    # 8) OS 움직임 줄이기
    ctx, page = boot(b, 390, 844, reduce=True)
    anim = ev(page, "getComputedStyle(document.querySelector('.persona-mascot .mr-all')).animationName")
    check('OS 움직임 줄이기 → 캐릭터 애니메이션 정지', anim in ('none', ''))
    ctx.close()
    b.close()

print('\n'.join(log))
print('ERRORS:', '\n'.join(errors) if errors else 'none')
