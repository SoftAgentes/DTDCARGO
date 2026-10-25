/**
 * DTD_ADMIN_INITIAL_REGISTRY_PREFLIGHT_BRIEF_1; FICTITIOUS JSON only.
 * This is structural correlation, never proof of real PRE-AWAIT custody.
 * Static dependency is the unchanged, pure DTO module from the fixed base.
 */
import {validateFixtureDtos} from './static-dto-validator.mjs';

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fict = x => typeof x === 'string' && /^FICT_.+$/s.test(x);
const uint = x => Number.isSafeInteger(x) && x >= 0;
const exact = (x, keys) => object(x) && Object.keys(x).length === keys.length &&
  keys.every(k => Object.prototype.hasOwnProperty.call(x, k));
const equal = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) ?
  a.length === b.length && a.every((x, i) => equal(x, b[i])) :
  object(a) && object(b) && Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every(k => Object.hasOwn(b, k) && equal(a[k], b[k])));
const pin = x => exact(x, ['bytes', 'utf16Units', 'sha256']) && uint(x.bytes) &&
  uint(x.utf16Units) && typeof x.sha256 === 'string' && /^[0-9a-f]{64}$/.test(x.sha256);
const refKeys = ['schema', 'logicalRole', 'versionId', 'kind', 'storageRole',
  'custodyHandle', 'contentPin', 'whole', 'sourceEventRole'];
const refShape = r => exact(r, refKeys) && r.schema === 'PROP_ADMIN_ORIGINAL_REF_2' &&
  ['logicalRole', 'versionId', 'storageRole'].every(k => fict(r[k])) &&
  ['TEXT_UTF8', 'JSON_ORIGINAL', 'TOOL_INPUT', 'TOOL_RETURN', 'ERROR', 'DECLARATION'].includes(r.kind) &&
  (r.custodyHandle === null || fict(r.custodyHandle)) &&
  (r.contentPin === null || pin(r.contentPin)) &&
  ['ENTERO', 'NO_OBSERVADO', 'PARCIAL', 'DESCONOCIDO'].includes(r.whole) &&
  (r.sourceEventRole === null || fict(r.sourceEventRole));
function walk(value, visit, field = 'value') {
  if (Array.isArray(value)) value.forEach((x, i) => walk(x, visit, field + '[' + i + ']'));
  else if (object(value)) {
    if (value.schema === 'PROP_ADMIN_ORIGINAL_REF_2') visit(value, field);
    else Object.entries(value).forEach(([k, v]) => walk(v, visit, field + '.' + k));
  }
}
export function validateFixtureInitialRegistry(envelope) {
  const issues = [];
  const add = (code, role, field) => {
    if (!issues.some(x => x.code === code && x.role === role && x.field === field))
      issues.push({code, role, field});
  };
  const report = () => ({
    structuralState: issues.some(x => x.code !== 'INCOMPLETE_EVIDENCE') ? 'INVALID' : 'VALID',
    evidenceState: issues.length ? 'NO_ACREDITADO_FICTITIOUS' : 'PRESENT_FICTITIOUS',
    scope: 'FICTITIOUS_STRUCTURE_ONLY', issues
  });
  if (!exact(envelope, ['marker', 'caseRole', 'units', 'declarations', 'captureRefs']) ||
      envelope.marker !== 'FICTITIOUS_ADMIN_INITIAL_REGISTRY_FIXTURE_1' ||
      !fict(envelope.caseRole) || !Array.isArray(envelope.units) || !envelope.units.length ||
      !Array.isArray(envelope.declarations) || !envelope.declarations.length ||
      !Array.isArray(envelope.captureRefs)) {
    add('BAD_ENVELOPE', 'FICT_ENVELOPE', 'fixture'); return report();
  }
  const {units, declarations, captureRefs} = envelope;
  const forms = validateFixtureDtos({
    marker: 'FICTITIOUS_ADMIN_DTO_FIXTURE_1', caseRole: envelope.caseRole, units
  });
  for (const i of forms.issues) {
    if (i.code !== 'INCOMPLETE_EVIDENCE')
      add(i.code, i.role, i.field.replace(/^units\[\d+\]\./, ''));
  }
  if (forms.structuralState === 'INVALID') return report();
  for (const u of units) {
    if (!['LOCAL_DATA', 'INPUT_DATA', 'ENTRY3'].includes(u.dtoType))
      add('INVALID_FIELD', u.role, 'dtoType');
  }
  if (issues.length) return report();
  const byVersion = new Map(units.map(u => [u.versionId, u]));
  // Return the real target even if evidence is incomplete; never invent a ref.
  function resolve(r, role, field, types = null, dependent = null) {
    if (r === null) { add('INCOMPLETE_EVIDENCE', role, field); return {unit: null, full: false}; }
    if (!refShape(r)) { add('INVALID_FIELD', role, field); return {unit: null, full: false}; }
    const target = byVersion.get(r.versionId);
    if (!target || target.role !== r.logicalRole) {
      add('MISSING_REF', role, field); return {unit: null, full: false};
    }
    let full = true;
    const bad = code => { add(code, role, field); full = false; };
    const expectedKind = target.dtoType === 'INPUT_DATA' ? 'TOOL_INPUT' : 'JSON_ORIGINAL';
    if (r.kind !== expectedKind || (types && !types.includes(target.dtoType))) bad('WRONG_KIND');
    if (r.storageRole !== 'FICT_MEMORY' ||
        (r.custodyHandle !== null && r.custodyHandle !== target.id) ||
        (r.contentPin !== null && !equal(r.contentPin, target.pin))) bad('INVALID_FIELD');
    if (r.whole !== 'ENTERO' || r.custodyHandle === null || r.contentPin === null)
      bad('INCOMPLETE_EVIDENCE');
    if (dependent && target.order >= dependent.order) bad('INVALID_ORDER');
    return {unit: target, full};
  }
  const rowKeys = ['actionId', 'actionRole', 'key', 'ordinal', 'inputRef', 'declarationRef'];
  const columns = new Map(['actionId', 'actionRole', 'key', 'ordinal', 'declarationRef']
    .map(k => [k, new Set()]));
  const rows = [];
  for (const [i, row] of declarations.entries()) {
    const role = fict(row?.actionRole) ? row.actionRole : envelope.caseRole;
    if (!exact(row, rowKeys) || !['actionId', 'actionRole', 'key'].every(k => fict(row[k])) ||
        !uint(row.ordinal)) {
      add('INVALID_FIELD', role, 'declarations[' + i + ']'); continue;
    }
    for (const k of ['actionId', 'actionRole', 'key', 'ordinal']) {
      if (columns.get(k).has(row[k])) add('INVALID_FIELD', role, 'declarations[' + i + '].' + k);
      columns.get(k).add(row[k]);
    }
    const input = resolve(row.inputRef, role, 'declarations[' + i + '].inputRef', ['INPUT_DATA']);
    const declaration = resolve(row.declarationRef, role,
      'declarations[' + i + '].declarationRef', ['LOCAL_DATA']);
    if (declaration.unit) {
      const id = declaration.unit.versionId;
      if (columns.get('declarationRef').has(id))
        add('INVALID_FIELD', role, 'declarations[' + i + '].declarationRef');
      columns.get('declarationRef').add(id);
    }
    rows.push({row, index: i, input, declaration, count: 0});
  }
  const edges = new Map(units.map(u => [u.versionId, []]));
  const entryRefs = new Map();
  for (const u of units) {
    walk(u.value, (r, field) => {
      const types = field === 'value.declarationRef' ? ['LOCAL_DATA'] :
        field === 'value.input' || field === 'value.events[0].original' ? ['INPUT_DATA'] : null;
      const resolved = resolve(r, u.role, field, types, u);
      if (resolved.unit) edges.get(u.versionId).push({unit: resolved.unit, field});
      if (field === 'value.input' || field === 'value.declarationRef') {
        if (!entryRefs.has(u.versionId)) entryRefs.set(u.versionId, {});
        entryRefs.get(u.versionId)[field] = resolved;
      }
    });
    if (u.dtoType !== 'ENTRY3') continue;
    const v = u.value;
    for (const [k, expected] of Object.entries({
      inputProp: 'FICT_INPUT', boundary: 'PREFIX', actionKind: 'TOOL_CALL',
      captureState: 'INPUT_SAVED', callState: 'NOT_INVOKED'
    })) if (v[k] !== expected) add('INVALID_FIELD', u.role, 'value.' + k);
    for (const k of ['returnProp', 'parentRole', 'beforeUtc', 'result', 'error', 'afterUtc',
      'stopReason', 'localObservationRef', 'containerVersionRef']) {
      if (v[k] !== null) add('INVALID_FIELD', u.role, 'value.' + k);
    }
    for (const [k, value] of Object.entries(v.native))
      if (value !== null) add('INVALID_FIELD', u.role, 'value.native.' + k);
    if (v.events.length !== 1) add('INVALID_FIELD', u.role, 'value.events');
    else {
      const e = v.events[0];
      for (const [k, expected] of Object.entries({
        ordinal: v.ordinal, priorOrdinal: null, kind: 'INPUT_SAVED', observedUtc: null
      })) if (e[k] !== expected) add('INVALID_FIELD', u.role, 'value.events[0].' + k);
      const a = resolve(v.input, u.role, 'value.input', ['INPUT_DATA'], u);
      const b = resolve(e.original, u.role, 'value.events[0].original', ['INPUT_DATA'], u);
      if (a.full && b.full && !equal(v.input, e.original))
        add('INVALID_FIELD', u.role, 'value.events[0].original');
    }
    if (v.input === null) resolve(null, u.role, 'value.input');
    if (v.declarationRef === null) resolve(null, u.role, 'value.declarationRef');
  }
  const color = new Map();
  function visit(u) {
    color.set(u.versionId, 1);
    for (const edge of edges.get(u.versionId)) {
      if (color.get(edge.unit.versionId) === 1) add('CYCLE', u.role, edge.field);
      else if (!color.has(edge.unit.versionId)) visit(edge.unit);
    }
    color.set(u.versionId, 2);
  }
  units.forEach(u => { if (!color.has(u.versionId)) visit(u); });
  const captured = [], seen = new Set();
  captureRefs.forEach((r, i) => {
    const value = resolve(r, fict(r?.logicalRole) ? r.logicalRole : envelope.caseRole,
      'captureRefs[' + i + ']', ['ENTRY3']);
    if (!value.unit || value.unit.dtoType !== 'ENTRY3') return;
    if (seen.has(value.unit.versionId)) add('INVALID_FIELD', value.unit.role, 'captureRefs[' + i + ']');
    else { seen.add(value.unit.versionId); captured.push(value.unit); }
  });
  for (const u of units) {
    if (u.dtoType === 'ENTRY3' && !seen.has(u.versionId)) add('MISSING_REF', u.role, 'captureRefs');
  }
  for (const u of captured) {
    const v = u.value, refs = entryRefs.get(u.versionId) ?? {};
    const matching = rows.filter(x => x.declaration.unit &&
      x.declaration.unit.versionId === refs['value.declarationRef']?.unit?.versionId);
    if (matching.length !== 1) { add('INVALID_FIELD', u.role, 'value.declarationRef'); continue; }
    const item = matching[0], row = item.row;
    item.count++;
    for (const k of ['actionId', 'actionRole', 'key', 'ordinal']) {
      if (v[k] !== row[k]) add('INVALID_FIELD', u.role, 'value.' + k);
    }
    if (item.declaration.full && refs['value.declarationRef']?.full &&
        !equal(row.declarationRef, v.declarationRef)) add('INVALID_FIELD', u.role, 'value.declarationRef');
    if (item.input.full && refs['value.input']?.full && !equal(row.inputRef, v.input))
      add('INVALID_FIELD', u.role, 'value.input');
    for (const [name, resolved] of [['inputRef', item.input], ['declarationRef', item.declaration]]) {
      if (resolved.unit && resolved.unit.order >= u.order)
        add('INVALID_ORDER', row.actionRole, 'declarations[' + item.index + '].' + name);
    }
  }
  for (const item of rows) {
    if (item.count === 0) add('INCOMPLETE_EVIDENCE', item.row.actionRole, 'captureRefs');
    if (item.count > 1) add('INVALID_FIELD', item.row.actionRole, 'captureRefs');
  }
  return report();
}
