"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Reveal } from "./landing-reveal";

/**
 * خطوات «إزاي تبدأ». الأولى تظهر أول ما القسم يدخل الشاشة.
 * الروبوت على الشمال يتحرك ويشوّر على الخطوة اللي ظهرت.
 */
export function StartSteps({ steps }: { steps: string[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(-1);
  const [active, setActive] = useState(-1);
  const [top, setTop] = useState(0);
  const [travel, setTravel] = useState(false);

  useEffect(() => {
    if (active < 0 || travel) return;
    const id = requestAnimationFrame(() => setTravel(true));
    return () => cancelAnimationFrame(id);
  }, [active, travel]);

  function arrive(index: number) {
    const box = boxRef.current;
    if (!box) return;
    const next = Math.max(activeRef.current, index);
    if (next === activeRef.current) return;
    const target = box.querySelector<HTMLElement>(`[data-step="${next}"]`);
    if (!target) return;
    activeRef.current = next;
    setTop(target.offsetTop + target.offsetHeight / 2 - 56);
    setActive(next);
  }

  return (
    <div ref={boxRef} className="relative mt-8">
      <GuideRobot top={top} show={active >= 0} pulse={active} travel={travel} />
      <ol className="flex max-w-4xl flex-col gap-10 lg:me-44">
        {steps.map((step, i) => (
          <Reveal
            key={step}
            as="li"
            variant="step"
            step={i}
            line={i === 0 ? 1.15 : 0.82}
            onShow={() => arrive(i)}
            className="relative flex items-start gap-5"
          >
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-11 bottom-[-2.5rem] start-[21.75px] w-[0.5px] bg-line"
              />
            ) : null}
            <span className="tnum relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold text-white">
              {i + 1}
            </span>
            <p className="pt-2 text-lg leading-relaxed text-ink sm:text-xl">{step}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

function GuideRobot({
  top,
  show,
  pulse,
  travel,
}: {
  top: number;
  show: boolean;
  pulse: number;
  travel: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-0 z-10 hidden w-36 lg:block",
        show ? "opacity-100" : "opacity-0",
        travel ? "transition-[transform,opacity] duration-700 ease-out" : "transition-opacity duration-500",
      )}
      style={{ transform: `translateY(${top}px)` }}
    >
      <div className="guide-float">
        <svg viewBox="0 0 160 112" className="h-auto w-full overflow-visible">
          <line x1="48" y1="16" x2="48" y2="5" stroke="#2b4257" strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="4" r="3.5" fill="#2b4257" />
          <rect x="24" y="16" width="48" height="34" rx="10" fill="#2b4257" />
          <circle cx="38" cy="32" r="5" fill="#ffffff" />
          <circle cx="56" cy="32" r="5" fill="#ffffff" />
          <circle cx="40" cy="32" r="2.1" fill="#1b1b18" />
          <circle cx="58" cy="32" r="2.1" fill="#1b1b18" />
          <rect x="28" y="54" width="40" height="34" rx="8" fill="#ffffff" stroke="#2b4257" strokeWidth="1.5" />
          <text
            x="48"
            y="75"
            textAnchor="middle"
            fill="#2b4257"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            {"</>"}
          </text>
          <rect x="32" y="90" width="12" height="6" rx="2" fill="#2b4257" />
          <rect x="52" y="90" width="12" height="6" rx="2" fill="#2b4257" />
          <g key={pulse} className="guide-point">
            <path d="M68 66 H118" stroke="#2b4257" strokeWidth="3" strokeLinecap="round" />
            <path d="M112 58 L132 66 L112 74 Z" fill="#2b4257" />
          </g>
        </svg>
      </div>
    </div>
  );
}
