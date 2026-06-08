---
title: "Runbook — Reconfiguración de Kommo (CRM) para SDD-0062"
updated: 2026-06-07
confidencialidad: interno
related: ["0062","0043","0058"]
review-by: 2026-09-07
---

# Runbook — Reconfiguración de Kommo (CRM)

> Operación supervisada de la cuenta `doortudoor.kommo.com` (DTD CARGO / DoorTuDoor C.A) para SDD-0062. Se opera vía la extensión de Chrome con el founder logueado y confirmando cada acción destructiva. **Read-only primero; nada destructivo sin OK explícito.**

## Snapshot del estado (en vivo, 2026-06-07 · read-only)

| Área | Estado real | Implicación |
|---|---|---|
| **Canal principal** | WhatsApp **8021 = API oficial** (fuente "WhatsApp API 8021") | Flows / plantillas / broadcasts / AI Agent **disponibles** en el número comercial |
| **Fuentes caídas** | 1 fuente WhatsApp en **"Error de conexión"** ("Door tu door Importad…") + **WeChat desconectado** | Posible pérdida de leads entrantes → reconectar (founder, credenciales) |
| **Otros canales** | Instagram (Whu Dragon Chino) + Facebook/Messenger conectados | El AI Agent hoy vive en Instagram |
| **AI Agent** | "DTD Cargo asistente de ventas" (#326244) **activo solo en Instagram** | Gap: NO cubre el WhatsApp del grueso de leads → lever #1 = extenderlo a WhatsApp 8021 |
| **3 IAs de Kommo** | **Kommo Copilot** [Beta] ON · **Respuesta sugerida** [Beta] ON · **Sugerencias de tareas** ON | Las sugeridas dependen de Fuentes de conocimiento |
| **Fuentes de conocimiento** | Ya cargadas: DOCX de **20 subsecciones** + 3 textos (Datos clave / Productos y servicios / Descripción del negocio) + 1 URL (home). **VECES USADAS = 0 en todas** | El conocimiento existe pero **nunca se usó** → el cuello es el **wiring** de la IA al flujo, no el contenido |
| **Dedup** | Control de duplicados **ON** | Bien |
| **Anti-blast** | Etapa "Atención al cliente" **sin automatizaciones de etapa**; el único automatismo del embudo está en "Leads entrantes" (Salesbot Asignar asesor + Activar AI Agent) | Bulk move/close de los 2.029 **no dispara mensajería** (re-verificar antes de cada bulk) |
| **Usuarios** | Solo **2 (ambos Administrador)**: DTD CARGO (dueño de 2.673 leads) + Sergio Quevedo Bermudez (2 leads) | **Reparto bloqueado** sin crear cuentas de asesores (decisión de negocio + costo/usuario) |
| **Embudo principal** | Etapas: Leads entrantes → Atención al cliente → Asesoría personalizada → Closed-Won/Lost | — |

### Hallazgo central
El conocimiento y la IA **ya existen** pero **no están enchufados al canal del grueso (WhatsApp 8021)** → por eso 0 cierres, 0 usos de la IA. El mayor leverage no es cargar más cosas, es **wiring** (extender el AI Agent a WhatsApp) + **Depurar** el cementerio + **reparto** (requiere asesores).

## Matriz de impacto (qué se rompe si borro/cambio)

| Operación | Qué se rompe | ¿Reversible? | Regla segura |
|---|---|---|---|
| Borrar **etapa** | Leads se reubican; automations del Digital Pipeline de esa etapa desaparecen; Salesbots por "entra a etapa X" quedan huérfanos | Config no; leads se mueven | Mover leads antes; **Closed-Won/Lost NO se borran (solo renombrar)** |
| Borrar/editar **Salesbot** | Referencias desde Digital Pipeline/botones rotas; 1 bot por conversación | No | Desconectar triggers; para editar hay que **reactivar** (desactivado = solo lectura) |
| Reparar **NPS/Cursos** | NPS dispara "al cerrar" → si se cierran 2.029 → blast | — | Trigger acotado; el bulk-close no debe disparar NPS a leads viejos |
| **Bulk** mover/cerrar | Entrar a etapa destino dispara sus automations → posible mensajería masiva (riesgo de ban) | Parcial | **Desactivar automations que envían mensajes ANTES del bulk**; por lotes |
| Crear automation | NO afecta leads ya presentes salvo tildar *"Apply to all leads already in this stage"* | Sí | Default seguro para el backlog |
| Borrar **custom field** | Borra TODA su data; bots/plantillas que lo usan se rompen | **No** | Exportar antes; nunca borrar EMAIL |

## Protocolo seguro
1. Snapshot read-only del estado actual (este documento) **antes de tocar**.
2. Backup: el **espejo en Supabase ya tiene los 2.675 leads** (SDD-0043); para historial de chat, exportar de Kommo si hace falta.
3. **Desactivar** automations que envían mensajes en la etapa destino (anti-blast).
4. **Probar en 1** elemento antes de masivo.
5. Bulk del backlog por **lotes**, confirmando con el founder.
6. Re-activar saneado + registrar en la bitácora.

## Bitácora de cambios
| Fecha | Acción | Por |
|---|---|---|
| 2026-06-07 | Snapshot read-only completo (sin cambios) | Claude (Chrome) |
| 2026-06-07 | **Añadida Fuente de conocimiento URL `https://dtdcargo.com`** (con subpáginas) → procesando crawl (~2h). Reversible (se puede borrar) | Claude (Chrome), OK founder |

## Acciones pendientes
**Founder (credenciales / negocio):**
- Reconectar la fuente WhatsApp en "Error de conexión" (+ WeChat si se usa).
- Crear **cuentas de asesores** en Gestión de usuarios para habilitar el reparto.
- Decidir si se prende/paga el AI Agent como add-on de forma estable.

**Claude (con OK, vía Chrome):**
- **Extender el AI Agent al WhatsApp 8021** (hoy solo Instagram) — lever #1 (alto impacto: la IA respondería a clientes reales → probar antes).
- **Depurar** dormidos >180 días (1.752) en lotes (anti-blast verificado). **REGLA DURA: Depurar = cerrar el LEAD como "Perdido" (Closed-Lost), un cambio de etapa — JAMÁS borrar el CONTACTO ni su teléfono/email.** Los contactos quedan intactos en la lista (≈1.448 teléfonos, 149 emails) + respaldados en el espejo Supabase. Antes de cerrar: **analizar y segmentar** (email vs solo-teléfono vs categoría) para campañas de **email** (Resend) y **SMS** (canal a evaluar: costo + opt-in + entrega VE). El cierre del lead NO afecta esos números.
- Afinar instrucciones del AI Agent para Depurar + pedir/guardar email.

## Borrador — instrucciones afinadas del AI Agent "DTD Cargo asistente de ventas"
> Aplicar **después** de que termine el crawl de `dtdcargo.com` (la IA usará ese conocimiento). El agente hoy corre solo en Instagram; el builder se abre desde Kommo (revisar juntos). Reemplazar/ajustar lo existente con esto:

**Rol y tono:** Eres el asistente de ventas de **DTD Cargo** (importación y logística China→Venezuela). Hablas en **español venezolano**, cercano y profesional, claro y **breve** (respuestas cortas, una idea por mensaje, sin muros de texto). Respondes en el idioma del cliente. Usas la base de conocimiento (dtdcargo.com) para datos de servicios, tarifas y procesos.

**Prioridad de negocio (founder):** el objetivo #1 es ganar y retener **clientes frecuentes y de alto volumen (CBM)**. En cada interacción: captura el **volumen/CBM**, captura el **email** (guárdalo en el campo Email + tag opt-in), e **incentiva el registro** (`dtdcargo.com/registro`) porque ahí nace el cliente frecuente (historial + recompra + mejores condiciones). Cada respuesta cierra con un **próximo paso concreto** (registrar / calcular en la calculadora / dejar correo), no con un "¿en qué te ayudo?" genérico.

**Qué haces (When → Do):**
- **Saludo/consulta general** → responder con la base de conocimiento; ofrecer los 4 servicios: consolidación, puerta a puerta DDP (Financiamiento 100%), reserva FCL, transporte terrestre.
- **Piden precio/cotización** → pedir CBM o medidas/peso + origen y destino; explicar la regla marítima (**mín. 0,20 CBM; tarifa especial desde 5 CBM**); orientar a la calculadora; mover el lead a la etapa de cotización/asesoría.
- **Capturar email (prioridad · acción GLOBAL)** → cada vez que el cliente dé su correo (en CUALQUIER pregunta), **guardarlo en el campo Email del CONTACTO** + tag `email_optin`, **asociado a su número de cliente (Markbox)** si ya está registrado (vincular al contacto existente, no duplicar). Es UNA sola acción del agente que cubre todos los "déjame tu correo". (Habilita la reactivación por email — Slice D.)
- **Estado de envío** → si dan código de tracking, orientar a dtdcargo.com/track.
- **Ruido/cortesía/spam** → responder cordial y breve; taggear `ruido` (apoya el Depurar).
- **Escalar a humano** (acción "transferir") si: pago/cobranza, reclamo, caso complejo, o si el cliente lo pide.

**Qué NO haces:** no inventar precios fuera de la regla; no prometer tiempos exactos de tránsito; no pedir cédula/datos financieros por chat; no dar asesoría legal/financiera; no cerrar ventas tú solo (escalas).

**Contactos oficiales:** WhatsApp CRM **+58 412 166 8021** (primario) · Fijo Valencia **+58 241 414 7886** (secundario).

### Bitácora (cont.)
| 2026-06-07 | Revisión del AI Agent: confirmado "DTD Cargo asistente de ventas" activo **solo en Instagram**; builder no editado (esperar fin del crawl + revisar juntos). Borrador de instrucciones preparado ↑ | Claude (Chrome) |

---

## 🔖 Punto de retoma — FAQ de la IA de Kommo (sesión 4281fb30 · 2026-06-07)

**Qué es:** reestructuración del *knowledge base* del AI Agent de Kommo (lo que responde la IA).
- **Archivo de trabajo:** [`../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`](../specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md)
- **Origen:** `DTDCARGO_Kommo_KnowledgeSource (1).docx` (descargado de Kommo el 2026-06-07 16:29, en `Downloads/`).
- **Destino final:** convertir el `.md` aprobado → DOCX → re-subir a Kommo como Fuente de conocimiento (reemplaza el de 20 secciones).

**Formato de revisión (sección por sección):**
1. **Pregunta(s)** que hace el cliente.
2. **Respuesta actual** (la que dice hoy en Kommo).
3. **Respuesta sugerida** (nueva).
4. **El porqué** de la sugerida.
→ El founder **aprueba o ajusta**, y se pasa a la siguiente.

**Estado: ✅ FAQ 26/26 COMPLETO** (2026-06-08) — 21 base + **5 de cobertura ampliada** (#22 DDP/Financiamiento · #23 Aduana · #24 Cobertura entrega · #25 Qué importar · #26 Consolidado LCL), tras análisis de huecos vs sitio público + catálogo de servicios.
- **#7/#8 Validación/Verificación:** patrón captura-email + **link** de servicios de inspección con precios (página **stand by** → lo envía el asesor). Plantillas de reporte listas: **"Inspección de Producto (PSI)"** + **"Inspección de Fábrica (auditoría /100)"** (samples branded HTML en Downloads del founder).
- **#9 Compra asistida:** **el proveedor lo pone DTD (red propia)** → el bot no revela contacto. Modelo comercial (margen/comisión/cobro) **pendiente de definir**.
- **#10 Cursos:** "por ahora no hay, déjame tu correo" (lista de espera) → actualizar al lanzar.

**Siguiente paso:** convertir el `.md` → **DOCX** → re-subir a Kommo (reemplaza el knowledge source de 20 secciones) → afinar el AI Agent (auto-guardar email + tono) → extenderlo de Instagram al **WhatsApp 8021** (lever #1). Pendientes de negocio (no bloquean): **link/web de inspección** + **modelo de compra asistida**.
