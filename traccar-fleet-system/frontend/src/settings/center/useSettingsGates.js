import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  useAdministrator, useManager, useSuperAdmin, useTechnician,
} from '../../common/util/permissions';
import useFeatures from '../../common/util/useFeatures';

/**
 * The inputs to the Settings section gating rule (isSettingsSectionVisible), in one
 * place. The sidebar, the command palette and the route guard all read this, so what
 * a user is shown and what they can open can never drift apart.
 */
export default function useSettingsGates() {
  const manager = useManager();
  const admin = useAdministrator();
  const technician = useTechnician();
  const platformOwner = useSuperAdmin();
  const features = useFeatures();
  const currentContextType = useSelector((state) => state.organizations?.currentContext?.type);

  return useMemo(() => ({
    manager, admin, technician, platformOwner, features, currentContextType,
  }), [manager, admin, technician, platformOwner, features, currentContextType]);
}
