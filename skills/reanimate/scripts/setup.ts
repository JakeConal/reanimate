// Cross-platform dependency setup. Run with Bun from any working directory.
import { spawnSync } from "node:child_process";
import { SCRIPTS_DIR, ffmpegPath } from "./lib.ts";

function run(args: string[]) {
  const result = spawnSync(process.execPath, args, { cwd: SCRIPTS_DIR, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`bun ${args.join(" ")} failed (${result.status})`);
}

// Install from this skill's lockfile; ffmpeg-static's download hook is explicitly trusted.
run(["install", "--frozen-lockfile"]);

const { chromium } = await import("playwright");
async function checkChromium() {
  const browser = await chromium.launch();
  await browser.close();
}

try {
  await checkChromium();
} catch {
  console.log("Installing Chromium for this Playwright version...");
  run(["x", "--no-install", "playwright", "install", "chromium"]);
  // A launch failure here may require Linux system libraries or host permissions.
  await checkChromium();
}

const probe = spawnSync(ffmpegPath(), ["-hide_banner", "-version"], { encoding: "utf8" });
if (probe.error) throw probe.error;
if (probe.status !== 0) throw new Error(`ffmpeg failed (${probe.status}): ${probe.stderr}`);
console.log(probe.stdout.split(/\r?\n/)[0]);
console.log(`ready: ${SCRIPTS_DIR}`);
