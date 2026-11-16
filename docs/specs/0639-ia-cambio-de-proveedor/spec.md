---
sdd: "0639"
title: "IA: cambiar de modelo o de proveedor por función, con principal y respaldo"
status: proposed
author: "Claude (Worker pagos-de-ia)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0638", "0020", "0146", "0473", "0588", "0626", "0637"]
confidencialidad: interno
---

# SDD-0639 — Cambiar de modelo o de proveedor de IA

> Pregunta de Sam (2026-11-16): «si Anthropic se cae, los botones de noticias, el brief y Bitácora no
> funcionan. ¿Se puede cambiar desde el mismo menú?». Sí se puede, con trabajo previo. Esta spec
> propone un **motor común** con un **principal** y un **respaldo** por función, que se elige desde la
> pantalla «Estado de la IA» de la SDD-0638.
>
> **Estado: proposed.** Es un plan. Depende de la SDD-0638 (clasificador y registro) y se coordina con
> el fallback de la Oficina (SDD-0626 §7). Sam decide las D-1 a D-6 (§8).

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no
verificado. Base: `main` `4a3046745`. El repo es público: sin llaves, montos ni datos de cuentas.

## 1. Dos niveles de cambio

| Nivel | Qué es | Dificultad | ¿Salva una caída de Anthropic? |
|---|---|---|---|
| **1 · Modelo** | Otro modelo del mismo proveedor (por ejemplo, Sonnet → Haiku) | Baja: llevar el id del modelo a la configuración | No |
| **2 · Proveedor** | Otro proveedor (por ejemplo, Anthropic → GLM o DeepSeek) | Media o alta, según la función | Sí |

Hoy unas funciones leen el modelo de una variable (A3, A4 y A5 de la SDD-0638) y otras lo tienen
fijo en código: `claude-sonnet-4-6` en noticias (C `noticias-web/actions.ts:220`) y en el brief (C
`lib/news/ceo-brief.ts:53`). Las tarifas de Agentes también están fijas (C
`agents/runtime/llm-client-anthropic.ts:38-46`).

## 2. Lo que hace difícil el nivel 2

Cada función usa la librería de Anthropic directamente, y algunas usan capacidades que no todos los
proveedores tienen:

| Función (SDD-0638) | Capacidad que usa | Riesgo al cambiar | Ev. |
|---|---|---|---|
| A1 noticias, A2 brief | Texto libre | Bajo | C |
| A3 actas, A4 resúmenes | Herramienta forzada (`tool_choice`) para una respuesta con forma fija | Medio: el respaldo debe soportarla, o la función tiene que validar un JSON | C `bitacora/extract.ts:278` |
| A5 documentos | PDF como entrada, `countTokens` y `output_config` con `json_schema` | **Alto**: pocos proveedores leen PDF, y DeepSeek documenta un soporte limitado de `output_config` | C `document-import/anthropic.ts:41-50` |
| A6 Agentes | Bucle de herramientas y precios por modelo | Alto: hay que validar el bucle y recalcular las tarifas | C `llm-client-anthropic.ts:275` |
| A8 análisis Chatwoot | Ya usa GLM con una API compatible con OpenAI | Bajo | C `chatwoot/analisis-motor.ts` |

**Posible atajo (NV):** Z.AI y DeepSeek publican un endpoint compatible con la API de Anthropic
(documentación de cada proveedor, revisada por Codex el 2026-11-16). En ese caso, para las funciones de
texto libre el cambio sería casi solo de dirección, llave y modelo. Pero eso **no prueba** que funcionen
la herramienta forzada, el bucle de herramientas, el PDF ni el `json_schema`. Cada combinación de
función y proveedor se habilita solo después de pasar su prueba (§6).

## 3. Diseño mínimo

1. **Un motor común**, `lib/studio/ia/motor/`, con una interfaz pequeña: texto libre, respuesta con
   forma fija y, si la función lo necesita, documento. Hay un adaptador por proveedor. Las funciones le
   hablan al motor y no a la librería del proveedor.
2. **Un catálogo aprobado por función** (en código, revisado por PR): qué proveedores y modelos puede
   usar cada función. Lo que no está en el catálogo no se puede elegir en la pantalla.
3. **La elección por función** se guarda en una tabla `ia_motores` (tenant, función, principal,
   respaldo), que el admin cambia desde la pantalla de la SDD-0638. Las llaves siguen en variables de
   entorno; la tabla solo guarda nombres de proveedor y modelo.
4. **Primero, cambio manual.** El admin elige el principal y el respaldo y aprieta «Usar el respaldo».
   Queda en la auditoría quién lo cambió y cuándo.
5. **Después, y solo si Sam lo aprueba (D-3), cambio automático:** si el principal da `falta_de_pago`,
   `cuenta_suspendida` o `llave_invalida` (clasificador de la SDD-0638), esa llamada se reintenta con el
   respaldo y la pantalla lo muestra. No es una cadena larga: es un principal y un respaldo, igual que
   en Faro (SDD-0637 §6.5).
6. **Costos:** las tarifas pasan a una tabla o a la configuración por modelo, para que el tope de
   Agentes y el de Faro sigan sumando bien con otro proveedor.

**Coordinación con la Oficina:** la SDD-0626 §7 ya diseña una cadena con fallback del lado de Hermes.
Esta spec cubre solo las llamadas **directas** del ERP. Si la Oficina extrae su política de fallos a un
módulo común, este motor la adopta y no mantiene otra (la misma regla que aceptó el DG para Faro).

## 4. Privacidad: el cambio de proveedor mueve datos

Z.AI y DeepSeek son proveedores chinos. Cambiar a ellos una función que manda **conversaciones de
clientes** (A4) o **documentos de clientes** (A5) significa transferir esos datos a China.

- Antes de habilitar a un proveedor para una función con datos de clientes, se pasa por
  `.claude/skills/revisar-datos-ve/SKILL.md` (Venezuela y PIPL). Si esas normas aplican es una
  cuestión jurídica que queda pendiente.
- El catálogo de §3 marca cada función como **interna** (A1, A2, A3, A6, A8) o **con datos de
  clientes** (A4, A5). Para estas últimas, Sam aprueba cada destino por separado (D-2).
- Retención: se usa la política de no conservar del proveedor donde exista, y queda escrita por
  proveedor en el catálogo.

## 5. Fases

| Fase | Qué entrega | Necesita |
|---|---|---|
| **1 · Nivel 1** | Los ids de modelo de A1, A2 y A6 pasan a la configuración, sin literales en el código | Nada |
| **2 · Motor** | Interfaz y adaptador de Anthropic; A1 y A2 migran sin cambiar su conducta | SDD-0638 fase 1 |
| **3 · Respaldo de texto** | Adaptador del primer respaldo (D-1) para A1 y A2, con cambio manual desde la pantalla | SDD-0638 fase 4, D-1 |
| **4 · Forma fija** | A3 y A4 con respaldo, después de pasar la prueba de forma fija | Fase 3; para A4, D-2 y `revisar-datos-ve` |
| **5 · Automático** | Cambio al respaldo ante error de cobro | D-3 |
| — | A5 (documentos) y A6 (Agentes) | Quedan **sin respaldo** hasta que pasen su prueba y Sam lo apruebe |

## 6. Pruebas previstas

- **Contrato del motor:** la misma batería contra el adaptador de Anthropic y contra cada respaldo:
  texto, forma fija (JSON válido según su esquema) y tiempo agotado.
- **Habilitación:** una función no ofrece un proveedor en la pantalla si no pasó su prueba (el catálogo
  lo marca).
- **Sin literales:** una prueba busca ids de modelo fuera de la configuración (como en Faro).
- **Cambio manual:** queda en la auditoría; sin permiso de admin se rechaza.
- **Automático:** con un 402 simulado en el principal, la llamada va al respaldo una sola vez y queda
  registrada; un 400 de entrada inválida no cambia de proveedor.
- **Privacidad:** una función con datos de clientes no puede apuntar a un proveedor sin aprobación;
  la prueba falla si el catálogo lo permite.

## 7. Fuera de alcance

- La cadena de fallback de la Oficina (SDD-0626 §7).
- Elegir el modelo «mejor» por calidad: eso se mide en la evaluación de cada función.
- Comprar o crear cuentas en proveedores nuevos: lo hace Sam en cada panel.

## 8. Decisiones abiertas para Sam

- **D-1 · Primer respaldo.** ¿Con qué proveedor arrancamos? GLM (ya hay cuenta de pago para el ERP) o
  DeepSeek (hace falta una llave propia).
- **D-2 · Datos de clientes.** ¿Las funciones con datos de clientes (resúmenes de conversaciones y
  documentos) pueden ir a un proveedor chino? ¿O se quedan solo con proveedores que Sam apruebe
  después de la revisión de privacidad?
- **D-3 · Automático.** Solo cambio manual (propuesta para empezar), o automático ante falta de pago.
- **D-4 · Alcance.** ¿Empezamos solo por noticias y brief (lo más simple), o también Bitácora?
- **D-5 · Agentes.** ¿Agentes y Skills entra en esta spec, o se queda con Anthropic?
- **D-6 · Quién cambia.** Solo el superadministrador, o cualquier admin del equipo.
