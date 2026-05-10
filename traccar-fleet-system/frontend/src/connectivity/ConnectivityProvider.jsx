import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import ConnectivityService from './ConnectivityService.js';
import { connectivityActions } from '../store/connectivity.js';

/**
 * ConnectivityProvider
 *
 * Starts the singleton ConnectivityService once, mirrors its snapshots into
 * Redux, and stops it on unmount. It does not render any UI itself.
 */
const ConnectivityProvider = ({ children }) => {
  const dispatch = useDispatch();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return undefined;
    startedRef.current = true;

    ConnectivityService.start();
    const unsubscribe = ConnectivityService.subscribe((snapshot) => {
      dispatch(connectivityActions.update(snapshot));
    });

    return () => {
      try { unsubscribe(); } catch { /* noop */ }
      ConnectivityService.stop();
      startedRef.current = false;
    };
  }, [dispatch]);

  return useMemo(() => children, [children]);
};

export default ConnectivityProvider;
