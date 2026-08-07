import { Stack } from '@mui/material';
import PageHeader from '../../../common/components/PageHeader.jsx';
import SettingsCard from './SettingsCard.jsx';

/**
 * Shared section wrapper for every Settings Center section: the app's standard
 * page header over a card body.
 *
 * The header used to be written inline here, and its docblock noted it doubled
 * as the app's "PageHeader". It now composes common/components/PageHeader so
 * the rest of the app can use the same header without importing something from
 * settings/. This component's props and output are unchanged — all nine
 * consumers keep working untouched.
 */
export default function SettingsSectionPanel({
  title, description, actions, children,
}) {
  return (
    <Stack spacing={2}>
      <PageHeader title={title} subtitle={description} actions={actions} />
      <SettingsCard>{children}</SettingsCard>
    </Stack>
  );
}
