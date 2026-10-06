"use client";

import { useEffect, useRef } from "react";

/**
 * خلفية صفحة الزائر فقط. رموز برمجية خافتة على الشريط الغامق وعلى الصفحة
 * الفاتحة، بتتنفّس لوحدها وبتقترب من الماوس. مش واجهة، وممنوعة خارج الصفحة دي.
 */

const GLYPHS = ["0", "1", "{", "}", "</>", ";", "=>", "(", ")", "[", "]"];
const STEP = 48;
const REACH = 150;

type Cell = { x: number; y: number; glyph: string; phase: number };

export function LandingField({ tone }: { tone: "dark" | "light" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = ref.current;
    const root = node?.parentElement ?? null;
    if (!node || !root) return;
    const context = node.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = node;
    const parent: HTMLElement = root;
    const ctx: CanvasRenderingContext2D = context;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const font = `400 13px ${getComputedStyle(document.body).fontFamily}`;

    let cells: Cell[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let band = 0;
    let raf = 0;
    let running = true;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, on: false };

    function measure() {
      width = parent.clientWidth;
      height = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      const bandEl = parent.querySelector<HTMLElement>("[data-band]");
      band = tone === "dark" ? height : bandEl ? bandEl.offsetTop + bandEl.offsetHeight : 0;

      const cols = Math.ceil(width / STEP) + 1;
      const rows = Math.ceil(height / STEP) + 1;
      cells = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const n = row * cols + col;
          cells.push({
            x: col * STEP + (row % 2 ? STEP / 2 : STEP / 4),
            y: row * STEP + STEP / 2,
            glyph: GLYPHS[n % GLYPHS.length],
            phase: ((n * 17) % 100) / 100,
          });
        }
      }
    }

    function focus(): { x: number; y: number; strength: number } {
      if (pointer.on) return { x: pointer.x, y: pointer.y, strength: 1 };
      if (reduce) return { x: -9999, y: -9999, strength: 0 };
      const t = performance.now();
      const span = tone === "dark" ? height : Math.max(height - band, 1);
      const origin = tone === "dark" ? 0 : band;
      return {
        x: width * (0.5 + 0.22 * Math.sin(t / 2800)),
        y: origin + span * (0.42 + 0.2 * Math.cos(t / 3400)),
        strength: 0.55,
      };
    }

    function draw(now: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (pointer.on) {
        pointer.x += (pointer.tx - pointer.x) * 0.18;
        pointer.y += (pointer.ty - pointer.y) * 0.18;
      }
      const spot = focus();

      const top = Math.max(0, window.scrollY - STEP);
      const bottom = top + window.innerHeight + STEP * 2;

      for (const cell of cells) {
        if (cell.y < top || cell.y > bottom) continue;
        if (tone === "light" && cell.y < band) continue;
        const dark = tone === "dark";
        const dx = cell.x - spot.x;
        const dy = cell.y - spot.y;
        const dist = Math.hypot(dx, dy) || 1;
        const near = spot.strength * Math.max(0, 1 - dist / REACH);
        const breathe = reduce ? 0 : 0.5 + 0.5 * Math.sin(now / 900 + cell.phase * Math.PI * 2);
        const base = dark ? 0.24 : 0.22;
        const alpha = base + breathe * 0.06 + near * (dark ? 0.72 : 0.45);
        const push = reduce ? 0 : near * 16;
        const drift = reduce ? 0 : Math.sin(now / 1400 + cell.x * 0.012) * 1.6;
        const x = cell.x + (dx / dist) * push;
        const y = cell.y + (dy / dist) * push + drift;

        ctx.fillStyle = dark
          ? `rgba(174, 188, 203, ${alpha})`
          : near > 0.25
            ? `rgba(43, 66, 87, ${alpha})`
            : `rgba(154, 152, 141, ${alpha})`;
        ctx.fillText(cell.glyph, x, y);

        if (near > 0.28) {
          ctx.strokeStyle = dark
            ? `rgba(174, 188, 203, ${near * 0.4})`
            : `rgba(43, 66, 87, ${near * 0.28})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(spot.x, spot.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }

    function frame(now: number) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    function onPointer(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
      if (!pointer.on) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        pointer.on = true;
      }
    }

    function onLeave() {
      pointer.on = false;
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    window.addEventListener("pointermove", onPointer);
    document.documentElement.addEventListener("pointerleave", onLeave);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running && !reduce) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    if (reduce) draw(0);
    else raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tone]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}
