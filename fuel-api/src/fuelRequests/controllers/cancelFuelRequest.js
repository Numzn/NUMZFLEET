import { FuelRequest } from '../../models/index.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

/**
 * Cancel fuel request (Driver only - can only cancel own pending requests)
 */
export const cancelFuelRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await FuelRequest.findByPk(id);

    if (!request) {
      console.error('❌ Fuel request not found:', id);
      return res.status(404).json({ error: 'Fuel request not found' });
    }

    // Only driver who created it can cancel
    if (request.userId !== req.user.id) {
      console.error('❌ Forbidden - User', req.user.id, 'cannot cancel request owned by', request.userId);
      return res.status(403).json({ error: 'Forbidden - Can only cancel your own requests' });
    }

    if (request.status !== 'pending' && request.status !== 'approved') {
      console.error('❌ Invalid status for cancellation:', request.status);
      return res.status(400).json({ error: 'Can only cancel pending or approved requests' });
    }

    // Capture previous status before changing
    const previousStatus = request.status;

    request.status = 'cancelled';
    
    await request.save();

    emitDomainEvent(EVENT_NAMES.FUEL_REQUEST_CANCELLED, {
      request,
      previousStatus,
      actorUserId: req.user.id,
    });

    res.json(request);
  } catch (error) {
    console.error('Cancel fuel request error:', error);
    res.status(500).json({ error: 'Failed to cancel fuel request' });
  }
};

