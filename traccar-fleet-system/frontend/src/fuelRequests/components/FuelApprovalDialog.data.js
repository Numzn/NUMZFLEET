import { useState, useEffect, useMemo } from 'react';
import { lookupVehicleDisplay } from '../../fleet/display/resolveVehicleDisplay.js';

/**
 * Fetch live validation data from the fuel-api when the dialog opens.
 */
export const useFuelApprovalLiveData = ({ open, request, userId }) => {
  const [validationData, setValidationData] = useState(null);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (!open || !request?.id) return;
    let cancelled = false;

    const fetchValidation = async () => {
      try {
        const url = `/api/fuel-requests/${request.id}/validation`;
        const response = await fetch(url, {
          headers: fuelApiAuthHeaders({ id: userId }),
          credentials: 'include',
        });
        if (!response.ok) throw new Error(`Validation request failed (${response.status})`);
        const data = await response.json();
        if (!cancelled) setValidationData(data);
      } catch (err) {
        console.warn('Fuel validation fetch failed:', err.message);
        if (!cancelled) setValidationError(err.message);
      }
    };

    fetchValidation();
    return () => { cancelled = true; };
  }, [open, request?.id, userId]);

  return { validationData, validationError, setValidationData, setValidationError };
};

/**
 * Derive display values from the combination of request, device, position, and live validation data.
 */
export const useFuelApprovalDerivedData = ({ request, device, latestPosition, validationData, approvedAmount, vehicleDisplayRegistry }) => {
  return useMemo(() => {
    if (!request) {
      return {
        deviceName: '', driverName: '', tankCapacity: null, currentFuelPercent: 0,
        roundedMaxPossible: 0, approvedPercentage: 0, suggestedAmount: 0,
        suggestionDiffers: false, hasWarnings: false, validationWarnings: [],
        safeApprovedAmount: 0, approvedExceedsMax: false,
      };
    }

    // Device / driver names
    const display = lookupVehicleDisplay(vehicleDisplayRegistry, request.deviceId, device);
    const deviceName = display.secondary
      ? `${display.primary} (${display.secondary})`
      : display.primary;
    const driverName = request.driverName || request.driver || 'Unknown Driver';

    // Tank capacity: validation -> request snapshot -> device attribute -> null
    const tankCapacity =
      validationData?.vehicleSpec?.tankCapacity
      ?? request?.vehicleSpec?.tankCapacity
      ?? device?.attributes?.tankCapacity
      ?? null;

    // Current fuel %: validation -> position attribute -> request snapshot -> 0
    const currentFuelPercent =
      validationData?.request?.currentFuelLevel
      ?? latestPosition?.attributes?.fuel
      ?? latestPosition?.attributes?.fuelLevel
      ?? request?.currentFuelLevel
      ?? 0;

    // Max possible litres that can be added
    const rawMaxPossible = Number.isFinite(tankCapacity)
      ? Math.max(0, tankCapacity * (1 - currentFuelPercent / 100))
      : request?.requestedAmount * 2 || 200;
    const roundedMaxPossible = Math.round(rawMaxPossible);

    // Clamp approved amount
    const safeApprovedAmount = Math.max(0, Math.min(Math.round(approvedAmount), roundedMaxPossible));
    const approvedExceedsMax = Math.round(approvedAmount) > roundedMaxPossible;

    // Approved percentage after fill
    const approvedPercentage = Number.isFinite(tankCapacity) && tankCapacity > 0
      ? currentFuelPercent + (safeApprovedAmount / tankCapacity) * 100
      : 0;

    // Suggested amount from validation or manager
    const suggestedAmount =
      validationData?.validation?.suggestedAmount ?? request?.managerSuggestion ?? request?.requestedAmount ?? 0;
    const suggestionDiffers = suggestedAmount !== request?.requestedAmount;

    // Warnings
    const validationWarnings = validationData?.validation?.warnings || [];
    const hasWarnings = validationWarnings.length > 0;

    return {
      deviceName,
      driverName,
      tankCapacity,
      currentFuelPercent,
      roundedMaxPossible,
      approvedPercentage,
      suggestedAmount,
      suggestionDiffers,
      hasWarnings,
      validationWarnings,
      safeApprovedAmount,
      approvedExceedsMax,
    };
  }, [request, device, latestPosition, validationData, approvedAmount, vehicleDisplayRegistry]);
};
