---
sdd: "0062"
title: "Reestructuración CRM (Kommo) para cierres automáticos + integración CRM↔ERP"
status: proposed
author: "Claude Code (session context) + founder"
created: 2026-06-07
updated: 2026-06-07
supersedes: null
superseded_by: null
related: ["0011","0020","0026","0040","0041","0042","0043","0044","0046","0055","0058","0061"]
confidencialidad: interno
---

# DTD-0062 — Reestructuración CRM (Kommo) para cierres automáticos + integración CRM↔ERP

> Desatascar el embudo de Kommo y lograr cierres eficientes integrándolo con el ERP propio (DTD Studio): el CRM sigue siendo Kommo (canal WhatsApp + embudo), el ERP es el cerebro (valor, IA, email marketing, write-back). Para el equipo comercial de DTD Cargo.

## Contexto

DTD Cargo capta mucho por WhatsApp/Kommo pero **no cierra**. El negocio no tiene problema de captación, sino de **avance y cierre**: los leads se amontonan en la primera/segunda etapa y casi ninguno llega a la decisión.

Hoy la integración Kommo↔ERP es **inbound-only**: el ERP espeja Kommo (read-only + webhooks, SDD-0043) y convierte lead→cliente (SDD-0058), pero **nunca escribe en Kommo**. El ERP ya tiene las piezas para ser el cerebro: runtime de IA con presupuesto/auditoría (SDD-0020), motor de reglas de mail con Resend (SDD-0026), el dato de plata real (estimados `total_usd`, SDD-0011/0061; facturas, SDD-0021) y el puente que ya extrae el email de Kommo a `clients.email` (`lib/studio/kommo-convert.ts::parseContactFields`).

Este spec define la reestructuración del embudo + la evolución de la integración a **bidireccional mínima (write-back)** para habilitar cierres automáticos, manteniendo Kommo y el modelo de seguridad del token (solo accesible por la edge function vía Vault).

> ⚠️ **Supersede el punto "inbound-only"** de SDD-0043 (Alcance B) y SDD-0061, *únicamente* para el write-back acotado que define este spec. El token sigue viviendo en Vault y solo lo lee la edge function — la compatibilidad de seguridad se preserva.

---

## 1. Resumen ejecutivo + hallazgos clave

DTD no necesita un sistema complejo ni más bots, sino: (a) **desatascar** el backlog muerto, (b) **asignar valor** real a los leads (hoy $0), (c) **capturar email** para tener un canal de reactivación sin restricciones, y (d) usar la **IA existente** (Kommo AI Agent + runtime del ERP) en vez de construir más bots. La regla de negocio es la **Metodología 3D: Depurar → Dirigir → Decidir**.

**Hallazgos clave (validados con datos reales de PROD — ver §2):**

- **H1 — Cementerio, no backlog.** 2.029 leads en "Atención al cliente"; **mediana de 349 días sin movimiento**; 86% lleva >6 meses. La mayoría está muerta.
- **H2 — Ceguera total de valor.** **0 de 2.675 leads** tienen valor monetario. El pipeline real es inmedible. El ERP ya tiene el valor (estimado).
- **H3 — Conversión ≈ 0.** Solo **3 leads cerrados** (1 ganado, 2 perdidos) en todo el CRM = **0,04%**.
- **H4 — Sin email no hay reactivación.** Solo **149 de 2.700 contactos (5,5%)** tienen email. El canal correcto para los dormidos (email) hoy alcanza al 5,5%.
- **H5 — Concentración insostenible.** **1 usuario posee 2.673 de 2.675 leads (99,9%)**. Una persona no puede dar seguimiento a ese volumen → causa estructural del atasco.
- **H6 — Sin atribución.** Los campos UTM/fbclid/gclid existen pero están vacíos (solo 30/2.675 leads tienen algún custom field). No se sabe de qué canal vienen los leads.
- **H7 — Integración inbound-only.** El CRM no refleja lo que pasa en el ERP (no hay write-back de valor ni de etapa). Bots Cursos y NPS rotos; fuga ~25% en el saludo.

**Decisiones (cerradas):** mantener Kommo ✓ · arquitectura híbrida (Kommo canal + ERP cerebro) ✓ · IA sobre bots ✓ · write-back habilitado ✓ · Metodología 3D como modelo operativo ✓ · arrancar código por captura/reactivación de email (Slice D) ✓.

---

## 2. Diagnóstico con datos reales (Fase 0 · "Claude Cot")

Corte **2026-06-07**, SQL read-only sobre el espejo Kommo en Supabase (proyecto `DoorTuDoor`, SDD-0043). Reemplaza los "[PENDIENTE: requiere export/API]" del documento original con números duros. **Sin PII** (solo agregados).

### 2.1 Volumen y embudos
- **2.675 leads** y **2.700 contactos** en el espejo. **10 pipelines** (el documento contaba 6; hay 4 chicos no documentados: *Carga China VZLA Ofidoc* 4, *VISA China* 4, *Investigación productos* 3, *Sam* 2).
- Distribución: Embudo de ventas (principal) **2.067** · Embudo Carga 240 · Compra asistida 232 · Cursos 95 · Verificación de mercancía 15 · Validación de proveedores 13.

### 2.2 El cuello de botella (pregunta 1 — antigüedad)
"Atención al cliente" (Embudo de ventas): **2.029 leads**. Antigüedad sin movimiento (`kommo_updated_at`):

| Sin moverse | Leads | % |
|---|---|---|
| > 30 días | 1.941 | 96% |
| > 90 días | 1.860 | 92% |
| > 180 días | 1.752 | **86%** |
| > 365 días | 753 | 37% |

**Mediana: 349 días** (~11,5 meses). El más viejo sin tocar desde 2024-04-23. **Conclusión: no es un backlog reciente, es un cementerio** → la mayoría no es reactivable por WhatsApp (ventana de 24h cerrada hace meses), solo por email/re-opt-in.

### 2.3 Valor y conversión (preguntas 2)
- **$0 confirmado al 100%:** 0 de 2.675 leads con `price > 0`.
- **Conversión ≈ 0:** solo **3 leads cerrados** (1 `Logrado con éxito`, 2 `Closed-lost`) = **0,04%**. *(Caveat: el espejo trae casi solo leads abiertos; aun así el patrón "no se cierra / no se marca el cierre" es inequívoco.)*

### 2.4 Asesores (pregunta 3 — parcial)
- **1 usuario (`responsible_user_id` 9976747) posee 2.673 leads (99,9%)**, incluidos los 2.029 atascados. El otro usuario: 2 leads.
- **Tiempo de respuesta por asesor = GAP**: el espejo no trae timestamps de mensajes. Requiere la API de eventos de Kommo o el módulo `conversaciones` (SDD-0056). No medible desde el espejo hoy.

### 2.5 Email y atribución (preguntas 4 — clave para la estrategia)
- **Email: 149 de 2.700 contactos (5,5%)**. Teléfono: 1.448 (54%).
- **Atribución vacía:** solo 30/2.675 leads tienen algún custom field poblado; los campos UTM/fbclid/gclid existen en el catálogo pero **sin datos** → no se puede saber el canal/fuente de origen. *(Gap de captación, no de consulta.)*

### 2.6 Lectura (pregunta 5 — metodología de mayor impacto)
Los datos confirman la **3D**: (1) **Depurar** — el 86% del cuello está muerto, hay que limpiarlo; (2) **Dirigir** — sin SLA los leads mueren a los ~11 meses; (3) **Decidir** — sin valor ($0) ni cierres (0,04%) no hay forma de priorizar. Y agregan dos prioridades nuevas no obvias en el documento: **capturar email** (5,5% es el techo actual de reactivación) y **repartir la cartera** (99,9% en una cuenta es insostenible).

---

## 3. Diagnóstico del estado actual (cualitativo)

- **Embudos:** leads apilados en etapa 1-2; "Tomar decisión"/won prácticamente vacíos.
- **Conversaciones:** ~3.018 en el Inbox (2.920 abiertas, 98 cerradas); 485 "sin respuesta" (~16% de las abiertas); de 401 analizadas, **42% es cortesía/ruido** (auto-cerrable), 10% cotización (alta prioridad), 6% servicio específico.
- **Bots (10 Salesbots):** núcleo OK (Bienvenida, Asignar asesor, Solicitud de datos, Carga marítima [mín 0,20 CBM; tarifa especial ≥5 CBM], etc.). **Rotos: Cursos** (primer mensaje vacío) y **NPS** (0 lanzamientos: el trigger "Conversación cerrada" nunca dispara + "Error al enviar" en el bloque 1-10). **Fuga ~25%** en el saludo de Bienvenida (menú largo).
- **Integración:** inbound-only; el CRM no refleja el ERP.

---

## 4. Fallas y mejoras priorizadas

| # | Falla | Impacto | Mejora | Prioridad |
|---|---|---|---|---|
| F1 | 2.029 leads muertos en "Atención al cliente" | Embudo tapado, métricas falsas | Depurar (limpieza masiva supervisada) + auto-cierre de ruido | **Alta** |
| F2 | Leads en $0 | Pipeline inmedible | Value-sync `estimado.total_usd` → `kommo_leads.price` (Slice B) | **Alta** |
| F3 | Solo 5,5% con email | No hay canal de reactivación sin restricción | Captura de email (AI Agent/Flow) + Sign-in-with-Google + dedup/opt-in (Slice D) | **Alta** |
| F4 | 99,9% de leads en 1 usuario | 1 persona no da seguimiento | Reparto real / Round Robin efectivo (config Kommo) | **Alta** |
| F5 | Conversión 0,04% / sin SLA | No se cierra | Dirigir: SLA + recordatorio >24h + 2 intentos → perdido | **Alta** |
| F6 | Bots Cursos/NPS rotos | Sin encuesta/satisfacción; primer contacto roto | Reparar en Kommo (runbook) | Media |
| F7 | Sin atribución (UTM vacío) | No se sabe qué canal funciona | Capturar UTM/fbclid en el alta (Kommo + web) | Media |
| F8 | Fuga ~25% en saludo | Pérdida en el primer toque | Menú más corto en Bienvenida | Media |
| F9 | Integración inbound-only | CRM no refleja el ERP | Write-back foundation (Slice A) | Media (habilita F2/F5) |

---

## 5. Metodología 3D y su mapa a herramientas

**Depurar → Dirigir → Decidir** es la rutina semanal simple (no más bots). Cada movimiento se ejecuta con una herramienta concreta:

| Movimiento 3D | Qué hace | Herramienta |
|---|---|---|
| **Depurar** (caliente/tibio/frío; cerrar 42% ruido) | Clasificar y sacar el ruido | **Kommo AI Agent** (clasifica/taggea/mueve/escala en vivo) + regla de Kommo para auto-cerrar cortesías |
| **Dirigir** (SLA; nadie quieto >X días; 2 intentos → perdido) | Mover el embudo | **Reglas de Kommo (Digital Pipeline)** time-in-stage → tarea/recordatorio; + señal del ERP "lead sin estimado tras X días" → mueve etapa vía **write-back (Slice A)** |
| **Decidir** (valor real; revisión semanal) | Que el pipeline muestre dinero | **Value-sync (Slice B)** `total_usd` → `kommo_leads.price`; tablero en `/studio/kommo` |

**Criterios de éxito 3D:** ningún lead >X días en una etapa sin acción; ruido auto-cerrado <24h; todo lead que avanza con valor asignado; revisión semanal de "Atención al cliente" a cero pendientes nuevos.

---

## 6. Reactivación WhatsApp + captura de email (investigación verificada)

Investigación con verificación adversarial contra documentación oficial de Meta (junio 2026). **Marca:** [verificado] = confirmado por docs oficiales.

### 6.1 La verdad sobre la ventana de 24h
- Solo **un mensaje del CLIENTE** reinicia la ventana de servicio; un mensaje del negocio **no la extiende**. "Escribir antes de las 24h para mantener vivo el chat 2-3 días" **NO funciona**, y mandar relleno viola la Messaging Policy (reportes → baja calidad → riesgo de ban). [verificado]
- La única ventana larga gratis es el **Free Entry Point de 72h**, que solo se abre vía **anuncios Click-to-WhatsApp** (CTWA). [verificado]

### 6.2 Dentro vs fuera de la ventana
- **Dentro:** texto libre, media, botones, listas, Flows — gratis. Plantillas UTILITY gratis.
- **Fuera:** solo **plantillas pre-aprobadas**. Reactivar un dormido = categoría **MARKETING** (aunque haya mostrado interés antes) → requiere **opt-in explícito de marketing** (tener el teléfono ≠ opt-in) + se **cobra por mensaje** (per-message desde 1-jul-2025). [verificado]
- Venezuela (bucket "Rest of LatAm"): marketing ≈ USD 0,074–0,085/mensaje *[estimado, no oficial]* → ~USD 150-170 para 2.000 leads + markup del BSP.

### 6.3 Riesgo de reactivar en masa
Un blast a ~2.000 dormidos es **alto riesgo de ban**, y por el límite de **Business Portfolio** (oct-2025) **contamina al número CRM primario** (+58 412 166 8021). Mitigación: no blast; empujar al cliente a re-escribir (quick-reply/CTWA); warm-up gradual; segmentar; número separado; opt-out en cada plantilla; monitorear quality rating. [verificado]

### 6.4 El email es el canal correcto para los que se fueron
El email **no tiene ventana de 24h ni tier ni riesgo de ban**. WhatsApp captura el email y conversa en vivo; el email sostiene la reactivación. **Pero hoy solo 5,5% tiene email** (§2.5) → capturar email es la prioridad. Captura correcta: **Kommo AI Agent / Salesbot** (setea custom field) o **WhatsApp Flow** (formulario in-chat, valida formato, resetea ventana) o **Sign-in-with-Google** en el alta web. [verificado]

### 6.5 Playbook (reemplaza la idea original)
Dentro de la ventana → cerrar cada mensaje con **quick-reply** ("Cotizar"/"Estado"/"Asesor") → cada toque resetea 24h gratis → tras 1-2 intentos sin respuesta, parar → plantilla MARKETING con opt-in → si nada, **abandonado** → reactivar por **email**.

---

## 7. IAs nativas de Kommo y reparto IA-Kommo vs IA-ERP

Kommo tiene 3 IAs: **AI Agent** (add-on pago, trial 14d; framework "When→Do" con 8 acciones: responde, pide info, **setea campos**, **mueve etapa**, taggea, **lanza Salesbot**, **escala**; multilingüe español ✓, 3-8s) · **AI Suggestions** (plan Pro; sugiere respuestas al asesor) · **AI Summary + Rewriter** (desde Base). Es "IA en vez de bots" nativo.

**Reparto híbrido (decidido):**

| Tarea | Mejor en | Por qué |
|---|---|---|
| Triage conversacional, captura email, SLA-nudge, responder FAQ | **Kommo AI Agent** | Vive donde está la conversación de WhatsApp; toma acciones en vivo |
| Valor ($0)/write-back, email marketing-reactivación, dedup/identidad, scoring con histórico, diagnóstico | **ERP (SDD-0020/0026)** | Necesita datos verdad del ERP; Kommo no hace email marketing |

**IA vs bots (cuándo cada uno):** **IA** para lo conversacional ambiguo (clasificar intención, responder en lenguaje natural, resumir) y para scoring con datos. **Bot/regla** para lo determinista (ruteo Round Robin, time-in-stage, plantilla CBM, auto-cierre por keyword). No se agregan bots nuevos de calificación: eso lo hace la IA.

**Cautelas:** el AI Agent es **costo recurrente** y **beta/maduración** → evaluar en el trial; **no poner dependencia dura sin fallback**. Gaps: ¿API para leer salidas?, ¿con qué LLM corre (privacidad)?, costo con N asesores.

---

## 8. Configuración en Kommo (operada vía Chrome) — matriz de impacto + protocolo

Las reconfiguraciones del embudo/bots se hacen en la UI de Kommo (no son código del repo); las opera Claude con la extensión de Chrome, con el founder logueado y supervisando. Runbook detallado: `docs/runbooks/kommo-reconfig.md` *(a crear en la fase operativa)*.

| Operación | Qué se rompe | ¿Reversible? | Regla segura |
|---|---|---|---|
| Borrar **etapa** | Leads se reubican; automations Digital Pipeline ligadas desaparecen; Salesbots por "entra a etapa X" quedan huérfanos | Config no; leads se mueven | Mover leads antes; **Closed-Won/Lost NO se borran (solo renombrar)** |
| Borrar/editar **Salesbot** | Referencias desde Digital Pipeline/botones rotas; 1 bot por conversación | No | Desconectar triggers; **para editar hay que reactivar** (desactivado = solo lectura) |
| Reparar **NPS/Cursos** | NPS dispara "al cerrar" → si se cierran 2.029 → **blast** | — | Trigger acotado; el bulk-close no debe disparar NPS a leads viejos |
| **Bulk** mover/cerrar | Entrar a etapa destino **dispara sus automations** → posible mensajería masiva (riesgo de ban) | Parcial | **Desactivar automations que envían mensajes ANTES del bulk**; por lotes |
| Crear automation nueva | **NO** afecta leads ya presentes salvo tildar *"Apply to all leads already in this stage"* | Sí | Default seguro para el backlog |
| Borrar **custom field** | **Borra TODA su data**; bots/plantillas que lo usan se rompen | **No** | Exportar antes; nunca borrar EMAIL |

**Protocolo seguro:** (1) snapshot read-only del estado actual → (2) export/backup CSV de leads afectados → (3) desactivar automations que mandan mensajes (anti-blast) → (4) probar en 1 elemento → (5) bulk del backlog por lotes → (6) re-activar saneado + registrar en runbook.

---

## 9. Requisitos de la integración CRM↔ERP (Slices A–D)

### Slice A — Fundación de write-back (en *dry-run*, riesgo cero)
Toda escritura a Kommo nace apagada (`writeback_enabled=false`, `writeback_dry_run=true`): en PROD solo registra el PATCH que haría.
- **Migr `0114_kommo_writeback_outbox.sql`** (clona `0071_operario_push_subscriptions.sql`): tabla `kommo_writeback_outbox` (`op` in `patch_price|patch_stage|patch_lead`, payload jsonb, `idempotency_key` unique parcial, dedup_tag, status, attempts, `kommo_updated_at_at_enqueue`) + columnas `kommo_connections.writeback_enabled/writeback_dry_run` + RLS estilo 0071 + RPCs `enqueue/mark_sent/bump_attempt/mark_skipped`.
- **`kommo-sync/kommo-client.ts`** + `kommoWrite(baseUrl,token,path,method,body)` reusando la escalera retry/backoff/rate-limit de `kommoFetch` (sin tocarla).
- **`supabase/functions/kommo-writeback/index.ts`** (clon de `kommo-sync/index.ts`): drena el outbox; dry-run → loguea + `skipped`; real → PATCH `/api/v4/leads/{id}` → `sent`.
- **`lib/studio/kommo/kommo-writeback-outbox.ts`** (enqueue/drain) + **cron** `app/api/cron/kommo-writeback-drain/route.ts`.
- **Guardrail 0107:** la edge function nunca escribe el espejo; ERP → PATCH Kommo → webhook → upsert con el `updated_at` autoritativo de Kommo.

### Slice B — Value sync (arregla el $0)
Col `quotes.kommo_lead_id` (migr `0115`, espeja `0108`) + hook en `transitionStatus()` (`app/studio/(app)/cotizador/actions.ts`, al lado de `fireMailEvent`): a `sent`/`accepted` con `kommo_lead_id`≠null → `enqueueKommoWriteback(patch_price {price: total_usd})` + `patch_stage`. Hereda el gate dry-run de A.

### Slice C — Scoring + diagnóstico con datos del ERP (encogido por el reparto híbrido)
El triage conversacional lo hace el Kommo AI Agent. El ERP NO reconstruye el clasificador: (a) consume los tags/etapas del AI Agent (vía espejo) para reportes/segmentos; (b) scoring/diagnóstico con datos verdad del ERP (histórico envíos, valor, recurrencia) — versión productizada de la Fase 0, sobre `lib/studio/agents` (SDD-0020).

### Slice D — Captura de email + opt-in + reactivación por email (arranca primero)
El puente Kommo→`clients.email`→Resend ya existe (`parseContactFields` + SDD-0026). Falta:
- **Migr `0117`:** opt-in trazable en `clients` (`email_marketing_optin_at`, `email_optin_source`, `whatsapp_marketing_optin_at`) + dedup/email canónico al sincronizar (varios emails por contacto → 1, validar formato; ata con SDD-0046).
- **Evento de mailing** `lead_dormant_reengagement` (SDD-0026) + segmento "dormido con email + opt-in" → campaña de reactivación **por Resend** (no por WhatsApp).
- **Kommo (runbook):** WhatsApp Flow de captura de email (opt-in de email separado del de WhatsApp) + quick-reply en Salesbot. **Bloqueante: confirmar que Kommo usa API oficial Cloud, no WhatsApp Lite.**
- **Idea a evaluar — "Registrarse con Google":** Sign in with Google (OAuth de identidad, solo email+nombre, NO acceso a la bandeja) en `/portal`/`/registro`. **Supabase Auth lo soporta nativo** (proveedor junto al magic-link de SDD-0042; setup = app Google Cloud + redirect `/portal/callback`). Captura Gmail verificado en el alta → resuelve el 5,5% en la raíz. El opt-in de marketing sigue siendo casilla aparte.

> Reparar bots, reestructurar etapas, auto-cierre de cortesías, etapa ">24h" y reparto Round Robin viven **dentro de Kommo** (§8) — no son código del repo.

---

## 10. Plan por fases + métricas de éxito

**Fases:**
0. **Diagnóstico real** (hecho, §2).
1. **Informe** (este spec + HTML ejecutivo).
2. **Slice D** (captura email + opt-in + reactivación) por el harness `/feature`.
3. **Config Kommo** (vía Chrome, supervisada): reparar NPS/Cursos, reparto Round Robin, etapa ">24h", auto-cierre ruido, evaluar AI Agent (trial).
4. **Slice A** (write-back dry-run) → **Slice B** (value-sync, apaga el $0) → **Slice C** (scoring ERP).
5. **Reactivación**: capturar emails (Flow/Google) → campaña Resend a dormidos con email.

**Métricas de éxito:**
- % leads con valor > 0 (hoy **0%** → objetivo >80% de los activos).
- Leads en "Atención al cliente" >30 días sin acción (hoy **96%** → <10%).
- % contactos con email (hoy **5,5%** → objetivo >40% en 6 meses).
- Conversión registrada (hoy **0,04%** → medible y creciente).
- Reparto de cartera (hoy **99,9% en 1 usuario** → distribuido).
- Tiempo de respuesta < SLA (24h) — medible cuando se cierre el gap de §2.4.

---

## 11. Preguntas abiertas vs cerradas

**Cerradas:** mantener Kommo · híbrido · IA sobre bots · write-back · 3D · arrancar por Slice D · reparto IA-Kommo/IA-ERP.

**Abiertas (para el founder):**
1. ¿Kommo usa **API oficial Cloud o WhatsApp Lite**? (bloqueante para Flows/plantillas/broadcasts).
2. Valor del lead: ¿`total_usd` del estimado o estimación temprana del asesor?
3. SLA objetivo (24h) y días para auto-cerrar cortesías.
4. ¿El token de Kommo en Vault tiene **scope de escritura**? (un 401 de `kommoWrite` lo revela).
5. Mapa etapa-Kommo ⇄ estado-estimado (para `patch_stage`).
6. ¿Hay **opt-in de marketing** registrado para los dormidos, o solo teléfono?
7. ¿DTD corre/puede correr **anuncios Click-to-WhatsApp** (única vía al FEP de 72h)?
8. Número separado para reactivación (no contaminar el CRM primario).
9. ¿Adoptar el **Sign-in-with-Google** en el portal? (acelera el 5,5%).

---

## 12. Prácticas recomendadas (referencias web)

- **Embudos Kommo / etapas:** empezar con 4-6 etapas que reflejen la conversación real, no un embudo idealizado. (kommo.com/support/crm/pipelines/)
- **Freight/logística CRM:** el CRM debe conectarse al quoting y a los hitos operativos o se vuelve una base muerta; la adopción mejora cuando actualizar el CRM es subproducto de trabajar (gofreight.com, velocityos.ai).
- **WhatsApp SLA / no-respuesta:** inbox compartido con SLA; follow-up automático; re-engagement personalizado (infobip.com, respond.io).
- **Higiene de pipeline:** marcar deals sin próximo paso / sin actividad / sin dueño; limpieza trimestral + chequeos automáticos; meta >95% completitud, <2% duplicados (geckoboard.com, prospeo.io).
- **AI agents vs bots:** los bots de reglas se rompen ante lo inesperado; los AI agents adaptan, razonan y actúan; equipos con AI agents reportan +25-30% conversión (salesforce.com, qualified.com, McKinsey "State of AI" 2025).
- **WhatsApp Business Platform (oficial Meta):** ventana de 24h, pricing per-message (1-jul-2025), categorías de plantilla, Flows, messaging limits (developers.facebook.com).
- **Kommo AI:** AI Agent "When→Do", suggested replies, summary (kommo.com/blog/kommo-ai, kommo.com/support/crm/kommo-ai-agent/).

---

## Adjuntos
- Dashboard ejecutivo navegable: `docs/specs/0062-crm-erp-cierres-automaticos/assets/informe-ejecutivo.html`.
- Runbook de reconfiguración de Kommo (fase operativa): `docs/runbooks/kommo-reconfig.md` *(pendiente)*.
- Fuentes del diagnóstico original: `Paquete-ClaudeCot-DTDCargo-v2.md`, `Analisis-DTDCargo-CRM-Kommo-v3.html` (Downloads del founder).
