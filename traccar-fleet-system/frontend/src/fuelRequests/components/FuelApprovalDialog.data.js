import { useEffect, useMemo, useState } from 'react';

const resolveFuelPercent = ({ validationData, latestPosition, request }) => {
  const fromValidation = validationData?.request?.currentFuelLevel;
  const fromPosition = latestPosition?.attributes?.fuel ?? latestPosition?.attributes?.fuelLevel;
  const fromRequest = request?.currentFuelLevel;

  if (Number.isFinite(fromValidation)) return fromValidation;
  if (Number.isFinite(fromPosition)) return fromPosition;
  if (Number.isFinite(fromRequest)) return fromRequest;
  return 0;
};

const resolveTankCapacity = ({ validationData, device, request }) => {
  const fromValidation = validationData?.vehicleSpec?.tankCapacity;
  const fromRequest = request?.vehicleSpec?.tankCapacity;
  const fromDevice = device?.attributes?.tankCapacity;

  if (Number.isFinite(fromValidation)) return fromValidation;
  if (Number.isFinite(fromRequest)) return fromRequest;
  if (Number.isFinite(fromDevice)) return fromDevice;
  return null;
};

export const useFuelApprovalLiveData = ({ open, request, userId }) => {
  const [validationData, setValidationData] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (!open || !request?.id) return;

    let active = true;
    const fetchValidation = async () => {
      setValidationLoading(true);
      setValidationError(null);
      try {
        const response = await fetch(`/api/fuel-requests/${request.id}/validation`, {
          method: 'GET',
          headers: {
            ...(userId ? { 'x-user-id': userId.toString() } : {}),
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Unable to fetch live fuel data (HTTP ${response.status})`);
        }

        const payload = await response.json();
        if (active) setValidationData(payload);
      } catch (error) {
        if (active) setValidationError(error.message || 'Unable to fetch live fuel data');
      } finally {
        if (active) setValidationLoading(false);
      }
    };

    fetchValidation();
    return () => {
      active = false;
    };
  }, [open, request?.id, userId]);

  return { validationData, validationLoading, validationError, setValidationData, setValidationError };
};

export const useFuelApprovalDerivedData = ({ request, device, latestPosition, validationData, approvedAmount }) => {
  return useMemo(() => {
    if (!request) {
      return {
        hasWarnings: false,
        validationWarnings: [],
        approvedExceedsMax: false,
        suggestionDiffers: false,
        roundedMaxPossible: 1,
        safeApprovedAmount: 0,
      };
    }

    const validationWarnings = validationData?.validation?.warnings || request.validationWarnings || [];
    const hasWarnings = validationWarnings.length > 0;

    const currentFuelPercent = resolveFuelPercent({ validationData, latestPosition, request });
    const tankCapacity = resolveTankCapacity({ validationData, device, request });

    const currentFuelLiters = Number.isFinite(tankCapacity)
      ? (Math.max(0, currentFuelPercent) / 100) * tankCapacity
      : 0;

    const maxPossibleFromValidation = validationData?.validation?.maxPossible;
    const computedMaxPossible = Number.isFinite(tankCapacity)
      ? Math.max(0, tankCapacity - currentFuelLiters)
      : null;
    const maxPossible = Number.isFinite(maxPossibleFromValidation)
      ? Math.max(0, maxPossibleFromValidation)
      : computedMaxPossible;

    const roundedMaxPossible = Number.isFinite(maxPossible)
      ? Math.round(maxPossible)
      : Math.max(1, Math.round(request.managerSuggestion || request.requestedAmount || 1));

    const safeApprovedAmount = Math.max(0, approvedAmount || 0);
    const approvedExceedsMax = Number.isFinite(maxPossible) ? safeApprovedAmount > maxPossible : false;

    const approvedPercentage = Number.isFinite(tankCapacity)
      ? Math.min(100, ((currentFuelLiters + safeApprovedAmount) / tankCapacity) * 100)
      : Math.min(100, Math.max(0, currentFuelPercent));

    const suggestedAmount = Number.isFinite(validationData?.validation?.suggestedAmount)
      ? validationData.validation.suggestedAmount
      : request.managerSuggestion;

    const suggestionDiffers = Number.isFinite(suggestedAmount)
      && suggestedAmount > 0
      && suggestedAmount !== request.requestedAmount;

    return {
      validationWarnings,
      hasWarnings,
      currentFuelPercent,
      tankCapacity,
      currentFuelLiters,
      roundedMaxPossible,
      safeApprovedAmount,
      approvedExceedsMax,
      approvedPercentage,
      suggestedAmount,
      suggestionDiffers,
      deviceName: device?.name || request.device?.name || `Device ${request.deviceId}`,
      driverName: request.user?.name || request.driverName || `User ${request.userId}`,
    };
  }, [approvedAmount, device, latestPosition, request, validationData]);
};
