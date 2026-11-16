/* ===== 3D表示（three.js） ===== */
(function () {
  "use strict";
  const THREE = window.THREE;
  if (!THREE) { window.World3D = null; return; }

  /* ---------- 共通ユーティリティ ---------- */
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.userData = { canvas: c };
    return t;
  }
  const matCache = {};
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.02 }, opts || {}));
    return matCache[key];
  }
  function box(w, h, d, m, x, y, z, parent) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === "string" ? mat(m) : m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (parent) parent.add(o); return o;
  }
  function cyl(rt, rb, h, m, x, y, z, parent, seg) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), typeof m === "string" ? mat(m) : m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (parent) parent.add(o); return o;
  }
  function sph(r, m, x, y, z, parent, seg) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 20, seg ? Math.max(8, seg * 0.75) : 16), typeof m === "string" ? mat(m) : m);
    o.position.set(x, y, z); o.castShadow = true; if (parent) parent.add(o); return o;
  }
  function rbox(w, h, d, r, m, x, y, z, parent) {
    // 角丸っぽい箱（箱＋上面を少し縮めた箱で近似）
    const g = new THREE.Group(); g.position.set(x, y, z);
    box(w, h - r, d, m, 0, -r / 2, 0, g); box(w - r, r, d - r, m, 0, h / 2 - r / 2, 0, g);
    if (parent) parent.add(g); return g;
  }

  /* ---------- テクスチャ ---------- */
  function noiseFill(g, w, h, base, amt, n) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { g.fillStyle = "rgba(" + (Math.random() < 0.5 ? "0,0,0" : "255,255,255") + "," + (Math.random() * amt) + ")"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }
  function planks(base, line, wPlank) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const rows = Math.round(h / wPlank);
      for (let r = 0; r < rows; r++) {
        let x = -Math.random() * 200;
        while (x < w) {
          const len = 160 + Math.random() * 220;
          const l = (Math.random() - 0.5) * 18;
          g.fillStyle = "hsl(32," + (38 + l / 2) + "%," + (70 + l) + "%)";
          g.globalAlpha = 0.35; g.fillRect(x, r * wPlank, len, wPlank); g.globalAlpha = 1;
          for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(120,80,40,0.08)"; g.beginPath(); const yy = r * wPlank + Math.random() * wPlank; g.moveTo(x, yy); g.bezierCurveTo(x + len / 3, yy + 3, x + len * 2 / 3, yy - 3, x + len, yy); g.stroke(); }
          g.fillStyle = line; g.fillRect(x, r * wPlank, 2, wPlank);
          x += len;
        }
        g.fillStyle = line; g.fillRect(0, r * wPlank, w, 2);
      }
    }, [3, 3]);
  }
  const TEX = {};
  function textures() {
    if (TEX.wood) return TEX;
    TEX.wood = planks("#cfa877", "rgba(90,55,25,0.35)", 64);
    TEX.oak = planks("#e6cfa6", "rgba(120,85,45,0.25)", 85);
    TEX.carpet = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, "#8fa3b8", 0.12, 9000), [4, 4]);
    TEX.tile = canvasTex(256, 256, (g, w, h) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? "#f1ebe0" : "#ddd0bb"; g.fillRect(x * 64, y * 64, 64, 64); }
      g.strokeStyle = "rgba(0,0,0,0.12)"; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
    }, [2, 2]);
    TEX.wall = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, "#eef0f2", 0.05, 6000), [4, 2]);
    TEX.hwall = canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, "#f6f1e8", 0.05, 6000), [4, 2]);
    TEX.rug = canvasTex(256, 256, (g, w, h) => { noiseFill(g, w, h, "#d8cbb5", 0.1, 8000); g.strokeStyle = "#c2b294"; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28); });
    TEX.board = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = "#fdfdfd"; g.fillRect(0, 0, w, h);
      g.lineWidth = 4; g.lineCap = "round";
      g.strokeStyle = "#e2336b"; g.beginPath(); g.moveTo(20, 30); g.lineTo(130, 30); g.stroke();
      g.strokeStyle = "#2f6fdb"; [[20, 60, 200], [20, 85, 150], [20, 108, 110]].forEach(([x, y, l]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); });
      g.strokeStyle = "#1f8a8a"; g.beginPath(); g.moveTo(170, 50); g.lineTo(200, 22); g.lineTo(230, 50); g.lineTo(230, 80); g.lineTo(170, 80); g.closePath(); g.stroke();
    });
    TEX.screenPink = canvasTex(128, 80, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#ff9cc0"); gr.addColorStop(1, "#e2336b"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillRect(14 + i * 36, 12 + j * 32, 30, 26); });
    TEX.screenBlue = canvasTex(128, 80, (g, w, h) => { g.fillStyle = "#cfe9f8"; g.fillRect(0, 0, w, h); g.fillStyle = "#79c7ef"; g.fillRect(0, 0, w, 14); g.fillStyle = "#9fb6c8"; for (let i = 0; i < 5; i++) g.fillRect(10, 22 + i * 11, 40 + Math.random() * 60, 5); });
    return TEX;
  }
  function skyTex(top, bottom, rain) {
    return canvasTex(64, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (!rain) { g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(18, 40, 16, 6, 0, 0, 7); g.ellipse(44, 70, 12, 5, 0, 0, 7); g.fill(); }
      // 遠景の木と家並み
      g.fillStyle = "rgba(70,110,80,0.6)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(i * 12 + 4, h - 18, 9, 0, 7); g.fill(); }
      g.fillStyle = "rgba(120,120,130,0.5)"; g.fillRect(0, h - 14, w, 14);
    });
  }
  function bubbleTex(color) {
    return canvasTex(64, 80, (g) => {
      g.fillStyle = "#1b1f2c"; g.beginPath(); g.roundRect ? g.roundRect(6, 4, 52, 56, 14) : g.rect(6, 4, 52, 56); g.fill();
      g.beginPath(); g.moveTo(24, 58); g.lineTo(32, 74); g.lineTo(40, 58); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect ? g.roundRect(10, 8, 44, 48, 11) : g.rect(10, 8, 44, 48); g.fill();
      g.fillStyle = color; g.fillRect(28, 15, 8, 24); g.fillRect(28, 43, 8, 8);
    });
  }
  function heartTex() {
    return canvasTex(64, 64, (g) => {
      g.fillStyle = "#e2336b"; g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(-6, 30, 10, -4, 32, 18); g.bezierCurveTo(54, -4, 70, 30, 32, 56); g.fill();
      g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(20, 22, 6, 4, -0.6, 0, 7); g.fill();
    });
  }
  function glowTex(rgb) {
    return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(" + rgb + ",0.55)"); gr.addColorStop(1, "rgba(" + rgb + ",0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  }

  /* ---------- キャラクター ---------- */
  function makeChar(lk) {
    const root = new THREE.Group();
    const skin = mat(lk.skin, { roughness: 0.6 });
    const hair = mat(lk.hair, { roughness: 0.55 });
    const outfit = mat(lk.outfit, { roughness: 0.8 });
    const pants = mat("#34384a"), shoe = mat("#1d2030", { roughness: 0.5 });
    const body = new THREE.Group(); root.add(body);
    const legs = [];
    [-0.085, 0.085].forEach((x) => {
      const p = new THREE.Group(); p.position.set(x, 0.3, 0); body.add(p);
      cyl(0.065, 0.06, 0.26, pants, 0, -0.14, 0, p, 12);
      box(0.12, 0.06, 0.18, shoe, 0, -0.27, 0.03, p);
      legs.push(p);
    });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.16, 6, 16), outfit);
    torso.position.y = 0.5; torso.scale.set(1, 1, 0.78); torso.castShadow = true; body.add(torso);
    box(0.14, 0.04, 0.05, "#ffffff", 0, 0.66, 0.12, body);
    if (lk.tie) box(0.05, 0.18, 0.02, mat(lk.tie), 0, 0.55, 0.135, body);
    const arms = [];
    [-1, 1].forEach((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.215, 0.62, 0); body.add(p);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.16, 4, 10), outfit); a.position.y = -0.12; a.castShadow = true; p.add(a);
      sph(0.05, skin, 0, -0.25, 0, p, 10);
      arms.push(p);
    });
    const head = new THREE.Group(); head.position.y = 0.93; body.add(head);
    sph(0.25, skin, 0, 0, 0, head, 28);
    // 髪
    const capG = new THREE.SphereGeometry(0.268, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const cap = new THREE.Mesh(capG, hair); cap.rotation.x = -0.6; cap.position.set(0, 0.02, -0.015); cap.castShadow = true; head.add(cap);
    const backG = new THREE.SphereGeometry(0.262, 24, 16, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.3, Math.PI * 0.42);
    const back = new THREE.Mesh(backG, hair); back.castShadow = true; head.add(back);
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
    bang.scale.set(1.35, 0.4, 0.6); bang.position.set(-0.04, 0.17, 0.17); bang.rotation.x = 0.45; head.add(bang);
    if (lk.style === "long") {
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.22, 4, 16), hair); l.scale.set(1.25, 1, 0.6); l.position.set(0, -0.2, -0.1); l.castShadow = true; head.add(l);
      [-1, 1].forEach((s) => { const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.24, 4, 8), hair); side.position.set(s * 0.22, -0.13, 0.03); head.add(side); });
    }
    if (lk.style === "bun") sph(0.11, hair, 0, 0.27, -0.06, head, 16);
    if (lk.style === "spiky") {
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 8), hair);
        const a = (i / 7) * Math.PI * 2; c.position.set(Math.sin(a) * 0.13, 0.25, Math.cos(a) * 0.1 - 0.03);
        c.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); c.castShadow = true; head.add(c);
      }
    }
    // 顔
    const eye = mat("#1b1f2c", { roughness: 0.3 });
    [-0.085, 0.085].forEach((x) => {
      const e = sph(0.034, eye, x, -0.01, 0.228, head, 12); e.scale.set(1, 1.35, 0.6);
      sph(0.011, "#ffffff", x + 0.01, 0.01, 0.25, head, 6);
      const b = sph(0.04, mat("#f4a3a3", { roughness: 0.9, transparent: true, opacity: 0.7 }), x * 1.55, -0.08, 0.2, head, 10); b.scale.set(1, 0.6, 0.4); b.castShadow = false;
    });
    box(0.06, 0.012, 0.01, "#b05a5a", 0, -0.1, 0.244, head);
    if (lk.glasses) {
      const gm = mat("#1b1f2c", { metalness: 0.4, roughness: 0.3 });
      [-0.085, 0.085].forEach((x) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 18), gm); r.position.set(x, -0.005, 0.245); head.add(r); });
      box(0.06, 0.01, 0.01, gm, 0, 0, 0.25, head);
    }
    if (lk.cap) {
      const cm = mat(lk.cap, { roughness: 0.6 });
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.275, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), cm); c.position.y = 0.02; c.castShadow = true; head.add(c);
      const brim = cyl(0.17, 0.17, 0.02, cm, 0, 0.07, 0.2, head, 20); brim.scale.set(1, 1, 0.8);
    }
    if (lk.acc) addAcc(lk.acc, head, body);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.userData = { legs, arms, body, head, phase: 0 };
    return root;
  }
  function addAcc(acc, head, body) {
    const gold = mat("#e9b830", { metalness: 0.7, roughness: 0.3 });
    const h = acc.head, f = acc.face, n = acc.neck, b = acc.back;
    if (h === "knit") {
      const m = mat("#e2336b", { roughness: 0.95 });
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.285, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), m); c.position.y = 0.03; head.add(c);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.04, 8, 28), m); rim.rotation.x = Math.PI / 2; rim.position.y = 0.105; head.add(rim);
      sph(0.07, mat("#ffffff", { roughness: 1 }), 0, 0.32, 0, head, 12);
    }
    if (h === "helmet") {
      const m = mat("#f0b429", { roughness: 0.35 });
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), m); c.position.y = 0.03; head.add(c);
      const brim = cyl(0.33, 0.33, 0.025, m, 0, 0.08, 0.03, head, 28); brim.scale.set(1, 1, 1.05);
      box(0.05, 0.16, 0.24, m, 0, 0.27, 0, head);
      box(0.1, 0.03, 0.01, "#1f8a8a", 0, 0.2, 0.27, head); box(0.03, 0.1, 0.01, "#1f8a8a", 0, 0.2, 0.27, head);
    }
    if (h === "beret") {
      const m = mat("#b4233f", { roughness: 0.9 });
      const c = sph(0.22, m, 0.05, 0.22, -0.02, head, 20); c.scale.set(1.25, 0.38, 1.2); c.rotation.z = -0.3;
      cyl(0.015, 0.015, 0.06, m, 0.06, 0.32, -0.02, head, 6);
    }
    if (h === "crown") {
      const ring = cyl(0.15, 0.15, 0.1, gold, 0, 0.27, 0, head, 20); ring.material = gold;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 6), gold); c.position.set(Math.sin(a) * 0.14, 0.36, Math.cos(a) * 0.14); head.add(c); }
      sph(0.028, mat("#e2336b", { roughness: 0.2 }), 0, 0.27, 0.15, head, 10);
    }
    if (h === "hachimaki") {
      const m = mat("#ffffff", { roughness: 0.9 });
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 8, 30), m); t.rotation.x = Math.PI / 2; t.position.y = 0.1; head.add(t);
      const d = cyl(0.05, 0.05, 0.01, mat("#e2336b"), 0, 0.1, 0.285, head, 16); d.rotation.x = Math.PI / 2;
      [-1, 1].forEach((s) => { const tail = box(0.05, 0.2, 0.02, m, s * 0.06, 0.0, -0.27, head); tail.rotation.z = s * 0.4; });
    }
    if (h === "headphones") {
      const m = mat("#2a2f3c", { roughness: 0.4 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 24, Math.PI), m); band.position.y = 0.02; head.add(band);
      [-1, 1].forEach((s) => { const c = cyl(0.08, 0.08, 0.07, m, s * 0.27, 0.0, 0, head, 18); c.rotation.z = Math.PI / 2; const p = cyl(0.06, 0.06, 0.072, mat("#e2336b"), s * 0.272, 0.0, 0, head, 18); p.rotation.z = Math.PI / 2; });
    }
    if (h === "rainhat") {
      const m = mat("#f0b429", { roughness: 0.35 });
      cyl(0.2, 0.26, 0.16, m, 0, 0.24, 0, head, 24); cyl(0.4, 0.4, 0.02, m, 0, 0.16, 0, head, 28);
    }
    if (h === "heartpin") {
      const m = mat("#ff5c8a", { roughness: 0.3 }); const g = new THREE.Group(); g.position.set(0.2, 0.17, 0.12); g.rotation.z = -0.4; head.add(g);
      sph(0.035, m, -0.025, 0.02, 0, g, 10); sph(0.035, m, 0.025, 0.02, 0, g, 10); const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.07, 10), m); c.rotation.z = Math.PI; c.position.y = -0.025; g.add(c);
    }
    if (f === "glasses" || f === "roundglasses") {
      const gm = f === "glasses" ? mat("#1b1f2c", { metalness: 0.4, roughness: 0.3 }) : gold;
      const r = f === "glasses" ? 0.055 : 0.065;
      [-0.085, 0.085].forEach((x) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 6, 18), gm); ring.position.set(x, -0.005, 0.247); head.add(ring); });
      box(0.05, 0.01, 0.01, gm, 0, 0.01, 0.25, head);
    }
    if (f === "sunglasses") {
      const gm = mat("#111318", { roughness: 0.1, metalness: 0.5 });
      [-0.09, 0.09].forEach((x) => box(0.13, 0.075, 0.02, gm, x, 0, 0.25, head));
      box(0.06, 0.015, 0.015, gm, 0, 0.02, 0.255, head);
    }
    if (n === "badge") {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 20, Math.PI), mat("#1f8a8a")); strap.rotation.z = Math.PI; strap.position.set(0, 0.66, 0.1); strap.rotation.x = -0.3; body.add(strap);
      box(0.12, 0.15, 0.015, "#ffffff", 0, 0.5, 0.15, body); box(0.12, 0.035, 0.017, "#e2336b", 0, 0.555, 0.15, body);
    }
    if (n === "camera") {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20, Math.PI), mat("#1b1f2c")); strap.rotation.z = Math.PI; strap.position.set(0, 0.66, 0.1); strap.rotation.x = -0.3; body.add(strap);
      box(0.2, 0.12, 0.08, "#1b1f2c", 0, 0.5, 0.16, body); const l = cyl(0.045, 0.05, 0.07, mat("#3b3f4a", { metalness: 0.5, roughness: 0.3 }), 0, 0.5, 0.22, body, 16); l.rotation.x = Math.PI / 2;
    }
    if (n === "necktie") box(0.055, 0.2, 0.02, mat("#2f6fdb"), 0, 0.55, 0.14, body);
    if (b === "backpack") { rbox(0.3, 0.32, 0.14, 0.05, mat("#1f8a8a", { roughness: 0.9 }), 0, 0.52, -0.17, body); box(0.2, 0.12, 0.04, mat("#187373"), 0, 0.45, -0.25, body); }
    if (b === "cape") { const c = box(0.42, 0.5, 0.02, mat("#b4233f", { roughness: 0.8 }), 0, 0.42, -0.16, body); c.rotation.x = 0.18; box(0.36, 0.04, 0.05, gold, 0, 0.67, -0.12, body); }
  }
  const DIR_ROT = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
  function poseChar(ch, dir, moving, dt) {
    const u = ch.userData;
    const target = DIR_ROT[dir] || 0;
    let diff = target - ch.rotation.y; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    ch.rotation.y += diff * Math.min(1, dt * 14);
    if (moving) u.phase += dt * 12; else u.phase *= 0.8;
    const s = Math.sin(u.phase) * (moving ? 0.65 : 0);
    u.legs[0].rotation.x = s; u.legs[1].rotation.x = -s;
    u.arms[0].rotation.x = -s * 0.8; u.arms[1].rotation.x = s * 0.8;
    u.body.position.y = moving ? Math.abs(Math.sin(u.phase)) * 0.04 : 0;
    u.head.rotation.z = moving ? Math.sin(u.phase) * 0.04 : 0;
  }

  /* ---------- 家具 ---------- */
  const W = { wood: "#b98a5e", woodDark: "#7a5232", white: "#f4f5f7", metal: "#9aa3ad", dark: "#2a2f3c" };
  function plant(g, x, z, big) {
    const s = big ? 1.25 : 1;
    cyl(0.17 * s, 0.13 * s, 0.32 * s, mat("#c26a3a", { roughness: 0.9 }), x, 0.16 * s, z, g);
    cyl(0.16 * s, 0.16 * s, 0.02, "#4a3426", x, 0.32 * s, z, g);
    const leaf = mat("#3f9a4f", { roughness: 0.8 }), leaf2 = mat("#56b866", { roughness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 * s, 0), i % 2 ? leaf : leaf2);
      const a = i / 7 * Math.PI * 2; m.position.set(x + Math.sin(a) * 0.13 * s, (0.55 + (i % 3) * 0.14) * s, z + Math.cos(a) * 0.13 * s);
      m.rotation.set(i, i * 2, 0); m.castShadow = true; g.add(m);
    }
  }
  function desk(g, x, z, mine, tex) {
    box(0.98, 0.05, 0.72, mat(W.wood, { roughness: 0.55 }), x, 0.74, z, g);
    [[-0.44, -0.3], [0.44, -0.3], [-0.44, 0.3], [0.44, 0.3]].forEach(([dx, dz]) => box(0.04, 0.72, 0.04, W.metal, x + dx, 0.36, z + dz, g));
    box(0.04, 0.22, 0.04, W.dark, x, 0.88, z - 0.2, g);
    box(0.2, 0.02, 0.14, W.dark, x, 0.775, z - 0.2, g);
    box(0.62, 0.38, 0.03, mat(W.dark, { roughness: 0.4 }), x, 1.1, z - 0.2, g);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), new THREE.MeshBasicMaterial({ map: mine ? tex.screenPink : tex.screenBlue }));
    sc.position.set(x, 1.1, z - 0.183); g.add(sc);
    box(0.42, 0.015, 0.13, "#d9dde3", x, 0.775, z + 0.08, g);
    if (mine) { cyl(0.04, 0.035, 0.09, "#ffffff", x + 0.33, 0.81, z + 0.15, g, 12); box(0.12, 0.01, 0.16, "#fff3a8", x - 0.3, 0.772, z + 0.12, g); }
    else if (Math.random() < 0.5) box(0.18, 0.04, 0.24, "#79c7ef", x - 0.3, 0.79, z + 0.12, g);
  }

  /* ---------- 本体 ---------- */
  const World = {};
  let renderer, scene, camera, root, clock, container, sun, hemi, amb, fill;
  let playerObj = null, playerLookKey = "", npcObjs = {}, markerObjs = [], itemObjs = [], photoObjs = [], hearts = [];
  let windowMats = [], camTarget = new THREE.Vector3(8, 0, 7), shake = 0, currentMap = null, pickables = [];
  let rainLines = null;
  const markerTex = { pink: null };

  World.init = function (canvas) {
    container = canvas.parentElement;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100);
    hemi = new THREE.HemisphereLight(0xffffff, 0xb79a7a, 0.55); scene.add(hemi);
    amb = new THREE.AmbientLight(0xffffff, 0.12); scene.add(amb);
    sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -11; sun.shadow.camera.right = 11; sun.shadow.camera.top = 11; sun.shadow.camera.bottom = -11;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);
    fill = new THREE.DirectionalLight(0xfff1e0, 0.25); fill.position.set(8, 6, 20); scene.add(fill);
    clock = new THREE.Clock();
    markerTex.pink = bubbleTex("#e2336b");
    World.heartTex = heartTex();
    World.glowY = glowTex("255,190,60"); World.glowB = glowTex("90,170,255");
    resize(); window.addEventListener("resize", resize);
    textures();
  };
  function resize() {
    if (!renderer) return;
    const w = container.clientWidth, h = Math.round(w * 0.75);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (World.battleCam) { World.battleCam.aspect = w / h; World.battleCam.updateProjectionMatrix(); }
  }
  World.resize = resize;

  function clearRoot() {
    if (root) { scene.remove(root); root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    root = new THREE.Group(); scene.add(root);
    npcObjs = {}; markerObjs = []; itemObjs = []; photoObjs = []; windowMats = []; pickables = []; playerObj = null; playerLookKey = ""; rainLines = null;
  }
  function tag(obj, spot) { obj.traverse((o) => { o.userData.spot = spot; }); pickables.push(obj); }

  World.buildMap = function (mapId, M, npcs, dayId) {
    currentMap = mapId; clearRoot();
    const tex = textures();
    const g = root;
    const house = mapId === "house";
    // 床
    const floorMat = new THREE.MeshStandardMaterial({ map: house ? tex.oak : tex.wood, roughness: 0.6 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(8, 0, 6.5); floor.receiveShadow = true; g.add(floor);
    floor.userData.floor = true; pickables.push(floor);
    // 外の地面（部屋の外）
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(house ? "#c9d8b8" : "#d5dbe3", { roughness: 1 }));
    outside.rotation.x = -Math.PI / 2; outside.position.set(8, -0.02, 6); outside.receiveShadow = true; g.add(outside);
    if (!house) {
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ map: tex.carpet, roughness: 1 }));
      carpet.rotation.x = -Math.PI / 2; carpet.position.set(13, 0.004, 4); carpet.receiveShadow = true; g.add(carpet); pickables.push(carpet); carpet.userData.floor = true;
      const tiles = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ map: tex.tile, roughness: 0.35 }));
      tiles.rotation.x = -Math.PI / 2; tiles.position.set(13, 0.004, 9); tiles.receiveShadow = true; g.add(tiles); pickables.push(tiles); tiles.userData.floor = true;
    } else {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshStandardMaterial({ map: tex.rug, roughness: 1 }));
      rug.rotation.x = -Math.PI / 2; rug.position.set(4, 0.004, 4.6); rug.receiveShadow = true; g.add(rug); pickables.push(rug); rug.userData.floor = true;
    }
    // 壁
    const wallMat = new THREE.MeshStandardMaterial({ map: house ? tex.hwall : tex.wall, roughness: 0.95 });
    const H = 2.7;
    box(16, H, 0.4, wallMat, 8, H / 2, 1.8, g);              // 奥
    box(0.4, H, 9.4, wallMat, 0.8, H / 2, 6.5, g);           // 左
    box(0.4, H, 9.4, wallMat, 15.2, H / 2, 6.5, g);          // 右
    box(16, 0.32, 0.4, wallMat, 8, 0.16, 11.2, g);           // 手前（低い）
    box(16, 0.1, 0.02, house ? "#c9b28c" : "#b8c2cf", 8, 0.05, 2.01, g); // 幅木
    // 窓
    const winDefs = house ? [[1.4, 14.6, 0.25, 2.45]] : [[1.5, 4.4, 0.95, 2.2], [5.4, 8.4, 0.95, 2.2]];
    winDefs.forEach(([x0, x1, y0, y1]) => {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const m = new THREE.MeshBasicMaterial({ map: skyTex("#8ec5ff", "#dff0ff") });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(cx, cy, 2.012); g.add(p); windowMats.push(m);
      const fm = mat(house ? "#3b3f4a" : "#ffffff", { roughness: 0.4, metalness: 0.2 });
      box(w + 0.12, 0.07, 0.08, fm, cx, y0, 2.04, g); box(w + 0.12, 0.07, 0.08, fm, cx, y1, 2.04, g);
      box(0.07, h, 0.08, fm, x0, cy, 2.04, g); box(0.07, h, 0.08, fm, x1, cy, 2.04, g);
      const n = house ? 4 : 2; for (let k = 1; k < n; k++) box(0.05, h, 0.06, fm, x0 + w * k / n, cy, 2.04, g);
      if (!house) box(w + 0.2, 0.05, 0.16, fm, cx, y0 - 0.03, 2.1, g);
      // 光のさしこみ（半透明の板）
      if (dayId !== "rain") {
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 3.2), new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: house ? 0.05 : 0.07, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.set(cx, 0.01, 2 + 1.6); beam.rotation.x = -Math.PI / 2; g.add(beam);
      }
    });
    // 雨
    if (dayId === "rain") {
      const pts = []; winDefs.forEach(([x0, x1, y0, y1]) => { for (let i = 0; i < (x1 - x0) * 14; i++) { const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0); pts.push(x, y, 2.02, x - 0.02, y - 0.12, 2.02); } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      rainLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
      rainLines.userData.base = pts.slice(); rainLines.userData.bounds = winDefs; g.add(rainLines);
    }
    if (!house) {
      // 間仕切り（ガラス）
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6f5, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
      const frame = mat("#8d97a3", { metalness: 0.5, roughness: 0.4 });
      for (let y = 2; y <= 6; y++) for (let x = 10; x <= 14; x++) {
        if (M.grid[y][x] !== "|") continue;
        const vertical = x === 10;
        const cx = vertical ? 10.5 : x + 0.5, cz = vertical ? y + 0.5 : 6.5;
        const w = vertical ? 0.06 : 1, d = vertical ? 1 : 0.06;
        const gl = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), glass); gl.position.set(cx, 1.1, cz); g.add(gl);
        box(vertical ? 0.1 : 1, 0.06, vertical ? 1 : 0.1, frame, cx, 2.2, cz, g); box(vertical ? 0.1 : 1, 0.1, vertical ? 1 : 0.1, frame, cx, 0.05, cz, g);
      }
      box(0.1, 2.2, 0.1, frame, 10.5, 1.1, 3.95, g); box(0.1, 2.2, 0.1, frame, 10.5, 1.1, 5.05, g);
      // ホワイトボード
      const wb = new THREE.Group();
      box(1.9, 1.05, 0.05, mat("#c3ccd8", { metalness: 0.4, roughness: 0.35 }), 0, 0, 0, wb);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.95), new THREE.MeshStandardMaterial({ map: tex.board, roughness: 0.25 })); face.position.z = 0.03; wb.add(face);
      box(1.6, 0.04, 0.09, "#9aa7b8", 0, -0.55, 0.04, wb);
      wb.position.set(12, 1.4, 2.04); g.add(wb); tag(wb, "board");
      // 時計
      const clk = new THREE.Group(); clk.position.set(9.5, 2.05, 2.03); g.add(clk);
      const face2 = cyl(0.2, 0.2, 0.04, "#ffffff", 0, 0, 0, clk, 24); face2.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 24), mat("#1b1f2c")); clk.add(rim);
      World.clockHands = [box(0.015, 0.13, 0.01, "#1b1f2c", 0, 0.05, 0.03, clk), box(0.015, 0.17, 0.01, "#e2336b", 0, 0.07, 0.035, clk)];
      World.clockHands.forEach((h) => { h.geometry.translate(0, 0.0, 0); });
      // 天井照明（ライン）
      for (let i = 0; i < 2; i++) { const l = box(5, 0.04, 0.12, new THREE.MeshBasicMaterial({ color: 0xffffff }), 5, 2.65, 4 + i * 3.5, g); l.castShadow = false; }
    }
    // ドア（手前）
    const door = new THREE.Group(); door.position.set(2.5, 0, 11.2); g.add(door);
    const df = mat("#6b4a3a", { roughness: 0.5 });
    box(0.08, 2.2, 0.14, df, -0.5, 1.1, 0, door); box(0.08, 2.2, 0.14, df, 0.5, 1.1, 0, door); box(1.08, 0.1, 0.14, df, 0, 2.2, 0, door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (c) => { c.fillStyle = "#1f8a8a"; c.fillRect(0, 0, 256, 64); c.fillStyle = "#fff"; c.font = "bold 30px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(house ? "← オフィスへ" : "モデルハウスへ →", 128, 34); }) }));
    sign.position.set(0, 2.42, 0.02); sign.rotation.x = -0.25; door.add(sign);
    const mat2 = box(0.9, 0.02, 0.6, mat(house ? "#8a6450" : "#1f8a8a", { roughness: 1 }), 0, 0.01, -0.55, door); mat2.castShadow = false;
    tag(door, house ? "hdoor" : "door");

    // 置き物
    M.objects.forEach((o) => {
      const x = o.x + 0.5, z = o.y + 0.5;
      const og = new THREE.Group(); g.add(og);
      if (o.k === "desk") desk(og, x, z, o.mine, tex);
      else if (o.k === "table") {
        box(1.0, 0.05, 0.9, mat("#f4f6f9", { roughness: 0.3 }), x, 0.72, z, og);
        cyl(0.04, 0.04, 0.7, W.metal, x, 0.36, z, og, 10);
        if (o.x === 12) { box(0.36, 0.02, 0.26, "#c3ccd8", x, 0.755, z + 0.1, og); const lid = box(0.36, 0.24, 0.015, "#c3ccd8", x, 0.87, z - 0.03, og); lid.rotation.x = -0.25; }
        else cyl(0.045, 0.04, 0.09, "#ffffff", x, 0.79, z, og, 12);
        // 椅子
        if (o.x === 13) { box(0.42, 0.06, 0.42, "#2f3a4f", x + 0.05, 0.45, z + 0.65, og); box(0.42, 0.45, 0.06, "#2f3a4f", x + 0.05, 0.7, z + 0.86, og); }
      } else if (o.k === "counter" || o.k === "coffee") {
        box(1.0, 0.92, 0.7, mat("#6b4a3a", { roughness: 0.55 }), x, 0.46, z, og);
        box(1.02, 0.05, 0.74, mat("#e8e4dc", { roughness: 0.25 }), x, 0.94, z, og);
        if (o.k === "coffee") {
          box(0.42, 0.55, 0.38, mat("#2a2f3c", { roughness: 0.3, metalness: 0.4 }), x, 1.24, z - 0.05, og);
          box(0.2, 0.1, 0.02, new THREE.MeshBasicMaterial({ color: 0xe2336b }), x, 1.38, z + 0.15, og);
          cyl(0.045, 0.04, 0.09, "#ffffff", x, 1.01, z + 0.12, og, 12);
        } else { for (let i = 0; i < 3; i++) cyl(0.04, 0.035, 0.08, i === 1 ? "#79c7ef" : "#ffffff", x - 0.2 + i * 0.2, 1.0, z, og, 10); }
      } else if (o.k === "sofa") {
        box(1.0, 0.36, 0.8, mat("#1f8a8a", { roughness: 0.95 }), x, 0.24, z, og);
        box(1.0, 0.5, 0.22, mat("#187373", { roughness: 0.95 }), x, 0.55, z + 0.3, og);
        if (o.x === 12) box(0.2, 0.5, 0.8, mat("#187373", { roughness: 0.95 }), x - 0.42, 0.4, z, og); else box(0.2, 0.5, 0.8, mat("#187373", { roughness: 0.95 }), x + 0.42, 0.4, z, og);
        if (o.x === 13) { const c = box(0.3, 0.28, 0.1, mat("#f0b429", { roughness: 0.95 }), x, 0.52, z + 0.12, og); c.rotation.z = 0.2; }
      } else if (o.k === "plant") plant(og, x, z, mapId === "house");
      else if (o.k === "camera") {
        for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = cyl(0.015, 0.015, 1.2, W.dark, x + Math.sin(a) * 0.15, 0.58, z + Math.cos(a) * 0.15, og, 6); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); }
        box(0.3, 0.2, 0.16, "#1b1f2c", x, 1.25, z, og); const lens = cyl(0.07, 0.08, 0.16, mat("#3b3f4a", { metalness: 0.5, roughness: 0.3 }), x, 1.25, z + 0.15, og, 16); lens.rotation.x = Math.PI / 2;
        const ring = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: 0x79c7ef })); ring.position.set(x, 1.25, z + 0.235); og.add(ring);
      } else if (o.k === "hsofa") {
        box(1.0, 0.34, 0.85, mat("#8a8f99", { roughness: 0.95 }), x, 0.22, z, og);
        box(1.0, 0.45, 0.22, mat("#777c86", { roughness: 0.95 }), x, 0.52, z - 0.32, og);
        if (o.x === 3) box(0.22, 0.48, 0.85, mat("#777c86", { roughness: 0.95 }), x - 0.4, 0.36, z, og);
        if (o.x === 5) box(0.22, 0.48, 0.85, mat("#777c86", { roughness: 0.95 }), x + 0.4, 0.36, z, og);
        if (o.x === 4) { const c = box(0.34, 0.3, 0.1, mat("#f0b429", { roughness: 0.95 }), x, 0.5, z - 0.15, og); c.rotation.z = -0.15; }
        if (o.x === 4) { box(0.9, 0.06, 0.5, mat(W.wood, { roughness: 0.5 }), x, 0.32, z - 1.2, og); cyl(0.05, 0.05, 0.3, "#3b3f4a", x, 0.15, z - 1.2, og, 8); }
      } else if (o.k === "island") {
        box(1.0, 0.88, 0.8, mat("#f4f6f9", { roughness: 0.4 }), x, 0.44, z, og);
        box(1.04, 0.05, 0.84, mat("#3b3f4a", { roughness: 0.2, metalness: 0.2 }), x, 0.9, z, og);
        if (o.x === 11) { box(0.4, 0.02, 0.3, "#c3ccd8", x, 0.935, z, og); const f = cyl(0.015, 0.015, 0.35, "#c3ccd8", x, 1.1, z - 0.25, og, 8); }
        if (o.x !== 11) {
          cyl(0.005, 0.005, 1.1, "#1b1f2c", x, 2.15, z, og, 4);
          const shade = cyl(0.04, 0.15, 0.18, mat("#1b1f2c", { roughness: 0.5 }), x, 1.55, z, og, 16);
          const bulb = sph(0.06, new THREE.MeshBasicMaterial({ color: 0xffe3a0 }), x, 1.46, z, og, 10); bulb.castShadow = false;
          const pl = new THREE.PointLight(0xffd59a, 0.45, 3.2); pl.position.set(x, 1.4, z); og.add(pl);
        }
        // スツール
        cyl(0.13, 0.13, 0.05, mat(W.wood), x, 0.62, z + 0.62, og, 14); cyl(0.02, 0.02, 0.6, W.dark, x, 0.3, z + 0.62, og, 6);
      } else if (o.k === "stairs") {
        const steps = 4, base = o.y === 3 ? 0 : 4;
        for (let k = 0; k < steps; k++) { const hgt = (base + k + 1) * 0.28; box(1.0, hgt, 0.25, mat("#c99a70", { roughness: 0.6 }), x, hgt / 2, z + 0.375 - k * 0.25, og); }
        if (o.x === 13) { box(0.05, 0.9, 1.0, mat("#3b3f4a", { metalness: 0.5 }), x - 0.48, (base + 2) * 0.28 + 0.6, z, og); }
      } else if (o.k === "dining") {
        box(1.0, 0.05, 0.85, mat(W.wood, { roughness: 0.5 }), x, 0.72, z, og);
        box(0.05, 0.7, 0.05, W.dark, x + (o.x === 10 ? -0.42 : 0.42), 0.35, z - 0.35, og); box(0.05, 0.7, 0.05, W.dark, x + (o.x === 10 ? -0.42 : 0.42), 0.35, z + 0.35, og);
        if (o.x === 10) { cyl(0.11, 0.11, 0.02, "#ffffff", x, 0.755, z, og, 18); } else { cyl(0.06, 0.05, 0.16, "#ffffff", x, 0.83, z, og, 12); plant(og, x + 0.2, z - 0.1, false); og.children.slice(-9).forEach((c) => c.scale.multiplyScalar(0.35)); og.children.slice(-9).forEach((c) => { c.position.x = x + (c.position.x - x - 0.2) * 0.35 + 0.2; c.position.z = z - 0.1 + (c.position.z - z + 0.1) * 0.35; c.position.y = 0.75 + c.position.y * 0.35; }); }
        box(0.4, 0.05, 0.4, mat(W.wood), x, 0.45, z - 0.65, og); box(0.4, 0.45, 0.05, mat(W.wood), x, 0.68, z - 0.85, og);
      }
    });
    // NPC
    npcs.forEach((n) => {
      const ch = makeChar(n.look); ch.position.set(n.x + 0.5, 0, n.y + 0.5); ch.rotation.y = DIR_ROT[n.dir] || 0;
      ch.userData.dir = n.dir; g.add(ch); npcObjs[n.id] = ch; tag(ch, n.id);
    });
    Object.entries(M.spots).forEach(([id, s]) => { if (id === "desk") { /* デスクは家具をタグ */ } });
    // デスク・コーヒー・ソファ・窓のクリック判定用の透明箱
    Object.entries(M.spots).forEach(([id, s]) => {
      if (npcObjs[id] || id === "door" || id === "hdoor" || id === "board") return;
      if (s.onlyDay && s.onlyDay !== dayId) return;
      s.tiles.forEach(([tx, ty]) => {
        const hb = new THREE.Mesh(new THREE.BoxGeometry(1, ty <= 1 ? 2.4 : 1.4, ty <= 1 ? 0.3 : 1), new THREE.MeshBasicMaterial({ visible: false }));
        hb.position.set(tx + 0.5, ty <= 1 ? 1.2 : 0.7, ty <= 1 ? 2.1 : ty + 0.5); g.add(hb); tag(hb, id);
      });
    });
  };

  World.setNpcDir = function (id, dir) { const o = npcObjs[id]; if (o) o.userData.dir = dir; };

  const SKY = {
    "9:00": ["#8ec5ff", "#e6f3ff", 0xfff6ea, 1.25, [-4, 14, -6]], "10:00": ["#6fb4ff", "#d5ecff", 0xfff8ef, 1.3, [-2, 15, -6]], "11:00": ["#5aa8f7", "#cfe8ff", 0xffffff, 1.35, [0, 16, -5]],
    "12:00": ["#4aa0f2", "#cbe6ff", 0xffffff, 1.35, [2, 16, -5]], "13:00": ["#5aa8f0", "#d7ebfb", 0xfffaf2, 1.3, [4, 15, -5]], "14:00": ["#78b6ea", "#e3eef6", 0xfff1df, 1.25, [6, 14, -6]],
    "15:00": ["#9cbfe0", "#f2e9dc", 0xffe6c8, 1.2, [9, 12, -6]], "16:00": ["#e9b98a", "#fbe3c8", 0xffcf9a, 1.15, [12, 10, -6]], "17:00": ["#e88f7a", "#f7c9a8", 0xffa774, 1.1, [16, 7, -5]],
    "17:30": ["#b46f8a", "#e8a88f", 0xff8f7a, 0.95, [18, 6, -5]]
  };
  World.setTime = function (time, dayId) {
    const s = SKY[time] || SKY["9:00"];
    let top = s[0], bot = s[1], col = s[2], inten = s[3];
    if (dayId === "rain") { top = "#7f8b9c"; bot = "#b9c1cc"; col = 0xd6e0ee; inten = 0.55; }
    windowMats.forEach((m) => { if (m.map) m.map.dispose(); m.map = skyTex(top, bot, dayId === "rain"); m.needsUpdate = true; });
    sun.color.setHex(col); sun.intensity = inten;
    sun.position.set(8 + s[4][0], s[4][1], 6 + s[4][2]); sun.target.position.set(8, 0, 6.5);
    hemi.intensity = dayId === "rain" ? 0.7 : 0.55;
    hemi.color.setHex(dayId === "rain" ? 0xc6d2e2 : 0xffffff);
    const bg = time === "17:00" || time === "17:30" ? "#e7cdc4" : time === "16:00" ? "#efe0d2" : dayId === "rain" ? "#c3cad4" : "#e4e9f0";
    scene.background = new THREE.Color(bg);
    if (World.clockHands) { const hr = parseInt(time, 10) % 12, mn = time.endsWith("30") ? 30 : 0; World.clockHands[0].rotation.z = -((hr + mn / 60) / 12) * Math.PI * 2; World.clockHands[1].rotation.z = -(mn / 60) * Math.PI * 2; }
  };

  World.setPlayerLook = function (lk) {
    const key = JSON.stringify(lk);
    if (playerObj && key === playerLookKey) return;
    if (playerObj) root.remove(playerObj);
    playerObj = makeChar(lk); playerLookKey = key; root.add(playerObj);
  };
  World.setPlayer = function (x, z, dir, moving) {
    if (!playerObj) return;
    playerObj.position.set(x + 0.5, 0, z + 0.5);
    playerObj.userData.dir = dir; playerObj.userData.moving = moving;
  };
  World.snapCamera = function () { if (playerObj) camTarget.copy(playerObj.position); };

  /* ---------- ほかのプレイヤー ---------- */
  const peerObjs = {}; let peerGroup = null;
  function nameTex(text) {
    return canvasTex(256, 64, (g) => {
      g.font = "bold 30px 'Zen Kaku Gothic New', sans-serif"; const w = Math.min(240, g.measureText(text).width + 28);
      g.fillStyle = "rgba(27,31,44,0.85)"; g.beginPath(); g.roundRect ? g.roundRect(128 - w / 2, 8, w, 46, 14) : g.rect(128 - w / 2, 8, w, 46); g.fill();
      g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128, 32, 220);
    });
  }
  World.setPeers = function (list) {
    if (!peerGroup) { peerGroup = new THREE.Group(); scene.add(peerGroup); }
    const seen = {};
    list.forEach((p) => {
      seen[p.peer] = true;
      const key = JSON.stringify(p.look) + "|" + p.nick;
      let o = peerObjs[p.peer];
      if (o && o.userData.key !== key) { peerGroup.remove(o); o = null; }
      if (!o) {
        o = makeChar(p.look); o.userData.key = key;
        o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.82; } });
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex(p.nick), depthTest: false, transparent: true }));
        label.scale.set(1.1, 0.275, 1); label.position.y = 1.55; label.renderOrder = 9; o.add(label);
        o.position.set(p.x + 0.5, 0, p.y + 0.5); peerGroup.add(o); peerObjs[p.peer] = o;
      }
      o.userData.tx = p.x + 0.5; o.userData.tz = p.y + 0.5; o.userData.dir = p.dir; o.userData.moving = p.moving;
    });
    Object.keys(peerObjs).forEach((k) => { if (!seen[k]) { peerGroup.remove(peerObjs[k]); delete peerObjs[k]; } });
  };
  function updatePeers(dt) {
    Object.values(peerObjs).forEach((o) => {
      const u = o.userData; const dx = u.tx - o.position.x, dz = u.tz - o.position.z;
      const d = Math.hypot(dx, dz); const moving = d > 0.03;
      if (d > 4) { o.position.x = u.tx; o.position.z = u.tz; }
      else if (moving) { const step = Math.min(d, dt * 4.2); o.position.x += dx / d * step; o.position.z += dz / d * step; }
      poseChar(o, u.dir || "down", moving || u.moving, dt);
    });
  }

  World.setMarkers = function (list) {
    markerObjs.forEach((m) => root.remove(m)); markerObjs = [];
    list.forEach(({ spot, x, y, wall }) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex.pink, depthTest: false }));
      sp.scale.set(0.62, 0.78, 1); sp.renderOrder = 10;
      sp.userData.base = new THREE.Vector3(x, wall ? 2.85 : 1.85, wall ? 2.3 : y); sp.userData.spot = spot;
      root.add(sp); markerObjs.push(sp); pickables.push(sp);
    });
  };
  function itemMesh(id) {
    const g = new THREE.Group();
    if (id === "coffee") { cyl(0.09, 0.075, 0.2, mat("#ffffff", { roughness: 0.3 }), 0, 0, 0, g, 18); cyl(0.085, 0.085, 0.01, "#6b4a3a", 0, 0.1, 0, g, 18); const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12, Math.PI), mat("#ffffff")); h.position.set(0.09, 0.0, 0); h.rotation.z = -Math.PI / 2; g.add(h); }
    else if (id === "energy") { cyl(0.07, 0.07, 0.24, mat("#2f6fdb", { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, g, 18); cyl(0.071, 0.071, 0.07, mat("#f0b429", { metalness: 0.4, roughness: 0.3 }), 0, 0.02, 0, g, 18); cyl(0.06, 0.07, 0.02, mat("#c3ccd8", { metalness: 0.8, roughness: 0.2 }), 0, 0.13, 0, g, 18); }
    else if (id === "memo") { box(0.22, 0.02, 0.28, "#fff3a8", 0, 0, 0, g); box(0.16, 0.022, 0.015, "#9a8a3a", 0, 0.002, -0.06, g); box(0.12, 0.022, 0.015, "#9a8a3a", -0.02, 0.002, 0, g); box(0.16, 0.022, 0.015, "#e2336b", 0, 0.002, 0.06, g); g.rotation.x = -0.6; }
    else if (id === "sweets") { box(0.26, 0.12, 0.2, "#e57aa0", 0, 0, 0, g); box(0.27, 0.125, 0.04, "#f0b429", 0, 0, 0, g); box(0.04, 0.125, 0.21, "#f0b429", 0, 0, 0, g); sph(0.04, "#f0b429", 0, 0.08, 0, g, 8); }
    return g;
  }
  World.itemMesh = itemMesh;
  World.setItems = function (list) {
    itemObjs.forEach((m) => root.remove(m)); itemObjs = [];
    list.forEach((it) => {
      const g = new THREE.Group(); g.position.set(it.x + 0.5, 0, it.y + 0.5);
      const m = itemMesh(it.id); m.position.y = 0.4; m.scale.setScalar(1.5); g.add(m); g.userData.spin = m;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: World.glowY, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(0.9, 0.9, 1); glow.position.y = 0.4; g.add(glow);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0xf0b429, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; g.add(ring);
      root.add(g); itemObjs.push(g);
    });
  };
  World.setPhotos = function (list) {
    photoObjs.forEach((m) => root.remove(m)); photoObjs = [];
    list.forEach((p) => {
      const g = new THREE.Group(); g.position.set(p.x + 0.5, 0, p.y + 0.5);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshStandardMaterial({ color: 0x79c7ef, emissive: 0x3a8fd0, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.3 }));
      m.position.y = 0.45; g.add(m); g.userData.spin = m;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: World.glowB, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(0.8, 0.8, 1); glow.position.y = 0.45; g.add(glow);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), new THREE.MeshBasicMaterial({ color: 0x79c7ef, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; g.add(ring);
      root.add(g); photoObjs.push(g);
    });
  };
  World.hearts = function (n) {
    const base = playerObj ? playerObj.position : new THREE.Vector3(8, 0, 7);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: World.heartTex, transparent: true, depthWrite: false }));
      const sc = 0.2 + Math.random() * 0.25; s.scale.set(sc, sc, 1);
      s.position.set(base.x + (Math.random() - 0.5) * 6, 0.2 + Math.random() * 0.6, base.z + (Math.random() - 0.5) * 4);
      s.userData = { vy: 0.9 + Math.random() * 1.3, life: 2.4 + Math.random(), ph: Math.random() * 6 };
      scene.add(s); hearts.push(s);
    }
  };
  World.shake = function (t) { shake = Math.max(shake, t); };

  World.pick = function (clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, camera);
    const hits = rc.intersectObjects(pickables, true);
    for (const h of hits) {
      let o = h.object; let spot = null;
      while (o) { if (o.userData && o.userData.spot) { spot = o.userData.spot; break; } o = o.parent; }
      if (spot) return { spot };
      if (h.object.userData.floor) return { tile: [Math.floor(h.point.x), Math.floor(h.point.z)] };
    }
    return null;
  };

  /* ---------- ボス戦 ---------- */
  let bScene = null, bossObj = null, bPlayer = null, bState = { hit: 0, hurt: 0, dead: false };
  function makeBoss(id) {
    const g = new THREE.Group(); const parts = [];
    const em = (c, e, i) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: e || 0x000000, emissiveIntensity: i || 0, roughness: 0.5 }); parts.push(m); return m; };
    const dark = em(0x1b1f2c);
    if (id === "deadline") {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 40), em(0xffffff)); face.rotation.x = Math.PI / 2; face.position.y = 1.5; g.add(face);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.12, 12, 40), em(0xe2336b)); rim.position.y = 1.5; g.add(rim);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), dark); t.position.set(Math.sin(a) * 0.82, 1.5 + Math.cos(a) * 0.82, 0.16); t.rotation.z = -a; g.add(t); }
      [-0.6, 0.6].forEach((x) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14, 0, 7, 0, Math.PI / 2), em(0xc3ccd8)); b.position.set(x, 2.45, 0); b.rotation.z = -x * 0.5; g.add(b); });
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.03), em(0xe2336b)); hand.geometry.translate(0, 0.3, 0); hand.position.set(0, 1.5, 0.17); g.add(hand); g.userData.hand = hand;
      [-0.35, 0.35].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), dark); e.scale.set(1, 1.3, 0.5); e.position.set(x, 1.62, 0.17); g.add(e); const br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), dark); br.position.set(x, 1.85, 0.17); br.rotation.z = x > 0 ? 0.35 : -0.35; g.add(br); });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.03), em(0xb4233f)); mouth.position.set(0, 1.15, 0.17); g.add(mouth);
      [-0.15, 0, 0.15].forEach((x) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.035), em(0xffffff)); t.position.set(x, 1.21, 0.18); g.add(t); });
      [-0.5, 0.5].forEach((x) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10), dark); l.position.set(x, 0.3, 0); g.add(l); const f = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.35), dark); f.position.set(x, 0.05, 0.08); g.add(f); });
      [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 10), dark); a.position.set(s * 1.25, 1.4, 0); a.rotation.z = s * 0.7; g.add(a); });
    } else if (id === "enjo") {
      const cols = [[0xe2336b, 0xe2336b, 1.0, 1.1], [0xff7a3d, 0xff5a1d, 0.8, 1.4], [0xffd34d, 0xffb020, 0.55, 1.7]];
      cols.forEach(([c, e, r, h], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), em(c, e, 0.6)); m.position.y = 0.9 + i * 0.05; m.scale.y = 1.05; g.add(m); const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.75, h, 20), em(c, e, 0.6)); cone.position.y = 0.9 + r * 0.6 + h / 2 - 0.2; g.add(cone); });
      [[-0.7, 1.7, 0.4], [0.75, 1.5, 0.35]].forEach(([x, y, r]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, 0.9, 14), em(0xff7a3d, 0xff5a1d, 0.6)); c.position.set(x, y, 0); c.rotation.z = -x * 0.4; g.add(c); });
      [-0.3, 0.3].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), dark); e.scale.set(1, 1.3, 0.5); e.position.set(x, 1.05, 0.62); g.add(e); const br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), dark); br.position.set(x, 1.27, 0.6); br.rotation.z = x > 0 ? 0.4 : -0.4; g.add(br); });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.04), dark); mouth.position.set(0, 0.75, 0.66); g.add(mouth);
      g.userData.bubbles = [];
      for (let i = 0; i < 3; i++) { const b = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.06), em(0xffffff)); b.add(m); const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.07), em(0xb4233f)); t.position.y = 0.04; b.add(t); const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.07), em(0xb4233f)); d.position.y = -0.1; b.add(d); g.add(b); g.userData.bubbles.push(b); }
    } else {
      const paper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.1), em(0xffffff)); paper.position.y = 1.25; g.add(paper);
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.02), em(0xc3ccd8)); l.position.set(0, 1.95 - k * 0.22, 0.06); g.add(l); }
      [[-0.3, 1.8, 0.6, 0.5], [0.25, 0.75, 0.7, -0.3], [0.35, 1.45, 0.4, 0.8]].forEach(([x, y, w, r]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.03), em(0xe2336b)); m.position.set(x, y, 0.08); m.rotation.z = r; g.add(m); });
      [-0.3, 0.3].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), dark); e.scale.set(1, 1.3, 0.5); e.position.set(x, 1.35, 0.08); g.add(e); const br = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.04), dark); br.position.set(x, 1.56, 0.08); br.rotation.z = x > 0 ? 0.35 : -0.35; g.add(br); });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.03), dark); mouth.position.set(0, 1.05, 0.08); g.add(mouth);
      const pen = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 16), em(0xe2336b)); pen.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), em(0xf0b429)); tip.position.y = -0.95; pen.add(tip);
      const capm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 16), dark); capm.position.y = 0.75; pen.add(capm);
      pen.position.set(1.1, 1.4, 0.3); pen.rotation.z = 0.5; g.add(pen); g.userData.pen = pen;
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData.parts = parts; g.userData.id = id;
    return g;
  }
  World.startBattle = function (bossId, lk) {
    bScene = new THREE.Scene();
    bScene.background = new THREE.Color(0x231a35);
    bScene.fog = new THREE.Fog(0x231a35, 8, 18);
    bScene.add(new THREE.HemisphereLight(0x8f7fd0, 0x2a1530, 0.7));
    const spot = new THREE.SpotLight(0xffffff, 1.6, 20, 0.55, 0.5); spot.position.set(0, 7, 3); spot.target.position.set(0, 1, -1.5); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
    bScene.add(spot); bScene.add(spot.target);
    const rim = new THREE.PointLight(0xff5a9a, 1.2, 10); rim.position.set(-3, 2.5, -3); bScene.add(rim);
    const rim2 = new THREE.PointLight(0x5ac8ff, 0.8, 10); rim2.position.set(3, 2, -2.5); bScene.add(rim2);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0x3d2a52, roughness: 0.6, metalness: 0.2 })); fl.position.y = -0.1; fl.receiveShadow = true; bScene.add(fl);
    const ringm = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0xe2336b })); ringm.rotation.x = Math.PI / 2; bScene.add(ringm);
    const starGeo = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 300; i++) sp.push((Math.random() - 0.5) * 30, Math.random() * 12 + 1, -6 - Math.random() * 10);
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); bScene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06 })));
    bossObj = makeBoss(bossId); bossObj.position.set(0, 0, -1.6); bScene.add(bossObj);
    bPlayer = makeChar(lk); bPlayer.scale.setScalar(1.6); bPlayer.position.set(-1.5, 0, 2.0); bPlayer.rotation.y = Math.PI + 0.35; bScene.add(bPlayer);
    World.battleCam = new THREE.PerspectiveCamera(45, camera.aspect, 0.1, 60); World.battleCam.position.set(0.4, 2.4, 6.2); World.battleCam.lookAt(0, 1.3, -0.8);
    bState = { hit: 0, hurt: 0, dead: false, deadT: 0 };
  };
  World.battleHit = function () { bState.hit = 0.45; shake = Math.max(shake, 0.15); };
  World.battleHurt = function () { bState.hurt = 0.45; shake = Math.max(shake, 0.35); };
  World.battleDefeat = function () { bState.dead = true; };
  World.endBattle = function () { bScene = null; bossObj = null; bPlayer = null; };

  /* ---------- 毎フレーム ---------- */
  World.render = function () {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    let cam = camera, sc = scene;
    if (bScene) {
      cam = World.battleCam; sc = bScene;
      if (bossObj) {
        const u = bossObj.userData;
        bossObj.position.y = Math.sin(t * 2) * 0.08;
        bossObj.rotation.y = Math.sin(t * 0.8) * 0.15;
        if (u.hand) u.hand.rotation.z = -t * 3;
        if (u.pen) u.pen.rotation.z = 0.5 + Math.sin(t * 3) * 0.25;
        if (u.bubbles) u.bubbles.forEach((b, i) => { const a = t * 1.2 + i * 2.1; b.position.set(Math.sin(a) * 1.6, 1.6 + Math.sin(a * 1.7) * 0.4, Math.cos(a) * 0.6); });
        if (u.id === "enjo") bossObj.scale.set(1 + Math.sin(t * 9) * 0.03, 1 + Math.sin(t * 7) * 0.05, 1);
        if (bState.hit > 0) { bState.hit -= dt; const on = Math.floor(bState.hit * 20) % 2 === 0; u.parts.forEach((m) => { m.emissive.setHex(on ? 0xffffff : 0x000000); m.emissiveIntensity = on ? 0.8 : 0; }); bossObj.position.x = Math.sin(t * 60) * 0.12; if (bState.hit <= 0) u.parts.forEach((m) => { m.emissive.setHex(0); m.emissiveIntensity = 0; }); }
        else bossObj.position.x = 0;
        if (bState.dead) { bState.deadT += dt; bossObj.scale.multiplyScalar(0.94); bossObj.rotation.y += dt * 8; if (bossObj.scale.x < 0.03) { bScene.remove(bossObj); bossObj = null; } }
      }
      if (bPlayer) { poseChar(bPlayer, "up", false, dt); bPlayer.rotation.y = Math.PI + 0.35; bPlayer.position.z = 2.0 + (bState.hurt > 0 ? Math.sin(t * 50) * 0.05 : 0); if (bState.hurt > 0) bState.hurt -= dt; }
    } else {
      if (playerObj) {
        poseChar(playerObj, playerObj.userData.dir || "down", !!playerObj.userData.moving, dt);
        camTarget.lerp(playerObj.position, Math.min(1, dt * 3));
      }
      Object.values(npcObjs).forEach((n) => poseChar(n, n.userData.dir || "down", false, dt));
      updatePeers(dt);
      markerObjs.forEach((m, i) => { const b = m.userData.base; m.position.set(b.x, b.y + Math.sin(t * 3 + i) * 0.08, b.z); });
      itemObjs.concat(photoObjs).forEach((g, i) => { const s = g.userData.spin; s.rotation.y = t * 2 + i; s.position.y = 0.42 + Math.sin(t * 2.5 + i) * 0.06; });
      if (rainLines) {
        const pos = rainLines.geometry.attributes.position; const base = rainLines.userData.base;
        for (let i = 0; i < pos.count; i += 2) {
          const off = ((t * 2.5 + (i % 17) * 0.13) % 1.4);
          let y = base[i * 3 + 1] - off; const bnds = rainLines.userData.bounds.find((b) => base[i * 3] >= b[0] - 0.1 && base[i * 3] <= b[1] + 0.1) || rainLines.userData.bounds[0];
          if (y < bnds[2] + 0.12) y += (bnds[3] - bnds[2] - 0.12);
          pos.setY(i, y); pos.setY(i + 1, y - 0.12);
        }
        pos.needsUpdate = true;
      }
      const cx = Math.max(4.6, Math.min(11.4, camTarget.x)), cz = Math.max(4.4, Math.min(9.0, camTarget.z));
      camera.position.set(cx, 7.6, cz + 6.3);
      camera.lookAt(cx, 0.5, cz - 0.3);
    }
    hearts = hearts.filter((h) => { h.userData.life -= dt; h.position.y += h.userData.vy * dt; h.position.x += Math.sin(t * 3 + h.userData.ph) * 0.01; h.material.opacity = Math.min(1, h.userData.life); if (h.userData.life <= 0) { scene.remove(h); return false; } return true; });
    if (shake > 0) { shake -= dt; cam.position.x += (Math.random() - 0.5) * 0.25; cam.position.y += (Math.random() - 0.5) * 0.18; }
    renderer.render(sc, cam);
    if (bScene && World.battleCam) { World.battleCam.position.set(0.4, 2.4, 6.2); }
  };

  /* ---------- アバターのスナップショットとプレビュー ---------- */
  let snapR = null, snapScene, snapCam; const snapCache = {};
  function snapSetup() {
    if (snapR) return;
    const c = document.createElement("canvas"); c.width = 160; c.height = 160;
    snapR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    snapR.outputEncoding = THREE.sRGBEncoding; snapR.toneMapping = THREE.ACESFilmicToneMapping; snapR.setSize(160, 160, false);
    snapScene = new THREE.Scene();
    snapScene.add(new THREE.HemisphereLight(0xffffff, 0xb79a7a, 0.5));
    const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(2, 4, 5); snapScene.add(d);
    snapCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  }
  World.snapshot = function (key, buildFn, camPos, look) {
    if (snapCache[key]) return snapCache[key];
    snapSetup();
    const obj = buildFn(); snapScene.add(obj);
    snapCam.position.set(...camPos); snapCam.lookAt(...look);
    snapR.render(snapScene, snapCam);
    const url = snapR.domElement.toDataURL("image/png");
    snapScene.remove(obj);
    snapCache[key] = url; return url;
  };
  World.avatarURL = function (lk) {
    return World.snapshot("a" + JSON.stringify(lk), () => { const c = makeChar(lk); c.rotation.y = 0.35; return c; }, [0.15, 0.9, 2.4], [0, 0.6, 0]);
  };
  World.faceURL = function (lk) {
    return World.snapshot("f" + JSON.stringify(lk), () => { const c = makeChar(lk); c.rotation.y = 0.25; return c; }, [0.12, 1.0, 1.25], [0, 0.85, 0]);
  };
  World.itemURL = function (id) {
    return World.snapshot("i" + id, () => { const g = itemMesh(id); g.scale.setScalar(2.4); g.rotation.y = 0.6; return g; }, [0, 0.7, 1.4], [0, 0.05, 0]);
  };
  World.createPreview = function (canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0xb79a7a, 0.7));
    const d = new THREE.DirectionalLight(0xffffff, 1.0); d.position.set(2, 5, 4); d.castShadow = true; s.add(d);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), new THREE.MeshStandardMaterial({ color: 0xe8d9c1, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; s.add(fl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0, 1.25, 3.0); cam.lookAt(0, 0.6, 0);
    let ch = null; const ck = new THREE.Clock();
    function size() { const w = canvas.clientWidth || 160, h = canvas.clientHeight || 160; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    size(); window.addEventListener("resize", size);
    let wave = 0;
    return {
      setLook(lk) { if (ch) s.remove(ch); ch = makeChar(lk); s.add(ch); wave = 1.2; },
      render() { const t = ck.getElapsedTime(), dt = 1 / 60; if (ch) { ch.rotation.y = Math.sin(t * 0.7) * 0.6; if (wave > 0) { wave -= dt; ch.userData.arms[1].rotation.z = Math.sin(wave * 14) * 0.5 + 0.6 * Math.min(1, wave * 2); } else ch.userData.arms[1].rotation.z = 0; ch.userData.body.position.y = Math.abs(Math.sin(t * 2)) * 0.02; } r.render(s, cam); }
    };
  };

  window.World3D = World;
})();
