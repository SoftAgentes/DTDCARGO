---
sdd: "0576"
title: "Fechas Caracas — operaciones, anuales y móvil — C1/C2/C3"
status: in-progress
author: "Codex"
created: 2026-10-21
updated: 2026-10-21
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# SDD-0576 — Fechas de operaciones, lecturas anuales y móvil en America/Caracas — C1/C2/C3

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
La migración asignada es **0533_fechas_caracas_operaciones**, sin aplicación real.

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
- 0533 cambia únicamente defaults/fallbacks/guardas temporales vigentes y el
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

SQL y HTTP sintéticos cargan primero 0533 intacta y verifican hash/defaults,
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
| SGE-00.04 Auditoría | Cumplimiento acotado | Contrato0533/HTTP y composición0493 conservan actor, tenant, request, evento y timestamps UTC |
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

Se conserva el contrato original `f4c55bb8c97ac57d9b0c8ce0206d2aabe524e3009320be6c7c974674cfde76ff` y el addendum de acciones `1d82124240dd1ad7f3666591d572219d23ded116ecabd871ddd88a364e4d86a6`. La allowlist vigente queda en **65 rutas**, misma tarea/owner/rama/turno/0533. Guardar este addendum antes de editar la ruta nueva.

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

La allowlist pasa a **68 rutas**, misma tarea/owner/rama/turno/migración0533. Conservar contrato original y addenda previos; guardar este documento en spec/handoff antes de las tres nuevas ediciones.

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

0533 contiene las cinco definiciones completas anteriores (0467/0468/0340/0464/0128), con delta temporal acotado, y los cuatro defaults. No incorpora helper SQL productivo. El día de negocio se captura antes de autorización/locks; los timestamps de auditoría no cambian. La fecha explícita se conserva, incluso si el caller anterior la deriva de UTC. El motor privado0464 devuelve el recibo idéntico autorizado antes de validar frescura de una nueva creación; sigue comprobando actor/tenant/request/report/verb/hash y bloqueando filas. SQL no comprueba bytes actuales de Storage: esa garantía pertenece a la action y su helper.

La migración exige una transacción, lock_timeout5s/statement_timeout60s; ALTER DEFAULT toma ACCESS EXCLUSIVE en cuatro tablas hasta COMMIT, sin backfill. Preflight compara firmas, cuerpos, ACL/owner/defaults/cierre/auditoría; postflight exige cuerpos y catálogo conservados. No GRANT nuevo ni cambio RLS.0467/0468 siguen INVOKER authenticated;0464 privado mantiene EXECUTE authenticated preexistente;0128 sigue service_role. La espera0533 es MIGRATE-FIRST: paquete/previa/OK nominal antes de DB, despliegue posterior. Rollback de app mantiene SQL compatible; rollback SQL requiere solo restaurar cinco cuerpos y cuatro defaults revisados, sin ejecutar migraciones históricas completas ni re-fechar filas.

El contrato carga0533 REAL sin alterarla y toma catálogo/filas antes y después. Después instrumenta exclusivamente anclas exactas de reloj en copias de los cuerpos/defaults, abortando ante deriva; conserva hash, locks, autorización y prueba. Fecha fija02:30Z, límites03:59:59.999/04:00, mes/año/bisiesto e IANA2010; sesiones UTC/Caracas/Shanghai; reloj secuenciado confirma una captura por operación. Fechas explícitas/centavos, gasto original y asiento histórico/cierre, cero nuevas mutaciones en negativos, replay autorizado y cada campo/actor/tenant/revocación/verb están cubiertos.

Fuentes de la fixture: estructura sintética0421 con auditoría real0258/0261/0267/0294/0351; cuerpos reales0464/0467/0468/0128/0340; políticas actuales de0414 extraídas íntegramente desde su DDL/postflight (no se certifica su preflight de release0411–0413); helpers completos get_user_tenant_id0453/current_studio_role0200;0230 y0470 completas para las cuatro tablas financieras. auth.uid es adaptador de claims sintéticos, no Auth alojado. Privilegios estándar service_role de las tablas añadidas se declaran en bootstrap; no se simula permiso con true. La prueba ejecuta acciones bajo SET ROLE authenticated/service_role/anon y evalúa aislamiento/tenant ambiguo, no solo postgres. HTTP/JWT queda pendiente en este checkpoint.

Evidencia externa en C:/tmp/director-traspaso-20261020/0576-codex-validation/:
- ROJO: red-sql-1 y red-sql-groups-1 reproducen defaults/cobro/0128/gasto/futura nueva; red-sql-replay-1 reproduce PAYMENT_INPUT previo al replay idéntico, con5 casos omitidos exclusivamente por selección -t. No representan suite completa verde.
- green-sql-groups-2 PASÓ6/6 sin omisiones; los errores anteriores de bootstrap y postflight se conservan en sus logs. El postflight corrigió las dos representaciones exactas de paréntesis de pg_get_expr, sin relajar reloj/zona/cast.
- green-sql-final-1 PASÓ7/8 y FALLÓ el nuevo fixture de otro actor por constraint real de principal único; se corrigió usando reasignación sintética conservando el constraint. green-sql-portal-final-2 PASÓ3/3.
- lint-sql-checkpoint-1 y typecheck-sql-checkpoint-1 PASÓ salida0. La incorporación posterior de0470 es únicamente fixture SQL; su suplemento se registra en el handoff.

Los controles rojos permanentes esperan el error funcional exacto de la base sin0533; un error de infraestructura no los hace pasar. PostgreSQL/HTTP, mutantes, navegador, verify y revisión SQL siguen pendientes. Este checkpoint no certifica C1 completa ni autorización de integración/producción.

FUERA DE ALCANCE DETECTADO: app/m/erp/actions.ts mantiene occurred_at.slice(0,10) y guardas anteriores (blob9f10b23265c8273e9a2f543ac04092d1c7beea86; líneas95/195/260/354 cotejadas por Director). No se modifica dentro de68. Requiere slice móvil posterior antes de afirmar toda la hora Caracas unificada.

## Suplemento de composición 0493 y mutantes · 21oct03:28Z

Producto APP/0533 permanecen idénticos a b714; este suplemento añade pruebas y arnés dentro de las68rutas. La fixture anterior cargaba0133. La actual carga0357 y0493 REALES completas antes0533 (preflight/ACL intactos), con los dos pins search_path de0210;0453 ypgcrypto ya eran reales. Compara hashes, ACL, owner y config de ambos triggers y excepcion_al_cierre_vigente antes/después0533, además de policies/triggers/filas.

- green-0493-composition-1: PASÓ un caso focal PGlite, cinco omitidos únicamente por selección -t. No se presenta como suite completa. Incluye las tres guardas C1 de gasto, OLD cerrado→NEW abierto, inverso, DELETE cerrado, traslado de línea, abierto permitido y cero efectos negativos.
- postgres-0493-composition-1: PASÓ33aserciones yROLLBACK en PostgreSQL17.11,03:27:19.212–03:27:25.099Z; salida0, recursos propios eliminados/remainingOwn vacío. HTTP NO EJECUTADO en este suplemento; la API/0533 no cambiaron y sigue el recibo HTTP41respuestas del checkpoint de8. No Auth alojado ni DB real.
- Excepción mediante RPC0493 real con accounting, motivo, nonce/txid/actor/importes y limpieza. GUC inventado, nonce de otro asiento y txid previo no autorizan. Un nonce real válido para el asiento tampoco vence el bloqueo explícito de void_expense0533. La modificación sintética del txid solo prueba antigüedad: no supone que una API pueda escribir la tabla privada.
- sql-mutants-0493: PASÓ5/5 muertos por aserción funcional esperada,03:27:39.209–03:27:47.493Z; fuente0533 intacta. El nuevo15 demuestra que quitar el bloqueo explícito permitiría la anulación con nonce válido en ese contexto, complementando el09 anterior (otro mensaje de trigger, sin persistencia). No cambia el permiso productivo.
- app-mutants-1: resultado inicial exit1,25/29 clasificados muertos,29restaurados. Dos fallos UI eran funcionales pero el clasificador no reconocía los matchers DOM: evidencia íntegra y reclasificación en app-mutants-ui-classification.json, sin repetirlos. Dos supervivientes reales mostraban huecos de prueba: bytes distintos del mismo tamaño y recibo recovery con replayed=false. Nuevas regresiones PASÓ265/265 en2archivos,0SKIP; app-mutants-supplement-1 PASÓ2/2 muertos/restaurados, sin cambiar producto. Resultado final29casos cubiertos; se conserva el historial inicial, no se reescribe su exit.
- CxP incluye prueba sin today inyectado a03:59:59.999/04:00 y mutante de default UTC muerto. typecheck-supplements-1 PASÓ salida0; lint-supplements-1 PASÓ salida0 sin warnings.

Recibos/logs/JSON externos en C:/tmp/director-traspaso-20261020/0576-codex-validation/. SHA2560499 continúa fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef. Navegador real, verify final y cierre de conocimiento siguen pendientes. Revisiones por b714/de8 conservan sus límites; este suplemento se entrega como nuevo objeto para cotejo independiente. No merge, despliegue ni migración real.

Suplemento mínimo tras revisión fd6: se añade negativa de editar importe/descripción de una línea manteniendo su asiento cerrado (rama específica del trigger), y RPC0493 en modo default superclave sin clave antes de habilitar advertencia. postgres-0493-composition-2 PASÓ37aserciones+ROLLBACK, salida0,03:30:28.126–03:30:34.518Z; mismos producto/0533/arnés, cero recursos propios restantes. No se repite HTTP ni los cinco mutantes intactos. No consta un defecto de producto; cierra cobertura de las dos negativas requeridas.

Cierre de orquestación de pruebas: red-composed-orchestration-1 reprodujo2fallos/9 (7PASÓ,0SKIP): los controles Portal sin0533 alcanzaban antes el nuevo grupo de cierre que exige0533. Se aisló run_closing:false en el ejecutor Portal, sin cambiar sus oráculos ni la composición Studio. green-composed-orchestration-1 PASÓ9/9 en2archivos,0SKIP,03:31:19.712–03:31:34.235Z; incluye todos los positivos y negativos permanentes de ambos módulos. Lint-portal-composition-1 salida0. Es reparación propia de orquestación TEST, no producto. Se conserva ROJO original. SQL0533/APP/arnés iguales al checkpoint previo.


## Adopción de ampliación 69 · recibos0068

Leído íntegro antes de editar, SHA256834810d04b4c4eb0525e031885372c30894b84379051950f35cfef75e9322c7f. Verify46c interrumpido por decisión Director ante expectativa heredada vacío→hoy. Se conserva log/recibo, sin atribuir resultado global aprobado. Solo prueba adicional y documentos propios; producto/SQL intactos.

# C1 — addendum del contrato heredado de recibos0068

Fecha: 2026-10-20, Caracas. Decisión del Director dentro del mandato local vigente de Sam. Misma tarea C1, rama, worktree, owner y migración0533; ninguna nueva operación de producto o producción.

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

La ampliación69 no modifica producto APP,0533, arnés ni gates. El primer verify de46c comenzó03:39:19.150Z y fue INTERRUMPIDO/INCOMPLETO por decisión Director al detectar la expectativa heredada vacío→hoy. Harness237/237, lint con0errores/15advertencias de seis archivos idénticos a8729, fronteras1708módulos, tipos y cuatroEdgeFunctions habían pasado. La suite general no terminó; no se le atribuye verde global. Recibo verify-candidate-interruption.json:remaining=[]/unknownChildren=[]; wrapper terminó03:46:15.650Z por cierre controlado, exit forzado4294967295. E2E/build no alcanzados. El observador nativo fs.watch falló por aserción Windows; su sustituto de lectura exacta terminó0 sin captura al retirar la corrida. Son incidencias de captura separadas del producto.

ROJO original completo red-receipts-0068-original:33PASÓ/1FALLÓ/0SKIP,03:46:49.406–03:46:53.508Z; toMatch recibióundefined porque vacío fue rechazado. La prueba conserva moneda desconocida→USD, fecha malformada, importes, fondos, mandatos y builders; ahora exige error/input ausente para vacío. Dos casos con timers restaurados comprueban omisión/undefined a03:59:59.999Z→20 y04:00Z→21, preservando fecha explícita, importe y moneda. green-receipts-0068 PASÓ36/36,0SKIP,03:47:12.712–03:47:15.434Z. Lint focal PASÓ salida0 sin advertencias; typecheck-receipts-0068 PASÓ salida0,03:47:38.163–03:47:53.688Z. No se cambió el validador para acomodar la prueba. Siguiente cierre canónico sobre nuevoSHA congelado, separado del intento46c.

La revisión independiente final del suplemento46c PASÓ sin hallazgo material abierto: caracas-c1-revision-suplemento-fd6e8146.md SHA2566a780886a25aa3263f3604380ee7a04826ab818d15a1186c136e8c970b614313. El dictamen SQL/HTTP previo conserva00c21ac263a5a987e37a9097e0b72cefa2d1028b6f7483c4307d795246c78ed1. Estos dictámenes no sustituyen verify ni release.

Navegador final: visual-final-receipt.json, fuentes/capturas en visual-fixture, producto46c. PASÓ alcance local con componentes reales, globals/tokens/studio.css y wrappers reales, datos/reloj/actions ficticios,390/1280claro/oscuro y navegadorShanghai.35controles funcionales/29mediciones; el recibo inspection-2 conserva FALLÓ por selector de gasto que omitió el punto del locale, corregido solo en suplemento externo inspection-supplement PASÓ. Se conserva tanto el fallo de selector como el resultado funcional; capturas anteriores a studio.css son provisionales. Recuperación Portal reenvía mismosIDs/payload/archivo aun cuando la fecha aceptada parece futura; creación nueva futura se rechaza antes de action; defaults, vacío/fecha explícita, CxP sin today inyectado, foco y Escape comprobados. Director inspeccionó independientemente390conCSSreal sin hallazgo material. No se certifica teléfono físico, Studio/Auth real, A11Y integral, alta/duplicación de factura en navegador ni zoom200%nativo: las teclas Chrome no cambiaron viewport/DPR/escala y no se sustituyó conCSSzoom. Invoice fixture acredita RegistrarPago. Servidor20036 y Chrome propia retirados; visual-cleanup.json conserva cero descendientes propios.

PR312 permanece DRAFT/base8729; Actions de46c startup_failure39539115496/39539111495, sin aprobación. Conocimiento, cierre canónico nuevo, documentación final y release siguen separados. Sin merge/migración real/deploy.


## Adopción de ampliación70 · doble de GastosUSD0572

Leído íntegro y hash506d24fb1d35334877c320a7ee81e2cfa3a4b5c56a5cf1fc796628c767984cbb comprobado antes de editar. Verify2 de9cbe INTERRUMPIDO/INCOMPLETO por doble incompleto sin lt; no es defecto de cálculo. Recibo de corte:remaining=[]/unknownChildren=[]; manifiesto69sin diferencias, lockfile/runner intactos y árbol limpio antes de esta adopción.

# C1 — adaptación del doble de GastosUSD0572

Fecha: 2026-10-20, Caracas. Decisión del Director dentro del alcance local autorizado. Misma tarea, worktree, rama, owner y0533; sin cambio de producto o permiso de producción.

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

## C2 — Lecturas anuales Caracas (extensión autorizada del 2026-10-21)

La evidencia y límites de C1 arriba se conservan como entrega fechada. C2 parte
exactamente de d6bcd0e8b9738cb5784579ef8e7f1802abef4644 de PR312 y reutiliza esta
SDD sin crear0577. Writer único en codex/sdd-0576-fechas-caracas-anuales;
contrato ejecutable incorporado íntegro en el handoff propio
`.agents/handoffs/0576-fechas-caracas-anuales.md`, fuente externa
`C:/tmp/director-traspaso-20261020/0576-caracas-c2-asignacion-worker.md`, SHA256
`825ab8194a63ad542f2eb7c377f4e68ac5089cde0b352174a4d3771039c53943`.
Migración asignada **0534_annual_billing_caracas**: solo archivo y fixtures
locales, nunca aplicación real desde esta tarea.

### Contrato anual y alcance C2

- Las tres fachadas existentes usan el día Caracas del reloj de transacción.
  `issued_at DATE` tiene prioridad sin desplazarse; solo su ausencia deriva
  `created_at TIMESTAMPTZ` mediante IANA. Se conserva la resta de un año
  calendario y la historia de Caracas con -04:30, sin offset fijo ni365días.
- Portal legado y v2 comparten lower inclusivo de hoy menos un año; conservan
  sus fórmulas distintas y documentos futuros sin cota superior. Studio v1/v2
  conservan `p_as_of` obligatorio, ambos extremos inclusivos y tolerancia ±1
  Caracas; NULL/±2 siguen22023, nunca cero, vacío ni sustitución por hoy.
- `clientAnnualBilling` llama a `fechaCaracas(now)` antes del primer await y
  mantiene el mismo `p_as_of` hasta la página vacía. Reutiliza el helper C1,
  la RPCv2, decodificador decimal, claves únicas y paginador vigentes.
- 0534 redefine completas exclusivamente las tres funciones anuales. Preflight
  comprueba cuerpos0411/0527 actuales y catálogo; postflight conserva OID,
  owner, firma/retorno, STABLE/DEFINER/search_path y ACL efectiva diferenciada.
  v1 conserva el defaultservice_role histórico0033; Portal y v2 lo revocaron.
  No cambia grants, helpers privados, tenant, roles, overrides, RLS, importes,
  estados, filas documentales ni auditoría.
- v1 conserva HAVING>0 y fórmula legada. v2 conserva cero, negativos y grupos
  solo excluidos, subtotal decimal como texto, contador y estado. No se igualan
  grupos de v1/v2 cuando HAVING explica la diferencia. Portal mantiene soloNULL
  como ausencia y conserva los datos no financieros si falta billing_v2.

Allowlist exacta C2, ampliada por el addendum de cierre del 2026-10-21 (no amplía las rutas productivas de C1):

```text
lib/studio/fidelizacion/queries.ts
lib/studio/fidelizacion/__tests__/queries.test.ts
lib/portal/__tests__/portal-referral-query.test.ts
lib/studio/__tests__/annual-billing-caracas.migration.test.ts
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
docs/specs/README.md
supabase/migrations/0534_annual_billing_caracas.sql
supabase/tests/0534_annual_billing_caracas.test.sql
docs/specs/0576-fechas-caracas/spec.md
.agents/handoffs/0576-fechas-caracas-anuales.md
scripts/tests/annual-billing-caracas-postgrest.mjs
app/p/[token]/standard-format.test.tsx
```

No es obligatorio modificar las trece. Históricos0411/0527/0533, helper C1,
paginador, conversor, readerPortal y arneses históricos solo se leen y prueban.
No existe degradación automática por ausencia0534: las RPC previas pueden
responder200 con semántica anterior. Se conserva únicamente la degradación
real por RPCv2 ausente de0527 y se ajustan sus anclas desplazadas.

### Aceptación y evidencia C2

ROJO funcional de caller sobre base anterior:8fallos/22pass; VERDE54/54 en
caller y Portal en el árbol de implementación. Se mantiene NOW original de
medianocheUTC y los tres oráculos cambian al literal2026-06-02. No se mueve la
fixture a mediodía ni se calcula la expectativa con el helper bajo prueba.

Contrato SQL propio: DDL0534 íntegra primero, catálogo antes/después y hashes
de cuerpos medidos, cero DML, helpers/policies/ACL intactos; luego copias
acotadas del reloj con dos anclas por cuerpo y aborto ante deriva. Oráculos
independientes por v1/v2/Portal, lower exacto/un día antes, upperStudio y
futuroPortal, prioridad documental,02:30/03:59:59.999/04:00Z, año nuevo,
bisiestos e historiaIANA, zonasUTC/Caracas/Shanghai y erroresNULL/±2. Preserva
fórmulas, signo, centavos, estados y permisos reales. Las fuentes nunca reciben
reloj de prueba. Mutantes temporales deben morir por aserción funcional.

El arnés HTTP propio usa PG17/PostgREST14.17, loopback/JWT sintéticos y recursos
limitados con cleanup. Las tres RPC existen antes; se comparan respuestas
antes→DDLreal/COMMIT/NOTIFY→después con el mismo PID/inicioPostgREST. Solo los
bordes cambian según el oráculo. Fase instrumentada separada y restaurada;
paginación real1202grupos con cap500 hasta vacía, última página completa solo
excluidas, mismo `p_as_of`; negativos de tenant/ACL/rol/override/error y helper
privado conservados. Cada recibo atribuye versiones, hashes, cwd, PID y tiempo.

Implementación y regresión ampliada223/223 en11archivos PASÓ; incluye30casosC2/21mutantesSQL y controles históricos. HTTPfinal PASÓ05:01:25–45Z sobreb309 limpio,424asercionesPG17 y recarga caliente del mismo PostgRESTPID830/inicio05:01:36.214487839Z; SQL/script/contrato ligados por hashes. Recibo SHA25614cc2f7e9d7cfd805762046f80e194d4481ed1989192fca62ba3c4b18aea2911. El handoff conserva por separado los intentos previos y sus defectos de arnés.

El primer verify canónico C2 sobreb309,05:04:27.386–05:36:16.981Z, FALLÓexit1:16/17pasos ejecutados, único fallo finaltest y cierre además INCOMPLETO por migrations-applied sinURL/key. Sus dos intentos unitarios completos registraron cada uno12.758PASÓ/1FALLÓ/1SKIP; mismo timeout20000ms en standard-format:25. SQL249contratos, reconstrucción492migraciones, E2E177expected/20SKIP/0unexpected/1flaky y buildPASARON con sus límites. Corpus real de proformas omitido. Se conserva el JSONoriginalE2E268805bytes/SHA2569ea74b36f27b4fd0ac92d2bb5a8210fccdbde38ce6be56ca840742b8b37f2e90, capturado por observador externo sin hooks ni filtro rootDir. El bytecheck posterior confirmó19fuentes+2auxiliares iguales/árbol limpio antes de editar docs. No se transfiere verify C1 a C2 ni se elimina el FALLÓ del historial.

### Addendum acotado del test de formato estándar

Director autorizó `C:/tmp/director-traspaso-20261020/0576-c2-addendum-test-standard-format.md`, SHA25665e50085e3d38ba9497cc1598fc2debc4f9862bf76e93ee6faa5a72cda28ed7d, condicionado a EXIT real, integridad, cleanup y focal original. Esas condiciones se cumplieron antes de escribir la ruta nueva. La propuesta af4d9c07ae2f0c4d7098eca706db1d44721c2ff74e80182a986be9a76165e9a1 solo acota consultas a tabla/editor identificados por rol/nombre, reutiliza el botón entre su aserción/clic y conserva la espera de foco del heading localizado una vez. Mantiene siete casos, todas las aserciones/acciones, hidratación, oráculos, consultas globales de ausencia/unicidad, roundtrip y consulta final fresca. No cambia producto del proveedor, fixtures, mocks, tiempos20s, configuración, runners, gates ni dependencias.

El focal ORIGINAL intacto PASÓ7/7/0SKIP05:37:44.634–05:37:58.598Z con maxWorkers1 solo diagnóstico; caso1 1224ms, tests10,21s/total11,60s. CANDIDATO PASÓ7/7/0SKIP05:39:00.172–05:39:13.502Z con la misma receta/20s; caso1 1108ms, tests10,72s/total12,10s. El caso1 fue116ms menor y el archivo completo0,50s mayor en estas observaciones; no se demuestra ahorro estable ni causa de los timeouts globales. Checkpoint0f2bc5362669ffc41d1c7abcbdefcc283c5cb03a PASÓ revisión del Director, dictamen65fa05e434996750b25466515bba9800805df200d2154c32a15a669518972e92, y recibió GO para la corrida completa siguiente. Caller/0534/arnés/contratoSQL conservan bytesb309, por lo que sus recibos no se repiten por este delta exclusivo de test/docs.

### Resultado canónico final de producto C2

La corrida normal sobre 0f2 terminó 05:43:33.356–06:11:24.876Z con exit 0 y **CIERRE INCOMPLETO**: 16/17 pasos medidos; migrations-applied sin URL/key no se midió. Unitarias PASÓ al primer intento, 12.759 aprobadas / 0 fallidas / 1 omitida, 886 archivos aprobados + 1 omitido, 553,38 s; corpus real de proformas sin ejecutar. Harness237/237, lint0errores/15advertencias preexistentes, RSC/tipos/cuatroEdgeFunctions/docs/numeración/componentes/gobernanza, SQL249contratos con rollback, reconstrucción492migraciones y build162páginas PASARON con sus límites. No se borra el primer FALLÓ ni se afirma cobertura productiva por exit0.

E2E quedó **OK con AVISO del runner**: 177 expected / 20 skipped / 0 unexpected / 1 flaky, 198 casos, 549.100,845 ms. Auth token inválido en Chromium registró ERR_ABORTED y aprobó el reintento; hubo además un error fuera de los casos por worker-17 forzado tras 300.000 ms sin salir. La atribución del absolvedor a WebKit/no-regresión no demuestra una causa y se conserva como interpretación del runner. JSON original capturado, 268.916 bytes, SHA25670d3428c30e83a66cb869e9620670f797850f57c34117a6f18a86433b5bf6d07. Omisiones: comments3, carrusel2 por captura única, gastos6, buscador6, nómina3; sus motivos/proyectos exactos siguen en el original.

Bytecheck 06:11:48.509Z confirmó veinte fuentes y dos auxiliares iguales, árbol limpio, antes de este cierre documental; recibo SHA256b1e3ffd36a50517f68c790e9bf90f7343669d26c8cf2e45f5bb84c9d01cf63b4. Se verificaron cerradas las55identidades registradas, puertos y contenedores propios. Dos candidatos WebKit posteriores con ownership NO VERIFICABLE se preservaron, igual que procesos anteriores; no se certifica limpieza global ni se atribuye pertenencia por PID/cache/nombre. El delta posterior a0f2 es solo spec/handoff; no se repite producto por cambios documentales.

### Gobernanza C2 (riesgo R2 de lectura financiera)

| Principio/política | Clasificación acotada | Evidencia o motivo |
|---|---|---|
| SGE-00.01 | Cumplimiento | Única semántica de día Caracas, ventanas deliberadamente distintas y oráculos por consumidor |
| SGE-00.02 | Cumplimiento | Solo lecturas; errores/shape/duplicados/paginación incompleta conservan indisponibilidad explícita |
| SGE-00.03 | No aplica mutación | Sin acción irreversible ni pasos/confirmaciones nuevos; DDL real requiere OK nominal aparte |
| SGE-00.04 | No aplica evento nuevo | No cambia documentos/asientos ni eventos; snapshot local comprueba cero DML durante0534 |
| SGE-00.05 | Cumplimiento acotado | Catálogo/ACL diferenciada, tenant/roles/overrides/RLS negativos en fixtures reales |
| SGE-00.06 | Cumplimiento | Instante inválido antes deRPC, NULL/±2SQL siguenerror; issued_at conserva prioridad |
| SGE-00.07 | Cumplimiento | Se conserva DTO/no_disponible y total completo; no éxito financiero por HTTP200 aislado |
| SGE-00.08 | No aplica flujo nuevo | Cambio del ancla de consulta sin pasos, campos ni UI nuevos |
| SGE-00.09 | Cumplimiento | Reutiliza fechaCaracas, fetchAllPaged, decoder anual y helper privado to_usd |
| SGE-00.10 | No aplica al delta visual | Query/SQL sin interacción visual nueva; no certifica A11Y general ni revoca límites C1 |
| SGE-00.11 | Cumplimiento acotado | Conserva errores sanitizados, shape/ausencia distintos y contrato previo de consumidores |
| SGE-00.12 | Cumplimiento del límite | Implementación/push/PRDRAFT autorizados; merge/deploy/DBreal/PII no autorizados |
| DAT-01v1.0 | Cumplimiento acotado | Fechas/calendario/timezone y límites explícitos; selector/teclado/móvil no reciben cambios |
| NUM-01v1.1 | Cumplimiento acotado | Fórmulas/decimal textual/cero/negativos/centavos/contador/estado preservados |
| ERR-01v1.0 | Cumplimiento acotado | Error real/no_disponible frente a cero yNULL; no nuevas excepciones ni copia de errores SQL a UI |

Políticas aprobadas del registro fuente, plugin derivado solo read-only.
Sus conteos de consistencia no aprueban comportamiento. UI nueva y ui-check
NO EJECUTADOS por no aplicar al delta; no es una aprobación visual global.

### Convivencia y pendientes globales

MIGRATE-FIRST conserva firmas, pero una app antigua puede enviarUTC dentro de±1
y seguir leyendo otra ventana. La validación futura requiere SQL0534 aprobado,
OK nominal de Sam, callerCaracas activo y smoke por SHA servido. PR/merge,
migración, deploy y producción siguen siendo permisos/resultados distintos.
C3móvil y demás tareas siguen fuera; SDD0576 permanece **in-progress**.

El cierre local distingue guardado, integración, estructura, semántica/piloto, Archify, preview y UI de Obsidian. Por autorización específica del Director se ejecutó Graphify nativo0.9.61 sin instalación global/APIs: 44.261nodos/80.956relaciones/2.666comunidades, HTML agregado bajo5.000nodos. Se conservan avisos de extracción parcial en dos archivos de Legal; CURRENT estructural no demuestra semántica. Primera generación Archify2.16.0 PASÓ9/9 sin errores/advertencias, con ZIP y treehash fijados cotejados antes de extraer/ejecutar. Global0/1.328 y piloto0/16 del inventario inicial no se elevan a CURRENT por AST; no se copiaron recibos de main.

El último refresco de derivados, knowledge:visual/check y publish/status/check --preview se ejecuta después del commit documental estable, con recibo externo final y readback de PR313 ligados a su SHA definitivo. Preview fija y propia en graphify-out/obsidian-preview; no publicación compartida. Semántica masiva, revisión visible en Obsidian, integración, ledger y producción conservan sus estados no medidos o pendientes. El handoff propio contiene comandos, huellas, intentos históricos y límites; no se alteran reglas globales para completar esta entrega.

## C3 — alta, edición y fila de gastos móviles

Asignación activada del Director2026-10-21, reproducida íntegra antes de producto en .agents/handoffs/0576-fechas-caracas-movil.md. Fuente externa C:/tmp/director-traspaso-20261020/0576-caracas-c3-asignacion-worker.md, SHA2566b94cd33764fd13b05efe2881ce99d0ac579c563491f54f75b82c60894293c66. Base final C2:0e630ede760dbc369ddf60133c18c4a77f2d8692; rama codex/sdd-0576-fechas-caracas-movil, PR DRAFT sobre codex/sdd-0576-fechas-caracas-anuales (histórico: hoy la C3 es la #526 contra main). No nueva migración, reparación histórica ni cambio0575.

### Alcance exacto y aceptación C3

Siete rutas permitidas: app/m/erp/actions.ts; app/m/erp/_components/MobileErpClient.tsx; app/m/erp/__tests__/fechas-caracas.test.ts; app/m/erp/_components/MobileErpClient.fechas-caracas.test.tsx; esta spec; docs/specs/README.md generado; .agents/handoffs/0576-fechas-caracas-movil.md. Helpers compartidos, CSS/layout, todos los tests previos, SQL, dependencias y gates quedan fuera de la escritura.

- Alta captura un instante antes del PRIMER await, deriva su día IANA Caracas y persiste exactamente ese occurred_at. Guard y poster usan el mismo día, aun si sesión cruza04:00Z o el insert devuelve otro timestamp. La numeración conserva su RPC y reloj propios; no se afirma anclaje de su correlativo.
- Ambas acciones resuelven tenant desde la sesión mediante get_user_tenant_id() sin argumentos y UUID escalar canónico estricto, sin fallback ni tenant de formulario. Solo arrays íntegros de0/1 settings con tenant coherente y closing_dateNULL/calendario válido pueden habilitar; errores, shapes o cardinalidad inesperados bloquean.
- Edición carga exactamente un origen propio/tenant/activo, límite2, y valida identidad y occurred_at histórico sin reemplazarlo. Resuelve cuenta y conserva la comparación real amount_usd/cuenta/método antes de foto. Solo para cambio contable lee0/1 asiento vivo estricto con límite2; cierre o fecha histórica distinta bloquean antes de upload/remove/UPDATE/void/post. Cambio descriptivo abierto no consulta innecesariamente ese asiento ni repostea.
- No se re-fecha historia, occurred_at ni created_at. Se preservan UTC de auditoría, importes/monedas/FX, permiso móvil propio, cuentaNULL legada, MIME/5MB y anulación gobernada.
- Fila usa Intl real, localees-VE y timeZoneAmerica/Caracas explícita, incluidos02:30Z, corte04:00Z, mes/año/bisiesto y Caracas histórico−04:30.
- El MISMO form conserva campos y File ante rechazo recuperable. Manejo local onSubmit/preventDefault→FormData nativo→useActionState en transición evita reset del form tras el error, sin caché/ref de File, exports ni form copiado. Retirar/sustituir/cancelar/cerrar realmente respeta la decisión del usuario.
- N1: botón y fondo del alta no desmontan durante pending; vuelven a permitir cierre voluntario tras rechazo. N2: mensaje general persistente con rolealert/tabIndex−1 y foco local solo en respuesta nueva; no mueve foco al teclear/cambiar foto. Reintento por teclado medido en ambos forms.

### Evidencia funcional C3 y límites

> **Evidencia histórica de la #314** sobre la base C2 `0e630ede760dbc369ddf60133c18c4a77f2d8692`, no de la cabeza de la #526. Los conteos 168/168 y 248/248, «tipos PASÓ» y los 12 mutantes se midieron allí. **Sobre la cabeza de la #526** (`15e35ee7d` y siguientes): vitest, tipos y mutantes locales NO EJECUTADOS; los cubre el CI.

Recibos externos bajo C:/tmp/director-traspaso-20261020/0576-c3-validation; sus identidades y hashes están en el handoff. ROJO puro de acciones sobre base intacta:117 FALLÓ/28 PASÓ,145 casos. ROJO UI real:13 FALLÓ/8 PASÓ,21 casos. Intentos con import/selección File de fixture incompleta se preservan aparte y no cuentan como ROJO funcional.

La comparación global inicial E01/E03 solo mostraba método transfer→cash. La aserción independiente File de JSDOM PASÓ2/2 con21 omitidas por filtro, por lo que no demostraba pérdida de archivo. El navegador nativo posterior sí reprodujo, en alta y edición, primer File íntegro y segundo ausente tanto en FD cliente como en multipart parseado por handler real, con mismo form y rechazo inicial sin efectos. Se conserva esa diferencia de entorno.

El VERDE nativo usa exactamente el mismo fixture de transporte11bytes: segundo File conserva name/type/size/bytes/SHA en ambos extremos y método transfer; todos los campos iguales. Base native/base-multipart.json SHA256c1126322305176ceeecc0f8339d280142a81e2e8804c3cee0cafc17223718db1; candidato native/candidate-multipart.json SHA2563e18370ef781902c35b163821503e264942cd0b809cc61b408c0fcfe6d902129. No se usa previewURL o input.files aislado como prueba de payload.

Primer VERDE conjunto168/168 (145 acciones+23 UI). Regresión ampliada posterior248/248 en9archivos, cero omisiones:151 acciones C3+25 UI C3 y72 previas de anulación móvil/gobernada, Caracas, FX, cierre, posting y consultas. Incluye fieldErrors reales MIME y frontera de fallo posterior de upload/UPDATE; esto conserva, no elimina, la incertidumbre de escritura entre Storage/DB/posting. Tipos PASÓ tras corregir únicamente el tipo de una tabla del test; el primer falloTS se conserva.

Mutantes focales seriales M1–M9/M11 y N1/N2 murieron por aserciones previstas; M10 nativo, al restaurar form action con reset, murió por aserción independiente del segundo File en ambos forms. Cada fuente se restauró por SHA256 exacto; fallos iniciales de invocación/clasificador se preservan como arnés, no como muerte funcional. No se tocaron controles, tiempos, pools, gates ni dependencias.

Suplemento visual: Chrome headless, componente/forms/ToastProvider/CSS reales y fronteras sintéticas;390×844 y1280×900, teclado/foco/error/reintento/scroll/último control. PNG ficticio válido240×160/4421bytes/SHA2560e6d2f8ca3f566e34692303b1d8cf58ae963ba25d64fb3b443786f0c23af055c, distinto del fixture11bytes preservado para transporte. Preview decodificada y bytes/hash iguales en ambos envíos y extremos; documento sin desborde horizontal y forms390/480px. native/review.json SHA256714a9b80c6300cf1c6a8b8a2e2dde443786b53e036525e07a601e37dc1ca6ea5. Oscuro es suplemento sintético: layout real claro. Native200% NO DISPONIBLE; viewport fuente restringe zoom. Teléfono/Auth/RLS vivos, lector de pantalla y WCAG integral NO EJECUTADOS.

### Gobernanza C3 — riesgo máximo R3 financiero

| SGE-00v1.0 | Clasificación y evidencia acotada |
|---|---|
| .01 Predecibilidad | Cumplimiento: mismo Guardar, rechazo real sin cierre/refresh |
| .02 No perder trabajo | Cumplimiento medido: File/método ROJO→VERDE nativo; N1 y cierre voluntario |
| .03 Riesgo/fricción | Cumplimiento: guardas financieras sin confirmación nueva; anulación P3/R3 intacta |
| .04 Auditoría | Cumplimiento del delta: ancla persistida, historia y UTC de auditoría preservados |
| .05 Permisos/tenant/estado | Cumplimiento sintético/fuente: tenant escalar, owner y estados estrictos; no RLS vivo |
| .06 Prevenir errores | Cumplimiento: guardas previas a foto/documento/void/post y calendario IANA |
| .07 Estado verdadero | Cumplimiento: solo array vacío es ausencia; error no equivale a abierto; no atomicidad0575 |
| .08 Frecuencia | Cumplimiento: no campos, permisos ni pasos nuevos |
| .09 Reutilización | Cumplimiento: helper, componente y forms existentes; sin exports/duplicación |
| .10 Accesibilidad | Cumplimiento de DOM/foco/teclado/reflow observado; integral NO VERIFICABLE por límites |
| .11 Lenguaje | Cumplimiento de nuevas guardas: error persistente sanitizado y vía de recuperación |
| .12 Autoridad humana | No aplica IA nueva; PR #526 contra main (antes #314 DRAFT) y límites merge/producción preservados |

DAT-01v1.0: día/calendario coherente, sin selector nuevo. ERR-01v1.0 y FRM-01v1.1: bloqueo visible, foco nuevo, preservación de trabajo y pending medidos. NUM-01v1.1: conversión/validación vigentes preservadas, no adopción global NumericInput. A11Y-01v1.1: DOM/teclado/foco/reflow medidos; lector/zoom/teléfono no certificados. MP-01v1.1: máximoR3 por historia financiera, sin fricción añadida ni promesa transaccional. Ninguna excepción creada; aprobación de políticas y conteos estáticos no certifican el producto.

UI-check advisory del delta: sin color/spacing/CSS nuevo; error enfocado visible. Deuda fuera de alcance: layout móvil hereda Archivo/ArchivoBlack (medido, archivos locales cargados) frente al split operativo Nunito/Sora de la rúbrica; restricciones de zoom y legibilidad oscura heredadas. No se cambia layout ni se declara esa deuda conforme.

Privacidad técnica del delta File: ENCONTRADO FormData nativo limitado al mismo input/form; CORRECTO sin caché global/durable, retirar/sustituir/cerrar y guardas antes de Storage medidos con datos ficticios; NO VERIFICABLE borrado físico de memoria/objetos históricos, vida completa de blobURLs y cumplimiento jurídico global. Sin filas reales, secretos o PII; no se promete borrado forense.

### Primera receta C3 y reparación acotada del fixture TZ

Primera receta normal sobre a732bcb0221ad821c671b0ee18d52ab928da26eb,07:28:01.8197424–08:03:24.5892194Z,exit1: **FALLÓ y CIERRE ADEMÁS INCOMPLETO**.16/17pasos medidos; test falló y migrations-applied quedó OMITIDO por URL/SERVICE_ROLE_KEY ausentes. Primer intento unitario12.934PASÓ/1FALLÓ/1OMITIDO,543,34s; reintento normal12.933/2/1,553,31s. Ambos detectaron TZ por acceso directo nuevo del fixture UI; solo el reintento agregó timeout20000ms del Portal supplier-flow.test.tsx:287. Ese caso pasó antes; su causa no se demuestra ni se amplía alcance para repararlo. El corpus real de proformas sigue OMITIDO. No se suman ni sustituyen los intentos.

Harness237/237,lint0errores/15advertencias,RSC/tipos/cuatroEdgeFunctions/docs/numeración/componentes/gobernanza,SQL249contratos con rollback,reconstrucción492 (474DDL+18historial) en DB efímera y build PASARON. E2E quedó OK con AVISO del runner:177expected/20skipped/0unexpected/1flaky,198casos. auth.spec.ts:81/chromium registró ERR_ABORTED y aprobó el reintento; error global worker-17 sin salir en300000ms y forzado. La interpretación del runner WebKit/no-regresión no acredita causa. JSON original268808bytes/SHA2560ff365f96a63595b19bbb5db7138ff1c289a01c7f7fe6bf130d1603409a95114, capturado por observador externo con ancestry/PID/tiempo, sin hooks ni filtro rootDir ni reconstrucción. Las20omisiones y motivos exactos se conservan en el original.

Bytecheck automático08:03:24.6738369Z confirmó39fuentes únicas con hashes/bytes idénticos, HEADa732estable y árbol limpio antes de docs; SHA2564b74d8c2ec1bdd99298f01e11c6595c1eb1a10692e6bc956ccbf94e7191cb31b. Log completo3e97bb3cb16752106a9eaebfa33dab81c2bad6338f0f2a360e47e4cef60bc47a y metadata9541981d5ccfc1213d0ff21696f0116f841166b03b0c6866b96bd10bdccfd54d quedan inmutables en0576-c3-validation. Revisión formal del Director bdc113f6e3497e97685071b76bff47bb3ceae3430f72e10aee2e1bf5dd5de7e9 autorizó únicamente la reparación causal del fixture, después de EXIT/integridad.

Se sustituyeron almacenamiento/asignación/restauración directos de TZ por vi.stubEnv("TZ",tz)/vi.unstubAllEnvs(). Se conservan Intl/resolvedOptions real,25casos UI, aserciones, filtros y límites; no se edita .env.example, scanner, producto, Portal ni runner. Focal completo UI+env-contract26/26PASÓ,0OMITIDO,08:07:27.756–08:07:56.240Z; recibo38b439f5609844183b5d3c5cad1d5442fac07408bdc95fe0ca3fb2d215daa506 en0576-c3-tz-fixture. M9 repitió únicamente el control afectado:6FALLÓ/1PASÓ/18omitidos por filtro D01-D04, por día visible incorrecto; recibo8eed3ef4d8374c3bf8d3fb78cecbe00b8a32655559fbdf70cc18c921c5bf1ddb. Fuente UI restaurada exacta al SHA6ab337a12cfe6e82018cbc1baf45a7d248e5c8a45ef17046eae6ea5fef33ed6a. No se repiten navegador/regresiones intactas por este cambio exclusivo de fixture.

### Segunda receta C3 y espera de baseline independiente

GO2 explícito tras devolución del turno pesado, con revisión del Director7085550f50e6b32709aa061476dda97cf5e10d2b99b4b461305edb835b5f145b y candidato exacto d1a7cca287fafcfe978ac74a58c40040889193c2/base0e630. Una receta normal corepack pnpm verify, 08:25:18.8874801–09:03:45.1958957Z, exit 1: **FALLÓ y CIERRE ADEMÁS INCOMPLETO**, 16/17 pasos medidos, test fallido y ledger OMITIDO. Se conservan los fallos de la primera receta; este resultado no los reemplaza.

| Intento unitario de segunda receta | Resultado separado | Diagnóstico original |
|---|---|---|
| Primero, 562,82 s | 12.934 PASÓ / 1 FALLÓ / 1 OMITIDO | supplier-flow.test.tsx:287, timeout 20000 ms, caso 20377 ms |
| Reintento nativo, 567,73 s | 12.934 PASÓ / 1 FALLÓ / 1 OMITIDO | EmbarquesClient.borrado.test.tsx:184, botón «Eliminar embarques» no disponible; DOM submit disabled «Procesando…» |

Ambos intentos tuvieron 887 archivos aprobados, uno fallido y uno omitido. TZ no figuró entre fallos; Portal no figuró entre fallos del reintento y embarques no figuró entre los del primero. Eso no demuestra causa ni certifica flake. C3 no modifica esos fixtures, sus productos, configuración, tiempos o gates. El rótulo «flaky conocido» se preserva como texto del runner. El corpus real de proformas continúa OMITIDO.

Harness 237/237, lint 0 errores/15 advertencias, RSC/tipos/cuatro Edge Functions/docs/numeración/componentes/gobernanza, SQL 249 con rollback, reconstrucción 492 (474 DDL+18 historial) en DB efímera y build PASARON. E2E fue OK con AVISO: 177 expected / 20 skipped / 0 unexpected / 1 flaky, 198 casos; auth Chromium ERR_ABORTED 14231 ms y reintento aprobado 13593 ms. Se conserva el error global literal de worker-17 forzado después de 300000 ms. La atribución del runner a WebKit/no-regresión no demuestra causalidad.

JSON E2E original de 268802 bytes capturado a 09:01:54.279Z; inicio propio 08:52:33.075Z y duración 561169,744 ms, SHA4bb1943ae2400f1b70dd6b782b7e7060661da764c40cb8c7192633028d263e3e. No hooks, filtro rootDir, reconstrucción o E2E adicional. Bytecheck automático a 09:03:45.2883911Z, SHA7516cf1f673805edd5c09218b5c11060301cbc79aeb18e75b963e37aa1b0ebb0: 39/39 rutas únicas, hashes/bytes iguales, HEAD d1a7 estable y árbol limpio antes de documentos. Director contrastó también los 39 archivos actuales; los trece primeros originales siguen intactos. Log completo6bf8fd29c0550453391b6a3965ac09165d9e073236b7a1df8db1373cd23ea53f y metadata7f9eb200e8187810cf30ffaee4573758fb9f62c6bb28636c3fd82f08a6d0ffe0 permanecen en la carpeta separada0576-c3-next/canonical-2.

Cierre atribuible de recursos: 89 identidades observadas cerradas, sin listeners propios 3149/13149 ni contenedores exactos de SQL/reconstrucción. Ningún proceso terminado por el Worker; cuatro WebKit anteriores no atribuidos se preservaron. Recibo heavy-release.json SHA68bdbefd98eef50f544688f7135116989ab69c3bcebfefab6fe52c7d18d42de3. Turno devuelto expresamente al Director, claim C3 conservado. No limpieza global ni validación nueva por esa inspección.

### Composición local de baseline 0577 revisada

Director autorizó composición local, sin canónica, mediante C:/tmp/director-traspaso-20261020/0576-c3-baseline-0577-autorizada.md, SHAa8702feb4301de42ff694a19a47d62c9dd262856126b1391cd802d24016cd41e, leído íntegro y preservado en handoff propio. Receptor55138b9cca4d304802337b50f353569531f9993e, donantec4b2e72dabbdde80ec7fe5c8a7f128966b6494be, ancestro común eafbd910d1c082c9b416b558f8c3db5847b994a6. PR314 y315 OPEN/DRAFT/remotos exactos comprobados; mismo owner/claim/rama C3. Merge Git local normal sin conflictos; no main ni merge de PR.

La allowlist acumulada pasa de siete a once rutas por cuatro heredadas: los tests Portal/Embarques, spec0577 y handoff0577. README compartido ya estaba permitido y se regenera preservando ambas specs;559specs/18huecos y docs:check PASÓ en el árbol previo al commit. No se reescriben producto/tests C3 ni archivos0577 heredados. Se mantienen blobs del receptor para las cuatro rutas TS/TSX C3 y del donante para las cuatro rutas heredadas; sus identidades se cotejan en recibo externo de composición.

Tests heredados exactos: Portal8112f1d2d1d98623830e31855e67c0bf97b325d3 y Embarques64c357737fd383078ce3b68594f816561f93bed5. Las preimágenes del receptor coinciden con eaf. Revisión independiente e48f432cd469f299ef8f9db1d5ebee569f7941a554a8b810a680b0584592c057 aceptada por Director; recibo donante2824bd5df16ac699c101024dcecace19de8577f7d1727c4fbfb499449c8f2d8e cotejado junto con sus13artefactos. Los40casos originales/candidatos pasaron antes, con171oráculos/29negativas y38cuerpos preservados, más2aserciones de disponibilidad. Se vinculan por blobs a la baseline; no se atribuyen retrospectivamente a una ejecución sobreHEADc4 ni a la composición. El original ya pasaba focalmente: no demuestra causa del timeout Portal ni estabilidad bajo concurrencia general.

Se preservan ambas canónicas C3 FALLÓ+INCOMPLETO. La incorporación por sí sola no inició pruebas ni transfirió una canónica histórica de0577: la aceptación receptora se midió después mediante el GO3 descrito abajo. Los13primeros originales,32del segundo sobre y13artefactos del donante permanecen íntegros por hash/bytes. El sobre nuevo registró43fuentes únicas, las39previas más dos tests/spec/handoff heredados, approvedHead explícito y protección de los recibos previos. Sin focal/UI/SQL extra por la composición.

### Tercera receta C3 sobre composición revisada

Composición publicada y revisada **22bd5192825199aeafd0cf5e3625606ff77657b0**, con padres55138b9cca4d304802337b50f353569531f9993e y c4b2e72dabbdde80ec7fe5c8a7f128966b6494be. GO3 del Director autorizó una sola receta normal `corepack pnpm verify`, sin instalación ni cambios de workers/config/tiempos/gates. Node24.20.0/pnpm12.14.0, solo COREPACK_ENABLE_AUTO_PIN=0 y COREPACK_ENABLE_DOWNLOAD_PROMPT=0 en el proceso; package/lock idénticos antes/después, sin credenciales ni overrides VERIFY/NODE_OPTIONS.

Inicio09:58:37.0499811Z, EXIT10:36:15.3461774Z, **exit0 y CIERRE INCOMPLETO16/17**. Los16pasos medidos fueron aceptados por Director en caracas-c3-revision-director-go3-terminada.md, SHAe46a0136ac34387f18ad5ddcb09238f167d305717658dac96dbe74901b697334, leído íntegro. El ledger migrations-applied quedó OMITIDO por ausencia de URL/SERVICE_ROLE_KEY; no se consultó DB real. No es cierre verde completo ni prueba de producción. Las dos recetas anteriores FALLÓ+INCOMPLETO se conservan y no se suman ni reemplazan.

| Intento unitario GO3 | Resultado nativo separado | Límite |
|---|---|---|
| Primero,519.63s,exit1 | 886archivos PASÓ/1OMITIDO de889;12823casos PASÓ/1OMITIDO de12936;2errores de pool | PARCIAL: dos errores nativos ZoneOOM y Worker exited unexpectedly; faltan archivos/casos sin resultado, sin causa establecida |
| Reintento nativo único,647.26s | 888archivos PASÓ/1OMITIDO de889;12935casos PASÓ/1OMITIDO de12936; paso testOK | No borra el primer intento ni demuestra estabilidad por una receta |

El stdout solo nombra1skipped: identidad individual acreditada por reporte nativo **NO DISPONIBLE**. La fuente lib/studio/document-import/corpus.test.ts:31 contiene el único skip explícito encontrado, describe.skipIf para corpus real de proformas dependiente de DOCUMENT_IMPORT_CORPUS/carpeta disponible. Esa correspondencia es **estática/inferencia**, no un nombre obtenido del reporte nativo. No se leyó corpus real ni cache ni se fabricó JSON de casos. Los muestreos de memoria fueron posteriores al OOM y no causales; el intento de comparación de fechas mal tipadas se conserva como diagnóstico inválido del recibo, sin confundirlo con una falla del producto.

Harness237/237,lint0errores/15warnings,RSC/tipos/cuatroEdgeFunctions/docs/numeración/constantes/componentes/gobernanza/manifiesto pendiente,SQL249contratos con rollback total,rebuild492migraciones (474DDL+18solo-ledger) y build PASARON. El manifiesto pendiente conserva0ROJO/2AMARILLO declarados/3homónimos descartados. Rebuild y aislamiento sintético de219tablas/2tenants son locales; no RLS o datos productivos. Se preservan warnings y choques históricos declarados. El build restauró tsconfig automáticamente; no hubo reparación manual.

E2E original capturado a10:34:16.933Z,270339bytes, SHA455ae60e2a70281f0f87ff808b3e96cc82369a774e3fba68476d70115059b437: **198únicos=177expected+20skipped+1flaky,0unexpected**,557377.402ms. Flaky actual distinto del auth anterior: Chromium company-photo-carousel.spec.ts:93, aserción103 sobre #operacion video expected2/received1, failed20335ms→retry1passed20753ms. Sus dos adjuntos reales, contexto y trace, se copiaron exactos con hash/bytes. Error global literal: `worker-17 process did not exit within 300000ms after stop, force-killed it`. El aviso WebKitWindows/no-regresión es interpretación del runner, no causalidad independiente demostrada. Sin reejecutar ni reconstruir E2E.

Las20omisiones conservan anotaciones nativas: comments3 por Preview/credenciales/seed; capturas carousel móvil2; gastos6 poraccounting/admin+gasto vivo; búsqueda6 porcredenciales/branch+seed; nómina3 poradmin+finiquito desechable. No prueban sesiones/RLS/filas reales, dispositivo físico o cobertura integral.

Bytecheck automático10:36:15.5742581Z, **43/43rutas únicas, hashes y bytes iguales antes/después/actuales, HEAD22bd intacto y árbol limpio**, antes de documentos; SHAec9d2c3cb8ae8919321bec345900e0a439c857e0a83319a83b54e95deac39797. Carpeta C:/tmp/director-traspaso-20261020/0576-c3-next/canonical-3 inmutable:40archivos sellados en documentation-3/canonical-3-originals-seal.json, SHA9b960b6289d4f59a86250d048b270ffe15cbc0359eb282b7e5dce694cad3747a. Hashes de originales/proyecciones/adjuntos y límites están en el handoff.

Recursos propios observados cerrados:135identidades atribuidas temporalmente,0restantes; cada intento unitario tuvo28identidades observadas y0restantes. Puertos3149/13149 libres y contenedores exactos SQL/rebuild ausentes. Ningún proceso matado por el Worker;19932 y su conhost37612 previos al GO3 se excluyeron por creación/parentesco temporal pese al PPID reutilizado. No se afirma inventario universal entre snapshots ni limpieza global. Turno pesado devuelto expresamente a10:41:50Z; claim retenido para el cierre acordado.

### Cierre e integración C3

PR314 OPEN/DRAFT sobre la base asignada0e630. Composición22bd con0577 heredada revisada y receta receptora aceptada con sus límites; once rutas acumuladas, cuatro fuentes móviles exactas del receptor55138 y cuatro heredadas exactas del donantec4. Este cierre cambia solo spec/handoff propios; título/status in-progress de la SDD no cambian y el índice generado conserva su fila vigente. Se preservan ambas corridas fallidas, el primer intento parcial de GO3 y todos sus originales. Ledger vivo sigue validación release y no autoriza consultar DB para completar un gate;0495 no se repite y0496/0500 siguen sin aplicar a producción.

Al corte documental, conocimiento C3 **NO EJECUTADO**, pendiente de fijar este commit estable y turno expreso. Se realizará un único ciclo nativo: Graphify0.9.61, Archify2.16.0 con ZIP/hash verificado antes de extraer, visual/check y preview/publish/status/check locales. Sus resultados postcommit irán a C:/tmp/director-traspaso-20261020/0576-c3-next/knowledge-final y PR314; no se hará un primer ciclo para autocitarlo ni publicación compartida. Si no hay corrección material, no se reescriben estos documentos para insertar su propio SHA o los resultados de ese ciclo. Semántica/piloto/global, revisión visible Obsidian, integración, deploy, migraciones y producción conservan estados separados. Aceptación local final y liberación de claim se acreditarán mediante recibo externo/PR. SDD0576 sigue in-progress; este slice no cierra por sí solo2.1global.
green-gastos-usd-compat PASÓ17/17 en2archivos completos,0SKIP,04:01:18.302–04:01:20.825Z, incluyendo expense-queries-caracas real que ejecuta filtros contra filas de borde. Lint focal PASÓ salida0 sin advertencias,04:01:25.413–04:01:31.340Z; typecheck-gastos-usd-compat PASÓ salida0,04:01:36.490–04:01:47.322Z. Producto APP/0533/arnés/gates siguen idénticos; el checkpoint contiene únicamente este test y los dos documentos propios. Alcance70rutas exactas. Nueva verificación canónica y cierre de conocimiento aún pendientes sobre el siguienteSHA congelado.

## Renumeración 0499 → 0533 (2026-11-11)

Main llegó a la 0526 antes de integrar esta pila, la 0499 no está aplicada en
ningún entorno y de la 0528 a la 0532 ya las ocupan otras PR. La migración pasa a
`0533_fechas_caracas_operaciones` con su contrato
`supabase/tests/0533_fechas_caracas_operaciones.test.sql`; se renumeraron sus
literales internos, la espera de `migrations-baseline.json` (sigue sin aplicar),
pruebas, arnés HTTP y citas. Cambia sólo el número: el SHA-256 anterior
`fd42b7a15fe413107d457a32da56b46f051fad29e7cbd7388611d24949b3f0ef` (blob
`ba9d4b4cae90ea65406bbc63e5a1425dafcffea5`) pasa a
`da9343c22d38a2cffce7d7118c090a8e6c412ae0956979d2dc315754cc1e85e0` (blob
`9c70be6e81a143502b1cdb03133fe96d343950fd`). Las evidencias anteriores a esta
nota describen el archivo con número 0499.

Composición con main: ninguna de las cinco funciones que redefine
(`register_collection_receipt` 0467, `register_supplier_payment_order` 0468,
`void_expense_governed` 0340, `payment_private.run_report_command` 0464,
`sales_order_claim_and_invoice` 0128) cambió en main después de esas versiones.
El asiento de factura ya no lo inserta JS: la RPC atómica de la 0497 lo fecha con
`issued_at` persistido, así que el default `fechaCaracas()` de
`invoice-posting.ts` se retiró al traer main. La 0533 corre después de la 0511
(RLS de escritura de asientos). Prueba de los asientos bajo esa RLS: NO DISPONIBLE,
el contrato no monta la 0511 (su fixture carga 0078, 0470 y 0493, no 0511 ni 0497;
montarla arrastra 0190, 0294 y la cadena de auditoría D2). Seguridad de las cinco
funciones (preflight de la 0533): 0340, 0464 y 0128 son DEFINER; 0467 y 0468 son
INVOKER y no escriben asientos. De las DEFINER, sólo `void_expense_governed` (0340)
toca `journal_entries`/`journal_lines`; que la 0511 no la alcance no está medido aquí. La rama `claude/sdd-0576-fechas-caracas-operaciones`
reemplaza a la PR #312.

## Renumeración 0500 → 0534 (2026-11-11)

La migración C2 pasa a `0534_annual_billing_caracas` (contrato
`supabase/tests/0534_annual_billing_caracas.test.sql`) por la misma razón que la
C1: main llegó a la 0526, la 0500 no está aplicada en ningún entorno y 0528-0532
están ocupadas. Sus dependencias pasan a 0527 (antes 0498) y 0533 (antes 0499).
El preflight que compara el md5 de los cuerpos de 0411/0527 sigue valiendo: la
renumeración de la 0527 sólo tocó literales del preflight, el postflight y la tabla
temporal, no los cuerpos de las funciones. SHA-256 anterior `bf90fe717e7be3d0af70a1c1999758529e875855aa118ad9f36dad2fdbffbfaf`, nuevo
`4ea257be32704d24b4ed06871c50a86cce6bac9f8d1c8f63ca4bbc923e5c7c45`. La rama `claude/sdd-0576-fechas-caracas-anuales` reemplaza a la PR #313.

## Desviaciones declaradas de la C3 (revisión de la #526, 2026-11-13)

- **Copy de la edición de un gasto ajeno.** Antes, editar un gasto de otra persona
  devolvía «Solo puedes editar tus propios gastos.». Ahora `ownExpense`
  (`app/m/erp/actions.ts`) busca el gasto filtrando por id, tenant y `user_id` en una
  sola lectura y falla cerrado, así que un gasto ajeno y uno inexistente dan el mismo
  mensaje genérico: «No se pudo comprobar el gasto propio y su fecha histórica.
  Reintenta.». Se mantiene porque no revela si el gasto existe. Pendiente menor de
  copy: para un gasto ajeno, «Reintenta» no ayuda. Restaurar el texto anterior no es
  un cambio de una línea, porque exige separar la lectura por dueño.
- **`disabled={isPending}` en «Cerrar».** `NewExpenseModal` deshabilita el botón
  «Cerrar» y el clic del fondo mientras se guarda, para que el envío en curso no
  pierda el formulario ni el archivo. `app/m/CLAUDE.md` pide no usar
  `disabled={isPending}` a mano y dejarlo a `<ActionButton>`; aquí no aplica porque
  «Cerrar» no es una acción con efecto, pero es una desviación de esa guía y queda
  declarada.

## Estado de aplicación (2026-11-13, Director General)

- **0533_fechas_caracas_operaciones**: **aplicada**. Prueba 16:25:51Z y producción 19:06:22Z del 2026-11-13, md5 `ef1805bd799471fe4c453276639c7b27`, verificación PASÓ.
  - En producción la previa encontró una deriva cosmética en `public.sales_order_claim_and_invoice`: era la lógica de la 0128 sin comentarios ni caracteres no ASCII.
  - Con el OK de Sam («Sí, restaura y aplica») se restauró el cuerpo exacto de la 0128, con guardas de md5 antes y después, y enseguida se aplicó la 0533.
- **0534_annual_billing_caracas**: **aplicada**. Prueba 16:26:30Z y producción 18:01:47Z del 2026-11-13, md5 `9b16d8aaf26282e4db3ddf4930e64981`, verificación PASÓ.

Las dos se retiraron de la espera y quedaron selladas en el tren AD (#529). Donde este documento dice «sin aplicar» o «no aplicada», es el estado histórico anterior a esa fecha. La cabecera del `.sql` no se edita, porque cambiaría el md5 aplicado.
