import { createHash } from 'node:crypto'

function stableId(feature) {
  const key = `${feature.spec}|${feature.feature_id || feature.title}`
  return `FKP-${createHash('sha1').update(key).digest('hex').slice(0, 8).toUpperCase()}`
}

function kindOf(feature) {
  if (feature.classification === 'blocked') return 'human_decision'
  if (feature.classification === 'contradiction') return 'reconcile_contradiction'
  if (feature.classification === 'done_without_evidence') return 'verification_ticket'
  return 'implementation_ticket'
}

function priorityOf(feature) {
  if (['blocked', 'contradiction'].includes(feature.classification)) return 'red'
  return 'yellow'
}

function modelClassOf(priority) {
  return priority === 'red' ? 'sol' : 'terra'
}

function fingerprint(proposal) {
  const stable = {
    proposal_id: proposal.proposal_id, kind: proposal.kind, title: proposal.title,
    source: proposal.source, source_hash: proposal.source_hash, feature_id: proposal.feature_id,
    classification: proposal.classification, priority: proposal.priority,
    priority_reason: proposal.priority_reason, domain: proposal.domain,
    artifact_type: proposal.artifact_type, route: proposal.route,
    owned_paths: proposal.owned_paths, shared_paths: proposal.shared_paths,
    forbidden_paths: proposal.forbidden_paths, gate: proposal.gate,
    acceptance_criteria: proposal.acceptance_criteria,
    risk_tags: proposal.risk_tags, task_effort: proposal.task_effort,
    build_method: proposal.build_method, model_class: proposal.model_class,
    model: proposal.model, reasoning_effort: proposal.reasoning_effort,
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

export function buildProposals(result, routeDomain = null, config = {}) {
  return result.actionable.map(feature => {
    const kind = kindOf(feature); const domain = feature.contract.domain || null
    const route = domain && routeDomain ? routeDomain(domain) : null
    const priority = feature.contract.priority || priorityOf(feature)
    const modelClass = modelClassOf(priority)
    const modelConfig = config.models?.[modelClass] || {}
    const buildMethod = feature.contract.build_method || (route?.build_method === 'forja' ? 'forja' : 'yunque')
    const missing = []
    if (!domain) missing.push('domain')
    if (!feature.contract.artifact_type) missing.push('artifact_type')
    if (!feature.contract.owned_paths.length) missing.push('owned_paths')
    if (!feature.contract.gate) missing.push('gate')
    if (!feature.contract.acceptance_criteria.length) missing.push('acceptance_criteria')
    if (!modelConfig.model) missing.push(`model:${modelClass}`)
    if (kind === 'implementation_ticket' && !feature.ticket_refs.length && !feature.feature_id) missing.push('feature_id_or_ticket_ref')
    if (domain && (!route || route.blocked)) missing.push(`capability:${domain}`)
    const proposal = {
      proposal_id: stableId(feature), kind, eligible_for_ticket: kind !== 'human_decision' && missing.length === 0,
      title: feature.title, source: feature.spec, source_hash: feature.source_hash, feature_id: feature.feature_id,
      classification: feature.classification, priority,
      priority_reason: feature.reason, domain, artifact_type: feature.contract.artifact_type || null,
      tickets: feature.ticket_refs, human_decisions: feature.contract.human_decisions,
      missing_evidence: feature.evidence.missing.map(item => `${item.kind}:${item.pattern}`),
      route: route && !route.blocked ? route : null, blockers: missing,
      owned_paths: feature.contract.owned_paths,
      shared_paths: feature.contract.shared_paths,
      forbidden_paths: feature.contract.forbidden_paths,
      gate: feature.contract.gate,
      acceptance_criteria: feature.contract.acceptance_criteria,
      risk_tags: feature.contract.risk_tags,
      task_effort: Number(feature.contract.task_effort) || (priority === 'red' ? 8 : 5),
      build_method: buildMethod,
      model_class: modelClass,
      model: modelConfig.model || null,
      reasoning_effort: modelConfig.reasoning_effort ?? null,
      approval: 'pending',
    }
    proposal.proposal_hash = fingerprint(proposal)
    return proposal
  })
}

export function renderProposalMarkdown(proposals, metadata = {}) {
  const icon = proposal => proposal.kind === 'human_decision' || proposal.classification === 'contradiction' ? '🔴' : '🟡'
  const lines = ['# Forge Kanban — Propuestas', '', `- Fecha: ${metadata.generatedAt || new Date().toISOString()}`, `- Baseline: ${metadata.baseline || 'n/a'}`, `- Propuestas: ${proposals.length}`, '', '> Este archivo es read-only respecto al backlog. Ninguna propuesta crea tickets sin aprobación explícita.', '', '| Estado | ID | Tipo | Propuesta | Prioridad | Elegible | Bloqueos |', '|:---:|---|---|---|---|:---:|---|']
  for (const proposal of proposals) lines.push(`| ${icon(proposal)} | ${proposal.proposal_id} | ${proposal.kind} | ${proposal.title.replaceAll('|', '\\|')} | ${proposal.priority} | ${proposal.eligible_for_ticket ? 'sí' : 'no'} | ${(proposal.blockers.join(', ') || '—').replaceAll('|', '\\|')} |`)
  lines.push('', '## Detalle', '')
  for (const proposal of proposals) {
    lines.push(`### ${icon(proposal)} ${proposal.proposal_id} · ${proposal.title}`, '', `- Fuente: \`${proposal.source}\``, `- Acción: ${proposal.kind}`, `- Razón: ${proposal.priority_reason}`, `- Dominio: ${proposal.domain || 'pendiente'}`, `- Artefacto: ${proposal.artifact_type || 'pendiente'}`, `- Aprobación: **${proposal.approval}**`, `- Elegible para ticket: **${proposal.eligible_for_ticket ? 'sí' : 'no'}**`)
    if (proposal.blockers.length) lines.push(`- Bloqueos: ${proposal.blockers.join(', ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

export function renderProposalConsole(proposals) {
  const decisions = proposals.filter(item => item.kind === 'human_decision').length
  const eligible = proposals.filter(item => item.eligible_for_ticket).length
  const blocked = proposals.length - eligible
  const lines = ['PROPUESTAS FORGE KANBAN', `🔴 Decisiones humanas: ${decisions}`, `🟡 Tickets elegibles: ${eligible}`, `⚫ Requieren completar contrato: ${blocked - decisions}`, '']
  for (const proposal of proposals) lines.push(`${proposal.eligible_for_ticket ? '🟡' : proposal.kind === 'human_decision' ? '🔴' : '⚫'} ${proposal.proposal_id} · ${proposal.title}\n   ${proposal.kind} · ${proposal.blockers.join(', ') || 'lista para aprobación'}`)
  lines.push('', 'Ningún ticket fue creado. Revisa y aprueba las propuestas antes de aplicar.')
  return lines.join('\n')
}
