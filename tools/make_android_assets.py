"""안드로이드 앱 아이콘·적응형 아이콘·알림 아이콘·스플래시를 미루먼지 SVG로 만든다.
실행: python3 tools/make_android_assets.py  (Playwright + Pillow 필요)
"""
import io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
SVG_DIR = ROOT / 'www/assets/mireum/svg'
STOVE = (43, 38, 34, 255)          # #2B2622 숯색 화구
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def render(svg_name, px=1024):
    """미루먼지 SVG를 투명 배경 PNG(정사각)로 렌더링"""
    svg = (SVG_DIR / svg_name).read_text(encoding='utf-8')
    html = f'<html><body style="margin:0;background:transparent"><div style="width:{px}px;height:{px}px">{svg}</div></body></html>'
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': px, 'height': px})
        pg.set_content(html)
        pg.wait_for_timeout(200)
        png = pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': px, 'height': px})
        b.close()
    return Image.open(io.BytesIO(png)).convert('RGBA')


def fit(img, box, scale):
    """img의 실제 그림 영역을 잘라서 box 크기 캔버스의 scale 비율만큼 가운데 배치"""
    bbox = img.getbbox()
    art = img.crop(bbox)
    target = int(box * scale)
    r = target / max(art.size)
    art = art.resize((max(1, int(art.width * r)), max(1, int(art.height * r))), Image.LANCZOS)
    canvas = Image.new('RGBA', (box, box), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((box - art.width) // 2, (box - art.height) // 2 + int(box * 0.01)))
    return canvas


def main():
    face = render('mireum_happy.svg')
    plain = render('mireum_default.svg')

    for d, k in DENS.items():
        # 1) 옛날식 아이콘 (네모·동그라미) 48dp
        s = int(48 * k)
        sq = Image.new('RGBA', (s, s), STOVE)
        sq.alpha_composite(fit(face, s, 0.80))
        # 모서리 둥글게
        mask = Image.new('L', (s * 4, s * 4), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, s * 4 - 1, s * 4 - 1], radius=int(s * 4 * 0.22), fill=255)
        mask = mask.resize((s, s), Image.LANCZOS)
        out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        out.paste(sq, (0, 0), mask)
        out.save(RES / f'mipmap-{d}/ic_launcher.png')
        cm = Image.new('L', (s * 4, s * 4), 0)
        ImageDraw.Draw(cm).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
        cm = cm.resize((s, s), Image.LANCZOS)
        rd = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        rd.paste(sq, (0, 0), cm)
        rd.save(RES / f'mipmap-{d}/ic_launcher_round.png')

        # 2) 적응형 아이콘 전경 108dp (안전 영역 66dp 안에 들어가게 0.58)
        f = int(108 * k)
        fit(face, f, 0.58).save(RES / f'mipmap-{d}/ic_launcher_foreground.png')

        # 3) 알림 아이콘 24dp: 흰색 실루엣 (안드로이드는 알파만 사용)
        n = int(24 * k)
        sil = fit(plain, n, 0.92)
        a = sil.split()[3].point(lambda v: 255 if v > 90 else 0)
        white = Image.new('RGBA', (n, n), (255, 255, 255, 0))
        white.putalpha(a)
        (RES / f'drawable-{d}').mkdir(exist_ok=True)
        white.save(RES / f'drawable-{d}/ic_stat_mireum.png')

    # 4) 스플래시: 숯색 바탕 + 가운데 미루먼지
    for f in RES.glob('drawable*/splash.png'):
        w, h = Image.open(f).size
        bg = Image.new('RGBA', (w, h), STOVE)
        art = fit(face, min(w, h), 0.42)
        bg.alpha_composite(art, ((w - art.width) // 2, (h - art.height) // 2))
        bg.convert('RGB').save(f)

    # 적응형 아이콘 배경색
    (RES / 'values/ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2B2622</color>\n</resources>\n', encoding='utf-8')
    print('android assets ok')


if __name__ == '__main__':
    main()
