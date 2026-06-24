const DEFAULT_WINDOW_DAYS = 30;

function refuelTimestamp(row) {
  const t = new Date(row?.sessionDate || row?.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function refuelDate(row) {
  return new Date(row?.sessionDate || row?.createdAt);
}

/**
 * Tank-to-tank fuel efficiency from consecutive operation refuel rows.
 * Distance = ODOₙ − ODOₙ₋₁; fuel = actualFuelLitres at fill N.
 *
 * @param {Array<{ actualFuelLitres?: number, currentMileage?: number, sessionDate?: string, createdAt?: string }>} refuelRows
 * @param {{ windowDays?: number | null }} [options]
 */
export function calculateTankToTankEfficiency(refuelRows = [], options = {}) {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = windowDays != null
    ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    : null;

  const sorted = [...refuelRows]
    .filter((row) => {
      const litres = Number(row?.actualFuelLitres);
      if (!Number.isFinite(litres) || litres <= 0) return false;
      if (cutoff) {
        const d = refuelDate(row);
        if (Number.isNaN(d.getTime()) || d < cutoff) return false;
      }
      return true;
    })
    .sort((a, b) => refuelTimestamp(a) - refuelTimestamp(b));

  let totalDistanceKm = 0;
  let totalFuelLitres = 0;
  let intervalCount = 0;

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevM = Number(prev.currentMileage);
    const curM = Number(cur.currentMileage);
    const fuel = Number(cur.actualFuelLitres);

    if (!Number.isFinite(prevM) || !Number.isFinite(curM) || curM <= prevM) continue;
    if (!Number.isFinite(fuel) || fuel <= 0) continue;

    totalDistanceKm += curM - prevM;
    totalFuelLitres += fuel;
    intervalCount += 1;
  }

  const base = {
    totalDistanceKm: totalDistanceKm > 0 ? Number(totalDistanceKm.toFixed(0)) : null,
    totalFuelLitres: totalFuelLitres > 0 ? Number(totalFuelLitres.toFixed(1)) : null,
    intervalCount,
    refuelCountInWindow: sorted.length,
    windowDays,
    measured: intervalCount >= 1,
    kmPerLitre: null,
    lPer100km: null,
  };

  if (intervalCount < 1 || totalFuelLitres <= 0 || totalDistanceKm <= 0) {
    return base;
  }

  const kmPerLitre = totalDistanceKm / totalFuelLitres;
  return {
    ...base,
    kmPerLitre: Number(kmPerLitre.toFixed(2)),
    lPer100km: Number(((totalFuelLitres / totalDistanceKm) * 100).toFixed(1)),
    measured: true,
  };
}

export { DEFAULT_WINDOW_DAYS };
