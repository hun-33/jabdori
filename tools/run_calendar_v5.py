"""v5 검수: 일정 구조(시작·종료·종일·여러 날·반복·마감) · 한 폼 등록 · 일/주/월 달력 · 추가 버튼 하나 · 옛 데이터 변환."""
import json
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots/v5'
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra and not cond else ''))

import os
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR', timezone_id='Asia/Seoul')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')
    ev = lambda c: pg.evaluate(c)

    # ---------- 옛 저장 데이터 변환 (날짜 + 시작 + 걸리는 시간 → 시작·종료 일시) ----------
    pg.goto(URL)
    old = {'v': 1, 'clock': ev('BASE_CLOCK'), 'session': {'kakaoId': 'k1', 'memberId': 'm1', 'method': 'talk', 'at': 0},
           'kakao': {'k1': {'linked': True, 'token': True, 'consent': {}}}, 'memberByKakao': {'k1': 'm1'},
           'members': {'m1': {'id': 'm1', 'kakaoId': 'k1', 'nickname': '옛 회원', 'consent': {}, 'createdAt': 0, 'onboarded': True,
                              'characterId': 'mireum', 'scaleMode': 'character', 'costume': 'devil', 'initialHeat': 30, 'penalty': 1, 'streak': 0, 'runs': {},
                              'tasks': [
                                  {'id': 't1', 'type': 'jab', 'title': '밤샘 과제', 'date': '2026-11-23', 'repeat': {'kind': 'none'}, 'start': '23:00', 'duration': 120, 'heat': 50, 'deadline': {'enabled': True, 'date': '2026-11-24', 'time': '01:00'}},
                                  {'id': 't2', 'type': 'normal', 'title': '빨래', 'date': '2026-11-23', 'repeat': {'kind': 'interval', 'every': 3}, 'start': '21:30', 'duration': 30, 'heat': None, 'deadline': None},
                                  {'id': 't3', 'type': 'normal', 'title': '스터디', 'date': '2026-11-10', 'repeat': {'kind': 'weekly', 'days': [2]}, 'start': '19:00', 'duration': 90, 'heat': None, 'deadline': None}]}}}
    ev(f"localStorage.setItem(STORE_KEY, {json.dumps(json.dumps(old))})"); pg.reload(); pg.wait_for_timeout(600)
    t1 = ev("member().tasks.find(t => t.id === 't1')"); t2 = ev("member().tasks.find(t => t.id === 't2')")
    check('변환: 23:00 + 2시간 → 다음 날 01:00 종료', t1['endDate'] == '2026-11-24' and t1['end'] == '01:00' and t1['duration'] == 120, t1)
    check('변환: 예전 n일마다 → 매일 간격 3', t2['repeat'] == {'kind': 'daily', 'every': 3}, t2['repeat'])
    check('변환: 기록·벌점은 그대로', ev('member().penalty') == 1 and ev('member().nickname') == '옛 회원')
    check('변환: 3일 간격 반복 계산 그대로', ev("occursOn(member().tasks[1], '2026-11-26')") and not ev("occursOn(member().tasks[1], '2026-11-25')"))
    check('옷 갈아입기 제거: 저장된 옷이 있어도 기본 모습', 'devil' not in ev("mascot(member(), {})") and ev("typeof viewCloset") == 'undefined')

    # ---------- 반복 규칙 ----------
    def mk(rep, date='2026-01-31'):
        return f"({{ date: '{date}', repeat: {json.dumps(rep)} }})"
    check('매월 31일: 2월(없음)은 건너뜀, 3월 31일은 반복', not ev(f"occursOn({mk({'kind': 'monthly', 'every': 1})}, '2026-02-28')") and ev(f"occursOn({mk({'kind': 'monthly', 'every': 1})}, '2026-03-31')"))
    check('2달마다: 1월 → 3월 O, 2월 X', ev(f"occursOn({mk({'kind': 'monthly', 'every': 2}, '2026-01-15')}, '2026-03-15')") and not ev(f"occursOn({mk({'kind': 'monthly', 'every': 2}, '2026-01-15')}, '2026-02-15')"))
    check('매년 같은 월·일', ev(f"occursOn({mk({'kind': 'yearly', 'every': 1}, '2026-11-24')}, '2027-11-24')") and not ev(f"occursOn({mk({'kind': 'yearly', 'every': 1}, '2026-11-24')}, '2027-11-25')"))
    wk2 = {'kind': 'weekly', 'every': 2, 'days': [1, 3]}
    check('2주마다 월·수 (일요일 시작 주 기준)', ev(f"occursOn({mk(wk2, '2026-11-23')}, '2026-11-25')") and not ev(f"occursOn({mk(wk2, '2026-11-23')}, '2026-11-30')") and ev(f"occursOn({mk(wk2, '2026-11-23')}, '2026-12-07')"))
    check('반복 문구', ev(f"repeatText({mk(wk2, '2026-11-23')})") == '2주마다 월·수요일' and ev(f"repeatText({mk({'kind': 'monthly', 'every': 1}, '2026-11-24')})") == '매월 24일')

    # ---------- 새로 가입해서 폼으로 등록 ----------
    ev('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2300)
    pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)
    shot('01_today')
    check('추가 버튼: 오늘 화면에 + 하나', ev("document.querySelectorAll('[data-act=openAdd]').length") == 2 and ev("!!document.querySelector('#fab-slot .fab')"),
          ev("[...document.querySelectorAll('[data-act=openAdd]')].map(b=>b.className)"))
    check('캐릭터 메뉴(옷장·월간 시트) 없음', not ev("!!document.querySelector('.p-menu')") and ev("typeof viewMonthSheet") == 'undefined')
    pg.click('#fab-slot .fab'); pg.wait_for_timeout(500)
    shot('02_form_quick')
    check('빠른 등록: 처음엔 상세 설정 접힘', not ev("!!document.querySelector('[data-act=formRepeat]')") and ev("!!document.querySelector('[data-act=formMore]')"))
    check('빠른 등록: 시작 → 종료 한 줄 + 폼 안 달력', ev("document.querySelectorAll('.wb-date').length") == 2 and ev("!!document.querySelector('.fcal')"))
    pg.fill('#f-title', '캡스톤 보고서')
    # 폼 달력: 시작 날짜(오늘) 그대로 두고 끝 쪽을 골라 이틀 뒤를 누른다
    pg.click('.wb-date[data-v=end]'); pg.wait_for_timeout(200)
    pg.click(f'.fcal-cell[data-date="{ev("addDays(today(), 2)")}"]'); pg.wait_for_timeout(250)
    check('폼 달력: 기간 띠(시작·사이·끝)', ev("document.querySelectorAll('.fcal-cell.a, .fcal-cell.in, .fcal-cell.b').length") == 3)
    pg.click('.wb-time[data-v=end-time]'); pg.wait_for_timeout(200)
    ev("setWheel('end-h', '11')"); ev("setWheel('end-m', '00')")
    shot('03_form_end_picker')
    check('여러 날: 종료 날짜를 이틀 뒤로', ev('ui.form.endDate') == ev('addDays(today(), 2)') and '3일에 걸친' in ev("document.querySelector('#time-summary').textContent"))
    pg.click('[data-act=formMore]'); pg.wait_for_timeout(300)
    check('상세 설정 펼침: 반복·알림·색상·메모·강도·마감', all(ev(f"!!document.querySelector('{s}')") for s in ['[data-act=formRepeat]', '[data-act=formAlarm]', '[data-act=formColor]', '#f-memo', '#f-heat', '[data-act=formDl]']))
    pg.click('[data-act=formDl][data-v=end]'); pg.click('[data-act=formAlarm][data-v="30"]'); pg.click('[data-act=formColor][data-v=lilac]')
    pg.fill('#f-memo', '참고문헌 정리부터')
    shot('04_form_detail')
    pg.click('[data-act=formSave]'); pg.wait_for_timeout(500)
    t = ev("member().tasks.find(t => t.title === '캡스톤 보고서')")
    check('저장: 시작·종료 일시 따로', t and t['date'] == ev('today()') and t['endDate'] == ev('addDays(today(), 2)') and t['end'] == '11:00', t)
    check('저장: 마감 = 종료 (같은 값을 따로 입력하지 않음)', t and t['deadline']['enabled'] and t['deadline']['sameAsEnd'])
    check('저장: 알림·색상·메모', t and t['alarms'] == [30] and t['color'] == 'lilac' and t['memo'] == '참고문헌 정리부터')
    check('마감 시각 = 종료 시각', ev("(() => { const t = member().tasks.find(t => t.title === '캡스톤 보고서'); const w = occWindow(t, t.date); return w.deadline === w.end; })()"))

    # 폼 달력: 시작 → 끝 차례로 누르기 (삼성 캘린더 방식)
    ev("ACT.openAdd({dataset:{date: today()}})"); pg.wait_for_timeout(400)
    a1, a2 = ev("addDays(today(), 3)"), ev("addDays(today(), 5)")
    pg.click(f'.fcal-cell[data-date="{a1}"]'); pg.wait_for_timeout(200)
    check('시작 날짜를 누르면 끝 쪽으로 넘어감', ev('ui.form.date') == a1 and ev('ui.form.pick') == 'end')
    pg.click(f'.fcal-cell[data-date="{a2}"]'); pg.wait_for_timeout(200)
    check('끝 날짜 → 3일 기간', ev('ui.form.endDate') == a2)
    pg.click(f'.fcal-cell[data-date="{ev("addDays(today(), 1)")}"]'); pg.wait_for_timeout(200)
    check('끝 쪽에서 시작보다 앞 날짜 → 그날 하루 일정', ev('ui.form.date') == ev('addDays(today(), 1)') and ev('ui.form.endDate') == ev('addDays(today(), 1)'))
    check('지난 날짜 칸은 누를 수 없음', ev(f"document.querySelector('.fcal-cell[data-date=\"{ev('addDays(today(), -1)')}\"]')?.disabled") in (True, None))
    ev("ACT.formDiscard()"); pg.wait_for_timeout(300)

    # 일반 일정: 종일 + 매년
    ev("ACT.openAdd({dataset:{date: addDays(today(), 3)}})"); pg.wait_for_timeout(400)
    pg.click('[data-act=formType][data-v=normal]'); pg.fill('#f-title', '엄마 생신')
    pg.click('[data-act=formAllDay]'); pg.click('[data-act=formMore]'); pg.click('[data-act=formRepeat][data-v=yearly]'); pg.wait_for_timeout(200)
    check('잡도리 전용 설정은 일반 일정에서 숨김', not ev("!!document.querySelector('#f-heat')") and not ev("!!document.querySelector('[data-act=formDl]')"))
    pg.click('[data-act=formSave]'); pg.wait_for_timeout(400)
    t = ev("member().tasks.find(t => t.title === '엄마 생신')")
    check('저장: 종일 + 매년, 잡도리 값 없음', t and t['allDay'] and t['repeat']['kind'] == 'yearly' and t['heat'] is None and t['deadline'] is None, t)
    # 종류를 오갔을 때 잡도리 값이 남지 않는지
    ev("ACT.openAdd({dataset:{date: today()}})"); pg.wait_for_timeout(300)
    pg.click('[data-act=formMore]'); pg.click('[data-act=formDl][data-v=custom]'); pg.click('[data-act=formType][data-v=normal]'); pg.fill('#f-title', '종류 바꾼 일정'); pg.click('[data-act=formSave]'); pg.wait_for_timeout(400)
    t = ev("member().tasks.find(t => t.title === '종류 바꾼 일정')")
    check('잡도리 → 일반으로 바꾸면 마감·강도 저장 안 됨', t and t['deadline'] is None and t['heat'] is None, t)
    # 검증: 종료가 시작보다 앞
    ev("ACT.openAdd({dataset:{date: today()}})"); pg.wait_for_timeout(300)
    pg.fill('#f-title', '거꾸로'); pg.click('.wb-time[data-v=end-time]'); pg.wait_for_timeout(200); ev("setWheel('end-h','10')"); pg.click('[data-act=formSave]'); pg.wait_for_timeout(300)
    check('검증: 종료가 시작보다 앞이면 막음', '종료 시각이 시작 시각보다 뒤여야' in pg.inner_text('.form-sheet'))
    shot('05_form_error')
    ev("ACT.formDiscard()"); pg.wait_for_timeout(300)

    # ---------- 달력 ----------
    pg.click('[data-act=tab][data-tab=calendar]'); pg.wait_for_timeout(400)
    shot('06_month')
    head = ev("[...document.querySelectorAll('.mo-head span')].map(s=>s.textContent).join('')")
    check('월간 요일 순서 일~토', head == '일월화수목금토', head)
    cover = [ev(f"occurrencesCovering(member(), addDays(today(), {i})).some(o => o.task.title === '캡스톤 보고서')") for i in range(4)]
    check('여러 날 일정이 시작~종료 날짜 모두에 표시', cover == [True, True, True, False], cover)
    day2 = ev("occurrencesCovering(member(), addDays(today(), 1)).find(o => o.task.title === '캡스톤 보고서')")
    check('둘째 날은 2/3일째', day2['dayNo'] == 2 and day2['days'] == 3)
    check('월간 칸에 일정 제목', '캡스톤' in pg.inner_text('.mo-grid'))
    # 기간 선택
    pg.click('[data-act=rangeStart]'); pg.wait_for_timeout(200)
    d1, d2 = ev("addDays(today(), 5)"), ev("addDays(today(), 7)")
    if ev(f"!!document.querySelector('.mo-cell[data-date=\"{d1}\"]')") and ev(f"!!document.querySelector('.mo-cell[data-date=\"{d2}\"]')"):
        pg.click(f'.mo-cell[data-date="{d2}"]'); pg.wait_for_timeout(200); shot('07_range'); pg.click(f'.mo-cell[data-date="{d1}"]'); pg.wait_for_timeout(500)
        check('기간 선택 → 폼: 시작·종료 날짜 + 종일 (거꾸로 눌러도 정렬)', ev('ui.form.date') == d1 and ev('ui.form.endDate') == d2 and ev('ui.form.allDay'))
        ev("ACT.formDiscard()"); pg.wait_for_timeout(300)
    # 스와이프 → 다음 달
    m0 = ev('ui.calMonth')
    box = pg.query_selector('.cal-swipe').bounding_box()
    pg.dispatch_event('.cal-swipe', 'touchstart', {'touches': [{'clientX': 300, 'clientY': box['y'] + 100, 'identifier': 1}], 'changedTouches': [{'clientX': 300, 'clientY': box['y'] + 100, 'identifier': 1}]})
    pg.dispatch_event('.cal-swipe', 'touchend', {'touches': [], 'changedTouches': [{'clientX': 120, 'clientY': box['y'] + 110, 'identifier': 1}]})
    pg.wait_for_timeout(300)
    check('왼쪽으로 쓸면 다음 달', ev('ui.calMonth') != m0, (m0, ev('ui.calMonth')))
    pg.click('[data-act=calToday]'); pg.wait_for_timeout(300)
    check('오늘 버튼으로 복귀', ev('ui.calMonth') == m0 and ev('ui.selDate') == ev('today()'))
    # 주간
    pg.click('[data-act=calMode][data-v=week]'); pg.wait_for_timeout(300); shot('08_week')
    dates = ev("[...document.querySelectorAll('.ag-date b')].map(b=>b.textContent).join('')")
    check('주간 일~토', dates == '일월화수목금토', dates)
    s0 = ev('ui.selDate'); pg.click('[data-act=calNav][data-delta="1"]'); pg.wait_for_timeout(200)
    check('주간 다음 = 7일 뒤', ev('ui.selDate') == ev(f"addDays('{s0}', 7)"))
    pg.click('[data-act=calToday]'); pg.wait_for_timeout(200)
    # 일간
    pg.click('[data-act=calMode][data-v=day]'); pg.wait_for_timeout(400); shot('09_day')
    check('일간 시간표 24칸', ev("document.querySelectorAll('.tg-slot').length") == 24)
    check('일간: 오늘 시작한 여러 날 일정 블록', '캡스톤' in pg.inner_text('.tgrid'))
    pg.click('.tg-slot[data-min="540"]'); pg.wait_for_timeout(200)
    check('시간 칸 첫 탭 = 시작 표시', ev("!!document.querySelector('.tg-slot.picked')"))
    pg.click('.tg-slot[data-min="660"]'); pg.wait_for_timeout(500)
    check('두 번째 탭 → 폼: 09:00–12:00', ev('ui.form.start') == '09:00' and ev('ui.form.end') == '12:00')
    shot('10_form_from_slot')
    ev("ACT.formDiscard()"); pg.wait_for_timeout(300)
    s0 = ev('ui.selDate'); pg.click('[data-act=calNav][data-delta="-1"]'); pg.wait_for_timeout(200)
    check('일간 이전 = 하루 전', ev('ui.selDate') == ev(f"addDays('{s0}', -1)"))

    # ---------- 시간대·날짜 밀림 ----------
    check('자정 넘는 일정 종료 = 다음 날 (로컬 시간)', ev("(() => { const t = migrateTask({id:'x',type:'normal',title:'x',date:'2026-11-30',start:'23:30',endDate:'2026-12-01',end:'00:30',repeat:{kind:'none'}}); return durOf(t) === 60 && ymd(occWindow(t,'2026-11-30').end) === '2026-12-01'; })()"))
    check('월말·연말 경계 날짜 계산', ev("addDays('2026-12-31', 1)") == '2027-01-01' and ev("daysBetween('2027-02-28','2027-03-01')") == 1)

    b.close()

print('\n'.join(log))
print('ERRORS:', errors or '없음')
print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} 통과")
