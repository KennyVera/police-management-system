"""Prepare flota images: soft matte removal + full-subject crop. Never over-eat the vehicle."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ASSETS = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "src"
    / "roles"
    / "supervisor_unidad"
    / "modulos"
    / "logistica_turnos"
    / "assets"
    / "vehiculos"
)


def is_edge_matte(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return True
    # only very light studio / checkerboard (avoid eating white police doors)
    if r >= 250 and g >= 250 and b >= 250:
        return True
    if abs(r - g) <= 2 and abs(g - b) <= 2 and 228 <= r <= 232:
        return True
    return False


def process(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    if max(im.size) > 1600:
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)

    w, h = im.size
    px = im.load()
    vis = [[False] * h for _ in range(w)]
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not vis[x][y]:
            r, g, b, a = px[x, y]
            if is_edge_matte(r, g, b, a):
                vis[x][y] = True
                q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)

    bbox = im.getbbox()
    if bbox:
        pad = 12
        l, t, r, b = bbox
        im = im.crop(
            (max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad))
        )

    # Normalize canvas to a shared landscape frame so CSS contain shows full vehicle
    max_w, max_h = 720, 420
    im.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 0))
    ox = (max_w - im.size[0]) // 2
    oy = (max_h - im.size[1]) // 2
    canvas.paste(im, (ox, oy), im)

    out = ASSETS / f"{path.stem}.png"
    canvas.save(out, "PNG", optimize=True)
    if path.resolve() != out.resolve() and path.suffix.lower() in {".jpg", ".jpeg"}:
        path.unlink(missing_ok=True)
    print(f"OK {path.name} -> {out.name} subject={im.size} canvas={canvas.size}")


def main() -> None:
    for f in sorted(ASSETS.iterdir()):
        if f.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            # skip already normalized outputs if source jpg still present
            process(f)


if __name__ == "__main__":
    main()
