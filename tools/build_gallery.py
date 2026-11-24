# 미루먼지 표정·자세·코스튬 갤러리 페이지를 만든다 (디자인 검수용)
from pathlib import Path
root = Path(__file__).resolve().parent.parent
core = (root/'src'/'01-core.js').read_text(encoding='utf-8')
mr = (root/'src'/'01b-mireum.js').read_text(encoding='utf-8')
css = (root/'src'/'mireum.css').read_text(encoding='utf-8')
html = f"""<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face{{font-family:P;src:url('../../dist/fonts/PretendardVariable-ko2350.woff2')}}
body{{margin:0;font:13px P,sans-serif;background:#F3EEE5;color:#26211C}}
.row{{display:flex;flex-wrap:wrap;gap:8px;padding:10px}}
.cell{{width:150px;text-align:center}} .cell.d{{background:#2B2622;color:#F3ECE0;border-radius:12px}}
.cell .mireum{{width:150px}}
h2{{margin:10px 10px 0;font-size:15px}}
{css}
</style></head><body><div id="g"></div><script>
{core.split('/* ---------- 저장소 ---------- */')[0]}
{mr}
const g=document.getElementById('g'); let h='';
const E=['default','happy','focus','suspicious','angry','furious','disappointed','sad','surprised','flustered','shy','sleepy','tired','proud'];
const pose={{happy:'cheer',focus:'check',angry:'puff',furious:'puff',sad:'cry',sleepy:'curl',proud:'flag',suspicious:'nag'}};
h+='<h2>표정 (종이 배경)</h2><div class="row">'+E.map(e=>`<div class="cell">${{mireumSVG({{expr:e,pose:pose[e]||'idle',motion:'none',fluff:e==='furious'?1:e==='angry'?0.6:0}})}}<div>${{e}}</div></div>`).join('')+'</div>';
h+='<h2>표정 (화구 띠 배경)</h2><div class="row">'+E.map(e=>`<div class="cell d">${{mireumSVG({{expr:e,pose:pose[e]||'idle',motion:'none',fluff:e==='furious'?1:e==='angry'?0.6:0}})}}<div>${{e}}</div></div>`).join('')+'</div>';
const P=['idle','wave','cheer','nag','check','cry','curl','puff','flag','chase'];
h+='<h2>자세</h2><div class="row">'+P.map(p=>`<div class="cell">${{mireumSVG({{expr:'default',pose:p,motion:'none'}})}}<div>${{p}}</div></div>`).join('')+'</div>';
h+='<h2>단계 0 → 1 (모양은 그대로, 먼지 입자·크기만)</h2><div class="row">'+[0,0.25,0.5,0.75,1].map(f=>`<div class="cell">${{mireumSVG({{expr:f>0.5?'angry':'suspicious',pose:'idle',motion:'none',fluff:f}})}}<div>${{f}}</div></div>`).join('')+'</div>';
h+='<h2>작은 크기 (48px / 32px)</h2><div class="row">'+E.slice(0,6).map(e=>`<div style="width:48px">${{mireumSVG({{expr:e,motion:'none'}})}}</div><div style="width:32px">${{mireumSVG({{expr:e,motion:'none',shadow:false}})}}</div>`).join('')+'</div>';
g.innerHTML=h;
</script></body></html>"""
(root/'tools'/'gallery'/'gallery.html').write_text(html, encoding='utf-8')
print('ok')
