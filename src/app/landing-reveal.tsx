"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * يظهر العنصر وهو داخل الشاشة. لو الزائر طلب تقليل الحركة، يظهر فوراً.
 */
export function Reveal({
  as = "div",
  delay = 0,
  variant = "card",
  line,
  step,
  onShow,
  className,
  children,
}: {
  as?: "div" | "li";
  delay?: number;
  /** الخطوة تظهر لما توصل لأعلى الشاشة، عشان كل رقم يبان لوحده مع النزول */
  variant?: "card" | "step";
  /** نسبة ارتفاع الشاشة. أكبر يعني يظهر والعنصر لسه أقرب لأسفل الشاشة */
  line?: number;
  step?: number;
  onShow?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const onShowRef = useRef(onShow);
  useEffect(() => {
    onShowRef.current = onShow;
  }, [onShow]);

  useEffect(() => {
    if (!node) return;
    const finish = () => {
      setShown(true);
      onShowRef.current?.();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const edge = line ?? (variant === "step" ? 0.8 : 0.9);
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      const rect = node.getBoundingClientRect();
      if (rect.top >= window.innerHeight * edge) return;
      revealed = true;
      finish();
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
  }, [node, variant, line]);

  const style: CSSProperties = { transitionDelay: shown ? `${delay}ms` : "0ms" };

  return createElement(
    as,
    {
      ref: setNode,
      style,
      ...(step === undefined ? {} : { "data-step": step }),
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
