/** @type {import('socket.io').Server|null} */
let notificationIo = null;

/** @param {import('socket.io').Server} io */
export function setNotificationIo(io) {
  notificationIo = io;
}

export function getNotificationIo() {
  return notificationIo;
}
