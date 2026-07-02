import { registerVehicleAssignedListeners } from './listeners/vehicleAssignedListeners.js';
import { registerFuelRequestListeners } from './listeners/fuelRequestListeners.js';
import { registerErbPriceListeners } from './listeners/erbPriceListeners.js';
import { registerOperationRefuelListeners } from './listeners/operationRefuelListeners.js';

let listenersRegistered = false;

export const registerEventListeners = ({ io }) => {
  if (listenersRegistered) {
    return;
  }

  registerVehicleAssignedListeners(io);
  registerFuelRequestListeners(io);
  registerErbPriceListeners(io);
  registerOperationRefuelListeners(io);
  listenersRegistered = true;
};
