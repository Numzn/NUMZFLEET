import { findFuelRequestScoped } from '../scopeFuelRequest.js';
import { getTraccarPosition } from '../../config/traccar.js';
import { getVehicleSpec } from '../../services/vehicleSpecService.js';
import { validateFuelRequest } from '../services/fuelValidationService.js';

/**
 * Get validation details for a fuel request
 */
export const getValidationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await findFuelRequestScoped(req, id);

    if (!request) {
      return res.status(404).json({ error: 'Fuel request not found' });
    }

    // Get vehicle specs for detailed validation info
    const vehicleSpec = await getVehicleSpec(request.deviceId);
    const position = await getTraccarPosition(request.deviceId);
    const currentFuelLevel = position?.attributes?.fuel || position?.attributes?.fuelLevel || 0;

    // Re-run validation to get current details
    const validation = await validateFuelRequest(
      vehicleSpec,
      currentFuelLevel,
      request.requestedAmount,
      null
    );

    res.json({
      request: {
        id: request.id,
        requestedAmount: request.requestedAmount,
        currentFuelLevel,
        validationWarnings: request.validationWarnings,
        managerSuggestion: request.managerSuggestion
      },
      vehicleSpec: {
        tankCapacity: vehicleSpec.tankCapacity,
        fuelEfficiency: vehicleSpec.fuelEfficiency,
        fuelType: vehicleSpec.fuelType
      },
      validation: {
        valid: validation.valid,
        severity: validation.severity,
        warnings: validation.warnings,
        suggestedAmount: validation.suggestedAmount,
        maxPossible: validation.maxPossible,
        details: validation.details
      }
    });
  } catch (error) {
    console.error('Get validation details error:', error);
    res.status(500).json({ error: 'Failed to fetch validation details' });
  }
};

