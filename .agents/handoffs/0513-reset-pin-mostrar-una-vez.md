# Handoff · 0513-reset-pin-mostrar-una-vez

- **Fecha:** 2026-10-14
- **Owner:** subagente Worker del Director (sesión «Revisión de tareas en progreso»); claim local `reset-pin-mostrar-una-vez`, liberado al cerrar.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-ae78e9b7ed4aaa342`
- **Rama:** `codex/reset-pin-mostrar-una-vez` (sin upstream a main; push explícito rama→rama).
- **Base:** `origin/main` `cbce76921b09a890dc172e26951108079290dbbc`. Durante la tarea `origin/main` avanzó a `1ce2ba994f523ef26ace6001487bd73c30f3bbd0` (PR #209: Dockerfile, `infra/`, runbook del servidor): ningún archivo en común con esta rama; no hizo falta traer main.
- **SDD:** 0513, asignada por el Director — `docs/specs/0513-reset-pin-mostrar-una-vez/spec.md`, estado `in-progress`.
- **Estado de tarea:** lista-para-revision, con el criterio 5 bloqueado por migración.

## OBJETIVO ORIGINAL

En Studio › Operarios, que un admin restablezca el PIN de un operario de la app
del teléfono (`/m/cn`, `/m/ve`) con un PIN nuevo generado por el sistema y lo vea
una sola vez para pasárselo. El PIN sigue guardado solo como hash bcrypt.

Decisión de Sam (2026-10-14, AskUserQuestion, opción elegida literal):
«Restablecer y mostrar (Recomendado)». Descartó «Ver el PIN guardado».

## COMPLETADO

Criterios 1 a 4 de la spec cumplidos; el 5 no (ver PENDIENTES).

1. **Generado en el servidor.** `generateOperarioPinAction` (nueva, en
   `app/studio/(app)/operarios/actions.ts`) pasa el mismo `moduleEditDenial(…,
   "operarios")`, y recién después sortea con `crypto.randomInt`
   (`lib/studio/operario-pin-generator.ts`, `server-only`). El sorteo es por
   rechazo sobre 0–9999 y descarta los 24 PIN comunes que tumba
   `validate_operario_pin_format` (`lib/studio/operario-pin.ts`). Ignora el `pin`
   del formulario. Llama a la RPC de siempre, `admin_reset_operario_pin`.
2. **Mismo candado.** Igual que hoy: admin y operations; la RPC repite el candado
   en la base (0351).
3. **Se ve una vez.** `ResetPinDrawer.tsx` reescrito: modos «Generar PIN nuevo»
   (por defecto, `SegmentedControl` canónico) y «Escribirlo yo». Al restablecer
   muestra el PIN grande, «Copiar PIN» y el aviso «Anótalo ahora: no se vuelve a
   mostrar.». El valor vive solo en el estado del cajón; al cerrar o recargar
   desaparece. Se quitó `Math.random` del cliente.
4. **Manual conservado.** Arranca vacío; los comunes se rechazan en vivo y en el
   servidor con tuteo («Ese PIN es muy fácil de adivinar. Usa otro o genera uno
   nuevo.») sin llegar a la base, cuyo mensaje dice «Elegí».
5. **Copy:** botón de la tabla «Reset PIN» → «Restablecer PIN»; subtítulo de
   edición; carga «Restableciendo…» (antes caía al default «Creando…»); se
   corrigió el voseo «Pasale este al operario» → «Pásaselo al operario» y se quitó
   el glifo «↻».

### Revisión de datos (`/revisar-datos-ve`, advisory)

- **CORRECTO** — minimización: el PIN en claro existe solo en la action, su
  respuesta y el estado del cajón (`actions.ts` `generateOperarioPinAction`,
  `ResetPinDrawer.tsx` `PinReveal`).
- **CORRECTO en el código revisado** — no persistencia: nada en consola, otras
  RPC, tablas, `revalidatePath`, localStorage, sessionStorage, URL ni historial
  (espías en las dos suites). Sentry no está en `package.json`.
- **CORRECTO** — la base guarda solo `crypt(p_pin, gen_salt('bf'))` (0351).
- **NO VERIFICABLE** — «Copiar PIN» deja el valor en el portapapeles del equipo
  del admin, a pedido suyo; su vida ahí depende del sistema operativo.
- **ENCONTRADO (fuera de alcance)** — `pin_hash` legible por cualquier rol del
  tenant; ver FUERA DE ALCANCE.
- **ENCONTRADO** — el cambio de credencial no deja evento de auditoría (criterio 5).
- Marco citado desde `references/`: Ley Especial contra los Delitos Informáticos,
  arts. 20-22; PIPL art. 51 (control de permisos) por el equipo de Yiwu. No es
  asesoría legal.

### `/ui-check` (inline, sobre el diff)

```
UI-CHECK · app/studio/(app)/operarios (ResetPinDrawer, OperariosClient, EditOperarioDrawer)
Hallazgos (4):
1 ⭐ [media] ResetPinDrawer.tsx:116, :261, :296 — paddings 20px 22px / 24px 22px /
   20px 32px fuera de la escala de 4 px por el 22. Es el inset del DrawerShell
   (18px 22px) y el de todos los cajones; deuda del sistema, no se cambia aquí.
2  [baja] ResetPinDrawer.tsx:336 — párrafo centrado en el revelado (heredado);
   pieza focal corta, se deja.
3  [baja] ResetPinDrawer.tsx:126 — el título del grupo es un span visual; el
   nombre accesible lo da `ariaLabel` del SegmentedControl.
4  [baja] OperariosClient.tsx:327 — `#FFFFFF` en la perilla del toggle;
   preexistente, fuera del diff.
Lo que está bien: solo tokens; SegmentedControl (canonical), DrawerShell y
ErrorAlert; una primaria por cajón; aviso de Atención con borde e ícono dorados
sobre --bg-surface (3,14:1; sobre --warning-bg el ícono caía a ~2,8:1, por eso
no se usó); error de campo con texto neutro e ícono rojo, como RateDrawer;
tuteo; sin emoji.
Veredicto: OK con ajustes menores (no bloqueante).
```

### Gobernanza

AUD-01: no conformidad **preexistente** (el reset manual tampoco audita), no
introducida; queda como criterio 5. BTN-01: cumplimiento. CMP-01: cumplimiento.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `corepack pnpm install --frozen-lockfile --prefer-offline` | worktree | PASÓ (exit 0) |
| `vitest run` de las 4 suites nuevas + `rbac-actions-guard.test.ts` | código de `0ce429ff` (igual al de la cabeza) | PASÓ — 5 archivos, 484 pruebas |
| `vitest related --run` de los 6 archivos de producto | árbol previo al commit | PASÓ — 4 archivos, 50 pruebas (solo sigue imports) |
| `rbac.test.ts` + `rbac-actions-guard.test.ts` + `rbac-action-scan.test.ts` (leen fuentes como texto) | árbol previo al commit | 1.ª corrida FALLÓ: inventario 428 ≠ 429, por la acción nueva; tras escribir la justificación: PASÓ 521/521 |
| Contrato PGlite `operario-pin.migration.test.ts` | toma `0288_finalize_replay_gate_split_history.sql` | PASÓ 5/5, con su control rojo interno |
| Mutantes (12, corredor sin shell, «N failed» con control verde 484/484) | `0ce429ff` | PASÓ — los 12 mueren: candado quitado (8 caen, y también el veredicto por acción de `rbac-actions-guard`), sorteo antes del candado (11), PIN a consola (1), manual sin comunes (3), validador sin lista (3 + 2 en PGlite), rango (0, 9999) (1), corregir en vez de rechazar (4), `Math.random` en el generador (1 + 5), sessionStorage (5), recordar al reabrir (9), prellenar con `Math.random` (4), todo por el camino manual (7) |
| Control rojo: suites nuevas contra `origin/main` de `ResetPinDrawer.tsx` y `actions.ts` (iguales en `cbce7692` y `1ce2ba99`) | — | PASÓ como control: UI 10/10 en rojo; actions 22/25 en rojo. Las 3 verdes en main son las de preservación (manual guarda, manual con rol denegado, consola limpia) |
| `corepack pnpm exec tsc --noEmit` (sin tubería) | `57d3ffe0` | PASÓ (exit 0, sin salida) |
| eslint de los 11 archivos de código | `57d3ffe0` | PASÓ (exit 0) |
| `node scripts/build-docs-index.mjs --check` | `57d3ffe0` | PASÓ (498 specs) |
| `node scripts/check-numbering.mjs` / `pnpm sdd:check` | — | PASÓ (0512 sale como hueco local: reservada fuera de esta rama) |
| `git diff --check` y `git diff --cached --check` | cada commit | PASÓ |
| `pnpm governance:check` | — | PASÓ (28 políticas, cápsula vigente) |
| `pnpm components:check` | — | PASÓ |
| `node scripts/check-rsc-boundary.mjs` | — | PASÓ (1656 módulos) |
| `node scripts/check-pending-migration-symbols.mjs` | — | PASÓ (0 ROJO · 0 AMARILLO) |
| `pnpm knowledge:status` | `0ce429ff` | ejecutado: `ok:false`; INVALID estructural y semántico global porque este worktree no tiene `graphify-out/` (preexistente, no producido por la tarea) |
| `pnpm verify` (incluye `next build`, vitest completo, e2e) | — | NO EJECUTADO: por instrucción del Director, el turno pesado lo da él |
| e2e, Docker, `run-sql-tests.mjs` | — | NO EJECUTADO: mismo motivo; no hay SQL nuevo |
| Graphify update / `knowledge:visual` | — | NO EJECUTADO: el diff final no toca fuentes del piloto semántico; Graphify lo publica el Director desde main |

## COMMITS

- `34278f2e` — docs(sdd): SDD-0513 — spec, índice regenerado (y una fila del mapa que el commit siguiente retira).
- `0ce429ff` — feat(studio): SDD-0513 — código y pruebas.
- `57d3ffe0` — docs(sdd): SDD-0513 — retira la fila del mapa de módulos hasta el cierre (fuente del piloto semántico) y ajusta la allowlist.
- Commit que contiene este documento — docs: handoff.

## PR / BRANCH

- Rama `codex/reset-pin-mostrar-una-vez`, base `main`, worktree arriba.
- PR draft: la URL se registra en el cuerpo de la PR y en el mensaje al Director.
- La cabeza es el commit del handoff (solo `.md`): por el `ignoreCommand` de
  Vercel, esa cabeza no genera preview; el merge a main sí despliega porque su
  diff toca código.

## PENDIENTES DE ESTA TAREA

1. **Criterio 5 — auditoría del restablecimiento (bloqueado: necesita
   migración).** Hoy ningún restablecimiento deja evento: no existe el
   `entity_type` `operario` en `audit_entity_types`, `append_audit_event` solo lo
   ejecuta `service_role` y AUD-01 §1/§4 exigen el evento en la misma transacción
   que el cambio de credencial (un registro aparte desde TypeScript no cumple).
   Propuesta, para que el Director asigne número (el encargo nombró la 0475 como
   la libre) y Sam dé OK nominal: una migración que registre `operario` en el
   catálogo y haga que `admin_reset_operario_pin` escriba el evento (actor
   `auth.uid()`, operario, tenant; nunca el PIN) dentro de su transacción, con su
   `*.migration.test.ts` en PGlite. La parte TypeScript no cambia.
2. Al cerrar la spec: fila de Operarios en `docs/architecture/module-sdd-map.md`
   (fuente del piloto semántico: recibo desde main) y estado `done`.
3. `pnpm verify` completo cuando el Director dé el turno.
4. Smoke de Sam en producción (abajo), después del merge y del deploy.

### Guion de smoke para Sam (producción, después del deploy)

> ⚠️ El PIN viejo del operario deja de funcionar en el momento. Usa un operario
> de prueba o avísale antes al operario real.

1. Entra al Studio con un usuario **admin** u **operations** → Operarios.
2. En la fila del operario (VE para este guion), toca **Restablecer PIN**. Debe
   abrir el cajón con «Generar PIN nuevo» marcado y **sin ningún número a la
   vista**.
3. Toca **Restablecer PIN** (abajo a la derecha). Debe aparecer «PIN
   restablecido», el aviso «Anótalo ahora: no se vuelve a mostrar.» y **un solo**
   PIN de 4 dígitos.
4. Toca **Copiar PIN**: el botón dice «Copiado». Anota el PIN.
5. Toca **Listo**. Vuelve a abrir **Restablecer PIN** en la misma fila: **no**
   debe verse el PIN anterior (y no lo restablezcas de nuevo). Cierra con
   Cancelar.
6. En el teléfono, abre `/m/ve/login` e ingresa ese PIN: debe entrar como ese
   operario. Si el operario es de China, usa `/m/cn/login`.
7. Control del PIN viejo (si lo conoces): cierra sesión e intenta una vez con el
   PIN anterior: debe rechazarlo. Un solo intento; el login bloquea tras 10
   fallos en 15 minutos.
8. (Opcional) Con un usuario **marketing** o **support**, Studio › Operarios no
   debe dejar restablecer.
9. Falla si: se ve un número antes de restablecer, el PIN aparece dos veces,
   reaparece al reabrir, o `/m/ve/login` no lo acepta.

## FUERA DE ALCANCE DETECTADO

1. **`pin_hash` legible por cualquier rol del tenant (alta).**
   `0021_operario_admin_rpcs.sql:178-184` y `0023_operario_region.sql:38` dan
   `grant select` de tabla a `authenticated` con una policy solo por tenant; 0263
   cambió los privilegios por defecto de tablas futuras, no estos. Marketing o
   support pueden leer los hashes por PostgREST, y un bcrypt de 4 dígitos se
   revierte probando 10.000 valores: en la práctica el PIN **sí** se puede
   recuperar de la base, contra lo que supone la decisión de Sam. Arreglo
   propuesto: migración con grant por columnas sin `pin_hash` para
   `authenticated` (el Studio no la lee: `lib/studio/operario-queries.ts` no la
   pide). NO VERIFICADO contra producción. Decisión de Sam y número del Director.
2. **PIN repetido deja fuera a dos operarios (media).** El login exige una sola
   coincidencia por tenant y región (`0325_operario_pin_login_hardening.sql`,
   `v_matches <> 1`), y ni `admin_create_operario` ni `admin_reset_operario_pin`
   impiden repetir un PIN activo. Probabilidad por alta o restablecimiento: k/9.976
   (k = demás operarios activos de ese tenant y región). Preexistente. Arreglo
   propuesto: que la RPC rechace un PIN que ya use otro operario activo, con un
   código propio, y que la action generadora sortee otro. Necesita migración.
3. **El alta de operario sigue con `Math.random` (baja).**
   `NewOperarioDrawer.tsx:26-27` prellena el PIN en el navegador y
   `createOperarioAction` valida solo el formato (`/^\d{4}$/`), así que un común
   llega a la base y vuelve con «Elegí». Arreglo sin migración: reutilizar
   `operario-pin.ts` y el generador del servidor, como en esta tarea.
4. **Voseo en la base (baja).** `validate_operario_pin_format` responde «PIN
   demasiado común. Elegí uno menos predecible.» (0037 y reafirmaciones hasta
   0288). El Studio ya no lo muestra en el restablecimiento; corregirlo en la
   base es migración.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR draft. No fusionar mientras el criterio 5
  siga abierto, salvo que Sam acepte por escrito salir sin auditoría (hoy el
  reset manual tampoco audita, así que no hay regresión). Respeta la veda del
  jueves 2026-10-15 en la noche (corte de dtdcargo.com al VPS).
- **Decisiones que necesitan a Sam:** (a) número y OK nominal de la migración de
  auditoría del criterio 5; (b) si se suma en la misma migración el grant por
  columnas que esconde `pin_hash` (FUERA DE ALCANCE 1) y el rechazo de PIN
  repetido (FUERA DE ALCANCE 2); (c) si la PR puede entrar antes que la auditoría.
- **Contratos compartidos:** `lib/studio/rbac-actions-guard.test.ts` (inventario
  428 → 429); si otra PR suma o quita una acción, el número choca al integrar.
- **Sin migraciones ni escritura en producción.** Ninguna base tocada.
- **Conocimiento:** impacto documental = spec nueva + índice; la fila del mapa
  de módulos y el recibo semántico quedan para el cierre desde main. Sin Archify.
- **Turno pesado:** falta `pnpm verify` completo.
- **Ownership:** claim `reset-pin-mostrar-una-vez` liberado al terminar la
  escritura; worktree y rama se conservan.

## CIERRE DE INTEGRACIÓN (Director, 2026-10-14)

- **Merge:** PR #210, merge `ad959bca` a las 17:57:31Z, con `--match-head-commit 70a5330e`, con OK de Sam («Sí, fusiónala cuando esté verde (Recomendado)»). Deploy a las 17:59:21Z.
- **Smoke en producción (restablecer + login): PASÓ.** Sam restableció el PIN de Wang Hua (región `cn`) a las 18:07:04Z (gateway 204). Los intentos por `/m/ve/login` fallaron, como corresponde a un operario `cn`. A las **20:28:19Z** entró por `/m/cn/login` (`operario_pin_attempts`: `region = cn`, `succeeded = t`; `last_login_at` actualizado). Sam, literal: «SI APROBE ENTRO».
- La spec queda `in-progress` a propósito: el criterio 5 (auditoría del restablecimiento) lo cumple la migración 0475 de la SDD-0515 (PR #212), todavía sin aplicar.

## CIERRE DE INTEGRACIÓN (Director, 2026-10-14 noche)

- **Criterio 5 (auditoría del restablecimiento): cumplido.** Lo trae la migración 0475 de la SDD-0515:
- **0475 aplicada en el servidor propio** a las 23:32:24Z con el OK nominal de Sam, literal: «OK, aplica la 0475_pin_operarios_endurecer en el servidor propio».
  - Antes de aplicar, el Director repitió la lectura previa READ ONLY a las 23:31Z: los siete md5 de origen (incluida la forma viva `2c22a7b2` del validador), las sobrecargas, que el Vault no tuviera `operario_pin_key` y que no existiera la entidad `operario`.
  - Aplicación: `psql` en `dtd-cargo-db-1`, con migración y fila del ledger en una transacción. El script tiene md5 `b2b75da6…`, verificado en el servidor, y sale del blob `0d7492ce` (61685 bytes). Exit 0 y COMMIT; el postflight interno pasó.
  - Verificación posterior READ ONLY:
    - ledger en 481 filas, con la fila `20261014233224 · 0475_pin_operarios_endurecer`, cuyo `md5(statements[1])` es `1273d8a4…`, igual al blob;
    - `pin_hash` y `pin_cifrado` sin SELECT para anon, authenticated y service_role;
    - `operario_pin_key` en el Vault y la entidad `operario` en `active`;
    - 3 operarios, 0 con `pin_cifrado`, y 0 locks en espera.
  - Evidencia: `/srv/ops/evidencias/apply-0475-dtd-cargo-20261014T233453Z/` con `SHA256SUMS`.
- **Merge:** PR #212, merge `487971c8` a las 23:35:19Z, con `--match-head-commit fb23fa7c`, migración primero y merge enseguida. Deploy: «Deployment has completed» a las 23:37:29Z.
- Desde ese deploy, cada restablecimiento escribe su evento en la entidad `operario`, en la misma transacción, y pide un motivo de la lista. El smoke del restablecimiento y el login por la app de su región ya había PASADO a las 20:28:19Z (ver «Seguimiento»).
- Todos los criterios cumplidos. Estado de la tarea: **integrada**.
