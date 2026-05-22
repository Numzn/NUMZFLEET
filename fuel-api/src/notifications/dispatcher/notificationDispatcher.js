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

  if (channels.includes(CHANNELS.WEBSOCKET)) {
    deliverWebsocketNotification(io, userId, payload);
  }
  if (channels.includes(CHANNELS.PUSH)) {
    await deliverPushNotification(payload);
  }
  if (channels.includes(CHANNELS.SMS)) {
    await deliverSmsNotification(payload);
  }
  if (channels.includes(CHANNELS.EMAIL)) {
    await deliverEmailNotification(payload);
  }
}
