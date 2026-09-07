/**
 * Derives a person's roles and status from the fields that actually gate access
 * today. The hooks in ./permissions.js answer this only for the logged-in user;
 * the People directory needs the same answer for every row, so the rules are
 * restated here to match them exactly — keep the two in step.
 */

export const PERSON_ROLE_ADMIN = 'admin';
export const PERSON_ROLE_MANAGER = 'manager';
export const PERSON_ROLE_TECHNICIAN = 'technician';
export const PERSON_ROLE_DISPATCHER = 'dispatcher';

function readNumzRole(attributes) {
  return attributes.numzRole || attributes.numz_role || null;
}

/**
 * Note there is deliberately no "driver by exclusion" rule here. A person who is
 * neither an admin nor a manager is not thereby a driver — being a driver means
 * having an actual driver profile, which is resolved separately by
 * usePersonDriverLinks. Inferring it from the absence of other roles would badge
 * every ordinary account as a driver.
 */
export function derivePersonRoles(person) {
  if (!person) return [];
  const attributes = person.attributes || {};
  const roles = [];

  if (person.administrator) {
    roles.push(PERSON_ROLE_ADMIN);
  } else if (person.isManager === true || attributes.isManager === true || attributes.isManager === 'true') {
    roles.push(PERSON_ROLE_MANAGER);
  }

  const numzRole = readNumzRole(attributes);
  if (numzRole === PERSON_ROLE_TECHNICIAN) roles.push(PERSON_ROLE_TECHNICIAN);
  if (numzRole === PERSON_ROLE_DISPATCHER) roles.push(PERSON_ROLE_DISPATCHER);

  return roles;
}

/** 'disabled' | 'expired' | 'active' */
export function derivePersonStatus(person) {
  if (!person) return 'active';
  if (person.disabled) return 'disabled';
  if (person.expirationTime && new Date(person.expirationTime).getTime() < Date.now()) {
    return 'expired';
  }
  return 'active';
}
