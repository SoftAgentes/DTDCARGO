---
sdd: "0650"
title: "Ficha 360° del cliente en el Studio"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0246", "0258", "0483", "0504", "0507", "0558", "0585", "0590", "0635", "0647", "0648", "0649", "0651"]
confidencialidad: interno
---

# SDD-0650 — Ficha 360° del cliente en el Studio

> Quien abre la ficha de un cliente en `app/studio/(app)/clientes/[markbox]` ve ahí mismo quién es, cuánto debe, qué tiene en camino y qué escribió por última vez, con enlaces para profundizar.
> Una sola SDD con cinco fases (F1 a F5). La F1 está en `main` (PR #629). **La F2 va en su propia PR** (§5 F2, §6, §10 y §11). F3 a F5 quedan especificadas y las asigna el Director General.
> La **F5 absorbe la reserva 0483** («El Studio muestra el historial de cambios que hizo el cliente»): la 0483 queda reemplazada por la 0650 §F5.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.

## 1. Pedido

Sam, 2026-11-16, en la sesión del Director General, mientras se integraban la SDD-0645 (pasar embarque a otro cliente) y la 0649 (atributos del ERP en el contacto de Chatwoot). La ficha debe ser una vista 360°: la información útil a la vista, sin salir a buscar, y con enlaces para profundizar. A la derecha, un panel con lo último que escribió el cliente, con el historial importado de Kommo incluido. Sam pidió tomar de **QuickBooks Online** lo contable.

La propuesta, con la investigación, sus fuentes y la maqueta, la vio Sam antes de construir: es un artefacto privado del 2026-11-16 («Ficha 360 del cliente»). Las decisiones de §3 son sus respuestas, una por una, en la sesión Worker de esta SDD.

## 2. Lo que había (medido en `main` `be9fe643c`)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La tarjeta «Conversaciones en la Bandeja» muestra número, estado, no leídos y fecha. No muestra texto | `app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx:1-10` | C |
| Solo hay `client_id` en `chatwoot_conversations` si el teléfono cruza con **una** ficha | `lib/studio/chatwoot/conversations-queries.ts:49-64`, migración 0504 | C |
| El Archivo Kommo no llega a `chatwoot_conversations`: el cargador escribe con `insert_all`, sin eventos | `docs/specs/0590-kommo-historial-e5/spec.md` §10.3 y E-3/E-4 | D |
| Los contactos que creó el cargador llevan `additional_attributes.client_id`; los que reusó por teléfono o correo, no | `infra/ops/kommo-historial/cargar-archivo-kommo.rb:186-197` | C |
| El historial de envíos filtraba **solo por el código vigente**. El saldo sí suma historial y fichas fusionadas | `lib/studio/client-queries.ts` (`listShipmentsByMarkbox`), `app/studio/(app)/clientes/[markbox]/page.tsx` (`getClientAccountState` con `codigosConocidos`), migración 0492 | C |
| Saldo por moneda, vencido, último pago y embarques en curso en la cabecera. El estado de cuenta solo para finanzas | SDD-0558, `ClientAccountHeader.tsx`, `lib/studio/client-account.ts` | C |
| El ERP aún no tiene facturas reales en producción | Estado de producción del 2026-11-14 | D |
| El módulo Bandeja lo abren `commercial` y `support` (y admin) | `lib/studio/rbac.ts` (`bandeja`) | C |

## 3. Decisiones de Sam (2026-11-16, literales)

Las personas van por su función: el repo es público. Entre corchetes, la sustitución.

| ID | Pregunta | Respuesta literal de Sam | Queda |
|---|---|---|---|
| D1 | ¿El panel muestra el texto del último mensaje? | «si recoemndado a» | Sí. Unas dos líneas y el autor de las últimas ~6 conversaciones, leídas en vivo y sin guardar el texto |
| D2 | ¿Con qué permiso se leen? | «Yo creo que es más simple que vean todo. Que vean lo mismo. Yo opino que sí, que todos vean lo mismo, sin complicaciones.» | **Cuenta de servicio de Studio**: todos los que tienen el módulo Bandeja ven lo mismo |
| D3 | ¿Quién abre el chat completo del Archivo Kommo? | «Sí, aquí pueden ver lo que dijimos arriba; todos van a ver en esa sección. Pero si quieren abrir el chat completo, solamente lo puede hacer admin y administración, ya que están buscando un caso en específico.» En el formulario: «Abrir archivo kommo: Admin, Contabilidad» | Ver en la ficha: Admin, Comercial y Soporte. Abrir el chat completo del Archivo Kommo: **Admin y Contabilidad** |
| D4 | ¿Cómo se une un chat con una ficha? | «b» | Lista de uniones chat ↔ ficha con solo ids (migración 0554, reservada por el DG) |
| D5 | Fichas sin nombre | «si» (a la opción a) | «Nombre en el chat», solo para leer. Después, «Usar este nombre» para quien edita clientes, con auditoría |
| D6 | Barra de dinero | «Aclarar que si el cliente tiene un saldo, solamente usamos dólares. No hay saldos en bolívares ni USDT, solo hay métodos de pago. […] mi sistema es 100% dólares.» y «Yo opino que las cinco cifras.» | Cinco cifras en USD: cotizado vigente, por facturar, abierto, vencido y cobrado en 30 días. Sin línea de otras monedas |
| D6 · por facturar | ¿Qué embarque cuenta? | «b Sí, «por facturar» significa que ya viene en camino: ya salió de China. Cuando llegue la mercancía a China o se haga el consolidado, se empieza a poner «por facturar». […] Eso se hace normalmente 10 o 15 días antes de que llegue realmente a Venezuela.» | Entra al llegar a la bodega de China o al consolidarse, si no tiene factura. Suma lo de bodega más lo consolidado. Sale al facturar |
| D6 · quién ve | ¿Quién ve el dinero? | Primero: «Las cifras solo las ve contabilidad.» Después, sobre la propuesta de dos niveles: «ok recoemndado» | **Reemplaza la decisión 14 (2026-10-18).** Nivel 1, ver saldo abierto y vencido: Admin, [caja], [atención y CRM] y [comercial]. Nivel 2, las cinco cifras, el estado de cuenta y «Registrar pago»: Admin y [caja]. El resto ve solo «Embarques en curso». Se asigna por persona (SDD-0635), sin nombres en Git |
| D7 | ¿Resumen con IA? | «a sin ai oppor ahora» | Sin IA. Si vuelve, SDD propia y proveedor no chino (regla D-2) |

La fusión de clientes que Sam pidió en la misma conversación va en la **SDD-0651** (fusión v2, amplía la 0246).

## 4. Diseño de la ficha

| Zona | Contenido | Detrás del enlace | Fase |
|---|---|---|---|
| Cabecera | Shipping Mark con historial, nombre o «Sin nombre», tipo, nivel, adjuntos; acciones rápidas: Abrir chat, Cotizaciones, Estado de cuenta, Etiquetas, Editar | Historial de códigos (`ShippingMarkChip`) | F1 |
| Avisos | La solicitud de cambio pendiente, a todo el ancho, encima de las columnas | La solicitud | F1. Reporte de pago, reclamo y vencido llegan en F3 y F4 |
| Barra de dinero | Hoy, la cabecera de cuenta de la 0558 sin cambios | Estado de cuenta | F3 la reemplaza (D6) |
| Columna de datos | Datos, perfil, portal, asesor, direcciones, identidad, facturación, documentos | — | F1 (reordenada) |
| Columna de operación | Envíos de **todos** los códigos de la ficha, aliado, adjuntos | Seguimiento de cada envío | F1. Contenedor, ETA, bodega China, cotizaciones y reclamos en F4 |
| Columna de conversaciones | La tarjeta de hoy, en su columna | La Bandeja (`/studio/bandeja?c=N`) | F1 (lugar). F2 (texto, Archivo Kommo, «Nombre en el chat») |

Columnas por ancho de ventana: tres desde 1.441 px; dos, con las conversaciones abajo, hasta 900 px (con el menú lateral, a menos de 1.440 px la columna central quedaba en ~430 px y cortaba la fila de envíos); una sola por debajo, con operación, conversaciones y datos, en ese orden. Sin acceso a la Bandeja no hay panel y quedan dos columnas. Densidad del Studio (BRAND, perfil denso), solo con tokens de `app/studio/tokens.css`. Las pestañas de la maqueta entran en la F4, cuando la columna central tenga más bloques: en la F1 dividirían poco contenido en muchas partes.

## 5. Fases

### F1 — Reordenar la ficha (esta PR, sin migración)

1. **Envíos de todos los códigos.** `listCodigosDeLaFicha` reúne el vigente, su historial (0367) y los códigos de las fichas fusionadas en ella (`merged_into_client_id`, hasta 10 saltos, como `resolve_markbox`) con sus historiales. `listShipmentsDeLaFicha` lista los envíos vivos de esos códigos. Cada envío con otro código lo dice («con DTD-xxxx»), y una línea cuenta cuántos son. Si la cadena de códigos no se puede leer, cae al vigente: la ficha no se cae.
2. **«Sin nombre»** cuando la ficha no tiene nombre (fichas del sistema anterior o de Kommo).
3. **Acciones rápidas.** «Abrir chat» (la conversación más reciente, solo con Bandeja) y «Cotizaciones» (`/studio/cotizador?client=`, solo con el módulo `quotes`). Un botón que rebota no aparece.
4. **Tres columnas** (§4). La solicitud de cambio pendiente sube a todo el ancho.

Comparación de códigos exacta, igual que antes. Normalizar mayúsculas y espacios como la 0506 queda fuera: cambia qué envíos cuentan y va con su medida. `listShipmentsByMarkbox` no cambia: lo usan las herramientas del agente.

### F2 — Panel de conversaciones (migración 0554)

- **Lista de uniones** `chatwoot_contact_links` (D4): `tenant_id, client_id, chatwoot_contact_id, origen, created_by, created_at`, sin nombres ni teléfonos. RLS por tenant y lectura para los roles con Bandeja. Se llena desde tres lados: el webhook cuando el cruce por teléfono es único (0504); un relleno único con el `client_id` que dejó el cargador de Kommo, que corre en el VPS y sale con solo ids; y «Unir este chat a la ficha», manual y auditado. Al borrar o anonimizar una ficha, sus uniones se borran en cascada.
- **Lectura en vivo** con una cuenta de servicio de Chatwoot (D2): `GET /contacts/{id}/conversations` por cada contacto unido. Studio toma 160 caracteres del último mensaje, el autor, la bandeja, el estado y la fecha. No los guarda, ni en logs ni en caché.
- **«Nombre en el chat»** (D5) cuando la ficha no tiene nombre.
- **Privacidad ante el equipo de China (SDD-0531):** el texto de los mensajes y el «Nombre en el chat» solo salen del servidor si `canSeeClientNames` (`lib/studio/privacidad-cn.ts`) lo permite. Un usuario de región `cn` que no es admin recibe el panel sin texto ni nombre, en el servidor y no con CSS.
- **Abrir:** `/studio/bandeja?c=N`. Para el Archivo Kommo solo se ofrece a Admin y Contabilidad (D3). Contabilidad necesita usuario de Chatwoot, ser miembro del Archivo Kommo y una entrada en Studio; la F2 decide si es la Bandeja entera o una vista solo del Archivo.
- **Estados:** cargando; Chatwoot no responde (con reintento); sin conversaciones; hay conversaciones que tu rol no abre. El aviso no da un número; las conversaciones del Archivo Kommo sí se listan, sin enlace (D3).
- **Puertas, cada una con OK nominal de Sam:** aplicar la 0554; el relleno en el VPS; crear la cuenta de servicio y agregar miembros al Archivo Kommo (D3). La F2 no hace ninguna por su cuenta.
- **Medir antes de construir:** cuánto tarda `/contacts/{id}/conversations` en el entorno de prueba de la 0590. Si pasa de 400 ms, el panel carga aparte.

#### Decisiones tomadas en la F2 (Worker, 2026-11-17; revisables por el DG y Sam)

| ID | Decisión | Por qué |
|---|---|---|
| F2-1 | El panel carga **siempre** aparte (`<Suspense>`), sin esperar la medida | Cumple la regla de los 400 ms en los dos casos. La medida queda en el smoke M de `ficha-conversaciones.poc.test.ts` (Chatwoot 4.19.1 efímero en CI), no en el entorno de la 0590: leer ahí es una puerta |
| F2-2 | Un contacto es de **una** ficha y de **un** tenant (llave `chatwoot_contact_id`: hay una sola cuenta de Chatwoot, F2-11); una ficha puede tener varios contactos | Un chat en dos fichas muestra conversaciones de una persona en la ficha de otra. Mover un chat exige quitarlo primero |
| F2-3 | Ni el webhook ni el relleno pisan una unión existente; «Unir este chat» no mueve un chat unido a otra ficha | Una unión manual (auditada) no la deshace un cruce automático |
| F2-4 | «Quitar la unión», auditada | Una unión equivocada expone conversaciones ajenas: tiene que poder deshacerse sin una migración |
| F2-5 | Unir y quitar piden **editar** la Bandeja (Admin y Comercial); Soporte solo ve. Lo comprueban el ERP y la base | Soporte es de solo lectura en el Studio (`user_has_module` de la 0538) |
| F2-6 | D3 tal cual lo dijo Sam: las conversaciones del Archivo Kommo se **ven** con su texto (Admin, Comercial y Soporte); el enlace **Abrir** solo lo reciben Admin y Contabilidad. Un rol sin Bandeja no recibe nada: ni texto ni enlace | «todos van a ver en esa sección. Pero si quieren abrir el chat completo, solamente […] admin y administración» |
| F2-7 | Contabilidad entra por un **acceso extra por persona a la Bandeja** (SDD-0622/0635), no por cambiar el default del rol. La F2 no le da la Bandeja a nadie | No abre la Bandeja a todo el rol. **Necesita a Sam:** si prefiere una vista solo del Archivo, es otra pieza |
| F2-8 | Una nota interna se nombra («Nota interna») sin su texto | No es del cliente |
| F2-9 | La F2 apagada (sin 0554, sin `CHATWOOT_FICHA_TOKEN`, sin `CHATWOOT_INBOX_ARCHIVO_KOMMO_ID` o sin `CHATWOOT_TENANT_ID`, o con una sesión de otro tenant) o una ficha sin uniones muestran la tarjeta de la F1 | Nada cambia hasta abrir las puertas. Las conversaciones que cruzó el teléfono antes de la 0554 no tienen contacto en `chatwoot_conversations`: entran al panel cuando el webhook las une en su siguiente mensaje |
| F2-10 | La ficha lee las uniones de **su** `client_id`; las de una ficha fusionada en ella no | Mover uniones al fusionar es de la SDD-0651 (fusión v2) |
| F2-11 | Acotar por tenant: la cuenta de servicio, el panel, «Unir» y «Quitar» solo funcionan para el tenant dueño de la cuenta de Chatwoot (`CHATWOOT_TENANT_ID`); otro tenant ve la F1 o recibe exactamente el texto de `moduleEditGate` («No tienes permiso para realizar esta acción.», el mismo que levanta la base con el 42501). La llave de la 0554 es el contacto: un contacto no se une en dos tenants. Acotar por tenant en la base: unir y quitar a mano son **solo de service_role**; el ERP las llama con el cliente de servicio después de su candado, con el tenant y el actor explícitos, y la base vuelve a comprobar que el actor tiene membresía activa en ese tenant y edita la Bandeja (`user_has_module` evaluado como él), que la ficha es de ese tenant y está viva, y audita al actor real | Revisión de la F2 (A2 y N1). Hay una sola cuenta de Chatwoot. La base no conoce el tenant dueño de la cuenta (vive en el entorno), pero ninguna sesión puede escribir uniones llamando la API directo |
| F2-12 | El webhook escribe uniones solo con `CHATWOOT_FICHA_UNIR=1` exacto, apagado por defecto e independiente de la 0554 | Decisión del DG (M1). Una unión no se reevalúa si el teléfono cambia de dueño: se quita a mano |
| F2-13 | Borrar la ficha deja **una** fila de auditoría con los ids de los contactos; restaurarla no restaura las uniones | Revisión de la F2 (B3) |

**Pendiente de Sam (M2, sin cambiar D2):** quien edita la Bandeja (Admin y Comercial) puede unir cualquier conversación de la cuenta a una ficha y leer su último mensaje, aunque en Chatwoot no sea miembro de esa bandeja. Es consecuencia de la cuenta de servicio (D2, «que vean lo mismo»). Si Sam quiere limitarlo a las bandejas de cada persona, se vuelve a leer con el token de cada agente.

### F3 — Barra de dinero en USD (D6)

- Cinco cifras: **cotizado vigente** (`quotes.total_usd` sin vencer), **por facturar** (regla de Sam en §3: recibos en bodega China y embarques consolidados sin factura), **abierto** y **vencido** (`client_outstanding`, 0492), y **cobrado en 30 días** (`payment_receipts`). Todo con los códigos de la ficha (F1).
- Dos niveles de acceso (§3). Hace falta un permiso nuevo, o ampliar `puedeVerSaldoCliente` y `puedeVerEstadoDeCuenta` con la asignación por persona de la SDD-0635. Se decide en la F3, con su prueba de RLS.
- Avisos: reporte de pago por revisar (`payment_reports`) y factura vencida. «Registrar pago» en el nivel 2.
- Estados vacíos obligatorios: hoy no hay facturas reales.

### F4 — Operación en la ficha

En camino ahora, con contenedor y ETA (`consolidation_items → consolidations → sailings`, la misma cadena de `lib/portal/consolidation-queries.ts`); en bodega China (`warehouse_receipts_cn`); cotizaciones y reclamos abiertos. Todo con los códigos de la ficha. Aquí entran las pestañas: Resumen, Embarques, Finanzas, Documentos, Datos e Historial.

### F5 — Actividad unificada (absorbe la 0483)

Una línea de tiempo con los cambios del perfil hechos desde el portal (lo que pedía la 0483, con su decisión «Evento y ver la foto vieja»), pagos, recibos, embarques y conversaciones. Puede pedir una vista SQL; se decide en la F5.

## 6. Datos personales (`revisar-datos-ve`, para la F2)

| Dato | Finalidad | Dónde vive | Quién lo ve | Estado |
|---|---|---|---|---|
| Texto del último mensaje (160 caracteres) | Atender sin salir de la ficha | Solo en memoria del servidor y en la página; ni tabla, ni caché, ni log | Roles con Bandeja (D2); no sale para región `cn` no admin (SDD-0531) | CORRECTO: corte en `lib/studio/chatwoot/ficha-conversaciones.ts:19` y `:92` (nota interna sin texto); por región en `ficha-conversaciones.ts:147`; rol antes del token en `lib/studio/chatwoot/ficha-panel.ts:90` y `:92` (con el tenant dueño); sin caché en `lib/studio/chatwoot/router-api.ts:64`; los logs solo llevan el código en `ficha-panel.ts:70` y `:109`. La 0554 no tiene columna de texto (`supabase/migrations/0554_chatwoot_contact_links.sql:109`, contrato 1c) |
| Nombre del contacto en Chatwoot («Nombre en el chat») | Identificar fichas sin nombre (D5) | Igual, sin guardar; nunca un teléfono o correo (`nombreVisibleDe`) | Igual, y solo si la ficha no tiene nombre | CORRECTO: `ficha-conversaciones.ts:159`; la región se lee en `app/studio/(app)/clientes/[markbox]/page.tsx:318`. Unir un chat usa solo el id del contacto: `app/studio/(app)/clientes/conversaciones-actions.ts:98` |
| Unión chat ↔ ficha | Encontrar los chats de la ficha | Supabase propio: `chatwoot_contact_links`, solo ids, origen y autor | Roles con Bandeja de su tenant (RLS), solo el tenant dueño de la cuenta de Chatwoot (F2-11) | CORRECTO en el contrato: RLS en `0554_chatwoot_contact_links.sql:136`; autor obligatorio en lo manual `:119`; cascada `:111` y al borrar la ficha `:434` (con una fila de auditoría); negativos de rol y tenant en `supabase/tests/0554_chatwoot_contact_links.test.sql` §3. NO VERIFICABLE contra producción: la 0554 no está aplicada |
| Auditoría de unir y quitar | Saber quién unió un chat a una ficha y por qué | `entity_audit_log` (solo agregar), con el id del contacto y el origen, sin nombres | Lo que ya dicta la auditoría del Studio | CORRECTO en el contrato (§4j y §5g). Retención: la de `entity_audit_log`; el evento no se borra al borrar la ficha |

Chatwoot y Studio corren en el servidor propio (`docs/runbooks/servidor-contabo.md`). El panel no llama a terceros, y no hay IA (D7). Revisión con `revisar-datos-ve`, acotada a la F2: hallazgos y NO VERIFICABLE en `.agents/handoffs/sdd-0650-f2-panel-conversaciones.md`. La F1 no agrega datos personales: reordena lo que la ficha ya mostraba y suma envíos de la misma persona. Esto no es asesoría legal.

## 7. Lista exacta de archivos de la F1

| Archivo | Cambio |
|---|---|
| `lib/studio/client-queries.ts` | `listCodigosDeLaFicha` y `listShipmentsDeLaFicha` (nuevas; la segunda filtra tenant además de la RLS) |
| `lib/studio/ficha-cliente.ts` | Reglas puras: `nombreDeLaFicha`, `accionesRapidas` y `codigosConCaida` (nuevo) |
| `app/studio/(app)/clientes/[markbox]/page.tsx` | Envíos de todos los códigos, «Sin nombre», acciones, tres columnas |
| `app/studio/(app)/clientes/_components/ClientDetailClient.tsx` | «Abrir chat» y «Cotizaciones» |
| `app/studio/studio.css` | `.studio-ficha-grid` y sus columnas |
| `lib/studio/__tests__/client-codigos-ficha.test.ts` | Pruebas nuevas de las consultas |
| `lib/studio/__tests__/ficha-cliente.test.ts` | Pruebas nuevas de las reglas puras |
| `app/studio/(app)/clientes/__tests__/ficha-cliente-page.test.tsx` | Pruebas nuevas de la página: acciones, «Sin nombre» y caída al vigente |
| `docs/specs/0651-fusion-clientes-v2/spec.md` | Spec de la fusión v2 (solo documento) |
| `docs/specs/0650-ficha-360-cliente/spec.md` | Esta spec |
| `docs/specs/README.md` | Índice regenerado |
| `.agents/handoffs/sdd-0650-ficha-360.md` | Handoff |

## 8. Aceptación de la F1

- [ ] Con un código en el historial, la ficha lista sus envíos y los marca «con DTD-xxxx».
- [ ] Con una ficha fusionada, en uno o dos saltos, lista los envíos de los códigos de la fusionada y de su historial.
- [ ] Una cadena con ciclo no se repite, y se corta en 10 saltos.
- [ ] Los envíos borrados no aparecen (SDD-0509).
- [ ] Sin códigos, no consulta envíos.
- [ ] Si la cadena falla, quedan los envíos del vigente.
- [ ] «Sin nombre» con un nombre vacío o de espacios.
- [ ] «Abrir chat» solo con Bandeja y alguna conversación; «Cotizaciones» solo con el módulo `quotes`.
- [ ] Tres columnas con Bandeja, dos sin ella; una columna en el teléfono.
- [ ] CI de la PR en verde. `pnpm verify` local no se corre sin turno del Director General.

## 9. Fuera de alcance

- El cambio de la decisión 14 es de la F3. En la F1 la cabecera de cuenta queda como está.
- La fusión v2 es la SDD-0651.
- Leer filas de producción. Las cuentas de cuántas fichas no tienen nombre o tienen contacto de Kommo con `client_id` piden autorización.

## 10. Lista exacta de archivos de la F2

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0554_chatwoot_contact_links.sql` | Tabla, RLS, cinco funciones (unir automática, comprobación del actor, unir y quitar a mano, disparador de ficha borrada), el disparador y el tipo de auditoría (en espera) |
| `0554_desarme`, en `supabase/desarmes/` | Desarme sin número (se nombra sin la extensión: `spec-migration-refs.test.ts` toma todo `NNNN_nombre` con `.sql` como migración) |
| `supabase/tests/0554_chatwoot_contact_links.test.sql` | Contrato: RLS por Bandeja y tenant, unir, quitar, borrar, idempotencia |
| `lib/studio/__tests__/chatwoot-contact-links.migration.test.ts` | El contrato en PGlite, control rojo, 16 mutantes, la llave de una tabla vieja y el desarme |
| `supabase/migrations-baseline.json` · `supabase/pending-migration-symbol-declarations.json` | Espera y degradación declaradas |
| `lib/studio/chatwoot/config.ts` | `chatwootFichaConfig` y `chatwootFichaConfigPara` (`CHATWOOT_FICHA_TOKEN`, `CHATWOOT_INBOX_ARCHIVO_KOMMO_ID`, `CHATWOOT_TENANT_ID`) y `chatwootFichaUnirActivo` (`CHATWOOT_FICHA_UNIR`) |
| `lib/studio/chatwoot/router-api.ts` | `leerConversacionesDeContacto`; `obtenerConversacionYContacto` acepta cualquier cuenta |
| `lib/studio/chatwoot/ficha-conversaciones.ts` | Reglas puras: resumen de 160 caracteres, D3, D5, SDD-0531 |
| `lib/studio/chatwoot/ficha-panel.ts` | Cargador del servidor: rol, configuración, uniones, Chatwoot |
| `lib/studio/chatwoot/union-ficha-manejador.ts` · `webhook-procesar.ts` | El webhook une cuando el teléfono cruzó con una ficha |
| `app/studio/(app)/clientes/conversaciones-actions.ts` | Unir y quitar (candado de edición de la Bandeja) |
| `app/studio/(app)/clientes/_components/ConversacionesFichaCard.tsx` · `PanelConversacionesFicha.tsx` | Panel y sus estados |
| `app/studio/(app)/clientes/[markbox]/page.tsx` | Suspense y región |
| `lib/i18n/es-VE/bandeja.ts` · `lib/i18n/zh-CN/bandeja.ts` | Textos del panel |
| `.env.example` · `infra/dtd-cargo/.env.example` | Las dos variables, vacías |
| Pruebas | `ficha-conversaciones.test.ts`, `ficha-panel.test.ts`, `union-ficha-manejador.test.ts`, `conversaciones-actions.test.ts`, `conversaciones-ficha-card.test.tsx`, `ficha-conversaciones.poc.test.ts` (Chatwoot 4.19.1 efímero); ajustes en `aviso-unico-por-evento.test.ts`, `ficha-cliente-page.test.tsx` y `rbac-actions-guard.test.ts` (acciones 479 → 481, archivos 83 → 84) |
| `infra/chatwoot/pruebas/portal/prueba-portal-poc.sh` · `.github/workflows/chatwoot-portal-poc.yml` | Corren el smoke nuevo |

## 11. Aceptación de la F2

- [ ] Un rol sin Bandeja no lee uniones (RLS) y el servidor no toca el token ni Chatwoot.
- [ ] Otro tenant no ve ni quita uniones; una sesión de otro tenant no usa la cuenta de servicio (panel apagado, unir y quitar denegados); un contacto no se une en dos tenants.
- [ ] Comercial y Soporte ven el texto del Archivo Kommo sin enlace; Admin y Contabilidad (con Bandeja) reciben el enlace. El aviso «Hay conversaciones que tu rol no abre» no da un número; las del Archivo Kommo se listan (D3).
- [ ] Región `cn` no admin: ni texto ni nombre salen del servidor.
- [ ] Sin la 0554, sin token (o con token vacío) o sin uniones, la ficha se ve como en la F1.
- [ ] Chatwoot caído: aviso con «Reintentar»; uno de varios contactos caído: lo leído, marcado incompleto.
- [ ] Unir y quitar: Admin y Comercial, con motivo, auditado con el actor real; solo service_role (ninguna sesión las llama directo); la base rechaza un actor de otro tenant, sin Bandeja o desactivado; no mueve un chat de otra ficha.
- [ ] El webhook une solo con `CHATWOOT_FICHA_UNIR=1`, con cruce único, y nunca pisa una unión.
- [ ] Borrar la ficha borra sus uniones con una fila de auditoría; restaurarla no las restaura.
- [ ] Contrato SQL en Postgres 17 y PGlite, con control rojo y mutantes; smoke contra Chatwoot 4.19.1 con la medida.
- [ ] Puertas de producción sin ejecutar (handoff): aplicar la 0554, relleno en el VPS, cuenta de servicio y variables, miembros del Archivo Kommo y acceso de Contabilidad.
