"""Builds the Gulistan Travel logo files in public/brand/ from the emblem (pin, Registan arches, golden arc, plane).

Interim wordmark until a designer delivers final artwork: Inter Display Black, "Gulistan" in white (dark
backgrounds) or navy (light backgrounds) and "Travel" in the golden gradient of the emblem's arc.
Run:  python3 scripts/brand/make-logo.py   (needs Pillow + the Inter Display fonts)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "public" / "brand"
EMBLEM = Path(__file__).with_name("emblem.png")
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
FONT_TAG = "/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf"
NAVY = (1, 38, 108, 255)
WHITE = (255, 255, 255, 255)
GOLD_TOP, GOLD_BOTTOM = (255, 214, 40), (236, 140, 0)
SLOGAN = "YOUR JOURNEY. ONE PLATFORM."
S = 4  # supersampling


def gold(size):
    w, h = size
    g = Image.new("RGBA", size)
    px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(GOLD_TOP[i] + (GOLD_BOTTOM[i] - GOLD_TOP[i]) * t) for i in range(3)) + (255,)
        for x in range(w):
            px[x, y] = c
    return g


def text_layer(text, font, fill):
    l, t, r, b = font.getbbox(text)
    img = Image.new("RGBA", (r - l, b - t), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((-l, -t), text, font=font, fill=WHITE)
    if fill == "gold":
        g = gold(img.size)
        g.putalpha(img.getchannel("A"))
        return g
    solid = Image.new("RGBA", img.size, fill)
    solid.putalpha(img.getchannel("A"))
    return solid


def lockup(word_fill, slogan_fill=None, height=168):
    emblem = Image.open(EMBLEM).convert("RGBA")
    if word_fill == NAVY:  # the plane is white in the artwork; paint it navy for light backgrounds
        px = emblem.load()
        for y in range(round(emblem.height * 0.2)):
            for x in range(round(emblem.width * 0.75), emblem.width):
                r, g, b, a = px[x, y]
                if a and min(r, g, b) > 150:
                    px[x, y] = NAVY[:3] + (a,)
    eh = height * S if not slogan_fill else round(height * S * 0.88)
    emblem = emblem.resize((round(emblem.width * eh / emblem.height), eh), Image.LANCZOS)
    cap = round(eh * 0.30)  # cap height of each word line
    f = ImageFont.truetype(FONT, round(cap / 0.727))
    w1 = text_layer("Gulistan", f, word_fill)
    w2 = text_layer("Travel", f, "gold")
    gap = round(cap * 0.16)
    x0 = emblem.width + round(eh * 0.02)
    y1 = round(eh * 0.28)
    y2 = y1 + w1.height - (w1.height - cap) + gap  # "Gulistan" has no descender below baseline
    width = x0 + max(w1.width, w2.width) + S * 4
    total_h = height * S
    canvas = Image.new("RGBA", (width, total_h), (0, 0, 0, 0))
    canvas.alpha_composite(emblem, (0, 0))
    canvas.alpha_composite(w1, (x0, y1))
    canvas.alpha_composite(w2, (x0, y2))
    if slogan_fill:
        ft = ImageFont.truetype(FONT_TAG, round(total_h * 0.075))
        tag = text_layer(SLOGAN, ft, slogan_fill)
        # letter-spaced slogan, right-aligned under the words
        chars = [text_layer(c, ft, slogan_fill) if c != " " else None for c in SLOGAN]
        track = round(ft.size * 0.12)
        space = round(ft.size * 0.32)
        tw = sum((c.width if c else space) + track for c in chars) - track
        x = width - tw - S * 4
        base_y = total_h - round(total_h * 0.02)
        for ch, c in zip(SLOGAN, chars):
            if c is None:
                x += space + track
                continue
            l, t, r, b = ft.getbbox(ch)
            canvas.alpha_composite(c, (x, base_y - (ft.getbbox("H")[3] - t)))
            x += c.width + track
        del tag
    bbox = canvas.getbbox()
    canvas = canvas.crop((0, 0, bbox[2] + S * 2, total_h))
    return canvas.resize((round(canvas.width / S), height), Image.LANCZOS)


def main():
    lockup(WHITE).save(BRAND / "gulistan-travel-header-light.webp", lossless=True)
    lockup(NAVY).save(BRAND / "gulistan-travel-header.webp", lossless=True)
    lockup(WHITE, WHITE, height=276).save(BRAND / "gulistan-travel-logo-light.webp", lossless=True)
    lockup(NAVY, NAVY, height=230).save(BRAND / "gulistan-travel-logo.png", optimize=True)


if __name__ == "__main__":
    main()
