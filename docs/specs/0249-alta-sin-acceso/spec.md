---
sdd: 0249
title: Cliente con Shipping Mark y sin acceso al portal
status: in-progress
author: Claude (ventana auditoría 2026-08-05)
created: 2026-08-05
updated: 2026-08-05
supersedes: null
superseded_by: null
related: [0042, 0059, 0248]
confidencialidad: interna
---

# SDD-0249 · Cliente con Shipping Mark y sin acceso al portal

## Problema

`registerClientAction` hace, en este orden:

1. crea el cliente y le emite el MARKBOX
2. le crea la cuenta de auth
3. **inserta `client_users`** ← le da el acceso
4. le manda el correo de bienvenida invitándolo al portal

El paso 3 es best-effort: si falla, se escribe un `console.error` y el alta
devuelve éxito igual. El cliente queda con `portal_approved_at` puesto —o sea,
**"activo" en toda la UI**— y sin cuenta con la cual entrar.

Nadie se entera. Ni él (le dijimos que entrara), ni el equipo (la ficha se ve
normal).

### Ya pasó

Medido en producción el 2026-08-05: **DTD-9017**, alta del 15 de julio por el
registro self-service. Recibió su correo de bienvenida (1 entregado, confirmado
por el webhook) y **no tenía fila en `client_users`**.

Y no se quedó en la teoría: **entró**. `auth.users.last_sign_in_at` = 15-jul
21:04. O sea, tiene cuenta de auth válida, el login funcionó, y el portal no
tenía cómo resolver de qué cliente es. El paso que faltaba no era la puerta: era
el vínculo.

Uno solo entre 432 altas — es raro. Pero estuvo **tres semanas invisible**, y lo
que hace visible a un fallo raro no es la suerte: es un check.

> **Reparación** (no la hace este SDD): la RPC `portal_invite_client` inserta
> exactamente esa fila y devuelve el token de reclamo, sin tocar la cuenta de
> auth existente. Vive en Studio › Administración.

## Diseño

**`lib/studio/alta-health.ts`**
- `listAltasSinAcceso()` — altas del portal marcadas activas y sin `client_users`.
- `buildAltaHealthMessage()` — puro y testeable; el mensaje trae el markbox
  (para buscarlo) **y la acción** (qué hacer). Un aviso sin la acción se lee una
  vez y se archiva.
  Apunta a **Studio › Administración** (`/studio/admin`), no a la ficha del
  cliente: quien provisiona el acceso es la RPC `portal_invite_client`
  (idempotente), y vive en el backfill del portal. Desde la ficha no se puede,
  así que mandar a `/studio/clientes` sería un callejón sin salida — hay un test
  que lo fija.

**`app/api/cron/alta-health/route.ts`** — diario, `0 12 * * *` (8am Caracas).
Auth por `CRON_SECRET` en header. `?dry=1` clasifica sin avisar.

**`app/registro/actions.ts`** — si el insert falla, ahora el visitante recibe un
warning en vez de una pantalla que dice que todo salió bien.

### Decisiones

**Dos consultas y un diff en memoria, no el embed de PostgREST.** El
`select("...,client_users(id)")` depende de que la relación se resuelva sola, y
si no se resuelve **la respuesta viene vacía sin error**. Un check de salud que
devuelve `[]` en silencio dice "todo bien" para siempre — sería exactamente el
bug que vino a cazar.

**Sin estado de "ya avisé".** Un cliente sin acceso SIGUE roto hasta que alguien
lo arregla, así que repetir el aviso es correcto: no es ruido, es un pendiente
abierto. La ventana de 30 días acota el nagging.

**Ante un error leyendo `client_users`, se calla.** No se reporta "todos rotos":
un aviso falso de 50 clientes sin puerta quema la confianza en el aviso, y un
aviso en el que no se confía no sirve para nada.

**La condición `portal_approved_at is not null` es deliberada.** Sin ella
entrarían las fichas que a propósito todavía no se activaron. Lo que se busca es
la **contradicción**: el sistema dice "activo" y no hay con qué entrar.

**El warning de acceso pesa más que el del correo.** Si fallan los dos, gana
este (`??=`): sin puerta, que además no le haya llegado el correo es el menor de
sus problemas.

## Lo que este SDD NO hace

- **No repara DTD-9017.** Crear el acceso de un cliente real es una acción de
  operación, con nombre y apellido; va en la lista del founder.
- No mueve a outbox los otros 6 pasos best-effort del registro. Eso necesita
  migración y es el pendiente de raíz (ver el checklist maestro).

## Verificación

- `lib/studio/__tests__/alta-health.test.ts`
- `pnpm typecheck` · `pnpm lint` · `node scripts/verify.mjs`
- La consulta se validó contra producción: devuelve exactamente DTD-9017.
