import { CompareVideo } from "@/components/CompareVideo";
import { CopyCommand } from "@/components/CopyCommand";
import { LiveExample } from "@/components/LiveExample";
import { Nav, type NavItem } from "@/components/Nav";
import { Sidenote } from "@/components/Sidenote";

const REPO = "https://github.com/NiazMorshed2007/motion-clone";
const INSTALL = "npx skills add NiazMorshed2007/motion-clone -g";

const sections: NavItem[] = [
  { id: "measure", label: "Measure, don’t eyeball" },
  { id: "levels", label: "Three levels of done" },
  { id: "numbers", label: "Where the numbers come from" },
  { id: "evidence", label: "Reading the evidence" },
  { id: "cards", label: "Three cards, up close" },
  { id: "prompt", label: "Writing a prompt" },
  { id: "install", label: "Install" },
  { id: "limits", label: "Limits" },
  { id: "questions", label: "Questions" },
];

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="section">
      <div className="section__head">
        <h2>{title}</h2>
        <span className="num serif">{String(n).padStart(2, "0")}</span>
      </div>
      {children}
    </section>
  );
}

function Rows({ rows, head }: { rows: [string, React.ReactNode, React.ReactNode?][]; head?: [string, string, string?] }) {
  return (
    <table className="kv">
      {head && (
        <thead>
          <tr>
            <th>{head[0]}</th>
            <th>{head[1]}</th>
            {head[2] !== undefined && <th className="num">{head[2]}</th>}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(([k, v, num]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
            {num !== undefined && <td className="num">{num}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Home() {
  return (
    <div className="page" id="top">
      <Nav items={sections} />

      <main className="main">
        <header className="masthead">
          <h1>
            motion-clone <span>· a skill for Claude Code</span>
          </h1>
          <div className="masthead__links">
            <a href={REPO} aria-label="GitHub repository">GitHub</a>
          </div>
        </header>

        <p className="lede">
          Point Claude at an animation, and it rebuilds it <em>frame by frame</em>, then proves the copy moves the same.
        </p>

        <div className="meta">
          <span>/motion-clone</span>
          <span><a href="#cards">3 cards, all live</a></span>
          <span>by <a href="https://github.com/NiazMorshed2007">Niaz</a></span>
          <span>29 October 2026</span>
          <span><a href="#install">Install ↓</a></span>
        </div>

        <p>
          Copying an animation by eye goes the same way every time. The copy looks right in a screenshot and feels wrong in motion. The easing is a little sharper, the second line starts a beat late, the card lifts four pixels instead of six. Nobody can say what is off, so nobody fixes it.
        </p>
        <p>
          motion-clone is a skill for Claude Code that treats an animation as something to <em>measure</em>. It records the reference, whether that is a live site, a screen recording or a gif, reads it frame by frame and writes down every timing and easing. Then it rebuilds the animation in your codebase, records the copy the same way and compares the two until the numbers agree.
        </p>

        <figure className="figure figure--wide">
          <LiveExample title="Three stripe.com cards, rebuilt by motion-clone, running live" />
          <figcaption className="sr-only">Three cards from the stripe.com homepage, rebuilt by motion-clone.</figcaption>
        </figure>

        <p>
          These are three cards from the stripe.com homepage, rebuilt by the skill, one agent per card.
          <Sidenote n={1}>
            The cards here use Inter. stripe.com uses its licensed Söhne, and the clone was verified with the original font before this public build swapped it.
          </Sidenote>{" "}
          What you see above is the clone, running live. Hover a card: it grows six pixels, the title and the button slide out of the way and the border lights up where your pointer is. The Visa card tilts towards you, the particle ring pulls in near your pointer and the globe’s dots brighten.
        </p>

        <figure className="figure figure--wide">
          <CompareVideo reference="/media/entrance-ref.mp4" clone="/media/entrance-clone.mp4" width={1252} height={696} label="Entrance" />
          <figcaption className="figure__caption">
            <span>The entrance, recorded on stripe.com and on the clone with the same command. Drag the line.</span>
          </figcaption>
        </figure>

        <Section id="measure" n={1} title="Measure, don’t eyeball">
          <p>The skill rests on one rule, near the top of its instructions:</p>
          <blockquote className="rule">
            <p>The deliverable is code in the user’s project plus evidence (numbers and side-by-side sheets), never “it looks about right”.</p>
            <cite>SKILL.md</cite>
          </blockquote>
          <p>Every clone runs the same loop, and the loop doesn’t end until the comparison passes.</p>
          <Rows
            rows={[
              ["Capture", "Records the reference in a headless browser at a fixed viewport and frame rate: a video, numbered frames, every CSS and Web Animations API animation it can find, and the position of chosen elements on every frame."],
              ["Spec", "Writes one row per element per property: when it starts, how long it runs, from where to where, with which easing. A row with a question mark means the frames haven’t been read yet."],
              ["Build", "Implements it in your stack, with what the project already uses: CSS, Framer Motion, GSAP, three.js."],
              ["Verify", "Records the clone with the exact command used for the reference, then compares timing, pixels and the easing curve, and builds side-by-side sheets."],
              ["Repeat", "Fixes the smallest thing the evidence points at and records again. Two to five rounds is normal. A row that still fails after five is reported with its numbers and the reason, not hidden."],
            ]}
          />
          <p>
            The capture is the part that makes this work. The reference and the clone are recorded by the same script with the same viewport, crop, trigger, duration and frame rate. When the two differ, the difference is in the clone, not in how it was filmed.
          </p>
        </Section>

        <Section id="levels" n={2} title="Three levels of done">
          <p>The words in your prompt pick how close the copy has to be, and that decides what gets checked.</p>
          <Rows
            rows={[
              ["Motion-faithful", <>The default. Trigger, order, stagger, the timing of every step to within 80 ms, the easing family, and how far things move relative to their size. Copy, colours and fonts can be yours.</>],
              ["Pixel-faithful", <>Say <em>match it exactly</em> or <em>pixel-perfect</em>. Everything above, plus fonts, sizes, colours, spacing and assets, with at most 2 % of pixels differing on average.</>],
              ["Mixed", <>Say <em>clone this and add that</em>. The cloned parts are held to one of the levels above; your additions live in their own components and are checked only for not breaking the motion.</>],
            ]}
          />
          <p>You can also narrow the target: one section, one widget, or a time range of a video, like <em>0:12 to 0:15</em>. It clones exactly that and leaves the rest of the page alone.</p>
        </Section>

        <Section id="numbers" n={3} title="Where the numbers come from">
          <p>Most of an animation’s spec is sitting in the page, if you know where to look. The skill reads its sources in this order and stops at the first one that answers:</p>
          <Rows
            rows={[
              ["Declared", "CSS animations, transitions and Web Animations that ran under the target, with their durations, delays and per-keyframe easings. When these exist they are the spec."],
              ["Tracked", "The position, size, opacity and transform of chosen elements on every animation frame, fitted against a table of named easings. It reports the best fit, the overshoot and whether the motion looks like a spring."],
              ["Read", "For video, gifs and canvas: the first frame where something changes and the last, and where the midpoint lands. Past halfway at a third of the time is an ease-out; a quarter or less is an ease-in."],
            ]}
          />
          <p>
            For WebGL graphics, like the three canvases in these cards, the pixels are the only output, so the skill reads the scripts the page loaded to recover the shaders, constants and timings, and rebuilds the scene from those.
          </p>
        </Section>

        <Section id="evidence" n={4} title="Reading the evidence">
          <p>Each round ends with numbers and a sheet. The numbers say <em>that</em> something is off; the sheet says <em>what</em>.</p>
          <figure className="figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="sheet" src="/media/sheet-issuing-hover.webp" alt="A comparison sheet: four moments of the card issuing hover, stripe.com on the left, the clone in the middle, and on the right the pixels that differ, in red. Only thin outlines of the card's edge and the title differ." width={816} height={975} loading="lazy" />
            <figcaption className="figure__caption">
              <span>Hovering the card issuing card: stripe.com, the clone, and in red the pixels that differ. 0.91 % differ on average.</span>
            </figcaption>
          </figure>
          <p>For the hover shared by all three cards, the same measurement on both pages:</p>
          <Rows
            head={["", "stripe.com → clone", "difference"]}
            rows={[
              ["Title shift", "ease-out-expo, starts 38 → 34 ms, settles in 643 → 633 ms", "0.13 px"],
              ["Button shift", "same curve, (3.55, −6) px", "0.08 px"],
              ["Icon arrows", "ease-out-expo, settles in 397 → 383 ms", "0.05 px"],
              ["Border glow", "follows the pointer to the card’s edge", "6.6 of 290 px"],
              ["Card growth", "6 px taller, 3.55 px wider, clipped open", "0 px"],
            ]}
          />
        </Section>

        <Section id="cards" n={5} title="Three cards, up close">
          <p>
            Each card was cloned by its own agent running the skill, in parallel, in 28 to 40 minutes.
            <Sidenote n={2}>Measured as the agent’s working time, from the first recording to the final report.</Sidenote>{" "}
            On the left of each card below is the clone, live. On the right, both recordings of the same pointer path: in, hold, across, out.
          </p>

          <h3>Agentic commerce</h3>
          <div className="pair figure figure--wide">
            <div>
              <div className="pair__label">Live clone</div>
              <LiveExample card="agentic-commerce" title="Agentic commerce card, live clone" />
            </div>
            <div>
              <div className="pair__label">Recorded: stripe.com | clone</div>
              <CompareVideo reference="/media/hover-agentic-commerce-ref.mp4" clone="/media/hover-agentic-commerce-clone.mp4" width={420} height={696} label="Agentic commerce hover" />
            </div>
          </div>
          <p>
            A chat plays once when the card comes into view. The question rises in at 0.25 s, the answer’s seventeen words fade in 60 ms apart, and two products rise 20 px into place at 1.4 s. Behind it, ten thousand points pull into a ring with a clockwise sweep and relax again, and the ones near your pointer are pulled back onto it.
          </p>
          <Rows
            rows={[
              ["Chat timing", "every step within Stripe’s own spread between two recordings", "≤ 43 ms"],
              ["Chat layout", "52 of 52 elements in the same place, same styles", "≤ 0.05 px"],
              ["Particle ring", "tightens past half at 1.44 s (Stripe: 1.44–1.48 s), relaxed by 4.24 s", "pass"],
              ["Whole card", "pixel difference, entrance to pointer, vs stripe.com against itself", "0.9–1.2 %"],
            ]}
          />

          <h3>Card issuing</h3>
          <div className="pair figure figure--wide">
            <div>
              <div className="pair__label">Live clone</div>
              <LiveExample card="issuing" title="Card issuing card, live clone" />
            </div>
            <div>
              <div className="pair__label">Recorded: stripe.com | clone</div>
              <CompareVideo reference="/media/hover-issuing-ref.mp4" clone="/media/hover-issuing-clone.mp4" width={420} height={696} label="Card issuing hover" />
            </div>
          </div>
          <p>
            A three.js scene: a folded ribbon of colour drifts behind a Visa card that is drawn separately and combined in a final pass. On hover the card tilts towards the pointer, up to 27°, easing in with no overshoot, and lies flat again when you leave.
          </p>
          <Rows
            rows={[
              ["At rest", "pixels that differ (stripe.com vs itself: 0.10 %)", "0.03–0.05 %"],
              ["Tilt", "settled pose at three pointer positions", "≤ 0.4 px"],
              ["Hover in and out", "tilt curve and pixels, within the noise of two Stripe recordings", "pass"],
              ["Entrance", "fades in earlier than on Stripe’s heavier page", "−210 ms"],
            ]}
          />

          <h3>Stablecoins and crypto</h3>
          <div className="pair figure figure--wide">
            <div>
              <div className="pair__label">Live clone</div>
              <LiveExample card="crypto" title="Stablecoins and crypto card, live clone" />
            </div>
            <div>
              <div className="pair__label">Recorded: stripe.com | clone</div>
              <CompareVideo reference="/media/hover-crypto-ref.mp4" clone="/media/hover-crypto-clone.mp4" width={420} height={696} label="Crypto hover" />
            </div>
          </div>
          <p>
            A dotted globe built from a land map turns slowly, faster over the Pacific. Arcs fly between 69 cities with a label riding each one, a random amount in USDC, USDB or cash. On hover the dots brighten in a corona around the globe’s edge.
            <Sidenote n={3}>
              The arcs, amounts and dot sizes are random on every load, on stripe.com too, so they are compared by their timing, not their pixels.
            </Sidenote>
          </p>
          <Rows
            rows={[
              ["Globe pose", "start angle, tilt, centre and camera", "exact"],
              ["Rotation", "per rendered frame", "0.0016°"],
              ["Arcs and labels", "spawn, line growth, label intro and travel, within Stripe’s spread", "pass"],
              ["Hover glow", "the same value on every rendered frame", "identical"],
            ]}
          />
        </Section>

        <Section id="prompt" n={6} title="Writing a prompt">
          <p>Name the thing, where it is, and where it should go. The skill infers the rest from your request and your repo, and asks only when two readings would lead to different work.</p>
          <div className="prompts">
            {[
              ["From a live site", <>the hero entrance on <b>https://example.com</b>, into <b>components/Hero.tsx</b></>],
              ["From a video", <>this loader, <b>0:03 to 0:05</b> of ~/Downloads/loader.mov</>],
              ["Pixel-exact", <>the card hover in this gif, <b>match it exactly</b></>],
              ["With your own parts", <>the logo marquee from https://example.com, <b>with our logos and pause on hover</b></>],
            ].map(([label, text]) => (
              <div key={label as string}>
                <div className="prompt__label">{label}</div>
                <div className="prompt__text"><span className="slash">/motion-clone</span>{text}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="install" n={7} title="Install">
          <CopyCommand command={INSTALL} />
          <p>
            The <a href="https://skills.sh">skills CLI</a> asks which agents to set up; add <code>-a claude-code</code> to skip the question. Then, in Claude Code, type <code>/motion-clone</code> followed by what you want cloned.
          </p>
          <p>
            The scripts run on <a href="https://bun.sh">Bun</a>. The first run downloads Playwright’s Chromium and a static ffmpeg into the skill’s folder, about 250 MB, and nothing after that. No API keys.
            <Sidenote n={4}>The skills CLI can install it for other agents that read SKILL.md, but it has only been tested with Claude Code.</Sidenote>
          </p>
        </Section>

        <Section id="limits" n={8} title="Limits">
          <ul className="list">
            <li>WebGL and canvas are compared as pixels. Random content, like particles, never matches exactly, so it is judged against two recordings of the reference instead.</li>
            <li>Headless browsers draw WebGL in software. Frame pacing in the recordings differs from a real screen, mostly on heavy pages.</li>
            <li>Pages behind a login, YouTube and Loom can’t be recorded directly. Hand it a screen recording.</li>
            <li>Physics springs are fitted from their overshoot and settle time, not read from the source.</li>
            <li>It clones what you point it at. Fonts, images and code from another site still belong to their owners; make sure you may use what you copy.</li>
          </ul>
        </Section>

        <Section id="questions" n={9} title="Questions">
          <div className="faq">
            <details>
              <summary>Does it copy the other site’s code?</summary>
              <p>It reads what the browser receives: CSS, keyframes and, for canvas graphics, the scripts that draw them. It writes its own implementation in your stack. The licences of whatever you copy still apply.</p>
            </details>
            <details>
              <summary>Which frameworks does it write?</summary>
              <p>Whatever your project already uses. It reads package.json and your existing components first, and won’t add GSAP to a project that animates with CSS.</p>
            </details>
            <details>
              <summary>Can it clone scroll-driven animations?</summary>
              <p>Yes. Scroll-linked motion is compared by scroll position instead of time, with the same stepped scroll on both pages.</p>
            </details>
            <details>
              <summary>What if it can’t get a row to pass?</summary>
              <p>After five rounds it stops and reports that row with its last numbers and the reason, such as a missing font or a physics spring it approximated. It never loosens a threshold quietly.</p>
            </details>
          </div>
        </Section>

        <footer className="footer">
          <span>
            <a href={REPO}>GitHub</a> · MIT licence · built with motion-clone
          </span>
          <span>The examples recreate three cards from stripe.com as a study of the technique. Not affiliated with or endorsed by Stripe. Stripe and Visa are trademarks of their respective owners.</span>
        </footer>
      </main>
    </div>
  );
}
