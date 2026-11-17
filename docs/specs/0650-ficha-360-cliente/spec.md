---
sdd: "0650"
title: "Ficha 360° del cliente en el Studio"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-17
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0246", "0258", "0483", "0504", "0507", "0558", "0585", "0590", "0635", "0647", "0648", "0649", "0651"]
confidencialidad: interno
---

# SDD-0650 — Ficha 360° del cliente en el Studio

> Quien abre la ficha de un cliente en `app/studio/(app)/clientes/[markbox]` ve ahí mismo quién es, cuánto debe, qué tiene en camino y qué escribió por última vez, con enlaces para profundizar.
> Una sola SDD con cinco fases (F1 a F5). **Esta PR implementa solo la F1.** F2 a F5 quedan especificadas y las asigna el Director General.
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
- **Abrir:** `/studio/bandeja?c=N`. Para el Archivo Kommo solo se ofrece a Admin y Contabilidad (D3). Contabilidad necesita usuario de Chatwoot, ser miembro del Archivo Kommo y una entrada en Studio; la F2 decide si es la Bandeja entera o una vista solo del Archivo.
- **Estados:** cargando; Chatwoot no responde (con reintento); sin conversaciones; hay conversaciones que tu rol no abre (sin decir cuántas).
- **Puertas, cada una con OK nominal de Sam:** aplicar la 0554; el relleno en el VPS; crear la cuenta de servicio y agregar miembros al Archivo Kommo (D3). La F2 no hace ninguna por su cuenta.
- **Medir antes de construir:** cuánto tarda `/contacts/{id}/conversations` en el entorno de prueba de la 0590. Si pasa de 400 ms, el panel carga aparte.

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
| Texto del último mensaje (160 caracteres) | Atender sin salir de la ficha | Solo en memoria y en la página | Roles con Bandeja (D2) | NO VERIFICABLE hasta la F2 |
| Nombre del contacto en Chatwoot | Identificar fichas sin nombre | Igual, sin guardar | Igual | NO VERIFICABLE hasta la F2 |
| Unión chat ↔ ficha | Encontrar los chats de la ficha | Supabase propio, con RLS | Roles con Bandeja | Diseño en §F2 |

Chatwoot y Studio corren en el servidor propio (`docs/runbooks/servidor-contabo.md`). El panel no llama a terceros, y no hay IA (D7). La F1 no agrega datos personales: reordena lo que la ficha ya mostraba y suma envíos de la misma persona. Esto no es asesoría legal.

## 7. Lista exacta de archivos de la F1

| Archivo | Cambio |
|---|---|
| `lib/studio/client-queries.ts` | `listCodigosDeLaFicha` y `listShipmentsDeLaFicha` (nuevas) |
| `app/studio/(app)/clientes/[markbox]/page.tsx` | Envíos de todos los códigos, «Sin nombre», acciones, tres columnas |
| `app/studio/(app)/clientes/_components/ClientDetailClient.tsx` | «Abrir chat» y «Cotizaciones» |
| `app/studio/studio.css` | `.studio-ficha-grid` y sus columnas |
| `lib/studio/__tests__/client-codigos-ficha.test.ts` | Pruebas nuevas |
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
