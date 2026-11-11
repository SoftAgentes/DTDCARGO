# Handoff · SDD-0574 · Embarques sin facturar (4.5 del plan contable)

> Estado de la retoma Codex, 2026-10-21: producto F1–F3 de `639c8954` y composición documentada en `8394a560` aceptados localmente con sus límites. **La única canónica normal de 8394 terminó con exit 0, 16/17 medidos y CIERRE INCOMPLETO por `migrations-applied` omitido**, con un timeout unitario inicial y retry nativo aprobado conservados. PR [#316](https://github.com/SoftAgentes/DTDCARGO/pull/316) sigue DRAFT contra #307; conocimiento final pendiente. Turno pesado devuelto a las 12:14:35.074Z, cero recursos propios; claim retenido. El cierre documental no cambia producto/tests/donantes. Los bloques históricos de preparación se conservan como evidencia fechada; el bloque final de aceptación canónica fija el estado actual y no autoriza release.

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `fase4-carril-adelantado` / sesión Worker «carril del embarque» (Claude, `claude-peaceful-franklin-a3831e`) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0574-embarques-sin-facturar` |
| Rama | `codex/sdd-0574-embarques-sin-facturar`, creada con `harness-worktree start --from claude/peaceful-franklin-a3831e` (`2e94bccc`), más la reserva `codex/sdd-reserve-0574` (`aeeace19`, sobre `origin/main` reciente) |
| SDD | [0574](../../docs/specs/0574-embarques-sin-facturar/spec.md), `in-progress`. Número asignado por el Director el 2026-10-20; reserva con `sdd:next --reserve embarques-sin-facturar --number 0574 --push` |
| Dependencia | **Apilada sobre la SDD-0571 (PR #307)**: lee `shipment_rate_snapshots`. Se integra después de la #307 |
| Permisos | Commits, push de la rama propia y PR en borrador; no fusionar. Lectura de `invoices` autorizada por el Director (solo lectura, BASELINE, aviso a «Contabilidad») |

## OBJETIVO ORIGINAL

La 4.5: reporte «Embarques sin facturar» y tarjetas en Dirección.

## COMPLETADO

- Regla pura y lectura en `lib/studio/rate-snapshots/sin-facturar.ts` (detalle en la spec).
- Página `/studio/reportes/embarques-sin-facturar` (layout de Reportes: accounting + admin) y enlace desde Reportes › Contables.
- Tarjeta «Por facturar» en Dirección (admin), con los tres estados enlazados al reporte.
- Lector nuevo de `invoices` justificado en el BASELINE de `invoice-read-boundary` (19 → 20 archivos, 44 → 45 lecturas).
- Aviso de columnas leídas a la sesión «Contabilidad» (2026-10-20): `id, invoice_code, shipment_id, client_markbox, status, deleted_at`.
- Comprobé que las ramas `sdd-0572` y `sdd-0573` de Contabilidad no tocan Reportes, Dirección ni el BASELINE.
- `/ui-check` en línea: sin hallazgos bloqueantes.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `sin-facturar.test.ts` | regla (facturada, normalización en los dos lados, otro cliente, borrador, anulada, estados, días, orden, fuera) y lectura (borradas, huérfanas, facturas borradas, tarifas reemplazadas, sin la 0496) | PASÓ: 10/10 |
| Mutantes a mano (copia y `cmp` de restauración) | sin normalizar el Shipping Mark de la factura · borrador como facturado · sin excluir el envío cancelado | los 3 MUERTOS; el primero sobrevivió a la primera versión de la prueba y se agregó el caso inverso |
| `invoice-read-boundary.test.mjs` | inventario de lectores de `invoices` | PASÓ |
| `tsc --noEmit` | repo | PASÓ (0 errores) |
| eslint de lo tocado | — | PASÓ |
| `docs:check` | 557 specs | PASÓ |
| `pnpm verify` | completo | NO EJECUTADO: va después del verify final de la 0571, con turno del Director |

## COMMITS

- `aeeace19` reserva SDD-0574.
- `3a837756` reporte, tarjetas, regla, pruebas, BASELINE y spec.
- El commit que contiene este documento.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` (turno del Director), push y PR en borrador, base `main`, declarando que va apilada sobre la #307.
2. Después de la 4.2: cruzar la factura por el envío por cliente, sin Shipping Mark.

## FUERA DE ALCANCE DETECTADO

- La auto-factura de la orden de venta (0128) liga la factura a la prealerta y no al envío: el reporte no la reconoce como cobertura. SDD-0284 midió 0 de 8 compras con orden de venta.

## HANDOFF AL DIRECTOR

- Integrar después de la #307 (lee su tabla). No toca archivos de Contabilidad.
- Ownership: claim de `claude-peaceful-franklin-a3831e`, vigente.
---

## Adopción explícita del Worker Codex · 2026-10-21

Lo anterior se conserva como evidencia histórica de H18edcd81, incluida su declaración de owner; no describe el ownership actual de este árbol nuevo. Adopto AGENTS vigente aportado por Sam, skill Worker y runbook de ingeniería. La autorización actual es el contrato de abajo y la precisión del Director de esta misma sesión.

- Task: `0574-embarques-cierre`.
- Owner único: `worker-0574cierre-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.
- Worktree propio: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0574-embarques-cierre`.
- Rama: `codex/sdd-0574-embarques-cierre`.
- Inicio: `ba43747a803ea9aec3b8750d1b461d69795834a5`.
- Merge normal propio, sin conflictos: `e6b0129c6026ef32db9b5ae37d4a3ce669b17e76`; padres `ba43747a803ea9aec3b8750d1b461d69795834a5` + `18edcd8127f3acdd93e5a9e85c15c589c8712b88`; árbol `277e97c272bf337c2cf55b7b28b97d8fa9384eaf`.
- Guard y claim: PASÓ con este owner antes del merge; árbol limpio al iniciar la preparación. Las ramas/worktrees históricos se conservan intactos.
- Evidencia inicial externa: `C:/tmp/director-traspaso-20261020/0574-cierre-validation/preflight-inicial.json`, hashes de las doce rutas y estado previo.
- Estado: **fase ligera, en preparación**. C3 conserva turno pesado. Ninguna instalación, prueba, Node no-harness, SQL, navegador, build o conocimiento ejecutados; producto intacto desde la combinación.
- Referencia del encargo íntegro: `C:/tmp/director-traspaso-20261020/0574-cierre-asignacion-worker.md`, SHA256 `8f425c182c631416a1e80e700e4b78b64543bd64e2feaa54fa209d3b96ffb5dd`.
- Referencia de revisión: `C:/tmp/director-traspaso-20261020/0574-revision-director-preparacion.md`, SHA256 `05bf85433c9c94a1d3001df43141af43489659486dcb7d704bf54e6abc7e0c33`. Sus F1–F3 son hallazgos de lectura aceptados, no pruebas ejecutadas.

### Precisión de lectura del Norte autorizada por el Director

«Norte vigente» requiere CLAUDE y HANDOFF completos, seguidos por las entradas actuales/relevantes de CHANGELOG que rijan estas superficies; no requiere recorrer íntegro el historial de prototipo ajeno. Quedan leídas las enmiendas y entradas de estados, Reportes, Dirección, tablas y dark. El resto histórico se declara NO RECORRIDO. AGENTS, Worker/runbook/project-rules, registro/políticas y contrato mantienen su lectura completa. Esta precisión no altera el archivo de asignación ni permite modificar producto antes del ROJO.

### Contrato completo de asignación conservado
$worker

# Asignación ejecutable — SDD0574, embarques sin facturar / 4.5

Director: sesión01a15a4e-ddf0-7d82-8656-d9dc56b58468. Fecha2026-10-21. Sam autorizó continuidad local, ramas/commits/push y PR en borrador mientras se resuelve el pago; el prompt final permite este carril de embarques en paralelo con contabilidad. No hay permiso de main/merge/deploy/DB real.

## Identidad y objetivo

Objetivo observable: recuperar la implementación0574, incorporar la corrección vigente0571 y cerrar los tres P2 de su reporte y tarjeta reales, con evidencia local y PR DRAFT. Un importe sin tarifa no se presenta como cero/total completo; el importe congelado conserva su autoridad y explica el volumen que lo genera; una lectura incompleta no certifica Al día. Conservar pairing de factura, prioridades, permisos y lecturas existentes.

Task ID: `0574-embarques-cierre`. Owner único nuevo: `worker-0574cierre-01a15a4e-ddf0-7d82-8656-d9dc56b58468`.

Repositorio de objetos: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Crear aislamiento con el harness vigente: slug `sdd-0574-embarques-cierre`, `--from ba43747a803ea9aec3b8750d1b461d69795834a5`.
Destino esperado: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0574-embarques-cierre`.
Rama esperada: `codex/sdd-0574-embarques-cierre`.

El Director comprobó que ruta y rama nuevas no existen y consultó los dos refs remotos sin mutarlos: rama0571=`ba43747a803ea9aec3b8750d1b461d69795834a5`, rama0574 histórica=`18edcd8127f3acdd93e5a9e85c15c589c8712b88`. Verifica de nuevo raíz/rama/HEAD, adopta explícitamente la metodología y reclama ese owner ANTES de escribir. Si la creación no coincide, no improvises git-dir/work-tree ni edites el checkout principal. No copies .env, secretos, node_modules ni cambios de un árbol ajeno.

Incorpora únicamente el historial0574 H=`18edcd8127f3acdd93e5a9e85c15c589c8712b88` mediante merge normal en TU rama nueva, sobre P=`ba43747a803ea9aec3b8750d1b461d69795834a5`. No rebase/reset/cherry-pick aislado del producto. Conserva ambas ramas históricas y sus claims; no son tuyas. El ancestro común P/H es2e94bcccd5d289d79b97a831b868f216185f6292. Registra SHA de combinación, padres, diff heredado y estado antes de reparar. Si aparece conflicto material fuera de los documentos propios, informa al Director antes de editar esa ruta.

SDD existente: `docs/specs/0574-embarques-sin-facturar/spec.md`; no reservar ID ni SQL. Handoff propio permitido: `.agents/handoffs/0574-embarques-sin-facturar.md`, en TU rama nueva, conservando historia y añadiendo adopción/contrato completo antes de producto. No modificar el handoff ni la spec en el árbol histórico.

## Lecturas obligatorias y evidencia de partida

Lee completas AGENTS vigente aportado por Sam, skill Worker, runbook de ingeniería/project-rules, AGENT-BRIEF/registro/políticas aplicables, marca/diseño/Norte y privacidad según corresponda. Aplica revisión de gobernanza y /ui-check para las superficies reales; matriz de los doce principios SGE y clasificación explícita, sin excepción inventada. Lee el runbook de conocimiento; conocimiento de inicio se registra pendiente mientras no haya turno pesado.

Lee íntegro `C:/tmp/director-traspaso-20261020/0574-revision-director-preparacion.md`, SHA256 `05bf85433c9c94a1d3001df43141af43489659486dcb7d704bf54e6abc7e0c33`, y contrasta las fuentes Git citadas. El Director acepta sus F1–F3 como alcance de reparación, no como resultados de pruebas ejecutadas. Preserva el handoff y las pruebas históricas de H con sus límites. La revisión es lectura, no certificación previa de RLS, UI, verify o combinación.

El diff propio B139e419536623553cdf6ccabb057692dcdd9c27a→H es diez rutas889+/20−. El diff desde ancestro2e94 añade cuatro rutas heredadas de main mediante reserva: quality.yml, su contrato CI, handoff de topeCI y diagnóstico/plan. No son reparaciones0574 ni permiso de modificarlas. La corrección actual0571 toca otras ocho rutas; los lectores queries/types/0496/paginate mantienen sus blobs. Sin intersección textual no significa combinación ya probada.

## Contrato de producto

F1: conservar llegada como prioridad y monto congelado. Separar subtotal calculable, cantidad sin tarifa y completitud por grupo y global, propagados a Reporte y Dirección. Conocido0 sí puede mostrarse0. Desconocido nunca se certifica como0/total, ni se oculta su contador por estar llegado. Distinguir falta de0496, falta de tarifa y truncamiento; mensajes describen el alcance real, también con todas las filas desconocidas o mezcla1700+desconocido.

F2: conservar amount_to_invoice generado por snapshot; no recalcular facturas ni sustituir tarifa/CBM. Transportar y presentar la base congelada, o ambos volúmenes inequívocos con aviso/tolerancia del contrato0571. Ejemplo sintético snapshot2m³×850=1700 y actual3m³:1700 permanece, se explica2 frente3; no presentar3×850=1700 sin aviso. Cubrir mínimos/reemplazo/volumen actual ausente y unidades USD/m³.

F3: distinguir vacío completo elegible de vacío del subconjunto incompleto. Este último no da Al día, ausencia universal de pendientes ni tono de éxito de cero comprobado. Se permite lectura parcial con aviso veraz; no rechazar indiscriminadamente todo parcial ni cambiar el paginador compartido. Error nunca se convierte en vacío exitoso.

Conservar unidad temporal recepción hasta4.2, pairing shipment_id+clave(markbox) en ambos lados, estados fiscales emitida/parcial/pagada/vencida, borrador/anulada no cubren, otro cliente nunca cubre, exclusiones cancelado/deleted/huérfano, orden/prioridad. Autorización accounting/admin para Reportes y admin para Dirección, cliente de sesión y RLS/tenant existentes. No privilegios nuevos, escrituras de negocio, impuestos, cobranza, moneda global ni retorno a datos reales. El cruce con factura por prealerta0128 y la nueva unidad4.2 quedan fuera de alcance detectado, sin borrar esa deuda documental.

## Allowlist exacta — doce rutas

```text
lib/studio/rate-snapshots/sin-facturar.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/reportes/embarques-sin-facturar/page.tsx
app/studio/(app)/direccion/_components/SinFacturarCard.tsx
app/studio/(app)/direccion/page.tsx
app/studio/(app)/reportes/page.tsx
scripts/__tests__/invoice-read-boundary.test.mjs
docs/specs/0574-embarques-sin-facturar/spec.md
docs/specs/README.md
.agents/handoffs/0574-embarques-sin-facturar.md
app/studio/(app)/reportes/embarques-sin-facturar/page.test.tsx
app/studio/(app)/direccion/_components/SinFacturarCard.test.tsx
```

No obligación de editar doce. Índice por generador. Lecturas/baseline se recalculan exactamente en la combinación, sin debilitar guardas ni conservar conteos viejos por conveniencia. No editar SQL, archivos0571, infraestructura/runner/gates/dependencias/CSS global ni rutas contables. Una ruta adicional exige justificación y decisión previa del Director. Fixtures sintéticas y recibos externos propios bajo `C:/tmp/director-traspaso-20261020/0574-cierre-validation/` sí autorizados; nunca secretos/PII/rawcontratos/financieros enGit.

## Fases, pruebas y turno

AHORA SOLO FASE LIGERA: crear/claim/merge propio; leer; guardar contrato y diseñar/autorizar pruebas y fixtures. Puedes escribir las pruebas F1–F3 y documentación propia, sin alterar todavía el producto antes del ROJO. No Node/tests/instalaciones/tsc/build/SQL/Docker/navegador/Graphify/Archify/knowledge durante la receta C3. El harness de creación/claim/guard y lecturas Git pequeñas son la excepción de coordinación, no un permiso de probar. Entrega preflight: padres/SHA/cleanclaim/allowlist, propuesta de API exacta, matriz de pruebas, instrucciones de instalación congelada propia y cualquier frontera real. Solicita turno al Director sin preguntar a Sam. NO tienes aún turno pesado ni GO canónico.

DESPUÉS DEL TURNO EXPRESO: instalación propia congelada sin scripts/copias de entorno ni upgrades, ROJO funcional F1–F3 sobre combinación intacta (sin confundir fixtures/import con defecto), corrección propia, VERDE y regresiones históricas intactas. Pruebas de componentes reales de ambas salidas, no DTO copiado. Cubrir el cero conocido, llegada sin tarifa/mezcla, ausencia0496, volumen distinto/igual/ausente/mínimo/reemplazo, vacío completo/incompleto/parcial, errores y paginación normal/corte. Validar roles/tenant con recursos locales sintéticos autorizados y explicar qué es mock vs RLS real; si falta infraestructura duradera que requiere otra ruta, proponerla ANTES de editar, no fingir ejecución. Mutantes proporcionales de F1–F3 por aserción prevista/restauración, no sumar los tres históricos como nuevos.

Tipos/lint/índice/SDD/numeración/invoice-read-boundary, UI con componentes/CSS reales en claro y oscuro, ancho390 y escritorio, última columna, teclado/foco y reflow/zoom con límites honestos. Sin sesión productiva, teléfono o A11Y global inferidos de fixture. Checkpoint estable/commit/push/DRAFT antes del canónico para revisión íntegra porSHA. El Director concede UNA receta normal pnpm verify; manifiesto previo de fuentes/config/runners/lock y bytecheck tras EXIT antes de docs. Nada de overrides/secretos para ocultar SKIPs; receta incluye build, no repetirlo sin nuevo motivo.

Cierre: documentos con PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE por comprobación, logs/hashes y límites; revisión final del Director, UN ciclo local de conocimiento después del commit documental estable y resultados externos+PR para evitar recursión. Separar estructura/semántica/Archify/preview/integración/Obsidianvisible. Sin publicar bóveda compartida desde rama no integrada, sin certificados de limpieza global. Conservar worktree/rama; solo recursos propios probadamente atribuibles pueden cerrarse, documentar desconocidos. Handoff registra pendientes propios y FUERA DE ALCANCE separados, commits/PR/limpieza/owner. Liberación de claim solo al cierre aceptado.

## Publicación y secuencia

Autorizados commits selectivos propios y push a `codex/sdd-0574-embarques-cierre`, PR DRAFT con base **`claude/peaceful-franklin-a3831e`**, declarando0571/#307 como dependencia y su SHA ba437. Antes de crear, reconsultar base remota; si cambió, avisar al Director sin retarget automático. Adjuntar la PR a esta tarea con la herramienta del app; descripción humana con problema/comportamiento/validación/límites y SHA/base. Conserva la rama histórica sin cierre/borrado. El delta de PR incluye la herencia nombrada; informa esa diferencia y separa cambios propios.

El carril0574 es PARALELIZABLE en lecturas/preparación y escrituras de sus doce rutas con el C3 aislado; es DEPENDIENTE del turno para cualquier prueba pesada y del307 para integración. No hay ancestry de Caracas/BCV/0573/0575 en este trabajo. Contratos y archivos contables compartidos se reevaluarán en su composición futura; no se da por probada por una afirmación histórica. Director serializa recursos y revisa. Sin main, merge, auto-merge, deploy, VPS, migración0496 real, lectura de negocio, contacto externo ni cambio de facturación/cuentas.

Ejecuta hasta completar dentro de las fases y turnos expresos. Reporta avances al Director y espera ese turno en el checkpoint ligero, conservando evidencia durable; no abandones por tener pendiente el pago ni absorbas bugs ajenos. No hay pregunta a Sam necesaria para esta tarea local.

### Checkpoint ligero preparado · 2026-10-21

**No es cierre de producto.** Sobre e6b0129c se prepararon la spec y tres archivos de pruebas; las cinco rutas de producto de la allowlist, el baseline, el índice y las dependencias/runners protegidos siguen con sus bytes iniciales. No se ha observado un ROJO todavía, ni iniciado el parche de producto.

- API propuesta exacta en la spec, precisada antes del GO: `TotalesSinFacturar { cantidad, subtotalConocido: ImporteUsdExacto, sinTarifa, aFacturar: ImporteUsdExacto | null }`, por grupo y global. `ImporteUsdExacto` es texto decimal canónico con dos decimales, proyectado desde centavos BigInt internos. La regla recibe `lecturaCompleta?: boolean`; el lector propaga su conjunción real. La fila conserva importe numérico del snapshot, transporta `cbmCongelado`/`minimo` y no recalcula con CBM actual. Dirección recibe el agregado global del lector.
- «Sin tarifa disponible» de Dirección es transversal e incluye lo llegado. Se explica el cruce de tarjetas y no se propone sumarlas. El reporte conserva categorías exclusivas y prioridad de llegada. Se distinguen todo desconocido, cero conocido, cero conocido mezclado con faltante y cualquier subtotal de lectura parcial.
- Inventario por lectura de pruebas preparadas, después del suplemento de precisión: 38 regla/lector, 29 Reporte/layout, 20 tarjeta/Dirección; **87 previstos, 0 ejecutados**. Es un inventario manual, no resultado de runner. Los diez casos históricos siguen presentes; el agregado se proyecta a texto exacto y su antiguo cero de importe desconocido cambia a null por el contrato F1, conservando cantidades y montos conocidos. Las filas individuales conservan su expectativa numérica.
- Se ejercitarán el lector/regla y componentes reales con dobles solo en las fronteras de datos y agregados ajenos. La prueba de cableado lee la página de Dirección real y renderiza su tarjeta. Los dobles de membresía no son PostgreSQL/RLS; jsdom no es prueba CSS/navegador.
- Recursos RLS existentes identificados: pruebas SQL0414 y0496, con identidades/tenants sintéticos y migraciones reales; se recopilará su resultado/límite cuando se autorice la receta local. No se inventó un filtro de archivos para `run-sql-tests.mjs` ni se amplió la allowlist.
- Lecturas completas: AGENTS; Worker/runbook/project-rules; AGENT-BRIEF/registro; políticas SGE/TBL/A11Y/NUM/LOD/ERR/VIS01/VIS02/CMP/LNK/ICO; AVS en SDD0165; BRAND/diseño; Norte CLAUDE/HANDOFF/backend README; app/studio/CLAUDE; ui-check; conocimiento; contrato y revisión. La cápsula/registro de componentes se consultaron como índices y no sustituyen fuentes normativas.
- Corte del CHANGELOG del Norte autorizado: 1–71,151–159,1896–1920,2105–2211,2315–2347,2603–2638,2846–2863. Resto histórico **NO RECORRIDO**. No se traslada el mock «sin backend» ni fallbacks históricos al contrato real. Gobernanza mantiene F1–F3 como no conformidades abiertas y revisión visual pendiente; no hay excepción.
- Recibos externos propios: `C:/tmp/director-traspaso-20261020/0574-cierre-validation/preflight-ligero.md` y `preflight-ligero.json`; conservan matriz, API, receta de instalación congelada propuesta, hashes/alcance y límites.
- Instalación y toda validación Node no-harness/pruebas/SQL/UI/knowledge: **NO EJECUTADAS**, pendientes del turno expreso. La receta propuesta fija pnpm11.19.0 de la CI, evita scripts/env/copias ajenas y no se ejecutó. El shim local disponible contiene11.25.0 y no se atribuye a la CI. Se usarán `COREPACK_ENABLE_AUTO_PIN=0` y `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` solo en el proceso, restaurados al salir, con hashes de package/lock antes y después incluso al fallar. El Corepack0.35.0 instalado admite `pnpm@11.19.0` por lectura: README175–183, parser `corepack.cjs:14515–14527`, descriptor/ejecución13828–13856; autopin13796–13804 y prompt12969–12980 condicionados a1. No se ejecutó ningún manager ni se modificó su configuración.
- No hay commit de reparación ni PR nueva. El Director autorizó un commit/push selectivo de estas cinco rutas de pruebas/documentación como respaldo parcial revisable antes del GO; el recibo externo registrará SHA y igualdad remota. El claim permanece con el owner de esta retoma. El turno pesado sigue en C3 y no se toma por iniciativa propia.

### Precisión incorporada al preflight · 2026-10-21

El Director aceptó el preflight anterior `7d5b5d5a…` por lectura y pidió cerrar precisión e instalación antes del turno. Se conserva su copia íntegra como `preflight-ligero-antes-precision.md/json` fuera de Git. La asignación original `8f425c18…` sigue intacta.

La suma de muchos `numeric(14,2)` no cabe necesariamente en centavos seguros de Number. Propuesta mínima dentro de las mismas doce rutas: recuperar los dos decimales de cada importe válido del snapshot, sumar centavos BigInt y devolver texto exacto; el cliente recibe cadenas JSON, no BigInt ni una aproximación. Reporte/tarjeta formatean esas cadenas sin coerción numérica, con adaptadores locales que conservan el import solo de tipo del lector. No se cambia la captura, el normalizador común, SQL, `lib/money` ni el paginador. La magnitud por sí sola no vuelve nulo un total conocido y no incrementa faltantes.

Los tres bordes `90071992547409.91/.92/.93` provienen de 92 snapshots aritméticamente realizables con las escalas de 0496: 90 × (100.000 × 9999999999.99), uno de (100.000 × 700000000.00) y uno de (1.000 × 1992547499.91/.92/.93), mínimo0. Los tests guardan literales esperados y recorren regla, lector/normalizador, JSON y ambas UI reales. También se escriben magnitud+faltante1 y 60000 filas observadas con subtotal `59999999999940000.00`, lectura parcial y faltantes0. Este último no certifica haber llegado al vacío del paginador. Todos los oráculos permanecen **NO EJECUTADOS** y no son evidencia de ROJO ni de precisión ya implementada.

**Pendientes propios:** instalación, ROJO funcional, producto F1–F3, verde/regresiones/mutantes/restauración, roles/RLS, UI real, tipos/lint/docs/numbering/baseline, checkpoint/DRAFT, verify por receta y conocimiento. **FUERA DE ALCANCE DETECTADO:** unidad4.2 y cobertura de la auto-factura0128 por prealerta, conservadas; no se absorben Caracas/BCV/0573/0575 ni operaciones de producción.

### Avance después del ROJO · 2026-10-21

La preparación de cinco rutas quedó comprometida/publicada en `1ffa8acced21871379cd0c67ade6a90445d77219`, padre `e6b0129c`, remoto igual y ahead/behind0 en ese checkpoint. El Director leyó los tres archivos de pruebas completos y aceptó la API de centavos BigInt/proyección decimal textual. No se movió la rama histórica ni se cambió la combinación.

**Fase1 ejecutada en turno expreso y cerrada antes de producto:**

| Comprobación | Estado / evidencia |
|---|---|
| Instalación propia congelada | Manager PASÓ exit0: `corepack pnpm@11.19.0 install --frozen-lockfile --ignore-scripts --store-dir .pnpm-store`, 50.75s de pared. Package/lock idénticos. Sin env/copias ajenas, scripts de instalación ni upgrades |
| Envoltorio de instalación | FALLÓ exit1: `environmentRestored=false`. El proceso23736 terminó. La reproducción separada muestra que PowerShell7.6.5 convierte el null pasado a SetEnvironmentVariable en cadena vacía; la receta futura debe eliminar el nombre del proveedor Env si antes estaba ausente y restaurar el valor si existía. El recibo original no midió los tipos previos y no se recertifica retroactivamente. No se repitió instalación |
| Conocimiento inicial | NO DISPONIBLE por interrupción autorizada después de335.85s. JSON `ok=false`, estructura/semántica UNAVAILABLE; wrapper exit0 no es verde. Se terminaron solo procesos atribuibles a esa inspección. Sin generación/publicación, sin cambios de ignores/runtime/store; no se atribuye causa única a la caché |
| ROJO funcional | Tres archivos completos, Vitest4.1.7, maxWorkers2/retry0. 87 casos: regla/lector38 (26 fallan/12 pasan), página29 (15/14), tarjeta20 (12/8). Total53 fallan/34 pasan/0 skip/0 todo; exit1, 35.97s pared. Nueve suites del JSON son agrupaciones, no nueve archivos |
| Clasificación del ROJO | 33 AssertionError, 14 búsquedas DOM y6 toHaveTextContent: agregado, base congelada, faltantes/alcance y UI real en jsdom. Sin import/resolve/TypeError/ReferenceError/SyntaxError/timeout/no manejado detectados. No corrección de fixture ni reintento |
| Huellas/procesos | 27/27 iguales: cinco producto, diecisiete protegidas, cinco preparación. Ningún tracked cambiado; solo store propia sin rastrear. PIDs registrados y procesos pesados atribuibles ausentes a08:23:49Z; turno devuelto expresamente a C3. Claim propio conservado |

Los bordes monetarios fallaron con diferencias observables: `.91` recibió `.9`, `.93` recibió `.94`; 60000 filas esperaban `59999999999940000.00` y recibieron Number `59999999999994390`, además de certificar monto con lectura cortada. No son filas reales. Los fixtures de permisos no prueban RLS; jsdom no acredita CSS/navegador, dispositivo ni A11Y integral.

**Recibos externos inmutables:** carpeta `C:/tmp/director-traspaso-20261020/0574-cierre-validation/`. Primer preflight conserva `preflight-ligero.md` SHA256 `7d5b5d5a882d5c333dcd1a4f341eb71400d942e5e1fb70539c11aa859caf76a1` y JSON `9bb117c9042aa7fa4ca923d3fabd065fcd98a0f12e3429f5c1eb13d78dbb0ff8`; precisión posterior usa nombres nuevos `preflight-precision-1ffa8acc.md/json` (`6e462f49…`/`ac3c0817…`). No se sobrescriben los originales citados.

- `fase1-red-1ffa8acc.receipt.json`: SHA256 `36dce84b0b0cd49aeb6d0a5127874bff9346540d07504654b894b4f665a86458`.
- JSON nativo ROJO: `8e9e0a6b2bfa8f597063674dce87bb8a24db43a1822c66e9825151ce0b90c57b`; log: `e23e65b91facf00fbe9152b2402986bc067eff8743527bf363da3bd23bd35a1c`.
- `fase1-resumen-1ffa8acc.md`: SHA256 `3cc586868d3aed18edb8b62564fcf423d98fff4b1dcda7062ad78092f0bf9cbe`.
- `fase1-cierre-1ffa8acc.json`: SHA256 `df44eef2bbf88da90d79de1e7d595ba93b207129ec8417ebf0a62ae81ae509ee`; inventaría todos los artefactos de fase1 y huellas finales. Se creó antes de editar producto y no se actualiza con el parche.

**GO de implementación ligera:** después de leer el recibo, los53 nombres/primeros diagnósticos/líneas y cotejar los hashes, el Director autorizó producto/test/docs dentro de las mismas doce rutas, sin ejecución durante C3. El parche actual modifica cuatro rutas de producto:

- `sin-facturar.ts`: suma importes fuente en centavos BigInt y proyecta texto exacto, por grupo y global. Conserva subtotal/faltante y anula el total si falta tarifa o lectura. La guarda por fila rechaza formato incompatible con numeric14,2; no lo disfraza como ausencia ni cero. Transporta CBM congelado/mínimo; mismo pairing, prioridades y consultas de sesión.
- Reporte: global y categorías muestran alcance/subtotal/faltante; separa vacío completo/parcial. Tabla de CBM congelado/actual, aviso mediante `cbmCambio` existente y mínimo, sin recalcular. Agregados formateados por texto; fila conserva formateador numérico de su importe acotado. Contenedor desplazable con nombre y foco para comprobación posterior.
- Tarjeta: contador sin tarifa transversal `total.sinTarifa`, incluido lo llegado, con explicación visible del cruce. Parcial no usa éxito por cero. Conserva los cuatro enlaces y solo importaciones de tipo de la biblioteca del lector; no añade hooks, estado compartido, fetches ni cascadas.
- Dirección pasa el mismo `total` del lector. No cambia sus consultas ajenas, gates ni cifras contables.

Los tres archivos de pruebas conservan sus87 oráculos y bytes del ROJO. Revisión acotada de React aplicada por lectura: props/estado derivados, null separado de cero, importación de tipos, sin solicitudes adicionales, tabla semántica y avisos textuales. No se recomienda cambiar bibliotecas ni tokens DTD. El diff/checkpoint ligero y scripts externos futuros no equivalen a validación ejecutada.

**Validación siguiente preparada fuera de Git:** `fase2-plan-preparado.md` (SHA256 `5b1edab2f096e1febc0f90a523482bbcffdbde942ebb88040760fff45a16d4f9`) describe el focal87, ocho archivos de regresión, catorce mutantes y una fixture visual de componentes/CSS reales con DB sintética. `fase2-runner.cjs`, `fase2-mutants.json`, `fase2-ui.cjs`, `fase2-ui-data.ts` y `fase2-ui-entry.tsx` permanecen **NO EJECUTADOS**; su sintaxis/funcionamiento no están certificados. Por lectura de anclas, las14 sustituciones son únicas y sus tests existen. Se exige nuevo turno, SHA estable, guard/claim y referencia de GO; ninguna fase se encadena o reintenta automáticamente. El recibo externo del checkpoint inventaría los seis hashes. Los límites incluyen SSR estático, no RLS, Chromium/viewport sin teléfono real ni zoom nativo, y revisión visual posterior de capturas.

**Pendientes de esta tarea:** verde87, regresiones pertinentes/baseline exacto, mutantes y restauración, tipos/lint/docs/numbering, RLS/SQL sintéticos, UI real claro/oscuro/390/escritorio/teclado/reflow, checkpoint funcional revisado y DRAFT, verify normal por receta del Director, ciclo de conocimiento/cierre. Todos **NO EJECUTADOS sobre el parche**; conocimiento inicial **NO DISPONIBLE**. Sin autorización actual para nuevos procesos pesados, PR, integración o producción. Claim permanece hasta cierre aceptado.

**FUERA DE ALCANCE DETECTADO:** las dos deudas ya declaradas (unidad4.2 y cobertura0128 por prealerta) conservan su frontera. No se absorben 0573/0575/Caracas/BCV ni cambios contables globales. No hay hallazgo nuevo que exija ampliar las doce rutas.

## Checkpoint funcional aceptado y composición 0577 · 2026-10-21

Este bloque sustituye el estado pendiente de los apartados de preparación, conservados como historia. El contrato original `8f425c18…`, los sobres previos y el ROJO no se reescriben. El Director aceptó el producto y la evidencia de `639c8954607ee81f86694390775fae325acadf8a` con los límites de esta sección; no transfirió esa ejecución a un SHA posterior.

### Evidencia ejecutada sobre 639

| Comprobación | Resultado y alcance real |
|---|---|
| Focal original | **PASÓ 87/87**, tres archivos reales: regla/lector 38, Reporte 29, tarjeta 20; cero fallo/skip/todo, maxWorkers2/retry0. Nombres/firmas únicos exactamente iguales al ROJO; sus 53 fallos pasan. Pared 39.411 s, Vitest 35.59 s |
| Regresiones | **PASÓ 167/167**, ocho archivos, cero fallos/skip/todo; 87 repetidos + 80 adicionales, no 254 únicos. Incluye types14, propuesta11, paridad PGlite12, consultas Dirección39 y baseline4. No prueba RLS real de servidor |
| Tipos | **PASÓ**, tsc --noEmit local, exit0 sin diagnósticos; 94.2 s |
| Lint | **PASÓ**, cuatro productos reparados + tres tests, exit0 sin warnings, 62.392 s; no se renombra canónica |
| Variantes M01–M14 | **PASÓ**, 14 detectadas por su aserción funcional prevista, cero sobrevivientes/inconclusas/timeout. Una por turno secuencial, restauración individual de bytes y final de 27/27 fuentes. Casos no seleccionados por patrón se conservan como no seleccionados; no son una suite completa ni 14 casos únicos nuevos |
| UI original | **FALLÓ PREPARACIÓN**: entrada absoluta Windows marcada external por el resolver genérico; exit1 antes de servidor/navegador/capturas, cero PNG. No fue un fallo de producto ni se borró el intento |
| UI V2 | **PASÓ en alcance observado**, ejecución única exit0 en 37.7893113 s; 40 combinaciones, 56 PNG revisados, cero diagnósticos. Cambió solo el resolver externo autorizado: `if (path.isAbsolute(args.path)) return undefined;` |
| Recursos/huellas | Cada fase devolvió su turno después de EXIT y bytecheck. Última devolución a09:40:26.3670904Z: 27/27 intactas, tracked limpio, siete PIDs observados ausentes, cero consumidores propios y cero conexiones/listeners del puerto32766 |
| Canónica, SQL/RLS de servidor, build general y CI del receptor | **NO EJECUTADOS**. El focal PGlite no se presenta como esos gates. Esperan la receta normal y el turno expresos |
| Conocimiento | Inicial **NO DISPONIBLE**, interrupción autorizada conservada. Ciclo final **NO EJECUTADO**; no publicación compartida ni apertura visible de Obsidian acreditadas |

UI: siete escenarios × dos superficies × dos temas a390 =28; mixed/precision a1280 =8; mixed a320 =4. Se distinguen subtotal exacto/total desconocido, todo sin tarifa, esquema no disponible, vacío parcial y vacío completo. La tarjeta incluye el faltante llegado en su contador transversal y explica que no se suman las tarjetas. La tabla muestra CBM congelado2/actual3 con $1,700.00 conservados y el mínimo $100.00; no recalcula a partir del volumen actual. La cifra agregada $90,071,992,547,409.93 conserva los centavos.

Cero desbordes de página en40 medidas. Las14 tablas con desborde propio responden a ArrowRight (0→40); las dos mixed/1280 completas permanecen en0. Las16 últimas columnas se fotografiaron después de scroll programático al extremo y quedan dentro del contenedor. No se atribuye ese recorrido completo a una sola tecla. Las20 tarjetas conservan cuatro enlaces y foco visible; los16 reportes con tabla enfocan la región. Rúbrica `.claude/commands/ui-check.md` aplicada como advisory, sin hallazgo obligatorio observado ni reparación de marca heredada.

**Límite visual conservado:** seis PNG de reportes largos empiezan en la tabla por el foco, sin probar por píxeles la cabecera superior: partial-rows/390 y precision/390/1280, ambos temas. Sus resúmenes sí se cotejaron exactamente en DOM. SSR estático/DB sintética/CSS de utilidades acotado con Studio/tokens/fuentes reales, sin hidratación, sesión/RLS reales, navegación autenticada, teléfono físico, zoom nativo ni auditoría A11Y/performance integral.320 es reflow de ancho. El Director aceptó esta frontera y no pidió otro ciclo de fotos.

### Recibos inmutables y aceptación

Raíz externa propia: `C:/tmp/director-traspaso-20261020/0574-cierre-validation/`. Logs y datos sintéticos no se agregan a Git. Los siguientes recibos inventarían sus entradas/salidas, hashes, procesos y fuentes:

| Recibo | SHA256 |
|---|---|
| `fase2-focal-639c8954-1792573708412/cierre-turno.json` | `d0601cfaac863a947d85d832db09507c3d0fc56f03f13758e07a51e14ff04530` |
| `fase2-regresiones-tipos-lint-cierre-639c8954.json` | `4ba37cb34cbcadda9a604a675b2467e488751f7049df5e0234ffd9249e9eed05` |
| `fase2-mutants-639c8954-1792575062065/receipt.json` | `3b49115cf94f2679a2f3ee268fa066da34712a558778203d3937604ef0d47f09` |
| `fase2-variantes-ui-cierre-639c8954.json` | `4cc7aa1020a4e0167ab3462083b0c2bf4b7c7c875b6be3081fb8759fe2f69d5e` |
| `fase2-ui-v2-cierre-639c8954.json` | `a39074f0220b9e27ab957a70599a1a4df52213afbef0d37a581a19f7a4cfdb6e` |
| `fase2-ui-v2-revision-639c8954.md` | `3dcbdfcb8be01a0ea4cb93c22265392240fc30728ae1346cd796ebe8b88c3cd0` |
| `fase2-ui-639c8954-1792575547956/receipt.json` | `c9ba93baae1514fc0dec4708597a051a1e21fa4b951f0ff8abb958cc5f1aa0be` |

Director cotejó8/8 artefactos focales y las87 identidades contra ROJO, revisó regresiones/tipos/lint, catorce diagnósticos/JSON de variantes y su restauración, y cotejó81/81 artefactos UI por hash/bytes. La revisión independiente de639 no encontró hallazgo obligatorio. Director examinó además ocho recortes UI y las40 medidas/modelos; la revisión de los56 PNG corresponde al Writer. Aceptación limitada al SHA y cobertura indicados.

El plan anterior `fase2-plan-preparado.md` `5b1edab…` y su runner permanecen intactos como propuesta histórica. Su entrada directa al verificador/watchdog externo no rigen. La V2 `fase2-plan-canonica-v2.md` `38ff19df…` y runner `a2affce5…` conservaron las fases locales; la receta canónica normal es exclusivamente `corepack pnpm verify`, con GO independiente. El suplemento propuesto de catorce negativos monetarios no fue autorizado ni se necesitó para este cierre; no se añadieron tests ni se alteraron los87 originales.

### Composición local autorizada de 0577

Autorización leída íntegra: `C:/tmp/director-traspaso-20261020/0574-baseline-0577-autorizada.md`, SHA256 `4b0aa0638494febdc03bfbfbc7bb95077e0c5af5cd6a87baf3bac7a4fad5580d`. Permite composición/documentación/Git, sin turno pesado ni nuevo producto. C3 conserva ese turno.

- Receptor:639; donante revisado `c4b2e72dabbdde80ec7fe5c8a7f128966b6494be`, rama `codex/sdd-0577-contratos-pruebas-portal-embarques`, PR[#315](https://github.com/SoftAgentes/DTDCARGO/pull/315) DRAFT. Ancestro común `eafbd910d1c082c9b416b558f8c3db5847b994a6`.
- Merge normal `827df6c8be5446c69e5c8264fc179aeb18af0a30`; padres completos `639c8954607ee81f86694390775fae325acadf8a` y `c4b2e72dabbdde80ec7fe5c8a7f128966b6494be`; árbol `ca6460dcbc06342dc8caa5c353d142f8d3a06db4`.
- Sin conflictos pendientes; merge semántico de README existente y regeneración con `node scripts/build-docs-index.mjs`:558 specs/19 huecos locales. No son números disponibles. No se reservaron IDs/SQL ni se modificó el generador.
- Delta inmediato639→merge: únicamente dos tests y dos documentos de0577, más README. Los26 archivos protegidos distintos de README conservaron sus hashes al crear el merge. La documentación propia se actualiza después; producto/tests/runners/package/lock siguen iguales.
- Tests heredados: Portal blob `8112f1d2d1d98623830e31855e67c0bf97b325d3`; Embarques blob `64c357737fd383078ce3b68594f816561f93bed5`. Spec0577 `10c3bf9f8a815f66caad5563ecc78caf158bb8aa`; handoff0577 `d205c0f629b344b6a5e45ff85001ced7fb9ea079`. Cotejados contra el donante sin editarlos.
- Donante:40 casos,171 oráculos/29 negativas conservados, dos comprobaciones nuevas visible/enabled antes del único segundo click. Su par original/candidato40/40 pasó; no reproduce el timeout ni demuestra mejora estable/causa. Esta herencia no convierte su ejecución en resultado del receptor.
- Preflight propio `composicion-0577-preflight-639c8954.json` `0f996933d5f8a1725d641ecea81d6afc44cd03cc6526b1638ec1c502aa2c9366`; recibo de merge `composicion-0577-merge.json` `fccbd87a052fabe9af3f675ed8e550f00768aac2e10dacd655154a53c36ce7a1`.

Allowlist acumulada exacta de16 rutas (README compartido cuenta una vez):

```text
lib/studio/rate-snapshots/sin-facturar.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/reportes/embarques-sin-facturar/page.tsx
app/studio/(app)/direccion/_components/SinFacturarCard.tsx
app/studio/(app)/direccion/page.tsx
app/studio/(app)/reportes/page.tsx
scripts/__tests__/invoice-read-boundary.test.mjs
docs/specs/0574-embarques-sin-facturar/spec.md
docs/specs/README.md
.agents/handoffs/0574-embarques-sin-facturar.md
app/studio/(app)/reportes/embarques-sin-facturar/page.test.tsx
app/studio/(app)/direccion/_components/SinFacturarCard.test.tsx
app/p/[token]/supplier-flow.test.tsx
app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx
docs/specs/0577-contratos-pruebas-portal-embarques/spec.md
.agents/handoffs/0577-contratos-pruebas-portal-embarques.md
```

Esta ampliación permite heredar0577 y documentar el receptor. No autoriza alterar producto/tests de639, tests/spec/handoff0577 ni cualquier archivo adicional. Solo README generado y los dos documentos propios pueden cambiar en este bloque. No se incorporan productos C3/C2, Caracas, BCV,0573/0575 ni WIP ajeno.

La comparación completa contra la base `ba43747a` tiene veinte rutas, no dieciséis. Las cuatro adicionales ya procedían de main por la reserva histórica de 18ed, con autorización y límite explícitos en la asignación original: `.github/workflows/quality.yml` (blob `e2bf24977abebd5c099d07aa744a9231ce233cff`), `scripts/__tests__/ci-workflow-contract.test.mjs` (`ecb2d21871769f911faa4628c0bdea4145c0ef9b`), `.agents/handoffs/2026-10-20-ci-calidad-tope-y-paralelismo.md` (`fa5733641d20ee39c570a86f419380098e6bc230`) y `docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md` (`92ba7b672d35127c83308959c29b48ed64fd3862`). Los cuatro blobs coinciden en 18ed, e6, 639 y 827; no se editaron ni se amplía su permiso. Se separan esta herencia y las dieciséis rutas del alcance acumulado al describir la PR.

### Entrega y pendientes propios

Comprobaciones ligeras de la documentación compuesta: guard propio **PASÓ**, `docs:check` **PASÓ** con 558 specs; numbering **PASÓ** con 558 specs/489 migraciones y los once avisos de colisiones históricas conservados, sin renumeración; `git diff --check` **PASÓ**. Son controles documentales, no una nueva corrida de producto. La comparación rastreada de este bloque contiene únicamente spec/handoff propios; `.pnpm-store/` preexistente se conserva sin rastrear.

Commit/push selectivos de la rama propia y PR DRAFT autorizados contra `claude/peaceful-franklin-a3831e`, base nominal `ba43747a803ea9aec3b8750d1b461d69795834a5`, dependencia[#307](https://github.com/SoftAgentes/DTDCARGO/pull/307). Reconsultar la base antes de crear; no retargetear si deriva. El recibo externo final y readback de la PR conservarán SHA/padres/base/delta/blobs, respaldo remoto y estado. No se hace commit adicional para autocitar el hash del mismo documento.

**PR entregada:** [#316](https://github.com/SoftAgentes/DTDCARGO/pull/316), OPEN/DRAFT, adjuntada a la tarea. Readback inicial sobre el commit documental `853b546392918936281dc382300928ec3b7bd55c`: base exacta `ba43747a803ea9aec3b8750d1b461d69795834a5`, veinte rutas y cuerpo cotejado íntegro; checks vacíos, no CI verde. `pr316-readback-853b5463.json` SHA256 `cbd39fff7403583077e22a0338b7bae874220db4276a50381b947e8192cdeeca` conserva esa lectura. El único delta posterior es registrar aquí la URL/entrega; el recibo externo final identifica el HEAD resultante y su igualdad remota, sin cambiar producto o pruebas.

**Preparación histórica de la canónica (ejecución y resultado en el bloque final):** manifiesto de31 fuentes y originales sellados, receta normal `corepack pnpm verify`, previa comprobación de SHA/claim/limpieza/ausencia de entorno real y versión efectiva. La receta finalmente ejecutada pasó únicamente `COREPACK_ENABLE_AUTO_PIN=0` y `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` en una **copia del entorno de cada hijo**; no mutó el padre ni necesitó borrar/restaurar entradas de Env. Sin VERIFY*/NODE_OPTIONS, credenciales, cambio de topes/concurrencia/gates o entrada directa al script. Se preservó el fallo de preflight b0ed antes del gestor; la V2 y su nuevo GO permitieron la única ejecución posterior, sin reparación o reintento externo de pruebas.

Pendientes propios: revisar checkpoint/PR DRAFT compuesto; canónica normal sobre SHA aprobado con turno separado, inspección de exit/pasos/SKIPs y RLS/SQL/build reales que efectivamente ejecute; cierre documental estable; un único ciclo de conocimiento local con turno y límites por capa; respaldo/limpieza/recursos/claim al cierre aceptado. Estado inicial de conocimiento NO DISPONIBLE permanece histórico. Integración, producción y bóveda compartida no están autorizadas aquí;0495 no se repite y0496 sigue sin aplicar.

Gobernanza: matriz por principio actualizada en la spec, con F1–F3 en cumplimiento local observado y sin excepción. Permisos/RLS reales, seis cabeceras por píxeles, dispositivo y accesibilidad integral conservan sus límites. La canónica fue ejecutada después de este checkpoint; su omisión de release y el conocimiento pendiente pertenecen a esta SDD, no a FUERA DE ALCANCE.

**FUERA DE ALCANCE DETECTADO:** se conservan la unidad futura4.2 y la cobertura0128 por prealerta. La reparación0577 se hereda por mandato, sin absorber mejoras generales de Portal/borrado ni atribuir el timeout a una causa no demostrada. No hay nuevas operaciones de negocio, permisos, tasas, correlativos o migraciones.

## Aceptación canónica sobre 8394 y cierre documental D · 2026-10-21

Este bloque sustituye las previsiones de los checkpoints anteriores, que se conservan como historia. Director leyó y aceptó la evidencia de la única canónica normal sobre `8394a560065d49bd2e0064455f8985646191afab`, con **exit0 y CIERRE INCOMPLETO: 16/17 pasos medidos**. La aceptación no certifica CI/release/producción ni transfiere la corrida a un producto posterior. Producto/tests de 639, cuatro archivos heredados de 0577/c4 y cuatro históricos de 18ed permanecen intactos; este cierre solo admite spec/handoff propios y README por el generador.

Autorización documental leída íntegra y cotejada: `C:/tmp/director-traspaso-20261020/0574-revision-director-canonic-v2-y-go-documental.md`, SHA256 `fda71ca8b1bfe4fa34376b0006439156369b33fb3ae80f1c0cffafb7b5b20f6e`. Mantiene owner `worker-0574cierre-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, misma raíz/rama/claim, commit/push selectivos y actualización de PR #316 DRAFT. BCV tiene el turno pesado; aquí solo documentación y preparación externa de conocimiento. No hay otra canónica/focal/SQL/browser por cambios documentales.

### Preparación preservada y única receta ejecutada

El runner b0ed (`b0ed9f0d6f52d86d4d0a3e4df6a4855cff693a5b8d67fb34dcf4f4dcc9e01327`) falló en preflight **antes de iniciar el gestor o verify**. El diagnóstico autorizado del mismo `spawnSync git ls-files` confirmó status null/SIGTERM/ENOBUFS, 1064960 bytes stdout/0 stderr; el filtrado del store posterior a la captura llegaba tarde. No fue un ROJO de producto ni una segunda canónica.

V2 `40289a3ec17c3be0be88410bd318267145933eba02f2b7e7799654229f6f8b7b` añade únicamente la exclusión literal del store raíz al propio listado Git, sin aumentar maxBuffer/memoria o cambiar gates/topes. La fixture Git externa comprobó que `.pnpm-store/` raíz queda excluida y siguen visibles archivo ordinario, `.pnpm-store-otro/` y `subdir/.pnpm-store/`. Sintaxis y consulta real corregida pasaron; no se borró/movió el cache ni se alteró configuración compartida. El GO V2 fue `0574-go-canonica-v2-8394a560-director.md`, SHA256 `d3c4f937ba8d10516a6bead811b0a47dc5a262b4e928a79add3d694205f9f67a`.

Comando real: `corepack pnpm verify`; gestor observado **pnpm 12.14.0**, sin forzarlo a la versión 11.19.0 de instalación. Inicio 11:38:08.469Z; final 12:11:16.175Z; **1987.706 s**, exit 0/signal null/sin interrupción. El wrapper solo pasó AUTO_PIN=0/DOWNLOAD_PROMPT=0 en copias del entorno de hijos. El padre conservó sus variables; no hubo restauración/borrado de Env para esta receta. No se modificaron package/lock/config/runners, no hubo override de VERIFY/NODE_OPTIONS ni invocación directa de verify.mjs.

### Resultado por comprobación

| Paso | Estado y límite |
|---|---|
| Harness | **PASÓ 237/237**, cero fallos/skip/cancel/todo; 111875.4379 ms |
| Lint | **PASÓ con avisos**, cero errores/quince advertencias; no se ocultaron ni repararon fuera de alcance |
| RSC | **PASÓ**, 1713 módulos y sin cruces prohibidos |
| Tipos y cuatro Edge | **PASÓ** en receta nativa; no una ejecución focal renombrada |
| Unitarias, intento 1 | **FALLÓ**: 859 archivos aprobados/1 fallido/1 omitido; 12358 casos aprobados/1 fallido/1 omitido; 579.93 s |
| Unitarias, retry nativo 1/1 | **PASÓ con omisión**: 860 archivos aprobados/1 omitido; 12359 casos aprobados/1 omitido; 522.22 s |
| Docs / numeración | **PASÓ**: 558 specs/489 migraciones; avisos históricos conservados sin renumeración |
| Constantes / componentes / gobernanza | **PASÓ**: 6 banderas, 5 fuentes CMP-01, registro de 28 políticas. Este gate no certifica conformidad universal del producto |
| migrations-applied | **NO EJECUTADO / OMITIDO**, sin URL/servicekey productivas. Determina el **CIERRE INCOMPLETO 16/17**; no permite obtener secretos ni aplicar 0496 |
| Símbolos pendientes | **PASÓ con aviso**, 0 ROJO/1 AMARILLO declarado de 0496 |
| SQL local | **PASÓ 246 contratos**, postgres:17 efímero y rollback; no DB productiva |
| Reconstrucción local | **PASÓ 489 migraciones = 471 DDL + 18 solo-ledger**; aislamiento sobre 219 tablas/dos tenants ficticios |
| E2E | **PASÓ con omisiones**, 198 identidades únicas: 178 expected/20 skip/0 unexpected/0 flaky, 255793.348 ms; cero casos con múltiples intentos |
| Build | **PASÓ**; tsconfig restaurado por la receta; avisos de Supabase ausente conservados |

Fallo unitario conservado: `Test timed out in 20000ms.`, `app/p/[token]/supplier-flow.test.tsx:260:3`, caso `supplier guided workflow > supports correction and append-only resubmission without clearing the form`. La política del verificador inició su único retry nativo; el Worker no repitió la suite por fuera. Ambos intentos no se suman como cobertura única. La etiqueta «flaky conocido» del runner no demuestra causa; tampoco se declara que 0577 eliminó este timeout. La identidad de la única omisión unitaria no fue emitida en el resumen nativo disponible y no se infiere como hecho.

E2E usó 8 workers, servidor propio 3285 y Supabase sintético deny-only 13285, sin filas reales. El Director recorrió 198 identidades y 20 anotaciones de omisión: comentarios 3 por Preview/seed, carrusel 2 por anchos explícitos una vez, gastos 6 por fixture contable, búsqueda 6 por credenciales y nómina 3 por seed. No hubo aviso global de cierre forzado en esta corrida; no se hereda el de otras tareas.

### Observador, integridad y recursos

Observer aceptado `8aa556b053018198e414a2591b848a87b18043b0775437da66798c24bab48f7b`: fijó verify PID 5600, CreationTime/ascendencia propia y mtime; capturó el JSON original a las 12:09:38.339Z, 264002 bytes. rootDir fue metadata, no filtro. No hooks, reconstrucción, replay ni otra E2E. Su muestreo no garantiza observar cualquier archivo de vida breve ni hace atómica la consulta proceso+archivo; en esta ejecución sí conservó el original. Observer terminó exit 0.

Director cotejó antes/después/actuales **31 fuentes/247 originales/48 adicionales/13 composición**, más 20 artefactos y 12 referencias, por ruta/bytes/SHA256, cero diferencias. Los conjuntos se solapan. Incluyen producto/tests/runners/package/lock y documentación congelada de 8394; estos dos documentos pueden cambiar solo después de esa aceptación. Store preexistente conservado y desconocidos fuera del store 0. La documentación posterior no requiere repetir pruebas de producto.

Turno pesado **devuelto a las 12:14:35.074459Z**, tras EXIT y bytecheck. 181 identidades observadas/resueltas; cero procesos propios/consumidores por rutas/puertos/contenedores. Un PID reutilizado se distinguió por CreationTime; seis navegadores previos no se atribuyeron ni terminaron. Primer inventario de cierre `f7c60c7a…` preservado: comparaba UTC con literal DateTime local y produjo candidatos previos; el cotejo usa UtcTicks de ambos extremos. Las incidencias auxiliares de lectura se documentan sin alterar receta/evidencia. No hubo cierre manual de la canónica o E2E. Claim **retenido** para revisión/cierre final, sin readopción silenciosa.

Raíz de evidencia: `C:/tmp/director-traspaso-20261020/0574-cierre-validation/`. Los logs/JSON originales permanecen fuera de Git; las rutas siguientes son relativas a ella:

| Artefacto | SHA256 |
|---|---|
| `canonica-v2-cierre-8394a560.json` | `dac834dcbdfa2ca4207d7255424858c9115ff31d6820a72f814e809d16ece5e7` |
| `canonica-v2-cierre-8394a560.md` | `1f6e0ab905848cefe07af0edf27f6bdc6d18f0c30b0cca3cdaddbf0f549f22cc` |
| `canonica-v2-entrega-8394a560.json` | `914ef7109e7eac1ff2d4bda87c171a5f520de133828fc55a93178c42ab0012db` |
| `canonica-v2-git-readback-8394a560.json` | `125442ba242acdb6de0179d91886209ac48adf80ba6985815f19899b9fe4919d` |
| `canonica-8394a560-preparacion/ejecucion-8394a560-1792582687461/receipt.json` | `1078c8f73625aef826c525f9958475f8665283b6399c9b9199ce2f545dde0e26` |
| `canonica-8394a560-preparacion/ejecucion-8394a560-1792582687461/stdout.log` | `4f825c544f60f15a419b8d3af6fe6b643e58e871a0db307d14d4c0d3942d09af` |
| `canonica-8394a560-preparacion/ejecucion-8394a560-1792582687461/stderr.log` | `9c7f90e4e104346e5ad7e1e14c670238109902eace7d03b77800a8318f704740` |
| `canonica-8394a560-preparacion/ejecucion-8394a560-1792582687461/final-bytecheck-v2.json` | `66dc40f283486aec7a0d3350a4019818701feb830ce7cb61ddac6d988e947b02` |
| `canonica-8394a560-preparacion/ejecucion-8394a560-1792582687461/final-resources-v2-cotejo.json` | `9b90680319152ec94c5fa51b86cfe23445d7d40e4ae25bc5c16b92f992d9be6d` |
| `canonica-8394a560-observador-preparacion/captura-1792582713256/e2e-0574-original-5600.json` | `1e599a475ac83380f09a15fb17fe2062bef4f7c3542718607cde621c4faf1c41` |
| `canonica-8394a560-observador-preparacion/captura-1792582713256/e2e-0574-observer-final.json` | `4e16724587d08847fa1a436f355d3dc4d77a1413158376761146d2549745136f` |

### Checkpoint documental estable y pendientes propios

El commit que contiene este apartado es el checkpoint documental **D**; su SHA/padres/diff/igualdad remota y cuerpo final de la PR se guardan en el recibo externo, sin commit recursivo para autocitar ese hash. Solo spec/handoff propios y, si lo requiere el generador, README pueden diferir de 8394. Guard, generación/check documental, numbering y diff-check proporcionan validación proporcional; su evidencia se registra en ese recibo. Producto 639/tests, donante c4 y heredados 18ed no reciben cambios ni una aprobación nueva por documentación.

Después de D se prepara fuera de Git el plan del **único ciclo final de conocimiento**, todavía **NO EJECUTADO y SIN GO**. Se fijarán D, fuentes/runtime nativos, respaldos de derivados propios, guardas y estados por capa. El posible recorrido de `.pnpm-store/` por Graphify es evidencia de lectura, no causa demostrada de los 335.85 s del status interrumpido. CLI `--exclude` solo no garantiza el mismo corpus del inspector; cualquier propuesta de ignore local exige revisar interfaz soportada, inexistencia previa y fixture mínima que conserve fuentes ordinarias/otros directorios. No se crea ignore ni se ejecuta fixture/ciclo en este GO documental; no se borran/mueven cache, fuentes o configuración compartida, ni se parchea el runtime instalado.

Pendientes: revisión de D/plan por Director; turno y GO para conocimiento local, con estructura/semántica/Archify/preview separados; cierre aceptado y liberación explícita del claim. CI/GitHub no acreditado por checks vacíos; ledger de release 0496 requiere aprobación nominal futura de Sam y permanece sin aplicar. No main/merge/deploy/VPS/DBreal/PII/secretos/pagos/contactos ni publicación de bóveda compartida desde esta rama. Los seis encabezados largos por píxeles, SSR/DB sintética/CSS acotado, dispositivo y A11Y integral mantienen sus límites.

**FUERA DE ALCANCE DETECTADO:** permanecen la unidad futura 4.2 y la cobertura 0128 por prealerta. No se absorben Caracas/BCV/0573/0575 ni reparaciones generales de Portal/borrado; la omisión del ledger y el ciclo de conocimiento son pendientes propios, no hallazgos ajenos.
