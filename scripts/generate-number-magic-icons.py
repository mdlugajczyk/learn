from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd() / "public" / "numberblocks" / "icons"
ROOT.mkdir(parents=True, exist_ok=True)
SIZE = 1024


def font(size: int):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def rounded_rectangle(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_icon(maskable: bool = False):
    image = Image.new("RGB", (SIZE, SIZE), "#76cff2")
    pixels = image.load()
    for y in range(SIZE):
        mix = y / (SIZE - 1)
        start = (103, 205, 243)
        end = (196, 239, 226)
        color = tuple(round(start[i] * (1 - mix) + end[i] * mix) for i in range(3))
        for x in range(SIZE):
            pixels[x, y] = color

    draw = ImageDraw.Draw(image)
    draw.ellipse((-170, 780, 1194, 1230), fill="#76c873")
    draw.ellipse((95, 80, 135, 120), fill="#fff8a6")
    draw.ellipse((865, 170, 889, 194), fill="#fff8a6")
    draw.polygon([(842, 88), (854, 120), (888, 120), (861, 140), (873, 174),
                  (842, 153), (813, 174), (823, 140), (796, 120), (830, 120)], fill="#ffe064")

    unit = 121 if not maskable else 108
    columns = 2
    rows = 5
    body_w = unit * columns
    body_h = unit * rows
    left = (SIZE - body_w) // 2
    top = 254 if not maskable else 280
    shadow = 18
    for row in range(rows):
        for column in range(columns):
            x0 = left + column * unit
            y0 = top + row * unit
            box = (x0 + shadow, y0 + shadow, x0 + unit - 4 + shadow, y0 + unit - 4 + shadow)
            rounded_rectangle(draw, box, 23, "#b7303e")
    for row in range(rows):
        for column in range(columns):
            x0 = left + column * unit
            y0 = top + row * unit
            box = (x0, y0, x0 + unit - 4, y0 + unit - 4)
            rounded_rectangle(draw, box, 23, "#fffdf4", "#ef4e55", 14)
            draw.ellipse((x0 + 20, y0 + 18, x0 + 34, y0 + 32), fill="#ffffff")

    number_box = (SIZE // 2 - 123, 104, SIZE // 2 + 123, 250)
    rounded_rectangle(draw, number_box, 38, "#fffdf4", "#ef4e55", 18)
    number_font = font(112)
    number_text = "10"
    bbox = draw.textbbox((0, 0), number_text, font=number_font)
    text_x = SIZE // 2 - (bbox[2] - bbox[0]) // 2
    text_y = 109 - bbox[1]
    draw.text((text_x, text_y), number_text, font=number_font, fill="#ef4e55")

    eye_y = top + 30
    for eye_x in (left + 63, left + body_w - 63):
        star = []
        import math
        for point in range(20):
            radius = 38 if point % 2 == 0 else 20
            angle = -math.pi / 2 + point * math.pi / 10
            star.append((eye_x + math.cos(angle) * radius, eye_y + math.sin(angle) * radius))
        draw.polygon(star, fill="#ffffff", outline="#1b2853")
        draw.ellipse((eye_x - 9, eye_y - 5, eye_x + 9, eye_y + 16), fill="#1b2853")
        draw.ellipse((eye_x - 4, eye_y - 2, eye_x + 1, eye_y + 3), fill="#ffffff")

    mouth_box = (SIZE // 2 - 45, top + 70, SIZE // 2 + 45, top + 120)
    draw.arc(mouth_box, 4, 176, fill="#1b2853", width=15)
    return image


base = make_icon(False)
base.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "icon-192.png", optimize=True)
base.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / "icon-512.png", optimize=True)
make_icon(True).resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / "icon-maskable-512.png", optimize=True)
print("Generated Number Magic app icons.")
