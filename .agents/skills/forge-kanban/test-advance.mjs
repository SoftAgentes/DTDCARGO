#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAdvancePlan } from './scripts/lib/advance.mjs'

const skillRoot = dirname(fileURLToPath(import.meta.url))
let failed = false
function ok(name, condition) { console.log(`  ${condition ? 'ok  ' : 'FAIL'}: ${name}`); if (!condition) failed = true }

const baseTicket = {
  schema_version: '3', id: 'T-100', proposal_id: 'FKP-AAAABBBB', title: 'Construir contrato listo',
  status: 'planning', priority: 'red', priority_reason: 'Bloquea entrega', blocked: 'false',
  depends_on: 'null', spec_ref: 'docs/specs/ready.md', domain: 'general_code', artifact_type: 'code',
  builder_skills: 'karpathy-principles', review_skills: 'testing-engineer', llm_mode: 'required',
  methodology: 'karpathy_goal_oriented', required_context: 'AGENTS.md, docs/specs/ready.md',
  owned_paths: 'src/features/ready', shared_paths: 'none', forbidden_paths: '.env*',
  model_class: 'sol', model: 'test-sol', model_reason: 'Riesgo alto', build_method: 'yunque',
  build_method_reason: 'Ruta compartida', gate: 'npm.cmd test', evidence: 'focused_tests',
  commit_strategy: 'atomic_selective',
  ticket_relative_path: '.forge/backlog/tickets/T-100.md',
}
const approval = { proposal_id: baseTicket.proposal_id, applied_ticket_id: baseTicket.id, status: 'applied', approved_by: 'Founder', reason: 'GO', applied_at: '2026-07-16T00:00:00Z' }
const row = { item_type: 'ticket', id: baseTicket.id, title: baseTicket.title, priority: 'red', ready: true, blockers: [], model: 'test-sol' }

const readyPlan = buildAdvancePlan({ board: { rows: [row] }, tickets: [baseTicket], approvals: [approval], baseline: 'abc', skillRoot })
ok('advance selects an approved ready ticket', readyPlan.action === 'execute_ticket' && readyPlan.ticket.id === 'T-100')
ok('execution packet includes harness, snapshots, gate and continuation', readyPlan.execution.commands.harness_preflight.includes('harness.mjs') && readyPlan.execution.commands.snapshot_start.includes('snapshot T-100 start') && readyPlan.execution.commands.gate === 'npm.cmd test' && readyPlan.execution.commands.continue.includes('advance --json'))
ok('execution packet requires human GO, lifecycle updates and safe close', readyPlan.requires_human_go === true && readyPlan.ticket.path.endsWith('T-100.md') && readyPlan.execution.lifecycle.length === 3 && readyPlan.execution.close_rule.includes('fail-closed'))

const blockedTicket = { ...baseTicket, id: 'T-101', proposal_id: 'FKP-CCCCDDDD', blocked: 'true' }
const blockedApproval = { ...approval, proposal_id: blockedTicket.proposal_id, applied_ticket_id: blockedTicket.id }
const blockedPlan = buildAdvancePlan({ board: { rows: [{ ...row, id: blockedTicket.id }] }, tickets: [blockedTicket], approvals: [blockedApproval], skillRoot })
ok('blocked tickets never advance', blockedPlan.action === 'blocked' && blockedPlan.blocked[0].blockers.includes('ticket bloqueado'))

const dependency = { ...baseTicket, id: 'T-099', proposal_id: 'FKP-EEEEFFFF', status: 'dev' }
const dependent = { ...baseTicket, id: 'T-102', proposal_id: 'FKP-11112222', depends_on: dependency.id }
const dependentApproval = { ...approval, proposal_id: dependent.proposal_id, applied_ticket_id: dependent.id }
const dependencyPlan = buildAdvancePlan({ board: { rows: [{ ...row, id: dependent.id }] }, tickets: [dependency, dependent], approvals: [dependentApproval], skillRoot })
ok('unfinished dependencies block selection', dependencyPlan.blocked[0].blockers.includes('dependencia pendiente T-099'))

const yellow = { ...baseTicket, id: 'T-103', proposal_id: 'FKP-33334444', priority: 'yellow' }
const redReview = { ...baseTicket, id: 'T-104', proposal_id: 'FKP-55556666', status: 'review' }
const priorities = buildAdvancePlan({
  board: { rows: [{ ...row, id: yellow.id, priority: 'yellow' }, { ...row, id: redReview.id }] }, tickets: [yellow, redReview],
  approvals: [{ ...approval, proposal_id: yellow.proposal_id, applied_ticket_id: yellow.id }, { ...approval, proposal_id: redReview.proposal_id, applied_ticket_id: redReview.id }], skillRoot,
})
ok('advance respects priority before lifecycle stage', priorities.ticket.id === redReview.id && priorities.ticket.stage === 'verify_and_close')

const featurePlan = buildAdvancePlan({ board: { rows: [{ item_type: 'feature', id: 'F-001', title: 'Feature sin ticket' }] }, tickets: [], approvals: [], skillRoot })
ok('features require propose approve apply before execution', featurePlan.action === 'prepare_tickets' && featurePlan.next.includes('approve'))

const fixture = mkdtempSync(join(tmpdir(), 'forge-advance-'))
try {
  mkdirSync(join(fixture, '.forge', 'backlog', 'tickets'), { recursive: true })
  mkdirSync(join(fixture, '.forge', 'reports'), { recursive: true })
  mkdirSync(join(fixture, 'docs', 'specs'), { recursive: true })
  writeFileSync(join(fixture, '.forge', 'forge-kanban.yml'), 'ticket_dir: .forge/backlog/tickets\nmodels:\n  sol:\n    model: test-sol\n', 'utf8')
  writeFileSync(join(fixture, 'docs', 'specs', 'ready.md'), '# Ready\n', 'utf8')
  const yaml = Object.entries(baseTicket).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')
  writeFileSync(join(fixture, '.forge', 'backlog', 'tickets', 'T-100.md'), `---\n${yaml}\n---\n\n## Ready\n`, 'utf8')
  writeFileSync(join(fixture, '.forge', 'reports', 'ticket-approvals.json'), `${JSON.stringify({ schema_version: 1, approvals: [approval] }, null, 2)}\n`, 'utf8')
  execFileSync('git', ['init'], { cwd: fixture, stdio: 'ignore' })
  execFileSync('git', ['add', '.'], { cwd: fixture, stdio: 'ignore' })
  execFileSync('git', ['-c', 'user.name=Forge Test', '-c', 'user.email=forge@test.local', 'commit', '-m', 'fixture'], { cwd: fixture, stdio: 'ignore' })
  const cli = spawnSync(process.execPath, [join(skillRoot, 'scripts', 'forge-kanban.mjs'), 'advance', '--json'], { cwd: fixture, encoding: 'utf8' })
  const output = cli.status === 0 ? JSON.parse(cli.stdout) : null
  ok('advance CLI emits a machine-readable execution packet', cli.status === 0 && output?.action === 'execute_ticket' && output.ticket.id === 'T-100')
} finally {
  rmSync(fixture, { recursive: true, force: true })
}

console.log(failed ? '\nFORGE ADVANCE TESTS FAILED' : '\nALL FORGE ADVANCE TESTS PASSED')
process.exit(failed ? 1 : 0)
