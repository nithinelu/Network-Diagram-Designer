"""Stencil library: network icons and basic shapes built from simple primitives.

Every icon is a list of primitives inside a unit box (0..1 by 0..1), so the same
definition renders on screen (Tk canvas), to SVG and to PNG/PDF (Pillow).

Primitive tuples (coordinates are unit-box fractions, widths are world pixels):
    ("rect",  x0, y0, x1, y1, fill, outline, width)
    ("rrect", x0, y0, x1, y1, r, fill, outline, width)   r = fraction of the shorter side
    ("oval",  x0, y0, x1, y1, fill, outline, width)
    ("poly",  [x, y, ...], fill, outline, width)
    ("line",  [x, y, ...], color, width)
    ("arrow", [x, y, ...], color, width)                 arrowhead at the last point
    ("arc",   x0, y0, x1, y1, start, extent, color, width)  Tk angles (deg, counter-clockwise)

Colour roles: F = shape fill, D = darker fill, L = lighter fill, W = white,
O = shape line colour, S = screen blue, None = nothing, or a literal '#rrggbb'.
"""

BLUE = "#1e6fb8"
OUTLINE = "#1b2f45"


def _hex(c):
    c = c.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def shade(color, factor):
    """Darker version of a colour (factor < 1)."""
    try:
        r, g, b = _hex(color)
    except (ValueError, IndexError):
        return color
    return "#%02x%02x%02x" % (int(r * factor), int(g * factor), int(b * factor))


def tint(color, amount):
    """Lighter version of a colour (amount 0..1 towards white)."""
    try:
        r, g, b = _hex(color)
    except (ValueError, IndexError):
        return color
    return "#%02x%02x%02x" % tuple(int(v + (255 - v) * amount) for v in (r, g, b))


def resolve(role, fill, line):
    if role is None:
        return None
    if role == "F":
        return fill
    if role == "D":
        return shade(fill, 0.72)
    if role == "L":
        return tint(fill, 0.28)
    if role == "W":
        return "#ffffff"
    if role == "O":
        return line
    if role == "S":
        return "#d6e8fa"
    return role


# --- reusable parts --------------------------------------------------------

def _box3d(front_x1=0.86, top_y=0.28):
    """Isometric box: lighter top, front face, darker side."""
    return [
        ("poly", [0, top_y, 1 - front_x1, 0, 1, 0, front_x1, top_y], "L", "O", 1.2),
        ("rect", 0, top_y, front_x1, 1, "F", "O", 1.2),
        ("poly", [front_x1, top_y, 1, 0, 1, 1 - top_y, front_x1, 1], "D", "O", 1.2),
    ]


def _cloud():
    ovals = [(0.04, 0.36, 0.40, 0.88), (0.18, 0.14, 0.56, 0.62), (0.40, 0.04, 0.82, 0.56),
             (0.62, 0.30, 0.98, 0.82), (0.24, 0.46, 0.76, 0.97)]
    # first pass draws outlined ovals, second pass covers the inner outlines
    return ([("oval", *o, "F", "O", 2.4) for o in ovals]
            + [("oval", o[0] + 0.016, o[1] + 0.026, o[2] - 0.016, o[3] - 0.026, "F", None, 0)
               for o in ovals])


ROUTER = [
    ("oval", 0, 0.42, 1, 1, "F", "O", 1.2),
    ("rect", 0, 0.29, 1, 0.71, "F", None, 0),
    ("line", [0, 0.29, 0, 0.71], "O", 1.2),
    ("line", [1, 0.29, 1, 0.71], "O", 1.2),
    ("oval", 0, 0, 1, 0.58, "L", "O", 1.2),
    ("arrow", [0.10, 0.13, 0.38, 0.25], "W", 2.2),
    ("arrow", [0.90, 0.45, 0.62, 0.33], "W", 2.2),
    ("arrow", [0.42, 0.36, 0.14, 0.47], "W", 2.2),
    ("arrow", [0.58, 0.22, 0.86, 0.11], "W", 2.2),
]

SWITCH = _box3d() + [
    ("arrow", [0.10, 0.40, 0.74, 0.40], "W", 1.6),
    ("arrow", [0.76, 0.56, 0.12, 0.56], "W", 1.6),
    ("arrow", [0.10, 0.72, 0.74, 0.72], "W", 1.6),
    ("arrow", [0.76, 0.88, 0.12, 0.88], "W", 1.6),
]

L3SWITCH = _box3d() + [
    ("arrow", [0.36, 0.56, 0.10, 0.38], "W", 1.8),
    ("arrow", [0.50, 0.56, 0.76, 0.38], "W", 1.8),
    ("arrow", [0.36, 0.72, 0.10, 0.92], "W", 1.8),
    ("arrow", [0.50, 0.72, 0.76, 0.92], "W", 1.8),
]

FIREWALL = _box3d(0.85, 0.2) + [
    ("line", [0, 0.4, 0.85, 0.4], "W", 1.2),
    ("line", [0, 0.6, 0.85, 0.6], "W", 1.2),
    ("line", [0, 0.8, 0.85, 0.8], "W", 1.2),
] + [("line", [x, y0, x, y0 + 0.2], "W", 1.2)
     for y0, xs in ((0.2, (0.28, 0.57)), (0.4, (0.14, 0.43, 0.71)),
                    (0.6, (0.28, 0.57)), (0.8, (0.14, 0.43, 0.71)))
     for x in xs]

LOADBAL = _box3d() + [
    ("line", [0.08, 0.64, 0.34, 0.64], "W", 1.8),
    ("arrow", [0.34, 0.64, 0.76, 0.40], "W", 1.8),
    ("arrow", [0.34, 0.64, 0.76, 0.64], "W", 1.8),
    ("arrow", [0.34, 0.64, 0.76, 0.88], "W", 1.8),
]

WLC = _box3d() + [
    ("arc", 0.33, 0.70, 0.53, 1.02, 40, 100, "W", 1.6),
    ("arc", 0.23, 0.54, 0.63, 1.18, 40, 100, "W", 1.6),
    ("arc", 0.13, 0.38, 0.73, 1.34, 40, 100, "W", 1.6),
    ("oval", 0.40, 0.82, 0.46, 0.91, "W", None, 0),
]

AP = [
    ("arc", 0.30, 0.20, 0.70, 0.80, 35, 110, "F", 2.2),
    ("arc", 0.16, 0.00, 0.84, 0.98, 35, 110, "F", 2.2),
    ("oval", 0, 0.62, 1, 1, "D", "O", 1.2),
    ("oval", 0, 0.52, 1, 0.92, "F", "O", 1.2),
    ("oval", 0.42, 0.66, 0.58, 0.78, "W", None, 0),
]

SERVER = [
    ("poly", [0.15, 0.1, 0.3, 0, 0.95, 0, 0.8, 0.1], "L", "O", 1.2),
    ("rect", 0.15, 0.1, 0.8, 1, "F", "O", 1.2),
    ("poly", [0.8, 0.1, 0.95, 0, 0.95, 0.9, 0.8, 1], "D", "O", 1.2),
    ("line", [0.26, 0.22, 0.69, 0.22], "W", 1.4),
    ("line", [0.26, 0.31, 0.69, 0.31], "W", 1.4),
    ("line", [0.26, 0.40, 0.69, 0.40], "W", 1.4),
    ("oval", 0.43, 0.82, 0.53, 0.89, "#7ddc4a", None, 0),
]

DATABASE = [
    ("oval", 0, 0.76, 1, 1, "F", "O", 1.2),
    ("rect", 0, 0.12, 1, 0.88, "F", None, 0),
    ("line", [0, 0.12, 0, 0.88], "O", 1.2),
    ("line", [1, 0.12, 1, 0.88], "O", 1.2),
    ("arc", 0, 0.30, 1, 0.54, 180, 180, "W", 1.2),
    ("arc", 0, 0.52, 1, 0.76, 180, 180, "W", 1.2),
    ("oval", 0, 0, 1, 0.24, "L", "O", 1.2),
]

STORAGE = [
    ("rect", 0, 0.00, 1, 0.30, "F", "O", 1.2),
    ("rect", 0, 0.35, 1, 0.65, "F", "O", 1.2),
    ("rect", 0, 0.70, 1, 1.00, "F", "O", 1.2),
] + [("line", [0.08, y, 0.6, y], "W", 1.4) for y in (0.15, 0.50, 0.85)] \
  + [("oval", 0.78, y - 0.05, 0.88, y + 0.05, "#7ddc4a", None, 0) for y in (0.15, 0.50, 0.85)]

RACK = [
    ("rect", 0, 0, 1, 1, "F", "O", 1.2),
    ("rect", 0.1, 0.05, 0.9, 0.95, "D", None, 0),
] + [("rect", 0.14, y, 0.86, y + 0.07, "L", None, 0) for y in (0.09, 0.19, 0.29, 0.45, 0.55, 0.71, 0.83)]

PC = [
    ("rect", 0.08, 0, 0.92, 0.6, "F", "O", 1.2),
    ("rect", 0.15, 0.07, 0.85, 0.53, "S", None, 0),
    ("poly", [0.42, 0.6, 0.58, 0.6, 0.62, 0.72, 0.38, 0.72], "D", "O", 1),
    ("poly", [0.1, 0.8, 0.9, 0.8, 1, 1, 0, 1], "F", "O", 1.2),
]

LAPTOP = [
    ("rect", 0.14, 0.04, 0.86, 0.66, "F", "O", 1.2),
    ("rect", 0.20, 0.10, 0.80, 0.60, "S", None, 0),
    ("poly", [0.14, 0.66, 0.86, 0.66, 1, 0.94, 0, 0.94], "D", "O", 1.2),
]

PRINTER = [
    ("rect", 0.2, 0.02, 0.8, 0.4, "W", "O", 1.2),
    ("rect", 0, 0.32, 1, 0.8, "F", "O", 1.2),
    ("rect", 0.15, 0.72, 0.85, 0.98, "W", "O", 1.2),
    ("oval", 0.8, 0.42, 0.9, 0.52, "#7ddc4a", None, 0),
]

CAMERA = [
    ("line", [0.52, 0.5, 0.56, 0.86], "O", 2.4),
    ("rect", 0.38, 0.86, 0.76, 0.98, "D", "O", 1),
    ("poly", [0.04, 0.26, 0.76, 0.12, 0.82, 0.48, 0.10, 0.62], "F", "O", 1.2),
    ("oval", 0.0, 0.30, 0.16, 0.60, "#2b2b2b", "O", 1),
]

USER = [
    ("oval", 0.30, 0, 0.70, 0.40, "F", "O", 1.2),
    ("poly", [0.06, 1, 0.12, 0.6, 0.5, 0.46, 0.88, 0.6, 0.94, 1], "F", "O", 1.2),
]

MOBILE = [
    ("rrect", 0.1, 0, 0.9, 1, 0.18, "F", "O", 1.2),
    ("rect", 0.2, 0.1, 0.8, 0.82, "S", None, 0),
    ("oval", 0.42, 0.86, 0.58, 0.95, "W", None, 0),
]

IPPHONE = [
    ("poly", [0.08, 0.4, 0.92, 0.4, 1, 1, 0, 1], "F", "O", 1.2),
    ("rrect", 0.02, 0.06, 0.98, 0.34, 0.5, "F", "O", 1.2),
    ("rect", 0.30, 0.48, 0.70, 0.62, "S", None, 0),
] + [("rect", x, y, x + 0.08, y + 0.07, "W", None, 0)
     for y in (0.70, 0.84) for x in (0.32, 0.46, 0.60)]

VIDEO = [
    ("rect", 0.38, 0, 0.62, 0.1, "D", "O", 1),
    ("rect", 0, 0.12, 1, 0.8, "F", "O", 1.2),
    ("rect", 0.05, 0.18, 0.95, 0.74, "S", None, 0),
    ("line", [0.5, 0.8, 0.5, 0.92], "O", 2.4),
    ("rect", 0.3, 0.92, 0.7, 0.99, "F", "O", 1),
]

UCSERVER = SERVER[:3] + [
    ("rrect", 0.27, 0.20, 0.68, 0.32, 0.5, "W", None, 0),
    ("rect", 0.32, 0.38, 0.63, 0.56, "W", None, 0),
    ("oval", 0.43, 0.82, 0.53, 0.89, "#7ddc4a", None, 0),
]

MODEM = [
    ("line", [0.2, 0.4, 0.12, 0.0], "O", 2),
    ("line", [0.8, 0.4, 0.88, 0.0], "O", 2),
    ("rrect", 0, 0.38, 1, 1, 0.2, "F", "O", 1.2),
] + [("oval", x, 0.62, x + 0.07, 0.74, "#7ddc4a", None, 0) for x in (0.18, 0.32, 0.46, 0.60)]

# --- registry ---------------------------------------------------------------
# label: "below" (icon), "inside" (basic shapes), "top" (container title)

STENCILS = {}
CATEGORIES = []


def _add(cat, key, name, w, h, prims, fill=BLUE, line=OUTLINE, prefix="", label="below"):
    if cat not in CATEGORIES:
        CATEGORIES.append(cat)
    STENCILS[key] = dict(cat=cat, name=name, w=w, h=h, prims=prims, fill=fill,
                         line=line, prefix=prefix, label=label)


_add("Network", "router", "Router", 64, 46, ROUTER, prefix="RTR-")
_add("Network", "switch", "Switch", 70, 44, SWITCH, prefix="SW-")
_add("Network", "l3switch", "L3 Switch", 70, 44, L3SWITCH, fill="#155a99", prefix="CORE-")
_add("Network", "ap", "Access Point", 56, 40, AP, prefix="AP-")
_add("Network", "wlc", "WLC", 70, 44, WLC, fill="#2a7f9e", prefix="WLC-")
_add("Network", "loadbal", "Load Balancer", 70, 44, LOADBAL, fill="#6a4fa3", prefix="LB-")
_add("Network", "modem", "ISP Router", 60, 36, MODEM, fill="#4f6d8a", prefix="ISP-")
_add("Security & WAN", "firewall", "Firewall", 60, 50, FIREWALL, fill="#c0392b", prefix="FW-")
_add("Security & WAN", "cloud", "Cloud", 96, 60, _cloud(), fill="#e8eef6", line="#7f95ad")
_add("Security & WAN", "internet", "Internet", 96, 60, _cloud(), fill="#dcecff", line="#4a7fb5")
_add("Security & WAN", "wan", "WAN / MPLS", 96, 60, _cloud(), fill="#efe6fa", line="#8a6db5")
_add("Servers & Storage", "server", "Server", 40, 60, SERVER, fill="#5b6f82", prefix="SRV-")
_add("Servers & Storage", "database", "Database", 44, 56, DATABASE, fill="#c27c0e", prefix="DB-")
_add("Servers & Storage", "storage", "Storage", 56, 50, STORAGE, fill="#4b5b6b", prefix="NAS-")
_add("Servers & Storage", "rack", "Rack", 40, 70, RACK, fill="#3a4654", prefix="RACK-")
_add("Collaboration", "ipphone", "IP Phone", 50, 44, IPPHONE, fill="#2f3b48", prefix="PHONE-")
_add("Collaboration", "video", "Video Endpoint", 70, 50, VIDEO, fill="#2f3b48", prefix="VC-")
_add("Collaboration", "ucserver", "UC Server", 40, 60, UCSERVER, fill="#13897f", prefix="CUCM-")
_add("Collaboration", "mobile", "Mobile", 28, 48, MOBILE, fill="#2f3b48")
_add("Endpoints", "pc", "PC", 56, 52, PC, fill="#3d7cc9", prefix="PC-")
_add("Endpoints", "laptop", "Laptop", 60, 44, LAPTOP, fill="#3d7cc9", prefix="LAP-")
_add("Endpoints", "printer", "Printer", 56, 46, PRINTER, fill="#6b7b8c", prefix="PRN-")
_add("Endpoints", "camera", "IP Camera", 56, 44, CAMERA, fill="#8a96a3", prefix="CAM-")
_add("Endpoints", "user", "User", 40, 52, USER, fill="#4a8a5c")

_BASIC = "Basic shapes"
_add(_BASIC, "rect", "Rectangle", 120, 60, [("rect", 0, 0, 1, 1, "F", "O", 1.5)],
     fill="#ffffff", line="#34495e", label="inside")
_add(_BASIC, "rounded", "Rounded", 120, 60, [("rrect", 0, 0, 1, 1, 0.25, "F", "O", 1.5)],
     fill="#ffffff", line="#34495e", label="inside")
_add(_BASIC, "ellipse", "Ellipse", 110, 60, [("oval", 0, 0, 1, 1, "F", "O", 1.5)],
     fill="#ffffff", line="#34495e", label="inside")
_add(_BASIC, "diamond", "Diamond", 100, 70, [("poly", [0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5], "F", "O", 1.5)],
     fill="#ffffff", line="#34495e", label="inside")
_add(_BASIC, "hexagon", "Hexagon", 110, 60,
     [("poly", [0.2, 0, 0.8, 0, 1, 0.5, 0.8, 1, 0.2, 1, 0, 0.5], "F", "O", 1.5)],
     fill="#ffffff", line="#34495e", label="inside")
_add(_BASIC, "text", "Text", 100, 30, [], fill="#ffffff", line="#34495e", label="inside")
_add(_BASIC, "container", "Zone / Site", 320, 220, [], fill="#f3f7fc", line="#5d7896", label="top")

# Shapes the user can switch between in the Properties panel ("Type")
KIND_NAMES = {k: v["name"] for k, v in STENCILS.items()}
