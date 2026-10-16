/**
 * Procedural map sprites for the live vehicle markers: a top-down car that
 * points "up" (north) and is rotated by the map with the vehicle's heading, and
 * a translucent heading cone that sits underneath it.
 *
 * The drawing functions only need a 2D context in a logical coordinate space
 * (no DOM), so they can be previewed anywhere; `buildSprite` turns one into the
 * ImageData MapLibre wants, at the device pixel ratio it is registered with.
 */

/** Logical size of the car sprite. The ring layer is sized relative to this. */
export const CAR_SPRITE_PX = 64;
/** Logical size of the heading cone sprite (the vehicle sits at its centre). */
export const CONE_SPRITE_PX = 128;
/** Radius, at icon-size 1, of the status ring drawn around a top-down car. */
export const CAR_RING_RADIUS_PX = 29;
/**
 * How large a top-down car is drawn relative to the generic icon size (the round
 * puck for other vehicle kinds uses 1). The ring, heading cone and label follow it.
 */
export const CAR_SIZE_FACTOR = 0.8;

/** Trace the car body, nose at the top, as a closed symmetric path. */
const carBodyPath = () => {
  const p = new Path2D();
  p.moveTo(32, 8);
  p.bezierCurveTo(38.5, 8, 42.4, 11.2, 43, 17.5);
  p.bezierCurveTo(43.4, 21, 43.8, 24, 43.9, 28);
  p.bezierCurveTo(44.2, 34, 44, 41, 43.2, 46);
  p.bezierCurveTo(42.2, 51.5, 38.5, 55, 32, 55.2);
  p.bezierCurveTo(25.5, 55, 21.8, 51.5, 20.8, 46);
  p.bezierCurveTo(20, 41, 19.8, 34, 20.1, 28);
  p.bezierCurveTo(20.2, 24, 20.6, 21, 21, 17.5);
  p.bezierCurveTo(21.6, 11.2, 25.5, 8, 32, 8);
  p.closePath();
  return p;
};

/** Draw the same shape on both sides of the car's centre line. */
const mirrored = (ctx, draw) => {
  draw();
  ctx.save();
  ctx.translate(64, 0);
  ctx.scale(-1, 1);
  draw();
  ctx.restore();
};

/** A white sedan seen from above, nose up, in a 64x64 logical box. */
export const drawTopDownCar = (ctx) => {
  const body = carBodyPath();

  // Soft contact shadow so the car lifts off any map style.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1.6;
  ctx.fillStyle = '#c9d0da';
  ctx.fill(body);
  ctx.restore();

  // Pearl-white paint: lighter down the middle, a touch darker at the flanks.
  const paint = ctx.createLinearGradient(20, 0, 44, 0);
  paint.addColorStop(0, '#bfc7d3');
  paint.addColorStop(0.28, '#f4f6f9');
  paint.addColorStop(0.5, '#ffffff');
  paint.addColorStop(0.72, '#f4f6f9');
  paint.addColorStop(1, '#bfc7d3');
  ctx.fillStyle = paint;
  ctx.fill(body);

  // A little shading toward the nose and tail gives the body some volume.
  const length = ctx.createLinearGradient(0, 8, 0, 55);
  length.addColorStop(0, 'rgba(120, 135, 160, 0.22)');
  length.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
  length.addColorStop(0.75, 'rgba(255, 255, 255, 0)');
  length.addColorStop(1, 'rgba(120, 135, 160, 0.28)');
  ctx.fillStyle = length;
  ctx.fill(body);

  ctx.strokeStyle = 'rgba(40, 52, 72, 0.55)';
  ctx.lineWidth = 0.7;
  ctx.stroke(body);

  // Windscreen and panoramic roof (one dark run), pale roof strip, rear window.
  const glass = ctx.createLinearGradient(0, 21, 0, 37);
  glass.addColorStop(0, '#202c47');
  glass.addColorStop(1, '#0a1020');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(23.6, 24.6);
  ctx.quadraticCurveTo(32, 20.8, 40.4, 24.6);
  ctx.lineTo(41.2, 36.4);
  ctx.quadraticCurveTo(32, 34.8, 22.8, 36.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e4e8ee';
  ctx.beginPath();
  ctx.moveTo(22.8, 36.9);
  ctx.quadraticCurveTo(32, 35.3, 41.2, 36.9);
  ctx.lineTo(41, 41.6);
  ctx.quadraticCurveTo(32, 40.6, 23, 41.6);
  ctx.closePath();
  ctx.fill();

  const rear = ctx.createLinearGradient(0, 42, 0, 49);
  rear.addColorStop(0, '#0a1020');
  rear.addColorStop(1, '#1d2944');
  ctx.fillStyle = rear;
  ctx.beginPath();
  ctx.moveTo(23.3, 42.3);
  ctx.quadraticCurveTo(32, 41.4, 40.7, 42.3);
  ctx.lineTo(39.4, 47.8);
  ctx.quadraticCurveTo(32, 49.2, 24.6, 47.8);
  ctx.closePath();
  ctx.fill();

  // Glass highlight.
  ctx.strokeStyle = 'rgba(190, 210, 255, 0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(26.5, 26.4);
  ctx.lineTo(27.3, 33.2);
  ctx.stroke();

  // Door mirrors.
  mirrored(ctx, () => {
    ctx.fillStyle = '#dfe4ea';
    ctx.strokeStyle = 'rgba(40, 52, 72, 0.6)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(19.3, 25, 1.7, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Headlights.
  mirrored(ctx, () => {
    ctx.fillStyle = 'rgba(255, 246, 214, 0.95)';
    ctx.beginPath();
    ctx.moveTo(24.4, 13.6);
    ctx.quadraticCurveTo(26, 10.9, 29.6, 10.2);
    ctx.quadraticCurveTo(28, 12.4, 27.4, 14.2);
    ctx.closePath();
    ctx.fill();
  });

  // Tail lights, glowing red.
  ctx.save();
  ctx.shadowColor = 'rgba(255, 40, 40, 0.9)';
  ctx.shadowBlur = 3.2;
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  mirrored(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(22.6, 50);
    ctx.quadraticCurveTo(24.4, 53.2, 28.6, 53.8);
    ctx.stroke();
  });
  ctx.restore();
};

/**
 * Translucent arrowhead showing where the vehicle is heading, with a chevron
 * ahead of it. Drawn pointing up in a 128x128 box centred on the vehicle; the
 * wide base hides under the car, so only the tip shows beyond it.
 */
export const drawHeadingCone = (ctx) => {
  const arrow = ctx.createLinearGradient(0, 14, 0, 62);
  arrow.addColorStop(0, 'rgba(170, 205, 255, 0.92)');
  arrow.addColorStop(0.55, 'rgba(110, 160, 245, 0.55)');
  arrow.addColorStop(1, 'rgba(80, 130, 230, 0.12)');

  ctx.save();
  ctx.shadowColor = 'rgba(120, 170, 255, 0.55)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = arrow;
  ctx.beginPath();
  ctx.moveTo(64, 16);
  ctx.lineTo(87, 62);
  ctx.quadraticCurveTo(64, 53, 41, 62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(200, 222, 255, 0.95)';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(53, 12);
  ctx.lineTo(64, 4.5);
  ctx.lineTo(75, 12);
  ctx.stroke();
};

/**
 * Render a drawing function to ImageData at `pixelRatio` (the ratio the image
 * is registered with, so it stays crisp on high-density screens).
 */
export const buildSprite = (logicalSize, draw, pixelRatio = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1) => {
  const size = Math.round(logicalSize * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(pixelRatio, pixelRatio);
  draw(ctx);
  return ctx.getImageData(0, 0, size, size);
};

export const prepareTopDownCar = () => buildSprite(CAR_SPRITE_PX, drawTopDownCar);
export const prepareHeadingCone = () => buildSprite(CONE_SPRITE_PX, drawHeadingCone);
