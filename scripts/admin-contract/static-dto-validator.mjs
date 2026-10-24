/**
 * ADMIN_STATIC_DTO_PROFILE_1. Only JSON marked FICTITIOUS_ADMIN_DTO_FIXTURE_1.
 * Pure, closed structural checks: no original lookup, I/O, clock or authenticity.
 * Evidence is always fictitious. Each export includes the preceding stages.
 */
const MARKER = 'FICTITIOUS_ADMIN_DTO_FIXTURE_1';
const RESULT = ['PASO', 'FALLO', 'NO_EJECUTADO', 'NO_DISPONIBLE', 'NO_ACREDITADO'];
const READ = ['COMPLETA', 'PARCIAL', 'NO_REALIZADA'];
const KINDS = ['SOURCE_CANONICAL', 'FINANCIAL_RAW', 'LOCAL_ORIGINAL', 'CALL_INPUT',
  'CALL_RETURN', 'CALL_ERROR', 'SEMANTIC_DTO', 'WHOLE_PROOF', 'OPERATION_CLOSURE',
  'PRODUCER_CLOSURE', 'GATE_REVIEW'];
const NATURAL = {
  VERSION_REF: 'SEMANTIC_DTO', UNIT_DESCRIPTOR: 'SEMANTIC_DTO', ENTRY3: 'SEMANTIC_DTO',
  NATIVE_OBSERVATION: 'SEMANTIC_DTO', OPERATION_CLOSURE: 'OPERATION_CLOSURE',
  ACTION_CLOSURE: 'SEMANTIC_DTO', PREDICATE_BINDING: 'SEMANTIC_DTO',
  RELATION_OPERAND: 'SEMANTIC_DTO', RELATION_PROOF: 'WHOLE_PROOF',
  RELATION_REVIEW: 'SEMANTIC_DTO', UNIT_REVIEW: 'SEMANTIC_DTO',
  LOCAL_DATA: 'LOCAL_ORIGINAL', INPUT_DATA: 'CALL_INPUT', RETURN_DATA: 'CALL_RETURN',
  ERROR_DATA: 'CALL_ERROR', CONTAINER_DATA: 'SEMANTIC_DTO'
};
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
const sameData = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) ?
  a.length === b.length && a.every((v, i) => sameData(v, b[i])) :
  object(a) && object(b) && Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every(k => own(b, k) && sameData(a[k], b[k])));
const fict = x => typeof x === 'string' && /^FICT_.+$/s.test(x);
const uint = x => Number.isSafeInteger(x) && x >= 0;
const integer = x => Number.isSafeInteger(x);
const scalar = x => x === null || typeof x === 'boolean' ||
  (typeof x === 'number' && Number.isFinite(x)) || fict(x);
const utc = x => typeof x === 'string' &&
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/.test(x);
function issue(c, code, field) {
  if (!c.issues.some(i => i.code === code && i.role === c.role && i.field === field))
    c.issues.push({code, role: c.role, field});
}
const primitive = fn => (x, c, p) => { if (!fn(x)) issue(c, 'INVALID_FIELD', p); };
const text = primitive(fict), U = primitive(uint), B = primitive(x => typeof x === 'boolean');
const I = primitive(integer), S = primitive(scalar), UTC = primitive(utc);
const literal = value => primitive(x => x === value);
const enumeration = values => primitive(x => values.includes(x));
const nullable = check => (x, c, p) => { if (x !== null) check(x, c, p); };
const array = (check, minimum = 0) => (x, c, p) => {
  if (!Array.isArray(x) || x.length < minimum) { issue(c, 'INVALID_FIELD', p); return; }
  x.forEach((v, i) => check(v, c, p + '[' + i + ']'));
};
const shape = fields => (x, c, p) => {
  if (!object(x)) { issue(c, 'INVALID_FIELD', p); return; }
  for (const k of Object.keys(x)) if (!own(fields, k)) issue(c, 'INVALID_FIELD', p + '.' + k);
  for (const [k, check] of Object.entries(fields)) {
    if (!own(x, k)) issue(c, 'INVALID_FIELD', p + '.' + k);
    else check(x[k], c, p + '.' + k);
  }
};
const pin = shape({bytes: U, utf16Units: U,
  sha256: primitive(x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x))});
const ref = shape({
  schema: literal('PROP_ADMIN_ORIGINAL_REF_2'), logicalRole: text, versionId: text,
  kind: enumeration(['TEXT_UTF8', 'JSON_ORIGINAL', 'TOOL_INPUT', 'TOOL_RETURN', 'ERROR', 'DECLARATION']),
  storageRole: text, custodyHandle: nullable(text), contentPin: nullable(pin),
  whole: enumeration(['NO_OBSERVADO', 'ENTERO', 'PARCIAL', 'DESCONOCIDO']),
  sourceEventRole: nullable(text)
});
const native = shape({toolCallId: nullable(text), chunkId: nullable(text),
  sessionId: S, exitCode: nullable(I), terminal: nullable(B), source: nullable(ref)});
const states = ['DECLARED', 'INPUT_SAVED', 'RETURN_SAVED', 'INTERPRETATION_RECORDED', 'STOP'];
const event = shape({schema: literal('PROP_ADMIN_EVENT_1'), ordinal: U, priorOrdinal: nullable(U),
  kind: enumeration(states), original: ref, observedUtc: nullable(UTC)});
const requirement = shape({role: text, unitKind: enumeration(KINDS), min: U,
  max: nullable(U), critical: B, order: enumeration(['SINGLE', 'DECLARED_ORDER', 'OBSERVED_ORDER'])});
const binding = shape({contractRef: ref, predicateRole: text, operandRequirements: array(requirement, 1)});
const operand = shape({role: text, occurrence: U, unitRef: ref});
const claim = shape({claimRole: text, operandRoles: array(text, 1), result: enumeration(RESULT),
  evidenceRefs: array(ref, 1), scope: text});
const limits = array(text);
const forms = {
  VERSION_REF: ref,
  UNIT_DESCRIPTOR: shape({schema: literal('PROP_ADMIN_UNIT_DESCRIPTOR_1'), unitRole: text,
    kind: enumeration(KINDS), versionRef: ref, originRef: ref, parentRefs: array(ref),
    semanticContractRole: text, critical: B, custodianRole: text}),
  ENTRY3: shape({schema: literal('PROP_ADMIN_ENTRY_3'), actionRole: text, actionId: text, key: text,
    inputProp: nullable(text), returnProp: nullable(text), declarationRef: ref, parentRole: nullable(text),
    boundary: enumeration(['PREFIX', 'POST_PREFIX']), ordinal: U,
    actionKind: enumeration(['LOCAL_OBSERVATION', 'TOOL_CALL', 'INTERNAL_SUBROLE']),
    captureState: enumeration(states),
    callState: enumeration(['NO_APLICA', 'NOT_INVOKED', 'RETURNED', 'THREW', 'OUTCOME_UNKNOWN']),
    input: nullable(ref), beforeUtc: nullable(UTC), result: nullable(ref), error: nullable(ref),
    afterUtc: nullable(UTC), native, events: array(event, 1), stopReason: nullable(text),
    localObservationRef: nullable(ref), containerVersionRef: nullable(ref)}),
  NATIVE_OBSERVATION: native,
  OPERATION_CLOSURE: shape({schema: literal('PROP_ADMIN_OPERATION_CLOSURE_1'), operationRole: text,
    initialCallRef: ref, pollCallRefs: array(ref), terminalCallRef: nullable(ref),
    state: enumeration(['RUNNING', 'TERMINAL', 'UNKNOWN']),
    terminalObservationRef: nullable(ref), decisionRef: nullable(ref)}),
  ACTION_CLOSURE: shape({schema: literal('PROP_ADMIN_ACTION_CLOSURE_1'), actionRole: text,
    declarationRef: ref, inputRef: nullable(ref), returnRef: nullable(ref), errorRef: nullable(ref),
    localObservationRef: nullable(ref), containerRef: nullable(ref), captureEntryVersionRefs: array(ref, 1),
    operationClosureRef: nullable(ref), result: enumeration(RESULT), limits}),
  PREDICATE_BINDING: binding,
  RELATION_OPERAND: operand,
  RELATION_PROOF: shape({schema: literal('PROP_ADMIN_RELATION_PROOF_1'), predicate: binding,
    operandRefs: array(operand, 1), claims: array(claim, 1), sourceEvidenceRefs: array(ref, 1),
    result: enumeration(RESULT), limits}),
  RELATION_REVIEW: shape({schema: literal('PROP_ADMIN_RELATION_REVIEW_1'), relationRole: text,
    predicate: binding, operands: array(operand, 1), unitReviewRefs: array(ref, 1), proofRef: nullable(ref),
    reviewerRole: text, humanWhole: enumeration(READ), result: enumeration(RESULT), rationale: text,
    limits, sourceDecisionRef: nullable(ref)}),
  UNIT_REVIEW: shape({schema: literal('PROP_ADMIN_UNIT_REVIEW_1'), unitVersionRef: ref,
    channelProfileRef: ref, ownerRole: text, reviewerRole: text, custodyResult: enumeration(RESULT),
    receiveResult: enumeration(RESULT), humanWhole: enumeration(READ), semanticResult: enumeration(RESULT),
    relationProofRefs: array(ref), limits, decisionRef: nullable(ref)}),
  LOCAL_DATA: shape({fictitious: literal(true), label: text}),
  INPUT_DATA: shape({fictitious: literal(true), toolRole: text,
    arguments: shape({fictitious: literal(true), token: text})}),
  RETURN_DATA: shape({fictitious: literal(true), terminal: nullable(B), exitCode: nullable(I), sessionId: S}),
  ERROR_DATA: shape({fictitious: literal(true), message: text}),
  CONTAINER_DATA: shape({fictitious: literal(true), proofRef: ref})
};
function walkRefs(value, visit, field = 'value') {
  if (Array.isArray(value)) value.forEach((v, i) => walkRefs(v, visit, field + '[' + i + ']'));
  else if (object(value)) {
    if (value.schema === 'PROP_ADMIN_ORIGINAL_REF_2') visit(value, field);
    else for (const [k, v] of Object.entries(value)) walkRefs(v, visit, field + '.' + k);
  }
}
function localBinding(v, c, p) {
  if (!object(v) || !Array.isArray(v.operandRequirements)) return;
  const roles = new Set();
  for (const [i, r] of v.operandRequirements.entries()) {
    if (!object(r)) continue;
    if (roles.has(r.role)) issue(c, 'INVALID_FIELD', p + '.operandRequirements[' + i + '].role');
    roles.add(r.role);
    if ((r.max !== null && r.max < r.min) ||
        (r.order === 'SINGLE' && (r.min !== 1 || r.max !== 1)))
      issue(c, 'INVALID_FIELD', p + '.operandRequirements[' + i + ']');
  }
}
function dtoStage(fixture, c) {
  const envelopeKeys = ['marker', 'caseRole', 'units'];
  if (!object(fixture) || Object.keys(fixture).length !== 3 ||
      !envelopeKeys.every(k => own(fixture, k)) || fixture.marker !== MARKER ||
      !fict(fixture.caseRole) || !Array.isArray(fixture.units) || fixture.units.length === 0) {
    issue(c, 'BAD_ENVELOPE', 'fixture'); return false;
  }
  const ids = new Set(), versions = new Set(), orders = new Set();
  for (const [i, unit] of fixture.units.entries()) {
    c.role = fict(unit?.role) ? unit.role : fixture.caseRole;
    const p = 'units[' + i + ']';
    shape({id: text, dtoType: enumeration(Object.keys(forms)), unitKind: enumeration(KINDS),
      role: text, versionId: text, order: U, pin, value: () => {}})(unit, c, p);
    if (!object(unit)) continue;
    for (const [seen, name] of [[ids, 'id'], [versions, 'versionId'], [orders, 'order']]) {
      if (seen.has(unit[name])) issue(c, 'INVALID_FIELD', p + '.' + name);
      seen.add(unit[name]);
    }
    if (!own(forms, unit.dtoType)) continue;
    if (unit.unitKind !== NATURAL[unit.dtoType]) issue(c, 'INVALID_FIELD', p + '.unitKind');
    forms[unit.dtoType](unit.value, c, p + '.value');
    const v = unit.value;
    if (!object(v)) continue;
    if (unit.dtoType === 'PREDICATE_BINDING') localBinding(v, c, p + '.value');
    if (['RELATION_PROOF', 'RELATION_REVIEW'].includes(unit.dtoType)) {
      localBinding(v.predicate, c, p + '.value.predicate');
      const operands = v.operandRefs ?? v.operands;
      if (Array.isArray(operands)) {
        const pairs = new Set();
        operands.forEach((x, j) => {
          if (!object(x)) return;
          const pair = JSON.stringify([x.role, x.occurrence]);
          if (pairs.has(pair)) issue(c, 'INVALID_FIELD', p + '.value.operands[' + j + ']');
          pairs.add(pair);
        });
      }
    }
    walkRefs(v, (r, field) => {
      if (r.whole !== 'ENTERO') issue(c, 'INCOMPLETE_EVIDENCE', p + '.' + field + '.whole');
    });
    if (unit.dtoType === 'OPERATION_CLOSURE' && v.state !== 'TERMINAL')
      issue(c, 'INCOMPLETE_EVIDENCE', p + '.value.state');
    if (unit.dtoType === 'ENTRY3' && (v.captureState === 'STOP' || v.callState === 'OUTCOME_UNKNOWN'))
      issue(c, 'INCOMPLETE_EVIDENCE', p + '.value.callState');
    if (['ACTION_CLOSURE', 'RELATION_PROOF', 'RELATION_REVIEW'].includes(unit.dtoType) && v.result !== 'PASO')
      issue(c, 'INCOMPLETE_EVIDENCE', p + '.value.result');
    if (unit.dtoType === 'RELATION_REVIEW' && (v.humanWhole !== 'COMPLETA' || v.proofRef === null))
      issue(c, 'INCOMPLETE_EVIDENCE', p + '.value.proofRef');
    if (unit.dtoType === 'UNIT_REVIEW' &&
        (v.humanWhole !== 'COMPLETA' || ['custodyResult', 'receiveResult', 'semanticResult'].some(k => v[k] !== 'PASO')))
      issue(c, 'INCOMPLETE_EVIDENCE', p + '.value');
  }
  return !c.issues.some(x => x.code !== 'INCOMPLETE_EVIDENCE');
}
const representation = unit => ({INPUT_DATA: 'TOOL_INPUT', RETURN_DATA: 'TOOL_RETURN',
  ERROR_DATA: 'ERROR'}[unit.dtoType] ?? 'JSON_ORIGINAL');
function referenceStage(fixture, c) {
  const byVersion = new Map(fixture.units.map(u => [u.versionId, u]));
  const seenMetadata = new Map();
  const get = r => r === null ? null : byVersion.get(r.versionId);
  for (const unit of fixture.units) {
    c.role = unit.role;
    walkRefs(unit.value, (r, field) => {
      const target = get(r);
      if (!target || target.role !== r.logicalRole) { issue(c, 'MISSING_REF', field); return; }
      if (r.kind !== representation(target)) issue(c, 'WRONG_KIND', field + '.kind');
      if (r.contentPin !== null && !sameData(r.contentPin, target.pin))
        issue(c, 'INVALID_FIELD', field + '.contentPin');
      const metadata = [r.logicalRole, r.kind, r.storageRole, r.custodyHandle, r.contentPin];
      if (seenMetadata.has(r.versionId) && !sameData(seenMetadata.get(r.versionId), metadata))
        issue(c, 'INVALID_FIELD', field + '.aliasMetadata');
      seenMetadata.set(r.versionId, metadata);
    });
    const expect = (r, types, field) => {
      const target = get(r);
      if (target && !types.includes(target.dtoType)) issue(c, 'WRONG_KIND', field);
    };
    const v = unit.value;
    if (unit.dtoType === 'UNIT_DESCRIPTOR') {
      const t = get(v.versionRef);
      if (t && (v.kind !== t.unitKind || v.unitRole !== t.role)) issue(c, 'WRONG_KIND', 'value.versionRef');
    }
    if (unit.dtoType === 'ENTRY3') {
      expect(v.declarationRef, ['LOCAL_DATA'], 'value.declarationRef');
      expect(v.input, ['INPUT_DATA'], 'value.input'); expect(v.result, ['RETURN_DATA'], 'value.result');
      expect(v.error, ['ERROR_DATA'], 'value.error');
      expect(v.localObservationRef, ['LOCAL_DATA'], 'value.localObservationRef');
      if (v.containerVersionRef) {
        const t = get(v.containerVersionRef);
        if (t && t.unitKind !== 'SEMANTIC_DTO') issue(c, 'WRONG_KIND', 'value.containerVersionRef');
      }
    }
    if (unit.dtoType === 'OPERATION_CLOSURE') {
      expect(v.initialCallRef, ['ENTRY3'], 'value.initialCallRef');
      v.pollCallRefs.forEach((r, i) => expect(r, ['ENTRY3'], 'value.pollCallRefs[' + i + ']'));
      expect(v.terminalCallRef, ['ENTRY3'], 'value.terminalCallRef');
      expect(v.terminalObservationRef, ['RETURN_DATA'], 'value.terminalObservationRef');
      expect(v.decisionRef, ['LOCAL_DATA'], 'value.decisionRef');
    }
    if (unit.dtoType === 'ACTION_CLOSURE') {
      expect(v.declarationRef, ['LOCAL_DATA'], 'value.declarationRef');
      expect(v.inputRef, ['INPUT_DATA'], 'value.inputRef'); expect(v.returnRef, ['RETURN_DATA'], 'value.returnRef');
      expect(v.errorRef, ['ERROR_DATA'], 'value.errorRef');
      expect(v.localObservationRef, ['LOCAL_DATA'], 'value.localObservationRef');
      expect(v.operationClosureRef, ['OPERATION_CLOSURE'], 'value.operationClosureRef');
      v.captureEntryVersionRefs.forEach((r, i) => expect(r, ['ENTRY3'], 'value.captureEntryVersionRefs[' + i + ']'));
    }
    if (unit.dtoType === 'PREDICATE_BINDING') expect(v.contractRef, ['LOCAL_DATA'], 'value.contractRef');
    if (['RELATION_PROOF', 'RELATION_REVIEW'].includes(unit.dtoType))
      expect(v.predicate.contractRef, ['LOCAL_DATA'], 'value.predicate.contractRef');
    if (unit.dtoType === 'RELATION_REVIEW') {
      expect(v.proofRef, ['RELATION_PROOF'], 'value.proofRef');
      v.unitReviewRefs.forEach((r, i) => expect(r, ['UNIT_REVIEW'], 'value.unitReviewRefs[' + i + ']'));
      expect(v.sourceDecisionRef, ['LOCAL_DATA'], 'value.sourceDecisionRef');
    }
    if (unit.dtoType === 'UNIT_REVIEW') {
      expect(v.channelProfileRef, ['LOCAL_DATA'], 'value.channelProfileRef');
      expect(v.decisionRef, ['LOCAL_DATA'], 'value.decisionRef');
      v.relationProofRefs.forEach((r, i) => expect(r, ['RELATION_PROOF'], 'value.relationProofRefs[' + i + ']'));
    }
    if (unit.dtoType === 'CONTAINER_DATA') expect(v.proofRef, ['RELATION_PROOF'], 'value.proofRef');
  }
  return byVersion;
}
function closureStage(fixture, c, byVersion) {
  const get = r => r === null ? null : byVersion.get(r.versionId);
  const colors = new Map();
  function visit(unit) {
    if (colors.get(unit.versionId) === 1) {
      c.role = unit.role; issue(c, 'CYCLE', 'value.dependencies'); return;
    }
    if (colors.get(unit.versionId) === 2) return;
    colors.set(unit.versionId, 1);
    walkRefs(unit.value, r => { const t = get(r); if (t) visit(t); });
    colors.set(unit.versionId, 2);
  }
  fixture.units.forEach(visit);
  const entries = fixture.units.filter(u => u.dtoType === 'ENTRY3');
  for (const unit of fixture.units) {
    c.role = unit.role; const v = unit.value;
    walkRefs(v, (r, field) => {
      const t = get(r);
      if (t && t.order >= unit.order) issue(c, 'INVALID_ORDER', field);
    });
    if (unit.dtoType === 'ENTRY3') {
      const n = v.native;
      if (v.actionKind !== 'TOOL_CALL') {
        if (['inputProp', 'returnProp', 'input', 'result'].some(k => v[k] !== null) ||
            v.callState !== 'NO_APLICA' || ['toolCallId', 'chunkId', 'sessionId', 'exitCode', 'terminal'].some(k => n[k] !== null))
          issue(c, 'INVALID_ORDER', 'value.actionKind');
      } else {
        if (v.captureState === 'INPUT_SAVED' &&
            (v.input === null || v.callState !== 'NOT_INVOKED' || v.result !== null || v.error !== null))
          issue(c, 'INVALID_ORDER', 'value.INPUT_CAPTURE');
        if (v.captureState === 'RETURN_SAVED') {
          const previous = entries.some(e => e.order < unit.order && e.value.captureState === 'INPUT_SAVED' &&
            e.value.actionId === v.actionId && e.value.actionRole === v.actionRole && e.value.key === v.key &&
            e.value.inputProp === v.inputProp && e.value.returnProp === v.returnProp &&
            e.value.input?.versionId === v.input?.versionId);
          if (!previous || v.input === null ||
              !['RETURNED', 'THREW'].includes(v.callState) ||
              (v.callState === 'RETURNED' && (v.result === null || v.error !== null)) ||
              (v.callState === 'THREW' && (v.error === null || v.result !== null)))
            issue(c, 'INVALID_ORDER', 'value.RETURN_CAPTURE');
          const r = get(v.result);
          if (r && ['terminal', 'exitCode', 'sessionId'].some(k => n[k] !== r.value[k]))
            issue(c, 'INVALID_ORDER', 'value.native');
        }
      }
      if (v.events.at(-1).kind !== v.captureState) issue(c, 'INVALID_ORDER', 'value.events');
      v.events.forEach((e, i) => {
        if ((i === 0 && e.priorOrdinal !== null) ||
            (i > 0 && (e.ordinal <= v.events[i - 1].ordinal || e.priorOrdinal !== v.events[i - 1].ordinal)))
          issue(c, 'INVALID_ORDER', 'value.events[' + i + ']');
        const expected = e.kind === 'INPUT_SAVED' ? v.input :
          e.kind === 'RETURN_SAVED' ? (v.result ?? v.error) : null;
        if (expected && e.original.versionId !== expected.versionId)
          issue(c, 'INVALID_ORDER', 'value.events[' + i + '].original');
      });
    }
    if (unit.dtoType === 'NATIVE_OBSERVATION' && v.source) {
      const original = get(v.source);
      if (original.dtoType === 'RETURN_DATA' &&
          ['terminal', 'exitCode', 'sessionId'].some(k => v[k] !== original.value[k]))
        issue(c, 'INVALID_ORDER', 'value.source');
    }
    if (unit.dtoType === 'OPERATION_CLOSURE') {
      const initial = get(v.initialCallRef), polls = v.pollCallRefs.map(get);
      for (const call of [initial, ...polls]) {
        if (call.value.captureState !== 'RETURN_SAVED' || call.value.actionKind !== 'TOOL_CALL')
          issue(c, 'INVALID_ORDER', 'value.callRefs');
      }
      const allCalls = [initial, ...polls];
      for (let i = 1; i < allCalls.length; i++) {
        if (allCalls[i].order <= allCalls[i - 1].order ||
            allCalls[i - 1].value.native.terminal === true ||
            initial.value.native.sessionId === null ||
            allCalls[i].value.native.sessionId !== initial.value.native.sessionId)
          issue(c, 'INVALID_ORDER', 'value.pollCallRefs');
      }
      if (v.state === 'TERMINAL') {
        const last = allCalls.at(-1), observed = get(last.value.result);
        if (v.terminalCallRef?.versionId !== last.versionId || last.value.native.terminal !== true ||
            !observed || observed.value.terminal !== true ||
            v.terminalObservationRef?.versionId !== observed.versionId)
          issue(c, 'INVALID_ORDER', 'value.terminalCallRef');
      } else if (v.terminalCallRef !== null || v.terminalObservationRef !== null ||
          allCalls.some(call => call.value.native.terminal === true)) {
        issue(c, 'INVALID_ORDER', 'value.terminalObservationRef');
      }
    }
    if (unit.dtoType === 'ACTION_CLOSURE' && !v.operationClosureRef &&
        v.captureEntryVersionRefs.map(get).some(e => e.value.actionKind === 'TOOL_CALL'))
      issue(c, v.result === 'PASO' ? 'INVALID_ORDER' : 'INCOMPLETE_EVIDENCE', 'value.operationClosureRef');
    if (unit.dtoType === 'ACTION_CLOSURE' && v.operationClosureRef) {
      const op = get(v.operationClosureRef);
      if ([op.value.initialCallRef, ...op.value.pollCallRefs].some(r =>
          !v.captureEntryVersionRefs.some(capture => capture.versionId === r.versionId)))
        issue(c, 'MISSING_REF', 'value.captureEntryVersionRefs');
      if (v.result === 'PASO') {
        const term = get(op.value.terminalObservationRef);
        if (op.value.state !== 'TERMINAL' || !term || term.value.terminal !== true ||
            term.value.exitCode !== 0 || v.returnRef?.versionId !== term.versionId)
          issue(c, 'INVALID_ORDER', 'value.result');
      }
    }
    if (['RELATION_PROOF', 'RELATION_REVIEW'].includes(unit.dtoType)) {
      const operands = v.operandRefs ?? v.operands, reqs = v.predicate.operandRequirements;
      for (const operand of operands) {
        const req = reqs.find(r => r.role === operand.role), t = get(operand.unitRef);
        if (!req || t.unitKind !== req.unitKind) issue(c, 'WRONG_KIND', 'value.operands');
      }
      for (const req of reqs) {
        const matches = operands.filter(o => o.role === req.role);
        if (matches.length < req.min || (req.max !== null && matches.length > req.max))
          issue(c, 'MISSING_REF', 'value.operandRequirements');
        if (matches.some((o, i) => o.occurrence !== i) ||
            (req.order !== 'SINGLE' && matches.some((o, i) => i > 0 &&
              get(o.unitRef).order <= get(matches[i - 1].unitRef).order)))
          issue(c, 'INVALID_ORDER', 'value.operands');
      }
      if (unit.dtoType === 'RELATION_PROOF') {
        if (v.claims.some(x => x.operandRoles.some(role => !operands.some(o => o.role === role))))
          issue(c, 'MISSING_REF', 'value.claims.operandRoles');
        if (v.result === 'PASO' && v.claims.some(x => x.result !== 'PASO'))
          issue(c, 'INVALID_FIELD', 'value.claims.result');
      } else {
        const proof = get(v.proofRef);
        const critical = operands.filter(o => reqs.find(r => r.role === o.role)?.critical).map(o => o.unitRef.versionId);
        if (proof) critical.push(proof.versionId);
        for (const id of new Set(critical)) {
          const reviews = v.unitReviewRefs.map(get).filter(r => r.value.unitVersionRef.versionId === id);
          if (reviews.length !== 1) issue(c, 'MISSING_REF', 'value.unitReviewRefs');
        }
        if (v.result === 'PASO' && (!proof || proof.value.result !== 'PASO' || v.humanWhole !== 'COMPLETA' ||
            !sameData(proof.value.predicate, v.predicate) ||
            v.unitReviewRefs.map(get).some(r => ['custodyResult', 'receiveResult', 'semanticResult'].some(k =>
              r.value[k] !== 'PASO') || r.value.humanWhole !== 'COMPLETA')))
          issue(c, 'INCOMPLETE_EVIDENCE', 'value.result');
      }
    }
  }
}
function report(c) {
  return {
    structuralState: c.issues.some(i => i.code !== 'INCOMPLETE_EVIDENCE') ? 'INVALID' : 'VALID',
    evidenceState: c.issues.length ? 'NO_ACREDITADO_FICTITIOUS' : 'PRESENT_FICTITIOUS',
    scope: 'FICTITIOUS_STRUCTURE_ONLY', issues: c.issues
  };
}
function validate(fixture, stage) {
  const c = {issues: [], role: 'FICT_ENVELOPE'};
  if (!dtoStage(fixture, c) || stage === 0) return report(c);
  const byVersion = referenceStage(fixture, c);
  if (c.issues.some(i => i.code !== 'INCOMPLETE_EVIDENCE') || stage === 1) return report(c);
  closureStage(fixture, c, byVersion);
  return report(c);
}
export function validateFixtureDtos(fixture) { return validate(fixture, 0); }
export function validateFixtureReferences(fixture) { return validate(fixture, 1); }
export function validateFixtureClosureOrder(fixture) { return validate(fixture, 2); }
