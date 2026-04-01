from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
EXTENSION_ICON_DIR = ROOT / "src" / "extension" / "icons"
BRANDING_DIR = ROOT / "assets" / "branding"

ICON_SIZES = [16, 32, 48, 128]
STORE_SIZE = 1024


def lerp(a, b, t):
    return int(a + (b - a) * t)


def gradient_color(top, bottom, t):
    return tuple(lerp(top[i], bottom[i], t) for i in range(3))


def draw_background(canvas, size):
    draw = ImageDraw.Draw(canvas)
    top = (8, 19, 30)
    bottom = (25, 68, 84)

    for y in range(size):
      t = y / max(size - 1, 1)
      draw.line([(0, y), (size, y)], fill=gradient_color(top, bottom, t))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (
            int(size * 0.14),
            int(size * 0.10),
            int(size * 0.90),
            int(size * 0.80),
        ),
        fill=(34, 180, 205, 70),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.08))
    canvas.alpha_composite(glow)


def draw_stars(canvas, size):
    draw = ImageDraw.Draw(canvas)
    stars = [
        (0.20, 0.23, 0.010),
        (0.76, 0.18, 0.012),
        (0.83, 0.31, 0.008),
        (0.28, 0.78, 0.009),
        (0.71, 0.72, 0.010),
    ]
    for x, y, radius in stars:
        r = size * radius
        cx = size * x
        cy = size * y
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 160))


def draw_center_button(canvas, size):
    pill = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pill)

    left = size * 0.17
    top = size * 0.33
    right = size * 0.83
    bottom = size * 0.67
    radius = size * 0.13

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (left, top + size * 0.025, right, bottom + size * 0.025),
        radius=radius,
        fill=(0, 0, 0, 105),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.03))
    canvas.alpha_composite(shadow)

    draw.rounded_rectangle(
        (left, top, right, bottom),
        radius=radius,
        fill=(247, 249, 252, 255),
    )

    accent_left = left + size * 0.035
    accent_top = top + size * 0.045
    accent_right = accent_left + size * 0.18
    accent_bottom = bottom - size * 0.045
    draw.rounded_rectangle(
        (accent_left, accent_top, accent_right, accent_bottom),
        radius=size * 0.05,
        fill=(238, 66, 57, 255),
    )

    triangle = [
        (accent_left + size * 0.055, accent_top + size * 0.047),
        (accent_left + size * 0.055, accent_bottom - size * 0.047),
        (accent_right - size * 0.04, top + size * 0.17),
    ]
    draw.polygon(triangle, fill=(255, 255, 255, 255))

    line_y = size * 0.47
    draw.rounded_rectangle(
        (left + size * 0.28, line_y - size * 0.024, right - size * 0.09, line_y + size * 0.024),
        radius=size * 0.02,
        fill=(31, 48, 65, 255),
    )
    draw.rounded_rectangle(
        (left + size * 0.28, line_y + size * 0.075, right - size * 0.22, line_y + size * 0.118),
        radius=size * 0.02,
        fill=(93, 115, 134, 255),
    )

    ring_center = (right - size * 0.04, top + size * 0.06)
    ring_r = size * 0.05
    draw.ellipse(
        (
            ring_center[0] - ring_r,
            ring_center[1] - ring_r,
            ring_center[0] + ring_r,
            ring_center[1] + ring_r,
        ),
        fill=(19, 34, 47, 255),
    )
    star = [
        (ring_center[0], ring_center[1] - ring_r * 0.65),
        (ring_center[0] + ring_r * 0.22, ring_center[1] - ring_r * 0.16),
        (ring_center[0] + ring_r * 0.72, ring_center[1] - ring_r * 0.10),
        (ring_center[0] + ring_r * 0.33, ring_center[1] + ring_r * 0.18),
        (ring_center[0] + ring_r * 0.44, ring_center[1] + ring_r * 0.65),
        (ring_center[0], ring_center[1] + ring_r * 0.36),
        (ring_center[0] - ring_r * 0.44, ring_center[1] + ring_r * 0.65),
        (ring_center[0] - ring_r * 0.33, ring_center[1] + ring_r * 0.18),
        (ring_center[0] - ring_r * 0.72, ring_center[1] - ring_r * 0.10),
        (ring_center[0] - ring_r * 0.22, ring_center[1] - ring_r * 0.16),
    ]
    draw.polygon(star, fill=(255, 195, 94, 255))

    pill = pill.filter(ImageFilter.GaussianBlur(radius=0))
    canvas.alpha_composite(pill)


def draw_frame(canvas, size):
    frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    stroke = max(2, int(size * 0.03))
    draw.rounded_rectangle(
        (stroke // 2, stroke // 2, size - stroke // 2 - 1, size - stroke // 2 - 1),
        radius=size * 0.22,
        outline=(255, 255, 255, 42),
        width=stroke,
    )
    canvas.alpha_composite(frame)


def rounded_mask(size):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size, size), radius=size * 0.23, fill=255)
    return mask


def build_icon(size):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_background(canvas, size)
    draw_stars(canvas, size)
    draw_center_button(canvas, size)
    draw_frame(canvas, size)

    clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    clipped.paste(canvas, (0, 0), rounded_mask(size))
    return clipped


def main():
    EXTENSION_ICON_DIR.mkdir(parents=True, exist_ok=True)
    BRANDING_DIR.mkdir(parents=True, exist_ok=True)

    for size in ICON_SIZES:
        image = build_icon(size)
        image.save(EXTENSION_ICON_DIR / f"icon-{size}.png")

    store_image = build_icon(STORE_SIZE)
    store_image.save(BRANDING_DIR / "store-icon-1024.png")


if __name__ == "__main__":
    main()
