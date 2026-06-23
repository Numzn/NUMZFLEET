/** Open external maps navigation to lat/lng (Google Maps with Apple Maps fallback on iOS). */
export function openExternalNavigation(latitude, longitude) {
  if (latitude == null || longitude == null) return;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const isApple = typeof navigator !== 'undefined'
    && /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isApple) {
    window.open(`maps://?daddr=${lat},${lng}`, '_blank', 'noopener,noreferrer');
    return;
  }

  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    '_blank',
    'noopener,noreferrer',
  );
}
