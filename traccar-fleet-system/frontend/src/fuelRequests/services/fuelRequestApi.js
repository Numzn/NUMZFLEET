/**
 * Fuel Request API Service
 * Centralized API calls for fuel request operations
 */

/**
 * Get authentication headers
 */
const getAuthHeaders = (userId) => {
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId.toString() } : {})
  };
};

/**
 * List all fuel requests
 */
export const listFuelRequests = async (userId) => {
  const response = await fetch('/api/fuel-requests', {
    method: 'GET',
    headers: getAuthHeaders(userId),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch fuel requests' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Get single fuel request by ID
 */
export const getFuelRequest = async (requestId, userId) => {
  const response = await fetch(`/api/fuel-requests/${requestId}`, {
    method: 'GET',
    headers: getAuthHeaders(userId),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch fuel request' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Create a new fuel request
 */
export const createFuelRequest = async (requestData, userId) => {
  const response = await fetch('/api/fuel-requests', {
    method: 'POST',
    headers: getAuthHeaders(userId),
    credentials: 'include',
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create fuel request' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Approve a fuel request
 */
export const approveFuelRequest = async (requestId, approvedAmount, notes, userId) => {
  const response = await fetch(`/api/fuel-requests/${requestId}/approve`, {
    method: 'PUT',
    headers: getAuthHeaders(userId),
    credentials: 'include',
    body: JSON.stringify({ 
      approvedAmount,
      notes: notes || 'Approved by manager' 
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to approve request' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Reject a fuel request
 */
export const rejectFuelRequest = async (requestId, notes, userId) => {
  const response = await fetch(`/api/fuel-requests/${requestId}/reject`, {
    method: 'PUT',
    headers: getAuthHeaders(userId),
    credentials: 'include',
    body: JSON.stringify({ notes: notes || 'Rejected by manager' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to reject request' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Cancel a fuel request
 */
export const cancelFuelRequest = async (requestId, userId) => {
  const response = await fetch(`/api/fuel-requests/${requestId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(userId),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to cancel request' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Fulfill a fuel request
 */
export const fulfillFuelRequest = async (requestId, userId) => {
  const response = await fetch(`/api/fuel-requests/${requestId}/fulfill`, {
    method: 'PUT',
    headers: getAuthHeaders(userId),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fulfill request' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Get validation details for a fuel request
 */
export const getValidationDetails = async (requestId, userId) => {
  const response = await fetch(`/api/fuel-requests/${requestId}/validation`, {
    method: 'GET',
    headers: getAuthHeaders(userId),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch validation details' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

