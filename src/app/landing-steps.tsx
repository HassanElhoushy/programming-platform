"use client";

import { Reveal } from "./landing-reveal";

/** خطوات «إزاي تبدأ». الأولى تظهر أول ما القسم يدخل، والباقي مع النزول. */
export function StartSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-8 flex max-w-4xl flex-col gap-10">
      {steps.map((step, i) => (
        <Reveal
          key={step}
          as="li"
          variant="step"
          step={i}
          line={i === 0 ? 1.15 : 0.82}
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
  );
}
