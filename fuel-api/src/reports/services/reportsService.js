import { getTripsSummary } from '../adapters/traccarAdapter.js';
import { getFuelSummary } from '../adapters/fuelAdapter.js';

const MAX_RANGE_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parseDate = (value, fieldName, endOfDay = false) => {
  const normalizedValue = DATE_ONLY_PATTERN.test(value)
    ? `${value}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`
    : value;

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${fieldName} must be a valid ISO date`);
  }
  return parsed;
};

const parseDeviceId = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest('deviceId must be a positive integer');
  }
  return parsed;
};

export const getFuelSummaryReport = async ({ query, user }) => {
  if (!user) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }

  const { deviceId, from, to } = query;

  if (!deviceId) {
    throw badRequest('deviceId is required');
  }

  if (!from || !to) {
    throw badRequest('from and to are required');
  }

  const parsedDeviceId = parseDeviceId(deviceId);
  const fromDate = parseDate(from, 'from', false);
  const toDate = parseDate(to, 'to', true);

  if (fromDate > toDate) {
    throw badRequest('from must be before to');
  }

  const rangeMs = toDate.getTime() - fromDate.getTime();
  if (rangeMs > MAX_RANGE_DAYS * DAY_IN_MS) {
    throw badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  const [tripSummary, fuelSummary] = await Promise.all([
    getTripsSummary({
      deviceId: parsedDeviceId,
      from: fromDate,
      to: toDate,
    }),
    getFuelSummary({
      deviceId: parsedDeviceId,
      from: fromDate,
      to: toDate,
    }),
  ]);

  const totalDistance = Number(tripSummary.totalDistance || 0);
  const tripCount = Number(tripSummary.tripCount || 0);
  const positionCount = Number(tripSummary.positionCount || 0);
  const totalFuel = Number(fuelSummary.totalFuel || 0);
  const totalCost = Number(fuelSummary.totalCost || 0);
  const fuelRequestCount = Number(fuelSummary.fuelRequestCount || 0);

  return {
    deviceId: parsedDeviceId,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    totalDistance,
    totalFuel,
    totalCost,
    efficiency: totalFuel > 0 ? totalDistance / totalFuel : 0,
    costPerKm: totalDistance > 0 ? totalCost / totalDistance : 0,
    tripCount,
    fuelRequestCount,
    positionCount,
    meta: {
      distanceSource: tripSummary.distanceSource || 'positions_estimated',
      truncated: Boolean(tripSummary.truncated),
      positionLimit: Number(tripSummary.positionLimit || 0),
      processedPositions: Number(tripSummary.processedPositions || 0),
      distanceUnit: 'km',
      efficiencyUnit: 'km/L',
    },
  };
};
