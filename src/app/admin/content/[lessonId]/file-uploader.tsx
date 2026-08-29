"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import {
  createFileUploadAction,
  finalizeFileAction,
} from "@/app/actions/admin-content";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize } from "@/lib/format";

const MAX_BYTES = 20 * 1024 * 1024;

export function FileUploader({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"explanation" | "slides">("explanation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(selected: File | undefined) {
    setError(null);
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      setError("الملف لازم يكون PDF.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError(`حجم الملف ${formatFileSize(selected.size)} — الحد الأقصى 20 ميجابايت.`);
      return;
    }

    setFile(selected);
    if (title.trim() === "") {
      setTitle(selected.name.replace(/\.pdf$/i, ""));
    }
  }

  function reset() {
    setFile(null);
    setTitle("");
    setKind("explanation");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setBusy(true);

    try {
      const slot = await createFileUploadAction(lessonId);
      if (slot.error || !slot.path || !slot.token) {
        setError(slot.error ?? "تعذّر تجهيز الرفع.");
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("files")
        .uploadToSignedUrl(slot.path, slot.token, file, {
          contentType: "application/pdf",
        });

      if (uploadError) {
        setError("الرفع فشل. اتأكد من النت وجرّب تاني.");
        return;
      }

      const saved = await finalizeFileAction({
        lessonId,
        storagePath: slot.path,
        title,
        kind,
        sizeBytes: file.size,
      });

      if (saved.error) {
        setError(saved.error);
        return;
      }

      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card px-4 py-4">
      {!file ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" strokeWidth={1.5} />
          ارفع ملف PDF
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">
            {file.name}{" "}
            <span className="text-ink-3">({formatFileSize(file.size)})</span>
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div>
              <label className="label" htmlFor="file-title">
                عنوان الملف
              </label>
              <input
                id="file-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="مثال: شرح الدرس الأول"
              />
            </div>

            <div>
              <label className="label" htmlFor="file-kind">
                النوع
              </label>
              <select
                id="file-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "explanation" | "slides")}
                className="input"
              >
                <option value="explanation">شرح</option>
                <option value="slides">سلايدز</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void upload()}
              disabled={busy || title.trim().length < 2}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Upload className="size-4" strokeWidth={1.5} />
              )}
              {busy ? "جارٍ الرفع…" : "رفع الملف"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={reset}
              disabled={busy}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="badge badge-bad mt-3 w-full justify-start px-3 py-2">{error}</p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
