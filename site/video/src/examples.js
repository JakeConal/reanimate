// The clones, quickly. The Stripe and WorkOS ones ride a track, a step every two beats, the one in focus
// sharp and its neighbours blurred; then Liveblocks' app window gets a bar to itself, the Clerk cards come
// in a bar at a time, in groups, and the Resend cube and React Bits' fading stars after them. Each clip
// plays from the moment it takes focus.
// The last group gives way to the mosaic in helix.js.
import { bar, clamp, clipInfo, ease, el, frameUrl, lerp, presence, prog, put, setSrc } from "./lib.js";

export const name = "examples";
export const from = 28.5;
export const to = 48.1;

// A clip on a card: its frames, scaled, with a soft shadow under the card inside the frame.
// inset: the card's margin inside the recording (the Clerk cards were filmed with 24 px around them).
const LOOK = {
  stripe: { inset: 0, radius: 6, shadow: true },
  clerk: { inset: 24, radius: 16, shadow: true },
  workos: { inset: 0, radius: 0, shadow: false },
  resend: { inset: 0, radius: 16, shadow: true },
  reactbits: { inset: 0, radius: 16, shadow: true },
  liveblocks: { inset: 0, radius: 14, shadow: true },
};
function card(parent, slug, scale) {
  const c = clipInfo(slug);
  const look = LOOK[slug.split("-")[0]];
  const w = c.width * scale, h = c.height * scale;
  const g = el("div", "ex-card", parent);
  Object.assign(g.style, { width: `${w}px`, height: `${h}px` });
  if (look.shadow) {
    const sh = el("div", "ex-shadow", g);
    const i = look.inset * scale;
    Object.assign(sh.style, { left: `${i}px`, top: `${i}px`, right: `${i}px`, bottom: `${i}px`, borderRadius: `${look.radius * scale}px` });
  }
  g._img = el("img", "fill", g);
  g._img.style.borderRadius = `${look.radius * scale}px`;
  Object.assign(g, { _slug: slug, _w: w, _h: h });
  return g;
}

// ---- the track ----
const TRACK = [
  { slug: "stripe-agentic-commerce", scale: 640 / 676, at: bar(10), from: 0.2, speed: 1.25 },
  { slug: "stripe-issuing", scale: 640 / 676, at: bar(10.5), from: 0.3, speed: 1 },
  { slug: "stripe-crypto", scale: 640 / 676, at: bar(11), from: 0.4, speed: 1 },
  { slug: "workos-atlas", scale: 620 / 536, at: bar(11.5), from: 0, speed: 1.1 },
];
const SPACING = 600;
const TRACK_OUT = bar(12) - 0.25;

function trackPos(t) {
  let p = lerp(-1.7, 0, ease.expo(prog(t, 28.55, 29.35)));
  for (let k = 1; k < TRACK.length; k++) p += ease.expo(prog(t, TRACK[k].at - 0.12, TRACK[k].at + 0.6));
  return p + 1.6 * ease.inOutCubic(prog(t, TRACK_OUT, TRACK_OUT + 0.55));
}

// ---- the groups: [slug, x, y] in px of the recordings, scaled by `scale` ----
const GROUPS = [
  { at: bar(12), scale: 1.05, cards: [["liveblocks-comments", 0, 0]] },
  { at: bar(13), scale: 1.18, cards: [["clerk-session-management", 0, 0], ["clerk-fraud", 443, 0], ["clerk-magic-links", 886, 0]] },
  { at: bar(14), scale: 1.1, cards: [["clerk-mfa", 0, 0], ["clerk-otp", 443, 0], ["clerk-social-sign-on", 886, 0], ["clerk-bot-detection", 0, 308], ["clerk-advanced-security", 443, 308], ["clerk-passwords", 886, 308]] },
  { at: bar(15), scale: 1.28, cards: [["clerk-api-keys", 0, 0], ["clerk-cli", 845, 0]] },
  { at: bar(16), scale: 0.95, cards: [["resend-cube", 0, 25], ["reactbits-fading-stars", 688, 0]] },
];
const GROUP_END = bar(17);
const CY = 525; // the cards' centre line

let root, label, track, groups;

export function init(r) {
  root = r;
  label = el("div", "ex-label", root, "Examples, each rebuilt by its own agent with reanimate");
  track = TRACK.map((x) => Object.assign(card(root, x.slug, x.scale), { _x: x }));
  groups = GROUPS.map((g) => {
    const box = el("div", "ex-group", root);
    box._w = Math.max(...g.cards.map(([slug, x]) => x + clipInfo(slug).width)) * g.scale;
    box._h = Math.max(...g.cards.map(([slug, , y]) => y + clipInfo(slug).height)) * g.scale;
    box._cards = g.cards.map(([slug, x, y], i) => {
      const c = card(box, slug, g.scale);
      Object.assign(c, { _cx: x * g.scale, _cy: y * g.scale, _i: i });
      return c;
    });
    box._g = g;
    Object.assign(box.style, { width: `${box._w}px`, height: `${box._h}px` });
    return box;
  });
}

export function render(t) {
  const lab = presence(t, 28.95, 0.6, GROUP_END - 0.22, 0.4);
  put(label, { o: lab.v, y: 74 + (1 - lab.a) * 12 - lab.b * 10, blur: 10 * Math.max(1 - lab.a, lab.b) });

  // ---- track ----
  const pos = trackPos(t);
  const trackOut = ease.inOutCubic(prog(t, TRACK_OUT, TRACK_OUT + 0.5));
  track.forEach((c, k) => {
    const d = k - pos;
    const ad = Math.abs(d);
    if (ad > 2.2 || t > TRACK_OUT + 0.6) return put(c, { o: 0 });
    const x = c._x;
    const focus = clamp(1 - ad);
    const s = lerp(0.8, 1, focus);
    const lt = x.from + x.speed * Math.max(0, t - (x.at - 0.25));
    setSrc(c._img, frameUrl(x.slug, lt));
    put(c, {
      o: clamp(1 - ad * 0.62) * clamp(1.5 - ad * 0.5) * (1 - trackOut) * clamp((t - 28.5) * 3),
      x: 960 + d * SPACING - c._w / 2,
      y: CY - c._h / 2 + (1 - focus) * 14,
      s,
      blur: Math.min(1, ad) * 11 + trackOut * 10,
    });
  });

  // ---- Clerk groups ----
  groups.forEach((box, gi) => {
    const g = box._g;
    // the last group shrinks away as the mosaic of all of them flies in: the first step of the zoom out
    const last = gi === GROUPS.length - 1;
    const next = last ? GROUP_END : GROUPS[gi + 1].at;
    const out = ease.inOutCubic(prog(t, next - 0.3, next + 0.2));
    if (t < g.at - 0.4 || out >= 1) return put(box, { o: 0 });
    const top = CY - box._h / 2;
    put(box, { o: 1, x: 960 - box._w / 2, y: top, s: last ? lerp(1, 0.62, out) : 1 });
    box._cards.forEach((c) => {
      const a = ease.expo(prog(t, g.at - 0.28 + c._i * 0.07, g.at + 0.42 + c._i * 0.07));
      const lt = Math.max(0, t - (g.at - 0.1));
      setSrc(c._img, frameUrl(c._slug, lt));
      put(c, {
        o: a * (1 - out),
        x: c._cx + (1 - a) * 140 - (last ? 0 : out * 160),
        y: c._cy + (1 - a) * 10,
        s: lerp(0.94, 1, a) * (last ? 1 : lerp(1, 0.96, out)),
        blur: (1 - a) * 16 + out * 16,
      });
    });
  });
}
