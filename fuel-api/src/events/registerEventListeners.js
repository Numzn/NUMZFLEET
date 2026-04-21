import { registerVehicleAssignedListeners } from './listeners/vehicleAssignedListeners.js';

let listenersRegistered = false;

export const registerEventListeners = ({ io }) => {
  if (listenersRegistered) {
    return;
  }

  registerVehicleAssignedListeners(io);
  listenersRegistered = true;
};
