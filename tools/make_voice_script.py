"""캐릭터 대사(src/01-core.js) → 목소리 대본 (voice/clips.json, voice/batchN.txt/.json)
사용: python3 tools/make_voice_script.py

- 화면에 나오는 대사를 그대로 읽는다. 대사에는 일정 이름·시간을 넣지 않는다(말풍선 아래 정보 줄로 분리).
  그래서 화면 글자와 녹음 문장이 언제나 같다. {빈칸}이 든 대사가 생기면 멈추고 알려 준다.
- 폰 알림(notif.*)은 소리로 읽지 않으니 뺀다.
- 짧은 발성(퐁!, 킁킁 …)은 발성 사전에서 가져와 따로 묶는다 (vocal.*).
- 한 묶음 20줄 안팎. 줄 사이 빈 줄 = 생성할 때 쉬는 자리 (나중에 split_voice.py가 여기서 자른다)."""
import json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
d = json.loads(subprocess.run(['node', str(root / 'tools' / 'lines_dump.js')], capture_output=True, text=True, check=True).stdout)
SPOKEN = {}  # 대사에 정보가 들어가지 않게 바꿔서(정보 줄 분리) 이제는 화면 글자 = 녹음 문장. 예외가 생기면 여기 적는다
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
