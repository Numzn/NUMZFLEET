import { createSlice } from '@reduxjs/toolkit';

/**
 * Mirror of ConnectivityService snapshot for components that prefer Redux
 * selectors. Source of truth remains the singleton service; this slice is
 * driven by ConnectivityProvider.
 */
const initialState = {
  isBrowserOnline: true,
  backendReachable: true,
  latency: 0,
  unstableConnection: false,
  reconnectAttempts: 0,
  lastSuccessfulPing: null,
  lastError: null,
};

const { reducer, actions } = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    update(state, action) {
      const next = action.payload || {};
      state.isBrowserOnline = !!next.isBrowserOnline;
      state.backendReachable = !!next.backendReachable;
      state.latency = Number.isFinite(next.latency) ? next.latency : 0;
      state.unstableConnection = !!next.unstableConnection;
      state.reconnectAttempts = Number.isFinite(next.reconnectAttempts) ? next.reconnectAttempts : 0;
      state.lastSuccessfulPing = next.lastSuccessfulPing || null;
      state.lastError = next.lastError || null;
    },
  },
});

export { actions as connectivityActions };
export { reducer as connectivityReducer };
