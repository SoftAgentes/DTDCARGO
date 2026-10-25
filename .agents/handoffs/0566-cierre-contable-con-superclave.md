# Handoff · SDD-0566 · Cierre contable con superclave y reporte de excepciones

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19, en Caracas de 15:00 a 17:30 aprox. (UTC 19:00 a 21:30) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0566-cierre-contable-con-superclave` |
| Rama | `codex/sdd-0566-cierre-contable-con-superclave`, desde `origin/main` `b34c8d57` |
| SDD | [0566](../../docs/specs/0566-cierre-contable-con-superclave/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0566` (`fb597a2c`) y entró por cherry-pick. La migración 0493 la asignó el Director |
| Estado | lista para revisión, con PR en borrador y la espera declarada; `pnpm verify` 16/17 sin fallos sobre `3a2510f4`; la 0493 se aplica antes de fusionar (MIGRATE-FIRST), con la previa del Director y el OK nominal de Sam |
| Permisos | El Director la asignó el 2026-10-19 («cierre contable con superclave y reporte de excepciones»), con las decisiones de Sam de ese día. Eso cubre commits selectivos, push de la rama propia y PR en borrador. **No incluye aplicar la 0493 ni leer producción:** eso es del Director, con el OK nominal de Sam |

## OBJETIVO ORIGINAL

Decisión de Sam del 2026-10-19, registrada por el Director: el período cerrado se maneja como en QuickBooks, con advertencia y una «superclave de autorización» distinta de la clave del usuario. Lleva un reporte «Excepciones al cierre» y el historial de cambios de la fecha. El diseño de partida del Director está en la spec.

## COMPLETADO

- **Migración `0493_cierre_contable_superclave.sql`:**
  - **el modo del cierre:** `superclave` por defecto, que sin clave definida bloquea como hoy, o `advertencia`;
  - **la superclave:** solo como hash bcrypt, en una tabla sin acceso de API, con bloqueo tras 5 fallidos durante 15 minutos, `for update` y un tope de 72 bytes;
  - **la excepción como permiso:** la fila con su nonce y `txid_current()`, que los disparadores de la 0133 exigen;
  - **las cuatro operaciones en período cerrado:** crear, asentar, anular y eliminar borrador, como RPC DEFINER;
  - **el historial del cierre**, con fecha, modo, superclave, intentos y bloqueos.
  - **El preflight** compara el md5 del cuerpo de las seis funciones de las que depende, y aborta si producción difiere.
  - **Corrige el «%s» del mensaje de la 0133**, que en producción dice «modificars».
- **App:**
  - las acciones de los asientos piden la excepción o la usan;
  - las acciones del admin para el modo y la superclave;
  - el diálogo y los campos de la excepción en el Libro diario y en «Nuevo asiento»;
  - los ajustes en el cajón del cierre;
  - la pestaña «Excepciones al cierre», con su CSV;
  - sin la 0493, todo vuelve a lo de hoy.
- **Gobierno de la migración:**
  - la espera en `supabase/migrations-baseline.json`;
  - los 10 símbolos en `supabase/pending-migration-symbol-declarations.json`;
  - el inventario de RBAC, de 435 a 438.
- **Revisión del Director, 2026-10-19.** Aprobó el diseño, eligió A (la superclave compartida) y agregó requisitos de seguridad después de medir el servidor. Así quedó cada uno:

  | Requisito del Director | Cómo quedó |
  |---|---|
  | La RPC que recibe la clave la llama solo `authenticated`, sin `service_role` ni `anon` | ya era así. Ahora el contrato lo prueba como propiedad del catálogo (§16), con 2 mutantes nuevos |
  | La espera del `for update`, acotada | **nuevo:** `set lock_timeout = '1s'` en las ocho funciones que reciben la clave. Lo prueba el contrato (§16), con un mutante |
  | En la spec, el riesgo de `auto_explain` y su mitigación de fondo (`auto_explain.log_parameter_max_length=0`), como cambio aparte con el OK de Sam | escrito en la revisión de seguridad; no lo toqué |
  | Ningún error ni `raise` con la clave o su largo; la acción no registra el `formData`; nada de claves reales | ya era así: los `raise` dicen la regla, no el valor; los `console.error` registran el código y el mensaje de la base; las pruebas usan `Clave-Segura-1` y otras de fixture |
  | Riesgo aceptado: el bloqueo por tenant, con el usuario de cada intento a la vista | ya era así: `intento_fallido` lleva `user_id` (contrato §6) y el historial del reporte muestra el nombre |
  | Cuatro contratos con su control rojo: GUC falsificado, fila de otra transacción, fila de otro asiento, sin superclave definida | ya estaban: §3, §8 y §2, con los mutantes «sin mirar el nonce», «sin mirar el txid», «sin mirar el asiento» y «sin superclave definida se deja pasar» |
  | El hallazgo de facturas, recibos, CxP y pagos, en la spec como evidencia para la 2.2 | escrito en *Lo que hay hoy*, con los archivos y las líneas |

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato `supabase/tests/0493_cierre_contable_superclave.test.sql` en **PostgreSQL 17** (Docker) | la migración | PASÓ: «TEST 0493 GREEN: 75 aserciones». Sin la 0493 (`apply_fix=false`): «TEST 0493: existe public.anular_asiento_en_cierre(uuid,text,text)» en la primera aserción |
| `cierre-contable-superclave.migration.test.ts` (el mismo contrato en PGlite) | contrato, control rojo, 18 mutantes de la migración, aborto del preflight por cuerpo distinto, espera declarada y centinela del FOR UPDATE | PASÓ: `Tests  23 passed` |
| `vitest run` de contabilidad, `lib/studio/accounting`, la prueba de la migración, `account-types`, guardas de RBAC, reportes y `lib/studio/reports` | lo tocado y sus vecinos | PASÓ: `Test Files  31 passed (31)`, `Tests  919 passed (919)` |
| Control rojo de la app, 13 mutantes, restaurados por copia con la huella sha256 | campos con otro nombre, un error de la base a la vista, la RPC sin excepción, un aviso inventado sin la 0493, la anulación sin su motivo, la superclave sin vaciar (diálogo y cajón), la superclave a la vista, el diario sin ver el cierre, la fecha ISO en el aviso, el modo sin validar y la confirmación sin exigir | `MUERTOS 13/13 · restaurados 13/13` |
| `typecheck`, eslint `--max-warnings=0` (todos los .ts/.tsx tocados), `check-rsc-boundary` | repo y archivos tocados | PASÓ |
| `check-pending-migration-symbols` | código alcanzable que usa la 0493 | PASÓ: «0 ROJO · 2 AMARILLO declarado(s)» (la 0492 y la 0493) |
| `migrations-lock verificar` | candado | PASÓ: la 0493 figura como espera, «0 nueva(s) sin sellar» |
| `docs:check` (551 specs), `sdd:check`, `governance:check`, `components:check` | documentación | PASÓ |
| `/ui-check` | la UI nueva | OK con ajustes menores. El ⭐ (foco inicial del diálogo en el primer campo) quedó aplicado, con prueba. Los otros tres son de baja prioridad y se anotan abajo |
| `pnpm verify` | completo | ver la tabla de abajo, sobre `3a2510f4` |

**Corrieron sin turno.** El contrato en Docker, las pruebas de vitest y los mutantes de arriba corrieron sin turno de máquina, mientras el Worker de la #292 tenía su `pnpm verify`, lanzado hacia las 19:55Z. Lo señaló el Director. El riesgo son rojos falsos en el verify de la #292, no un verde falso aquí: las corridas de esta tabla terminaron en verde. Se repiten con turno, en el orden que fijó el Director: el contrato en Docker, los mutantes en PGlite y el `pnpm verify` completo.

**`ClosingDateDrawer.tsx` pasó de CRLF a LF.** En `main` estaba en CRLF, y al hacer el commit `.gitattributes` (`eol=lf`) lo normalizó a LF. Por eso `git diff --stat origin/main` marca 271 líneas agregadas y 250 quitadas. Con `--ignore-cr-at-eol`, el cambio real es de 34 agregadas y 13 quitadas.

**Después de la revisión del Director** (la espera acotada y el §16 del contrato). Las filas de arriba son de antes. El turno de máquina lo tiene el Worker de la #292, así que esta vez solo corrió lo que no es pesado:

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato en PostgreSQL 17, ahora con 78 aserciones (con turno del Director, 2026-10-19 hacia las 20:20Z) | la migración con `lock_timeout` y el §16 | PASÓ: «TEST 0493 GREEN: 78 aserciones». Sin la 0493 (`apply_fix=false`): «TEST 0493: existe public.anular_asiento_en_cierre(uuid,text,text)» |
| `cierre-contable-superclave.migration.test.ts`, ahora con 21 mutantes y 26 pruebas (con turno) | lo mismo en PGlite, con los 3 mutantes nuevos | PASÓ: `Tests  26 passed (26)`. Cada mutante afirma el mensaje exacto de la aserción donde muere |
| **`pnpm verify` sobre `3a2510f4`** (turno del Director, de 2026-10-19 20:22:11Z a 2026-10-20 06:34:05Z, con el equipo suspendido de noche) | completo | `VERIFY_EXIT=0`: «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)». Detalle abajo |

Detalle del `verify`, copiado de su salida:
- **PASÓ:** harness, lint, rsc-boundary, typecheck, edge-functions, test, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols («0 ROJO · 1 AMARILLO declarado(s)»: la 0493), sql-tests («244 contrato(s) de SQL verificado(s) · rollback total»), schema-rebuild («469 migraciones aplicadas desde cero», «aislamiento multi-tenant verificado (barrido de 219 tablas + 2 tenants reales)», «radiografía de integridad verificada sobre el esquema completo (63 filas, conteos)»), e2e y build.
- **test:** la primera vuelta dio `Tests  9 failed | 11934 passed | 1 skipped (11944)`. Los 9 son topes de tiempo («Test timed out in 240000ms» y otros) con unos 34.500.000 ms transcurridos (≈9,6 h), el tiempo que el equipo estuvo suspendido. Cayeron en suites ajenas a esta SDD, como `billing-identity`, `portal-bandeja-avisos`, `infra/ops/tests/migraciones.test.mjs`, `borrado-embarques-recepciones` y `pin-operarios-endurecer`. El reintento dio `Tests  12039 passed | 1 skipped (12040)`.
- **e2e:** la primera vuelta dio `1 failed` (`company-photo-carousel.spec.ts:93`, «visual evidence at 390 and 1440 pixels», del sitio público) y `1 flaky` (`auth.spec.ts:81`, el token inválido de Acceso), con `176 passed`. El reintento dio `1 flaky` (el mismo carrusel) y `177 passed (3.8m)`. Ninguno es de contabilidad.
- **NO DISPONIBLE:** migrations-applied (el worktree no tiene `.env.local`). La 0493 es MIGRATE-FIRST y la aplica el Director.
| `check-pending-migration-symbols` | código alcanzable que usa la 0493 | PASÓ: «0 ROJO · 1 AMARILLO declarado(s)». La 0492 ya está sellada |
| `migrations-lock verificar` | candado | PASÓ: «3 espera(s) sin sellar (0422…, 0423…, 0493_cierre_contable_superclave) · 0 nueva(s) sin sellar» |
| `docs:check` (552 specs), `sdd:check` | documentación | PASÓ |

**Segunda vuelta (la deriva de la 0133 y la revisión de seguridad, 2026-10-20),** con turno de máquina del Director. Las filas de arriba son de antes:

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato en PostgreSQL 17 | la migración con las seis correcciones y el preflight nuevo | PASÓ: «TEST 0493 GREEN: 100 aserciones». Sin la 0493: «TEST 0493: existe public.anular_asiento_en_cierre(uuid,text,text)» |
| `cierre-contable-superclave.migration.test.ts` (PGlite) | el contrato, el control rojo, 29 mutantes, el aborto del preflight, la 0133 viva y su control rojo, la reaplicación, el recálculo, la espera y el centinela | PASÓ: `Tests  38 passed (38)` |
| `vitest run` de `app/studio/(app)/contabilidad`, `cierre-excepciones` y `rbac-actions-guard` | la app | PASÓ: `Test Files  9 passed (9)`, `Tests  506 passed (506)` |
| Mutantes de la app, restaurados por copia con la huella sha256 | se muestra cualquier 22023/42501 sin mirar el hint; el historial no dice cuánto duró el bloqueo | `MUERTOS 2/2 · restaurados 2/2` |
| `typecheck`, eslint `--max-warnings=0` (los 6 .ts/.tsx tocados) | repo y archivos tocados | PASÓ |
| `check-pending-migration-symbols` | las líneas de `actions.ts` se corrieron 5; las 12 referencias se actualizaron | PASÓ: «0 ROJO · 1 AMARILLO declarado(s)» |
| `pnpm verify` sobre `2d9238f4` (de 2026-10-20T07:17:31Z a 07:55:26Z) | completo | **FALLÓ** en `test`, `VERIFY_EXIT=1`: «[FAIL] verify: 1 fallo(s) → test». Todo lo demás medido pasó: sql-tests («244 contrato(s)»), schema-rebuild (469 migraciones), e2e (`178 passed`) y build. migrations-applied: NO DISPONIBLE. Detalle abajo |

Detalle del `test` que falló, copiado de la salida:
- **Primera vuelta:** «Failed to start forks worker … Timeout waiting for worker to respond», con 3 errores y sin ningún test rojo (`844 passed`). Es falta de memoria del equipo.
- **Reintento:** `Tests  2 failed | 12063 passed`. Los dos rojos son ajenos a contabilidad:
  - `document-entity-bitacora-task.migration.test.ts`, «Test timed out in 20000ms»;
  - `EmbarquesClient.borrado.test.tsx`, «Unable to find … "Eliminar embarques"». Es la carrera que arregla la #292.
- **Aislados,** los dos archivos pasaron dos veces seguidas: `Tests  37 passed (37)`.
- **Después** entraron a `main` la #292 y la #295. Mezclé `origin/main` `5af1e933` sin conflictos; el gate, `docs:check` y el candado dieron OK. El `pnpm verify` completo se repite sobre esa cabeza.

### Lo que destaparon las pruebas y se corrigió

1. **El mensaje de la 0133 dice «modificars» en producción:** usa `%s` dentro de un `raise`. Lo vio el primer mutante del disparador.
2. **La ayuda del motivo estaba dentro del `<label>`:** el nombre accesible del campo era «Motivo del cambioQueda en el reporte…». Ahora la ayuda va con `aria-describedby`.
3. **bcrypt usa solo 72 bytes:** con el tope de 200 caracteres, dos superclaves que comparten esos 72 bytes eran la misma. Ahora el tope es de 8 a 64 caracteres y 72 bytes, en la base y en la app.
4. **El control rojo fallaba antes de su primera aserción:** un ayudante `language sql` del contrato se valida al crearse. Pasó a plpgsql.

## Segunda vuelta: la previa falló por deriva y la revisión de seguridad (2026-10-20)

### La previa de la 0493 falló en producción sin aplicar nada (el Director, 06:36:04Z)

- **Qué pasó:** los dos triggers de la 0133 tienen en producción otro cuerpo que en el repo. El archivo se editó después de aplicarse, en la época de Cloud: el vivo no tiene los comentarios internos y no lleva tildes en los mensajes. La lógica es idéntica.
- **Reproducido aquí:** el cuerpo del repo sin sus líneas de comentario y sin las tildes de «Período», «período» y «líneas» da **exactamente** los md5 vivos que midió el Director: `26b81a55…` (903 caracteres) y `5e7e21f0…` (408).
- **Corrección:**
  - el preflight acepta dos cuerpos conocidos por trigger, el del repo y el vivo;
  - la prueba en PGlite corre el contrato entero con esa 0133 viva, y su control rojo aborta sin la huella viva;
  - la 0133 no se tocó;
  - la causa y la evidencia están en la spec y en la espera.

### Hallazgos de la revisión de seguridad (sobre `9016eadf`)

Los dos importantes venían deducidos, sin ejecutar. **Antes de corregir, los confirmé con el contrato contra la 0493 sin cambios,** en postgres:17. «ok» quiere decir que el ataque pasó:

```
H1a redondeo 0.005+0.005 contra 0.01: ok
H1a saldo guardado (debe/haber): 0.02/0.01
H1b NaN: ok
H2 sacar una línea de un asiento cerrado: ok
H3 eventos antes del DELETE: 2
H3 eventos después del DELETE: 2
```

| # | Hallazgo | Corrección | Prueba |
|---|---|---|---|
| 1 | IMPORTANTE: `crear_asiento_en_cierre` validaba antes de redondear y aceptaba NaN | cada importe con hasta 2 decimales y por debajo del tope de `numeric(14,2)`, que deja afuera a NaN e Infinity; se insertan los valores validados; lo guardado se vuelve a sumar | 4 aserciones (redondeo, NaN, Infinity y que ningún asiento del tenant descuadre); 2 mutantes; una prueba de la defensa en profundidad con su control rojo |
| 2 | IMPORTANTE: una línea se podía sacar de un asiento cerrado cambiándole `entry_id` | el disparador de líneas rechaza todo cambio de `entry_id`; ningún código lo hace, porque la app y los asientos automáticos solo insertan y leen líneas | 2 aserciones; 1 mutante |
| 3 | El DELETE de `accounting_settings` no dejaba evento | el disparador pasa a `after insert or update or delete`: la fecha va a nada y el modo vuelve a `superclave`, salvo cuando se borra el tenant entero | 3 aserciones, una de ellas con el borrado del tenant entero; 1 mutante |
| 4 | El bloqueo no escalaba | cada 5 fallidos, el doble que el anterior: 15 min, 30… con techo de 24 h; el contador no vuelve a 0 al bloquear; los textos de la app ya no dicen «15 minutos» | 8 aserciones (§11 y §12); 3 mutantes nuevos y 2 ajustados; 1 mutante de la app (la duración en el historial) |
| 5 | ERR-01: la app mostraba cualquier 22023 o 42501 | los 18 mensajes propios llevan `hint = 'dtd-cierre'`, y la app muestra solo esos | 1 aserción en el contrato y 1 mutante; 2 pruebas de las acciones y 1 mutante de la app |
| 6 | Al reaplicar decía «otro cuerpo» | la comprobación de que ya existe va antes que las huellas | prueba en PGlite: aplicada dos veces, aborta con «ya existe» |

Sobre el NaN: la comparación explícita `= 'NaN'` sobraba. Su mutante sobrevivía, porque el tope ya rechaza NaN: Postgres lo ordena por encima de todo número. Quedó solo el tope, con el comentario de por qué.

## CIERRE DEL DIRECTOR · la 0493 aplicada y la #293 fusionada (2026-10-20)

- **OK nominal de Sam**, en la sesión del Director, hacia las 08:18Z: «autorizo aplicar la migración 0493_cierre_contable_superclave en producción, aceptando la deriva de los dos triggers del cierre». Queda en `AUTORIZACION.txt` de la evidencia.
- **La deriva aceptada:** `journal_entries_validate_closing` y `journal_lines_validate_closing`, con `preparar.mjs --acepta-deriva`. En vivo difieren de la 0133 del repo solo en comentarios y tildes de los mensajes (md5 vivos `26b81a55…` y `5e7e21f0…`). El preflight propio de la 0493 acepta los dos cuerpos.
- **Previas:**
  - 06:36Z: FALLÓ por esa deriva, sin aplicar nada;
  - 07:58Z: PASÓ, sobre `cd7c006c`;
  - 08:23:46Z: PASÓ, sobre `c3e5b9d9`. Es el mismo blob después de traer main con la #294, que se fusionó a las 08:21:32Z y dejó la PR BEHIND un minuto antes del primer intento de aplicar; la guarda lo frenó sin aplicar.
- **Apply:** COMMIT a las 09:06:45Z, con la fila del ledger en la misma transacción. Evidencia: `/srv/ops/evidencias/apply-0493-dtd-cargo-20261020T090644Z`.
  - Fila del ledger: `version` 20261020090645, `name` 0493_cierre_contable_superclave, `created_by` servidor-propio:psql:SDD-0566. El ledger pasó a 497 filas.
  - md5 `b5ca301e14f3bec8401bdf0dc229393c` y 51754 bytes. La verificación dio cuerpos vivos iguales al archivo en las 16 funciones.
- **Merge** de la #293 a las 09:06:49Z, 3 s después del COMMIT (merge `b3283623`), con `--match-head-commit c3e5b9d9…`.
- **Verify** sobre `cd7c006c`: 16 de 17 sin fallos y sin reintentos; `migrations-applied` NO DISPONIBLE. CI de GitHub verde sobre `cd7c006c` y sobre `c3e5b9d9`.
- **Revisión de seguridad** (revisor de solo lectura del Director) sobre `9016eadf`: dos hallazgos importantes (el redondeo o NaN, y la línea movida de un asiento cerrado) y cuatro menores. Los seis están corregidos en `cd7c006c` (ver «Segunda vuelta»).
- **Sello:** `retirar-espera.mjs 0493_cierre_contable_superclave --md5 b5ca301e…` sacó la 0493 de `pendingBelowCutoff` y quitó una declaración de símbolos. La selló en el candado con sha256 `603a78db…` y `ledger` exacta. `migrations-lock.mjs` da 485 selladas y quedan la 0422 y la 0423. La prueba que afirmaba la espera ahora afirma lo contrario. La cabecera «NO APLICADA» no se corrige.
- **Superclave:** la define Sam cuando quiera, desde Contabilidad › Cierre. Mientras no la defina, el período cerrado sigue bloqueado como antes.

## Impacto documental y conocimiento

La spec 0566 y el índice. **Cambia el esquema** (la 0493), así que el Director tiene que publicar Graphify y Archify después de integrarla. El plan (§9 del diagnóstico) lo actualiza el Director en su PR; aquí no se tocó.

## PENDIENTES DE ESTA TAREA

1. **Hecho, A o B (spec §8):** A, según el pedido literal de Sam del 2026-10-19; B ofrecida y no elegida. El Director se la planteó a Sam con la recomendación A, y Sam no pidió cambiarla.
2. **La previa de producción, antes de aplicar** (la corre el Director). La primera, del 2026-10-20, falló por la deriva de la 0133; esta versión la acepta. Falta repetirla, y la previa genérica de `preparar.mjs` con `--acepta-deriva` sobre las dos funciones, con el OK de Sam nombrando la deriva. Los parámetros de log ya los midió el 2026-10-19.
3. **Con turno de máquina:** la segunda vuelta, en la tabla de VALIDACIÓN de abajo.
4. Hecho: la 0493 aplicada con el OK nominal de Sam y la #293 fusionada (ver CIERRE DEL DIRECTOR). Falta que Sam defina la superclave y el smoke de esa parte con su sesión.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **Los documentos que generan asientos (facturas, recibos, CxP, pagos y gastos) no pasan por la excepción.** Cada flujo necesita su RPC atómica con el mecanismo de esta SDD; se proponen como SDD de seguimiento, una por flujo. Además, **facturas, recibos, CxP y pagos ni siquiera miran el cierre en la app**: su asiento best-effort choca con el disparador y falla en silencio, y el documento queda en «Por contabilizar». El diseño de partida decía lo contrario. La spec lo deja como evidencia para la 2.2 (B3), con el `git grep` y las líneas de cada archivo.
2. **La sombra y el respaldo del fondo** del diálogo usan los mismos `rgba` del `ConfirmDialog` del sistema. Conviene pasar los dos a `var(--shadow-pop)` en una limpieza común (`/ui-check`, baja).
3. **En los ajustes del cierre**, los errores no están ligados a sus campos con `aria-describedby` y los botones no dicen «Guardando…» mientras esperan (`/ui-check`, baja).
4. **Riesgo aceptado por el Director:** un editor puede bloquear la superclave 15 minutos con 5 intentos fallidos. Cada intento queda con su usuario y el reporte lo muestra; el admin la restablece o reabre el período.
5. **Que el motivo llegue a `entity_audit_log`** por `dtd.audit_reason` es INFERIDO de la 0294: el contrato no aplica el escritor de auditoría.
6. **`auto_explain.log_parameter_max_length=0` en el servidor**, la mitigación de fondo del riesgo de logs. Es un cambio aparte, con el OK de Sam, y lo hace el Director. Mientras no esté, protegen tres cosas: el `statement_timeout` de 8 s de `authenticated`, la espera acotada y que solo `authenticated` llame a estas funciones.
7. **La ficha de un cliente eliminado pide el saldo y muestra un error** (lo encontró el Director en el smoke de la 0558 en producción, 2026-10-19). No es de esta SDD. **Destino: «SDD chica de la ficha», después de la 2.11.**
   - Abierta por URL directa (`/studio/clientes/DTD-XXXX`), la ficha de un cliente con `deleted_at` muestra «No se pudo calcular el saldo» con una referencia. El log dice `[saldo-cliente] ... la ficha no devolvió fila`.
   - Causa: `client_outstanding` filtra `c.deleted_at is null` en `asked`, así que no devuelve fila, y la página lo trata como error.
   - Lo correcto: que la ficha diga «cliente eliminado», o que no pida el saldo. El estado de cuenta del mismo cliente sí funciona y muestra bien la anulada con abono.
   - Es chico y sin migración.
