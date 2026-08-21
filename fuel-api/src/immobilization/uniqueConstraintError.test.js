import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUniqueConstraintError } from './uniqueConstraintError.js';

describe('isUniqueConstraintError', () => {
  it('matches Sequelize\'s wrapped unique-constraint error by name', () => {
    const error = { name: 'SequelizeUniqueConstraintError', message: 'Validation error' };
    assert.equal(isUniqueConstraintError(error), true);
  });

  it('matches a raw Postgres 23505 surfaced via error.original.code', () => {
    const error = { name: 'SequelizeDatabaseError', original: { code: '23505' } };
    assert.equal(isUniqueConstraintError(error), true);
  });

  it('matches a raw Postgres 23505 surfaced via error.parent.code', () => {
    const error = { name: 'SequelizeDatabaseError', parent: { code: '23505' } };
    assert.equal(isUniqueConstraintError(error), true);
  });

  it('does not match other Sequelize errors', () => {
    const error = { name: 'SequelizeValidationError', original: { code: '23502' } };
    assert.equal(isUniqueConstraintError(error), false);
  });

  it('does not match a generic error', () => {
    assert.equal(isUniqueConstraintError(new Error('boom')), false);
  });

  it('does not match a null/undefined error', () => {
    assert.equal(isUniqueConstraintError(null), false);
    assert.equal(isUniqueConstraintError(undefined), false);
  });
});
