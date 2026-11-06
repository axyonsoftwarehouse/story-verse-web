import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";

type Mote = { x: number; y: number; r: number; vy: number; vx: number; phase: number; speed: number };

/**
 * Poeira dourada subindo devagar atrás do conteúdo (como pó de livro numa réstia de luz).
 * Leve: um canvas, ~40 partículas, e para quando sai da tela, quando a aba fica escondida e para
 * quem pediu menos movimento no aparelho.
 */
export function GoldDust({ density = 40 }: { density?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || prefersReducedMotion()) return;
    // Sem estes (testes em jsdom, navegador muito antigo): fica só o fundo, sem poeira.
    if (typeof ResizeObserver === "undefined" || typeof IntersectionObserver === "undefined") return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const color = getComputedStyle(el).getPropertyValue("--dust").trim() || "228, 184, 106";
    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    let raf = 0;
    let visible = true;

    const spawn = (anywhere: boolean): Mote => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 6,
      r: 0.6 + Math.random() * 1.9,
      vy: 0.08 + Math.random() * 0.28,
      vx: (Math.random() - 0.5) * 0.12,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.4,
    });

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Celular: menos partículas (a tela é menor e a bateria agradece).
      const count = Math.round(density * Math.min(1, (width * height) / (1200 * 520)) + 8);
      motes = Array.from({ length: count }, () => spawn(true));
    };

    const frame = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const m of motes) {
        m.y -= m.vy;
        m.x += m.vx + Math.sin(t / 2400 + m.phase) * 0.12;
        if (m.y < -6 || m.x < -6 || m.x > width + 6) Object.assign(m, spawn(false));
        // Pisca devagar, e some perto do topo.
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 900 * m.speed + m.phase));
        const fade = Math.min(1, m.y / (height * 0.35));
        const alpha = 0.8 * twinkle * fade;
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
        glow.addColorStop(0, `rgba(${color}, ${alpha})`);
        glow.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    start();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(el);
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return <canvas ref={canvas} className="gold-dust" aria-hidden="true" />;
}
