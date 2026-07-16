#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { inspectSessions } from './lib/sessions.mjs'

const root = process.cwd()
function git(...args) {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch (error) { return { error: error.stderr?.toString().trim() || error.message } }
}

function gitAt(cwd, ...args) {
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch { return { error: 'git command failed' } }
}

function worktrees() {
  const raw = git('worktree', 'list', '--porcelain')
  if (typeof raw !== 'string') return []
  const entries = []; let current = null
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) { current = { path: line.slice(9), locked: false, prunable: false }; entries.push(current) }
    else if (current && line.startsWith('HEAD ')) current.head = line.slice(5)
    else if (current && line.startsWith('branch ')) current.branch = line.slice(7).replace('refs/heads/', '')
    else if (current && line === 'locked') current.locked = true
    else if (current && line.startsWith('prunable')) current.prunable = true
  }
  return entries
}

function inspect(targetArg) {
  const target = resolve(targetArg || root)
  const list = worktrees(); const primary = list[0]?.path ? resolve(list[0].path) : root
  const entry = list.find(item => resolve(item.path).toLowerCase() === target.toLowerCase())
  const status = entry ? gitAt(target, 'status', '--porcelain', '--untracked-files=all') : 'not-registered'
  const expected = dirname(primary)
  const sessions = inspectSessions(target)
  const checks = [
    { name: 'registered_worktree', ok: Boolean(entry) },
    { name: 'not_primary_checkout', ok: Boolean(entry) && target.toLowerCase() !== primary.toLowerCase() },
    { name: 'inside_expected_container', ok: !relative(expected, target).startsWith('..') && !isAbsolute(relative(expected, target)) },
    { name: 'clean_including_untracked', ok: status === '' },
    { name: 'not_locked', ok: Boolean(entry) && !entry.locked },
    { name: 'physical_path_exists', ok: existsSync(target) },
    { name: 'no_active_session_signal', ok: !sessions.cleanup_blocked, detail: sessions.limitation },
    { name: 'session_inactive_proven', ok: sessions.absence_proven, detail: sessions.limitation },
    { name: 'head_durably_preserved', ok: false, detail: 'Requiere rama publicada o referencia durable verificada.' },
    { name: 'integrated_in_published_integrator', ok: false, detail: 'Requiere integrador y remoto configurados.' },
    { name: 'handoff_and_evidence_saved', ok: false, detail: 'Requiere recibo de cierre.' },
  ]
  return { target, cleanup_allowed: checks.every(check => check.ok), verdict: checks.every(check => check.ok) ? 'LIMPIEZA_PERMITIDA' : 'LIMPIEZA_BLOQUEADA', sessions, checks }
}

const [command, target] = process.argv.slice(2)
if (command === 'list') console.log(JSON.stringify(worktrees(), null, 2))
else if (command === 'inspect' || command === 'plan-finish') console.log(JSON.stringify(inspect(target), null, 2))
else if (command === 'finish') {
  const result = inspect(target)
  console.log(JSON.stringify(result, null, 2))
  if (!result.cleanup_allowed) { console.error('LIMPIEZA BLOQUEADA: no se ejecutó ninguna eliminación.'); process.exit(1) }
  console.error('La eliminación automática requiere un recibo firmado; use el integrador de plataforma.')
  process.exit(2)
} else {
  console.error('Uso: harness.mjs <list|inspect PATH|plan-finish PATH|finish PATH>')
  process.exit(2)
}
