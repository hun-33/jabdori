"""미루먼지 개별 에셋(SVG·PNG, 투명 배경)과 앱 아이콘을 만든다.
   같은 생성기(src/01b-mireum.js)를 브라우저에서 돌려서 뽑기 때문에 앱 화면과 모양이 같다."""
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parent.parent
core = (root/'src'/'01-core.js').read_text(encoding='utf-8').split('/* ---------- 저장소 ---------- */')[0]
mr = (root/'src'/'01b-mireum.js').read_text(encoding='utf-8')
css = (root/'src'/'mireum.css').read_text(encoding='utf-8')
# 정적 에셋용: 애니메이션 규칙을 뺀 스타일
static_css = re.sub(r'@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', css)
static_css = '\n'.join(l for l in static_css.split('\n') if 'animation' not in l and '@media' not in l)
out_svg = root/'dist'/'assets'/'mireum'/'svg'; out_png = root/'dist'/'assets'/'mireum'/'png'; icons = root/'dist'/'icons'
for d in (out_svg, out_png, icons): d.mkdir(parents=True, exist_ok=True)
ASSETS = [  # 파일명, 표정, 자세, 부풂
  ('mireum_default', 'default', 'idle', 0), ('mireum_happy', 'happy', 'cheer', 0), ('mireum_focus', 'focus', 'check', 0),
  ('mireum_suspicious', 'suspicious', 'nag', 0.1), ('mireum_angry', 'angry', 'puff', 0.65), ('mireum_furious', 'furious', 'puff', 1),
  ('mireum_disappointed', 'disappointed', 'idle', 0.1), ('mireum_sad', 'sad', 'cry', 0.1), ('mireum_surprised', 'surprised', 'cheer', 0),
  ('mireum_sleepy', 'sleepy', 'curl', 0), ('mireum_proud', 'proud', 'flag', 0),
  ('mireum_flustered', 'flustered', 'idle', 0.2), ('mireum_shy', 'shy', 'idle', 0), ('mireum_tired', 'tired', 'curl', 0.1),
]
POSES = [('pose_wave', 'happy', 'wave'), ('pose_nag', 'angry', 'nag'), ('pose_chase', 'surprised', 'chase'), ('pose_check', 'focus', 'check')]
html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{{margin:0;background:transparent}} #s{{width:512px;height:512px}} {css}</style></head><body><div id='s'></div><script>{core}\n{mr}</script></body></html>"
(root/'tools'/'gallery'/'assets.html').write_text(html, encoding='utf-8')
manifest = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 512, 'height': 512})
    pg.goto((root/'tools'/'gallery'/'assets.html').as_uri())
    def render(name, opts, folder_svg=out_svg, folder_png=out_png):
        svg = pg.evaluate("o => { const s = mireumSVG(o); document.getElementById('s').innerHTML = s; return s; }", {**opts, 'motion': 'none'})
        # 독립 실행 SVG: 스타일을 안에 넣는다
        svg_std = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace('focusable="false">', f'focusable="false"><style>{static_css}</style>', 1)
        (folder_svg/f'{name}.svg').write_text(svg_std, encoding='utf-8')
        pg.locator('#s svg').screenshot(path=str(folder_png/f'{name}.png'), omit_background=True)
        manifest.append({'file': name, **{k: v for k, v in opts.items() if k != 'label'}})
    for name, e, po, f in ASSETS:
        render(name, {'expr': e, 'pose': po, 'fluff': f})
    for name, e, po in POSES:
        render(name, {'expr': e, 'pose': po})
    # 앱 아이콘: 숯색 바탕 + 미루먼지
    def icon(size, scale, path, radius=0):
        pg.set_viewport_size({'width': size, 'height': size})
        pg.evaluate("""([size, scale, radius]) => { document.body.innerHTML = `<div id="ic" style="width:${size}px;height:${size}px;background:#2B2622;border-radius:${radius}px;display:grid;place-items:center;--m-shadow:rgba(10,8,7,.32)"><div style="width:${size*scale}px">${mireumSVG({expr:'default',pose:'idle',motion:'none',shadow:false})}</div></div>`; }""", [size, scale, radius])
        pg.wait_for_timeout(50)
        pg.locator('#ic').screenshot(path=str(path))
    icon(512, 0.86, icons/'icon-512.png'); icon(192, 0.86, icons/'icon-192.png')
    icon(512, 0.62, icons/'icon-maskable-512.png'); icon(180, 0.84, icons/'apple-touch-icon.png')
    b.close()
(root/'dist'/'assets'/'mireum'/'assets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(manifest), 'assets')
