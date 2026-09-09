# PR #29 — revisión y replay local de la migración 0448

- Fecha: 2026-09-06.
- Task ID: `pr29-replay-validation-20260906`.
- Owner / sesión: Worker `01a073a6-f21d-7483-9b74-4d9f3464c295`.
- Director: `01a073cc-1278-7422-81da-9f85c2fff047`.
- Worktree: `<local>/DTD-worktrees/pr29-replay-validation-20260906`.
- Rama: `codex/pr29-replay-validation-20260906`.
- Base revalidada: `origin/main` = `74bb52ab9677f96908cc032a15f2364ab9d94716`.
- PR fuente: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/29, HEAD `4af6aac1223f008ffb58f7e161d601b1317ef243`.
- SDD: `0440`, leída desde el blob de PR #28 `80eea11e88120f0fb6a074a67c733e6bd19c6e59:docs/specs/0440-e2e-harness-general-determinista/spec.md`; sin copiar ni numerar otra spec.
- Estado: lista-para-revision; P2 corregido y validado localmente; release pendiente de Director/autorización.

## Objetivo y aceptación

Revisar el DDL/ACL completo y contrastar el artefacto 0448 con sus pruebas y
las migraciones históricas 0222/0223. Medir conservación de valores reales,
idempotencia, firma de diez campos, retiro de `peso_max_kg`, tipos, nulos,
constraints y consecuencias de eliminar/recrear la RPC. Ejecutar los contratos
SQL existentes y el rebuild completo sobre la combinación exacta con main,
usando Postgres 17 local desechable y evidencia de SHA/log/hash. Documentar
compatibilidad y requisitos de release; un fallo se reproduce y diagnostica,
sin debilitar el gate ni corregir producto fuera de autorización.

## Alcance exacto y permisos

Importación local del PR #29 (tres archivos originales) más este handoff:

- `.agents/handoffs/2026-09-05-restore-0223-history-close.md`
- `supabase/migrations/0448_restore_calculator_settings_0223_history.sql`
- `supabase/tests/0448_restore_calculator_settings_0223_history.test.sql`
- `.agents/handoffs/pr29-replay-validation-20260906.md`

Autorización inicial: worktree nuevo, claim, merge local del HEAD fuente revalidado,
pruebas SQL acotadas en contenedores exclusivos de este árbol, dependencias
con lockfile congelado si hacen falta y commits selectivos del handoff.
La asignación inicial no autorizó correcciones de producto, push, integración en main,
Cloud, costos, credenciales/ledger/PII de producción ni cleanup de worktrees.
El merge local conservó los tres archivos originales. La ampliación posterior
autoriza exclusivamente corregir 0448, su test y este handoff (detalle abajo).

## Dependencias y coordinación

Orden #29 → #28. No integrar #28 en esta unidad. El worktree PR #24 queda
intacto y liberado. No ejecutar build/E2E mientras #30 hace su focal; SQL local
acotado sí está autorizado. Aplicadas las skills Worker y Supabase y leído el
runbook vigente `docs/runbooks/aplicar-migraciones-prod.md`.

## Autorización y revisión inicial del artefacto publicado

### Ampliación autorizada después de la revisión inicial

Director informó en esta sesión que consultó únicamente metadatos
`list_migrations` del proyecto productivo y no encontró
`0448_restore_calculator_settings_0223_history`. Es evidencia comunicada por
Director, no una consulta productiva ejecutada por este Worker. Autorizó editar
la migración 0448 todavía no registrada, su test y este handoff, conservando
ID/SDD y sin tocar otros artefactos. Objetivo: CHECK positivo efectivo y validado
ante homónimo débil/NOT VALID, preservación de datos válidos, abortos atómicos
ante inválidos, idempotencia y firma/ACL intactas. Primero regresión contractual
roja sobre el SQL original; luego corrección, SQL completo/rebuild y revisión del
SHA. Commit local autorizado; push/Cloud/producción siguen excluidos.

La revisión inicial de la combinación local reprodujo el estado canónico histórico y
conserva los valores configurados de las columnas vigentes. Pasaron los 140
contratos SQL y la reconstrucción completa. Una prueba adicional demuestra
que la convergencia no está garantizada frente a un constraint homónimo con
otra expresión: el artefacto lo acepta sin validarlo y permite pesos negativos.
No se afirma que ese drift exista en Producción: no se consultó.

El commit de combinación `3664e903` dejó los tres archivos importados idénticos
al HEAD `4af6aac1`. La corrección posterior `1e31b9a3` cambia únicamente 0448
y su test. No se tocaron 0222/0223 ni se incorporó PR #28.

## P2 del artefacto original — corregido localmente en 1e31b9a3

- Archivo: `supabase/migrations/0448_restore_calculator_settings_0223_history.sql`,
  líneas 57–68; postflight líneas 115–159 no verifica el CHECK.
- Disparador reproducido: `peso_max_envio_kg numeric` con valores positivos y
  `calculator_settings_peso_max_envio_kg_check CHECK (true)` preexistente.
- Resultado: el SQL real de 0448 termina con exit 0; el constraint sigue siendo
  `CHECK (true)`. Luego `UPDATE ... SET peso_max_envio_kg = -1` tiene éxito y
  `public_calculator_config()` devuelve `-1`, también al invocarla como `anon`.
- El test publicado (líneas 143–152) comprueba nombre y tipo `c`, pero no
  expresión, columnas ni estado validado. Los 140 contratos no cubren este caso.
- Variante medida: con el CHECK positivo correcto pero `NOT VALID`, la 0448
  termina con `convalidated=false`. Este CHECK sí protege escrituras nuevas;
  la variante no equivale a permitir negativos, pero no converge al catálogo
  validado que produce 0223.
- Propuesta surgida de la revisión inicial: comprobar tipo, columnas,
  expresión y validación del constraint; ante drift, abortar explícitamente antes
  del DDL o restaurar el contrato canónico conforme al alcance aprobado. Añadir
  regresión que aplique el archivo real y compruebe rechazo de cero/negativos,
  además de la aceptación de la configuración existente. Implementación autorizada
  y evidencia rojo/verde descritas en el resultado final, más abajo.

Evidencia: `probes/weak-check-setup.sql`, `weak-check-apply.sql` y sus logs,
`weak-check-negative-write.log` y `results.json` en el directorio de evidencia
absoluto indicado abajo. Hallazgo enviado al Director antes de cualquier
ampliación de producto. Clasificación: no conformidad del contrato de
convergencia declarado por el artefacto; no es diagnóstico del estado productivo.

## Matriz inicial de revisión DDL, datos y ACL (3664e903)

| Escenario medido en fixtures sintéticos locales | Resultado |
|---|---|
| Replay anterior a 0222/0223, dos tenants con ajustes diferentes | Crea `numeric NOT NULL DEFAULT 9000`, elimina `peso_max_kg` y su CHECK cruzado; conserva los demás valores. |
| Segunda ejecución después de configurar 7777 y 8888 | Ambas filas vigentes se conservan; idempotencia de datos, no de identidad/OID de función. |
| Aplicación de los archivos reales 0222 y 0223, luego 0448 | Filas completas iguales antes/después, misma firma ordenada de diez columnas `numeric`; CHECK positivo validado. |
| Tipo `text` preexistente | Falla el preflight con mensaje propio; rollback integral. |
| Columna `numeric` existente con nulos | Falla `SET NOT NULL` (línea 55), no el preflight; rollback integral usando transacción única. No rellena nulos ni inventa valores. |
| Valor no positivo existente | Falla el preflight; rollback integral. |
| CHECK homónimo débil / no validado | Hallazgo P2 y variante descritos arriba. |
| Vista dependiente de la RPC | `DROP FUNCTION` falla con RESTRICT; rollback integral. No hay CASCADE. |
| Default personalizado 12345, filas 7777/8888 | Filas preservadas; default cambia a 9000 para escrituras futuras. |
| Owner y grant adicional personalizados | Owner pasa de `probe_owner` al ejecutor `postgres`; se pierde el grant explícito a `probe_consumer`. Datos y firma se conservan. |

En los cuatro abortos esperados se comparó el snapshot completo de filas,
columnas/defaults, constraints y RPC (incluido OID, owner, ACL y cuerpo):
igualdad exacta antes/después. Son abortos esperados de las sondas, no fallos
del runner canónico. Cada invocación de 0448 usó `psql --single-transaction`
con `ON_ERROR_STOP=1`.

Contrato RPC: diez campos numéricos, sin `tenant_id` ni PII; `STABLE`,
`SECURITY DEFINER`, `search_path=public`, tablas con schema explícito, filtro
`tenant.slug='dtd'` y una fila por tenant. Se invocó realmente como `anon`:
solo devolvió la configuración dtd, no la del segundo tenant; sin fila dtd
devolvió cero filas. Se verificó ausencia de EXECUTE para PUBLIC y grants
explícitos a anon/authenticated. El estado histórico 0223 conserva PUBLIC
por el default de creación; 0448 lo revoca explícitamente.

`DROP/CREATE` reemplaza la identidad de la función aun cuando ya tenga la firma
correcta. No conserva owner ni ACL personalizados, comentario ni dependencias
externas automáticamente. Los grants por defecto del ejecutor también cuentan:
0033 concede funciones futuras a `service_role`; el fixture reducido del test
0448 no reproduce ese default. Por ello no se afirma que los dos grants
explícitos sean el inventario completo de privilegios de un entorno real.
Las tablas, sus grants/RLS y triggers no se reescriben en 0448.

## Compatibilidad y condiciones de release

1. Director revisa la corrección local P2 y su SHA completo antes de aprobar
   integración. La ampliación ya autorizó el cambio y su nueva validación.
2. Revalidar base/head y combinar antes de integrar: esta evidencia solo cubre
   main `74bb52ab` + PR #29 `4af6aac1` + corrección local `1e31b9a3`.
3. El runbook exige autorización nominal independiente para
   `0448_restore_calculator_settings_0223_history`; PR/merge no autorizan Cloud.
   No se leyó ledger, credenciales ni filas productivas para esta revisión.
4. Antes de aplicar, revisar metadatos autorizados de columna/default/constraint,
   owner, ACL, dependencias y ejecutor. La operación requiere transacción única:
   en autocommit un fallo tardío podría dejar la RPC eliminada. Las operaciones
   ALTER TABLE necesitan locks; planificar la ventana y comprobar postcondiciones.
5. Estado anterior esperado: si ya refleja 0222/0223, no cambian los valores
   guardados; sobre replay anterior aparece 9000 y se retira la columna antigua.
   Default personalizado y ACL/owner no están cubiertos por «sin cambios».
6. `lib/public/rates-queries.ts:116` usa un fallback cuando falta el campo nuevo.
   Los lectores de Studio ya seleccionan `peso_max_envio_kg`. PR #28 exige esa
   columna en el preflight y normaliza los diez defaults solo en su entorno
   efímero autorizado. Mantener #29 → #28 y no trasladar esa normalización a prod.
7. No hay rollback SQL genérico demostrado. Retirar `peso_max_kg` elimina su
   contenido; revertir archivos no lo recupera. Una incidencia exige revisión
   concreta de compatibilidad y recuperación/forward fix. No reescribir ni
   renumerar una migración aplicada.

La reconstrucción local ejecuta los archivos 0222/0223 del repositorio; no es
una reconstrucción del ledger Cloud. El fixture anterior a esos cambios aporta
la comprobación complementaria, pero no reemplaza el futuro replay hospedado
y los E2E de SDD-0440, sujetos a su autorización de entorno/costo.

Referencias primarias consultadas para contrastar la semántica, además del
changelog Supabase: [ALTER TABLE PostgreSQL 17](https://www.postgresql.org/docs/17/sql-altertable.html),
[CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html) y
[DROP FUNCTION](https://www.postgresql.org/docs/17/sql-dropfunction.html).

## Validación inicial y evidencia durable (3664e903)

SHA medido: `3664e90384a245fd748f7e804774da951f13879b`, merge sin conflicto de
main y HEAD fuente. Node 24.19.0; PostgreSQL 17.11 local (Debian); imagen
`postgres@sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`.

| Comando / alcance | Resultado |
|---|---|
| `node scripts/run-sql-tests.mjs` | PASÓ, 140/140, exit 0, 95.305 ms. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ, 399 archivos; 381 aplicadas + 18 solo-ledger, aislamiento 219 tablas/2 tenants, exit 0, 53.247 ms. |
| Sondas DDL externas al repo | 10 escenarios completados; 4 abortos esperados con rollback; un P2 reproducido. No se presentan como diez contratos de producto aprobados. |
| `node scripts/check-numbering.mjs` | PASÓ; 310 specs/399 migraciones, 0448 sin colisión nueva. Conserva excepciones históricas del gate. |
| `node scripts/build-docs-index.mjs --check` | PASÓ, exit 0. |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ, 28 políticas aprobadas/cápsula vigente. |
| `node scripts/validate-component-registry.mjs` | NO DISPONIBLE: `ERR_MODULE_NOT_FOUND: ajv`, exit 1 en árbol sin dependencias. Sin cambios de UI/componentes; no se instaló el árbol completo para esta revisión SQL. |
| Build, Vitest general y E2E | NO EJECUTADO: revisión SQL acotada, sin autoría de producto; build/E2E excluidos durante focal #30. |
| Ledger/replay hospedado/aplicación productiva | NO EJECUTADO: fuera de autorización. |

Evidencia absoluta:
`<local>/DTD-backups/pr29-replay-validation-20260906/`.
Contiene runners, SQL exacto de cada sonda, snapshots, logs y resultados JSON.

| Artefacto | SHA-256 |
|---|---|
| `sql-tests.log` | `b4db74bcfbd3ffd2bb3ec6aa7d73e51702f0d1ca9192315a9692e155bb922b40` |
| `schema-rebuild.log` | `b48862adb5baf224f3cc5cf725223c9283302a68739957eda83ac14c47257a23` |
| `validation.json` | `083140befa1294172c33ee1144bda80c1d3cfd077fcb2966d1af4f62086b625b` |
| `probes/results.json` | `5b0d97d9e40f0b1627b666d8e7388ccb14cdf19a4c014f453c05cb416ed27812` |
| `probes/hashes.json` | `dbed23fbda0b9ec0e447064c2046c6b83ca6f59bd502a00dc8f4078cf1abddfd` |
| Archivo SQL 0448, bytes locales CRLF | `5380e42c7adf8e8eec25cc2bb4242d6845f70cf0dd6c5d71f9ea48ae0b582c68` |
| Test SQL 0448, bytes locales CRLF | `175922b18529f325185cfd30cc7e7629571abefbb5836aeb3e00fcbd84a1c13e` |

Contenedores exclusivos verificados ausentes antes del arranque:
`dtd_sqltest_c9022d13`, `dtd_rebuild_c9022d13`, `dtd_pr29_probe_c9022d13`.
Los runners retiraron únicamente sus propios contenedores desechables; al
terminar, los tres estaban ausentes. No se instalaron dependencias ni se
copiaron credenciales. Worktree PR #24 preservado.

## Corrección autorizada y prueba rojo/verde

Commit de producto: `1e31b9a31400973e0a25f781b2b539dbdbb8ca44`; dos archivos,
140 inserciones y 14 eliminaciones. No modifica el cuerpo/firma/grants de la RPC.

Decisión: reparación determinista. La 0448 retira únicamente el CHECK con el
nombre canónico y vuelve a crearlo con `peso_max_envio_kg > 0`, validando todas
las filas. Un objeto homónimo que no sea CHECK provoca un aborto de preflight,
sin retirar PK/UNIQUE/FK. El postflight exige CHECK validado. Se conservan todos
los demás constraints y no se actualizan datos existentes.

Tradeoff: un CHECK personalizado más restrictivo que reutilice ese nombre
también converge a la regla canónica positiva. No se intenta interpretar ni
conservar una expresión divergente. El inventario previo a release debe detectar
personalizaciones y dependencias antes de autorizar su sustitución. Cada
reaplicación reconstruye ese CHECK y su OID; la idempotencia garantizada es de
datos y contrato. El archivo completo requiere transacción única, igual que el
runner de rebuild; no usar SQL Editor en autocommit.

El test de regresión aplica el archivo real frente a CHECK(true), NOT VALID y
una reaplicación. Intenta UPDATE negativo, cero y nulo; usa subtransacciones
para recuperar incluso una escritura incorrectamente aceptada y reportar ambos
escenarios juntos. Comprueba validación y conservación de 7777. Finalmente
invoca realmente la RPC como anon y exige diez campos y el valor conservado.

- Rojo: test nuevo + SQL original, psql exit 3. Reporta `homonimo_debil:
  negative=false, zero=false` y `not_valid: validated=false` (también reaplicado).
- Verde focal: el mismo test, sin modificar sus expectativas, + SQL corregido,
  psql exit 0 y rollback del fixture.
- `red-contract.json` y `green-contract.json` conservan los hashes exactos de
  ambos artefactos; los resultados referencian HEAD anterior porque el cambio
  aún estaba en el working tree. El SHA de producto posterior fija esa versión.
- SHA-256 log rojo: `414674355be6ef3f2e77184e771878960a6ef4f7f629bae66301b20d3d2f56af`.
- SHA-256 log verde: `8d412bdb51a8271f3c39fd7be986b5905cdb6dbb77a8f243883cb810a2abc695`.

Validación completa sobre `1e31b9a3` terminada; evidencia nueva en
`<local>/DTD-backups/pr29-replay-validation-20260906/post-fix/`.

| Comprobación final | Resultado |
|---|---|
| SQL canónico | PASÓ, 140/140, exit 0, 58.409 ms. Incluye el contrato ampliado 0448. |
| Rebuild canónico | PASÓ, 381 migraciones + 18 solo-ledger, aislamiento 219 tablas/2 tenants, exit 0, 49.939 ms. |
| Sondas sobre artefacto corregido | 12 completadas: los diez escenarios iniciales más homónimo UNIQUE e inválido bajo CHECK(true). Seis abortos esperados; seis snapshots antes/después idénticos. |
| CHECK débil y NOT VALID después del fix | Reparados a `CHECK ((peso_max_envio_kg > (0)::numeric))`, `convalidated=true`. Negativo rechazado por CHECK; RPC anon sigue devolviendo 7777. |
| Preservación e idempotencia | 0222/0223→0448 conserva todas las filas; reaplicación conserva 7777/8888 y resto de parámetros. |
| RPC/ACL | Diez campos, solo dtd, PUBLIC sin EXECUTE; no cambio de su definición/firma/grants en el diff del fix. |
| Scope y Git | Solo dos archivos de producto autorizados + este handoff; histórico del PR importado sin editar. `git diff --check` correcto. |
| Remoto al cierre | PR #29 OPEN/HEAD `4af6aac1`, main `74bb52ab`, confirmados por GitHub y `git ls-remote`. |

SHA-256 de la evidencia posterior:

- `post-fix/validation.json`: `7c7c4a50129deab705e72510eb479d20f0ff119ff8595cbd5ff45d2e31155803`.
- `post-fix/probes/results.json`: `fd2857eccbfd7f4076f26ad34798e2200d24f11d091b5e1e5cbfba8586f4a50b`.
- `post-fix/probes/hashes.json`: `d8219e29c77a7abad3361707bf58389f1d6d09f1e39d4b1ebcdf22d23c0a70b9`.
- Migración corregida, bytes locales: `146d82978778894db6362af3ac49e385bba56282e0ac3ddc4b2c3e23c3941ae8`.
- Test ampliado, bytes locales: `dce9471f282fb811af26d1ad761bf3ab9179045c82aaf064927e8cf4b246e38a`.

Los logs canónicos iniciales y finales tienen las mismas huellas porque sus
resúmenes imprimen nombres y conteos, no el contenido SQL. `validation.json`
identifica el SHA medido; las huellas de SQL/test y los SQL/logs de las sondas
permiten distinguir y reproducir los artefactos. Las evidencias iniciales no
fueron sobrescritas. Al cerrar las corridas no quedan contenedores de esta tarea.

Gobernanza aplicable: SGE-00.02 cumplimiento (valores preservados/rollback);
SGE-00.05 cumplimiento (RPC pública mínima y filtro dtd); SGE-00.06/07
cumplimiento (pruebas negativas y ausencia de éxito sin protección);
SGE-00.12 cumplimiento (ampliación explícita, producción pendiente de permiso).
AUD-01 y MP-01 no aplica a eventos de producto: no se agrega captura, borrado de
datos personales ni un flujo operativo nuevo. La evidencia de migración/release
se conserva por el procedimiento específico y no se reemplaza por un mensaje.

## Cierre Worker

- **OBJETIVO ORIGINAL:** revisar y validar PR #29/0448 localmente; tras ampliación
  explícita, corregir la falsa convergencia del CHECK sin aplicar Cloud.
- **COMPLETADO:** revisión DDL/ACL/historia; reproducción contractual roja de los
  dos casos; reparación determinista con preflight y postflight; contrato verde,
  SQL completo/rebuild y doce sondas con evidencia durable. P2 resuelto localmente.
- **VALIDACIÓN:** PASÓ sobre `1e31b9a3` lo descrito en la tabla final. Numeración,
  docs y gobernanza pasaron en la combinación y sus entradas no cambiaron.
  Components NO DISPONIBLE por ajv ausente; no se modificaron UI/componentes.
  Build/E2E/Vitest general/ledger/Cloud NO EJECUTADOS por el alcance acordado.
- **COMMITS:** `3664e90384a245fd748f7e804774da951f13879b` combina fuentes;
  `1e31b9a31400973e0a25f781b2b539dbdbb8ca44` corrige migración/test; el commit
  que contiene este documento registra revisión, autorización y evidencia.
- **PR / BRANCH:** fuente https://github.com/hailuwaycom-sketch/DTDCARGO/pull/29;
  rama local `codex/pr29-replay-validation-20260906`, base `74bb52ab`.
  No se publicó rama nueva ni cambió el HEAD remoto.
- **PENDIENTES DE ESTA TAREA:** revisión del Director sobre el SHA completo y
  decisión de publicación/integración. Implementación y validación local
  autorizadas terminadas; no queda un defecto conocido del CHECK por corregir.
- **FUERA DE ALCANCE DETECTADO:** dependencias npm para components, validación
  Cloud/ledger, aplicación nominal y E2E hospedados. No se afirmó drift productivo.
- **HANDOFF AL DIRECTOR:** mantener #29 → #28; revisar el tradeoff de sustituir
  el CHECK homónimo y los requisitos de release antes de pedir autorización
  nominal separada. Sin push/main/Cloud/cleanup; PR #24 y principal preservados.
  Ownership se libera después del commit documental final; el árbol queda para
  revisión. La confirmación y SHA final se envían al Director al completar release.
