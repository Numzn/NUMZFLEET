/**
 * WebSocket event handlers for fuel requests
 * Centralized functions for emitting fuel request events
 */

/**
 * Serialize a Sequelize instance to plain JSON
 */
const serializeRequest = (request) => {
  return request.toJSON ? request.toJSON() : request.get({ plain: true });
};

/**
 * Emit fuel request created event
 */
export const emitFuelRequestCreated = (io, fuelRequest, userId) => {
  if (!io) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ req.io is not available - WebSocket event not sent');
    }
    return;
  }

  const eventData = {
    request: serializeRequest(fuelRequest),
    change: {
      type: 'created',
      newStatus: 'pending',
      changedBy: userId,
      changedAt: new Date().toISOString(),
      message: `New fuel request for ${fuelRequest.requestedAmount}L from device ${fuelRequest.deviceId}`
    }
  };

  io.to('managers').emit('fuel-request-created', eventData);
};

/**
 * Emit fuel request updated event
 */
export const emitFuelRequestUpdated = (io, request, changeType, previousStatus, userId, customMessage = null) => {
  if (!io) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [socketEvents] req.io is not available - WebSocket events not sent');
      console.warn('⚠️ [socketEvents] io parameter is:', io);
    }
    return;
  }
  
  if (!io.sockets) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [socketEvents] io.sockets is missing - cannot emit events');
    }
    return;
  }

  const serializedRequest = serializeRequest(request);
  
  // Generate default message if not provided
  let message = customMessage;
  if (!message) {
    switch (changeType) {
      case 'approved':
        message = `Your fuel request for ${request.approvedAmount || request.requestedAmount}L has been approved`;
        break;
      case 'rejected':
        message = `Your fuel request has been rejected`;
        break;
      case 'cancelled':
        message = 'Your fuel request has been cancelled';
        break;
      case 'fulfilled':
        message = `Fuel request for ${request.approvedAmount || request.requestedAmount}L has been fulfilled`;
        break;
      default:
        message = `Fuel request ${changeType}`;
    }
  }

  const changeData = {
    request: serializedRequest,
    change: {
      type: changeType,
      previousStatus: previousStatus,
      newStatus: request.status,
      changedBy: userId,
      changedAt: new Date().toISOString(),
      message: message
    }
  };

  io.to(`driver-${request.userId}`).emit('fuel-request-updated', changeData);
  io.to('managers').emit('fuel-request-updated', changeData);
};

/**
 * Emit fuel request cancelled event (with different messages for driver and manager)
 */
export const emitFuelRequestCancelled = (io, request, previousStatus, userId) => {
  if (!io) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ req.io is not available - WebSocket events not sent');
    }
    return;
  }

  const serializedRequest = serializeRequest(request);
  
  const driverEventData = {
    request: serializedRequest,
    change: {
      type: 'cancelled',
      previousStatus: previousStatus,
      newStatus: 'cancelled',
      changedBy: userId,
      changedAt: new Date().toISOString(),
      message: 'Your fuel request has been cancelled'
    }
  };
  
  const managerEventData = {
    request: serializedRequest,
    change: {
      type: 'cancelled',
      previousStatus: previousStatus,
      newStatus: 'cancelled',
      changedBy: userId,
      changedAt: new Date().toISOString(),
      message: `Fuel request #${request.id} has been cancelled by driver`
    }
  };

  io.to(`driver-${request.userId}`).emit('fuel-request-updated', driverEventData);
  io.to('managers').emit('fuel-request-updated', managerEventData);
};
