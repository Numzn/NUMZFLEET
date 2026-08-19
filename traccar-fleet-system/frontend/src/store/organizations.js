import { createSlice } from '@reduxjs/toolkit';

const organizationsSlice = createSlice({
  name: 'organizations',
  initialState: {
    currentContext: null, // { id, name, type: 'platform' | 'partner' | 'customer' }
    accessibleContexts: [], // every workspace this identity may enter (from GET /api/context)
    partners: [],
    directCustomers: [],
    myCustomers: [], // Partner's own customers (from /api/my-customers)
    overview: null, // { partnerCount, directCustomerCount, partnerCustomerCount }
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentContext: (state, action) => {
      state.currentContext = action.payload;
    },
    setAccessibleContexts: (state, action) => {
      state.accessibleContexts = action.payload;
    },
    setPartners: (state, action) => {
      state.partners = action.payload;
    },
    setDirectCustomers: (state, action) => {
      state.directCustomers = action.payload;
    },
    setMyCustomers: (state, action) => {
      state.myCustomers = action.payload;
    },
    setOverview: (state, action) => {
      state.overview = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCurrentContext,
  setAccessibleContexts,
  setPartners,
  setDirectCustomers,
  setMyCustomers,
  setOverview,
  setLoading,
  setError,
  clearError,
} = organizationsSlice.actions;

export default organizationsSlice.reducer;
