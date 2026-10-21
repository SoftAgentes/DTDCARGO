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
