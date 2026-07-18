#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

function git(startPath, args) {
  try {
    return execFileSync('git', ['-C', startPath, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

export function slugifyProjectName(value) {
  const slug = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'project'
}

function readConfig(configPath) {
  if (!existsSync(configPath)) return {}
  let config
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`Configuracion de proyecto invalida en ${configPath}: ${error.message}`)
  }
  if (!config || Array.isArray(config) || typeof config !== 'object') {
    throw new Error(`Configuracion de proyecto invalida en ${configPath}: se esperaba un objeto JSON`)
  }
  if ('displayName' in config && (typeof config.displayName !== 'string' || !config.displayName.trim())) {
    throw new Error(`displayName debe ser un texto no vacio en ${configPath}`)
  }
  return config
}

function parseWorktrees(output, fallback) {
  const roots = output
    .split(/\r?\n/)
    .filter((line) => line.startsWith('worktree '))
    .map((line) => resolve(line.slice('worktree '.length)))
  return roots.length ? [...new Set(roots)] : [fallback]
}

export function isPathInside(candidate, root) {
  const rel = relative(resolve(root), resolve(candidate))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

export function resolveProjectIdentity(startPath = process.cwd()) {
  const start = resolve(startPath)
  const workspaceRoot = resolve(git(start, ['rev-parse', '--show-toplevel']) || start)
  const commonRaw = git(workspaceRoot, ['rev-parse', '--git-common-dir'])
  const commonDir = commonRaw
    ? resolve(isAbsolute(commonRaw) ? commonRaw : join(workspaceRoot, commonRaw))
    : ''
  const canonicalRoot = commonDir && basename(commonDir).toLowerCase() === '.git'
    ? dirname(commonDir)
    : workspaceRoot
  const configPath = join(workspaceRoot, '.codex', 'project.json')
  const config = readConfig(configPath)
  const folderName = basename(canonicalRoot)
  const displayName = config.displayName?.trim() || folderName
  const slug = slugifyProjectName(displayName)
  const bitacoraRelativePath = `docs/bitacora-${slug}.html`
  const worktreeOutput = git(workspaceRoot, ['worktree', 'list', '--porcelain'])
  const relatedRoots = parseWorktrees(worktreeOutput, workspaceRoot)

  return {
    displayName,
    slug,
    configured: Boolean(config.displayName),
    folderName,
    workspaceRoot,
    canonicalRoot,
    configPath,
    bitacoraRelativePath,
    bitacoraPath: join(workspaceRoot, 'docs', `bitacora-${slug}.html`),
    storageNamespace: `${slug}-bitacora`,
    relatedRoots,
  }
}

function cli() {
  const rootIndex = process.argv.indexOf('--root')
  const startPath = rootIndex >= 0 && process.argv[rootIndex + 1]
    ? process.argv[rootIndex + 1]
    : process.cwd()
  const identity = resolveProjectIdentity(startPath)
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(identity, null, 2))
    return
  }
  console.log(`Proyecto: ${identity.displayName}`)
  console.log(`Slug: ${identity.slug}`)
  console.log(`Bitacora: ${identity.bitacoraRelativePath}`)
  console.log(`Raiz canonica: ${identity.canonicalRoot}`)
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (executedPath === resolve(fileURLToPath(import.meta.url))) cli()
