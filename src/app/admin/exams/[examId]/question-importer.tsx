"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, FileJson, Loader2, Upload } from "lucide-react";

import { addQuestionAction, importQuestionsAction } from "@/app/actions/admin-exams";
import { FORMAT_NOTES, SAMPLE_JSON } from "@/lib/sample-questions";

type Mode = "replace" | "single";

export function QuestionImporter({
  examId,
  hasQuestions,
}: {
  examId: string;
  hasQuestions: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("replace");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFormat, setShowFormat] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    setDetails([]);
    setSuccess(null);

    const result =
      mode === "replace"
        ? await importQuestionsAction(examId, text)
        : await addQuestionAction(examId, text);

    if (result.error) {
      setError(result.error);
      setDetails(result.details ?? []);
    } else {
      setSuccess(
        mode === "replace"
          ? `تم استيراد ${"count" in result ? result.count : 0} سؤال.`
          : "تمت إضافة السؤال.",
      );
      setText("");
      router.refresh();
    }

    setBusy(false);
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_JSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "نموذج-الأسئلة.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card px-4 py-4 sm:px-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={mode === "replace" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setMode("replace")}
        >
          استيراد ملف كامل
        </button>
        <button
          type="button"
          className={mode === "single" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setMode("single")}
        >
          إضافة سؤال واحد
        </button>
      </div>

      {mode === "replace" && hasQuestions ? (
        <p className="badge badge-wait mb-3 w-full justify-start px-3 py-2 leading-relaxed">
          الاستيراد هيمسح كل أسئلة الامتحان الحالية ويحط مكانها أسئلة الملف.
        </p>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fileRef.current?.click()}
        >
          <FileJson className="size-4" strokeWidth={1.5} />
          اختر ملف JSON
        </button>
        <button type="button" className="btn btn-ghost" onClick={downloadSample}>
          <Download className="size-4" strokeWidth={1.5} />
          نزّل ملفاً نموذجياً
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowFormat((v) => !v)}
        >
          {showFormat ? "إخفاء شرح الصيغة" : "شرح الصيغة"}
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        dir="ltr"
        spellCheck={false}
        className="input resize-y font-mono text-xs leading-relaxed"
        placeholder={
          mode === "replace"
            ? 'الصق محتوى الملف هنا، أو اختر ملفاً من الزر فوق…'
            : 'الصق سؤالاً واحداً بصيغة { "type": "...", "body": "..." }'
        }
      />

      {error ? (
        <div className="mt-3">
          <p className="badge badge-bad w-full justify-start px-3 py-2">{error}</p>
          {details.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 px-1">
              {details.map((line, i) => (
                <li key={i} className="text-xs leading-relaxed text-bad">
                  • {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <p className="badge badge-ok mt-3 w-full justify-start px-3 py-2">{success}</p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary mt-4"
        onClick={() => void run()}
        disabled={busy || text.trim().length === 0}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <Upload className="size-4" strokeWidth={1.5} />
        )}
        {busy ? "جارٍ الاستيراد…" : mode === "replace" ? "استيراد الأسئلة" : "إضافة السؤال"}
      </button>

      {showFormat ? (
        <div className="divider mt-5 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">مثال على الصيغة</p>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(SAMPLE_JSON);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <Check className="size-3.5" strokeWidth={1.5} />
              ) : (
                <Copy className="size-3.5" strokeWidth={1.5} />
              )}
              {copied ? "اتنسخ" : "نسخ"}
            </button>
          </div>

          <pre
            dir="ltr"
            className="overflow-x-auto rounded-[6px] border-[0.5px] border-line bg-page px-3 py-3 text-left font-mono text-[11px] leading-relaxed text-ink-2"
          >
            {SAMPLE_JSON}
          </pre>

          <dl className="mt-4 flex flex-col gap-3">
            {FORMAT_NOTES.map((note) => (
              <div key={note.title}>
                <dt dir="ltr" className="text-right font-mono text-xs text-ink">
                  {note.title}
                </dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-ink-2">
                  {note.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => readFile(e.target.files?.[0])}
      />
    </div>
  );
}
