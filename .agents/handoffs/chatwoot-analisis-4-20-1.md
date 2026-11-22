# Handoff · Análisis de la subida de Chatwoot 4.20.0 → 4.20.1

- **Owner:** Worker (sesión `chatwoot-analisis-actualizacion`), encargado por Dir_DTD el 2026-11-22.
- **Rama / worktree:** `claude/chatwoot-analisis-actualizacion-ffdb7d` en `.claude/worktrees/chatwoot-analisis-actualizacion-ffdb7d`.
- **SDD:** ninguna nueva. Es un informe en `docs/runbooks/`, bajo SDD-0588 (procedimiento) y siguiendo SDD-0679 (subida anterior).
- **Alcance:** solo docs. Prohibido tocar Chatwoot de producción, el VPS, instalar o leer datos de clientes. Nada de eso se hizo.

## OBJETIVO ORIGINAL

Pedido de Sam, textual: «Actualización de Chatwoot: revísame para instalar la actualización de Chatwoot y analiza qué podemos hacer, sus riesgos, cómo mitigar esos riesgos, qué conviene actualizar y por qué».

## COMPLETADO

- Panel «Análisis del salto» ubicado (`app/studio/(app)/admin/actualizaciones/`, `lib/studio/chatwoot/analisis*.ts`, `versiones-fuentes.ts`). El salto es 4.20.0 (instalada) → 4.20.1 (publicada el 2026-11-20).
- Notas de la release, PR #16651 (imagen) y #16359 (gzip) y diff `compare/v4.20.0...v4.20.1` leídos por la API pública de GitHub. Sin migraciones.
- Configuración de la imagen leída en Docker Hub (R), sin bajarla; digests anotados.
- Informe: `docs/runbooks/chatwoot-analisis-4-20-1.md` (fila por fila, riesgos, plan, decisiones A/B).

## VALIDACIÓN

- `git diff --check`: PASÓ.
- Pruebas de producto: NO APLICA (cambio solo de docs).
- Ensayo de la imagen: va en la PR #779 (rama `codex/chatwoot-v4-20-1`), con turno del Director.

## PENDIENTES DE ESTA TAREA

- Ninguna de decisión: D1–D4 ya están tomadas por Sam el 2026-11-22 (A, A, A y hoy). Quedan el ensayo y la revisión de la #779.

## FUERA DE ALCANCE DETECTADO

- El informe «sin IA» del panel marca `Gemfile.lock` como riesgo medio en cada versión aunque no cambien las gemas de la pieza (falso positivo). Mejora: gemas por pieza.
- El smoke de la 4.20.0 es el paso 1 del plan (§6) y se cerró el 2026-11-22: SSO, Bandeja, nota privada y Ficha DTD en verde. El contador no se midió.

## Impacto documental

- Nuevo: `docs/runbooks/chatwoot-analisis-4-20-1.md`. No cambia ningún canónico. Cuando se suba, la fila va al Registro de `chatwoot-versiones.md`.
