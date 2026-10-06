import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { errorsReducer as errors } from './errors';
import { connectivityReducer as connectivity } from './connectivity';
import { sessionReducer as session } from './session';
import { devicesReducer as devices } from './devices';
import { eventsReducer as events } from './events';
import { geofencesReducer as geofences } from './geofences';
import { driversReducer as drivers } from './drivers';
import { calendarsReducer as calendars } from './calendars';
import { fuelRequestsReducer as fuelRequests } from '../fuelRequests/store/fuelRequests';
import { operationSessionsReducer as operationSessions } from '../operationSessions/store/operationSessions';
import { notificationsReducer as notifications } from './notifications/notificationsSlice.js';
import { fleetInteractionReducer as fleetInteraction } from './fleetInteraction.js';
import organizationsReducer from './organizations.js';
import throttleMiddleware from './throttleMiddleware';

const reducer = combineReducers({
  errors,
  connectivity,
  session,
  devices,
  events,
  geofences,
  drivers,
  calendars,
  fuelRequests,
  operationSessions,
  notifications,
  fleetInteraction,
  organizations: organizationsReducer,
});

export { errorsActions } from './errors';
export { connectivityActions } from './connectivity';
export { sessionActions } from './session';
export { devicesActions } from './devices';
export { eventsActions } from './events';
export { geofencesActions } from './geofences';
export { driversActions } from './drivers';
export { calendarsActions } from './calendars';
export { fuelRequestsActions } from '../fuelRequests/store/fuelRequests';
export { operationSessionsActions } from '../operationSessions/store/operationSessions';
export { fleetInteractionActions } from './fleetInteraction.js';
export { notificationsActions } from './notifications/notificationsSlice.js';

export default configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(throttleMiddleware),
});
