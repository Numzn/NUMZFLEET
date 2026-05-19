import { useMemo } from 'react';
import { computeVehicleSetupReadiness } from './vehicleSetupReadiness.js';

export default function useVehicleSetupReadiness({
  vehicle,
  form,
  linkedDrivers,
  linkedGeofences,
  linkedGeofencesLoading,
  linkedGeofencesError,
  capabilities,
  disableDrivers,
}) {
  return useMemo(
    () =>
      computeVehicleSetupReadiness({
        vehicle,
        formDraft: form,
        linkedDrivers,
        linkedGeofences,
        linkedGeofencesLoading,
        linkedGeofencesError,
        capabilities,
        disableDrivers,
      }),
    [
      vehicle,
      form,
      linkedDrivers,
      linkedGeofences,
      linkedGeofencesLoading,
      linkedGeofencesError,
      capabilities,
      disableDrivers,
    ],
  );
}
