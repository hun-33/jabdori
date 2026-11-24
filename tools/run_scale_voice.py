"""미루먼지 농도·단계 이름 설정·목소리(TTS) 검수.
- 온도/° 표현이 화면 어디에도 남지 않았는지
- 캐릭터별(미루먼지 농도: 좋음~최악) ↔ 공통(잡도리 강도: 순한맛~최고 매운맛) 전환
- 쌓인 먼지(실패 +10, 3연속 성공 시 털기)
- 숫자 조사 (60이에요 / 62예요 / 10으로 / 7로)
- 목소리: 소리 모드(끄기·중요할 때만·모든 멘트), 중복 방지, 단계별 빠르기, 읽기 다듬기
"""
import re
from playwright.sync_api import sync_playwright
URL = 'file:///home/claude/jabdori-app/dist/index.html'
OUT = '/home/claude/jabdori-app/shots'
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra and not cond else ''))
# 브라우저 음성 엔진을 가짜로 바꿔, 무엇을 어떤 빠르기로 읽었는지 기록한다
MOCK = """
window.__said = [];
const fake = {
  speak(u) { window.__said.push({ text: u.text, rate: u.rate, pitch: u.pitch, lang: u.lang }); },
  cancel() {}, getVoices() { return [{ lang: 'ko-KR', name: '테스트 한국어', localService: true }]; },
  addEventListener() {},
};
Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
window.SpeechSynthesisUtterance = function (t) { this.text = t; };
"""
HEAT_WORDS = re.compile(r'온도|°|미지근|따끈|뜨끈|부글|펄펄|바닥 온도')
def all_text(pg):
    return pg.evaluate("[...document.querySelectorAll('#screen, #layer-sheet, #layer-result, #layer-popup, #layer-banner, #tabbar')].map(e => e.innerText).join('\\n')")
def no_heat(pg, where):
    t = all_text(pg)
    m = HEAT_WORDS.search(t)
    check(f'온도 표현 없음 · {where}', m is None, m.group(0) + ' … ' + t[max(0, m.start() - 30):m.end() + 30] if m else '')
def said(pg): return pg.evaluate('window.__said.map(s => s.text)')
def clear_said(pg): pg.evaluate('window.__said.length = 0')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='ko-KR')
    ctx.add_init_script(MOCK)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    ev = lambda c: pg.evaluate(c)

    # 0) 조사·캐릭터 목록 (순수 함수)
    check('숫자 조사 60이에요', ev("josa('60','이에요/예요')") == '60이에요')
    check('숫자 조사 62예요', ev("josa('62','이에요/예요')") == '62예요')
    check('숫자 조사 10으로', ev("josa('10','으로/로')") == '10으로')
    check('숫자 조사 7로', ev("josa('7','으로/로')") == '7로')
    check('기본 캐릭터 미루먼지', ev("charOf(null).id") == 'mireum')
    check('없는 캐릭터 id → 기본', ev("charOf({characterId:'nobody'}).id") == 'mireum')
    check('읽기 다듬기 18:30 → 18시 30분', ev("speakable('과제 18:30에 부를게… (진짜)')") == '과제 18시 30분에 부를게, 진짜', ev("speakable('과제 18:30에 부를게… (진짜)')"))
    check('읽기 다듬기 18:00–20:00', ev("speakable('18:00–20:00')") == '18시에서 20시')

    # 1) 로그인·온보딩
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2200)
    check('새 회원 캐릭터·단계 설정 기본값', ev("member().characterId") == 'mireum' and ev("member().scaleMode") == 'character')
    pg.click('[data-act=onbNext]'); pg.wait_for_timeout(200)
    pg.click('[data-act=onbNext]'); pg.wait_for_timeout(250)
    t = all_text(pg)
    check('온보딩 단계: 좋음~최악', all(n in t for n in ['좋음', '보통', '나쁨', '매우 나쁨', '최악']))
    check('온보딩 단계: 먼지 농도 설명', '먼지 농도' in t)
    no_heat(pg, '온보딩 단계')
    clear_said(pg); pg.click('[data-act=onbStage][data-s="5"]'); pg.wait_for_timeout(150)
    pg.click('.scale-desc [data-act=speakSample]'); pg.wait_for_timeout(100)
    check('온보딩 단계 들어 보기(끄기 모드여도 직접 누르면 읽음)', len(said(pg)) == 1)
    pg.screenshot(path=f'{OUT}/sv_01_onb_stage.png')
    pg.click('[data-act=onbNext]'); pg.wait_for_timeout(250)
    t = all_text(pg)
    check('온보딩 마지막: 먼지가 쌓여', '먼지가 쌓여' in t and '먼지가 10만큼 쌓여서' in t)
    no_heat(pg, '온보딩 마지막')
    pg.click('[data-act=onbFinish][data-to=home]'); pg.wait_for_timeout(400)

    # 2) 오늘: 맡은 일 없음 → 쌓인 먼지 50
    t = all_text(pg)
    check('오늘: 큰 숫자 이름 = 쌓인 먼지', pg.inner_text('.pt-label') == '쌓인 먼지')
    check('오늘: 아래 안내 쌓인 먼지 50', '쌓인 먼지 50' in t, t[-200:])
    no_heat(pg, '오늘 (빈 상태)')
    pg.click('[data-act=mascotTap]'); pg.wait_for_timeout(200)
    check('캐릭터 터치: 메뉴 대신 짧은 반응', pg.query_selector('.p-menu') is None and ev('ui.react && ui.react.id') == 'tap')

    # 3) 일정 올리기 폼: 슬라이더 눈금 = 좋음~최악
    ev("ACT.cSeed()"); pg.wait_for_timeout(300)
    ev("ACT.openAdd({dataset:{date:today()}})"); pg.wait_for_timeout(500); ev("ACT.formMore()"); pg.wait_for_timeout(200)
    t = pg.inner_text('#layer-sheet')
    check('폼: 미루먼지 농도 구역', '미루먼지 농도' in t and '좋음' in t and '최악' in t)
    no_heat(pg, '일정 올리기 폼')
    pg.screenshot(path=f'{OUT}/sv_02_form.png')
    pg.click('[data-act=formClose]'); pg.wait_for_timeout(200)
    if pg.query_selector('[data-act=formDiscard]'): pg.click('[data-act=formDiscard]'); pg.wait_for_timeout(200)

    # 4) 시작 → 집중 모드 → 영수증 → 실패
    pg.click('.ticket [data-act=startOcc]'); pg.wait_for_timeout(400)
    ev("ACT.cTime({dataset:{hm:'19:40'}})"); pg.wait_for_timeout(300)
    pg.click('[data-act=toggleReceipt]'); pg.wait_for_timeout(200)
    t = all_text(pg)
    check('영수증: 왜 농도가 N일까?', re.search(r'왜 농도가 \d+일까\?', t) is not None)
    check('영수증: 시작 농도 / 지금 농도', '시작 농도' in t and '지금 농도' in t)
    no_heat(pg, '집중 모드·영수증')
    pg.screenshot(path=f'{OUT}/sv_03_focus.png')
    pg.click('[data-act=giveUp]'); pg.wait_for_timeout(250)
    t = pg.inner_text('#layer-sheet')
    check('포기 확인: 쌓인 먼지가 50 → 60으로', '쌓인 먼지가' in t and '50 → 60' in t and '60으로' in t, t)
    pg.click('[data-act=confirmFail]'); pg.wait_for_timeout(250)
    pg.click('[data-act=excuse][data-v=time]'); pg.wait_for_timeout(700)
    t = all_text(pg)
    check('결과: 먼지 +10 · 쌓인 먼지 50 → 60', '먼지 +10' in t and '쌓인 먼지 50 → 60' in t, t[:400])
    check('결과: 농도 60부터 시작', '농도 60부터' in t)
    no_heat(pg, '실패 결과')
    pg.screenshot(path=f'{OUT}/sv_04_result_fail.png')
    pg.click('[data-act=resultRecord]'); pg.wait_for_timeout(400)
    t = all_text(pg)
    check('기록: 지금 쌓인 먼지 60', '지금 쌓인 먼지' in t and '60' in t)
    check('기록: 먼지 1겹 (+10)', '먼지 1겹 (+10)' in t)
    no_heat(pg, '기록 탭')
    pg.click('.rec-row'); pg.wait_for_timeout(300)
    t = pg.inner_text('#layer-sheet')
    check('기록 상세 로그: 쌓인 먼지 50 → 60', '쌓인 먼지 50 → 60' in t, t)
    no_heat(pg, '기록 상세')
    pg.click('#layer-sheet [data-act=closeSheet]'); pg.wait_for_timeout(200)

    # 5) 나 탭: 단계 이름 공통으로
    pg.click('[data-act=tab][data-tab=me]'); pg.wait_for_timeout(300)
    t = all_text(pg)
    check('나: 미루먼지 농도 구역·쌓인 먼지 60', '미루먼지 농도' in t and '쌓인 먼지' in t and '60' in t)
    check('나: 단계 이름 설정 보임', pg.query_selector('[data-act=scaleMode][data-v=common]') is not None)
    check('나: 목소리 설정 보임', pg.query_selector('[data-act=voiceMode][data-v=key]') is not None)
    no_heat(pg, '나 탭')
    pg.screenshot(path=f'{OUT}/sv_05_me_character.png', full_page=True)
    pg.click('[data-act=scaleMode][data-v=common]'); pg.wait_for_timeout(300)
    t = all_text(pg)
    check('공통: 잡도리 강도·순한맛~최고 매운맛', '잡도리 강도' in t and '순한맛' in t and '최고 매운맛' in t)
    check('공통: 최저 강도 60', '최저 강도' in t)
    check('공통: 저장됨', ev("member().scaleMode") == 'common')
    pg.screenshot(path=f'{OUT}/sv_06_me_common.png', full_page=True)
    pg.click('[data-act=tab][data-tab=records]'); pg.wait_for_timeout(300)
    pg.click('.rec-row'); pg.wait_for_timeout(300)
    check('공통: 옛 로그도 새 이름으로 (최저 강도 50 → 60)', '최저 강도 50 → 60' in pg.inner_text('#layer-sheet'))
    pg.click('#layer-sheet [data-act=closeSheet]'); pg.wait_for_timeout(200)
    pg.click('[data-act=tab][data-tab=today]'); pg.wait_for_timeout(300)
    check('공통: 오늘 큰 숫자 이름 = 최저 강도', pg.inner_text('.pt-label') == '최저 강도')
    no_heat(pg, '오늘 (공통 이름)')
    ev("ACT.openAdd({dataset:{date:today()}})"); pg.wait_for_timeout(500); ev("ACT.formMore()"); pg.wait_for_timeout(200)
    t = pg.inner_text('#layer-sheet')
    check('공통: 폼 눈금 순한맛·최저 강도 60', '순한맛' in t and '최저 강도' in t, t[-600:])
    pg.click('[data-act=formClose]'); pg.wait_for_timeout(200)
    if pg.query_selector('[data-act=formDiscard]'): pg.click('[data-act=formDiscard]'); pg.wait_for_timeout(200)
    # 캐릭터별로 되돌리기
    pg.click('[data-act=tab][data-tab=me]'); pg.click('[data-act=scaleMode][data-v=character]'); pg.wait_for_timeout(200)
    check('캐릭터별로 되돌림', ev("member().scaleMode") == 'character' and '쌓인 먼지' in all_text(pg))

    # 6) 목소리
    check('목소리 기본값 끄기', ev("voicePrefs().mode") == 'off')
    pg.click('[data-act=voiceMode][data-v=key]'); pg.wait_for_timeout(200)
    check('중요할 때만 저장', ev("state.voice.mode") == 'key')
    pg.click('[data-act=tab][data-tab=today]'); pg.wait_for_timeout(300)
    # 내일 일정 하나 더 올려 시작 시각 배너를 만든다
    clear_said(pg)
    ev("(() => { const m = member(); const t = m.tasks[0]; ACT.cTime({dataset:{hm:'23:00'}}); })()"); pg.wait_for_timeout(300)
    ev("ACT.cSeed()"); pg.wait_for_timeout(300)
    ev("(() => { const m = member(); m.tasks.push({ ...m.tasks[0], id: 'tv1', title: '음성 테스트', date: today(), start: '23:10', duration: 30, repeat: { kind: 'none', days: [] }, deadline: { enabled: false }, createdAt: now() - 60000 }); save(); render(); })()"); pg.wait_for_timeout(300)
    clear_said(pg)
    ev("ACT.cTime({dataset:{hm:'23:10'}})"); pg.wait_for_timeout(400)
    s = said(pg)
    check('중요할 때만: 시작 시간 배너를 읽음', any('음성 테스트' in x and '시간이야' in x for x in s), s)
    check('중요할 때만: 말풍선 변화는 따로 안 읽음', len(s) == 1, s)
    clear_said(pg)
    ev("showBanner('같은 말 테스트', '', {expr:'focus'}); showBanner('같은 말 테스트', '', {expr:'focus'})"); pg.wait_for_timeout(200)
    check('같은 말 15초 안에 두 번 안 읽음', len(said(pg)) == 1, said(pg))
    # 모든 멘트
    pg.click('[data-act=tab][data-tab=me]'); pg.click('[data-act=voiceMode][data-v=all]'); pg.wait_for_timeout(200)
    pg.click('[data-act=tab][data-tab=today]'); pg.wait_for_timeout(300)
    clear_said(pg); ev("TTS.busyUntil = 0; TTS.lastPri = ''")
    pg.click('.ticket [data-act=startOcc]'); pg.wait_for_timeout(400)
    s = said(pg)
    check('모든 멘트: 말풍선이 바뀌면 읽음 (시작 → 집중 모드 첫마디)', len(s) >= 1, s)
    pg.click('[data-act=exitFocus]'); pg.wait_for_timeout(300)
    # 단계별 빠르기: 5단계가 1단계보다 빠르고 높다
    p1 = ev("TTS.params(1)"); p5 = ev("TTS.params(5)")
    check('5단계 목소리 더 빠르고 높게', p5['rate'] > p1['rate'] and p5['pitch'] > p1['pitch'], (p1, p5))
    pg.click('[data-act=tab][data-tab=me]'); pg.click('[data-act=voiceSpeed][data-v=fast]'); pg.wait_for_timeout(200)
    check('말 빠르기 빠르게 반영', ev("TTS.params(1).rate") > p1['rate'])
    clear_said(pg); pg.click('[data-act=voiceTest]'); pg.wait_for_timeout(100)
    check('목소리 들어 보기', len(said(pg)) == 1 and said(pg)[0])
    # 끄기: 배너도 안 읽음, 직접 버튼은 읽음
    pg.click('[data-act=voiceMode][data-v=off]'); pg.wait_for_timeout(200)
    clear_said(pg); ev("showBanner('끄기 테스트 배너', '', {expr:'focus'})"); pg.wait_for_timeout(150)
    check('끄기: 배너 안 읽음', len(said(pg)) == 0, said(pg))
    pg.click('[data-act=tab][data-tab=today]'); pg.wait_for_timeout(300)
    clear_said(pg)
    if pg.query_selector('.say-btn'): pg.click('.say-btn'); pg.wait_for_timeout(100)
    check('끄기: 스피커 버튼은 읽음', len(said(pg)) == 1)
    # 옛 설정 이어받기 (ttsAuto: true → 모든 멘트)
    ev("(() => { const s = JSON.parse(localStorage.getItem(STORE_KEY)); delete s.voice; s.ttsAuto = true; localStorage.setItem(STORE_KEY, JSON.stringify(s)); })()")
    pg.reload(); pg.wait_for_timeout(600)
    check('옛 멘트 소리 켜짐 → 모든 멘트로 이어받음', ev("state.voice.mode") == 'all' and ev("'ttsAuto' in state") is False)
    b.close()
print('\n'.join(log))
print('ERRORS:', '\n'.join(errors) if errors else 'none')
