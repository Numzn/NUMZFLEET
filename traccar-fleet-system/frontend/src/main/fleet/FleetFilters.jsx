import { Box } from '@mui/material';
import FiltersFlyout from '../components/FiltersFlyout';

/**
 * Compact filter control — pair with FleetSearch in one row.
 */
const FleetFilters = ({
  groups = [],
  filters,
  devices,
  onFilterChange,
  sx: sxProp = {},
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ...sxProp }}>
    <FiltersFlyout
      onFilterChange={onFilterChange}
      compact
      groups={groups}
      filters={filters}
      devices={devices}
    />
  </Box>
);

export default FleetFilters;
