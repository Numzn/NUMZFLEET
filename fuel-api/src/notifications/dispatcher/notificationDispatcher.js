import { CHANNELS } from '../contracts/notificationContract.js';
import { deliverWebsocketNotification } from '../channels/websocketChannel.js';
import { deliverPushNotification } from '../channels/pushChannel.js';
import { deliverSmsNotification } from '../channels/smsChannel.js';
import { deliverEmailNotification } from '../channels/emailChannel.js';
import { toCanonicalPayload } from '../canonicalNotification.js';

/**
 * @param {import('socket.io').Server} [io]
 * @param {number} userId
 * @param {object} apiRow
 * @param {string[]} channels
 */
export async function dispatchNotificationChannels(io, userId, apiRow, channels) {
  const payload = toCanonicalPayload(apiRow);
  /** @type {Record<string, object>} per-channel outcome, keyed by CHANNELS value */
  const results = {};

  if (channels.includes(CHANNELS.WEBSOCKET)) {
    results[CHANNELS.WEBSOCKET] = deliverWebsocketNotification(io, userId, payload);
  }
  if (channels.includes(CHANNELS.PUSH)) {
    results[CHANNELS.PUSH] = await deliverPushNotification(payload);
  }
  if (channels.includes(CHANNELS.SMS)) {
    results[CHANNELS.SMS] = await deliverSmsNotification(payload);
  }
  if (channels.includes(CHANNELS.EMAIL)) {
    results[CHANNELS.EMAIL] = await deliverEmailNotification(payload);
  }

  // Returned so the caller can persist what actually happened. Nothing about
  // what gets sent, or to whom, changed here.
  return results;
}
