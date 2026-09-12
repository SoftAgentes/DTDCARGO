---
sdd: "0453"
title: "Mailing — guard admin en el envío de prueba de plantillas"
status: done
author: "Claude Code (Worker mailing-test-template-admin-guard)"
created: 2026-09-11
updated: 2026-09-11
supersedes: null
superseded_by: null
related: ["0026", "0085", "0143", "0252"]
confidencialidad: interno
---

# SDD-0453 — Mailing: guard admin en `sendTestTemplateAction`

> Cierra en la app el único hueco RBAC de las 15 Server Actions de Mailing: mandar la prueba de una plantilla no exigía rol admin.

## Contexto

- Mailing es admin-only duro (SDD-0085 §2). `mailing` está en `ADMIN_ONLY_MODULES` y en `LOCKED_MODULES` (`lib/studio/rbac.ts:143, 173-188`), así que ningún override por rol (SDD-0252) lo abre.
- La vista ya está gateada: `app/studio/(app)/mailing/layout.tsx:12` (`requireModuleView("mailing")`) y `page.tsx:100-102` (redirect si `role !== "admin"`).
- Una Server Action se puede invocar como endpoint sin renderizar su page (SDD-0085 §3 y §5). Por eso cada mutación valida su propio permiso con `moduleEditDenial(supabase, "<id>")`.
- En `app/studio/(app)/mailing/actions.ts`, 14 de las 15 actions lo llaman. `sendTestTemplateAction` (`:111-161` en `3c610701` y en `07d00097`) no lo llama. Cualquier miembro autenticado del tenant podía invocarla, leer la plantilla con su sesión y mandarse la prueba vía `createAdminClient()` y `sendEmail`. Ese envío inserta en `mail_logs` y consume Resend.
- El anti-drift `lib/studio/rbac-actions-guard.test.ts` valida por archivo (`src.includes("moduleEditDenial")`) y no lo detectó: el archivo pasa gracias a las otras 14 actions.
- El hallazgo sale de la auditoría del lote L08 del bloque C (PR #74, SDD-0351): fila c4 y FUERA DE ALCANCE #1 de su handoff. La migración `0408_mailing_admin_rbac` de esa PR cierra el acceso en la base, pero está pendiente de aplicar y el guard de app corresponde igual. Esta spec no depende de 0408 ni la toca.

## Alcance

1. `sendTestTemplateAction` llama `moduleEditDenial(supabase, "mailing")` inmediatamente después de `createClient()`. Es la misma posición que en `createMailRuleAction`, `addMailBlacklistAction` y `scheduleEmailAction`: antes de `auth.getUser()`, del lookup de tenant, de leer `mail_templates`, de crear el admin client y de enviar. Se reutiliza el helper; no se duplica lógica de rol.
2. Test Vitest focal `app/studio/(app)/mailing/__tests__/send-test-template-admin-guard.test.ts`, con el guard y la matriz reales. Solo se reemplazan los bordes: sesión, admin client, `sendEmail`, `revalidatePath` y overrides por rol.

## Comportamiento

| Caso | Antes | Después |
|---|---|---|
| Rol no-admin (`commercial`, `operations`, `accounting`, `warehouse`, `support`, `marketing`) | Lee la plantilla y se manda la prueba | `{ error: "No tienes permiso para realizar esta acción." }`, sin leer la plantilla ni enviar |
| No-admin con override por rol sobre `mailing` | Se manda la prueba | Denegado: `mailing` es LOCKED |
| Sin sesión | «Inicia sesión primero.», sin efectos | Denegación del guard, sin efectos, igual que las otras actions del módulo que consultan la sesión |
| Admin activo | Envía la prueba a su correo | Sin cambios: mismos argumentos de `sendEmail`, mismo mensaje y `revalidatePath("/studio/mailing")` |

## Aceptación

1. El guard está en la posición del punto 1 del Alcance.
2. Con cada rol no-admin de `STUDIO_USER_ROLES`, la action devuelve la denegación y no lee `mail_templates`, no crea el admin client ni llama `sendEmail` o `revalidatePath`.
3. Un override `marketing:mailing` con `view` y `edit` no cambia el resultado.
4. Sin sesión no hay envío.
5. El admin conserva el envío descrito en la tabla.
6. Los criterios 2 y 3 fallan sin el guard y pasan con él. La evidencia está en el handoff.
7. `pnpm verify` se registra por paso y ningún paso falla por este cambio. E2E autenticado y `migrations-applied` quedan NO DISPONIBLE: no hay credenciales y no se copian secretos.

## Allowlist exacta

- `app/studio/(app)/mailing/actions.ts` (solo `sendTestTemplateAction`)
- `app/studio/(app)/mailing/__tests__/send-test-template-admin-guard.test.ts`
- `docs/specs/0453-mailing-test-template-admin-guard/spec.md`
- `docs/specs/README.md` (regenerado con `pnpm docs:index`)
- `.agents/handoffs/mailing-test-template-admin-guard.md`

## Gobernanza (AGENT-BRIEF)

| Principio | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 permisos y tenant | cumplimiento | Prueba negativa por cada rol no-admin, por override sobre módulo LOCKED y sin sesión. La UI (layout y page) sigue gateando, pero ya no es la única defensa. El tenant del envío sigue saliendo de la membresía de la sesión |
| SGE-00.06 prevenir antes de informar | cumplimiento | El permiso se evalúa antes de cualquier lectura o efecto |
| SGE-00.11 y ERR-01 | cumplimiento | Mensaje de denegación estándar del Studio (`lib/studio/rbac-guard.ts:182`); el drawer ya muestra `testState.error` (`TemplateEditorDrawer.tsx:376-384`) |
| AUD-01 y AUD-02 | no aplica | No se agrega mutación ni evento; el envío de prueba del admin sigue registrando `mail_logs` vía `sendEmail` |
| SGE-00.01-04, .07-.10 y .12; MP-01; BTN-01; VIS-01/02; MOT-01; CMP-01; IA-01 | no aplica | Sin UI, verbos, borrado, permanencia, componentes ni IA |
| Datos personales (`revisar-datos-ve`) | no aplica | No se captura, mueve ni borra un dato personal; el cambio reduce quién puede disparar un envío |

## No-objetivos

- No toca `0408_mailing_admin_rbac` ni ninguna migración, SQL o RLS.
- No cambia UI ni copy. El copy que queda desactualizado al aplicar 0408 sigue registrado en el handoff de L08.
- No endurece el anti-drift a nivel de función; queda como candidato de seguimiento en el handoff de esta tarea.
- No cambia las otras 14 actions del módulo.
