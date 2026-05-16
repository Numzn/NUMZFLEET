

import { loadImage, prepareIcon } from './mapUtil';

import directionSvg from '../../resources/images/direction.svg';
import backgroundSvg from '../../resources/images/background.svg';
import animalSvg from '../../resources/images/icon/animal.svg';
import bicycleSvg from '../../resources/images/icon/bicycle.svg';
import boatSvg from '../../resources/images/icon/boat.svg';
import busSvg from '../../resources/images/icon/bus.svg';
import carSvg from '../../resources/images/icon/car.svg';
import camperSvg from '../../resources/images/icon/camper.svg';
import craneSvg from '../../resources/images/icon/crane.svg';
import defaultSvg from '../../resources/images/icon/default.svg';
import startSvg from '../../resources/images/icon/start.svg';
import finishSvg from '../../resources/images/icon/finish.svg';
import helicopterSvg from '../../resources/images/icon/helicopter.svg';
import motorcycleSvg from '../../resources/images/icon/motorcycle.svg';
import personSvg from '../../resources/images/icon/person.svg';
import planeSvg from '../../resources/images/icon/plane.svg';
import scooterSvg from '../../resources/images/icon/scooter.svg';
import shipSvg from '../../resources/images/icon/ship.svg';
import tractorSvg from '../../resources/images/icon/tractor.svg';
import trailerSvg from '../../resources/images/icon/trailer.svg';
import trainSvg from '../../resources/images/icon/train.svg';
import tramSvg from '../../resources/images/icon/tram.svg';
import truckSvg from '../../resources/images/icon/truck.svg';
import vanSvg from '../../resources/images/icon/van.svg';

export const mapIcons = {
  animal: animalSvg,
  bicycle: bicycleSvg,
  boat: boatSvg,
  bus: busSvg,
  car: carSvg,
  camper: camperSvg,
  crane: craneSvg,
  default: defaultSvg,
  finish: finishSvg,
  helicopter: helicopterSvg,
  motorcycle: motorcycleSvg,
  person: personSvg,
  plane: planeSvg,
  scooter: scooterSvg,
  ship: shipSvg,
  start: startSvg,
  tractor: tractorSvg,
  trailer: trailerSvg,
  train: trainSvg,
  tram: tramSvg,
  truck: truckSvg,
  van: vanSvg,
};

export const mapIconKey = (category) => {
  switch (category) {
    case 'offroad':
    case 'pickup':
      return 'car';
    case 'trolleybus':
      return 'bus';
    default:
      return Object.prototype.hasOwnProperty.call(mapIcons, category) ? category : 'default';
  }
};

export const mapImages = {};

const LIVE_PX = 56;

/**
 * Minimal enterprise-style puck: soft depth shadow, cool radial body, hairline ring,
 * small monochrome vehicle glyph (state is shown by map circle layers, not this bitmap).
 */
async function prepareMinimalLivePuck(iconImg) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(LIVE_PX * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = w;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = LIVE_PX / 2;
  const cy = LIVE_PX / 2;
  const bodyR = 17.5;

  ctx.save();
  ctx.shadowColor = 'rgba(8, 12, 22, 0.55)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy + 0.35, bodyR, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, bodyR);
  g.addColorStop(0, '#4a5d78');
  g.addColorStop(0.55, '#2b384c');
  g.addColorStop(1, '#141b26');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, bodyR - 0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(cx, cy, bodyR - 2.4, 0, Math.PI * 2);
  ctx.stroke();

  if (iconImg) {
    const glyph = 20;
    const gx = (LIVE_PX - glyph) / 2;
    const gy = (LIVE_PX - glyph) / 2;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(210, 220, 235, 0.97)';
    ctx.fillRect(gx - 1, gy - 1, glyph + 2, glyph + 2);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(iconImg, gx, gy, glyph, glyph);
    ctx.restore();
  }

  return ctx.getImageData(0, 0, w, w);
}

export default async () => {
  const background = await loadImage(backgroundSvg);
  mapImages.background = await prepareIcon(background);
  mapImages.direction = await prepareIcon(await loadImage(directionSvg));

  await Promise.all(
    Object.keys(mapIcons).map(async (category) => {
      const icon = await loadImage(mapIcons[category]);
      mapImages[`${category}-live`] = await prepareMinimalLivePuck(icon);
    }),
  );
};
