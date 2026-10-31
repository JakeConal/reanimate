import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";
import { SCRIPTS_DIR } from "./lib.ts";

function run(script: string, args: string[], cwd = SCRIPTS_DIR) {
  const result = spawnSync(process.execPath, [join(SCRIPTS_DIR, script), ...args], {
    cwd, encoding: "utf8", timeout: 60_000, maxBuffer: 8 << 20,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test("all capture and analysis CLIs expose help", () => {
  for (const script of ["capture.ts", "frames.ts", "compare.ts", "sheet.ts", "easing.ts", "gl.ts"]) {
    expect(run(script, ["--help"])).toContain(script);
  }
}, 30_000);

test("local HTML capture, extraction, comparison and sheets work from paths with spaces and #", () => {
  const dir = mkdtempSync(join(tmpdir(), "reanimate smoke # "));
  try {
    const html = join(dir, "animated fixture #.html");
    writeFileSync(html, `<!doctype html><style>
      body { margin:0; background:#111 }
      .box { width:32px; height:32px; background:#f80; position:absolute; top:40px; left:20px }
      </style><div class="box"></div><script>
      document.querySelector('.box').animate(
        [{ transform:'translateX(0px)' }, { transform:'translateX(100px)' }],
        { duration:400, fill:'forwards', easing:'linear' }
      );</script>`);
    for (const name of ["ref", "clone"]) {
      run("capture.ts", ["--url", html, "--out", join(dir, name), "--viewport", "240x120",
        "--track", ".box", "--clock", "virtual", "--trigger", "load", "--duration", "600",
        "--pre-roll", "0", "--wait-before", "0", "--fps", "10"], dir);
    }
    const ref = join(dir, "ref", "frames"), clone = join(dir, "clone", "frames");
    const images = readdirSync(ref).filter((p) => p.endsWith(".png")).sort();
    expect(images.length).toBeGreaterThanOrEqual(6);
    const first = readFileSync(join(ref, images[0]));
    const last = readFileSync(join(ref, images[images.length - 1]));
    expect(PNG.sync.read(first).width).toBe(240);
    expect(first.equals(last)).toBe(false); // The fixture must actually move.

    const compared = join(dir, "compare");
    run("compare.ts", ["--ref", ref, "--clone", clone, "--out", compared, "--offset", "0", "--fps", "10"]);
    const report = JSON.parse(readFileSync(join(compared, "report.json"), "utf8"));
    expect(report.setupWarnings).toEqual([]);
    expect(report.compared).toBe(images.length);
    expect(report.meanMismatch).toBe(0);
    expect(report.pass).toEqual({ pixels: true, timing: true });

    const probe = JSON.parse(run("frames.ts", ["--in", join(dir, "ref", "video.mp4"), "--probe"]));
    expect(probe.width).toBe(240);
    expect(probe.height).toBe(120);
    run("frames.ts", ["--in", join(dir, "ref", "video.mp4"), "--out", join(dir, "extracted"), "--fps", "10"]);
    expect(readdirSync(join(dir, "extracted")).filter((p) => p.endsWith(".png")).length).toBeGreaterThan(0);
    const sheets = join(dir, "sheets");
    run("sheet.ts", ["compare", "--ref", ref, "--clone", clone, "--diff", join(compared, "diff"), "--out", sheets]);
    expect(PNG.sync.read(readFileSync(join(sheets, "compare-01.png"))).height).toBeGreaterThan(0);
    expect(run("easing.ts", ["--track", join(dir, "clone", "track.json"), "--selector", ".box", "--prop", "translateX",
      "--compare-track", join(dir, "ref", "track.json")])).toContain("meanAbsDiff");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);
