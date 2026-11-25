"""미루먼지 v1 녹음(152개) 검수.
- 파일 152개가 모두 실제로 열리고(디코딩) 길이가 정상인지
- 앱 대사(알림 제목·알림 본문 제외)와 짧은 소리마다 맞는 녹음 파일이 연결되는지 (clipFor)
- 말하기 버튼을 누르면 기기 음성이 아니라 녹음 파일이 재생되는지, 정보 줄(제목·시간)은 읽지 않는지
- 전용 목소리를 끄면 기기 음성으로 바뀌는지, 말 빠르기 설정이 재생 속도에 반영되는지
(소리를 귀로 듣는 검사는 아니다. 재생 호출·파일 디코딩·연결만 확인한다)"""
import json, os
from playwright.sync_api import sync_playwright
HOOKS = __import__('pathlib').Path(__file__).resolve().parent / 'test_hooks.js'  # 검사 전용 도우미 (가상 시각·테스트 일정)
URL = 'file:///home/claude/jabdori-app/dist/index.html'
log, errors = [], []
def check(name, cond, extra=''):
    log.append(('OK  ' if cond else 'FAIL') + ' ' + name + (f'  [{extra}]' if extra and not cond else ''))

clips_json = json.load(open('/home/claude/jabdori-app/voice/clips.json', encoding='utf-8'))
want = {c['tpl']: c['file'] for c in clips_json}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='ko-KR', timezone_id='Asia/Seoul')
    ctx.add_init_script(path=str(HOOKS))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    ev = lambda c: pg.evaluate(c)
    pg.goto(URL); ev('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click('.btn-kakao'); pg.wait_for_timeout(1800); pg.click('[data-act=consentAgree]'); pg.wait_for_timeout(2300)
    pg.click('[data-act=onbSkip]'); pg.wait_for_timeout(400)

    # ---------- 1) 파일 152개 디코딩 ----------
    res = pg.evaluate("""async () => {
      const list = VOICE_PACKS.mireum.clips; const out = [];
      for (const [tpl, file] of list) {
        const src = VOICE_PACKS.mireum.dir + file + '.mp3';
        const r = await new Promise((ok) => { const a = new Audio(src); const t = setTimeout(() => ok({ file, err: 'timeout' }), 5000);
          a.onloadedmetadata = () => { clearTimeout(t); ok({ file, dur: a.duration }); }; a.onerror = () => { clearTimeout(t); ok({ file, err: 'error' }); }; a.load(); });
        out.push(r);
      }
      return out; }""")
    errs = [r for r in res if 'err' in r]
    durs = [r['dur'] for r in res if 'dur' in r]
    check('녹음 파일 152개 목록', len(res) == 152, len(res))
    check('152개 모두 열림(디코딩 오류 없음)', not errs, errs[:3])
    check('길이 0.4~5초 사이', durs and min(durs) > 0.4 and max(durs) < 5, (min(durs) if durs else None, max(durs) if durs else None))

    # ---------- 2) 대사 ↔ 파일 연결 ----------
    m = pg.evaluate("""() => { const L = []; const walk = (o) => { if (typeof o === 'string') L.push(o); else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const k in o) if (k !== 'notif') walk(o[k]); };
      walk(CHAR_MIREUM.lines); Object.keys(CHAR_MIREUM.vocals).forEach(v => L.push(v));
      return L.filter(t => !t.includes('{')).map(t => [t, (clipFor(t, 'mireum') || {}).src || null]); }""")
    miss = [t for t, s in m if not s]
    wrong = [t for t, s in m if s and not s.endswith('/' + want.get(t, '?') + '.mp3')]
    check(f'화면 대사·짧은 소리 {len(m)}개 모두 녹음 연결', not miss, miss[:5])
    check('연결된 파일이 녹음 대본 번호와 같음', not wrong, wrong[:5])

    # ---------- 3) 말하기 버튼 → 녹음 재생, 정보 줄은 안 읽음 ----------
    ev("""(() => { window.__played = []; window.__device = [];
      HTMLMediaElement.prototype.play = function () { window.__played.push({ src: this.src, rate: this.playbackRate }); return Promise.resolve(); };
      if (window.speechSynthesis) speechSynthesis.speak = (u) => window.__device.push(u.text); })()""")
    ev("(() => { const m = member(); m.tasks = [migrateTask({ id: 't1', type: 'jab', title: '데이터베이스 과제', date: today(), start: minToHm(Math.max(0, (new Date(now()).getHours() * 60 + new Date(now()).getMinutes()) - 25)), endDate: today(), end: '23:50', heat: 40, repeat: { kind: 'none' }, alarms: [], memo: '', deadline: null })]; save(); render(); })()")
    pg.wait_for_timeout(300)
    sp = ev("(() => { const s = document.querySelector('.speech'); return s ? { line: speechText(s), fact: (s.querySelector('.speech-fact') || {}).textContent || '' } : null; })()")
    btn = pg.query_selector('[data-act=speak]')
    if btn: btn.click(); pg.wait_for_timeout(300)
    played = ev('window.__played'); dev = ev('window.__device')
    check('오늘 화면 말풍선이 있음', bool(sp), sp)
    check('말하기 → 녹음 파일 재생', bool(played) and played[-1]['src'].endswith('.mp3'), (played, dev))
    check('재생한 파일 = 말풍선 대사의 녹음', bool(played) and sp and played[-1]['src'].endswith('/' + want.get(sp['line'], '?') + '.mp3'), (sp, played[-1:] if played else None))
    check('기기 음성은 안 씀', not dev, dev)
    check('정보 줄(제목·시간)은 읽는 문장에 없음', sp and '데이터베이스' not in sp['line'], sp)

    # ---------- 4) 말 빠르기 → 재생 속도 ----------
    ev("(() => { const v = voicePrefs(); v.speed = Object.keys(VOICE_SPEEDS).find(k => VOICE_SPEEDS[k].k > 1) || v.speed; save(); TTS.last = { text: '', at: 0 }; TTS.speak('퐁! 시간이다아!'); })()")
    pg.wait_for_timeout(200)
    last = ev('window.__played[window.__played.length - 1]')
    check('말 빠르기 설정이 재생 속도에 반영', last and last['rate'] > 1 and last['src'].endswith('/m014.mp3'), last)

    # ---------- 5) 전용 목소리 끄면 기기 음성 ----------
    ev("(() => { const v = voicePrefs(); v.useClips = false; save(); window.__played = []; window.__device = []; TTS.speak('퐁! 시간이다아!'); })()")
    pg.wait_for_timeout(200)
    check('전용 목소리 끄면 녹음 대신 기기 음성', not ev('window.__played').__len__() and len(ev('window.__device')) == 1, (ev('window.__played'), ev('window.__device')))
    ev("(() => { const v = voicePrefs(); v.useClips = true; save(); })()")

    # ---------- 6) 녹음이 없는 문장은 기기 음성 ----------
    ev("(() => { window.__played = []; window.__device = []; TTS.speak('녹음에 없는 문장이에요'); })()"); pg.wait_for_timeout(200)
    check('녹음 없는 문장은 기기 음성으로', not ev('window.__played').__len__() and len(ev('window.__device')) == 1)

    # ---------- 7) 출처 표기 ----------
    credit = ev('VOICE_PACKS.mireum.credit')
    check('ElevenLabs 출처 표기 문구가 있음', 'ElevenLabs' in credit, credit)
    b.close()

print('\n'.join(log)); print('errors:', errors[:5]); print(f"{sum(1 for l in log if l.startswith('OK'))}/{len(log)} OK")
