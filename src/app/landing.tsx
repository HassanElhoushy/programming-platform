import Link from "next/link";
import { ClipboardCheck, FileText, Layers } from "lucide-react";

import { LogoWordmark } from "@/components/logo";

import { SampleQuestion } from "./sample-question";

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
    body: "تحل وتسلّم، والدرجة توصلك هنا. المقالي يراجعه المدرّس ويكتب لك ملاحظته.",
  },
  {
    icon: Layers,
    title: "بنك الأسئلة",
    body: "من غير وقت ومن غير درجة. الغلط يتشرح، والإجابة الصح كمان.",
  },
];

const STEPS = [
  "اعمل حساب، واختار إنك طالب عربي ولا لغات.",
  "المدرّس يراجع الحساب ويفتح لك الدروس.",
  "ابدأ من أول درس: اقرأ الشرح، وبعدين حل.",
];

export function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="border-b-[0.5px] border-line">
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

      <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm text-ink-3">الصف الثاني الثانوي · البكالوريا المصرية</p>
            <h1 className="mt-3 text-3xl font-semibold leading-snug text-ink sm:text-4xl">
              ذاكر البرمجة والذكاء الاصطناعي صح
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-2 sm:text-base">
              الشرح، والحل، والدرجة في مكان واحد. مسار للعربي ومسار للغات، وكل طالب يشوف مساره بس.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/signup" className="btn btn-primary">
                ابدأ بحساب جديد
              </Link>
              <Link href="/login" className="btn btn-secondary">
                عندي حساب
              </Link>
            </div>
          </div>

          <SampleQuestion />
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border-[0.5px] border-line bg-line sm:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.label} className="bg-surface px-4 py-4">
              <dt className="text-xs text-ink-3">{fact.label}</dt>
              <dd className="tnum mt-1 text-2xl font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-14">
          <h2 className="text-lg font-semibold text-ink">جوه المنصة</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {INSIDE.map((item) => (
              <li key={item.title} className="card px-4 py-4">
                <item.icon className="size-4 text-ink-3" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-lg font-semibold text-ink">إزاي تبدأ</h2>
          <ol className="mt-4 flex flex-col gap-2">
            {STEPS.map((step, i) => (
              <li key={step} className="card flex items-start gap-3 px-4 py-3.5">
                <span className="tnum text-sm font-semibold text-ink-3">{i + 1}</span>
                <p className="text-sm leading-relaxed text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 card px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">عربي، أو لغات</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-2">
              بتختار المسار وأنت بتعمل الحساب. طالب اللغات يشوف المنصة كلها بالإنجليزي، ومن الشمال لليمين.
            </p>
          </div>
          <Link href="/signup" className="btn btn-primary mt-4 shrink-0 sm:mt-0">
            حساب جديد
          </Link>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-ink-3">
          بعد التسجيل، المدرّس بيراجع الحساب ويفتح المحتوى.
        </p>
      </main>
    </div>
  );
}
