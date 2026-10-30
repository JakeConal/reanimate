// The demo video: a 1920x1080 stage drawn from the time alone. Scenes, in order, with the bars of the
// soundtrack they sit on (90 bpm, bar n starts at 2.166 + n * 2.667 s):
//
//   intro     0 – 28.8   "/reanimate", the prompts on a picker wheel (bars 0–4), then the header above "how it works"
//   how      12.8 – 28.8  record, spec, build, verify, repeat (bars 4–10)
//   examples 28.5 – 48.1  the clones, a few at a time (bars 10–17)
//   helix    47.2 – 57.1  every clone in a mosaic (bar 17), then their frames on a turning helix (bars 18–20)
//   install  56.3 – end   the install command (bars 20.5–23.25)
import { DURATION, FPS, H, W, setManifest, settleImages, show } from "./lib.js";
import * as intro from "./intro.js";
import * as how from "./how.js";
import * as examples from "./examples.js";
import * as helix from "./helix.js";
import * as install from "./install.js";

const scenes = [intro, how, examples, helix, install];
const roots = new Map();
const stage = document.getElementById("stage");
const RENDER = document.documentElement.hasAttribute("data-render");

function draw(t) {
  for (const s of scenes) {
    const on = t >= s.from && t < s.to;
    show(roots.get(s), on);
    if (on) s.render(t);
  }
}

async function boot() {
  await Promise.all(["600 100px Inter", "400 20px Inter", "400 20px 'JetBrains Mono'", "italic 400 20px 'Instrument Serif'"].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  setManifest(await (await fetch("clips/manifest.json")).json());
  for (const s of scenes) {
    const root = document.createElement("section");
    root.className = `scene scene--${s.name}`;
    stage.append(root);
    roots.set(s, root);
    s.init(root);
  }
  window.__video = {
    duration: DURATION,
    fps: FPS,
    size: [W, H],
    async seek(t) {
      draw(t);
      await settleImages();
    },
  };
  if (!RENDER) player();
  else draw(0);
}

function player() {
  const audio = document.getElementById("audio");
  const scrub = document.getElementById("scrub");
  const time = document.getElementById("time");
  const play = document.getElementById("play");
  const viewport = document.getElementById("viewport");
  let t = Number(new URLSearchParams(location.search).get("t") || 0);

  const fit = () => {
    const k = Math.min(innerWidth / W, (innerHeight - 56) / H);
    stage.style.transform = `scale(${k})`;
    viewport.style.width = `${W * k}px`;
    viewport.style.height = `${H * k}px`;
  };
  fit();
  addEventListener("resize", fit);

  const paint = () => {
    draw(t);
    scrub.value = String(t);
    time.textContent = t.toFixed(2);
  };
  const loop = () => {
    if (audio.paused) return;
    t = audio.currentTime;
    if (t >= DURATION) audio.pause();
    paint();
    requestAnimationFrame(loop);
  };
  const toggle = () => {
    if (audio.paused) {
      audio.currentTime = t >= DURATION - 0.05 ? 0 : t;
      audio.play();
      play.textContent = "Pause";
      requestAnimationFrame(loop);
    } else {
      audio.pause();
      t = audio.currentTime;
      play.textContent = "Play";
      paint();
    }
  };
  const seek = (to) => {
    t = Math.min(DURATION, Math.max(0, to));
    audio.currentTime = t;
    paint();
  };
  play.addEventListener("click", toggle);
  scrub.addEventListener("input", () => seek(Number(scrub.value)));
  addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    }
    if (e.code === "ArrowRight") seek(t + (e.shiftKey ? 1 : 1 / FPS));
    if (e.code === "ArrowLeft") seek(t - (e.shiftKey ? 1 : 1 / FPS));
  });
  paint();
}

boot();
