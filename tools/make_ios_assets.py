"""아이폰 앱 아이콘(1024)·스플래시(2732)를 안드로이드와 같은 미루먼지 그림으로 만든다.
실행: python3 tools/make_ios_assets.py  (Playwright + Pillow 필요, 먼저 node build.mjs 로 www/ 를 만들어 둘 것)
- 아이폰 아이콘은 투명하면 안 되고 모서리는 iOS가 알아서 둥글게 깎으므로, 숯색 정사각형 그대로 둔다.
"""
from pathlib import Path
from PIL import Image

from make_android_assets import render, fit, STOVE

ROOT = Path(__file__).resolve().parent.parent
XC = ROOT / 'ios/App/App/Assets.xcassets'


def main():
    face = render('mireum_happy.svg')

    # 1) 앱 아이콘 1024x1024 (안드로이드 옛날식 아이콘과 같은 비율 0.80)
    icon = Image.new('RGBA', (1024, 1024), STOVE)
    icon.alpha_composite(fit(face, 1024, 0.80))
    icon.convert('RGB').save(XC / 'AppIcon.appiconset/AppIcon-512@2x.png')

    # 2) 스플래시 2732x2732: 숯색 바탕 + 가운데 미루먼지 (안드로이드 스플래시와 같은 비율 0.42를 짧은 변 기준으로)
    #    아이폰 화면은 이 정사각형의 가운데만 잘라 보여 주므로, 폰 폭(짧은 변) 대비 크기가 안드로이드와 비슷하게 0.42 * 1290/2732 로 맞춘다
    s = 2732
    bg = Image.new('RGBA', (s, s), STOVE)
    art = fit(face, s, 0.42 * 1290 / 2732)
    bg.alpha_composite(art, ((s - art.width) // 2, (s - art.height) // 2))
    out = bg.convert('RGB')
    for name in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
        out.save(XC / 'Splash.imageset' / name)
    print('ios assets ok')


if __name__ == '__main__':
    main()
