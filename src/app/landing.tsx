import Link from "next/link";
import { ClipboardCheck, FileText, Layers, PenLine } from "lucide-react";

import { LogoWordmark } from "@/components/logo";

import { LandingField } from "./landing-field";
import { Reveal } from "./landing-reveal";
import { StartSteps } from "./landing-steps";

/**
 * أرقام مسار واحد، مش مجموع العربي واللغات. كل طالب يشوف مسارًا واحدًا.
 * ٧ فصول و٢٣ درسًا، و٢٣ تدريبًا و٣٦ امتحانًا،
 * و١٩٠٥ سؤال: تدريب وامتحان وبنك.
 */
const FACTS = [
  { value: "7", label: "فصول" },
  { value: "23", label: "درس" },
  { value: "59", label: "تدريب وامتحان" },
  { value: "1905", label: "سؤال" },
];

const INSIDE = [
  {
    icon: FileText,
    title: "شرح الدرس",
    body: "ملف شرح مفصل لكل درس. مش هتدّور على الشرح بره المنصة.",
  },
  {
    icon: ClipboardCheck,
    title: "تدريب وامتحان",
    body: "التدريب أسئلة كتاب المدرسة. الامتحان أسئلة بمستوى أعلى، عشان تقيس فهمك.",
  },
  {
    icon: Layers,
    title: "بنك الأسئلة",
    body: "أسئلة إضافية بمستويات مختلفة، والتصحيح فوري.",
  },
  {
    icon: PenLine,
    title: "تصحيح المقالي",
    body: "المقالي يراجعه المدرّس بنفسه، ويكتب لك ملاحظته على إجابتك.",
  },
];

const STEPS = [
  "اعمل حساب، واختار إنك طالب عربي ولا لغات.",
  "تواصل مع المدرس عشان يراجع الحساب ويفتحلك الدروس.",
  "ابدأ من أول درس: ذاكر الشرح، وبعدين حل.",
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
          <StartSteps steps={STEPS} />
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

        <section className="mt-20 text-center">
          <h2 className="text-2xl font-semibold text-ink">جاهز تبدأ معانا؟</h2>
          <div className="mt-6">
            <Link href="/signup" className="btn btn-primary">
              انشئ حساب جديد
            </Link>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            بعد التسجيل، المدرّس بيراجع الحساب ويفتح لك المحتوى.
          </p>
        </section>
      </main>

      <footer className="relative z-10 mt-16 border-t-[0.5px] border-line bg-page">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-6 px-5 py-5">
          <div className="flex flex-col items-start gap-1">
            <LogoWordmark />
            <p className="text-xs leading-relaxed text-ink-3">
              الصف الثاني الثانوي · البكالوريا المصرية
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <a
              href="https://wa.me/201501584998"
              target="_blank"
              rel="noreferrer"
              aria-label="للتواصل على واتساب"
              className="inline-flex h-7 items-center gap-2 text-ink"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-5 text-accent">
                <path
                  fill="currentColor"
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                />
              </svg>
              <span className="text-[15px] font-semibold">للتواصل</span>
            </a>
            <p className="text-xs leading-relaxed text-ink-3">جميع الحقوق محفوظة © 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
