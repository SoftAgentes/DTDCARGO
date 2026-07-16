import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const DEFAULT_ROOTS = ['specs', 'docs/specs', 'docs/plan', 'docs/blueprints']
const EXCLUDED_PARTS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'handoffs', 'uploads'])

function normalized(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '')
}

function walk(root, directory, output = []) {
  if (!existsSync(directory)) return output
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const rel = normalized(relative(root, path))
    if (rel.split('/').some(part => EXCLUDED_PARTS.has(part))) continue
    const stat = statSync(path)
    if (stat.isDirectory()) walk(root, path, output)
    else if (['.md', '.mdx'].includes(extname(name).toLowerCase())) output.push(path)
  }
  return output
}

function titleOf(raw, path) {
  return raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.split(/[\\/]/).at(-1).replace(/\.(md|mdx)$/i, '')
}

function explicitStatus(raw) {
  const match = raw.match(/^(?:status|estado):\s*["']?([^\r\n"']+)/im)
  if (!match) return null
  const value = match[1].trim().toLowerCase()
  if (/^(done|complete|completed|terminado|completo|cerrado)/.test(value)) return 'done'
  if (/^(dev|doing|in.progress|en.progreso|partial|parcial)/.test(value)) return 'partial'
  if (/^(backlog|pending|pendiente|planned|planificado|todo)/.test(value)) return 'pending'
  if (/^(blocked|bloqueado)/.test(value)) return 'blocked'
  return 'unknown'
}

function ticketRefs(raw, path) {
  const values = new Set()
  for (const match of `${path}\n${raw}`.matchAll(/\bT-\d{3,}\b/gi)) values.add(match[0].toUpperCase())
  return [...values]
}

function signals(raw) {
  const unchecked = [...raw.matchAll(/^\s*[-*]\s+\[\s\]\s+(.+)$/gm)].map(match => match[1].trim())
  const checked = [...raw.matchAll(/^\s*[-*]\s+\[[xX]\]\s+(.+)$/gm)].map(match => match[1].trim())
  const pendingMarkers = [...raw.matchAll(/^#{1,6}\s+.*(?:pendiente|por hacer|siguiente fase|future|backlog).*$/gim)].map(match => match[0].replace(/^#+\s*/, '').trim())
  const blockers = [...raw.matchAll(/^\s*[-*]?\s*(?:bloqueador|blocker|decisión pendiente|decision pending)\s*[:—-]\s*(.+)$/gim)].map(match => match[1].trim())
  const evidenceMarkers = [...raw.matchAll(/(?:test|prueba|evidencia|screenshot|captura|migraci[oó]n|implementad[oa]|verificad[oa])/gi)].length
  return { unchecked, checked, pendingMarkers, blockers, evidenceMarkers }
}

function linkedTicketsFor(specPath, refs, tickets) {
  const spec = normalized(specPath).toLowerCase()
  return tickets.filter(ticket => {
    const ref = normalized(ticket.spec_ref || '').toLowerCase()
    return refs.includes(ticket.id) || (ref && ref !== 'null' && (ref === spec || spec.endsWith(ref) || ref.endsWith(spec)))
  })
}

function classify({ status, signal, linked }) {
  const ticketStates = linked.map(ticket => ticket.status)
  const hasOpenTicket = ticketStates.some(value => value && value !== 'done')
  const allTicketsDone = linked.length > 0 && ticketStates.every(value => value === 'done')
  const hasPending = signal.unchecked.length > 0 || signal.pendingMarkers.length > 0 || signal.blockers.length > 0
  const hasCompleted = signal.checked.length > 0 || allTicketsDone || signal.evidenceMarkers > 0

  if (status === 'blocked' || signal.blockers.length) return ['blocked', 'high', 'bloqueo explícito']
  if (status === 'done' && hasPending) return ['contradiction', 'high', 'declarada terminada pero conserva pendientes explícitos']
  if (allTicketsDone && hasPending) return ['contradiction', 'high', 'todos los tickets enlazados están done pero la spec conserva pendientes']
  if (status === 'done' && !linked.length && signal.evidenceMarkers === 0) return ['done_without_evidence', 'medium', 'declarada terminada sin ticket ni evidencia reconocible']
  if (hasOpenTicket || (hasPending && hasCompleted)) return ['partial', 'high', hasOpenTicket ? 'ticket enlazado aún abierto' : 'mezcla evidencia completada y pendientes']
  if (status === 'pending' || (hasPending && !hasCompleted)) return ['pending', 'high', 'pendientes explícitos sin evidencia de cierre']
  if (status === 'partial') return ['partial', 'high', 'estado parcial explícito']
  if (status === 'done' || allTicketsDone) return ['complete', 'high', status === 'done' ? 'estado terminado explícito' : 'todos los tickets enlazados están done']
  return ['review_needed', 'low', 'sin estado explícito suficiente para clasificar']
}

export function reconcileFeatures({ root = process.cwd(), config, tickets = [] }) {
  const configuredRoots = config?.reconcile?.roots || config?.reconcile_roots || DEFAULT_ROOTS
  const roots = Array.isArray(configuredRoots) ? configuredRoots : DEFAULT_ROOTS
  const configuredNames = config?.reconcile?.file_names
  const fileNames = Array.isArray(configuredNames) ? new Set(configuredNames.map(name => name.toLowerCase())) : null
  const discovered = [...new Set(roots.flatMap(item => walk(root, resolve(root, item))))]
  const files = discovered.filter(path => !fileNames || fileNames.has(path.split(/[\\/]/).at(-1).toLowerCase()))
  const features = files.map(path => {
    const raw = readFileSync(path, 'utf8')
    const rel = normalized(relative(root, path)); const refs = ticketRefs(raw, rel)
    const linked = linkedTicketsFor(rel, refs, tickets); const signal = signals(raw); const status = explicitStatus(raw)
    const [classification, confidence, reason] = classify({ status, signal, linked })
    return {
      title: titleOf(raw, rel), spec: rel, classification, confidence, reason,
      explicit_status: status, ticket_refs: linked.map(ticket => ticket.id),
      unchecked_items: signal.unchecked, pending_sections: signal.pendingMarkers,
      blockers: signal.blockers, evidence_markers: signal.evidenceMarkers,
    }
  })
  const categories = ['complete', 'partial', 'pending', 'blocked', 'contradiction', 'done_without_evidence', 'review_needed']
  const summary = Object.fromEntries(categories.map(category => [category, features.filter(feature => feature.classification === category).length]))
  const actionable = features.filter(feature => ['partial', 'pending', 'blocked', 'contradiction', 'done_without_evidence'].includes(feature.classification))
  return { roots, file_names: fileNames ? [...fileNames] : null, scanned: features.length, summary, actionable, features }
}

export function renderFeatureReport(result, metadata = {}) {
  const icon = { complete: '🟢', partial: '🟡', pending: '🟡', blocked: '🔴', contradiction: '🔴', done_without_evidence: '🟡', review_needed: '⚫' }
  const lines = [
    '# Forge Kanban — Feature Reconciliation Report', '',
    `- Fecha: ${metadata.generatedAt || new Date().toISOString()}`,
    `- Baseline: ${metadata.baseline || 'n/a'}`,
    `- Documentos analizados: ${result.scanned}`,
    `- Raíces: ${result.roots.join(', ')}`, '',
    '## Semáforo', '',
    '> 🔴 acción o contradicción · 🟡 pendiente/parcial · ⚫ revisión humana · 🟢 completo', '',
    '| Estado | Clasificación | Cantidad |', '|:---:|---|---:|',
    ...Object.entries(result.summary).map(([key, value]) => `| ${icon[key]} | ${key} | ${value} |`), '',
    '## Trabajo vivo y contradicciones', '',
  ]
  if (!result.actionable.length) lines.push('- No se detectó trabajo vivo con evidencia explícita.')
  for (const feature of result.actionable) {
    lines.push(`### ${icon[feature.classification]} ${feature.title}`, '', `- Clasificación: **${feature.classification}** (${feature.confidence})`, `- Spec: \`${feature.spec}\``, `- Razón: ${feature.reason}`, `- Tickets: ${feature.ticket_refs.join(', ') || 'ninguno'}`)
    if (feature.unchecked_items.length) lines.push('- Pendientes:', ...feature.unchecked_items.map(item => `  - [ ] ${item}`))
    if (feature.pending_sections.length) lines.push(`- Secciones pendientes: ${feature.pending_sections.join('; ')}`)
    if (feature.blockers.length) lines.push(`- Bloqueadores: ${feature.blockers.join('; ')}`)
    lines.push('')
  }
  lines.push('## Revisión manual', '', '> `review_needed` no se convierte automáticamente en ticket. Requiere evidencia o decisión humana.', '')
  for (const feature of result.features.filter(item => item.classification === 'review_needed')) lines.push(`- \`${feature.spec}\` — ${feature.title}`)
  lines.push('', '> Este informe no crea tickets ni modifica specs. El histórico desconocido permanece como `n/a (trabajo anterior a Forge Kanban)`.', '')
  return lines.join('\n')
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export function renderFeatureHtml(result, metadata = {}) {
  const presentation = {
    blocked: ['🔴', 'Acción requerida', 'red'], contradiction: ['🔴', 'Contradicción', 'red'],
    partial: ['🟡', 'Parcial', 'yellow'], pending: ['🟡', 'Pendiente', 'yellow'],
    done_without_evidence: ['🟡', 'Sin evidencia', 'yellow'], review_needed: ['⚫', 'Revisión humana', 'black'],
    complete: ['🟢', 'Completo', 'green'],
  }
  const order = ['blocked', 'contradiction', 'partial', 'pending', 'done_without_evidence', 'review_needed', 'complete']
  const summary = order.map(key => {
    const [, label, color] = presentation[key]
    return `<article class="metric ${color}"><i class="signal ${color}" aria-label="${label}"></i><strong>${result.summary[key]}</strong><small>${label}</small></article>`
  }).join('')
  const cards = order.flatMap(key => result.features.filter(feature => feature.classification === key)).map(feature => {
    const [, label, color] = presentation[feature.classification]
    const items = feature.unchecked_items.slice(0, 5).map(item => `<li>${escapeHtml(item)}</li>`).join('')
    return `<article class="card ${color}"><header><i class="signal ${color}" aria-label="${label}"></i><div><small>${label} · confianza ${escapeHtml(feature.confidence)}</small><h2>${escapeHtml(feature.title)}</h2></div></header><p>${escapeHtml(feature.reason)}</p><dl><dt>Spec</dt><dd>${escapeHtml(feature.spec)}</dd><dt>Tickets</dt><dd>${escapeHtml(feature.ticket_refs.join(', ') || 'ninguno')}</dd></dl>${items ? `<h3>Pendientes detectados</h3><ul>${items}</ul>` : ''}</article>`
  }).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forge Kanban · Features</title><style>
  :root{color-scheme:dark;--bg:#111214;--panel:#1b1d20;--text:#f4f4f5;--muted:#a1a1aa;--line:#303238;--red:#ef4444;--yellow:#facc15;--green:#22c55e;--black:#050506}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}.wrap{max-width:1180px;margin:auto;padding:42px 24px}h1{font-size:clamp(28px,5vw,48px);margin:0}.lead{color:var(--muted);max-width:760px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:12px;margin:28px 0}.metric,.card{background:var(--panel);border:1px solid var(--line);border-radius:16px}.metric{padding:16px;display:grid;grid-template-columns:auto 1fr;gap:0 10px}.metric strong{font-size:25px}.metric small{grid-column:2;color:var(--muted)}.signal{width:15px;height:15px;border-radius:999px;display:inline-block;margin-top:8px;box-shadow:0 0 0 2px rgba(255,255,255,.08)}.signal.red{background:var(--red)}.signal.yellow{background:var(--yellow)}.signal.green{background:var(--green)}.signal.black{background:var(--black);border:1px solid #71717a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.card{padding:20px;border-top:4px solid var(--line)}.card.red{border-top-color:var(--red)}.card.yellow{border-top-color:var(--yellow)}.card.green{border-top-color:var(--green)}.card.black{border-top-color:#71717a}.card header{display:flex;gap:12px}.card h2{font-size:18px;margin:2px 0 8px}.card small,.card p,dt{color:var(--muted)}dl{display:grid;grid-template-columns:58px 1fr;gap:4px 8px}dd{margin:0;word-break:break-word}ul{padding-left:20px}.stamp{margin-top:28px;color:var(--muted);font-size:12px}</style></head><body><main class="wrap"><header><h1>Inventario de features</h1><p class="lead">Cruce conservador de specs, tickets y evidencia. El negro significa que hace falta revisión humana; no se inventa un estado.</p></header><section class="metrics">${summary}</section><section class="grid">${cards}</section><p class="stamp">Baseline ${escapeHtml(metadata.baseline || 'n/a')} · ${escapeHtml(metadata.generatedAt || new Date().toISOString())} · ${result.scanned} documentos</p></main></body></html>`
}

export function renderFeatureConsole(result) {
  const icon = { complete: '🟢', partial: '🟡', pending: '🟡', blocked: '🔴', contradiction: '🔴', done_without_evidence: '🟡', review_needed: '⚫' }
  const lines = [
    '╭────────────────────────────────────────────────────────────╮',
    '│                 INVENTARIO DE FEATURES                     │',
    '╰────────────────────────────────────────────────────────────╯',
    '',
    `🔴 Acción requerida   ${String(result.summary.blocked + result.summary.contradiction).padStart(3)}`,
    `🟡 Pendiente/parcial ${String(result.summary.partial + result.summary.pending + result.summary.done_without_evidence).padStart(3)}`,
    `⚫ Revisión humana    ${String(result.summary.review_needed).padStart(3)}`,
    `🟢 Completo           ${String(result.summary.complete).padStart(3)}`,
    '',
    'PRÓXIMAS DECISIONES',
  ]
  const priority = { blocked: 0, contradiction: 1, partial: 2, pending: 3, done_without_evidence: 4 }
  const actionable = [...result.actionable].sort((a, b) => priority[a.classification] - priority[b.classification])
  if (!actionable.length) lines.push('  🟢 No hay trabajo vivo detectado con evidencia explícita.')
  actionable.forEach((feature, index) => {
    lines.push(`${String(index + 1).padStart(2)}. ${icon[feature.classification]} ${feature.title}`)
    lines.push(`    ${feature.classification} · ${feature.reason}`)
    lines.push(`    ${feature.spec}${feature.ticket_refs.length ? ` · ${feature.ticket_refs.join(', ')}` : ''}`)
  })
  lines.push('', `⚫ ${result.summary.review_needed} documentos quedan en revisión humana y no generan tickets automáticamente.`, 'Abre el dashboard HTML para ver todas las tarjetas y evidencias.')
  return lines.join('\n')
}
