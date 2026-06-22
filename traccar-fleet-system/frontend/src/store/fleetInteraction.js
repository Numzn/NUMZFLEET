import { createSlice } from '@reduxjs/toolkit';
import {
  SHEET_LEVEL,
  SHEET_MAX_LEVEL_SPRINT1,
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
     * 0 = closed, 1 = overview, 2 = list, 3 = command (2–3 reserved after Sprint 1).
     */
    sheetLevel: SHEET_LEVEL.LIST,
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
    expandSheet(state) {
      state.sheetLevel = clampSheetLevel(state.sheetLevel + 1);
    },
    collapseSheet(state) {
      state.sheetLevel = clampSheetLevel(state.sheetLevel - 1);
    },
  },
});

export { SHEET_MAX_LEVEL_SPRINT1, SHEET_LEVEL };

export { actions as fleetInteractionActions };
export { reducer as fleetInteractionReducer };
