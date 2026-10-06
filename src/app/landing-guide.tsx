"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** إيد السبابة تقريبًا عند خمس ارتفاع الصورة */
const HAND = 0.181;

/**
 * المدرّس بيظهر على الشمال من أول الصفحة، وبينزل بهدوء
 * على الجزء اللي داخل الشاشة كأنه هو اللي بيشرحه.
 */
export function LandingGuide() {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = true;
    let y = 140;
    let ready = false;
    let lastKey = "";
    let nudgeUntil = 0;

    const tick = (now: number) => {
      if (!running) return;
      const vh = window.innerHeight;
      const nodes = [...document.querySelectorAll<HTMLElement>("[data-guide], [data-step]")];
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const el of nodes) {
        if (el.hasAttribute("data-step") && parseFloat(getComputedStyle(el).opacity) < 0.45) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 48 || rect.top > vh - 48) continue;
        const mid = rect.top + Math.min(rect.height, 64) / 2;
        const dist = Math.abs(mid - vh * 0.4);
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      }

      const hand = node.offsetHeight * HAND || 48;
      let desired = vh * 0.22;
      if (best) {
        const rect = best.getBoundingClientRect();
        desired = rect.top + Math.min(rect.height, 64) / 2 - hand;
        const key = best.dataset.guide ?? best.dataset.step ?? "";
        if (key !== lastKey) {
          lastKey = key;
          nudgeUntil = now + 700;
        }
      }
      desired = Math.max(76, Math.min(desired, vh - node.offsetHeight * 0.55));
      y = reduce ? desired : y + (desired - y) * 0.12;
      const nudge = now < nudgeUntil ? 14 : 0;
      node.style.transform = `translate3d(${nudge}px, ${y}px, 0)`;
      if (!ready) {
        ready = true;
        setEntered(true);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-3 top-0 z-30 hidden w-44 xl:block",
        "transition-opacity duration-700",
        entered ? "opacity-100" : "opacity-0",
      )}
    >
      <div ref={ref}>
        <div className="guide-float">
          <img src="/guide-robot.png" alt="" className="h-auto w-full" />
        </div>
      </div>
    </div>
  );
}
