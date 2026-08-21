import { createSlice } from '@reduxjs/toolkit';

const organizationsSlice = createSlice({
  name: 'organizations',
  initialState: {
    currentContext: null, // { id, name, type: 'platform' | 'partner' | 'customer' } — always the identity's own home company (from GET /api/context)
    homeCompanyId: null, // identity fact (from GET /api/context)
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
    setHomeCompanyId: (state, action) => {
      state.homeCompanyId = action.payload;
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
  setHomeCompanyId,
  setPartners,
  setDirectCustomers,
  setMyCustomers,
  setOverview,
  setLoading,
  setError,
  clearError,
} = organizationsSlice.actions;

export default organizationsSlice.reducer;
