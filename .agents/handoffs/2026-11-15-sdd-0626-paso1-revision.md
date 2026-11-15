# Handoff · SDD-0626 · Paso 1 del cable · lo que pidió la revisión independiente de la #572

| | |
|---|---|
| Owner | `local_75c65889-revision-572`: Claude Code, en una sesión lanzada desde la sesión del cable |
| Fecha | 2026-11-15 UTC |
| Worktree | `Developer/DTD-worktrees/0626-paso1-revision` |
| Rama | `sdd/0626-paso1-revision`, desde `origin/main` `aee7d5d70` (el merge de la #572) |
| Base del PR | `main` |

**No hay merge ni auto-merge: la firma es de Sam.** Nada se aplicó en ningún entorno: ni producción ni prueba.

## OBJETIVO ORIGINAL
Atender la revisión independiente de la #572 antes de que el Paso 2 (webhook, filtro y despachador) escriba en las tablas de la 0541.
- **Las bajas:** se hacen.
- **Las dos medias:** son decisiones de la spec. Se proponen y esperan el OK de Sam.
- **El hallazgo 13 (IP en el runbook):** se pregunta antes de tocarlo.

## DECISIÓN: CORREGIR LA 0541 EN SU LUGAR, NO HACER UNA 0542
Se comprobó en el repo:
- **El candado no la protege:** la 0541 no está en `supabase/migrations.lock.json`.
  - `scripts/migrations-lock.mjs` solo falla con CAMBIADA, FALTA o HISTORIA en migraciones selladas.
  - `verificar --base origin/main` sale con 0: 522 selladas, 5 esperas y 0 nuevas.
- **El runbook no lo prohíbe:** `docs/runbooks/aplicar-migraciones-prod.md` §8 prohíbe editar o renumerar una migración **aplicada**. La 0541 no se aplicó en ningún entorno (la opción A de Sam).
- **Las imágenes ya construidas siguen valiendo:**
  - la etiqueta `org.dtdcargo.migraciones` (`infra/ops/web/publicable.mjs:93-95`) lleva **nombres**, no hashes;
  - las imágenes desde `aee7d5d70` exigen `0541_oficina_cable_tablas`, y la versión corregida conserva ese nombre;
  - una 0542 sumaría otra migración exigida y otra espera para cosas que no existen en ninguna base.
- **El gate de aplicadas tampoco compara contenido:** `scripts/check-migrations-applied.mjs` compara nombres.
- **Riesgo que queda:** que alguien haya aplicado la versión vieja en una base local. Para eso, el preflight nuevo para si encuentra `event_inbox_clave_dedupe_idx`, que es la huella de la versión anterior.

## COMPLETADO (las bajas)

| # | Hallazgo | Qué se hizo |
|---|---|---|
| 3 | `office_esta_pausada()` sin filas | Caso nuevo en el contrato 6. Después de despausar, el dueño vacía la tabla en un bloque que se deshace, y la función tiene que responder true. Tiene su mutante (`coalesce(…, false)`) |
| 4 | Privilegio dado por error | El contrato 2b corre sobre `task_events` **y** sobre `office_paused`. Tiene mutante por cada tabla |
| 5 | Disparadores ORIGIN | Ahora son `ENABLE ALWAYS TRIGGER` los cuatro. El postflight exige `tgenabled = 'A'`. El caso 2b2 nuevo corre con `session_replication_role = replica` (como superusuario de la prueba: el CI usa `psql -U postgres`) y tiene su mutante |
| 6 | UNIQUE en `clave_dedupe` | Se adoptó como restricción `event_inbox_clave_dedupe_unica unique (clave_dedupe)`, en lugar del índice no único `(clave_dedupe, ts)`. El contrato 5 comprueba que el duplicado no entra y que `ON CONFLICT DO NOTHING` lo descarta. Tiene mutantes del postflight y del contrato, y otro para la versión anterior aplicada |
| 7 | Grants por columna | service_role lee todo, pero no escribe `id`, `creado_en` ni `ts`. Tampoco cambia `clave_dedupe`, `tipo`, `origen` ni `payload_ref` de una fila ya creada (en `office_tasks`, no cambia `origen`). El contrato 8 lo prueba: 12 intentos que tienen que fallar y 2 cambios de trabajo que tienen que pasar. Hay 3 mutantes de grant de tabla |
| 8 | `search_path` de una sola función | El postflight revisa las tres. Comprueba también que solo `office_cambiar_pausa` sea SECURITY DEFINER. Hay 3 mutantes |
| — | anon y authenticated | El postflight comprueba además `has_any_column_privilege` |
| 9 | Autorización del Paso 1 | Quedó en la spec: Sam, 15/11/2026, «Sí, lánzalo», transmitida por Hermes (fila Estado y v0.2.3) |
| — | «3 tablas» | Pasó a 4 en §1 y §3.6. §3.2 y §9 dicen que la clave es única |

**Otros cambios:**
- **Espera de la 0541:** su texto en `supabase/migrations-baseline.json` describe la versión corregida.
- **Revisión de datos personales:** `docs/specs/0626-oficina-runtime/privacidad.md`, hecha con `revisar-datos-ve`. Da 6 CORRECTO, 3 ENCONTRADO y 5 NO VERIFICABLE.

## PRUEBAS

| Comprobación | Resultado |
|---|---|
| `vitest run lib/studio/__tests__/oficina-cable-tablas.migration.test.ts` | **31 de 31.** Incluye el contrato, la vuelta arriba-abajo-arriba, el control rojo, **25 mutantes** (eran 14) y los 3 casos del desarme |
| `migrations-lock verificar --base origin/main` | exit 0 |
| `check-pending-migration-symbols` | 0 ROJO |
| `scripts/__tests__/spec-migration-refs.test.ts` | 5 de 5 |
| `scripts/check-pending-migration-symbols.test.mjs` | 20 de 20 |
| `scripts/tests/migrations-lock.node.mjs` | 23 de 23 |
| `docs:check`, `sdd:check`, `governance:check` | exit 0 |
| ESLint del archivo de prueba | exit 0 |

**No se corrió en local:**
- el contrato en Postgres 17, porque Docker no corre en la PC. Queda para el job «Contratos SQL» del CI;
- `pnpm verify` completo: el cambio no toca producto ni build.

## PENDIENTE DE ESTA TAREA
- **El OK de Sam:**
  - media 1, textos libres: opción A recomendada, B o C;
  - media 2: el §3 de AUD-01 «no aplica» a `task_events`;
  - hallazgo 13: quitar la IP del VPS DTD de `docs/runbooks/oficina-cable.md:23`, `:41` y `:90`.
- **La propuesta completa** está en la nota `revision-572-medias-propuesta.md` de la carpeta compartida y en el cuerpo del PR.
- **Con la opción A**, la 0541 suma:
  - el CHECK de identificador en `actor` y `asignado_a`;
  - la excepción del disparador (`resumen → null` solo en filas de más de 90 días);
  - la función diaria de vaciado.

  Cada uno con su prueba y su mutante. También se actualiza `privacidad.md`.

## FUERA DE ALCANCE DETECTADO
- Hallazgos informativos 10 y 12 de la revisión:
  - la auto-pausa al 80 % y el Vigía (AC-5): hoy solo un administrador mueve la bandera;
  - las acciones en el VPS del handoff de la #572.
- Antes de la etapa 2 de AC-1 (clientes reales) hace falta una revisión propia del envío de conversaciones al proveedor de glm-5.3: transferencia internacional y terceros (`privacidad.md` §5).
- La IP de la oficina y la del VPS DTD siguen en el historial de Git del repo público.
