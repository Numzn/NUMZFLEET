import {
  Box,
  Link,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PositionValue from '../../common/components/PositionValue';
import { useTranslation } from '../../common/components/LocalizationProvider';
import usePositionAttributes from '../../common/attributes/usePositionAttributes';
import { useAttributePreference } from '../../common/util/preferences';

/**
 * Compact read-only telemetry from user positionItems preference (sidebar / fleet row).
 */
const DeviceTelemetryPanel = ({ position }) => {
  const t = useTranslation();
  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference('positionItems', 'fixTime,address,speed,totalDistance');

  if (!position) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 0.25 }}>
        No live position
      </Typography>
    );
  }

  const keys = positionItems
    .split(',')
    .map((k) => k.trim())
    .filter((key) => key && (Object.prototype.hasOwnProperty.call(position, key)
      || (position.attributes && Object.prototype.hasOwnProperty.call(position.attributes, key))));

  if (!keys.length) return null;

  return (
    <Box sx={{ mt: 0.75, maxHeight: 200, overflow: 'auto' }}>
      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.35, px: 0, border: 0 } }}>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key}>
              <TableCell sx={{ width: '38%', verticalAlign: 'top' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.65rem' }}>
                  {positionAttributes[key]?.name || key}
                </Typography>
              </TableCell>
              <TableCell sx={{ verticalAlign: 'top' }}>
                <Typography variant="caption" component="div" sx={{ fontSize: '0.6875rem', lineHeight: 1.35 }}>
                  <PositionValue
                    position={position}
                    property={Object.prototype.hasOwnProperty.call(position, key) ? key : null}
                    attribute={Object.prototype.hasOwnProperty.call(position, key) ? null : key}
                  />
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
            <TableRow>
              <TableCell colSpan={2} sx={{ border: 0, pt: 0.5 }}>
                <Link component={RouterLink} to={`/position/${position.id}`} variant="caption">
                  {t('sharedShowDetails')}
                </Link>
              </TableCell>
            </TableRow>
          </TableFooter>
      </Table>
    </Box>
  );
};

export default DeviceTelemetryPanel;
