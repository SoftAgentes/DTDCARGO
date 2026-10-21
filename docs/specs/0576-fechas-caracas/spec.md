---
sdd: "0576"
title: "Fechas de operaciones en America/Caracas — C1"
status: draft
author: "Codex"
created: 2026-10-21
updated: 2026-10-21
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# SDD-0576 — Fechas de operaciones en America/Caracas — C1

## Objetivo y autoridad

Las operaciones nuevas y sus lectores inmediatos usan el día de negocio de
America/Caracas. A las 02:30Z del 21 de octubre de 2026 todavía es día 20 en
Caracas. Se conservan fechas explícitas, instantes UTC de auditoría, importes,
IVA, filtros, estados, permisos y la historia contable existente.

Asignación del Director del 2026-10-21: contrato completo reproducido en
`.agents/handoffs/0576-fechas-caracas-operaciones.md`, fuente externa
`C:/tmp/director-traspaso-20261020/0576-caracas-c1-asignacion-worker.md`, SHA256
`f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff`.
Base `8729f7f4a3349b9b553c045c15a6adb37c943b98` de la PR #311; se adopta la
reserva `58beb2ce3bfb37cdddf070876e54468e0b5a6d2f` mediante cherry-pick selectivo.
La migración asignada es **0499_fechas_caracas_operaciones**, sin aplicación real.

## Contrato funcional

- Primitiva pura compartida con zona IANA, calendario e instante estrictos,
  reloj inyectable y límites de día/mes `[inicio, fin)`. Nunca interpretar una
  fecha sin hora como instante ni extender el offset actual a toda la historia.
- Capturar una sola ancla antes de esperas y reutilizar su día en tasa,
  documento y asiento. Omitir una fecha programáticamente puede usar el día
  predeterminado; un campo explícitamente vacío es inválido. Conservar fechas
  elegidas e instantes de auditoría.
- Facturas preservan CAS, override explícito, tasa VES del día y aviso con tasa
  persistida. La emisión desde orden usa `issued_at` retornado por SQL. Solo si
  ese campo está ausente en una base anterior se permite readback estricto de
  la misma factura/tenant; error, ausencia, ambigüedad o dato inválido dejan el
  asiento pendiente, sin inventar fecha ni repetir la emisión.
- Los nueve fallbacks de los ocho posters usan Caracas solo al omitir
  `entryDate`. Identificación conserva la fecha real del recibo. Depreciación
  por mes y `posted_at` permanecen iguales.
- Gastos nuevos persisten el mismo instante capturado antes del guard.
  Lecturas de día/mes usan ambos límites. CSV y filas muestran el día Caracas.
  Ediciones leen estrictamente origen, cierre y cero/uno asiento vivo del
  tenant antes de mutar. Si repostear cambiaría la fecha del asiento existente,
  se bloquea con explicación persistente y una vía de corrección gobernada.
  Lectura fallida, múltiple o incoherente no significa ausencia ni período abierto.
- Portal rechaza fechas futuras Caracas en nueva creación antes de subir
  evidencia. El contexto obligatorio `new`/`recovery-candidate` se decide
  server-side después de autorización y lookup del reporte propio, nunca por
  una bandera pública. Recuperación verifica bytes del objeto anterior sin
  recrearlo. SQL autoriza replay idéntico por actor, tenant, identidad e input
  hash; todo intento de creación nuevo conserva la guarda de frescura.
- 0499 cambia únicamente defaults/fallbacks/guardas temporales vigentes y el
  retorno aditivo de emisión. Conserva cuerpos completos, identidades,
  privilegios, locks y auditoría. 0467/0468 siguen SECURITY INVOKER con EXECUTE
  authenticated y sin permiso service_role; 0128 sigue service-only. No hay
  RPC público nuevo de reloj, ni edición de migraciones aplicadas.

## Alcance y convivencia

El contrato original contiene 60 rutas; los addenda del Director amplían la
allowlist exacta vigente a **68 rutas**, adoptadas antes de sus cambios de
producto y reproducida íntegramente en el handoff. El índice SDD se genera;
las declaraciones de símbolos pendientes solo ajustan sitios/anclas reales.
No se editan rutas adicionales sin decisión del Director.

MIGRATE-FIRST es obligatorio. El readback de 0128 permite convivencia sin
inventar fecha. Callers antiguos con fecha UTC explícita conservan sus bytes:
no se certifica coherencia general hasta retirar la versión antigua y comprobar
los recorridos. C2 (anclajes anuales de b), BCV, 2.3, recibos 2.7, 0575,
históricos, cambios de dinero, integración, despliegue y DB real quedan fuera.

## Aceptación y validación prevista

ROJO funcional antes de corregir UTC, cambio entre awaits, límite superior de
gastos, re-fecha implícita, replay bloqueado y creación futura admitida. Casos
02:30Z/03:59:59.999Z/04:00Z, mes/año/bisiesto, distintos TZ, fecha explícita,
vacía e inválida e historia IANA. Se conservan los contratos monetarios de b.

SQL y HTTP sintéticos cargan primero 0499 intacta y verifican hash/defaults,
firmas/owner/ACL/auth/tenant/locks/auditoría. La fase determinista instrumenta
solo el reloj en copias, con anclas exactas y aborto ante deriva. Los negativos
de replay verifican ausencia de nuevas mutaciones y evidencia. PGlite no se
presenta como PostgreSQL ni como JWT/HTTP.

Mutantes funcionales con restauración comprobada; tipos/lint/docs; fixtures
reales y revisión visual acotada; `pnpm verify` serial sobre SHA guardado.
PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE se informan por evidencia y SHA, con cada
SKIP. Estado actual: **APP implementada con controles focales; SQL/HTTP,
mutantes, navegador y verify pendientes**, sin aceptación de release ni
afirmación de producción. La validación detallada vive en el handoff propio.

## Gobernanza (SGE-00, doce principios)

| Principio | Clasificación inicial | Evidencia requerida |
|---|---|---|
| SGE-00.01 Acción predecible | Pendiente de evidencia | Mismo verbo/resultado; diferencia entre nuevo y recuperación explícita |
| SGE-00.02 Conservar trabajo | Pendiente de evidencia | Identidad/payload/prueba del intento incierto conservados |
| SGE-00.03 Fricción proporcional | Pendiente de evidencia | Mutación financiera R3; guardas sin confirmaciones nuevas rutinarias |
| SGE-00.04 Auditoría | Pendiente de evidencia | SQL conserva actor, tenant, request, evento y reloj UTC |
| SGE-00.05 Permisos y estados | Pendiente de evidencia | Guards, tenant y ACL intactos; período cerrado y negativos SQL/HTTP |
| SGE-00.06 Prevención | Pendiente de evidencia | DAT/FRM: vacío inválido y futuro nuevo bloqueado antes de evidencia |
| SGE-00.07 Estado verdadero | Pendiente de evidencia | Replay no inferido por existencia; lectura fallida no es ausencia |
| SGE-00.08 Frecuencia y complejidad | Pendiente de evidencia | Sin pasos ni campos nuevos; límite de convivencia explícito |
| SGE-00.09 Reutilización | Pendiente de evidencia | Helper compartido y wrappers compatibles; componentes existentes |
| SGE-00.10 Accesibilidad | Pendiente de evidencia | A11Y: teclado, 390px y zoom; límites de fixture explícitos |
| SGE-00.11 Lenguaje | Pendiente de evidencia | ERR-01: recuperación explícita y mensajes sanitizados persistentes |
| SGE-00.12 Autoridad humana | Cumplimiento del límite operativo | Encargo autorizado; PR borrador, sin merge, despliegue ni DB real |

NUM-01: no se cambian importes, redondeos ni la semántica de incompletitud de b.
La matriz se cotejará contra los identificadores y evidencia de las políticas
vigentes al cerrar; «pendiente» no es cumplimiento demostrado.

## Addendum íntegro del Director · 60 → 64 rutas
# C1 · ampliación autorizada por el Director a 64 rutas

Contrato vigente: `0576-caracas-c1-asignacion-worker.md`, SHA256 `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff`. Se conserva íntegro y este addendum se agrega a la spec y al handoff del mismo Worker antes de editar las cuatro rutas nuevas. Mismo owner, rama, worktree, base y turno; no crea una segunda tarea ni cambia la migración 0499.

## Decisión autorizada

El Director revisó las fuentes por objetos de la base `8729f7f4`: `registerCollectionFor` lee la factura antes de validar el input y los wrappers de Cobranzas/Tesorería esperan sesión y permiso antes de delegar. Una fecha omitida puede resolverse después de cruzar medianoche. Es una omisión concreta del alcance original, porque su aceptación ya exige capturar el día antes de las esperas.

Se autorizan exactamente estas cuatro rutas adicionales; la allowlist pasa de 60 a **64 rutas**:

```text
lib/studio/collections-actions.ts
app/studio/(app)/cobranzas/actions.ts
app/studio/(app)/tesoreria/actions.ts
lib/studio/__tests__/fechas-caracas-actions.test.ts
```

Alcance limitado a `registerCollectionFor`, los wrappers `registerCollection` y `registerUnidentifiedPayment` de Cobranzas, y `createBill`/`registerPayment` de Tesorería. El cambio resuelve `receivedAt`, `issueDate` o `paidAt` **solo cuando está omitida** al entrar y antes del primer await, y propaga esa misma fecha al delegado. No se toca otra acción de esos archivos. Las correcciones de los delegados ya incluidos en las 60 rutas conservan su alcance original.

## Criterios y límites

- Fecha explícita, vacía o inválida conserva su valor hasta la validación existente; no convertir vacío/null en hoy ni normalizar calendario.
- Captura pura del reloj antes de esperar, sin adelantar lecturas de negocio, mutaciones, correlativos, evidencias ni permisos. Conservar sesión/RBAC/RLS/tenant y su resultado de denegación antes de los efectos existentes.
- Propagar la fecha elegida sin recapturar un fallback más abajo. Conservar importes, monedas, FX, firmas de negocio, estados, IDs, auditoría, best-effort y mensajes de resultado, salvo la fecha de negocio objeto de la tarea.
- No mutar el objeto de entrada del llamador ni añadir un fallo nuevo por acceder prematuramente a un payload malformado. La captura de una omisión no sustituye la validación posterior ni autoriza éxito.
- ROJO→VERDE sobre handlers y delegados reales con I/O sintética: cruce dentro de sesión/guard/read, fecha explícita/omitida/vacía/inválida y denegación sin efectos. Registrar fuente/base/recibos y probar las aserciones funcionales; ningún doble de éxito incondicional.
- Revalidar tipos/lint y el conjunto focal; incluir estas rutas en el checkpoint inmutable y su revisión. Mantener un solo turno pesado.

Autorización de Sam para continuar localmente y subir PR en borrador vigente, reiterada al retirarse a dormir. El Director resuelve esta ampliación técnica dentro de la tarea, sin solicitar otro permiso rutinario. No autoriza merge, deploy, escrituras VPS, datos reales, migraciones reales ni ampliaciones posteriores. 0495 no se repite. C2 y BCV siguen fuera de C1.



# C1 · ampliación del inventario exacto de lecturas, ruta 65

El Director autoriza una única ruta adicional a las 64 ya permitidas:

```text
scripts/__tests__/invoice-read-boundary.test.mjs
```

Se conserva el contrato original `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff` y el addendum de acciones `1d82124240dd1ad7f3666591d572219d23ded116ecabd871ddd88a364e4d86a6`. La allowlist vigente queda en **65 rutas**, misma tarea/owner/rama/turno/0499. Guardar este addendum antes de editar la ruta nueva.

## Causa y cambio permitido

El ROJO original del inventario informa exactamente una lectura nueva: `lib/studio/sales-orders/actions.ts: 1`. El Director leyó ese readback en el árbol C1 y el inventario/analyzer completo. Es la convivencia ya autorizada en la decisión 3 para obtener `issued_at` realmente persistida cuando una DB anterior omite el campo aditivo de 0128; no una lectura financiera nueva sin revisión.

Actualizar únicamente el mapa exacto añadiendo esa ruta con valor 1, el número de archivos **19→20** y total de llamadas **43→44**, con comentario de SDD-0576 que explique el guard, tenant y propósito. Ajustar en este mismo test la frase histórica «único caller ADMIN» que dejaría de ser cierta, conservando su explicación y los candados de referido existentes. Ningún cambio del analyzer, raíces, prefiltro, exclusiones, timeouts, widgets o pruebas de RBAC.

La lectura nueva usa el cliente ADMIN recibido por el motor Warehouse ya existente, tras el gate vigente y el resultado de RPC `outcome='invoiced'` con `invoice_id` UUID válido. Solo la ausencia estricta de la propiedad `issued_at` habilita consultar; propiedad presente inválida bloquea el asiento. Selección mínima `id, tenant_id, issued_at`, filtros por el id devuelto y tenant confiable del caller, `deleted_at IS NULL`, límite 2 para detectar ambigüedad y cardinalidad exactamente 1, identidad y calendario estrictos. Error/ausencia/multiplicidad/fecha inválida dejan factura emitida y asiento pendiente; sin otra emisión, reloj sustituto ni expansión a `already_invoiced`. Se preserva el control financiero de la RPC y su frontera de servicio.

El ajuste del inventario no es una autorización genérica de ADMIN ni un cambio de la RLS. Conservar sus cuatro pruebas, todas las negativas funcionales del readback y los mutantes proporcionales. ROJO→VERDE del gate exacto, después tipos/lint/focal y revisión por SHA. Si aparece cualquier otra diferencia de mapa/conteo, no incorporarla por conveniencia: reportarla al Director.

Autorizaciones de publicación local/draft vigentes; sin merge, despliegue, VPS, DB real o migración real. El Director no edita producto. C2 y BCV continúan fuera de C1.


# C1 · estado visible de factura emitida con asiento pendiente

El Director autoriza tres rutas adicionales a las 65 vigentes:

```text
lib/studio/sales-orders/invoicing.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/__tests__/auto-invoice-caracas-event.test.ts
```

La allowlist pasa a **68 rutas**, misma tarea/owner/rama/turno/migración0499. Conservar contrato original y addenda previos; guardar este documento en spec/handoff antes de las tres nuevas ediciones.

## Hallazgo demostrado por lectura

El nuevo readback autorizado de0128 devuelve actualmente `ok:false` y una razón «Factura … emitida; asiento pendiente» cuando no puede comprobar su fecha. El caller vigente en CN conserva el evento `No se facturó automáticamente: ${inv.reason}` para todo fallo no-notApplicable. El resultado compuesto sería contradictorio aunque la RPC ya confirmó emisión. Esto incumple el estado verdadero exigido por la decisión3 y ERR/SGE del contrato. No es una nueva automatización ni un cambio de la decisión de facturar.

## Ajuste mínimo autorizado

1. En `sales-orders/invoicing.ts`, ampliar de forma aditiva y explícita el tipo del resultado para distinguir **emisión confirmada, asiento pendiente** de **no emitida**. Usar un discriminante/propiedad tipada (por ejemplo `invoiceEmitted:true` en el resultado pendiente); no analizar texto ni sobrecargar `notApplicable`.
2. En el `sales-orders/actions.ts` ya autorizado, marcar únicamente el resultado de la rama `outcome='invoiced'` que no puede confirmar la fecha, conservando `ok:false`/pendiente y los bloqueos del poster/readback. Un error de red/RPC sin emisión confirmada no recibe ese marcador. No transformar un asiento pendiente en un éxito contable ni ampliar `already_invoiced`.
3. En `cn/actions.ts`, cambiar exclusivamente la presentación del evento que consume ese resultado: si la emisión está confirmada y el asiento pendiente, guardar una descripción verdadera que lo diga, con la recuperación/revisión ya prevista; los fallos de emisión conservan su prefijo y los éxitos su evento actual. Mantener ubicación y condiciones de invocación, sesión/RBAC/tenant, consolidación, notificaciones, timeline, IDs, motivo y best-effort. No activar otro disparador, refacturar ni agregar un asiento o correo.
4. Nuevo test focal de la action/caller real con I/O sintética y aserción del evento persistido: primero ROJO del texto contradictorio, luego VERDE para fecha presente inválida/readback fallido, éxito normal, fallo real/no aplicable, actor/tenant pertinente y cero segunda emisión/poster indebido. La prueba debe atravesar la propagación del resultado real; un doble que inventa el resultado final por sí solo no demuestra la reparación. Reutilizar patrones existentes sin ampliar otras rutas.

El mapa de lecturas de facturas sigue exigiendo exactamente20archivos/44llamadas después del addendum de inventario. Este ajuste de tipo/copy no habilita nuevas lecturas ni modifica el analyzer. Validar focal/tipos/lint y congelar checkpoint app para revisión independiente antes del cierre general. No declarar navegador real aprobado por Vitest/JSDOM.

La ampliación concreta resuelve un hallazgo propio de C1 dentro de la delegación de Sam para avanzar sin detenerse. No absorbe0575 ni promete atomicidad de emisión+asiento; el pendiente permanece explícito. Sin merge, deploy, VPS, datos reales ni migración real. 0495 no se repite.
## Checkpoint SQL C1 · revisión parcial, sin aplicar

0499 contiene las cinco definiciones completas anteriores (0467/0468/0340/0464/0128), con delta temporal acotado, y los cuatro defaults. No incorpora helper SQL productivo. El día de negocio se captura antes de autorización/locks; los timestamps de auditoría no cambian. La fecha explícita se conserva, incluso si el caller anterior la deriva de UTC. El motor privado0464 devuelve el recibo idéntico autorizado antes de validar frescura de una nueva creación; sigue comprobando actor/tenant/request/report/verb/hash y bloqueando filas. SQL no comprueba bytes actuales de Storage: esa garantía pertenece a la action y su helper.

La migración exige una transacción, lock_timeout5s/statement_timeout60s; ALTER DEFAULT toma ACCESS EXCLUSIVE en cuatro tablas hasta COMMIT, sin backfill. Preflight compara firmas, cuerpos, ACL/owner/defaults/cierre/auditoría; postflight exige cuerpos y catálogo conservados. No GRANT nuevo ni cambio RLS.0467/0468 siguen INVOKER authenticated;0464 privado mantiene EXECUTE authenticated preexistente;0128 sigue service_role. La espera0499 es MIGRATE-FIRST: paquete/previa/OK nominal antes de DB, despliegue posterior. Rollback de app mantiene SQL compatible; rollback SQL requiere solo restaurar cinco cuerpos y cuatro defaults revisados, sin ejecutar migraciones históricas completas ni re-fechar filas.

El contrato carga0499 REAL sin alterarla y toma catálogo/filas antes y después. Después instrumenta exclusivamente anclas exactas de reloj en copias de los cuerpos/defaults, abortando ante deriva; conserva hash, locks, autorización y prueba. Fecha fija02:30Z, límites03:59:59.999/04:00, mes/año/bisiesto e IANA2010; sesiones UTC/Caracas/Shanghai; reloj secuenciado confirma una captura por operación. Fechas explícitas/centavos, gasto original y asiento histórico/cierre, cero nuevas mutaciones en negativos, replay autorizado y cada campo/actor/tenant/revocación/verb están cubiertos.

Fuentes de la fixture: estructura sintética0421 con auditoría real0258/0261/0267/0294/0351; cuerpos reales0464/0467/0468/0128/0340; políticas actuales de0414 extraídas íntegramente desde su DDL/postflight (no se certifica su preflight de release0411–0413); helpers completos get_user_tenant_id0453/current_studio_role0200;0230 y0470 completas para las cuatro tablas financieras. auth.uid es adaptador de claims sintéticos, no Auth alojado. Privilegios estándar service_role de las tablas añadidas se declaran en bootstrap; no se simula permiso con true. La prueba ejecuta acciones bajo SET ROLE authenticated/service_role/anon y evalúa aislamiento/tenant ambiguo, no solo postgres. HTTP/JWT queda pendiente en este checkpoint.

Evidencia externa en C:/tmp/director-traspaso-20261020/0576-codex-validation/:
- ROJO: red-sql-1 y red-sql-groups-1 reproducen defaults/cobro/0128/gasto/futura nueva; red-sql-replay-1 reproduce PAYMENT_INPUT previo al replay idéntico, con5 casos omitidos exclusivamente por selección -t. No representan suite completa verde.
- green-sql-groups-2 PASÓ6/6 sin omisiones; los errores anteriores de bootstrap y postflight se conservan en sus logs. El postflight corrigió las dos representaciones exactas de paréntesis de pg_get_expr, sin relajar reloj/zona/cast.
- green-sql-final-1 PASÓ7/8 y FALLÓ el nuevo fixture de otro actor por constraint real de principal único; se corrigió usando reasignación sintética conservando el constraint. green-sql-portal-final-2 PASÓ3/3.
- lint-sql-checkpoint-1 y typecheck-sql-checkpoint-1 PASÓ salida0. La incorporación posterior de0470 es únicamente fixture SQL; su suplemento se registra en el handoff.

Los controles rojos permanentes esperan el error funcional exacto de la base sin0499; un error de infraestructura no los hace pasar. PostgreSQL/HTTP, mutantes, navegador, verify y revisión SQL siguen pendientes. Este checkpoint no certifica C1 completa ni autorización de integración/producción.

FUERA DE ALCANCE DETECTADO: app/m/erp/actions.ts mantiene occurred_at.slice(0,10) y guardas anteriores (blob9f10b23265c8273e9a2f543ac04092d1c7beea86; líneas95/195/260/354 cotejadas por Director). No se modifica dentro de68. Requiere slice móvil posterior antes de afirmar toda la hora Caracas unificada.

## Suplemento de composición 0493 y mutantes · 21oct03:28Z

Producto APP/0499 permanecen idénticos a b714; este suplemento añade pruebas y arnés dentro de las68rutas. La fixture anterior cargaba0133. La actual carga0357 y0493 REALES completas antes0499 (preflight/ACL intactos), con los dos pins search_path de0210;0453 ypgcrypto ya eran reales. Compara hashes, ACL, owner y config de ambos triggers y excepcion_al_cierre_vigente antes/después0499, además de policies/triggers/filas.

- green-0493-composition-1: PASÓ un caso focal PGlite, cinco omitidos únicamente por selección -t. No se presenta como suite completa. Incluye las tres guardas C1 de gasto, OLD cerrado→NEW abierto, inverso, DELETE cerrado, traslado de línea, abierto permitido y cero efectos negativos.
- postgres-0493-composition-1: PASÓ33aserciones yROLLBACK en PostgreSQL17.11,03:27:19.212–03:27:25.099Z; salida0, recursos propios eliminados/remainingOwn vacío. HTTP NO EJECUTADO en este suplemento; la API/0499 no cambiaron y sigue el recibo HTTP41respuestas del checkpoint de8. No Auth alojado ni DB real.
- Excepción mediante RPC0493 real con accounting, motivo, nonce/txid/actor/importes y limpieza. GUC inventado, nonce de otro asiento y txid previo no autorizan. Un nonce real válido para el asiento tampoco vence el bloqueo explícito de void_expense0499. La modificación sintética del txid solo prueba antigüedad: no supone que una API pueda escribir la tabla privada.
- sql-mutants-0493: PASÓ5/5 muertos por aserción funcional esperada,03:27:39.209–03:27:47.493Z; fuente0499 intacta. El nuevo15 demuestra que quitar el bloqueo explícito permitiría la anulación con nonce válido en ese contexto, complementando el09 anterior (otro mensaje de trigger, sin persistencia). No cambia el permiso productivo.
- app-mutants-1: resultado inicial exit1,25/29 clasificados muertos,29restaurados. Dos fallos UI eran funcionales pero el clasificador no reconocía los matchers DOM: evidencia íntegra y reclasificación en app-mutants-ui-classification.json, sin repetirlos. Dos supervivientes reales mostraban huecos de prueba: bytes distintos del mismo tamaño y recibo recovery con replayed=false. Nuevas regresiones PASÓ265/265 en2archivos,0SKIP; app-mutants-supplement-1 PASÓ2/2 muertos/restaurados, sin cambiar producto. Resultado final29casos cubiertos; se conserva el historial inicial, no se reescribe su exit.
- CxP incluye prueba sin today inyectado a03:59:59.999/04:00 y mutante de default UTC muerto. typecheck-supplements-1 PASÓ salida0; lint-supplements-1 PASÓ salida0 sin warnings.

Recibos/logs/JSON externos en C:/tmp/director-traspaso-20261020/0576-codex-validation/. SHA2560499 continúa fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef. Navegador real, verify final y cierre de conocimiento siguen pendientes. Revisiones por b714/de8 conservan sus límites; este suplemento se entrega como nuevo objeto para cotejo independiente. No merge, despliegue ni migración real.

Suplemento mínimo tras revisión fd6: se añade negativa de editar importe/descripción de una línea manteniendo su asiento cerrado (rama específica del trigger), y RPC0493 en modo default superclave sin clave antes de habilitar advertencia. postgres-0493-composition-2 PASÓ37aserciones+ROLLBACK, salida0,03:30:28.126–03:30:34.518Z; mismos producto/0499/arnés, cero recursos propios restantes. No se repite HTTP ni los cinco mutantes intactos. No consta un defecto de producto; cierra cobertura de las dos negativas requeridas.

Cierre de orquestación de pruebas: red-composed-orchestration-1 reprodujo2fallos/9 (7PASÓ,0SKIP): los controles Portal sin0499 alcanzaban antes el nuevo grupo de cierre que exige0499. Se aisló run_closing:false en el ejecutor Portal, sin cambiar sus oráculos ni la composición Studio. green-composed-orchestration-1 PASÓ9/9 en2archivos,0SKIP,03:31:19.712–03:31:34.235Z; incluye todos los positivos y negativos permanentes de ambos módulos. Lint-portal-composition-1 salida0. Es reparación propia de orquestación TEST, no producto. Se conserva ROJO original. SQL0499/APP/arnés iguales al checkpoint previo.
