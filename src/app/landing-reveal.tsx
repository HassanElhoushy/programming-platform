"use client";

import { createElement, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * يظهر العنصر وهو داخل الشاشة. لو الزائر طلب تقليل الحركة، يظهر فوراً.
 */
export function Reveal({
  as = "div",
  delay = 0,
  variant = "card",
  className,
  children,
}: {
  as?: "div" | "li";
  delay?: number;
  /** الخطوة تظهر لما توصل لأعلى الشاشة، عشان كل رقم يبان لوحده مع النزول */
  variant?: "card" | "step";
  className?: string;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const line = variant === "step" ? 0.72 : 0.9;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      const rect = node.getBoundingClientRect();
      if (rect.top >= window.innerHeight * line) return;
      revealed = true;
      setShown(true);
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("resize", reveal);
    };
    reveal();
    window.addEventListener("scroll", reveal, { passive: true });
    window.addEventListener("resize", reveal);
    return () => {
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("resize", reveal);
    };
  }, [node, variant]);

  const style: CSSProperties = { transitionDelay: shown ? `${delay}ms` : "0ms" };

  return createElement(
    as,
    {
      ref: setNode,
      style,
      className: cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
        shown
          ? "translate-y-0 scale-100 opacity-100"
          : "motion-safe:translate-y-8 motion-safe:scale-[0.97] motion-safe:opacity-0",
        className,
      ),
    },
    children,
  );
}
