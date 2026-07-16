import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

function safeTicketDirectory(root, ticketDir) {
  const resolvedRoot = resolve(root); const resolvedTicketDir = resolve(ticketDir)
  const rel = relative(resolvedRoot, resolvedTicketDir)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..') throw new Error('ticket_dir debe permanecer dentro del repositorio')
  return resolvedTicketDir
}

function approvalPath(reportDir) {
  return join(reportDir, 'ticket-approvals.json')
}

function proposalPath(reportDir) {
  return join(reportDir, 'ticket-proposals.json')
}

function proposalFromBundle(bundle, proposalId) {
  return bundle?.proposals?.find(item => item.proposal_id === proposalId) || null
}

export function approveProposal({ reportDir, proposalId, approver, reason, baseline, currentProposals, now = new Date().toISOString() }) {
  if (!/^FKP-[A-F0-9]{8}$/.test(proposalId || '')) throw new Error('proposal_id inválido')
  if (!approver?.trim()) throw new Error('approve requiere --by')
  if (!reason?.trim()) throw new Error('approve requiere --reason')
  const bundle = readJson(proposalPath(reportDir))
  if (!bundle) throw new Error('Falta ticket-proposals.json; ejecuta propose primero')
  if (bundle.baseline !== baseline) throw new Error('Las propuestas pertenecen a otro baseline; ejecuta propose de nuevo')
  const reported = proposalFromBundle(bundle, proposalId)
  const current = currentProposals.find(item => item.proposal_id === proposalId)
  if (!reported || !current) throw new Error(`Propuesta no encontrada: ${proposalId}`)
  if (reported.proposal_hash !== current.proposal_hash) throw new Error('La propuesta cambió desde propose; regenera antes de aprobar')
  if (!current.eligible_for_ticket || current.kind === 'human_decision') throw new Error(`Propuesta no elegible: ${current.blockers.join(', ') || current.kind}`)
  const path = approvalPath(reportDir)
  const manifest = readJson(path, { schema_version: 1, approvals: [] })
  const existing = manifest.approvals.find(item => item.proposal_id === proposalId && item.proposal_hash === current.proposal_hash)
  if (existing) return { path, approval: existing, already_approved: true }
  const approval = {
    proposal_id: proposalId, proposal_hash: current.proposal_hash, baseline,
    approved_at: now, approved_by: approver.trim(), reason: reason.trim(),
    status: 'approved', applied_ticket_id: null, applied_at: null,
  }
  manifest.approvals.push(approval); atomicJson(path, manifest)
  return { path, approval, already_approved: false }
}

function nextTicketId(ticketDir) {
  const numbers = existsSync(ticketDir) ? readdirSync(ticketDir).map(name => name.match(/^T-(\d+)\.md$/i)?.[1]).filter(Boolean).map(Number) : []
  return `T-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function yamlString(value) {
  return JSON.stringify(value ?? '')
}

function findExistingTicket(ticketDir, proposalId) {
  if (!existsSync(ticketDir)) return null
  for (const name of readdirSync(ticketDir).filter(item => /^T-\d+\.md$/i.test(item))) {
    const raw = readFileSync(join(ticketDir, name), 'utf8')
    if (new RegExp(`^proposal_id:\\s*${proposalId}$`, 'm').test(raw)) return name.replace(/\.md$/i, '')
  }
  return null
}

function renderTicket(proposal, ticketId, today) {
  const route = proposal.route
  const evidence = list(route?.evidence).join(', ')
  const criteria = list(proposal.acceptance_criteria)
  const lines = [
    '---', 'schema_version: 3', `id: ${ticketId}`, `proposal_id: ${proposal.proposal_id}`,
    `kind: ${proposal.kind === 'reconcile_contradiction' ? 'bug' : 'story'}`,
    `title: ${yamlString(proposal.title)}`, `pts: ${proposal.task_effort}`,
    `priority: ${proposal.priority}`, `priority_reason: ${yamlString(proposal.priority_reason)}`,
    'status: planning', 'sprint: null', 'blocked: false', `created: ${today}`, `updated: ${today}`,
    `depends_on: ${proposal.tickets.length ? proposal.tickets.join(', ') : 'null'}`,
    `spec_ref: ${yamlString(proposal.source)}`, `domain: ${yamlString(proposal.domain)}`,
    `artifact_type: ${yamlString(proposal.artifact_type)}`, `risk_tags: ${yamlString(list(proposal.risk_tags).join(', ') || 'none')}`,
    `builder_skills: ${yamlString(list(route.builder_skills).join(', '))}`,
    `review_skills: ${yamlString(list(route.review_skills).join(', '))}`,
    'required_context: "AGENTS.md, spec_ref"', `owned_paths: ${yamlString(list(proposal.owned_paths).join(', '))}`,
    `shared_paths: ${yamlString(list(proposal.shared_paths).join(', ') || 'none')}`,
    `forbidden_paths: ${yamlString(list(proposal.forbidden_paths).join(', ') || '.env*')}`,
    `complexity: ${proposal.priority === 'red' ? 'high' : 'medium'}`,
    `model_class: ${proposal.model_class}`, `model: ${yamlString(proposal.model)}`,
    `model_reason: ${yamlString(`Clase ${proposal.model_class} resuelta desde config para prioridad ${proposal.priority}`)}`,
    `task_effort: ${proposal.task_effort}`, `reasoning_effort: ${proposal.reasoning_effort === null ? 'null' : proposal.reasoning_effort}`,
    `build_method: ${proposal.build_method}`, `build_method_reason: ${yamlString(proposal.build_method === 'forja' ? 'Rutas declaradas para ejecución aislada' : 'Ejecución conservadora sobre rutas coordinadas')}`,
    `gate: ${yamlString(proposal.gate)}`, `evidence: ${yamlString(evidence)}`, 'commit_strategy: atomic_selective',
    '---', '', `## ${proposal.title}`, '', '**Criterios de aceptación:**', ...criteria.map(item => `- [ ] ${item}`), '',
  ]
  return lines.join('\n')
}

export function applyApprovedProposal({ root, config, reportDir, proposalId, baseline, currentProposals, now = new Date().toISOString() }) {
  const approvalsFile = approvalPath(reportDir); const manifest = readJson(approvalsFile)
  if (!manifest) throw new Error('Falta ticket-approvals.json; aprueba la propuesta primero')
  const proposal = currentProposals.find(item => item.proposal_id === proposalId)
  if (!proposal) throw new Error(`Propuesta actual no encontrada: ${proposalId}`)
  const approval = manifest.approvals.find(item => item.proposal_id === proposalId && item.proposal_hash === proposal.proposal_hash)
  if (!approval || !['approved', 'applied'].includes(approval.status)) throw new Error('No existe aprobación vigente para esta propuesta')
  if (approval.baseline !== baseline) throw new Error('El baseline cambió desde la aprobación; vuelve a ejecutar propose y approve')
  if (!proposal.eligible_for_ticket || proposal.kind === 'human_decision') throw new Error('La propuesta ya no es elegible')
  const ticketDir = safeTicketDirectory(root, config.ticket_dir_abs)
  const existing = findExistingTicket(ticketDir, proposalId)
  if (existing) {
    if (approval.status !== 'applied' || approval.applied_ticket_id !== existing) {
      approval.status = 'applied'; approval.applied_ticket_id = existing; approval.applied_at ||= now
      atomicJson(approvalsFile, manifest)
    }
    return { ticket_id: existing, already_applied: true, path: join(ticketDir, `${existing}.md`) }
  }
  mkdirSync(ticketDir, { recursive: true })
  const ticketId = nextTicketId(ticketDir); const path = join(ticketDir, `${ticketId}.md`)
  writeFileSync(path, renderTicket(proposal, ticketId, now.slice(0, 10)), { encoding: 'utf8', flag: 'wx' })
  approval.status = 'applied'; approval.applied_ticket_id = ticketId; approval.applied_at = now
  atomicJson(approvalsFile, manifest)
  return { ticket_id: ticketId, already_applied: false, path }
}
