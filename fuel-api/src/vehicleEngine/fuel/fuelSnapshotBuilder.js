import { estimateFuelLitres } from '../../intelligence/EstimationEngine.js';
import { getLatestErbPrice, resolveFuelTypeKey } from '../../services/fuelPriceService.js';

/**
 * Resolve display efficiency: learned → measured → spec.
 * @param {{ hubFuel: object, learning?: object|null, specEfficiency?: number|null }}
 */
export function resolveEfficiencySource({ hubFuel, learning = null, specEfficiency = null }) {
  const learned = learning?.currentEfficiency != null ? Number(learning.currentEfficiency) : null;
  const learnedConfidence = learning?.confidence != null ? Number(learning.confidence) : 0;
  const learnedObs = learning?.totalObservations != null ? Number(learning.totalObservations) : 0;

  if (learned != null && learned > 0 && learnedConfidence >= 60 && learnedObs >= 3) {
    return {
      efficiencyKmL: learned,
      efficiencySource: 'learned',
      confidence: learnedConfidence,
    };
  }

  if (hubFuel?.measured && hubFuel?.kmPerLitre != null && hubFuel.kmPerLitre > 0) {
    return {
      efficiencyKmL: Number(hubFuel.kmPerLitre),
      efficiencySource: 'measured',
      confidence: hubFuel.confidenceScore ?? null,
    };
  }

  const spec = specEfficiency != null ? Number(specEfficiency) : null;
  if (spec != null && spec > 0) {
    return {
      efficiencyKmL: spec,
      efficiencySource: 'spec',
      confidence: null,
    };
  }

  return {
    efficiencyKmL: null,
    efficiencySource: 'none',
    confidence: null,
  };
}

/**
 * Build authoritative engine.fuel snapshot for Vehicle Engine read model.
 */
export async function buildFuelSnapshot({
  hubFuel = {},
  registry = {},
  learning = null,
  fleetDeltaPct = null,
  fleetEfficiencyAvg = null,
  fuelState = null,
}) {
  const spec = registry?.vehicleSpec ?? {};
  const capacityL = hubFuel.tankCapacity ?? spec.tankCapacity ?? null;
  const tankLevelPct = hubFuel.tankLevelPct != null ? Number(hubFuel.tankLevelPct) : null;
  const tankLevelSource = tankLevelPct != null ? 'telemetry' : 'unavailable';

  const { efficiencyKmL, efficiencySource, confidence: sourceConfidence } = resolveEfficiencySource({
    hubFuel,
    learning,
    specEfficiency: hubFuel.specEfficiency ?? spec.fuelEfficiency ?? null,
  });

  const lPer100km = efficiencyKmL != null && efficiencyKmL > 0
    ? Math.round((100 / efficiencyKmL) * 10) / 10
    : null;

  const litresRemaining = capacityL != null && tankLevelPct != null
    ? Math.round((tankLevelPct / 100) * Number(capacityL) * 10) / 10
    : null;

  const estimatedRangeKm = litresRemaining != null && efficiencyKmL != null && efficiencyKmL > 0
    ? Math.round(litresRemaining * efficiencyKmL)
    : null;

  let estimatedFillCostZmw = null;
  if (capacityL != null && tankLevelPct != null) {
    try {
      const fuelType = resolveFuelTypeKey(spec.fuelType);
      const priceInfo = await getLatestErbPrice(fuelType);
      const litresToFill = estimateFuelLitres({
        tankCapacity: Number(capacityL),
        tankLevelFraction: tankLevelPct,
      });
      if (priceInfo?.pricePerLitre != null && litresToFill > 0) {
        estimatedFillCostZmw = Math.round(litresToFill * priceInfo.pricePerLitre * 100) / 100;
      }
    } catch {
      /* optional ERB */
    }
  }

  let risk = null;
  if (tankLevelPct != null && tankLevelPct <= 15) risk = 'high';
  else if (tankLevelPct != null && tankLevelPct <= 25) risk = 'medium';
  else if (hubFuel.measured || tankLevelPct != null) risk = 'low';

  const perf = hubFuel.fuelPerformance ?? {};
  const confidence = sourceConfidence ?? hubFuel.confidenceScore ?? null;

  return {
    efficiencyKmL,
    lPer100km,
    efficiencySource,
    confidence,
    trend: hubFuel.trend ?? learning?.trend ?? null,
    fleetDeltaPct,
    fleetEfficiencyAvg,
    risk,
    measured: Boolean(hubFuel.measured && efficiencySource !== 'spec'),
    tankLevelPct,
    tankLevelSource,
    capacityL: capacityL != null ? Number(capacityL) : null,
    litresRemaining,
    estimatedRangeKm,
    estimatedFillCostZmw,
    sampleCount: hubFuel.sampleCount ?? 0,
    intervalCount: perf.intervalCount ?? hubFuel.intervalCount ?? 0,
    windowDays: perf.windowDays ?? hubFuel.windowDays ?? null,
    measuredStats: {
      totalDistanceKm: perf.totalDistanceKm ?? null,
      totalFuelLitres: perf.totalFuelLitres ?? null,
      kmPerLitre: perf.kmPerLitre ?? (hubFuel.measured ? hubFuel.kmPerLitre : null),
      lPer100km: perf.lPer100km ?? lPer100km,
      learnableIntervalCount: perf.learnableIntervalCount ?? null,
      storedIntervalCount: perf.storedIntervalCount ?? null,
      rejectedIntervalCount: perf.rejectedIntervalCount ?? null,
    },
    learned: learning
      ? {
        currentEfficiency: learning.currentEfficiency != null ? Number(learning.currentEfficiency) : null,
        confidence: learning.confidence != null ? Number(learning.confidence) : null,
        trend: learning.trend ?? null,
        totalObservations: learning.totalObservations ?? 0,
        modelMaturity: learning.modelMaturity ?? null,
        maturitySignals: learning.maturitySignals ?? null,
        operatingEnvelope: learning.operatingEnvelope ?? null,
      }
      : null,
    // Shadow-mode Digital Fuel Twin projection (fuelStateService). Modelled balance
    // lives beside — never replaces — telemetry litresRemaining/tankLevelPct above.
    fuelState: fuelState ?? null,
  };
}
