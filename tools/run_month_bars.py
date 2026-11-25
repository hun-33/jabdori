"""월간 막대 + 종일 버튼 검수.
- 여러 날 일정이 칸마다 끊기지 않고 한 막대로 이어지는지, 주가 바뀌면 다음 주 줄에서도 제목이 다시 나오는지 (갤럭시 캘린더 방식)
- 한 주에 줄이 넘치면 +N
- 막대를 눌러도 그 날짜가 선택되는지 (막대가 탭을 가로채지 않음)
- 종일 버튼: 잡도리 상태에서도 눌리고, 새 일정은 일반 일정으로 / 고치는 일정은 잡도리 끔으로 바뀌는지"""
import json, os
from playwright.sync_api import sync_playwright
HOOKS = __import__('pathlib').Path(__file__).resolve().parent / 'test_hooks.js'  # 검사 전용 도우미 (가상 시각·테스트 일정)
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots/month_bars'
os.makedirs(OUT, exist_ok=True)
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra and not cond else ''))

TASKS = [
    # 사용자 화면과 같은 일정: 11/27(금) 18:00 → 12/1(화) 20:00 (주가 바뀌는 구간)
    dict(id='s1', type='jab', title='시연', date='2026-11-27', start='18:00', endDate='2026-12-01', end='20:00', heat=40, color='sky'),
    # 갤럭시 사진처럼: 16~20 이어진 일정 + 19~21(토) 이어진 일정
    dict(id='s2', type='normal', title='선거 유세', date='2026-11-16', start='00:00', endDate='2026-11-20', end='23:59', allDay=True, color='sun'),
    dict(id='s3', type='normal', title='졸작 다과 준비', date='2026-11-19', start='00:00', endDate='2026-11-21', end='23:59', allDay=True, color='sun'),
    # 17일 하루에 일정 4개 → 줄이 넘쳐 +N
    dict(id='a1', type='normal', title='3학년 1분반', date='2026-11-17', start='09:00', endDate='2026-11-17', end='10:00', color='sun'),
    dict(id='a2', type='normal', title='1학년 1분반', date='2026-11-17', start='11:00', endDate='2026-11-17', end='12:00', color='sun'),
    dict(id='a3', type='normal', title='3학년 2분반', date='2026-11-17', start='13:00', endDate='2026-11-17', end='14:00', color='sun'),
    dict(id='a4', type='normal', title='2학년 전체', date='2026-11-17', start='15:00', endDate='2026-11-17', end='16:00', color='mint'),
    dict(id='b1', type='normal', title='교정치과', date='2026-11-26', start='10:00', endDate='2026-11-26', end='11:00', color='sky'),
]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR', timezone_id='Asia/Seoul')
    ctx.add_init_script(path=str(HOOKS))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')
    ev = lambda c: pg.evaluate(c)

    pg.goto(URL); ev('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2300)
    pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)
    ev(f"(() => {{ const m = member(); m.tasks = {json.dumps(TASKS)}.map(t => migrateTask({{ repeat: {{ kind: 'none' }}, alarms: [], memo: '', deadline: null, ...t }})); save(); render(); }})()")
    pg.click('[data-act=tab][data-tab=calendar]'); pg.wait_for_timeout(300)
    if ev('ui.calMode') != 'month': pg.click('[data-act=calMode][data-v=month]'); pg.wait_for_timeout(300)
    pg.click('.mo-cell[data-date="2026-11-27"]'); pg.wait_for_timeout(300)
    shot('01_month_nov')

    # ---------- 1) 11/27 → 12/1: 주마다 한 막대, 둘 다 제목 ----------
    bars = ev("""[...document.querySelectorAll('.mo-bar[data-key^="s1"]')].map(b => ({ t: b.textContent, c: b.className, col: b.style.gridColumn, w: b.getBoundingClientRect().width }))""")
    check('시연: 주가 바뀌어 막대 2개(이번 주 + 다음 주)', len(bars) == 2, bars)
    check('시연: 두 막대 모두 제목이 들어감', all(x['t'] == '시연' for x in bars), bars)
    check('시연: 이번 주 막대 = 금·토 2칸, 다음 주로 이어짐 표시', len(bars) == 2 and bars[0]['col'].startswith('6 / span 2') and 'cr' in bars[0]['c'] and 'multi' in bars[0]['c'], bars)
    check('시연: 다음 주 막대 = 일·월·화 3칸, 지난주에서 이어짐 표시', len(bars) == 2 and bars[1]['col'].startswith('1 / span 3') and 'cl' in bars[1]['c'], bars)
    cw = ev("document.querySelector('.mo-cell').getBoundingClientRect().width")
    check('시연: 막대가 칸 사이에서 끊기지 않음 (폭 ≈ 2칸)', len(bars) == 2 and abs(bars[0]['w'] - 2 * cw) < 4, (bars[0]['w'] if bars else None, cw))
    align = ev("getComputedStyle(document.querySelector('.mo-bar.multi')).textAlign")
    check('여러 날 일정 제목은 가운데 정렬', align == 'center', align)
    one = ev("getComputedStyle(document.querySelector('.mo-bar[data-key^=\"b1\"]')).textAlign")
    check('하루 일정은 왼쪽 정렬 (막대와 구분)', one in ('left', 'start'), one)

    # ---------- 2) 16~20 한 막대, 19~21 한 막대, 같은 주 줄 겹치지 않음 ----------
    s2 = ev("""[...document.querySelectorAll('.mo-bar[data-key^="s2"]')].map(b => [b.style.gridColumn, b.style.gridRow])""")
    s3 = ev("""[...document.querySelectorAll('.mo-bar[data-key^="s3"]')].map(b => [b.style.gridColumn, b.style.gridRow])""")
    check('선거 유세 16~20: 막대 1개 5칸', len(s2) == 1 and s2[0][0].startswith('2 / span 5'), s2)
    check('졸작 다과 준비 19~21: 막대 1개 3칸, 다른 줄', len(s3) == 1 and s3[0][0].startswith('5 / span 3') and s3[0][1] != s2[0][1], (s2, s3))

    # ---------- 3) 줄이 넘치면 +N ----------
    more = ev("[...document.querySelectorAll('.mo-more')].map(x => [x.style.gridColumn, x.textContent])")
    check('17일: 일정이 넘쳐 +N 표시', any(c.startswith('3') and t.startswith('+') for c, t in more), more)
    vis17 = ev("[...document.querySelectorAll('.mo-bar')].filter(b => { const c = b.style.gridColumn; const [s, sp] = [parseInt(c), parseInt(c.split('span')[1] || 1)]; return b.closest('.mo-week').querySelector('[data-date=\"2026-11-17\"]') && s <= 3 && 3 < s + sp; }).length")
    total17 = ev("occurrencesCovering(member(), '2026-11-17').length")
    hidden17 = int(next((t[1:] for c, t in more if c.startswith('3')), '0'))
    check('17일: 보이는 막대 + N = 그날 일정 수', vis17 + hidden17 == total17, (vis17, hidden17, total17))

    # ---------- 4) 막대 위를 눌러도 날짜 선택 ----------
    box = ev("(() => { const r = document.querySelector('.mo-bar[data-key^=\"s2\"]').getBoundingClientRect(); return [r.x + r.width * 0.5, r.y + r.height / 2]; })()")
    pg.mouse.click(box[0], box[1]); pg.wait_for_timeout(250)
    check('막대 가운데(18일)를 눌러도 18일이 선택됨', ev('ui.selDate') == '2026-11-18', ev('ui.selDate'))

    # ---------- 5) 목록 시각 문구 ----------
    pg.click('.mo-cell[data-date="2026-11-27"]'); pg.wait_for_timeout(250)
    meta = pg.inner_text('.rows')
    check('목록: 여러 날 시각을 "18:00 – 12월 1일 20:00"으로', '18:00 – 12월 1일 20:00' in meta and '(+4)' not in meta, meta[:120])

    # ---------- 6) 12월로 넘겨도 이어진 막대 + 제목 ----------
    pg.click('[data-act=calNav][data-delta="1"]'); pg.wait_for_timeout(300); shot('02_month_dec')
    dec = ev("""[...document.querySelectorAll('.mo-bar[data-key^="s1"]')].map(b => [b.textContent, b.style.gridColumn])""")
    check('12월 첫 주: 시연 막대 1개(일~화) + 제목', len(dec) == 1 and dec[0][0] == '시연' and dec[0][1].startswith('1 / span 3'), dec)
    pg.click('[data-act=calToday]'); pg.wait_for_timeout(200)

    # ---------- 7) 종일 버튼 (새 일정 · 잡도리 상태) ----------
    pg.click('#fab-slot .fab'); pg.wait_for_timeout(500)
    check('새 일정은 잡도리로 시작', ev('ui.form.type') == 'jab')
    check('종일 버튼이 막혀 있지 않음', not ev("document.querySelector('[data-act=formAllDay]').disabled"))
    pg.click('[data-act=formAllDay]'); pg.wait_for_timeout(250); shot('03_form_allday_on')
    check('종일 켜짐 → 일반 일정으로 바뀜 + 안내 문구', ev('ui.form.allDay') and ev('ui.form.type') == 'normal' and '일반 일정' in pg.inner_text('.hint.note'))
    check('종일 켜짐: 시각 대신 "종일"', ev("[...document.querySelectorAll('.wb-time')].every(x => x.textContent.includes('종일'))"))
    pg.click('[data-act=formAllDay]'); pg.wait_for_timeout(250)
    check('종일 끔 → 다시 잡도리', not ev('ui.form.allDay') and ev('ui.form.type') == 'jab' and not ev("!!document.querySelector('.hint.note')"))
    pg.click('[data-act=formType][data-v=normal]'); pg.click('[data-act=formAllDay]'); pg.wait_for_timeout(150)
    check('일반 일정에서 종일: 그대로 일반 일정, 안내 없음', ev('ui.form.allDay') and ev('ui.form.type') == 'normal' and not ev("!!document.querySelector('.hint.note')"))
    pg.click('[data-act=formClose]'); pg.wait_for_timeout(300)

    # ---------- 8) 종일 버튼 (고치는 잡도리 일정) ----------
    ev("(() => { const m = member(), task = findTask(m, 's1'); ui.form = draftFromTask(m, task); openSheet({ type: 'form', id: task.id }); })()"); pg.wait_for_timeout(400)
    pg.click('[data-act=formAllDay]'); pg.wait_for_timeout(250); shot('04_edit_allday')
    check('고치는 잡도리: 종일 켜면 잡도리 끔 + 안내', ev('ui.form.allDay') and ev('ui.form.jabOn') is False and '잡도리를 껐어요' in pg.inner_text('.hint.note'))
    pg.click('[data-act=formSave]'); pg.wait_for_timeout(400)
    t = ev("member().tasks.find(t => t.id === 's1')")
    check('저장: 종일 · 잡도리 끔 · 기간 유지', t['allDay'] and t['jabOn'] is False and t['date'] == '2026-11-27' and t['endDate'] == '2026-12-01', {k: t.get(k) for k in ('allDay', 'jabOn', 'date', 'endDate')})

    b.close()

print('\n'.join(log))
print('errors:', errors[:5])
print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
