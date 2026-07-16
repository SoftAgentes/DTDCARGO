import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const DEFAULT_CONFIG = {
  version: 2,
  mode: 'auto',
  ticket_dir: '.forge/backlog/tickets',
  kanban_view: 'KANBAN.md',
  max_forja_agents: 2,
  dashboard: { strategy: 'detect_and_reuse', create_if_missing: true, fail_on_multiple_candidates: true },
  models: {
    sol: { provider: 'configured', model: null, reasoning_effort: 'high' },
    terra: { provider: 'configured', model: null, reasoning_effort: 'medium' },
    luna: { provider: 'configured', model: null, reasoning_effort: null },
  },
}

function scalar(raw) {
  const value = raw.trim()
  if (value === '' ) return {}
  if (value === 'null' || value === '~') return null
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true'
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(item => scalar(item)).filter(item => item !== '')
  }
  return value.replace(/^['"]|['"]$/g, '')
}

// Subconjunto YAML deliberadamente pequeño: mappings, arrays inline y escalares.
// Falla ante sintaxis desconocida para evitar aceptar configuración que no se aplica.
export function parseSimpleYaml(text, source = '<yaml>') {
  const root = {}
  const stack = [{ indent: -1, value: root }]
  for (const [index, original] of text.split(/\r?\n/).entries()) {
    if (!original.trim() || original.trimStart().startsWith('#')) continue
    if (/\t/.test(original)) throw new Error(`${source}:${index + 1}: tabs no permitidos`)
    const indent = original.length - original.trimStart().length
    const match = original.trim().match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/)
    if (!match) throw new Error(`${source}:${index + 1}: YAML no soportado`)
    while (stack.at(-1).indent >= indent) stack.pop()
    const parent = stack.at(-1).value
    const value = scalar(match[2] ?? '')
    parent[match[1]] = value
    if (value && typeof value === 'object' && !Array.isArray(value)) stack.push({ indent, value })
  }
  return root
}

function merge(base, override) {
  const output = { ...base }
  for (const [key, value] of Object.entries(override || {})) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(base[key] || {}, value)
      : value
  }
  return output
}

export function loadConfig(root = process.cwd()) {
  const path = join(root, '.forge', 'forge-kanban.yml')
  const project = existsSync(path) ? parseSimpleYaml(readFileSync(path, 'utf8'), path) : {}
  const config = merge(DEFAULT_CONFIG, project)
  config.root = resolve(root)
  config.path = path
  config.ticket_dir_abs = resolve(root, config.ticket_dir)
  config.kanban_view_abs = resolve(root, config.kanban_view)
  return config
}

