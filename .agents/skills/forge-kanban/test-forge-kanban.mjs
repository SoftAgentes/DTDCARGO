#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectIdentity, slugifyProjectName } from './scripts/project-identity.mjs'
import { inspectSessions } from './scripts/lib/sessions.mjs'
import { reconcileFeatures, renderFeatureConsole, renderFeatureHtml } from './scripts/lib/reconciler.mjs'
import { buildProposals, renderProposalConsole } from './scripts/lib/proposals.mjs'

const ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))
const INIT = join(dirname(fileURLToPath(import.meta.url)), 'scripts', 'init-project.mjs')
const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), 'scripts', 'forge-kanban.mjs')
const CONTROL = join(dirname(fileURLToPath(import.meta.url)), 'scripts', 'control-plane.mjs')
const HARNESS = join(dirname(fileURLToPath(import.meta.url)), 'scripts', 'harness.mjs')
const SKILL_ROOT = dirname(fileURLToPath(import.meta.url))
const METHODOLOGY = join(SKILL_ROOT, 'references', 'methodology.md')
const ROUTER = join(SKILL_ROOT, 'references', 'capability-router.yaml')
const LOCAL_METRICS = join(ROOT, 'scripts', 'bitacora-metrics.mjs')
const METRICS = existsSync(LOCAL_METRICS) ? LOCAL_METRICS : join(SKILL_ROOT, 'scripts', 'bitacora-metrics.mjs')
let failed = false

function ok(name, condition) {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'}: ${name}`)
  if (!condition) failed = true
}

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function createRepo(parent, name) {
  const root = join(parent, name)
  mkdirSync(root, { recursive: true })
  git(root, 'init')
  git(root, '-c', 'user.name=Forge Test', '-c', 'user.email=forge@test.local', 'commit', '--allow-empty', '-m', 'init')
  return root
}

function runInit(cwd, ...args) {
  return spawnSync('node', [INIT, ...args], { cwd, encoding: 'utf8' })
}

const sandbox = mkdtempSync(join(tmpdir(), 'forge-kanban-'))
try {
  const williams = createRepo(sandbox, 'Williams Project')
  const initial = resolveProjectIdentity(williams)
  ok('folder fallback keeps visible name', initial.displayName === 'Williams Project')
  ok('folder fallback creates safe slug', initial.slug === 'williams-project')
  ok('bitacora filename is project-specific', basename(initial.bitacoraPath) === 'bitacora-williams-project.html')

  const initWilliams = runInit(williams)
  ok('Williams initialization succeeds', initWilliams.status === 0)
  const williamsHtml = readFileSync(join(williams, 'docs', 'bitacora-williams-project.html'), 'utf8')
  ok('Williams visible title is rendered', williamsHtml.includes('<title>Bitácora Williams Project</title>'))
  ok('Williams storage namespace is isolated', williamsHtml.includes('williams-project-bitacora-last-open-v1'))

  const worktree = join(sandbox, 'Williams Project-wt-feature')
  git(williams, 'worktree', 'add', '-b', 'codex/test-worktree', worktree)
  const worktreeIdentity = resolveProjectIdentity(worktree)
  ok('worktree inherits canonical folder name', worktreeIdentity.displayName === 'Williams Project')
  ok('worktree never leaks suffix into slug', worktreeIdentity.slug === 'williams-project')
  ok('worktree writes inside its own checkout', worktreeIdentity.bitacoraPath.startsWith(worktree))
  ok('worktree sees related roots', worktreeIdentity.relatedRoots.length === 2)

  const atlas = createRepo(sandbox, 'Project Alpha')
  mkdirSync(join(atlas, '.codex'), { recursive: true })
  mkdirSync(join(atlas, 'docs'), { recursive: true })
  writeFileSync(join(atlas, '.codex', 'project.json'), '{"displayName":"Atlas"}\n')
  writeFileSync(join(atlas, 'docs', 'bitacora-atlas.html'), '<title>Bitácora Atlas</title>\n')
  const initAtlas = runInit(atlas)
  ok('configured identity reuses canonical file', initAtlas.status === 0 && /reutilizada/.test(initAtlas.stdout))
  ok('configured identity creates no duplicate bitacora', !existsSync(join(atlas, 'docs', 'bitacora-project-alpha.html')))

  const conflict = createRepo(sandbox, 'New Project')
  mkdirSync(join(conflict, 'docs'), { recursive: true })
  writeFileSync(join(conflict, 'docs', 'bitacora-legacy.html'), '<title>Legacy</title>\n')
  const initConflict = runInit(conflict)
  ok('existing mismatched bitacora fails closed', initConflict.status === 1)
  ok('conflict creates no parallel bitacora', !existsSync(join(conflict, 'docs', 'bitacora-new-project.html')))

  const metrics = spawnSync('node', [METRICS, '--write'], { cwd: williams, encoding: 'utf8' })
  ok('metrics writes the resolved Williams bitacora', metrics.status === 0)
  const metricsHtml = readFileSync(join(williams, 'docs', 'bitacora-williams-project.html'), 'utf8')
  ok('metrics payload contains Williams identity', metricsHtml.includes('"slug":"williams-project"'))

  const start = spawnSync('node', [SNAPSHOT, 'snapshot', 'T-001', 'start'], { cwd: williams, encoding: 'utf8' })
  const end = spawnSync('node', [SNAPSHOT, 'snapshot', 'T-001', 'end'], { cwd: williams, encoding: 'utf8' })
  const report = spawnSync('node', [SNAPSHOT, 'report', 'T-001'], { cwd: williams, encoding: 'utf8' })
  const reportData = report.status === 0 ? JSON.parse(report.stdout) : {}
  ok('ticket start/end snapshots use portable metrics', start.status === 0 && end.status === 0)
  ok('ticket report exposes measured delta', report.status === 0 && reportData.available === true && reportData.project?.slug === 'williams-project')

  ok('accented names use deterministic slug', slugifyProjectName('José & Williams') === 'jose-williams')
  const methodology = readFileSync(METHODOLOGY, 'utf8')
  const router = readFileSync(ROUTER, 'utf8')
  ok('methodology declares the six-stage control plane', methodology.includes('AVIVAR → CLASIFICAR → ENRUTAR → FORJAR → VERIFICAR → CERRAR'))
  ok('capability router separates builders and reviewers', router.includes('builder_skills:') && router.includes('review_skills:'))
  ok('capability router keeps specialist logic external', router.includes('never_duplicate_specialist_logic: true'))
  ok('portable package uses only generic capability identities', router.includes('product_design:') && router.includes('database:'))

  const portable = createRepo(sandbox, 'Portable Project')
  mkdirSync(join(portable, '.forge'), { recursive: true })
  mkdirSync(join(portable, 'custom', 'tickets'), { recursive: true })
  writeFileSync(join(portable, '.forge', 'forge-kanban.yml'), 'version: 2\nticket_dir: custom/tickets\nkanban_view: BOARD.md\n')
  const doctor = spawnSync('node', [CONTROL, 'doctor', '--json'], { cwd: portable, encoding: 'utf8' })
  const doctorData = doctor.status === 0 ? JSON.parse(doctor.stdout) : {}
  ok('doctor parses project config instead of documenting it', doctorData.checks?.some(check => check.name === 'ticket_directory' && check.value === 'custom/tickets'))
  const route = spawnSync('node', [CONTROL, 'route', 'product_design', '--json'], { cwd: portable, encoding: 'utf8' })
  const routeData = route.status === 0 ? JSON.parse(route.stdout) : {}
  ok('router resolves builder and reviewer from YAML', routeData.builder_skills?.includes('impeccable') && routeData.review_skills?.includes('web-quality'))
  const unknown = spawnSync('node', [CONTROL, 'route', 'does_not_exist', '--json'], { cwd: portable, encoding: 'utf8' })
  ok('unknown capability blocks closed', unknown.status === 1 && JSON.parse(unknown.stdout).blocked === true)
  const cleanup = spawnSync('node', [HARNESS, 'inspect', portable], { cwd: portable, encoding: 'utf8' })
  const cleanupData = cleanup.status === 0 ? JSON.parse(cleanup.stdout) : {}
  ok('cleanup remains blocked without positive session and integration proof', cleanupData.verdict === 'LIMPIEZA_BLOQUEADA')
  const fakeHome = join(sandbox, 'fake-home')
  mkdirSync(join(fakeHome, '.claude', 'ide'), { recursive: true })
  writeFileSync(join(fakeHome, '.claude', 'ide', '65534.lock'), JSON.stringify({ pid: 99999999, workspaceFolders: [portable] }))
  const stale = inspectSessions(portable, fakeHome)
  ok('stale Claude lock is not treated as an active window', stale.active_detected === false && stale.signals[0]?.alive === false)

  const featureRoot = createRepo(sandbox, 'Feature Inventory')
  mkdirSync(join(featureRoot, 'docs', 'plan'), { recursive: true })
  writeFileSync(join(featureRoot, 'docs', 'plan', 'complete.md'), '# Facturación\nstatus: done\nEvidencia: prueba verificada\n')
  writeFileSync(join(featureRoot, 'docs', 'plan', 'partial.md'), '# Portal\n- [x] Login\n- [ ] Recuperar contraseña\n')
  writeFileSync(join(featureRoot, 'docs', 'plan', 'blocked.md'), '# Integración\nBloqueador: falta autorización humana\n')
  writeFileSync(join(featureRoot, 'docs', 'plan', 'unknown.md'), '# Idea sin decisión\nDescripción exploratoria.\n')
  writeFileSync(join(featureRoot, 'docs', 'plan', 'README.md'), '# No es una feature\n')
  const featureResult = reconcileFeatures({ root: featureRoot, config: { reconcile: { roots: ['docs/plan'] } }, tickets: [] })
  ok('feature inventory separates complete partial blocked and review-needed', featureResult.summary.complete === 1 && featureResult.summary.partial === 1 && featureResult.summary.blocked === 1 && featureResult.summary.review_needed === 2)
  const featureHtml = renderFeatureHtml(featureResult, { baseline: 'test' })
  ok('feature dashboard renders red yellow black and green presentation', ['red', 'yellow', 'black', 'green'].every(color => featureHtml.includes(`class="card ${color}"`)))
  ok('feature console is summarized instead of dumping plain text', renderFeatureConsole(featureResult).includes('PRÓXIMAS DECISIONES') && renderFeatureConsole(featureResult).includes('Revisión humana'))
  const featureCli = spawnSync('node', [CONTROL, 'features'], { cwd: featureRoot, encoding: 'utf8' })
  ok('features command presents the four visual states', featureCli.status === 0 && ['🔴', '🟡', '⚫', '🟢'].every(icon => featureCli.stdout.includes(icon)))
  const filteredFeatures = reconcileFeatures({ root: featureRoot, config: { reconcile: { roots: ['docs/plan'], file_names: ['partial.md'] } }, tickets: [] })
  ok('project config can restrict which markdown files represent features', filteredFeatures.scanned === 1 && filteredFeatures.features[0].title === 'Portal')

  const contractRoot = createRepo(sandbox, 'Contract Inventory')
  mkdirSync(join(contractRoot, 'docs', 'specs', 'verified'), { recursive: true })
  mkdirSync(join(contractRoot, 'docs', 'specs', 'missing'), { recursive: true })
  mkdirSync(join(contractRoot, 'docs', 'specs', 'future'), { recursive: true })
  mkdirSync(join(contractRoot, 'docs', 'specs', 'decision'), { recursive: true })
  mkdirSync(join(contractRoot, 'docs', 'specs', 'sections'), { recursive: true })
  mkdirSync(join(contractRoot, 'docs', 'specs', 'proposal'), { recursive: true })
  mkdirSync(join(contractRoot, 'src'), { recursive: true }); mkdirSync(join(contractRoot, 'tests'), { recursive: true })
  writeFileSync(join(contractRoot, 'src', 'verified.js'), 'export const verified = true\n')
  writeFileSync(join(contractRoot, 'tests', 'verified.test.js'), '// verified\n')
  writeFileSync(join(contractRoot, 'docs', 'specs', 'verified', 'spec.md'), `---\nfeature_schema: 1\nfeature_id: F-001\nscope_status: complete\nimplementation_status: complete\nverification_status: verified\nevidence_code: [src/verified.js]\nevidence_tests: [tests/verified.test.js]\n---\n# Feature verificada\n`)
  writeFileSync(join(contractRoot, 'docs', 'specs', 'missing', 'spec.md'), `---\nfeature_schema: 1\nfeature_id: F-002\nscope_status: complete\nimplementation_status: complete\nverification_status: verified\nevidence_code: [src/missing.js]\n---\n# Evidencia rota\n`)
  writeFileSync(join(contractRoot, 'docs', 'specs', 'future', 'spec.md'), `---\nfeature_schema: 1\nfeature_id: F-003\nscope_status: future\nimplementation_status: not_started\nverification_status: pending\n---\n# Feature futura\n`)
  writeFileSync(join(contractRoot, 'docs', 'specs', 'decision', 'spec.md'), `---\nfeature_schema: 1\nfeature_id: F-004\nscope_status: complete\nimplementation_status: not_started\nverification_status: pending\nhuman_decisions: [elegir proveedor]\n---\n# Decisión humana\n`)
  writeFileSync(join(contractRoot, 'docs', 'specs', 'sections', 'spec.md'), `# Spec con dos features\n\n<!-- forge-feature\nfeature_id: F-005\ntitle: Sección completa\nscope_status: complete\nimplementation_status: complete\nverification_status: verified\nevidence_code: [src/verified.js]\n-->\n## Sección completa\n\n<!-- forge-feature\nfeature_id: F-006\ntitle: Sección futura\nscope_status: future\nimplementation_status: not_started\nverification_status: pending\n-->\n## Sección futura\n`)
  writeFileSync(join(contractRoot, 'docs', 'specs', 'proposal', 'spec.md'), `---\nfeature_schema: 1\nfeature_id: F-007\ntitle: Feature enrutable\nscope_status: complete\nimplementation_status: partial\nverification_status: pending\ndomain: general_code\nartifact_type: code\n---\n# Feature enrutable\n`)
  const contractResult = reconcileFeatures({ root: contractRoot, config: { reconcile: { roots: ['docs/specs'], file_names: ['spec.md'] } }, tickets: [] })
  ok('feature contract verifies real code and test paths', contractResult.features.find(feature => feature.feature_id === 'F-001')?.classification === 'complete')
  ok('missing declared evidence becomes a contradiction', contractResult.features.find(feature => feature.feature_id === 'F-002')?.classification === 'contradiction')
  ok('future scope is separated from actionable work', contractResult.features.find(feature => feature.feature_id === 'F-003')?.classification === 'future' && !contractResult.actionable.some(feature => feature.feature_id === 'F-003'))
  ok('human decisions block implementation explicitly', contractResult.features.find(feature => feature.feature_id === 'F-004')?.classification === 'blocked')
  ok('one spec can expose independent feature sections without a duplicate document card', contractResult.features.filter(feature => feature.spec.startsWith('docs/specs/sections/spec.md#')).length === 2 && !contractResult.features.some(feature => feature.spec === 'docs/specs/sections/spec.md'))
  const contractProposals = buildProposals(contractResult, domain => ({ blocked: false, domain, builder_skills: ['builder'], review_skills: ['reviewer'], evidence: ['tests'] }))
  const eligibleProposal = contractProposals.find(proposal => proposal.feature_id === 'F-007')
  ok('proposals route only declared domains and remain pending approval', eligibleProposal?.eligible_for_ticket === true && eligibleProposal.route?.builder_skills.includes('builder') && eligibleProposal.approval === 'pending')
  ok('human decisions never become automatic tickets', contractProposals.find(proposal => proposal.feature_id === 'F-004')?.eligible_for_ticket === false)
  ok('proposal ids are stable across repeated analysis', buildProposals(contractResult)[0].proposal_id === buildProposals(contractResult)[0].proposal_id)
  ok('proposal console states that no tickets were created', renderProposalConsole(contractProposals).includes('Ningún ticket fue creado'))
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

console.log(failed ? '\nFORGE KANBAN TESTS FAILED' : '\nALL FORGE KANBAN TESTS PASSED')
process.exit(failed ? 1 : 0)
