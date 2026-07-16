#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectIdentity } from './project-identity.mjs'

const SKILL_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const TEMPLATE = join(SKILL_ROOT, 'assets', 'bitacora-template.html')

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : ''
}

function configureDisplayName(startPath, displayName) {
  if (!displayName) return
  const initial = resolveProjectIdentity(startPath)
  mkdirSync(dirname(initial.configPath), { recursive: true })
  const current = existsSync(initial.configPath)
    ? JSON.parse(readFileSync(initial.configPath, 'utf8'))
    : {}
  writeFileSync(initial.configPath, `${JSON.stringify({ ...current, displayName }, null, 2)}\n`, 'utf8')
}

export function initializeProject(startPath = process.cwd(), displayName = '') {
  configureDisplayName(startPath, displayName.trim())
  const identity = resolveProjectIdentity(startPath)
  const docsDir = join(identity.workspaceRoot, 'docs')
  mkdirSync(docsDir, { recursive: true })
  const existing = readdirSync(docsDir).filter((name) => /^bitacora-.*\.html$/i.test(name))

  if (existsSync(identity.bitacoraPath)) {
    return { ...identity, created: false }
  }
  if (existing.length) {
    throw new Error(
      `Ya existe otra bitacora (${existing.join(', ')}). ` +
      `Configura displayName o migra ese archivo; no se creara una bitacora paralela.`,
    )
  }

  const template = readFileSync(TEMPLATE, 'utf8')
    .replaceAll('{{PROJECT_NAME}}', identity.displayName)
    .replaceAll('{{PROJECT_SLUG}}', identity.slug)
  writeFileSync(identity.bitacoraPath, template, 'utf8')
  return { ...identity, created: true }
}

function cli() {
  try {
    const result = initializeProject(process.cwd(), arg('--display-name'))
    const action = result.created ? 'creada' : 'reutilizada'
    console.log(`Bitacora ${action}: ${result.bitacoraRelativePath}`)
    console.log(`Titulo: Bitacora ${result.displayName}`)
  } catch (error) {
    console.error(`No se pudo inicializar Forge Kanban: ${error.message}`)
    process.exit(1)
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) cli()
