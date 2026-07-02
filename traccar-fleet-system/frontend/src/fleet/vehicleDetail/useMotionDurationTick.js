import { useEffect, useState } from 'react';

/** Re-render motion duration labels on an interval without waiting for WS ticks. */
export default function useMotionDurationTick(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
