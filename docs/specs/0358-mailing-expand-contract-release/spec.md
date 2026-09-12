---
sdd: 0358
title: Separar expansión y restricción del release de Mailing
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0353
  - SDD-0357
confidencialidad: interno
---

# SDD-0358 — Release compatible de Cobranzas/Mailing

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 (`ea9952a4`; commit
> `fa420f3f`) con su contenido original, `status: done` incluido: describe el cierre técnico local de la
> rama de origen, no un release. `0410_collections_mail_context` y `0415_mail_logs_read_rbac` están
> **PENDIENTES DE APLICAR** y declaradas por separado en `supabase/migrations-baseline.json`; fusionar no
> autoriza aplicar ninguna. Lote L10 del bloque C: **0410 → despliegue y verificación de Cobranzas →
> 0415**. Precisión medida en local sobre `main`: si 0415 se aplica con el consumidor anterior todavía
> desplegado no hay error; RLS devuelve cero filas de `mail_logs` a accounting y la vista previa pierde
> las quejas de spam y el último recordatorio. La «Evidencia local de cierre» conserva las cifras de la
> rama de origen; las de esta importación, el inventario de lectores de `mail_logs` y los locks están en
> `.agents/handoffs/c-l10-recordatorios-cobranzas.md`. No se importan el checklist
> `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la allowlist;
> entran fuera de ella los dos registros de migraciones pendientes, que exigen los gates
> `migrations-applied` y `pending-migration-symbols`, y ese handoff.
>
> **Desviaciones respecto del origen**, decididas por el Director el 2026-09-12 antes de cualquier
> aplicación. `0410` y `0415` fijan `set local lock_timeout = '5s'` y `statement_timeout = '60s'` antes
> de su primer lock: `0415` toma ACCESS EXCLUSIVE sobre `mail_logs` y, sin tope, su espera dejaba en
> cola envíos, webhook de Resend, crons y la consola de Mailing. Se conserva la recomendación de
> aplicar `0415` en baja actividad de correo. `0410` además normaliza el email como
> `String.prototype.trim()` de JS en ambos lados (detalle en SDD-0353). Los contratos `0410` y `0415`
> agregan las aserciones estáticas de los timeouts y los casos de normalización, así que ya no son
> idénticos al origen.

## Hallazgo

0410 creaba `collections_mail_context` y cerraba la lectura de `mail_logs` en
la misma transacción. Aplicar primero esa migración rompía la consulta antigua
de Cobranzas; desplegar primero el código nuevo dejaba una RPC ausente.
No existe un orden sin corte demostrado para esa versión del paquete.

0410 fue creada en este trabajo, no se publicó ni aplicó desde esta tarea.
El fetch y `git branch -a --contains e0c560a6` sólo encuentran esta rama; el
archivo está ausente de `origin/main`. Se corrige antes de su primera aplicación,
sin renumerar ni modificar migraciones históricas ya aplicadas.

## Decisión

1. 0410 sólo agrega el facade mínimo y sus ACL de función; no cambia el SELECT
   histórico de `mail_logs`. Conserva compatibilidad durante el release.
2. Publicar la aplicación que consume el facade después de comprobarlo en DB.
3. 0415 cierra el SELECT a admin tras el smoke del consumidor; exige la RPC
   SECURITY DEFINER y la policy esperada. `service_role` conserva su uso interno.
4. Probar la misma matriz dos veces: después de expansión y después de restricción.
   El test 0415 reutiliza el fixture 0410 con una variable psql local al runner;
   ambas ejecuciones usan migraciones reales y terminan en rollback.
5. No agregar fallback al SELECT crudo en la aplicación nueva.

La compatibilidad temporal no es conformidad final de seguridad: 0415 sigue
siendo obligatoria para completar el cierre, con su autorización individual.

## Allowlist exacta

- `supabase/migrations/0410_collections_mail_context.sql`
- `supabase/migrations/0415_mail_logs_read_rbac.sql`
- `supabase/tests/0410_collections_mail_context.test.sql`
- `supabase/tests/0415_mail_logs_read_rbac.test.sql`
- `docs/specs/0353-collections-mail-context/spec.md`
- `docs/specs/0358-mailing-expand-contract-release/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-mailing-expand-contract-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Gate constitucional

| Principio | Resultado y evidencia |
|---|---|
| SGE-00.01 | cumplimiento: mismo resultado final con orden de release explícito |
| SGE-00.02 | cumplimiento: no muta ni purga filas; prueba de lectura compatible durante expansión |
| SGE-00.03 | cumplimiento: cambio de acceso R3, dos gates alojados separados |
| SGE-00.04 | no aplica: no cambia acciones de negocio ni auditoría |
| SGE-00.05 | cumplimiento: facade siempre exige accounting/admin; cierre final y tenant contratados |
| SGE-00.06 | cumplimiento: preflight rechaza dependencias o policies inesperadas |
| SGE-00.07 | cumplimiento: pruebas de las dos fases; ninguna equivale a un deploy medido |
| SGE-00.08 | no aplica: no cambia recorridos de usuario |
| SGE-00.09 | cumplimiento: reutiliza facade y fixture, sin nueva lógica de negocio |
| SGE-00.10 | no aplica: no cambia UI |
| SGE-00.11 | cumplimiento: checklist identifica qué se aplica antes/después de la app |
| SGE-00.12 | cumplimiento: autorizaciones Cloud y deploy no se infieren del cambio local |

MP-01: no modifica retención ni contenido de logs; no captura o traslada PII.

## Aceptación

- 0410 conserva lectura del tenant para el consumidor antiguo, nunca otro tenant.
- 0410 y 0415 devuelven idénticas señales mínimas a accounting/admin mediante RPC.
- 0415 deniega lectura directa a accounting/commercial, preserva admin del tenant
  y service_role, y no concede escritura a authenticated.
- SQL/rebuild completos, contrato unitario de Cobranzas, docs, numeración,
  gobernanza, componentes y diff pasan. El gate canónico de SDD-0357 permanece
  como baseline de aplicación: este slice sólo cambia SQL y documentación.

## Fuera de alcance

- Aplicar 0410/0415 o realizar despliegues, escrituras, secretos o cambios de datos.
- Cambiar proveedor de correo, frecuencia o criterio de recordatorios.
- Relajar el estado final admin-only o crear una excepción permanente.

## Evidencia local de cierre

- Cobranzas: 1 archivo / 3 pruebas unitarias aprobadas.
- SQL: 156 contratos aprobados, incluidos expansión 0410 y cierre 0415.
- Rebuild: 412 migraciones; 394 desde cero y 18 sólo-ledger; comprobación
  estructural de aislamiento sobre 219 tablas con dos tenants sintéticos.
- La aplicación conserva el baseline canónico posterior a SDD-0357: 527 archivos
  / 5.957 unitarios, 150 E2E aprobados / 18 omitidos y build de 158 páginas.
- Cierre técnico local; no demuestra migraciones, deploy ni smoke alojados.
