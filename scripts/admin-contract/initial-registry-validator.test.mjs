/**
 * NEW FICTITIOUS cases only. One read of the new allowlisted JSON.
 * Every finite mutation and independent expectation is fixed before validation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFixtureInitialRegistry as validate} from './initial-registry-validator.mjs';
import {validateFixtureDtos, validateFixtureReferences} from './static-dto-validator.mjs';

const data = JSON.parse(readFileSync(new URL(
  './fixtures/fictitious-initial-registry-cases.json', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(data).sort(), ['baseline', 'cases', 'profile', 'schema']);
assert.equal(data.schema, 'FICTITIOUS_INITIAL_REGISTRY_CASES_1');
assert.equal(data.profile, 'DTD_ADMIN_INITIAL_REGISTRY_PREFLIGHT_BRIEF_1');
const clone = x => JSON.parse(JSON.stringify(x));
const get = (input, name) => input.units.find(u => u.id === 'FICT_REG_ID_' + name);
const ref = u => ({
  schema: 'PROP_ADMIN_ORIGINAL_REF_2', logicalRole: u.role, versionId: u.versionId,
  kind: u.dtoType === 'INPUT_DATA' ? 'TOOL_INPUT' : 'JSON_ORIGINAL',
  storageRole: 'FICT_MEMORY', custodyHandle: u.id, contentPin: clone(u.pin),
  whole: 'ENTERO', sourceEventRole: null
});
function second(input, declared) {
  const decl = clone(get(input, 'DECL_A'));
  Object.assign(decl, {id: 'FICT_REG_ID_DECL_B', role: 'FICT_REG_ROLE_DECL_B',
    versionId: 'FICT_REG_VERSION_DECL_B', order: 5});
  decl.value.label = 'FICT_DECLARATION_BETA';
  input.units.push(decl);
  const row = {actionId: 'FICT_REG_ACTION_B', actionRole: 'FICT_REG_ACTION_ROLE_B',
    key: 'FICT_REG_KEY_B', ordinal: 1, inputRef: ref(get(input, 'INPUT_B')),
    declarationRef: ref(decl)};
  const unit = clone(get(input, 'ENTRY_A'));
  Object.assign(unit, {id: 'FICT_REG_ID_ENTRY_B', role: 'FICT_REG_ROLE_ENTRY_B',
    versionId: 'FICT_REG_VERSION_ENTRY_B', order: 40});
  Object.assign(unit.value, {actionId: row.actionId, actionRole: row.actionRole,
    key: row.key, ordinal: row.ordinal, input: clone(row.inputRef),
    declarationRef: clone(row.declarationRef)});
  Object.assign(unit.value.events[0], {ordinal: row.ordinal, original: clone(row.inputRef)});
  input.units.push(unit);
  input.captureRefs.push(ref(unit));
  if (declared) input.declarations.push(row);
  return {unit, row};
}
function make(role) {
  const input = clone(data.baseline);
  input.caseRole = role;
  const entry = get(input, 'ENTRY_A'), v = entry.value, row = input.declarations[0];
  switch (role) {
    case 'FICT_MATCH': break;
    case 'FICT_UNDECLARED': second(input, false); break;
    case 'FICT_NO_CAPTURE':
      input.units = input.units.filter(u => u.id !== entry.id);
      input.captureRefs = []; break;
    case 'FICT_CROSSED_INPUT':
      v.input = ref(get(input, 'INPUT_B')); v.events[0].original = clone(v.input); break;
    case 'FICT_DUP_ACTION_ID': case 'FICT_DUP_ACTION_ROLE':
    case 'FICT_DUP_KEY': case 'FICT_DUP_ORDINAL': {
      const key = {FICT_DUP_ACTION_ID: 'actionId', FICT_DUP_ACTION_ROLE: 'actionRole',
        FICT_DUP_KEY: 'key', FICT_DUP_ORDINAL: 'ordinal'}[role];
      const b = second(input, true);
      b.row[key] = row[key]; b.unit.value[key] = row[key];
      if (key === 'ordinal') b.unit.value.events[0].ordinal = row.ordinal;
      break;
    }
    case 'FICT_DUP_DECL_REF': {
      const b = second(input, true);
      b.row.declarationRef = clone(row.declarationRef);
      b.unit.value.declarationRef = clone(row.declarationRef); break;
    }
    case 'FICT_ALIAS_CAPTURE':
      input.captureRefs.push({...clone(input.captureRefs[0]), sourceEventRole: 'FICT_ALIAS'}); break;
    case 'FICT_UNLISTED': input.captureRefs = []; break;
    case 'FICT_CROSS_ACTION_ID': v.actionId = 'FICT_CHANGED'; break;
    case 'FICT_CROSS_ACTION_ROLE': v.actionRole = 'FICT_CHANGED'; break;
    case 'FICT_CROSS_KEY': v.key = 'FICT_CHANGED'; break;
    case 'FICT_CROSS_ORDINAL': v.ordinal = 88; v.events[0].ordinal = 88; break;
    case 'FICT_MISSING_VERSION': v.input.versionId = 'FICT_MISSING'; break;
    case 'FICT_MISSING_ROLE': row.inputRef.logicalRole = 'FICT_MISSING'; break;
    case 'FICT_WRONG_KIND': row.inputRef = ref(get(input, 'DECL_A')); break;
    case 'FICT_SELF_CYCLE':
      v.input = ref(entry); v.events[0].original = clone(v.input); break;
    case 'FICT_FUTURE': get(input, 'INPUT_A').order = 100; break;
    case 'FICT_EXTRA_RESULT': v.result = ref(get(input, 'INPUT_B')); break;
    case 'FICT_EXTRA_TERMINAL': v.native.terminal = true; break;
    case 'FICT_UNKNOWN_FIELD': v.state = 'FICT_OLD_ALIAS'; break;
    case 'FICT_NULL_PIN': v.input.contentPin = null; break;
    case 'FICT_PARTIAL': v.input.whole = 'PARCIAL'; break;
    case 'FICT_NULL_HANDLE': v.input.custodyHandle = null; break;
    case 'FICT_CRITICAL_NULL': row.inputRef = null; break;
    case 'FICT_MISSING_MARKER': delete input.marker; break;
    case 'FICT_MALFORMED': return null;
    default: assert.fail('Undefined fictitious mutation: ' + role);
  }
  return input;
}
const good = {state: 'VALID', evidence: 'PRESENT_FICTITIOUS', required: [], only: true};
const bad = (code, field, only = true) => ({
  state: 'INVALID', evidence: 'NO_ACREDITADO_FICTITIOUS', required: [{code, field}], only
});
const nd = field => ({state: 'VALID', evidence: 'NO_ACREDITADO_FICTITIOUS',
  required: [{code: 'INCOMPLETE_EVIDENCE', field}], only: true});
const expected = {
  FICT_MATCH: good,
  FICT_UNDECLARED: bad('INVALID_FIELD', 'value.declarationRef'),
  FICT_NO_CAPTURE: nd('captureRefs'),
  FICT_CROSSED_INPUT: bad('INVALID_FIELD', 'value.input'),
  FICT_DUP_ACTION_ID: bad('INVALID_FIELD', 'declarations[1].actionId'),
  FICT_DUP_ACTION_ROLE: bad('INVALID_FIELD', 'declarations[1].actionRole'),
  FICT_DUP_KEY: bad('INVALID_FIELD', 'declarations[1].key'),
  FICT_DUP_ORDINAL: bad('INVALID_FIELD', 'declarations[1].ordinal'),
  FICT_DUP_DECL_REF: bad('INVALID_FIELD', 'declarations[1].declarationRef', false),
  FICT_ALIAS_CAPTURE: bad('INVALID_FIELD', 'captureRefs[1]'),
  FICT_UNLISTED: bad('MISSING_REF', 'captureRefs', false),
  FICT_CROSS_ACTION_ID: bad('INVALID_FIELD', 'value.actionId'),
  FICT_CROSS_ACTION_ROLE: bad('INVALID_FIELD', 'value.actionRole'),
  FICT_CROSS_KEY: bad('INVALID_FIELD', 'value.key'),
  FICT_CROSS_ORDINAL: bad('INVALID_FIELD', 'value.ordinal'),
  FICT_MISSING_VERSION: bad('MISSING_REF', 'value.input'),
  FICT_MISSING_ROLE: bad('MISSING_REF', 'declarations[0].inputRef'),
  FICT_WRONG_KIND: bad('WRONG_KIND', 'declarations[0].inputRef'),
  FICT_SELF_CYCLE: bad('CYCLE', 'value.input', false),
  FICT_FUTURE: bad('INVALID_ORDER', 'value.input', false),
  FICT_EXTRA_RESULT: bad('INVALID_FIELD', 'value.result'),
  FICT_EXTRA_TERMINAL: bad('INVALID_FIELD', 'value.native.terminal'),
  FICT_UNKNOWN_FIELD: bad('INVALID_FIELD', 'value.state'),
  FICT_NULL_PIN: nd('value.input'),
  FICT_PARTIAL: nd('value.input'),
  FICT_NULL_HANDLE: nd('value.input'),
  FICT_CRITICAL_NULL: nd('declarations[0].inputRef'),
  FICT_MISSING_MARKER: bad('BAD_ENVELOPE', 'fixture'),
  FICT_MALFORMED: bad('BAD_ENVELOPE', 'fixture')
};
assert.deepEqual(data.cases, Object.keys(expected));
function freeze(x) {
  if (x !== null && typeof x === 'object') {
    Object.values(x).forEach(freeze); Object.freeze(x);
  }
  return x;
}
// All 29 new effective inputs and expectations exist before any validator call.
const cases = data.cases.map(role => ({role, input: freeze(make(role)), expected: expected[role]}));
freeze(cases);
const codes = ['BAD_ENVELOPE', 'INVALID_FIELD', 'MISSING_REF', 'WRONG_KIND',
  'CYCLE', 'INVALID_ORDER', 'INCOMPLETE_EVIDENCE'];
for (const current of cases) {
  test(current.role, () => {
    const before = JSON.stringify(current.input);
    const result = validate(current.input), want = current.expected;
    assert.deepEqual(Object.keys(result).sort(), ['evidenceState', 'issues', 'scope', 'structuralState']);
    assert.equal(result.structuralState, want.state);
    assert.equal(result.evidenceState, want.evidence);
    assert.equal(result.scope, 'FICTITIOUS_STRUCTURE_ONLY');
    const roles = new Set(['FICT_ENVELOPE',
      ...(current.input?.units ?? []).map(u => u.role),
      ...(current.input?.declarations ?? []).map(r => r.actionRole)]);
    for (const issue of result.issues) {
      assert.deepEqual(Object.keys(issue).sort(), ['code', 'field', 'role']);
      assert.ok(codes.includes(issue.code));
      assert.ok(roles.has(issue.role), 'diagnostic role must identify its unit or declaration');
      assert.equal(typeof issue.field, 'string');
    }
    for (const required of want.required)
      assert.ok(result.issues.some(i => i.code === required.code && i.field === required.field),
        'missing independently expected diagnostic ' + JSON.stringify(required));
    if (want.only) assert.equal(result.issues.length, want.required.length);
    assert.equal(JSON.stringify(current.input), before, 'mutation of frozen fictitious input');
    if (current.role === 'FICT_CROSSED_INPUT') {
      const envelope = {marker: 'FICTITIOUS_ADMIN_DTO_FIXTURE_1',
        caseRole: current.role, units: current.input.units};
      for (const check of [validateFixtureDtos, validateFixtureReferences]) {
        assert.deepEqual(check(envelope), {structuralState: 'VALID',
          evidenceState: 'PRESENT_FICTITIOUS', scope: 'FICTITIOUS_STRUCTURE_ONLY', issues: []});
      }
      const capture = get(current.input, 'ENTRY_A').value;
      assert.deepEqual(capture.events[0].original, capture.input);
      assert.notEqual(capture.input.versionId, current.input.declarations[0].inputRef.versionId);
      assert.equal(get(current.input, 'INPUT_A').unitKind, get(current.input, 'INPUT_B').unitKind);
      assert.deepEqual(validate(cases[0].input), {structuralState: 'VALID',
        evidenceState: 'PRESENT_FICTITIOUS', scope: 'FICTITIOUS_STRUCTURE_ONLY', issues: []});
    }
  });
}
