import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { map } from './core/MapView';

/** Must match PremiumTopBar inner toolbar (see getToolbarHeight). */
const TOP_TOOLBAR_DESKTOP = 56;
const TOP_TOOLBAR_MOBILE = 50;
/** Reserve space for BottomMenu + labels; aligned with AppLayout mobile content offset. */
const BOTTOM_NAV_RESERVE = 64;
/** Space between fixed chrome and map control stacks (px). */
const CHROME_GAP = 8;

/**
 * Keeps the map canvas full-bleed under fixed top/bottom chrome while insetting
 * MapLibre's logical viewport (padding + control offsets) so controls and framing stay clear.
 */
const MapChromePadding = ({ sidebarInset = 0, isDesktop }) => {
  const theme = useTheme();
  const topSafeRef = useRef(null);
  const bottomSafeRef = useRef(null);
  const [safeTop, setSafeTop] = useState(0);
  const [safeBottom, setSafeBottom] = useState(0);

  const readSafe = () => {
    setSafeTop(topSafeRef.current?.offsetHeight ?? 0);
    setSafeBottom(bottomSafeRef.current?.offsetHeight ?? 0);
  };

  useLayoutEffect(() => {
    readSafe();
    window.addEventListener('resize', readSafe);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', readSafe);
    return () => {
      window.removeEventListener('resize', readSafe);
      vv?.removeEventListener('resize', readSafe);
    };
  }, []);

  useEffect(() => {
    const container = map.getContainer();
    const toolbar = isDesktop ? TOP_TOOLBAR_DESKTOP : TOP_TOOLBAR_MOBILE;
    const topPad = safeTop + toolbar;
    const bottomPad = isDesktop ? 0 : safeBottom + BOTTOM_NAV_RESERVE;
    const left = theme.direction === 'rtl' ? 0 : sidebarInset;
    const right = theme.direction === 'rtl' ? sidebarInset : 0;

    // MapView: nav + style switcher use top-right (LTR) / top-left (RTL) — not top-left on LTR.
    const topCorner = theme.direction === 'rtl'
      ? container.querySelector('.maplibregl-ctrl-top-left')
      : container.querySelector('.maplibregl-ctrl-top-right');

    if (topCorner) {
      topCorner.style.top = `${topPad + CHROME_GAP}px`;
      if (sidebarInset > 0) {
        topCorner.style.insetInlineStart = `${sidebarInset}px`;
      }
    }

    // Push bottom stacks above the mobile bottom nav (scale + attribution live in opposite corners).
    const bottomCorners = !isDesktop
      ? [
          container.querySelector('.maplibregl-ctrl-bottom-left'),
          container.querySelector('.maplibregl-ctrl-bottom-right'),
        ].filter(Boolean)
      : [];

    bottomCorners.forEach((el) => {
      el.style.bottom = `${bottomPad + CHROME_GAP}px`;
    });

    map.setPadding({ top: topPad, right, bottom: bottomPad, left });

    return () => {
      if (topCorner) {
        topCorner.style.top = '';
        if (sidebarInset > 0) {
          topCorner.style.insetInlineStart = '';
        }
      }
      bottomCorners.forEach((el) => {
        el.style.bottom = '';
      });
      map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    };
  }, [isDesktop, sidebarInset, theme.direction, safeTop, safeBottom]);

  return (
    <>
      <span
        ref={topSafeRef}
        aria-hidden
        style={{
          position: 'fixed',
          width: 0,
          height: 'env(safe-area-inset-top, 0px)',
          margin: 0,
          padding: 0,
          border: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          top: 0,
          left: 0,
        }}
      />
      <span
        ref={bottomSafeRef}
        aria-hidden
        style={{
          position: 'fixed',
          width: 0,
          height: 'env(safe-area-inset-bottom, 0px)',
          margin: 0,
          padding: 0,
          border: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          bottom: 0,
          left: 0,
        }}
      />
    </>
  );
};

export default MapChromePadding;
