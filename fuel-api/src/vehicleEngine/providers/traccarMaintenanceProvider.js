/**
 * Maintenance facts from Traccar schedules + device position.
 * Swap this module when supporting another GPS platform; hub shape stays the same.
 */
export { loadVehicleMaintenanceDueState as fetchMaintenanceFacts } from '../../maintenance/maintenanceTraccarAdapter.js';
