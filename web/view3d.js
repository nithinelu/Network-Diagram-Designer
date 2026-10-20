/* 3D room view. One Scene3D per device column; app.js drives it through window.View3D.
   Plan coordinates (x across the display wall, y away from it) map to three.js as
   X = x - W/2, Z = y, Y = height. The display wall is the plane Z = 0. */
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

const EYE = 1.15;          // seated eye height, where the camera fan is drawn
const TABLE_H = 0.74;
const DISPLAY_BOTTOM = 0.9;
const BASE_FOV = 45;

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;

function label(text, {size = 48, color = "#fff", bg = "rgba(0,0,0,.55)", h = 0.16} = {}) {
  const c = document.createElement("canvas"), g = c.getContext("2d");
  g.font = `600 ${size}px Segoe UI, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + size;
  c.width = w; c.height = Math.ceil(size * 1.5);
  g.font = `600 ${size}px Segoe UI, sans-serif`;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, size * 0.35); g.fill(); }
  g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthTest: false, transparent: true}));
  s.scale.set(h * c.width / c.height, h, 1);
  s.renderOrder = 10;
  return s;
}

function screenTexture(text, w, h) {
  const c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext("2d"), grd = g.createLinearGradient(0, 0, c.width, c.height);
  grd.addColorStop(0, "#1b3a4f"); grd.addColorStop(1, "#0b141c");
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(255,255,255,.75)"; g.font = `600 ${Math.round(c.height * 0.12)}px Segoe UI, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function fan(radius, halfDeg, y, mat) {
  const h = THREE.MathUtils.degToRad(Math.min(halfDeg, 179.9));
  // CircleGeometry lies in XY; after rotateX(-90°) angle θ points to (cos θ, 0, -sin θ), so +Z is θ = -90°.
  const g = new THREE.CircleGeometry(radius, 64, -Math.PI / 2 - h, 2 * h);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = y;
  return m;
}

function arcLine(radius, halfDeg, y, z0, mat, closed) {
  const h = THREE.MathUtils.degToRad(Math.min(halfDeg, 179.9)), pts = [];
  if (closed) pts.push(new THREE.Vector3(0, y, z0));
  for (let i = 0; i <= 64; i++) {
    const a = -h + 2 * h * i / 64;
    pts.push(new THREE.Vector3(radius * Math.sin(a), y, z0 + radius * Math.cos(a)));
  }
  if (closed) pts.push(new THREE.Vector3(0, y, z0));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  line.computeLineDistances();
  return line;
}

function ring(radius, y, x, z, mat) {
  const pts = [];
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(x + radius * Math.cos(a), y, z + radius * Math.sin(a))); }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  line.computeLineDistances();
  return line;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

class Scene3D {
  constructor(col) {
    this.col = col;
    this.renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1.6, 0.03, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 60;
    this.controls.addEventListener("change", () => { this.draw(); View3D._synced(this); });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9590, 1.6));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.group = null;
    this.viewMode = "orbit";
    this.roomKey = "";
    this.pov = document.createElement("div"); this.pov.className = "pov"; this.pov.hidden = true;
    this.ro = new ResizeObserver(() => this.resize());
  }

  attach(host) {
    if (this.host === host) return;
    if (this.host) this.ro.unobserve(this.host);
    this.host = host;
    host.innerHTML = "";
    host.append(this.renderer.domElement, this.pov);
    this.ro.observe(host);
    this.resize();
  }

  resize() {
    if (!this.host) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    if (this.viewMode.startsWith("pov")) this.applyPovFov();
    this.camera.updateProjectionMatrix();
    this.draw();
  }

  draw() { this.renderer.render(this.scene, this.camera); }

  update({d, L, A, S, I}) {
    this.data = {d, L, A, S, I};
    if (this.group) { this.scene.remove(this.group); disposeTree(this.group); }
    this.group = this.build(d, L, A, S, I);
    this.group.getObjectByName("overlays").visible = !this.viewMode.startsWith("pov");
    const cb = this.group.getObjectByName("cables"); if (cb) cb.visible = !this.viewMode.startsWith("pov");
    this.scene.add(this.group);
    this.scene.background = new THREE.Color(css("--bg"));
    const key = `${S.W}|${S.D}|${S.H}`;
    if (key !== this.roomKey) { this.roomKey = key; this.setView(this.viewMode); }
    else if (this.viewMode.startsWith("pov")) this.setView(this.viewMode);
    else this.draw();
  }

  build(d, L, A, S, I) {
    const W = S.W, D = S.D, H = S.H || 2.8, X = x => x - W / 2;
    const G = new THREE.Group(), isDark = dark();
    const clip = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), W / 2),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), W / 2),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), D),
    ];
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.85, metalness: 0, ...extra});
    const zone = (color, opacity) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: clip});
    const lineMat = (color, opacity = 1, dashed = false) => dashed
      ? new THREE.LineDashedMaterial({color, transparent: true, opacity, dashSize: 0.12, gapSize: 0.1, clippingPlanes: clip})
      : new THREE.LineBasicMaterial({color, transparent: true, opacity, clippingPlanes: clip});
    const ACC = css("--accent"), MIC = css("--mic");
    const STC = {ok: css("--ok"), warn: css("--warn"), bad: css("--bad")};

    // floor, 1 m grid, walls (inward-facing, so walls between the viewer and the room are culled)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(isDark ? 0x2c3532 : 0xd8ddd9));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, D / 2); floor.receiveShadow = true; G.add(floor);
    const gp = [];
    for (let x = 1; x < W; x++) gp.push(X(x), 0.002, 0, X(x), 0.002, D);
    for (let z = 1; z < D; z++) gp.push(-W / 2, 0.002, z, W / 2, 0.002, z);
    const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
    G.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({color: isDark ? 0x3a4642 : 0xc3cbc7})));
    const wallMat = std(isDark ? 0x232c29 : 0xf1f3f2, {side: THREE.FrontSide});
    const walls = [
      {w: W, p: [0, H / 2, 0], r: 0},
      {w: W, p: [0, H / 2, D], r: Math.PI},
      {w: D, p: [-W / 2, H / 2, D / 2], r: Math.PI / 2},
      {w: D, p: [W / 2, H / 2, D / 2], r: -Math.PI / 2},
    ];
    walls.forEach(o => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, H), wallMat);
      m.position.set(...o.p); m.rotation.y = o.r; m.receiveShadow = true; G.add(m);
    });
    const outline = [[-W / 2, 0], [W / 2, 0], [W / 2, D], [-W / 2, D], [-W / 2, 0]].map(([x, z]) => new THREE.Vector3(x, 0.004, z));
    G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline), new THREE.LineBasicMaterial({color: css("--ink")})));

    // table
    const wood = isDark ? 0x6b5643 : 0xb39572;
    // imported tables and room objects (VRC): rotated boxes, rotation.y = -VRC rotation
    (L.tables || []).forEach(t => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(t.w, 0.05, t.h), std(wood, {roughness: 0.6}));
      top.position.set(X(t.cx), TABLE_H - 0.025, t.cy); top.rotation.y = -t.rot * Math.PI / 180;
      top.castShadow = top.receiveShadow = true; G.add(top);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.35, TABLE_H - 0.05, t.h * 0.6), std(isDark ? 0x3d4643 : 0x8d9692));
      ped.position.set(X(t.cx), (TABLE_H - 0.05) / 2, t.cy); ped.rotation.y = top.rotation.y; ped.castShadow = true; G.add(ped);
    });
    (L.obstacles || []).forEach(o => {
      const hgt = Math.max(0.02, Math.min(S.H, o.hgt)), door = /^door/.test(o.kind);
      const box = new THREE.Mesh(new THREE.BoxGeometry(o.w, hgt, o.h), std(door ? 0x8a6e4b : (isDark ? 0x39433f : 0xc9cfcc), {transparent: door, opacity: door ? 0.5 : 1}));
      box.position.set(X(o.cx), hgt / 2, o.cy); box.rotation.y = -o.rot * Math.PI / 180; box.castShadow = !door; G.add(box);
    });
    if (L.kind === "board" && !L.tables) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(L.tw, 0.05, L.len), std(wood, {roughness: 0.6}));
      top.position.set(X(L.cx), TABLE_H - 0.025, L.y0 + L.len / 2); top.castShadow = top.receiveShadow = true; G.add(top);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(L.tw * 0.35, TABLE_H - 0.05, L.len * 0.75), std(isDark ? 0x3d4643 : 0x8d9692));
      ped.position.set(X(L.cx), (TABLE_H - 0.05) / 2, L.y0 + L.len / 2); ped.castShadow = true; G.add(ped);
    }
    const deskMat = std(wood, {roughness: 0.6}), legMat = std(isDark ? 0x3d4643 : 0x8d9692);
    L.desks.forEach(k => {
      const w = k.x1 - k.x0, top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, k.dep), deskMat);
      top.position.set(X((k.x0 + k.x1) / 2), TABLE_H - 0.02, k.y); top.castShadow = top.receiveShadow = true; G.add(top);
      const mod = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.02), legMat);
      mod.position.set(X((k.x0 + k.x1) / 2), TABLE_H - 0.22, k.y - k.dep / 2 + 0.02); G.add(mod);
    });
    if (L.lectern) {
      const lec = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.05, 0.45), std(wood, {roughness: 0.6}));
      lec.position.set(X(L.lectern.x), 0.525, L.lectern.y); lec.castShadow = true; G.add(lec);
    }

    // seats: chair + seated person coloured by coverage
    const chairMat = std(isDark ? 0x4a5350 : 0x3f4745, {roughness: 0.7});
    A.seats.forEach((s, i) => {
      const g = new THREE.Group();
      g.position.set(X(s.x), 0, s.y);
      const tx = X(L.cx), tz = Math.min(L.y0 + L.len, Math.max(L.y0, s.y));
      g.rotation.y = s.face === "x" ? THREE.MathUtils.degToRad(s.faceDeg) : s.face === "f" ? Math.PI : s.face === "p" ? 0 : Math.atan2(tx - X(s.x), tz - s.y);
      if (s.presenter) {
        const pm = std(STC[s.st], {roughness: 0.55});
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.85, 4, 12), pm); body.position.y = 0.95; body.scale.z = 0.7;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), pm); head.position.y = 1.62;
        [body, head].forEach(m => { m.castShadow = true; g.add(m); });
        G.add(g);
        const tag = label("P", {size: 40, bg: STC[s.st], h: 0.17}); tag.position.set(X(s.x), 1.95, s.y); G.add(tag);
        return;
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), chairMat); seat.position.set(0, 0.46, -0.05);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), chairMat); back.position.set(0, 0.74, -0.27);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), chairMat); pole.position.set(0, 0.22, -0.05);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 20), chairMat); base.position.set(0, 0.03, -0.05);
      const pm = std(STC[s.st], {roughness: 0.55});
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.32, 4, 12), pm); torso.position.set(0, 0.8, -0.1); torso.scale.z = 0.7;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), pm); head.position.set(0, EYE + 0.05, -0.06);
      [seat, back, pole, base, torso, head].forEach(m => { m.castShadow = true; g.add(m); });
      G.add(g);
      const tag = label(String(i + 1), {size: 40, bg: STC[s.st], h: 0.17});
      tag.position.set(X(s.x), EYE + 0.33, s.y); G.add(tag);
    });

    // displays and device
    const geo = I.geo, diag = geo.diag, dw = geo.dw, dh = geo.dh;
    const bezel = std(0x15191b, {roughness: 0.4});
    const screens = geo.screens.map(s => s.x - L.cx);
    const MP = L.main || {x: L.cx, y: 0, aim: 0}, ma = THREE.MathUtils.degToRad(MP.aim);
    const DG = new THREE.Group(); DG.position.set(X(MP.x), 0, L.main ? MP.y - 0.05 : 0); DG.rotation.y = ma; G.add(DG);
    screens.forEach((ox, k) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.03, dh + 0.03, 0.05), bezel);
      body.position.set(ox, geo.bottom + dh / 2, 0.03); body.castShadow = true; DG.add(body);
      const txt = d.board ? (d.dualBoard && k ? "Content" : `${d.v} ${d.name}`) : S.dual ? (k ? "Content" : `People · ${diag}"`) : `${diag}" display`;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({map: screenTexture(txt, dw, dh)}));
      scr.position.set(ox, geo.bottom + dh / 2, 0.056); DG.add(scr);
    });
    let camY;
    if (d.board) {
      camY = geo.lensZ;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), std(0x000000, {roughness: 0.2}));
      lens.rotation.x = Math.PI / 2; lens.position.set(0, camY, 0.065); DG.add(lens);
    } else {
      const bw = geo.bw;
      camY = geo.barZ;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.085, 0.08), std(0x22272a, {roughness: 0.5}));
      bar.position.set(0, camY, 0.05); bar.castShadow = true; DG.add(bar);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), std(0x000000, {roughness: 0.2}));
      lens.rotation.x = Math.PI / 2; lens.position.set(0, camY, 0.095); DG.add(lens);
    }
    DG.updateMatrixWorld(true);
    this.camPos = DG.localToWorld(new THREE.Vector3(0, camY, 0.11));
    this.camDir = new THREE.Vector3(Math.sin(ma), 0, Math.cos(ma));

    // camera coverage: fan at seated eye height plus frustum edges from the lens
    // coverage overlays go in their own group so the camera view can hide them
    const O = new THREE.Group(); O.name = "overlays"; G.add(O);
    const sp = A.sp, ox = X(A.mx), z0 = A.cy;
    const FG = new THREE.Group(); FG.position.set(ox, 0, z0); FG.rotation.y = ma; O.add(FG);
    if (sp.pan > 0) {
      FG.add(fan(sp.reach, sp.hfov / 2 + sp.pan, EYE, zone(ACC, 0.06)));
      FG.add(arcLine(sp.reach, sp.hfov / 2 + sp.pan, EYE, 0, lineMat(ACC, 0.45, true), true));
    }
    FG.add(fan(sp.reach, sp.hfov / 2, EYE, zone(ACC, 0.17)));
    FG.add(arcLine(sp.reach, sp.hfov / 2, EYE, 0, lineMat(ACC, 0.9), true));
    const hr = THREE.MathUtils.degToRad(sp.hfov / 2), lz = 0.03;
    const fr = [];
    [-1, 1].forEach(sg => fr.push(0, camY, lz, sg * sp.reach * Math.sin(hr), EYE, sp.reach * Math.cos(hr)));
    fr.push(0, camY, lz, 0, EYE, sp.reach);
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fr, 3));
    FG.add(new THREE.LineSegments(fg, lineMat(ACC, 0.55)));

    // mic pickup zones on the floor
    if (sp.mic > 0) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(A.micPlan, 96).rotateX(-Math.PI / 2), zone(MIC, 0.14));
      disc.position.set(ox, 0.01, z0); O.add(disc);
      O.add(ring(A.micPlan, 0.012, ox, z0, lineMat(MIC, 0.9)));
      O.add(ring(sp.mic, 0.013, ox, z0, lineMat(MIC, 0.6, true)));
    }
    A.mics.forEach(m => {
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 24), std(MIC, {roughness: 0.5}));
      if (A.ad.ext) { puck.geometry.dispose(); puck.geometry = new THREE.BoxGeometry(0.6, 0.04, 0.6); puck.material.color.set(0xeceeee); puck.position.set(X(m.x), S.H - 0.03, m.y); }
      else if (A.ad.ceil) { puck.scale.set(3.5, 1, 3.5); puck.position.set(X(m.x), S.H - 0.02, m.y); }
      else puck.position.set(X(m.x), TABLE_H + 0.012, m.y);
      puck.castShadow = true; G.add(puck);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(A.ad.r, 72).rotateX(-Math.PI / 2), zone(MIC, 0.1));
      disc.position.set(X(m.x), 0.014, m.y); O.add(disc);
      O.add(ring(A.ad.r, 0.016, X(m.x), m.y, lineMat(MIC, 0.8)));
    });

    // extension cameras: physical body in the scene, coverage fan in the overlays
    const CAM2 = css("--cam2");
    this.extViews = [];
    A.cams.filter(k => !k.main).forEach((k, i) => {
      const aim = THREE.MathUtils.degToRad(k.aim), x = X(k.x), z = k.y;
      const body = new THREE.Group(); body.position.set(x, k.z, z); body.rotation.y = aim;
      const camMat = std(0x1e2326, {roughness: 0.45});
      if (k.hfov >= 360) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.36, 24), camMat); cyl.position.y = -0.02;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.06, 24), std(0x050505, {roughness: 0.1})); band.position.y = 0.1;
        body.add(cyl, band);
      } else {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), std(0xe8eaea, {roughness: 0.6})); base.position.y = -0.13;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.13), camMat);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20), std(0x000000, {roughness: 0.1}));
        lens.rotation.x = Math.PI / 2; lens.position.z = 0.072;
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), std(0x9aa29f)); shelf.position.y = -0.17;
        body.add(base, head, lens, shelf);
      }
      body.traverse(m => { if (m.isMesh) m.castShadow = true; });
      G.add(body);
      const tag = label(`C${i + 2}`, {size: 40, bg: CAM2, h: 0.17});
      tag.position.set(x, k.z + 0.3, z); G.add(tag);

      const og = new THREE.Group(); og.position.set(x, 0, z); og.rotation.y = aim; O.add(og);
      if (k.pan > 0 && k.hfov < 360) {
        og.add(fan(k.reach, k.hfov / 2 + k.pan, EYE, zone(CAM2, 0.05)));
        og.add(arcLine(k.reach, k.hfov / 2 + k.pan, EYE, 0, lineMat(CAM2, 0.4, true), true));
      }
      og.add(fan(k.reach, k.hfov / 2, EYE, zone(CAM2, 0.14)));
      og.add(arcLine(k.reach, k.hfov / 2, EYE, 0, lineMat(CAM2, 0.85), k.hfov < 360));
      if (k.hfov < 360) {
        const h2 = THREE.MathUtils.degToRad(k.hfov / 2), pts = [];
        [-1, 1].forEach(sg => pts.push(0, k.z, 0.08, sg * k.reach * Math.sin(h2), EYE, k.reach * Math.cos(h2)));
        const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        og.add(new THREE.LineSegments(lg, lineMat(CAM2, 0.5)));
      }
      if (k.mic > 0) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(k.mic, 72).rotateX(-Math.PI / 2), zone(MIC, 0.1));
        disc.position.set(x, 0.015, z); O.add(disc);
        O.add(ring(k.mic, 0.017, x, z, lineMat(MIC, 0.8)));
      }
      const dir = new THREE.Vector3(Math.sin(aim), 0, Math.cos(aim));
      this.extViews.push({pos: new THREE.Vector3(x, k.z + (k.hfov >= 360 ? 0.1 : 0), z).addScaledVector(dir, 0.1),
        dir, hfov: k.esv ? 30 : Math.min(k.hfov, 120), name: k.name, full: k.hfov, esv: !!k.esv,
        far: Math.max(...A.seats.map(q => q.y))});
    });

    // ceiling speakers
    if (A.au && A.au.spk) {
      const SPK = css("--spk"), grille = std(0xf4f5f5, {roughness: 0.8});
      A.au.spk.pts.forEach((p, i) => {
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 32), grille);
        g.position.set(X(p.x), S.H - 0.02, p.y); G.add(g);
        const rim = ring(0.13, S.H - 0.04, X(p.x), p.y, new THREE.LineBasicMaterial({color: SPK})); G.add(rim);
        O.add(ring(A.au.spk.r, 1.2, X(p.x), p.y, lineMat(SPK, 0.55, true)));
        const tag = label(`S${i + 1}`, {size: 36, bg: SPK, h: 0.14}); tag.position.set(X(p.x), S.H - 0.2, p.y); G.add(tag);
      });
    }

    // equipment rack and cable routes
    if (I) {
      const rk = I.rack, rack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.5), std(isDark ? 0x2a2f31 : 0x4a5054, {roughness: 0.5}));
      rack.position.set(X(rk[0]), 0.4, Math.min(S.D - 0.25, Math.max(0.25, rk[1]))); rack.castShadow = true;
      if (S.cab.rack !== "behind") G.add(rack);
      if (S.cab.show) {
        const CC = {CAT6: css("--cat6"), HDMI: css("--hdmi"), Vendor: css("--muted"), Speaker: css("--spk")};
        const C = new THREE.Group(); C.name = "cables"; G.add(C);
        I.runs.forEach((r, i) => {
          if (!r.pts) return;
          const off = (i % 6) * 0.012;
          const pts = r.pts.map(p => new THREE.Vector3(X(p[0]) + off, p[2] + off, p[1] + off));
          C.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color: CC[r.type]})));
        });
      }
    }

    // dimensions
    const dimW = label(`${W.toFixed(1)} m`, {size: 40, color: css("--ink"), bg: null, h: 0.22});
    dimW.position.set(0, 0.05, D + 0.35); G.add(dimW);
    const dimD = label(`${D.toFixed(1)} m`, {size: 40, color: css("--ink"), bg: null, h: 0.22});
    dimD.position.set(-W / 2 - 0.45, 0.05, D / 2); G.add(dimD);

    // light and shadow frustum sized to the room
    const R = Math.max(W, D);
    this.sun.position.set(W * 0.3, H + 4, D * 0.8);
    this.sun.target.position.set(0, 0, D / 2);
    Object.assign(this.sun.shadow.camera, {left: -R, right: R, top: R, bottom: -R, near: 0.5, far: H + 4 + R * 2});
    this.sun.shadow.camera.updateProjectionMatrix();
    return G;
  }

  applyPovFov() {
    const h = THREE.MathUtils.degToRad(Math.min(this.povHfov || this.data.A.sp.hfov, 170) / 2);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h) / this.camera.aspect));
  }

  setView(mode) {
    if (!this.data) { this.viewMode = mode; return; }
    const {S, d, A} = this.data, W = S.W, D = S.D, H = S.H || 2.8, c = this.camera, t = this.controls.target;
    const idx = mode.startsWith("pov") ? (parseInt(mode.slice(3), 10) || 0) : -1;
    if (idx > 0 && !(this.extViews || [])[idx - 1]) mode = "pov";
    const isPov = idx >= 0;
    this.viewMode = mode;
    this.controls.enabled = !isPov;
    this.pov.hidden = !isPov;
    if (this.group) {
      this.group.getObjectByName("overlays").visible = !isPov;
      const cb = this.group.getObjectByName("cables"); if (cb) cb.visible = !isPov;
    }
    c.fov = BASE_FOV;
    const tanH = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
    if (mode === "top") {
      const need = Math.max(D, W / c.aspect) * 0.62 / tanH;
      t.set(0, 0, D / 2); c.position.set(0, need, D / 2 + 0.001);
    } else if (mode === "side") {
      const need = Math.max(D / c.aspect, H) * 0.62 / tanH;
      t.set(0, 1.0, D / 2); c.position.set(W / 2 + need, 1.5, D / 2);
    } else if (mode === "pov") {
      c.position.copy(this.camPos);
      t.copy(this.camPos).addScaledVector(this.camDir, Math.max(D, 2)); t.y = EYE - 0.1;
      this.povHfov = A.sp.hfov;
      this.applyPovFov();
      this.pov.textContent = `Camera view · ${d.v} ${d.name} · HFOV ${A.sp.hfov}°`;
    } else if (isPov) {
      const v = this.extViews[mode === "pov" ? 0 : parseInt(mode.slice(3), 10) - 1];
      c.position.copy(v.pos);
      if (v.esv) t.set(v.pos.x, EYE, v.far); // zoomed close-up of the far end
      else { t.copy(v.pos).addScaledVector(v.dir, 3); t.y = EYE - 0.15; }
      this.povHfov = v.hfov;
      this.applyPovFov();
      this.pov.textContent = `C${parseInt(mode.slice(3), 10) + 1} view · ${v.name} · ` + (v.full >= 360 ? "360° camera, 120° slice" : v.esv ? "Extended Speaker View, zoomed close-up of the far end" : `HFOV ${v.full}°`);
    } else {
      const dist = Math.max(W, D) * 0.95 + 1.6;
      t.set(0, 0.8, D * 0.5);
      c.position.set(t.x + dist * 0.5, t.y + dist * 0.62, t.z + dist * 0.6);
    }
    c.updateProjectionMatrix();
    c.lookAt(t);
    this.controls.update();
    this.draw();
  }

  snapshot(w, h) {
    if (!this.data) return null;
    const size = new THREE.Vector2(); this.renderer.getSize(size);
    const ratio = this.renderer.getPixelRatio(), aspect = this.camera.aspect, fov = this.camera.fov;
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.viewMode.startsWith("pov")) this.applyPovFov();
    this.camera.updateProjectionMatrix();
    this.draw();
    const url = this.renderer.domElement.toDataURL("image/png");
    this.renderer.setPixelRatio(ratio);
    if (size.x && size.y) this.renderer.setSize(size.x, size.y); else this.renderer.setSize(1, 1, false);
    this.camera.aspect = aspect; this.camera.fov = fov; this.camera.updateProjectionMatrix();
    this.draw();
    return url;
  }

  dispose() {
    this.ro.disconnect();
    if (this.group) disposeTree(this.group);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

const scenes = [];
const View3D = {
  sync: false,
  _busy: false,
  update(c, host, data) {
    if (!host) return;
    const s = scenes[c] || (scenes[c] = new Scene3D(c));
    s.attach(host);
    s.update(data);
  },
  setView(c, mode) {
    const targets = this.sync && !mode.startsWith("pov") ? scenes.filter(Boolean) : [scenes[c]].filter(Boolean);
    targets.forEach(s => s.setView(mode));
  },
  mode: c => scenes[c] ? scenes[c].viewMode : "orbit",
  resize(c) { if (scenes[c]) scenes[c].resize(); },
  snapshot(c, w, h) { return scenes[c] ? scenes[c].snapshot(w, h) : null; },
  prune(n) { for (let i = n; i < scenes.length; i++) if (scenes[i]) { scenes[i].dispose(); scenes[i] = null; } },
  setSync(on) { this.sync = !!on; if (on && scenes[0]) this._synced(scenes[0]); },
  _synced(src) {
    if (!this.sync || this._busy || src.viewMode.startsWith("pov")) return;
    this._busy = true;
    scenes.forEach(s => {
      if (!s || s === src || s.viewMode.startsWith("pov")) return;
      s.viewMode = src.viewMode;
      s.camera.position.copy(src.camera.position);
      s.controls.target.copy(src.controls.target);
      s.controls.update();
      s.draw();
    });
    this._busy = false;
  },
};
window.View3D = View3D;
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (window.render) window.render(); });
if (window.onView3DReady) window.onView3DReady();
