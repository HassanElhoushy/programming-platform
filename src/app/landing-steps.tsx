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
    setTop(target.offsetTop + target.offsetHeight / 2 - 78);
    setActive(next);
  }

  return (
    <div ref={boxRef} className="relative mt-8">
      <GuideRobot top={top} show={active >= 0} pulse={active} travel={travel} />
      <ol className="flex max-w-4xl flex-col gap-10 lg:me-64">
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
        "pointer-events-none absolute left-0 z-10 hidden w-60 lg:block",
        show ? "opacity-100" : "opacity-0",
        travel ? "transition-[transform,opacity] duration-700 ease-out" : "transition-opacity duration-500",
      )}
      style={{ transform: `translateY(${top}px)` }}
    >
      <div className="guide-float">
        <svg viewBox="0 0 300 210" className="h-auto w-full overflow-visible">
          <RobotFigure pulse={pulse} />
        </svg>
      </div>
    </div>
  );
}

/** هيكل ومفاصل وإيد بأصابع. السبابة ممدودة ناحية الخطوة. */
function RobotFigure({ pulse }: { pulse: number }) {
  return (
    <>
      <line x1="58" y1="18" x2="58" y2="6" stroke="#2b4257" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="58" cy="5" r="4" fill="#16212c" />
      <circle cx="58" cy="5" r="1.6" fill="#d5dde4" />

      <rect x="18" y="28" width="12" height="22" rx="6" fill="#1a2c3b" />
      <rect x="86" y="28" width="12" height="22" rx="6" fill="#1a2c3b" />
      <rect x="22" y="18" width="72" height="56" rx="18" fill="#2b4257" />
      <rect x="28" y="22" width="60" height="8" rx="4" fill="#3e5a72" />
      <rect x="32" y="34" width="52" height="24" rx="8" fill="#0e1720" />
      <circle cx="46" cy="46" r="7" fill="#1a2c3b" />
      <circle cx="46" cy="46" r="4.2" fill="#d5dde4" />
      <circle cx="46" cy="46" r="2.2" fill="#0e1720" />
      <circle cx="45" cy="45" r="0.8" fill="#ffffff" />
      <circle cx="70" cy="46" r="7" fill="#1a2c3b" />
      <circle cx="70" cy="46" r="4.2" fill="#d5dde4" />
      <circle cx="70" cy="46" r="2.2" fill="#0e1720" />
      <circle cx="69" cy="45" r="0.8" fill="#ffffff" />
      <path d="M40 64 H76" stroke="#3e5a72" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M44 68 H72" stroke="#3e5a72" strokeWidth="1.4" strokeLinecap="round" />

      <rect x="48" y="74" width="20" height="8" rx="3" fill="#1a2c3b" />
      <rect x="52" y="80" width="12" height="6" rx="2" fill="#16212c" />

      <rect x="24" y="86" width="68" height="62" rx="14" fill="#2b4257" />
      <rect x="32" y="94" width="52" height="40" rx="8" fill="#f7f8f9" />
      <rect x="40" y="102" width="36" height="18" rx="4" fill="#0e1720" />
      <text
        x="58"
        y="115"
        textAnchor="middle"
        fill="#d5dde4"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        {"</>"}
      </text>
      <circle cx="42" cy="136" r="2.2" fill="#2b4257" />
      <circle cx="74" cy="136" r="2.2" fill="#2b4257" />
      <path d="M40 142 H76" stroke="#c9d2db" strokeWidth="1.2" strokeLinecap="round" />

      <rect x="30" y="146" width="22" height="28" rx="7" fill="#1a2c3b" />
      <rect x="64" y="146" width="22" height="28" rx="7" fill="#1a2c3b" />
      <circle cx="41" cy="160" r="3" fill="#3e5a72" />
      <circle cx="75" cy="160" r="3" fill="#3e5a72" />
      <rect x="28" y="172" width="26" height="10" rx="4" fill="#2b4257" />
      <rect x="62" y="172" width="26" height="10" rx="4" fill="#2b4257" />

      <circle cx="96" cy="104" r="13" fill="#16212c" />
      <circle cx="96" cy="104" r="8" fill="#3e5a72" />
      <circle cx="96" cy="104" r="3" fill="#d5dde4" />
      <path d="M108 98 H148" stroke="#1a2c3b" strokeWidth="16" strokeLinecap="round" />
      <path d="M112 94 H146" stroke="#5d7a90" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="150" cy="98" r="9" fill="#16212c" />
      <circle cx="150" cy="98" r="4.5" fill="#3e5a72" />
      <circle cx="150" cy="98" r="1.7" fill="#d5dde4" />

      <g key={pulse} className="guide-point">
        <path d="M146 100 H188" stroke="#2b4257" strokeWidth="12" strokeLinecap="round" />
        <path d="M150 96 H186" stroke="#5d7a90" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="190" cy="100" r="6" fill="#16212c" />
        <circle cx="190" cy="100" r="2.6" fill="#3e5a72" />

        <path
          d="M186 86
             c14 -2 24 2 28 10
             c2 4 2 8 0 12
             c-4 12 -16 22 -30 22
             c-8 0 -14 -4 -14 -12
             v-18
             c0 -8 6 -13 16 -14z"
          fill="#2b4257"
        />
        <path d="M196 102 C206 108 214 108 222 104" stroke="#1a2c3b" strokeWidth="1.3" fill="none" />

        <g transform="rotate(-46 188 90)">
          <rect x="184" y="82" width="13" height="8" rx="4" fill="#3e5a72" />
          <circle cx="195" cy="86" r="2.3" fill="#16212c" />
          <rect x="196" y="83" width="11" height="7" rx="3.5" fill="#5d7a90" />
          <path d="M203 84.5 H206" stroke="#d5dde4" strokeWidth="1" strokeLinecap="round" />
        </g>

        <rect x="214" y="72" width="20" height="12" rx="6" fill="#3e5a72" />
        <circle cx="232" cy="78" r="3" fill="#16212c" />
        <rect x="234" y="73" width="18" height="11" rx="5.5" fill="#2b4257" />
        <circle cx="250" cy="78.5" r="2.8" fill="#16212c" />
        <rect x="252" y="74" width="18" height="10" rx="5" fill="#5d7a90" />
        <circle cx="271" cy="79" r="5" fill="#2b4257" />
        <circle cx="273" cy="77.2" r="1.6" fill="#f7f8f9" />

        <rect x="208" y="108" width="16" height="11" rx="5" fill="#2b4257" />
        <circle cx="222" cy="113.5" r="2.6" fill="#16212c" />
        <rect x="223" y="114" width="13" height="10" rx="5" transform="rotate(24 223 114)" fill="#3e5a72" />

        <rect x="204" y="122" width="14" height="10" rx="5" fill="#1a2c3b" />
        <circle cx="216" cy="127" r="2.4" fill="#16212c" />
        <rect x="217" y="128" width="11" height="9" rx="4.5" transform="rotate(32 217 128)" fill="#2b4257" />

        <rect x="200" y="134" width="12" height="9" rx="4.5" fill="#1a2c3b" />
        <rect x="210" y="140" width="9" height="8" rx="4" transform="rotate(38 210 140)" fill="#3e5a72" />
      </g>
    </>
  );
}
