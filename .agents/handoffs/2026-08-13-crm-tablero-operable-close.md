# Cierre · CRM operable desde el ERP (SDD-0256) — 2026-08-13

Rama `feat/crm-columna-contacto` → `main`. Worktree `DTD-worktrees/crm`.

## Lo que se cerró en esta ventana

| Commit | Qué |
|---|---|
| `a48d6989` | El verbo de mover etapa también en el **Tablero** (kanban). Antes vivía sólo en la tabla del Asesor |
| `1bf0f37f` | **Migración 0366** — la cola fusiona etiquetas y falla ruidosa ante un array nuevo |
| `b5f9e400` | **SDD-0256** deja de ser un stub · **checklist-kommo.md** reescrito con todo medido |
| `abcdbc6e` | Auditoría de estado y proceso: 33 hallazgos, 3 refutados |
| `41b889ca` | **Gate de RBAC en la UI**: no se ofrece un verbo que el rol no puede usar |
| `5127173d` | Decisión del founder: reasignar asesor se hace **desde los dos lados** |

**Migración aplicada a prod:** `0366_kommo_outbox_fusiona_arrays` (verificada ahí
sobre la función pura, sin crear filas en la cola — una fila real dispara un
PATCH a Kommo).

## Los tres errores que originaron este trabajo

1. **El verbo salió en una sola superficie.** El founder probó en el kanban, no
   pasó nada, y concluyó *"el ERP no escribe al CRM"*. La cola probaba que nunca
   se había encolado una orden. Fijado por contrato: el control tiene que estar
   en las dos vistas y las dos derivar destinos de `stageTargets()`.
2. **La 0364 dejó el aviso en un comentario.** Nombró el caso exacto
   (`tags_to_add`), la 0365 lo activó metiendo `patch_tags` en el `CHECK`, y
   nadie volvió. La 0366 cambia el mecanismo: ahora **falla nombrando la clave**
   en vez de dejar prosa para el próximo.
3. **El registro se quedó atrás del trabajo.** Spec en `RESERVADO` con código en
   prod; checklist congelado 25 días declarando como bloqueo un paso cerrado.

Los tres son la misma forma: **el trabajo se detiene una capa antes de volverse
real.** El detalle completo, en
[`2026-08-13-crm-auditoria-estado-y-proceso.md`](2026-08-13-crm-auditoria-estado-y-proceso.md).

## Lo que se hizo distinto, y conviene sostener

- **Validación por mutación en cada cambio.** El contrato de la 0366 se corrió
  con la fusión desactivada (rojo, mostrando que sobrevive sólo la 2ª etiqueta);
  el de RBAC con una regla paralela por rol (rojo en la aserción correcta); el
  del Tablero contra la versión anterior del archivo (3 rojos).
- **No creerle al verde sin mirar qué mide.** El exit code venía de `tail`, así
  que se abrió `verify.mjs` para confirmar que `TODO VERDE` sólo se imprime con
  cero fallos.
- **El `ignoreCommand` se midió contra `vercel.json`, no contra `AGENTS.md`.**
  Y se detectó a tiempo que el último commit doc-only iba a cancelar el deploy.
- **Los contratos SQL cargan la migración real con `\i`**, no una copia del DDL.

## ⚠️ Prerrequisito nuevo que trajo la decisión del founder

Reasignar desde los dos lados hace que el **chequeo optimista deje de ser
opcional**. `kommo_updated_at_at_enqueue` existe desde la 0136 y **hoy se
guarda pero no se lee**: si el asesor mueve el lead en Kommo mientras la orden
viaja desde el ERP, el ERP le pisa el trabajo sin avisar. Va **antes** de la UI
de ese verbo, no después.

## Pendientes

Ver §Checklist en
[`2026-08-13-crm-auditoria-estado-y-proceso.md`](2026-08-13-crm-auditoria-estado-y-proceso.md).
Resumen de lo que quedó abierto de la Fase 4/5:

- UI de `reassignLeadOwnerAction` y `setLeadTagsAction` (servidor listo, cero
  superficie). El de reasignar, después del chequeo optimista.
- Fase 5: método HTTP por op (`"PATCH"` está literal), notas y tareas, clave de
  idempotencia para POST, saldo/carga al contacto de Kommo.
- Transversal: **102 llamadas `.limit(N>1000)`** sin paginar — las peligrosas
  son contabilidad, rendiciones y libros fiscales, no el CRM.
- Nadie vio el Tablero en pantalla: se verificó con build, contratos y tests,
  no con los ojos. El Studio pide sesión.

## Lo que le queda al founder en Kommo (medido 2026-08-13)

1. Crear los 5 campos comerciales — **ninguno existe**; los 20 campos de lead
   que hay son de tracking.
2. Repartir la cartera — **2 asesores de 5** tienen carga, sobre ~47 leads
   activos.

Todo lo técnico del CRM está cerrado: 1 embudo, 7 etapas, write-back en real,
cola vacía, y el drenaje con nudge (de 14 min 38 s a segundos).
