"use client";

import { usePathname } from "next/navigation";

import { LandingField } from "@/app/landing-field";

/** الامتحان وحل البنك مش صفحات تصفح. الخلفية متظهرش وهم بيحلوا. */
const SOLVING = /^\/exams\/[^/]+$|^\/bank\/practice/;

export function MotionBackdrop({
  enabled,
  hideWhileSolving = false,
}: {
  enabled: boolean;
  hideWhileSolving?: boolean;
}) {
  const path = usePathname();
  if (!enabled) return null;
  if (hideWhileSolving && SOLVING.test(path)) return null;
  return <LandingField tone="light" />;
}
