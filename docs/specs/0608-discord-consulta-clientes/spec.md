---
sdd: "0608"
title: "Consulta de clientes desde Discord: /cliente"
status: in-progress
author: "Claude"
created: 2026-11-05
updated: 2026-11-05
supersedes: null
superseded_by: null
related: ["0606", "0085", "0252", "0509"]
confidencialidad: interno
---

# SDD-0608 — Consulta de clientes desde Discord: `/cliente`

> En Operación, alguien escribe `/cliente buscar:Pedro Pérez` y recibe, solo él, «hay tres Pedro Pérez» con el código de cada uno y el enlace a su ficha en el Studio. Y al revés: `/cliente buscar:DTD-0123` le dice de quién es ese código. Nada de facturas, montos ni contacto: eso se ve en el Studio con usuario y permisos.

## Contexto

Pedido de Sam (2026-11-05, plan de la oficina v2, punto 5b), con sus palabras: «que puedan hacerle preguntas con el nombre de un cliente y les dé el código… "hay tres Pedro Pérez"… Puede darle el nombre, pero no le puede dar datos de facturas y cosas así. Lo tiene que ver en el ERP; le va a dar un link.»

Discord reemplaza a Telegram (SDD-0606). El servidor «DTD Cargo» (ID `1534936818951262390`) es de Sam; la categoría Operación la ven Sam y el rol «Equipo» (un socio y una cuenta compartida). La SDD-0606 agrega `user_profiles.discord_user_id` (migración 0514): cada quien pega su ID de Discord en su perfil del Studio. Esta spec usa ese enlace para saber quién pregunta.

**Medido en el código (`main` `fff7249fc`):**

| Qué | Dónde |
|---|---|
| Clientes y su código | `public.clients` (`markbox` = Shipping Mark `DTD-…`, `name`, `tenant_id`, `deleted_at`), `supabase/migrations/0006_clients.sql:9` |
| Ficha del cliente | `/studio/clientes/[markbox]`, `app/studio/(app)/clientes/[markbox]/page.tsx` |
| Quién ve clientes | módulo `clients` de la matriz: `commercial`, `operations`, `accounting`, `support` y `admin` (`lib/studio/rbac.ts:90`), con los desvíos por tenant de la 0357 y el alcance de almacén (`getStudioAccess`, `lib/studio/rbac-guard.ts:78`) |
| Búsqueda de clientes del Studio | `.or(… name.ilike.%term% …)` sin escapar comodines (`lib/studio/client-queries.ts`, `construirQuery`). No se reutiliza: ver D4 |
| Enlace de Discord | `user_profiles.discord_user_id`, texto de 17 a 20 dígitos, **sin índice único**, lo escribe cada quien en su fila (rama `claude/gracious-kapitsa-213515`, migración 0514 y `saveMyDiscordUserIdAction`) |

## Decisiones

### D1 · Aplicación de Discord propia del Studio, no ALFRED

El comando se registra en una aplicación nueva («DTD Cargo Studio» o el nombre que Sam elija), no en ALFRED (`1567972021244002447`).

- La «URL de interacciones» es UNA por aplicación. ALFRED corre en Hermes con conexión de bot (gateway); si su aplicación apuntara al Studio, todas sus interacciones (botones, otros comandos) llegarían al Studio, y el día que ALFRED quiera su propia URL tendría que quitársela.
- Aislamiento de llaves: la del Studio sólo verifica firmas de `/cliente`. Si se filtra la llave del bot de la oficina, no da acceso a la base de clientes, y al revés. Es lo que pide el plan: los agentes de Hermes no tienen llaves ni acceso a clientes.
- La aplicación nueva no necesita bot ni permisos en canales: sólo el alcance `applications.commands` en el servidor. Responder a una interacción no requiere token.

### D2 · Firma Ed25519 y PING

`POST /api/discord/interacciones` lee el cuerpo crudo y verifica `X-Signature-Ed25519` sobre `X-Signature-Timestamp + cuerpo` con la llave pública de `DISCORD_CONSULTA_PUBLIC_KEY` (`node:crypto`, sin dependencias nuevas). Firma mala o ausente → 401, como exige Discord al guardar la URL. Sin la variable → 503 y nadie pasa. El timestamp tiene que estar a ±5 minutos del reloj: un pedido capturado no se repite más tarde. El PING (tipo 1) se contesta con PONG sin tocar la base.

### D3 · Quién puede preguntar

Todo falla cerrado, en este orden, con el cliente `service_role` (no hay sesión del Studio):

1. Sólo `/cliente`, sólo con `guild_id` = servidor de DTD Cargo y con `member` (nunca por mensaje directo).
2. `DISCORD_TENANT_ID` (la misma variable de la SDD-0606, D1b): el servidor tiene un tenant dueño. Sin ella, «no disponible».
3. **Exactamente un** perfil con ese `discord_user_id`. Cero → «No autorizado» con cómo enlazarse. Dos o más → «No autorizado», ambiguo (la 0514 no tiene índice único; no se adivina de quién es).
4. Membresía **activa** (`disabled_at` nulo) en ese tenant.
5. Permiso de ver `clients` con la matriz del Studio, los desvíos **de ese tenant** y el alcance de almacén. Si los desvíos no se pueden leer, «no disponible»: un desvío puede quitar permiso y omitirlo abriría de más (distinto de `getRoleModuleOverrides`, que en el Studio degrada a `{}`).

En Discord, además, el comando nace oculto (`default_member_permissions: "0"`, `contexts: [0]`) y Sam lo habilita para el rol «Equipo» y los canales de Operación en Ajustes del servidor › Integraciones. Eso es configuración de Discord, no la barrera: la barrera es el enlace + permiso del Studio.

### D4 · Búsqueda en la base, por nombre o por código, con comodines escapados

Por código (Sam, 2026-11-06: «si yo pregunto el código, me dice el cliente»): el término sin mayúsculas ni signos tiene que ser **igual** al Shipping Mark sin signos (`dtd0123` y `DTD-0123` encuentran `DTD-0123`, también con prefijo de aliado). Es igualdad exacta, sin comodines, y esa coincidencia va primero. Un código parcial no encuentra nada por código. Una sola opción, `buscar`, recibe nombre o código: no hace falta saber de antemano cuál es.

La búsqueda va por `public.discord_buscar_clientes(tenant, término, límite)` (migración 0516) y no por `.ilike()` de PostgREST, que convierte `*` en `%` sin forma de escaparlo. En SQL se escapan `\`, `%` y `_` y `*` queda literal. Cada palabra de 2+ caracteres del término (hasta 6) tiene que aparecer en el nombre, en cualquier orden, sin distinguir mayúsculas ni acentos (á→a, ñ→n). Sin ninguna palabra válida no devuelve nada (nunca «todos»). Excluye eliminados y otros tenants. Devuelve **sólo** `markbox` y `name`: la minimización vive en la base. Techo de 25 filas.

### D5 · Respuesta

Siempre efímera (`flags: 64`) y con `allowed_mentions: { parse: [] }`. Hasta 10 coincidencias: nombre, «código **DTD-…**» y `<https://dtdcargo.com/studio/clientes/DTD-…>`. Se piden 11: si llega la 11.ª, «Hay más coincidencias. Escribe el nombre más completo para afinar la búsqueda.» Pie fijo: «Facturas, montos y datos de contacto se ven en el Studio con tu usuario.» El texto visible dice «código», nunca «MARKBOX» (`BRAND.md`).

Los nombres pueden venir del registro público del portal: se escapan `\ * _ ~ \` | [ ] ( ) < : @` y se parte `//`, para que un nombre como «[Haz clic](https://…)» no sea un enlace disfrazado. Nombres de más de 50 caracteres se cortan; si el mensaje pasara de 2.000 caracteres, se quitan líneas y se pide afinar.

### D6 · Registro y límite

Cada consulta que pasa el filtro de servidor se registra en `public.discord_consultas_clientes` (migración 0516): usuario de Discord, usuario del Studio (si hay enlace), tenant, término (hasta 100 caracteres), resultado (`ok`, `sin_enlace`, `enlace_ambiguo`, `sin_permiso`, `limite`, `no_disponible`) y hora. RLS activada sin policies; sólo `service_role`. Retención: 180 días, borrados en cada registro.

`discord_consulta_registrar` registra y aplica el tope en el mismo paso, con un candado por usuario de Discord: **6 consultas por minuto**, contando también las rechazadas. La que pasa el tope se anota como `limite` y no busca. Si no se puede registrar (0516 sin aplicar), no se busca.

### D7 · Dependencia de la SDD-0606: rama propia desde `main`, integración después

No se apila sobre `claude/gracious-kapitsa-213515`: esa rama sigue cambiando y su PR es otra unidad de revisión. Esta rama sale de `main` y no importa nada de la 0606; sólo lee la columna `discord_user_id` por nombre.

- **Orden de integración:** la PR de la 0606 primero; ésta después, trayendo `main` una vez. Al traerlo hay que (a) dejar UNA línea `DISCORD_TENANT_ID=` en cada `.env.example`, (b) sumar `lib/studio/discord/consulta/consulta.ts` (la lectura de `discord_user_id`) a la declaración de símbolos `sdd-0606-discord-user-id` mientras la 0514 siga pendiente, con su evidencia (`return { resultado: "no_disponible" …}` ante el error de la columna), y (c) ajustar la fila de Discord del inventario de terceros, que hoy dice «sin nombre».
- **Orden de migraciones:** 0514 → 0515 → 0516. La 0516 no depende de la 0514 para aplicarse, pero sin la 0514 el comando contesta «no disponible».
- Si esta PR entrara antes que la 0606, no rompe nada: sin la columna, todo pedido termina en «no disponible».

### D8 · Registro del comando

Discord no deja crear comandos desde el portal. `scripts/discord/registrar-comando-cliente.mjs` los registra por API, en el servidor de DTD Cargo, con credencial de cliente (OAuth2 `client_credentials`, alcance `applications.commands.update`) de la aplicación del Studio. Las credenciales se leen del entorno de quien lo corre y no se guardan en el servidor ni se imprimen. `--dry-run` muestra lo que mandaría. La definición vive en `lib/studio/discord/consulta/comando-cliente.json`, la misma que lee la ruta.

## Privacidad

Revisión con `revisar-datos-ve` en [`privacidad.md`](privacidad.md). El nombre del cliente llega a Discord (tercero), sólo a quien preguntó y con el permiso del Studio; alta propuesta en `docs/legal/privacidad/inventario-terceros.md`.

## Allowlist exacta

Producto:

- `app/api/discord/interacciones/route.ts`
- `lib/studio/discord/consulta/comando-cliente.json`
- `lib/studio/discord/consulta/comando.ts`
- `lib/studio/discord/consulta/firma.ts`
- `lib/studio/discord/consulta/respuesta.ts`
- `lib/studio/discord/consulta/consulta.ts`
- `scripts/discord/registrar-comando-cliente.mjs`
- `supabase/migrations/0516_discord_consulta_clientes.sql`
- la vuelta atrás `0516_desarme`, en la carpeta `supabase/desarmes/` (sin número de migración; no se aplica sin OK nominal). Se nombra sin la extensión: `spec-migration-refs.test.ts` toma todo `NNNN_nombre` con extensión `.sql` del cuerpo de una spec como migración

Pruebas:

- `app/api/discord/interacciones/__tests__/route.test.ts`
- `lib/studio/discord/consulta/__tests__/fake-admin.ts`
- `lib/studio/discord/consulta/__tests__/firma.test.ts`
- `lib/studio/discord/consulta/__tests__/respuesta.test.ts`
- `lib/studio/discord/consulta/__tests__/consulta-clientes.migration.test.ts`
- `supabase/tests/0516_discord_consulta_clientes.test.sql`

Contratos y configuración:

- `supabase/migrations-baseline.json` (espera de la 0516)
- `supabase/pending-migration-symbol-declarations.json` (declaración `sdd-0608-discord-consulta-clientes`)
- `.env.example`, `infra/dtd-cargo/.env.example` (`DISCORD_CONSULTA_PUBLIC_KEY`, `DISCORD_TENANT_ID`; y en la raíz las dos del script)

Documentos:

- `docs/specs/0608-discord-consulta-clientes/spec.md`, `docs/specs/0608-discord-consulta-clientes/privacidad.md`
- `docs/specs/README.md` (índice regenerado)
- `docs/legal/privacidad/inventario-terceros.md` (fila propuesta)
- `docs/legal/privacidad/mapa-de-borrado.md` y `docs/legal/privacidad/registro-tratamiento.md` (registro de consultas y titulares no usuarios)
- `.agents/handoffs/sdd-0608-discord-consulta-clientes.md`

Fuera: pantallas del Studio, la 0606 y sus archivos, la búsqueda del listado de clientes, Hermes/ALFRED, producción y Discord.

## Criterios de aceptación

1. Firma inválida, ausente, de otra llave o con timestamp fuera de ±5 min → 401 sin tocar la base; sin llave configurada → 503.
2. PING firmado → `{ "type": 1 }`.
3. Otro servidor o mensaje directo → rechazo efímero sin tocar la base.
4. Sin enlace → «No autorizado…», registrado como `sin_enlace`, sin búsqueda. Enlace en dos perfiles → ambiguo, sin búsqueda.
5. Membresía desactivada, de otro tenant o rol sin `clients` (también por desvío del tenant) → sin permiso, sin búsqueda. Desvíos ilegibles → no disponible.
6. `%`, `_`, `*` y `\` se buscan como texto; una sola letra o sólo comodines no devuelven nada. Un Shipping Mark exacto, con o sin guion y en cualquier mayúscula, devuelve ese cliente primero; uno parcial, eliminado o de otro tenant no.
7. Hasta 10 coincidencias y «afinar» si hay más; con exactamente 10, no pide afinar.
8. La respuesta no contiene teléfono, correo, dirección, montos ni estado de envío aunque la fila los traiga; la función de la base devuelve sólo `markbox` y `name`.
9. Toda respuesta de comando es efímera y sin menciones.
10. Cada consulta queda registrada; la 7.ª del minuto se frena y se anota `limite`.
11. Sin las funciones de la 0516 o sin `DISCORD_TENANT_ID`, «no disponible» y no busca.

## Validación

Pruebas focales (`firma.test.ts`, `respuesta.test.ts`, `route.test.ts`, `consulta-clientes.migration.test.ts` con control rojo y mutantes en PGlite), `typecheck`, `lint`, `docs:check`, `sdd:check`, gate de símbolos pendientes y `pnpm verify` con turno del Director General. Resultado por comprobación en el handoff.

## Lo que activa Sam (fuera del repositorio)

Crear la aplicación, instalarla en el servidor, poner `DISCORD_CONSULTA_PUBLIC_KEY` y `DISCORD_TENANT_ID` en el servidor, registrar el comando, guardar la URL de interacciones, habilitar el comando para el rol «Equipo» en Operación, OK nominal de la 0516 (y de la 0514) y descongelar la publicación. Paso a paso en el handoff.
