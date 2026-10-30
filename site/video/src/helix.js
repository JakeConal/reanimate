// Every clone at once: a mosaic of the clips in three staggered rows of six, which unravels into one ribbon
// of playing frames wound into a helix at bar 18, then the camera pulls back for a few seconds as it turns.
// The mosaic's tiles become the middle of the ribbon. Tiles turned away are flipped (they are edge-on
// when it happens) so no frame is ever mirrored.
import { bar, clipInfo, clipLen, ease, el, frameUrl, hash, lerp, prog, put, setSrc, setStyle } from "./lib.js";

export const name = "helix";
export const from = 47.2;
export const to = 57.1;

// in the mosaic's reading order
const EXAMPLES = [
  "stripe-agentic-commerce", "stripe-issuing", "resend-cube", "stripe-crypto", "workos-atlas", "clerk-session-management",
  "clerk-fraud", "clerk-magic-links", "reactbits-fading-stars", "clerk-mfa", "liveblocks-comments", "clerk-otp",
  "clerk-social-sign-on", "clerk-bot-detection", "clerk-advanced-security", "clerk-passwords", "clerk-api-keys", "clerk-cli",
];
const LIGHT = new Set(["stripe-agentic-commerce", "stripe-issuing", "stripe-crypto", "workos-atlas"]); // on white; the rest are dark
// where to crop each recording into a 4:3 tile: the card's margin in the recording, and the focus point
const CROP = {
  "stripe-agentic-commerce": [0, 0.5, 0.52], "stripe-issuing": [0, 0.5, 0.42], "stripe-crypto": [0, 0.5, 0.62],
  "workos-atlas": [0, 0.5, 0.42], "clerk-session-management": [24, 0.5, 0.62], "clerk-fraud": [24, 0.5, 0.62],
  "clerk-magic-links": [24, 0.5, 0.58], "clerk-api-keys": [24, 0.42, 0.5],
};

const TW = 340, TH = 255; // tile, px
const R = 1050; // helix radius
const PER_TURN = 18; // frames almost edge to edge, like a film strip
const STEP = 360 / PER_TURN;
const PITCH = 23; // rise per tile: a turn rises a tile and a gap
const N = 54; // three turns
const MID = 27; // the middle of the ribbon, and of the mosaic
const P = 1700; // perspective
const MS = 0.76; // tile scale in the mosaic
const GAP = 20;
// the mosaic's cells, in reading order: three rows of six, the middle one set across by half a tile
const CELLS = [0, 1, 2].flatMap((r) =>
  Array.from({ length: 6 }, (_, c) => ({
    r,
    x: 960 + (c - 2.5 + (r === 1 ? 0.25 : -0.25)) * (TW * MS + GAP),
    y: 500 + (r - 1) * (TH * MS + GAP),
  })),
);
// camera distance from the helix axis when the morph lands (the front tiles a little smaller than in the
// mosaic), and once it has pulled back
const D0 = P / 0.8 - P + R;
const D1 = 2150;

const IN = bar(17) - 0.17; // the mosaic flies in as the last examples leave
const MORPH = [bar(18) - 0.05, bar(18) + 1.45]; // 50.12 → 51.62
const PULLED = MORPH[1] + 2.4; // the camera has pulled back
const FADE = bar(20); // the helix gives way to the install card

// helix tile for each mosaic cell: the middle of the ribbon, the light ones spread out along it and the
// Resend cube in front when it lands
const RIBBON = [6, 7, 0, 8, 12, 1, 13, 10, 14, 2, 15, 3, 11, 16, 9, 4, 17, 5]; // EXAMPLES indices, in ribbon order
const HALF = Math.floor(EXAMPLES.length / 2);
const cellTile = (k) => MID - HALF + RIBBON.indexOf(k);

let root, world, tiles;

// rotation: still during the morph, then speeding up to SPEED deg/s, easing off at the end
const SPEED = 24;
function spin(t) {
  const a = MORPH[1] - 0.6;
  const ramp = 1.6;
  const u = t - a;
  if (u <= 0) return 0;
  const x = Math.min(u, ramp) / ramp;
  let d = SPEED * ramp * (x ** 3 - x ** 4 / 2); // ∫ smoothstep
  if (u > ramp) d += SPEED * (u - ramp);
  return d;
}

export function init(r) {
  root = r;
  world = el("div", "helix-world", root);
  // which example each helix tile shows: the mosaic's cells get theirs; the rest alternate light (Stripe,
  // WorkOS) and dark (the others) so neither clumps
  const show = new Array(N).fill(-1);
  CELLS.forEach((_, k) => (show[cellTile(k)] = k));
  const all = EXAMPLES.map((_, i) => i);
  const pools = [all.filter((i) => LIGHT.has(EXAMPLES[i])), all.filter((i) => !LIGHT.has(EXAMPLES[i]))];
  const next = [0, 0];
  for (let i = 0; i < N; i++) {
    if (show[i] >= 0) continue;
    const pool = pools[i % 2];
    let e;
    do e = pool[next[i % 2]++ % pool.length];
    while (e === show[i - 1] || e === show[i + 1] || e === show[i - PER_TURN] || e === show[i + PER_TURN]);
    show[i] = e;
  }
  tiles = Array.from({ length: N }, (_, i) => {
    const tile = el("div", "tile", world);
    const slug = EXAMPLES[show[i]];
    const info = clipInfo(slug);
    const [inset, fx, fy] = (CROP[slug] ?? [0, 0.5, 0.5]).map((v, j) => (j === 0 && slug.startsWith("clerk") ? 8 : v)); // Clerk: keep a white margin round the card
    const iw = info.width - 2 * inset, ih = info.height - 2 * inset;
    const k = Math.max(TW / iw, TH / ih);
    const img = el("img", "", tile);
    Object.assign(img.style, {
      width: `${info.width * k}px`,
      height: `${info.height * k}px`,
      left: `${-(inset + (iw - TW / k) * fx) * k}px`,
      top: `${-(inset + (ih - TH / k) * fy) * k}px`,
    });
    Object.assign(tile, { _img: img, _slug: slug, _off: hash(i * 7 + 3) * clipLen(slug), _theta: i * STEP, _y: (i - MID) * PITCH });
    return tile;
  });
  tiles.forEach((tile) => (tile._cell = null));
  CELLS.forEach((cell, k) => (tiles[cellTile(k)]._cell = cell));
}

export function render(t) {
  const morph = ease.inOutCubic(prog(t, ...MORPH));
  const phi = -tiles[MID]._theta - spin(t) + spin(MORPH[1]); // the middle tile faces front when the morph lands
  const zoom = ease.inOutCubic(prog(t, MORPH[1] - 0.5, PULLED));
  const D = lerp(D0, D1, zoom) + 160 * ease.inOutSine(prog(t, PULLED, to));
  const tilt = -21 * ease.inOutCubic(prog(t, MORPH[0] + 0.3, PULLED + 0.4)) + 6 * ease.inOutSine(prog(t, PULLED + 0.4, to));
  const lean = -7 * ease.inOutCubic(prog(t, MORPH[1] - 0.4, PULLED + 0.6)) + 3 * ease.inOutSine(prog(t, PULLED + 0.6, to));
  const lift = -40 - tiles[MID]._y - 70 * ease.inOutCubic(prog(t, MORPH[0] + 0.3, PULLED + 0.4)); // the near ring sits lower; lift it to centre the coil
  const tau = (tilt * Math.PI) / 180;
  const ct = Math.cos(tau), st = Math.sin(tau);
  const fade = ease.inOutCubic(prog(t, FADE - 0.4, FADE + 1.4));
  const tq = Math.floor(t * 30) / 30; // tiles play at 30 fps

  put(world, { o: 1 - fade, blur: fade * 14, s: lerp(1, 0.9, fade), rz: lean });

  for (let i = 0; i < N; i++) {
    const tile = tiles[i];
    // on the helix
    const psi = tile._theta + phi;
    const pr = (psi * Math.PI) / 180;
    const X = R * Math.sin(pr);
    const Y0 = tile._y + lift;
    const Z0 = R * Math.cos(pr);
    const Y = Y0 * ct - Z0 * st;
    const Z = Y0 * st + Z0 * ct - D;
    // turned away from the camera? (normal · direction to the camera)
    const nx = Math.sin(pr), ny = -Math.cos(pr) * st, nz = Math.cos(pr) * ct;
    const back = nx * -X + ny * -Y + nz * (P - Z) < 0;
    let yaw = psi + (back ? 180 : 0);
    yaw = ((((yaw + 180) % 360) + 360) % 360) - 180;
    const front = (Math.cos(pr) + 1) / 2;

    let x = X, y = Y, z = Z, rx = tilt, ry = yaw, o, blur, sc = 1;
    const helixO = 0.05 + 0.95 * front ** 2.2;
    const helixBlur = (1 - front) ** 1.5 * 8;
    if (tile._cell) {
      // a mosaic cell: flies in, plays, then curls onto the helix
      const { r, x: cx, y: cy } = tile._cell;
      const gx = cx - 960, gy = cy - 540;
      const d = Math.hypot((cx - 960) / (TW * MS + GAP), r - 1);
      const a = ease.expo(prog(t, IN + d * 0.06, IN + 0.75 + d * 0.06));
      const settle = 1 - 0.035 * ease.inOutSine(prog(t, IN + 0.7, MORPH[0]));
      const gz = (1 - a) * 900 - (1 - settle) * 400;
      x = lerp(gx, X, morph);
      y = lerp(gy, Y, morph);
      z = lerp(gz, Z, morph);
      rx = tilt * morph;
      ry = yaw * morph;
      o = lerp(a, helixO, morph);
      blur = lerp((1 - a) * 18, helixBlur, morph);
      sc = lerp(MS, 1, morph);
    } else {
      const a = ease.expo(prog(t, MORPH[0] + 0.25 + hash(i) * 0.9, MORPH[0] + 1.1 + hash(i) * 0.9));
      o = helixO * a;
      blur = helixBlur + (1 - a) * 12;
      z -= (1 - a) * 500;
    }
    if (o <= 0.003) {
      put(tile, { o: 0 });
      continue;
    }
    setSrc(tile._img, frameUrl(tile._slug, tile._off + (tq - IN) * 0.9, { small: true, loop: true }));
    put(tile, { o, x, y, z, rx, ry, s: sc, blur });
    setStyle(tile, "z-index", String(Math.round(z + 20000)));
  }
}
