# Handoff · SDD-0652 — Ficha 360° del empleado

- **Owner:** Claude Worker `w-0652-ficha-empleado` (sesión hija del DG)
- **Ruta:** `.claude/worktrees/0652-ficha-empleado-360-9e19a0`
- **Rama:** `claude/0652-ficha-empleado-360-9e19a0`, base `main` `26a9a911e`
- **SDD:** `docs/specs/0652-ficha-empleado-360/spec.md` (`proposed`). Número asignado por el DG. Migración reservada: **0555** (F2). La 0554 es de la SDD-0650 F2.
- **Encargo:** Fase 1, análisis y spec. Sin implementación. Publicar rama y PR borrador; no fusionar.

## OBJETIVO ORIGINAL

Medir la ficha de empleado de Nómina, la ficha de usuario, el seguimiento y los inicios de sesión; responder por qué no se ve el correo ni se entra al detalle; proponer el enlace explícito empleado ↔ usuario con el caso «sin usuario» previsto; escribir la spec con fases, allowlist, migración y decisiones; cubrir privacidad.

## COMPLETADO

- Spec con medición citada (§2), respuestas (§3), enlace (§4), diseño basado en la 0650 y el Expediente del Norte (§5), fases F1-F5 (§6), allowlist F1 y F2 (§7), D1-D13 (§8), privacidad (§9), gobernanza (§10), aceptación (§11).
- Índice `docs/specs/README.md` regenerado con `node scripts/build-docs-index.mjs`.

## Revisión independiente del DG (18441e8b7, CHANGES REQUESTED)

Cada hallazgo se verificó en el código antes de corregir:

| Hallazgo | Verificado en | Corrección en la spec |
|---|---|---|
| H1: ya no hay CHECK de `entity_type` | `0261:119-133`, `0538:292-299` | Tipos en `audit_entity_types` con su `domain_code` (§F2) |
| H2: la retención choca con AUD-02 §5 y §8 | `aud-02.md` §5 y §8, `retention-schedule-v1.md` §3, `0304:68-69`, `:103-105` | Enmienda v1.1 del calendario, clase `security` de 2 años, lote controlado; sin purga mientras no se apruebe (§F3, D6) |
| H3: a la 0555 le faltaban preflight, topes, grant y límites del bucket | `0261:19-20`, `0457:103-105`; la `0199` no crea bucket | §F2, pasos 1 a 6 |
| H4: `ensureEmployeeAuthUser` reutiliza cuentas | `nomina/actions.ts:1891-1927` (sin `client_users`; solo 200 usuarios) | §3.3, §4 punto 6, D2, H9, F5 |
| H5: Nómina sí audita la anulación de finiquitos | `0316:26-32`, `:191`, `:320` | §2.1 y la Línea de tiempo |
| H6: faltaba la clasificación de gobernanza | `AGENT-BRIEF.md` paso 4 | §10 |
| No bloqueantes | `NominaClient.tsx:712`, `rbac-guard.ts:156-157`, `password-confirmed.ts:70` | §2.1, §2.2, §F1, §F3, §F4, D7, D9, D13 |

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/check-numbering.mjs` | PASÓ (sin repetidos) |
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: cambio solo de documentos, sin `node_modules` en el worktree |
| Lectura de producción | NO EJECUTADO, a propósito |

## PENDIENTES DE ESTA TAREA

- Respuestas de Sam a D1-D13.
- Medidas marcadas NV en la spec: columnas e IP de `auth.audit_log_entries`/`auth.sessions` en GoTrue v2.197 (stack local) y qué IP llega detrás del borde. Van al inicio de la F3.
- El índice de specs choca con la PR #629 (agrega 0650/0651): al integrar, regenerar el índice.

## FUERA DE ALCANCE DETECTADO

- La ficha del empleado no audita cambios de sueldo, banco ni estado (AUD-01); los finiquitos sí (0316). La spec lo deja como F5.
- `audit_list_events` no filtra por actor, aunque AUD-02 §4 lo pide. La spec lo deja como F3 (reordenada).
- `nomina_employee_registrations.photo_path` sin escritor y con conservación indefinida (`registro-tratamiento.md:56`).
- `nomina_employees` sin plazo de conservación (`registro-tratamiento.md:55`).

## Impacto documental

- Nuevo: `docs/specs/0652-ficha-empleado-360/spec.md`. Regenerado: `docs/specs/README.md`.
- `registro-tratamiento.md` y `mapa-de-borrado.md` se actualizan en la F2/F3, no ahora (la spec es propuesta).

## HANDOFF AL DIRECTOR

PR borrador con la spec. El DG lanza la revisión independiente y asigna las fases cuando Sam responda.

## Re-revisión del DG (8dcb53734, APPROVED con ajustes menores)

Aplicados: D9 nombra las tres diferencias con AUD-02 §3 (sin motivo, sin reautenticación, Contabilidad también); F3 declara funciones de lote propias, porque las de 0304 solo leen `entity_audit_log` (`0304:57-72`); D7 dice lo que `after()` no resuelve (el tiempo de `signInWithPassword`, el límite de 200 de `listUsers`) y que la F3 lo mide; nota del primer uso del `domain_code` `security`. Pendiente: la revisión de Codex que pasará el DG.

## Revisión de Codex (sobre 8dcb53734, solo lectura), incorporada el 2026-11-17

Cada punto se verificó en el código antes de adoptarlo:

| Punto | Verificado en | En la spec |
|---|---|---|
| A1 control de rol y tenant en el servidor | `0181:77-82` (lectura propia), `0160:78-84` (`nomina_can_access` sin tenant), `rbac-guard.ts:156-157` | §2.2, §F1 punto 1, aceptación F1 |
| A2 correctivo de `ensureEmployeeAuthUser` antes del enlace | `nomina/actions.ts:1908-1924` (lee `data` sin mirar `error`: falla abierto) | §3.3, §4 punto 6, F2, D2 |
| A3 la cuenta completa ya viaja al navegador | `employee-queries.ts:13-17`, `nomina/page.tsx:67`, `:116-117`, `EmpleadoDrawer.tsx:277` | §2.1, §F1 punto 2, D9, H10 |
| A4 tres clases de inicio de sesión | `login/actions.ts:58-80` | §F4 |
| A5 «lo que hizo» acotado; Contabilidad con proyección laboral | `0398:105-120` | §F2 punto 6, §F3 |
| A6 la foto no es P0 | `mp-01.md` (P0 nunca es el default de una acción visible) | §F2, foto; §10 |
| A7 error ≠ ausencia, consultas acotadas, índice | `employee-queries.ts:39-42`, `:59-62` | §F1 punto 4, §F3 |
| A8 gobernanza como «diseño propuesto»; CMP-01 aplica | `cmp-01.md`; registro en `docs/governance/components/` | §10, §7 |
| B1-B5, C1-C3, D9, D11, D13 | — | §5, §6 «Después», §8 |

Otros hallazgos verificados: el `insert` directo en `entity_audit_log` está revocado (`0293:528`) y se escribe con `append_audit_event` (`0538:507`); suspender en `user_tenants` no corta `/m/emp` (`0181:48-62`, H11).

Fases reordenadas: F1 lectura segura → F2 identidad, revelado y foto (0555) → F3 «lo que hizo» → F4 inicios de sesión → F5 historial y alta con acceso.
