import VehicleDriverSection from '../../VehicleDriverSection.jsx';

export default function DriverSetupModule({
  vehicle,
  deviceId,
  telemetry,
  onRefreshVehicle,
}) {
  return (
    <VehicleDriverSection
      embedded
      vehicle={vehicle}
      deviceId={deviceId}
      telemetry={telemetry}
      onRefreshVehicle={onRefreshVehicle}
    />
  );
}
