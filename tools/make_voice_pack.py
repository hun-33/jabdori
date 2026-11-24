"""voice/clips.json + src/voice/<캐릭터>/*.mp3 → src/05b-voice-pack.js
파일이 실제로 있는 대사만 목록에 넣는다 (없는 대사는 앱에서 기기 음성으로 읽음).
사용: python3 tools/make_voice_pack.py [캐릭터 id] [목소리 이름] [출처 문구]
"""
import json, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
char = sys.argv[1] if len(sys.argv) > 1 else 'mireum'
voice_name = sys.argv[2] if len(sys.argv) > 2 else ''
credit = sys.argv[3] if len(sys.argv) > 3 else ''
clips = json.load(open(root / 'voice' / 'clips.json', encoding='utf-8'))
d = root / 'src' / 'voice' / char
have = {p.stem for p in d.glob('*.mp3')} if d.exists() else set()
rows, seen = [], set()
for c in clips:
    if c['file'] not in have or c['tpl'] in seen:
        continue
    seen.add(c['tpl'])
    rows.append([c['tpl'], c['file'], c.get('mood', '')])
body = ',\n    '.join(json.dumps(r, ensure_ascii=False) for r in rows)
js = f"""/* ============================================================
   05b-voice-pack.js — 캐릭터 목소리 파일 목록 (tools/make_voice_pack.py가 만든다. 손으로 고치지 않는다)
   clips: [대사 틀(화면 문장), 파일 이름(확장자 빼고), 감정]
   파일은 src/voice/<캐릭터>/ 에 있고 빌드 때 dist/voice/ 로 복사된다.
   목록에 없는 문장은 기기 음성으로 읽는다.
   ============================================================ */
const VOICE_PACKS = {{
  {char}: {{ dir: 'voice/{char}/', voiceName: {json.dumps(voice_name, ensure_ascii=False)}, credit: {json.dumps(credit, ensure_ascii=False)}, clips: [
    {body}
  ] }},
}};
"""
(root / 'src' / '05b-voice-pack.js').write_text(js, encoding='utf-8')
print(f'{char}: 대사 {len(rows)}개 (파일 {len(have)}개)')
