import { FuelRequest } from '../../models/index.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

/**
 * Mark fuel request as fulfilled
 */
export const fulfillFuelRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await FuelRequest.findByPk(id);

    if (!request) {
      console.error('❌ Fuel request not found:', id);
      return res.status(404).json({ error: 'Fuel request not found' });
    }

    if (request.status !== 'approved') {
      console.error('❌ Invalid status transition:', request.status, '→ fulfilled');
      return res.status(400).json({ error: 'Can only fulfill approved requests' });
    }

    const previousStatus = request.status;
    request.status = 'fulfilled';
    request.fulfillmentTime = new Date();
    
    await request.save();

    emitDomainEvent(EVENT_NAMES.FUEL_REQUEST_FULFILLED, {
      request,
      previousStatus,
      actorUserId: req.user.id,
    });

    res.json(request);
  } catch (error) {
    console.error('Fulfill fuel request error:', error);
    res.status(500).json({ error: 'Failed to fulfill fuel request' });
  }
};

