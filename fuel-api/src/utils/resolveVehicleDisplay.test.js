import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVehicleDisplay,
  formatVehicleDisplayLine,
} from './resolveVehicleDisplay.js';

describe('resolveVehicleDisplay', () => {
  it('uses nickname as primary with registration secondary', () => {
    const d = resolveVehicleDisplay({ name: 'Copper Truck 1', plateNumber: 'ABA 1234' });
    assert.equal(d.primary, 'Copper Truck 1');
    assert.equal(d.secondary, 'ABA 1234');
  });

  it('uses registration when no nickname', () => {
    const d = resolveVehicleDisplay({ plateNumber: 'ABA 1234' });
    assert.equal(d.primary, 'ABA 1234');
    assert.equal(d.secondary, null);
  });

  it('falls back to device name', () => {
    const d = resolveVehicleDisplay({ deviceName: 'Tracker01', deviceId: 25 });
    assert.equal(d.primary, 'Tracker01');
    assert.equal(d.deviceId, 25);
  });

  it('never returns Device {id} pattern', () => {
    const d = resolveVehicleDisplay({ deviceId: 25 });
    assert.equal(d.primary, 'Vehicle');
    assert.ok(!d.primary.includes('Device'));
  });

  it('formatVehicleDisplayLine combines primary and secondary', () => {
    const line = formatVehicleDisplayLine({
      primary: 'Copper Truck 1',
      secondary: 'ABA 1234',
    });
    assert.equal(line, 'Copper Truck 1 (ABA 1234)');
  });
});
