import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "منصة البرمجة",
  description: "منصة البرمجة والذكاء الاصطناعي — الصف الثاني الثانوي، البكالوريا المصرية",
};

export const viewport: Viewport = {
  themeColor: "#FBFAF7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
