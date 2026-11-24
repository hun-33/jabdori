"""선택기 '직접 입력' 검사: 파서 단위 검사 + 화면 흐름 검사."""
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/www/index.html'
OUT = '/home/claude/jabdori-app/shots'
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  ({extra})' if extra and not cond else ''))

TIME_CASES = [
    ('18:30', '18:30'), ('1830', '18:30'), ('930', '09:30'), ('9', '09:00'), ('18시', '18:00'), ('18시 30분', '18:30'),
    ('6시 반', '06:30'), ('오후 6시 반', '18:30'), ('오후 6:30', '18:30'), ('6:30pm', '18:30'), ('오전 12시', '00:00'),
    ('오후 12시', '12:00'), ('정오', '12:00'), ('자정', '00:00'), ('１８：３０', '18:30'), ('18.05', '18:05'), ('저녁 7시', '19:00'),
    ('새벽 2시', '02:00'), ('0:00', '00:00'), ('23:59', '23:59'), ('18:37', '18:37'),
]
TIME_BAD = ['', '24:00', '25:00', '18:60', '오후 13시', 'abc', '18:3:0', '오전 오후 3시', '123456']
DATE_BASE = '2026-11-24'
DATE_CASES = [
    ('오늘', '2026-11-24'), ('내일', '2026-11-25'), ('모레', '2026-11-26'), ('3일 뒤', '2026-11-27'), ('+7', '2026-12-01'),
    ('12/3', '2026-12-03'), ('12.3', '2026-12-03'), ('12-3', '2026-12-03'), ('12월 3일', '2026-12-03'), ('1203', '2026-12-03'),
    ('2026-12-03', '2026-12-03'), ('20261203', '2026-12-03'), ('1/5', '2027-01-05'), ('11/24', '2026-11-24'), ('11/23', '2027-11-23'),
    ('30일', '2026-11-30'), ('3일', '2026-12-03'), ('2/29', '2028-02-29'), ('12/3(목)', '2026-12-03'), ('12월 3일 목요일', '2026-12-03'),
]
DATE_BAD = ['', '13/1', '2/30', '4/31', '2026-02-30', 'abc', '0/5', '12/0']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
    ev = lambda code: pg.evaluate(code)

    # 1) 파서 단위 검사
    bad_t = [c for c, want in TIME_CASES if ev(f"JSON.stringify(parseTimeInput({c!r}))") != f'{{"ok":true,"hm":"{want}"}}']
    check(f'시각 형식 {len(TIME_CASES)}가지 인식', not bad_t, '틀림: ' + ', '.join(f'{c}→{ev(f"JSON.stringify(parseTimeInput({c!r}))")}' for c in bad_t))
    bad_t2 = [c for c in TIME_BAD if ev(f"parseTimeInput({c!r}).ok")]
    check(f'잘못된 시각 {len(TIME_BAD)}가지 거절 + 이유 문장', not bad_t2 and all(ev(f"parseTimeInput({c!r}).error.length > 5") for c in TIME_BAD), ', '.join(bad_t2))
    bad_d = [c for c, want in DATE_CASES if ev(f"(parseDateInput({c!r}, {DATE_BASE!r}).ymd)") != want]
    check(f'날짜 형식 {len(DATE_CASES)}가지 인식 (연도 추정 포함)', not bad_d, '틀림: ' + ', '.join(f'{c}→{ev(f"JSON.stringify(parseDateInput({c!r}, {DATE_BASE!r}))")}' for c in bad_d))
    bad_d2 = [c for c in DATE_BAD if ev(f"parseDateInput({c!r}, {DATE_BASE!r}).ok")]
    check(f'잘못된 날짜 {len(DATE_BAD)}가지 거절', not bad_d2, ', '.join(bad_d2))
    check('2/30 → "2월에는 30일이 없어요"', '30일이 없어요' in ev("parseDateInput('2/30', '2026-11-24').error"))
    check('걸리는 시간 형식 (90분·1시간 반·1.5시간·+45)', ev("[parseDurationInput('90분').min, parseDurationInput('1시간 반').min, parseDurationInput('1.5시간').min, parseDurationInput('+45').min, parseDurationInput('2시간 10분').min].join(',')") == '90,90,90,45,130')

    # 2) 화면 흐름
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2200); pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)
    ev("ACT.cTime({dataset:{hm:'17:00'}})")
    ev("ACT.openAdd({dataset:{date: today()}})"); pg.wait_for_timeout(500)
    pg.click('.when-row[data-v=start]'); pg.wait_for_timeout(300)
    check('라벨 옆 "직접 입력" 버튼 3개(날짜·시작·…)', len(pg.query_selector_all('[data-act=wheelInput]')) >= 2)
    pg.click('[data-act=wheelInput][data-target=start]'); pg.wait_for_timeout(300)
    check('입력창 열림 + 현재 값 채워짐 + 포커스', pg.query_selector('#in-field') is not None and pg.input_value('#in-field') == '18:00' and ev("document.activeElement.id") == 'in-field')
    pg.fill('#in-field', '오후 6시 37분'); pg.wait_for_timeout(100)
    check('입력하면서 미리보기', '18:37' in pg.inner_text('#in-preview'))
    pg.screenshot(path=f'{OUT}/in_01_start.png')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('Enter → 시작 18:37 반영, 창 닫힘', ev('ui.form.start') == '18:37' and pg.query_selector('#in-field') is None)
    check('분 선택기에 37분이 끼워져 선택됨', ev("document.querySelector('.wheel[data-wheel=\"start-m\"] .wheel-item.sel').dataset.v") == '37')
    check('시작 줄 시각 갱신', '18:37' in pg.inner_text('.when-row[data-v=start]'))

    # 잘못된 값 → 오류 표시, 값 유지, 닫히지 않음
    pg.click('[data-act=wheelInput][data-target=start]'); pg.wait_for_timeout(200)
    pg.fill('#in-field', '25:00'); pg.click('[data-act=wheelInputOk]'); pg.wait_for_timeout(250)
    check('잘못된 시각 → 오류 문장, 창 유지, 입력값 유지', pg.query_selector('#in-err') is not None and pg.input_value('#in-field') == '25:00' and ev('ui.form.start') == '18:37')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    check('Esc → 입력창만 닫히고 폼은 그대로', pg.query_selector('#in-field') is None and ev("ui.sheet && ui.sheet.type") == 'form')

    # 선택된 가운데 줄을 탭 → 입력창
    sel = pg.query_selector('.wheel[data-wheel="start-h"] .wheel-item.sel'); sel.click(); pg.wait_for_timeout(250)
    check('가운데 선택 줄 탭 → 입력창', pg.query_selector('#in-field') is not None)
    pg.click('[data-act=wheelInputCancel]', position={'x': 5, 'y': 5}) if pg.query_selector('.in-scrim') else None
    pg.wait_for_timeout(200)
    if pg.query_selector('#in-field'): ev("ACT.wheelInputCancel()")

    # 날짜: 지난 날짜 거절, 내년 추정, 1년 넘김 거절
    pg.click('[data-act=wheelInput][data-target=date]'); pg.wait_for_timeout(200)
    td = ev('today()'); y, mo, d = map(int, td.split('-'))
    pg.fill('#in-field', f'{y - 1}-{mo:02d}-{d:02d}'); pg.click('[data-act=wheelInputOk]'); pg.wait_for_timeout(200)
    check('지난 날짜 거절', '지난 날짜' in (pg.inner_text('#in-err') if pg.query_selector('#in-err') else ''))
    pg.fill('#in-field', f'{y + 2}-01-01'); pg.click('[data-act=wheelInputOk]'); pg.wait_for_timeout(200)
    check('1년 넘는 날짜 거절', '1년' in (pg.inner_text('#in-err') if pg.query_selector('#in-err') else ''))
    pg.fill('#in-field', '내일'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('내일 → 날짜 반영 + 선택기 이동', ev('ui.form.date') == ev('addDays(today(),1)') and ev("document.querySelector('.wheel[data-wheel=\"date\"] .wheel-item.sel').dataset.v") == ev('addDays(today(),1)'))
    pg.click('[data-act=wheelInput][data-target=date]'); pg.wait_for_timeout(200)
    pg.fill('#in-field', '+200'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('선택기 범위 밖 먼 날짜(+200일)도 선택기에 표시', ev("document.querySelector('.wheel[data-wheel=\"date\"] .wheel-item.sel').dataset.v") == ev('addDays(today(),200)'))
    pg.click('[data-act=wheelInput][data-target=date]'); pg.wait_for_timeout(200); pg.fill('#in-field', '오늘'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)

    # 끝 시각: 걸리는 시간으로도 입력, 12시간 초과 거절, 시작과 같음 거절
    pg.click('.when-row[data-v=end]'); pg.wait_for_timeout(300)
    pg.click('[data-act=wheelInput][data-target=end]'); pg.wait_for_timeout(200)
    pg.fill('#in-field', '18:37'); pg.click('[data-act=wheelInputOk]'); pg.wait_for_timeout(200)
    check('끝 = 시작 거절', '같아요' in (pg.inner_text('#in-err') if pg.query_selector('#in-err') else ''))
    pg.fill('#in-field', '13시간'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('"13시간" → 다음 날 07:37 종료 (여러 날 허용)', ev('ui.form.end') == '07:37' and ev('ui.form.endDate') == ev('addDays(ui.form.date,1)'))
    pg.click('[data-act=wheelInput][data-target=end]'); pg.wait_for_timeout(200)
    pg.fill('#in-field', '1시간 반'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('"1시간 반" → 끝 20:07, 같은 날', ev('ui.form.end') == '20:07' and ev('ui.form.endDate') == ev('ui.form.date'))

    # 마감: 날짜+시각 한 번에, 시작보다 앞서면 거절
    pg.click('[data-act=formMore]'); pg.wait_for_timeout(200)
    pg.click('[data-act=formDl][data-v=custom]'); pg.wait_for_timeout(300)
    pg.click('[data-act=wheelInput][data-target=dl]'); pg.wait_for_timeout(200)
    pg.fill('#in-field', '17:00'); pg.click('[data-act=wheelInputOk]'); pg.wait_for_timeout(200)
    check('마감이 시작보다 앞서면 거절', '뒤여야' in (pg.inner_text('#in-err') if pg.query_selector('#in-err') else ''))
    pg.fill('#in-field', '내일 9시'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('"내일 9시" → 마감 날짜·시각 반영', ev('ui.form.dlDate') == ev('addDays(today(),1)') and ev('ui.form.dlTime') == '09:00')
    pg.screenshot(path=f'{OUT}/in_02_form.png')

    # 저장까지
    pg.fill('#f-title', '직접 입력 테스트'); pg.click('[data-act=formSave]'); pg.wait_for_timeout(500)
    t = ev("member().tasks.find(t => t.title === '직접 입력 테스트')")
    check('저장 → 18:37 시작, 90분, 마감 내일 09:00', t and t['start'] == '18:37' and t['duration'] == 90 and t['deadline']['time'] == '09:00', str(t and (t['start'], t['duration'], t['deadline'])))
    b.close()

print('\n'.join(log))
print('ERRORS:', '\n'.join(errors) if errors else 'none')
