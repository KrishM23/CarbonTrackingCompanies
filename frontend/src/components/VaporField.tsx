import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
};

type Props = {
  className?: string;
  density?: number;
};

/** Soft wisps that spawn low and rise upward, then fade out. */
export function VaporField({ className = "", density = 28 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const particles: Particle[] = [];

    const spawn = (stagger = false): Particle => {
      const maxLife = 5 + Math.random() * 4;
      // Start in the lower band so motion reads as rising through the hero
      const baseY = h * (0.72 + Math.random() * 0.35);
      return {
        x: Math.random() * w,
        y: stagger ? baseY + Math.random() * 80 : baseY,
        r: 10 + Math.random() * 26,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -(0.35 + Math.random() * 0.55),
        life: stagger ? Math.random() * maxLife * 0.6 : 0,
        maxLife,
      };
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles.length = 0;
      while (particles.length < density) particles.push(spawn(true));
    };

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += 0.016;
        p.x += p.vx + Math.sin(p.life * 1.2 + i) * 0.12;
        p.y += p.vy;

        const t = p.life / p.maxLife;
        if (t >= 1 || p.y + p.r < -20) {
          particles[i] = spawn(false);
          continue;
        }

        const fade = t < 0.15 ? t / 0.15 : t > 0.5 ? 1 - (t - 0.5) / 0.5 : 1;
        const alpha = Math.max(0, fade) * 0.16;
        const radius = p.r * (0.75 + t * 1.35);

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        g.addColorStop(0, `rgba(244, 245, 247, ${alpha})`);
        g.addColorStop(0.45, `rgba(61, 214, 140, ${alpha * 0.32})`);
        g.addColorStop(1, "rgba(61, 214, 140, 0)");
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (running) raf = requestAnimationFrame(draw);
        else cancelAnimationFrame(raf);
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      io.disconnect();
    };
  }, [density]);

  return <canvas ref={canvasRef} className={`vapor-field ${className}`.trim()} aria-hidden />;
}
