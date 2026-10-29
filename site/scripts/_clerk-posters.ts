import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const browser = await chromium.launch({ channel: "chromium", args: ["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
for (const card of process.argv.slice(2)) {
  await page.goto(`http://localhost:3000/examples/clerk-bento/?card=${card}&embed`);
  await page.waitForSelector('html[data-widgets="ready"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const v = (await page.locator(`.clerk-card--${card}`).boundingBox())!;
  const s = (await page.locator(`.clerk-card--${card} .clerk-card__visual`).boundingBox())!;
  const h = Math.min(s.height, v.height, (v.width * 3) / 4);
  const w = (h * 4) / 3;
  const clip = { x: s.x + (s.width - w) / 2, y: Math.max(v.y, Math.min(s.y + (s.height - h) / 2, v.y + v.height - h)), width: w, height: h };
  mkdirSync(`public/media/clerk-${card}`, { recursive: true });
  const png = `public/media/clerk-${card}/poster.png`;
  await page.screenshot({ path: png, clip });
  execFileSync("cwebp", ["-quiet", "-q", "86", "-m", "6", "-sharp_yuv", "-resize", "288", "0", png, "-o", png.replace(".png", ".webp")]);
  rmSync(png);
  console.log(card, clip);
}
await browser.close();
