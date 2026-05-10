export const withSafeListener = (eventName, listenerName, handler) => {
  return (payload) => {
    Promise.resolve(handler(payload)).catch((error) => {
      console.error('[events] listener failed', {
        eventName,
        listenerName,
        error: error?.message || String(error),
      });
    });
  };
};
