import { useSelector } from 'react-redux';

const defaultState = {
  isBrowserOnline: true,
  backendReachable: true,
  latency: 0,
  unstableConnection: false,
  reconnectAttempts: 0,
  lastSuccessfulPing: null,
  lastError: null,
};

/**
 * Read connectivity status from Redux. Components that don't want to use
 * selectors directly should use this hook.
 */
const useConnectivity = () => useSelector((state) => state.connectivity || defaultState);

export default useConnectivity;
