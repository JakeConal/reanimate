// Films the original and the clone the same way (same browser, viewport, scroll, pointer path and
// timing) at 2x device pixels and 60 fps, for the site and the README.
//
//   bun run preview                                  # serves the site on http://localhost:8787
//   bun run media [--only stripe-issuing,…] [--site http://localhost:8787] [--keep <dir>]
//
// For each clip in CLIPS: public/media/<slug>/compare.mp4 (both recordings in one file) and
// poster.webp (see src/examples.ts).
// Then the README animations in ../.github/assets/.
// Needs Playwright's Chromium (bunx playwright install chromium), ffmpeg, cwebp and webpmux on PATH.
import { chromium, type Browser } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

type Clip = {
  slug: string;
  reference: string;
  clone: string; // path on the local site
  select: string[]; // what to film: the crop is these elements' union plus PAD, on both pages
  trigger: "scroll" | "hover"; // scroll: the entrance as they scroll into view; hover: HOVER_PATH over the first
  pin?: number; // Math.random returns this from just before the trigger, so random picks come out the same on both pages
};

const bento = (card: string) => `.modular-solutions-bento__card-${card}`;
const CLIPS: Clip[] = [
  { slug: "stripe-bento", reference: "https://stripe.com/", clone: "/examples/stripe-bento/", select: ["agentic-commerce", "issuing", "crypto"].map(bento), trigger: "scroll" },
  { slug: "stripe-agentic-commerce", reference: "https://stripe.com/", clone: "/examples/stripe-bento/", select: [bento("agentic-commerce")], trigger: "hover" },
  { slug: "stripe-issuing", reference: "https://stripe.com/", clone: "/examples/stripe-bento/", select: [bento("issuing")], trigger: "hover" },
  { slug: "stripe-crypto", reference: "https://stripe.com/", clone: "/examples/stripe-bento/", select: [bento("crypto")], trigger: "hover" },
  { slug: "workos-atlas", reference: "https://workos.com/atlas", clone: "/examples/workos-atlas/", select: ['[aria-label^="Atlas reaching out"]'], trigger: "scroll", pin: 0.37 },
];

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    site: { type: "string", default: "http://localhost:8787" },
    keep: { type: "string" },
  },
});

const ROOT = join(import.meta.dirname, "..");
const README_ASSETS = join(ROOT, "..", ".github", "assets");
const WORK = args.keep ?? mkdtempSync(join(tmpdir(), "record-media-"));

const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;
const FPS = 60;
const TOP = 112; // where the filmed elements sit in the viewport
const PAD = 10; // CSS px kept around them; the bento hover growth (3.55 px a side) stays inside
const ENTRANCE_MS = 5800;
const ENTRANCE_LEAD_MS = 300; // at most this much before content first appears is kept
const HOVER_MS = 5000;
const COMPARE_WIDTH = 1120; // compare.mp4, in px: 2x the page column
const COMPARE_GAP = 24;
const COMPARE_HOLD_MS = 1000; // the last frame is held this long before the loop starts again
// Pointer path, as fractions of the element's box: in from the left, hold, across, hold, out to the
// right. Times in ms from the start of the clip.
const HOVER_PATH: [number, number, number][] = [
  [0, -0.12, 0.55],
  [500, -0.12, 0.55],
  [850, 0.35, 0.42],
  [1850, 0.35, 0.42],
  [2850, 0.7, 0.7],
  [3350, 0.7, 0.7],
  [3700, 1.12, 0.82],
];

// A visible pointer, so viewers can see what the hover clips react to. Drawn in the page, ignored by
// hit testing, identical on both sites.
const CURSOR = `addEventListener("DOMContentLoaded", () => {
  const el = document.createElement("div");
  el.innerHTML = '<svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg"><path d="M2 2v20.5l5.4-5.2 3.6 8.4 3.5-1.5-3.6-8.3H18z" fill="#0a0a0a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  el.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;display:none;filter:drop-shadow(0 1px 2px rgb(0 0 0 / .3))";
  document.documentElement.append(el);
  addEventListener("mousemove", (e) => { el.style.display = "block"; el.style.transform = "translate(" + (e.clientX - 2) + "px," + (e.clientY - 2) + "px)"; }, { capture: true, passive: true });
});`;

// Example pages hold little more than the clone itself; pad them so it starts below the fold and
// lazy-mounts on scroll, as it does on the original page.
const PUSH_DOWN = `addEventListener("DOMContentLoaded", () => { document.body.style.padding = "1800px 0 900px"; });`;

type Box = { x: number; y: number; width: number; height: number };
type Take = { frames: { file: string; t: number }[]; start: number; ms: number; clip: Box; small: number };
type Side = "reference" | "clone";
const SIDES: Side[] = ["reference", "clone"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function run(cmd: string, argv: string[]) {
  const r = spawnSync(cmd, argv, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr?.toString().slice(-2000)}`);
  return r.stdout;
}

async function film(browser: Browser, clip: Clip, side: Side): Promise<Take> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  await context.addInitScript(CURSOR);
  if (side === "clone") await context.addInitScript(PUSH_DOWN);
  const page = await context.newPage();
  await page.goto(side === "clone" ? new URL(clip.clone, args.site).href : clip.reference, { waitUntil: "load", timeout: 60_000 });

  // The screencast delivers frames at the window's size in CSS px, whatever the device scale. So the
  // window is made SCALE times larger and the emulated 1440x900 view is zoomed to fill it: the page
  // still lays out at 1440x900 and the frames come out in device pixels. Playwright re-applies its own
  // emulation now and then (a cross-site navigation swaps the renderer), so this runs again right
  // before filming and every frame's size is checked.
  const cdp = await context.newCDPSession(page);
  const zoom = async () => {
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE + 200 } });
    await cdp.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: SCALE, mobile: false, scale: SCALE });
  };
  await page.evaluate(() => document.fonts.ready);
  await sleep(1500);

  const boxes: Box[] = await page.evaluate(
    (sels) =>
      sels.map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
      }),
    clip.select,
  );
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const top = Math.min(...boxes.map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  const crop = { x: left - PAD, y: TOP - PAD, width: right - left + 2 * PAD, height: bottom - top + 2 * PAD };
  const scrollY = top - TOP;
  const scrollIn = () => page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
  // Pinned after load: the pages' other code calls Math.random a different number of times, so a seed
  // would not line the picks up.
  if (clip.pin !== undefined) await page.evaluate((v) => (Math.random = () => v), clip.pin);

  if (clip.trigger === "hover") {
    await scrollIn();
    await sleep(6000); // let the entrance finish
  }

  const dir = join(WORK, `${clip.slug}-${side}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: Take["frames"] = [];
  let recording = false;
  let wide = 0;
  let small = 0;
  const seen: number[] = [];
  cdp.on("Page.screencastFrame", (f) => {
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    const ok = f.metadata.deviceWidth >= VIEWPORT.width * SCALE;
    seen.push(f.metadata.deviceWidth);
    if (!recording) return void (wide = ok ? wide + 1 : 0);
    if (!ok) small++;
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: (f.metadata.timestamp ?? Date.now() / 1000) * 1000 });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95 });
  // Frames only come when the page paints, and the zoom only lands with a new frame, so a page at
  // rest gets a speck in its corner that repaints every frame until the zoom has landed.
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.id = "record-media-tick";
    el.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;z-index:2147483647;pointer-events:none";
    document.documentElement.append(el);
    let n = 0;
    const tick = () => {
      if (!el.isConnected) return;
      el.style.background = n++ % 2 ? "rgb(255 255 255 / .01)" : "rgb(255 255 255 / .02)";
      requestAnimationFrame(tick);
    };
    tick();
  });
  for (let i = 0; wide < 5; i++) {
    if (i === 20) throw new Error(`${clip.slug} ${side}: the window would not zoom (frame widths: ${seen.slice(-12).join(" ") || "none"})`);
    await zoom();
    await sleep(250);
  }
  await page.evaluate(() => document.getElementById("record-media-tick")?.remove());
  recording = true;
  await sleep(300);

  let start: number;
  let ms: number;
  if (clip.trigger === "scroll") {
    await scrollIn();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    start = Date.now(); // the elements are on screen, not yet mounted
    ms = ENTRANCE_MS + 2500;
    await sleep(ms);
  } else {
    // Mouse input lands in the zoomed window's coordinates, so CSS px are scaled up to match.
    const box = boxes[0];
    const at = (fx: number, fy: number) => ({ x: (box.x + box.width * fx) * SCALE, y: (box.y - scrollY + box.height * fy) * SCALE });
    const p0 = at(HOVER_PATH[0][1], HOVER_PATH[0][2]);
    await page.mouse.move(p0.x, p0.y);
    start = Date.now();
    ms = HOVER_MS;
    for (;;) {
      const t = Date.now() - start;
      const i = HOVER_PATH.findIndex(([when]) => when > t);
      if (i < 0) break;
      const [t0, x0, y0] = HOVER_PATH[i - 1];
      const [t1, x1, y1] = HOVER_PATH[i];
      const k = (t - t0) / (t1 - t0);
      const e = k * k * (3 - 2 * k); // smoothstep: the pointer speeds up and settles like a hand
      const p = at(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e);
      await page.mouse.move(p.x, p.y);
      await sleep(8);
    }
    await sleep(HOVER_MS - (Date.now() - start) + 500);
  }
  await cdp.send("Page.stopScreencast");
  await context.close();
  return { frames, start, ms, clip: crop, small };
}

// Screencast frames arrive only when the page changes: hold each until the next, crop, and resample
// to a constant 60 fps. Writes a visually lossless master with t=0 at the take's start.
function master(take: Take, out: string) {
  const first = Math.max(0, take.frames.findLastIndex((f) => f.t <= take.start));
  const frames = take.frames.slice(first);
  const list = frames.map((f, i) => {
    const t = i === 0 ? take.start : f.t;
    const next = i + 1 < frames.length ? frames[i + 1].t : take.start + take.ms;
    return `file '${f.file}'\nduration ${Math.max(0.001, (next - t) / 1000).toFixed(4)}`;
  });
  list.push(`file '${frames.at(-1)!.file}'`);
  writeFileSync(`${out}.txt`, list.join("\n") + "\n");
  const c = take.clip;
  const crop = `crop=${Math.round(c.width * SCALE)}:${Math.round(c.height * SCALE)}:${Math.round(c.x * SCALE)}:${Math.round(c.y * SCALE)}`;
  run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${out}.txt`, "-vf", `${crop},fps=${FPS},format=yuv444p`, "-t", (take.ms / 1000).toFixed(3), "-c:v", "libx264", "-crf", "6", "-preset", "fast", out]);
}

// When content first appears after the scroll, in ms: the first frame that differs from the empty
// elements by more than a sliver. The two entrances are lined up on it, since the lazy loading
// before it depends on the network.
const dims = (file: string) =>
  run("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).toString().trim().split(",").map(Number);

function contentAppears(file: string): number {
  const [w, h] = dims(file);
  const sw = 96;
  const sh = Math.round((h / w) * sw / 2) * 2;
  const raw = run("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${sw}:${sh},format=gray`, "-f", "rawvideo", "-"]);
  const size = sw * sh;
  const from = Math.round(0.15 * FPS); // after the jump scroll has painted
  const base = raw.subarray(from * size, (from + 1) * size);
  for (let i = from + 1; (i + 1) * size <= raw.length; i++) {
    let changed = 0;
    for (let p = 0; p < size; p++) if (Math.abs(raw[i * size + p] - base[p]) > 12) changed++;
    if (changed / size > 0.01) return (i / FPS) * 1000;
  }
  throw new Error(`no content appeared in ${file}`);
}

// The original and the clone in one file, so the page never has to keep two videos in step: side by
// side, or stacked when the recordings are wider than tall.
function compareMp4(panels: { file: string; from: number }[], ms: number, out: string) {
  const [w, h] = dims(panels[0].file);
  const side = w <= h;
  const pw = side ? (COMPARE_WIDTH - COMPARE_GAP) / 2 : COMPARE_WIDTH;
  const fit = `scale=${pw}:${Math.round((pw * h) / w / 2) * 2}:flags=lanczos,setsar=1`;
  // the gap takes the colour of the original's page, from its top-left corner
  const rgb = run("ffmpeg", ["-v", "error", "-ss", (panels[0].from / 1000).toFixed(3), "-i", panels[0].file, "-frames:v", "1", "-vf", "format=rgb24,crop=1:1:1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const bg = `0x${[...rgb.subarray(0, 3)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const gap = side ? `pad=iw+${COMPARE_GAP}:ih:0:0:${bg}` : `pad=iw:ih+${COMPARE_GAP}:0:0:${bg}`;
  const argv = ["-y", "-v", "error"];
  for (const p of panels) argv.push("-ss", (p.from / 1000).toFixed(3), "-t", (ms / 1000).toFixed(3), "-i", p.file);
  const graph = `[0:v]${fit},${gap}[a];[1:v]${fit}[b];[a][b]${side ? "hstack" : "vstack"},tpad=stop_mode=clone:stop_duration=${COMPARE_HOLD_MS / 1000},format=yuv420p[out]`;
  run("ffmpeg", [...argv, "-filter_complex", graph, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", out]);
}

const poster = (src: string, at: number, out: string) => {
  const png = `${out}.png`;
  run("ffmpeg", ["-y", "-v", "error", "-ss", (at / 1000).toFixed(3), "-i", src, "-frames:v", "1", png]);
  run("cwebp", ["-quiet", "-q", "88", "-m", "6", "-sharp_yuv", png, "-o", out]);
  rmSync(png);
};

// A caption strip for the README animations: white, label on the left, `width` px wide.
async function strip(browser: Browser, label: string, note: string, width: number) {
  const out = join(WORK, `strip-${label}-${width}-${note.length}.png`);
  const page = await browser.newPage({ viewport: { width: width / 2, height: 30 }, deviceScaleFactor: 2 });
  await page.setContent(`<body style="margin:0;background:#fff;font:600 11px/32px -apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#0a0a0a;padding:0 5px;-webkit-font-smoothing:antialiased">
    ${label} <span style="color:#8a8a8a;font-weight:400">· ${note}</span></body>`);
  await page.screenshot({ path: out });
  await page.close();
  return out;
}

// README animation: each panel under its caption strip, stacked or side by side, 20 fps. libwebp's
// animation encoder carries "similar" blocks over from the previous frame, which leaves a patchwork
// on slow gradients and saves little here (the particles change everywhere), so every frame is
// encoded on its own and the frames are muxed.
function readmeWebp(panels: { file: string; from: number; strip: string }[], layout: "stack" | "side", width: number, ms: number, out: string) {
  const fps = 20;
  const dir = join(WORK, `readme-${Date.now()}`);
  mkdirSync(dir);
  const pw = layout === "stack" ? width : width / panels.length;
  const argv = ["-y", "-v", "error"];
  for (const p of panels) argv.push("-ss", (p.from / 1000).toFixed(3), "-t", (ms / 1000).toFixed(3), "-i", p.file);
  for (const p of panels) argv.push("-framerate", String(fps), "-loop", "1", "-i", p.strip);
  const n = panels.length;
  const graph = panels.flatMap((_, k) => [`[${k}:v]fps=${fps},scale=${pw}:-2:flags=lanczos[v${k}]`, `[${n + k}:v][v${k}]vstack=shortest=1[p${k}]`]);
  graph.push(`${panels.map((_, k) => `[p${k}]`).join("")}${layout === "stack" ? "vstack" : "hstack"}=inputs=${n},format=rgb24[out]`);
  run("ffmpeg", [...argv, "-filter_complex", graph.join(";"), "-map", "[out]", "-t", (ms / 1000).toFixed(3), join(dir, "%04d.png")]);
  const pngs = readdirSync(dir).sort().map((f) => join(dir, f));
  run("sh", ["-c", `ls "${dir}"/*.png | xargs -P 8 -I{} cwebp -quiet -q 72 -m 4 -sharp_yuv {} -o {}.webp`]);
  run("webpmux", [...pngs.flatMap((f) => ["-frame", `${f}.webp`, `+${1000 / fps}+0+0+0-b`]), "-loop", "0", "-o", out]);
  rmSync(dir, { recursive: true });
}

const only = args.only?.split(",");
const browser = await chromium.launch({ channel: "chromium", args: ["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"] });
console.log("work dir:", WORK);
const masters: Record<string, { file: string; from: number }> = {};

for (const clip of CLIPS) {
  if (only && !only.includes(clip.slug)) continue;
  const out = join(ROOT, "public", "media", clip.slug);
  mkdirSync(out, { recursive: true });
  const takes: Record<string, { file: string; appear: number }> = {};
  for (const side of SIDES) {
    // A busy page (stripe.com is heavy) sometimes renders at half speed for a while, and the pointer
    // and frames lag behind; the zoom can also drop mid-take. Film again when either happens.
    let take: Take;
    for (let attempt = 1; ; attempt++) {
      take = await film(browser, clip, side);
      const t0 = take.start;
      const fps = take.frames.filter((f) => f.t >= t0 && f.t < t0 + take.ms).length / (take.ms / 1000);
      console.log(`${clip.slug} ${side}: ${fps.toFixed(0)} fps${take.small ? `, ${take.small} frames at 1x` : ""}`);
      if ((fps >= 50 && !take.small) || attempt === 4) break;
    }
    if (take!.small) throw new Error(`${clip.slug} ${side}: frames kept coming out at 1x`);
    const file = join(WORK, `${clip.slug}-${side}.mkv`);
    master(take!, file);
    takes[side] = { file, appear: clip.trigger === "scroll" ? contentAppears(file) : 0 };
  }
  const lead = Math.min(ENTRANCE_LEAD_MS, ...SIDES.map((s) => takes[s].appear));
  const ms = clip.trigger === "scroll" ? ENTRANCE_MS : HOVER_MS;
  for (const side of SIDES) masters[`${clip.slug}-${side}`] = { file: takes[side].file, from: takes[side].appear - lead };
  compareMp4(SIDES.map((side) => masters[`${clip.slug}-${side}`]), ms, join(out, "compare.mp4"));
  // At rest: the end of an entrance, the start of a hover.
  poster(takes.clone.file, clip.trigger === "scroll" ? takes.clone.appear - lead + ms - 100 : 0, join(out, "poster.webp"));
}

if (masters["stripe-bento-reference"]) {
  const w = 960;
  readmeWebp(
    [
      { ...masters["stripe-bento-reference"], strip: await strip(browser, "stripe.com", "the original", w) },
      { ...masters["stripe-bento-clone"], strip: await strip(browser, "reanimate", "the copy, filmed the same way", w) },
    ],
    "stack",
    w,
    4800,
    join(README_ASSETS, "entrance.webp"),
  );
  console.log("README entrance.webp");
}
if (masters["stripe-issuing-reference"]) {
  const w = 720;
  readmeWebp(
    [
      { ...masters["stripe-issuing-reference"], strip: await strip(browser, "stripe.com", "original", w / 2) },
      { ...masters["stripe-issuing-clone"], strip: await strip(browser, "reanimate", "copy", w / 2) },
    ],
    "side",
    w,
    HOVER_MS,
    join(README_ASSETS, "hover.webp"),
  );
  console.log("README hover.webp");
}

await browser.close();
if (!args.keep) rmSync(WORK, { recursive: true, force: true });
