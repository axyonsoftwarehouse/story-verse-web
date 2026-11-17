import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

/** Quem pediu menos movimento no sistema vê tudo parado. */
/** Número que sobe de 0 até `value` ao aparecer (≈0,9 s, desacelerando no fim). */
function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

export function CountUp({ value, format = (n: number) => String(n) }: { value: number; format?: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}
