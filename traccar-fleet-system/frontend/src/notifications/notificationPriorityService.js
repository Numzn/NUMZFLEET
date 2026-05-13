/**
 * @typedef {object} DeliveryPlan
 * @property {boolean} toast
 * @property {boolean} persistentToast
 * @property {boolean} browserPush
 * @property {boolean} sound
 */

/**
 * Pure priority rules (no transport / component knowledge).
 * @param {string} severity
 * @param {{ documentHidden: boolean, hasFocus: boolean }} focus
 * @returns {DeliveryPlan}
 */
export function getDeliveryPlan(severity, focus) {
  const blurred = focus.documentHidden || !focus.hasFocus;

  switch (severity) {
    case 'critical':
      return {
        toast: true,
        persistentToast: true,
        browserPush: blurred,
        sound: true,
      };
    case 'warning':
      return {
        toast: true,
        persistentToast: false,
        browserPush: blurred,
        sound: false,
      };
    case 'success':
      return {
        toast: true,
        persistentToast: false,
        browserPush: false,
        sound: false,
      };
    case 'info':
    default:
      return {
        toast: false,
        persistentToast: false,
        browserPush: false,
        sound: false,
      };
  }
}

export function mapSeverityToToastType(severity) {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  if (severity === 'success') return 'success';
  return 'info';
}
