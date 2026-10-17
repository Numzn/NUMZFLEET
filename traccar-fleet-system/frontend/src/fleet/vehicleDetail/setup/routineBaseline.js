/**
 * The Routine Service interval baseline on the Vehicle Setup page.
 *
 * Where the current interval started is the Traccar schedule's `start`, and ONLY completing a service moves it
 * (the backend rebases it to the completion odometer). The copy cached in `fleetConfig.routineService` is written
 * once at setup and goes stale at the first completion — so the page must hydrate from the schedule
 * (`vehicle.routineService`), and must not re-send the baseline on every unrelated save: re-sending a stale
 * figure silently rewinds the service interval (a vehicle serviced at 10,500 km suddenly "due" from 5,000 km).
 */

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {object|null|undefined} vehicle - a fuel-api merged vehicle (`routineService` summary + `fleetConfig`)
 * @returns {{ scheduleExists: boolean, intervalKm: number|null, startingOdometerKm: number|null, source: 'schedule'|'cached'|'none' }}
 */
export function routineBaselineFromVehicle(vehicle) {
  const schedule = vehicle?.routineService ?? null;
  if (schedule) {
    return {
      scheduleExists: true,
      intervalKm: num(schedule.intervalKm) ?? num(vehicle?.fleetConfig?.routineService?.intervalKm),
      // Never the cached start: it is stale after the first completed service.
      startingOdometerKm: num(schedule.startingOdometerKm),
      source: 'schedule',
    };
  }
  const cached = vehicle?.fleetConfig?.routineService ?? null;
  if (cached) {
    return {
      scheduleExists: false,
      intervalKm: num(cached.intervalKm),
      startingOdometerKm: num(cached.startingOdometerKm),
      source: 'cached',
    };
  }
  return { scheduleExists: false, intervalKm: null, startingOdometerKm: null, source: 'none' };
}

/**
 * Whether saving the setup page should (re)write the Routine Service schedule: when there is none yet, or when
 * the person actually changed the interval or the starting odometer. Saving anything else must leave it alone.
 * @param {{ form: { routineServiceIntervalKm: string, routineServiceStartingOdometerKm: string }, baseline: ReturnType<typeof routineBaselineFromVehicle> }} args
 */
export function shouldSaveRoutineService({ form, baseline }) {
  if (!baseline.scheduleExists) return true;
  const interval = num(form.routineServiceIntervalKm);
  const start = num(form.routineServiceStartingOdometerKm);
  return interval !== baseline.intervalKm || start !== baseline.startingOdometerKm;
}
