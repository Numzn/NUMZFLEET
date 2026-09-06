import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligence } from './intelligenceBuilder.js';

function baseEngine(overrides = {}) {
  return {
    maintenance: { nextService: null, overdueCount: 0, dueSoonCount: 0 },
    fuel: {},
    status: { operational: 'online' },
    activity: { anomalies: [] },
    health: { overall: null },
    ...overrides,
  };
}

function findingsFor(code, engine, options = {}) {
  return buildIntelligence(engine, options).findings.filter((f) => f.code === code);
}

describe('buildIntelligence — fuel.efficiency_declining trend vocabulary', () => {
  it('fires on trend "decreasing" — the real value computeTrend() produces for a tracked vehicle', () => {
    const engine = baseEngine({ fuel: { trend: 'decreasing', confidence: 60 } });
    assert.equal(findingsFor('fuel.efficiency_declining', engine).length, 1);
  });

  it('still fires on the legacy literal "declining" — the untracked-vehicle learning-engine fallback', () => {
    const engine = baseEngine({ fuel: { trend: 'declining', confidence: 60 } });
    assert.equal(findingsFor('fuel.efficiency_declining', engine).length, 1);
  });

  it('does not fire on "increasing" or "stable"', () => {
    assert.equal(findingsFor('fuel.efficiency_declining', baseEngine({ fuel: { trend: 'increasing', confidence: 60 } })).length, 0);
    assert.equal(findingsFor('fuel.efficiency_declining', baseEngine({ fuel: { trend: 'stable', confidence: 60 } })).length, 0);
  });

  it('does not fire below the confidence floor even when declining', () => {
    const engine = baseEngine({ fuel: { trend: 'decreasing', confidence: 39 } });
    assert.equal(findingsFor('fuel.efficiency_declining', engine).length, 0);
  });

  it('confidence exactly at the floor (40) still fires', () => {
    const engine = baseEngine({ fuel: { trend: 'decreasing', confidence: 40 } });
    assert.equal(findingsFor('fuel.efficiency_declining', engine).length, 1);
  });
});

describe('buildIntelligence — vehicle health tiers', () => {
  it('overall >= 70 -> no health finding at all', () => {
    const engine = baseEngine({ health: { overall: 70 } });
    assert.equal(findingsFor('HEALTH_ATTENTION', engine).length, 0);
    assert.equal(findingsFor('HEALTH_CRITICAL', engine).length, 0);
  });

  it('60 <= overall < 70 -> HEALTH_ATTENTION (warning), not critical', () => {
    const engine = baseEngine({ health: { overall: 65 } });
    const attention = findingsFor('HEALTH_ATTENTION', engine);
    assert.equal(attention.length, 1);
    assert.equal(attention[0].severity, 'warning');
    assert.equal(findingsFor('HEALTH_CRITICAL', engine).length, 0);
  });

  it('overall exactly 60 -> still HEALTH_ATTENTION, not critical (boundary is < 60, not <=)', () => {
    const engine = baseEngine({ health: { overall: 60 } });
    assert.equal(findingsFor('HEALTH_ATTENTION', engine).length, 1);
    assert.equal(findingsFor('HEALTH_CRITICAL', engine).length, 0);
  });

  it('overall < 60 -> HEALTH_CRITICAL (error severity), not attention', () => {
    const engine = baseEngine({ health: { overall: 59 } });
    const critical = findingsFor('HEALTH_CRITICAL', engine);
    assert.equal(critical.length, 1);
    assert.equal(critical[0].severity, 'error');
    assert.equal(findingsFor('HEALTH_ATTENTION', engine).length, 0);
  });

  it('overall null -> no health finding, not a crash', () => {
    const engine = baseEngine({ health: { overall: null } });
    assert.equal(findingsFor('HEALTH_ATTENTION', engine).length, 0);
    assert.equal(findingsFor('HEALTH_CRITICAL', engine).length, 0);
  });
});
