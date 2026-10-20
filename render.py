"""Drawing engine: one set of drawing routines, three back-ends.

draw_shape / draw_connector work in world coordinates and call a back-end:
    TkBackend  - the editor canvas and palette thumbnails
    PilBackend - PNG / PDF export and copy-to-clipboard
    SvgBackend - SVG export
"""
import base64
import html
import io
import math
import os

from stencils import STENCILS, resolve

FONT_FAMILY = "Segoe UI"
FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
DASHES = {"solid": None, "dashed": (8, 5), "dotted": (2, 4), "dash-dot": (10, 4, 2, 4)}
LINE_H = 1.3  # line height as a multiple of font size


# --- geometry helpers ---------------------------------------------------------

def label_lines(s):
    lines = s.get("label", "").split("\n") if s.get("label") else []
    ip = s.get("data", {}).get("ip", "")
    if s.get("show_ip", True) and ip and label_pos(s) == "below":
        lines.append(ip)
    return lines


def label_pos(s):
    st = STENCILS.get(s["kind"])
    if s["kind"].startswith("img:"):
        return "below"
    return st["label"] if st else "below"


def label_box(s, measure=None):
    """Approximate world bbox of a below-icon label (None for other label styles)."""
    if label_pos(s) != "below":
        return None
    lines = label_lines(s)
    if not lines:
        return None
    size = s.get("font", 11)
    if measure:
        w = max(measure(l, size, False) for l in lines)
    else:
        w = max(len(l) for l in lines) * size * 0.58
    cx = s["x"] + s["w"] / 2
    top = s["y"] + s["h"] + 3
    return cx - w / 2, top, cx + w / 2, top + len(lines) * size * LINE_H


def shape_bbox(s, with_label=True):
    x0, y0, x1, y1 = s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]
    if with_label:
        lb = label_box(s)
        if lb:
            x0, y0, x1, y1 = min(x0, lb[0]), min(y0, lb[1]), max(x1, lb[2]), max(y1, lb[3])
    return x0, y0, x1, y1


def route_box(s):
    """Box connectors attach to: the icon plus its label underneath."""
    x0, y0, x1, y1 = s["x"] - 2, s["y"] - 2, s["x"] + s["w"] + 2, s["y"] + s["h"] + 2
    lb = label_box(s)
    if lb:
        y1 = lb[3] + 1
    return x0, y0, x1, y1


def _exit_point(box, p, q):
    """Where the segment p->q leaves box (p is normally inside the box)."""
    x0, y0, x1, y1 = box
    dx, dy = q[0] - p[0], q[1] - p[1]
    ts = []
    if dx > 0:
        ts.append((x1 - p[0]) / dx)
    elif dx < 0:
        ts.append((x0 - p[0]) / dx)
    if dy > 0:
        ts.append((y1 - p[1]) / dy)
    elif dy < 0:
        ts.append((y0 - p[1]) / dy)
    t = max(0.0, min(1.0, min(ts))) if ts else 0.0
    return p[0] + t * dx, p[1] + t * dy


def _sgn(v):
    return 1 if v > 0 else -1 if v < 0 else 0


def parallel_offsets(conns, spacing=9):
    """Spread multiple links between the same two shapes so they don't overlap."""
    groups = {}
    for c in conns:
        groups.setdefault(tuple(sorted((c["src"], c["dst"]))), []).append(c)
    out = {}
    for key, group in groups.items():
        n = len(group)
        for i, c in enumerate(group):
            off = (i - (n - 1) / 2) * spacing
            out[c["id"]] = off
    return out


def route(c, sa, sb, offset=0.0):
    """List of world points for connector c between shapes sa and sb."""
    ba, bb = route_box(sa), route_box(sb)
    ca = (sa["x"] + sa["w"] / 2, sa["y"] + sa["h"] / 2)
    cb = (sb["x"] + sb["w"] / 2, sb["y"] + sb["h"] / 2)
    dx, dy = cb[0] - ca[0], cb[1] - ca[1]
    if c.get("style") == "orthogonal":
        bend = -_sgn(dx) * _sgn(dy) or 1
        # top-down layouts read best: go vertical first whenever the shapes don't overlap vertically
        v_sep = bb[1] > ba[3] + 8 or ba[1] > bb[3] + 8
        horiz_first = not v_sep
        for attempt in (horiz_first, not horiz_first):
            if attempt:
                sx, tx = (ba[2], bb[0]) if dx >= 0 else (ba[0], bb[2])
                if (dx >= 0 and tx > sx + 8) or (dx < 0 and tx < sx - 8):
                    ya, yb = ca[1] + offset, cb[1] + offset
                    mx = (sx + tx) / 2 + offset * bend
                    return [(sx, ya), (mx, ya), (mx, yb), (tx, yb)]
            else:
                sy, ty = (ba[3], bb[1]) if dy >= 0 else (ba[1], bb[3])
                if (dy >= 0 and ty > sy + 8) or (dy < 0 and ty < sy - 8):
                    xa, xb = ca[0] + offset, cb[0] + offset
                    my = (sy + ty) / 2 + offset * bend
                    return [(xa, sy), (xa, my), (xb, my), (xb, ty)]
    # straight (also the fallback when boxes overlap)
    d = math.hypot(dx, dy) or 1.0
    if c["src"] > c["dst"]:
        offset = -offset
    nx, ny = -dy / d * offset, dx / d * offset
    pa, pb = (ca[0] + nx, ca[1] + ny), (cb[0] + nx, cb[1] + ny)
    return [_exit_point(ba, pa, pb), _exit_point(bb, pb, pa)]


def path_length(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
               for i in range(len(pts) - 1))


def point_along(pts, dist):
    """Point at a distance along a polyline (clamped)."""
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if dist <= seg or i == len(pts) - 2:
            t = 0 if seg == 0 else max(0.0, min(1.0, dist / seg))
            return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        dist -= seg
    return pts[0]


def dist_to_polyline(pts, x, y):
    best = float("inf")
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy
        t = 0 if L2 == 0 else max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / L2))
        best = min(best, math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)))
    return best


# --- shared drawing routines -----------------------------------------------------

def _arrow_head(b, tail, tip, color, width):
    dx, dy = tip[0] - tail[0], tip[1] - tail[1]
    d = math.hypot(dx, dy)
    if d < 0.01:
        return tip
    ux, uy = dx / d, dy / d
    L, W = 6 + 2.2 * width, 3 + 1.3 * width
    bx, by = tip[0] - ux * L, tip[1] - uy * L
    b.poly([tip, (bx - uy * W, by + ux * W), (bx + uy * W, by - ux * W)], color, color, 0.5)
    return bx + ux * 1, by + uy * 1  # line stops at the head's base


def draw_text_lines(b, cx, top, lines, size, color, bold=False, align="center", bg=None):
    if not lines:
        return
    if bg:
        w = max(b.text_width(l, size, bold) for l in lines) + 6
        x0 = cx - w / 2 if align == "center" else cx - 3
        b.rect(x0, top - 1, x0 + w, top + len(lines) * size * LINE_H + 1, bg, None, 0)
    for i, line in enumerate(lines):
        b.text(cx, top + i * size * LINE_H, line, size, color, bold, align)


def draw_shape(b, s, labels=True):
    kind = s["kind"]
    st = STENCILS.get(kind)
    x, y, w, h = s["x"], s["y"], s["w"], s["h"]
    fill = s.get("fill") or (st["fill"] if st else "#ffffff")
    line = s.get("line") or (st["line"] if st else "#34495e")
    tcolor = s.get("text_color", "#1a1a1a")
    size = s.get("font", 11)

    if kind == "container":
        b.rect(x, y, x + w, y + h, fill, line, s.get("lw", 1.5), dash=DASHES["dashed"], radius=10)
        if labels:
            draw_text_lines(b, x + 12, y + 7, label_lines(s), size + 1, line, True, "left")
        return
    if kind.startswith("img:"):
        b.image(kind[4:], x, y, x + w, y + h)
    elif st:
        lw_scale = s.get("lw", 1.5) / 1.5 if st["label"] == "inside" else 1.0
        for p in st["prims"]:
            _draw_prim(b, p, x, y, w, h, fill, line, lw_scale)
    if not labels:
        return
    lines = label_lines(s)
    if label_pos(s) == "inside":
        top = y + h / 2 - len(lines) * size * LINE_H / 2
        draw_text_lines(b, x + w / 2, top, lines, size, tcolor, s.get("bold", False))
    else:
        draw_text_lines(b, x + w / 2, y + h + 3, lines, size, tcolor, s.get("bold", False))


def _draw_prim(b, p, x, y, w, h, fill, line, lw_scale=1.0):
    t = p[0]
    X = lambda u: x + u * w
    Y = lambda v: y + v * h
    col = lambda role: resolve(role, fill, line)
    if t == "rect":
        _, x0, y0, x1, y1, f, o, lw = p
        b.rect(X(x0), Y(y0), X(x1), Y(y1), col(f), col(o), lw * lw_scale)
    elif t == "rrect":
        _, x0, y0, x1, y1, r, f, o, lw = p
        rad = r * min(abs(X(x1) - X(x0)), abs(Y(y1) - Y(y0)))
        b.rect(X(x0), Y(y0), X(x1), Y(y1), col(f), col(o), lw * lw_scale, radius=rad)
    elif t == "oval":
        _, x0, y0, x1, y1, f, o, lw = p
        b.oval(X(x0), Y(y0), X(x1), Y(y1), col(f), col(o), lw * lw_scale)
    elif t == "poly":
        _, pts, f, o, lw = p
        b.poly([(X(pts[i]), Y(pts[i + 1])) for i in range(0, len(pts), 2)], col(f), col(o), lw * lw_scale)
    elif t in ("line", "arrow"):
        _, pts, c, lw = p
        wpts = [(X(pts[i]), Y(pts[i + 1])) for i in range(0, len(pts), 2)]
        lw = lw * min(1.0, max(0.6, min(w, h) / 44))
        if t == "arrow":
            wpts[-1] = _arrow_head(b, wpts[-2], wpts[-1], col(c), lw * 0.8)
        b.line(wpts, col(c), lw)
    elif t == "arc":
        _, x0, y0, x1, y1, start, extent, c, lw = p
        b.arc(X(x0), Y(y0), X(x1), Y(y1), start, extent, col(c), lw)


def draw_connector(b, c, pts, bg="#ffffff"):
    color = c.get("color", "#2c3e50")
    width = c.get("width", 2)
    pts = list(pts)
    arrow = c.get("arrow", "none")
    if arrow in ("end", "both"):
        pts[-1] = _arrow_head(b, pts[-2], pts[-1], color, width)
    if arrow in ("start", "both"):
        pts[0] = _arrow_head(b, pts[1], pts[0], color, width)
    b.line(pts, color, width, dash=DASHES.get(c.get("dash", "solid")))
    size = c.get("font", 9)
    tcolor = c.get("text_color", "#1a1a1a")
    L = path_length(pts)
    if c.get("label"):
        mx, my = point_along(pts, L / 2)
        lines = c["label"].split("\n")
        draw_text_lines(b, mx, my - len(lines) * size * LINE_H / 2, lines, size, tcolor, bg=bg)
    for key, d in (("src_label", min(22, L * 0.3)), ("dst_label", max(L - 22, L * 0.7))):
        if c.get(key):
            px, py = point_along(pts, d)
            lines = c[key].split("\n")
            draw_text_lines(b, px, py - len(lines) * size * LINE_H / 2, lines, size, tcolor, bg=bg)


# --- image store (custom PNG icons) ----------------------------------------------------

class ImageStore:
    """Decoded custom icon images, shared by all back-ends."""

    def __init__(self):
        self.data = {}      # name -> base64 PNG
        self._pil = {}
        self._tk = {}

    def register(self, name, b64):
        if self.data.get(name) != b64:
            self.data[name] = b64
            self._pil.pop(name, None)

    def pil(self, name):
        if name not in self._pil:
            from PIL import Image
            try:
                im = Image.open(io.BytesIO(base64.b64decode(self.data[name]))).convert("RGBA")
            except Exception:
                im = None
            self._pil[name] = im
        return self._pil[name]

    def tk(self, name, W, H):
        key = (name, W, H)
        if key not in self._tk:
            im = self.pil(name)
            if im is None:
                return None
            from PIL import Image, ImageTk
            if len(self._tk) > 400:
                self._tk.clear()
            self._tk[key] = ImageTk.PhotoImage(im.resize((max(1, W), max(1, H)), Image.LANCZOS))
        return self._tk[key]


# --- back-ends ----------------------------------------------------------------------------

class _Base:
    def __init__(self, scale=1.0, ox=0.0, oy=0.0, images=None):
        self.s, self.ox, self.oy = scale, ox, oy
        self.images = images

    def P(self, x, y):
        return x * self.s + self.ox, y * self.s + self.oy

    def W(self, w):
        return max(1.0, w * self.s)

    def _missing_image(self, x0, y0, x1, y1):
        self.rect(x0, y0, x1, y1, "#eeeeee", "#999999", 1)
        self.line([(x0, y0), (x1, y1)], "#999999", 1)
        self.line([(x0, y1), (x1, y0)], "#999999", 1)


def rr_points(x0, y0, x1, y1, r):
    return [x0 + r, y0, x0 + r, y0, x1 - r, y0, x1 - r, y0, x1, y0, x1, y0 + r, x1, y0 + r,
            x1, y1 - r, x1, y1 - r, x1, y1, x1 - r, y1, x1 - r, y1, x0 + r, y1, x0 + r, y1,
            x0, y1, x0, y1 - r, x0, y1 - r, x0, y0 + r, x0, y0 + r, x0, y0]


_TK_FONTS = {}


class TkBackend(_Base):
    def __init__(self, canvas, scale=1.0, ox=0.0, oy=0.0, images=None):
        super().__init__(scale, ox, oy, images)
        self.c = canvas
        self.tags = ()

    def _font(self, size, bold):
        px = max(1, int(round(size * self.s)))
        key = (px, bold)
        if key not in _TK_FONTS:
            import tkinter.font as tkfont
            _TK_FONTS[key] = tkfont.Font(family=FONT_FAMILY, size=-px, weight="bold" if bold else "normal")
        return _TK_FONTS[key]

    def _kw(self, fill, outline, width, dash=None):
        kw = dict(fill=fill or "", outline=outline or "", tags=self.tags,
                  width=self.W(width) if outline and width else 0)
        if dash and outline:
            kw["dash"] = dash
        return kw

    def rect(self, x0, y0, x1, y1, fill, outline, width=1, dash=None, radius=0):
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        kw = self._kw(fill, outline, width, dash)
        r = min(radius * self.s, abs(X1 - X0) / 2, abs(Y1 - Y0) / 2)
        if r > 1:
            self.c.create_polygon(rr_points(X0, Y0, X1, Y1, r), smooth=True, **kw)
        else:
            self.c.create_rectangle(X0, Y0, X1, Y1, **kw)

    def oval(self, x0, y0, x1, y1, fill, outline, width=1):
        self.c.create_oval(*self.P(x0, y0), *self.P(x1, y1), **self._kw(fill, outline, width))

    def poly(self, pts, fill, outline, width=1):
        flat = [v for p in pts for v in self.P(*p)]
        self.c.create_polygon(flat, **self._kw(fill, outline, width))

    def line(self, pts, color, width=1, dash=None):
        flat = [v for p in pts for v in self.P(*p)]
        kw = dict(fill=color, width=self.W(width), tags=self.tags, capstyle="round", joinstyle="round")
        if dash:
            kw["dash"] = dash
            kw["capstyle"] = "butt"
        self.c.create_line(flat, **kw)

    def arc(self, x0, y0, x1, y1, start, extent, color, width=1):
        self.c.create_arc(*self.P(x0, y0), *self.P(x1, y1), start=start, extent=extent,
                          style="arc", outline=color, width=self.W(width), tags=self.tags)

    def text(self, x, y, s, size, color, bold=False, align="center"):
        if size * self.s < 3:
            return
        self.c.create_text(*self.P(x, y), text=s, fill=color, font=self._font(size, bold),
                           anchor="n" if align == "center" else "nw", tags=self.tags)

    def text_width(self, s, size, bold=False):
        return self._font(size, bold).measure(s) / self.s

    def image(self, name, x0, y0, x1, y1):
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        img = self.images.tk(name, int(X1 - X0), int(Y1 - Y0)) if self.images else None
        if img is None:
            return self._missing_image(x0, y0, x1, y1)
        self.c.create_image(X0, Y0, image=img, anchor="nw", tags=self.tags)


_PIL_FONTS = {}


def _pil_font(px, bold):
    key = (px, bold)
    if key not in _PIL_FONTS:
        from PIL import ImageFont
        font = None
        for name in (("segoeuib.ttf", "arialbd.ttf") if bold else ("segoeui.ttf", "arial.ttf")):
            try:
                font = ImageFont.truetype(os.path.join(FONT_DIR, name), px)
                break
            except OSError:
                continue
        _PIL_FONTS[key] = font or ImageFont.load_default(px)
    return _PIL_FONTS[key]


class PilBackend(_Base):
    def __init__(self, image, scale=1.0, ox=0.0, oy=0.0, images=None):
        super().__init__(scale, ox, oy, images)
        from PIL import ImageDraw
        self.img = image
        self.d = ImageDraw.Draw(image)

    def _wi(self, w):
        return max(1, int(round(w * self.s)))

    def _box(self, x0, y0, x1, y1):
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        return [min(X0, X1), min(Y0, Y1), max(X0, X1), max(Y0, Y1)]

    def rect(self, x0, y0, x1, y1, fill, outline, width=1, dash=None, radius=0):
        box = self._box(x0, y0, x1, y1)
        r = int(min(radius * self.s, (box[2] - box[0]) / 2, (box[3] - box[1]) / 2))
        ol = None if dash else outline
        wi = self._wi(width) if outline and width else 0
        if r > 1:
            self.d.rounded_rectangle(box, r, fill=fill, outline=ol, width=wi)
        else:
            self.d.rectangle(box, fill=fill, outline=ol, width=wi)
        if dash and outline:
            pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
            self.line(pts, outline, width, dash)

    def oval(self, x0, y0, x1, y1, fill, outline, width=1):
        self.d.ellipse(self._box(x0, y0, x1, y1), fill=fill, outline=outline,
                       width=self._wi(width) if outline and width else 0)

    def poly(self, pts, fill, outline, width=1):
        self.d.polygon([self.P(*p) for p in pts], fill=fill, outline=outline,
                       width=self._wi(width) if outline and width else 0)

    def line(self, pts, color, width=1, dash=None):
        P = [self.P(*p) for p in pts]
        wi = self._wi(width)
        if not dash:
            self.d.line(P, fill=color, width=wi, joint="curve")
            if wi > 2:
                r = wi / 2
                for X, Y in (P[0], P[-1]):
                    self.d.ellipse([X - r, Y - r, X + r, Y + r], fill=color)
            return
        pattern = [v * self.s for v in dash]
        k, left, on = 0, pattern[0], True
        for (X0, Y0), (X1, Y1) in zip(P, P[1:]):
            seg = math.hypot(X1 - X0, Y1 - Y0)
            pos = 0.0
            while pos < seg:
                step = min(left, seg - pos)
                if on:
                    a, b = pos / seg, (pos + step) / seg
                    self.d.line([(X0 + (X1 - X0) * a, Y0 + (Y1 - Y0) * a),
                                 (X0 + (X1 - X0) * b, Y0 + (Y1 - Y0) * b)], fill=color, width=wi)
                pos += step
                left -= step
                if left <= 1e-6:
                    k = (k + 1) % len(pattern)
                    left, on = pattern[k], not on

    def arc(self, x0, y0, x1, y1, start, extent, color, width=1):
        self.d.arc(self._box(x0, y0, x1, y1), start=-(start + extent), end=-start,
                   fill=color, width=self._wi(width))

    def text(self, x, y, s, size, color, bold=False, align="center"):
        font = _pil_font(max(1, int(round(size * self.s))), bold)
        self.d.text(self.P(x, y), s, font=font, fill=color, anchor="ma" if align == "center" else "la")

    def text_width(self, s, size, bold=False):
        return _pil_font(max(1, int(round(size * self.s))), bold).getlength(s) / self.s

    def image(self, name, x0, y0, x1, y1):
        im = self.images.pil(name) if self.images else None
        if im is None:
            return self._missing_image(x0, y0, x1, y1)
        from PIL import Image
        box = [int(v) for v in self._box(x0, y0, x1, y1)]
        im = im.resize((max(1, box[2] - box[0]), max(1, box[3] - box[1])), Image.LANCZOS)
        self.img.paste(im, (box[0], box[1]), im)


class SvgBackend(_Base):
    def __init__(self, scale=1.0, ox=0.0, oy=0.0, images=None):
        super().__init__(scale, ox, oy, images)
        self.parts = []

    @staticmethod
    def _paint(fill, outline, width, dash=None):
        a = 'fill="%s"' % (fill or "none")
        if outline and width:
            a += ' stroke="%s" stroke-width="%.2f"' % (outline, width)
            if dash:
                a += ' stroke-dasharray="%s"' % ",".join(str(v) for v in dash)
        return a

    def rect(self, x0, y0, x1, y1, fill, outline, width=1, dash=None, radius=0):
        X0, Y0 = self.P(min(x0, x1), min(y0, y1))
        X1, Y1 = self.P(max(x0, x1), max(y0, y1))
        r = min(radius * self.s, (X1 - X0) / 2, (Y1 - Y0) / 2)
        self.parts.append('<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" rx="%.2f" %s/>'
                          % (X0, Y0, X1 - X0, Y1 - Y0, r, self._paint(fill, outline, self.W(width), dash)))

    def oval(self, x0, y0, x1, y1, fill, outline, width=1):
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        self.parts.append('<ellipse cx="%.2f" cy="%.2f" rx="%.2f" ry="%.2f" %s/>'
                          % ((X0 + X1) / 2, (Y0 + Y1) / 2, abs(X1 - X0) / 2, abs(Y1 - Y0) / 2,
                             self._paint(fill, outline, self.W(width))))

    def poly(self, pts, fill, outline, width=1):
        P = " ".join("%.2f,%.2f" % self.P(*p) for p in pts)
        self.parts.append('<polygon points="%s" stroke-linejoin="round" %s/>'
                          % (P, self._paint(fill, outline, self.W(width))))

    def line(self, pts, color, width=1, dash=None):
        P = " ".join("%.2f,%.2f" % self.P(*p) for p in pts)
        extra = ' stroke-dasharray="%s"' % ",".join("%.1f" % (v * self.s) for v in dash) if dash else ""
        cap = "butt" if dash else "round"
        self.parts.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%.2f" '
                          'stroke-linecap="%s" stroke-linejoin="round"%s/>'
                          % (P, color, self.W(width), cap, extra))

    def arc(self, x0, y0, x1, y1, start, extent, color, width=1):
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        cx, cy, rx, ry = (X0 + X1) / 2, (Y0 + Y1) / 2, abs(X1 - X0) / 2, abs(Y1 - Y0) / 2
        a0, a1 = math.radians(start), math.radians(start + extent)
        sx, sy = cx + rx * math.cos(a0), cy - ry * math.sin(a0)
        ex, ey = cx + rx * math.cos(a1), cy - ry * math.sin(a1)
        large = 1 if abs(extent) > 180 else 0
        sweep = 0 if extent > 0 else 1
        self.parts.append('<path d="M %.2f %.2f A %.2f %.2f 0 %d %d %.2f %.2f" fill="none" stroke="%s" '
                          'stroke-width="%.2f" stroke-linecap="round"/>'
                          % (sx, sy, rx, ry, large, sweep, ex, ey, color, self.W(width)))

    def text(self, x, y, s, size, color, bold=False, align="center"):
        X, Y = self.P(x, y)
        px = size * self.s
        self.parts.append('<text x="%.2f" y="%.2f" font-family="%s, Arial, sans-serif" font-size="%.2f" '
                          'fill="%s"%s text-anchor="%s">%s</text>'
                          % (X, Y + px * 0.95, FONT_FAMILY, px, color, ' font-weight="bold"' if bold else "",
                             "middle" if align == "center" else "start", html.escape(s)))

    def text_width(self, s, size, bold=False):
        try:
            return _pil_font(max(1, int(round(size * 4))), bold).getlength(s) / 4
        except Exception:
            return len(s) * size * 0.58

    def image(self, name, x0, y0, x1, y1):
        b64 = self.images.data.get(name) if self.images else None
        if not b64:
            return self._missing_image(x0, y0, x1, y1)
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        self.parts.append('<image x="%.2f" y="%.2f" width="%.2f" height="%.2f" preserveAspectRatio="none" '
                          'href="data:image/png;base64,%s"/>' % (X0, Y0, X1 - X0, Y1 - Y0, b64))

    def document(self, width, height, bg="#ffffff"):
        return ('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">\n'
                '<rect width="100%%" height="100%%" fill="%s"/>\n%s\n</svg>\n'
                % (width, height, width, height, bg, "\n".join(self.parts)))
