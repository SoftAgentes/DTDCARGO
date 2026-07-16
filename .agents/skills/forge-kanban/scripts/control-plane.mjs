#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './lib/config.mjs'
import { loadRouter, routeCapability } from './lib/router.mjs'

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const root = process.cwd()

function git(...args) {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch { return '' }
}

function detectMode() {
  if (existsSync(join(root, '.forge', 'manifest.json')) || existsSync(join(root, 'FORGE.md'))) return 'forge'
  if (existsSync(join(root, '.git')) || git('rev-parse', '--git-dir')) return 'standalone'
  return 'uninitialized'
}

function parseFrontmatter(path) {
  const raw = readFileSync(path, 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  return Object.fromEntries(match[1].split(/\r?\n/).map(line => line.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^['"]|['"]$/g, '')]))
}

function tickets(config) {
  if (!existsSync(config.ticket_dir_abs)) return []
  return readdirSync(config.ticket_dir_abs).filter(name => name.endsWith('.md')).map(name => parseFrontmatter(join(config.ticket_dir_abs, name)))
}

function validateTicket(ticket, all) {
  const errors = []
  if (String(ticket.schema_version) === '3') {
    for (const field of ['id', 'title', 'status', 'priority', 'priority_reason', 'domain', 'artifact_type', 'model_class', 'model_reason', 'task_effort', 'reasoning_effort', 'build_method', 'build_method_reason', 'builder_skills', 'review_skills', 'owned_paths', 'gate', 'evidence', 'commit_strategy']) {
      if (!ticket[field] || ticket[field] === 'null') errors.push(`${ticket.id || 'ticket'}: requiere ${field}`)
    }
    if (ticket.commit_strategy !== 'atomic_selective') errors.push(`${ticket.id}: commit_strategy debe ser atomic_selective`)
  }
  const deps = (ticket.depends_on || '').split(',').map(v => v.trim()).filter(v => v && v !== 'null')
  const ids = new Set(all.map(item => item.id))
  for (const dep of deps) if (!ids.has(dep)) errors.push(`${ticket.id}: dependencia inexistente ${dep}`)
  if (ticket.status === 'dev') {
    for (const field of ['spec_ref', 'builder_skills', 'review_skills', 'owned_paths', 'gate', 'evidence']) {
      if (!ticket[field] || ticket[field] === 'null') errors.push(`${ticket.id}: gate planning→dev requiere ${field}`)
    }
  }
  return errors
}

function dependencyCycles(all) {
  const graph = new Map(all.map(t => [t.id, (t.depends_on || '').split(',').map(v => v.trim()).filter(v => v && v !== 'null')]))
  const visiting = new Set(); const visited = new Set(); const errors = []
  function visit(id) {
    if (visiting.has(id)) { errors.push(`ciclo de dependencias en ${id}`); return }
    if (visited.has(id)) return
    visiting.add(id); for (const dep of graph.get(id) || []) visit(dep); visiting.delete(id); visited.add(id)
  }
  for (const id of graph.keys()) visit(id)
  return [...new Set(errors)]
}

function doctor(json = false) {
  const config = loadConfig(root); const mode = detectMode(); const checks = []
  checks.push({ name: 'git_repository', ok: mode !== 'uninitialized' })
  checks.push({ name: 'base_commit', ok: Boolean(git('rev-parse', 'HEAD')) })
  checks.push({ name: 'config_parsed', ok: true, value: existsSync(config.path) ? config.path : 'defaults' })
  checks.push({ name: 'ticket_directory', ok: existsSync(config.ticket_dir_abs), value: config.ticket_dir })
  try { checks.push({ name: 'capability_router', ok: Boolean(loadRouter(skillRoot)) }) } catch (error) { checks.push({ name: 'capability_router', ok: false, error: error.message }) }
  const result = { mode, root, healthy: checks.every(c => c.ok), checks }
  console.log(json ? JSON.stringify(result, null, 2) : checks.map(c => `${c.ok ? '✓' : '✗'} ${c.name}${c.value ? `: ${c.value}` : ''}${c.error ? ` — ${c.error}` : ''}`).join('\n'))
  process.exitCode = result.healthy ? 0 : 1
}

function status(json = false) {
  const config = loadConfig(root); const all = tickets(config)
  const errors = all.flatMap(ticket => validateTicket(ticket, all)).concat(dependencyCycles(all))
  const counts = Object.fromEntries(['backlog','planning','dev','qa','review','done'].map(s => [s, all.filter(t => t.status === s).length]))
  const result = { mode: detectMode(), tickets: all.length, counts, valid: errors.length === 0, errors }
  console.log(json ? JSON.stringify(result, null, 2) : [`Modo: ${result.mode}`, `Tickets: ${all.length}`, `Estado: ${result.valid ? 'válido' : 'bloqueado'}`, ...errors.map(e => `- ${e}`)].join('\n'))
  process.exitCode = result.valid ? 0 : 1
}

function route(domain, json = false) {
  const result = routeCapability(loadRouter(skillRoot), domain)
  console.log(json ? JSON.stringify(result, null, 2) : result.blocked ? `BLOQUEADO: ${result.reason}` : `${domain}: ${result.builder_skills.join(', ')} → revisión ${result.review_skills.join(', ')}`)
  process.exitCode = result.blocked ? 1 : 0
}

function adoption(deep = false) {
  const config = loadConfig(root); const all = tickets(config)
  const report = {
    generated_at: new Date().toISOString(), mode: detectMode(), depth: deep ? 'deep' : 'quick', read_only: true,
    baseline_commit: git('rev-parse', 'HEAD') || null, tickets: all.length,
    worktrees: git('worktree', 'list', '--porcelain').split(/\r?\n/).filter(line => line.startsWith('worktree ')).length,
    dirty: Boolean(git('status', '--porcelain')), instructions: 'Revisar este baseline antes de aprobar cualquier escritura.',
  }
  console.log(JSON.stringify(report, null, 2))
}

function reconcile() {
  const config = loadConfig(root); const all = tickets(config); const errors = all.flatMap(t => validateTicket(t, all)).concat(dependencyCycles(all))
  const output = ['# Forge Kanban Adoption Report', '', `- Fecha: ${new Date().toISOString()}`, `- Modo: ${detectMode()}`, `- Baseline: ${git('rev-parse', 'HEAD') || 'n/a'}`, `- Tickets: ${all.length}`, '', '## Hallazgos', '', ...(errors.length ? errors.map(e => `- ${e}`) : ['- Sin contradicciones estructurales detectadas.']), '', '> El trabajo histórico desconocido se registra como `n/a (trabajo anterior a Forge Kanban)`; no se inventan métricas.', ''].join('\n')
  const path = join(root, 'FORGE-KANBAN-ADOPTION-REPORT.md'); writeFileSync(path, output, 'utf8'); console.log(path)
}

const [command, argument] = process.argv.slice(2); const json = process.argv.includes('--json')
if (command === 'doctor') doctor(json)
else if (command === 'status' || command === 'start') status(json)
else if (command === 'route' && argument) route(argument, json)
else if (command === 'adopt') adoption(process.argv.includes('--deep'))
else if (command === 'reconcile') reconcile()
else { console.error('Uso: control-plane.mjs <doctor|start|status|route DOMINIO|adopt [--quick|--deep]|reconcile> [--json]'); process.exit(2) }

