/**
 * The PATCH that completes a service record. Kept free of imports so its rules are unit-testable.
 *
 * The odometer typed into the completion dialog is prefilled from the system's own figure, so by itself it
 * is not a dashboard reading. It is sent as one (`odometerConfirmedPhysical`) only when the person ticks
 * the attestation, and only when there is an odometer value for the attestation to refer to.
 */
export function buildCompletionPatch({
  completedAt, odometerKm, odometerConfirmedPhysical, odometerReason,
} = {}) {
  const patch = { status: 'completed' };
  if (completedAt) patch.completedAt = completedAt;

  const hasOdometer = odometerKm !== '' && odometerKm != null;
  if (hasOdometer && odometerConfirmedPhysical === true) patch.odometerConfirmedPhysical = true;

  const reason = typeof odometerReason === 'string' ? odometerReason.trim() : '';
  if (hasOdometer && reason) patch.odometerReason = reason;

  return patch;
}

export default buildCompletionPatch;
