"""캐릭터 대사(src/01-core.js) → 목소리 대본 (voice/clips.json, voice/batchN.txt/.json)
사용: python3 tools/make_voice_script.py

- 화면에 나오는 대사를 그대로 읽는다. 단, {title}·{late}처럼 바뀌는 값이 든 대사는 미리 녹음할 수 없으니
  값을 뺀 '말하는 버전(spoken)'을 아래 SPOKEN에 따로 적어 둔다. 앱은 대사 틀로 파일을 찾아 이 버전을 튼다.
- 폰 알림(notif.*)은 소리로 읽지 않으니 뺀다.
- 짧은 발성(퐁!, 킁킁 …)은 발성 사전에서 가져와 따로 묶는다 (vocal.*).
- 한 묶음 20줄 안팎. 줄 사이 빈 줄 = 생성할 때 쉬는 자리 (나중에 split_voice.py가 여기서 자른다)."""
import json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
d = json.loads(subprocess.run(['node', str(root / 'tools' / 'lines_dump.js')], capture_output=True, text=True, check=True).stdout)
SPOKEN = {
    'upcoming.0': '곧 시작이다? 나 대기 중!', 'upcoming.1': '폴폴… 얼마 안 남았어. 딴소리하기 없기!', 'upcoming.2': '곧 시간이야! 나 보고 있다아?',
    'due.0': '퐁! 시간이야! 가자 가자!', 'due.2': '땡! 시작! 어서어!',
    'late.1.0': '어라? 시간 지났는데에… 살짝만 열어 볼래?', 'late.1.2': '폴폴… 기다리는 중이야아.', 'late.2.1': '어라? 시간 지났다? 나 갸웃갸웃해.',
    'late.3.1': '한참 지났어! 나 부풀기 시작했어어.', 'late.3.2': '뿌우! 혼자서는 안 끝난다구!', 'late.4.1': '계속 그대로야! 나 따끔따끔해!',
    'late.4.2': '이러다 진짜 큰일 난다구!', 'late.5.1': '아직이야? 빵빵해애!',
    'running.2.1': '잘하고 있어! 나 살짝 작아졌다?', 'running.3.0': '많이 했어! 아직 남았다아?', 'running.3.1': '조금만 더 빨리이!',
    'running.4.0': '빠듯해애!', 'running.5.0': '지금 아니면 없어어!',
    'urgent.0': '얼마 안 남았어! 마무리, 마무리이!', 'urgent.1': '쭈뼛! 다듬지 말고 끝내!', 'urgent.2': '마감 코앞이야! 제출할 곳 열어 놨어?',
    'urgent.3': '으아아! 마감 온다! 마감 온다구!', 'urgent.4': '빵빵! 일단 내고 보자아!',
    'break.0': '후우~ 잠깐만 둥실 쉬자아.', 'break.1': '물 한 모금! 이따 콕 부를게.', 'break.2': '몽글… 잠깐만이다? 나 시계 본다.',
    'breakOver.1': '휴식 시간 넘었어! 돌아와아!', 'breakOver.2': '어라? 5분이라며! 벌써 더 쉬었다?',
    'slackAsk.0': '킁킁… 딴짓 냄새 난다아?', 'slackAsk.1': '어라라? 하다 말고 딴짓?', 'slackAsk.2': '킁킁! 딴짓 냄새! 거기서 뭐 해?',
    'doneEarly.0': '우와아! 해냈다! 마감 전에 끝냈어!', 'doneNone.0': '우와아! 끝!',
    'saved.0': '오잉! 새 일정이다아! 접수!', 'saved.1': '퐁! 시간 되면 콕 부를게!', 'saved.2': '킁킁… 새 일정 냄새 기억했어!',
    'banner.start': '퐁! 시간이야! 가자 가자!', 'banner.urgent': '쭈뼛! 마감 얼마 안 남았어! 마무리이!', 'banner.due': '땡! 마감이야! 결과 알려 줘!',
    'banner.lateHard': '빵빵! 아직이지? 폰 내려놓고 열어!', 'banner.breakOver': '뿌우? 쉬는 시간 끝! 다시 콕!',
}
rows, files = [], {}  # files: 말하는 문장 → 파일 이름 (같은 문장은 한 번만 녹음하고 여러 대사 틀이 같이 쓴다)
for x in d['lines']:
    if x['id'].startswith('notif.'): continue
    if '{' in x['tpl'] and x['id'] not in SPOKEN: raise SystemExit(f"말하는 버전이 없어요: {x['id']} {x['tpl']}")
    rows.append({'id': x['id'], 'tpl': x['tpl'], 'spoken': SPOKEN.get(x['id'], x['tpl'])})
for v in d['vocals']:
    rows.append({'id': 'vocal.' + v, 'tpl': v, 'spoken': v})
for r in rows:
    if r['spoken'] not in files: files[r['spoken']] = f'm{len(files) + 1:03d}'
    r['file'] = files[r['spoken']]
uniq = [r for i, r in enumerate(rows) if r['file'] not in {x['file'] for x in rows[:i]}]  # 녹음할 문장 (중복 없이)
(root / 'voice').mkdir(exist_ok=True)
for f in (root / 'voice').glob('batch*.*'): f.unlink()
json.dump(rows, open(root / 'voice' / 'clips.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
size = 20
batches = [uniq[i:i + size] for i in range(0, len(uniq), size)]
for n, b in enumerate(batches, 1):
    (root / 'voice' / f'batch{n}.txt').write_text('\n\n'.join(r['spoken'] for r in b) + '\n', encoding='utf-8')
    json.dump([r['file'] for r in b], open(root / 'voice' / f'batch{n}.json', 'w'), ensure_ascii=False)
chars = sum(len(r['spoken']) for r in uniq)
print(f'대사 틀 {len(rows)}개 · 녹음할 문장 {len(uniq)}줄 (발성 {len(d["vocals"])}개 포함) · 묶음 {len(batches)}개 · {chars}자 (Eleven v3 기준 약 {chars} 크레딧)')
