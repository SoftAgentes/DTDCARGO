# Handoff · `documents` sin borrado duro (migr 0394) — cierre 2026-08-28

> Todo lo de acá está **medido** contra producción o contra un Postgres
> desechable con el schema reconstruido. Donde hay un número, hay una consulta
> detrás. Donde no se pudo medir, lo dice.

**Rama:** `claude/confident-napier-4d85ea` · **Worktree:**
`Claude/DTDCargo/confident-napier-4d85ea` · publicada en `main` como `814a49e2`.

Salió del barrido de SDD-0312: la tabla `documents` prometía borrado suave
auditable y no lo defendía en la base.

## Lo que quedó EN PRODUCCIÓN

| Commit | Qué |
|---|---|
| `a286ed7f` | Migración 0394 (revoke del DELETE) + el contrato 0097 reescrito |
| `814a49e2` | Merge de `origin/main` (SDD-0313, sin choques) |

**Migración `0394_documents_sin_borrado_duro` aplicada** con OK del founder
nombrándola. Verificada **contra el objeto**, antes y después:

| Sonda | Antes | Después |
|---|---|---|
| `authenticated` → DELETE | `true` | **`false`** |
| `authenticated` → SELECT / INSERT / UPDATE | `true` | `true` |
| `service_role` → DELETE | `true` | `true` |
| policies sobre `documents` | 2 | 2 |
| fila en el ledger | no | sí, basename exacto |

## 1. El hallazgo, y por qué era peor de lo reportado

La 0097 escribió «soft delete (auditable)» en el comentario de la tabla y en la
línea 101 le dio `delete` a `authenticated`. Medido contra el schema del repo
reconstruido entero (372 migraciones): un usuario del tenant hacía
`delete from documents` y **la fila desaparecía de verdad, sin error**.

Es el mismo hueco que la 0097 dice defender con su trigger —«la server action
valida, PERO un cliente Supabase directo (PostgREST) la saltaría»— dejado
abierto justo en el borrado. Dos agravantes que no estaban a la vista:

- Un documento con **`legal_hold = true` también se borraba**. La 0313 dice que
  la retención «nunca autoriza por sí sola una eliminación física»; el delete la
  autorizaba igual.
- Tras el borrado **no sobrevivía ningún evento en `entity_audit_log`** — con la
  0313 (SDD-0224) prometiendo motivo, autor y cadena auditable vía
  `soft_delete_document()`.

**El fix elegido** (decisión del founder): quitar el `delete` del grant, no un
trigger BEFORE DELETE. Falla con 42501, visible, en vez de convertir en silencio
una intención de borrar en una de marcar. No rompió nada: barrido de `app/`,
`lib/`, `components/`, `scripts/` y `supabase/functions/` → 17 usos de
`from("documents")`, **cero** llaman `.delete()`.

## 2. El contrato medía HISTORIA, no producción

`supabase/tests/0097_documentos_hub.test.sql` aplicaba **sólo la 0097**. Llevaba
meses verde afirmando que un documento borrado no se ve — cierto para esa
migración aislada, falso en prod desde la **0230**, un bugfix sin SDD que barrió
~60 tablas y le quitó el `and deleted_at is null` al `using` de toda policy
`FOR ALL`. Tuvo que hacerlo: con esa condición adentro, poner `deleted_at`
violaba la propia policy y **el soft-delete era imposible para todos**.

Ahora el archivo aplica las tres migraciones que definen lo que contrata
(0097 + 0230 + 0394). El contrato 6 fija la propiedad **en las dos direcciones**
—que los borrados se vean y que se puedan marcar y restaurar— para que el
arreglo de ida y el de vuelta no se pisen. El contrato 10 nuevo cierra el
candado.

**Validado por mutación**, las cinco afirmaciones nuevas:

| Mutación | Resultado |
|---|---|
| devolver `delete` a `authenticated` | CONTRATO 10 ROTO |
| quitarle `delete` a `service_role` | CONTRATO 10 ROTO |
| dar `truncate` a `authenticated` | CONTRATO 10 ROTO |
| devolver `deleted_at is null` al `using` | CONTRATO 6 ROTO |
| cerrar la restauración | CONTRATO 6 ROTO |
| control sin mutar | verde |

## 3. 🔴 Lo que queda ABIERTO y no se tocó

**TRUNCATE sistémico.** Sondeando prod antes de aplicar, aparecieron privilegios
que el repo nunca declaró:

```
anon           → REFERENCES, TRIGGER, TRUNCATE
authenticated  → INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
```

De las **249** tablas de `public`: `anon` tiene TRUNCATE en **180**,
`authenticated` en **205** (y DELETE en 120). **TRUNCATE ignora RLS por
completo** — ninguna policy lo detiene. Son los *default privileges* de la
plataforma; el schema reconstruido desde el repo sale limpio, así que ningún
contrato del gate lo ve.

⚠️ **NO medido que sea explotable hoy**: PostgREST no expone TRUNCATE por REST.
La vía sería una función `security invoker` que lo ejecute, o acceso directo a
Postgres. Es superficie **latente**, no un agujero abierto.

**Siguiente paso antes de proponer nada:** medir si alguna RPC `security
invoker` alcanza un TRUNCATE. Eso decide si el barrido es urgente o higiene —
sin ese dato, una migración de 205 tablas sería adivinar.

**Y dos cosas más que el contrato deja escritas y no cierra:**

- El borrado del equipo **no exige motivo ni deja autor**:
  `soft_delete_document()` existe desde SDD-0224 y **la app no la llama** — las
  dos acciones que borran hacen `update … set deleted_at = now()` a pelo.
  Decisión del founder: se decide aparte.
- `anon` puede ejecutar `document_entity_in_tenant` (`security definer`, lee
  nueve tablas saltándose sus grants): es un **oráculo de existencia**. Riesgo
  práctico bajo —hay que adivinar dos uuids— pero le falta el
  `revoke … from public, anon`.

## 4. Verificación

`node scripts/verify.mjs` con Docker vivo: **15 de 15 pasos corrieron de
verdad**, ninguno en SKIP.

- ✅ `migrations-applied`, `sql-tests`, `schema-rebuild`, `build`, `typecheck`,
  `lint`, `test`, `edge-functions`, `numbering`, `governance:check`,
  `components:check`, `docs:check`, `feature-constants`, `rsc-boundary`.
- ⚠️ `e2e` salió rojo **dentro del gate** por 2 tests de
  `calculadora-hidratacion.spec.ts` en mobile-safari. Corridos aislados:
  **150 passed, 0 failed**. Se comen el timeout de 20 s cuando la máquina está
  saturada (los mismos 2 salieron *flaky* en la corrida previa). No es
  regresión de este cambio: la calculadora pública vive del otro lado de la
  frontera dura y no puede tocar `documents`.

## 5. Siguiente responsable

Ninguno para este trabajo — está en `main` y en producción. Lo que queda abierto
(TRUNCATE, el motivo del borrado, el oráculo de `anon`) son decisiones del
founder, no tareas pendientes de esta ventana.
