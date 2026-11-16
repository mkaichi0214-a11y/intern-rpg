(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("ja-JP");
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

  /* ===================== サウンド ===================== */
  let ac = null, soundOn = false, bgmTimer = null, bgmStep = 0, bgmName = null;
  function ensureAC() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!soundOn || !ac) return;
    const t0 = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol) {
    if (!soundOn || !ac) return;
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; g.gain.value = vol || 0.08;
    s.connect(g); g.connect(ac.destination); s.start();
  }
  const SFX = {
    blip: () => tone(1100, 0.03, "square", 0.012),
    select: () => { tone(880, 0.06, "square", 0.04); tone(1320, 0.08, "square", 0.04, 0.06); },
    talk: () => tone(660, 0.07, "triangle", 0.06),
    pickup: () => [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.08, "square", 0.04, i * 0.06)),
    level: () => [67, 72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.1, "square", 0.045, i * 0.07)),
    buzz: () => { [72, 76, 79, 84, 88].forEach((m, i) => tone(mtof(m), 0.14, "square", 0.05, i * 0.08)); tone(mtof(96), 0.4, "triangle", 0.05, 0.42); },
    good: () => { tone(mtof(76), 0.08, "square", 0.04); tone(mtof(83), 0.14, "square", 0.04, 0.08); },
    bad: () => { tone(mtof(64), 0.12, "square", 0.04); tone(mtof(58), 0.2, "square", 0.04, 0.12); },
    hit: () => { noise(0.15, 0.12); tone(220, 0.15, "square", 0.05, 0, 80); },
    hurt: () => { tone(300, 0.2, "sawtooth", 0.05, 0, 90); noise(0.1, 0.06); },
    door: () => { tone(330, 0.08, "triangle", 0.06); tone(494, 0.12, "triangle", 0.06, 0.09); },
    win: () => [72, 72, 72, 76, 79, 84].forEach((m, i) => tone(mtof(m), i === 5 ? 0.5 : 0.12, "square", 0.05, i * 0.13)),
    lose: () => [67, 64, 60, 55].forEach((m, i) => tone(mtof(m), 0.22, "triangle", 0.06, i * 0.2)),
    boss: () => { tone(110, 0.6, "sawtooth", 0.05, 0, 55); noise(0.5, 0.05); }
  };
  function sfx(n) { if (soundOn) { ensureAC(); SFX[n] && SFX[n](); } }
  const BGM = {
    office: { ms: 170, mel: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 72, 0, 0, 0, 69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 71, 0, 72, 0, 0, 0],
      bass: [48, 48, 45, 45, 41, 41, 43, 43] },
    house: { ms: 200, mel: [76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 77, 0, 0, 0, 74, 0, 77, 0, 81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 0, 0],
      bass: [48, 48, 52, 52, 53, 53, 55, 55] },
    battle: { ms: 115, mel: [69, 72, 76, 72, 69, 72, 77, 72, 67, 71, 74, 71, 68, 71, 76, 71, 69, 72, 76, 81, 79, 76, 77, 74, 76, 0, 72, 0, 71, 0, 68, 0],
      bass: [45, 45, 41, 41, 43, 43, 40, 40] }
  };
  function playBgm(name) {
    bgmName = name;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (!soundOn || !name) return;
    ensureAC();
    const b = BGM[name]; bgmStep = 0;
    bgmTimer = setInterval(() => {
      const m = b.mel[bgmStep % b.mel.length];
      if (m) tone(mtof(m), b.ms / 1000 * 0.9, "square", 0.018);
      if (bgmStep % 4 === 0) { const bs = b.bass[Math.floor(bgmStep / 4) % b.bass.length]; tone(mtof(bs), b.ms / 1000 * 3.5, "triangle", 0.035); }
      bgmStep++;
    }, b.ms);
  }
  function setSound(on) {
    soundOn = on;
    if (on) ensureAC();
    ["snd-maker", "snd-game"].forEach((id) => {
      const b = $(id); b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = id === "snd-game" ? (on ? "♪ オン" : "♪ オフ") : (on ? "オン" : "オフ");
    });
    playBgm(bgmName);
  }

  /* ===================== アバター ===================== */
  const STYLES = [["short", "ショート"], ["long", "ロング"], ["bun", "おだんご"], ["spiky", "ツンツン"]];
  const HAIRS = ["#2b2420", "#7a4a2a", "#d9a441", "#e57aa0"];
  const SKINS = ["#f6d7bd", "#e8b98f", "#b9825a"];
  const OUTFITS = ["#2f6fdb", "#e2336b", "#1f8a8a", "#f0b429", "#3b3f4a"];
  const TYPES = [
    { id: "power", name: "体力おばけ", desc: "体力95でスタート。疲れにくく、体力の減りが2割少ない" },
    { id: "sense", name: "センスの人", desc: "投稿のセンスが光る。フォロワーの増え方が3割アップ" },
    { id: "comm", name: "人たらし", desc: "信頼62でスタート。信頼の上がり方が3割アップ" }
  ];
  const look = { style: "short", hair: HAIRS[0], skin: SKINS[0], outfit: OUTFITS[0], acc: {} };
  try { const saved = JSON.parse(localStorage.getItem("intern-rpg-acc") || "{}"); if (saved && typeof saved === "object") look.acc = saved; } catch (e) { /* なし */ }
  let type = TYPES[0];
  let playerName = "インターン";

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    return "rgb(" + Math.max(0, (n >> 16) - 40) + "," + Math.max(0, ((n >> 8) & 255) - 40) + "," + Math.max(0, (n & 255) - 40) + ")";
  }
  function drawChar(ctx, ox, oy, lk, dir, step) {
    const flip = dir === "left";
    const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + (flip ? 16 - x - w : x), oy + y, w, h); };
    const side = dir === "left" || dir === "right", back = dir === "up";
    const pants = "#34384a", shoe = "#1d2030";
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(ox + 4, oy + 15, 8, 1);
    const l = step === 1 ? 1 : 0, r = step === 2 ? 1 : 0;
    if (side) { P(6, 12, 2, 3 - l, pants); P(6, 14 - l, 2, 1, shoe); P(8, 12, 2, 3 - r, pants); P(8, 14 - r, 2, 1, shoe); }
    else { P(5, 12, 2, 3 - l, pants); P(5, 14 - l, 2, 1, shoe); P(9, 12, 2, 3 - r, pants); P(9, 14 - r, 2, 1, shoe); }
    if (lk.style === "long" && !back) P(4, 6, 8, 4, lk.hair);
    if (side) { P(5, 8, 6, 5, lk.outfit); P(7, 9, 2, 3, shade(lk.outfit)); P(7, 11, 2, 1, lk.skin); }
    else {
      P(4, 8, 8, 5, lk.outfit); if (!back) P(7, 8, 2, 1, "#ffffff");
      const a = step === 1 ? 1 : 0, b = step === 2 ? 1 : 0;
      P(3, 9 - a, 1, 3, lk.outfit); P(3, 12 - a, 1, 1, lk.skin); P(12, 9 - b, 1, 3, lk.outfit); P(12, 12 - b, 1, 1, lk.skin);
    }
    if (side) P(5, 2, 6, 6, lk.skin); else P(4, 2, 8, 6, lk.skin);
    const H = lk.hair;
    if (back) {
      P(4, 1, 8, 6, H); P(5, 0, 6, 1, H);
      if (lk.style === "long") P(4, 7, 8, 3, H);
      if (lk.style === "bun") P(6, -1, 4, 2, H);
      if (lk.style === "spiky") { P(4, 0, 1, 1, H); P(7, -1, 2, 1, H); P(11, 0, 1, 1, H); }
    } else if (side) {
      P(5, 1, 6, 2, H); P(4, 2, 2, 4, H); P(5, 3, 1, 2, H); P(10, 2, 1, 1, H);
      if (lk.style === "long") P(4, 6, 3, 4, H);
      if (lk.style === "bun") P(3, 0, 3, 3, H);
      if (lk.style === "spiky") { P(5, 0, 1, 1, H); P(7, -1, 1, 1, H); P(9, 0, 1, 1, H); }
      P(9, 4, 1, 2, "#222"); P(10, 6, 1, 1, "#f2a3a3");
    } else {
      P(5, 1, 6, 1, H); P(4, 2, 8, 1, H); P(4, 3, 2, 1, H); P(10, 3, 2, 1, H); P(6, 3, 2, 1, H); P(4, 4, 1, 2, H); P(11, 4, 1, 2, H);
      if (lk.style === "long") { P(3, 3, 1, 7, H); P(12, 3, 1, 7, H); P(4, 6, 1, 3, H); P(11, 6, 1, 3, H); }
      if (lk.style === "bun") P(6, -1, 4, 2, H);
      if (lk.style === "spiky") { P(4, 1, 1, 1, H); P(6, 0, 1, 1, H); P(9, 0, 1, 1, H); P(11, 1, 1, 1, H); }
      P(6, 5, 1, 2, "#222"); P(9, 5, 1, 2, "#222"); P(5, 7, 1, 1, "#f2a3a3"); P(10, 7, 1, 1, "#f2a3a3");
    }
    if (lk.glasses && !back) { if (side) P(8, 4, 3, 1, "#1b1f2c"); else { P(5, 4, 3, 1, "#1b1f2c"); P(8, 4, 3, 1, "#1b1f2c"); } }
    if (lk.tie && !back && !side) { P(7, 9, 2, 3, lk.tie); }
    if (lk.cap) {
      if (side) { P(4, 0, 7, 2, lk.cap); P(10, 2, 3, 1, lk.cap); }
      else { P(4, 0, 8, 2, lk.cap); P(4, 2, 8, 1, lk.cap); if (!back) P(3, 3, 10, 1, shade(lk.cap)); }
    }
  }
  function cleanAcc(a) {
    const out = {}; if (!a || typeof a !== "object") return out;
    ACC_SLOTS.forEach(([slot]) => { const id = a[slot]; if (typeof id === "string" && ACCESSORIES.some((x) => x.id === id && x.slot === slot)) out[slot] = id; });
    return out;
  }
  function lookCopy() { return { style: look.style, hair: look.hair, skin: look.skin, outfit: look.outfit, acc: { ...look.acc } }; }
  function safeLook(l) {
    const ok = (c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
    l = l && typeof l === "object" ? l : {};
    return {
      style: STYLES.some((s) => s[0] === l.style) ? l.style : "short",
      hair: ok(l.hair) ? l.hair : HAIRS[0], skin: ok(l.skin) ? l.skin : SKINS[0], outfit: ok(l.outfit) ? l.outfit : OUTFITS[0],
      acc: cleanAcc(l.acc)
    };
  }

  // アイテムのアイコン（12x12）
  function drawItem(ctx, ox, oy, id) {
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };
    if (id === "coffee") { R(2, 4, 7, 7, "#ffffff"); R(2, 4, 7, 2, "#6b4a3a"); R(9, 5, 2, 4, "#ffffff"); R(3, 1, 1, 2, "#c3ccd8"); R(6, 0, 1, 3, "#c3ccd8"); R(2, 10, 7, 1, "#c3ccd8"); }
    else if (id === "energy") { R(3, 1, 6, 10, "#2f6fdb"); R(3, 1, 6, 2, "#c3ccd8"); R(4, 4, 4, 3, "#f0b429"); R(5, 5, 2, 1, "#2f6fdb"); }
    else if (id === "memo") { R(2, 1, 8, 10, "#fff3a8"); R(3, 3, 6, 1, "#9a8a3a"); R(3, 5, 5, 1, "#9a8a3a"); R(3, 7, 6, 1, "#e2336b"); R(8, 1, 2, 2, "#f0b429"); }
    else if (id === "sweets") { R(1, 4, 10, 6, "#e57aa0"); R(1, 4, 10, 2, "#ffffff"); R(5, 4, 2, 6, "#f0b429"); R(3, 2, 6, 2, "#f0b429"); }
  }

  let preview = null;
  function renderPreview() {
    if (preview) preview.setLook(lookCopy());
    $("pvname").textContent = playerName || "インターン";
  }
  function pressGroup(container, btn) { container.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false")); }
  function buildMaker() {
    const st = $("o-style");
    STYLES.forEach(([id, label], i) => {
      const b = document.createElement("button"); b.className = "pill"; b.textContent = label; b.setAttribute("aria-pressed", i === 0);
      b.onclick = () => { look.style = id; pressGroup(st, b); renderPreview(); sfx("blip"); }; st.appendChild(b);
    });
    [["o-hair", HAIRS, "hair", ["黒", "茶", "金", "ピンク"]], ["o-skin", SKINS, "skin", ["明るめ", "ふつう", "小麦"]], ["o-outfit", OUTFITS, "outfit", ["青", "ピンク", "緑", "黄", "黒"]]].forEach(([id, list, key, names]) => {
      const box = $(id);
      list.forEach((col, i) => {
        const b = document.createElement("button"); b.className = "sw"; b.style.background = col; b.setAttribute("aria-label", names[i]); b.setAttribute("aria-pressed", i === 0);
        b.onclick = () => { look[key] = col; pressGroup(box, b); renderPreview(); sfx("blip"); }; box.appendChild(b);
      });
    });
    const tb = $("o-type");
    TYPES.forEach((t, i) => {
      const b = document.createElement("button"); b.className = "type"; b.setAttribute("aria-pressed", i === 0);
      b.innerHTML = "<strong>" + t.name + "</strong><span>" + t.desc + "</span>";
      b.onclick = () => { type = t; pressGroup(tb, b); sfx("blip"); }; tb.appendChild(b);
    });
    $("name").addEventListener("input", (e) => { playerName = e.target.value.trim(); $("pvname").textContent = playerName || "インターン"; });
    renderPreview();
  }

  function accUnlocked(a) { return !a.title || (typeof prog !== "undefined" && prog.titles.includes(a.title)); }
  function buildEquip() {
    const box = $("equip"); box.innerHTML = "";
    look.acc = cleanAcc(look.acc);
    ACC_SLOTS.forEach(([slot, label]) => {
      if (look.acc[slot] && !accUnlocked(ACCESSORIES.find((a) => a.id === look.acc[slot]))) delete look.acc[slot];
      const row = document.createElement("div"); row.className = "eq-row";
      const lb = document.createElement("span"); lb.textContent = label; row.appendChild(lb);
      const r = document.createElement("div"); r.className = "row";
      const mk = (text, id, locked, a) => {
        const b = document.createElement("button"); b.className = "pill" + (locked ? " locked" : "");
        b.textContent = text; b.setAttribute("aria-pressed", (look.acc[slot] || null) === id ? "true" : "false");
        b.onclick = () => {
          if (locked) { const t = TITLES.find((x) => x.id === a.title); $("acc-note").textContent = a.name + "：称号「" + (t ? t.name : "") + "」（" + (t ? t.hint : "") + "）で解放"; sfx("bad"); return; }
          if (id) look.acc[slot] = id; else delete look.acc[slot];
          try { localStorage.setItem("intern-rpg-acc", JSON.stringify(look.acc)); } catch (e) { /* なし */ }
          pressGroup(r, b); renderPreview(); sfx("blip");
          $("acc-note").textContent = id ? ACCESSORIES.find((x) => x.id === id).name + " を装備しました" : "";
        };
        r.appendChild(b);
      };
      mk("なし", null, false);
      ACCESSORIES.filter((a) => a.slot === slot).forEach((a) => { const lock = !accUnlocked(a); mk(lock ? "？？？" : a.name, a.id, lock, a); });
      row.appendChild(r); box.appendChild(row);
    });
    const got = ACCESSORIES.filter(accUnlocked).length;
    if (!$("acc-note").textContent || $("acc-note").dataset.auto) { $("acc-note").textContent = "解放ずみ " + got + " / " + ACCESSORIES.length + "。？？？を押すと解放の条件が出ます。"; $("acc-note").dataset.auto = "1"; }
  }

  /* ===================== マップ定義 ===================== */
  const T = 16, COLS = 16, ROWS = 12;
  const MAPS = {
    office: {
      grid: [
        "################", "################",
        "#.........|mmmm#", "#.........|mmmm#", "#.........dmmmm#", "#.........|mmmm#", "#.........|||||#",
        "#..........cccc#", "#..........cccc#", "#..........cccc#", "#..........cccc#",
        "################"
      ],
      objects: [], npcs: [], windows: [[22, 5, 36, 18], [86, 5, 36, 18]],
      spots: {
        desk: { name: "自分のデスク", tiles: [[3, 3]] },
        board: { name: "会議室のホワイトボード", tiles: [[11, 1], [12, 1]] },
        door: { name: "モデルハウスへの出口", tiles: [[2, 11]] },
        coffee: { name: "カフェコーナー", tiles: [[13, 8]] },
        sofa: { name: "休憩ソファ", tiles: [[12, 10], [13, 10]] },
        senpai: { name: "先輩（運用リーダー）", tiles: [[6, 4]] },
        client: { name: "工務店の担当さん", tiles: [[14, 3]] },
        coworker: { name: "同じユニットの人", tiles: [[4, 8]] },
        doki: { name: "同期のインターン", tiles: [[14, 10]] },
        president: { name: "社長", tiles: [[8, 5]], onlyDay: "president" }
      }
    },
    house: {
      grid: [
        "################", "################",
        "#..............#", "#..............#", "#..............#", "#..............#", "#..............#",
        "#..............#", "#..............#", "#..............#", "#..............#",
        "################"
      ],
      objects: [], npcs: [], windows: [[20, 4, 216, 22]],
      spots: {
        window: { name: "リビングの大開口", tiles: [[7, 1], [8, 1]] },
        hdoor: { name: "オフィスへ戻る出口", tiles: [[2, 11]] },
        kantoku: { name: "現場監督さん", tiles: [[13, 9]] }
      }
    }
  };
  const OF = MAPS.office, HO = MAPS.house;
  for (let x = 2; x <= 7; x++) OF.objects.push({ x, y: 3, k: "desk", mine: x === 3 });
  for (let x = 2; x <= 6; x++) OF.objects.push({ x, y: 7, k: "desk" });
  OF.objects.push({ x: 12, y: 3, k: "table" }, { x: 13, y: 3, k: "table" });
  OF.objects.push({ x: 12, y: 8, k: "counter" }, { x: 13, y: 8, k: "coffee" }, { x: 14, y: 8, k: "counter" });
  OF.objects.push({ x: 12, y: 10, k: "sofa" }, { x: 13, y: 10, k: "sofa" });
  OF.objects.push({ x: 1, y: 2, k: "plant" }, { x: 9, y: 2, k: "plant" }, { x: 9, y: 10, k: "plant" }, { x: 1, y: 8, k: "camera" });
  OF.npcs = [
    { id: "senpai", x: 6, y: 4, dir: "up", look: { style: "short", hair: "#2b2420", skin: "#f1cfb3", outfit: "#2b3a67", glasses: true } },
    { id: "client", x: 14, y: 3, dir: "left", look: { style: "short", hair: "#5a3a22", skin: "#e2b08a", outfit: "#5d7f2a", cap: "#f0b429" } },
    { id: "coworker", x: 4, y: 8, dir: "up", look: { style: "long", hair: "#7a4a2a", skin: "#f6d7bd", outfit: "#c75a8a" } },
    { id: "doki", x: 14, y: 10, dir: "left", look: { style: "bun", hair: "#2b2420", skin: "#e8b98f", outfit: "#f0b429" } },
    { id: "president", x: 8, y: 5, dir: "down", onlyDay: "president", look: { style: "short", hair: "#9aa0a8", skin: "#efc9a8", outfit: "#1b1f2c", tie: "#e2336b" } }
  ];
  HO.objects.push({ x: 3, y: 6, k: "hsofa" }, { x: 4, y: 6, k: "hsofa" }, { x: 5, y: 6, k: "hsofa" });
  HO.objects.push({ x: 10, y: 6, k: "island" }, { x: 11, y: 6, k: "island" }, { x: 12, y: 6, k: "island" });
  HO.objects.push({ x: 13, y: 2, k: "stairs" }, { x: 14, y: 2, k: "stairs" }, { x: 13, y: 3, k: "stairs" }, { x: 14, y: 3, k: "stairs" });
  HO.objects.push({ x: 1, y: 2, k: "plant" }, { x: 1, y: 10, k: "plant" }, { x: 10, y: 9, k: "dining" }, { x: 11, y: 9, k: "dining" });
  HO.npcs = [{ id: "kantoku", x: 13, y: 9, dir: "left", look: { style: "short", hair: "#2b2420", skin: "#c99470", outfit: "#3b5f8f", cap: "#ffffff" } }];
  const PHOTO_SPOTS = [
    { x: 4, y: 3, name: "窓辺のやわらかい光" }, { x: 11, y: 4, name: "キッチンの奥行き" }, { x: 12, y: 3, name: "階段の抜け感" },
    { x: 7, y: 9, name: "玄関からの視線" }, { x: 2, y: 5, name: "造作ニッチ" }, { x: 8, y: 6, name: "床と天井のライン" }
  ];

  const FLAVOR = {
    desk: ["パソコンの壁紙は担当中の工務店さんの施工事例。今日もがんばろう。", "通知はゼロ。今のうちに「！」のところへ行こう。"],
    board: ["ホワイトボードに「今月の目標：保存数アップ」と書いてある。", "誰かの落書き。家のイラストがやけに上手い。"],
    door: ["この先はモデルハウス。撮影の用事があるときに行こう。"],
    coffee: ["コーヒーのいい香り。"],
    sofa: ["ふかふかのソファ。座ったら最後、立てなくなりそう。"],
    senpai: ["「困ったらいつでも聞いてね」", "「伸びた投稿は、なぜ伸びたかまで見るのがコツだよ」"],
    client: ["「いつも投稿ありがとうございます！」", "「今度の完成見学会、写真たくさん撮りますね」"],
    coworker: ["「リールの音源、何使ってる？」", "「今日の1枚目どうしようかな〜」"],
    doki: ["「お互いがんばろうね！」", "「床にキラキラしたもの落ちてたよ。拾うといいことあるかも」"],
    president: ["「がんばってるね。数字、楽しみにしてるよ」", "「お客様の声を一番近くで聞けるのがSNSなんだ」"],
    window: ["大きな窓から光がたっぷり。いい写真が撮れそう。"],
    hdoor: ["撮影が終わるまではオフィスに戻れない。"],
    kantoku: ["「床のキラキラしてる場所、撮ると映えるよ」", "「施主さんもこの家の写真、楽しみにしてるって」"]
  };

  let mapId = "office";
  const cur = () => MAPS[mapId];
  function spotIdAt(x, y) {
    for (const [id, s] of Object.entries(cur().spots)) {
      if (s.onlyDay && day.id !== s.onlyDay) continue;
      if (s.tiles.some(([a, b]) => a === x && b === y)) return id;
    }
    return null;
  }
  function npcsHere() { return cur().npcs.filter((n) => !n.onlyDay || n.onlyDay === day.id); }
  function walkable(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    const ch = cur().grid[y][x];
    if (ch === "#" || ch === "|") return false;
    if (cur().objects.some((o) => o.x === x && o.y === y)) return false;
    if (npcsHere().some((n) => n.x === x && n.y === y)) return false;
    return true;
  }

  /* ===================== 状態 ===================== */
  const SKIES = {
    "9:00": ["#8ec5ff", "#dff0ff"], "10:00": ["#6fb4ff", "#d5ecff"], "11:00": ["#5aa8f7", "#cfe8ff"],
    "12:00": ["#4aa0f2", "#cbe6ff"], "13:00": ["#5aa8f0", "#d7ebfb"], "14:00": ["#78b6ea", "#e3eef6"],
    "15:00": ["#9cbfe0", "#f2e9dc"], "16:00": ["#e9b98a", "#fbe3c8"], "17:00": ["#e88f7a", "#f7c9a8"], "17:30": ["#b46f8a", "#e8a88f"], "18:00": ["#5b5f99", "#d29a94"]
  };
  const TINT = { "15:00": 0.04, "16:00": 0.1, "17:00": 0.16, "17:30": 0.2 };
  const PHASE_LABEL = { morning: "午前", lunch: "お昼休み", afternoon: "午後", evening: "夕方" };

  let S, step, pools, active, log, level, curTime = "9:00", day = DAYS[0], inv, memo, st, mapItems, photos, battle = null, ended = false;
  const player = { x: 8, y: 9, px: 8 * T, py: 9 * T, dir: "down", moving: false, anim: 0, path: [], autoTalk: null };
  let held = null, busy = false, frame = 0;
  let shownF = START.f;

  function renderHud() {
    $("v-t").textContent = S.t; $("v-h").textContent = S.h;
    $("b-f").style.width = Math.max(0, Math.min(100, (S.f - START.f) / 10)) + "%";
    $("b-t").style.width = S.t + "%"; $("b-h").style.width = S.h + "%";
    $("who-lv").textContent = "Lv." + level;
    $("daybadge").textContent = day.name;
  }
  function calcLevel() { return 1 + Math.floor(Math.max(0, S.f - START.f) / 120); }

  function renderInv() {
    const box = $("inv"); box.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const id = inv[i];
      const b = document.createElement("button");
      b.className = "slot" + (id ? " has" : "") + (id === "memo" && memo ? " memo-on" : "");
      if (id) {
        let c;
        if (W3) { c = document.createElement("img"); c.alt = ""; c.src = W3.itemURL(id); }
        else { c = document.createElement("canvas"); c.width = 12; c.height = 12; drawItem(c.getContext("2d"), 0, 0, id); }
        b.appendChild(c);
        const s = document.createElement("span"); s.innerHTML = esc(ITEMS[id].name) + "<small>" + esc(ITEMS[id].desc) + "</small>"; b.appendChild(s);
        b.setAttribute("aria-label", ITEMS[id].name + "を使う");
        b.onclick = () => { if (!busy && !battle) useItem(i); };
      } else { b.textContent = "あき"; b.disabled = true; }
      box.appendChild(b);
    }
  }
  function useItem(i, inBattle) {
    const id = inv[i]; if (!id) return "";
    inv.splice(i, 1);
    let msg = "";
    if (id === "coffee") { S.h = clamp(S.h + 15); msg = "コーヒーを飲んだ。体力 +15"; }
    if (id === "energy") { S.h = clamp(S.h + 28); msg = "エナドリを一気飲み！ 体力 +28"; }
    if (id === "sweets") { S.t = clamp(S.t + 8); msg = "お菓子を配った。みんなにこにこ。信頼 +8"; }
    if (id === "memo") { memo = true; msg = "先輩のメモを読み込んだ。次の「運しだい」は必ず当たる！"; }
    sfx("pickup"); renderHud(); renderInv();
    if (!inBattle) toast(msg);
    return msg;
  }

  let toastTimer;
  function toast(msg, ms) {
    const t = $("toast"); t.textContent = msg; t.style.opacity = 1;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = 0; }, ms || 2200);
  }

  function animateFollowers() {
    const target = S.f;
    if (shownF === target) return;
    const diff = target - shownF;
    shownF += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) / 12));
    if ((diff > 0 && shownF > target) || (diff < 0 && shownF < target)) shownF = target;
    $("v-f").textContent = fmt(shownF);
  }

  /* ===================== 進行 ===================== */
  function startGame() {
    ensureAC();
    day = pick(DAYS);
    S = { f: START.f, t: START.t, h: START.h };
    if (type.id === "power") S.h = 95;
    if (type.id === "comm") S.t = 62;
    shownF = S.f; $("v-f").textContent = fmt(S.f);
    step = 0; log = []; level = 1; inv = []; memo = false; battle = null; ended = false;
    st = { luckW: 0, luckL: 0, usedLuck: 0, buzz: 0, items: 0, photos: 0, coffee: false, bossWin: false, bossLose: false, oneshot: false };
    mapItems = []; photos = [];
    pools = {}; Object.keys(EVENTS).forEach((k) => { pools[k] = shuffle(EVENTS[k]); });
    mapId = "office";
    Object.assign(player, { x: 8, y: 9, px: 8 * T, py: 9 * T, dir: "down", moving: false, path: [], autoTalk: null });
    ["maker", "board1", "end", "board2"].forEach((id) => $(id).classList.add("hidden"));
    $("game").classList.remove("hidden");
    $("who-name").textContent = playerName || "インターン";
    renderHud(); renderInv();
    active = []; curTime = SCHEDULE[0].time; aiUsed = false;
    $("time").textContent = curTime; $("phase").textContent = PHASE_LABEL[SCHEDULE[0].phase];
    rebuildWorld();
    if (W3) W3.resize();
    playBgm("office");
    window.scrollTo({ top: 0 });
    let begun = false;
    const begin = (note) => {
      if (begun) return; begun = true;
      setupSlot(true);
      if (W3) W3.setTime(curTime, day.id);
      openDialog({
        speaker: "今日はどんな日？", title: "今日は「" + day.name + "」", text: day.desc + (note ? " " + note : ""),
        next: "次へ",
        onNext: () => openDialog({
          speaker: "ナレーション",
          text: (playerName || "インターン") + "、出社！ 1時間ごとに「！」が2つ出るよ。どちらか1つに話しかけて進めよう。床のキラキラはアイテム。17:30には何かが起きるらしい…。",
          next: "はじめる", onNext: closeDialog
        })
      });
    };
    if (aiMode && sampleFn) {
      const ctl = new AbortController();
      const req = genAIEvents(ctl.signal);
      openDialog({
        speaker: "AI", title: "今日の出来事をAIが考えています…", pre: '<p class="lead" style="font-size:13px;margin:0 0 4px"><span class="spinner"></span>ふつうは数秒〜30秒ほどです</p>',
        text: "初めてのときは、Claudeの利用の許可を聞かれます。待たずに始めたいときは下のボタンを押してください。",
        next: "いつもの出来事で始める", onNext: () => { ctl.abort(); }
      });
      req.then((p) => { pools = p; aiUsed = true; begin("今日の出来事はAIが考えました。"); })
        .catch((e) => {
          const code = e && e.code;
          if (code === "not_granted" || code === "sampling_disabled") { aiMode = false; setAiMode(false); }
          begin(code === "cancelled" ? "" : "（AIの準備がうまくいかなかったので、いつもの出来事にしました）");
        });
    } else begin();
  }

  /* ===================== AIの出来事 ===================== */
  let aiMode = false, aiUsed = false, sampleFn = null;
  function setAiMode(on) {
    aiMode = on;
    $("ai-on").setAttribute("aria-pressed", on ? "true" : "false");
    $("ai-off").setAttribute("aria-pressed", on ? "false" : "true");
  }
  const AI_SPOTS = { morning: ["desk", "senpai", "client", "board"], lunch: ["senpai", "coffee", "sofa"], afternoon: ["desk", "senpai", "client", "board", "door"], evening: ["desk", "senpai", "client", "board"] };
  function genAIEvents(signal) {
    const ex = JSON.stringify([EVENTS.afternoon[1], EVENTS.morning[4]].map((e) => ({ phase: e === EVENTS.afternoon[1] ? "afternoon" : "morning", spot: e.spot, tag: e.tag, title: e.title, body: e.body, choices: e.choices })));
    const prompt = [
      "工務店（住宅会社）のInstagram運用を担当するインターン生が主人公の、社内向けブラウザゲームの「出来事」を作ってください。",
      "今日の設定：" + day.name + "（" + day.desc + "）。主人公のタイプ：" + type.name + "（" + type.desc + "）。",
      "JSON配列だけを返してください。要素は出来事18個です。",
      "条件：",
      "- phase の個数は morning 6、lunch 2、afternoon 6、evening 4。",
      "- spot は phase ごとに次から選ぶ。morning・evening：desk（自分のデスク）、senpai（先輩）、client（工務店の担当さん）、board（会議室のホワイトボード）。afternoon：同じ4つに加えて door（モデルハウスでの撮影。afternoon に1〜2個入れる）。lunch：senpai、coffee（カフェコーナー）、sofa（休憩ソファ）。同じ phase の中で spot が偏らないようにする。",
      "- 出来事の形：{\"phase\",\"spot\",\"tag\"（2〜6文字）,\"title\"（20字以内）,\"body\"（60字以内の状況説明）,\"choices\"（3つ）}。",
      "- 選択肢の形：{\"label\"（25字以内）,\"fx\":{\"f\":フォロワー増減,\"t\":信頼増減,\"h\":体力増減},\"res\"（50字以内の結果）}。または運しだい：{\"label\",\"chance\":0.4〜0.6,\"win\":{\"fx\":{...},\"res\":\"...\"},\"lose\":{\"fx\":{...},\"res\":\"...\"}}。運しだいは全体で4〜6個。",
      "- 数値の目安：f は -50〜150（大当たりだけ200まで）、t は -20〜15、h は -25〜25。丁寧だけど疲れる選択（f か t が上がり h が減る）、効率的な選択、手抜きやダメな選択（t が下がる、または h が回復するだけ）を3択に混ぜる。正解がいつも1番目にならないように順番を混ぜる。",
      "- 内容はInstagram運用の実務（リール、カルーセル、キャプション、ハッシュタグ、インサイト分析、DM・コメント対応、撮影、画像選定、Canva、生成AIの活用、クライアント対応、見学会の告知など）と、インターンのリアルな1日に沿って、少しユーモアのあるものに。今日の設定も1〜3個の出来事に反映する。実在の会社名・人名は使わない。",
      "例（形の参考。内容はまねしない）：" + ex
    ].join("\n");
    return sampleFn.json(prompt, { modelTier: "quick", cache: false, signal }).then(normAI);
  }
  function normAI(arr) {
    if (!Array.isArray(arr)) throw { code: "invalid_json" };
    const str = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : "");
    const num = (v, lo, hi) => { v = Math.round(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
    const fx = (o) => ({ f: num(o && o.f, -80, 220), t: num(o && o.t, -25, 20), h: num(o && o.h, -30, 30) });
    const out = { morning: [], lunch: [], afternoon: [], evening: [] };
    arr.forEach((e) => {
      if (!e || !out[e.phase]) return;
      const title = str(e.title, 30), body = str(e.body, 120); if (!title || !body) return;
      const spot = AI_SPOTS[e.phase].includes(e.spot) ? e.spot : AI_SPOTS[e.phase][0];
      const choices = (Array.isArray(e.choices) ? e.choices : []).slice(0, 3).map((c) => {
        if (!c || typeof c !== "object") return null;
        const label = str(c.label, 40); if (!label) return null;
        if (c.chance !== undefined && c.win && c.lose) {
          const wr = str(c.win.res, 90), lr = str(c.lose.res, 90); if (!wr || !lr) return null;
          return { label, chance: Math.max(0.3, Math.min(0.7, Number(c.chance) || 0.5)), win: { fx: fx(c.win.fx), res: wr }, lose: { fx: fx(c.lose.fx), res: lr } };
        }
        const res = str(c.res, 90); if (!res) return null;
        return { label, fx: fx(c.fx), res };
      }).filter(Boolean);
      if (choices.length < 2) return;
      out[e.phase].push({ tag: str(e.tag, 8) || "出来事", title, body, spot, choices, ai: true });
    });
    const need = { morning: 6, lunch: 2, afternoon: 6, evening: 4 }; let total = 0;
    Object.keys(out).forEach((k) => { total += out[k].length; const extra = shuffle(EVENTS[k]); while (out[k].length < need[k] && extra.length) out[k].push(extra.pop()); out[k] = shuffle(out[k]); });
    if (total < 8) throw { code: "invalid_json" };
    return out;
  }

  function setupSlot(first) {
    const slot = SCHEDULE[step];
    curTime = slot.time;
    let rebuild = false;
    if (mapId !== "office") { mapId = "office"; Object.assign(player, { x: 2, y: 10, px: 2 * T, py: 10 * T, dir: "up", path: [] }); playBgm("office"); rebuild = true; }
    $("time").textContent = slot.time; $("phase").textContent = PHASE_LABEL[slot.phase];
    if (rebuild) rebuildWorld(); else if (W3 && !first) W3.setTime(curTime, day.id);
    const pool = pools[slot.phase];
    const a = pool.pop();
    let idx = pool.findIndex((e) => e.spot !== a.spot);
    if (idx < 0) idx = pool.length - 1;
    const b = idx >= 0 ? pool.splice(idx, 1)[0] : null;
    active = [a, b].filter(Boolean);
    // アイテムを床に置く
    if (Math.random() < 0.6 && mapItems.length < 2) {
      const ids = Object.keys(ITEMS), weights = { coffee: 3, energy: 2, memo: 2, sweets: 2 };
      const bag = []; ids.forEach((k) => { for (let i = 0; i < weights[k]; i++) bag.push(k); });
      for (let tries = 0; tries < 40; tries++) {
        const x = rnd(1, 14), y = rnd(2, 10);
        if (walkable(x, y) && !(x === player.x && y === player.y) && !mapItems.some((m) => m.x === x && m.y === y)) { mapItems.push({ x, y, id: pick(bag) }); break; }
      }
    }
    if (!first) toast(slot.time + "　" + PHASE_LABEL[slot.phase] + "　！が" + active.length + "つ");
  }

  function spotOf(e) { return mapId === "house" && e.spot === "door" ? "window" : e.spot; }
  function activeAt(spotId) { return active.find((e) => spotOf(e) === spotId && (mapId === "office" || e.spot === "door")); }

  /* ===================== 会話ウィンドウ ===================== */
  let typing = null, dialogToken = 0;
  function openDialog(o) {
    if (typing) { clearInterval(typing); typing = null; }
    busy = true; held = null; player.path = [];
    const d = $("dialog"); d.classList.remove("hidden");
    requestAnimationFrame(() => d.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    d.innerHTML =
      '<span class="speaker">' + esc(o.speaker) + (o.tag ? '<span class="tg">' + esc(o.tag) + "</span>" : "") + "</span>" +
      (o.title ? '<p class="dtitle">' + esc(o.title) + "</p>" : "") +
      (o.pre || "") + '<p class="dtext" id="dtext"></p><div id="dafter"></div>';
    const full = o.text; let i = 0; const el = $("dtext");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const token = (dialogToken = (dialogToken || 0) + 1);
    const finish = () => {
      if (token !== dialogToken) return;
      clearInterval(typing); typing = null; el.textContent = full;
      const after = $("dafter");
      if (o.choices) {
        after.innerHTML = '<div class="dchoices">' + o.choices.map((c, k) =>
          '<button class="dchoice" data-k="' + k + '"><span>' + esc(c.label) + "</span>" + (c.chance !== undefined ? '<span class="dice">運しだい</span>' : "") + (c.note ? '<span class="dice">' + esc(c.note) + "</span>" : "") + "</button>").join("") + "</div>";
        after.querySelectorAll(".dchoice").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); sfx("select"); o.onChoose(+b.dataset.k); }));
        after.querySelector(".dchoice").focus({ preventScroll: true });
      } else {
        after.innerHTML = (o.post || "") + '<button class="next" id="dnext">' + esc(o.next || "次へ") + "</button>";
        $("dnext").addEventListener("click", (e) => { e.stopPropagation(); sfx("blip"); o.onNext(); });
        $("dnext").focus({ preventScroll: true });
      }
    };
    d.onclick = () => { if (typing) finish(); };
    if (reduce) { finish(); return; }
    typing = setInterval(() => { i += 1; el.textContent = full.slice(0, i); if (i % 2 === 0) sfx("blip"); if (i >= full.length) finish(); }, 22);
  }
  function closeDialog() { $("dialog").classList.add("hidden"); busy = false; }
  function chip(label, v) { if (!v) return ""; return '<span class="chip ' + (v > 0 ? "up" : "down") + '">' + label + " " + (v > 0 ? "+" : "") + v + "</span>"; }

  function talk(spotId) {
    sfx("talk");
    const name = cur().spots[spotId].name;
    const ev = activeAt(spotId);
    if (spotId === "door" && ev) { goHouse(); return; }
    if (!ev) {
      if (spotId === "coffee" && !st.coffee) {
        if (inv.length < 3) { st.coffee = true; inv.push("coffee"); st.items++; renderInv(); sfx("pickup");
          openDialog({ speaker: name, text: "マシンでコーヒーを1杯いれた。持ち物に「コーヒー」が入った！ 体力が減ったら使おう。", next: "閉じる", onNext: closeDialog }); return; }
      }
      openDialog({ speaker: name, text: pick(FLAVOR[spotId] || ["……"]), next: "閉じる", onNext: closeDialog });
      return;
    }
    openDialog({ speaker: name, tag: ev.tag + (ev.ai ? "・AI" : ""), title: ev.title, text: ev.body, choices: ev.choices, onChoose: (k) => resolve(ev, ev.choices[k], name) });
  }

  function goHouse() {
    sfx("door"); $("fade").classList.add("on"); busy = true;
    setTimeout(() => {
      mapId = "house";
      Object.assign(player, { x: 2, y: 10, px: 2 * T, py: 10 * T, dir: "up", moving: false, path: [], autoTalk: null });
      photos = shuffle(PHOTO_SPOTS).slice(0, 3).map((p) => ({ ...p, found: false }));
      rebuildWorld(); playBgm("house"); setTimeout(() => $("fade").classList.remove("on"), 80); busy = false;
      openDialog({ speaker: "モデルハウス", text: "モデルハウスに到着！ 窓の前の「！」で撮影しよう。床のキラキラは撮影スポット。見つけるとフォロワーが少し増えるよ。", next: "探索する", onNext: closeDialog });
    }, 250);
  }

  function applyMods(fx) {
    const o = { f: fx.f || 0, t: fx.t || 0, h: fx.h || 0 };
    if (type.id === "sense" && o.f > 0) o.f = Math.round(o.f * 1.3);
    if (type.id === "comm" && o.t > 0) o.t = Math.round(o.t * 1.3);
    if (type.id === "power" && o.h < 0) o.h = Math.round(o.h * 0.8);
    if (day.fMul && o.f > 0) o.f = Math.round(o.f * day.fMul);
    if (day.tMul) o.t = Math.round(o.t * day.tMul);
    if (day.hMul && o.h < 0) o.h = Math.round(o.h * day.hMul);
    return o;
  }

  function changeStats(fx) {
    const before = { ...S };
    S.f += fx.f; S.t = clamp(S.t + fx.t); S.h = clamp(S.h + fx.h);
    const d = { f: S.f - before.f, t: S.t - before.t, h: S.h - before.h };
    const newLv = calcLevel(); const lvUp = newLv > level; level = newLv;
    renderHud();
    if (d.f >= 100) buzzFx(d.f);
    else if (lvUp) sfx("level");
    return { d, lvUp };
  }

  function buzzFx(n) {
    st.buzz++;
    if (W3 && !battle) { W3.hearts(46); W3.shake(0.6); }
    sfx("buzz"); toast("バズった！ フォロワー +" + n, 2600); sendNews("buzz");
  }

  function resolve(ev, c, name) {
    let fx = c.fx, res = c.res, luck = "";
    if (c.chance !== undefined) {
      st.usedLuck++;
      let win;
      if (memo) { win = true; memo = false; renderInv(); luck = '<div class="luck" style="color:#17733f">★ 先輩のメモが効いた！ 当たり！</div>'; }
      else { const p = Math.max(0.05, Math.min(0.95, c.chance + (day.luck || 0))); win = Math.random() < p; luck = win ? '<div class="luck" style="color:#17733f">★ 当たり！</div>' : '<div class="luck" style="color:#b4233f">… ハズレ</div>'; }
      if (win) st.luckW++; else st.luckL++;
      fx = win ? c.win.fx : c.lose.fx; res = win ? c.win.res : c.lose.res;
      sfx(win ? "good" : "bad");
    }
    const { d, lvUp } = changeStats(applyMods(fx));
    if (!c.chance) { if (d.f + d.t > 0) sfx("good"); else if (d.f + d.t < 0) sfx("bad"); }
    log.push({ time: curTime, title: ev.title, pick: c.label });
    active = [];
    let chips = chip("フォロワー", d.f) + chip("信頼", d.t) + chip("体力", d.h);
    if (!chips) chips = '<span class="chip zero">変化なし</span>';
    if (lvUp) chips += '<span class="chip up">レベルアップ！ Lv.' + level + "</span>";
    const over = S.h <= 0 ? "h" : S.t <= 0 ? "t" : null;
    const last = step === SCHEDULE.length - 1;
    openDialog({
      speaker: name, tag: ev.tag, pre: luck, text: res, post: '<div class="chips">' + chips + "</div>",
      next: over ? "結果を見る" : last ? "17:30 …？" : SCHEDULE[step + 1].time + " へ",
      onNext: () => {
        closeDialog();
        if (over) return ending(over);
        step++;
        if (step >= SCHEDULE.length) return startBoss();
        setupSlot();
      }
    });
  }

  /* ===================== ボス戦 ===================== */
  function startBoss() {
    const b = pick(BOSSES);
    curTime = "17:30"; $("time").textContent = "17:30"; $("phase").textContent = "ボス戦";
    battle = { b, hp: b.hp, max: b.hp, turn: 0, senpai: false, hitT: 0, hurtT: 0, dmg: [], startH: S.h };
    if (W3) { W3.startBattle(b.id, lookCopy()); W3.shake(0.5); }
    flash("rgba(255,255,255,0.9)"); sfx("boss"); playBgm("battle");
    openDialog({ speaker: "！！", tag: "ボス戦", title: b.name + " があらわれた！", text: b.intro, next: "たたかう", onNext: bossMenu });
  }
  function bossMenu() {
    const bt = battle;
    const choices = [
      { label: "企画でこうげき", key: "plan", note: "Lvで強くなる" },
      { label: "AIにたのむ", key: "ai", chance: 0.55 },
    ];
    if (!bt.senpai) choices.push({ label: "先輩をよぶ（1回だけ）", key: "senpai", note: "信頼で強くなる" });
    if (inv.length) choices.push({ label: "アイテムを使う", key: "item" });
    openDialog({
      speaker: playerName || "インターン", tag: "ボス戦", title: bt.b.name + "　HP " + Math.max(0, bt.hp) + " / " + bt.max,
      text: "体力 " + S.h + "。どうする？", choices,
      onChoose: (k) => playerAct(choices[k].key)
    });
  }
  function playerAct(key) {
    const bt = battle; let dmg = 0, text = "";
    if (key === "item") {
      const choices = inv.map((id) => ({ label: ITEMS[id].name + "（" + ITEMS[id].desc + "）" })).concat([{ label: "もどる" }]);
      openDialog({ speaker: "持ち物", tag: "ボス戦", text: "どれを使う？", choices, onChoose: (k) => {
        if (k >= inv.length) return bossMenu();
        const id = inv[k];
        const msg = useItem(k, true);
        if (id === "memo") { openDialog({ speaker: "持ち物", tag: "ボス戦", text: msg + "（ボス戦では「AIにたのむ」が必ず成功）", next: "次へ", onNext: bossAttack }); return; }
        openDialog({ speaker: "持ち物", tag: "ボス戦", text: msg, next: "次へ", onNext: bossAttack });
      } });
      return;
    }
    if (key === "plan") { dmg = 14 + level * 3 + rnd(0, 8); text = "企画でこうげき！ 渾身の企画書をたたきつけた！"; }
    if (key === "ai") {
      const win = memo || Math.random() < 0.55 + (day.luck || 0) / 2;
      if (memo) { memo = false; renderInv(); }
      if (win) { dmg = rnd(38, 48); text = "AIにたのんだ！ 完璧なたたき台が一瞬でできた！"; }
      else { dmg = rnd(4, 8); text = "AIにたのんだ…けど、答えがちょっとズレていた。"; }
    }
    if (key === "senpai") { bt.senpai = true; dmg = Math.round(S.t * 0.5) + 10; text = "先輩をよんだ！「ここは任せて」頼れる一撃！"; }
    if (type.id === "sense" && key === "plan") dmg = Math.round(dmg * 1.15);
    bt.hp -= dmg; if (W3) W3.battleHit(); floatDmg("-" + dmg, "52%", "22%", "#ffffff"); sfx("hit");
    const finish = bt.hp <= 0;
    if (finish && dmg >= 40) st.oneshot = true;
    openDialog({ speaker: playerName || "インターン", tag: "ボス戦", text: text + " " + bt.b.name + "に " + dmg + " のダメージ！", next: finish ? "やった…？" : "次へ", onNext: finish ? bossWin : bossAttack });
  }
  function bossAttack() {
    const bt = battle; bt.turn++;
    let dmg = rnd(bt.b.atk[0], bt.b.atk[1]);
    const big = bt.turn % 3 === 0; if (big) dmg += 8;
    if (type.id === "power") dmg = Math.round(dmg * 0.8);
    if (day.hMul) dmg = Math.round(dmg * day.hMul);
    S.h = clamp(S.h - dmg); renderHud();
    if (W3) W3.battleHurt(); flash("rgba(226,51,107,0.45)"); floatDmg("-" + dmg, "20%", "58%", "#ffd34d"); sfx("hurt");
    const line = (big ? "大技！ " : "") + pick(bt.b.attacks);
    openDialog({ speaker: bt.b.name, tag: "ボス戦", text: line + " 体力が " + dmg + " へった！", next: S.h <= 0 ? "うっ…" : "次へ", onNext: S.h <= 0 ? bossLose : bossMenu });
  }
  function bossWin() {
    st.bossWin = true; sfx("win"); playBgm(null); sendNews("boss");
    const fx = applyMods({ f: 150, t: 10, h: 0 });
    const { d } = changeStats(fx);
    battle.dead = true; if (W3) W3.battleDefeat();
    openDialog({ speaker: "勝利！", tag: "ボス戦", title: battle.b.name + " をたおした！", text: battle.b.win, post: '<div class="chips">' + chip("フォロワー", d.f) + chip("信頼", d.t) + "</div>", next: "18:00 退勤する", onNext: () => { closeDialog(); ending(null); } });
  }
  function bossLose() {
    st.bossLose = true; sfx("lose"); playBgm(null);
    const before = S.f; S.f = Math.max(START.f - 200, S.f - 60); S.t = clamp(S.t - 10); renderHud();
    openDialog({ speaker: "ボス戦", tag: "敗北", title: "力尽きた…", text: "今日は" + battle.b.name + "に押し切られてしまった。でも、明日がある。", post: '<div class="chips">' + chip("フォロワー", S.f - before) + chip("信頼", -10) + "</div>", next: "18:00 退勤する", onNext: () => { closeDialog(); ending(null); } });
  }

  /* ===================== 移動 ===================== */
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function tryStep(dir) {
    player.dir = dir;
    const [dx, dy] = DIRS[dir]; const nx = player.x + dx, ny = player.y + dy;
    if (walkable(nx, ny)) { player.x = nx; player.y = ny; player.moving = true; return true; }
    return false;
  }
  function faceTile() { const [dx, dy] = DIRS[player.dir]; return [player.x + dx, player.y + dy]; }
  function interact() {
    if (busy || battle) return;
    const [fx, fy] = faceTile();
    let id = spotIdAt(fx, fy);
    if (!id) id = nearbySpot();
    if (id) { faceTo(id); talk(id); }
  }
  function nearbySpot() {
    let found = null;
    for (const [dx, dy] of Object.values(DIRS)) {
      const id = spotIdAt(player.x + dx, player.y + dy);
      if (id && activeAt(id)) return id;
      if (id && !found) found = id;
    }
    return found;
  }
  function faceTo(id) {
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      if (cur().spots[id].tiles.some(([x, y]) => x === player.x + dx && y === player.y + dy)) { player.dir = d; return; }
    }
  }
  function bfs(goals) {
    const key = (x, y) => x + "," + y;
    const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
    const prev = { [key(player.x, player.y)]: null }; const q = [[player.x, player.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (goalSet.has(key(x, y))) { const path = []; let k = key(x, y); while (prev[k]) { path.unshift(k.split(",").map(Number)); k = prev[k]; } return path; }
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, nk = key(nx, ny);
        if (!(nk in prev) && walkable(nx, ny)) { prev[nk] = key(x, y); q.push([nx, ny]); }
      }
    }
    return null;
  }
  function tapTo(tx, ty) {
    if (busy || battle) return;
    const id = spotIdAt(tx, ty);
    if (id) return tapSpot(id);
    if (walkable(tx, ty)) { const p = bfs([[tx, ty]]); if (p) { player.path = p; player.autoTalk = null; } }
  }
  function tapSpot(id) {
    if (busy || battle) return;
    {
      const goals = [];
      cur().spots[id].tiles.forEach(([x, y]) => Object.values(DIRS).forEach(([dx, dy]) => { if (walkable(x + dx, y + dy) || (player.x === x + dx && player.y === y + dy)) goals.push([x + dx, y + dy]); }));
      const p = bfs(goals);
      if (p) { player.path = p; player.autoTalk = id; if (!p.length) { player.autoTalk = null; faceTo(id); talk(id); } }
    }
  }
  function arrived() {
    if (mapId === "office") {
      const i = mapItems.findIndex((m) => m.x === player.x && m.y === player.y);
      if (i >= 0) {
        const it = mapItems[i];
        if (inv.length >= 3) { toast("持ち物がいっぱい！ 先に使おう"); return; }
        mapItems.splice(i, 1); inv.push(it.id); st.items++; renderInv(); sfx("pickup");
        toast(ITEMS[it.id].name + " を拾った！");
      }
    } else {
      const p = photos.find((q) => !q.found && q.x === player.x && q.y === player.y);
      if (p) {
        p.found = true; st.photos++;
        const { d } = changeStats(applyMods({ f: 20 }));
        sfx("pickup"); toast("撮影スポット発見！「" + p.name + "」 +" + d.f);
      }
    }
  }

  function update() {
    frame++;
    animateFollowers();
    if (battle) return;
    if (player.moving) {
      const tx = player.x * T, ty = player.y * T, sp = 2;
      player.px += Math.sign(tx - player.px) * Math.min(sp, Math.abs(tx - player.px));
      player.py += Math.sign(ty - player.py) * Math.min(sp, Math.abs(ty - player.py));
      player.anim++;
      if (player.px === tx && player.py === ty) { player.moving = false; arrived(); }
    }
    if (!player.moving && !busy) {
      if (player.path.length) {
        const [nx, ny] = player.path.shift();
        const dir = Object.keys(DIRS).find((d) => DIRS[d][0] === nx - player.x && DIRS[d][1] === ny - player.y);
        if (!dir || !tryStep(dir)) player.path = [];
      } else if (player.autoTalk) { const id = player.autoTalk; player.autoTalk = null; faceTo(id); talk(id); }
      else if (held) tryStep(held);
    }
    // 社長はたまに向きを変える
    if (frame % 150 === 0 && W3 && day.id === "president" && mapId === "office") { const p = OF.npcs.find((n) => n.id === "president"); p.dir = pick(["down", "left", "right", "down"]); W3.setNpcDir("president", p.dir); }
    const pr = $("prompt");
    const near = !busy && !player.moving ? nearbySpot() : null;
    if (near) { pr.textContent = "A：" + cur().spots[near].name + (activeAt(near) ? "に話しかける" : "を見る"); pr.classList.remove("hidden"); }
    else pr.classList.add("hidden");
  }

  /* ===================== 描画（3D） ===================== */
  const W3 = window.World3D;
  let markerKey = "", itemKey = "";
  function syncWorld() {
    if (!W3) return;
    const mk = mapId + "|" + (active || []).map((e) => e.title).join(",");
    if (mk !== markerKey) {
      markerKey = mk;
      const list = [];
      (active || []).forEach((e) => {
        if (mapId === "house" && e.spot !== "door") return;
        const sid = spotOf(e), sp = cur().spots[sid]; if (!sp) return;
        const xs = sp.tiles.map((t) => t[0]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5; const ty = sp.tiles[0][1];
        list.push({ spot: sid, x: cx, y: ty + 0.5, wall: ty <= 1 });
      });
      W3.setMarkers(list);
    }
    const ik = mapId + "|" + (mapId === "office" ? mapItems.map((m) => m.x + "," + m.y + m.id).join(";") : photos.filter((p) => !p.found).map((p) => p.x + "," + p.y).join(";"));
    if (ik !== itemKey) {
      itemKey = ik;
      if (mapId === "office") { W3.setItems(mapItems); W3.setPhotos([]); } else { W3.setItems([]); W3.setPhotos(photos.filter((p) => !p.found)); }
    }
    W3.setPlayer(player.px / T, player.py / T, player.dir, player.moving || !!(held && !busy));
  }
  function rebuildWorld() {
    if (!W3) return;
    W3.buildMap(mapId, cur(), npcsHere(), day.id);
    W3.setPlayerLook(lookCopy());
    W3.setPlayer(player.px / T, player.py / T, player.dir, false); W3.snapCamera();
    markerKey = ""; itemKey = "";
    W3.setTime(curTime, day.id);
  }
  function renderBHud() {
    const bt = battle; const h = $("bhud");
    if (!bt) { h.classList.add("hidden"); return; }
    h.classList.remove("hidden");
    $("bh-name").textContent = bt.b.name; $("bh-hp").style.width = Math.max(0, bt.hp / bt.max * 100) + "%";
    $("bh-pname").textContent = (playerName || "インターン") + "　体力 " + S.h; $("bh-php").style.width = S.h + "%";
  }
  function floatDmg(text, left, top, color) {
    const d = document.createElement("div"); d.className = "dmg"; d.textContent = text; d.style.left = left; d.style.top = top; d.style.color = color;
    $("stage").appendChild(d); setTimeout(() => d.remove(), 1100);
  }
  function flash(color) { const f = $("flash"); f.style.background = color; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }
  function loop() {
    presenceTick++;
    if (presenceTick % 8 === 0) pushPresence();
    if (!$("game").classList.contains("hidden")) { update(); syncWorld(); if (W3 && presenceTick % 4 === 0) W3.setPeers(peersForWorld()); if (W3) W3.render(); renderBHud(); }
    else if (preview && !$("maker").classList.contains("hidden")) preview.render();
    requestAnimationFrame(loop);
  }

  /* ===================== 入力 ===================== */
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
  document.addEventListener("keydown", (e) => {
    if ($("game").classList.contains("hidden") || e.target.tagName === "INPUT") return;
    if (busy) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const list = [...document.querySelectorAll(".dchoice")]; if (!list.length) return;
        e.preventDefault(); const i = list.indexOf(document.activeElement);
        list[e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length].focus();
      }
      if ((e.key === " " || e.key === "Enter") && typing) { e.preventDefault(); $("dialog").click(); }
      return;
    }
    if (KEYS[e.key]) { e.preventDefault(); held = KEYS[e.key]; player.path = []; player.autoTalk = null; }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); interact(); }
  });
  document.addEventListener("keyup", (e) => { if (KEYS[e.key] === held) held = null; });
  $("dpad").querySelectorAll("button").forEach((b) => {
    const on = (e) => { e.preventDefault(); if (busy) return; held = b.dataset.d; player.path = []; player.autoTalk = null; };
    const off = () => { if (held === b.dataset.d) held = null; };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
  });
  $("abtn").addEventListener("click", () => {
    if (busy) {
      if (typing) { $("dialog").click(); return; }
      const n = $("dnext"); if (n) n.click(); else { const f = document.activeElement; if (f && f.classList.contains("dchoice")) f.click(); else { const first = document.querySelector(".dchoice"); if (first) first.focus(); } }
      return;
    }
    interact();
  });
  $("map").addEventListener("click", (e) => {
    if (!W3 || busy || battle) return;
    const hit = W3.pick(e.clientX, e.clientY); if (!hit) return;
    if (hit.spot) { const sp = cur().spots[hit.spot]; if (sp && !(sp.onlyDay && sp.onlyDay !== day.id)) tapSpot(hit.spot); return; }
    if (hit.tile) tapTo(hit.tile[0], hit.tile[1]);
  });
  ["snd-maker", "snd-game"].forEach((id) => $(id).addEventListener("click", () => { setSound(!soundOn); if (soundOn) sfx("select"); }));

  /* ===================== 称号・保存 ===================== */
  const LS_KEY = "intern-rpg-progress-v1";
  let prog = { titles: [], plays: 0, types: [], best: 0 };
  try { const raw = localStorage.getItem(LS_KEY); if (raw) { const p = JSON.parse(raw); prog = { titles: Array.isArray(p.titles) ? p.titles : [], plays: +p.plays || 0, types: Array.isArray(p.types) ? p.types : [], best: +p.best || 0 }; } } catch (e) { /* 保存なしで続行 */ }
  function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(prog)); } catch (e) { /* 無視 */ } }
  function mergeProg(o) {
    if (!o) return;
    const titles = Array.isArray(o.titles) ? o.titles.filter((t) => typeof t === "string") : [];
    const types = Array.isArray(o.types) ? o.types.filter((t) => typeof t === "string") : [];
    prog.titles = [...new Set(prog.titles.concat(titles))];
    prog.types = [...new Set(prog.types.concat(types))];
    prog.plays = Math.max(prog.plays, +o.plays || 0);
    prog.best = Math.max(prog.best, +o.best || 0);
  }
  function updateTitleCounts() { const t = prog.titles.length + "/" + TITLES.length; $("tcount1").textContent = t; $("tcount2").textContent = t; }
  function openTitles() {
    $("tsum").textContent = "集めた称号 " + prog.titles.length + " / " + TITLES.length + "　あそんだ日数 " + prog.plays + "日";
    $("tgrid").innerHTML = TITLES.map((t) => {
      const got = prog.titles.includes(t.id);
      return '<div class="tcard' + (got ? " got" : "") + '"><strong>' + (got ? esc(t.name) : "？？？") + "</strong><span>" + esc(t.hint) + "</span></div>";
    }).join("");
    $("tmodal").classList.remove("hidden"); $("tclose").focus();
  }
  $("open-titles1").onclick = openTitles; $("open-titles2").onclick = openTitles;
  $("tclose").onclick = () => $("tmodal").classList.add("hidden");
  $("tmodal").addEventListener("click", (e) => { if (e.target.id === "tmodal") $("tmodal").classList.add("hidden"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("tmodal").classList.add("hidden"); });

  function checkTitles(c) {
    const got = [];
    const add = (id, cond) => { if (cond) got.push(id); };
    add("first_day", c.cleared);
    add("legend", c.cleared && c.rank === "S");
    add("rank_a", c.cleared && (c.rank === "S" || c.rank === "A"));
    add("lucky", st.luckW >= 3 && st.luckL === 0);
    add("unlucky", st.luckL >= 3);
    add("survivor", c.cleared && S.h <= 10);
    add("iron", c.cleared && S.h >= 80);
    add("trust_max", c.cleared && S.t >= 100);
    add("f500", S.f - START.f >= 500);
    add("buzz3", st.buzz >= 3);
    add("boss", st.bossWin);
    add("oneshot", st.oneshot);
    add("boss_lose", st.bossLose);
    add("early", c.over === "h");
    add("replaced", c.over === "t");
    add("collector", st.items >= 4);
    add("photographer", st.photos >= 3);
    add("rain", c.cleared && day.id === "rain");
    add("president", c.cleared && day.id === "president" && S.t >= 80);
    add("steady", c.cleared && st.usedLuck === 0);
    add("alltypes", TYPES.every((t) => prog.types.includes(t.id)));
    add("veteran", prog.plays >= 5);
    return got;
  }

  /* ===================== ランキング（共有データ） ===================== */
  let db = null, me = null, uid = null, rankRows = [], rankState = "loading", canWrite = true, myDoc = null;
  let room = null, peersList = [], lastPresence = "", lastNews = "", presenceTick = 0, lastRank = null;
  const NEWS = { buzz: "がバズった！", boss: "がボスを倒した！", rankS: "がランクSをとった！", title: "が新しい称号をゲット！" };
  function sceneName() {
    if (!$("maker").classList.contains("hidden")) return "maker";
    if (!$("end").classList.contains("hidden")) return "end";
    if (battle) return "battle";
    return mapId;
  }
  function pushPresence() {
    if (!room) return;
    const p = { nick: (playerName || "インターン").slice(0, 10), look: lookCopy(), scene: sceneName(), x: player.x, y: player.y, dir: player.dir, mv: player.moving ? 1 : 0, time: curTime, lv: level || 1, rank: lastRank };
    const k = JSON.stringify(p);
    if (k === lastPresence) return;
    lastPresence = k; room.presence(p).catch(() => {});
  }
  function sendNews(kind) {
    if (!room) return;
    room.emit("news", { kind, nick: (playerName || "インターン").slice(0, 10) }).catch(() => {});
  }
  function onNews(m) {
    if (!m || m.isMe) return;
    const d = m.data && typeof m.data === "object" ? m.data : {};
    if (!NEWS[d.kind]) return;
    const msg = String(d.nick || "だれか").slice(0, 10) + "さん" + NEWS[d.kind];
    lastNews = msg; renderOnline();
    if (!$("game").classList.contains("hidden")) toast(msg, 2600);
    sfx("good");
  }
  function peerStatus(pr) {
    const sc = pr.scene;
    if (sc === "maker") return "アバター作成中";
    if (sc === "end") return pr.rank ? "退勤（ランク" + String(pr.rank).slice(0, 1) + "）" : "退勤";
    if (sc === "battle") return "ボス戦中！";
    if (sc === "house") return String(pr.time || "").slice(0, 5) + " モデルハウス";
    if (sc === "office") return String(pr.time || "").slice(0, 5) + " オフィス";
    return "";
  }
  function renderOnline() {
    ["online1", "online2"].forEach((id) => {
      const box = $(id); box.innerHTML = "";
      if (!room || !peersList.length) return;
      const head = document.createElement("span"); head.className = "ol-head";
      head.textContent = "いまオンライン " + peersList.length + "人" + (lastNews ? "　" + lastNews : "");
      box.appendChild(head);
      peersList.slice(0, 12).forEach((p) => {
        const pr = p.presence && typeof p.presence === "object" ? p.presence : {};
        const chip = document.createElement("span"); chip.className = "peer" + (p.isMe && p.sameTab ? " me" : "") + (pr.scene === "battle" ? " boss" : "");
        const img = document.createElement("img"); img.alt = ""; if (W3) img.src = W3.faceURL(safeLook(pr.look));
        const nm = document.createElement("b"); nm.textContent = (p.isMe && p.sameTab ? "あなた" : String(pr.nick || "だれか").slice(0, 10));
        const stx = document.createElement("small"); stx.textContent = peerStatus(pr);
        chip.append(img, nm, stx); box.appendChild(chip);
      });
    });
  }
  function peersForWorld() {
    if (!room || battle) return [];
    const DIRS4 = ["up", "down", "left", "right"];
    return peersList.filter((p) => !p.isMe && p.presence && p.presence.scene === mapId).map((p) => {
      const pr = p.presence;
      const x = Math.max(1, Math.min(14, Math.round(Number(pr.x) || 8))), y = Math.max(2, Math.min(10, Math.round(Number(pr.y) || 9)));
      return { peer: p.peer, nick: String(pr.nick || "だれか").slice(0, 10), look: safeLook(pr.look), x, y, dir: DIRS4.includes(pr.dir) ? pr.dir : "down", moving: !!pr.mv };
    });
  }
  function renderRanking() {
    ["rank1", "rank2"].forEach((cid) => {
      const box = $(cid); box.innerHTML = "";
      if (rankState === "off") { box.innerHTML = '<p class="board-note">ランキングのサーバーにつながっていません。この端末でのベスト：' + fmt(prog.best) + " pt</p>"; return; }
      if (rankState === "loading") { box.innerHTML = '<p class="board-note">ランキングを読み込み中…</p>'; return; }
      if (rankState === "slow") { box.innerHTML = '<p class="board-note">ランキングにまだつながりません。少し待つと表示されます。</p>'; }
      if (!rankRows.length && rankState !== "slow") { box.innerHTML = '<p class="board-note">まだ誰も記録していません。1日を終えると、ここに載ります。一番乗りをめざそう！</p>'; return; }
      const ol = document.createElement("ol"); ol.className = "ranks";
      rankRows.slice(0, 20).forEach((r, i) => {
        const li = document.createElement("li"); if (r.id === uid) li.className = "me";
        const pos = document.createElement("span"); pos.className = "pos"; pos.textContent = i + 1;
        const cv = document.createElement("img"); cv.alt = ""; if (W3) cv.src = W3.faceURL(safeLook(r.look));
        const nm = document.createElement("span"); nm.className = "nm";
        nm.textContent = String(r.nick || "インターン").slice(0, 12);
        const sub = document.createElement("span"); sub.className = "sub";
        const tname = (TYPES.find((t) => t.id === r.type) || {}).name || "";
        sub.textContent = [r.bestRank ? "ランク" + String(r.bestRank).slice(0, 1) : "", tname, "称号 " + (Array.isArray(r.titles) ? r.titles.length : 0)].filter(Boolean).join("・");
        nm.appendChild(sub);
        const pt = document.createElement("span"); pt.className = "pt"; pt.textContent = fmt(+r.best || 0);
        const sm = document.createElement("small"); sm.textContent = (+r.plays || 0) + "日"; pt.appendChild(sm);
        li.append(pos, cv, nm, pt); ol.appendChild(li);
      });
      box.appendChild(ol);
      if (!canWrite) { const p = document.createElement("p"); p.className = "board-note"; p.textContent = "記録の保存に失敗しました。通信状態を確認して、もう一度遊んでみてください。"; box.appendChild(p); }
    });
  }
  async function initShared() {
    if (!(window.claude && typeof window.claude.use === "function")) { rankState = "off"; renderRanking(); $("ai-on").disabled = true; $("ai-note").textContent = "AIモードはclaude.aiで開いたときに使えます"; return; }
    try {
      [db, me, room, sampleFn] = await Promise.all([window.claude.use("db"), window.claude.use("user"), window.claude.use("room"), window.claude.use("sample")]);
      uid = me ? await me.id() : null;
    } catch (e) { db = null; }
    if (sampleFn) { $("ai-on").disabled = false; }
    else { $("ai-on").disabled = true; $("ai-note").textContent = "AIモードはclaude.aiで開いたときに使えます"; }
    if (room) {
      try {
        room.onPeers((ch) => { peersList = ch.peers.slice(); renderOnline(); }, () => { room = null; renderOnline(); });
        room.on("news", onNews, () => {});
        pushPresence();
      } catch (e) { room = null; }
    }
    if (!db || !uid) { rankState = "off"; renderRanking(); return; }
    try { if (me.can) { const w = await me.can("data.write"); if (w === false) canWrite = false; } } catch (e) { /* 不明なら書き込みを試す */ }
    try { const snap = await db.doc("scores/" + uid).get(); if (snap.exists) { myDoc = snap.data(); mergeProg(myDoc); saveLocal(); updateTitleCounts(); buildEquip(); } } catch (e) { /* 無視 */ }
    const timer = setTimeout(() => { if (rankState === "loading") { rankState = "slow"; renderRanking(); } }, 10000);
    db.collection("scores").orderBy("best", "desc").limit(50).onSnapshot((snap) => {
      clearTimeout(timer);
      rankRows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => typeof r.best === "number");
      rankState = "ok"; renderRanking();
    }, () => { clearTimeout(timer); rankState = "off"; renderRanking(); });
  }
  let writing = false;
  async function saveScore(s, rank) {
    if (!db || !uid || !canWrite || writing) return;
    writing = true;
    const prevBest = myDoc && typeof myDoc.best === "number" ? myDoc.best : 0;
    const isBest = s > prevBest;
    const data = {
      nick: (playerName || "インターン").slice(0, 10), look: lookCopy(),
      best: Math.max(prevBest, s), bestRank: isBest ? rank : (myDoc && myDoc.bestRank) || rank,
      type: isBest ? type.id : (myDoc && myDoc.type) || type.id,
      titles: prog.titles, types: prog.types, plays: prog.plays, updatedAt: Date.now()
    };
    try { await db.doc("scores/" + uid).set(data); myDoc = data; }
    catch (e) { if (e && e.code === "invalid_argument") { canWrite = false; renderRanking(); } }
    writing = false;
  }

  /* ===================== 結果 ===================== */
  function ending(over) {
    if (ended) return; ended = true;
    playBgm(null);
    const s = scoreOf(S);
    const r = RANKS.find((x) => s >= x.min);
    let rank = r.rank, title = r.name, note = r.note;
    if (over === "h") { rank = "×"; title = "体力切れで早退"; note = "がんばりすぎて電池切れ。休むのも仕事のうち。今度はペース配分を意識しよう。"; }
    if (over === "t") { rank = "×"; title = "担当交代…"; note = "クライアントの信頼がゼロに。報連相と丁寧な対応が逆転のカギ。"; }
    const cleared = !over;
    prog.plays++;
    if (cleared && !prog.types.includes(type.id)) prog.types.push(type.id);
    if (rank !== "×") prog.best = Math.max(prog.best, s);
    const got = checkTitles({ cleared, over, rank });
    const fresh = got.filter((id) => !prog.titles.includes(id));
    prog.titles = [...new Set(prog.titles.concat(got))];
    saveLocal(); updateTitleCounts(); buildEquip();
    lastRank = rank === "×" ? null : rank;
    if (rank === "S") sendNews("rankS"); else if (fresh.length) sendNews("title");
    if (rank !== "×") saveScore(s, rank); else saveScore(0, "C");
    if (cleared) sfx(st.bossWin ? "level" : "good");

    const gain = S.f - START.f;
    const nm = playerName || "インターン";
    const bossLine = st.bossWin ? "ボス撃破" : st.bossLose ? "ボスに敗北" : "";
    const shareText = "【インターン生の1日】" + nm + "（" + type.name + "・Lv." + level + "・" + day.name + "）" +
      (rank === "×" ? title : "ランク" + rank + "「" + title + "」") + (bossLine ? "・" + bossLine : "") +
      "\nスコア " + fmt(s) + "／フォロワー " + (gain >= 0 ? "+" : "") + fmt(gain) + "・信頼 " + S.t + "・体力 " + S.h +
      "\n称号 " + prog.titles.length + "/" + TITLES.length;
    const end = $("end");
    end.innerHTML =
      '<div class="eyebrow">' + (over ? "ゲームオーバー" : "18:00　おつかれさま！") + "　" + esc(day.name) + (aiUsed ? '<span class="ai-badge">AIの出来事</span>' : "") + "</div>" +
      '<div class="end-top" style="margin-top:10px"><img id="endc" alt="あなたのアバター"><div>' +
      '<div class="rank">' + rank + '</div><div class="end-title">' + esc(title) + "</div>" +
      '<div class="score">' + esc(nm) + "　Lv." + level + "　" + fmt(s) + " pt</div></div></div>" +
      '<p style="margin:14px 0 6px">' + note + "</p>" +
      '<div class="chips">' + chip("フォロワー", gain) + '<span class="chip zero">信頼 ' + S.t + '</span><span class="chip zero">体力 ' + S.h + '</span><span class="chip zero">' + type.name + "</span>" +
      (bossLine ? '<span class="chip ' + (st.bossWin ? "up" : "down") + '">' + bossLine + "</span>" : "") +
      (st.buzz ? '<span class="chip up">バズ ' + st.buzz + "回</span>" : "") + "</div>" +
      '<p class="lead" style="font-size:13px;margin-top:8px">スコア＝増えたフォロワー＋信頼×4＋体力×2</p>' +
      (fresh.length ? '<div class="newtitles"><b>新しい称号をゲット！</b><div>' + fresh.map((id) => '<span class="tchip">' + esc(TITLES.find((t) => t.id === id).name) + "</span>").join("") + "</div>" +
        (ACCESSORIES.some((a) => fresh.includes(a.title)) ? '<p style="margin:8px 0 0;font-size:14px">装備が解放されました：' + ACCESSORIES.filter((a) => fresh.includes(a.title)).map((a) => esc(a.name)).join("、") + "　「アバターを変える」から着られます</p>" : "") + "</div>" : "") +
      "<h3>今日の選択</h3><ul class=\"log\">" + log.map((l) => "<li><time>" + l.time + "</time><span>" + esc(l.title) + " → <strong>" + esc(l.pick) + "</strong></span></li>").join("") +
      (bossLine ? "<li><time>17:30</time><span>ボス戦 → <strong>" + bossLine + "</strong></span></li>" : "") + "</ul>" +
      '<div class="btn-row4"><button class="secondary" id="copy">結果をコピー</button><button class="secondary" id="remake">アバターを変える</button></div>' +
      '<button class="primary" id="again">もう1日やる</button>' +
      '<div class="copy-msg" id="copymsg"></div><textarea id="share" class="hidden" rows="4" readonly></textarea>';
    $("game").classList.add("hidden"); end.classList.remove("hidden"); $("board2").classList.remove("hidden");
    renderRanking();
    if (W3) $("endc").src = W3.avatarURL(lookCopy());
    window.scrollTo({ top: 0, behavior: "smooth" });
    battle = null; if (W3) W3.endBattle(); renderBHud();
    $("again").onclick = startGame;
    $("remake").onclick = () => { buildEquip(); renderPreview(); end.classList.add("hidden"); $("board2").classList.add("hidden"); $("maker").classList.remove("hidden"); $("board1").classList.remove("hidden"); window.scrollTo({ top: 0 }); };
    $("copy").onclick = async () => {
      try { await navigator.clipboard.writeText(shareText); $("copymsg").textContent = "コピーしました。チャットに貼り付けて比べてみてください。"; }
      catch (e) { const ta = $("share"); ta.value = shareText; ta.classList.remove("hidden"); ta.select(); $("copymsg").textContent = "自動でコピーできなかったので、下の文章を選んでコピーしてください。"; }
    };
  }

  window.__game = window.__game || {};
  Object.assign(window.__game, {
    spots: () => (active || []).filter((e) => mapId === "office" || e.spot === "door").map((e) => cur().spots[spotOf(e)].tiles[0]),
    map: () => mapId, battle: () => !!battle, tapSpot: (id) => tapSpot(id), tapTo: (x, y) => tapTo(x, y),
    activeSpots: () => (active || []).filter((e) => mapId === "office" || e.spot === "door").map((e) => spotOf(e))
  });
  if (W3) {
    try { W3.init($("map")); preview = W3.createPreview($("pv")); }
    catch (e) { console.error(e); }
  }
  if (!W3) { $("go").disabled = true; $("go").textContent = "3Dを読み込めませんでした。再読み込みしてください"; }
  buildMaker();
  buildEquip();
  $("ai-on").disabled = true;
  $("ai-on").onclick = () => { setAiMode(true); sfx("blip"); };
  $("ai-off").onclick = () => { setAiMode(false); sfx("blip"); };
  updateTitleCounts();
  renderRanking();
  $("go").addEventListener("click", startGame);
  if (W3) { mapId = "office"; rebuildWorld(); }
  requestAnimationFrame(loop);
  initShared();
})();
