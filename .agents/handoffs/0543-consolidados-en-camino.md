# Handoff 0543 · Consolidados en camino: carga de contenedores desde el packing list

- Fecha: 2026-10-16 → 2026-10-17 (Caracas = UTC − 4)
- Owner/sesión: `6f7f92-consolidados-en-camino` (Claude Code, Worker, sesión «Cargar los consolidados en camino como llegadas a China»). Claim del harness tomado al empezar.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/suspicious-hofstadter-ccafd8`
- Rama: `claude/suspicious-hofstadter-ccafd8`, base `main` `2ad5653c` (fast-forward desde `dc84d94f` por indicación del Director).
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), `in-progress`. Número asignado por el Director; reserva `refs/heads/codex/sdd-reserve-0543-consolidados-en-camino` (`2946e8cf`), publicada por él. La reserva previa 0546 (`57e2401f`) se borró por su indicación.
- Migración: ninguna (la siguiente libre era 0492).
- Permisos: commits locales y PR en borrador contra `main` cuando el Director autorice publicar la rama. Producción no se toca. Prueba: autorización literal de Sam «autorizo cargar datos reales de los consolidados en prueba»; antes de escribir en prueba se avisó al Director y se coordinó con la sesión «Contabo VPS y dockerización de proyectos». Nunca se imprimen ni copian claves de prueba.

## OBJETIVO ORIGINAL

Cargar en el Studio los contenedores que ya zarparon (59 primero) desde los Excel de Yiwu: recepciones en China fechadas un día antes de la carga, consolidación con contenedor/naviera/ETA, envíos por cliente visibles en el Portal y una factura por cliente en borrador; probar en prueba antes de decidir producción con Sam.

## COMPLETADO

- Spec 0543 con las decisiones de Sam (2026-10-16): factura por cliente y contenedor en borrador; código de envío = Remitente; lote SQL por psql; recepciones 2026-08-10, zarpe 2026-08-11, ETA 2026-10-19; sin avisos en esta fase.
- Generador `scripts/consolidados/` (`pnpm consolidados:lote`): lectores de los dos Excel, modelo puro, cinco scripts (previa, simulacro, aplicar, verificar, deshacer) + manifiesto + resumen + SHA256SUMS. 39 pruebas unitarias sobre fixtures inventados.
- `infra/ops/consolidados/aplicar-lote.sh` (sólo `*-staging`) con su prueba bash (19 casos).
- Portal: tarjeta «por aceptar» en Mis facturas, nota en el estado de cuenta y puerta del detalle en vez de 404 (`PendingInvoiceGate`), con pruebas.
- Evento `carga_en_camino` en el catálogo de avisos (sólo catálogo y copy).
- Runbook `docs/runbooks/cargar-consolidados.md`.
- Corrida en seco del 59 (fuera del repo, `DTD-consolidados/59/2026-10-16`): lote `carga-consolidado:59:8dd77b3c` · 50 envíos · 50 recepciones · 98 items · 1.288 cajas · 33 clientes · 33 facturas · 68,811 m³ · 20.373,45 kg · base $48.652,84 (flete $47.241,75 + excesos de peso $1.411,05). 19 avisos en `resumen.md` (remitentes sin secuencia, uno con barra corregido, 7 embarques sin peso, 2 a $0, la fila de totales del Excel difiere en 3 cajas/0,043 m³/10 kg).
- `purgar.sql` (pedido del Director): borrado definitivo para prueba, físico y en orden de dependencias, incluidos los clientes y aliados que el lote creó; se niega fuera de la base de prueba (busca el cliente sintético de la semilla) y termina con conteo cero por lote. Paso `purgar --confirm-purga <id>` en `aplicar-lote.sh`. El log de auditoría (append-only, sin nombres) queda como registro.
- Revisión del Director de la PR #260 (comentario del 2026-10-17 01:53Z sobre 413d96e3; sin bloqueantes, cuatro arreglos antes de salir del borrador) atendida en `2569832c`: (1) la puerta y la página de aceptación muestran los embarques de la factura con la medida sumada (cada línea lleva `shipmentCode`; `embarques` en `PendingAcceptanceDetail`, scope de tenant); (2) los tres `raise` con `c.clave` pasan a `c.etiqueta`, la prueba cubre los cuatro, y todos los scripts ponen `set VERBOSITY terse`; (3) aplicar/simulacro/deshacer de un lote para prueba se niegan sin el cliente sintético de la semilla; (4) `createAdminClient()` dentro del `try`. Menores: (5) vacío de «Mis facturas» con sólo borradores habla de facturas emitidas y dice cuándo entran; (6) `carga_en_camino` marcado `gancho: "pendiente"` y mostrado aparte en el Studio; (7) pruebas de página (puerta vs 404; «Mis facturas» con y sin borradores), doble de `pending-acceptance` que aplica from/select/eq, control de fuga plantada en `prueba-aplicar-lote.sh`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `vitest run scripts/__tests__/consolidados-*.test.ts` | PASÓ (39) |
| `bash infra/ops/tests/prueba-aplicar-lote.sh` | PASÓ (21, con purgar) |
| `vitest run lib/portal/__tests__/pending-acceptance.test.ts`, `PendingInvoiceGate.test.tsx`, `client-notification-types.test.ts`, `app/portal/(app)/page.test.tsx`, `portal-legal-queries.test.ts` | PASÓ (41) |
| `tsc --noEmit` (proyecto completo) | PASÓ (0 errores) |
| `eslint` sobre los archivos tocados | PASÓ |
| `pnpm lint` completo | ver sección de cierre |
| `pnpm docs:check`, `pnpm sdd:check` | PASÓ |
| `/ui-check` sobre el Portal | OK para commit (un ajuste aplicado: sin monto repetido con una sola factura) |
| `pnpm verify` completo | NO EJECUTADO (corrida pesada: turno del Director) |
| Corrida local completa del lote (postgres:17 + stubs + 467 migraciones, contenedor `dtd-0543-lote59`, turno del Director, 2026-10-16 23:26Z, 32 s) | PASÓ: previa → simulacro (ROLLBACK, 0 filas) → aplicar (33 fact · 50 rec · 50 env · 1 cons · 36 cli · 3 ali) → verificar PASÓ (50/50/1288/98/33 · 68,811 m³ · 20.373,45 kg · $48.652,84) → previa repetida con conflictos 1/1/50/50/33 → aplicar repetido abortado en preflight → deshacer (vivos 0) → aplicar abortado por «códigos BORRADOS ocupados» → purgar (conteo cero) → aplicar + verificar + purgar otra vez (cero). Contenedor y volúmenes borrados (`docker ps -a`/`volume ls` filtrados: 0). Evidencia local sin nombres en `DTD-consolidados/59/2026-10-16-v5/local-20261016T232558Z/`. |
| Carga en prueba (previa → simulacro → aplicar → verificar), Contabo, `dtd-cargo-staging` | **PASÓ** el 2026-10-16 23:28:39Z–23:28:43Z con la v5 (e2cbeec0): los cuatro pasos con código 0; previa conflictos 0 y 33 marcas sin resolver; simulacro ROLLBACK; aplicar COMMIT (50 envíos · 50 recepciones · 98 items · 33 facturas · 33 clientes creados + 3 raíces de aliado); verificar PASÓ · 50 · 50 · 1288 cajas · 98 · 33 · 68.811 m³ · 20373.45 kg · $48652.84. Evidencia sin nombres en `/srv/ops/evidencias/lote-carga_consolidado_59_8dd77b3c-dtd-cargo-staging-20261016T2328{39Z-previa,39Z-simulacro,41Z-aplicar,42Z-verificar}`. Intentos previos parados en el simulacro sin dejar nada: v1 `next_markbox` (sesión), v2 guard de marcas de aliado, v3 alias `e`/`r`; v4 sólo previa. Paquete v5 en `/srv/ops/paquetes/lote-59/` (700 root) hasta el cierre; deshacer/purgar sin correr. |
| Purga de la v5 y carga de la v6 (sin exceso de peso) en prueba, Contabo, con OK del Director | **PASÓ** el 2026-10-17 00:15:55Z–00:16:23Z: purgar v5 con conteo cero (33 facturas · 50 recepciones · 50 envíos · 1 contenedor · 1 zarpe · 1 naviera · 36 clientes · 3 aliados; sin FK que abortara), `ls` del paquete vacío antes de copiar la v6, previa (0 conflictos, 33 sin resolver), simulacro ROLLBACK, aplicar COMMIT, verificar PASÓ · 50 · 50 · 1288 · 98 · 33 · 68.811 m³ · 20373.45 kg · $47241.79. Evidencia en `/srv/ops/evidencias/lote-carga_consolidado_59_8dd77b3c-dtd-cargo-staging-20261017T00{1555Z-purgar,1618Z-previa,1619Z-simulacro,1621Z-aplicar,1623Z-verificar}`. Es la carga que queda en prueba para el smoke de Sam. Paquete v6 (700 root) hasta el cierre. |
| Carga de **61, 62 y 63 (fcl)** en prueba, Contabo, con OK del Director | **PASÓ** el 2026-10-17 01:18:06Z–01:18:34Z (previa → simulacro → aplicar → verificar por lote, todos con código 0): `DTD-CONSOL-0002` (61, `MRSU9497682`), `DTD-CONSOL-0003` (62, `CMAU6782112`), `DTD-CONSOL-0004` (63, `SELU4042155`); un envío FCL del dueño por contenedor, sin recepciones ni facturas. Clientes creados: 61 → 2 (raíz `MG` + `MG-019`) y 1 aliado; 62 → 1 (`MG-020`, cuelga del `MG` que creó el 61); 63 → 1 (`DTD-9038`). Paquetes v1 (aplicar.sql `1bf4e02f…`, `87f7b117…`, `a2dee9b2…`) en `/srv/ops/paquetes/lote-6{1,2,3}` (700 root) hasta el cierre. |
| Caso local de **dos lotes que comparten aliado** (pedido del Director): 61 v2 + 62 v2 generados desde 413d96e3, `infra/ops/consolidados/validar-lote-local.sh` en 3f61e1bc, contenedor `dtd-0543-local`, 2026-10-17 01:27Z | **PASÓ**: aplicar 61 → verificar · aplicar 62 → verificar · purgar 61 **aborta** con `purgar: 1 cliente(s) de otro lote (carga-consolidado:62:3639981b) cuelgan de un aliado creado por este lote: purga ese lote primero` · purgar 62 (conteo cero) → purgar 61 (conteo cero: 2 clientes · 1 aliado). `docker ps -a`/`volume ls` filtrados: 0. Evidencia local sin nombres en `DTD-consolidados/61/2026-10-17-v2/local-20261017T012742Z/`. Una corrida anterior (01:23Z) abortó en la reconstrucción: con `MSYS_NO_PATHCONV` node no leía `LEDGER_ONLY` y corría la 0271; arreglado en 3f61e1bc (lectura con sed y guarda si la lista sale vacía). |
| Tras los arreglos de la revisión (2569832c): `vitest run` consolidados-{modelo,excel,sql}, pending-acceptance, portal-legal-queries, PendingInvoiceGate, client-notification-types, aceptar/__tests__, portada + las dos páginas nuevas | PASÓ (104 + 6 = 110) · `tsc --noEmit` PASÓ (0) · `eslint` sobre lo tocado PASÓ · `prueba-aplicar-lote.sh` PASÓ (23, con el control de fuga) · `docs:check` PASÓ |
| Paquetes regenerados desde 2569832c (mismo id de lote que los cargados en prueba): **59 v8** aplicar `f5eafe072a256dac` · verificar `04da3166f9d837ca` · purgar `dfa256e6796f35ab`; **61 v3** aplicar `19ef660b1a173038` · verificar `383af6edb08649b6` · purgar `196e94e8e80e1ec9`; **62 v3** aplicar `30fb5246b6b7fa8d` · verificar `872370a538ff70c8` · purgar `d80f5800bb7defe6`; **63 v3** aplicar `fe278f0a7753615d` · verificar `a008c41b02683e7d` · purgar `20eba7e4f7ad1f32` (sha256, 16 primeros) | Validación local en Docker (59 solo · 61+62 par · 63 solo · 60 doble v2): ver fila siguiente |
| Validación local de los paquetes regenerados (turno del Director B, 2026-10-17 ~02:40Z) | EN CURSO al escribir esta fila; resultado en la siguiente actualización |

## COMMITS

- `1b2bbf78` docs: spec, handoff y runbook
- `9e067b5a` feat(studio): generador Excel → lote SQL
- `91939b1d` chore(ops): aplicar-lote.sh + prueba bash
- `abb2805e` feat(portal): facturas por aceptar y puerta del detalle
- `d7e08db1` feat(studio): evento carga_en_camino
- `1fe981c0` feat(studio): purgar.sql · `62a1960e` `2fcbaf80` `5ced2d3b` `336cdae9` `e2cbeec0` fix(studio): el lote corre como postgres, marcas de aliado válidas, evidencia sin literales, alias del bloque DO, preflight de códigos ocupados
- `020f4400` feat(studio): modalidades fcl y mixto · `60a83de0` `b120fc91` fix(studio): columna `modo`, deshacer borra físico el gasto
- `413d96e3` feat(studio): purgar detecta lotes que dependen de este; `validar-lote-local.sh` entra al repo · `3f61e1bc` fix(ops): LEDGER_ONLY con sed
- `2569832c` fix(studio,portal): revisión del Director (arreglos 1–4 y menores 5–7)
- docs/handoff entre medio: `9fb9ec02` `575175f9` `da3ecf0a` `ae5449e4` `5cfa39d2` `d8d69c14` `3df1cb2e` `26ae2e91` `168cbe9a` `a44dca40` `67af9081` `a25faf36` `4406adf3`

## PR / BRANCH

Rama `claude/suspicious-hofstadter-ccafd8` publicada (push autorizado por el Director el 2026-10-16 ~23:05Z). PR en borrador contra `main`: [hailuwaycom-sketch/DTDCARGO#260](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/260). Sin merge: fusionar lo decide Sam (un merge a main publica solo).

## Cifras corregidas (pedido del Director)

La primera lectura a ojo decía 39 remitentes, 99 filas, 1.285 cajas y ≈ $47.210: contaba sólo las filas con marca `DTD-` y copiaba la celda de total del Excel. El generador mide fila por fila: 98 filas con Remitente (la 99.ª es la de totales), 50 remitentes (los aliados DC/MMVE/TEJ suman 11), 1.288 cajas (la SUM del Excel no cubre todas las filas: 3 cajas, 0,043 m³ y 10 kg de diferencia), flete $47.241,75 por «TOTAL FACTURADO» y $1.411,05 más de excesos de peso. Spec y handoff llevan estas cifras.

## PENDIENTES DE ESTA TAREA

- Correr el lote en prueba (Contabo) y registrar evidencia y smoke de Sam (CN, Naviera, Tracking, Facturación, Portal). Primer intento 2026-10-16 22:56Z: previa PASÓ, simulacro falló en `next_markbox` (candado de sesión); corregido en 62a1960e. Segundo intento 23:07Z (v2): previa PASÓ, simulacro falló en el guard `clients_guard_markbox_aliado_t` (un cliente de aliado exige `<cadena>-NNNN`, la marca del Excel era `DC-01-ALESS`); corregido en 2fcbaf80 (marca calculada como `next_markbox_aliado`, sin la función); paquete v3 (aplicar.sql `f6d5e86a…`) entregado a Contabo y reemplazado por el v4 (aplicar.sql `51dc5074…`, previa `68f89c12…`) tras encontrar Contabo en `previa.out` la clave `DC-01-ALESS` (texto del Excel con parte de un nombre). Lección registrada: lo que psql escribe en la evidencia del servidor son columnas proyectadas, NOTICEs y errores de la base, y los tres pueden citar literales; desde 5ced2d3b previa imprime etiquetas `PREFIJO-#n` para marcas sin número, el preflight imprime conteos y verificar no lista códigos de embarque. Contabo tapó las filas con texto en las evidencias v2 y v3 (NOTA.txt + SHA256SUMS).
- Borrado final de prueba (pedido de Sam y del Director): `purgar` (o reinicio) + borrar el paquete completo de `/srv/ops/paquetes/lote-59/` (v1 y v2: todos sus archivos llevan nombres) + la evidencia vieja con nombres (`…-20261016T225630Z/`, previa.out de la v1). Contabo confirma con nombre de carpeta y `ls` vacío. **Orden de la purga: inverso al de la carga, 63 → 62 → 61 → 59**, con OK del Director por lote: el 62 cuelga del aliado raíz `MG` que creó el 61 (FK `clients.aliado_id`); el 63 no depende del 59 (el manifiesto v6 del 59 no trae `DTD-9038`). Los `purgar.sql` que están en el servidor (59 v6, 61–63 v1) no traen el preflight de dependencias de 413d96e3: antes del cierre hay que subir paquetes regenerados (61 v2 y 62 v2 ya existen; aplicar.sql sólo cambia en la línea `-- generado <hora>`; mismo id de lote) o purgar en el orden dicho con los paquetes actuales. Tras la revisión del Director el generador cambió otra vez (2569832c: guarda de prueba, `raise` con etiquetas, `VERBOSITY terse`, `shipmentCode` por línea), así que, como él pidió, se regeneró TODO una sola vez: 59 v8, 61 v3, 62 v3 y 63 v3 (huellas en VALIDACIÓN; mismos ids de lote). El Director decide cuándo Contabo los reemplaza en el servidor; hasta entonces, si hubiera que purgar, se purga con los paquetes actuales en orden inverso.
- Decisión de Sam (2026-10-16, ~23:40Z): **sin exceso de peso** («No cobres el exceso de peso: regenera el lote del 59 con --sin-exceso-peso»). v6 generada desde 3df1cb2e con esa bandera: mismos conteos, base $47.241,79 (Excel $47.241,75; $0,04 de redondeo por cliente); validada en local a las 00:13Z (secuencia completa con purga y recarga). Huellas: aplicar.sql `dac10662…`, verificar `cd9b89dd…`, previa/deshacer/purgar iguales a la v5. Pedido al Director el OK para purgar la v5 en prueba y cargar la v6; Contabo tiene la secuencia (purgar → reemplazar paquete → previa → simulacro → aplicar → verificar) y espera ese OK.
- Decisión de Sam (2026-10-17): las dos filas a $0 de DTD-J000 entran como líneas en $0, como están (la v6 ya las trae así; sin regenerar).
- Pendientes de Sam que el lote deja a la vista: remitentes sin secuencia (`DTD-A068`, `DTD-9011`, `MMVE-41/041`) y 1.288 vs 1.285 cajas de la fila de totales (informativos; no cambian el lote).
- `pnpm verify` completo con turno del Director.
- Contenedores 60–64 (autorización de Sam al Director, 2026-10-17; spec §Decisiones 9): generador con `--modalidad ddp|fcl|mixto` (020f4400, 60a83de0, b120fc91). **61, 62 y 63 (fcl)** generados desde b120fc91, validados en local y **cargados en prueba el 2026-10-17 01:18Z** (ver VALIDACIÓN): ids `carga-consolidado:6N:3639981b`, envíos `MG-019-FCL-61`, `MG-020-FCL-62`, `DTD-9038-FCL-63`. **60 (mixto)** probado en local con el packing del 59 como doble (51 envíos, 33 facturas, 1 gasto; PASÓ); falta el packing real y el monto del gasto del aliado HR (Sam, 2026-10-17 ~02:00Z: lo manda aparte). **64 (ddp)**: falta el packing. Sam avisó el 2026-10-17 ~02:00Z que dejó los dos packing en `DTD-consolidados`, pero a las 02:05Z la carpeta no tenía ningún `.xlsx` (ni en subcarpetas; tampoco hay Excel nuevos en Descargas/Escritorio/Documentos): se le pidió la ruta exacta. Comandos previstos: 60 → `--modalidad mixto --dueno HR --packing <60> --eta 2026-10-22 --sin-exceso-peso --gasto-espacio <USD de Sam> --gasto-usuario <usuario del Studio de prueba>`; 64 → `--packing <64> --eta 2026-12-02 --sin-exceso-peso` (misma regla que el 59; el resumen trae el exceso para que Sam decida). Validar cada uno con `validar-lote-local.sh` (turno del Director), huellas al Director, Contabo carga. La bodega pendiente de China: después.
- Producción, flip de `TRACKING_EN_CONSTRUCCION`, emisión automática al aceptar y el aviso `carga_en_camino`: se deciden con Sam después del 59.

## FUERA DE ALCANCE DETECTADO

- `changeReceiptStatusAction` consolida contra un envío `C-YYYY-NNNN` sin cliente que el Portal no ve (`lib/studio/expense-alerts-queries.ts:88-135`).
- No hay acción para darle dueño a una recepción huérfana (migr 0469:114-122).
- `docs/runbooks/aplicar-migraciones-prod.md` sigue describiendo Supabase Cloud y no hay procedimiento para cargas de datos en el VPS.
- `MARKBOX_REGEX` (`lib/studio/markbox-utils.ts:18`) deja fuera marcas legadas y de aliados.
- Comisiones por agente del Excel (`Agente`, `GANANCIA POR ENVIO`) no tienen entidad en el ERP.
- `scripts/next-number.mjs --reserve` deja también `refs/dtd/reservations/NNNN`; al borrar una reserva abandonada hay que borrar las dos refs.
- La aceptación de T&C sella la medida del PRIMER envío (`shipment_code`, SDD-0054, `aceptar/actions.ts`) aunque la factura cubra varios embarques; desde 2569832c la pantalla muestra la suma y los códigos, pero el sello no cambió. Cambiarlo toca el gate AUT-04 y es decisión aparte.
- El doble de docker de `prueba-aplicar-lote.sh` no corre psql: la higiene de nombres de la evidencia se prueba en `consolidados-sql.test.ts` y el guion bash sólo comprueba que copia la salida tal cual (control de fuga plantada).

## HANDOFF AL DIRECTOR

1. Autorizar publicar la rama y abrir la PR en borrador.
2. Turno para `pnpm verify` completo.
3. Smoke de Sam sobre prueba (59 DDP + 61–63 FCL). Después, con Sam: producción, flip de `TRACKING_EN_CONSTRUCCION`, emisión al aceptar, aviso.
4. OK para que Contabo reemplace los paquetes del servidor por los regenerados desde 2569832c (59 v8, 61 v3, 62 v3, 63 v3; huellas en VALIDACIÓN; el paquete viejo se borra entero porque lleva nombres) y, al cierre, OK por lote para purgar en orden 63 → 62 → 61 → 59.
6. `pnpm verify` completo con la cabeza que salga del borrador (turno concedido tras los arreglos): resultado por comprobación en VALIDACIÓN; si pasa de 60 min se para y se avisa.
7. Sacar la PR #260 del borrador cuando el Director dé por buenos los arreglos y el verify.
5. 60 y 64: turno de Docker para validarlos cuando lleguen los Excel y el monto de HR.
