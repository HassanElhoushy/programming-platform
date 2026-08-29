"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { createAnswerImageUploadAction } from "@/app/actions/exam";
import { createClient } from "@/lib/supabase/client";

interface Props {
  attemptId: string;
  questionId: string;
  text: string;
  imagePath: string | null;
  onChangeText: (text: string) => void;
  onChangeImage: (path: string | null) => void;
}

/*
 * ضغط الصورة إجباري قبل الرفع. صورة موبايل خام تتخطى 4 ميجابايت بسهولة،
 * وباقة Supabase المجانية تعطي جيجابايت واحداً للمشروع كله.
 *
 * الضبط مقصود: نُبقي الألوان كما هي ولا نحوّل لأبيض وأسود، لأن التحويل
 * الثنائي يبتلع خط الرصاص الخفيف. نكتفي بخفض الجودة وتقليل الأبعاد،
 * فيبقى الخط مقروءاً وحجم الملف حوالي 300 كيلوبايت.
 */
const COMPRESSION = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.82,
};

export function EssayInput({
  attemptId,
  questionId,
  text,
  imagePath,
  onChangeText,
  onChangeImage,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const previewSrc =
    localPreview ??
    (imagePath
      ? `/answer-image?attempt=${attemptId}&question=${questionId}`
      : null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);

    try {
      const { default: imageCompression } = await import("browser-image-compression");
      const compressed = await imageCompression(file, COMPRESSION);

      const slot = await createAnswerImageUploadAction(attemptId, questionId);
      if (slot.error || !slot.path || !slot.token) {
        setError(slot.error ?? "تعذّر رفع الصورة.");
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("answers")
        .uploadToSignedUrl(slot.path, slot.token, compressed, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        setError("الرفع فشل. اتأكد من النت وجرّب تاني.");
        return;
      }

      setLocalPreview(URL.createObjectURL(compressed));
      onChangeImage(slot.path);
    } catch {
      setError("مقدرناش نجهّز الصورة. جرّب صورة تانية.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
        rows={5}
        className="input resize-y leading-relaxed"
        placeholder="اكتب إجابتك هنا…"
      />

      <div className="divider pt-3">
        <p className="mb-2 text-xs text-ink-3">
          أو ارفع صورة لإجابتك المكتوبة بخط اليد. تقدر تكتب وترفع صورة مع بعض.
        </p>

        {previewSrc ? (
          <div className="flex flex-col gap-2">
            <a
              href={previewSrc}
              target="_blank"
              rel="noreferrer"
              className="relative block overflow-hidden rounded-[6px] border-[0.5px] border-line"
            >
              <Image
                src={previewSrc}
                alt="صورة إجابتك"
                width={800}
                height={600}
                unoptimized
                className="h-auto w-full max-w-sm object-contain"
              />
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <ImagePlus className="size-4" strokeWidth={1.5} />
                استبدال الصورة
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setLocalPreview(null);
                  onChangeImage(null);
                }}
                disabled={busy}
              >
                <Trash2 className="size-4" strokeWidth={1.5} />
                حذف
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <ImagePlus className="size-4" strokeWidth={1.5} />
            )}
            {busy ? "جارٍ رفع الصورة…" : "ارفع صورة الإجابة"}
          </button>
        )}

        {error ? <p className="badge badge-bad mt-2">{error}</p> : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>
    </div>
  );
}
