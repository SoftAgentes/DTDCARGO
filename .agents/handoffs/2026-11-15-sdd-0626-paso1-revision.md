# Handoff · SDD-0626 · Paso 1 del cable · revisión independiente de la #572 y Paso 1.1

| | |
|---|---|
| Owner | `local_75c65889-revision-572`: Claude Code, en una sesión lanzada desde la sesión del cable |
| Fecha | 2026-11-15 UTC |
| Worktree | `Developer/DTD-worktrees/0626-paso1-revision` |
| Rama | `sdd/0626-paso1-revision`, desde `origin/main` `aee7d5d70` (el merge de la #572) |
| Base | `main` |
| PR | SoftAgentes/DTDCARGO#575 |

**No hay merge ni auto-merge: la firma es de Sam.** Nada se aplicó en ningún entorno: ni producción ni prueba.

## OBJETIVO ORIGINAL
Atender la revisión independiente de la #572 antes de que el Paso 2 (webhook, filtro y despachador) escriba en las tablas de la 0541.
- **Las bajas:** se hacen.
- **Las dos medias:** se proponen y se hacen con el OK de Sam.
- **El hallazgo 13 (la IP del runbook):** se pregunta antes de tocarlo.

**Lo que se sumó después:** a pedido de Sam («Sí, añádelas»), dos reglas del pedido «Paso 1.1» de Hermes, solo en la spec.

## AUTORIZACIONES (todas de Sam, 15/11/2026)
Llegaron por la sesión del cable (`local_75c65889`), eligiendo sobre la nota `revision-572-medias-propuesta.md`:
- **Media 1:** «A: regla + 90 días».
  - Sam la mantuvo («Mantener A») después de la corrección: los 90 días de R5 son del replay, no de la bitácora.
  - En la spec el motivo queda como red por temporalidad, no como requisito de R5.
- **Media 2:** «Sí, apruebo».
- **Hallazgo 13:** «Sí, quitarla».

Llegó por la sesión superior (`local_f13ed801`):
- **Paso 1.1:** «Sí, añádelas», para la regla de la etapa 1 a la 2 y la de un solo contestador por bandeja.

## DECISIÓN: CORREGIR LA 0541 EN SU LUGAR, NO HACER UNA 0542
- **El candado no la protege:** la 0541 no está en `supabase/migrations.lock.json`.
  - `scripts/migrations-lock.mjs` solo falla con CAMBIADA, FALTA o HISTORIA en migraciones selladas.
  - `verificar --base origin/main` sale con 0.
- **El runbook no lo prohíbe:** `docs/runbooks/aplicar-migraciones-prod.md` §8 prohíbe editar o renumerar una migración **aplicada**. La 0541 no se aplicó en ningún entorno (la opción A de Sam en la #572).
- **Las imágenes ya construidas siguen valiendo:**
  - la etiqueta `org.dtdcargo.migraciones` (`infra/ops/web/publicable.mjs:93-95`) lleva nombres, no hashes;
  - las imágenes desde `aee7d5d70` exigen `0541_oficina_cable_tablas`, y la versión corregida conserva ese nombre.
- **El gate de aplicadas tampoco compara contenido:** `check-migrations-applied` compara nombres.
- **Por qué no una 0542:** sumaría otra migración exigida, otra espera y otro desarme para objetos que no existen en ninguna base.
- **Riesgo que queda:** una base local con la versión vieja. El preflight para si encuentra `event_inbox_clave_dedupe_idx`, que es su huella.

## COMPLETADO

### Bajas
| # | Hallazgo | Qué se hizo |
|---|---|---|
| 3 | `office_esta_pausada()` sin filas | Caso nuevo y su mutante |
| 4 | Privilegio dado por error | También en `office_paused`, con un mutante por tabla |
| 5 | Disparadores ORIGIN | Los cuatro van `ENABLE ALWAYS`. El postflight exige `'A'`, y hay un caso con `session_replication_role = replica` y su mutante |
| 6 | Índice no único | `clave_dedupe` es única: el duplicado no entra y `ON CONFLICT DO NOTHING` lo descarta. Hay mutantes del postflight, del contrato y de la versión anterior aplicada |
| 7 | service_role cambia cualquier columna | Grants por columna: nunca `id`, `creado_en` ni `ts`, ni el origen de una fila ya creada. Contrato 8 y 3 mutantes |
| 8 | `search_path` de una sola función | El postflight revisa las cuatro funciones y cuál es DEFINER. Hay 4 mutantes |
| 9 | Autorización del Paso 1 | Quedó en la spec |
| — | «3 tablas» | Pasó a 4 |

### Media 1 · opción A
- **CHECK de identificador** en `task_events.actor` y `office_tasks.asignado_a`: `agente:`, `sistema:` o `persona:<uuid>`.
  - El contrato tiene 6 casos de rechazo y 3 válidos.
  - Hay mutantes del CHECK de cada columna y del postflight.
- **Retención:** `office_vaciar_resumenes_viejos()`, SECURITY DEFINER y solo para service_role, vacía `resumen` en las filas de más de 90 días.
  - La excepción 2 de `office_solo_insertar()` solo deja pasar `resumen → null`, en filas de más de 90 días, con todas las demás columnas iguales (`to_jsonb(new) - 'resumen' = to_jsonb(old) - 'resumen'`).
  - El contrato 2e prueba 6 ediciones que tienen que fallar y que anon y authenticated no la ejecutan. Prueba también el camino real: service_role en su propia sesión con `set session authorization`, como entra por la API.
  - Hay 5 mutantes de la excepción, 1 de DEFINER, 1 de grant y 1 de `search_path`.
  - El desarme quita la función nueva: son 8 objetos.
- **Regla de código:** `lib/studio/oficina/cable-textos.ts`, con `exigirTextosDelCable`.
  - Usa `tieneDatosPersonales` y le suma el teléfono internacional agrupado, porque la regla de noticias no ve «+86 138 1234 5678».
  - No confunde uuids ni conteos con teléfonos.
  - Mira `meta_datos` a cualquier profundidad, claves incluidas.
  - Su prueba: 18 casos, 2 mutantes, y la comparación del patrón de identificador con los CHECK de la 0541.

### Media 2
§3.1 declara que el §3 de AUD-01 «no aplica» a `task_events`, con la tabla de correspondencia. AC-2 «resultado» = `tipo`.

### Hallazgo 13
La IP pública del VPS DTD salió de `docs/runbooks/oficina-cable.md:23`, `:41` (`from=`) y `:90`.
- En `:41` y `:90` dice ahora «IP pública del VPS DTD (ver el servidor)».
- En el título de `:23` dice «IP pública del VPS DTD: ver el servidor», para no anidar paréntesis.
- Se reemplazó sin imprimir la IP.

### Paso 1.1, solo en la spec
- **AC-1:** la regla del paso de la etapa 1 a la 2, con su fila en §9.
- **§3.5:** un solo contestador por bandeja; `soporte-chatwoot` y el `dtd-bot` de la SDD-0618 nunca comparten bandeja.

### Lo demás
- **Spec:** pasó a v0.3, con allowlist del Paso 1 en §3.1.
- **`privacidad.md`:** revisión `revisar-datos-ve`. Da 7 CORRECTO, 3 ENCONTRADO y 5 NO VERIFICABLE.
- **Espera de la 0541:** su texto en `migrations-baseline.json` describe la versión final.

## PRUEBAS

| Comprobación | Resultado |
|---|---|
| `vitest run lib/studio/__tests__/oficina-cable-tablas.migration.test.ts` | **42 de 42.** Contrato, vuelta arriba-abajo-arriba, control rojo, **36 mutantes** (eran 14) y 3 casos del desarme |
| `vitest run lib/studio/oficina/__tests__/cable-textos.test.ts` | 18 de 18 |
| `migrations-lock verificar --base origin/main` | exit 0 |
| `check-pending-migration-symbols` | 0 ROJO |
| `spec-migration-refs.test.ts` | 5 de 5 |
| `check-pending-migration-symbols.test.mjs` | 20 de 20 |
| `migrations-lock.node.mjs` | 23 de 23 |
| `docs:check`, `sdd:check`, `governance:check`, ESLint | exit 0 |

**No se corrió en local:**
- el contrato en Postgres 17, porque Docker no corre en la PC. Lo corre el job «Contratos SQL»;
- `pnpm verify` completo.

## DUDAS (Paso 1.1)
- **«Paso 3» no está numerado en la spec.** La spec solo nombra el Paso 0 y §3.1 (Paso 1). La regla de un solo contestador dice «se hace cumplir en el Paso 3» como en el texto de Hermes.
- **AC-5 tiene dos partes:** el presupuesto visible por corrida y la auto-pausa al 80 %. La regla de la etapa 1 a la 2 exige solo la primera («gasto registrado por corrida»). La auto-pausa no se exige para pasar.
- **Dónde queda registrado el 9 de 10:** en la etapa 1 no hay `agent_approvals`, porque ese registro empieza en la etapa 2.

## FUERA DE ALCANCE DETECTADO
- **La misma IP del VPS DTD sigue en otros 44 archivos del árbol:** handoffs, runbooks, specs y scripts de `infra/ops` que la usan para funcionar. Además está en el historial de Git del repo público. Una limpieza pide su propia tarea, porque hay scripts que dependen de ella.
- **Hallazgos informativos 10 y 12 de la revisión:**
  - la auto-pausa al 80 % y el Vigía (AC-5);
  - las acciones en el VPS del handoff de la #572.
- **Revisión del proveedor de glm-5.3** (transferencia internacional y terceros): hace falta antes de la etapa 2 de AC-1 (`privacidad.md` §5).
- **El Paso 2 tiene que llamar a `exigirTextosDelCable`** y a `office_vaciar_resumenes_viejos()` una vez al día (`privacidad.md`, hallazgos 1 y 3).
