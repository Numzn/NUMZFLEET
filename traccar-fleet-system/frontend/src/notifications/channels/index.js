/**
 * Future delivery channels (FCM, email, SMS, WhatsApp) register here.
 * Each channel: { id, canDeliver(ctx), deliver(notification, ctx) }
 */
export const deliveryChannelRegistry = [];

export function registerDeliveryChannel(channel) {
  if (channel?.id) {
    deliveryChannelRegistry.push(channel);
  }
}
