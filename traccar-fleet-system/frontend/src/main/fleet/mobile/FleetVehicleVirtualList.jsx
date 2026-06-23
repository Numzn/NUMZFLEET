import { List } from 'react-window';
import FleetVehicleListRow from './FleetVehicleListRow';

const ROW_HEIGHT = 48;

function VirtualRow({
  index,
  style,
  devices,
  positions,
  selectedId,
  onSelect,
  ariaAttributes,
}) {
  const device = devices[index];
  if (!device) return null;
  return (
    <div style={style} {...ariaAttributes}>
      <FleetVehicleListRow
        device={device}
        position={positions[device.id]}
        selected={selectedId === device.id}
        onSelect={onSelect}
      />
    </div>
  );
}

const FleetVehicleVirtualList = ({
  devices = [],
  positions = {},
  selectedId,
  listHeight,
  onSelect,
}) => (
  <List
    rowCount={devices.length}
    rowHeight={ROW_HEIGHT}
    rowComponent={VirtualRow}
    rowProps={{
      devices,
      positions,
      selectedId,
      onSelect,
    }}
    style={{ height: listHeight, width: '100%' }}
  />
);

export default FleetVehicleVirtualList;
