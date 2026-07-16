import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSimpleYaml } from './config.mjs'

export function loadRouter(skillRoot) {
  const path = join(skillRoot, 'references', 'capability-router.yaml')
  if (!existsSync(path)) throw new Error(`No existe capability router: ${path}`)
  const router = parseSimpleYaml(readFileSync(path, 'utf8'), path)
  if (!router.capabilities || typeof router.capabilities !== 'object') {
    throw new Error('Capability router sin capabilities')
  }
  return { ...router, path }
}

export function routeCapability(router, domain) {
  const capability = router.capabilities[domain]
  if (!capability) {
    return { blocked: true, domain, reason: `Capacidad desconocida: ${domain}`, suggested_skill: 'skill-creator' }
  }
  const status = capability.status || 'active'
  if (status !== 'active') return { blocked: true, domain, status, reason: `Capacidad ${domain} está ${status}` }
  return {
    blocked: false,
    domain,
    status,
    builder_skills: capability.builder_skills || [],
    review_skills: capability.review_skills || [],
    build_method: capability.default_method || 'conditional',
    evidence: capability.evidence || [],
  }
}

