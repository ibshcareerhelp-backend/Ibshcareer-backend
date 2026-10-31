// Builds index.html, compositions/ch1..ch5.html and compositions/captions.html from tools/film.mjs.
// Narration timing: assets/voice/durations.json ({ "<phrase id>": seconds }) when the real voiceover
// exists; otherwise an estimate of 0.43 s a word. Re-run after the voiceover changes:
//   node tools/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenes, CHAPTER } from "./film.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1920, H = 1080;
const DISSOLVE = 0.8, DIP_IN = 0.7, DIP_OUT = 0.6, GAP = 0.6;
const TOTAL = CHAPTER * scenes.length;

const durFile = path.join(ROOT, "assets/voice/durations.json");
const realDur = fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, "utf8")) : {};
const presenterFile = path.join(ROOT, "assets/voice/presenter.json");
const presenterClips = fs.existsSync(presenterFile) ? JSON.parse(fs.readFileSync(presenterFile, "utf8")) : {};
const wordsOf = (t) => t.trim().split(/\s+/);
const phraseDur = (id, text) => realDur[id] ?? +(wordsOf(text).length * 0.43 + 0.2).toFixed(2);
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- timing ----------
const narration = [];
for (const [si, scene] of scenes.entries()) {
  const base = si * CHAPTER;
  let used = 0;
  for (const b of scene.beats) {
    b.phr = [];
    let t = b.lead ?? 0;
    for (const [i, [id, text]] of (b.vo ?? []).entries()) {
      if (i) t += GAP;
      const d = phraseDur(id, text);
      b.phr.push({ id, text, start: t, dur: d });
      t += d;
    }
    const natural = b.vo?.length ? t + (b.tail ?? 1.0) : 0;
    b.len = b.min === "fill" ? null : r2(Math.max(natural, typeof b.min === "number" ? b.min : 0));
    if (b.len != null) used += b.len;
  }
  const fill = scene.beats.find((b) => b.len == null);
  const rest = r2(CHAPTER - used);
  if (fill) fill.len = rest;
  if (rest < (fill ? 4 : 0) || (!fill && Math.abs(rest) > 0.01))
    throw new Error(`${scene.id}: beats take ${used.toFixed(2)} s of ${CHAPTER} s (fill would be ${rest})`);
  let at = 0;
  for (const b of scene.beats) {
    b.start = r2(at);
    at += b.len;
    for (const p of b.phr) narration.push({ id: p.id, scene: scene.id, text: p.text, start: r2(base + b.start + p.start), dur: p.dur });
  }
}

// ---------- scene markup ----------
const css = `
  #root { position: absolute; inset: 0; overflow: hidden; background: #000; font-family: "Inter", sans-serif; }
  .shot, .ground, .card { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  .kb { position: absolute; inset: 0; will-change: transform, opacity; }
  .kb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ground-pattern { background: radial-gradient(ellipse at 50% 45%, #2a1a0c 0%, #120b06 60%, #070402 100%); }
  .ground-pattern .pat { position: absolute; left: -200px; top: -200px; width: ${W + 400}px; height: ${H + 400}px; opacity: 0.13;
    background:
      repeating-linear-gradient(45deg, transparent 0 38px, #d4a24c 38px 40px, transparent 40px 80px),
      repeating-linear-gradient(-45deg, transparent 0 38px, #d4a24c 38px 40px, transparent 40px 80px); }
  .ground-pattern .pat-fade { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, rgba(18,11,6,0.92) 0%, rgba(18,11,6,0.55) 45%, rgba(7,4,2,0.2) 100%); }
  .ground-black { background: #050302; }
  .gold { background: linear-gradient(180deg, #fbe7a6 0%, #e2b453 42%, #b07a22 70%, #f0cd78 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .scrim { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 80%); }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .ch-num { font: 700 30px "Inter"; letter-spacing: 0.42em; text-transform: uppercase; color: #e2b453; margin-left: 0.42em; }
  .ch-rule { width: 220px; height: 2px; background: #c8322a; margin: 26px 0 30px; transform-origin: 50% 50%; }
  .ch-title { font: 700 92px "Playfair Display", serif; color: #f6ecd9; letter-spacing: 0.04em; text-transform: uppercase; text-shadow: 0 4px 30px rgba(0,0,0,0.6); }
  .ch-title span, .k-name span, .f-title span { display: inline-block; white-space: pre; }
  .bigword { font: 900 260px "Playfair Display", serif; letter-spacing: 0.08em; margin-left: 0.08em; filter: drop-shadow(0 8px 40px rgba(0,0,0,0.55)); }
  .bigword span { display: inline-block; }
  .lower { position: absolute; left: 150px; bottom: 210px; padding: 26px 44px 28px 34px; max-width: 1200px;
    background: linear-gradient(90deg, rgba(8,5,2,0.78) 0%, rgba(8,5,2,0.55) 70%, rgba(8,5,2,0) 100%); }
  .lower .bar { position: absolute; left: 0; top: 18px; bottom: 18px; width: 5px; background: #d4a24c; transform-origin: 50% 0%; }
  .lower .l-name { font: 700 50px "Playfair Display", serif; color: #f6ecd9; letter-spacing: 0.02em; }
  .lower .l-sub { font: 400 28px "Inter"; color: #e9d6ae; letter-spacing: 0.04em; margin-top: 8px; }
  .k-dates { font: 700 28px "Inter"; letter-spacing: 0.36em; color: #e2b453; text-transform: uppercase; margin-left: 0.36em; }
  .k-name { font: 700 128px "Playfair Display", serif; color: #f6ecd9; text-transform: uppercase; letter-spacing: 0.03em; margin: 22px 0 18px; }
  .k-note { font: 400 36px "Inter"; color: #e9d6ae; }
  .words { position: absolute; left: 150px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
  .words.stack { left: 0; right: 0; align-items: center; }
  .words .w { font: 700 96px "Playfair Display", serif; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.12; }
  .words:not(.stack) .w { font-size: 84px; filter: drop-shadow(0 4px 24px rgba(0,0,0,0.8)); }
  .s-big { font: 900 230px "Playfair Display", serif; line-height: 1; }
  .s-line { font: 700 64px "Playfair Display", serif; color: #f6ecd9; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 18px; }
  .s-note { font: 400 34px "Inter"; color: #e9d6ae; margin-top: 18px; }
  .f-title { font: 700 104px "Playfair Display", serif; text-transform: uppercase; letter-spacing: 0.05em; }
  .f-sub { font: 700 34px "Inter"; color: #f6ecd9; letter-spacing: 0.3em; text-transform: uppercase; margin: 22px 0 0 0.3em; }
  .f-rule { width: 260px; height: 2px; background: #c8322a; margin: 46px 0; }
  .f-quote { font: 400 40px "Playfair Display", serif; color: #e9d6ae; letter-spacing: 0.08em; line-height: 1.5; text-transform: uppercase; }
`;

function sceneHtml(scene) {
  const sid = scene.id;
  const els = [];
  const tw = [];
  let z = 1;
  const T = (n) => r2(n);
  const beats = scene.beats;

  for (const [bi, b] of beats.entries()) {
    const id = `${sid}-${b.id}`;
    const first = bi === 0, last = bi === beats.length - 1;
    const next = beats[bi + 1];
    const overlapIn = b.enter === "dissolve" && !first ? DISSOLVE : 0;
    const cs = T(b.start - overlapIn);
    const ce = T(b.start + b.len);
    const cd = T(ce - cs);

    const fadesIn = (b.enter === "dissolve" && !first) || b.enter === "dip" || first;
    // picture: still image, presenter video or a drawn ground
    const pres = b.presenter && presenterClips[`${sid}-${b.id}`];
    if (pres) {
      els.push(`<div id="${id}" class="clip shot" data-start="${cs}" data-duration="${cd}" data-track-index="1" style="z-index:${z++}"><div id="${id}-kb" class="kb"${fadesIn ? ' style="opacity:0"' : ""}><video id="${id}-v" src="${pres.src}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video></div></div>`);
    } else if (b.shot) {
      els.push(`<div id="${id}" class="clip shot" data-start="${cs}" data-duration="${cd}" data-track-index="1" style="z-index:${z++}"><div id="${id}-kb" class="kb"${fadesIn ? ' style="opacity:0"' : ""}><img id="${id}-img" src="${b.shot.src}" alt="" style="object-position:${b.shot.pos ?? "50% 50%"}" /></div></div>`);
      const [s0, x0, y0] = b.shot.from, [s1, x1, y1] = b.shot.to;
      tw.push(`tl.fromTo("#${id}-kb", { scale: ${s0}, xPercent: ${x0}, yPercent: ${y0} }, { scale: ${s1}, xPercent: ${x1}, yPercent: ${y1}, duration: ${cd}, ease: "sine.inOut" }, ${cs});`);
    } else {
      const g = b.ground ?? "black";
      els.push(`<div id="${id}" class="clip ground" data-start="${cs}" data-duration="${cd}" data-track-index="1" style="z-index:${z++}"><div id="${id}-kb" class="kb ground-${g}"${fadesIn ? ' style="opacity:0"' : ""}>${g === "pattern" ? `<div id="${id}-pat" class="pat"></div><div class="pat-fade"></div>` : ""}</div></div>`);
      if (g === "pattern") tw.push(`tl.fromTo("#${id}-pat", { x: 0, y: 0 }, { x: -260, y: -130, duration: ${cd}, ease: "none" }, ${cs});`);
    }
    // arrival
    if (b.enter === "dissolve" && !first) tw.push(`tl.fromTo("#${id}-kb", { opacity: 0 }, { opacity: 1, duration: ${DISSOLVE}, ease: "sine.inOut" }, ${cs});`);
    else if (b.enter === "dip" || first) tw.push(`tl.fromTo("#${id}-kb", { opacity: 0 }, { opacity: 1, duration: ${first && sid === "ch1" ? 1.6 : DIP_IN}, ease: "power2.out" }, ${cs});`);
    // departure: into a dip, or the chapter's end
    if (last || next?.enter === "dip") {
      const out = last ? (sid === "ch5" ? 1.2 : DIP_OUT) : 0.45;
      tw.push(`tl.to("#${id}-kb", { opacity: 0, duration: ${out}, ease: "power2.in" }, ${T(ce - out - 0.04)});`);
    }

    // cards
    for (const [ci, c] of (b.cards ?? []).entries()) {
      const cid = `${id}-c${ci}`;
      const ph = c.phrase ? b.phr.find((p) => p.id === c.phrase) : c.after ? b.phr.find((p) => p.id === c.after) : null;
      let s = c.at != null ? c.at : c.phrase ? ph.start + (c.offset ?? 0) : ph.start + ph.dur + (c.offset ?? 0);
      s = T(b.start + s);
      const e = c.untilEnd || c.dur == null ? T(ce - (last ? 0.05 : 0)) : T(s + c.dur);
      const d = T(e - s);
      const zc = 100 + z++;
      const open = `<div id="${cid}" class="clip card" data-start="${s}" data-duration="${d}" data-track-index="2" style="z-index:${zc}"`;
      const outAt = T(e - 0.45);
      if (c.kind === "chapter") {
        const words = c.title.split(" ").map((w, i) => `<span id="${cid}-t${i}">${esc(w)}${i < c.title.split(" ").length - 1 ? " " : ""}</span>`).join("");
        els.push(`${open} data-layout-allow-overlap><div id="${cid}-scrim" class="scrim" style="opacity:0"></div><div class="center"><div id="${cid}-num" class="ch-num">${esc(c.num)}</div><div id="${cid}-rule" class="ch-rule"></div><div class="ch-title">${words}</div></div></div>`);
        tw.push(`tl.fromTo("#${cid}-scrim", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${s});`);
        tw.push(`tl.fromTo("#${cid}-num", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }, ${T(s + 0.15)});`);
        tw.push(`tl.fromTo("#${cid}-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "expo.out" }, ${T(s + 0.35)});`);
        c.title.split(" ").forEach((_, i) => tw.push(`tl.fromTo("#${cid}-t${i}", { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "power3.out" }, ${T(s + 0.5 + i * 0.12)});`));
        tw.push(`tl.to("#${cid} .center, #${cid}-scrim", { opacity: 0, filter: "blur(6px)", duration: 0.4, ease: "power2.in" }, ${T(e - 0.42)});`);
      } else if (c.kind === "bigword") {
        const letters = [...c.text].map((ch, i) => `<span id="${cid}-l${i}" class="gold">${esc(ch)}</span>`).join("");
        els.push(`${open}><div id="${cid}-scrim" class="scrim" style="opacity:0"></div><div class="center"><div class="bigword">${letters}</div></div></div>`);
        tw.push(`tl.fromTo("#${cid}-scrim", { opacity: 0 }, { opacity: 0.8, duration: 0.8, ease: "power2.out" }, ${s});`);
        [...c.text].forEach((_, i) => tw.push(`tl.fromTo("#${cid}-l${i}", { opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "power3.out" }, ${T(s + i * 0.1)});`));
        tw.push(`tl.to("#${cid} .center, #${cid}-scrim", { opacity: 0, duration: 0.5, ease: "power2.in" }, ${T(e - 0.55)});`);
      } else if (c.kind === "lower") {
        els.push(`${open}><div id="${cid}-box" class="lower"><div id="${cid}-bar" class="bar"></div><div id="${cid}-name" class="l-name">${esc(c.name)}</div><div id="${cid}-sub" class="l-sub">${esc(c.sub)}</div></div></div>`);
        tw.push(`tl.fromTo("#${cid}-box", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, ${s});`);
        tw.push(`tl.fromTo("#${cid}-bar", { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "expo.out" }, ${s});`);
        tw.push(`tl.fromTo("#${cid}-name", { opacity: 0, x: -24, filter: "blur(6px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }, ${T(s + 0.1)});`);
        tw.push(`tl.fromTo("#${cid}-sub", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, ${T(s + 0.35)});`);
        tw.push(`tl.to("#${cid}-box", { opacity: 0, duration: 0.35, ease: "power2.in" }, ${T(e - 0.38)});`);
      } else if (c.kind === "kingdom") {
        const name = c.name.split(" ").map((w, i, a) => `<span id="${cid}-n${i}">${esc(w)}${i < a.length - 1 ? " " : ""}</span>`).join("");
        els.push(`${open}><div class="center"><div id="${cid}-dates" class="k-dates">${esc(c.dates)}</div><div class="k-name">${name}</div><div id="${cid}-note" class="k-note">${esc(c.note)}</div></div></div>`);
        c.name.split(" ").forEach((_, i) => tw.push(`tl.fromTo("#${cid}-n${i}", { opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }, ${T(s + i * 0.1)});`));
        tw.push(`tl.fromTo("#${cid}-dates", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }, ${T(s + 0.25)});`);
        tw.push(`tl.fromTo("#${cid}-note", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${T(s + 0.6)});`);
        tw.push(`tl.to("#${cid} .center", { opacity: 0, filter: "blur(8px)", duration: 0.3, ease: "power2.in" }, ${T(e - 0.32)});`);
      } else if (c.kind === "words") {
        const list = c.words.map(([w], i) => `<div id="${cid}-w${i}" class="w gold">${esc(w)}</div>`).join("");
        els.push(`${open}>${c.stack ? "" : `<div id="${cid}-scrim" class="scrim" style="opacity:0;background:linear-gradient(90deg,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.35) 45%,rgba(0,0,0,0) 70%)"></div>`}<div class="words${c.stack ? " stack" : ""}">${list}</div></div>`);
        if (!c.stack) tw.push(`tl.fromTo("#${cid}-scrim", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${s});`);
        c.words.forEach(([, f], i) => tw.push(`tl.fromTo("#${cid}-w${i}", { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.4, ease: "power3.out" }, ${T(b.start + ph.start + f * ph.dur)});`));
        tw.push(`tl.to("#${cid} .words${c.stack ? "" : `, #${cid}-scrim`}", { opacity: 0, filter: "blur(6px)", duration: 0.35, ease: "power2.in" }, ${T(e - 0.38)});`);
      } else if (c.kind === "stat") {
        els.push(`${open} data-hold><div class="center"><div id="${cid}-big" class="s-big gold">${esc(c.big)}</div><div id="${cid}-line" class="s-line">${esc(c.line)}</div><div id="${cid}-note" class="s-note">${esc(c.note)}</div></div></div>`);
        tw.push(`tl.fromTo("#${cid}-big", { opacity: 0, scale: 1.08, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, ${s});`);
        tw.push(`tl.fromTo("#${cid}-line", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" }, ${T(s + 0.45)});`);
        tw.push(`tl.fromTo("#${cid}-note", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${T(s + 0.8)});`);
        tw.push(`tl.to("#${cid} .center", { opacity: 0, filter: "blur(8px)", duration: 0.32, ease: "power2.in" }, ${T(e - 0.35)});`);
      } else if (c.kind === "final") {
        const title = "Africa: The Untold Story";
        const tparts = title.split(" ").map((w, i, a) => `<span id="${cid}-t${i}" class="gold">${esc(w)}${i < a.length - 1 ? " " : ""}</span>`).join("");
        els.push(`${open} data-hold><div class="center"><div class="f-title">${tparts}</div><div id="${cid}-sub" class="f-sub">From Ancient Kingdoms to a New Generation</div><div id="${cid}-rule" class="f-rule"></div><div id="${cid}-q" class="f-quote">“Our history is our foundation.<br />Our future is our responsibility.”</div></div></div>`);
        title.split(" ").forEach((_, i) => tw.push(`tl.fromTo("#${cid}-t${i}", { opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "power3.out" }, ${T(s + 0.3 + i * 0.16)});`));
        tw.push(`tl.fromTo("#${cid}-sub", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 1.0, ease: "expo.out" }, ${T(s + 1.6)});`);
        tw.push(`tl.fromTo("#${cid}-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, ${T(s + 3.0)});`);
        tw.push(`tl.fromTo("#${cid}-q", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 1.0, ease: "power2.out" }, ${T(s + 3.6)});`);
        tw.push(`tl.to("#${cid} .center", { opacity: 0, duration: 1.2, ease: "power2.in" }, ${T(e - 1.3)});`);
      }
    }
  }

  return `<template>
  <style>${css}
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${W}" data-height="${H}">
    ${els.join("\n    ")}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${tw.join("\n    ")}
    window.__timelines["${sid}"] = tl;
  </script>
</template>
`;
}

// ---------- captions ----------
function captionGroups() {
  const groups = [];
  for (const p of narration) {
    const words = wordsOf(p.text);
    const per = p.dur / words.length;
    // one group up to 8 words; longer phrases split once, at the comma nearest the middle, else in half
    const all = words.map((_, i) => i);
    const mid = words.length / 2;
    let chunks = [all];
    if (p.text.length > 62) {
      let cut = Math.ceil(mid), best = Infinity;
      words.forEach((w, i) => { if (/[,;:]$/.test(w) && i + 1 >= 3 && words.length - i - 1 >= 3 && Math.abs(i + 1 - mid) < best) { best = Math.abs(i + 1 - mid); cut = i + 1; } });
      if (best === Infinity) {
        // no usable comma: break before a joining word nearest the middle
        let bb = Infinity;
        words.forEach((w, i) => { if (i >= 3 && words.length - i >= 3 && /^(and|but|the|of|by|in|to|that|what|we|is|who)$/i.test(w) && Math.abs(i - mid) < bb) { bb = Math.abs(i - mid); cut = i; } });
      }
      chunks = [all.slice(0, cut), all.slice(cut)];
    }
    chunks.forEach((idx, k) => {
      const s = p.start + idx[0] * per - 0.08;
      const lastWordEnd = p.start + (idx[idx.length - 1] + 1) * per;
      const e = k < chunks.length - 1 ? p.start + chunks[k + 1][0] * per - 0.08 : lastWordEnd + 0.3;
      groups.push({ text: idx.map((i) => words[i]).join(" "), start: r2(s), end: r2(e) });
    });
  }
  return groups;
}

function captionsHtml() {
  const g = captionGroups();
  const els = g.map((c, i) => `<div id="cap-${i}" class="clip cap" data-start="${c.start}" data-duration="${r2(c.end - c.start)}" data-track-index="3"><span id="cap-${i}-t" class="cap-t">${esc(c.text)}</span></div>`);
  const tw = g.flatMap((c, i) => [
    `tl.fromTo("#cap-${i}-t", { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "power2.out" }, ${c.start});`,
    `tl.to("#cap-${i}-t", { opacity: 0, duration: 0.12, ease: "power2.in" }, ${r2(c.end - 0.12)});`,
  ]);
  return `<template>
  <style>
    #root { position: absolute; inset: 0; pointer-events: none; }
    .cap { position: absolute; left: 0; right: 0; bottom: 92px; text-align: center; overflow: visible; }
    .cap-t { display: inline-block; font: 700 42px "Inter", sans-serif; color: #fffaf0; letter-spacing: 0.01em; line-height: 1.25;
      padding: 8px 22px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.42); text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
  </style>
  <div id="root" data-composition-id="captions" data-width="${W}" data-height="${H}">
    ${els.join("\n    ")}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${tw.join("\n    ")}
    window.__timelines["captions"] = tl;
  </script>
</template>
`;
}

// ---------- root ----------
function indexHtml() {
  const hosts = scenes.map((s, i) => `<div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${i * CHAPTER}" data-duration="${CHAPTER}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:1"></div>`);
  const voiceDir = path.join(ROOT, "assets/voice");
  const audio = [];
  for (const n of narration) {
    const f = `assets/voice/${n.id}.mp3`;
    if (fs.existsSync(path.join(ROOT, f))) audio.push(`<audio id="vo-${n.id}" class="clip" src="${f}" data-start="${n.start}" data-duration="${n.dur}" data-track-index="5" data-volume="1"></audio>`);
  }
  const music = fs.existsSync(path.join(ROOT, "assets/music/bed.mp3"))
    ? `<audio id="music-bed" class="clip" src="assets/music/bed.mp3" data-start="0" data-duration="${TOTAL}" data-track-index="6" data-volume="0.32" data-fade-in="2" data-fade-out="4"></audio>`
    : "";
  return `<!doctype html>
<html lang="en" data-composition-variables='[{"id":"filmTitle","type":"string","label":"Film title","default":"Africa: The Untold Story"}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>Africa: The Untold Story</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #main { position: relative; width: 100%; height: 100%; background: #000; }
    </style>
  </head>
  <body>
    <div id="main" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
      ${hosts.join("\n      ")}
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${TOTAL}" data-track-index="3" data-track-kind="captions" data-width="${W}" data-height="${H}" style="z-index:50"></div>
      ${audio.join("\n      ")}
      ${music}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;
}

fs.mkdirSync(path.join(ROOT, "compositions"), { recursive: true });
for (const s of scenes) fs.writeFileSync(path.join(ROOT, `compositions/${s.id}.html`), sceneHtml(s));
fs.writeFileSync(path.join(ROOT, "compositions/captions.html"), captionsHtml());
fs.writeFileSync(path.join(ROOT, "index.html"), indexHtml());
fs.writeFileSync(path.join(ROOT, "narration.json"), JSON.stringify(narration, null, 2) + "\n");
for (const s of scenes) console.log(s.id, s.beats.map((b) => `${b.id}@${b.start}+${b.len}`).join("  "));
console.log(`phrases: ${narration.length}, words: ${narration.reduce((n, p) => n + wordsOf(p.text).length, 0)}, captions: ${captionGroups().length}`);
