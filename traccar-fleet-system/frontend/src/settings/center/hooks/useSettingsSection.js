import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveActiveSettingsSection } from '../settingsSectionRegistry.js';

/**
 * URL-derived active section + navigation, mirroring the spirit of
 * fleet/vehicleDetail/hooks/useVehicleWorkspaceTab.js (URL is the source of
 * truth, not local component state) — adapted to path-based routing.
 */
export default function useSettingsSection() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeId = useMemo(
    () => resolveActiveSettingsSection(location.pathname)?.id || null,
    [location.pathname],
  );

  const goToSection = (section) => {
    if (!section?.live || !section.path) return;
    navigate(section.path);
  };

  return { activeId, goToSection };
}
