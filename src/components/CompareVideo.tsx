"use client";

import { useEffect, useRef, useState } from "react";

// Two recordings made with the same capture command, stacked: the reference on the left of the
// line, the clone on the right. Drag (or use the arrow keys) to move the line. Both videos play
// only while on screen and are kept on the same frame.

export function CompareVideo({ reference, clone, width, height, label }: { reference: string; clone: string; width: number; height: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLVideoElement>(null);
  const bottom = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState(50);

  useEffect(() => {
    const el = box.current;
    const a = top.current;
    const b = bottom.current;
    if (!el || !a || !b) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let syncId = 0;
    const play = () => {
      if (reduce) return;
      b.currentTime = a.currentTime;
      void a.play().catch(() => {});
      void b.play().catch(() => {});
      syncId = window.setInterval(() => {
        if (Math.abs(a.currentTime - b.currentTime) > 0.04) b.currentTime = a.currentTime;
      }, 400);
    };
    const pause = () => {
      a.pause();
      b.pause();
      clearInterval(syncId);
    };
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : pause()), { threshold: 0.3 });
    io.observe(el);
    return () => {
      io.disconnect();
      pause();
    };
  }, []);

  return (
    <div ref={box} className="compare" style={{ aspectRatio: `${width} / ${height}` }}>
      <video ref={bottom} src={clone} muted playsInline loop preload="metadata" width={width} height={height} aria-hidden="true" />
      <div className="compare__top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <video ref={top} src={reference} muted playsInline loop preload="metadata" width={width} height={height} aria-hidden="true" />
      </div>
      <div className="compare__line" style={{ left: `${pos}%` }} />
      <span className="compare__label compare__label--left">stripe.com</span>
      <span className="compare__label compare__label--right">clone</span>
      <input type="range" min={0} max={100} step={0.5} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={`${label}: drag to compare stripe.com (left) with the clone (right)`} />
    </div>
  );
}
