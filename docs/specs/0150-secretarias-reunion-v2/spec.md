---
sdd: "0150"
title: "Secretarias de reunión v2 — default rica + Escucha Activa + transcripción diarizada"
status: in-progress
author: "founder"
created: 2026-07-05
updated: 2026-07-05
supersedes: null
superseded_by: null
related: ["0146", "0139", "0088"]
confidencialidad: interno
---

# DTD-0150 — Secretarias de reunión v2

> Evoluciona el análisis IA de Bitácora (SDD-0146) de un "secretario de actas" simple a **dos secretarias** sobre el mismo tronco: una **default rica pero concisa** para todo el equipo, y una **Escucha Activa privada** solo para el admin que critica y recomienda sobre el acta ya producida.

**Estado (2026-07-05):** Fases **A, B, D implementadas** (gate `verify.mjs` verde + reviewer APROBADO, sin migración). **Fase C DIFERIDA** — necesita `ASSEMBLYAI_API_KEY` + decisión de proveedor (la ruta tiene `maxDuration=60s`; AssemblyAI es asíncrono → Deepgram síncrono encaja mejor; decidir con la key en mano).

## Contexto

Bitácora (SDD-0146) está LIVE: grabar/pegar conversación → IA propone acta + tareas → humano confirma. Hoy el análisis lo hace un solo prompt, `buildActaPrompt` (`lib/studio/bitacora/prompts.ts`, "secretario de actas"), que saca resumen + puntos + decisiones + tareas.

El founder diseñó una evolución (prompts completos en `prompts/` de esta spec). Dos agentes analistas sobre un núcleo común:

1. **Secretaria Bitácora ERP** — default, la ven todos los empleados. Operativa y neutra. Suma sobre lo actual: distinción **empleado→tarea vs externo→pendiente**, **vínculo con la tabla de clientes** (atar al interlocutor externo; caso real "González de Maracay vs. de Valencia"), **dudas de clasificación**, **hilos** (coser temas dispersos, usar el dato FINAL al corregirse). Salida **concisa** (resumen 2-4 frases + decisiones + tareas al frente; el detalle rico en campos estructurados, no en prosa).
2. **Secretaria Escucha Activa** — 2º botón, **solo admin** (extensible a gerentes vía capability). Capa **privada de crítica**: NO genera su propio set de tareas; toma lo que produjo la default y le **recomienda** al founder qué cambiar (subir prioridad, ser más explícito, reescribir una tarea). El founder aplica. Suma la capa suspicaz (Grice, actos de habla, hedging, black swans, presuposición, distancia/evasión) como sugerencias privadas.

## Decisiones del founder (fijadas)

- **Escucha Activa = privada + capa de comparación/recomendación** sobre el acta default; el founder aplica los cambios. No persiste su análisis (efímero) en v1.
- **Default = híbrido conciso**: adopta el contrato rico pero con instrucción de resumen rápido y concreto.
- **Transcripción = transcript rico + Claude** (todo Anthropic, NO audio-nativo/Gemini). Se acepta a conciencia el techo de tono/prosodia a cambio de un solo proveedor de IA; se exprime la señal que SÍ sobrevive al texto (hablantes, pausas, muletillas, respuestas no-preferidas).

**Investigación de audio (cerrada):** Claude no ingiere audio por API (su voice mode es otra cosa). Solo Gemini 2.5 "oye" tono/pausas de verdad, pero se decidió no sumar Google. Escucha Activa corre sobre transcript enriquecido en Claude/Opus.

## Hallazgo que define la estrategia de datos

`bitacora_confirm_meeting` sobrescribe el `acta` jsonb entero (`0214_bitacora.sql:662`) y `analyzeActaAction` ya persiste el blob completo. ⇒ **Cualquier campo rico nuevo dentro de `acta` sobrevive sin tocar SQL**, y hereda gratis el gate de visibilidad `gestores` (`0214:137`). **v1 sale con CERO migraciones.**

## Alcance (4 fases · tamaño-harness)

### Fase A — Contrato unificado + concisión + bloque común
- Refactor `prompts.ts`: `buildActaCommonBlock` (núcleo compartido) + `buildActaErpPrompt` (default conciso, reemplaza `buildActaPrompt`). Regla obligatoria en ambas: *"analiza solo lo transcrito; no inventes tono, pausas ni gestos que no estén en el texto"*.
- Extender `ACTA_INPUT_SCHEMA`/`RawActa`/`coerceRawActa`/`mockActa` (`extract.ts`) con `tipo_reunion`, `hilos[]`, `vinculo_cliente{}`, `pendientes_externos[]`, `dudas_clasificacion[]`. Tool-use forzado se mantiene (la estructura mata la verborrea).
- Extender `ActaData` (`bitacora-types.ts`, llaves opcionales), propagar en `match.ts` y en las escrituras de `acta` (analyze + payload de confirm en `ActaReview`).
- `ActaReview`: render **colapsable** de hilos/dudas. Sin migración.

### Fase B — Vínculo cliente enriquecido + matching externo
- Post-proceso determinístico: correr `vinculo_cliente.nombre_detectado` por `listClients`/`searchClientsAction` (matchea name/markbox/rif/email/teléfono) → `client_id_sugerido` + confianza.
- `ActaReview`: aviso inline ámbar "¿Es este cliente?" → `ClientCombobox` para confirmar. Poblar `bitacora_tasks.client_id` al confirmar (hoy la action no lo envía). No auto-crea clientes. Sin migración.

### Fase C — Transcripción diarizada + enriquecida + fallback
- Proveedor con diarización en español (**AssemblyAI** recomendado por sentiment/entidades; Deepgram nova-3 alternativa por costo/latencia). Env `ASSEMBLYAI_API_KEY` (o `DEEPGRAM_API_KEY`), server-only.
- Enriquecer transcript server-side: `"Hablante 1: …"`, `[pausa Ns]` de gaps de timestamps (≥2s), NO limpiar muletillas. Fallback a CF Whisper si el proveedor falla/no está configurado.
- ⚠️ Verificar que el sentiment funcione en ESPAÑOL (suele ser English-first); si no, se omite y la señal se deriva por código/prompt. Verificar disponibilidad server-side desde Vercel.

### Fase D — Secretaria Escucha Activa
- Capability `escucha_activa: []` en `CAPABILITIES` (`rbac.ts:178`) → admin-only, extensible sin tocar call sites.
- `analyzeEscuchaAction` + `extractEscucha` (tool `sugerencias`, modelo Opus por cascada `BITACORA_ESCUCHA_MODEL ?? BITACORA_ACTA_MODEL ?? default`). Recibe transcript + acta default; devuelve `sugerencias[]` tipadas; no crea tasks, no persiste.
- `ActaReview`: panel "Escucha Activa (privado)" gateado por `canSpecial(role,"escucha_activa")`; cada sugerencia con "Aplicar" que muta el estado local. Etiqueta "privado · no se guarda el análisis".

Orden: **A → B → C → D**.

## Diseño

Plan de implementación aprobado (con rutas `file:line`): ver el plan de la sesión. Prompts fuente del founder: `prompts/secretaria-bitacora-erp.md`, `prompts/secretaria-escucha-activa-sam.md`, contexto en `prompts/CONTEXTO-secretarias.md`, kit de prueba en `prompts/kit-prueba-transcripcion.md`.

Contrato JSON unificado (tool-use): `tipo_reunion`, `hilos[]`, `vinculo_cliente{}`, `tareas[]`, `pendientes_externos[]`, `dudas_clasificacion[]`, y `puntos_sin_cerrar[]` (ERP) / `bucles_abiertos[]` (Escucha). Flags que frenan automatización: `necesita_confirmar_responsable`, `vinculo_cliente.necesita_confirmar`, `dudas_clasificacion` no vacío, `hilos[].contradiccion_sin_resolver`.

## Riesgos / qué NO hacer

- Frontera pública↔ERP: todo es Studio interno.
- RLS multi-tenant: campos ricos en `acta` heredan la policy; `analyzeEscuchaAction` lee con user-client (no service-role).
- No auto-crear clientes: la IA solo **sugiere** `client_id`; el humano confirma.
- Regla de oro intacta: tareas nacen solo en `confirmActaAction`→RPC; Escucha no crea tareas ni persiste.
- Tokens/costo: subir `max_tokens` (hoy 4000) para el contrato ampliado; mantener cap 50 tareas. Escucha (Opus) admin-only bajo demanda; diarización por minuto → cap 10 min + fallback CF.
- No desincronizar prompts: bloque común obligatorio.
- No romper actas viejas: campos nuevos opcionales; `coerce`/validadores toleran ausencia.

## Adjuntos

Prompts fuente del founder en `prompts/` (este folder). Sin binarios.
