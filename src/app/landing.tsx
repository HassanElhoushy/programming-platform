import Link from "next/link";
import { ClipboardCheck, FileText, Layers, PenLine } from "lucide-react";

import { LogoWordmark } from "@/components/logo";

import { LandingField } from "./landing-field";
import { Reveal } from "./landing-reveal";

/**
 * أرقام مسار واحد، مش مجموع العربي واللغات. كل طالب يشوف مسارًا واحدًا.
 * ٧ فصول و٢٣ درسًا، و٣٨٩ سؤال تدريب، و٨٥٨ سؤال بنك.
 */
const FACTS = [
  { value: "7", label: "فصول" },
  { value: "23", label: "درس" },
  { value: "389", label: "سؤال تدريب" },
  { value: "858", label: "سؤال في البنك" },
];

const INSIDE = [
  {
    icon: FileText,
    title: "شرح الدرس",
    body: "ملف كل درس في مكانه. مش هتدّور على الشرح بره المنصة.",
  },
  {
    icon: ClipboardCheck,
    title: "تدريب وامتحان",
    body: "تحل وتسلّم، والدرجة توصلك هنا من غير ما تسأل.",
  },
  {
    icon: Layers,
    title: "بنك الأسئلة",
    body: "من غير وقت ومن غير درجة. الغلط يتشرح، والإجابة الصح كمان.",
  },
  {
    icon: PenLine,
    title: "تصحيح المقالي",
    body: "المقالي يراجعه المدرّس بنفسه، ويكتب لك ملاحظته على إجابتك.",
  },
];

const STEPS = [
  "اعمل حساب، واختار إنك طالب عربي ولا لغات.",
  "المدرّس يراجع الحساب ويفتح لك الدروس.",
  "ابدأ من أول درس: اقرأ الشرح، وبعدين حل.",
];

export function Landing() {
  return (
    <div className="relative min-h-dvh">
      <LandingField tone="light" />
      <header className="relative z-20 border-b-[0.5px] border-line bg-page">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <LogoWordmark />
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost text-sm">
              تسجيل الدخول
            </Link>
            <Link href="/signup" className="btn btn-primary text-sm">
              حساب جديد
            </Link>
          </div>
        </div>
      </header>
      <div data-band className="on-band relative z-10 bg-band text-band-ink">
        <LandingField tone="dark" />

        <div className="relative z-10 mx-auto w-full max-w-3xl px-5 pb-16 pt-12 sm:pt-16">
          <p className="inline-flex rounded-[6px] border-[0.5px] border-band-line px-2.5 py-1 text-xs text-band-ink-2">
            الصف الثاني الثانوي · البكالوريا المصرية
          </p>
          <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.12] tracking-tight text-band-ink sm:text-5xl lg:text-6xl">
            البرمجة والذكاء الاصطناعي
            <span className="mt-2 block text-balance text-band-ink-2">
              من الشرح للحل للدرجة، في مكان واحد
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-sm leading-relaxed text-band-ink-2 sm:text-base">
            الشرح، والحل، والدرجة في مكان واحد. مسار للعربي ومسار للغات، وكل طالب يشوف مساره بس.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/signup" className="btn btn-invert">
              ابدأ بحساب جديد
            </Link>
            <Link href="/login" className="btn btn-invert-ghost">
              عندي حساب
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-2 border-t-[0.5px] border-band-line sm:grid-cols-4">
            {FACTS.map((fact, i) => (
              <div
                key={fact.label}
                className={
                  i === FACTS.length - 1
                    ? "px-4 py-5"
                    : "border-e-[0.5px] border-band-line px-4 py-5 max-sm:even:border-e-0 max-sm:[&:nth-child(-n+2)]:border-b-[0.5px]"
                }
              >
                <dd className="tnum text-3xl font-semibold text-band-ink">{fact.value}</dd>
                <dt className="mt-1 text-xs text-band-ink-2">{fact.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-16 pt-16">
        <section>
          <h2 className="text-lg font-semibold text-ink">جوه المنصة</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {INSIDE.map((item, i) => (
              <Reveal key={item.title} as="li" delay={i * 110} className="card card-hover p-5">
                <span className="flex size-9 items-center justify-center rounded-[6px] border-[0.5px] border-line">
                  <item.icon className="size-4 text-ink-2" strokeWidth={1.5} />
                </span>
                <p className="mt-4 text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="text-xl font-semibold text-ink">إزاي تبدأ</h2>
          <ol className="mt-8 flex max-w-4xl flex-col gap-10">
            {STEPS.map((step, i) => (
              <Reveal key={step} as="li" variant="step" className="relative flex items-start gap-5">
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-11 bottom-[-2.5rem] start-[21.75px] w-[0.5px] bg-line"
                  />
                ) : null}
                <span className="tnum relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold text-white">
                  {i + 1}
                </span>
                <p className="pt-2 text-lg leading-relaxed text-ink sm:text-xl">
                  {step}
                </p>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="text-lg font-semibold text-ink">عربي، أو لغات</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-2">
            بتختار المسار وأنت بتعمل الحساب. كل طالب يشوف محتوى مساره بس.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <article className="card p-5" dir="rtl">
              <h3 className="text-sm font-semibold text-ink">عربي</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">المنصة بالعربي، ومن اليمين للشمال.</p>
              <div className="mt-4 rounded-[6px] border-[0.5px] border-line px-3 py-3">
                <p className="text-xs text-ink-3">الفصل الأول · الدرس الثاني</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">امتحان الدرس</p>
                  <span className="badge badge-ok">تم التصحيح</span>
                </div>
              </div>
            </article>
            <article className="card p-5" dir="ltr">
              <h3 className="text-sm font-semibold text-ink">لغات</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                The whole platform in English, left to right.
              </p>
              <div className="mt-4 rounded-[6px] border-[0.5px] border-line px-3 py-3">
                <p className="text-xs text-ink-3">Chapter 1 · Lesson 2</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Lesson exam</p>
                  <span className="badge badge-ok">Graded</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="mt-16 card px-5 py-10 text-center">
          <h2 className="text-xl font-semibold text-ink">ابدأ من أول درس</h2>
          <div className="mt-5">
            <Link href="/signup" className="btn btn-primary">
              حساب جديد
            </Link>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            بعد التسجيل، المدرّس بيراجع الحساب ويفتح المحتوى.
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t-[0.5px] border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <LogoWordmark />
          <p className="text-xs leading-relaxed text-ink-3">
            منصة مذاكرة لمادة البرمجة والذكاء الاصطناعي، الصف الثاني الثانوي.
          </p>
          <Link href="/login" className="text-sm text-ink-2 hover:text-ink">
            تسجيل الدخول
          </Link>
        </div>
      </footer>
    </div>
  );
}
