import { createSlice } from '@reduxjs/toolkit';

const organizationsSlice = createSlice({
  name: 'organizations',
  initialState: {
    currentContext: null, // { id, name, type: 'platform' | 'partner' | 'customer' }
    partners: [],
    directCustomers: [],
    myCustomers: [], // Partner's own customers (from /api/my-customers)
    partnerCustomers: {}, // { partnerId: [customers] }
    overview: null, // { partnerCount, directCustomerCount, partnerCustomerCount }
    selectedPartnerId: null, // For partner detail view
    loading: false,
    error: null,
  },
  reducers: {
    setCurrentContext: (state, action) => {
      state.currentContext = action.payload;
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
    setPartnerCustomers: (state, action) => {
      const { partnerId, customers } = action.payload;
      state.partnerCustomers[partnerId] = customers;
    },
    setOverview: (state, action) => {
      state.overview = action.payload;
    },
    setSelectedPartnerId: (state, action) => {
      state.selectedPartnerId = action.payload;
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
    addPartner: (state, action) => {
      state.partners.push(action.payload);
    },
    addDirectCustomer: (state, action) => {
      state.directCustomers.push(action.payload);
    },
    addMyCustomer: (state, action) => {
      state.myCustomers.push(action.payload);
    },
    addPartnerCustomer: (state, action) => {
      const { partnerId, customer } = action.payload;
      if (!state.partnerCustomers[partnerId]) {
        state.partnerCustomers[partnerId] = [];
      }
      state.partnerCustomers[partnerId].push(customer);
    },
  },
});

export const {
  setCurrentContext,
  setPartners,
  setDirectCustomers,
  setMyCustomers,
  setPartnerCustomers,
  setOverview,
  setSelectedPartnerId,
  setLoading,
  setError,
  clearError,
  addPartner,
  addDirectCustomer,
  addMyCustomer,
  addPartnerCustomer,
} = organizationsSlice.actions;

export default organizationsSlice.reducer;
