"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { Reveal } from "./landing-reveal";

/** إيد السبابة قريبة من أعلى صورة المشاورة */
const HAND = 0.181;

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: "مين صاحب المنصة؟",
    a: (
      <>
        <p>
          المنصة عملها حسن الحوشي، مهندس برمجيات وخريج Computer Science. عنده خبرة
          عملية في تعليم البرمجة، واشتغل مع جهات عالمية لتعليم البرمجة زي Udacity،
          ومتابع أحدث طرق التعليم.
        </p>
        <p>دي نبذة عنه. تقدر تشوفه أو تكلمه من هنا:</p>
        <p className="flex flex-col gap-1">
          <a
            href="https://www.linkedin.com/in/hassanelhoushy/"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            لينكدإن
          </a>
          <a
            href="https://wa.me/201501584998"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            واتساب 01501584998
          </a>
        </p>
      </>
    ),
  },
  {
    q: "المنصة دي لمين؟",
    a: (
      <p>
        لطلبة الصف الثاني الثانوي، البكالوريا المصرية. فيها مسار عربي ومسار لغات،
        وكل طالب يشوف محتوى مساره بس.
      </p>
    ),
  },
  {
    q: "هلاقي إيه وأنا بذاكر؟",
    a: (
      <p>
        شرح كل درس، وتدريب وامتحان تسلّمه وتوصلك الدرجة. بنك أسئلة من غير وقت،
        والغلط يتشرح. المقالي المدرّس هو اللي بيصححه ويكتب لك ملاحظته.
      </p>
    ),
  },
  {
    q: "اشترك ازاي؟",
    a: (
      <p>
        تواصل مع المدرّس على{" "}
        <a
          href="https://wa.me/201501584998"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          واتساب
        </a>
        ، وهو يراجع حسابك ويفتح لك الدروس.
      </p>
    ),
  },
  {
    q: "لو أنا طالب لغات؟",
    a: (
      <p>
        بتختار لغات وأنت بتسجل. المنصة كلها بتظهر لك بالإنجليزي، ومن الشمال لليمين.
      </p>
    ),
  },
];

/**
 * خطوات «إزاي تبدأ». الروبوت هنا بس: يشاور على كل خطوة،
 * وبعد التلاتة يثبّت ويبص للطالب، والضغط عليه يفتح الأسئلة.
 */
export function StartSteps({ steps }: { steps: string[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(-1);
  const [active, setActive] = useState(-1);
  const [top, setTop] = useState(0);
  const [travel, setTravel] = useState(false);
  const [settled, setSettled] = useState(false);
  const [hint, setHint] = useState(false);
  const settleTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (active < 0 || travel) return;
    const id = requestAnimationFrame(() => setTravel(true));
    return () => cancelAnimationFrame(id);
  }, [active, travel]);

  useEffect(() => {
    return () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!settled) return;
    const show = window.setTimeout(() => setHint(true), 1250);
    const hide = window.setTimeout(() => setHint(false), 1250 + 2000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [settled]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const box = boxRef.current;
      if (!box || !target) return;
      if (box.querySelector("[data-ask]")?.contains(target)) return;
      if (box.querySelector("[data-robot-btn]")?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function arrive(index: number) {
    const box = boxRef.current;
    if (!box) return;
    const next = Math.max(activeRef.current, index);
    if (next === activeRef.current) return;
    const target = box.querySelector<HTMLElement>(`[data-step="${next}"]`);
    const robot = box.querySelector<HTMLElement>("[data-robot]");
    if (!target || !robot) return;
    activeRef.current = next;
    const hand = robot.offsetHeight * HAND || 42;
    const beside = target.offsetTop + target.offsetHeight / 2 - hand;
    setTop(beside);
    setActive(next);
    if (next === steps.length - 1) {
      const card = box.closest("section")?.nextElementSibling?.querySelector<HTMLElement>(".card");
      settleTimer.current = window.setTimeout(() => {
        if (card) {
          const boxTop = box.getBoundingClientRect().top;
          const cardTop = card.getBoundingClientRect().top;
          setTop(cardTop - boxTop - robot.offsetHeight + 18);
        }
        setSettled(true);
      }, 500);
    }
  }

  return (
    <div ref={boxRef} className="relative mt-8 lg:pb-8">
      <div
        data-robot
        className={cn(
          "absolute left-8 z-20 hidden w-44 lg:block",
          active >= 0 ? "opacity-100" : "opacity-0",
          settled ? "pointer-events-auto" : "pointer-events-none",
          travel ? "transition-[transform,opacity] duration-700 ease-out" : "transition-opacity duration-500",
        )}
        style={{ transform: `translateY(${top}px)` }}
      >
        <button
          type="button"
          data-robot-btn
          className="group relative block w-full"
          aria-expanded={open}
          aria-controls="robot-ask"
          disabled={!settled}
          onClick={() => {
            setOpen((value) => !value);
            setPicked(null);
          }}
        >
          <Image
            src="/guide-robot.png"
            alt=""
            width={720}
            height={960}
            className={cn("aspect-[3/4] h-auto w-full", !settled && "guide-float")}
            style={{
              opacity: settled ? 0 : 1,
              transition: "opacity 1.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
          <Image
            src="/guide-robot-rest.png"
            alt=""
            width={720}
            height={960}
            className="absolute inset-0 aspect-[3/4] h-auto w-full"
            style={{
              opacity: settled ? 1 : 0,
              transition: "opacity 1.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
          {settled && !open ? (
            <span
              className={cn(
                "pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-[10px] border-[0.5px] border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition duration-200 group-hover:translate-y-0 group-hover:opacity-100",
                hint ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
            >
              عندك أسئلة؟
            </span>
          ) : null}
        </button>

        <div
          id="robot-ask"
          data-ask
          role="dialog"
          aria-label="أسئلة عن المنصة"
          hidden={!open}
          className={cn(
            "absolute left-[88%] top-1 z-30 w-[19.5rem]",
            open ? "ask-pop" : "pointer-events-none",
          )}
        >
          <div className="relative rounded-[18px] border-2 border-ink bg-surface px-3.5 py-3">
            <span
              aria-hidden
              className="absolute -left-2 top-7 size-3.5 rotate-45 border-b-2 border-l-2 border-ink bg-surface"
            />
            <p className="px-1 text-sm font-semibold text-ink">اسأل، وأنا أجاوبك</p>
            <ul className="mt-2 flex flex-col">
              {QUESTIONS.map((item, i) => {
                const on = picked === i;
                return (
                  <li key={item.q} className="border-t-[0.5px] border-line">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-start text-sm text-ink"
                      aria-expanded={on}
                      onClick={() => setPicked(on ? null : i)}
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200", on && "rotate-180")}
                        strokeWidth={1.5}
                      />
                    </button>
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-out",
                        on ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden" aria-hidden={!on}>
                        <div className="flex flex-col gap-2 pb-3 text-sm leading-relaxed text-ink-2">
                          {item.a}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
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
