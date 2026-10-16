/**
 * A requestAnimationFrame loop that only runs while something is animating.
 *
 * Subscribers (marker rendering, camera lock) are called together, in
 * registration order, at most every FRAME_INTERVAL_MS. The final frame of a
 * glide is always delivered, so motion ends exactly on the target. When nothing
 * is animating there is no timer and no work at all.
 */
export const FRAME_INTERVAL_MS = 33;

export const createFrameLoop = ({
  isActive,
  requestFrame,
  cancelFrame,
  now,
}) => {
  const subscribers = new Set();
  let handle = null;
  let lastRun = -Infinity;

  const tick = () => {
    handle = null;
    const t = now();
    const active = isActive(t);
    if (!active || t - lastRun >= FRAME_INTERVAL_MS) {
      lastRun = t;
      subscribers.forEach((subscriber) => subscriber(t));
    }
    if (active) handle = requestFrame(tick);
  };

  return {
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    /** Start the loop if there is something to animate and it is not running. */
    kick() {
      if (handle == null && isActive(now())) handle = requestFrame(tick);
    },

    stop() {
      if (handle != null) cancelFrame(handle);
      handle = null;
    },
  };
};

export default createFrameLoop;
