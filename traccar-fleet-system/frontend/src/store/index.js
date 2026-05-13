import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { errorsReducer as errors } from './errors';
import { connectivityReducer as connectivity } from './connectivity';
import { sessionReducer as session } from './session';
import { devicesReducer as devices } from './devices';
import { eventsReducer as events } from './events';
import { geofencesReducer as geofences } from './geofences';
import { groupsReducer as groups } from './groups';
import { driversReducer as drivers } from './drivers';
import { maintenancesReducer as maintenances } from './maintenances';
import { calendarsReducer as calendars } from './calendars';
import { fuelRequestsReducer as fuelRequests } from '../fuelRequests/store/fuelRequests';
import { operationSessionsReducer as operationSessions } from '../operationSessions/store/operationSessions';
import { notificationsReducer as notifications } from './notifications/notificationsSlice.js';
import throttleMiddleware from './throttleMiddleware';

const reducer = combineReducers({
  errors,
  connectivity,
  session,
  devices,
  events,
  geofences,
  groups,
  drivers,
  maintenances,
  calendars,
  fuelRequests,
  operationSessions,
  notifications,
});

export { errorsActions } from './errors';
export { connectivityActions } from './connectivity';
export { sessionActions } from './session';
export { devicesActions } from './devices';
export { eventsActions } from './events';
export { geofencesActions } from './geofences';
export { groupsActions } from './groups';
export { driversActions } from './drivers';
export { maintenancesActions } from './maintenances';
export { calendarsActions } from './calendars';
export { fuelRequestsActions } from '../fuelRequests/store/fuelRequests';
export { operationSessionsActions } from '../operationSessions/store/operationSessions';
export { notificationsActions } from './notifications/notificationsSlice.js';

export default configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(throttleMiddleware),
});
