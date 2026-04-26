import { grey } from '@mui/material/colors';
import { createTheme } from '@mui/material';
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
      return mapIcons.hasOwnProperty(category) ? category : 'default';
  }
};

export const mapImages = {};

const theme = createTheme({
  palette: {
    neutral: { main: grey[500] },
    // Enhanced color palette for better status indication
    success: { main: '#4caf50' }, // Green for online
    error: { main: '#f44336' },    // Red for offline
    warning: { main: '#ff9800' },  // Orange for moving
    info: { main: '#2196f3' },    // Blue for idle
    neutral: { main: grey[500] },  // Gray for unknown
  },
});

// Enhanced icon preparation with better styling
const prepareEnhancedIcon = async (background, icon, color, status = 'neutral') => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = 32;
  canvas.height = 32;
  
  // Draw background circle with status color
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  
  // Add white border
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw icon in center
  if (icon) {
    const iconSize = 20;
    const iconX = (32 - iconSize) / 2;
    const iconY = (32 - iconSize) / 2;
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
  }
  
  // Add status indicator dot
  ctx.beginPath();
  ctx.arc(24, 8, 4, 0, 2 * Math.PI);
  ctx.fillStyle = theme.palette[status].main;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

export default async () => {
  const background = await loadImage(backgroundSvg);
  mapImages.background = await prepareIcon(background);
  mapImages.direction = await prepareIcon(await loadImage(directionSvg));
  
  // Create speed indicator icon
  const speedCanvas = document.createElement('canvas');
  const speedCtx = speedCanvas.getContext('2d');
  speedCanvas.width = 16;
  speedCanvas.height = 16;
  
  speedCtx.beginPath();
  speedCtx.arc(8, 8, 6, 0, 2 * Math.PI);
  speedCtx.fillStyle = '#ff9800';
  speedCtx.fill();
  speedCtx.strokeStyle = 'white';
  speedCtx.lineWidth = 1;
  speedCtx.stroke();
  
  speedCtx.fillStyle = 'white';
  speedCtx.font = '10px Arial';
  speedCtx.textAlign = 'center';
  speedCtx.fillText('⚡', 8, 12);
  
  mapImages['speed-indicator'] = await prepareIcon(speedCanvas);
  
  // Create enhanced icons for each category and status
  await Promise.all(Object.keys(mapIcons).map(async (category) => {
    const results = [];
    ['info', 'success', 'error', 'warning', 'neutral'].forEach((status) => {
      results.push(loadImage(mapIcons[category]).then((icon) => {
        const color = status === 'success' ? '#4caf50' :
                     status === 'error' ? '#f44336' :
                     status === 'warning' ? '#ff9800' :
                     status === 'info' ? '#2196f3' :
                     '#9e9e9e';
        return prepareEnhancedIcon(background, icon, color, status).then((preparedIcon) => {
          mapImages[`${category}-${status}`] = preparedIcon;
        });
      }));
    });
    await Promise.all(results);
  }));
};









