# 📋 CONTEXTO COMPLETO · Oficina de Agentes de DTD Cargo

Documento maestro · v1.0 · 12/11/2026 · Propietario: Sam (Junta)

Este documento consolida TODO el proyecto para que cualquier IA pueda
continuarlo desde cero. Único dueño y aprobador humano: Sam.

## 1 · El proyecto en una frase

Construir una oficina de 35 agentes IA coordinados por un Router,
nativa del Studio ERP, siempre activa por eventos, con candados
humanos, auditoría innegable y fallback de modelos — donde Sam solo
decide lo que importa.

## 2 · El negocio

DTD Cargo: puerta a puerta China→Venezuela (Yiwu–Valencia, equipo propio).
Meta vigente: pasar de 1 a 2 contenedores/mes, sostenido.
CRM: Chatwoot (migración desde Kommo, cierre 13/11). Canal: Discord.
Repo: github.com/SoftAgentes/DTDCARGO (Studio ERP con Supabase, SGE v8.0).

## 3 · Estado real

| Pieza | Estado |
|---|---|
| Diseño completo (arquitectura, nómina, fallback, gobernanza) | ✅ Aprobado por Sam (12/11) |
| Prototipo visual V3 | ✅ trabajo/oficina-dtd.html |
| Organigrama 35 interactivo | ✅ trabajo/organigrama-35.html |
| Gobernanza SGE v8.0 + SGE-AG-01 v0.2 | ✅ Aprobada en contenido (este cambio) |
| SDD-0626 «oficina-runtime» | ⏳ Por redactar |
| Construcción (tablas, despachador, eventos) | ⬜ Nada construido |

## 4 · Arquitectura — 6 piezas

1. **Datos:** office_tasks, task_events (solo-agregar), agent_approvals
   (SDD-0021), agents (SkillDef SDD-0020), agent_runs (costo+replay),
   decisions, event_inbox, attention_feed, activation_thresholds.
2. **Eventos:** webhooks (Chatwoot, pagos) + cron (brief 07:00, síntesis
   17:00) + cambios de estado del ERP → una bandeja → filtro 2 niveles
   (reglas baratas → modelo semántico). Dedupe 30 min, prioridad
   dinero>cliente>interno, cuota 20/h. 6 disparadores: pago, pre-alerta,
   contenedor en puerto, reclamo Chatwoot, run fallido, presupuesto al 80%.
3. **Despachador (Router):** toma listo → asigna por skill → respeta
   espera:<id> y modo solo/equipo → verifica eval.md → escala L0/L1.
   Jamás ejecuta. Frenos: cooldown 10s, 1 corrida por agente, 60 turnos,
   timeout 1200s. Vigía monitorea al Router cada 10 min; brief 07:00 con
   reglas fijas sin Router; estado en BD. Kill switch office_paused.
4. **Ejecución (workers):** corridas aisladas, mínimo privilegio, presupuesto
   por corrida, SkillDef con cadena de modelos y fallback.
5. **Candados humanos:** L0 auto / L1 Sam (dinero, tarifas, publicar,
   irreversible) con contexto y ⭐. La decisión SIEMPRE en decisions.
6. **Vistas:** el prototipo V3 es la especificación visual.

## 5 · Nómina — 35 puestos

- Dirección: gerente-general (Router) · coordinador-procesos · analista-datos ⭐
- Operaciones: jefe + recepcion-yiwu · compras-inspeccion · consolidacion-embarque · tracking-entregas ⚡ · documental-aduana ⭐
- Comercial: jefe + cotizador-tarifas · asesor-cuentas
- Marketing: jefe + redactor · editor-fotografia · editor-video · crecimiento-analitica · curador-noticias ⭐
- At. Cliente: jefe + soporte-chatwoot ⚡ · soporte-portal · experiencia-encuestas
- Finanzas: jefe + cobranzas · cuentas-pagar · contabilidad-reportes
- Tecnología: jefe + portal-web · integraciones · vigilante · vigia-mejoras ⭐
- Cumplimiento: jefe + auditor-entregas · guardian-reglas · riesgo-aduana

⭐ aprobados 12/11 · ⚡ especulan. Presupuesto ~$1.280/mes con auto-pausa.
Activación por umbrales de negocio.

## 6 · Modelos y fallback

Motor por ROL: GLM 5.3 mayoría · Claude redacción · Codex revisión. Piso
obligatorio glm-5.3 (plan fijo Z.AI).
El error decide: 401/402/403 salta proveedor (caído 24h) · 429/503
reintenta ×2 y salta · timeout salta · corrupta ×2 salta. Todo en
task_events.
Cortacircuitos: 3 fallos/10min = 1h fuera + aviso. Sonda de suscripción
2×día. Modo degradado de dos vías (interno degrada; clientes esperan).
Toda la cadena caída → vuelve a listo, Vigía reintenta cada 10 min.
El presupuesto manda.

## 7 · Skills

Nativas (SkillDef): lo del negocio (tarifas, procesos, voz, eval.md,
guiones). Piloto: 5 fichas de Marketing primero.
Catálogo solo lo genérico: web, documentos, hojas de cálculo, canales.

## 8 · Gobernanza

SGE v8.0 (tiers L0–L3, delegación, índice generado, archivo >90 días, KPIs,
actas consolidadas) + SGE-AG-01 v0.2 (L0/L1, presupuestos, identidad,
prohibiciones, anti-inyección, kill switch, auditoría+replay, AI-SBOM, red
teaming, incidentes, madurez N1–N4). Políticas UI "no aplica a agentes".

## 9 · Fase 1 — El Cable Vertical (7 días)

Una conversación real de Chatwoot atendida de principio a fin por
soporte-chatwoot sin la mano de Sam, visible en la V3.

1. Hermes redacta la SDD-0626 → 2. Rama+PR en el repo → 3. Director
construye el cable (3 tablas + webhook + corrida glm-5.3) → 4. Prueba
interna, luego real → 5. Revisión conjunta.

Límites: 1 agente, glm-5.3, tope $10–15/semana, acceso nivel 2, kill switch
activo. Luego: Fase A/B (tablas+despachador+6 eventos), Fase C (vistas),
Fase D (piloto Marketing), Semana 7 (encendido + Vigía).

## 10 · Chatwoot — qué necesita la oficina

1. Webhooks de conversación → bandeja. 2. API de mensajes (token de agente).
3. Etiquetas («reclamo», «cotización») → filtro barato. 4. Inbox de prueba
separado. 5. Token mínimo privilegio en el gestor de secretos.

## 11 · Decisiones clave

1. 05/11 (SDD-0605): etapa interina 13 agentes + Discord — no ejecutada, opcional.
2. 12/11: oficina nativa del ERP, sin orquestador externo.
3. 12/11: roster 31→35. 4. 12/11: jefe-gabinete → coordinador-procesos.
5. 12/11: CRM Chatwoot; soporte-chatwoot. 6. 12/11: fallback en cadena, piso glm-5.3.
7. 12/11: capa agentiva (kill switch, AI-SBOM, red teaming, incidentes).
8. 12/11: gobernanza v8.0 + SGE-AG-01 v0.2. 9. 12/11: sin n8n por ahora.
10. 12/11: sin ISO 42001 completo por ahora.

## 12 · Entregables

trabajo/oficina-dtd.html (V3) · trabajo/organigrama-35.html ·
trabajo/contexto-oficina.md · gobernanza (este cambio) · SDD-0626 (próxima).

## 13 · Convenciones de nombres

gerente-general · coordinador-procesos · analista-datos · jefes
jefe-<area> · estados borrador → listo → en-ejecución → auditoría → aprobación → terminada · niveles L0/L1 · office_paused = kill switch.

## 14 · Fuentes

Repo DTD (SDD-0020/0021, SGE, BRAND.md) · DeepSeek superagente · Anthropic
building-effective-agents · OrgAgent · CrewAI · MetaGPT · Paperclip (MIT,
ideas) · OWASP Top 10 Agentic 2026 · CSA MAESTRO · NIST · ISO 42001 · EU AI
Act · NN/g affordances · Smallville/AI Town.

## 15 · Próximos pasos

1. SDD-0626 «oficina-runtime» (con SGE-AG-01 v0.2 integrada).
2. Commit de este cambio de gobernanza (rama aparte).
3. PR de la SDD-0626 → Director construye el cable.
4. Prueba real → Fase 1 terminada → Fases A–D → encendido.
