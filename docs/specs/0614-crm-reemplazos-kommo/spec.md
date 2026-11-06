---
sdd: "0614"
title: "Reemplazos de Kommo en el ERP: vista CRM nueva, ficha desde la tarjeta, etapas desde el cotizador, reporte por asesor, KPI de leads y alerta «sin atender» (E6 del programa SDD-0582, paso 6.6)"
status: draft
author: "Claude Worker «E6 reemplazos» (Sam)"
created: 2026-11-06
updated: 2026-11-06
supersedes: null
superseded_by: null
related: ["0582", "0587", "0585", "0586", "0078", "0083", "0084", "0157", "0288", "0610"]
confidencialidad: interno
---

# SDD-0614 — Reemplazos de Kommo en el ERP (E6, paso 6.6)

> **Diseño en borrador, sin código de producto.** Esta SDD no escribe migraciones, no toca
> producción, Kommo, Meta, el VPS ni Chatwoot. La revisa el Director General antes de que exista
> código. Las decisiones que solo Sam puede tomar están en §11 como pendientes, con una
> recomendación cada una.

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [fila 6.6](../0582-chatwoot-piloto/checklist.md) ·
contrato de E6: [SDD-0587](../0587-chatwoot-contrato-sistema-maestro/spec.md) (6.1 a 6.4, aceptados).

**Por qué una SDD aparte.** La SDD-0587 §10 decía que los pasos 6.5 en adelante sumarían allí su
allowlist. El Director General asignó a 6.6 una SDD propia el 2026-11-06. El contrato de la 0587
sigue mandando: esta SDD lo cumple y no lo cambia, salvo donde §11 lo dice con su motivo.

**Etiquetas de evidencia** (las del programa): **C** código leído en esta tarea, **D** documento,
**T** medido en la cuenta de DTD, **I** inferencia, **NV** no verificado. Las citas de código son de
`main` en `3d17292a4` (2026-11-06). No se leyó ninguna fila de ninguna base.

## 0. Resumen: qué reemplaza cada pieza

| # | Pieza | Qué reemplaza de Kommo o del ERP de hoy | Qué hace | Pide migración |
|---|---|---|---|---|
| R1 | **Vista CRM nueva** | Pestañas Dirección, Tablero y Asesor, que leen el espejo `kommo_*` | Pestañas propias **Resumen**, **Embudos** (6.3) y **Sin atender**. Las de Kommo quedan agrupadas hasta el corte | No |
| R2 | **Crear ficha desde la tarjeta** | `convertLead` sobre `kommo_leads` | Crea la ficha del cliente desde la tarjeta, o la liga a una ficha que ya existe | No (usa los grants de la 0506) |
| R3 | **Etapas desde el cotizador** | `patch_price` y `patch_stage` a Kommo | Enviar, aceptar o rechazar un estimado mueve la tarjeta, con reglas de «solo si» | Sí |
| R4 | **Reporte por asesor** | `commercialByAgent` sobre `kommo_leads.responsible_user_id` | Desempeño por dueño de la tarjeta, en el CRM y en Reportes › Por agente | Sí |
| R5 | **KPI de leads** | Los KPI de Dirección (`kommo-analytics.ts`) | Nuevos, abiertos, estimados, aceptados, pasaron a cliente, perdidos, por fuente | Sí |
| R6 | **Alerta «sin atender»** | `leadsSinAtender` (sin consumidor) y los «Ping 23 h» / «Aviso interno — ventana de 24 h por cerrarse» de Kommo | Lista y conteo de tarjetas con el último mensaje sin respuesta, la ventana de 24 h por cerrar o tareas vencidas. Aviso interno, nunca un mensaje al cliente | Sí |
| R7 | **Mantenimiento** (lo que 6.2 a 6.4 le dejaron a 6.6) | — | Registro del cambio de tablero, cron de la retención D6, «Anonimizar ahora», auditoría AUD-01 de la tarjeta y motivos de pérdida predefinidos | Sí |

Todas cuestan **0 en Meta**: ninguna envía mensajes por WhatsApp, Instagram ni Messenger.

## 1. Punto de partida

### 1.1 Lo que ya está y no se repite (6.1 a 6.4, aceptados)

- **6.1** Contrato de sistema maestro, decisiones D1 a D10 (SDD-0587 §3 a §8).
- **6.2** Modelo `crm_*` en la 0506, aplicada el 2026-11-04: tarjetas, etapas, historial, tareas,
  notas, mapeo de IDs, `crm_mover_etapa`, `crm_mover_etapa_auto` y
  `crm_anonimizar_leads_perdidos` (SDD-0587 §14).
- **6.3** Pestaña **Embudos** con los dos tableros, mover, ficha de la tarjeta con dueño, tareas,
  notas e historial (SDD-0587 §15).
- **6.4** Entrada de leads desde Chatwoot y `/registro`, con atribución, en la 0513, aplicada el
  2026-11-04 (SDD-0587 §16).

### 1.2 Lo que 6.2 a 6.4 le dejaron a 6.6

| Pendiente | Dónde se dejó | Pieza de esta SDD |
|---|---|---|
| Agendar `crm_anonimizar_leads_perdidos` (ruta y cron) | SDD-0587 §14.1 | R7 |
| Acción de admin «Anonimizar ahora» | SDD-0587 §14.3 punto 4 y §15.3 punto 4 | R7 |
| Auditoría AUD-01 de crear, ligar y dar dueño a una tarjeta | SDD-0587 §16.6 | R7 |
| Registrar el cambio de tablero al detectarlo (cliente que vuelve a lead sin rastro) | SDD-0587 §4.5 y §15.1 «Límite conocido» | R7 |
| Cruce del detalle del estimado con la tarjeta propia, en vez del espejo | SDD-0587 §1.2, fila «Cotizador» | R3 |
| Una opción para marcar «otro asunto» (Sam, 2026-11-05) | SDD-0587, «Pendiente de E6» | R7 (motivos), sin decidir el criterio de entrada |
| Fusionar dos tarjetas de la misma persona | SDD-0587 §16.5, «propuesta para 6.5 o 6.6» | **Fuera** (§12) |

### 1.3 Código que se reemplaza (**C**)

| Pieza de hoy | Dónde | Lee o escribe |
|---|---|---|
| Página del CRM, pestaña por defecto Dirección | `app/studio/(app)/crm/page.tsx:60` (candado de vista), `_components/kommo-tabs.shared.ts:22-32` | Espejo `kommo_*` |
| KPI de Dirección: leads, contactos, conversión, convertidos, cobertura de correo, valor ERP | `_components/DireccionTab.tsx:298-331`, `lib/studio/kommo-analytics.ts:487` | Espejo y `invoices` |
| Conversión lead → cliente | `lib/studio/kommo-convert.ts:167` (`registration_channel = 'kommo'` en `:216`); acción en `crm/actions.ts:62`, que además encola el Shipping Mark a Kommo (`:82`) | `kommo_leads`, `clients` |
| Etapas desde el cotizador | `cotizador/actions.ts:234` (`transitionStatus`): encola `patch_price` (`:339`) y `patch_stage` (`:349`) | Outbox de Kommo |
| Cruce del estimado web con Kommo | `cotizador/[code]/page.tsx:52` (`findKommoContactsByPhone`) | `kommo_contacts` |
| Reporte por asesor | `lib/studio/reports/queries.ts:601`; vista en `reportes/_components/ReportesClient.tsx:1030` | `kommo_leads`, `kommo_users`, `invoices` |
| «Sin atender» | `lib/studio/kommo-atencion.ts:77`; sin consumidor fuera de pruebas (SDD-0587 §12) | `kommo_tasks` |
| Recuperación (SDD-0157) | `lib/studio/kommo-recovery.ts:259`; CSV con teléfono completo en `:239` | `kommo_contacts`, `clients` |

### 1.4 Hallazgos de esta lectura que cambian el diseño

| # | Hallazgo | Evidencia | Consecuencia |
|---|---|---|---|
| H1 | **Reportes es de contabilidad; las tablas `crm_*` no.** `reports` = `["accounting"]` y admin; la RLS de la 0506 deja leer solo a admin y comercial | `lib/studio/rbac.ts:129`, `app/studio/(app)/reportes/layout.tsx:12`; `crm_puede_usar()` en `0506_crm_modelo.sql:186`. El espejo de Kommo sí lo lee cualquier rol del tenant (`0082_kommo_mirror_schema.sql:145`) | Si Reportes › Por agente lee las tarjetas directo, contabilidad deja de ver lo que ve hoy. Decisión D-6.6-7 |
| H2 | **Recuperación necesita el teléfono completo; la tarjeta sin ficha guarda 10 dígitos** | CSV en `kommo-recovery.ts:239-250`; D6 y el check de `0506_crm_modelo.sql:339` | «La misma salida sobre las tarjetas» (SDD-0587 §6.2) no se puede para los leads sin ficha sin romper D6. Decisión D-6.6-8 |
| H3 | **La auditoría ya no usa un `check`**: desde la 0261 el tipo de entidad es una FK a `audit_entity_types` | `0261_audit_entity_catalog_validate.sql:132`; patrón vigente en `0491_freight_carriers_auditoria.sql:107-122` | Lo que la SDD-0587 §16.6 dice («ampliar `entity_audit_log_entity_type_check`») está vencido: se registra `crm_tarjeta` en el catálogo |
| H4 | **No hay vínculo entre la tarjeta de un lead sin ficha y su conversación.** `chatwoot_conversations` no guarda el contacto; la ficha de 6.3 solo cruza por `client_id` | `0504_chatwoot_eventos.sql:90-104`; `crm/tarjeta-actions.ts:195-221` | «Sin atender» necesita dos fechas en la tarjeta (§3) |
| H5 | **Crear la ficha no vuelve cliente a nadie.** Con la regla de 0.8, cliente = envío vivo o recibo vivo en China | SDD-0587 §1.1 y §4.3, etapa 6 | El botón no puede decir «Convertir en cliente». Decisión D-6.6-2 |
| H6 | **`/privacidad` promete anonimizar a los 12 meses a quien «no llegaste a ser cliente», y nada lo corre.** La función existe sin ruta ni cron, y solo cubre a quien está sin ficha y en «Perdido»: deja fuera al que se queda en otra etapa y al registrado que nunca envió nada | `app/privacidad/page.tsx:345-349`; `git grep crm_anonimizar_leads_perdidos` en `app/`, `lib/`, `scripts/`, `infra/` y `vercel.json`: 0 resultados; predicado en `0506_crm_modelo.sql:768-774`; al ligar una ficha, el check `:339` solo quita nombre y teléfono | Hoy no se incumple todavía (la primera tarjeta es del 2026-11-04, **I**), pero el cron tiene que existir y estar encendido antes. Decisión D-6.6-9 |
| H7 | `crm_mover_etapa_auto` no deja historial si la tarjeta ya está en la etapa | `0506_crm_modelo.sql:731-733` | Entrar a Clientes en «Activo» (su valor por defecto) no deja rastro: el cambio de tablero necesita su propio registro (§2.7) |
| H8 | `crm_mover_etapa_auto` no limpia el motivo al salir de «Perdido»; la 0513 lo hace aparte | `0506_crm_modelo.sql:735-745`; `0513_crm_entrada_leads.sql:159` | Los movimientos del cotizador tienen que limpiarlo igual |
| H9 | «Vencido» no es una transición del estimado: se deriva al pintar | `cotizador/[code]/page.tsx:45` (`isExpired`) | La salida «o vence el SLA» de «Estimado enviado» (SDD-0587 §4.3) no tiene evento. Queda fuera (§12) |
| H10 | Otra sesión diseña un resumen semanal agregado del CRM para marketing (SDD-0610, rama `claude/practical-swartz-5b50ae`) que clasifica `motivo_perdida` como texto libre | Su spec, §1, fila «Motivo de pérdida» | Resuelto por el Director General (P-5): la 0610 usa la clave del motivo de R7, y el texto libre solo en «Otro» |

**DESIGN-CHECK.** El Norte vigente (`docs/design/studio/_norte/`) no trae una pantalla del CRM.
R1 reusa lo que ya está aprobado en el Studio: `KpiCard`, la tarjeta de sección y las barras de
`DireccionTab.tsx`, `DataTable` (TBL-01), `SegmentedControl`, `DrawerShell`, `ConfirmDialog` y el
tablero de 6.3. Si Sam quiere una maqueta antes del código, es la decisión D-6.6-12.

## 2. Diseño por pieza

### 2.1 R1 — Vista CRM nueva

**Pestañas** (`kommo-tabs.shared.ts`):

| Grupo | Pestaña | Qué muestra | Fuente |
|---|---|---|---|
| CRM propio | **Resumen** (nueva, por defecto) | KPI de R5 y tabla por asesor de R4, con selector de período | Tarjetas |
| CRM propio | **Embudos** | El tablero de 6.3, sin cambios salvo el enlace directo a una tarjeta | Tarjetas |
| CRM propio | **Sin atender** (nueva) | La lista de R6, con su conteo en la pestaña | Tarjetas |
| Kommo · hasta el corte | Dirección, Tablero, Asesor, Recuperación | Igual que hoy | Espejo `kommo_*` |

- **`?tab=` sigue igual**: los enlaces viejos (`?tab=direccion`) siguen abriendo su pestaña. Solo
  cambia la que abre sin parámetro (D-6.6-1).
- **Enlace directo** `?tab=embudos&tarjeta=<uuid>`: abre la ficha de la tarjeta en su tablero. Lo
  usan el detalle del estimado (R3) y Sin atender (R6).
- **Encabezado** (`KommoClient.tsx:254-271`): dice qué pestañas leen Kommo una vez al día y cuáles
  son de Studio. Propuesta: «Resumen, Embudos y Sin atender son de Studio: lo que mueves o
  guardas queda aquí. Las pestañas de Kommo se sincronizan una vez al día hasta el corte.» La
  prueba `crm/__tests__/stage-control.test.ts:59` sigue exigiendo que no diga «solo lectura».
- **Accesibilidad (A11Y-01):** las pestañas usan hoy botones con `role="tab"`
  (`KommoClient.tsx:307-330`). Si el patrón no maneja flechas e Inicio/Fin, se corrige con el
  componente de pestañas del sistema (NV: no se probó con teclado en esta tarea).
- **Estados obligatorios** (BRAND §Estados): cargando con `Suspense` (como Embudos), vacío
  distinto de «sin resultados», error con «Reintentar», sin migración («Falta aplicar la
  migración NNNN», como 6.3) y rol sin CRM («Tu rol no usa el CRM propio»).
- **Las pestañas de Kommo no se tocan**: se retiran en 8.7 con su código (§12).

### 2.2 R2 — Crear ficha desde la tarjeta

**Dónde:** en la ficha de la tarjeta (`TarjetaFichaDrawer.tsx`), cuando la tarjeta **no tiene
ficha** y no está anonimizada. Botón «Crear ficha» (D-6.6-2).

**Flujo** (CRT-01, creación rápida desde contexto):

1. **Permiso antes de mostrar**: el mismo candado doble de 6.3 (módulo `kommo` y rol de la RLS)
   y, además, permiso de edición del módulo `clients` (`createClientAction` lo exige,
   `clientes/actions.ts:104-110`).
2. **Buscar duplicados antes de crear**, por teléfono (últimos 10) y correo:
   - Una ficha viva que coincide y **no tiene tarjeta** → se ofrece «Ligar a DTD-0123» en vez de
     crear.
   - Una ficha que coincide y **ya tiene tarjeta** → se detiene: «Esta persona ya tiene una
     tarjeta (DTD-0123). Unir dos tarjetas todavía no se puede.» (fusión, §12).
   - Más de una coincidencia → se muestran y la persona elige; no se adivina (SDD-0587 §5.3).
3. **Formulario mínimo** en un drawer: nombre (precargado con el nombre visible), teléfono,
   correo (opcional) y los campos que `validateClientInput` exija. Enlace «Abrir el formulario
   completo» a Clientes.
4. **Teléfono precargado desde Chatwoot**, solo si la tarjeta tiene contacto: se lee en el
   momento, del lado del servidor, con el token de E10 (`lib/studio/chatwoot/router-api.ts`, hoy
   sin una lectura de contacto por id: se agrega). **No se guarda** en ningún lado salvo en la
   ficha, y solo si la persona confirma. Sin token o sin respuesta, el campo queda vacío y se
   escribe a mano.
5. **Guardar** = el alta de cliente de siempre (misma validación, `next_markbox`,
   `registration_channel = 'admin'`, dueño de la ficha = dueño de la tarjeta si lo tiene) y
   después ligar: `update crm_tarjetas set client_id = …, nombre_visible = null, phone_last10 =
   null`. Ese `update` ya lo permiten los grants de la 0506 (`0506_crm_modelo.sql:418`) y el
   check (`:339`) obliga a quitar nombre y teléfono al ligar.
6. **Resultado**: «Ficha DTD-0123 creada. Sigue en Leads hasta su primer envío.» La tarjeta no
   cambia de etapa ni de tablero: lo hace la regla de 0.8 cuando haya carga.

**Errores:**
- Si el alta funciona y el ligado falla, no se pierde nada: «Ficha DTD-0123 creada; falta ligarla
  a la tarjeta» con «Ligar» para reintentar. Además, el siguiente mensaje por Chatwoot la liga solo
  si el teléfono cruza con esa ficha (0513, `crm_entrada_chatwoot`).
- Choque de la llave única `crm_tarjetas_client_uq` → el mensaje de «ya tiene tarjeta».

**Lo que no hace:** no escribe nada en Kommo (SDD-0587 §5.1, «las tarjetas propias nunca se
escriben en Kommo») ni en Chatwoot; no crea envío ni portal.

**Reuso del alta de cliente:** la implementación extrae el alta de `createClientAction` a una
función compartida, **sin cambiar su conducta** y con sus pruebas de hoy en verde; o la llama tal
como está. Lo que no hace es copiar la validación.

### 2.3 R3 — Etapas desde el cotizador

**Dónde:** al final de `transitionStatus` (`cotizador/actions.ts:234`), después de actualizar el
estimado y junto a los envíos a Kommo de hoy, con el cliente de servicio que ya se usa ahí.
**Nunca rompe ni demora la transición**: una función que no lanza (mismo criterio que la tarjeta
web de 6.4 en `/registro`).

**Cómo encuentra la tarjeta** (en SQL, una RPC de `service_role`). **No repite la regla de
ubicar o crear:** llama a la pieza única de la 10.5, `crm_tarjeta_ubicar_o_crear` (SDD-0586
§10.5.6, pieza 1, decisión E10-D30), que también usan el alta web de la 0513 y los tickets del
portal (§2.8). La pieza cubre los dos caminos, por ficha y por teléfono; 6.6 solo le pasa los datos
y aplica el mapeo de abajo. Si a 6.6 le faltara un parámetro, se agrega redefiniendo la pieza desde
su última definición, no con otra pieza.

1. Estimado con Shipping Mark → ficha viva de ese tenant → la pieza con esa ficha y `fuente =
   'cotizador'` (ya admitida en `0506_crm_modelo.sql:318-320`). Devuelve la tarjeta de la ficha,
   liga la del lead sin ficha que cruza por teléfono o crea una.
2. Estimado web sin Shipping Mark → la pieza con los últimos 10 de `prospect_whatsapp`, el nombre
   visible (`quotes.client_name`) y `fuente = 'cotizador'`.
3. Lo que hace la pieza por teléfono: con una sola ficha para ese número (`crm_ficha_por_telefono`,
   0513:62), sigue como en 1; si no hay ficha, toma la tarjeta sin ficha de ese teléfono
   (`crm_buscar_tarjeta`, 0513:117); si no hay ninguna, crea una con nombre visible y últimos 10
   (D6). **Con más de una coincidencia devuelve `ambigua`: no se mueve nada** y queda un código en
   el log.
4. El tablero que se mueve sale del segmento en ese momento (`crm_segmento_cliente`; sin ficha,
   lead nuevo).

**Mapeo** (clave de evento `estimado:<id del estimado>:<estado>`, idempotente; un movimiento a
mano posterior gana, `crm_mover_etapa_auto`):

| Estimado | Segmento lead → tablero Leads | Segmento cliente → tablero Clientes |
|---|---|---|
| `sent` | → **Estimado enviado**, solo si está en Nuevo, Contactado, Registrado / recontacto, Negociación o Perdido | → **Recompra en curso**, solo si está en Activo, Postventa o Recompra pendiente |
| `accepted` | → **Aceptado, esperando carga**, desde cualquier etapa abierta o desde Perdido | → **Activo**, solo si está en Recompra en curso |
| `rejected` | → **Perdido** con motivo «Estimado rechazado», solo si está en Estimado enviado o Negociación | Sin movimiento (D-6.6-4) |
| Vencido (derivado, H9) | Sin movimiento | Sin movimiento |
| Convertir a embarque | Sin movimiento: un envío en borrador no cuenta (SDD-0587 §4.3). El tablero cambia cuando el envío vive (R7) | Igual |

- **«Solo si» evita retroceder**: un estimado nuevo no saca de «Aceptado, esperando carga» a quien
  ya aceptó otro.
- **Al salir de «Perdido» se borra el motivo** (H8), igual que `crm_volver_a_recontacto`.
- **Con Kommo en F2**: los envíos `patch_price` y `patch_stage` siguen como hoy hasta 8.7, para los
  leads que Kommo atiende (D-6.6-3). El contrato decía «en vez de» (SDD-0587 §5.1); esta SDD
  propone «además de» hasta el corte, porque Kommo sigue siendo maestro de sus leads en F2
  (SDD-0587 §3).

**Detalle del estimado** (`cotizador/[code]/page.tsx`): si hay tarjeta, una línea «En el CRM:
Leads · Estimado enviado» con enlace a la ficha (R1). El cruce con Kommo (`:52`) sigue mientras
exista el espejo.

### 2.4 R6 — Alerta «sin atender»

**La definición es una sola y está en §2.8 (D-SA).** Aquí, de dónde salen los datos y dónde se ve.

| Señal de D-SA | Reemplaza |
|---|---|
| **Espera respuesta** (Chatwoot o ticket del portal) | La tarea vencida «Responder al cliente» de los agentes de Kommo (`kommo-atencion.ts:1-15`) |
| **Ventana por cerrar o cerrada** (solo Chatwoot) | «Ping 23 h» y «Aviso interno — ventana de 24 h por cerrarse», como alerta interna (D8 de la 0587) |
| **Tarea vencida** | `leadsSinAtender` sobre `kommo_tasks` (sin fecha no vence, igual que `kommo-atencion.ts:62`) |

**Qué cuenta como respuesta humana en Chatwoot** (para `ultima_respuesta_at`):

| Mensaje de Chatwoot | ¿Respuesta? |
|---|---|
| Saliente, no privado, escrito por un agente que no es el usuario de servicio | Sí |
| Saliente sin remitente: eco de lo que DTD escribió desde el teléfono o la app de Instagram (SDD-0587, «Pendiente de E6») | Sí |
| Nota privada | No |
| Mensaje de actividad | No |
| Respuesta de un bot (`AgentBot`) | No |
| La redirección automática de E10 | **No.** Sale con el token del usuario de servicio (`router-api.ts:10`) como `outgoing` y no privado (`:123`), así que se excluye por el id de ese usuario, `chatwootServicioUserId()` (`config.ts:67`). Sin ese id configurado, ningún saliente de agente cuenta: la alerta avisa de más, nunca de menos |

La dirección y el remitente salen del payload de `message_created` (`message_type`, `private`,
`sender`), que `interpretarEvento` ya lee en parte (`webhook-events.ts:129`). Que 4.19.1 mande el
tipo y el id del remitente en el webhook es **NV**: se confirma en su fuente, como hizo 6.4
(SDD-0587 §16.2).

En el portal, la respuesta es la primera respuesta del ticket (`primera_respuesta_at`, E10-D29 de
la SDD-0586). 6.6 no la vuelve a calcular.

**Límite (I):** una conversación que E10 redirige al otro número queda como «espera respuesta»
hasta que alguien del equipo conteste. Es lo que pide excluir la redirección; si molesta, se decide
después con datos.

**Dónde se ve:**
- Pestaña **Sin atender** con su número. Ordenada por la espera más larga. Filtro «Mías / Todas».
  Cada fila: nombre o Shipping Mark, tablero y etapa, la señal en palabras («Espera respuesta hace
  3 h · la ventana se cierra en 1 h»), dueño, y «Abrir ficha». Sin texto de mensajes.
- **Aviso al dueño** cuando la ventana entra en sus últimas 4 h, si Sam lo elige (D-6.6-6): push
  interno con `enqueueUserPush` (el de `webhook-procesar.ts:103`), una vez por ventana (clave
  `crm-ventana:<tarjeta>:<hora del entrante>`), **sin nombre ni teléfono en el aviso** (sale por los
  servicios de push del navegador y se ve en la pantalla bloqueada): «CRM · ventana por cerrar. A
  una conversación le quedan menos de 4 h para responder sin plantilla.» Sin dueño activo, va a los
  agentes vinculados, como `avisarPorPush`.

**Límite conocido (I).** Lo que se contesta por fuera de Chatwoot (Kommo, en F2) solo cuenta si
llega a Chatwoot como eco. Si no llega, esa tarjeta aparece como «sin atender» aunque se haya
contestado. Se mide en prueba con conteos de ecos por bandeja antes de encender el aviso.

### 2.5 R5 — KPI de leads

Período elegible: 7, 30 o 90 días (presets reales, DAT-01). Los cortes van a medianoche de
Venezuela (UTC−4). «Ahora» para las fotos del momento.

| KPI | Fórmula | Fuente |
|---|---|---|
| **Leads abiertos** (foto) | Tarjetas vivas en el tablero Leads con etapa no terminal | `crm_tarjetas`, segmento en el momento, `crm_etapas.terminal` |
| **Nuevos** (período) | Tarjetas creadas en el período, por fuente | `crm_tarjetas.created_at`, `fuente` |
| **Estimados enviados** (período) | Tarjetas distintas que entraron a «Estimado enviado» o «Recompra en curso», a mano o solas | `crm_historial_etapas.a`, `ocurrio_at` |
| **Aceptados** (período) | Tarjetas distintas que entraron a «Aceptado, esperando carga» | Igual |
| **Pasaron a cliente** (período) | Cambios de tablero Leads → Clientes observados, sin contar la ubicación inicial | `crm_cambios_tablero` (§3) |
| **Conversión de la cohorte** | De las tarjetas creadas en el período, el % que hoy está en Clientes | `crm_tarjetas`, segmento en el momento |
| **Perdidos** (período) | Tarjetas distintas que entraron a «Perdido», por motivo | `crm_historial_etapas`, motivo predefinido (R7) |
| **Sin atender** (foto) | Tarjetas con alguna señal de R6 | §2.4 |
| **Embudo** (foto) | Leads abiertos por etapa, en el orden del admin | `crm_etapas.orden` |
| **Tiempo en la etapa** (foto) | Mediana de días desde `etapa_leads_at` por etapa abierta. Reemplaza al «cementerio» de Dirección | `crm_tarjetas.etapa_leads_at` |

**Una sola definición.** Las fórmulas viven en SQL (RPC de la migración, §3) y las usan la pestaña
Resumen, Reportes y el cron. Así no hay dos versiones que diverjan, como pide la 0587 para el
segmento (§4.2).

**Si la lectura se queda corta** (tope de filas), la pantalla lo dice, igual que Dirección hace hoy
con `complete` (`kommo-analytics.ts:470-475`).

### 2.6 R4 — Reporte por asesor

**Asesor = dueño de la tarjeta** (`crm_tarjetas.asesor_id`, D9 de la 0587), no quien contesta el
chat. Sin dueño → fila «Sin dueño».

| Columna | Fórmula |
|---|---|
| Abiertas en Leads | Leads abiertos con ese dueño (foto) |
| Nuevas | Nuevos del período con ese dueño |
| Estimados | Estimados enviados del período |
| Aceptadas | Aceptados del período |
| Perdidas | Perdidos del período |
| Pasaron a cliente | Del período |
| Sin atender | Foto |
| Tareas vencidas | Tareas abiertas y vencidas asignadas a la persona o, sin asignado, de sus tarjetas |
| Facturado 12 meses | Facturación de las fichas de sus tarjetas, con `clientAnnualBilling`, como hoy. Sam dijo el 2026-11-02 que producción aún no tiene facturas reales (no medido aquí): hoy da 0 y la vista lo dice |

**Límite (I):** la atribución es al dueño de hoy. Si una tarjeta cambia de dueño, su historia se
cuenta para el nuevo. El historial guarda quién movió, no quién era el dueño.

**Dónde:** en Resumen, debajo de los KPI, para admin y comercial. En **Reportes › Por agente**, para
quien ve Reportes, con la misma RPC de agregados (D-6.6-7, H1). **La RPC devuelve solo conteos y
totales por asesor, con el id del usuario del equipo: ni ids de fichas, ni de tarjetas, ni
nombres de personas.** El facturado lo suma dentro de la base con `studio_client_annual_billing`, la
misma RPC que usa `clientAnnualBilling` (`lib/studio/fidelizacion/queries.ts`), así que tampoco
salen los Shipping Marks. Los nombres del equipo se ponen en la app con `listTenantAdvisors`, como
la ficha de la tarjeta. Mientras Kommo atienda, Reportes muestra también la tabla actual del espejo,
rotulada «Kommo · hasta el corte»; si no, contabilidad perdería de golpe lo que ve hoy.

### 2.7 R7 — Mantenimiento

**a) Cambio de tablero.** Una tabla de historia, `crm_cambios_tablero` (§3), y un cron cada hora:

1. Para cada tarjeta viva calcula el tablero de hoy (segmento en el momento, como el tablero de
   6.3) y lo compara con el último registrado.
2. Sin registro previo → guarda la ubicación inicial (`inicial = true`), que **no cuenta** como
   conversión.
3. Distinto del último → guarda el cambio con clave `<tarjeta>:<id del registro anterior>`: dos
   corridas a la vez no lo duplican.
4. Clientes → Leads → además, `crm_mover_etapa_auto` a «Registrado / recontacto» con esa clave
   (SDD-0587 §4.5); un movimiento manual posterior gana. Esto cierra el «Límite conocido» de 6.3.
5. Leads → Clientes → `crm_mover_etapa_auto` a «Activo». Si ya estaba en «Activo» no hay fila en
   el historial (H7), pero sí en `crm_cambios_tablero`.

**No contradice la regla de 0.8** (I): el tablero que se pinta se sigue calculando en el momento;
la tabla es historia para los KPI, nunca la fuente del segmento. El Director General eligió la tabla
propia (P-2): un movimiento a la misma etapa no deja fila (`0506_crm_modelo.sql:731-733`), y en el
historial `de` y `a` son etapas, no tableros.

**b) Retención D6.** Cron diario a las 04:45 de Venezuela que corre la anonimización en cada tenant
con CRM, con el predicado que Sam elija en D-6.6-9. Con la opción recomendada:

- **Toda tarjeta cuya persona no es cliente hoy** (segmento lead nuevo o lead registrado), en
  cualquier etapa, con 12 meses sin actividad: se borran nombre visible, teléfono, contacto, BSUID,
  motivos, notas, tareas, mapeos y las dos fechas de §3. **Si tiene ficha, además se desliga**
  (`client_id` a nulo). Sin desligarla, la llave única `crm_tarjetas_client_uq`
  (`0506_crm_modelo.sql:348`) impediría que esa persona tenga una tarjeta nueva si vuelve a escribir.
  La ficha no se toca: sigue el plazo de la cuenta («Mientras tengas una cuenta o relación activa»,
  `app/privacidad/page.tsx:331-333`).
- **En toda tarjeta, también la de un cliente,** el BSUID se borra al año sin actividad: la misma
  lista de `/privacidad` lo promete aparte (`app/privacidad/page.tsx:352-354`).

**c) Los dos crons nacen apagados** (decisión del Director General): el de cambio de tablero, cada
hora, y el de retención, cada día. Cada uno mira su interruptor del servidor y solo `"1"` lo
enciende, como `CRM_ALTA_WEB_SIN_KOMMO` en 6.4: `CRM_CAMBIOS_TABLERO` y `CRM_RETENCION`. El aviso de
ventana (D-6.6-6) tiene el suyo, `CRM_AVISO_VENTANA`, también apagado. Apagado, la ruta responde
`apagado` y no escribe nada. **Encender cada uno es un OK aparte de Sam:** ni fusionar ni publicar
activan escrituras irreversibles. Mientras estén apagados:

- el KPI «Pasaron a cliente» dice «Sin registro: está apagado» en vez de mostrar 0;
- el cliente que vuelve a lead sigue con el límite de 6.3 (SDD-0587 §15.1);
- **lo que promete `/privacidad` sigue sin cumplirse** (H6). Hay que encender la retención antes de
  que la primera tarjeta cumpla 12 meses sin actividad: la más vieja es del 2026-11-04 (SDD-0587,
  sección de esa fecha), así que el plazo más temprano posible es el 2027-11-04.

**d) «Anonimizar ahora».** En la ficha de la tarjeta, solo para admin y solo si la tarjeta **no
tiene ficha** (D-6.6-10):

- Confirmación con `ConfirmDialog` (MP-01: es irreversible) y un motivo de una lista corta, sin
  texto libre: «Lo pidió la persona», «Se cargó por error».
- Hace la misma limpieza que la anonimización por plazo (nombre, teléfono, contacto, BSUID,
  motivos, notas, tareas, mapeos), más las dos fechas de §3. La tarjeta queda para los conteos.
- El diálogo dice la verdad sobre lo que no borra: «Esto borra los datos de la tarjeta en Studio.
  El contacto y la conversación siguen en Chatwoot: si la persona pidió que la borren, hay que
  borrarlos allá también.»
- Con ficha, el botón no aparece: el borrado de una persona con ficha va por la ficha del cliente
  (borrado en suave de la 0455 y su purga).

**e) Auditoría (AUD-01).** Un trigger en `crm_tarjetas`, en la misma transacción que el cambio, con
el patrón de la 0491 y la **regla única D-AUD de §2.8**:

| Evento | Cuándo | Qué guarda |
|---|---|---|
| `crm_tarjeta_created` | Alta | Fuente; si tiene ficha y si tiene contacto, solo sí o no |
| `crm_tarjeta_linked` | `client_id` pasa de nulo a una ficha | Solo `con_ficha: true`: **no** el id de la ficha |
| `crm_tarjeta_unlinked` | `client_id` vuelve a nulo (retención de §2.7 b) | `con_ficha: false` |
| `crm_tarjeta_owner_changed` | Cambia el dueño | Ids del dueño anterior y del nuevo (usuarios del equipo) |
| `crm_tarjeta_anonymized` | Anonimizar, a mano o por plazo | El motivo de la lista o `plazo` |

Los cambios de etapa no se duplican aquí: ya están en `crm_historial_etapas`, con su propio
contrato (SDD-0587 §16.6).

**f) Motivos de pérdida predefinidos** (D-6.6-11). El diálogo de «Perdido» de 6.3 ofrece una lista:
«No es lead / otro asunto», «Precio», «No respondió», «Compró con otro», «Fuera de lo que hacemos»,
«Estimado rechazado» (lo pone R3) y «Otro» con texto (hasta 200 caracteres, como hoy). Se guarda la
clave junto al texto actual. Esto le da a Sam la opción «otro asunto» que pidió el 2026-11-05.
**No decide** si una conversación que abre DTD crea una tarjeta: eso sigue pendiente con él
(SDD-0587, «Pendiente de E6»).

### 2.8 Coordinación con la 10.5 y las dos definiciones únicas

**Con la PR #400** (paso 10.5, tickets del portal, SDD-0586 §10.5), que va **primero y en serie**:

- **Comparten archivos:** `TarjetaFichaDrawer.tsx`, `CrmTableroKanban.tsx`, `tarjeta-actions.ts`,
  `crm-ficha.ts` y `supabase/pending-migration-symbol-declarations.json`. La implementación de 6.6
  arranca sobre `main` con la 10.5 ya fusionada y no edita esos archivos mientras la 10.5 los tenga
  abiertos.
- **Una sola pieza para ubicar o crear la tarjeta:** `crm_tarjeta_ubicar_o_crear` de la 10.5
  (E10-D30), por ficha y por teléfono, sirve al alta web de la 0513, a los tickets y al cotizador de
  6.6 (§2.3). 6.6 no la copia.
- **Migración:** la de 6.6 va después de la de la 10.5 y su preflight la exige. Ninguna de las dos
  reserva número ahora: se asigna al arrancar cada una (P-6).
- **Las dos definiciones de abajo las fija esta SDD, una sola vez.** La 10.5 las cita igual; si
  alguna cambia, cambia aquí.

**D-SA · Definición de «sin atender»** (única para la alerta, los reportes, el conteo y el aviso)

Una tarjeta está *sin atender* si está viva (no anonimizada, ficha no borrada, etapa no terminal en
su tablero del momento) y cumple al menos una de estas señales:

1. **Espera respuesta en Chatwoot:** `ultimo_entrante_at` no es nulo, `ultima_respuesta_at` es nulo
   o anterior a él, y pasó el umbral (D-6.6-5) desde `ultimo_entrante_at`.
2. **Espera respuesta en el portal:** tiene un ticket abierto del portal (SDD-0586 §10.5) sin
   `primera_respuesta_at`, y pasó el umbral desde su `abierto_at`.
3. **Ventana por cerrar o cerrada**, solo en Chatwoot: la señal 1 y pasaron 20 h desde
   `ultimo_entrante_at` (por cerrar) o 24 h (cerrada: hace falta plantilla). En el portal no hay
   ventana.
4. **Tarea vencida:** una tarea abierta de la tarjeta con `vence_at` anterior a ahora. Sin fecha
   no vence.

**Respuesta humana**, en Chatwoot: un mensaje saliente no privado de un agente que no es el usuario
de servicio (`chatwootServicioUserId()`, `lib/studio/chatwoot/config.ts:67`), o un eco sin
remitente. No lo son una nota privada, un mensaje de actividad, un bot ni la redirección de E10.
Sin el id del usuario de servicio configurado, ningún saliente de agente cuenta. En el portal, la
primera respuesta del ticket (E10-D29). La calcula **una sola función SQL**, `crm_sin_atender`
(§3). El «vencido» del ticket del portal (E10-D23: sin primera respuesta al terminar el día) es
otra cosa: es la promesa del portal y sigue siendo de la 10.5.

**D-AUD · Qué lleva la auditoría del CRM** (única para los tipos `crm_*`: `crm_tarjeta` de esta
SDD y `crm_ticket` de la 10.5)

- **Entidad:** `entity_id` es el id de la fila del CRM (la tarjeta o el ticket).
- **Puede llevar:** ids de filas propias del CRM (tarjeta, ticket), ids de usuarios del equipo
  (dueño, quien cerró), claves de etapa, fuente, motivo de lista, estado, número del episodio y
  banderas sí o no.
- **Nunca lleva:** `client_id`, Shipping Mark, nombre, teléfono, correo, contacto de Chatwoot,
  BSUID, texto libre (notas, tareas, motivo «Otro», mensajes) ni montos. `entity_audit_log` es de
  solo agregar y sobrevive a la purga de la ficha: nada de lo que guarda puede identificar a la
  persona después.
- **Actor:** `user` con `auth.uid()` **solo si ese usuario es miembro activo del tenant de la
  fila** (`user_tenants`, sin `disabled_at`). Lo que dispara un cliente del portal, el webhook de
  Chatwoot, un cron o `service_role` lleva `system`, con `actor_id` nulo, nunca el `auth.uid()` del
  cliente. El origen va en `source`, con los valores que admite la 0267
  (`0267_audit_contract_append_only.sql:324-336`): `studio` (el equipo en Studio, incluido el
  cotizador), `webhook` (Chatwoot), `job` (crons) y `rpc` (portal y alta web de `/registro`).
- **Misma transacción que el cambio** (AUD-01). En la 10.5, el ticket y su evento van juntos
  dentro del bloque que nunca rompe el mensaje del cliente (E10-D24).

## 3. Modelo de datos y migración

**Una migración**, descrita aquí y **no escrita**. Número: se asigna al arrancar el código, no
antes, y no se reserva ninguno ahora (P-6). Va después de la 0506 y la 0513, ya aplicadas, y de la
migración de la 10.5 (§2.8). **Aplicarla pide el OK nominal de Sam** y el
[runbook de producción](../../runbooks/aplicar-migraciones-prod.md). Es aditiva: no borra ni
renombra nada. Aplicarla no enciende nada: los crons dependen de sus interruptores (§2.7 c).

| Objeto | Cambio | Quién lo escribe |
|---|---|---|
| `crm_tarjetas.ultimo_entrante_at`, `ultima_respuesta_at` | Columnas nuevas `timestamptz`, nulas. Sin grant de INSERT ni UPDATE a `authenticated`. La anonimización las pone en nulo | `service_role` |
| `crm_tarjetas.motivo_perdida_clave` y `crm_historial_etapas.motivo_clave` | Columna nueva con `check` a la lista de R7. El texto actual se queda | `crm_mover_etapa` y el RPC de R3 |
| `crm_cambios_tablero` | Tabla nueva: `id`, `tenant_id`, `tarjeta_id` (borrado en cascada), `de` y `a` (`leads` o `clientes`), `inicial`, `clave` única por tenant, `detectado_at`. Sin datos de personas. RLS de lectura con `crm_puede_usar()` | `service_role` |
| `crm_registrar_mensaje(tenant, contacto, ficha, dirección, ocurrió)` | Ubica la tarjeta con `crm_buscar_tarjeta` y sube la fecha con `greatest`: dos veces no cambia nada | `service_role` |
| `crm_mover_por_estimado(tenant, estimado, estado, ocurrió)` | §2.3 completo: ubica o crea con `crm_tarjeta_ubicar_o_crear` de la 10.5, por ficha o por teléfono; con `ambigua` no mueve nada; «solo si»; limpiar motivo | `service_role` |
| `crm_registrar_cambios_tablero(tenant, ahora)` | §2.7 a. Devuelve cuántos cambios guardó | `service_role` |
| `crm_sin_atender(umbral, ahora)` | D-SA (§2.8), por tarjeta, incluidos los tickets del portal de la 10.5. Una variante con tenant para el cron | `authenticated` con `crm_puede_usar()`; la variante, `service_role` |
| `crm_kpis(desde, hasta, umbral)` | Las fórmulas de §2.5. Solo conteos | Admin y comercial |
| `crm_resumen_por_asesor(desde, hasta, umbral)` | Las de §2.6. Solo conteos y totales por asesor, con el id del usuario del equipo; el facturado, sumado adentro con `studio_client_annual_billing`. Ni ids de fichas ni de tarjetas | Admin y comercial; también contabilidad si D-6.6-7 es (a) |
| `crm_anonimizar_tarjeta(tarjeta, motivo)` | §2.7 d. Exige admin del tenant de la tarjeta y tarjeta sin ficha | `authenticated` (con ese chequeo adentro) |
| `crm_anonimizar_leads_perdidos` | Redefinida **desde su última definición** (`0506_crm_modelo.sql:759`) para compartir la limpieza con la anterior y con el predicado de D-6.6-9. Con la opción recomendada, desliga la ficha y borra el BSUID al año (§2.7 b). El nombre se conserva para no romper llamadas; si conviene otro, se decide al escribirla | `service_role` |
| `crm_mover_etapa` | Redefinida desde `0506_crm_modelo.sql:623` solo para aceptar la clave del motivo | `authenticated`, como hoy |
| `audit_entity_types` | Fila `crm_tarjeta`, dominio `commercial` (existe en `0258_audit_entity_catalog.sql:127`) | Migración |
| `audit_crm_tarjeta_change()` | Trigger de §2.7 e, con la regla D-AUD (§2.8) | Trigger |

**Preflight:** exige la 0506, la 0513 y la migración de la 10.5 (`crm_tarjeta_ubicar_o_crear`,
`crm_tickets`), y aborta si esta ya se aplicó, como la 0513 (SDD-0587 §16.3). **Contrato en
PGlite** con las migraciones reales (§8).

## 4. Permisos y RLS

| Acción | Candado en la app | Candado en la base |
|---|---|---|
| Ver Resumen, Embudos y Sin atender | `requireModuleView("kommo")` + rol con CRM (`rolUsaCrm`) | RLS de la 0506: `crm_puede_usar()` (admin y comercial) |
| Crear ficha / ligar | `puertaEdicion` de 6.3 + `moduleEditDenial("clients")` | Insert de `clients` con su RLS; `update` de `crm_tarjetas` con los grants de la 0506 |
| Mover por el cotizador | `moduleEditDenial("quotes")`, el de la transición de hoy | RPC solo de `service_role` |
| Registrar mensajes | Webhook firmado de E2 | RPC solo de `service_role` |
| KPI y por asesor en el CRM | Igual que ver | RPC con `crm_puede_usar()` |
| Por agente en Reportes | `requireModuleView("reports")` | RPC de agregados con admin, comercial o contabilidad (D-6.6-7) |
| Anonimizar ahora | `puertaEdicion` + rol admin | RPC que vuelve a exigir admin del tenant de la tarjeta |
| Cron de cambio de tablero, de retención y aviso de ventana | `CRON_SECRET`, como las demás rutas de `app/api/cron/`, **y su interruptor** (`CRM_CAMBIOS_TABLERO`, `CRM_RETENCION`, `CRM_AVISO_VENTANA`): apagados, no escriben | `service_role`, acotado por tenant |

Ningún permiso por usuario (desvíos de `rbac-guard`) abre las tablas `crm_*`: sigue mandando el
rol, como en 6.3 (SDD-0587 §14.1, «Permisos por usuario»).

## 5. Pantallas y allowlist exacta

Cuatro tramos en **dos PR en serie contra `main`, sin apilar** (decisión del Director General,
P-3): **PR A = S1 + S2** y **PR B = S3 + S4**. La PR B se abre desde `main` cuando la A ya está
fusionada. Las dos van después de la implementación de la 10.5 (§2.8). Las pruebas de cada tramo
van en el mismo tramo.

**S1 · Base de datos**
- `supabase/migrations/NNNN_crm_reemplazos_kommo.sql` (número al empezar)
- `supabase/tests/NNNN_crm_reemplazos_kommo.test.sql`
- `lib/studio/__tests__/crm-reemplazos.migration.test.ts`
- `supabase/migrations-baseline.json` (solo la entrada nueva)
- `supabase/pending-migration-symbol-declarations.json` (solo la entrada `sdd-0614-crm-reemplazos`)

**S2 · Cotizador y ficha desde la tarjeta**
- `app/studio/(app)/cotizador/actions.ts` (solo `transitionStatus`: la llamada que no lanza)
- `app/studio/(app)/cotizador/[code]/page.tsx` (solo la línea del CRM)
- `lib/studio/crm-estimado.ts` (nuevo)
- `app/studio/(app)/crm/tarjeta-actions.ts` (verbos de buscar duplicados, crear ficha y ligar)
- `app/studio/(app)/crm/_components/CrearFichaDrawer.tsx` (nuevo) y `TarjetaFichaDrawer.tsx` (el botón)
- `lib/studio/crm-ficha.ts` (tipos)
- `lib/studio/chatwoot/router-api.ts` (solo la lectura de un contacto por id)
- `app/studio/(app)/clientes/actions.ts` y `lib/studio/client-alta.ts` (nuevo), **solo si** se extrae el alta (§2.2)
- Pruebas: `lib/studio/__tests__/crm-estimado.test.ts`, `app/studio/(app)/cotizador/__tests__/transicion-tarjeta-crm.test.ts`, `app/studio/(app)/crm/__tests__/tarjeta-actions-gate.test.ts` (casos nuevos), `app/studio/(app)/crm/_components/CrearFichaDrawer.test.tsx`, `lib/studio/rbac-actions-guard.test.ts` (conteo de acciones)

**S3 · Vista, KPI, por asesor y sin atender**
- `lib/studio/chatwoot/webhook-events.ts` (dirección y tipo de remitente, sin nombres), `webhook-procesar.ts` (lista de manejadores), `lib/studio/chatwoot/respuestas.ts` (nuevo manejador)
- `lib/studio/crm-kpis.ts` (nuevo: tipos y lecturas de las RPC)
- `app/studio/(app)/crm/page.tsx`, `_components/kommo-tabs.shared.ts`, `_components/KommoClient.tsx` (pestañas, encabezado y slots)
- `app/studio/(app)/crm/_components/CrmResumenSlot.tsx`, `CrmResumen.tsx`, `CrmSinAtenderSlot.tsx`, `CrmSinAtender.tsx` (nuevos)
- `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx` y `CrmEmbudosClient.tsx` (solo `?tarjeta=`)
- `lib/studio/reports/queries.ts` y `types.ts` (Por agente), `app/studio/(app)/reportes/_components/ReportesClient.tsx` (solo `ByAgentView`)
- Pruebas: `lib/studio/chatwoot/__tests__/respuestas.test.ts`, `webhook-events.test.ts`, `webhook-fixtures.ts`, `lib/studio/__tests__/crm-kpis.test.ts`, `app/studio/(app)/crm/_components/CrmResumen.test.tsx`, `CrmSinAtender.test.tsx`, `app/studio/(app)/crm/__tests__/stage-control.test.ts` y `crm-rename.test.ts` (si fijan pestañas o encabezado), `lib/studio/reports/__tests__/queries.test.ts`

**S4 · Mantenimiento**
- `app/api/cron/crm-mantenimiento/route.ts` y `app/api/cron/crm-retencion/route.ts` (nuevos), `lib/studio/crm-mantenimiento.ts` (nuevo)
- `vercel.json` (dos entradas) e `infra/dtd-cargo/cron/crontab` (regenerado con `scripts/build-crontab.mjs`, no a mano)
- `.env.example` e `infra/dtd-cargo/.env.example` (solo `CRM_CAMBIOS_TABLERO`, `CRM_RETENCION` y `CRM_AVISO_VENTANA`, vacías: apagadas)
- `app/studio/(app)/crm/tarjeta-actions.ts` (anonimizar ahora), `_components/TarjetaFichaDrawer.tsx` (botón y diálogo), `_components/CrmTableroKanban.tsx` (motivos en el diálogo de «Perdido»)
- `docs/runbooks/crm-mantenimiento.md` (nuevo: qué corre, a qué hora, cómo se ve si falló)
- Pruebas: `app/api/cron/crm-mantenimiento/__tests__/route.test.ts`, `app/api/cron/crm-retencion/__tests__/route.test.ts`, `lib/studio/__tests__/crm-mantenimiento.test.ts`, `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx`, `scripts/__tests__/build-crontab.test.ts` y `scripts/__tests__/infra-env-example.test.ts` (sin cambios: tienen que seguir verdes)

**En todos los tramos:** esta spec, `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 6.6),
`docs/specs/README.md` (índice regenerado) y `.agents/handoffs/0614-*.md`.

**Este borrador** toca solo: esta spec, `docs/specs/README.md`,
`.agents/handoffs/0614-crm-reemplazos-kommo.md` y, por P-1, una línea en la SDD-0587 §10
(`docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md`) que apunta aquí.

## 6. Datos personales (revisar-datos-ve)

Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Se evalúa el código de
`main` que 6.6 toca y se dice qué exige el diseño; lo diseñado no es **CORRECTO** hasta que exista.
**Esto no es asesoría legal.**

**Resumen sobre el código de hoy:** 4 CORRECTO, 3 ENCONTRADO, 4 NO VERIFICABLE y 1 no aplica.

**Inventario que suma 6.6:**

| Dato | Dónde | De quién | Finalidad | Retención |
|---|---|---|---|---|
| Nombre visible y últimos 10 dígitos de quien pidió un estimado por la web sin ficha | `crm_tarjetas` con `fuente = 'cotizador'`, copiados de `quotes.client_name` y de `quotes.prospect_whatsapp` (§2.3, paso 3). Del teléfono, solo los 10 últimos | Prospecto sin ficha que usó el cotizador web | Seguir su estimado en el tablero Leads | D6: se anonimiza a los 12 meses sin actividad (§2.7 b). El estimado sigue en `quotes` con su propio plazo, que 6.6 no cambia |
| Hora del último entrante y de la última respuesta | `crm_tarjetas` (§3) | Lead o cliente que escribe por Chatwoot | Saber si alguien espera respuesta y si la ventana de 24 h se cierra | Con la tarjeta; se borran al anonimizar |
| Clave del motivo de pérdida | `crm_tarjetas`, `crm_historial_etapas` | Lead | Conteos por motivo con menos texto libre | Con la tarjeta; se borra al anonimizar |
| Cambios de tablero | `crm_cambios_tablero` | Persona con tarjeta | KPI «pasaron a cliente» | Con la tarjeta; sin datos de la persona |
| Teléfono completo leído de Chatwoot | En memoria del servidor; si se confirma, `clients.phone` | Lead al que se le crea ficha | Precargar la ficha | El de la ficha |
| Eventos de auditoría | `entity_audit_log` | Id de la tarjeta e ids del equipo; **nunca** el de la ficha ni datos de la persona (D-AUD, §2.8) | AUD-01 | El de la bitácora (AUD-02), que sobrevive a la purga de la ficha |
| Aviso de ventana | Push del navegador | Ninguno: sin nombre ni teléfono | Avisar al dueño | El del servicio de push |

| # | Punto | Estado en `main` | Evidencia y lo que exige 6.6 |
|---|---|---|---|
| 1 | Inventario | CORRECTO | El de la 0506 y la 0513 (SDD-0587 §14.3 y §16.8). Lo nuevo de 6.6 está arriba; ninguna columna nueva guarda texto de mensajes, teléfono completo ni correo |
| 2 | Minimización | CORRECTO | Con ficha no se copian nombre ni teléfono (`0506_crm_modelo.sql:339`). 6.6 exige: aviso sin datos de la persona; motivos de lista; KPI y por asesor solo con conteos; el teléfono de Chatwoot se lee solo para precargar y no se guarda en la tarjeta |
| 3 | Consentimiento | NO VERIFICABLE | Igual que la 0587 §14.3: la base de licitud de guardar al lead la decide Sam con su asesor. Crear una ficha sin un acto de la persona ya pasa hoy (`kommo-convert.ts:167`, `clientes/actions.ts:104`) y 6.6 no lo amplía |
| 4 | Derechos | ENCONTRADO | Un lead sin ficha no tiene cómo pedir que se borre su tarjeta antes de los 12 meses: la anonimización solo la corre `service_role` y nada la llama (`0506_crm_modelo.sql:759`; `git grep` sin llamadas). **Arreglo:** «Anonimizar ahora» (§2.7 d) |
| 5 | Borrado | ENCONTRADO | La anonimización por plazo no está agendada y solo mira a quien está en «Perdido» y sin ficha (`0506_crm_modelo.sql:768-774`): el registrado que nunca envió nada conserva para siempre en su tarjeta el contacto del chat, el BSUID, las notas y las tareas. **Arreglo:** cron diario con D-6.6-9 (a), que nace apagado y lo enciende Sam (§2.7 c). Chatwoot conserva contacto y conversación sin plazo (0587 §14.3, punto 8): el diálogo lo dice. La prueba de borrado con un valor rastreable se propone para prueba (§8), no para producción |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Hoy no hay camino que registrar. El diseño deja `crm_tarjeta_anonymized` con quién y el motivo de la lista |
| 7 | Política pública | ENCONTRADO | `/privacidad` promete anonimizar a los 12 meses sin actividad a quien «no llegaste a ser cliente» (`app/privacidad/page.tsx:345-349`) y borrar el BSUID al año (`:352-354`); nada lo hace hoy, y el predicado de la 0506 deja fuera al registrado sin envíos. Solo D-6.6-9 (a), **con el cron encendido**, deja el texto cierto sin cambiarlo (**I**: lo confirma Sam). Con (b) o (c) hay que cambiar el texto (d), con su aprobación |
| 8 | Terceros | NO VERIFICABLE | Studio no escribe en Chatwoot (0587 §5.1) y 6.6 tampoco. El aviso sale por los servicios de push del navegador (`web-push`, `package.json:85`); que el contenido viaje cifrado de punta a punta no se leyó aquí. Por eso el aviso no lleva datos de la persona |
| 9 | Transferencia internacional | NO VERIFICABLE | Todo queda en la base de DTD. El CRM solo lo ven admin y comercial (`rbac.ts:99`); si alguno trabaja desde China aplicaría la PIPL, y eso no se ve en el código |
| 10 | Decisiones automatizadas | CORRECTO | Los movimientos solos cambian la etapa y el aviso es interno: nada niega servicio ni escribe al cliente (D8 de la 0587) |
| 11 | Aceptación electrónica | No aplica | 6.6 no registra aceptaciones |
| 12 | Titulares que no son usuarios | CORRECTO | El lead sin ficha guarda lo mínimo y su plazo (D6). 6.6 le suma un camino para pedir el borrado (punto 4). Si hace falta un aviso al escribir por el canal, lo decide Sam con su asesor |
| — | Logs | — | El diseño exige solo códigos en los logs, sin nombre, teléfono, contacto ni BSUID, con prueba (como `entrada-leads.test.ts` en 6.4) |
| — | Fixtures | — | Nombres de prueba, teléfonos 555 y correos `example.test` |

La skill recomienda una segunda opinión: otro modelo puede auditar este diseño. **Lo que hace
falta de un abogado:** la base de licitud y el pase de la política, que siguen sin hacerse.

## 7. Gobernanza ([AGENT-BRIEF](../../governance/AGENT-BRIEF.md))

| Política | Clasificación propuesta | Por qué |
|---|---|---|
| SGE-00 | cumplimiento (diseño) | El permiso vive en la base: RPC con chequeo de rol y RLS de la 0506 (§4) |
| MP-01 | cumplimiento (diseño) | «Anonimizar ahora» es irreversible y lo dice; la tarjeta queda para los conteos |
| AUD-01 | cumplimiento (diseño), cierra la no conformidad de SDD-0587 §16.6 | Trigger en la misma transacción (§2.7 e), con la regla D-AUD (§2.8) |
| AUD-02 | no aplica | No cambia quién consulta ni cuánto retiene la bitácora |
| BTN-01 | cumplimiento (diseño) | Verbos directos: «Crear ficha», «Ligar a DTD-0123», «Anonimizar ahora» |
| CRT-01 | cumplimiento (diseño) | §2.2: permiso antes, duplicados, datos mínimos, drawer, enlace al formulario completo |
| FRM-01 / ERR-01 | cumplimiento (diseño) | Errores por campo en el drawer; el fallo del ligado se dice y se reintenta |
| LOD-01 | cumplimiento (diseño) | `Suspense` en Resumen y Sin atender, como Embudos |
| TBL-01 | cumplimiento (diseño) | Por asesor y Sin atender con `DataTable`: vacío distinto de «sin coincidencias» |
| DAT-01 | cumplimiento (diseño) | Solo presets reales de período (7, 30, 90 días) |
| A11Y-01 | **no conformidad posible**, NV | Las pestañas actuales (§2.1) |
| VIS-01, CMP-01 | cumplimiento (diseño) | Componentes canónicos y tokens; sin pantalla del Norte (DESIGN-CHECK, §1.4) |

## 8. Pruebas

- **Contrato SQL en PGlite** (aplica la 0503 a la 0506, la 0513 y la nueva): cada fila del mapeo de
  §2.3, con su «solo si»; idempotencia por clave; el manual posterior gana; salir de «Perdido»
  limpia el motivo; estimado web con 0, 1 y 2 coincidencias; cambio de tablero en los dos sentidos
  sin duplicar y sin contar la ubicación inicial; `crm_registrar_mensaje` con `greatest` y con
  contacto desconocido; señales de «sin atender» en los bordes (umbral exacto, 20 h, 24 h, respuesta
  posterior, tarea sin fecha, ticket del portal sin primera respuesta); KPI y por asesor contra un
  juego de datos fijo, y que el de por asesor no devuelva ids de fichas ni de tarjetas; anonimizar
  ahora (admin sí, comercial no, otro tenant no, con ficha no; misma limpieza que por plazo);
  retención con D-6.6-9 (a): lead sin ficha y registrado sin envíos a los 12 meses, el registrado
  queda desligado y puede tener una tarjeta nueva, el cliente no se toca salvo su BSUID al año;
  auditoría según D-AUD (payload sin `client_id` ni datos de la persona; actor `system` para lo
  que dispara el webhook, un cron o `service_role`); grants (nada para `anon`).
- **Control rojo** sin la migración y **mutantes** por rama de cada RPC, como la 0506 y la 0513.
- **Manejador de mensajes:** saliente de agente, eco sin remitente, nota privada, bot y redirección
  de E10, cada uno con su resultado esperado.
- **Cotizador:** el fallo de la tarjeta no rompe la transición (error, promesa rechazada, llamada que
  lanza), y los envíos a Kommo siguen igual en F2 (si D-6.6-3 es (a)).
- **Ficha desde la tarjeta:** candados, duplicados, ficha que ya tiene tarjeta, ligado que falla
  después del alta.
- **Pantallas:** estados de carga, vacío, error y sin migración; pestañas con teclado; `/ui-check`.
- **Cron:** sin `CRON_SECRET` responde 401; **con el interruptor vacío o con cualquier valor que no
  sea `"1"` responde `apagado` y no escribe nada**, probado valor por valor como
  `CRM_ALTA_WEB_SIN_KOMMO` en 6.4; encendido, dos corridas seguidas no duplican nada;
  `build-crontab.test.ts` e `infra-env-example.test.ts` verdes.
- **Logs:** ninguna línea con nombre, teléfono, contacto ni BSUID.
- **Prueba de borrado (revisar-datos-ve, paso 3)** en el entorno de prueba, con un valor rastreable,
  nunca en producción.
- **Cierre:** `pnpm verify` por tramo, con turno del Director General.

## 9. Criterios de aceptación

- [ ] R1: Resumen, Embudos y Sin atender funcionan con datos de tarjetas; las pestañas de Kommo se
  ven igual que hoy; `?tab=` viejo sigue abriendo lo mismo.
- [ ] R2: crear ficha desde una tarjeta sin ficha deja la ficha ligada, sin nombre ni teléfono en la
  tarjeta, en el mismo tablero; con duplicado ofrece ligar o se detiene, según §2.2.
- [ ] R3: enviar, aceptar o rechazar mueven la tarjeta según la tabla de §2.3; repetir no mueve dos
  veces; un fallo no rompe la transición.
- [ ] R4: la tabla por asesor sale de las tarjetas, con la misma definición en el CRM y en Reportes.
- [ ] R5: cada KPI coincide con su fórmula sobre un juego de datos fijo.
- [ ] R6: las tres señales aparecen y desaparecen en sus bordes; nada se envía al cliente; el aviso,
  si se enciende, no lleva datos de la persona y sale una vez por ventana.
- [ ] R7: los crons nacen apagados y no escriben nada así; encendidos en prueba, registran cambios
  de tablero y anonimizan por plazo; «Anonimizar ahora» solo para admin y sin ficha; la auditoría
  registra sus eventos según D-AUD.
- [ ] Las definiciones D-SA y D-AUD (§2.8) son las mismas que cita la SDD-0586 §10.5.
- [ ] Contrato SQL, control rojo y mutantes en verde; `pnpm verify` de cada tramo con su resultado
  por paso.
- [ ] La migración **no** se aplica dentro de este paso: lleva su propio OK nominal de Sam. Encender
  cada cron es otro OK aparte.

## 10. Reestimación y tramos

La base de 6.6 es **2,5 días** (checklist). El diseño pide **4 días**:

| Tramo | Días | Qué |
|---|---|---|
| S1 | 1,5 | Migración, contrato PGlite, control rojo y mutantes |
| S2 | 0,75 | Cotizador y ficha desde la tarjeta |
| S3 | 1 | Vista, KPI, por asesor, sin atender y manejador de salientes |
| S4 | 0,75 | Crons, aviso, anonimizar ahora, motivos y runbook |

**De dónde sale el +1,5:** lo que 6.2 a 6.4 le pasaron a 6.6 después del contrato (cron de
retención, «Anonimizar ahora», AUD-01 y el cambio de tablero, §1.2), cerca de 1 día (**I**), y las
dos fechas de «sin atender», que no se podían sacar de lo que existe (H4), cerca de 0,5 días.

**Decisión del Director General (P-4):** no se recorta nada: la retención (§2.7 b) y «Anonimizar ahora» (§2.7 d) se quedan. La reestimación se
le lleva a Sam junto con la de la 10.5: en total **+2,25 días**, y el programa pasa de **115,5 a
117,75 días**. Cambiar la base pide una línea base nueva con su OK (SDD-0587 §9).

**Orden:** la implementación de la 10.5 primero; después la PR A (S1 + S2) y, ya fusionada, la PR B
(S3 + S4), las dos contra `main` (P-3).

## 11. Pendientes de decisión

### Para Sam (cada una con su recomendación)

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D-6.6-1 | Pestaña que abre el CRM | (a) Resumen ya, con Kommo agrupado hasta el corte · (b) Dirección hasta el corte | **(a)**: Embudos ya recibe leads reales desde el 2026-11-04 |
| D-6.6-2 | Nombre del botón | (a) «Crear ficha» · (b) «Convertir en cliente» | **(a)**: con la regla de 0.8 la ficha no lo vuelve cliente (H5) |
| D-6.6-3 | Kommo en F2 al mover desde el cotizador | (a) Mover la tarjeta y seguir enviando a Kommo hasta 8.7 · (b) Solo la tarjeta | **(a)**: Kommo es maestro de sus leads en F2; con (b) se quedarían quietos |
| D-6.6-4 | Estimado rechazado de un cliente | (a) Sin movimiento · (b) A «Recompra pendiente» | **(a)**: un rechazo de recompra no dice que la relación cambió |
| D-6.6-5 | Umbral de «espera respuesta» | (a) 1 h corrida · (b) 1 h de horario de oficina · (c) otro | **(a)** al empezar: el horario de oficina no está en el código (NV) |
| D-6.6-6 | Aviso de «sin atender» | (a) Solo en pantalla · (b) Pantalla y push al dueño cuando a la ventana le quedan 4 h · (c) Pantalla y resumen diario | **(b)**: es lo que hacía el aviso interno de Kommo, sin costo de Meta y sin datos en el aviso |
| D-6.6-7 | Quién ve el desempeño por asesor | (a) El CRM (admin y comercial) y Reportes › Por agente con agregados (también contabilidad, como hoy) · (b) Solo el CRM | **(a)**: contabilidad no pierde lo que ve hoy y no lee tarjetas (H1) |
| D-6.6-8 | Recuperación | (a) Sigue sobre el espejo hasta el corte; después, solo fichas, y los leads sin ficha se recuperan desde Chatwoot · (b) Guardar el teléfono completo del lead | **(a)**: (b) rompe D6 (H2) |
| D-6.6-9 | Qué se anonimiza por plazo. `/privacidad` dice hoy, palabra por palabra: «Si nos escribiste por WhatsApp o chat y no llegaste a ser cliente, cuando tu consulta queda cerrada sin servicio anonimizamos sus datos de seguimiento (nombre, teléfono, identificadores del chat y notas) a los 12 meses sin actividad» (`app/privacidad/page.tsx:345-349`), y aparte: «El código anónimo de WhatsApp (BSUID) se borra al año sin actividad» (`:352-354`) | (a) La tarjeta de toda persona que no es cliente hoy (lead sin ficha o registrado sin envíos), en cualquier etapa, a los 12 meses sin actividad: si tiene ficha, se desliga y la ficha no se toca; y el BSUID de toda tarjeta, también la de un cliente, al año · (b) Solo las tarjetas sin ficha, en cualquier etapa · (c) Como está: sin ficha y en «Perdido» · (d) Cambiar el texto de `/privacidad` para que diga lo que haga el sistema | **(a)**: es la única que cumple el texto tal como está. (b) deja fuera al registrado que nunca envió nada, que «no llegó a ser cliente»: al ligar, el check `0506_crm_modelo.sql:339` solo quita nombre y teléfono, y en su tarjeta siguen el contacto del chat, el BSUID, las notas y las tareas. (c) además nunca toca a quien se queda en «Nuevo». (d) pide aprobar un texto nuevo. **I:** para el registrado, el nombre y el teléfono viven en la ficha, que sigue el plazo de la cuenta (`:331-333`); si Sam lee que la promesa también los cubre, haría falta (d). En todas, el cron nace apagado y encenderlo es un OK aparte |
| D-6.6-10 | «Anonimizar ahora» | (a) Solo admin, solo tarjetas sin ficha · (b) Admin y comercial | **(a)**: es irreversible |
| D-6.6-11 | Motivos de pérdida | (a) Lista corta más «Otro» · (b) Solo texto, como hoy | **(a)**: da la opción «otro asunto» que Sam pidió y deja menos texto libre con datos de personas |
| D-6.6-12 | Maqueta antes del código | (a) No: componentes del Studio ya aprobados · (b) Sí, en Cloud Design | **(a)**: no hay pantalla del CRM en el Norte y las piezas ya existen |

**No es una pregunta de ahora:** encender cada cron (`CRM_CAMBIOS_TABLERO`, `CRM_RETENCION`,
`CRM_AVISO_VENTANA`) es un OK aparte de Sam, después de publicar y de probar en prueba (§2.7 c).

### Resueltas por el Director General (2026-11-06, sobre `99e7d6300`)

Relayadas por el Subdirector de Chatwoot.

| # | Pregunta | Decisión |
|---|---|---|
| P-1 | ¿Puntero en la SDD-0587 §10? | Sí. Va en esta misma PR |
| P-2 | Cambio de tablero: ¿tabla propia o filas en el historial? | Tabla propia: un movimiento a la misma etapa no deja fila (`0506_crm_modelo.sql:731-733`), y en el historial `de` y `a` son etapas, no tableros (§2.7 a) |
| P-3 | ¿Cuántas PR? | Dos, en serie contra `main` y sin apilar (§5) |
| P-4 | ¿Línea base o recorte? | No se recortan la retención (§2.7 b) ni «Anonimizar ahora» (§2.7 d). Se lleva a Sam junto con la 10.5: +2,25 días, de 115,5 a 117,75 (§10) |
| P-5 | ¿La SDD-0610 usa la clave del motivo? | Sí: usa la clave, y el texto libre solo en «Otro» |
| P-6 | Número de migración | Se asigna al arrancar. Ni 6.6 ni la 10.5 reservan la 0518 (§3) |
| P-7 | Identidad de la redirección de E10 | Respondida con el código: sale con el token del usuario de servicio (`router-api.ts:10`) como `outgoing` no privado (`:123`) y se excluye por el id de ese usuario (§2.4, D-SA) |

Cambios que pidió antes de aceptar, ya aplicados: D-6.6-9 reescrita con el texto literal de
`/privacidad`; en el inventario, las tarjetas de los estimados web (§6); la contradicción de los ids
en Reportes (§2.6 y §3: la RPC no devuelve ids de fichas); los crons nacen apagados (§2.7 c); y la
coordinación con la 10.5 con sus dos definiciones (§2.8).

## 12. Fuera de alcance

- **Retirar Kommo**: pestañas, espejo, sync, webhook y writeback (8.7 a 8.11);
  `registration_channel = 'kommo'` (8.10).
- **Migrar leads de Kommo** (6.5), **Salesbots y «Ping 23 h»** como inventario y costo (6.7; 6.6
  solo construye la alerta interna), el **bot** (E7), el **corte** (E8) y **Meta**.
- **Fusionar dos tarjetas** de la misma persona (SDD-0587 §16.5). Necesita su propia regla para
  historial, tareas y notas. Se propone como paso aparte.
- **Postventa al entregar el último envío** y **Recompra pendiente por cadencia** (SDD-0587 §4.4):
  no salen del cotizador. Se proponen para después.
- **Vencimiento del estimado** como evento (H9).
- **Decidir si una conversación que abre DTD es un lead**: es de Sam (SDD-0587, «Pendiente de E6»).
- **Mensajes al cliente**: nada de 6.6 sale por Meta.
- **Borrar en Chatwoot**: «Anonimizar ahora» no lo hace y lo dice.
- **Medir W5 a W7** de la prueba de WhatsApp (SDD-0587, sección del 2026-11-04).
- **Aplicar la migración** y **encender los crons**: cada uno con su OK aparte.

## 13. Seguimiento

- **2026-11-06:** SDD-0614 reservada (`refs/dtd/reservations/0614`, rama
  `codex/sdd-reserve-0614-crm-reemplazos-kommo`, `c7691a9c3`) y diseño en borrador para revisión
  del Director General. Sin código ni migración.
- **2026-11-06:** el Director General revisó el diseño sobre `99e7d6300` («bien encaminado»,
  cambios menores de texto), resolvió P-1 a P-7 y pidió los cambios de §11, ya aplicados. Las
  decisiones D-6.6-1 a D-6.6-12 se las lleva él a Sam, junto con las de la 10.5 y la línea base.
- **2026-11-06:** el nombre de la pieza única queda alineado con la SDD-0586 en `9acf84b60`:
  `crm_tarjeta_ubicar_o_crear`, antes `crm_tarjeta_de_ficha`. Cubre también el camino por teléfono
  del cotizador, así que §2.3 ya no lo resuelve aparte.
