#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const update = args.includes('--update')

function option(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

function assertCanonical(path) {
  const skill = join(path, 'SKILL.md')
  if (!existsSync(skill) || !/^name:\s*forge-kanban\s*$/m.test(readFileSync(skill, 'utf8'))) {
    throw new Error(`Se rechazó actualizar una carpeta que no es Forge Kanban: ${path}`)
  }
}

function installSkill(destination) {
  if (resolve(destination) === resolve(skillRoot)) return { destination, unchanged: true }
  if (existsSync(destination)) {
    if (!update) throw new Error(`Ya existe ${destination}. Use --update después de revisar diferencias.`)
    assertCanonical(destination)
  }
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(skillRoot, destination, { recursive: true, force: true })
  return { destination, updated: existsSync(join(destination, 'SKILL.md')) }
}

function installGlobal(target) {
  if (!['codex', 'claude', 'both'].includes(target)) throw new Error('--global debe ser codex, claude o both')
  const home = resolve(option('--home') || homedir())
  const platforms = target === 'both' ? ['codex', 'claude'] : [target]
  const installed = platforms.map(platform => installSkill(join(home, `.${platform}`, 'skills', 'forge-kanban')))
  if (platforms.includes('claude')) {
    const commandSource = join(skillRoot, 'assets', 'claude-command.md')
    const commandTarget = join(home, '.claude', 'commands', 'forge-kanban.md')
    if (existsSync(commandTarget) && !update) throw new Error(`Ya existe ${commandTarget}. Use --update después de revisar diferencias.`)
    mkdirSync(dirname(commandTarget), { recursive: true })
    writeFileSync(commandTarget, readFileSync(commandSource, 'utf8'), 'utf8')
    installed.push({ command: commandTarget })
  }
  console.log(JSON.stringify({ mode: 'global', platforms, installed }, null, 2))
}

function installProject(targetArg) {
  const target = resolve(targetArg || process.cwd())
  const agentsRoot = join(target, '.agents', 'skills', 'forge-kanban')
  const configPath = join(target, '.forge', 'forge-kanban.yml')
  const installed = installSkill(agentsRoot)
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, readFileSync(join(skillRoot, 'assets', 'forge-kanban.example.yml'), 'utf8'), 'utf8')
  }
  mkdirSync(join(target, '.forge', 'backlog', 'tickets'), { recursive: true })
  console.log(JSON.stringify({ mode: 'project', installed, config: configPath, next: 'node .agents/skills/forge-kanban/scripts/forge-kanban.mjs doctor' }, null, 2))
}

try {
  const globalTarget = option('--global')
  if (globalTarget) installGlobal(globalTarget)
  else installProject(args.find(arg => !arg.startsWith('--')))
} catch (error) {
  console.error(`BLOQUEADO: ${error.message}`)
  process.exit(1)
}
