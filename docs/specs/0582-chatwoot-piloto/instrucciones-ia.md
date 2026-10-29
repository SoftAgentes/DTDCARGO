# Instrucciones para la IA ejecutora — programa SDD-0582

Este documento sirve para cualquier agente de programación que tome un paso del [checklist](checklist.md): Claude, Codex u otro. Cuando choca con algo, manda este orden:

1. lo que diga Sam en el chat;
2. `AGENTS.md`;
3. la [spec del programa](spec.md);
4. este documento.

## Antes de empezar un paso

1. **Leer la fila del paso** en `checklist.md`: su puerta, sus dependencias y la evidencia que espera.
2. **Aislamiento:** una tarea, una rama, un worktree y una sesión escritora (`node scripts/harness-worktree.mjs start <slug>` y `claim --owner <id>`). Nunca en `main`.
3. **Si el paso cambia código o infraestructura,** reservar la SDD hija (`pnpm sdd:next --reserve <slug>`) con alcance, allowlist exacta, aceptación y puertas.
4. **Si el paso tiene puerta,** pedir el OK de Sam **nombrando la operación concreta**. Un OK no cubre otro:
   - lectura de PII;
   - carga de datos;
   - despliegue;
   - aplicación de migraciones (runbook de producción);
   - acción irreversible en Meta o Kommo.

   El OK del VPS no cubre ninguna de las otras.
5. **Lecturas según el paso:**
   - visual: `BRAND.md` y `docs/design/README.md`;
   - backend de Studio: `_norte/backend/README.md`;
   - datos personales: `.claude/skills/revisar-datos-ve/SKILL.md`.

## Prohibiciones (sin excepción)

**Número de WhatsApp:**
- no borrarlo;
- nada de `/deregister`;
- nada de Embedded Signup sobre el principal;
- nada de una 2.ª cuenta de mensajería en el mismo usuario del sistema;
- no reintentar `/register`;
- no crear la bandeja del número principal sin 4.2 probado y 0.3 aprobado.

**Datos:**
- No entran en Git:
  - tokens;
  - PIN de WhatsApp;
  - valores de Meta;
  - exportaciones de Kommo;
  - payloads;
  - transcripciones ni capturas con datos personales.

  Van cifrados fuera del repo, y en Git solo se registran conteos y huellas.
- Ninguna lectura de filas de producción sin un OK explícito.

**Bot:**
- «Contesta solo» no se activa hasta que 7.2 esté aprobado. Mientras tanto, solo Sugerir.
- Compromisos comerciales, cambios de datos y montos que no salen de `/api/public/cbm-rate` pasan a humano.

**Irreversibles:** 8.8, 8.11 y 8.12 piden cada uno su OK nominal y van después del acta de 8.6.

## Al cerrar un paso

1. **Commit selectivo** (nunca `git add -A`) con el cambio y con la fila del checklist actualizada **en el mismo commit**. La fila lleva:
   - estado `entregado`;
   - días reales;
   - restante en 0;
   - evidencia: PR, commit o handoff.
2. **Aceptación:** el paso pasa a `aceptado` solo cuando Sam (o el Director, si Sam lo delegó) acepta el entregable. Ese cambio es un commit propio.
3. **Correr** `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`.
4. **Reportar con este formato exacto:**

   `Etapa N de 10 · <nombre> · paso <ID> · Avance X % (falta Y %) · Esfuerzo: real R d, restante D d · Fecha probable <rango> · Esperando: … · Necesito de ti: …`
5. **Validación por check:** PASÓ, FALLÓ, NO EJECUTADO o NO DISPONIBLE. El cierre de producto es `pnpm verify`; para cambios solo de docs, `docs:check` y `sdd:check`.
6. **Handoff** en `.agents/handoffs/`, con los pendientes de la tarea separados de **FUERA DE ALCANCE DETECTADO**.

## Cambios de alcance y reestimación

- **Al cerrar cada etapa,** comparar lo real con lo estimado y ajustar «Días restantes» de lo que queda, con el motivo escrito en el handoff.
- **Descartar un paso o cambiar su peso** exige:
  - una línea base nueva (`Línea base: v2 …` y `Línea base anterior: v1 · alcance …`);
  - el OK de Sam.

  El script rechaza un alcance que no cuadra y un descarte sin línea base nueva.

## Evidencia

Cada afirmación nueva va al registro de [investigación](investigacion-2026-10-28.md) o a uno nuevo con su fecha. Etiquetas:
- **C**: el código lo permite;
- **D**: el proveedor lo documenta;
- **T**: la cuenta de DTD lo tiene;
- **R**: probado en runtime;
- **I**: inferencia;
- **NV**: no verificado.

Un paso con puerta técnica no se acepta solo con C o D: necesita **T** o **R**.
