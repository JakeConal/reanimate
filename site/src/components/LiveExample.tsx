"use client";

import { useEffect, useRef, useState } from "react";

// The clone, running live in an iframe. The cards switch to their desktop layout and hover
// behaviour from a 940px viewport, so the iframe is always laid out at least that wide and
// scaled (row) or cropped (single card) to fit. The iframe loads when it scrolls into view,
// so the entrance plays when the reader gets there.

const ROW = { width: 1300, height: 712 };
const CARD = { width: 960, height: 712, crop: 440 };

type Card = "agentic-commerce" | "issuing" | "crypto";

export function LiveExample({ card, title }: { card?: Card; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);
  const [run, setRun] = useState(0);

  const frameWidth = card ? CARD.crop : ROW.width;
  const src = `/examples/stripe-bento/${card ? `?card=${card}` : ""}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / frameWidth)));
    ro.observe(el);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [frameWidth]);

  const height = (card ? CARD.height : ROW.height) * scale;
  const offsetX = card ? ((CARD.width - CARD.crop) / 2) * scale : 0;

  return (
    <div className="figure-live">
      <div ref={box} className="live" style={{ height: height || undefined, aspectRatio: height ? undefined : `${frameWidth} / ${card ? CARD.height : ROW.height}`, maxWidth: card ? CARD.crop : undefined }}>
        {visible && scale > 0 && (
          <iframe
            key={run}
            src={src}
            title={title}
            width={card ? CARD.width : ROW.width}
            height={card ? CARD.height : ROW.height}
            style={{ transform: `translateX(${-offsetX}px) scale(${scale})` }}
          />
        )}
        <span className="live__badge"><b />live clone</span>
      </div>
      <div className="figure__caption" style={{ maxWidth: card ? CARD.crop : undefined }}>
        <button type="button" onClick={() => setRun((n) => n + 1)}>Replay entrance</button>
        <a href={src} target="_blank" rel="noreferrer">Open full size ↗</a>
      </div>
    </div>
  );
}
