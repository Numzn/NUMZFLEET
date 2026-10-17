import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { createMileageSignalSource, emitMileageSignal } from './mileageSignal.js';

/**
 * Mount ONCE (with the vehicle display registry). Watches the live data already in Redux — tracker positions
 * from the socket, the socket's connected flag — plus tab visibility and browser connectivity, and publishes
 * the "mileage may have changed" signals every screen listens to (see mileageSignal.js).
 *
 * It subscribes to the store directly instead of selecting `session.positions`, so a position update does not
 * re-render anything: only an actual signal reaches the screens that asked for it.
 */
export default function useMileageSignalSource() {
  const store = useStore();

  useEffect(() => {
    const source = createMileageSignalSource({ emit: emitMileageSignal });
    let lastPositions;
    let lastSocket;

    const sync = () => {
      const { positions, socket } = store.getState().session;
      if (positions !== lastPositions) {
        lastPositions = positions;
        source.positions(positions);
      }
      if (socket !== lastSocket) {
        lastSocket = socket;
        source.socket(socket);
      }
    };
    sync();
    const unsubscribe = store.subscribe(sync);

    const onVisibility = () => source.visible(document.visibilityState === 'visible');
    const onOnline = () => source.online();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      source.dispose();
    };
  }, [store]);
}
