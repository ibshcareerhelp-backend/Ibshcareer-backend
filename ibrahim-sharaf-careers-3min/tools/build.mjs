// Builds index.html + compositions/*.html for the 30 s "Ibrahim Sharaf Careers" advert.
//   node tools/build.mjs        (needs tools/schedule.json from tools/voice.py)
// If assets/img/presenter.png|jpg exists it is shown as the presenter portrait in scenes 1 and 4.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1920, H = 1080, TOTAL = 180;
const sched = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/schedule.json"), "utf8"));
const presenter = ["assets/img/presenter.png", "assets/img/presenter.jpg"].find((f) => fs.existsSync(path.join(ROOT, f)));
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const line = (id) => sched.find((s) => s.id === id);

// scene plan: each scene starts 0.5 s before its first narration line and runs to the next scene
const PLAN = [
  ["s1", ["l1", "l2"]], ["s2", ["l3", "l4", "l5"]], ["s3", ["l6"]], ["s4", ["l7"]], ["s5", ["l8"]], ["s6", ["l9"]],
  ["s7", ["l10"]], ["s8", ["l11", "l12", "l12b"]], ["s9", ["l13a", "l13"]], ["s10", ["l13b", "l14", "l15", "l16"]], ["s11", ["l17"]],
];
const SCENES = PLAN.map(([id, ls], i) => ({ id, ls, start: i === 0 ? 0 : r2(line(ls[0]).start - 0.5) }));
SCENES.forEach((s, i) => { s.end = i < SCENES.length - 1 ? SCENES[i + 1].start : TOTAL; });
const S = (id) => SCENES.find((s) => s.id === id);
const lt = (id, g) => r2(g - S(id).start);                       // global time -> scene-local time
const cue = (lineId, word, of) => { const l = line(lineId); return l.start + (l.dur * word) / of; };  // time of the Nth word of a line


// ---------- shared look ----------
const NAVY = "#1a4fd6", GOLD = "#f26b0f", GOLD_L = "#ff9d4d";
function skyline() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let x = 0, out = "";
  while (x < W) {
    const w = 70 + Math.floor(rnd() * 110), h = 160 + Math.floor(rnd() * 330);
    out += `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="#071a33" opacity="0.92"/>`;
    for (let wy = H - h + 24; wy < H - 24; wy += 34)
      for (let wx = x + 12; wx < x + w - 14; wx += 26)
        if (rnd() > 0.72) out += `<rect x="${wx}" y="${wy}" width="10" height="16" fill="${GOLD_L}" opacity="${(0.25 + rnd() * 0.45).toFixed(2)}"/>`;
    x += w + 6 + Math.floor(rnd() * 14);
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${out}</svg>`;
}
const LOGO = (size) => `<img src="assets/img/logo-mark.png" alt="" style="height:${size}px;width:auto;display:block" />`;

const css = `
  #root { position: absolute; inset: 0; overflow: hidden; background: #ffffff; font-family: "Inter", sans-serif; color: #1a4fd6; }
  #wrap { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: linear-gradient(160deg, #ffffff 0%, #f6f9fd 60%, #eaf0f8 100%); }
  #bgpan { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  .glow { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: radial-gradient(ellipse at 78% 30%, rgba(242,107,15,0.20) 0%, rgba(242,107,15,0) 55%); }
  .vig { display: none; }
  .brand { position: absolute; left: 90px; top: 62px; display: flex; align-items: center; gap: 18px; }
  .brand span { font: 700 22px "Inter"; letter-spacing: 0.32em; color: ${NAVY}; }
  .abs { position: absolute; }
  .gold { background: linear-gradient(180deg, #2f6bf5 0%, #1a4fd6 55%, #0f3399 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .serif { font-family: "Playfair Display", serif; }
  .eyebrow { font: 700 26px "Inter"; letter-spacing: 0.4em; text-transform: uppercase; color: #e0560a; }
  .rule { height: 3px; background: ${GOLD}; transform-origin: 0% 50%; }
  .w { display: inline-block; white-space: pre; }
`;

function shell(sid, body, script, extraCss = "", panFrom = 1.0, panTo = 1.07) {
  return `<template>
  <style>${css}${extraCss}
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${W}" data-height="${H}">
    <div id="wrap">
      <div id="bgpan"><div style="position:absolute;left:90px;right:90px;top:128px;height:2px;background:linear-gradient(90deg,#f26b0f,rgba(242,107,15,0))"></div><div style="position:absolute;left:90px;right:90px;bottom:34px;height:2px;background:linear-gradient(270deg,#f26b0f,rgba(242,107,15,0))"></div></div>
      <div class="vig"></div>
      <div class="brand"><div>${LOGO(54)}</div><span>IBRAHIM SHARAF CAREERS</span></div>
      ${body}
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#bgpan", { scale: ${panFrom}, transformOrigin: "50% 100%" }, { scale: ${panTo}, duration: ${SCENES.find((s) => s.id === sid).end - SCENES.find((s) => s.id === sid).start + 0.5}, ease: "none" }, 0);
    ${sid === "s1" ? "" : `tl.fromTo("#wrap", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.inOut" }, 0);`}
    ${script}
    window.__timelines["${sid}"] = tl;
  </script>
</template>
`;
}

const words = (id, text, cls = "") => text.split(" ").map((w, i, a) => `<span id="${id}-${i}" class="w ${cls}">${esc(w)}${i < a.length - 1 ? " " : ""}</span>`).join("");
const wordTw = (id, n, at, gap = 0.1, dur = 0.45) => Array.from({ length: n }, (_, i) =>
  `tl.fromTo("#${id}-${i}", { opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "blur(0px)", duration: ${dur}, ease: "power3.out" }, ${r2(at + i * gap)});`).join("\n    ");

// presenter portrait card (only when a portrait file exists) or the rising-steps graphic
function hero(id, at, dur = 5) {
  if (presenter)
    return {
      html: `<div id="${id}" class="abs" style="left:1090px;top:190px;width:700px;height:700px;border-radius:26px;overflow:hidden;border:3px solid ${GOLD};box-shadow:0 24px 56px rgba(26,79,214,0.22)"><img id="${id}-img" src="${presenter}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:50% 50%" /></div>`,
      js: `tl.fromTo("#${id}", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.9, ease: "expo.out" }, ${at});
    tl.fromTo("#${id}-img", { scale: 1.0 }, { scale: 1.03, duration: ${dur}, ease: "none" }, ${at});`,
    };
  const bars = [0, 1, 2, 3, 4].map((i) => `<div id="${id}-b${i}" class="abs" style="left:${1130 + i * 130}px;bottom:${150}px;width:96px;height:${150 + i * 130}px;border-radius:10px 10px 0 0;background:linear-gradient(180deg,${GOLD_L},${GOLD} 60%,#c2500a);transform-origin:50% 100%"></div>`).join("");
  return {
    html: `${bars}<svg id="${id}-arrow" class="abs" style="left:1090px;top:230px" width="720" height="560" viewBox="0 0 720 560"><path id="${id}-p" d="M20 520 C 200 470, 360 330, 640 70" fill="none" stroke="${NAVY}" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="100 120" stroke-dashoffset="110"/><path id="${id}-h" d="M575 62 L650 52 L630 128" fill="none" stroke="${NAVY}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`,
    js: `${[0, 1, 2, 3, 4].map((i) => `tl.fromTo("#${id}-b${i}", { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: "expo.out" }, ${r2(at + 0.15 * i)});`).join("\n    ")}
    tl.fromTo("#${id}-p", { strokeDashoffset: 110 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" }, ${r2(at + 0.7)});
    tl.fromTo("#${id}-h", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, ${r2(at + 1.95)});`,
  };
}

// ---------- scenes ----------
const out = {};
const CLIPLEN = { him: 9.33, hands: 9.33, laptop: 11.2, laptop2: 7.2, docs: 7.43, team1: 5.5, team2: 8.0, team3: 3.9, team4: 6.0 };

const chip = (id, text, top = 196) => `<div id="${id}" class="abs eyebrow" style="left:150px;top:${top}px">${esc(text)}</div>`;
const fade = (id, at, y = 0) => `tl.fromTo("#${id}", { opacity: 0${y ? `, y: ${y}` : ""} }, { opacity: 1${y ? ", y: 0" : ""}, duration: 0.7, ease: "expo.out" }, ${at});`;
const bullets = (sid, items, top = 340) => ({
  html: items.map(([text], i) => `<div id="${sid}-bu${i}" class="abs" style="left:150px;top:${top + i * 112}px;width:800px;display:flex;align-items:center;gap:22px"><div style="flex:none;width:16px;height:16px;border-radius:50%;background:${GOLD}"></div><div class="serif" style="font-size:46px;font-weight:700;line-height:1.15">${esc(text)}</div></div>`).join(""),
  js: items.map(([, g], i) => fade(`${sid}-bu${i}`, lt(sid, g), 40)).join("\n    "),
});
// a framed video: the wrapper is animated, the <video> carries the timing. `crop` > 1 zooms in on the top-left of the frame (hides the right edge).
function vcard(id, clip, g0, g1, o = {}) {
  const { left = 1000, top = 250, w = 780, h = 439, media = 0, crop = 1, sid } = o;
  const len = r2(g1 - g0), avail = CLIPLEN[clip] - media;
  const rate = Math.floor(Math.max(0.5, Math.min(1, avail / len)) * 100) / 100;
  const vdur = Math.floor(Math.min(len, avail / rate - 0.15) * 100) / 100; // stays inside the source file
  const at = lt(sid, g0);
  return {
    html: `<div id="${id}" class="abs" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;border-radius:20px;overflow:hidden;border:3px solid ${GOLD};box-shadow:0 24px 56px rgba(26,79,214,0.22);opacity:0"><video id="${id}-v" class="clip" src="assets/video/${clip}.mp4" muted playsinline data-start="${at}" data-duration="${vdur}" data-media-start="${media}" data-playback-rate="${r2(rate)}" data-track-index="2" style="position:absolute;left:0;top:0;width:${crop * 100}%;height:${crop * 100}%;object-fit:cover"></video></div>`,
    js: `tl.fromTo("#${id}", { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.7, ease: "expo.out" }, ${at});`
      + (o.keep ? "" : `\n    tl.to("#${id}", { opacity: 0, duration: 0.4, ease: "power2.in" }, ${r2(at + len - 0.45)});`),
  };
}
function steps(id, at) {
  const bars = [0, 1, 2, 3, 4].map((i) => `<div id="${id}-b${i}" class="abs" style="left:${1130 + i * 120}px;top:${760 - (150 + i * 105)}px;width:88px;height:${150 + i * 105}px;border-radius:10px 10px 0 0;background:linear-gradient(180deg,${GOLD_L},${GOLD} 60%,#c2500a);transform-origin:50% 100%"></div>`).join("");
  return { html: bars, js: [0, 1, 2, 3, 4].map((i) => `tl.fromTo("#${id}-b${i}", { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: "expo.out" }, ${r2(at + 0.18 * i)});`).join("\n    ") };
}
const icons = {
  cv: `<rect x="14" y="6" width="44" height="60" rx="5" fill="none" stroke="${GOLD}" stroke-width="3.5"/><path d="M24 24 H48 M24 36 H48 M24 48 H40" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round"/>`,
  brief: `<rect x="8" y="20" width="56" height="40" rx="6" fill="none" stroke="${GOLD}" stroke-width="3.5"/><path d="M26 20 V12 H46 V20 M8 38 H64" fill="none" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round"/>`,
  goal: `<circle cx="34" cy="38" r="26" fill="none" stroke="${GOLD}" stroke-width="3.5"/><circle cx="34" cy="38" r="14" fill="none" stroke="${GOLD}" stroke-width="3.5"/><path d="M34 38 L62 8 M50 8 H62 V20" fill="none" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  bars: `<path d="M12 60 V40 M30 60 V26 M48 60 V14" stroke="${GOLD}" stroke-width="9" stroke-linecap="round"/><path d="M8 34 L30 18 L50 28 L66 8" fill="none" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
};

// S1 hook
{
  const h = hero("s1h", 0.2, S("s1").end);
  out.s1 = shell("s1", `
      ${h.html}
      ${chip("s1-eyebrow", "Welcome", 300)}
      <div class="abs serif" style="left:150px;top:350px;width:880px;font-size:104px;font-weight:700;line-height:1.08">${words("s1-t", "Your Next Career Move Starts Here.")}</div>
      <div id="s1-rule" class="abs rule" style="left:154px;top:800px;width:420px"></div>`,
    `tl.fromTo("#s1-eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.3);
    ${wordTw("s1-t", 6, 0.5, 0.14, 0.5)}
    tl.fromTo("#s1-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, 1.5);
    ${h.js}`, "", 1.0, 1.06);
}

// S2 the challenge: three of your own clips, three phrases
{
  const s = S("s2"), g4 = line("l4").start - 0.3, g5 = line("l5").start - 0.3;
  const v1 = vcard("s2c1", "him", s.start + 0.4, g4, { sid: "s2" });
  const v2 = vcard("s2c2", "hands", g4, g5, { sid: "s2" });
  const v3 = vcard("s2c3", "laptop", g5, s.end - 0.1, { sid: "s2", keep: true });
  const ph = [["The challenge", "A fast-moving job market.", s.start + 0.5, g4 - 0.6], ["The challenge", "Skills that deserve to be seen.", g4 + 0.2, g5 - 0.6], ["The answer", "The right guidance makes the difference.", g5 + 0.2, s.end - 0.2]];
  out.s2 = shell("s2", `${v1.html}${v2.html}${v3.html}
      ${ph.map(([e, t], i) => `<div id="s2-p${i}" class="abs" style="left:150px;top:330px;width:780px;opacity:0"><div class="eyebrow" style="margin-bottom:26px">${esc(e)}</div><div class="serif" style="font-size:78px;font-weight:700;line-height:1.14">${esc(t)}</div></div>`).join("")}`,
    `${v1.js}\n    ${v2.js}\n    ${v3.js}
    ${ph.map(([, , a, b], i) => `tl.fromTo("#s2-p${i}", { opacity: 0, y: 40, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${lt("s2", a)});${i < 2 ? `\n    tl.to("#s2-p${i}", { opacity: 0, duration: 0.4, ease: "power2.in" }, ${lt("s2", b)});` : ""}`).join("\n    ")}`, "", 1.0, 1.05);
}

// S3 the four services, in the order the narration names them
{
  const tiles = [["cv", "CV Development", 7], ["goal", "Opportunity Support", 10], ["bars", "Career Positioning", 13], ["brief", "Recruitment Support", 18]];
  out.s3 = shell("s3", `${chip("s3-eyebrow", "What we do")}
      ${tiles.map(([k, label], i) => `<div id="s3-c${i}" class="abs" style="left:${150 + i * 420}px;top:290px;width:380px;height:380px;border-radius:22px;background:#ffffff;border:2px solid rgba(242,107,15,0.7);box-shadow:0 18px 44px rgba(26,79,214,0.14)"><svg style="position:absolute;left:150px;top:80px" width="80" height="80" viewBox="0 0 72 72">${icons[k]}</svg><div class="serif" style="position:absolute;left:0;right:0;top:215px;text-align:center;font-size:40px;font-weight:700;line-height:1.2;padding:0 30px">${esc(label)}</div></div>`).join("")}
      <div id="s3-bar" class="abs" style="left:150px;top:760px;width:1620px;height:92px;border-radius:46px;background:linear-gradient(90deg,${GOLD},${GOLD_L});display:flex;align-items:center;justify-content:center;font:700 38px Inter;color:#ffffff;letter-spacing:0.04em;white-space:nowrap">Career Strategy &nbsp;|&nbsp; CV Positioning &nbsp;|&nbsp; Opportunity Support</div>`,
    `${fade("s3-eyebrow", 0.4)}
    ${tiles.map(([, , w], i) => fade(`s3-c${i}`, lt("s3", cue("l6", w, 24)), 60)).join("\n    ")}
    tl.fromTo("#s3-bar", { opacity: 0, y: 30, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "expo.out" }, ${lt("s3", cue("l6", 20, 24))});`, "", 1.0, 1.05);
}

// S4 CV development: an animated CV + three phrases
{
  const b = bullets("s4", [["Clear presentation of your experience", cue("l7", 20, 34)], ["The right focus for the role", cue("l7", 23, 34)], ["Impact that gets you noticed", cue("l7", 27, 34)]], 520);
  const cv = `<div id="s4-cv" class="abs" style="left:1130px;top:200px;width:480px;height:620px;border-radius:16px;background:#f7f4ec;box-shadow:0 24px 56px rgba(26,79,214,0.22);padding:50px 44px"><div style="width:84px;height:84px;border-radius:50%;background:${NAVY}"></div><div style="height:20px;width:240px;margin:-62px 0 0 112px;background:${NAVY};border-radius:4px"></div><div style="height:12px;width:160px;margin:16px 0 0 112px;background:${GOLD};border-radius:4px"></div>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<div id="s4-l${i}" style="height:12px;width:${i % 3 === 2 ? 250 : 390}px;margin-top:${i === 0 ? 60 : 26}px;background:#c9ced8;border-radius:4px;transform-origin:0% 50%"></div>`).join("")}<div id="s4-chk" style="position:absolute;right:-30px;top:-30px;width:84px;height:84px;border-radius:50%;background:${GOLD};display:flex;align-items:center;justify-content:center"><svg width="42" height="42" viewBox="0 0 34 34"><path d="M6 18 L14 26 L29 8" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>`;
  out.s4 = shell("s4", `${chip("s4-eyebrow", "01 · CV Development", 270)}
      <div id="s4-h" class="abs serif" style="left:150px;top:310px;width:900px;font-size:66px;font-weight:700;line-height:1.1">Your first impression.</div>${b.html}${cv}`,
    `${fade("s4-eyebrow", lt("s4", cue("l7", 1, 34)))}
    ${fade("s4-h", lt("s4", cue("l7", 3, 34)), 40)}
    ${b.js}
    tl.fromTo("#s4-cv", { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" }, ${lt("s4", cue("l7", 3, 34))});
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `tl.fromTo("#s4-l${i}", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, ${lt("s4", cue("l7", 16 + i * 1.6, 34))});`).join("\n    ")}
    tl.fromTo("#s4-chk", { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(1.6)" }, ${lt("s4", cue("l7", 29, 34))});`, "", 1.0, 1.05);
}

// S5 career positioning
{
  const b = bullets("s5", [["Know where you stand", cue("l8", 6, 28)], ["Present your strengths", cue("l8", 14, 28)], ["Match the roles you want", cue("l8", 22, 28)]], 520);
  const st = steps("s5g", lt("s5", cue("l8", 4, 28)));
  out.s5 = shell("s5", `${chip("s5-eyebrow", "02 · Career Positioning", 270)}
      <div id="s5-h" class="abs serif" style="left:150px;top:310px;width:900px;font-size:66px;font-weight:700;line-height:1.1">Where you stand in the market.</div>${b.html}${st.html}
      <svg class="abs" style="left:1090px;top:170px" width="720" height="560" viewBox="0 0 720 560"><path id="s5-p" d="M20 520 C 200 470, 360 330, 640 70" fill="none" stroke="${NAVY}" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="100 120" stroke-dashoffset="110"/><path id="s5-hd" d="M575 62 L650 52 L630 128" fill="none" stroke="${NAVY}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`,
    `${fade("s5-eyebrow", lt("s5", cue("l8", 1, 28)))}
    ${fade("s5-h", lt("s5", cue("l8", 3, 28)), 40)}
    ${b.js}
    ${st.js}
    tl.fromTo("#s5-p", { strokeDashoffset: 110 }, { strokeDashoffset: 0, duration: 2.0, ease: "power2.inOut" }, ${lt("s5", cue("l8", 10, 28))});
    tl.fromTo("#s5-hd", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, ${r2(lt("s5", cue("l8", 10, 28)) + 1.9)});`, "", 1.0, 1.05);
}

// S6 opportunity support: your laptop clip
{
  const s = S("s6");
  const b = bullets("s6", [["Roles that fit your goals", cue("l9", 6, 24)], ["Time spent where it matters", cue("l9", 14, 24)]], 520);
  const v = vcard("s6c", "laptop2", s.start + 0.6, s.end - 0.1, { sid: "s6", keep: true });
  out.s6 = shell("s6", `${chip("s6-eyebrow", "03 · Opportunity Support", 270)}
      <div id="s6-h" class="abs serif" style="left:150px;top:310px;width:820px;font-size:66px;font-weight:700;line-height:1.1">Opportunities that truly matter.</div>${b.html}${v.html}`,
    `${fade("s6-eyebrow", lt("s6", cue("l9", 1, 24)))}
    ${fade("s6-h", lt("s6", cue("l9", 3, 24)), 40)}
    ${b.js}
    ${v.js}`, "", 1.0, 1.05);
}

// S7 recruitment and interview readiness: documents close-up, hands cropped out
{
  const s = S("s7");
  const b = bullets("s7", [["From the first application", cue("l10", 6, 26)], ["To the final conversation", cue("l10", 10, 26)], ["Ready for every stage", cue("l10", 18, 26)]], 520);
  const v = vcard("s7c", "docs", s.start, s.end - 0.1, { sid: "s7", crop: 1.3, keep: true });
  out.s7 = shell("s7", `${chip("s7-eyebrow", "04 · Recruitment & Interviews", 270)}
      <div id="s7-h" class="abs serif" style="left:150px;top:310px;width:820px;font-size:66px;font-weight:700;line-height:1.1">Prepared at every stage.</div>${b.html}${v.html}`,
    `${fade("s7-eyebrow", lt("s7", cue("l10", 1, 26)))}
    ${fade("s7-h", lt("s7", cue("l10", 6, 26)), 40)}
    ${b.js}
    ${v.js}`, "", 1.0, 1.05);
}

// S8 who we support: your team footage plays at normal speed on the right, then your portrait
{
  const s8 = S("s8");
  const rows = [["Leadership positions", cue("l11", 4, 20)], ["New career opportunities", cue("l11", 10, 20)], ["Ambitious professionals", line("l12").start + 0.6], ["Every stage of your career", cue("l12b", 4, 29)]];
  const seq = [["team1", 5.4], ["team2", 7.0], ["team3", 3.8], ["team4", 5.9]];
  let t = s8.start;
  const vs = seq.map(([c, len], i) => { const v = vcard(`s8c${i}`, c, r2(t), r2(t + len), { sid: "s8" }); t += len; return v; });
  const hp = hero("s8h", lt("s8", t + 0.2), r2(s8.end - t));
  out.s8 = shell("s8", `${vs.map((v) => v.html).join("")}${hp.html}${chip("s8-eyebrow", "Who we support", 270)}
      ${rows.map(([t2], i) => `<div id="s8-r${i}" class="abs serif" style="left:150px;top:${340 + i * 130}px;width:800px;font-size:60px;font-weight:700;display:flex;align-items:center;gap:24px"><div style="flex:none;width:16px;height:16px;border-radius:50%;background:${GOLD}"></div>${esc(t2)}</div>`).join("")}`,
    `${fade("s8-eyebrow", 0.6)}
    ${rows.map(([, g], i) => fade(`s8-r${i}`, lt("s8", g), 40)).join("\n    ")}
    ${vs.map((v) => v.js).join("\n    ")}
    ${hp.js}`, "", 1.0, 1.05);
}

// S9 why it matters, then the four-step approach
{
  const st = [["01", "Listen to your goals", 4], ["02", "Strengthen how you present yourself", 9], ["03", "Find the right opportunities", 15], ["04", "Support you through the process", 22]];
  const t13 = line("l13").start;
  out.s9 = shell("s9", `${chip("s9-eyebrow", "Our approach", 230)}
      <div id="s9-q" class="abs serif" style="left:150px;top:330px;width:1500px;font-size:92px;font-weight:700;line-height:1.14">A strong career is not built by chance.</div>
      ${st.map(([n, t], i) => `<div id="s9-s${i}" class="abs" style="left:${150 + i * 420}px;top:340px;width:380px;height:420px;border-radius:22px;background:#ffffff;border:2px solid rgba(242,107,15,0.7);box-shadow:0 18px 44px rgba(26,79,214,0.14);padding:40px 34px;opacity:0"><div class="serif gold" style="font-size:80px;font-weight:700">${n}</div><div class="serif" style="font-size:42px;font-weight:700;line-height:1.2;margin-top:24px">${esc(t)}</div></div>`).join("")}`,
    `${fade("s9-eyebrow", 0.5)}
    tl.fromTo("#s9-q", { opacity: 0, y: 40, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, ${lt("s9", line("l13a").start)});
    tl.to("#s9-q", { opacity: 0, duration: 0.5, ease: "power2.in" }, ${lt("s9", t13 - 0.3)});
    ${st.map(([, , w], i) => fade(`s9-s${i}`, lt("s9", cue("l13", w, 29)), 60)).join("\n    ")}`, "", 1.0, 1.05);
}

// S10 closing message
{
  const h = hero("s10h", 0.4, S("s10").end - S("s10").start);
  const ph = [["Every professional has a story worth telling.", line("l13b").start], ["You do not have to move forward alone.", line("l15").start + 0.4], ["Let's move your career forward.", line("l16").start - 0.1]];
  out.s10 = shell("s10", `${h.html}
      <div id="s10-name" class="abs" style="left:150px;top:250px;opacity:0"><div class="eyebrow">Ibrahim Sharaf</div><div style="font:400 30px Inter;color:#4b5a7a;letter-spacing:0.04em;margin-top:10px">Ibrahim Sharaf Careers</div></div>
      ${ph.map(([t], i) => `<div id="s10-p${i}" class="abs serif" style="left:150px;top:420px;width:880px;font-size:${i === 2 ? 100 : 82}px;font-weight:700;line-height:1.12;opacity:0">${esc(t)}</div>`).join("")}`,
    `${fade("s10-name", lt("s10", line("l14").start - 0.2), 20)}
    ${ph.map(([, g], i) => `tl.fromTo("#s10-p${i}", { opacity: 0, y: 40, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "expo.out" }, ${lt("s10", g)});${i < 2 ? `\n    tl.to("#s10-p${i}", { opacity: 0, duration: 0.4, ease: "power2.in" }, ${lt("s10", ph[i + 1][1] - 0.5)});` : ""}`).join("\n    ")}
    ${h.js}`, "", 1.0, 1.05);
}

// S11 end card
{
  out.s11 = shell("s11", `
      <div class="abs" style="left:0;top:0;width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center" data-hold>
        <div id="s11-logo">${LOGO(170)}</div>
        <div id="s11-name" class="serif gold" style="font-size:104px;font-weight:700;letter-spacing:0.05em;margin-top:22px">IBRAHIM SHARAF CAREERS</div>
        <div id="s11-tag" style="font:700 34px Inter;color:${NAVY};letter-spacing:0.42em;text-transform:uppercase;margin:18px 0 0 0.42em">Achieve. Advance. Succeed.</div>
        <div id="s11-rule" class="rule" style="width:300px;margin:38px 0 36px;transform-origin:50% 50%"></div>
        <div id="s11-web" style="display:flex;align-items:center;gap:20px;font:700 56px Inter;color:#e0560a;letter-spacing:0.02em"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="23" fill="none" stroke="${GOLD}" stroke-width="3"/><ellipse cx="28" cy="28" rx="10" ry="23" fill="none" stroke="${GOLD}" stroke-width="3"/><path d="M5 28 H51 M9 15 H47 M9 41 H47" stroke="${GOLD}" stroke-width="3" fill="none"/></svg>ibrahimsharafcareers.site</div>
        <div id="s11-cta" style="font:400 34px Inter;color:#4b5a7a;margin-top:30px;letter-spacing:0.03em">Take the next step in your career.</div>
      </div>`,
    `tl.fromTo("#s11-logo", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, 0.3);
    tl.fromTo("#s11-name", { opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.8, ease: "power3.out" }, 0.55);
    tl.fromTo("#s11-tag", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, 1.0);
    tl.fromTo("#s11-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.out" }, 1.3);
    tl.fromTo("#s11-web", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, 1.5);
    tl.fromTo("#s11-cta", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.out" }, 2.1);`, "", 1.0, 1.03);
}
fs.writeFileSync(path.join(ROOT, "tools/scenes.json"), JSON.stringify(SCENES.map(({ id, start, end }) => ({ id, start, end })), null, 1));

// ---------- subtitles ----------
function chunks(text) {
  const w = text.split(" ");
  const n = Math.ceil(w.length / 7);
  const per = Math.ceil(w.length / n);
  const res = [];
  for (let i = 0; i < w.length; i += per) res.push(w.slice(i, i + per).join(" "));
  return res;
}
const caps = [];
for (const l of sched) {
  const parts = chunks(l.show);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let t = l.start;
  parts.forEach((p, i) => {
    const d = (l.dur * p.length) / total;
    const s = r2(Math.max(0.05, t - 0.05));
    const e = r2(i === parts.length - 1 ? t + d + 0.25 : t + d - 0.02);
    caps.push({ text: p, start: s, end: Math.min(TOTAL, e) });
    t += d;
  });
}
const capHtml = `<template>
  <style>
    #root { position: absolute; inset: 0; }
    .cap { position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; overflow: visible; }
    .cap-t { display: inline-block; font: 700 40px "Inter", sans-serif; color: #fffaf0; line-height: 1.25; padding: 8px 24px 10px; border-radius: 8px; background: rgba(4, 14, 30, 0.62); text-shadow: 0 2px 8px rgba(0,0,0,0.6); }
  </style>
  <div id="root" data-composition-id="captions" data-width="${W}" data-height="${H}">
    ${caps.map((c, i) => `<div id="cap-${i}" class="clip cap" data-start="${c.start}" data-duration="${r2(c.end - c.start)}" data-track-index="3"><span id="cap-${i}-t" class="cap-t">${esc(c.text)}</span></div>`).join("\n    ")}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${caps.map((c, i) => `tl.fromTo("#cap-${i}-t", { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "power2.out" }, ${c.start});\n    tl.to("#cap-${i}-t", { opacity: 0, duration: 0.12, ease: "power2.in" }, ${r2(c.end - 0.12)});`).join("\n    ")}
    window.__timelines["captions"] = tl;
  </script>
</template>
`;

// ---------- write ----------
fs.mkdirSync(path.join(ROOT, "compositions"), { recursive: true });
for (const s of SCENES) fs.writeFileSync(path.join(ROOT, `compositions/${s.id}.html`), out[s.id]);
fs.writeFileSync(path.join(ROOT, "compositions/captions.html"), capHtml);
const hosts = SCENES.map((s, i) => `<div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${r2(s.end - s.start + (i < SCENES.length - 1 ? 0.5 : 0))}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:${i + 1}"></div>`);
fs.writeFileSync(path.join(ROOT, "index.html"), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>Ibrahim Sharaf Careers</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #main { position: relative; width: 100%; height: 100%; background: #071a33; }
    </style>
  </head>
  <body>
    <div id="main" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
      ${hosts.join("\n      ")}
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${TOTAL}" data-track-index="3" data-track-kind="captions" data-width="${W}" data-height="${H}" style="z-index:50"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`);
console.log(`presenter portrait: ${presenter ?? "none (rising-steps graphic used)"}; captions: ${caps.length}`);
