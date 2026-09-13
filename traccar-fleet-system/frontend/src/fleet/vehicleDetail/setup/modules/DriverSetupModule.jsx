import VehicleDriverSection from '../../VehicleDriverSection.jsx';

export default function DriverSetupModule({
  vehicle,
  vehicleId,
  deviceId,
  telemetry,
  linkedDrivers,
  reloadLinked,
  linkedDriversLoading,
  onRefreshVehicle,
  currentUser,
}) {
  return (
    <VehicleDriverSection
      embedded
      vehicle={vehicle}
      vehicleId={vehicleId}
      deviceId={deviceId}
      telemetry={telemetry}
      linkedDrivers={linkedDrivers}
      reloadLinked={reloadLinked}
      loading={linkedDriversLoading}
      onRefreshVehicle={onRefreshVehicle}
      currentUser={currentUser}
    />
  );
}
