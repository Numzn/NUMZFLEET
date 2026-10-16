import { createMotionTracker } from './markerMotion.js';
import { createFrameLoop } from './motionFrameLoop.js';

/**
 * The one marker-motion tracker and frame loop for the live map. Markers draw
 * from it and the follow camera locks onto it, so both move on the same clock.
 * Browser-only globals are touched lazily so the module imports anywhere.
 */
export const motionClock = () => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
);

export const markerMotion = createMotionTracker();

export const frameLoop = createFrameLoop({
  isActive: (now) => markerMotion.isAnimating(now),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
  now: motionClock,
});

/** Honour the OS "reduce motion" setting: show fixes as they arrive. */
export const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);
