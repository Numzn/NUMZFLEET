export function validateMileageAgainstPrevious(mileage, previousMileage) {
  if (mileage == null || previousMileage == null) return { valid: true };
  const m = Number(mileage);
  const prev = Number(previousMileage);
  if (!Number.isFinite(m) || !Number.isFinite(prev)) return { valid: true };
  if (m < prev) {
    return {
      valid: false,
      message: `Mileage (${m.toLocaleString()}) is lower than previous (${prev.toLocaleString()}). Provide an override reason.`,
    };
  }
  return { valid: true };
}
