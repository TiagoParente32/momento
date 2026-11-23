import { useEffect, useState } from 'react';

/** Re-render every second (or minute) – shared by clock-like widgets. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      t = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    t = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => clearTimeout(t);
  }, [intervalMs]);
  return now;
}

export function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
