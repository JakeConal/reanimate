# motion-clone site

The showcase website for the motion-clone skill in [`../skills/motion-clone`](../skills/motion-clone), a Claude Code skill that clones animations frame by frame. Commands below run from this `site/` folder. Next.js 16, exported as static files and served by a Cloudflare Worker (static assets only, no server code).

## Develop

```sh
bun install
bun run dev        # http://localhost:3000
```

`predev` and `prebuild` copy three.js and the Inter font from `node_modules` into `public/examples/stripe-bento/vendor/` (git-ignored), because the live examples are plain HTML pages loaded in iframes.

## Build and preview like production

```sh
bun run preview    # next build, then wrangler dev on http://localhost:8787
```

## Deploy to Cloudflare Workers

Set the public URL first, so the Open Graph and canonical links are absolute:

```sh
# .env.production
SITE_URL=https://motion-clone.<your-subdomain>.workers.dev
```

Then either:

- **From this machine:** `npx wrangler login` once (or export `CLOUDFLARE_API_TOKEN` with the "Edit Cloudflare Workers" template), then `bun run deploy`.
- **On every push:** in the Cloudflare dashboard, Workers & Pages → Create → Import a repository → `NiazMorshed2007/motion-clone`. Root directory `site`, build command `bun run build`, deploy command `npx wrangler deploy`. Add `SITE_URL` as a build variable.

`wrangler.jsonc` names the Worker `motion-clone` and serves `./out`, with `404.html` for unknown paths.

## Layout

| Path | What it is |
|---|---|
| `src/app/page.tsx` | The whole page: copy, sections, tables. |
| `src/components/` | `LiveExample` (scaled or cropped iframe of a live clone), `CompareVideo` (drag to compare stripe.com and the clone), `Nav`, `Sidenote`, `CopyCommand`. |
| `public/examples/stripe-bento/` | The three cloned stripe.com cards as a standalone page; `?card=agentic-commerce\|issuing\|crypto` shows one. |
| `public/media/` | Comparison recordings (stripe.com and clone, same capture command) and the comparison sheet. |
| `public/og.png` | Social preview image. |
| `marketing/launch.md` | Launch post drafts. |

## About the examples

The live examples recreate three cards from stripe.com as a study of the technique. They use Inter instead of Stripe's licensed Söhne, but the widget code ports Stripe's shaders and uses Stripe's images. Not affiliated with or endorsed by Stripe.
