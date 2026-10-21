---
sdd: "0576"
title: "Fechas de operaciones en America/Caracas — C1"
status: in-progress
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
allowlist exacta vigente a **70 rutas**, adoptadas antes de sus cambios de
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
SKIP. Estado actual: **C1 implementado y validado localmente sobre 264e0531**,
con APP, SQL/HTTP sintético, mutantes, revisión independiente y navegador
acotado. El tercer verify terminó el 21oct a 04:26:01.702Z, salida0:
**16/17, CIERRE INCOMPLETO** por el ledger de release no medido. Se conservan
una omisión unitaria, 20 omisiones E2E y un caso E2E aprobado al reintentar;
no se presenta cobertura íntegra. La tabla final y sus límites viven en el
handoff propio. C2 y el slice móvil siguen pendientes: la SDD0576 permanece
in-progress, sin cierre global de hora Caracas, integración ni producción.

## Gobernanza (SGE-00, doce principios)

| Principio | Clasificación en C1 | Evidencia y límite |
|---|---|---|
| SGE-00.01 Acción predecible | Cumplimiento acotado | CN comunica emisión confirmada/asiento pendiente; ROJO2/7→VERDE48/48 y revisión5dad |
| SGE-00.02 Conservar trabajo | Cumplimiento acotado | Portal conserva IDs/payload/archivo al recuperar; pruebas265/265 y recorrido real sintético |
| SGE-00.03 Fricción proporcional | Cumplimiento acotado | R3 conserva gates; recuperación no depende de un permiso UI ni agrega confirmaciones rutinarias |
| SGE-00.04 Auditoría | Cumplimiento acotado | Contrato0499/HTTP y composición0493 conservan actor, tenant, request, evento y timestamps UTC |
| SGE-00.05 Permisos y estados | Cumplimiento acotado | ACL/RLS y tenant ambiguo negativos; cierre OLD/NEW/DELETE/excepción real, sin acceso productivo |
| SGE-00.06 Prevención | Cumplimiento acotado | Vacío inválido; futuro nuevo bloqueado antes de Storage; misma fecha anclada antes de awaits |
| SGE-00.07 Estado verdadero | Cumplimiento acotado | Solo [] es ausencia; malformado falla cerrado; replay requiere recibo autorizado e input idéntico |
| SGE-00.08 Frecuencia y complejidad | Cumplimiento acotado | Sin pasos nuevos; formularios existentes y limitación de convivencia explícita |
| SGE-00.09 Reutilización | Cumplimiento acotado | Primitiva compartida IANA y componentes existentes; sin biblioteca UI paralela |
| SGE-00.10 Accesibilidad | No conformidad de evidencia pendiente | Teclado/foco/390px y claro/oscuro medidos en fixture; zoom200%nativo NO DISPONIBLE, lector de pantalla y A11Y integral NO EJECUTADOS. No se afirma defecto visual ni excepción aprobada |
| SGE-00.11 Lenguaje | Cumplimiento acotado | Errores persistentes/sanitizados y aviso fiel de CN; conservación del formulario y foco comprobados |
| SGE-00.12 Autoridad humana | Cumplimiento del límite operativo | Encargo autorizado; PR borrador, sin merge, despliegue ni DB real |

Políticas cotejadas: SGE-00v1.0, DAT-01v1.0 (fechas), FRM-01v1.1,
ERR-01v1.0, UPL-01v1.0, AUD-01v1.0, NUM-01v1.1, MP-01v1.1,
A11Y-01v1.1 y PLG-01v1.0. Cumplimiento del delta temporal y sus guardas según
pruebas/rutas del handoff; no certificación transversal de esas políticas.
NUM-01 conserva importes, redondeos y completitud de b. No aplica crear
componentes, IA, notificaciones ni una auditoría global del ERP en este slice.
No hay excepción nueva aprobada. El validador del plugin pasó solo consistencia
del registro (28 políticas/5 componentes); sus conteos no aprueban conducta.

Conocimiento de la rama264e: consulta final salida0 pero ok=false; Graphify
estructural INVALID (grafo ausente), semántica global0/1327 y piloto0/16,
Archify pendiente por runtime ausente. Preview y publicación compartida no
ejecutadas por el límite expreso del Director; siguen pendientes coordinados.
El cierre documental cambia únicamente esta spec, el índice generado y el
handoff; conserva bytes de producto/SQL/pruebas del candidato verificado.

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


## Adopción de ampliación 69 · recibos0068

Leído íntegro antes de editar, SHA256834810d04b4c4eb0525e031885372c30894b84379051950f35cfef75e9322c7f. Verify46c interrumpido por decisión Director ante expectativa heredada vacío→hoy. Se conserva log/recibo, sin atribuir resultado global aprobado. Solo prueba adicional y documentos propios; producto/SQL intactos.

# C1 — addendum del contrato heredado de recibos0068

Fecha: 2026-10-20, Caracas. Decisión del Director dentro del mandato local vigente de Sam. Misma tarea C1, rama, worktree, owner y migración0499; ninguna nueva operación de producto o producción.

## Motivo y alcance exacto

El verify iniciado03:39:19.150Z sobre `46c64bd09b28d36e2689312aeea9d204dd2a2051` detectó el caso de `lib/studio/__tests__/payment-receipts-0068.test.ts` que entrega `receivedAt:""` y exige una fecha válida. El Director y Worker cotejaron por lectura esa expectativa. C1 prescribe valor predeterminado únicamente para `undefined`; vacío no significa hoy. El producto vigente rechaza ese vacío como corresponde al contrato aceptado.

Se añade **una sola ruta** a la allowlist anterior de68: total **69 rutas únicas**.

```text
lib/studio/__tests__/payment-receipts-0068.test.ts
```

Las anotaciones necesarias en spec/handoff propios ya están permitidas. No cambia ninguna otra ruta, migración, módulo, validador, dinero, moneda ni autorización. El contrato original `0576-caracas-c1-asignacion-worker.md`, hash `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff`, y sus tres addenda anteriores se conservan íntegros.

## Aceptación comprobable

1. Conservar el caso original rojo por su expectativa de vacío→fecha, los recibos y el intento canónico anterior. No atribuirle un resultado global aprobado.
2. Mantener los controles de moneda desconocida→USD, fecha malformada, mandatos, importes, fondos y builders existentes.
3. Exigir para fecha vacía error de campo e input ausente. No debilitar el validador para acomodar el test.
4. Probar fecha omitida y `undefined` con reloj fijo: `2026-10-21T03:59:59.999Z` da `2026-10-20`; `2026-10-21T04:00:00Z` da `2026-10-21`. Conservar fechas explícitas válidas. Restaurar siempre los timers.
5. Pasar el archivo completo, sin omisiones, y sus controles estáticos pertinentes. Publicar checkpoint mínimo, cotejar el delta y ejecutar el cierre canónico sobre el candidato congelado nuevo; no combinar recibos de candidatos distintos como una sola corrida.

## Secuencia y límites

Se permite detener de forma controlada únicamente el árbol de procesos propio del intento canónico ya identificado, conservando logs/recibos y marcándolo INTERRUMPIDO/INCOMPLETO por este hallazgo. Antes del focal comprobar que ese árbol terminó; no ejecutar dos pruebas pesadas ni matar procesos compartidos. El observador auxiliar de JSON E2E propio también debe quedar retirado si ya no corresponde al PID de verify.

Guardar este addendum completo y su hash en el handoff antes de editar. Guard, rama y ownership siguen obligatorios. Commit y push selectivos a la rama propia y PR #312 en borrador ya autorizados. Sin merge, despliegue, migración real, lectura de negocio o modificación de pagos.0495 no se repite.


## Checkpoint test de recibos0068 y evidencia visual final

La ampliación69 no modifica producto APP,0499, arnés ni gates. El primer verify de46c comenzó03:39:19.150Z y fue INTERRUMPIDO/INCOMPLETO por decisión Director al detectar la expectativa heredada vacío→hoy. Harness237/237, lint con0errores/15advertencias de seis archivos idénticos a8729, fronteras1708módulos, tipos y cuatroEdgeFunctions habían pasado. La suite general no terminó; no se le atribuye verde global. Recibo verify-candidate-interruption.json:remaining=[]/unknownChildren=[]; wrapper terminó03:46:15.650Z por cierre controlado, exit forzado4294967295. E2E/build no alcanzados. El observador nativo fs.watch falló por aserción Windows; su sustituto de lectura exacta terminó0 sin captura al retirar la corrida. Son incidencias de captura separadas del producto.

ROJO original completo red-receipts-0068-original:33PASÓ/1FALLÓ/0SKIP,03:46:49.406–03:46:53.508Z; toMatch recibióundefined porque vacío fue rechazado. La prueba conserva moneda desconocida→USD, fecha malformada, importes, fondos, mandatos y builders; ahora exige error/input ausente para vacío. Dos casos con timers restaurados comprueban omisión/undefined a03:59:59.999Z→20 y04:00Z→21, preservando fecha explícita, importe y moneda. green-receipts-0068 PASÓ36/36,0SKIP,03:47:12.712–03:47:15.434Z. Lint focal PASÓ salida0 sin advertencias; typecheck-receipts-0068 PASÓ salida0,03:47:38.163–03:47:53.688Z. No se cambió el validador para acomodar la prueba. Siguiente cierre canónico sobre nuevoSHA congelado, separado del intento46c.

La revisión independiente final del suplemento46c PASÓ sin hallazgo material abierto: caracas-c1-revision-suplemento-fd6e8146.md SHA2566a780886a25aa3263f3604380ee7a04826ab818d15a1186c136e8c970b614313. El dictamen SQL/HTTP previo conserva00c21ac263a5a987e37a9097e0b72cefa2d1028b6f7483c4307d795246c78ed1. Estos dictámenes no sustituyen verify ni release.

Navegador final: visual-final-receipt.json, fuentes/capturas en visual-fixture, producto46c. PASÓ alcance local con componentes reales, globals/tokens/studio.css y wrappers reales, datos/reloj/actions ficticios,390/1280claro/oscuro y navegadorShanghai.35controles funcionales/29mediciones; el recibo inspection-2 conserva FALLÓ por selector de gasto que omitió el punto del locale, corregido solo en suplemento externo inspection-supplement PASÓ. Se conserva tanto el fallo de selector como el resultado funcional; capturas anteriores a studio.css son provisionales. Recuperación Portal reenvía mismosIDs/payload/archivo aun cuando la fecha aceptada parece futura; creación nueva futura se rechaza antes de action; defaults, vacío/fecha explícita, CxP sin today inyectado, foco y Escape comprobados. Director inspeccionó independientemente390conCSSreal sin hallazgo material. No se certifica teléfono físico, Studio/Auth real, A11Y integral, alta/duplicación de factura en navegador ni zoom200%nativo: las teclas Chrome no cambiaron viewport/DPR/escala y no se sustituyó conCSSzoom. Invoice fixture acredita RegistrarPago. Servidor20036 y Chrome propia retirados; visual-cleanup.json conserva cero descendientes propios.

PR312 permanece DRAFT/base8729; Actions de46c startup_failure39539115496/39539111495, sin aprobación. Conocimiento, cierre canónico nuevo, documentación final y release siguen separados. Sin merge/migración real/deploy.


## Adopción de ampliación70 · doble de GastosUSD0572

Leído íntegro y hash506d24fb1d35334877c320a7ee81e2cfa3a4b5c56a5cf1fc796628c767984cbb comprobado antes de editar. Verify2 de9cbe INTERRUMPIDO/INCOMPLETO por doble incompleto sin lt; no es defecto de cálculo. Recibo de corte:remaining=[]/unknownChildren=[]; manifiesto69sin diferencias, lockfile/runner intactos y árbol limpio antes de esta adopción.

# C1 — adaptación del doble de GastosUSD0572

Fecha: 2026-10-20, Caracas. Decisión del Director dentro del alcance local autorizado. Misma tarea, worktree, rama, owner y0499; sin cambio de producto o permiso de producción.

## Evidencia y única ruta adicional

El segundo verify sobre `9cbe8749d09bc1fbed9ebf42cdc4952f178a070b` detectó el caso «lee amount_usd de cada gasto y no recalcula por moneda». Su doble admite select/is/gte/then, pero no lt; la consulta vigente usa ambos límites del día Caracas. El Director leyó la fuente inmutable y comprobó el desajuste.

Se añade una sola ruta a las69 anteriores: **70 rutas únicas**.

```text
lib/studio/__tests__/gastos-y-pagos-en-usd-0572.test.ts
```

La spec y el handoff propios ya están autorizados. Producto, consulta, SQL, conversor, redondeos, gates y demás tests no se modifican. Conservar íntegros el contrato original y sus cuatro addenda anteriores.

## Aceptación y secuencia

1. Guardar este documento completo/hash antes de editar. Autoriza detener de forma controlada solo el árbol propio del segundo verify34808 y su observador exacto17036, con identidad comprobada, logs/recibos conservados y estado INTERRUMPIDO/INCOMPLETO. Comprobar restantes/descendientes desconocidos antes del focal; ningún proceso compartido se detiene.
2. Reproducir el archivo completo original en rojo. Registrar el error de método faltante y/o su efecto exacto en la aserción; no llamarlo un defecto de cálculo del producto ni un resultado global del verify.
3. Añadir lt encadenable al doble, conservando select/is/gte/then y su respuesta de amount_usd. Registrar y exigir ambos límites literales, inferior inclusivo y superior exclusivo de Caracas, con reloj fijo cerca de medianoche. Verificar columnas exactamente amount_usd, total127 y count3; los otros nueve casos monetarios siguen intactos.
4. Usar timers restaurados en finally o equivalente seguro. No cambiar expectativas de moneda, tasa, centavos, signo, redondeo o falta de conversión para acomodar el doble. No convertirlo en respuesta exitosa genérica que omita los límites.
5. Pasar el archivo completo sin omisiones y la regresión directa existente de expense-queries-caracas, sin ampliar rutas. Lint/tipos pertinentes, diff-check, scope70 y checkpoint mínimo selectivo a PR #312 en borrador. Director revisará el delta fijo antes del nuevo cierre canónico.

Inventario acotado ya efectuado por Director sobre9cbe: los únicos archivos de pruebas que mencionan/importan expense-queries son el nuevo `expense-queries-caracas.test.ts`, que ya contempla lt, y esta ruta heredada. No se autoriza un barrido masivo ni cambios especulativos en otros dobles. Si aparece otra ruptura concreta, se identifica y coordina su ruta.

No combinar gates de las dos corridas interrumpidas con la siguiente, ni editar fuentes durante un verify nuevo. Se conserva un único turno pesado. Sin merge, migración real, lectura de negocio, radiografía, deploy, pagos o cambios de cuenta.0495 no se repite.


## Checkpoint de compatibilidad del doble GastosUSD · 21oct04:02Z

Verify2 sobre9cbe, iniciado03:49:03.165Z, fue INTERRUMPIDO/INCOMPLETO por autorización Director al observar que el doble de GastosUSD carecía de lt. Terminó por cierre controlado04:00:36.249Z, exit forzado4294967295. No concluyeron unitarias/SQL/E2E/build ni existe resultado global aprobado. verify-candidate-2-interruption.json acredita remaining=[]/unknownChildren=[]; observador17036 terminó0 sin JSON porque E2E no se alcanzó. Antes de modificar docs, verify-candidate-2-bytecheck.json cotejó69fuentes con su manifiesto de entrada: diferencias=[], lockfile/runner intactos y árbol limpio. No se combinan gates de esta corrida con otra.

red-gastos-usd-original reprodujo el archivo original completo:9PASÓ/1FALLÓ/0SKIP,04:00:57.862–04:00:59.858Z. Error exacto TypeError: .lt is not a function en el doble; no es fallo de cálculo ni un ROJO funcional del producto. La adaptación autorizada solo añade lt encadenable y registro/aserción exacta de ambos límites: a2026-10-21T03:59:59.999Z, gte occurred_at2026-10-20T04:00:00.000Z y lt occurred_at2026-10-21T04:00:00.000Z. Conserva select amount_usd, respuesta original y total127/count3; los nueve casos restantes de monedas/centavos/signo/null siguen intactos. Reloj restaurado en finally.

green-gastos-usd-compat PASÓ17/17 en2archivos completos,0SKIP,04:01:18.302–04:01:20.825Z, incluyendo expense-queries-caracas real que ejecuta filtros contra filas de borde. Lint focal PASÓ salida0 sin advertencias,04:01:25.413–04:01:31.340Z; typecheck-gastos-usd-compat PASÓ salida0,04:01:36.490–04:01:47.322Z. Producto APP/0499/arnés/gates siguen idénticos; el checkpoint contiene únicamente este test y los dos documentos propios. Alcance70rutas exactas. Nueva verificación canónica y cierre de conocimiento aún pendientes sobre el siguienteSHA congelado.
