export const EVENT_NAMES = {
  VEHICLE_ASSIGNED: 'vehicle.assigned',

  // Fuel request state machine
  FUEL_REQUEST_CREATED:   'fuel.request.created',
  FUEL_REQUEST_APPROVED:  'fuel.request.approved',
  FUEL_REQUEST_FULFILLED: 'fuel.request.fulfilled',
  FUEL_REQUEST_REJECTED:  'fuel.request.rejected',
  FUEL_REQUEST_CANCELLED: 'fuel.request.cancelled',

  // Operation session / fueling day
  OPERATION_REFUEL_RECORDED: 'operation.refuel.recorded',
  OPERATION_REFUEL_ARRIVED: 'operation.refuel.arrived',
  OPERATION_REFUEL_SKIPPED: 'operation.refuel.skipped',
  OPERATION_INVOICE_RECONCILED: 'operation.invoice.reconciled',
  VEHICLE_DOCUMENT_OCR_COMPLETED: 'vehicle.document.ocr.completed',
  OPERATION_NOTIFICATION: 'operation.notification',

  // ERB fuel price feed
  ERB_PRICES_UPDATED: 'erb.prices.updated',

  // Vehicle activity state (telemetry ingestion)
  VEHICLE_STATE_CHANGED: 'vehicle.state.changed',
};
