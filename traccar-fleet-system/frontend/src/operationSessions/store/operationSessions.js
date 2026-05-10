import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'operationSessions',
  initialState: {
    items: {},
    details: {},
    currentSessionId: null,
    lastUpdated: null,
  },
  reducers: {
    refresh(state, action) {
      state.items = {};
      action.payload.forEach((item) => {
        state.items[item.id] = item;
      });
      state.lastUpdated = Date.now();
    },
    upsertDetails(state, action) {
      const { sessionId, data } = action.payload;
      state.details[sessionId] = data;
      state.lastUpdated = Date.now();
    },
    setCurrentSession(state, action) {
      state.currentSessionId = action.payload;
      state.lastUpdated = Date.now();
    },
    appendRefuels(state, action) {
      const { sessionId, records } = action.payload;
      if (!state.details[sessionId]) {
        state.details[sessionId] = { id: sessionId, refuels: [] };
      }
      const existing = state.details[sessionId].refuels || [];
      state.details[sessionId].refuels = [...existing, ...records];
      state.lastUpdated = Date.now();
    },
  },
});

export { actions as operationSessionsActions };
export { reducer as operationSessionsReducer };
