/**
 * ADMIN_STATIC_DTO_PROFILE_1. All inputs and observations below are FICTITIOUS.
 * Read exactly the allowlisted JSON fixture. Materialize every effective case
 * before the first validator call; expectations were authored in that JSON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateFixtureDtos, validateFixtureReferences, validateFixtureClosureOrder
} from './static-dto-validator.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/fictitious-dto-cases.json', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(fixture).sort(), ['baseline', 'cases', 'profile', 'schema']);
assert.equal(fixture.schema, 'FICTITIOUS_ADMIN_DTO_CASES_1');
assert.equal(fixture.profile, 'ADMIN_STATIC_DTO_PROFILE_1');

const clone = value => JSON.parse(JSON.stringify(value));
function applyCase(definition) {
  const keys = Object.keys(definition).sort();
  const direct = Object.hasOwn(definition, 'input');
  assert.deepEqual(keys, direct ? ['caseRole', 'expected', 'input'] : ['caseRole', 'changes', 'expected']);
  if (direct) return clone(definition.input);
  const input = clone(fixture.baseline);
  input.caseRole = definition.caseRole;
  for (const change of definition.changes) {
    assert.ok(['set', 'delete'].includes(change.op));
    assert.deepEqual(Object.keys(change).sort(),
      change.op === 'set' ? ['op', 'path', 'value'] : ['op', 'path']);
    assert.ok(Array.isArray(change.path) && change.path.length > 0);
    assert.ok(change.path.every(k => (typeof k === 'string' || Number.isSafeInteger(k)) &&
      !['__proto__', 'prototype', 'constructor'].includes(k)));
    let target = input;
    for (const key of change.path.slice(0, -1)) {
      assert.ok(target !== null && typeof target === 'object' && Object.hasOwn(target, key));
      target = target[key];
    }
    const last = change.path.at(-1);
    if (change.op === 'delete') {
      assert.ok(Object.hasOwn(target, last));
      delete target[last];
    } else target[last] = clone(change.value);
  }
  return input;
}
function freeze(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Complete, finite effective inputs, not lazy transformations during validation.
const effectiveCases = fixture.cases.map(definition => ({
  role: definition.caseRole, input: freeze(applyCase(definition)), expected: freeze(clone(definition.expected))
}));
freeze(effectiveCases);
const stages = [
  ['Dtos', validateFixtureDtos],
  ['References', validateFixtureReferences],
  ['ClosureOrder', validateFixtureClosureOrder]
];
const codes = ['BAD_ENVELOPE', 'INVALID_FIELD', 'MISSING_REF', 'WRONG_KIND',
  'CYCLE', 'INVALID_ORDER', 'INCOMPLETE_EVIDENCE'];

test('FICTICIO: all effective cases exist before validation and cover the admitted groups', () => {
  assert.deepEqual(effectiveCases.map(c => c.role), [
    'FICT_VALID', 'FICT_WRONG_KIND_SAME_SHAPE', 'FICT_MISSING_VERSION_ROLE',
    'FICT_CYCLE_SELF_REFERENCE', 'FICT_NONTERMINAL', 'FICT_TERMINAL_OWN_POLL',
    'FICT_TERMINAL_TRANSFERRED_TO_INITIAL', 'FICT_PROOF_CONTAINER_EXTERNAL_REVIEW',
    'FICT_FORWARD_CONTAINER', 'FICT_MUTUAL_CLOSURE_WRONG_KIND', 'FICT_ND_WITHOUT_SUCCESS',
    'FICT_MALFORMED_NULL', 'FICT_MISSING_MARKER', 'FICT_UNKNOWN_FIELD_ALIAS'
  ]);
  assert.ok(effectiveCases.every(c => c.expected.structuralStates.length === 3 &&
    c.expected.evidenceStates.length === 3 && c.expected.requiredCodes.length === 3));
});

for (const current of effectiveCases) {
  for (const [index, [name, validate]] of stages.entries()) {
    test(current.role + ': ' + name + ' FICTITIOUS_STRUCTURE_ONLY', () => {
      const before = JSON.stringify(current.input);
      const result = validate(current.input);
      assert.deepEqual(Object.keys(result).sort(), ['evidenceState', 'issues', 'scope', 'structuralState']);
      assert.equal(result.structuralState, current.expected.structuralStates[index]);
      assert.equal(result.evidenceState, current.expected.evidenceStates[index]);
      assert.equal(result.scope, 'FICTITIOUS_STRUCTURE_ONLY');
      assert.ok(Array.isArray(result.issues));
      for (const issue of result.issues) {
        assert.deepEqual(Object.keys(issue).sort(), ['code', 'field', 'role']);
        assert.ok(codes.includes(issue.code));
        assert.match(issue.role, /^FICT_/);
        assert.equal(typeof issue.field, 'string');
      }
      for (const code of current.expected.requiredCodes[index])
        assert.ok(result.issues.some(issue => issue.code === code), 'missing independently expected code ' + code);
      if (result.evidenceState === 'PRESENT_FICTITIOUS') assert.deepEqual(result.issues, []);
      assert.equal(JSON.stringify(current.input), before, 'pure export mutated its frozen input');
    });
  }
}

const caseByRole = role => effectiveCases.find(c => c.role === role).input;
const unit = (input, role) => input.units.find(u => u.role === role);
test('FICTICIO: terminal belongs to the own poll, never to the initial return', () => {
  const input = caseByRole('FICT_TERMINAL_OWN_POLL');
  const initial = unit(input, 'FICT_ROLE_INITIAL_RETURN');
  const poll = unit(input, 'FICT_ROLE_POLL_RETURN');
  const closure = unit(input, 'FICT_ROLE_OPERATION');
  assert.equal(initial.value.terminal, false);
  assert.equal(initial.value.exitCode, null);
  assert.equal(poll.value.terminal, true);
  assert.equal(poll.value.exitCode, 0);
  assert.equal(closure.value.terminalCallRef.versionId, 'FICT_VERSION_POLL_RETURN_CAPTURE');
  assert.equal(closure.value.terminalObservationRef.versionId, poll.versionId);
  assert.equal(unit(input, 'FICT_ROLE_POLL_RETURN_CAPTURE').value.native.sessionId,
    unit(input, 'FICT_ROLE_INITIAL_RETURN_CAPTURE').value.native.sessionId);
});
test('FICTICIO: finite proof then container then external review, with concrete proof review', () => {
  const input = caseByRole('FICT_PROOF_CONTAINER_EXTERNAL_REVIEW');
  const rawProof = unit(input, 'FICT_ROLE_RAW_PROOF'), container = unit(input, 'FICT_ROLE_CONTAINER');
  const containerProof = unit(input, 'FICT_ROLE_CONTAINER_PROOF'), review = unit(input, 'FICT_ROLE_RELATION_REVIEW');
  assert.ok(rawProof.order < container.order && container.order < containerProof.order &&
    containerProof.order < review.order);
  assert.equal(container.value.proofRef.versionId, rawProof.versionId);
  assert.equal(containerProof.value.operandRefs[0].unitRef.versionId, container.versionId);
  assert.equal(review.value.proofRef.versionId, containerProof.versionId);
  assert.equal(unit(input, 'FICT_ROLE_PROOF_REVIEW').value.unitVersionRef.versionId, containerProof.versionId);
});
test('FICTICIO: ND and running have no terminal reference or successful action', () => {
  for (const role of ['FICT_NONTERMINAL', 'FICT_ND_WITHOUT_SUCCESS']) {
    const input = caseByRole(role), closure = unit(input, 'FICT_ROLE_OPERATION').value;
    assert.notEqual(closure.state, 'TERMINAL');
    assert.equal(closure.terminalCallRef, null);
    assert.equal(closure.terminalObservationRef, null);
    assert.notEqual(unit(input, 'FICT_ROLE_ACTION').value.result, 'PASO');
    assert.equal(unit(input, 'FICT_ROLE_POLL_RETURN').value.exitCode, null);
  }
});
