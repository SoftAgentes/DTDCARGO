# FASE FUTURA — Motor de flujo interno por servicio + mapeo perfiles → RBAC

> Extensión de **SDD-0076** y hermano de [`FASE-FUTURA-capa-interna-y-frentes.md`](./FASE-FUTURA-capa-interna-y-frentes.md). **Diseño, NO implementado.** Migración futura libre **~0136** (0134/0135 ya tomadas por SDD-0082 — confirmar con `git fetch` + todas las ramas al implementar).
>
> **Fecha:** 2026-06-14 · **Origen:** el founder pidió el flujo de trabajo interno de cada servicio (quién hace qué, en qué momento, qué automatizar) estilo N8N + cómo cuajar los servicios a los perfiles para los roles del ERP. Análisis: 3 agentes Plan (motor + flujos núcleo + flujos add-on tercero) + brief real del founder + 3 agentes de perfiles (org-design, servicios↔roles, RBAC).

## 0. Principio rector (founder)

La config del **tipo de servicio es de una sola vez** — se configura una vez y queda hasta que el flujo cambie. → Optimizar para "set once, simple y correcto", NO edición frecuente. Por eso el motor es una **tabla de pasos**, no un BPMN ni un canvas arrastrable. El founder dio latitud ("si necesitas algo más robusto, hazlo"); el veredicto fue **simple gana**: la complejidad real no es del motor, es (a) una fase pre-bodega que faltaba modelar y (b) la integración WeChat↔CRM (problema de plataforma, no de motor).

## 1. Modelo del motor

- **Backbone + deltas** (no 20 flujos sueltos): los 5 núcleo comparten el viaje de la carga, se define **una vez** vía el campo `momentoTimeline` que el catálogo ya tiene; cada núcleo solo marca sus diferencias.
- **2 tablas** (espejo del patrón mail-rules / mail-logs ya probado en prod):
  - `service_workflow_steps` — la **definición** (lo que el founder configura), gemela de `mail_rules`. Campos: `service_key` (NULL = backbone de todos los núcleo), `momento`, `orden`, `nombre`, `node_kind`, `owner_role`, `automation_level`, `trigger_event`, `ai_skill_slug?`, `template_ref`, `channel`, `sla_hours`, `depends_on`.
  - `workflow_step_runs` — la **ejecución/traza** (quién hizo qué, cuándo), gemela de `mail_logs`/`agent_runs`. Idempotencia por unique `(step_id, source_kind, source_id)` — mismo patrón que el outbox de push.
- **Disparador `fireWorkflowEvent()`** = gemelo de `fireMailEvent()` (`lib/studio/mail/mail-rule-engine.ts`): best-effort (nunca rompe al caller), llamado **al lado** de los `fireMailEvent` que ya existen en las server actions; reusa el vocabulario del enum `mail_rule_event` + agrega los eventos faltantes.
- **Frontera:** 100% ERP-side. Ambas tablas `revoke all from anon`; la whitelist pública (`public_servicios()`) nunca las ve.
- **Anti-sobre-ingeniería:** sin nodos condicionales/loops/expresiones. Una bifurcación = dos pasos con distinto `trigger_event`. La secuencia la da `orden` + `depends_on` + `momento`.

## 2. Los 10 tipos de nodo (cada uno delega a infra que YA existe en prod)

| `node_kind` | Qué hace | Infra existente | ¿Toca cliente/dinero/tercero? |
|---|---|---|---|
| `enviar_email` | correo al cliente/interno | `fireMailEvent()` | cliente → compuerta |
| `enviar_whatsapp` | WhatsApp/SMS | `fireMailEvent` (canal whatsapp) | cliente → compuerta |
| `recordatorio_interno` | push al operario | `enqueueOperarioPush()` | no → puede ser nivel 4 |
| `crear_tarea` | asigna trabajo a un rol | `comments` + @mención (SDD-0045) | no → puede ser nivel 4 |
| `avanzar_estado` | mueve la entidad en su máquina de estados | `transitionShipment()` / RPCs despacho | depende |
| `montar_documento` | genera **borrador** de doc | generadores existentes (ver §4: `fillPacklist`) | el borrador no, emitir sí |
| `solicitar_doc_cliente` | pide al cliente subir un doc | `enviar_email` + link portal | cliente → compuerta |
| `solicitar_a_tercero` | auto-solicitud a proveedor/carrier | crea `workflow_step_runs` awaiting_human + borrador + costo esperado | tercero+dinero → JAMÁS auto |
| `esperar_confirmacion_humana` | compuerta explícita | fila awaiting_human en bandeja | es la compuerta |
| `ejecutar_ia` | corre un agente | `runAgent({trigger:'event'})` (SDD-0020) | la IA propone, nunca dispara lo irreversible |

## 3. Escalera de automatización (4 niveles) + regla dura

| Nivel | Qué hace el sistema | Qué hace el humano |
|---|---|---|
| `manual` | nada, solo recuerda | todo |
| `asistido` | arma el borrador (correo/doc/costo) | revisa y envía con 1 click |
| `auto_con_compuerta` | hace todo menos el envío final | 1 click de confirmación |
| `automatico` | corre solo | nada (solo audita) |

**Regla dura = candado en `validateWorkflowStepInput()`:** lo que mueve dinero o escribe a un **cliente** o **tercero** NUNCA puede ser `automatico` (tope = `auto_con_compuerta`). Nodos gated: `enviar_email`, `enviar_whatsapp`, `solicitar_doc_cliente`, `solicitar_a_tercero`. Pueden llegar a nivel 4: `recordatorio_interno`, `crear_tarea`, `ejecutar_ia` read-only, `montar_documento` (borrador), `avanzar_estado` interno.

## 4. Dónde entra la IA (runtime SDD-0020)

La IA del ERP es **read-only por diseño**. Corre sola cuando no manda nada irreversible: traducir ZH→ES, sugerir HS-code, clasificar un documento, resumir, sugerir el siguiente paso, recordar. Cuando le escribe al cliente o a un tercero → arma el **borrador** y el humano dispara. La **compuerta IA ya existe**: el estado `needs_approval` + tabla `agent_approvals` del runtime. **Blocker prod:** `ANTHROPIC_API_KEY` + seed de skills. Los niveles 1–3 (mail/push/tareas) funcionan **sin** la IA.

**Top 4 automatizaciones de mayor alivio:** (1) traducir ZH→ES + sugerir HS-code en recepción CN; (2) cerrar los huecos de email de hito al cliente (hoy NO se avisa solo cuando *llegó a bodega / zarpó / salió a reparto / fue entregado* — faltan los eventos `shipment_in_warehouse`/`shipped`/`out_for_delivery`/`delivered`); (3) borrador auto de solicitud a terceros + clasificar el reporte que devuelven; (4) cobranza DDP (recordatorios + borrador WhatsApp + conciliación).

## 5. La fase PRE-BODEGA (lo que el modelo no capturaba) — flujo real del founder

Flujo real de coordinación CN (compra-asistida / consolidación), **anterior** a que exista cualquier fila operacional (no hay shipment ni `warehouse_receipts_cn`):

1. Cliente avisa que tiene carga en China.
2. El dueño de la tarea pide al cliente los datos del proveedor: nombre/número/**WeChat**.
3. DTD contacta al proveedor **de parte del cliente**.
4. Se crea un **grupo de WeChat** y se mete al equipo de la oficina CN a coordinar.
5. Coordinar docs de exportación → DTD entrega un **documento 2-en-1 (factura + packing list)**.
6. Coordinar día de despacho + tracking del **flete interno**.
7. Negociar quién paga el flete interno (condiciones en el Packing/"documento patente").
8. Llega al almacén CN → fotos; si las cajas vienen con **QR** el operario escanea.

**Qué falta para modelarla** (campos nuevos, capa interna):
- Entidad **`proveedor`** ligera: `name`, `name_zh`, `wechat_id`, `phone`, `referido_por_markbox` (hoy solo es texto `supplier_name` en la recepción, se pierde).
- Campos de coordinación: `wechat_group_id`, `internal_freight_tracking`, `internal_freight_payer` (proveedor|cliente|dtd — campo de dinero → tope compuerta), `despacho_fecha`.
- Trigger de entrada nuevo: **`cliente_anuncia_carga_cn`** (lo arranca un mensaje entrante, no un evento del sistema).
- **NO crear nodo `crear_grupo_chat`** (crear grupo WeChat es 100% manual, sin API) → se modela con `crear_tarea` + pegar `wechat_group_id`.

**El doc 2-en-1 YA existe:** `fillPacklist()` en `lib/studio/prealertas/packlist.ts` + template `public/templates/dtd-packing-list-invoice.xlsx` (pre-llena 唛头/MARKBOX, cliente, proveedor, **微信/WeChat**, ref). Función pura = implementación lista del nodo `montar_documento`; solo falta colgarla + persistir al Hub de Documentos.

**WeChat ↔ CRM = captura manual estructurada, NO integración.** CRM = Kommo. WeChat **no tiene API oficial abierta** (≠ WhatsApp Cloud API); WeCom/Official Accounts son otros productos; conectores no-oficiales = riesgo de baneo. **Opción A (recomendada):** agregar `wechat` al enum `ConversationChannel` (`lib/studio/conversaciones/conversations-types.ts`; hoy whatsapp|email|portal) como canal de **registro manual** (external_ref = `wechat_group_id`, atado a `client_id`). Resuelve el 80% (trazabilidad) con casi cero ingeniería.

**El QR en recepción NO avanza estado solo:** su valor real = dar la identificación inequívoca del cliente que hoy falta en el auto-vínculo recepción→prealerta de `app/studio/(app)/cn/actions.ts` (caso ambiguo H1 de SDD-0072). Es input de `avanzar_estado`, no un nodo nuevo.

## 6. Mapeo perfiles → RBAC (de `Downloads/estructura-perfiles-dtdcargo.md`, doc del founder)

- Los **~14 roles de negocio colapsan limpio en los 6 RBAC que el ERP ya tiene** (SDD-0024: `admin · commercial · operations · accounting · warehouse · support`) + 2 móviles por PIN (`bodeguero · camionero`). **NO crear roles nuevos.** Marketing (Fátima/Fiorella/Alejandro-vibe) = sin asiento ERP (Kommo/GA4); externos (operador Candy, transportistas, agente aduanal) = prohibidos por candado.
- ⚠️ **Hueco real del ERP:** hoy el RBAC solo distingue **admin vs no-admin**; los 4 roles intermedios NO restringen ningún módulo (aislamiento real = `tenant_id`/RLS). Falta `ROLE_MODULE_ACCESS` + helper `requireModule()` server-side. Archivos: `lib/studio/user-types.ts` (6 roles), `supabase/migrations/0019_users_roles.sql` (CHECK+RPC), `app/studio/(app)/layout.tsx` (único gating `isAdmin`).
- **El `owner_role` del motor debe reusar `StudioUserRole`** (los mismos 6), no inventar "frentes". Un solo vocabulario de roles en todo el sistema.
- **La Matriz rol→persona (titular + suplente) debe volverse una TABLA en la DB** por tenant, no un .md — así el motor enruta tareas solo (`owner_role` del paso → titular de la Matriz).
- **Candados:** Sourcing/proveedores NUNCA en el ERP; **separación de poderes** Tesorería (`accounting`, mueve plata) vs Operador de ERP (`operations`, verifica) → **Yolimar = accounting, NO admin**; Alejandro (data/ERP) = `operations`, nunca el que mueve plata.

## 7. Mapeo servicios → owner_role (cuajar servicios a perfiles)

| # | Servicio | núcleo/add-on | in-house/tercero | owner_role (rol dueño) | persona hoy |
|---|---|---|---|---|---|
| 1 | Puerta a puerta DDP | núcleo | híbrido | operations + admin (⚠️ costura sin dueño) | Sam |
| 2 | LCL consolidado | núcleo | tercero | operations | Sam |
| 3 | FCL en bodega | núcleo | tercero | operations (externo Candy) | Candy/Sam |
| 4 | FCL directo | núcleo | tercero | operations | Sam |
| 5 | Transporte terrestre | núcleo | tercero | PIN camionero / operations | Javier+terceros |
| 6 | Tránsito de aduana | add-on | tercero+passthrough | operations | Sam(+Albert) |
| 7 | Documentos importación | add-on | in-house | operations | Sam(+Albert) |
| 8–10 | Revisión / etiquetado / reempaque | add-on | in-house | operations (externo Candy) | Candy/Sam |
| 11,13,14 | Inspección / auditoría / lab | add-on | tercero+markup | operations (QA/Coord. China) | Sam coord. |
| 12,15 | Verificación prov. / compra asistida | add-on | tercero / in-house | commercial (Sourcing) | José |
| 16 | Asesoría de pagos | add-on | in-house · riesgo alto | accounting + commercial | José |
| 17 | Muestras / courier | add-on | tercero+spread | commercial (Sourcing) | José |
| 18,19 | Visado / registro de marca | add-on | tercero | **⚠️ Trámites (sin dueño)** | por asignar |
| 20 | Cursos | add-on | tercero | **⚠️ Formación (sin dueño)** | por asignar |

**Huecos:** Sam dueño de 9/20, José 7/20; 3 sin dueño real (visado/marca/cursos); white-label sin vigilante de SLA; si Sam falta, nadie coordina a Candy.

## 8. Plan de implementación (cuando se apruebe)

1. Migración `~0136`: `service_workflow_steps` + `workflow_step_runs` + enums (`workflow_node_kind`, `workflow_automation_level`, `workflow_event`) + campos pre-bodega + entidad `proveedor`. `revoke … from anon`.
2. `lib/studio/workflow/{types,queries}.ts` + `validateWorkflowStepInput()` con la regla dura.
3. `fireWorkflowEvent()` (niveles 1–2 primero, sin IA) cableado al lado de los `fireMailEvent` existentes.
4. Tab "Flujo" en `ServicioDrawer` (lista simple, no canvas) + bandeja de compuerta.
5. Cron `api/cron/workflow-sla` (patrón ceo-brief) para escalado por SLA.
6. Niveles 3–4 con IA: `ejecutar_ia` → `runAgent(trigger:'event')`; `solicitar_a_tercero` → `needs_approval` (tras `ANTHROPIC_API_KEY` + seed skills).
7. RBAC por módulo (`ROLE_MODULE_ACCESS` + `requireModule()`) — hueco independiente pero relacionado (define el `owner_role`).

> Espejo del guardrail de SDD-0076: no marcar un paso gated como `automatico`, y no marcar `tercero+auto_request` sin `fulfiller`.
