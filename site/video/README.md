# Demo video

A 64-second demo of reanimate, cut to `assets/soundtrack.mp3` (90 bpm). It's a web page: every frame is drawn from the time alone, then screenshotted and encoded, so the render is frame-exact and the cuts land on the beat. Commands run from `site/`.

| Time | Bars | What |
|---|---|---|
| 0–4.8 s | intro | `/reanimate` slides in with onion-skin frames behind it |
| 4.8–12.8 s | 1–4 | a picker wheel of things to ask for, one every two beats |
| 12.8–28.8 s | 4–10 | how it works, on three clones at once (stripe.com's Agentic commerce card, the resend.com cube, clerk.com's Session management card): record, spec, build, verify, repeat (the copies' pixel difference shrinking each round) |
| 28.8–47.5 s | 10–17 | the clones: Stripe and WorkOS on a track, Liveblocks' app window, the Clerk cards, then the Resend cube and React Bits' fading stars |
| 47.5–56.8 s | 17–20.5 | all 18 as a mosaic, which unravels into a turning helix of their frames |
| 56.8 s–end | 20.5–23.25 | the install command; `/reanimate`, gray all video, turns to ink |

## Soundtrack

"My Little Prince" by Michael Ramir C., from [Mixkit](https://mixkit.co/free-stock-music/tag/calm/) under the [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree) (free for commercial and personal projects, no attribution required). It's 90 bpm with its first downbeat at 2.597 s, so 0.431 s is cut from the start to put that downbeat on the video's at 2.166 s, then it's turned down to about -18 LUFS and faded out over the last 2.5 s. The track isn't in the repository (Mixkit's licence is for using it in your own work, not for passing the file on); make it before rendering:

```sh
curl -L https://assets.mixkit.co/music/815/815.mp3 -o /tmp/815.mp3
ffmpeg -ss 0.431 -i /tmp/815.mp3 -t 64.166 -af "volume=-6.4dB,afade=t=out:st=61.666:d=2.5" -c:a libmp3lame -b:a 320k video/assets/soundtrack.mp3
```

Another track only needs the same treatment: 90 bpm (or time-stretched to it with `atempo`), a downbeat at 2.166 s, cut to `DURATION` in `src/lib.js`.

## Make it

```sh
bun video/scripts/clips.ts     # records the 18 clones into video/clips/ (about 3 minutes)
bun video/scripts/render.ts    # video/out/reanimate-demo.mp4, 1920x1080, 60 fps
bun video/scripts/publish.ts   # public/demo.mp4 for the site, and the README's preview, ../.github/assets/demo.webp
```

`clips.ts` films each clone on the skill's virtual clock (`skills/reanimate/scripts/capture.ts --clock virtual`) at 2x and 60 fps, so a clip comes out the same on every run. For "how it works" it also films clerk.com's Session management card and its copy the same way (`how-clerk-*`), and cuts the originals and copies of the other two out of the site's recordings (`public/media/stripe-bento/compare.mp4` and `resend-cube/compare.mp4`, as `how-stripe-*` and `how-resend-*`; `--only compare` redoes just those). `--only <slug>,…` redoes some.

`render.ts` options: `--scale 2` draws at 3840x2160 and scales down (sharper, about 4x slower); `--size 3840x2160` keeps it; `--from 12 --to 29` renders a section; `--stills 1.5,13.2` writes PNGs of single moments to `video/out/stills/`. It needs Playwright's Chromium and `ffmpeg` on PATH. `publish.ts` makes a smaller copy that the site serves at `/demo.mp4` (the README links to it), and the README's preview: a few moments of the video, cross-faded into a 20-second loop. It needs `ffmpeg`, `cwebp` and `webpmux`.

## Edit it

```sh
bun video/scripts/serve.ts     # http://localhost:4700/video/
```

A player with the soundtrack: space plays and pauses, ←/→ step a frame (shift: a second), `?t=12.5` starts there. Each scene is a module in `src/` with `from`, `to`, `init(root)` and `render(t)`; `src/lib.js` has the beat grid (`bar(n)`, `beat(n)`), easing and the blur-and-fade helper the transitions share.
