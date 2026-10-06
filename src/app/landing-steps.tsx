"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Reveal } from "./landing-reveal";

/** إيد السبابة قريبة من أعلى الصورة */
const HAND = 0.181;

/**
 * خطوات «إزاي تبدأ». الروبوت هنا بس، وبينزل على كل خطوة
 * وإيده بتتحرك وهي بتشوّر عليها.
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
    const robot = box.querySelector<HTMLElement>("[data-robot]");
    if (!target || !robot) return;
    activeRef.current = next;
    const hand = robot.offsetHeight * HAND || 40;
    setTop(target.offsetTop + target.offsetHeight / 2 - hand);
    setActive(next);
  }

  return (
    <div ref={boxRef} className="relative mt-8 lg:pb-8">
      <div
        data-robot
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 z-10 hidden w-44 lg:block",
          active >= 0 ? "opacity-100" : "opacity-0",
          travel ? "transition-[transform,opacity] duration-700 ease-out" : "transition-opacity duration-500",
        )}
        style={{ transform: `translateY(${top}px)` }}
      >
        <div className="guide-point">
          <div className="guide-float">
            <img src="/guide-robot.png" alt="" className="aspect-[3/4] h-auto w-full" />
          </div>
        </div>
      </div>
      <ol className="flex max-w-4xl flex-col gap-10 lg:me-52">
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
