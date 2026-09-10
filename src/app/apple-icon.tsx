import { ImageResponse } from "next/og";

/** أيقونة الشاشة الرئيسية على آيفون. المربع كامل؛ آبل تقصّه بشكلها. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 72,
          fontWeight: 500,
          letterSpacing: -3,
        }}
      >
        {"</>"}
      </div>
    ),
    { ...size },
  );
}
