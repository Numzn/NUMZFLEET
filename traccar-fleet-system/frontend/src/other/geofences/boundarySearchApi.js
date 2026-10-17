import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

/** @returns {Promise<{results: object[], pointOnly: number, invalid: number, cached: boolean}>} */
export async function searchBoundaries(user, query) {
  const res = await fetchOrThrow(
    `/api/geofence-boundaries/search?q=${encodeURIComponent(query)}`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}
