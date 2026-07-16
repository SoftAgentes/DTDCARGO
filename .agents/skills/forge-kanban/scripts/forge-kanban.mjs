#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [command, ticket, phase] = process.argv.slice(2)
const cwd = process.cwd()
const skillScripts = dirname(fileURLToPath(import.meta.url))
const metricsDir = join(cwd, '.forge', 'metrics')

function usage() {
  console.error('Uso: forge-kanban.mjs snapshot <ticket> <start|end> | report <ticket> | doctor|start|status|features|reconcile|propose|approve|apply|route|adopt')
  process.exit(2)
}

function metricsScript() {
  const local = join(cwd, 'scripts', 'bitacora-metrics.mjs')
  if (existsSync(local)) return local
  const portable = join(skillScripts, 'bitacora-metrics.mjs')
  return existsSync(portable) ? portable : ''
}

function readMetrics() {
  const script = metricsScript()
  if (!script) return { available: false, reason: 'No existe un colector de metricas local ni portable' }
  const result = spawnSync(process.execPath, [script, '--json'], { cwd, encoding: 'utf8' })
  if (result.status !== 0) return { available: false, reason: result.stderr.trim() || 'Fallo el colector' }
  try {
    const parsed = JSON.parse(result.stdout)
    return {
      available: true,
      capturedAt: new Date().toISOString(),
      project: parsed.project,
      totals: parsed.totals,
      sources: parsed.sources,
    }
  } catch (error) {
    return { available: false, reason: `El colector no devolvio JSON valido: ${error.message}` }
  }
}

function snapshot() {
  if (!ticket || !['start', 'end'].includes(phase)) usage()
  mkdirSync(metricsDir, { recursive: true })
  const data = { ticket, phase, ...readMetrics() }
  const path = join(metricsDir, `${ticket}-${phase}.json`)
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  console.log(path)
}

function report() {
  if (!ticket) usage()
  const startPath = join(metricsDir, `${ticket}-start.json`)
  const endPath = join(metricsDir, `${ticket}-end.json`)
  if (!existsSync(startPath) || !existsSync(endPath)) {
    console.log(JSON.stringify({ ticket, available: false, reason: 'Faltan snapshots start/end' }, null, 2))
    return
  }
  const start = JSON.parse(readFileSync(startPath, 'utf8'))
  const end = JSON.parse(readFileSync(endPath, 'utf8'))
  if (!start.available || !end.available) {
    console.log(JSON.stringify({ ticket, available: false, reason: start.reason || end.reason }, null, 2))
    return
  }
  const raw = {
    hours: end.totals.hours - start.totals.hours,
    generatedTokensM: end.totals.genM - start.totals.genM,
    processedTokensM: end.totals.procM - start.totals.procM,
  }
  if (Object.values(raw).some((value) => value < 0)) {
    console.log(JSON.stringify({ ticket, available: false, reason: 'Las metricas acumuladas disminuyeron entre snapshots' }, null, 2))
    return
  }
  const delta = {
    hours: +raw.hours.toFixed(2),
    generatedTokensM: +raw.generatedTokensM.toFixed(2),
    processedTokensM: +raw.processedTokensM.toFixed(1),
  }
  console.log(JSON.stringify({
    ticket,
    available: true,
    project: end.project || start.project,
    start: start.capturedAt,
    end: end.capturedAt,
    delta,
  }, null, 2))
}

if (command === 'snapshot') snapshot()
else if (command === 'report') report()
else if (['doctor', 'start', 'status', 'features', 'propose', 'approve', 'apply', 'route', 'adopt', 'reconcile'].includes(command)) {
  const control = join(skillScripts, 'control-plane.mjs')
  const result = spawnSync(process.execPath, [control, ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
  process.exit(result.status ?? 1)
} else usage()
