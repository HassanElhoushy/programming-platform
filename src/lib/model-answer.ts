/**
 * يفصل توزيع الدرجات عن نص الإجابة النموذجية للعرض فقط.
 * النص في قاعدة البيانات يبقى قطعة واحدة، والعنوان آخر فقرة:
 * «توزيع الدرجات:» في العربي و «Mark scheme:» في اللغات.
 */

const RUBRIC_MARKERS = ["\n\nتوزيع الدرجات:", "\n\nMark scheme:"] as const;

export function splitModelAnswer(text: string): { answer: string; scheme: string | null } {
  let at = -1;
  let marker = "";
  for (const candidate of RUBRIC_MARKERS) {
    const index = text.indexOf(candidate);
    if (index !== -1 && (at === -1 || index < at)) {
      at = index;
      marker = candidate;
    }
  }
  if (at === -1) return { answer: text, scheme: null };

  const answer = text.slice(0, at).trim();
  const scheme = text.slice(at + marker.length).trim();
  if (!answer || !scheme) return { answer: text, scheme: null };
  return { answer, scheme };
}
