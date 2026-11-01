// Builds index.html + compositions/*.html for the 30 s "Ibrahim Sharaf Careers" advert.
//   node tools/build.mjs        (needs tools/schedule.json from tools/voice.py)
// If assets/img/presenter.png|jpg exists it is shown as the presenter portrait in scenes 1 and 4.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1920, H = 1080, TOTAL = 30;
const sched = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/schedule.json"), "utf8"));
const presenter = ["assets/img/presenter.png", "assets/img/presenter.jpg"].find((f) => fs.existsSync(path.join(ROOT, f)));
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const line = (id) => sched.find((s) => s.id === id);

// scene slots (a slot runs 0.5 s past its end so the next scene dissolves in over it)
const SCENES = [
  { id: "s1", start: 0, end: 5 },
  { id: "s2", start: 5, end: 12 },
  { id: "s3", start: 12, end: 20 },
  { id: "s4", start: 20, end: 25.6 },
  { id: "s5", start: 25.6, end: 30 },
];

// ---------- shared look ----------
const NAVY = "#0b2545", GOLD = "#c9a24b", GOLD_L = "#f0d58a";
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
  #root { position: absolute; inset: 0; overflow: hidden; background: #ffffff; font-family: "Inter", sans-serif; color: #0b2545; }
  #wrap { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: linear-gradient(160deg, #ffffff 0%, #f6f9fd 60%, #eaf0f8 100%); }
  #bgpan { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  .glow { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: radial-gradient(ellipse at 78% 30%, rgba(201,162,75,0.20) 0%, rgba(201,162,75,0) 55%); }
  .vig { display: none; }
  .brand { position: absolute; left: 90px; top: 62px; display: flex; align-items: center; gap: 18px; }
  .brand span { font: 700 22px "Inter"; letter-spacing: 0.32em; color: ${NAVY}; }
  .abs { position: absolute; }
  .gold { background: linear-gradient(180deg, #d1a748 0%, #b8892a 55%, #8a6212 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .serif { font-family: "Playfair Display", serif; }
  .eyebrow { font: 700 26px "Inter"; letter-spacing: 0.4em; text-transform: uppercase; color: #9a7418; }
  .rule { height: 3px; background: ${GOLD}; transform-origin: 0% 50%; }
  .w { display: inline-block; white-space: pre; }
`;

function shell(sid, body, script, extraCss = "", panFrom = 1.0, panTo = 1.07) {
  return `<template>
  <style>${css}${extraCss}
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${W}" data-height="${H}">
    <div id="wrap">
      <div id="bgpan"><div style="position:absolute;left:90px;right:90px;top:128px;height:2px;background:linear-gradient(90deg,#c9a24b,rgba(201,162,75,0))"></div><div style="position:absolute;left:90px;right:90px;bottom:34px;height:2px;background:linear-gradient(270deg,#c9a24b,rgba(201,162,75,0))"></div></div>
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
function hero(id, at) {
  if (presenter)
    return {
      html: `<div id="${id}" class="abs" style="left:1090px;top:190px;width:700px;height:700px;border-radius:26px;overflow:hidden;border:3px solid ${GOLD};box-shadow:0 24px 56px rgba(11,37,69,0.22)"><img id="${id}-img" src="${presenter}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:50% 50%" /></div>`,
      js: `tl.fromTo("#${id}", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.9, ease: "expo.out" }, ${at});
    tl.fromTo("#${id}-img", { scale: 1.0 }, { scale: 1.03, duration: 5, ease: "none" }, ${at});`,
    };
  const bars = [0, 1, 2, 3, 4].map((i) => `<div id="${id}-b${i}" class="abs" style="left:${1130 + i * 130}px;bottom:${150}px;width:96px;height:${150 + i * 130}px;border-radius:10px 10px 0 0;background:linear-gradient(180deg,${GOLD_L},${GOLD} 60%,#8a6a22);transform-origin:50% 100%"></div>`).join("");
  return {
    html: `${bars}<svg id="${id}-arrow" class="abs" style="left:1090px;top:230px" width="720" height="560" viewBox="0 0 720 560"><path id="${id}-p" d="M20 520 C 200 470, 360 330, 640 70" fill="none" stroke="${NAVY}" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="100 120" stroke-dashoffset="110"/><path id="${id}-h" d="M575 62 L650 52 L630 128" fill="none" stroke="${NAVY}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`,
    js: `${[0, 1, 2, 3, 4].map((i) => `tl.fromTo("#${id}-b${i}", { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: "expo.out" }, ${r2(at + 0.15 * i)});`).join("\n    ")}
    tl.fromTo("#${id}-p", { strokeDashoffset: 110 }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" }, ${r2(at + 0.7)});
    tl.fromTo("#${id}-h", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, ${r2(at + 1.95)});`,
  };
}

// ---------- scenes ----------
const out = {};

// S1  0–5  presenter + title
{
  const h = hero("s1h", 0.2);
  out.s1 = shell("s1", `
      ${h.html}
      <div id="s1-eyebrow" class="abs eyebrow" style="left:150px;top:300px">Welcome</div>
      <div class="abs serif" style="left:150px;top:350px;width:880px;font-size:104px;font-weight:700;line-height:1.08;color:#fff">${words("s1-t", "Your Next Career Move Starts Here.")}</div>
      <div id="s1-rule" class="abs rule" style="left:154px;top:800px;width:420px"></div>`,
    `tl.fromTo("#s1-eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.3);
    ${wordTw("s1-t", 6, 0.5, 0.14, 0.5)}
    tl.fromTo("#s1-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, 1.5);
    ${h.js}`, "", 1.0, 1.06);
}

// S2  5–12  office + CV
{
  const L = 5; // scene-local = global - 5
  const office = `<svg class="abs" style="left:1000px;top:190px" width="780" height="620" viewBox="0 0 780 620">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3f73"/><stop offset="1" stop-color="#e3a95b"/></linearGradient></defs>
      <rect x="0" y="0" width="780" height="620" rx="22" fill="#0a1d38" stroke="${GOLD}" stroke-width="2.5"/>
      <rect x="30" y="30" width="720" height="400" rx="10" fill="url(#sky)"/>
      <g fill="#0a1d38" opacity="0.88">${[[60, 250, 70], [150, 200, 60], [230, 280, 80], [330, 170, 70], [420, 240, 60], [500, 190, 90], [610, 260, 70], [690, 220, 50]].map(([x, y, w]) => `<rect x="${x}" y="${y + 70}" width="${w}" height="${360 - y}"/>`).join("")}</g>
      <rect x="30" y="30" width="6" height="400" fill="#0a1d38"/><rect x="385" y="30" width="10" height="400" fill="#0a1d38"/><rect x="744" y="30" width="6" height="400" fill="#0a1d38"/><rect x="30" y="228" width="720" height="8" fill="#0a1d38"/>
      <rect x="0" y="430" width="780" height="190" fill="#061428"/>
      <rect x="110" y="470" width="560" height="26" rx="6" fill="#16355f"/><rect x="150" y="496" width="14" height="110" fill="#16355f"/><rect x="616" y="496" width="14" height="110" fill="#16355f"/>
      <rect x="290" y="392" width="200" height="78" rx="6" fill="#102a4d" stroke="${GOLD}" stroke-width="2"/><rect x="278" y="470" width="224" height="8" rx="4" fill="${GOLD}"/>
      <rect x="560" y="420" width="10" height="50" fill="${GOLD}"/><path d="M520 420 L610 420 L580 392 L550 392 Z" fill="${GOLD_L}" opacity="0.9"/>
      <circle cx="90" cy="440" r="0" fill="none"/>
    </svg>`;
  const cv = `<div id="s2-cv" class="abs" style="left:780px;top:430px;width:330px;height:420px;border-radius:14px;background:#f7f4ec;box-shadow:0 24px 56px rgba(11,37,69,0.22);padding:34px 30px">
      <div style="width:60px;height:60px;border-radius:50%;background:${NAVY}"></div>
      <div id="s2-cvn" style="height:16px;width:170px;margin:-44px 0 0 80px;background:${NAVY};border-radius:4px"></div>
      <div style="height:10px;width:110px;margin:12px 0 0 80px;background:${GOLD};border-radius:4px"></div>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<div id="s2-cvl${i}" style="height:10px;width:${i % 3 === 2 ? 170 : 262}px;margin-top:${i === 0 ? 42 : 17}px;background:#c9ced8;border-radius:4px;transform-origin:0% 50%"></div>`).join("")}
      <div id="s2-chk" style="position:absolute;right:-24px;top:-24px;width:68px;height:68px;border-radius:50%;background:${GOLD};display:flex;align-items:center;justify-content:center"><svg width="34" height="34" viewBox="0 0 34 34"><path d="M6 18 L14 26 L29 8" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    </div>`;
  out.s2 = shell("s2", `
      ${office}${cv}
      <div id="s2-eyebrow" class="abs eyebrow" style="left:150px;top:300px">Strategic career support</div>
      <div class="abs serif" style="left:150px;top:350px;width:760px;font-size:82px;font-weight:700;line-height:1.12;color:#fff">${words("s2-t", "Professional ambition meets strategy.")}</div>
      <div id="s2-rule" class="abs rule" style="left:154px;top:700px;width:300px"></div>`,
    `tl.fromTo("#s2-eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.4);
    ${wordTw("s2-t", 4, 0.6, 0.16, 0.5)}
    tl.fromTo("#s2-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, 1.5);
    tl.fromTo("#s2-cv", { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" }, 0.9);
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `tl.fromTo("#s2-cvl${i}", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, ${r2(1.6 + i * 0.18)});`).join("\n    ")}
    tl.fromTo("#s2-chk", { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(1.6)" }, 3.6);`,
    "", 1.0, 1.05);
}

// S3  12–20  four services + tri-label bar
{
  const icons = {
    cv: `<rect x="14" y="6" width="44" height="60" rx="5" fill="none" stroke="${GOLD}" stroke-width="3.5"/><path d="M24 24 H48 M24 36 H48 M24 48 H40" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round"/>`,
    brief: `<rect x="8" y="20" width="56" height="40" rx="6" fill="none" stroke="${GOLD}" stroke-width="3.5"/><path d="M26 20 V12 H46 V20 M8 38 H64" fill="none" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round"/>`,
    talk: `<path d="M8 12 H48 V40 H26 L14 50 V40 H8 Z" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linejoin="round"/><path d="M52 26 H64 V52 H58 V62 L48 52 H30 V44" fill="none" stroke="${GOLD_L}" stroke-width="3.5" stroke-linejoin="round"/>`,
    goal: `<circle cx="34" cy="38" r="26" fill="none" stroke="${GOLD}" stroke-width="3.5"/><circle cx="34" cy="38" r="14" fill="none" stroke="${GOLD}" stroke-width="3.5"/><path d="M34 38 L62 8 M50 8 H62 V20" fill="none" stroke="${GOLD_L}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const tiles = [["cv", "CV Development"], ["brief", "Executive Recruitment"], ["talk", "Interview Preparation"], ["goal", "Career Opportunities"]];
  const tileHtml = tiles.map(([k, label], i) => `<div id="s3-c${i}" class="abs" style="left:${150 + i * 420}px;top:290px;width:380px;height:380px;border-radius:22px;background:#ffffff;border:2px solid rgba(201,162,75,0.7);box-shadow:0 18px 44px rgba(11,37,69,0.14)"><svg style="position:absolute;left:150px;top:80px" width="80" height="80" viewBox="0 0 72 72">${icons[k]}</svg><div class="serif" style="position:absolute;left:0;right:0;top:215px;text-align:center;font-size:40px;font-weight:700;line-height:1.2;padding:0 30px">${esc(label)}</div></div>`).join("");
  out.s3 = shell("s3", `
      <div id="s3-eyebrow" class="abs eyebrow" style="left:150px;top:196px">What we do</div>
      ${tileHtml}
      <div id="s3-bar" class="abs" style="left:150px;top:760px;width:1620px;height:92px;border-radius:46px;background:linear-gradient(90deg,${GOLD},${GOLD_L});display:flex;align-items:center;justify-content:center;font:700 38px Inter;color:${NAVY};letter-spacing:0.04em;white-space:nowrap">Career Strategy &nbsp;|&nbsp; CV Positioning &nbsp;|&nbsp; Opportunity Support</div>`,
    `tl.fromTo("#s3-eyebrow", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.4);
    ${tiles.map((_, i) => `tl.fromTo("#s3-c${i}", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, ${r2(0.6 + i * 1.0)});`).join("\n    ")}
    tl.fromTo("#s3-bar", { opacity: 0, y: 30, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "expo.out" }, 5.0);`,
    "", 1.0, 1.05);
}

// S4  20–25.6  closing presenter
{
  const h = hero("s4h", 0.2);
  const t6 = line("l6").start - 20;
  out.s4 = shell("s4", `
      ${h.html}
      <div id="s4-eyebrow" class="abs eyebrow" style="left:150px;top:340px">Ibrahim Sharaf</div>
      <div id="s4-sub" class="abs" style="left:150px;top:392px;font:400 30px Inter;color:#4a5b75;letter-spacing:0.04em">Ibrahim Sharaf Careers</div>
      <div class="abs serif" style="left:150px;top:470px;width:880px;font-size:96px;font-weight:700;line-height:1.1;color:#fff">${words("s4-t", "Let's move your career forward.")}</div>
      <div id="s4-rule" class="abs rule" style="left:154px;top:810px;width:420px"></div>`,
    `tl.fromTo("#s4-eyebrow", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "power3.out" }, 0.9);
    tl.fromTo("#s4-sub", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, 1.2);
    ${wordTw("s4-t", 5, r2(t6 - 0.1), 0.17, 0.5)}
    tl.fromTo("#s4-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, ${r2(t6 + 0.9)});
    ${h.js}`, "", 1.0, 1.05);
}

// S5  25.6–30  end card
{
  out.s5 = shell("s5", `
      <div class="abs" style="left:0;top:0;width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center" data-hold>
        <div id="s5-logo">${LOGO(150)}</div>
        <div id="s5-name" class="serif gold" style="font-size:104px;font-weight:700;letter-spacing:0.05em;margin-top:22px">IBRAHIM SHARAF CAREERS</div>
        <div id="s5-tag" style="font:700 34px Inter;color:${NAVY};letter-spacing:0.42em;text-transform:uppercase;margin:18px 0 0 0.42em">Achieve. Advance. Succeed.</div>
        <div id="s5-rule" class="rule" style="width:300px;margin:38px 0 36px;transform-origin:50% 50%"></div>
        <div id="s5-web" style="display:flex;align-items:center;gap:20px;font:700 56px Inter;color:#8a6212;letter-spacing:0.02em"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="23" fill="none" stroke="${GOLD}" stroke-width="3"/><ellipse cx="28" cy="28" rx="10" ry="23" fill="none" stroke="${GOLD}" stroke-width="3"/><path d="M5 28 H51 M9 15 H47 M9 41 H47" stroke="${GOLD}" stroke-width="3" fill="none"/></svg>ibrahimsharafcareers.site</div>
        <div id="s5-cta" style="font:400 34px Inter;color:#4a5b75;margin-top:30px;letter-spacing:0.03em">Take the next step in your career.</div>
      </div>`,
    `tl.fromTo("#s5-logo", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, 0.3);
    tl.fromTo("#s5-name", { opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.8, ease: "power3.out" }, 0.55);
    tl.fromTo("#s5-tag", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, 1.0);
    tl.fromTo("#s5-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.out" }, 1.3);
    tl.fromTo("#s5-web", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, 1.5);
    tl.fromTo("#s5-cta", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.out" }, 2.1);`,
    "", 1.0, 1.03);
}

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
