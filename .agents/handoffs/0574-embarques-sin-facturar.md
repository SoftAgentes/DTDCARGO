# Handoff · SDD-0574 · Embarques sin facturar (4.5 del plan contable)

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
