# 立ち絵から、迷宮の駒（顔の丸い切り抜き 128px）と、会話用の軽い立ち絵（WebP）を作る
#   python scripts/make-tokens.py
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'assets', 'portraits')
TOKENS = os.path.join(ROOT, 'public', 'assets', 'tokens')
BUSTS = os.path.join(ROOT, 'public', 'assets', 'busts')

# 顔の中心と半径（480×600 の立ち絵での位置）。既定は (240, 215, 150)
FACE = {
    'akatsuki_genba': (238, 200, 150),
    'akatsuki_saku': (236, 205, 148),
    'akatsuki_suzuran': (250, 215, 145),
    'akatsuki_chikage': (255, 215, 145),
    'kurogane_genbu': (240, 195, 150),
    'kurogane_narukami': (225, 200, 150),
    'rengein_kangetsu': (240, 190, 140),
    'rengein_tesshin': (240, 185, 145),
    'ronin_kagemaru': (245, 200, 140),
    'youma_gaou': (240, 185, 160),
    'youma_kurobuchi': (240, 215, 150),
    'shirasagi_toshiro': (250, 200, 150),
}


def main():
    os.makedirs(TOKENS, exist_ok=True)
    os.makedirs(BUSTS, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(SRC, '*.png'))):
        name = os.path.splitext(os.path.basename(path))[0]
        im = Image.open(path).convert('RGB')
        sx, sy = im.width / 480, im.height / 600
        cx, cy, r = FACE.get(name, (240, 215, 150))
        box = (int((cx - r) * sx), int((cy - r) * sy), int((cx + r) * sx), int((cy + r) * sy))
        token = im.crop(box).resize((128, 128), Image.LANCZOS)
        token.save(os.path.join(TOKENS, f'{name}.webp'), 'WEBP', quality=86)
        bust = im.resize((360, 450), Image.LANCZOS)
        bust.save(os.path.join(BUSTS, f'{name}.webp'), 'WEBP', quality=80)
        print(name)


if __name__ == '__main__':
    main()
