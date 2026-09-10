import { ImageResponse } from "next/og";

/**
 * أيقونة التبويب. الملف القديم كان favicon.ico الافتراضي لـ Next
 * (مثلث أبيض على أسود) فيظهر في التبويب كمنتج تاني.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2B4257",
          color: "#ffffff",
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: -1.2,
        }}
      >
        {"</>"}
      </div>
    ),
    { ...size },
  );
}
