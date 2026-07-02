-- Vehicle fuel learning state and interval audit trail.

CREATE TABLE IF NOT EXISTS vehicle_fuel_learning (
  fleet_vehicle_id UUID PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id INTEGER,
  current_efficiency DECIMAL(10,4),
  spec_efficiency DECIMAL(10,4),
  confidence SMALLINT DEFAULT 0,
  trend VARCHAR(20) DEFAULT 'stable',
  total_observations INTEGER DEFAULT 0,
  total_distance_km DECIMAL(12,2) DEFAULT 0,
  efficiency_history JSONB DEFAULT '[]'::jsonb,
  last_interval_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_fuel_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  refuel_id INTEGER REFERENCES operation_session_refuels(id) ON DELETE SET NULL,
  previous_refuel_id INTEGER REFERENCES operation_session_refuels(id) ON DELETE SET NULL,
  distance_km DECIMAL(12,2),
  litres_consumed DECIMAL(10,2),
  efficiency_km_l DECIMAL(10,4),
  validation_status VARCHAR(20),
  is_anomalous BOOLEAN DEFAULT FALSE,
  event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_intervals_vehicle_time
  ON vehicle_fuel_intervals(fleet_vehicle_id, event_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_intervals_refuel_id
  ON vehicle_fuel_intervals(refuel_id)
  WHERE refuel_id IS NOT NULL;
