---
sdd: "0481"
title: "Portal cliente — cambiar la foto de cédula/RIF dentro del cupo de 3 cambios"
status: in-progress
author: "Claude + founder"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0439", "0438", "0151", "0145"]
confidencialidad: interna
---

# SDD-0481 · Cambiar la foto de cédula/RIF desde el Portal

## Pedido

Sam, 2026-09-18: *«en el portal del cliente, el usuario tiene que poder editar
la foto que subió de su cédula o de su RIF. Están subiendo por error fotos que
no son y ya no las pueden cambiar. […] hasta tres cambios».*

## Estado encontrado (2026-09-18)

| Pieza | Estado | Evidencia |
|---|---|---|
| Cupo compartido de 3 cambios | Aplicado en producción | `0445_portal_profile_edit_limit` (ledger `20260904193612`) |
| RPC `portal_set_identity_photo` que invalida la verificación | Aplicada | `0446_portal_profile_functional_remediation` (ledger `20260910165737`); `md5(prosrc)` en producción = `057aea5c2260562e99c757533aad55a6`, idéntico al del repo |
| Gate que bloquea todo reemplazo | Aplicado y activo (`tgenabled = O`) | `0447_identity_photo_replacement_privacy_gate` (ledger `20260910164232`) |
| UI | Con foto cargada sólo muestra «Ver» y deriva a soporte | `app/portal/(app)/perfil/CedulaPhotoRow.tsx` en `b43a39a5` |

El cupo, la primera foto gratis y la invalidación de la verificación ya existían.
Lo único que impedía el cambio era la contención de SDD-0439 (punto 4 de su
contrato funcional). Este SDD la retira por decisión de Sam.

## Contrato funcional

1. Con foto cargada y cupo disponible, la fila muestra «Ver» y «Cambiar foto».
2. «Cambiar foto» no abre el selector de inmediato: primero informa que usa 1 de
   los N cambios disponibles y que el asesor revisa la nueva. «Elegir foto nueva»
   abre el selector; «Cancelar» cierra sin efecto.
3. El reemplazo consume un cambio del cupo **compartido** con las solicitudes de
   datos (nombre, cédula/RIF, teléfono). Una solicitud pendiente reserva cupo.
4. Sin cupo, o si el cupo no se puede leer, no se ofrece reemplazar: la fila dice
   por qué y enlaza a soporte. La action lo repite en servidor **antes de subir**
   el archivo, y la RPC lo impone de nuevo con lock por fila.
5. La primera foto sigue siendo gratis y no pide confirmación.
6. Reemplazar invalida la verificación de identidad previa (0446): el asesor
   revisa la foto nueva.
7. La foto sustituida **se conserva** como versión: el objeto queda en el bucket
   privado y su ruta sólo en el ledger `client_profile_edits` (sin grants). No
   aparece en el Portal ni en el Studio.

## Decisión de retención y gobernanza

**Se conserva la foto sustituida; no se borra al reemplazar.**

- MP-01 (aprobada, normativa) §9: hasta tener purga gobernada, hold y pruebas,
  el default es *«no purgar; archivar, anular o conservar»*. §10: cero
  hard-delete visible sin clasificación P0 explícita. MP-D6: *«reemplazar
  evidencia crea una versión; no sobrescribe el original que ya sustentó una
  decisión»* — la foto anterior pudo sustentar una verificación.
- La directiva propuesta `docs/legal/privacidad/fotos-identidad-cliente-v1.md`
  (no vigente) fija un máximo de 30 días para la histórica. La purga que la
  cumple **no existe**; este SDD no la implementa ni la anuncia.
- El cupo acota el inventario: como máximo 3 versiones sustituidas por cliente.

Se evaluó y **no** se adoptó borrar la anterior al confirmar el reemplazo:
minimiza PII, pero es un hard-delete sin clasificación P0, contradice MP-D6 y
no tiene hold.

**Decisión de Sam (2026-09-18):** conservarla. Respuesta literal a la pregunta
«Al reemplazar la foto de cédula/RIF, ¿qué pasa con la foto anterior?»:
«Conservarla (Recomendado)».

## Persistencia

Migración `0461_identity_photo_replacement_enable.sql`:

- preflight: exige el trigger de 0447 enganchado a su función y el cuerpo 0446
  de `portal_set_identity_photo` (`profile_edit_limit_reached` +
  `doc_verify_status = null`); si falta, aborta sin cambiar nada;
- retira el trigger `client_profile_edits_identity_photo_privacy_gate` y la
  función `block_identity_photo_replacement_without_privacy_controls()`;
- documenta `client_profile_edits.previous_storage_path` como versión conservada;
- no toca filas, grants, RLS ni la RPC.

Orden con el despliegue: **migración primero**. Los datos quedan seguros en
cualquier orden, pero no la experiencia del cliente:

- App vieja + 0461: la action vieja sigue cortando el reemplazo antes de subir,
  así que no cambia nada visible.
- App nueva sin 0461: el Portal ofrece «Cambiar foto», pero la RPC rechaza con
  `identity_photo_replacement_temporarily_disabled`. La action retira sólo el
  objeto nuevo y muestra «El cambio de foto todavía no está activo…».

Decisión de Sam (2026-09-18), a propuesta de dtdcargo-18: «Migración primero
(Recomendado)». Es su OK nominal para
`0461_identity_photo_replacement_enable`, aplicada por la sesión coordinadora en
su ventana, antes de integrar esta PR.

## Datos personales · revisión VE/CN (método `revisar-datos-ve`)

| Estado | Evidencia |
|---|---|
| ENCONTRADO | La foto de cédula/RIF es dato personal sensible; el reemplazo crea una versión histórica en `client-docs` y una ruta en `client_profile_edits` (`supabase/migrations/0445_portal_profile_edit_limit.sql:41-74`). |
| CORRECTO | Identidad sólo por sesión (`get_portal_client_id`), prefijo `tenant/markbox`, objeto verificado en `client-docs` y lock por fila en la RPC (`supabase/migrations/0446_portal_profile_functional_remediation.sql:221-355`). |
| CORRECTO | El ledger no tiene grants para `anon`, `authenticated` ni `service_role`; lo comprueba el contrato `supabase/tests/0461_identity_photo_replacement_enable.test.sql` (CONTRATO 2). |
| CORRECTO | La auditoría registra `client_identity_photo_replaced` sin rutas ni valores personales (CONTRATO 8). |
| CORRECTO | El cupo impide más de 3 versiones sustituidas por cliente (CONTRATOS 5 y 9). |
| ENCONTRADO | No existe purga a 30 días, legal hold ni separación de acceso VE/CN para `client-docs`; la policy de `0091` sigue permitiendo lectura a miembros del tenant. Con 0461 las versiones sustituidas se conservan sin plazo hasta que exista la purga. |
| NO VERIFICABLE | Fundamento legal por categoría, holds reales y copias de proveedor requieren validación humana/profesional. |

Esta revisión técnica no constituye asesoría legal.

## Gobernanza

| Política | Clasificación | Aplicación |
|---|---|---|
| SGE-00 | cumplimiento | El límite vive en servidor/DB; la UI informa costo, estado y siguiente paso. |
| MP-01 | cumplimiento del default §9 · no conformidad heredada | Se conserva la versión (MP-D6) y no hay hard-delete. Sigue abierta la falta de disposición gobernada de históricos que SDD-0439 contenía con 0447; ahora queda acotada por el cupo, no bloqueada. |
| BTN-01 / A11Y-01 | cumplimiento | Botones con nombre accesible, `aria-expanded`/`aria-controls`, foco al abrir la confirmación y área táctil `min-h-11`/`.btn`. |
| UPL-01 | cumplimiento | Tipo, tamaño y privacidad explicados; sin cupo no se inicia la subida; rechazo confirmado retira sólo el objeto nuevo. |
| AUD-01 / AUD-02 | cumplimiento | Sin cambios: la RPC 0446 audita el reemplazo sin PII. |
| ERR-01 / FRM-01 / LOD-01 | cumplimiento | Mensajes junto a la fila en `role="status"` montado, estado «Subiendo…». |

## Allowlist exacta

- `docs/specs/0481-portal-cliente-reemplazo-foto-identidad/spec.md`
- `docs/specs/README.md` (generado)
- `docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md` (nota de reemplazo del punto 4)
- `docs/legal/privacidad/fotos-identidad-cliente-v1.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/legal/privacidad/registro-tratamiento.md`
- `supabase/migrations/0461_identity_photo_replacement_enable.sql`
- `supabase/tests/0461_identity_photo_replacement_enable.test.sql`
- `supabase/migrations-baseline.json`
- `lib/portal/__tests__/identity-photo-replacement.migration.test.ts`
- `app/portal/(app)/perfil/actions.ts`
- `app/portal/(app)/perfil/CedulaPhotoRow.tsx`
- `app/portal/(app)/perfil/page.tsx`
- `app/portal/(app)/perfil/IdentityPhotoAction.test.ts`
- `app/portal/(app)/perfil/ProfileEditControls.test.tsx`
- `app/portal/(app)/perfil/page.private-context.test.tsx`
- `.agents/handoffs/2026-09-18-portal-cliente-reemplazo-foto-identidad.md`

## Verificación exigida

- Contrato SQL 0461 sobre la cadena real 0445 → 0446 → 0447 → 0461, con control
  rojo sin 0461 y los dos preflights (PGlite en Vitest; Docker en `verify`).
- Pruebas de la action con stub y con el SDK Supabase real sobre transporte
  offline: cupo agotado/ilegible sin upload, reemplazo feliz sin borrado,
  respuesta perdida, rechazos del gate y del límite.
- Pruebas de UI: confirmación de 2 pasos, singular, sin cupo, cupo ilegible,
  primera carga.
- Mutantes: cada guard nuevo debe tener una prueba que falle al quitarlo.
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`, `pnpm sdd:check`,
  `pnpm governance:check`, `pnpm components:check`,
  `node scripts/check-pending-migration-symbols.mjs` y `pnpm verify`.

## Release

1. Aplicar `0461_identity_photo_replacement_enable` de forma individual, según
   `docs/runbooks/aplicar-migraciones-prod.md`. OK nominal de Sam del
   2026-09-18; ventana y aplicación a cargo de la sesión coordinadora.
2. Integrar la PR en su turno de la cola (despliega el código a producción).
3. Smoke con una cuenta Portal que Sam autorice: cambiar la foto, ver que el
   contador baja uno y que en el Studio la verificación vuelve a pendiente con
   la foto nueva.

## Fuera de alcance

- Purga a 30 días de versiones sustituidas, legal hold y gate regional de
  `client-docs` (SDD propio).
- Borrado inmediato de la foto sustituida (sólo como excepción autorizada).
- Cambiar el cupo, el email o el Shipping Mark.
