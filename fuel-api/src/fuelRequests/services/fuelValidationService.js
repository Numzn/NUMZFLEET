/**
 * Fuel validation service
 * Provides validation logic for fuel requests based on vehicle specifications
 */

/**
 * Validate tank capacity - hard block if exceeds capacity
 */
export const validateTankCapacity = (vehicleSpec, currentFuelLevel, requestedAmount) => {
  const tankCapacity = vehicleSpec.tankCapacity;
  const currentFuelLiters = (currentFuelLevel / 100) * tankCapacity;
  const maxPossible = tankCapacity - currentFuelLiters;
  const tolerance = 5; // 5L tolerance for safety margin

  // Hard validation - block if exceeds capacity + tolerance
  if (requestedAmount > maxPossible + tolerance) {
    return {
      valid: false,
      severity: 'critical',
      warnings: [{
        type: 'tank_capacity',
        message: `Request exceeds tank capacity. Tank can only hold ${Math.round(maxPossible)}L more`,
        severity: 'critical'
      }],
      suggestedAmount: Math.round(maxPossible),
      maxPossible: Math.round(maxPossible),
      details: {
        tankCapacity,
        currentFuelLiters: Math.round(currentFuelLiters),
        currentFuelLevel,
        requestedAmount,
        maxPossible: Math.round(maxPossible)
      }
    };
  }

  // Warning if close to capacity
  if (requestedAmount > maxPossible) {
    return {
      valid: true,
      severity: 'warning',
      warnings: [{
        type: 'near_capacity',
        message: `Request is at tank capacity limit. Tank can hold ${Math.round(maxPossible)}L more`,
        severity: 'warning'
      }],
      suggestedAmount: Math.round(maxPossible),
      maxPossible: Math.round(maxPossible),
      details: {
        tankCapacity,
        currentFuelLiters: Math.round(currentFuelLiters),
        currentFuelLevel,
        requestedAmount,
        maxPossible: Math.round(maxPossible)
      }
    };
  }

  return {
    valid: true,
    severity: 'none',
    warnings: [],
    suggestedAmount: requestedAmount,
    maxPossible: Math.round(maxPossible),
    details: {
      tankCapacity,
      currentFuelLiters: Math.round(currentFuelLiters),
      currentFuelLevel,
      requestedAmount,
      maxPossible: Math.round(maxPossible)
    }
  };
};

/**
 * Validate against trip requirements - warning if excessive
 */
export const validateTripRequirements = (vehicleSpec, requestedAmount, upcomingTrip = null) => {
  const warnings = [];
  
  if (!upcomingTrip) {
    return {
      valid: true,
      warnings,
      suggestedAmount: requestedAmount
    };
  }

  const tripDistance = upcomingTrip.distance || 0; // km
  const fuelEfficiency = vehicleSpec.fuelEfficiency; // km/L
  const fuelNeeded = tripDistance / fuelEfficiency;
  const safeAmount = fuelNeeded * 1.2; // 20% buffer
  const excessiveThreshold = safeAmount * 1.5; // 50% above safe amount

  if (requestedAmount > excessiveThreshold) {
    warnings.push({
      type: 'trip_excessive',
      message: `Request exceeds trip requirements by ${Math.round(((requestedAmount / safeAmount) - 1) * 100)}%. Trip needs ~${Math.round(safeAmount)}L`,
      severity: 'warning'
    });
  }

  return {
    valid: true,
    warnings,
    suggestedAmount: Math.ceil(safeAmount),
    details: {
      tripDistance,
      fuelNeeded: Math.round(fuelNeeded),
      safeAmount: Math.round(safeAmount),
      excessiveThreshold: Math.round(excessiveThreshold)
    }
  };
};

/**
 * Calculate optimal fuel amount based on multiple factors
 */
export const calculateOptimalAmount = (vehicleSpec, currentFuelLevel, upcomingTrip = null) => {
  const tankCapacity = vehicleSpec.tankCapacity;
  const currentFuelLiters = (currentFuelLevel / 100) * tankCapacity;
  const maxPossible = tankCapacity - currentFuelLiters;

  let suggestedAmount = maxPossible;

  // If there's an upcoming trip, consider trip requirements
  if (upcomingTrip) {
    const tripDistance = upcomingTrip.distance || 0;
    const fuelEfficiency = vehicleSpec.fuelEfficiency;
    const fuelNeeded = tripDistance / fuelEfficiency;
    const safeAmount = fuelNeeded * 1.2; // 20% buffer

    // Use the smaller of max possible or trip requirement
    suggestedAmount = Math.min(maxPossible, Math.ceil(safeAmount));
  }

  return Math.round(suggestedAmount);
};

/**
 * Generate comprehensive validation results
 */
export const validateFuelRequest = async (vehicleSpec, currentFuelLevel, requestedAmount, upcomingTrip = null) => {
  // Tank capacity validation (hard block)
  const tankValidation = validateTankCapacity(vehicleSpec, currentFuelLevel, requestedAmount);
  
  // If tank validation fails critically, return immediately
  if (!tankValidation.valid && tankValidation.severity === 'critical') {
    return tankValidation;
  }

  // Trip requirements validation (warnings only)
  const tripValidation = validateTripRequirements(vehicleSpec, requestedAmount, upcomingTrip);
  
  // Calculate optimal amount
  const optimalAmount = calculateOptimalAmount(vehicleSpec, currentFuelLevel, upcomingTrip);

  // Combine warnings
  const allWarnings = [
    ...tankValidation.warnings,
    ...tripValidation.warnings
  ];

  // Determine overall severity
  const severity = tankValidation.severity === 'warning' || allWarnings.length > 0 ? 'warning' : 'none';

  return {
    valid: true,
    severity,
    warnings: allWarnings,
    suggestedAmount: optimalAmount,
    maxPossible: tankValidation.maxPossible,
    details: {
      tank: tankValidation.details,
      trip: tripValidation.details
    }
  };
};

/**
 * Format validation warnings for display
 */
export const formatValidationWarnings = (validationResult) => {
  if (!validationResult.warnings || validationResult.warnings.length === 0) {
    return [];
  }

  return validationResult.warnings.map(warning => ({
    type: warning.type,
    message: warning.message,
    severity: warning.severity,
    icon: getWarningIcon(warning.type)
  }));
};

/**
 * Get appropriate icon for warning type
 */
const getWarningIcon = (warningType) => {
  switch (warningType) {
    case 'tank_capacity':
      return '🚨';
    case 'near_capacity':
      return '⚠️';
    case 'trip_excessive':
      return '📊';
    default:
      return '⚠️';
  }
};



