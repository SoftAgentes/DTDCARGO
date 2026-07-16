import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

function normalized(path) {
  try { return resolve(path).replaceAll('/', '\\').toLowerCase() } catch { return String(path).replaceAll('/', '\\').toLowerCase() }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

function tcpOwners() {
  if (process.platform !== 'win32') return new Map()
  try {
    const text = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true })
    const owners = new Map()
    for (const line of text.split(/\r?\n/)) {
      const match = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i)
      if (match) owners.set(Number(match[1]), Number(match[2]))
    }
    return owners
  } catch { return null }
}

export function inspectSessions(targetPath, home = homedir()) {
  const target = normalized(targetPath); const signals = []; const errors = []
  const lockDir = join(home, '.claude', 'ide'); const owners = tcpOwners()
  if (owners === null) errors.push('No se pudo consultar TCP owners')
  if (existsSync(lockDir)) {
    for (const name of readdirSync(lockDir).filter(item => item.endsWith('.lock'))) {
      const path = join(lockDir, name)
      try {
        const lock = JSON.parse(readFileSync(path, 'utf8'))
        const port = Number(name.replace(/\.lock$/, '')); const alive = pidAlive(Number(lock.pid))
        const tcpOwner = owners?.get(port); const tcpMatches = tcpOwner === Number(lock.pid)
        const matchesPath = (lock.workspaceFolders || []).some(folder => {
          const candidate = normalized(folder)
          return candidate === target || candidate.startsWith(`${target}\\`) || target.startsWith(`${candidate}\\`)
        })
        signals.push({ detector: 'claude_ide_lock', path, pid: Number(lock.pid), port, alive, tcp_owner: tcpOwner || null, tcp_matches_pid: tcpMatches, matches_target: matchesPath, active: alive && tcpMatches && matchesPath })
      } catch (error) { errors.push(`${path}: ${error.message}`) }
    }
  }
  const active = signals.filter(signal => signal.active)
  return {
    active_detected: active.length > 0,
    cleanup_blocked: active.length > 0 || errors.length > 0,
    absence_proven: false,
    limitation: 'Windows no permite demostrar que ninguna terminal, Codex CLI o proceso mantiene este cwd sin instrumentación adicional.',
    active, signals, errors,
  }
}
