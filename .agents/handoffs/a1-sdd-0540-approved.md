# Handoff · A1 · SDD-0540 a `approved` (solo docs)

| Campo | Valor |
|---|---|
| Fecha | 2026-11-02 |
| Rama | `claude/a1-sdd-0540-approved-f91fb0` |
| SDD | [0540](../../docs/specs/0540-entorno-prueba-staging/spec.md): `proposed` → `approved` |
| Alcance | spec 0540, `docs/specs/README.md` (generado) y este handoff. Sin `infra/`, sin `entorno-prueba.md`, sin AGENTS ni `project-rules.md` |

## COMPLETADO

1. `status: approved` y `updated: 2026-11-02` en la spec.
2. En §8, un bloque «Estado de aceptación de D1 a D11» con la fuente de cada una. No se inventó ninguna aprobación.

| Decisión | Estado |
|---|---|
| D1, D2, D3 | Aceptadas por Sam, texto literal en §8 |
| D7 | Aceptada por Sam (desconectar Vercel de GitHub ya). Su ejecución es **NO VERIFICADO** desde el repo |
| D4 | Sam eligió una variante: «Solo desde mis IP» (§10). La opción «clave sin allowlist» del §4 no la aceptó |
| D5, D6, D8, D9, D10, D11 | Aceptadas por Sam el 2026-11-02: «Confirmo todas» (pregunta nominal con las seis) |

## PROPUESTA NO ACTIVA — regla D6 (la decide Sam)

Destino sugerido: `docs/engineering/project-rules.md` (sección de migraciones/entorno de prueba), con una línea de puntero en `AGENTS.md` solo si Sam quiere que sea regla estable. Según AGENTS.md, el conocimiento nuevo se propone con destino y justificación antes de convertirse en regla.

> **Migraciones por prueba antes de producción.** Toda PR que añada o cambie una migración de base de datos se ensaya en `prueba.dtdcargo.com` antes de pedir el OK nominal de producción: (1) base de prueba reseteada a `main`; (2) smoke A, app de `main` con la migración aplicada; (3) smoke B, imagen del head de la PR; (4) Sam dice «aprobado en prueba»; (5) el pedido de OK nominal cita el md5 de la migración, la salida del apply en prueba, los smokes y el SHA; (6) tras aplicar en producción, el md5 del ledger de producción debe ser igual al de prueba. La evidencia vale para un solo SHA: un commit nuevo que toque la migración o el código que la usa obliga a repetir (1) a (4). Las PR solo de docs o de harness no pasan por prueba. Esta regla no sustituye el OK nominal de Sam ni el runbook de producción.

Justificación: producción usa datos reales; prueba reproduce exactamente la ventana migrate-first con datos sintéticos (spec 0540 §2.6). Estado: **PROPUESTA**, no vigente hasta que Sam la apruebe.

## Comprobaciones de cierre

| Comprobación | Resultado |
|---|---|
| `corepack pnpm docs:index` | PASÓ (566 specs) |
| `corepack pnpm docs:check` | PASÓ |
| `corepack pnpm sdd:check` | PASÓ (choques históricos ya aplicados, sin números nuevos repetidos) |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: solo docs |

## PENDIENTES DE ESTA TAREA

- Sam aprueba o rechaza el texto de la regla D6 para AGENTS/project-rules (aceptó la decisión D6, no el texto).
- Variante de D4: solo si Sam quiere abrir otras redes.

## FUERA DE ALCANCE DETECTADO

- Confirmar que Vercel quedó desconectado de GitHub (D7): se opera fuera del repo.
- `docs/runbooks/entorno-prueba.md` debe reflejar el estado de D4 (IP + clave): lo edita A4.
