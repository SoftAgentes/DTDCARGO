const PRIORITY_ORDER = { red: 0, yellow: 1, unknown: 2, green: 3, nice_to_have: 4 }
const STAGE_ORDER = { review: 0, qa: 1, dev: 2, planning: 3, backlog: 4 }

export function listValue(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
  if (value === null || value === undefined) return []
  const text = String(value).trim()
  if (!text || /^(null|none|n\/a)$/i.test(text)) return []
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text
  return inner.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
}

function truthy(value) {
  return /^(true|1|yes|si|sí)$/i.test(String(value || '').trim())
}

function pendingApproval(ticket) {
  const value = String(ticket.human_approval_status || ticket.approval_status || '').trim().toLowerCase()
  return ['pending', 'required', 'blocked', 'pendiente', 'requerida', 'requerido'].includes(value)
}

function hasDeclared(ticket, field) {
  return Object.prototype.hasOwnProperty.call(ticket, field) && !['', 'null'].includes(String(ticket[field] ?? '').trim())
}

function appliedApproval(ticket, approvals) {
  return approvals.find(item => item.proposal_id === ticket.proposal_id && item.applied_ticket_id === ticket.id && item.status === 'applied') || null
}

function dependencyBlockers(ticket, tickets) {
  const byId = new Map(tickets.map(item => [item.id, item]))
  return listValue(ticket.depends_on)
    .filter(id => byId.get(id)?.status !== 'done')
    .map(id => byId.has(id) ? `dependencia pendiente ${id}` : `dependencia inexistente ${id}`)
}

export function advanceBlockers(ticket, row, tickets, approvals = []) {
  const blockers = [...(row?.blockers || [])]
  const required = [
    'proposal_id', 'spec_ref', 'priority_reason', 'domain', 'artifact_type',
    'builder_skills', 'review_skills', 'llm_mode', 'methodology', 'model_class',
    'model_reason', 'build_method', 'build_method_reason', 'required_context',
    'owned_paths', 'shared_paths', 'forbidden_paths', 'gate', 'evidence',
    'commit_strategy',
  ]
  if (String(ticket.schema_version) !== '3') blockers.push('requiere ticket v3')
  for (const field of required) if (!hasDeclared(ticket, field)) blockers.push(`requiere ${field}`)
  if (!['backlog', 'planning', 'dev', 'qa', 'review'].includes(ticket.status)) blockers.push(`status no ejecutable: ${ticket.status || 'n/a'}`)
  if (!['yunque', 'forja'].includes(ticket.build_method)) blockers.push('build_method inválido')
  if (ticket.commit_strategy !== 'atomic_selective') blockers.push('commit_strategy debe ser atomic_selective')
  if (!listValue(ticket.owned_paths).length) blockers.push('owned_paths vacío')
  if (!listValue(ticket.builder_skills).length) blockers.push('constructor no declarado')
  if (!listValue(ticket.review_skills).length) blockers.push('revisor no declarado')
  if (!listValue(ticket.evidence).length) blockers.push('evidence vacío')
  if (truthy(ticket.blocked)) blockers.push('ticket bloqueado')
  if (pendingApproval(ticket)) blockers.push('aprobación humana pendiente')
  blockers.push(...dependencyBlockers(ticket, tickets))
  if (ticket.proposal_id && !appliedApproval(ticket, approvals)) blockers.push('falta recibo approve→apply')
  return [...new Set(blockers)]
}

function executionStage(status) {
  if (status === 'dev') return 'resume_build'
  if (status === 'qa' || status === 'review') return 'verify_and_close'
  return 'build'
}

function commands(ticket, skillRoot) {
  const control = `node "${skillRoot}/scripts/forge-kanban.mjs"`
  return {
    harness_preflight: `node "${skillRoot}/scripts/harness.mjs" list`,
    snapshot_start: `${control} snapshot ${ticket.id} start`,
    gate: ticket.gate,
    snapshot_end: `${control} snapshot ${ticket.id} end`,
    metrics_report: `${control} report ${ticket.id}`,
    continue: `${control} advance --json`,
  }
}

function executionPacket({ ticket, row, approval, baseline, skillRoot, remaining }) {
  return {
    schema_version: 1,
    action: 'execute_ticket',
    generated_at: new Date().toISOString(),
    baseline_commit: baseline || null,
    requires_human_go: true,
    ticket: {
      id: ticket.id, title: ticket.title, status: ticket.status, path: ticket.ticket_relative_path || null,
      priority: row.priority, priority_reason: ticket.priority_reason,
      domain: ticket.domain, artifact_type: ticket.artifact_type,
      stage: executionStage(ticket.status), build_method: ticket.build_method,
      builder_skills: listValue(ticket.builder_skills),
      review_skills: listValue(ticket.review_skills),
      llm_mode: ticket.llm_mode, model_class: ticket.model_class,
      model: ticket.model || row.model, methodology: ticket.methodology,
      required_context: listValue(ticket.required_context),
      owned_paths: listValue(ticket.owned_paths),
      shared_paths: listValue(ticket.shared_paths),
      forbidden_paths: listValue(ticket.forbidden_paths),
      gate: ticket.gate, evidence: listValue(ticket.evidence),
      approval: approval ? { approved_by: approval.approved_by, reason: approval.reason, applied_at: approval.applied_at } : null,
    },
    execution: {
      worktree_required: ticket.build_method === 'forja',
      preflight: 'Ejecutar source-command-cerrar antes de la primera escritura; si el checkout está compartido, aislar en worktree.',
      lifecycle: ['planning/backlog → dev después del preflight', 'dev → qa/review después de construir', 'qa/review → done sólo con gate y evidencia verdes'],
      review_rule: 'El constructor no se autoaprueba cuando existe un revisor independiente.',
      close_rule: 'Actualizar el ticket y su evidencia; después commit atómico, staging selectivo, push de rama worker, handoff y limpieza fail-closed por el integrador.',
      commands: commands(ticket, skillRoot),
    },
    remaining_ready_after_selection: remaining,
  }
}

function blockedPacket(rows, tickets, approvals, requestedId) {
  const ticketById = new Map(tickets.map(ticket => [ticket.id, ticket]))
  const blocked = rows.filter(row => row.item_type === 'ticket').map(row => {
    const ticket = ticketById.get(row.id) || {}
    return { id: row.id, title: row.title, blockers: advanceBlockers(ticket, row, tickets, approvals) }
  }).filter(item => item.blockers.length)
  return {
    schema_version: 1, action: requestedId ? 'blocked' : rows.some(row => row.item_type === 'feature') ? 'prepare_tickets' : 'blocked',
    requested_ticket: requestedId || null, blocked,
    next: rows.some(row => row.item_type === 'feature')
      ? 'Ejecutar propose; revisar, approve y apply antes de volver a advance.'
      : 'Completar el contrato o resolver decisiones humanas antes de volver a advance.',
  }
}

export function buildAdvancePlan({ board, tickets, approvals = [], baseline = null, skillRoot = '.', requestedId = null }) {
  const rows = requestedId ? board.rows.filter(row => row.id === requestedId) : board.rows
  if (requestedId && !rows.length) return { schema_version: 1, action: 'blocked', requested_ticket: requestedId, blocked: [{ id: requestedId, blockers: ['ticket no encontrado'] }] }
  if (!rows.length) return { schema_version: 1, action: 'complete', message: 'No hay tickets ni features pendientes.' }
  const ticketById = new Map(tickets.map(ticket => [ticket.id, ticket]))
  const candidates = rows.filter(row => row.item_type === 'ticket').map((row, index) => {
    const ticket = ticketById.get(row.id) || {}
    return { row, ticket, index, blockers: advanceBlockers(ticket, row, tickets, approvals) }
  }).filter(item => !item.blockers.length)
  candidates.sort((a, b) => (PRIORITY_ORDER[a.row.priority] ?? 9) - (PRIORITY_ORDER[b.row.priority] ?? 9)
    || (STAGE_ORDER[a.ticket.status] ?? 9) - (STAGE_ORDER[b.ticket.status] ?? 9) || a.index - b.index)
  if (!candidates.length) return blockedPacket(rows, tickets, approvals, requestedId)
  const selected = candidates[0]
  const approval = appliedApproval(selected.ticket, approvals)
  return executionPacket({ ticket: selected.ticket, row: selected.row, approval, baseline, skillRoot, remaining: candidates.length - 1 })
}

export function renderAdvanceConsole(plan) {
  if (plan.action === 'complete') return `✓ ${plan.message}`
  if (plan.action !== 'execute_ticket') {
    const details = (plan.blocked || []).map(item => `- ${item.id}: ${item.blockers.join(', ')}`).join('\n')
    return `BLOQUEADO — ${plan.action}\n${details}${plan.next ? `\n\nSiguiente: ${plan.next}` : ''}`
  }
  const ticket = plan.ticket
  return [
    `SIGUIENTE TICKET — ${ticket.id}: ${ticket.title}`,
    `Prioridad: ${ticket.priority} · Etapa: ${ticket.stage} · Motor: ${ticket.build_method}`,
    `Constructor: ${ticket.builder_skills.join(', ')} · Revisor: ${ticket.review_skills.join(', ')}`,
    `LLM: ${ticket.llm_mode} · Modelo: ${ticket.model || ticket.model_class} · Metodología: ${ticket.methodology}`,
    `Gate: ${ticket.gate}`,
    '', 'Requiere GO humano antes de la primera escritura.',
  ].join('\n')
}
