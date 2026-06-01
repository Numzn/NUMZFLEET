import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { logImmobilization } from './immobilizationLog.js';

export const ALLOWED_TRANSITIONS = Object.freeze({
  pending: ['monitoring', 'executing', 'cancelled', 'expired'],
  monitoring: ['executing', 'cancelled', 'expired'],
  executing: ['completed', 'failed'],
  completed: [],
  failed: [],
  expired: [],
  cancelled: [],
});

const VALID_STATUSES = new Set(Object.keys(ALLOWED_TRANSITIONS));
const PATCHABLE_COLUMNS = new Set([
  'cancelledByUserId',
  'gateSnapshot',
  'executionError',
  'deliveryPhase',
  'confidence',
  'traccarHttpStatus',
  'traccarDeliveryAt',
  'executionCompletedAt',
]);

function toStatusArray(input) {
  return Array.isArray(input) ? input : [input];
}

export function isTransitionAllowed(from, to) {
  if (!VALID_STATUSES.has(from) || !VALID_STATUSES.has(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function validateTransition(fromStatuses, to) {
  if (!VALID_STATUSES.has(to)) {
    throw new Error(`transitionIntentState invalid target status: ${to}`);
  }

  for (const from of fromStatuses) {
    if (!VALID_STATUSES.has(from)) {
      throw new Error(`transitionIntentState invalid source status: ${from}`);
    }
    if (!isTransitionAllowed(from, to)) {
      throw new Error(`transitionIntentState disallowed transition: ${from} -> ${to}`);
    }
  }
}

function buildInPlaceholders(values, replacements, prefix) {
  return values.map((value, index) => {
    const key = `${prefix}${index}`;
    replacements[key] = value;
    return `:${key}`;
  }).join(', ');
}

/**
 * Atomically transition one intent to a target status if current status still matches.
 * Returns updated row on success, null if stale/no-op.
 */
export async function transitionIntentState({
  id,
  from,
  to,
  patch = {},
  transaction = undefined,
}) {
  if (!id) throw new Error('transitionIntentState requires id');
  const fromStatuses = toStatusArray(from).filter(Boolean);
  if (fromStatuses.length === 0) throw new Error('transitionIntentState requires from status');
  validateTransition(fromStatuses, to);

  const replacements = { id, to };
  const setClauses = ['status = :to', '"updatedAt" = NOW()'];

  for (const [column, value] of Object.entries(patch || {})) {
    if (!PATCHABLE_COLUMNS.has(column)) {
      throw new Error(`transitionIntentState patch column not allowed: ${column}`);
    }
    const key = `patch_${column}`;
    replacements[key] = column === 'gateSnapshot' ? JSON.stringify(value ?? {}) : value;
    if (column === 'gateSnapshot') {
      setClauses.push(`"${column}" = CAST(:${key} AS jsonb)`);
    } else {
      setClauses.push(`"${column}" = :${key}`);
    }
  }

  const fromIn = buildInPlaceholders(fromStatuses, replacements, 'fromStatus');
  const sql = `
UPDATE vehicle_immobilization_intents
SET ${setClauses.join(',\n    ')}
WHERE id = :id
  AND status IN (${fromIn})
RETURNING *;
`;

  const rows = await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    logImmobilization('immobilization.intent.transition_rejected', {
      intentId: id,
      from: fromStatuses,
      attempted: to,
    });
    return null;
  }

  return row;
}
