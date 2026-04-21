import { FuelRequest } from '../../models/index.js';
import { emitDomainEvent } from '../../events/eventBus.js';
import { EVENT_NAMES } from '../../events/eventNames.js';

/**
 * Approve fuel request (Manager only)
 */
export const approveFuelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, approvedAmount } = req.body;

    const request = await FuelRequest.findByPk(id);

    if (!request) {
      console.error('❌ Fuel request not found:', id);
      return res.status(404).json({ error: 'Fuel request not found' });
    }

    if (request.status !== 'pending') {
      console.error('❌ Invalid status transition:', request.status, '→ approved');
      return res.status(400).json({ error: 'Can only approve pending requests' });
    }

    // Update request with approved amount (can differ from requested)
    const finalAmount = approvedAmount || request.requestedAmount;
    const previousStatus = request.status;
    
    request.status = 'approved';
    request.approvedAmount = finalAmount;
    request.reviewTime = new Date();
    request.reviewerId = req.user.id;
    request.notes = notes || `Approved ${finalAmount}L`;

    await request.save();

    const message = notes
      ? `Your fuel request for ${finalAmount}L has been approved: ${notes}`
      : `Your fuel request for ${finalAmount}L has been approved`;

    emitDomainEvent(EVENT_NAMES.FUEL_REQUEST_APPROVED, {
      request,
      previousStatus,
      actorUserId: req.user.id,
      message,
    });

    res.json(request);
  } catch (error) {
    console.error('Approve fuel request error:', error);
    res.status(500).json({ error: 'Failed to approve fuel request' });
  }
};

