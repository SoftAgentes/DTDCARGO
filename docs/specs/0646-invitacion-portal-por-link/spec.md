---
sdd: "0646"
title: "Invitación al portal por link: el cliente del legado completa SU ficha con su código de siempre"
status: in-progress
author: "Claude (Worker del DG) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0042", "0151", "0246", "0253", "0255", "0258", "0483"]
confidencialidad: interno
---

# SDD-0646 — Invitación al portal por link

> El equipo deja en la ficha el código real del cliente (o crea la ficha con ese código), genera
> desde la ficha un link de registro y lo manda por WhatsApp. El cliente llena sus datos con su
> código ya fijo y queda dentro de su portal. El equipo revisa después qué cambió.

**Estado:** `in-progress`. Código, migración y pruebas en la rama de esta SDD. La migración 0552 **no
está aplicada**: aplicarla en producción y fusionar a `main` necesitan autorizaciones separadas de Sam
a través del DG.

## 1. Problema

En agosto de 2026 entraron 361 clientes del sistema anterior. Hoy tienen código DTD-8001 a DTD-8361 y su
código viejo quedó como alias en `client_markbox_history`, que lo sigue resolviendo (SDD-0258, migr.
0367 y 0379). Casi ninguno tiene correo, empresa ni datos cargados, y ninguno tiene acceso al portal.

La invitación de hoy (SDD-0042) sale por correo, y de estos clientes no hay correo. El registro público
(`/registro`) les crearía una ficha nueva con un código nuevo: el duplicado que la SDD-0246 trata de
evitar.

## 2. Decisión de Sam (2026-11-16)

1. Alejandro (operaciones) deja en la ficha el código real del cliente, el viejo de siempre, o crea la
   ficha con ese código si no existe.
2. Desde la ficha genera un link de registro y lo manda por WhatsApp.
3. El cliente llena sus datos con su código ya fijo y queda dentro de su portal.
4. Alejandro revisa qué cambió.

## 3. Alcance

### 3.1 Link de registro (Studio, ficha del cliente)

- En «Acceso al portal» (`PortalAccessCard.tsx`), para el cliente **sin acceso activo**, el botón
  «Generar link de registro». Da un link copiable y un «Abrir WhatsApp con el link». No envía correo.
- Token de 32 bytes aleatorios (256 bits) en base64url. La base guarda **solo su sha256**. Un solo uso,
  vence a los 14 días, regenerar revoca el anterior (un índice único parcial impide dos vivos).
- La URL es `/registro/link/<token>`. **Nunca lleva el Shipping Mark**: si lo llevara, bastaría cambiar
  el número para quedarse con el portal de otro cliente.
- Lo emite la RPC `portal_registration_link_create` (roles admin, commercial y operations, tenant del
  usuario; rechaza al cliente con acceso activo, a la ficha borrada y a la fusionada).

### 3.2 Página pública

- `GET /registro/link/[token]` **solo lee** (`portal_registration_link_peek`): el robot de vista previa
  de WhatsApp hace GET y no debe gastar el link (lección de la SDD-0253). No se indexa.
- Muestra el Shipping Mark de la ficha **congelado**: sale de la base, no de la URL ni del formulario.
- Pide los datos del registro actual con los mismos campos (`RegisterForm.tsx` exporta `Field`,
  `CedulaInput`, `PhoneInput`, `CiudadEntrega`, `TypeCard`, `LeyendaObligatorio`) y valida con
  `validateRegisterInput`: tipo, nombre o empresa, cédula/RIF, correo, WhatsApp, teléfono de oficina
  opcional, ciudad y estado. Suma una dirección de entrega opcional, libre, de hasta 300 caracteres.
- Un solo mensaje para todo link que no sirve (no existe, usado, revocado, vencido, ficha borrada o ya
  con acceso), para no confirmarle a un curioso cuáles tokens son reales.
- El `POST` (`registerByLinkAction`) completa la ficha **existente**. No llama a `next_markbox_service`
  ni inserta en `clients`. Después crea la cuenta de Auth con contraseña aleatoria (nunca la cédula),
  vincula `client_users` con `portal_registration_link_bind` y acuña un magic-link de un clic.
- Mensaje final: «¡Ya eras cliente de DTD Cargo! Este es tu código de siempre: <código>. Ya puedes ver tu
  portal.» y el botón «Entrar a mi portal».
- Si el correo ya tiene una cuenta de Auth, la base lo rechaza **antes** de gastar el link y el aviso
  sale en el campo del correo. Si la cuenta o el vínculo fallan después, la ficha queda completa, se
  anota `access_error` y el cliente lee que lo contactamos por WhatsApp.
- Frontera: la ruta sigue el patrón de `app/registro` (ruta pública respaldada por la base, admin
  client con el visitante anónimo y el token como control), que la regla ESLint de frontera excluye
  por diseño. La página y el formulario no importan `@/lib/studio`; la acción importa
  `generatePortalAccessLink` de `@/lib/studio/portal-invite-email`, como ya lo hace `app/entrar`.

### 3.3 Duplicados

`find_duplicate_client_service` devuelve una sola ficha y la propia ficha del legado suele coincidir
consigo misma (mismo teléfono). La regla pasa a `find_duplicate_client_except_service(tenant, excepto,
…)`, con el cuerpo de la 0342 más `c.id is distinct from p_except_client_id`, y la función vieja la
llama con `null`: mismo resultado para el registro de siempre, una sola definición.

Si la cédula, el correo o el teléfono coinciden con **otra** ficha, no se fusiona nada: el link guarda
`duplicate_client_id` y `duplicate_matched_by`, y el par aparece en «Posibles duplicados»
(`client_duplicate_candidates`, que desde la 0349/0362 compara cualquier par). La cédula de otra ficha
no se copia (`rif_skipped`); tampoco si el índice único la rechaza por una ficha borrada que la retiene.

### 3.4 Revisión del equipo: «Registros por link»

`/studio/clientes/registros-link` (menú «Mantenimiento» de Clientes). Cada link usado muestra lo que
tenía la ficha al lado de lo que escribió el cliente, resalta lo que cambió, avisa del posible
duplicado, de la cédula no copiada y del acceso fallido, y ofrece «Marcar comprobado»
(`portal_registration_link_mark_reviewed`, mismos roles). Filtro «Pendientes» / «Todos».

**Por qué no `client_change_requests` (SDD-0151).** Aquella tabla es una propuesta que el asesor
aprueba **antes** de tocar `clients`, con tres campos y una sola abierta por cliente. Aquí el cliente
completa la ficha en el acto (es su primer acceso) y el equipo revisa **después**, con correo, ciudad,
estado y dirección. Meterlo ahí cambiaría el sentido de `pending` para las pantallas que ya la leen. El
historial de la SDD-0483 está en planes, no en `main`. Por eso el token y la revisión viven en la misma
fila de `client_registration_links`: un link usado **es** el registro a revisar.

### 3.5 Código real

- **Alta nueva.** El drawer de «Nuevo cliente» acepta un Shipping Mark opcional. Con él,
  `createClientAction` no llama a ningún generador; valida con `validateNuevoMarkbox`; si el código es
  el retirado de otra ficha, responde «Ese es el código viejo de la ficha DTD-8xxx. Ábrela y recupéralo…»
  en vez de crear otra ficha. Las guardas de aliados e insignias las aplica el trigger de `clients`
  (0362/0371). Un trigger nuevo, `clients_guard_markbox_retirado_t` (BEFORE INSERT), rechaza en la base
  cualquier ficha nueva con un código retirado: `clients_tenant_id_markbox_key` solo mira `clients`.
- **Cliente existente con DTD-8xxx.** `rename_client_markbox` (cuerpo de la 0371) rechazaba cualquier
  código del historial, incluso el retirado del MISMO cliente. Ahora, si el código está retirado y es
  de esa ficha, sale del historial y el código actual (DTD-8xxx) entra en su lugar. Si es de otro
  cliente, sigue el 23505 de siempre. El resultado agrega `recovered`.

## 4. Migración 0552 (`supabase/migrations/0552_registro_portal_por_link.sql`)

- Preflight: compara por md5 los cuerpos vivos de `rename_client_markbox` (0371,
  `ed233ed2354925960ffc4cd798f8549f`) y `find_duplicate_client_service` (0342,
  `61d5707d7c63d2c3647a554a497c7569`); si producción tiene otro, aborta sin tocar nada.
- Tabla `client_registration_links` con RLS: el equipo solo lee su tenant; nadie escribe por PostgREST.
- RPC: `create` y `mark_reviewed` para `authenticated`; `peek`, `complete`, `bind` y `access_error`
  solo para `service_role`.
- Sin backfill ni locks de tabla largos. Desarme: `supabase/desarmes/0552_desarme.sql` (no deshace
  datos: las fichas completadas, los accesos creados y los códigos recuperados se quedan).
- Gate de pendientes: entrada en `supabase/migrations-baseline.json`. MIGRATE-FIRST: sin la 0552, el
  botón dice «Esta acción todavía no está disponible», la lista avisa que falta la migración y el link
  público muestra «Enlace no disponible».

## 5. Privacidad (skill `revisar-datos-ve`, revisión acotada a este cambio)

| Punto | Estado | Evidencia |
|---|---|---|
| Inventario | CORRECTO | Datos nuevos: copia en `prev_data`/`submitted_data` (nombre, cédula/RIF, correo, teléfonos, ciudad, estado, dirección) en `0552:…client_registration_links`. |
| Minimización | CORRECTO | Mismos campos que `/registro`; la dirección es opcional. El token no se guarda, solo su hash. |
| Finalidad | CORRECTO | Mismo texto de finalidad que `/registro` en `RegistroLinkForm.tsx`; opt-in de correo explícito y apagado por defecto. |
| Acceso | CORRECTO | RLS de solo lectura por tenant; RPC con rol y tenant; las públicas, solo `service_role`. |
| Borrado y retención | ENCONTRADO | `prev_data`/`submitted_data` duplican datos personales y no hay flujo general de supresión de clientes en el repo. Decisión pendiente de Sam: plazo para vaciar esas copias después de «comprobado» (propuesta: 90 días). |
| Transferencias | NO VERIFICABLE | Sin terceros nuevos; Auth es el mismo Supabase de hoy. |

## 6. Criterios de aceptación

1. El link tiene ≥128 bits (son 256), se guarda como hash, es de un solo uso, vence a los 14 días y
   regenerarlo revoca el anterior. — contrato SQL §A/§B y `registro-por-link-studio.test.ts`.
2. La URL no lleva el Shipping Mark; uno puesto en la URL no abre nada. — `registro-link.test.ts`,
   `e2e/registro-link.spec.ts`.
3. Completar no crea ficha ni código y deja el acceso activo. — contrato §B4/§B7 y
   `registro-link-action.test.ts`.
4. El duplicado se marca sin fusionar y la cédula ajena no se copia. — contrato §C.
5. Un cliente recupera su propio código retirado; nadie más puede tomarlo. — contrato §D.
6. Una ficha nueva no nace con un código retirado. — contrato §E.
7. El alta acepta el código a mano sin pasar por el generador. — `registro-por-link-studio.test.ts`.
8. «Registros por link» muestra antes/después y marca comprobado con rol y tenant. — contrato
   («Marcar comprobado»).

## 7. Límites de las pruebas

- PGlite tiene una sola conexión: los `FOR UPDATE` (link, ficha, historial) no se prueban en carrera.
- El camino feliz completo en el navegador necesita una base con la 0552 y Auth; el e2e cubre la cara
  pública sin base.

## 8. Allowlist

- `supabase/migrations/0552_registro_portal_por_link.sql`, `supabase/tests/0552_registro_portal_por_link.test.sql`,
  `supabase/desarmes/0552_desarme.sql`, `supabase/migrations-baseline.json`,
  `supabase/pending-migration-symbol-declarations.json`
- `lib/portal/registro-link.ts`, `lib/portal/registro-link-types.ts`, `lib/studio/registro-link-queries.ts`,
  `lib/studio/client-types.ts`
- `app/registro/RegisterForm.tsx` (solo `export` de seis campos), `app/registro/link/[token]/*`
- `app/studio/(app)/clientes/actions.ts`, `…/_components/PortalAccessCard.tsx`, `…/_components/ClientDrawer.tsx`,
  `…/_components/ClientsClient.tsx`, `…/_components/RegistrosLinkClient.tsx`, `…/registros-link/page.tsx`
- Pruebas: `lib/portal/__tests__/registro-link.test.ts`, `lib/portal/__tests__/registro-por-link.migration.test.ts`,
  `app/registro/link/[token]/__tests__/registro-link-action.test.ts`,
  `app/studio/(app)/clientes/__tests__/registro-por-link-studio.test.ts`, `e2e/registro-link.spec.ts`
- `docs/specs/0646-invitacion-portal-por-link/spec.md`, `.agents/handoffs/sdd-0646-invitacion-portal-por-link.md`

## 9. Fuera de alcance

- Mandar el link por la API de WhatsApp (hoy se abre `wa.me` y el asesor lo envía).
- Fusionar duplicados (se resuelven en «Posibles duplicados»).
- Aplicar la 0552 en producción y fusionar a `main`.
