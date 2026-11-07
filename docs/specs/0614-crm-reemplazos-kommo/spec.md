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
> código. **Sam cerró las 12 decisiones y dos temas extra el 2026-11-06** (§11, con su cita); el
> diseño ya las incorpora. Lo que Sam decide aparte (retirar Kommo en E8, borrar sus tablas,
> aplicar las migraciones, encender crons) está marcado así y no lo autoriza esta SDD. Los textos
> públicos de §14 los aprobó el 2026-11-07; publicarlos lleva su PR y su OK.

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
| R1 | **Vista CRM nueva** | Pestañas Dirección, Tablero, Asesor y Recuperación, que leen el espejo `kommo_*` | Pestañas propias **Resumen** (por defecto), **Embudos** (6.3) y **Sin atender**. **Las de Kommo se ocultan del Studio** desde el primer tramo (D-6.6-1). En Leads, cada tarjeta dice si es «Interesado» o «Interesado con código» | No |
| R2 | **Crear ficha desde la tarjeta** | `convertLead` sobre `kommo_leads` | Crea la ficha del cliente desde la tarjeta, o la liga a una ficha que ya existe | No (usa los grants de la 0506) |
| R3 | **Etapas desde el cotizador** | `patch_price` y `patch_stage` a Kommo | Enviar, aceptar o rechazar un estimado mueve la tarjeta, con reglas de «solo si». **Retira el envío de precio y etapa a Kommo**, que hoy no escribe nada (D-6.6-3, H14) | Sí |
| R4 | **Reporte por asesor** | `commercialByAgent` sobre `kommo_leads.responsible_user_id` | Desempeño por dueño de la tarjeta, en el CRM y en Reportes › Por agente | Sí |
| R5 | **KPI de leads** | Los KPI de Dirección (`kommo-analytics.ts`) | Nuevos, abiertos, estimados, aceptados, pasaron a cliente, perdidos, por fuente | Sí |
| R6 | **Alerta «sin atender»** | `leadsSinAtender` (sin consumidor) y los «Ping 23 h» / «Aviso interno — ventana de 24 h por cerrarse» de Kommo | Lista y conteo de tarjetas con el último mensaje sin respuesta, la ventana de 24 h por cerrar o tareas vencidas. Aviso interno, nunca un mensaje al cliente | Sí |
| R7 | **Mantenimiento** (lo que 6.2 a 6.4 le dejaron a 6.6) | — | Registro del cambio de tablero, cron de la retención D6, «Anonimizar ahora», auditoría AUD-01 de la tarjeta y motivos de pérdida predefinidos | Sí |
| R8 | **Recontacto** (tema extra de Sam) | La etapa «Recontacto» de Kommo y su «volvió» | El lead que escribe tras 30 días callado pasa a «Recontacto», o, si ya va por «Estimado enviado» o más adelante, recibe la marca «Volvió a escribir» y una tarea. La etapa «Registrado / recontacto» pasa a llamarse **«Recontacto»** | Sí (en la de 6.6) |
| R9 | **Teléfono completo y Recuperación** (D-6.6-8) | Recuperación (SDD-0157) sobre el espejo | La tarjeta del lead sin ficha guarda su teléfono completo, y Recuperación pasa a leer las tarjetas y las fichas | Sí, **migración propia** |

Todas cuestan **0 en Meta**: ninguna envía mensajes por WhatsApp, Instagram ni Messenger desde el
sistema. Recuperación abre el WhatsApp del asesor con un enlace, como hoy.

**R8 y R9 son filas nuevas propuestas** para el checklist (§10): se diseñan aquí porque salen de las
respuestas de Sam a esta SDD, pero se estiman aparte de la fila 6.6.

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
| Dirección › Comercial (S0b) | «Pipeline CRM» y «Leads activos» en `direccion/_components/CommercialCard.tsx:65` y `:72`, que enlazan a `/studio/crm`; salen de `listKommoLeads` en `lib/studio/direccion/queries.ts:436` (import en `:46`, cuenta en `:496-501`) | `kommo_leads` |
| KPI «Leads en pipeline» del Dashboard (S0b) | `leadsKpi` en `lib/studio/dashboard/dashboard-kpi-queries.ts:244`, que pide `dashboard/page.tsx:158` si alguna fuente accesible es «leads» (`:130`); entrada `newLeads` en `dashboard-catalog.ts:65`, que viene en `DEFAULT_CONFIG` (`:103`) | `kommo_leads` |

Las dos filas de S0b no estaban en este inventario: las encontró el Director General al revisar la
#415 (PR 0). Las líneas son de `main` `7e75f7708` (2026-11-07).

### 1.4 Hallazgos de esta lectura que cambian el diseño

| # | Hallazgo | Evidencia | Consecuencia |
|---|---|---|---|
| H1 | **Reportes es de contabilidad; las tablas `crm_*` no.** `reports` = `["accounting"]` y admin; la RLS de la 0506 deja leer solo a admin y comercial | `lib/studio/rbac.ts:129`, `app/studio/(app)/reportes/layout.tsx:12`; `crm_puede_usar()` en `0506_crm_modelo.sql:186`. El espejo de Kommo sí lo lee cualquier rol del tenant (`0082_kommo_mirror_schema.sql:145`) | Si Reportes › Por agente lee las tarjetas directo, contabilidad deja de ver lo que ve hoy. Decisión D-6.6-7 |
| H2 | **Recuperación necesita el teléfono completo; la tarjeta sin ficha guarda 10 dígitos** | CSV en `kommo-recovery.ts:239-250`; D6 y el check de `0506_crm_modelo.sql:339` | «La misma salida sobre las tarjetas» (SDD-0587 §6.2) no se puede para los leads sin ficha sin romper D6. Sam eligió romperla (D-6.6-8 = b): R9 (§2.10) |
| H3 | **La auditoría ya no usa un `check`**: desde la 0261 el tipo de entidad es una FK a `audit_entity_types` | `0261_audit_entity_catalog_validate.sql:132`; patrón vigente en `0491_freight_carriers_auditoria.sql:107-122` | Lo que la SDD-0587 §16.6 dice («ampliar `entity_audit_log_entity_type_check`») está vencido: se registra `crm_tarjeta` en el catálogo |
| H4 | **No hay vínculo entre la tarjeta de un lead sin ficha y su conversación.** `chatwoot_conversations` no guarda el contacto; la ficha de 6.3 solo cruza por `client_id` | `0504_chatwoot_eventos.sql:90-104`; `crm/tarjeta-actions.ts:195-221` | «Sin atender» necesita dos fechas en la tarjeta (§3) |
| H5 | **Crear la ficha no vuelve cliente a nadie.** Con la regla de 0.8, cliente = envío vivo o recibo vivo en China | SDD-0587 §1.1 y §4.3, etapa 6 | El botón no puede decir «Convertir en cliente». Decisión D-6.6-2 |
| H6 | **`/privacidad` promete anonimizar a los 12 meses a quien «no llegaste a ser cliente», y nada lo corre.** La función existe sin ruta ni cron, y solo cubre a quien está sin ficha y en «Perdido»: deja fuera al que se queda en otra etapa y al registrado que nunca envió nada | `app/privacidad/page.tsx:345-349`; `git grep crm_anonimizar_leads_perdidos` en `app/`, `lib/`, `scripts/`, `infra/` y `vercel.json`: 0 resultados; predicado en `0506_crm_modelo.sql:768-774`; al ligar una ficha, el check `:339` solo quita nombre y teléfono | Hoy no se incumple todavía (la primera tarjeta es del 2026-11-04, **I**), pero el cron tiene que existir y estar encendido antes. Decisión D-6.6-9 |
| H7 | `crm_mover_etapa_auto` no deja historial si la tarjeta ya está en la etapa | `0506_crm_modelo.sql:731-733` | Entrar a Clientes en «Activo» (su valor por defecto) no deja rastro: el cambio de tablero necesita su propio registro (§2.7) |
| H8 | `crm_mover_etapa_auto` no limpia el motivo al salir de «Perdido»; la 0513 lo hace aparte | `0506_crm_modelo.sql:735-745`; `0513_crm_entrada_leads.sql:159` | Los movimientos del cotizador tienen que limpiarlo igual |
| H9 | «Vencido» no es una transición del estimado: se deriva al pintar | `cotizador/[code]/page.tsx:45` (`isExpired`) | La salida «o vence el SLA» de «Estimado enviado» (SDD-0587 §4.3) no tiene evento. Queda fuera (§12) |
| H10 | Otra sesión diseña un resumen semanal agregado del CRM para marketing (SDD-0610, rama `claude/practical-swartz-5b50ae`) que clasifica `motivo_perdida` como texto libre | Su spec, §1, fila «Motivo de pérdida» | Resuelto por el Director General (P-5): la 0610 usa la clave del motivo de R7, y el texto libre solo en «Otro» |
| H11 | **El nombre de una etapa vive en la base, no en el código.** `crm_etapas.nombre` lo siembra `crm_sembrar_etapas` por tenant (`0506_crm_modelo.sql:224-244`, «Registrado / recontacto» en `:234`) y la 0506 lo corrió en cada tenant existente (`:253`). La app lo lee de la tabla (`lib/studio/crm-tablero-queries.ts:115`) y lo pinta con `nombreEtapa` (`lib/studio/crm-tablero.ts:250-255`). Ninguna pantalla edita etapas: es la única lectura de `crm_etapas` en `app/` y `lib/` | `git grep crm_etapas -- app lib` | Cambiar la etiqueta **pide migración**: un `update` de las filas sembradas y la siembra nueva para los tenants que vengan (§2.9) |
| H12 | **El recontacto de hoy solo sale de «Perdido».** `crm_entrada_chatwoot` llama a `crm_volver_a_recontacto` solo si la etapa es `perdido` (`0513_crm_entrada_leads.sql:271-275`), y antes ya subió `ultima_actividad_at` (`:268`) | 0513 | La regla de 30 días tiene que leer las fechas **antes** de ese `update` (§2.9) |
| H13 | **Ocultar las pestañas de Kommo oculta también Recuperación** (`kommo-tabs.shared.ts:30`), que hoy es la única lista de recuperación del Studio, y el cruce del estimado con contactos de Kommo, que muestra sus nombres (`cotizador/_components/QuoteDetailClient.tsx:134-157`) | `kommo-tabs.shared.ts:26-32` | Hasta que exista R9, el Studio no tiene lista de recuperación |
| H14 | **Hoy el ERP no le escribe nada a Kommo.** Los envíos del cotizador (`patch_price`, `patch_stage`) y del alta de `/registro` solo escriben si el secreto `KOMMO_PUSH_DRY_RUN` vale exactamente `"false"` (`supabase/functions/_shared/kommo-outbound.ts:241`, `kommo-push-client/index.ts:109-110`), y en producción está vacío: lo midió el Director General en `dtd-cargo-functions-1` el 2026-11-06 (**T**, relayado por el Subdirector). Lo único vivo hacia Kommo es la lectura diaria del espejo | `cotizador/actions.ts:334`, `:345` («dry-run por default») | Quitar los envíos del cotizador (D-6.6-3) **no apaga nada en producción**: retira código sin efecto, en la PR A. La lectura diaria se retira en E8, fuera de esta SDD |

**DESIGN-CHECK.** El Norte vigente (`docs/design/studio/_norte/`) no trae una pantalla del CRM.
R1 reusa lo que ya está aprobado en el Studio: `KpiCard`, la tarjeta de sección y las barras de
`DireccionTab.tsx`, `DataTable` (TBL-01), `SegmentedControl`, `DrawerShell`, `ConfirmDialog` y el
tablero de 6.3. **Sam pidió ver una maqueta antes de programar** (D-6.6-12 = b): Resumen, Sin
atender y la ficha de la tarjeta pasan por el paso M (§5) antes de S3.

## 2. Diseño por pieza

### 2.1 R1 — Vista CRM nueva

**La dirección de Sam (2026-11-06, D-6.6-1):** el Studio trabaja con Chatwoot integrado lo mejor
posible, sin que el equipo salga del ERP, y Kommo queda **fuera del ERP** hasta la migración
completa. Por eso las pestañas de Kommo no se agrupan: **se ocultan**.

**Pestañas** (`kommo-tabs.shared.ts`):

| Pestaña | Qué muestra | Fuente |
|---|---|---|
| **Resumen** (nueva, por defecto) | KPI de R5 y tabla por asesor de R4, con selector de período | Tarjetas |
| **Embudos** | El tablero de 6.3, con el enlace directo a una tarjeta, el tipo de lead y la marca de R8 | Tarjetas |
| **Sin atender** (nueva) | La lista de R6, con su conteo en la pestaña | Tarjetas |
| **Recuperación** (nueva, con R9) | La lista de R9, sobre tarjetas y fichas | Tarjetas y fichas |
| ~~Dirección, Tablero, Asesor, Recuperación de Kommo~~ | **Ocultas desde S0** | Espejo `kommo_*` |

**S0 · Ocultar Kommo, antes que lo demás.** No depende de la 10.5 ni de ninguna migración, así que va
primero, en una PR chica contra `main` (P-8):

- La barra del CRM deja de mostrar Dirección, Tablero, Asesor y Recuperación de Kommo, con su
  configuración (campo del Shipping Mark y mapa de etapas, que viven en esas pestañas).
- **`?tab=direccion`, `tablero`, `asesor` y `recuperacion`** abren la pestaña por defecto. Mientras
  Resumen no exista (llega en S3), la pestaña por defecto es **Embudos**.
- **Reportes › Por agente** deja de mostrar la tabla del espejo (`ReportesClient.tsx:1030`) y su
  CSV (`lib/studio/reports/export-csv.ts`). En su lugar, un aviso corto e interno (P-9, texto
  aprobado tal cual por el Subdirector el 2026-11-06): «El desempeño por asesor se está pasando al CRM del Studio.
  Vuelve a aparecer aquí cuando esté listo.» Entre S0 y S3, contabilidad no ve ese reporte.
- **El detalle del estimado** deja de cruzar el teléfono con contactos de Kommo
  (`cotizador/[code]/page.tsx:52`) y de mostrar sus nombres (H13).
- **Ocultar no es apagar ni borrar.** El código y el espejo de Kommo siguen como están. Lo único vivo
  hacia Kommo es la lectura diaria del espejo (H14), que se retira en E8, fuera de esta SDD. Los
  envíos del alta de `/registro` y del cotizador hoy no escriben nada (H14). `convertLead`
  (`crm/actions.ts:62`) y su envío del Shipping Mark quedan sin botón que los llame. Borrar
  cualquiera de esas piezas va con su OK aparte (§12).
- **La guía «Antes en Kommo → Ahora aquí» se queda y S0 no la toca** (SDD-0589; P-10, cerrada por
  Sam el 2026-11-07: «Sí, se queda»). Sigue montada como `<GuiaStudio>` en
  `app/studio/(app)/layout.tsx:237-239` (medido en `main` `f28c5dcc1`) hasta que Sam decida
  apagarla. Enseña a dejar Kommo y no conecta con Kommo. No es consejo, es invariante de S0, y se
  comprueba así (§5, §8, §9):
  - ningún archivo de la guía entra en el diff de S0: `app/studio/_components/guia/`,
    `lib/studio/guia/`, `app/studio/(app)/_actions/guia-actions.ts`, `lib/i18n/*/guide.ts` ni
    `app/studio/(app)/layout.tsx`;
  - una prueba nueva de S0 lee el layout y exige que siga importando y montando `GuiaStudio`, con un
    mutante: quitar el montaje la pone roja;
  - la misma prueba exige que `/studio/crm` sin `?tab=` abra **Embudos**, la pestaña donde están las
    anclas `embudo.*` del recorrido Embudo de la guía (`CrmTableroKanban.tsx`). Hoy la pestaña por
    defecto es Dirección y esas anclas no están al entrar; S0 lo arregla de paso.
- **Con Resumen por defecto (S3), el recorrido Embudo no abre** al entrar a `/studio/crm` sin
  `?tab=`: la guía salta cada paso cuya ancla no está y, si no queda ninguno, el recorrido no abre
  (`lib/studio/guia/motor.ts`), y su ruta solo mira el camino, no la pestaña (`rutaCoincide`,
  `recorridos.ts`). Inferido (**I**) del código de la #408 (`836edcd18`, sin fusionar). 6.6 no toca
  la guía ni lo aprobado de E9. **P-13, decidida por el Director General el 2026-11-07:** lo
  resuelve la SDD-0589 en un paso aparte, con PR propia y después de la #408, y **S3 no se fusiona
  antes de ese paso** (condición de la PR B en §5 y §9). Ese paso está pendiente: E9 todavía no lo
  abre.

**S0b · Kommo fuera de las tres zonas de S0 (enmienda del 2026-11-07).** Después de S0, el Studio
todavía mostraba cifras de Kommo en dos lugares que §1.3 no inventariaba, y un texto que S0 dejó
falso. Lo cubre la misma D-6.6-1 («no lo quiero ver») y va en su propia PR, después de la PR 0:

- **Dirección › Comercial:** «Pipeline CRM» y «Leads activos» salían de `kommo_leads` y
  enlazaban a `/studio/crm`, donde desde S0 se ve otra cosa. `getDireccionData` deja de leer el
  espejo y devuelve el resumen `oculto`; la tarjeta no se pinta. La cuenta de antes se conserva
  como `resumenComercialKommo`, sin consumidor.
- **KPI «Leads en pipeline» del Dashboard** (`newLeads`, con `leadsKpi` sobre `kommo_leads`): la
  entrada sigue en el catálogo con `oculto: true`. `validateDashboardConfigInput` y
  `accessibleCatalog` la descartan, así que no se ofrece en el editor, una config guardada no la
  pinta y el default no la trae. Como la página pide solo las fuentes de los KPI accesibles,
  `leadsKpi` deja de llamarse sin tocar `dashboard/page.tsx`. `DEFAULT_CONFIG` no cambia: el
  Dashboard por defecto pasa de seis KPI a cinco.
- **Embudos sin la 0506** (`CrmEmbudosSlot.tsx:47`): decía «Mientras tanto, los leads siguen en
  las otras pestañas del CRM», que desde S0 no es cierto. Queda «Falta aplicar la migración 0506
  en esta base.», sin prometer nada que todavía no existe.
- **Ocultar no es borrar**, igual que S0: `listKommoLeads`, `leadsKpi`, la entrada del catálogo y la
  tarjeta se conservan hasta 8.7, con su OK aparte. Sin migración, sin tocar la guía de la
  SDD-0589 ni `layout.tsx`.
- Sin estimación propia en §10: la anota el Subdirector de Chatwoot.

**El resto de R1:**

- **Enlace directo** `?tab=embudos&tarjeta=<uuid>`: abre la ficha de la tarjeta en su tablero. Lo
  usan el detalle del estimado (R3) y Sin atender (R6).
- **Encabezado** (`KommoClient.tsx:254-271`): sin mención de Kommo. Propuesta: «Resumen, Embudos y
  Sin atender son de Studio: lo que mueves o guardas queda aquí.» La prueba
  `crm/__tests__/stage-control.test.ts:59` sigue exigiendo que no diga «solo lectura».
- **Tipo de lead en la tarjeta** (Sam, respuesta 3): en el tablero Leads, cada tarjeta lleva una
  etiqueta corta, **«Interesado»** (segmento lead nuevo: sin ficha) o **«Interesado con código»**
  (lead registrado: tiene ficha y, con ella, Shipping Mark, que el alta asigna con
  `next_markbox`). **No es una etapa** ni se guarda: sale del segmento en el momento, como el
  tablero (regla de 0.8). Se ve también en la ficha de la tarjeta y en Sin atender. En Clientes no
  se muestra. Sigue siendo lead hasta su primera carga recibida en China; «Aceptado, esperando
  carga» también es lead.
- **Accesibilidad (A11Y-01):** las pestañas usan hoy botones con `role="tab"`
  (`KommoClient.tsx:307-330`). Si el patrón no maneja flechas e Inicio/Fin, se corrige con el
  componente de pestañas del sistema (NV: no se probó con teclado en esta tarea).
- **Estados obligatorios** (BRAND §Estados): cargando con `Suspense` (como Embudos), vacío
  distinto de «sin resultados», error con «Reintentar», sin migración («Falta aplicar la
  migración NNNN», como 6.3) y rol sin CRM («Tu rol no usa el CRM propio»).
- **El código de las pestañas de Kommo** se retira en 8.7, con su OK aparte (§12). S0 solo lo oculta.

### 2.2 R2 — Crear ficha desde la tarjeta

**Dónde:** en la ficha de la tarjeta (`TarjetaFichaDrawer.tsx`), cuando la tarjeta **no tiene
ficha** y no está anonimizada. Botón **«Crear ficha»** (D-6.6-2, cerrada).

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
4. **Teléfono precargado.** Si la tarjeta ya tiene el teléfono completo (R9), sale de ahí. Si no,
   y la tarjeta tiene contacto, se lee de Chatwoot en el momento, del lado del servidor, con el
   token de E10 (`lib/studio/chatwoot/router-api.ts`, hoy sin una lectura de contacto por id: se
   agrega). Lo leído de Chatwoot **no se guarda** en ningún lado salvo en la ficha, y solo si la
   persona confirma. Sin token o sin respuesta, el campo queda vacío y se escribe a mano.
5. **Guardar** = el alta de cliente de siempre (misma validación, `next_markbox`,
   `registration_channel = 'admin'`, dueño de la ficha = dueño de la tarjeta si lo tiene) y
   después ligar: `update crm_tarjetas set client_id = …, nombre_visible = null, phone_last10 =
   null`. Ese `update` ya lo permiten los grants de la 0506 (`0506_crm_modelo.sql:418`) y el
   check (`:339`) obliga a quitar nombre y teléfono al ligar. Con R9, el teléfono completo se va de
   la tarjeta solo, por el trigger de §2.10: a partir de ahí vive en la ficha.
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
estimado, **en el lugar de los envíos a Kommo de hoy, que se quitan** (D-6.6-3), con el cliente de
servicio que ya se usa ahí.
**Nunca rompe ni demora la transición**: una función que no lanza (mismo criterio que la tarjeta
web de 6.4 en `/registro`).

**Cómo encuentra la tarjeta** (en SQL, una RPC de `service_role`). **No repite la regla de
ubicar o crear:** llama a la pieza única de la 10.5, `crm_tarjeta_ubicar_o_crear` (SDD-0586
§10.5.6, pieza 1, decisión E10-D30), que también usan el alta web de la 0513 y la entrada del
portal de la 10.5 (§2.8). La pieza cubre los dos caminos, por ficha y por teléfono; 6.6 solo le pasa los datos
y aplica el mapeo de abajo. Si a 6.6 le faltara un parámetro, se agrega redefiniendo la pieza desde
su última definición, no con otra pieza.

1. Estimado con Shipping Mark → ficha viva de ese tenant → la pieza con esa ficha y `fuente =
   'cotizador'` (ya admitida en `0506_crm_modelo.sql:318-320`). Devuelve la tarjeta de la ficha,
   liga la del lead sin ficha que cruza por teléfono o crea una.
2. Estimado web sin Shipping Mark → la pieza con los últimos 10 de `prospect_whatsapp`, el nombre
   visible (`quotes.client_name`) y `fuente = 'cotizador'`. Con R9, si la tarjeta que devuelve no
   tiene ficha ni teléfono completo, se le pone el de `prospect_whatsapp` (§2.10). La pieza
   compartida no cambia por eso.
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
| `sent` | → **Estimado enviado**, solo si está en Nuevo, Contactado, Recontacto, Negociación o Perdido | → **Recompra en curso**, solo si está en Activo, Postventa o Recompra pendiente |
| `accepted` | → **Aceptado, esperando carga**, desde cualquier etapa abierta o desde Perdido | → **Activo**, solo si está en Recompra en curso |
| `rejected` | → **Perdido** con motivo «Estimado rechazado», solo si está en Estimado enviado o Negociación | → **Recompra pendiente**, solo si está en Recompra en curso (D-6.6-4 = b) |
| Vencido (derivado, H9) | Sin movimiento | Sin movimiento |
| Convertir a embarque | Sin movimiento: un envío en borrador no cuenta (SDD-0587 §4.3). El tablero cambia cuando el envío vive (R7) | Igual |

- **«Solo si» evita retroceder**: un estimado nuevo no saca de «Aceptado, esperando carga» a quien
  ya aceptó otro.
- **Al salir de «Perdido» se borra el motivo** (H8), igual que `crm_volver_a_recontacto`.
- **El rechazo de un cliente** (D-6.6-4 = b) deshace lo que hizo su `sent`: vuelve de «Recompra en
  curso» a «Recompra pendiente». Sam dijo «postventa (es decir, a recompra pendiente)»; en el
  tablero son dos etapas distintas y la opción elegida es «Recompra pendiente». Desde otra etapa
  no se mueve: un movimiento a mano posterior gana.
- **Cliente desde la primera carga recibida en China** (regla de 0.8, que Sam repitió el
  2026-11-06): enviar, aceptar o convertir un estimado no vuelve cliente a nadie. «Aceptado,
  esperando carga» sigue en Leads.
- **El cotizador ya no le manda nada a Kommo (D-6.6-3 = b).** `transitionStatus` deja de encolar
  `patch_price` (`cotizador/actions.ts:339`) y `patch_stage` (`:349`): la tarjeta es lo único que se
  mueve. Es lo que decía el contrato («en vez de», SDD-0587 §5.1). **No es un apagado en
  producción:** hoy esos envíos no escriben nada, porque `KOMMO_PUSH_DRY_RUN` está vacío (H14). Es
  retirar de `transitionStatus` un camino sin efecto, dentro de la PR A. Las funciones de envío y su
  edge function quedan sin esa llamada y se retiran con Kommo en E8 (8.7).

**Detalle del estimado** (`cotizador/[code]/page.tsx`): si hay tarjeta, una línea «En el CRM:
Leads · Estimado enviado» con enlace a la ficha (R1). El cruce con Kommo (`:52`) ya no está: lo
quita S0.

### 2.4 R6 — Alerta «sin atender»

**La definición es una sola y está en §2.8 (D-SA).** Aquí, de dónde salen los datos y dónde se ve.

| Señal de D-SA | Reemplaza |
|---|---|
| **Espera respuesta** (Chatwoot o conversación del portal) | La tarea vencida «Responder al cliente» de los agentes de Kommo (`kommo-atencion.ts:1-15`) |
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
| Cualquier mensaje de la bandeja «Conversaciones del portal» | **No mueve las fechas de la tarjeta.** Se reconoce por `CHATWOOT_INBOX_PORTAL_ID` (SDD-0586 §10.5.8); la espera del portal la mide `crm_portal_espera` (señal 2) |

La dirección y el remitente salen del payload de `message_created` (`message_type`, `private`,
`sender`), que `interpretarEvento` ya lee en parte (`webhook-events.ts:129`). Que 4.19.1 mande el
tipo y el id del remitente en el webhook es **NV**: se confirma en su fuente, como hizo 6.4
(SDD-0587 §16.2).

En el portal, la respuesta es un mensaje del equipo en el hilo y la mide `crm_portal_espera` de la
10.5 (§2.8). 6.6 no la vuelve a calcular.

**Límite (I):** una conversación que E10 redirige al otro número queda como «espera respuesta»
hasta que alguien del equipo conteste. Es lo que pide excluir la redirección; si molesta, se decide
después con datos.

**Dónde se ve:**
- Pestaña **Sin atender** con su número. Ordenada por la espera más larga. Filtro «Mías / Todas».
  Cada fila: nombre o Shipping Mark, tipo de lead («Interesado» o «Interesado con código»), tablero
  y etapa, la señal en palabras («Espera respuesta hace 3 h · la ventana se cierra en 1 h»), dueño,
  y «Abrir ficha». Sin texto de mensajes ni teléfono. El umbral es **1 hora a reloj corrido**
  (D-6.6-5 = a).
- **Aviso al dueño** cuando la ventana entra en sus últimas 4 h (D-6.6-6 = b, cerrada; **nace
  apagado** con `CRM_AVISO_VENTANA` y encenderlo es un OK aparte de Sam): push
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
la ficha de la tarjeta. Quién lo ve quedó como estaba recomendado (D-6.6-7 = a): el CRM para admin y
comercial, y Reportes › Por agente con solo totales, también para contabilidad. **La tabla de Kommo
que hoy muestra Reportes se oculta en S0** (D-6.6-1), así que entre S0 y S3 Reportes › Por agente
no muestra desempeño por asesor y lo dice (§2.1, P-9).

### 2.7 R7 — Mantenimiento

**a) Cambio de tablero.** Una tabla de historia, `crm_cambios_tablero` (§3), y un cron cada hora:

1. Para cada tarjeta viva calcula el tablero de hoy (segmento en el momento, como el tablero de
   6.3) y lo compara con el último registrado.
2. Sin registro previo → guarda la ubicación inicial (`inicial = true`), que **no cuenta** como
   conversión.
3. Distinto del último → guarda el cambio con clave `<tarjeta>:<id del registro anterior>`: dos
   corridas a la vez no lo duplican.
4. Clientes → Leads → además, `crm_mover_etapa_auto` a «Recontacto» (clave
   `registrado_recontacto`) con esa clave de evento (SDD-0587 §4.5); un movimiento manual posterior
   gana. Esto cierra el «Límite conocido» de 6.3.
5. Leads → Clientes → `crm_mover_etapa_auto` a «Activo». Si ya estaba en «Activo» no hay fila en
   el historial (H7), pero sí en `crm_cambios_tablero`.

**No contradice la regla de 0.8** (I): el tablero que se pinta se sigue calculando en el momento;
la tabla es historia para los KPI, nunca la fuente del segmento. El Director General eligió la tabla
propia (P-2): un movimiento a la misma etapa no deja fila (`0506_crm_modelo.sql:731-733`), y en el
historial `de` y `a` son etapas, no tableros.

**b) Retención D6.** Cron diario a las 04:45 de Venezuela que corre la anonimización en cada tenant
con CRM, con el predicado que Sam eligió (D-6.6-9 = a, cerrada):

- **Toda tarjeta cuya persona no es cliente hoy** (segmento lead nuevo o lead registrado), en
  cualquier etapa, con 12 meses sin actividad: se borran nombre visible, los últimos 10, **el
  teléfono completo de R9**, contacto, BSUID, motivos, notas, tareas, mapeos, las dos fechas de §3 y
  la marca de R8. **Si tiene ficha, además se desliga**
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
tiene ficha** (D-6.6-10 = a, cerrada):

- Confirmación con `ConfirmDialog` (MP-01: es irreversible) y un motivo de una lista corta, sin
  texto libre: «Lo pidió la persona», «Se cargó por error».
- Hace la misma limpieza que la anonimización por plazo (nombre, últimos 10, **teléfono
  completo**, contacto, BSUID, motivos, notas, tareas, mapeos, las dos fechas de §3 y la marca de
  R8). La tarjeta queda para los conteos.
- Es el camino para quien pide que **borren** sus datos (texto T3 de §14). Para quien solo pide que
  no le escriban está «No volver a escribir» (§2.10), que no borra nada.
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
| `crm_tarjeta_no_contactar` | Se pone o se quita «No volver a escribir» (R9, migración B) | Solo sí o no |

Los cambios de etapa no se duplican aquí: ya están en `crm_historial_etapas`, con su propio
contrato (SDD-0587 §16.6).

**f) Motivos de pérdida predefinidos** (D-6.6-11 = a, cerrada, sin cambios en la lista). El diálogo
de «Perdido» de 6.3 ofrece una lista:
«No es lead / otro asunto», «Precio», «No respondió», «Compró con otro», «Fuera de lo que hacemos»,
«Estimado rechazado» (lo pone R3) y «Otro» con texto (hasta 200 caracteres, como hoy). Se guarda la
clave junto al texto actual. Esto le da a Sam la opción «otro asunto» que pidió el 2026-11-05.
**No decide** si una conversación que abre DTD crea una tarjeta: eso sigue pendiente con él
(SDD-0587, «Pendiente de E6»).

### 2.8 Coordinación con la 10.5 y las dos definiciones únicas

**Con la PR #400** (paso 10.5, conversaciones del portal en Chatwoot, SDD-0586 §10.5), que va
**primero y en serie**:

- **Comparten archivos:** `TarjetaFichaDrawer.tsx`, `CrmTableroKanban.tsx`, `tarjeta-actions.ts`,
  `crm-ficha.ts` y `supabase/pending-migration-symbol-declarations.json`. La implementación de 6.6
  arranca sobre `main` con la 10.5 ya fusionada y no edita esos archivos mientras la 10.5 los tenga
  abiertos.
- **Una sola pieza para ubicar o crear la tarjeta:** `crm_tarjeta_ubicar_o_crear` de la 10.5
  (E10-D30), por ficha y por teléfono, sirve al alta web de la 0513, a la entrada del portal de la
  10.5 y al cotizador de 6.6 (§2.3). 6.6 no la copia.
- **Migración:** la de 6.6 va después de la de la 10.5 y su preflight la exige. Ninguna de las dos
  reserva número ahora: lo reserva el Director General al arrancar cada una (P-6).
- **Las dos definiciones de abajo las fija esta SDD, una sola vez.** La 10.5 las cita igual; si
  alguna cambia, cambia aquí.
- **La 10.5 rediseñada** (#400, `12a5f7c52`, §10.5.19) cierra P-12 el 2026-11-06. El chat del
  portal se contesta desde Chatwoot, en la bandeja propia «Conversaciones del portal» (E10-D33), y
  entra a la tarjeta por su propio manejador, `entrarPortal` con `crm_entrada_portal` (E10-D36 y
  E10-D22), no por `crm_entrada_chatwoot`. No hay tabla de tickets. Por eso, desde esa fecha:
  - la señal 2 de D-SA se calcula con `crm_portal_espera` (SDD-0586 §10.5.6, objeto 9);
  - la bandeja del portal queda fuera de las señales 1 y 3 (E10-D46): no se cuenta dos veces y en el
    portal no hay ventana;
  - el tipo de auditoría `crm_ticket` queda sin objeto (E10-D45);
  - la pieza única sigue siendo `crm_tarjeta_ubicar_o_crear`.

**D-SA · Definición de «sin atender»** (única para la alerta, los reportes, el conteo y el aviso)

Una tarjeta está *sin atender* si está viva (no anonimizada, ficha no borrada, etapa no terminal en
su tablero del momento) y cumple al menos una de estas señales:

1. **Espera respuesta en Chatwoot:** `ultimo_entrante_at` no es nulo, `ultima_respuesta_at` es nulo
   o anterior a él, y pasó el umbral desde `ultimo_entrante_at`. El umbral es **1 hora a reloj
   corrido** (D-6.6-5 = a, cerrada). **La bandeja del portal no cuenta aquí:** sus mensajes no
   mueven `ultimo_entrante_at` ni `ultima_respuesta_at`.
2. **Espera respuesta en el portal:** la conversación del portal de la ficha tiene mensajes del
   cliente sin respuesta del equipo (`crm_portal_espera`, SDD-0586 §10.5), y pasó el umbral desde el
   primero de ellos.
3. **Ventana por cerrar o cerrada**, solo si el último entrante llegó por una bandeja **con ventana
   de Meta**: la señal 1 y pasaron 20 h desde `ultimo_entrante_at` (por cerrar) o 24 h (cerrada:
   hace falta plantilla). WhatsApp la tiene; Instagram y Messenger también, según Meta (NV en esta
   tarea). La bandeja del portal no cuenta (en el portal no hay ventana), y una bandeja sin ventana,
   como el correo, tampoco: por eso la tarjeta guarda si su último entrante tiene ventana
   (`ultimo_entrante_con_ventana`, §3).
4. **Tarea vencida:** una tarea abierta de la tarjeta con `vence_at` anterior a ahora. Sin fecha
   no vence.

**Respuesta humana**, en Chatwoot: un mensaje saliente no privado de un agente que no es el usuario
de servicio (`chatwootServicioUserId()`, `lib/studio/chatwoot/config.ts:67`), o un eco sin
remitente. No lo son una nota privada, un mensaje de actividad, un bot ni la redirección de E10.
Sin el id del usuario de servicio configurado, ningún saliente de agente cuenta. **En el portal,**
un mensaje del equipo en el hilo (`conversation_messages` con `direction = 'out'`), que con el flag
de la 10.5 encendido llega desde Chatwoot; lo mide `crm_portal_espera`, no esta SDD. La calcula
**una sola función SQL**, `crm_sin_atender` (§3). El plazo del portal (E10-D23: la conversación
vence al terminar el día que cuenta, o el lunes; SDD-0586 §10.5.11) es otra cosa: es la promesa del
portal y sigue siendo de la 10.5.

**D-AUD · Qué lleva la auditoría del CRM** (única para los tipos `crm_*`; hoy, `crm_tarjeta` de
esta SDD. El `crm_ticket` de la 10.5 quedó sin objeto, E10-D45)

- **Entidad:** `entity_id` es el id de la fila del CRM (la tarjeta).
- **Puede llevar:** ids de filas propias del CRM (la tarjeta), ids de usuarios del equipo (el dueño),
  claves de etapa, fuente, motivo de lista, estado, número del episodio y banderas sí o no.
- **Nunca lleva:** `client_id`, Shipping Mark, nombre, teléfono, correo, contacto de Chatwoot,
  BSUID, texto libre (notas, tareas, motivo «Otro», mensajes) ni montos. `entity_audit_log` es de
  solo agregar y sobrevive a la purga de la ficha: nada de lo que guarda puede identificar a la
  persona después.
- **Actor:** `user` con `auth.uid()` **solo si ese usuario es miembro activo del tenant de la
  fila** (`user_tenants`, sin `disabled_at`). Lo que dispara un cliente del portal, el webhook de
  Chatwoot, un cron o `service_role` lleva `system`, con `actor_id` nulo, nunca el `auth.uid()` del
  cliente. El origen va en `source`, con los valores que admite la 0267
  (`0267_audit_contract_append_only.sql:324-336`): `studio` (el equipo en Studio, incluido el
  cotizador), `webhook` (Chatwoot, también la bandeja del portal), `job` (crons) y `rpc` (portal y
  alta web de `/registro`).
- **Misma transacción que el cambio** (AUD-01). Lo que la 10.5 cambia en la tarjeta lo audita el
  mismo trigger de `crm_tarjetas` (§2.7 e), y la tarjeta del portal corre fuera de la transacción
  del mensaje del cliente, que nunca falla por el CRM (E10-D24).

### 2.9 R8 — Recontacto (tema extra de Sam, opción A)

**Decisión de Sam (2026-11-06).** A cómo se trata a quien «preguntó hace tres meses, quedó en leads
y ahora volvió a escribir», eligió la opción A, la recomendada: «Ok, la opción A a la pregunta que te
hice anteriormente está bien» (19:50Z). A «¿La etapa pasa a llamarse solo «Recontacto»?», el botón
«Sí, Recontacto» (21:09Z).

**La regla.** Un lead (segmento lead nuevo o lead registrado) que escribe por Chatwoot después de
**30 días callado** recibe la tarea «Volvió a escribir: recontactar» y la marca **«Volvió a
escribir»**, y pasa a «Recontacto» si eso no lo hace retroceder:

| Etapa en Leads cuando escribe | Qué pasa |
|---|---|
| Nuevo, Contactado y cualquier etapa propia del admin que vaya antes de «Estimado enviado» en el orden del tablero | Pasa a **Recontacto**, con tarea y marca |
| Recontacto | Se queda; tarea y marca del episodio nuevo |
| Estimado enviado, Negociación, Aceptado esperando carga y las propias desde «Estimado enviado» en adelante | **No retrocede:** solo tarea y marca |
| Perdido | Como hoy (0513): vuelve a «Recontacto» con cualquier mensaje entrante, sin esperar los 30 días y sin el motivo; además, la marca |

- **Callado** = 30 días sin mensajes entrantes de la persona. Se mide con `ultimo_entrante_at` (§3)
  **antes** de este mensaje; si es nulo (tarjeta anterior a la migración, o que nació en la web o
  en el cotizador), con `ultima_actividad_at` antes de este evento. Un saliente del equipo no rompe
  el silencio: cuenta que la persona no escribía.
- **Las dos fechas se leen antes del `update`**, porque hoy `crm_entrada_chatwoot` sube
  `ultima_actividad_at` antes de mirar la etapa (H12). Por eso el entrante lo registra esa misma
  función, en la misma transacción: `crm_entrada_chatwoot` pone `ultimo_entrante_at` (con
  `greatest`) y `crm_registrar_mensaje` queda solo para los salientes (§3).
- **Un evento viejo que llega tarde** (reintento del webhook) no dispara nada: si su hora no es
  posterior al `ultimo_entrante_at` guardado, no cuenta.
- **Idempotente** con la clave de hoy, `chatwoot_volvio:<clave del mensaje>`, para el movimiento y
  la tarea (`on conflict do nothing`). Un movimiento manual posterior gana (`crm_mover_etapa_auto`).
- **Solo Leads.** Al cliente no le aplica: su tarjeta está en Clientes, y el cliente que vuelve a
  lead ya tiene su camino (§2.7 a).
- **La bandeja del portal no dispara R8:** sus mensajes entran por `crm_entrada_portal` de la 10.5
  (E10-D22), no por `crm_entrada_chatwoot`, y su espera la mide la señal 2. Si Sam quiere que
  escribir por el portal tras 30 días también cuente como recontacto, se suma a esa función, en la
  10.5 o después (**I**: no se le preguntó).
- **Registrarse o pedir un estimado no es «escribir».** El alta web sigue como hoy: quien estaba en
  «Perdido» vuelve a Recontacto (`0513_crm_entrada_leads.sql:381-383`), y nada más.

**La marca «Volvió a escribir».** Columna nueva `crm_tarjetas.volvio_tarea_id`, que apunta a la
tarea del episodio (`on delete set null`; la escribe solo `service_role`). La tarjeta y su ficha
muestran «Volvió a escribir · 5 nov» (la fecha de esa tarea) **mientras la tarea siga abierta**; al
cerrarla, la marca deja de verse. La anonimización borra las tareas y, con ellas, la marca. Sin texto
del mensaje.

**El nombre «Recontacto».** La clave `registrado_recontacto` de la 0506 se queda (la usan la 0513,
`lib/studio/crm-tablero.ts:42` y el historial); cambia solo la etiqueta visible. Como vive en la base
(H11), el cambio **va en la migración A, dentro de la PR A**. Es lo más limpio: la A ya
redefine `crm_entrada_chatwoot` para R8 y mueve tarjetas a esa etapa, y una migración aparte pediría
otro número y otro OK para dos sentencias. La A:

1. hace `update crm_etapas set nombre = 'Recontacto'` donde `tablero = 'leads'`, `clave =
   'registrado_recontacto'` **y el nombre sigue siendo el sembrado** («Registrado / recontacto»),
   para no pisar uno que haya puesto un admin;
2. redefine `crm_sembrar_etapas` desde su última definición (`0506_crm_modelo.sql:224-244`) con el
   nombre nuevo, para los tenants que se creen después (la llama el trigger
   `crm_sembrar_etapas_tenant_nuevo`).

Textos del código que la nombran y cambian en S3: la ayuda de `CrmEmbudosClient.tsx:215`, los
comentarios de `lib/studio/chatwoot/entrada-leads.ts:13` y `lib/studio/crm-tablero.ts:17-20`, el dato
de prueba de `lib/studio/__tests__/crm-tablero-queries.test.ts:86` y el nombre de la prueba de
`crm-tablero.test.ts:88`. Los mensajes de `supabase/tests/0513_crm_entrada_leads.test.sql` no se
tocan: prueban una migración aplicada.

**«Con código» deja de ser etapa.** El «Registrado» del nombre viejo pasa a ser el tipo de lead
«Interesado con código» (§2.1).

**Cambia el contrato** de la SDD-0587 §4.3, etapa 3: se llama «Recontacto» y entra, además de lo de
hoy, el lead que escribe tras 30 días callado. Queda anotado allí, con una línea que apunta aquí.

### 2.10 R9 — Teléfono completo del lead y Recuperación (D-6.6-8 = b)

**Decisión de Sam (2026-11-06, 19:52Z):** el botón «Guardar el teléfono», a «¿de dónde sale la lista
para recuperar clientes?». No era la recomendada. Antes de elegir se le dijeron las contras: rompe
la regla de guardar lo mínimo (D6), obliga a cambiar `/privacidad` y deja en el Studio el teléfono
de gente que nunca se registró.

**Qué guarda.** Columna nueva `crm_tarjetas.phone_full`: solo dígitos, de 10 a 15, con el código de
país cuando se conoce. **Solo en la tarjeta sin ficha**, como el nombre visible. Con ficha, el
teléfono vive en `clients.phone`, como hoy. `phone_last10` se queda: es la llave para cruzar
(SDD-0587 §4.1) y la usa la pieza de ubicar o crear.

| Origen | Dato | Cómo |
|---|---|---|
| WhatsApp por Chatwoot | `meta.sender.phone_number` del webhook, que hoy se corta a 10 dígitos (`webhook-events.ts:86`, con `ultimos10` de `:71-75`) | Se pasa completo, solo dígitos, a `crm_entrada_chatwoot`. Que Chatwoot 4.19.1 lo mande con código de país es NV |
| Estimado web sin Shipping Mark | `quotes.prospect_whatsapp` | Con la regla de `buildProspectWaLink` (`lib/studio/estimado-linking.ts:47-53`: 0 más 10 dígitos pasa a 58 más 10), la misma que hoy arma el enlace de Recuperación |
| Instagram y Messenger | No traen teléfono | Nada |
| Tarjetas que ya existen | Solo tienen los últimos 10 | **Sin relleno.** El completo llega con el próximo mensaje. Copiarlo de Chatwoot o de Kommo es una carga de datos aparte que **decide Sam** (6.5 podría traerlo de Kommo, con su OK nominal) |

**Dónde se ve:** solo en la ficha de la tarjeta (con su enlace `wa.me`) y en Recuperación, para admin
y comercial (RLS de la 0506). No en el tablero, ni en Sin atender, ni en Resumen, ni en Reportes.

**Nunca sale**, con prueba en S5: ni a Discord (hoy solo lo usan `infra/ops/web/aviso-discord.sh` y
el puente de la oficina en `infra/oficina/dtd-alfred/`, y ninguno lee tarjetas, **C**), ni al push
(D-6.6-6 ya va sin datos), ni a los logs (solo códigos), ni a `entity_audit_log` (D-AUD), ni a
Kommo, ni a Chatwoot (Studio no escribe en Chatwoot).

**Cómo se borra** (mapa completo en §6.1):

- **Al ligar una ficha:** un trigger `before update` de `crm_tarjetas` lo vacía cuando `client_id`
  deja de ser nulo. Así ninguna ruta que liga tiene que acordarse: la de `crm_entrada_chatwoot`
  (`0513_crm_entrada_leads.sql:252-255`), la del alta web (`:375-379`), la pieza de la 10.5 y «Crear
  ficha» de R2. El check de `0506_crm_modelo.sql:339` se amplía igual, como red.
- **Al anonimizar,** por plazo o a mano: el mismo trigger lo vacía cuando `anonimizada_at` deja de
  ser nulo, y el check de anonimización (`:340-342`) lo exige.

**Cambia el contrato.** D6 de la SDD-0587 (§8) decía «nombre visible y últimos 10 dígitos». Queda:
del lead sin ficha, nombre visible, últimos 10 y teléfono completo; con ficha, nada (como antes). La
retención es la de D-6.6-9 (a). Se anota en la 0587 con una línea que apunta aquí.

**Migración propia (B)**, separada de la de 6.6 (A), porque se aplica en otro momento (P-11):

- columna `phone_full`, con check `^[0-9]{10,15}$` y sin grant de INSERT ni UPDATE para
  `authenticated`: la escriben solo funciones de `service_role`;
- el trigger de arriba;
- los dos checks de la 0506 (`:339` y `:340-342`) con `phone_full is null`. No tienen nombre propio:
  la migración los busca en `pg_constraint` por su definición y **aborta si no encuentra
  exactamente uno de cada uno** (I: así no borra uno equivocado);
- `crm_entrada_chatwoot` redefinida **desde su última definición**, la de la A (§2.9), con
  `p_phone_full text default null`. Se borra la firma vieja y se crea la nueva, para que PostgREST no
  vea dos funciones; el código de antes, que no lo manda, sigue funcionando;
- `crm_mover_por_estimado` redefinida desde la A: pone el teléfono del estimado web en la tarjeta sin
  ficha que no lo tiene (`coalesce`);
- **número reservado por el Director General.** Aplicarla pide el **OK nominal de Sam** y el
  runbook de producción, y va **después** de que el texto nuevo de `/privacidad` (§14, T1 a T3,
  aprobados el 2026-11-07) esté publicado: antes, el sistema no puede empezar a guardar el teléfono completo,
  porque la política diría otra cosa. El preflight exige la A.

**Recuperación sobre las tarjetas** (reemplaza la de Kommo que S0 oculta, H13). Hace lo mismo que la
de la SDD-0157 (`lib/studio/kommo-recovery.ts:1-12`), con otra fuente:

- **Quiénes:** los mismos dos grupos de hoy (`RecoverySegment`, `kommo-recovery.ts:29`), siempre
  desde una **tarjeta viva** sin la marca «No volver a escribir». Clientes, con el teléfono de su
  ficha. Interesados: «Interesado» con el teléfono completo de la tarjeta, e «Interesado con
  código» con el teléfono de su ficha. Una ficha sin tarjeta no aparece, igual que hoy solo
  aparece quien escribió por Kommo. Filtro por días desde la última actividad de la tarjeta.
- **«No volver a escribir».** Botón en la ficha de la tarjeta, para admin y comercial: pone
  `no_contactar_at` y la tarjeta sale de Recuperación. Se puede quitar; no borra nada. Deja el
  evento `crm_tarjeta_no_contactar`, solo con sí o no (D-AUD). Es lo que cumple el «no te escribimos
  más» de T3 también para quien tiene ficha, que no puede usar «Anonimizar ahora» (D-6.6-10). Hoy no
  hay una marca así: lo único parecido es la baja del boletín
  (`0259_newsletter_subscribers.sql:13`), que es de correo.
- **Acciones:** las de hoy, tandas de WhatsApp a mano con enlace `wa.me` (máximo 10,
  `RECOVERY_WA_BATCH_MAX`) y CSV para SMS. Salen del WhatsApp del asesor: **0 en Meta**. No sale por
  Chatwoot ni por la API de Meta: eso sería una plantilla pagada y queda fuera.
- **El CSV lo baja solo admin**, y cada descarga deja un registro con quién, cuándo y cuántas filas,
  sin teléfonos (§3). Quién lo baja hoy no se midió (NV).
- **Sale de la lista** quien se anonimizó: sin teléfono no hay a quién escribir.
- **El orden protege:** la lista de interesados sin ficha queda vacía hasta que exista
  `phone_full`, y la migración B se aplica solo después de publicar T1 a T3. No hace falta otro
  interruptor.
- **Base de licitud:** volver a escribirle a quien solo consultó es una finalidad nueva. T3 la
  describe; si su base es el consentimiento u otra, lo decide Sam con su asesor (revisar-datos-ve,
  punto 3).

## 3. Modelo de datos y migración

**Dos migraciones**, descritas aquí y **no escritas**:

- **A (6.6, R8 y el nombre «Recontacto»).** Número: lo reserva el Director General al arrancar el
  código, no antes (P-6). Va después de la 0506 y la 0513, ya aplicadas, y de la migración de la 10.5 (§2.8).
  Aditiva salvo un dato: el nombre visible de una etapa (§2.9). No borra ni renombra objetos.
- **B (R9, teléfono completo).** Número reservado por el Director General. Va después de la A y
  **después de publicar** los textos de §14 (§2.10). Cambia dos checks de la 0506.

**Aplicar cada una pide su OK nominal de Sam** y el
[runbook de producción](../../runbooks/aplicar-migraciones-prod.md). Aplicarlas no enciende nada:
los crons dependen de sus interruptores (§2.7 c).

**Migración A**

| Objeto | Cambio | Quién lo escribe |
|---|---|---|
| `crm_tarjetas.ultimo_entrante_at`, `ultima_respuesta_at` | Columnas nuevas `timestamptz`, nulas. Sin grant de INSERT ni UPDATE a `authenticated`. La anonimización las pone en nulo | `service_role` |
| `crm_tarjetas.ultimo_entrante_con_ventana` | Columna nueva `boolean`, nula: si el último entrante llegó por una bandeja con ventana de Meta (señal 3 de D-SA). La anonimización la pone en nulo | `service_role` |
| `crm_tarjetas.volvio_tarea_id` | Columna nueva, referencia a `crm_tareas(id)` con `on delete set null`: la marca «Volvió a escribir» de R8 | `service_role` |
| `crm_tarjetas.motivo_perdida_clave` y `crm_historial_etapas.motivo_clave` | Columna nueva con `check` a la lista de R7. El texto actual se queda | `crm_mover_etapa` y el RPC de R3 |
| `crm_cambios_tablero` | Tabla nueva: `id`, `tenant_id`, `tarjeta_id` (borrado en cascada), `de` y `a` (`leads` o `clientes`), `inicial`, `clave` única por tenant, `detectado_at`. Sin datos de personas. RLS de lectura con `crm_puede_usar()` | `service_role` |
| `crm_entrada_chatwoot` | Redefinida **desde su última definición** (hoy `0513_crm_entrada_leads.sql:174`; si la 10.5 la redefine antes, desde esa) para R8: lee las fechas antes del `update`, registra el entrante (`ultimo_entrante_at` con `greatest` y `ultimo_entrante_con_ventana`) y aplica la tabla de §2.9. Misma firma | `service_role` |
| `crm_registrar_mensaje(tenant, contacto, ficha, ocurrió)` | Solo salientes que cuentan como respuesta humana: ubica la tarjeta con `crm_buscar_tarjeta` y sube `ultima_respuesta_at` con `greatest`. Dos veces no cambia nada | `service_role` |
| `crm_etapas` (dato) y `crm_sembrar_etapas` | «Registrado / recontacto» pasa a «Recontacto» solo donde sigue el nombre sembrado; la siembra, redefinida desde `0506_crm_modelo.sql:224-244` (§2.9) | Migración |
| `crm_mover_por_estimado(tenant, estimado, estado, ocurrió)` | §2.3 completo: ubica o crea con `crm_tarjeta_ubicar_o_crear` de la 10.5, por ficha o por teléfono; con `ambigua` no mueve nada; «solo si»; limpiar motivo | `service_role` |
| `crm_registrar_cambios_tablero(tenant, ahora)` | §2.7 a. Devuelve cuántos cambios guardó | `service_role` |
| `crm_sin_atender(umbral, ahora)` | D-SA (§2.8), por tarjeta; la señal 2, con `crm_portal_espera` de la 10.5. Una variante con tenant para el cron | `authenticated` con `crm_puede_usar()`; la variante, `service_role` |
| `crm_kpis(desde, hasta, umbral)` | Las fórmulas de §2.5. Solo conteos | Admin y comercial |
| `crm_resumen_por_asesor(desde, hasta, umbral)` | Las de §2.6. Solo conteos y totales por asesor, con el id del usuario del equipo; el facturado, sumado adentro con `studio_client_annual_billing`. Ni ids de fichas ni de tarjetas | Admin, comercial y contabilidad (D-6.6-7 = a) |
| `crm_anonimizar_tarjeta(tarjeta, motivo)` | §2.7 d. Exige admin del tenant de la tarjeta y tarjeta sin ficha | `authenticated` (con ese chequeo adentro) |
| `crm_anonimizar_leads_perdidos` | Redefinida **desde su última definición** (`0506_crm_modelo.sql:759`) para compartir la limpieza con la anterior y con el predicado de D-6.6-9 (a): toda tarjeta de quien no es cliente, desliga la ficha y borra el BSUID al año (§2.7 b). El nombre se conserva para no romper llamadas; si conviene otro, se decide al escribirla | `service_role` |
| `crm_mover_etapa` | Redefinida desde `0506_crm_modelo.sql:623` solo para aceptar la clave del motivo | `authenticated`, como hoy |
| `audit_entity_types` | Fila `crm_tarjeta`, dominio `commercial` (existe en `0258_audit_entity_catalog.sql:127`) | Migración |
| `audit_crm_tarjeta_change()` | Trigger de §2.7 e, con la regla D-AUD (§2.8) | Trigger |

**Preflight de la A:** exige la 0506, la 0513 y, de la migración de la 10.5, `crm_tarjeta_ubicar_o_crear`
y `crm_portal_espera` (P-12, cerrada), y aborta si la A ya se aplicó, como la 0513 (SDD-0587
§16.3).

**Migración B**

| Objeto | Cambio | Quién lo escribe |
|---|---|---|
| `crm_tarjetas.phone_full` | Columna nueva, `check (phone_full ~ '^[0-9]{10,15}$')`. Sin grant de INSERT ni UPDATE a `authenticated` | `service_role` |
| `crm_tarjetas_quitar_telefono()` | Trigger `before update`: vacía `phone_full` cuando `client_id` o `anonimizada_at` dejan de ser nulos (§2.10) | Trigger |
| Checks de `0506_crm_modelo.sql:339` y `:340-342` | Se reemplazan por los mismos con `phone_full is null`. Se ubican por su definición; si no hay exactamente uno de cada uno, la migración aborta | Migración |
| `crm_entrada_chatwoot` | Redefinida desde la A con `p_phone_full text default null`; se borra la firma vieja | `service_role` |
| `crm_mover_por_estimado` | Redefinida desde la A: pone el teléfono del estimado web en la tarjeta sin ficha que no lo tiene | `service_role` |
| `crm_tarjetas.no_contactar_at` | Columna nueva `timestamptz`, nula: «No volver a escribir». La anonimización la pone en nulo | `crm_marcar_no_contactar` |
| `crm_marcar_no_contactar(tarjeta, valor)` | Pone o quita la marca, con su evento de auditoría | Admin y comercial, con `crm_puede_usar()` |
| `crm_recuperacion(segmento, dias_min, limite)` | La lista de §2.10: tarjetas vivas sin la marca; el teléfono, de la tarjeta sin ficha (`phone_full`) o de la ficha. Con el tope de hoy. Exige `crm_puede_usar()` | Admin y comercial |
| Registro de la descarga del CSV | Quién, cuándo y cuántas filas; sin teléfonos. Dónde vive se decide al escribirla: la auditoría de entidades pide una fila del CRM (D-AUD) y una descarga no la tiene (I) | Acción del CSV |

**Preflight de la B:** exige la A y aborta si la B ya se aplicó.

**Contrato en PGlite** para las dos, con las migraciones reales (§8).

## 4. Permisos y RLS

| Acción | Candado en la app | Candado en la base |
|---|---|---|
| Ver Resumen, Embudos y Sin atender | `requireModuleView("kommo")` + rol con CRM (`rolUsaCrm`) | RLS de la 0506: `crm_puede_usar()` (admin y comercial) |
| Crear ficha / ligar | `puertaEdicion` de 6.3 + `moduleEditDenial("clients")` | Insert de `clients` con su RLS; `update` de `crm_tarjetas` con los grants de la 0506 |
| Mover por el cotizador | `moduleEditDenial("quotes")`, el de la transición de hoy | RPC solo de `service_role` |
| Registrar mensajes | Webhook firmado de E2 | RPC solo de `service_role` |
| KPI y por asesor en el CRM | Igual que ver | RPC con `crm_puede_usar()` |
| Por agente en Reportes | `requireModuleView("reports")` | RPC de agregados con admin, comercial o contabilidad (D-6.6-7 = a) |
| Anonimizar ahora | `puertaEdicion` + rol admin | RPC que vuelve a exigir admin del tenant de la tarjeta |
| Ver Recuperación y el teléfono completo (R9) | Igual que ver | RLS de la 0506 y `crm_recuperacion` con `crm_puede_usar()` |
| Bajar el CSV de Recuperación | `puertaEdicion` + rol admin | La acción vuelve a exigir admin y deja el registro de la descarga |
| Cron de cambio de tablero, de retención y aviso de ventana | `CRON_SECRET`, como las demás rutas de `app/api/cron/`, **y su interruptor** (`CRM_CAMBIOS_TABLERO`, `CRM_RETENCION`, `CRM_AVISO_VENTANA`): apagados, no escriben | `service_role`, acotado por tenant |

Ningún permiso por usuario (desvíos de `rbac-guard`) abre las tablas `crm_*`: sigue mandando el
rol, como en 6.3 (SDD-0587 §14.1, «Permisos por usuario»).

## 5. Pantallas y allowlist exacta

Los tramos van en PR contra `main`, **en serie y sin apilar** (P-3), cada una abierta desde `main`
cuando la anterior ya está fusionada. Las pruebas de cada tramo van en el mismo tramo.

| PR | Tramos | Cuándo |
|---|---|---|
| **PR 0** | S0 | Primero: no espera la 10.5 ni migración (P-8) |
| **PR 0b** | S0b | Con la PR 0 fusionada (enmienda del Director General, 2026-11-07) |
| — | **M · maqueta** | Antes de S3, sin código (D-6.6-12 = b) |
| **PR A** | S1 + S2 | Después de la implementación de la 10.5 (§2.8) |
| **PR B** | S3 + S4 | Con la A fusionada, la maqueta aprobada por Sam y **la PR del paso P-13 de la SDD-0589 fusionada en `main`** (P-13; casilla de §9) |
| **PR C** | S5 (R9) | Con la B fusionada; la migración B se aplica después de publicar T1 a T3 (§14) |

**S0 · Ocultar Kommo** (§2.1, sin migración)
- `app/studio/(app)/crm/_components/kommo-tabs.shared.ts` (lista de pestañas y la de por defecto)
- `app/studio/(app)/crm/page.tsx` y `_components/KommoClient.tsx` (no cargar ni pintar lo de Kommo; encabezado)
- `app/studio/(app)/reportes/_components/ReportesClient.tsx` (solo `ByAgentView`), `lib/studio/reports/queries.ts`, `types.ts` y `export-csv.ts` (sin la tabla ni el CSV del espejo)
- `app/studio/(app)/cotizador/[code]/page.tsx` y `cotizador/_components/QuoteDetailClient.tsx` (sin el cruce con contactos de Kommo)
- Pruebas: las que fijan la lista de pestañas, la pestaña por defecto, `hasKommo` o `kommoMatches` (`git grep -n "resolveKommoTab\|KOMMO_TABS\|hasKommo\|kommoMatches"` en `__tests__`), más `app/studio/(app)/crm/__tests__/stage-control.test.ts` y `crm-rename.test.ts` si fijan el encabezado
- `app/studio/(app)/crm/__tests__/guia-se-queda.test.ts` (nueva: la guía sigue montada y `/studio/crm` abre Embudos; P-10)
- **Fuera de S0, aunque nombren a Kommo:** los archivos de la guía de la SDD-0589 (`app/studio/_components/guia/`, `lib/studio/guia/`, `app/studio/(app)/_actions/guia-actions.ts`, `lib/i18n/*/guide.ts`) y `app/studio/(app)/layout.tsx`. Si el diff de S0 toca uno, S0 no cierra

**S0b · Kommo fuera de las tres zonas de S0** (§2.1, sin migración). Allowlist exacta de la PR 0b:
- `lib/studio/direccion/queries.ts` (`CommercialSummary.oculto`; `getDireccionData` sin
  `listKommoLeads`; la cuenta queda como `resumenComercialKommo`) y
  `app/studio/(app)/direccion/_components/CommercialCard.tsx` (no se pinta si `oculto`)
- `lib/studio/dashboard/dashboard-catalog.ts` (`oculto` en el tipo y en `newLeads`),
  `dashboard-types.ts` (validación y catálogo accesible sin lo oculto) y
  `dashboard-kpi-queries.ts` (solo el comentario de `leadsKpi`)
- `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx` (el texto sin la 0506 y el comentario de
  cabecera)
- Pruebas:
  - `app/studio/(app)/direccion/_components/CommercialCard.test.tsx` (nueva: oculto no pinta,
    con su control)
  - `lib/studio/direccion/__tests__/queries.test.ts` (el smoke ya no espera cifras de Kommo y
    afirma que no se lee `kommo_leads`; la cuenta de antes se prueba en `resumenComercialKommo`)
  - `lib/studio/dashboard/dashboard-types.test.ts` (el catálogo accesible y el default sin lo
    oculto, la config guardada, la fuente «leads» y que solo `newLeads` está oculto)
  - `app/studio/(app)/crm/_components/CrmEmbudosSlot.test.tsx` (nueva: el texto sin la 0506)
- Esta spec (§1.3, §2.1, §5, §8, §9 y §13) y el handoff `.agents/handoffs/0614-s0b-kommo-fuera-de-s0.md`
- **Fuera de S0b:** `app/studio/(app)/dashboard/page.tsx` y `direccion/page.tsx` (no hace falta
  tocarlos), los archivos de la guía de la SDD-0589 y `layout.tsx`, y cualquier migración

**M · Maqueta** (sin código)
- Resumen, Sin atender y la ficha de la tarjeta (con «Crear ficha», el tipo de lead, la marca de R8 y
  el teléfono de R9), en Claude Design. Sam la aprueba antes de S3; el enlace y la fecha se anotan
  en esta spec.

**S1 · Base de datos (migración A)**
- `supabase/migrations/NNNN_crm_reemplazos_kommo.sql` (número al empezar)
- `supabase/tests/NNNN_crm_reemplazos_kommo.test.sql`
- `lib/studio/__tests__/crm-reemplazos.migration.test.ts`
- `supabase/migrations-baseline.json` (solo la entrada nueva)
- `supabase/pending-migration-symbol-declarations.json` (solo la entrada `sdd-0614-crm-reemplazos`)

**S2 · Cotizador y ficha desde la tarjeta**
- `app/studio/(app)/cotizador/actions.ts` (solo `transitionStatus`: la llamada que no lanza, y quitar `enqueueKommoWriteback` y `enqueueKommoStageWriteback` de ahí)
- `app/studio/(app)/cotizador/[code]/page.tsx` (solo la línea del CRM)
- `lib/studio/crm-estimado.ts` (nuevo)
- `app/studio/(app)/crm/tarjeta-actions.ts` (verbos de buscar duplicados, crear ficha y ligar)
- `app/studio/(app)/crm/_components/CrearFichaDrawer.tsx` (nuevo) y `TarjetaFichaDrawer.tsx` (el botón)
- `lib/studio/crm-ficha.ts` (tipos)
- `lib/studio/chatwoot/router-api.ts` (solo la lectura de un contacto por id)
- `app/studio/(app)/clientes/actions.ts` y `lib/studio/client-alta.ts` (nuevo), **solo si** se extrae el alta (§2.2)
- Pruebas: `lib/studio/__tests__/crm-estimado.test.ts`, `app/studio/(app)/cotizador/__tests__/transicion-tarjeta-crm.test.ts` (también: ya no encola nada a Kommo), `app/studio/(app)/crm/__tests__/tarjeta-actions-gate.test.ts` (casos nuevos), `app/studio/(app)/crm/_components/CrearFichaDrawer.test.tsx`, `lib/studio/rbac-actions-guard.test.ts` (conteo de acciones)

**S3 · Vista, KPI, por asesor, sin atender, tipo de lead y recontacto**
- `lib/studio/chatwoot/webhook-events.ts` (dirección, tipo de remitente, si la bandeja tiene ventana y si es la del portal, sin nombres), `webhook-procesar.ts` (lista de manejadores), `lib/studio/chatwoot/respuestas.ts` (nuevo manejador)
- `lib/studio/crm-kpis.ts` (nuevo: tipos y lecturas de las RPC)
- `app/studio/(app)/crm/page.tsx`, `_components/kommo-tabs.shared.ts`, `_components/KommoClient.tsx` (pestañas nuevas y slots)
- `app/studio/(app)/crm/_components/CrmResumenSlot.tsx`, `CrmResumen.tsx`, `CrmSinAtenderSlot.tsx`, `CrmSinAtender.tsx` (nuevos)
- `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx` y `CrmEmbudosClient.tsx` (`?tarjeta=` y el texto de ayuda con «Recontacto»)
- `app/studio/(app)/crm/_components/CrmTableroKanban.tsx` y `TarjetaFichaDrawer.tsx` (tipo de lead y marca «Volvió a escribir»), `lib/studio/crm-tablero.ts` y `crm-tablero-queries.ts` (el tipo y la marca; comentario de `:17-20`), `lib/studio/chatwoot/entrada-leads.ts` (solo el comentario de `:13`)
- `lib/studio/reports/queries.ts` y `types.ts` (Por agente), `app/studio/(app)/reportes/_components/ReportesClient.tsx` (solo `ByAgentView`)
- Pruebas: `lib/studio/chatwoot/__tests__/respuestas.test.ts`, `webhook-events.test.ts`, `webhook-fixtures.ts`, `lib/studio/__tests__/crm-kpis.test.ts`, `crm-tablero.test.ts` y `crm-tablero-queries.test.ts`, `app/studio/(app)/crm/_components/CrmResumen.test.tsx`, `CrmSinAtender.test.tsx`, `CrmTableroKanban.test.tsx`, `app/studio/(app)/crm/__tests__/stage-control.test.ts` y `crm-rename.test.ts` (si fijan pestañas o encabezado), `lib/studio/reports/__tests__/queries.test.ts`
- **Condición para fusionar (P-13):** la PR del paso P-13 de la SDD-0589 ya está en `main` (§9). S3 no toca ningún archivo de la guía; la prueba de ese paso vive en `main` y corre en su `pnpm verify`

**S4 · Mantenimiento**
- `app/api/cron/crm-mantenimiento/route.ts` y `app/api/cron/crm-retencion/route.ts` (nuevos), `lib/studio/crm-mantenimiento.ts` (nuevo)
- `vercel.json` (dos entradas) e `infra/dtd-cargo/cron/crontab` (regenerado con `scripts/build-crontab.mjs`, no a mano)
- `.env.example` e `infra/dtd-cargo/.env.example` (solo `CRM_CAMBIOS_TABLERO`, `CRM_RETENCION` y `CRM_AVISO_VENTANA`, vacías: apagadas)
- `app/studio/(app)/crm/tarjeta-actions.ts` (anonimizar ahora), `_components/TarjetaFichaDrawer.tsx` (botón y diálogo), `_components/CrmTableroKanban.tsx` (motivos en el diálogo de «Perdido»)
- `docs/runbooks/crm-mantenimiento.md` (nuevo: qué corre, a qué hora, cómo se ve si falló)
- Pruebas: `app/api/cron/crm-mantenimiento/__tests__/route.test.ts`, `app/api/cron/crm-retencion/__tests__/route.test.ts`, `lib/studio/__tests__/crm-mantenimiento.test.ts`, `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx`, `scripts/__tests__/build-crontab.test.ts` y `scripts/__tests__/infra-env-example.test.ts` (sin cambios: tienen que seguir verdes)

**S5 · Teléfono completo y Recuperación (R9, migración B)**
- `supabase/migrations/NNNN_crm_telefono_completo.sql` (número del Director General), `supabase/tests/NNNN_crm_telefono_completo.test.sql`, `lib/studio/__tests__/crm-telefono.migration.test.ts`, `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json` (solo sus entradas)
- `lib/studio/chatwoot/webhook-events.ts` (el teléfono completo, solo dígitos, aparte de `ultimos10`) y `lib/studio/chatwoot/entrada-leads.ts` (lo pasa a `crm_entrada_chatwoot`)
- `lib/studio/crm-estimado.ts` (el teléfono del estimado web)
- `lib/studio/crm-recuperacion.ts` (nuevo), `app/studio/(app)/crm/_components/CrmRecuperacionSlot.tsx` y `CrmRecuperacion.tsx` (nuevos), `kommo-tabs.shared.ts` (la pestaña), `app/studio/(app)/crm/tarjeta-actions.ts` (CSV solo admin y «No volver a escribir»)
- `app/studio/(app)/crm/_components/TarjetaFichaDrawer.tsx` (el teléfono y el botón «No volver a escribir») y `lib/studio/crm-ficha.ts`
- `app/privacidad/page.tsx`: **solo** los textos T1 a T3 de §14, aprobados el 2026-11-07 y sin cambiar una palabra, y su fecha de actualización. Se publica **antes** de aplicar la migración B
- Pruebas: `lib/studio/__tests__/crm-recuperacion.test.ts`, `app/studio/(app)/crm/_components/CrmRecuperacion.test.tsx`, `lib/studio/chatwoot/__tests__/webhook-events.test.ts` y `entrada-leads.test.ts` (el teléfono no sale a logs ni a avisos), `lib/studio/rbac-actions-guard.test.ts`

**En todos los tramos:** esta spec, `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 6.6 y las
filas nuevas que arme el Subdirector), `docs/specs/README.md` (índice regenerado) y
`.agents/handoffs/0614-*.md`.

**Este borrador** toca solo: esta spec, `docs/specs/README.md`,
`.agents/handoffs/0614-crm-reemplazos-kommo.md` y, en la SDD-0587
(`docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md`), la línea de §10 que apunta aquí (P-1)
y dos notas fechadas que apuntan aquí: en §4.3 (etapa «Recontacto») y en §8 (D6).

## 6. Datos personales (revisar-datos-ve)

Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Se evalúa el código de
`main` que 6.6 toca y se dice qué exige el diseño; lo diseñado no es **CORRECTO** hasta que exista.
**Esto no es asesoría legal.**

**Resumen sobre el código de hoy:** 4 CORRECTO, 3 ENCONTRADO, 4 NO VERIFICABLE y 1 no aplica.

**Inventario que suma 6.6:**

| Dato | Dónde | De quién | Finalidad | Retención |
|---|---|---|---|---|
| Nombre visible y últimos 10 dígitos de quien pidió un estimado por la web sin ficha | `crm_tarjetas` con `fuente = 'cotizador'`, copiados de `quotes.client_name` y de `quotes.prospect_whatsapp` (§2.3, paso 2). Con R9, también el teléfono completo | Prospecto sin ficha que usó el cotizador web | Seguir su estimado en el tablero Leads | D6: se anonimiza a los 12 meses sin actividad (§2.7 b). El estimado sigue en `quotes` con su propio plazo, que 6.6 no cambia |
| **Teléfono completo del lead sin ficha** (R9) | `crm_tarjetas.phone_full` (migración B) | Lead sin ficha que escribe por WhatsApp o pide un estimado web | Seguir su consulta y recuperarlo (D-6.6-8 = b) | 12 meses sin actividad o «Anonimizar ahora»; al ligar la ficha, se va de la tarjeta. Mapa en §6.1 |
| Hora del último entrante y de la última respuesta, y si ese entrante tiene ventana | `crm_tarjetas` (§3) | Lead o cliente que escribe por Chatwoot | Saber si alguien espera respuesta y si la ventana de 24 h se cierra | Con la tarjeta; se borran al anonimizar |
| Marca «Volvió a escribir» | `crm_tarjetas.volvio_tarea_id` (§2.9) | Lead que vuelve tras 30 días | Que el equipo lo trate como recontacto | Con su tarea; se va al anonimizar |
| Marca «No volver a escribir» | `crm_tarjetas.no_contactar_at` (§2.10, migración B) | Persona que pidió que no le escriban | Sacarla de Recuperación | Con la tarjeta; se va al anonimizar |
| Clave del motivo de pérdida | `crm_tarjetas`, `crm_historial_etapas` | Lead | Conteos por motivo con menos texto libre | Con la tarjeta; se borra al anonimizar |
| Cambios de tablero | `crm_cambios_tablero` | Persona con tarjeta | KPI «pasaron a cliente» | Con la tarjeta; sin datos de la persona |
| Teléfono completo leído de Chatwoot | En memoria del servidor; si se confirma, `clients.phone` | Lead al que se le crea ficha | Precargar la ficha | El de la ficha |
| Eventos de auditoría | `entity_audit_log` | Id de la tarjeta e ids del equipo; **nunca** el de la ficha ni datos de la persona (D-AUD, §2.8) | AUD-01 | El de la bitácora (AUD-02), que sobrevive a la purga de la ficha |
| Aviso de ventana | Push del navegador | Ninguno: sin nombre ni teléfono | Avisar al dueño | El del servicio de push |

| # | Punto | Estado en `main` | Evidencia y lo que exige 6.6 |
|---|---|---|---|
| 1 | Inventario | CORRECTO | El de la 0506 y la 0513 (SDD-0587 §14.3 y §16.8). Lo nuevo de 6.6 está arriba; ninguna columna nueva guarda texto de mensajes ni correo. El teléfono completo es de R9 y tiene su mapa (§6.1) |
| 2 | Minimización | CORRECTO hoy; **ENCONTRADO con R9** | Con ficha no se copian nombre ni teléfono (`0506_crm_modelo.sql:339`). 6.6 exige: aviso sin datos de la persona; motivos de lista; KPI y por asesor solo con conteos. **R9 guarda más que el mínimo de D6** por decisión de Sam (D-6.6-8 = b), con finalidad declarada (recuperar) y su plazo; se ve solo en la ficha y en Recuperación |
| 3 | Consentimiento | NO VERIFICABLE | Igual que la 0587 §14.3: la base de licitud de guardar al lead la decide Sam con su asesor. Crear una ficha sin un acto de la persona ya pasa hoy (`kommo-convert.ts:167`, `clientes/actions.ts:104`) y 6.6 no lo amplía. **Con R9 hay una finalidad nueva**, volver a escribirle a quien solo consultó (T3): su base es la misma pregunta abierta, y `/privacidad` §3 dice hoy que el marketing va con consentimiento (`app/privacidad/page.tsx:227-243`) |
| 4 | Derechos | ENCONTRADO | Un lead sin ficha no tiene cómo pedir que se borre su tarjeta antes de los 12 meses: la anonimización solo la corre `service_role` y nada la llama (`0506_crm_modelo.sql:759`; `git grep` sin llamadas). **Arreglo:** «Anonimizar ahora» (§2.7 d) |
| 5 | Borrado | ENCONTRADO | La anonimización por plazo no está agendada y solo mira a quien está en «Perdido» y sin ficha (`0506_crm_modelo.sql:768-774`): el registrado que nunca envió nada conserva para siempre en su tarjeta el contacto del chat, el BSUID, las notas y las tareas. **Arreglo:** cron diario con D-6.6-9 (a), que nace apagado y lo enciende Sam (§2.7 c). Chatwoot conserva contacto y conversación sin plazo (0587 §14.3, punto 8): el diálogo lo dice. La prueba de borrado con un valor rastreable se propone para prueba (§8), no para producción |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Hoy no hay camino que registrar. El diseño deja `crm_tarjeta_anonymized` con quién y el motivo de la lista |
| 7 | Política pública | ENCONTRADO | `/privacidad` promete anonimizar a los 12 meses sin actividad a quien «no llegaste a ser cliente» (`app/privacidad/page.tsx:345-349`) y borrar el BSUID al año (`:352-354`); nada lo hace hoy, y el predicado de la 0506 deja fuera al registrado sin envíos. Sam eligió D-6.6-9 (a), que **con el cron encendido** deja ese texto cierto sin cambiarlo. **R9 sí obliga a cambiar el texto:** la lista de datos dice que de quien no es cliente se guardan «los últimos 10 dígitos de tu teléfono» (`:64`), y la de finalidades no dice que le volvamos a escribir (`:183-224`). Textos en §14 (T1 a T3), aprobados por Sam el 2026-11-07 y sin publicar: lo dejan cierto al publicarse, antes de la migración B |
| 8 | Terceros | NO VERIFICABLE | Studio no escribe en Chatwoot (0587 §5.1) y 6.6 tampoco. El aviso sale por los servicios de push del navegador (`web-push`, `package.json:85`); que el contenido viaje cifrado de punta a punta no se leyó aquí. Por eso el aviso no lleva datos de la persona |
| 9 | Transferencia internacional | NO VERIFICABLE | Todo queda en la base de DTD. El CRM solo lo ven admin y comercial (`rbac.ts:99`); si alguno trabaja desde China aplicaría la PIPL, y eso no se ve en el código |
| 10 | Decisiones automatizadas | CORRECTO | Los movimientos solos cambian la etapa y el aviso es interno: nada niega servicio ni escribe al cliente (D8 de la 0587) |
| 11 | Aceptación electrónica | No aplica | 6.6 no registra aceptaciones |
| 12 | Titulares que no son usuarios | CORRECTO | El lead sin ficha guarda lo mínimo y su plazo (D6). 6.6 le suma un camino para pedir el borrado (punto 4). Si hace falta un aviso al escribir por el canal, lo decide Sam con su asesor |
| — | Logs | — | El diseño exige solo códigos en los logs, sin nombre, teléfono, contacto ni BSUID, con prueba (como `entrada-leads.test.ts` en 6.4) |
| — | Fixtures | — | Nombres de prueba, teléfonos 555 y correos `example.test` |

La skill recomienda una segunda opinión: otro modelo puede auditar este diseño. **Lo que hace
falta de un abogado:** la base de licitud (ahora también la de volver a escribirle a quien solo
consultó) y el pase de la política, que siguen sin hacerse.

### 6.1 Teléfono completo (R9): mapa de borrado y retención

**Retención:** la de D6 con D-6.6-9 (a). En la tarjeta sin ficha, hasta 12 meses sin actividad o
hasta que alguien lo pida («Anonimizar ahora»). Con ficha, el plazo de la cuenta.

| Copia | Dónde | Cómo se borra | Cuándo |
|---|---|---|---|
| Tarjeta sin ficha | `crm_tarjetas.phone_full` | El trigger de la B lo vacía al anonimizar; el check de anonimización lo exige | 12 meses sin actividad (cron, que nace apagado) o «Anonimizar ahora» |
| Al crear o ligar la ficha | Pasa a ser el `clients.phone` de la ficha | El trigger lo vacía de la tarjeta al ligar; la ficha sigue su plazo (`app/privacidad/page.tsx:331-337`) y su borrado (0455) | Al ligar |
| Estimado web | `quotes.prospect_whatsapp`, de donde se copia | 6.6 no lo cambia: sigue el plazo del estimado (no se leyó si hay uno, NV) | — |
| Chatwoot | El contacto de la conversación | Studio no lo borra; el diálogo de «Anonimizar ahora» lo dice | Sin plazo hoy (SDD-0587 §14.3, punto 8) |
| CSV de Recuperación | Archivo descargado | **Fuera del sistema: ningún plazo lo alcanza.** Por eso lo baja solo admin y queda el registro de cada descarga | ENCONTRADO como riesgo |
| Enlace `wa.me` | El WhatsApp del asesor | Fuera del sistema; el chat queda en el teléfono del asesor, como hoy con la Recuperación de Kommo | — |
| Respaldos | Copias cifradas de la base | Se van al cumplir 30 días (`app/privacidad/page.tsx:357-360`) | 30 días después del borrado |
| Logs, push, Discord, auditoría, Kommo | — | Nunca se escribe ahí; hay prueba de logs y de avisos | — |

**Prueba de borrado** (paso 3 de la skill), en el entorno de prueba con un teléfono rastreable de
la serie 555: entra por WhatsApp, se liga y se anonimiza; después de cada paso, el valor no aparece
en `crm_tarjetas`, en los logs ni en los avisos. Nunca en producción.

**Pendiente que R9 no resuelve:** Chatwoot conserva contacto y conversación sin plazo, y el texto
vigente ya promete anonimizar los «identificadores del chat» (`:348`). Lo cierra una retención en
Chatwoot o una frase que lo diga: **decide Sam aparte** (§12).

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
  posterior, tarea sin fecha, conversación del portal con mensajes sin respuesta por
  `crm_portal_espera`; la bandeja del portal no mueve las señales 1 y 3); KPI y por asesor contra un
  juego de datos fijo, y que el de por asesor no devuelva ids de fichas ni de tarjetas; anonimizar
  ahora (admin sí, comercial no, otro tenant no, con ficha no; misma limpieza que por plazo);
  retención con D-6.6-9 (a): lead sin ficha y registrado sin envíos a los 12 meses, el registrado
  queda desligado y puede tener una tarjeta nueva, el cliente no se toca salvo su BSUID al año;
  auditoría según D-AUD (payload sin `client_id` ni datos de la persona; actor `system` para lo
  que dispara el webhook, un cron o `service_role`); grants (nada para `anon`).
- **Recontacto (R8), en el contrato de la A:** a los 29 días y a los 30 en Nuevo, Contactado,
  Recontacto, Estimado enviado, Negociación, Aceptado y Perdido, con lo que pide la tabla de §2.9;
  `ultimo_entrante_at` nulo con `ultima_actividad_at` vieja y reciente; evento viejo que llega tarde;
  el mismo mensaje dos veces (una tarea); saliente del equipo dentro de los 30 días (no rompe el
  silencio); cliente (no aplica); etapa propia del admin antes y después de «Estimado enviado».
- **Nombre de la etapa:** el `update` cambia solo la fila con el nombre sembrado y deja la que un
  admin renombró; un tenant nuevo nace con «Recontacto».
- **Teléfono completo (R9), en el contrato de la B:** se guarda solo sin ficha; ligar por cada ruta
  (entrada de Chatwoot, alta web, la pieza de la 10.5 y «Crear ficha») lo vacía; anonimizar lo
  vacía; formato inválido no entra; la migración aborta si no encuentra exactamente uno de cada
  check; `authenticated` no lo escribe; firma vieja de `crm_entrada_chatwoot` borrada y la nueva
  acepta la llamada sin el parámetro.
- **Control rojo** sin la migración y **mutantes** por rama de cada RPC, como la 0506 y la 0513.
- **Manejador de mensajes:** saliente de agente, eco sin remitente, nota privada, bot y redirección
  de E10, cada uno con su resultado esperado; bandeja con ventana y sin ella; un saliente o un
  entrante de la bandeja del portal no mueve las fechas.
- **Cotizador:** el fallo de la tarjeta no rompe la transición (error, promesa rechazada, llamada que
  lanza), y **ya no se encola nada a Kommo** en ninguna de las tres transiciones (D-6.6-3 = b).
- **S0:** sin pestañas de Kommo en la barra; cada `?tab=` viejo abre la pestaña por defecto;
  Reportes › Por agente muestra su aviso y el CSV no trae la tabla del espejo; el detalle del
  estimado no muestra contactos de Kommo. **La guía se queda** (P-10): el layout sigue importando y
  montando `GuiaStudio`, con su mutante, y `/studio/crm` sin `?tab=` abre Embudos, donde están las
  anclas `embudo.*`; `git diff --name-only` de S0 no trae ningún archivo de la guía.
- **S0b:** Dirección no lee `kommo_leads` y la tarjeta Comercial no se pinta (con su control); el
  KPI de leads no se ofrece, no se pinta desde una config guardada, no viene en el default y su
  fuente no se pide; Embudos sin la 0506 no nombra las otras pestañas. Rojo antes del cambio y un
  mutante por pieza.
- **Recuperación:** los dos grupos con su tope; el CSV lo baja solo admin y deja su registro; una
  tarjeta anonimizada o con «No volver a escribir» no aparece; una ficha sin tarjeta tampoco.
- **El teléfono no sale:** ni en logs, ni en el push, ni en `entity_audit_log`, con un teléfono
  rastreable de la serie 555.
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

- [ ] S0: el Studio no muestra pestañas, tablas ni cruces de Kommo; los `?tab=` viejos abren la
  pestaña por defecto; nada de Kommo se apagó ni se borró; la guía «Antes en Kommo → Ahora aquí»
  sigue montada y S0 no tocó ninguno de sus archivos (P-10).
- [ ] S0b: Dirección y el Dashboard no muestran cifras de Kommo ni las leen; el texto de Embudos
  sin la 0506 no remite a pestañas ocultas; nada de Kommo se borró.
- [ ] R1: Resumen, Embudos y Sin atender funcionan con datos de tarjetas; cada tarjeta de Leads dice
  «Interesado» o «Interesado con código».
- [ ] M: Sam aprobó la maqueta de Resumen, Sin atender y la ficha de la tarjeta antes de S3.
- [ ] S3 (P-13): antes de fusionar la PR B, la PR del paso P-13 de la SDD-0589 está fusionada en
  `main`. En la PR B se anotan su número y su commit de merge; `git merge-base --is-ancestor
  <commit de merge> HEAD` da 0 en la rama de la PR B, y la prueba de ese paso (falla con Resumen por
  defecto y pasa con el arreglo) sale verde en el `pnpm verify` de la PR B. Sin esa PR en `main`, la
  PR B no se fusiona.
- [ ] R2: crear ficha desde una tarjeta sin ficha deja la ficha ligada, sin nombre ni teléfono en la
  tarjeta, en el mismo tablero; con duplicado ofrece ligar o se detiene, según §2.2.
- [ ] R3: enviar, aceptar o rechazar mueven la tarjeta según la tabla de §2.3; repetir no mueve dos
  veces; un fallo no rompe la transición; el cotizador ya no encola nada a Kommo.
- [ ] R4: la tabla por asesor sale de las tarjetas, con la misma definición en el CRM y en Reportes.
- [ ] R5: cada KPI coincide con su fórmula sobre un juego de datos fijo.
- [ ] R6: las tres señales aparecen y desaparecen en sus bordes; nada se envía al cliente; el aviso,
  si se enciende, no lleva datos de la persona y sale una vez por ventana.
- [ ] R7: los crons nacen apagados y no escriben nada así; encendidos en prueba, registran cambios
  de tablero y anonimizan por plazo; «Anonimizar ahora» solo para admin y sin ficha; la auditoría
  registra sus eventos según D-AUD.
- [ ] R8: el lead que vuelve tras 30 días pasa a «Recontacto» o recibe la marca y la tarea, según
  §2.9; la etapa se llama «Recontacto» y su clave sigue igual.
- [ ] R9: el teléfono completo se guarda solo sin ficha, se va al ligar y al anonimizar, y no sale a
  logs, avisos ni auditoría; Recuperación lista los dos grupos y el CSV es solo de admin; T1 a T3,
  aprobados el 2026-11-07, estaban publicados antes de aplicar la migración B.
- [ ] Las definiciones D-SA y D-AUD (§2.8) son las mismas que cita la SDD-0586 §10.5.
- [ ] Contrato SQL, control rojo y mutantes en verde; `pnpm verify` de cada tramo con su resultado
  por paso.
- [ ] Ninguna migración se aplica dentro de este paso: cada una lleva su propio OK nominal de Sam.
  Encender cada cron es otro OK aparte.

## 10. Reestimación y tramos

**Contra la línea base v3 del checklist 0582 (115,5 días).** La reestimación anterior de esta SDD
(6.6 de 2,5 a 4 días, y +2,25 junto con la 10.5, de 115,5 a 117,75) **queda vencida** por las
respuestas de Sam del 2026-11-06. La línea base nueva la arma el Subdirector; esta SDD da sus
números y no toca el checklist. Todos los días son estimación (**I**).

**Las 6.x, fila por fila:**

| Fila | Base v3 | Ahora | Delta | Por qué |
|---|---|---|---|---|
| 6.1 | 2 | 2 | 0 | Aceptada |
| 6.2 | 2 | 2 | 0 | Aceptada |
| 6.3 | 5 | 5 | 0 | Aceptada |
| 6.4 | 2 | 2 | 0 | Aceptada |
| 6.5 | 1,5 | 1,5 | 0 | Esta SDD no la cambia. Si 6.5 trae el teléfono completo de Kommo (R9 no rellena), se reestima allí |
| **6.6** | **2,5** | **5,5** | **+3** | Desglose abajo |
| 6.7 | 2,25 | 2,25 | 0 | Esta SDD no la cambia: el aviso de ventana de R6 es el reemplazo interno del «Ping 23 h» |
| **E6** | **17,25** | **20,25** | **+3** | |

**6.6 por tramo:**

| Tramo | Días | Qué | Frente al diseño anterior (4 d) |
|---|---|---|---|
| S0 | 0,25 | Ocultar Kommo: pestañas, Reportes y cruce del estimado | Nuevo (D-6.6-1) |
| M | 0,5 | Maqueta de Resumen, Sin atender y ficha de la tarjeta | Nuevo (D-6.6-12) |
| S1 | 1,75 | Migración A, contrato PGlite, control rojo y mutantes; nombre «Recontacto» | +0,25 (nombre de la etapa y siembra) |
| S2 | 1 | Cotizador sin Kommo y ficha desde la tarjeta | +0,25 (quitar los envíos y sus pruebas; rechazo del cliente) |
| S3 | 1,25 | Vista, KPI, por asesor, sin atender y manejador; tipo de lead | +0,25 (tipo de lead en tablero, ficha y Sin atender) |
| S4 | 0,75 | Crons, aviso, anonimizar ahora, motivos y runbook | 0 |
| **6.6** | **5,5** | | +1,5 sobre los 4 d; **+3 sobre la base** |

Lo que ya traía el diseño anterior sigue (P-4: no se recorta la retención ni «Anonimizar ahora»):
lo que 6.2 a 6.4 le pasaron a 6.6 (cerca de 1 día) y las dos fechas de «sin atender» (cerca de 0,5).

**Filas nuevas propuestas** (fuera de la fila 6.6; número y etapa los pone el Subdirector):

| Fila propuesta | Días | Qué | De dónde sale |
|---|---|---|---|
| Recontacto a los 30 días (R8) | 0,75 | La regla de §2.9 en la migración A, la marca «Volvió a escribir» en S3, sus pruebas y mutantes | Tema extra de Sam, opción A |
| Teléfono completo y Recuperación (R9) | 2,75 | Migración B con su contrato (0,75); entrada de Chatwoot y estimado web (0,5); Recuperación sobre las tarjetas, con CSV solo admin y «No volver a escribir» (1,25); revisar-datos-ve, textos T1 a T3 y prueba de borrado (0,25) | D-6.6-8 = b |
| Maqueta de la integración visual de Chatwoot en el Studio | 1 | Cómo se ve y se contesta una conversación de Chatwoot sin salir del Studio: la bandeja, la conversación junto a la ficha de la tarjeta y el paso de una a otra. Solo maqueta; lo que salga se estima después | Respuesta 1 de Sam; propuesta del Director General |
| **Filas nuevas** | **4,5** | | |

**Si se acepta todo:** 6.6 suma 3 y las filas nuevas 4,5: **+7,5 días**, de 115,5 a **123**. No
incluye lo que sume la 10.5 rediseñada por las respuestas 13 a 18 (es de su SDD).

**Orden:** la PR 0 (S0) ya; la maqueta M mientras se rediseña la 10.5; con la 10.5 implementada, la
PR A (S1 + S2, con la parte de R8 en la migración A); con la maqueta aprobada y el paso P-13 de la
SDD-0589 en `main`, la PR B (S3 + S4, con la parte de R8 en pantalla); después, la PR C (S5), cuya migración B se aplica tras publicar T1 a T3
(P-3, P-11).

## 11. Decisiones

### De Sam (cerradas el 2026-11-06)

Respondió en el chat del Director General, una por una. El texto literal está en el registro del
Director General (`respuestas-18-preguntas-20261106.md`, en las notas compartidas del programa);
aquí van la cita corta y lo que cambia. Las opciones y las recomendaciones con que se le preguntó
siguen en esta spec en `5dc8500c3`.

| # | Pregunta | Lo que dijo Sam (hora Z) | Queda | ¿La recomendada? | Dónde cambia el diseño |
|---|---|---|---|---|---|
| D-6.6-1 | Pestaña que abre el CRM | «A Como no lo quiero ver por ahora ni nada; como lo están trabajando externo, déjalo externo hasta que hagamos la migración al 100%» (~19:08Z; dictado, «Como» es Kommo) | Resumen. **Las pestañas de Kommo se ocultan del Studio desde ya**, y la tabla de Kommo en Reportes también | Va más allá de la (a) | §2.1 (S0), §2.6 |
| D-6.6-2 | Nombre del botón | Botón «Crear ficha» (19:11Z) | «Crear ficha» | Sí | §2.2 |
| D-6.6-3 | Kommo al mover desde el cotizador | «Ahorita no me interesa que avise nada a Kommo; vamos a eliminar a Kommo totalmente de la fórmula» (19:16Z) | (b) Solo la tarjeta: se retira del cotizador el envío de precio y etapa a Kommo, que hoy no escribe nada (H14). En la misma respuesta: dos tipos de lead, «Interesado» e «Interesado con código», y cliente desde la primera carga recibida en China | No | §2.1, §2.3 |
| D-6.6-4 | Estimado rechazado de un cliente | «si el cliente la rechaza, prefiero que se vaya a postventa (es decir, a recompra pendiente). Dije la opción A, pero prefiero la opción B» (19:37Z; corrige la (a) del mismo minuto) | (b) A «Recompra pendiente» | No | §2.3 |
| D-6.6-5 | Umbral de «espera respuesta» | «opcion a» (19:39Z) | (a) 1 hora a reloj corrido | Sí | §2.4, D-SA |
| D-6.6-6 | Aviso de «sin atender» | Botón «Pantalla y aviso» (19:48Z) | (b) Pantalla y push al dueño cuando a la ventana le quedan 4 h; nace apagado | Sí | §2.4, §2.7 c |
| D-6.6-7 | Quién ve el desempeño por asesor | «Para la pregunta 7, pon las recomendadas» (19:50Z) | (a) El CRM y Reportes › Por agente con totales, también contabilidad. La tabla vieja de Kommo se oculta, por la respuesta 1 | Sí | §2.6 |
| D-6.6-8 | Recuperación | Botón «Guardar el teléfono» (19:52Z), después de oír las contras | (b) La tarjeta guarda el teléfono completo de cada interesado, también sin ficha | No | §2.10 (R9), §6.1, §14 |
| D-6.6-9 | Qué se anonimiza por plazo | «a» (19:52Z) | (a) Toda tarjeta de quien no es cliente, con o sin ficha, en cualquier etapa; el BSUID al año; con la 8, también el teléfono completo | Sí | §2.7 b |
| D-6.6-10 | «Anonimizar ahora» | Botón «Solo administradores» (19:53Z) | (a) Solo admin y solo tarjetas sin ficha | Sí | §2.7 d |
| D-6.6-11 | Motivos de pérdida | Botón «Lista corta y Otro» (19:55Z), sin cambios en la lista | (a) | Sí | §2.7 f |
| D-6.6-12 | Maqueta antes del código | Botón «Sí, ver la maqueta» (19:56Z) | (b) Maqueta de Resumen, Sin atender y la ficha de la tarjeta. Propuesta aparte: la de Chatwoot dentro del Studio | No | §5 (M), §10 |
| Extra | Recontacto | «Ok, la opción A a la pregunta que te hice anteriormente está bien» (19:50Z) | A los 30 días callado, desde cualquier etapa; desde «Estimado enviado» en adelante no retrocede: marca y tarea | Sí | §2.9 (R8) |
| Extra | Nombre de la etapa | Botón «Sí, Recontacto» (21:09Z) | «Recontacto», con la misma clave; «con código» deja de ser etapa | — | §2.9, §2.1 |

**Lecturas del Director General que Sam puede corregir** (se las dijo en el chat): «Ya cuando
apruebe, se pasa a cliente» se lee como «Aceptado, esperando carga», que todavía es lead; y la
extracción del historial de Kommo sigue, porque es parte de la migración a Chatwoot.

**Lo que Sam decide aparte.** No lo autoriza esta SDD; cada punto lleva su OK:

- retirar Kommo en E8, fuera de esta SDD: la lectura diaria del espejo y el webhook, las tablas y
  columnas (8.9 a 8.11) y el código que S0 deja oculto (8.7);
- ~~aprobar los textos públicos T1 a T3 de §14, palabra por palabra~~ **cumplido el 2026-11-07**
  (03:59Z, «Apruebo los tres», traído por el Director General). Publicarlos sigue con su OK (§12);
- encender cada cron (`CRM_CAMBIOS_TABLERO`, `CRM_RETENCION`, `CRM_AVISO_VENTANA`), después de
  publicar y de probar en prueba (§2.7 c); la retención, antes del 2027-11-04;
- aplicar la migración A y la B, cada una con su OK nominal;
- rellenar el teléfono completo de las tarjetas que ya existen;
- la retención de Chatwoot (§6.1);
- con su asesor, la base de licitud de volver a escribirle a quien solo consultó (§2.10).

### Preguntas nuevas al Director General (2026-11-06)

P-8, P-9 y P-11 las respondió el Subdirector de Chatwoot el mismo día. P-12 se cerró con la 10.5
rediseñada. P-10 la contestó Sam el 2026-11-07. P-13, nueva del 2026-11-07, la decidió el
Director General ese mismo día.

| # | Pregunta | Estado |
|---|---|---|
| P-8 | ¿S0 (ocultar Kommo) va en su propia PR, antes que todo? | **Sí:** en su propia PR y primero |
| P-9 | Entre S0 y S3, Reportes › Por agente no muestra desempeño por asesor. ¿Se acepta, o la tabla de Kommo se queda hasta S3? | **Se oculta**, con un aviso corto e interno. El texto de §2.1 quedó aprobado tal cual por el Subdirector |
| P-10 | ¿La guía «Antes en Kommo → Ahora aquí» (SDD-0589) se queda en el Studio? | **Cerrada por Sam** el 2026-11-07 a las 03:56Z: «Sí, se queda». Se la dio al Director General, que la trajo, por el Subdirector de Chatwoot. Es la recomendación de esta SDD. La guía sigue montada cuando S0 oculte Kommo, hasta que Sam decida apagarla, y queda como invariante comprobable de S0 (§2.1, §5, §8, §9). No toca lo aprobado de E9 en la #408 |
| P-11 | ¿El teléfono completo va en su propia migración (B)? | **Sí:** la B va aparte |
| P-12 | La 10.5 se rediseña (respuesta 14). ¿Sigue trayendo `crm_tarjeta_ubicar_o_crear`, y qué pasa con la señal 2 de D-SA? | **Cerrada** con la 10.5 rediseñada (#400, `12a5f7c52`, §10.5.19): la pieza sigue; la señal 2 sale de `crm_portal_espera`; la bandeja del portal queda fuera de las señales 1 y 3; `crm_ticket` queda sin objeto. Aplicado en §2.8 |
| P-13 | Con Resumen por defecto (S3), `/studio/crm` sin `?tab=` ya no monta el tablero, y el recorrido Embudo de la guía (`RECORRIDO_EMBUDO`, #408) no encuentra sus anclas y no abre (§2.1, **I**). ¿Cómo sigue llegando la guía a Embudos? | **Decidida por el Director General** el 2026-11-07, hacia las 04:20Z (decisión técnica, no de Sam; la trajo el Subdirector de Chatwoot). Lo resuelve la SDD-0589 en un **paso aparte con PR propia, después de la #408**, no como ajuste de `836edcd18`. 6.6 no toca la guía (P-10). **S3 no se fusiona antes de ese paso** (§5, §9). El paso trae una prueba que falla con la pestaña por defecto en Resumen y pasa con el arreglo; el arreglo (un recorrido que abra `?tab=embudos` o un `rutaCoincide` que mire la pestaña) lo elige E9. Pendiente: E9 todavía no abre el paso. No cambia ninguna estimación de 6.6 |

### Resueltas por el Director General (2026-11-06, sobre `99e7d6300`)

Relayadas por el Subdirector de Chatwoot.

| # | Pregunta | Decisión |
|---|---|---|
| P-1 | ¿Puntero en la SDD-0587 §10? | Sí. Va en esta misma PR |
| P-2 | Cambio de tablero: ¿tabla propia o filas en el historial? | Tabla propia: un movimiento a la misma etapa no deja fila (`0506_crm_modelo.sql:731-733`), y en el historial `de` y `a` son etapas, no tableros (§2.7 a) |
| P-3 | ¿Cuántas PR? | En serie contra `main` y sin apilar (§5). Eran dos; con las respuestas de Sam se suman la PR 0 (P-8) y la PR C (P-11), las dos aceptadas |
| P-4 | ¿Línea base o recorte? | No se recortan la retención (§2.7 b) ni «Anonimizar ahora» (§2.7 d). La cifra de entonces (+2,25 días con la 10.5, de 115,5 a 117,75) **quedó vencida** el 2026-11-06: la nueva está en §10 |
| P-5 | ¿La SDD-0610 usa la clave del motivo? | Sí: usa la clave, y el texto libre solo en «Otro» |
| P-6 | Número de migración | Se asigna al arrancar; lo reserva el Director General. Ni 6.6 ni la 10.5 reservan la 0518 (§3) |
| P-7 | Identidad de la redirección de E10 | Respondida con el código: sale con el token del usuario de servicio (`router-api.ts:10`) como `outgoing` no privado (`:123`) y se excluye por el id de ese usuario (§2.4, D-SA) |

Cambios que pidió antes de aceptar, ya aplicados: D-6.6-9 reescrita con el texto literal de
`/privacidad`; en el inventario, las tarjetas de los estimados web (§6); la contradicción de los ids
en Reportes (§2.6 y §3: la RPC no devuelve ids de fichas); los crons nacen apagados (§2.7 c); y la
coordinación con la 10.5 con sus dos definiciones (§2.8).

## 12. Fuera de alcance

- **Retirar Kommo** (E8, con su OK aparte): el código que S0 deja oculto, el espejo y su lectura
  diaria, que es lo único vivo hacia Kommo (H14), el webhook y el writeback (8.7 a 8.11);
  `registration_channel = 'kommo'` (8.10). S0 solo oculta.
- **La integración visual de Chatwoot en el Studio**: aquí solo se propone su maqueta, como fila
  nueva (§10).
- **El rediseño de la 10.5** por las respuestas 13 a 18 de Sam: es de la SDD-0586.
- **Rellenar el teléfono completo** de las tarjetas que ya existen y **la retención de Chatwoot**
  (§6.1): decide Sam aparte.
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
- **Aplicar las migraciones A y B**, **publicar los textos de §14** y **encender los crons**: cada
  uno con su OK aparte.

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
- **2026-11-06:** Sam cerró D-6.6-1 a D-6.6-12 y dos temas extra en el chat del Director General
  (§11). El diseño suma S0 (Kommo oculto), la maqueta M, R8 (recontacto y nombre «Recontacto»), R9
  (teléfono completo, Recuperación y su migración B) y los textos públicos de §14, sin publicar. La
  reestimación anterior queda vencida (§10). Se suman P-8 a P-12 para el Director General. En la
  SDD-0587 quedan dos notas fechadas que apuntan aquí (§4.3 y D6).
- **2026-11-06:** corrección del Subdirector, con lo que midió el Director General en
  `dtd-cargo-functions-1`: hoy el ERP no le escribe nada a Kommo (`KOMMO_PUSH_DRY_RUN` vacío; H14).
  Quitar los envíos del cotizador deja de ser un apagado en producción y el alta de `/registro` sale
  de lo que Sam decide aparte. El Subdirector respondió P-8, P-9 y P-11; P-10 (de Sam) y P-12
  quedaron abiertas ese día y se cerraron después (P-12 el mismo 2026-11-06, P-10 el 2026-11-07).
  El nombre «Recontacto» va en la migración A, con número que reserva el Director General.
- **2026-11-06:** P-12 cerrada con la 10.5 rediseñada (#400, `12a5f7c52`, §10.5.19). D-SA y D-AUD de
  §2.8 quedan como las cita esa SDD: la señal 2 con `crm_portal_espera`, la bandeja del portal
  fuera de las señales 1 y 3, y sin `crm_ticket`. No cambia ninguna estimación.
- **2026-11-07:** P-10 cerrada por Sam a las 03:56Z, traída por el Director General: «Sí, se queda».
  La guía de la SDD-0589 queda fuera de S0 como invariante comprobable (§2.1, §5, §8, §9). Al
  medirlo apareció P-13 (la guía y Resumen por defecto en S3), que el Director General decidió ese
  mismo día. No cambia ninguna estimación.
- **2026-11-07:** Sam aprobó T1, T2 y T3 de §14 a las 03:59Z, traídos por el Director General:
  «Apruebo los tres». T3 queda con «o por mensaje de texto (SMS)». El texto de cada uno no cambió:
  sus huellas sha256, con los saltos de línea unidos por un espacio, son las mismas que en
  `8958ca951`. Siguen sin publicar; se publican antes de aplicar la migración B, por PR y tanda con
  el OK del Director General. No cambia ninguna estimación.
- **2026-11-07:** el Director General decidió P-13 hacia las 04:20Z: la resuelve la SDD-0589 en un
  paso aparte con PR propia, después de la #408, y S3 no se fusiona antes de ese paso. La
  dependencia queda como condición de la PR B (§5) y casilla de §9. E9 todavía no abre el paso. No
  cambia ninguna estimación.
- **2026-11-07:** enmienda S0b, encargada por el Director General al revisar la #415. §1.3 no
  inventariaba la tarjeta Comercial de Dirección ni el KPI «Leads en pipeline» del Dashboard, que
  siguen leyendo `kommo_leads`, ni el texto de Embudos que remite a las pestañas ocultas. Se
  ocultan sin borrar en la PR 0b (§2.1, §5, §8 y §9). Sin estimación propia en §10.

## 14. Textos públicos aprobados por Sam (se publican por PR y tanda, con el OK del Director General)

Para quien solo consultó, por R9 (D-6.6-8 = b). **Sam los aprobó palabra por palabra el 2026-11-07
a las 03:59Z**, traídos por el Director General: «Apruebo los tres». Si cambia una sola palabra de
cualquiera de los tres, vuelve al Director General antes. Van en la
PR C (S5), junto con la fecha `UPDATED` de la página (`app/privacidad/page.tsx:39`), y se publican
**antes** de aplicar la migración B. Pasan por revisar-datos-ve (§6) y no son asesoría legal.
Ninguno está publicado.

**T1 · `/privacidad` §1, fila «Mensajes por WhatsApp y chat»** (`app/privacidad/page.tsx:64`),
última oración.

- Hoy: «Si todavía no eres cliente, guardamos tu nombre visible y, si lo tenemos, los últimos 10
  dígitos de tu teléfono para dar seguimiento a tu consulta.»
- Aprobado (Sam, 2026-11-07 03:59Z, traído por el DG): «Si todavía no eres cliente, guardamos tu nombre visible y, si lo tenemos, tu número
  de teléfono completo para dar seguimiento a tu consulta y, si no llegas a contratar, para volver
  a escribirte más adelante.»

**T2 · `/privacidad` §1, fila «Estimado / Calculadora»** (`:66-69`): se agrega una oración al final.

- Hoy: «Datos del envío (tipo de carga, volumen/peso, origen-destino) y el contacto que dejas para
  enviarte el estimado (EST-XXXX).»
- Aprobado (Sam, 2026-11-07 03:59Z, traído por el DG): «Datos del envío (tipo de carga, volumen/peso, origen-destino) y el contacto que dejas
  para enviarte el estimado (EST-XXXX). Si todavía no eres cliente, también guardamos tu nombre y tu
  teléfono para dar seguimiento a tu estimado.»

**T3 · `/privacidad` §2 «Para qué usamos tus datos»**: viñeta nueva, después de «Atender tus
mensajes por WhatsApp y chat» (`:194-200`).

- Hoy: no existe.
- Aprobado (Sam, 2026-11-07 03:59Z, traído por el DG): «**Retomar tu consulta:** si nos escribiste o pediste un estimado y no llegaste a
  contratar, podemos escribirte más adelante por WhatsApp o por mensaje de texto (SMS) para
  retomarla. Si no quieres que te volvamos a escribir, dínoslo por el mismo chat o por los medios de
  la sección 11, y no te escribimos más. También puedes pedirnos que borremos tus datos de
  seguimiento.»

**Lo que los textos no cambian:** §6 ya dice que a los 12 meses sin actividad se anonimizan
«nombre, teléfono, identificadores del chat y notas» (`:345-349`), y eso cubre el teléfono completo.
Con D-6.6-9 (a) el sistema anonimiza en cualquier etapa, no solo «cuando tu consulta queda
cerrada», así que hace al menos lo que promete (**I**).

**Lo que Sam tiene que mirar con su asesor antes de aprobar:**

- **La base de T3.** §3 de la misma página dice que las comunicaciones de marketing van con
  consentimiento (`:227-243`). Volver a escribirle a quien solo consultó puede leerse como marketing;
  si es así, T3 necesitaría pedir ese consentimiento y no solo ofrecer la baja.
- **Chatwoot conserva** contacto y conversación sin plazo, y §6 ya promete anonimizar los
  «identificadores del chat» (§6.1). Los textos de arriba no lo arreglan.
- **«Por mensaje de texto (SMS)»** sale de la Recuperación de hoy, que exporta un CSV para SMS
  (`lib/studio/kommo-recovery.ts:1-4`). Si DTD ya no manda SMS, se quita de T3.

Sam aprobó los tres textos el 2026-11-07, después de ver estos tres puntos en el mismo mensaje, y
aprobó T3 con «o por mensaje de texto (SMS)», sin quitarlo. La base de T3 y la retención de Chatwoot
siguen en «Lo que Sam decide aparte» (§11). La del SMS no estaba en esa lista: quedó resuelta al
aprobar T3 tal cual.
