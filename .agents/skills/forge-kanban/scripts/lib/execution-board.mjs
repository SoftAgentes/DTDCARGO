function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value || value === 'null') return []
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

function normalized(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
}

function canonicalPriority(value) {
  const aliases = { critica: 'red', alta: 'red', media: 'yellow', baja: 'green', nice_to_have: 'nice_to_have' }
  return ['red', 'yellow', 'green', 'nice_to_have'].includes(value) ? value : aliases[value] || 'unknown'
}

function routeFor(domain, routeDomain) {
  if (!domain || !routeDomain) return null
  const route = routeDomain(domain)
  return route?.blocked ? null : route
}

function inferDomain({ title, source, artifactType, itemType, status }) {
  const text = `${title || ''} ${source || ''} ${artifactType || ''}`.toLowerCase()
  const rules = [
    [/(skill|forge|kanban)/, 'skill_engineering', 'skill o tooling de agentes'],
    [/(security|seguridad|auditor|release)/, 'release_audit', 'auditoría o seguridad'],
    [/(stripe|polar|checkout|webhook|\bpago)/, 'payments', 'pagos o webhooks'],
    [/(correo|email|resend)/, 'transactional_email', 'correo transaccional'],
    [/(pwa|mobile|móvil|notificaci)/, 'mobile_pwa', 'experiencia móvil o PWA'],
    [/(cinematic|cinemát|\b3d\b|motion)/, 'cinematic_web', 'experiencia web cinemática'],
    [/(imagen|image|asset visual)/, 'image_asset', 'activo de imagen'],
    [/(branding|identidad de marca|arquitectura de marca)/, 'brand_identity', 'identidad de marca'],
    [/(\bux\b|\bui\b|diseño|design|navegaci|landing|web pública|web replica)/, 'product_design', 'producto o diseño web'],
    [/(supabase|\brls\b|database|base de datos|migraci)/, 'database', 'datos o migraciones'],
    [/(blueprint|\bprd\b|\bpdr\b|user stor|research|alcance|tech.spec)/, 'planning', 'artefacto de planificación'],
    [/(código|\bcode\b|implementar|módulo|\bapi\b|calendario|leads|garantía|contrato|factur)/, 'general_code', 'construcción de producto'],
  ]
  for (const [pattern, domain, reason] of rules) if (pattern.test(text)) return { domain, reason }
  if (itemType === 'ticket' || ['partial', 'pending', 'contradiction'].includes(status)) return { domain: 'general_code', reason: 'fallback conservador para trabajo de implementación' }
  return { domain: 'planning', reason: 'documento pendiente de clasificación' }
}

function resolveDomain(declared, context) {
  if (declared && declared !== 'null') return { domain: declared, source: 'declared', reason: 'declarado en contrato' }
  return { ...inferDomain(context), source: 'inferred' }
}

function modelFor({ ticket = {}, priority, llmMode, route, config }) {
  if (llmMode === 'none') return { modelClass: 'n/a', model: 'n/a' }
  const modelClass = ticket.model_class || (priority === 'red' ? 'sol' : 'terra')
  return { modelClass, model: ticket.model || config.models?.[modelClass]?.model || null }
}

function llmLabel(mode) {
  return { required: 'Sí', optional: 'Opcional', none: 'No', unknown: 'Por definir' }[mode] || 'Por definir'
}

function priorityMeta(priority) {
  return {
    red: ['🔴', 'Rojo', 0], yellow: ['🟡', 'Amarillo', 1],
    green: ['🟢', 'Verde', 3], nice_to_have: ['✨', 'Nice to have', 4],
    unknown: ['⚫', 'Por clasificar', 2],
  }[priority] || ['⚫', 'Por clasificar', 2]
}

function featureForTicket(ticket, features) {
  const specRef = normalized(ticket.spec_ref)
  return features.find(feature => feature.ticket_refs.includes(ticket.id) || (specRef && (normalized(feature.spec).startsWith(specRef) || specRef.startsWith(normalized(feature.spec).split('#')[0])))) || null
}

function ticketRow(ticket, features, routeDomain, config) {
  const feature = featureForTicket(ticket, features)
  const domainResolution = resolveDomain(ticket.domain || feature?.contract.domain, { title: ticket.title || feature?.title, source: ticket.spec_ref || feature?.spec, artifactType: ticket.artifact_type || feature?.contract.artifact_type, itemType: 'ticket', status: ticket.status })
  const domain = domainResolution.domain
  const route = routeFor(domain, routeDomain)
  const priority = canonicalPriority(ticket.priority)
  const builders = list(ticket.builder_skills).length ? list(ticket.builder_skills) : list(route?.builder_skills)
  const reviewers = list(ticket.review_skills).length ? list(ticket.review_skills) : list(route?.review_skills)
  const llmMode = ticket.llm_mode || route?.llm_mode || 'unknown'
  const methodology = ticket.methodology || route?.methodology || null
  const buildMethod = ticket.build_method || (route?.build_method === 'forja' ? 'forja' : route ? 'yunque' : null)
  const gate = ticket.gate && ticket.gate !== 'null' ? ticket.gate : null
  const model = modelFor({ ticket, priority, llmMode, route, config })
  const blockers = []
  if (domainResolution.source === 'inferred') blockers.push('confirmar domain')
  if (!builders.length) blockers.push('constructor')
  if (!reviewers.length) blockers.push('revisor')
  if (llmMode === 'unknown') blockers.push('llm_mode')
  if (llmMode !== 'none' && !model.model) blockers.push('modelo')
  if (!methodology) blockers.push('metodología')
  if (!buildMethod) blockers.push('motor')
  if (!gate) blockers.push('gate')
  return {
    item_type: 'ticket', id: ticket.id, title: ticket.title || feature?.title || ticket.id,
    source: ticket.spec_ref || feature?.spec || null, status: ticket.status || 'backlog',
    priority, priority_reason: ticket.priority_reason || 'n/a (legacy)', domain, domain_source: domainResolution.source, domain_reason: domainResolution.reason,
    artifact_type: ticket.artifact_type || feature?.contract.artifact_type || null,
    build_method: buildMethod, builders, reviewers, llm_mode: llmMode,
    llm_label: llmLabel(llmMode), model_class: model.modelClass, model: model.model,
    methodology, gate, blockers, ready: blockers.length === 0,
    feature_id: feature?.feature_id || null,
  }
}

function featureRow(feature, proposal, routeDomain, config) {
  const domainResolution = resolveDomain(proposal?.domain || feature.contract.domain, { title: feature.title, source: feature.spec, artifactType: proposal?.artifact_type || feature.contract.artifact_type, itemType: 'feature', status: feature.classification })
  const route = proposal?.route || routeFor(domainResolution.domain, routeDomain)
  const priority = proposal ? canonicalPriority(proposal.priority) : 'unknown'
  const llmMode = route?.llm_mode || 'unknown'
  const blockers = proposal?.blockers?.length ? [...proposal.blockers] : []
  if (domainResolution.source === 'inferred') blockers.push('confirmar domain')
  if (!proposal) blockers.push('contrato de feature')
  if (!route?.builder_skills?.length) blockers.push('constructor')
  if (!route?.review_skills?.length) blockers.push('revisor')
  if (llmMode === 'unknown') blockers.push('llm_mode')
  if (!route?.methodology) blockers.push('metodología')
  return {
    item_type: 'feature', id: feature.feature_id || proposal?.proposal_id || 'SIN-ID',
    proposal_id: proposal?.proposal_id || null, title: feature.title, source: feature.spec,
    status: feature.classification, priority, priority_reason: proposal?.priority_reason || feature.reason,
    domain: domainResolution.domain, domain_source: domainResolution.source, domain_reason: domainResolution.reason,
    artifact_type: proposal?.artifact_type || feature.contract.artifact_type || null,
    build_method: proposal?.build_method || (route?.build_method === 'forja' ? 'forja' : route ? 'yunque' : null), builders: list(route?.builder_skills),
    reviewers: list(route?.review_skills), llm_mode: llmMode, llm_label: llmLabel(llmMode),
    model_class: proposal?.model_class || (llmMode === 'none' ? 'n/a' : priority === 'red' ? 'sol' : 'terra'), model: llmMode === 'none' ? 'n/a' : proposal?.model || config.models?.[priority === 'red' ? 'sol' : 'terra']?.model || null,
    methodology: route?.methodology || null, gate: proposal?.gate || null,
    blockers: [...new Set(blockers)], ready: Boolean(proposal?.eligible_for_ticket) && blockers.length === 0,
    feature_id: feature.feature_id || null,
  }
}

export function buildExecutionBoard({ tickets = [], featureResult, proposals = [], routeDomain, config = {} }) {
  const openTickets = tickets.filter(ticket => ticket.status !== 'done')
  const ticketRows = openTickets.map(ticket => ticketRow(ticket, featureResult.features, routeDomain, config))
  const coveredFeatures = new Set()
  for (const ticket of openTickets) {
    const feature = featureForTicket(ticket, featureResult.features)
    if (feature) coveredFeatures.add(feature.spec)
  }
  const proposalBySource = new Map(proposals.map(proposal => [proposal.source, proposal]))
  const pendingFeatures = featureResult.features.filter(feature => !['complete', 'future'].includes(feature.classification))
  const uncoveredFeatures = pendingFeatures.filter(feature => !coveredFeatures.has(feature.spec))
  const featureRows = uncoveredFeatures.map(feature => featureRow(feature, proposalBySource.get(feature.spec), routeDomain, config))
  const rows = [...ticketRows, ...featureRows].sort((a, b) => priorityMeta(a.priority)[2] - priorityMeta(b.priority)[2] || a.id.localeCompare(b.id))
  const summary = {
    open_tickets: ticketRows.length,
    uncovered_features: featureRows.length,
    features_covered_by_tickets: coveredFeatures.size,
    ready: rows.filter(row => row.ready).length,
    needs_definition: rows.filter(row => !row.ready).length,
    llm_required: rows.filter(row => row.llm_mode === 'required').length,
    llm_optional: rows.filter(row => row.llm_mode === 'optional').length,
    llm_none: rows.filter(row => row.llm_mode === 'none').length,
    llm_unknown: rows.filter(row => row.llm_mode === 'unknown').length,
    inferred_routes: rows.filter(row => row.domain_source === 'inferred').length,
  }
  return { summary, rows }
}

function cell(value) {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '—')
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function renderExecutionMarkdown(board, metadata = {}) {
  const lines = [
    '# Forge Kanban — Plan de ejecución', '',
    `- Fecha: ${metadata.generatedAt || new Date().toISOString()}`,
    `- Baseline: ${metadata.baseline || 'n/a'}`,
    `- Tickets abiertos: ${board.summary.open_tickets}`,
    `- Features adicionales: ${board.summary.uncovered_features}`,
    `- Listos: ${board.summary.ready} · Por definir: ${board.summary.needs_definition}`, '',
    '| Prioridad | Preparación | Tipo | ID | Qué se construye | Dominio | Motor | Agente/skill | Revisor | LLM | Modelo | Metodología | Gate | Situación |',
    '|:---:|:---:|---|---|---|---|---|---|---|---|---|---|---|---|',
  ]
  for (const row of board.rows) {
    const [icon, label] = priorityMeta(row.priority)
    lines.push(`| ${icon} ${label} | ${row.ready ? '✅ Lista' : '⚫ Por definir'} | ${cell(row.item_type)} | ${cell(row.id)} | ${cell(row.title)} | ${cell(`${row.domain} (${row.domain_source === 'inferred' ? 'sugerido' : 'declarado'})`)} | ${cell(row.build_method)} | ${cell(row.builders)} | ${cell(row.reviewers)} | ${cell(row.llm_label)} | ${cell(row.model)} | ${cell(row.methodology)} | ${cell(row.gate)} | ${cell(row.blockers.length ? row.blockers.join(', ') : row.status)} |`)
  }
  if (!board.rows.length) lines.push('| — | ✅ | — | — | No hay trabajo pendiente | — | — | — | — | — | — | — | — | — |')
  lines.push('', '> ⚫ significa que faltan decisiones o contrato. Forge Kanban no inventa agente, modelo, motor ni metodología.')
  return lines.join('\n')
}

function html(value) {
  return String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export function renderExecutionHtml(board, metadata = {}) {
  const rows = board.rows.map(row => {
    const [icon, label] = priorityMeta(row.priority)
    return `<tr class="${html(row.priority)} ${row.ready ? 'ready' : 'undefined'}"><td><span class="priority">${icon} ${html(label)}</span></td><td>${row.ready ? '<span class="ready-chip">Lista</span>' : '<span class="undefined-chip">Por definir</span>'}</td><td>${html(row.item_type)}</td><td><code>${html(row.id)}</code></td><td><strong>${html(row.title)}</strong><small>${html(row.source)}</small></td><td>${html(row.domain)}<small>${row.domain_source === 'inferred' ? 'sugerido' : 'declarado'}</small></td><td>${html(row.build_method)}</td><td>${html(row.builders.join(', ') || '—')}</td><td>${html(row.reviewers.join(', ') || '—')}</td><td>${html(row.llm_label)}</td><td>${html(row.model)}</td><td>${html(row.methodology)}</td><td><code>${html(row.gate)}</code></td><td>${html(row.blockers.join(', ') || row.status)}</td></tr>`
  }).join('')
  const s = board.summary
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forge Kanban · Plan de ejecución</title><style>:root{color-scheme:dark;--bg:#111214;--panel:#1a1c20;--line:#30343b;--text:#f5f7fa;--muted:#a7adb7;--red:#ff5d67;--yellow:#f6c945;--green:#47d18c;--black:#0a0a0b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 Inter,Segoe UI,sans-serif}.wrap{max-width:1900px;margin:auto;padding:28px}h1{font-size:28px;margin:0 0 6px}.meta{color:var(--muted);margin-bottom:20px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}.card b{display:block;font-size:26px}.card span{color:var(--muted)}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:var(--panel)}table{border-collapse:collapse;width:100%;min-width:1750px}th,td{padding:12px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}th{position:sticky;top:0;background:#22252a;color:#dfe3e8}tr.red{box-shadow:inset 4px 0 var(--red)}tr.yellow{box-shadow:inset 4px 0 var(--yellow)}tr.green{box-shadow:inset 4px 0 var(--green)}tr.unknown{box-shadow:inset 4px 0 #050505}small{display:block;color:var(--muted);margin-top:4px;max-width:320px}.priority,.ready-chip,.undefined-chip{white-space:nowrap}.ready-chip,.undefined-chip{display:inline-block;padding:3px 8px;border-radius:999px;font-weight:700}.ready-chip{background:#153c2b;color:#82efb6}.undefined-chip{background:#050505;color:#fff;border:1px solid #555}code{white-space:pre-wrap;color:#d9e1ea}.note{color:var(--muted);margin-top:14px}</style></head><body><main class="wrap"><h1>Forge Kanban · Plan de ejecución</h1><div class="meta">Baseline ${html(metadata.baseline || 'n/a')} · ${html(metadata.generatedAt || new Date().toISOString())}</div><section class="summary"><div class="card"><b>${s.open_tickets}</b><span>tickets abiertos</span></div><div class="card"><b>${s.uncovered_features}</b><span>features adicionales</span></div><div class="card"><b>${s.ready}</b><span>listas para construir</span></div><div class="card"><b>${s.needs_definition}</b><span>por definir</span></div><div class="card"><b>${s.llm_required}</b><span>usan LLM</span></div><div class="card"><b>${s.llm_none}</b><span>sin LLM</span></div></section><div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>Preparación</th><th>Tipo</th><th>ID</th><th>Qué se construye</th><th>Dominio</th><th>Motor</th><th>Agente/skill</th><th>Revisor</th><th>LLM</th><th>Modelo</th><th>Metodología</th><th>Gate</th><th>Situación</th></tr></thead><tbody>${rows || '<tr><td colspan="14">No hay trabajo pendiente</td></tr>'}</tbody></table></div><p class="note">Los dominios sugeridos orientan el plan, pero deben confirmarse antes de aplicar. ⚫ bloquea la construcción.</p></main></body></html>`
}
