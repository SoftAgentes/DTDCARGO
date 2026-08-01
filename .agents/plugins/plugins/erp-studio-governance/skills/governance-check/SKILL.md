---
name: governance-check
description: Revisa de forma read-only un cambio, diff, SDD o componente de DTDCargo contra las políticas aprobadas del ERP Studio. Usar antes de implementar, commitear o aprobar un slice de UI, comportamiento o componentes; clasifica cumplimiento, no aplica, excepción y no conformidad sin editar archivos ni elevar recomendaciones a reglas.
---

# Governance Check

## Flujo

1. Resuelve el root del repositorio con `git rev-parse --show-toplevel` desde
   el directorio de trabajo. Falla cerrado si no es DTDCargo.
2. Lee `docs/governance/AGENT-BRIEF.md` y
   `references/policy-registry.json`.
3. Selecciona sólo las políticas aplicables y abre sus rutas normativas.
4. Inspecciona el diff o allowlist solicitado. No amplíes el alcance.
5. Ejecuta `node <plugin-root>/scripts/validate-governance.mjs` con el root del
   repositorio como directorio de trabajo.
6. Clasifica cada evidencia como `cumplimiento`, `no aplica`, `excepción` o
   `no conformidad`.

## Salida

- superficie y módulo;
- política y versión;
- evidencia con ruta;
- clasificación;
- riesgo R1/R2/R3 y gate siguiente.

## Límites

- Sólo reglas aprobadas pueden bloquear.
- No edites, no promociones estados CMP y no crees excepciones.
- No llames Cloud, Auth, Vercel, MCP ni apps.
- No conviertas conteos estáticos en conformidad.
- El repositorio es la fuente; el registro del plugin es derivado.
