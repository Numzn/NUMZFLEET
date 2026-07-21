import { createSlice } from '@reduxjs/toolkit';
import {
  SHEET_LEVEL,
  clampSheetLevel,
} from '../main/fleet/fleetSheetConstants.js';

/**
 * Fleet operations UI state (sidebar, drawer, hover sync).
 * Device selection remains canonical on `devices.selectedId`; dispatch `devicesActions.selectId` from fleet UI.
 */
const { reducer, actions } = createSlice({
  name: 'fleetInteraction',
  initialState: {
    hoveredDeviceId: null,
    sidebarCollapsed: false,
    mobileDrawerOpen: false,
    searchQuery: '',
    mapMode: 'live',
    /** FleetTabs filter key */
    fleetTab: 'all',
    /** After marker click: scroll list to this device once */
    listScrollTargetDeviceId: null,
    /** Operational workspace shell (future: alerts, trips, …) */
    fleetWorkspaceMode: 'live',
    /**
     * Mobile Fleet Command bottom sheet depth (snap derived from level).
     * 0 = closed, 1 = overview (compact list), 2 = list (search + virtualized list).
     */
    sheetLevel: SHEET_LEVEL.CLOSED,
  },
  reducers: {
    setHoveredDeviceId(state, action) {
      state.hoveredDeviceId = action.payload;
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = action.payload;
    },
    setMobileDrawerOpen(state, action) {
      state.mobileDrawerOpen = action.payload;
    },
    toggleMobileDrawer(state) {
      state.mobileDrawerOpen = !state.mobileDrawerOpen;
    },
    setFleetSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    setMapMode(state, action) {
      state.mapMode = action.payload;
    },
    setFleetTab(state, action) {
      state.fleetTab = action.payload;
    },
    setFleetWorkspaceMode(state, action) {
      state.fleetWorkspaceMode = action.payload;
    },
    requestListScrollToDevice(state, action) {
      state.listScrollTargetDeviceId = action.payload;
    },
    clearListScrollTarget(state) {
      state.listScrollTargetDeviceId = null;
    },
    setSheetLevel(state, action) {
      state.sheetLevel = clampSheetLevel(action.payload);
    },
  },
});

export { SHEET_LEVEL };

export { actions as fleetInteractionActions };
export { reducer as fleetInteractionReducer };
