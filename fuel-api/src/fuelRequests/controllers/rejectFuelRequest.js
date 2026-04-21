import { FuelRequest } from '../../models/index.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

/**
 * Reject fuel request (Manager only)
 */
export const rejectFuelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const request = await FuelRequest.findByPk(id);

    if (!request) {
      console.error('❌ Fuel request not found:', id);
      return res.status(404).json({ error: 'Fuel request not found' });
    }

    if (request.status !== 'pending') {
      console.error('❌ Invalid status transition:', request.status, '→ rejected');
      return res.status(400).json({ error: 'Can only reject pending requests' });
    }

    // Update request
    const previousStatus = request.status;
    request.status = 'rejected';
    request.reviewTime = new Date();
    request.reviewerId = req.user.id;
    request.notes = notes || 'Request rejected by manager';

    await request.save();

    const message = notes
      ? `Your fuel request has been rejected: ${notes}`
      : `Your fuel request has been rejected`;

    emitDomainEvent(EVENT_NAMES.FUEL_REQUEST_REJECTED, {
      request,
      previousStatus,
      actorUserId: req.user.id,
      message,
    });

    res.json(request);
  } catch (error) {
    console.error('Reject fuel request error:', error);
    res.status(500).json({ error: 'Failed to reject fuel request' });
  }
};

