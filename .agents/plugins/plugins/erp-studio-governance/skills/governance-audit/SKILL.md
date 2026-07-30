---
name: governance-audit
description: Audita de forma read-only la adopción de gobernanza en una superficie, módulo o flujo de DTDCargo. Usar para inventariar evidencia, priorizar riesgos R2/R3 y proponer slices con SDD propio sin modificar producto, ejecutar barridos masivos ni confundir ausencia de evidencia con cumplimiento.
---

# Governance Audit

## Flujo

1. Define superficie, módulo, flujo y muestra acotada.
2. Lee `docs/governance/AGENT-BRIEF.md` y el registro derivado.
3. Abre únicamente las políticas relacionadas.
4. Reúne evidencia estática y runtime disponible sin leer PII.
5. Ejecuta `node scripts/validate-governance.mjs`.
6. Clasifica cada hallazgo y separa deuda legacy del cambio actual.
7. Prioriza R2/R3 y propone slices pequeños con SDD y allowlist propios.

## Salida

Entrega una matriz con superficie, módulo, política, versión, riesgo, evidencia,
clasificación, slice recomendado y allowlist.

## Límites

- No corrijas hallazgos ni abras múltiples dominios en un mismo slice.
- No migres masivamente toasts, botones, selects, tabs o literales.
- No uses investigación como regla obligatoria.
- No llames Cloud, Auth, Vercel, MCP ni apps.
- Declara explícitamente lo no observado.
