// Capture a web page (reference or your clone) the same way every time:
// video + extracted frames, an inspection dump (animations, keyframes, styles, fonts, libraries)
// and a per-frame track of chosen elements (position, size, opacity, transform).
//
// Usage: bun capture.ts --url <url|file.html> --out <dir> [options]
import { chromium, type Page } from "playwright";
import { join } from "node:path";
import { existsSync, readFileSync, renameSync, readdirSync, statSync } from "node:fs";
import { ensureDir, ffmpeg, num, pad, parseArgs, parseRect, parseSize, usage, writeJson, abs } from "./lib.ts";

const HELP = `
capture.ts — record a page and dump everything needed to clone its motion.

  bun capture.ts --url <url|file.html> --out <dir> [options]

Window
  --viewport WxH        viewport, default 1440x900 (use the same for reference and clone)
  --scale N             deviceScaleFactor, default 1
  --color-scheme S      light | dark
  --reduced-motion S    no-preference (default) | reduce

What to look at
  --selector CSS        element to scroll into view and crop frames to (default: whole viewport)
  --pad PX              extra margin around the selector crop, default 0
  --clip x,y,w,h        explicit crop in CSS px (overrides --selector crop)

How to start the motion
  --trigger T           load (default) | scroll | hover | leave | move | drag | click | none
                        load: the window starts at navigation (page-load animations)
                        scroll: wheel the page in steps so scroll-reveal / scroll-linked motion plays
                        hover / click: act on --target (default: --selector)
                        leave: move the pointer off whatever it is on (hover-out); pair with --pre-hover
                        move: glide the pointer through --path inside --target (pointer-follow effects)
                        drag: like move, with the button held: down at the first --path point, glide, up at the last
                        none: just record (loops, marquees, idle animations)
  --target CSS          element to hover/click/move over
  --hover-at FX,FY      where to put the pointer on --target, as fractions of its box (default 0.5,0.5)
  --pre-hover CSS       hover this element before the trigger (uses --hover-at) and wait --pre-hover-ms
  --pre-hover-ms MS     default 1500
  --leave-to X,Y        viewport point the pointer moves to for --trigger leave, default <width/2>,8
  --path "FX,FY;…"      move/drag trigger: fractional points inside --target, visited in order
  --path-ms MS          move/drag trigger: time spent between two points, default 400 (20 pointer steps each)
  --scroll-to PX|CSS    scroll position (or element) to reach during a scroll trigger;
                        default for scroll: bring --selector into view from just below the fold
  --scroll-ms MS        how long the stepped scroll takes, default 600
  --scroll-steps N      wheel steps, default 12
  --wait-before MS      settle time after load before the trigger, default 800
  --pre-js FILE|CODE    JS to run after load, before the trigger (dismiss banners, open a menu…)
  --duration MS         how long to record after the trigger, default 3000
  --pre-roll MS         frames to keep before the trigger, default 200

Output
  --fps N               extracted frame rate, default 25 (the video is 25 fps; higher only helps with --playback-rate)
  --playback-rate R     slow CSS/WAAPI animations with CDP (0.25 = 4x slower). JS-driven motion is not affected.
  --track "CSS, CSS"    elements sampled every animation frame → track.json (default: --selector, if any)
  --no-video            skip the video and frames (inspection + track only)
  --headed              show the browser (needs a display)

Writes to <out>/: video.webm, frames/NNNN.png, frames.json, inspect.json, track.json, capture.json
`;

const a = parseArgs(process.argv.slice(2));
if (a.help || !a.url || !a.out) usage(HELP);

const out = ensureDir(abs(a.out));
const viewport = parseSize(a.viewport, { width: 1440, height: 900 });
const scale = num(a.scale, 1);
const fps = num(a.fps, 25);
const rate = num(a["playback-rate"], 1);
const duration = num(a.duration, 3000);
const preRoll = num(a["pre-roll"], 200);
const waitBefore = num(a["wait-before"], 800);
const trigger: string = a.trigger || "load";
const selector: string | undefined = a.selector;
const target: string | undefined = a.target || selector;
const padPx = num(a.pad, 0);
const wantVideo = !a["no-video"];
const trackSelectors: string[] = (a.track ? String(a.track) : selector || "").split(",").map((s) => s.trim()).filter(Boolean);
let url: string = String(a.url);
if (!/^[a-z]+:/i.test(url)) url = "file://" + abs(url);

const hoverAt = String(a["hover-at"] ?? "0.5,0.5").split(",").map(Number);
const preHover: string | undefined = a["pre-hover"] ? String(a["pre-hover"]) : undefined;
const preHoverMs = num(a["pre-hover-ms"], 1500);
const leaveTo = a["leave-to"] ? String(a["leave-to"]).split(",").map(Number) : [viewport.width / 2, 8];
const movePath = String(a.path ?? "0.5,0.5").split(";").map((p) => p.split(",").map(Number));
const pathMs = num(a["path-ms"], 400);
async function pointAt(page: Page, sel: string, fx: number, fy: number) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`not visible: ${sel}`);
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}

const preJs = a["pre-js"] ? (existsSync(String(a["pre-js"])) ? readFileSync(String(a["pre-js"]), "utf8") : String(a["pre-js"])) : undefined;

// ---------- in-page tracker (installed before any script runs so load-triggered motion is caught) ----------
const TRACKER = `(() => {
  const sels = __SELS__;
  const w = window;
  w.__mc = { samples: [], t0: null, running: true };
  const sample = () => {
    if (!w.__mc.running) return;
    const t = performance.now();
    const els = {};
    for (const s of sels) {
      let el = null; try { el = document.querySelector(s); } catch {}
      if (!el) { els[s] = null; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      els[s] = { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
                 opacity: +(+cs.opacity).toFixed(3), transform: cs.transform, clipPath: cs.clipPath === 'none' ? undefined : cs.clipPath };
    }
    w.__mc.samples.push({ t, scrollY: w.scrollY, els });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();`;

// ---------- inspection (run after the motion so getAnimations() has seen everything) ----------
const INSPECT = `(sel) => {
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 4).join('.') : '');
  const root = sel ? document.querySelector(sel) : document.body;
  const w = window;
  const libs = [];
  const has = (c) => { try { return !!c(); } catch { return false; } };
  if (has(() => w.gsap)) libs.push('gsap' + (has(() => w.ScrollTrigger) ? '+ScrollTrigger' : ''));
  if (has(() => w.lottie || w.bodymovin || document.querySelector('lottie-player,dotlottie-player,[data-lottie],.lottie'))) libs.push('lottie');
  if (has(() => w.THREE || [...document.querySelectorAll('canvas')].some(c => c.getContext && (c.getContext('webgl2') || c.getContext('webgl'))))) libs.push('webgl/three');
  if (has(() => w.rive || document.querySelector('canvas[data-rive], .rive-canvas'))) libs.push('rive');
  if (has(() => w.anime)) libs.push('anime.js');
  if (has(() => w.Lenis || document.documentElement.classList.contains('lenis'))) libs.push('lenis smooth-scroll');
  if (has(() => w.Webflow || document.querySelector('[data-wf-page]'))) libs.push('webflow');
  if (has(() => document.querySelector('[data-framer-name],[data-framer-component-type]'))) libs.push('framer-sites');
  if (has(() => document.querySelector('[data-projection-id],[data-framer-appear-id]') || [...document.scripts].some(s => /framer-motion|motion-dom/.test(s.src)))) libs.push('framer-motion/motion');
  if (has(() => w.__NEXT_DATA__ || document.getElementById('__next'))) libs.push('next.js');
  if (has(() => w.__nuxt)) libs.push('nuxt');
  if (has(() => document.querySelector('astro-island'))) libs.push('astro');
  if (has(() => document.querySelector('.swiper, .splide, .slick-slider, .embla'))) libs.push('carousel lib');
  if (has(() => [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.cssText.includes('animation-timeline')) } catch { return false } }))) libs.push('css scroll-driven animations');

  const fonts = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '') + ' ' + f.weight + ' ' + f.style))];

  const keyframes = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { keyframes.push({ unreadable: sheet.href }); continue; }
    const walk = (list) => { for (const r of list) { if (r.type === 7) keyframes.push({ name: r.name, css: r.cssText }); else if (r.cssRules) walk(r.cssRules); } };
    walk(rules);
  }

  const anims = (root ? root.getAnimations({ subtree: true }) : document.getAnimations()).slice(0, 200).map(an => {
    const eff = an.effect; const tgt = eff && eff.target;
    let kf = []; try { kf = eff.getKeyframes().slice(0, 24).map(k => { const o = {}; for (const [p, v] of Object.entries(k)) if (p !== 'computedOffset' && p !== 'composite') o[p] = v; return o; }); } catch {}
    return { kind: an.constructor.name, name: an.animationName || an.transitionProperty || an.id || '', target: tgt ? desc(tgt) : null,
             timing: eff ? eff.getTiming() : null, keyframes: kf, playState: an.playState, currentTime: an.currentTime,
             timeline: an.timeline && an.timeline.constructor.name };
  });

  const PROPS = ['opacity','transform','transform-origin','transition','animation','will-change','color','background-color','background-image','font-family','font-size','font-weight','line-height','letter-spacing','border-radius','box-shadow','filter','backdrop-filter','clip-path','overflow','position','display','gap','padding','mask-image'];
  const nodes = [];
  if (root) {
    const all = [root, ...root.querySelectorAll('*')].slice(0, 150);
    for (const el of all) {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const style = {}; for (const p of PROPS) { const v = cs.getPropertyValue(p); if (!v || v === 'none' || v === 'normal' || v === 'auto' || v === 'static' || v === 'visible' || v === '0px' || v === 'all' || v === 'all 0s ease 0s' || v === 'rgba(0, 0, 0, 0)') continue; if (p === 'opacity' && v === '1') continue; if (p === 'transform' && v === 'matrix(1, 0, 0, 1, 0, 0)') continue; if (p === 'transform-origin') continue; style[p] = v; }
      const text = el.childElementCount === 0 ? (el.textContent || '').trim().slice(0, 60) : undefined;
      nodes.push({ el: desc(el), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], text, style,
                   src: el.currentSrc || el.src || undefined });
    }
  }
  const rect = root ? root.getBoundingClientRect() : null;
  return { url: location.href, title: document.title, viewport: [innerWidth, innerHeight], scrollY, devicePixelRatio, libs, fonts,
           target: sel ? { selector: sel, found: !!root, rect: rect && [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)] } : null,
           animations: anims, keyframes, nodes };
}`;

async function runTrigger(page: Page): Promise<number> {
  const now = () => Date.now();
  switch (trigger) {
    case "load": return now(); // handled by the caller: the window starts at navigation
    case "none": return now();
    case "hover": { if (!target) throw new Error("--target or --selector needed for hover"); const pt = await pointAt(page, target, hoverAt[0], hoverAt[1]); const t = now(); await page.mouse.move(pt.x, pt.y); return t; }
    case "leave": { const t = now(); await page.mouse.move(leaveTo[0], leaveTo[1]); return t; }
    case "move": {
      if (!target) throw new Error("--target or --selector needed for move");
      const pts = [] as { x: number; y: number }[];
      for (const [fx, fy] of movePath) pts.push(await pointAt(page, target, fx, fy));
      await page.mouse.move(pts[0].x, pts[0].y);
      const t = now();
      for (let i = 1; i < pts.length; i++) {
        for (let k = 1; k <= 20; k++) { const f = k / 20; await page.mouse.move(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f); await page.waitForTimeout(pathMs / 20); }
      }
      return t;
    }
    case "drag": {
      if (!target) throw new Error("--target or --selector needed for drag");
      const pts = [] as { x: number; y: number }[];
      for (const [fx, fy] of movePath) pts.push(await pointAt(page, target, fx, fy));
      await page.mouse.move(pts[0].x, pts[0].y);
      const t = now();
      await page.mouse.down();
      for (let i = 1; i < pts.length; i++) {
        for (let k = 1; k <= 20; k++) { const f = k / 20; await page.mouse.move(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f); await page.waitForTimeout(pathMs / 20); }
      }
      await page.mouse.up(); // released while still moving, so fling/inertia code sees a velocity
      return t;
    }
    case "click": { if (!target) throw new Error("--target or --selector needed for click"); const t = now(); await page.click(target, { timeout: 10000, noWaitAfter: true }); return t; }
    case "scroll": {
      const steps = num(a["scroll-steps"], 12);
      const ms = num(a["scroll-ms"], 600);
      const from = await page.evaluate(() => window.scrollY);
      let to: number;
      if (a["scroll-to"] !== undefined && a["scroll-to"] !== true && /^\d+$/.test(String(a["scroll-to"]))) to = Number(a["scroll-to"]);
      else {
        const sel = (a["scroll-to"] && a["scroll-to"] !== true) ? String(a["scroll-to"]) : selector;
        if (!sel) throw new Error("--scroll-to or --selector needed for a scroll trigger");
        to = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error("not found: " + s); return window.scrollY + el.getBoundingClientRect().top - innerHeight * 0.25; }, sel);
      }
      const t = now();
      const delta = (to - from) / steps;
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, delta); await page.waitForTimeout(ms / steps); }
      return t;
    }
    default: throw new Error(`unknown trigger ${trigger}`);
  }
}

const browser = await chromium.launch({ headless: !a.headed });
const context = await browser.newContext({
  viewport, deviceScaleFactor: scale,
  colorScheme: a["color-scheme"] || undefined,
  reducedMotion: a["reduced-motion"] || "no-preference",
  recordVideo: wantVideo ? { dir: join(out, ".video"), size: viewport } : undefined,
});
if (trackSelectors.length) await context.addInitScript(TRACKER.replace("__SELS__", JSON.stringify(trackSelectors)));
const page = await context.newPage();
const tPageCreated = Date.now();
if (rate !== 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
}

let tTrigger = Date.now();
let perfAtTrigger: number | null = null; // page clock at the trigger, so track.json has t=0 at the trigger
await page.goto(url, { waitUntil: trigger === "load" ? "commit" : "load", timeout: 60000 });
if (trigger !== "load") {
  await page.waitForTimeout(waitBefore);
  if (preJs) await page.evaluate(preJs);
  if (selector && trigger !== "scroll") {
    const found = await page.$(selector);
    if (!found) throw new Error(`selector not found: ${selector}`);
    await found.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  } else if (trigger === "scroll" && selector) {
    // start just below the fold so the element enters the viewport during the scroll
    await page.evaluate((s) => { const el = document.querySelector(s); if (el) window.scrollTo(0, Math.max(0, window.scrollY + el.getBoundingClientRect().top - innerHeight - 20)); }, selector);
    await page.waitForTimeout(300);
  }
  if (preHover) { const pt = await pointAt(page, preHover, hoverAt[0], hoverAt[1]); await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(preHoverMs); }
  perfAtTrigger = await page.evaluate(() => performance.now());
  tTrigger = await runTrigger(page);
}
await page.waitForTimeout(duration / rate);

// crop rect, measured after the motion (use --clip if the element moves a lot)
let clip = parseRect(a.clip);
if (!clip && selector) {
  const r = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }, selector);
  if (r) clip = { x: Math.max(0, Math.floor(r.x - padPx)), y: Math.max(0, Math.floor(r.y - padPx)), width: Math.ceil(Math.min(viewport.width - r.x + padPx, r.width + 2 * padPx)), height: Math.ceil(Math.min(viewport.height - r.y + padPx, r.height + 2 * padPx)) };
}

const track = trackSelectors.length ? await page.evaluate(() => { const m = (window as any).__mc; m.running = false; return m.samples; }) : [];
const inspect: any = await page.evaluate(`(${INSPECT})(${JSON.stringify(selector ?? null)})`);
await page.screenshot({ path: join(out, "final.png"), clip: clip && clip.width > 0 && clip.height > 0 ? clip : undefined });
await context.close();
await browser.close();

// ---------- video → frames ----------
let frames: any = null;
if (wantVideo) {
  const vdir = join(out, ".video");
  const webm = readdirSync(vdir).filter((f) => f.endsWith(".webm")).map((f) => join(vdir, f)).sort((x, y) => statSync(y).mtimeMs - statSync(x).mtimeMs)[0];
  if (!webm) throw new Error("no video recorded");
  renameSync(webm, join(out, "video.webm"));
  const framesDir = ensureDir(join(out, "frames"));
  for (const f of readdirSync(framesDir)) if (f.endsWith(".png")) require("node:fs").unlinkSync(join(framesDir, f));
  // the video clock starts at page creation; the trigger offset is wall-clock, refine with compare.ts --auto-align
  const triggerOffset = Math.max(0, (tTrigger - tPageCreated) / 1000 - preRoll / 1000);
  const videoFps = fps * rate; // frames per *video* second so that timestamps map to reference time
  const vf = [`fps=${videoFps}`];
  if (clip) vf.push(`crop=${Math.round(clip.width * scale)}:${Math.round(clip.height * scale)}:${Math.round(clip.x * scale)}:${Math.round(clip.y * scale)}`);
  ffmpeg(["-y", "-ss", triggerOffset.toFixed(3), "-i", join(out, "video.webm"), "-t", ((duration + preRoll) / rate / 1000).toFixed(3), "-vf", vf.join(","), join(framesDir, "%04d.png")], { quiet: true });
  const count = readdirSync(framesDir).filter((f) => f.endsWith(".png")).length;
  frames = { fps, count, playbackRate: rate, preRollMs: preRoll, triggerFrame: Math.round((preRoll / 1000) * fps), clip, viewport, scale, note: "frame i is at t = i/fps seconds of reference time, with t=0 at preRoll before the trigger" };
  writeJson(join(out, "frames.json"), frames);
}

// normalise track time: t=0 at the trigger (for --trigger load, at the first animation frame of the document)
const t0 = perfAtTrigger ?? (track.length ? track[0].t : 0);
const trackOut = { selectors: trackSelectors, playbackRate: rate, note: "t in ms of reference time, 0 = trigger; negative samples are before it",
  samples: track.map((s: any) => ({ ...s, t: +((s.t - t0) * rate).toFixed(1) })) };
if (trackSelectors.length) writeJson(join(out, "track.json"), trackOut);
writeJson(join(out, "inspect.json"), inspect);
writeJson(join(out, "capture.json"), { url, out, viewport, scale, fps, rate, trigger, target, selector, clip, duration, preRoll, waitBefore, scrollTo: a["scroll-to"], track: trackSelectors, capturedAt: new Date().toISOString() });

console.log(JSON.stringify({
  out, frames: frames && { count: frames.count, fps, triggerFrame: frames.triggerFrame, clip },
  libs: inspect.libs, fonts: inspect.fonts.slice(0, 8), animations: inspect.animations.length, keyframes: inspect.keyframes.length,
  target: inspect.target, trackSamples: track.length, trackSelectors,
}, null, 2));
