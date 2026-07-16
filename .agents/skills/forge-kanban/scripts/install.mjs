#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const target = resolve(process.argv[2] || process.cwd())
const agentsRoot = join(target, '.agents', 'skills', 'forge-kanban')
const configPath = join(target, '.forge', 'forge-kanban.yml')
const force = process.argv.includes('--force')

if (existsSync(agentsRoot) && !force) {
  console.error(`Ya existe ${agentsRoot}. Use --force solo después de revisar diferencias.`)
  process.exit(1)
}
mkdirSync(dirname(agentsRoot), { recursive: true })
cpSync(skillRoot, agentsRoot, { recursive: true, force })
if (!existsSync(configPath)) {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, readFileSync(join(skillRoot, 'assets', 'forge-kanban.example.yml'), 'utf8'), 'utf8')
}
mkdirSync(join(target, '.forge', 'backlog', 'tickets'), { recursive: true })
console.log(JSON.stringify({ installed: agentsRoot, config: configPath, next: 'node .agents/skills/forge-kanban/scripts/forge-kanban.mjs doctor' }, null, 2))
