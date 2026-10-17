---
sdd: "0526"
title: "Portal: bandeja de avisos del cliente"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0042", "0148", "0156", "0283", "0337", "0359", "0466", "0511", "0514", "0521", "0524"]
confidencialidad: interno
---

# SDD-0526 — Portal: bandeja de avisos del cliente

> El cliente ve dentro del Portal los avisos que el sistema ya le envió sobre su
> mercancía («Tu carga llegó a nuestra bodega en China», embarcada, en aduana,
> entregada), sin depender del correo ni del push. La campana cuenta los que no
> ha visto, y el detalle de una compra muestra su historial de avisos como ya lo
> hace el de un envío.

## Contexto

Sam, literal:

> «al correo y la notificación push a su portal, que le avisen en su portal el
> estatus de la mercancía»

Cuando el Director le explicó que hoy no existe una bandeja de avisos dentro del
Portal:

> «sí, prepara la bandeja de avisos en el Portal»

Lo que había en `main` (`a8d99acf`):

- La cola `client_notification_schedule` (0247, 0389) guarda cada aviso con su
  ancla (envío o compra) y su estado. Es **sólo de `service_role`**: no tiene
  policy para la API y el cliente no la puede leer con su sesión.
- El detalle de un envío ya muestra «Avisos que te enviamos»
  (`PortalNotificationHistory`), leyendo la cola con el **cliente admin**
  acotado a ese envío.
- La campana de la topbar (`PortalTopbar.tsx`, `NotificationsBell`) sólo
  marcaba la respuesta del asesor (`soporteDot`, SDD-0148). Su comentario lo
  decía: «no hay tabla de "leído" por cliente todavía».
- El detalle de una compra no mostraba ningún aviso, aunque el aviso de
  recepción en China cuelga de la compra desde 0389.

## Decisión

### Panel en la campana, no página

El Norte del Portal lo resuelve así: en escritorio la campana despliega un panel
bajo la topbar (`_norte/portal/app.jsx` · `PortalTopbar`, «Notificaciones»); en
el teléfono sube una hoja desde abajo (`_norte/portal/mobile-extra.jsx` ·
`NotifSheet`, «Avisos»). Por eso es un **panel** y no una página
`/portal/avisos`: el cliente consulta sin perder la pantalla en la que está, y
no se agrega una ruta nueva. El panel trae los 20 avisos más recientes; el
historial completo de cada compra o envío vive en su detalle (hasta 50).

### Qué avisos entran

Sólo los que pasan **todas** estas condiciones, aplicadas en la base por la RPC
`portal_list_my_notifications` (migración 0479):

1. `status = 'sent'` y `sent_at` no nulo. Nunca `scheduled`, `failed`,
   `skipped` ni `canceled`.
2. El vínculo del Portal sale de `auth.uid()` con la frontera de 0453: un único
   vínculo activo, cliente vivo, del mismo tenant. Con cero o con más de uno, la
   bandeja sale vacía.
3. La fila de la cola es del tenant y del Shipping Mark del cliente, **y** su
   ancla (envío o compra) vive (`deleted_at is null`, SDD-0511), es del mismo
   tenant y del mismo Shipping Mark.
4. «Visible en el portal» (`client_notification_rules.visible_in_portal`): con la
   precedencia de 0402, el override del cliente gana al default del tenant; sin
   regla, visible. Se aplica a todos los eventos, no sólo a los `status:*`.

`p_prealerta_id` sólo acota a una compra (el detalle de compra); no amplía nada.
La RPC devuelve título y texto del aviso, canal, fecha, código del ancla y si
está sin leer; nunca el payload entero (que guarda el nombre del cliente), el
tenant, el Shipping Mark ni la regla.

### No leídos

- Tabla `portal_notification_seen`: **una fila por vínculo del Portal**
  (`client_users.id`) con `last_seen_at`. No guarda historial, ni qué aviso se
  abrió, ni desde dónde. Sin policies ni privilegios de API: sólo la tocan las
  dos RPC.
- Al abrir la campana, el Portal marca como visto **hasta la fecha del aviso más
  nuevo que mostró** (`portal_mark_my_notifications_seen`), no hasta «ahora»: un
  aviso que llega con el panel abierto sigue sin leer. La base lo recorta a
  `now()` y nunca retrocede.
- El contador baja sólo cuando la base confirma (LOD-01). Si falla, queda como
  estaba y se reintenta al volver a abrir. Mientras el panel sigue abierto, los
  que eran nuevos conservan su marca «Nuevo».
- El visto no sobrevive al vínculo: un trigger en `client_users` borra la fila
  cuando el vínculo cambia de estado (revocado por el Studio, por la fusión o
  por el borrado del cliente; reactivado) o de persona. Quien reactiva no hereda
  el visto de otro.
- Sin backfill: un cliente sin fila ve todos sus avisos como no leídos la
  primera vez.

Se eligió una tabla y no `localStorage` (como el punto del asesor) porque el
cliente abre el Portal en el teléfono y en la computadora: un visto por
navegador lo haría leer dos veces lo mismo.

### La campana

- El contador suma los avisos sin leer y la respuesta del asesor (como el Norte,
  que suma «Mis envíos» y «Soporte»). Dice el número hasta 9 y después «9+».
- **Va en vino, no en rojo.** El punto del asesor era `--color-status-danger`;
  un aviso sin leer no es un error (BRAND.md, «Estados y mensajes»,
  2026-09-05): es un acento de marca. Texto `--color-on-accent` sobre
  `--color-wine`: 10,58:1 en claro y 4,96:1 en oscuro.
- La marca del asesor se conserva: cuenta en el contador y su enlace a Soporte
  va arriba del panel, como antes.
- Cada aviso: título, texto, «Compra»/«Envío» con su código en JetBrains Mono,
  fecha en hora de Venezuela y enlace a su detalle. Icono neutro (caja para la
  compra, barco para el envío): es información, no riesgo.
- Vacío: «Todavía no tienes avisos.» / «Cuando te enviemos uno sobre tu
  mercancía, también lo verás aquí.» No promete avisos (SDD-0516, 0521).
- Escape y la × devuelven el foco a la campana (A11Y-01 §2); la × y los avisos
  miden 44 px de alto en el teléfono.

### El historial dentro de la compra

`/portal/compras/[code]` muestra «Avisos que te enviamos» con los avisos
enviados de esa compra, al final, igual que el envío. Lee con la sesión del
cliente (la base vuelve a exigir que la compra sea suya y viva).
`PortalNotificationHistory` recibe `descripcion` para no decir «de este envío»
en una compra.

### Lo que no cambia

- El historial del **envío** sigue leyendo con el cliente admin, sin tocarlo (ver
  FUERA DE ALCANCE en el handoff).
- Nada de lo que programa o envía avisos (`lib/studio/notifications/schedule-*.ts`,
  `drain-client-notifications.ts`, las acciones de recepción): es de la SDD-0524.
- Sin WhatsApp, sin preferencias por canal, sin borrar avisos.
- El Portal no agrega imports de `@/lib/studio`: las etiquetas salen de
  `lib/shared/shipment-public`.

### Orden: MIGRATE-FIRST

La app nueva llama a las dos RPC de 0479. Sin la migración, degrada sin romper:
la campana queda sin contador de avisos y con la bandeja vacía (conserva la
marca del asesor), el detalle de compra sin historial y marcar como visto
devuelve `false`. Está declarado en
`supabase/pending-migration-symbol-declarations.json` (gate en AMARILLO, no
ROJO). Con 0479 aplicada y la app de antes no cambia nada: nadie llama a las
RPC nuevas.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0479_portal_bandeja_avisos.sql` | Nuevo. Tabla del visto, trigger, índice y las dos RPC, con preflight y postflight. |
| `supabase/tests/0479_portal_bandeja_avisos.test.sql` | Nuevo. Contrato sobre 0247 y 0389 reales con fixture infeliz. |
| `lib/portal/__tests__/portal-bandeja-avisos.migration.test.ts` | Nuevo. El contrato en PGlite, control rojo, preflights, locks y mutantes. |
| `supabase/migrations-baseline.json` | La espera de 0479. |
| `supabase/pending-migration-symbol-declarations.json` | La degradación declarada de las dos RPC. |
| `lib/portal/portal-avisos.ts` | Nuevo. Tipos y reglas puras (enlace, fecha, etiqueta, no leídos, contador). |
| `lib/portal/portal-avisos-queries.ts` | Nuevo. Las dos RPC con la sesión. |
| `lib/portal/__tests__/portal-avisos.test.ts` | Nuevo. Consultas con doble de la RPC y reglas puras. |
| `app/portal/actions.ts` | `markPortalAvisosSeenAction`. |
| `app/portal/_components/PortalAvisosBell.tsx` | Nuevo. La campana con la bandeja. |
| `app/portal/_components/__tests__/PortalAvisosBell.test.tsx` | Nuevo. Campana con y sin no leídos, vacía, enlaces, marca del asesor, foco. |
| `app/portal/_components/PortalTopbar.tsx` | Usa `PortalAvisosBell`; sale la campana vieja. |
| `app/portal/_components/PortalShell.tsx` | Pasa los avisos a la topbar. |
| `app/portal/(app)/layout.tsx` | Lee la bandeja con la sesión. |
| `app/portal/_components/PortalNotificationHistory.tsx` | Prop `descripcion`. |
| `app/portal/(app)/compras/[code]/page.tsx` | Historial de avisos de la compra. |
| `app/portal/(app)/compras/[code]/page.test.tsx` | Historial con y sin avisos; lectura con la sesión y acotada. |
| `docs/specs/0526-portal-bandeja-avisos/spec.md` | Esta spec. |
| `docs/specs/0526-portal-bandeja-avisos/assets/bandeja-escritorio-claro.jpg`, `bandeja-escritorio-oscuro.jpg`, `bandeja-movil-oscuro.jpg`, `bandeja-movil-claro-vacia.jpg` | Capturas del arnés con datos ficticios. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0526-portal-bandeja-avisos.md` | Handoff de la tarea. |

## Criterios de aceptación

1. La campana abre un panel (hoja en el teléfono) con los avisos enviados del
   cliente, del más nuevo al más viejo; cada uno con título, texto, fecha y
   enlace a su compra o envío.
2. Sólo entran filas `sent` con fecha, de su tenant y Shipping Mark, con ancla
   viva del mismo tenant y Shipping Mark, y cuya regla vigente no las oculte del
   portal. Nunca `scheduled`, `failed`, `skipped` ni `canceled`, ni avisos de
   envíos o compras eliminados.
3. Un cliente jamás ve avisos de otro: ni de otro Shipping Mark del mismo tenant
   ni del mismo Shipping Mark en otro tenant; tampoco un vínculo revocado, de
   otro tenant, de cliente eliminado, ni una persona con dos vínculos activos.
4. La campana cuenta los avisos no vistos más la respuesta del asesor; al
   abrirla se marcan vistos hasta el más nuevo mostrado; el contador baja sólo
   cuando la base confirma; el visto no retrocede, no pasa de «ahora» y no se
   comparte entre vínculos.
5. La marca de la respuesta del asesor se conserva (contador y enlace a Soporte).
6. El detalle de una compra muestra el historial de avisos de esa compra, leído
   con la sesión y acotado a la compra; sin avisos, no muestra nada.
7. La tabla del visto no se lee ni se escribe desde la API; las RPC son
   SECURITY DEFINER con `search_path` vacío y EXECUTE sólo para `authenticated`.
8. El visto se borra cuando el vínculo cambia de estado o de persona.
9. Sin 0479 la app degrada sin romper (declarado en el gate de símbolos).

## Riesgos

- **Primera vez.** Sin backfill, el primer día cada cliente ve su historial
  completo como no leído (el contador dice hasta «9+»). Es cierto —nunca lo vio
  en el Portal— y se limpia al abrir la campana.
- **Claim del despacho.** El cron marca la fila `sent` antes de despachar y la
  revierte si el envío falla. En esa ventana (segundos) un aviso puede aparecer y
  desaparecer de la bandeja. Un correo que rebota después pasa a `failed` y sale
  de la bandeja.
- **«Visible en el portal» oculta también el aviso.** Con la regla en «no
  visible» (el ejemplo de Sam: ocultar «llegó a aduana» y mandar el cobro
  anticipado), el correo o el push salen, pero el aviso no aparece en la
  bandeja. Es lo que pide el encargo; si Sam quiere ver el cobro en la bandeja,
  es una decisión de la regla, no de esta pantalla.
- **Avisos `skipped` por falta de destino** (cliente sin correo ni push) no entran:
  el encargo pide sólo lo enviado.
- **La carrera revocar ↔ marcar no se ejerce con dos conexiones.** El `for share
  of cu` de la RPC de visto hace que una revocación concurrente espere y borre la
  fila recién escrita. PGlite tiene una conexión: su mutante sobrevive a la
  batería. Si la carrera ocurriera sin el lock, la fila quedaría colgada de un
  vínculo revocado hasta que se reactive (el trigger la borra entonces) o se
  borre el vínculo; nunca la hereda otra persona. Un `*_carrera.test.sql` con
  dblink (patrón 0459) lo cubriría en `verify` con Docker.
- **Locks al aplicar.** ShareRowExclusiveLock sobre `client_users` y ShareLock
  sobre la cola hasta el COMMIT (modos medidos en PGlite; sin tiempos contra otra
  sesión). Aplicar en baja actividad y fuera de una corrida del cron.
- **Una consulta más por pantalla.** El layout llama a la RPC en cada carga del
  Portal; la cubre el índice parcial nuevo.

## Revisión de datos (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. Alcance: lo que la bandeja lee de la cola y lo
que guarda el visto.

| Punto | Estado | Evidencia |
|---|---|---|
| Dato nuevo: fecha del último aviso visto por vínculo del Portal | ENCONTRADO, mínimo | `portal_notification_seen.last_seen_at`. Una fecha por vínculo, sin historial, sin IP ni dispositivo. Finalidad: contar los avisos no vistos. |
| Retención del dato nuevo | CORRECTO | trigger `client_users_forget_portal_notification_seen` (0479 § 2) y FK `on delete cascade`; contrato § 11. Vive mientras el vínculo esté activo con la misma persona. |
| Quién lo ve | CORRECTO | sin policies ni privilegios de API (0479 § 1, postflight y contrato § 1); sólo las dos RPC. El Studio no lo lee. |
| Minimización de la lectura | CORRECTO | la RPC no devuelve el payload (que trae `clientName`), el tenant, el Shipping Mark ni la regla; contrato § 8 («Nombre privado» no sale) y postflight. |
| Aislamiento entre clientes | CORRECTO en PGlite | contrato §§ 2 y 5 con fixture infeliz; NO VERIFICADO contra producción hasta aplicar. |
| Datos personales en el texto del aviso | NO VERIFICABLE | `custom_title`/`custom_body` los escribe el equipo en el Studio; si alguien escribe un dato de un tercero, se muestra al cliente que ya lo recibió por correo. No cambia con esta SDD. |
| Logs | CORRECTO | `portal-avisos-queries.ts` sólo registra el código del error; prueba `portal-avisos.test.ts`. |

Marco citado desde `references/`: CRBV art. 28 (acceso a los datos propios: el
cliente ve lo que se le envió) y art. 60 (protección de la vida privada: la
bandeja no expone datos de otros clientes). El equipo de Yiwu no lee esta tabla
(PIPL no cambia). No es asesoría legal.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| A11Y-01 §2 (foco y restauración) | cumplimiento | Escape y × devuelven el foco a la campana; prueba de la campana |
| A11Y-01 §3 (contraste) | cumplimiento | ver `/ui-check` en el handoff |
| A11Y-01 §4 (nombre accesible) | cumplimiento | «Avisos · N sin leer»; región «Avisos»; lista «Avisos enviados»; × «Cerrar avisos» |
| A11Y-01 objetivos táctiles | cumplimiento en la hoja; salvedad preexistente | avisos y × de 44 px; la campana mide 36 px como el resto de la topbar |
| LOD-01 (éxito después del resultado durable) | cumplimiento | el contador baja tras la confirmación; prueba con promesa diferida |
| LNK-01 (navegación en la misma pestaña) | cumplimiento | los avisos son navegación |
| BRAND «Estados y mensajes» | cumplimiento | aviso = información (icono neutro); contador en vino de marca, no rojo |
| CMP-01 | cumplimiento con salvedad | el panel sigue la estructura del popover de la topbar existente; no hay primitiva de popover del Portal en el registro |

## Evidencia

Detalle y comandos en el handoff `.agents/handoffs/0526-portal-bandeja-avisos.md`.

- **Contrato SQL en PGlite** (`portal-bandeja-avisos.migration.test.ts`, 48
  casos): el contrato completo da `TEST 0479 GREEN: 61 aserciones` sobre 0247 y
  0389 reales; **control rojo** sin 0479 (`la RPC de la bandeja no existe`);
  cuatro preflights que abortan sin crear nada (sin el CHECK de 0389, con una
  policy de la API sobre la cola, con FORCE RLS, con la tabla ya creada) y la
  reaplicación; los modos de lock sobre las tablas existentes; la espera y la
  declaración; y **39 mutantes de la migración, cada uno muerto en su
  aserción** (criterios 2, 3, 4, 7 y 8).
- **Mutante sobreviviente declarado:** quitar `for share of cu` deja el contrato
  verde (una sola conexión). Ver Riesgos.
- **Consultas** (`portal-avisos.test.ts`, 21 casos) con un doble de la RPC que
  aplica la compra y el tope, devuelve copias y rechaza argumentos que la firma
  no tiene, con su control (sin compra vuelven las tres filas).
- **Campana** (`PortalAvisosBell.test.tsx`, 9 casos, jsdom): sin avisos, con no
  leídos, base que no confirma o falla, marca del asesor, asesor + avisos, «9+»,
  Escape y × devuelven el foco (criterios 1, 4 y 5).
- **Detalle de compra** (`page.test.tsx`, 9 casos; 3 nuevos): lee con la sesión
  y acotado a la compra, historial al final, sin avisos no hay historial; los 6
  de la 0514/0516/0521 siguen verdes (criterio 6).
- **21 mutantes manuales del lado TypeScript, 21 muertos**, con control verde
  antes y después en los tres archivos.
- **Gate de símbolos:** sin declaración, ROJO con las dos RPC; con la
  declaración, `0 ROJO · 1 AMARILLO` (criterio 9).
- **/ui-check** sobre la topbar real en un arnés con datos ficticios (capturas en
  `assets/`). Contraste medido en el navegador: claro, título 16,49:1, texto y
  metadatos 12,63:1, «Nuevo» 10,58:1, contador 10,58:1; oscuro, 13,08:1,
  7,33:1, 6,44:1 y 4,96:1. A 375 px la hoja ocupa todo el ancho, sin desborde
  horizontal; cada aviso mide 61-121 px de alto y la ×, 44×44. Las fuentes del
  Portal no se cargan en el arnés (salen las del sistema).
- **`pnpm verify` completo: NO EJECUTADO** a pedido del Director (el turno de la
  corrida pesada es del Worker de la 0522); la evidencia de la suite es el CI de
  la PR.

## Registro de integración (2026-10-15)

- **PR:** #230 (`codex/portal-bandeja-avisos`). Cabeza `337e2ec6` fusionada con `--match-head-commit`; merge `ce5cddda` a las 14:37:03Z.
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38750526256), con la suite y el build. `pnpm verify` local: NO EJECUTADO (una corrida pesada a la vez; el CI corre la suite completa).
- **Deploy:** el status de Vercel del merge dice «Deployment has completed» (14:38:24Z). El ID del deployment y el alias quedan NO VERIFICADOS: el conector de Vercel responde 403.
- **Migración `0479_portal_bandeja_avisos`: APLICADA** en el servidor propio (`dtd-cargo-db-1`), migrate-first, con el OK nominal de Sam, literal: «autorizo aplicar 0476_borrado_embarques_recepciones, 0477_naviera_zarpe_avanza_envios, 0479_portal_bandeja_avisos, 0480_operarios_editar_por_region y 0482_naviera_autorizar_correlation_id en el servidor propio».
  - Antes, la lectura previa READ ONLY de la migración dio «PREFLIGHT 0479 OK».
  - `psql` con la migración y la fila del ledger en una transacción. Ledger `20261015143659 · 0479_portal_bandeja_avisos`, una sentencia, md5 `52fe4141…` y 23428 bytes, igual al blob de la cabeza fusionada.
  - La PR se fusionó 4 s después de la fila del ledger, así que la app vieja y la base nueva no convivieron.
  - La espera salió de `supabase/migrations-baseline.json` en la misma PR. La cabecera «NO APLICADA» del `.sql` no se corrige: editarla rompería la identidad con el ledger.
  - Evidencia: `/srv/ops/evidencias/apply-0479-dtd-cargo-20261015T143659Z/` con `SHA256SUMS`.
- **Smoke de Sam: PENDIENTE.** Guion en `.agents/handoffs/0526-portal-bandeja-avisos.md` § «Smoke para Sam (después de aplicar 0479 y desplegar)».
- **Estado:** integrada. La spec sigue en `in-progress` hasta el smoke.
