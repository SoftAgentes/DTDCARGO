#!/usr/bin/env node
// Métricas automáticas por proyecto para la bitácora Forge Kanban.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { resolveProjectIdentity } from './project-identity.mjs'

const IDENTITY = resolveProjectIdentity(process.cwd())
const CLAUDE_PROJECTS = join(homedir(), '.claude', 'projects')
const CODEX_SESSIONS = join(homedir(), '.codex', 'sessions')
const PROJECT_ROOTS = IDENTITY.relatedRoots.map((root) => resolve(root).toLowerCase())
const HTML = IDENTITY.bitacoraPath
const TZ_OFFSET_MS = 4 * 3600 * 1000
const GAP_CAP_S = 300

const localDay = (iso) => new Date(new Date(iso).getTime() - TZ_OFFSET_MS).toISOString().slice(0, 10)
const emptyDay = () => ({ ts: [], gen: 0, proc: 0 })
const dayFor = (days, timestamp) => (days[localDay(timestamp)] ??= emptyDay())
const normalizePath = (value) => resolve(String(value)).toLowerCase()
const belongsToProjectPath = (value) => PROJECT_ROOTS.some((root) => {
  const candidate = normalizePath(value)
  return candidate === root || candidate.startsWith(`${root}${sep}`)
})

function claudeProjectSlug(value) {
  return resolve(value).replace(/[:\\/ ]/g, '-').toLowerCase()
}

function claudeTranscriptDirs() {
  if (!existsSync(CLAUDE_PROJECTS)) return []
  const wanted = new Set(IDENTITY.relatedRoots.map(claudeProjectSlug))
  return readdirSync(CLAUDE_PROJECTS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && wanted.has(entry.name.toLowerCase()))
    .map((entry) => join(CLAUDE_PROJECTS, entry.name))
}

function readJsonl(file) {
  const records = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { records.push(JSON.parse(line)) } catch { /* ignora línea incompleta */ }
  }
  return records
}

function collectClaude() {
  const days = {}
  for (const directory of claudeTranscriptDirs()) {
    for (const file of readdirSync(directory).filter((name) => name.endsWith('.jsonl'))) {
      for (const record of readJsonl(join(directory, file))) {
        if (!record.timestamp) continue
        const day = dayFor(days, record.timestamp)
        day.ts.push(new Date(record.timestamp).getTime())
        const usage = record?.message?.usage
        if (!usage) continue
        day.gen += usage.output_tokens || 0
        day.proc += (usage.input_tokens || 0) + (usage.output_tokens || 0) +
          (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
      }
    }
  }
  return days
}

function listJsonl(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...listJsonl(path))
    else if (entry.name.endsWith('.jsonl')) files.push(path)
  }
  return files
}

function collectCodex() {
  const days = {}
  for (const file of listJsonl(CODEX_SESSIONS)) {
    const records = readJsonl(file)
    const belongsToProject = records.some((record) =>
      record.type === 'session_meta' && record?.payload?.cwd &&
      belongsToProjectPath(record.payload.cwd))
    if (!belongsToProject) continue

    for (const record of records) {
      if (!record.timestamp) continue
      const day = dayFor(days, record.timestamp)
      day.ts.push(new Date(record.timestamp).getTime())
      if (record.type !== 'event_msg' || record?.payload?.type !== 'token_count') continue
      const usage = record?.payload?.info?.last_token_usage
      if (!usage) continue
      day.gen += usage.output_tokens || 0
      // input_tokens ya incluye cached_input_tokens; sumarla aparte duplicaría contexto.
      day.proc += usage.total_tokens || ((usage.input_tokens || 0) + (usage.output_tokens || 0))
    }
  }
  return days
}

function activeHours(timestamps) {
  const sorted = [...new Set(timestamps)].sort((a, b) => a - b)
  let seconds = 0
  for (let index = 1; index < sorted.length; index += 1) {
    seconds += Math.min((sorted[index] - sorted[index - 1]) / 1000, GAP_CAP_S)
  }
  return seconds / 3600
}

function summarize(days) {
  const dates = {}
  for (const day of Object.keys(days).sort()) {
    const { ts, gen, proc } = days[day]
    dates[day] = {
      hours: +activeHours(ts).toFixed(2),
      genM: +(gen / 1e6).toFixed(2),
      procM: +(proc / 1e6).toFixed(1),
    }
  }
  const totals = Object.values(dates).reduce(
    (acc, date) => ({
      hours: +(acc.hours + date.hours).toFixed(2),
      genM: +(acc.genM + date.genM).toFixed(2),
      procM: +(acc.procM + date.procM).toFixed(1),
    }),
    { hours: 0, genM: 0, procM: 0 },
  )
  return { dates, totals }
}

function combineSources(sources) {
  const dates = {}
  for (const source of Object.values(sources)) {
    for (const [day, metrics] of Object.entries(source.dates)) {
      const combined = (dates[day] ??= { hours: 0, genM: 0, procM: 0 })
      combined.hours = +(combined.hours + metrics.hours).toFixed(2)
      combined.genM = +(combined.genM + metrics.genM).toFixed(2)
      combined.procM = +(combined.procM + metrics.procM).toFixed(1)
    }
  }
  const totals = Object.values(sources).reduce(
    (acc, source) => ({
      hours: +(acc.hours + source.totals.hours).toFixed(2),
      genM: +(acc.genM + source.totals.genM).toFixed(2),
      procM: +(acc.procM + source.totals.procM).toFixed(1),
    }),
    { hours: 0, genM: 0, procM: 0 },
  )
  return { dates, totals }
}

function build() {
  const sources = {
    claude: summarize(collectClaude()),
    codex: summarize(collectCodex()),
  }
  return {
    project: {
      displayName: IDENTITY.displayName,
      slug: IDENTITY.slug,
      bitacora: IDENTITY.bitacoraRelativePath,
    },
    generatedAt: new Date().toISOString(),
    gapCapMin: GAP_CAP_S / 60,
    tz: 'America/Caracas (UTC-4)',
    sources,
    ...combineSources(sources),
  }
}

function assertBitacoraTarget() {
  if (existsSync(HTML)) return
  const docsDir = join(IDENTITY.workspaceRoot, 'docs')
  const candidates = existsSync(docsDir)
    ? readdirSync(docsDir).filter((name) => /^bitacora-.*\.html$/i.test(name))
    : []
  const detail = candidates.length
    ? ` Ya existe otra bitacora: ${candidates.join(', ')}. No se creara una paralela.`
    : ' Inicializa el proyecto con Forge Kanban antes de escribir metricas.'
  throw new Error(`No encuentro ${IDENTITY.bitacoraRelativePath}.${detail}`)
}

const data = build()
const arg = process.argv[2]

if (arg === '--json') {
  console.log(JSON.stringify(data, null, 2))
} else if (arg === '--write') {
  assertBitacoraTarget()
  const html = readFileSync(HTML, 'utf8')
  const pattern = /(<script id="bitacora-metrics"[^>]*>)([\s\S]*?)(<\/script>)/
  if (!pattern.test(html)) throw new Error(`No encuentro <script id="bitacora-metrics"> en ${HTML}`)
  const next = html.replace(pattern, `$1\n${JSON.stringify(data)}\n$3`)
  writeFileSync(HTML, next)
  console.log(`✓ Bitácora ${IDENTITY.displayName} actualizada · Claude Code + Codex · ${data.totals.hours} h activas`)
} else {
  console.log('fuente / fecha               activo   generados   procesados')
  console.log('─'.repeat(62))
  for (const [key, source] of Object.entries(data.sources)) {
    for (const [day, metrics] of Object.entries(source.dates)) {
      const label = `${key.padEnd(6)} · ${day}`
      console.log(`${label.padEnd(28)} ${(metrics.hours + 'h').padStart(7)} ${(metrics.genM + 'M').padStart(11)} ${(metrics.procM + 'M').padStart(12)}`)
    }
  }
  console.log('─'.repeat(62))
  console.log(`${'TOTAL'.padEnd(28)} ${(data.totals.hours + 'h').padStart(7)} ${(data.totals.genM + 'M').padStart(11)} ${(data.totals.procM + 'M').padStart(12)}`)
}
