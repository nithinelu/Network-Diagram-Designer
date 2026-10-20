"""Convert the Cisco topology icon packs into PNGs for Network Diagram Designer."""
import colorsys, io, os, re, sys, zipfile
from PIL import Image, ImageDraw

X, OUT = sys.argv[1], sys.argv[2]
D3, D2 = os.path.join(OUT, "Cisco 3D"), os.path.join(OUT, "Cisco Classic")
os.makedirs(D3, exist_ok=True); os.makedirs(D2, exist_ok=True)

def clean(name):
    name = re.sub(r"\s+", " ", name.replace("_", " ")).strip(" -")
    name = re.sub(r'[<>:"/\|?*]', "-", name)
    return name[:1].upper() + name[1:]

def trim(im):
    bb = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    return im.crop(bb) if bb else im

def unique(folder, name):
    n, i = name, 2
    while os.path.exists(os.path.join(folder, n + ".png")):
        n, i = "%s %d" % (name, i), i + 1
    return n

# --- 3D icons from the PowerPoint library: the large, bluest variant of each slide
p = zipfile.ZipFile(os.path.join(X, "pptx", "lib.pptx"))
slides = sorted([n for n in p.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
                key=lambda n: int(re.search(r"(\d+)\.xml", n).group(1)))

def blue_score(im):
    """Closeness to Cisco's dark navy 'Default' status colour (higher is better)."""
    small = im.convert("RGBA").resize((48, 48))
    px = [q for q in small.get_flattened_data() if q[3] > 128]
    if not px:
        return -1e9
    r, g, b = (sum(q[i] for q in px) / len(px) for i in range(3))
    return -(((r - 55) ** 2 + (g - 68) ** 2 + (b - 100) ** 2) ** 0.5)


n3 = 0
for s in slides:
    xml = p.read(s).decode("utf8")
    title = ""
    for sp in re.findall(r"<p:sp>.*?</p:sp>", xml, re.S):
        if re.search(r'<p:ph type="(ctr)?[tT]itle"', sp):
            paras = re.findall(r"<a:p>.*?</a:p>", sp, re.S)
            title = " ".join("".join(re.findall(r"<a:t>([^<]*)</a:t>", pa)) for pa in paras)
    title = clean(title)
    if not title:
        continue
    rels = p.read(s.replace("slides/", "slides/_rels/") + ".rels").decode("utf8")
    rmap = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="\.\./media/([^"]+)"', rels))
    rmap.update({k: v for v, k in re.findall(r'Target="\.\./media/([^"]+)"[^>]*Id="(rId\d+)"', rels)})
    pics = []
    for pic in re.findall(r"<p:pic>.*?</p:pic>", xml, re.S):
        emb = re.search(r'r:embed="(rId\d+)"', pic)
        ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', pic)
        if emb and ext and emb.group(1) in rmap:
            pics.append((int(ext.group(1)) * int(ext.group(2)), rmap[emb.group(1)]))
    if not pics:
        continue
    big = max(a for a, _ in pics)
    cands = sorted({m for a, m in pics if a >= big * 0.4})
    best, score = None, float("-inf")
    for m in cands:
        try:
            im = Image.open(io.BytesIO(p.read("ppt/media/" + m)))
            im.load()
        except Exception:
            continue
        sc = blue_score(im) + (im.width * im.height) / 1e9
        if sc > score:
            best, score = im, sc
    if score < -90:   # no navy 'Default' among the large ones: accept a smaller navy variant
        for m in sorted({m for a, m in pics if a >= big * 0.03}):
            try:
                im = Image.open(io.BytesIO(p.read("ppt/media/" + m)))
                im.load()
            except Exception:
                continue
            sc = blue_score(im)
            if sc > -60 and sc > score:
                best, score = im, sc
    if best is None:
        continue
    im = trim(best.convert("RGBA"))
    im.thumbnail((256, 256), Image.LANCZOS)
    im.save(os.path.join(D3, unique(D3, title) + ".png"))
    n3 += 1

# --- classic 2D icons: JPG on white -> transparent background (flood fill from outside)
n2 = 0
for f in sorted(os.listdir(os.path.join(X, "jpg"))):
    im = Image.open(os.path.join(X, "jpg", f)).convert("RGB")
    pad = Image.new("RGB", (im.width + 2, im.height + 2), (255, 255, 255))
    pad.paste(im, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), (255, 0, 255), thresh=48)
    rgba = pad.convert("RGBA")
    rgba.putdata([(0, 0, 0, 0) if q[:3] == (255, 0, 255) else q for q in rgba.get_flattened_data()])
    rgba = trim(rgba)
    rgba.save(os.path.join(D2, unique(D2, clean(os.path.splitext(f)[0])) + ".png"))
    n2 += 1
print("3D:", n3, " classic:", n2)
