"""발표용 대표 화면 다시 찍기 (시간을 순간 이동시키는 테스트 특성상 남는 알림 배너는 닫고 찍음)."""
from playwright.sync_api import sync_playwright
OUT = '/home/claude/jabdori-app/screenshots'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR')
    pg = ctx.new_page()
    pg.goto('file:///home/claude/jabdori-app/dist/index.html'); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2200); pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(300)
    pg.evaluate("ACT.openAdd({dataset:{date:'2026-11-23'}})"); pg.wait_for_timeout(300)
    pg.evaluate('ACT.cFill()'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#layer-sheet .sheet-body, #layer-sheet .sheet').scrollTop = 0"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/08_일정등록_상단화면_스크롤선택.png')
    pg.click('[data-act=formSave]'); pg.wait_for_timeout(500)
    pg.click('.ticket [data-act=startOcc]'); pg.wait_for_timeout(300)
    for hm, name in [('19:50', '13_펄펄_19시50분')]:
        pg.evaluate(f"ACT.cTime({{dataset:{{hm:'{hm}'}}}})"); pg.evaluate('hideBanner()'); pg.wait_for_timeout(3200)
        pg.screenshot(path=f'{OUT}/{name}.png')
    b.close()
