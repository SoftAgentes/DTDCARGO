---
sdd: "0573"
title: "Anular una factura revierte su asiento de venta, en la misma transacción"
status: in-progress
author: "founder"
created: 2026-10-20
updated: 2026-10-21
supersedes: null
superseded_by: null
related: ["0566", "0567", "0560", "0569", "0570", "0571", "0572"]
confidencialidad: interno
---

# SDD-0573 — Anular una factura revierte su asiento de venta, en la misma transacción

## 1. Adopción vigente y alcance de GO0

**Estado al 2026-10-21: M1 implementada por fuente en checkpoint local, VERDE pendiente; CORE in-progress y PR #320 DRAFT.** La instalación normal/I03 y el baseline parcial tienen evidencia separada; este checkpoint no ejecuta pruebas. Los catorce hallazgos y aceptaciones A CORE y B propagación siguen sin cierre global.

- Task: 0573-core-reparacion-20261021. Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Sesión principal Director: 01a15a4e-ddf0-7d82-8656-d9dc56b58468; esta es su tarea Worker interna.
- Worktree propio: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0573-core-reparacion-20261021.
- Rama propia: codex/sdd-0573-core-reparacion-20261021.
- H de creación: 89f15a5dcb9c9047e9a289fd499563c201ab5701; árbol 5f332053bd73d06d5a5438a74a62064999b42493.
- B fija: e834dc6eef597421d10f880b5deb8d689dcc7078; árbol b08e66460107950909d783f1c2256d6e2f098d62; rama codex/0573-base-temprana-20261021.
- Encargo ejecutable GO0: C:/tmp/director-traspaso-20261020/0573-core-go0-asignacion-director.md; SHA256 7a16dbdb1ebecfc420ca2f3c181ca6aa1cb5d6c5584f0c33fb2a7237af773428.
- Contrato completo: 0573-encargo-core-propuesto.md; SHA256 5ee11eab1d2f08af8890f676efdc20aa2daba918dd8d1c50c34950b366b22880; diez fuentes completas leídas y cotejadas.
- Prevuelo 0573-preflight-bases-temporales-peer.md leído completo.
- Composición B: 0573-base-composicion-director-20261021.md; SHA256 77ba229cb18b02a43f3f5c0a27df41ae0a9a04ed15516bb1dbff4110ddb9bd82.
- Recibo B: 0573-base-temprana-B-director.json; SHA256 9a2a9d2e382b94864b28c7626ce5ac544be385e80901854bb3d74905785b8e6c.

Rigen AGENTS canónico vigente, skill Worker, runbook y project-rules, leídos completos. Se leyeron AGENT-BRIEF, registro aplicable, SGE-00/AUD-01/AUD-02 y backend Norte. No se copian ni sustituyen instrucciones en H. BRAND/diseño/Norte y otras políticas UI se leerán antes de UI, fuera de GO0.

GO0 autoriza aislamiento nuevo desde H, guard/claim propios, adopción, merge normal sólo B y resolución de tres metadatos. La autoría actual se limita a spec/handoff/índice generado/baseline/declaraciones. Si Git exige edición manual de producto, conservar conflicto y devolver decisión antes de resolver. Un merge automático no es reparación ni aceptación funcional.

Sam autoriza commits selectivos y push propio. GO0 no crea PR: primero revisión R0/delta; futura única PR CORE DRAFT contra codex/0573-base-temprana-20261021. Prohibidos main/merge de PR/deploy/VPS/DB real/PII/secretos/env o deps copiados/cuentas/pagos/contactos/memoria/borrados/flags/Obsidian compartido.

Diagnóstico0577 conserva turno pesado. Instalación, parser de producto, tipos/lint, pruebas/SQL/DB/Docker/HTTP/browser/build/verify/conocimiento: NO EJECUTADOS en GO0. Node absoluto sólo para harness, hashes y generador/comprobación documental/numeración sin instalar.

Correcciones documentales M5/M8: canVoid opera por estado; UI/servidor verifican sus controles efectivos. ON DELETE RESTRICT protege al original referenciado, no hace inmutable el reverso. No agregar bloqueo UI general por paid_amount que impida revertir crédito antes de anular. MIGRATE-FIRST es contrato de release, exige PR/paquete revisados y OK nominal separado; no aplicar producción para aprobar PR. 0495 aplicada una vez según autoridad vigente del Director, no repetirla; 0496/0497 pendientes según metadata/encargo, sin lectura nueva de ledger real.

## 2. Fuentes completas y precedencia

Se leyeron íntegros y se cotejaron bytes SHA256 de los diez documentos siguientes, todos bajo `C:/tmp/director-traspaso-20261020/`. No se modificó ninguno.

| Documento | SHA256 verificado |
|---|---|
| `0573-encargo-reparacion-codex.md` | `2b8e62ff71098e812d9e29804530884f152c4ffee2e179c667e1199372f8e2ef` |
| `0573-decision-director-codex.md` | `280de69537a315f98abd6a4082af8e0a79f236403b1e7b1617141969bba1d8fe` |
| `0573-matriz-composicion-caracas-preparacion.md` | `85891eb80b0df358c4800a152683941512b982d1a2ec6e6d99a99707560282a2` |
| `0573-addendum-composicion-director.md` | `ea732c9b216cc401c1a2858d9aa2d2e899095cf1e77acec1394eaafb57a495b3` |
| `0573-addendum-composicion-revision.md` | `28c1fc10c58b0c3088aacc8e2c7566d4d6abb09c8ba0dcfd1e8bd751cd75a8d7` |
| `0573-i3-contrato-rpc-preparacion.md` | `9a6bb74d7855c8fe7c8ef2c342f458bbcd79ab80af31e1c3a6921bf5c8ab98fa` |
| `0573-i3-decision-director-preparacion.md` | `27a4dc04380ad04ed82833bccad705304769f2c1cb5faa57131d6b8592963403` |
| `0573-i3-decision-revision-preparacion.md` | `633756e8c62890cf92447ee7c37ed8d42793b5d3bff53a1266c5fc8eff4cef65` |
| `0573-secuencia-local-y-bases-pr-preparacion.md` | `0352a8cbde652548db61aa3e61fe867c2c5a1aebf5c356c7472bac7fd421dc2a` |
| `0573-decision-director-bases-sin-ciclo-preparacion.md` | `50d3f25e13eb6b687d441566e2e04d3200d84a145409ef76807441a1d6be20c5` |

Precedencia aplicable: el encargo original describe hallazgos; `280de695…` ratifica I2/M2 y descarta integrar 0572 antes de 0573; `ea732c9b…` acepta R1–R4 y amplía 42→49; `27a4dc04…` ratifica autoridad, estados, dinero, resultado y tres intentos totales de I3; `50d3f25e…` sustituye únicamente la exigencia de una sola cabeza descendiente de BCV y sitúa R1 en C1. Las revisiones son cotejos, no autorizaciones adicionales. Los pasajes anteriores «I2 pendiente», «negativos/tolerancia pendientes», «tres intentos por ratificar» o «base única posterior a BCV» no rigen sobre estas decisiones posteriores.

También se consultaron por objetos los antecedentes normativos y técnicos de main. AGENTS y la metodología Worker/Director continúan obligatorios al adoptar; esta preparación no sustituye su lectura sobre la base real. La skill governance-check se utilizó como guía de lectura, sin ejecutar su validador por la restricción expresa de este encargo. El registro derivado del plugin no sustituye el registro normativo del repositorio. No se ejecutó Graphify ni se certificó actualidad del grafo.

## 3. Estado Git y preservación antes de implementación

Árbol propio creado realmente por harness desde H; guard/claim/guard(owner) PASÓ. Histórico sdd-0573-reverso-al-anular conserva H/rama, status limpio y claim ajeno contabilidad-2026-10-18 (SHA256 23f8b82db6f695f668f4a4a54dac363b7992efd1065a45ca9ab3ca046deedb3c), sin takeover/liberación/movimiento. Limpieza no demuestra inactividad de consumidores.

Preimágenes previas a autoría: C:/tmp/director-traspaso-20261020/0573-core-go0-worker-20261021/0573-core-preimages-go0.json; SHA256 f83e940408331b6763b8268515dbf434afe43ba02acae1db4f37e8d490f4652b. Se guardaron 76 blobs y las48rutas de M/P304/P306/P307/H/B: H43 presentes, demás36. Cinco pruebas nuevas siguen ausentes. Allow48 literal LF con salto final SHA256 0a95bea2a8de4323b3ccbccb34499482d7dd5597736d055c735c4e275871b07c.

Predecesores positivos: M d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8; P304 8fb4edee602a933de852165aedaf643ad7548b4b; P306 2f9b336cd3a10b244f30be58f7e6466a2dd2b08c; P307 ba43747a803ea9aec3b8750d1b461d69795834a5. Cabezas310/311/C1/C2/C3/BCV no son padres permitidos.

**R0 real: bd2eeb29af909bc0d62b902ab4973386ee0e2d98; árbol c34aeddce41eb51a9608c0feb16b67ffa2c7cdd5.** Padres exactos H 89f15a5dcb9c9047e9a289fd499563c201ab5701 y B e834dc6eef597421d10f880b5deb8d689dcc7078. La adopción se guardó primero sin staging y quedó fuera del merge; no hubo commit documental previo. Los documentos actuales viajan en el commit posterior que los contiene.

9 ascendencias positivas (H, cuatro predecesores y otros cuatro commits históricos) y6negativas310/311/C1/C2/C3/BCV verificadas; sólo R0 es nuevo fuera de H/B.6344 entradas;29 rutas contra B, todas dentro de48; ningún path de padre perdido. Cinco pruebas nuevas siguen ausentes.

La composición no requirió edición manual de producto. Sólo cuatro blobs son distintos de ambos padres: actions automático y tres metadatos. Actions deb9fe678829412985ffa24b775c8dab74e07caa conserva prefijo/sufijo B exactamente y voidInvoice H exactamente; FX/CAS/override/precisión/VES/aviso persistido no se sustituyen. Es cotejo de procedencia, no aceptación de lógica.

Baseline unión exacta con cutoff238 y esperas0422/0423/0495/0496/0497; declaraciones unión exacta de0569/0571/0573. Ninguna espera/declaración retirada ni contrato heredado editado. El texto histórico pendiente0495 no acredita ledger ni permiso de repetirla.

Recibo R0 completo: C:/tmp/director-traspaso-20261020/0573-core-go0-worker-20261021/0573-core-R0-go0.json; SHA256 c594fef0439035f122e778a40e4d9bf47bfdb1763652d7e2308fc356ab2b28da. Deltas completos: R0-completo-vs-B.patch (SHA256 f228ad2bbfd9db86c5a77cc928d8afe01d6f5a25c5e631aad9a1b2294f392c54); R0-producto-vs-B.patch (24rutas,155874bytes,SHA256 6a51e26cd9b2d8483731da0ddb30986a8ace531cba4ef7fc1fee4dabdfc35089); y acciones contra H/B. Todos en la carpeta de evidencia. docs:check559specs, numbering y diff-check PASÓ. No se ejecutó ninguna aceptación funcional.

## 4. Contrato de reparación: los catorce hallazgos

Las líneas H se refieren al objeto histórico completo de §3; las líneas M, a main del mismo corte. Se conserva la identificación original, sin convertir esta inspección en reproducción ni cierre. I4 es requisito de evidencia; los otros trece tienen soporte de fuente ya documentado. Todos continúan pendientes de reparación/validación.

| ID | Evidencia concreta | Resultado exigido y oráculo futuro, NO EJECUTADO |
|---|---|---|
| **B1** | H `contabilidad/actions.ts`, `voidEntry` alrededor de 338; `LibroDiarioTab.tsx` alrededor de 359; 0497:97–104 sólo agrega vínculo/CHECK/índice. | Blindar original y reverso frente a anulación, borrado, cambio de tenant/factura/source/vínculo y alteración financiera de cabecera/líneas por RPC manual o escritura directa. La FK protege el original referenciado, no hace inmutable el reverso. No hay excepción de superclave para desarmar el par. Mantener asientos manuales ajenos. Lectura del vínculo íntegra aunque el otro extremo esté fuera de 500 filas, filtro o período; error/parcial no significa ausencia. UI explica el bloqueo y DB lo hace cumplir. |
| **I1** | H0497:166–168 cuenta recibos sin tenant; 181–198 inspecciona parcialmente ventas/líneas; 224 captura toda unicidad. | Validar el conjunto relevante del mismo tenant/factura y cuentas, source/estado/backlink/líneas/balance. Una relación cruzada es corrupción/rechazo, no se filtra hasta aparentar ausencia. No exponer datos ajenos. Sólo colisión de la constraint de código verificada admite reintento; unicidad de reverso, FK, CHECK u otra constraint no. |
| **I2** | Encargo:59–73; decisión `280de695…`; `ingreso-periodo.ts`, libro-control, consumidores de R2–R4. | Conservar facturado oficial y agregar ajuste documental y base de comparación explícitos. Documento 100 frente a venta 90 conserva diferencia 10; par válido septiembre/octubre explica +100/−100; neto cero con corrupción/actividad no se oculta. Metadata de todos los movimientos, incluso fuera de issued_at. VES/CNY nominal→no_comparable/diferencia null; falta de conversión visible. Contrato detallado en §5. |
| **I3** | M/H `invoice-posting.ts`:62–82,112–176: contador amplio, input monetario, código/cabecera/líneas en llamadas separadas; eliminación compensatoria no comprobada. | Posting atómico de código+cabecera+líneas y lock compartido de factura; sólo datos persistidos; resultado versionado validado; estados y dinero ratificados; idempotencia íntegra, desconocido honesto, presupuesto de tres intentos sólo para código. Conservar contrato de los callers y emisión previa separada. §6. |
| **I4** | H spec/handoff y encargo:158–169; no hay reparación ejecutada en esta preparación. | ROJO funcional sobre base compuesta congelada, VERDE y carreras SQL reales, mutantes pertinentes/restauración, tipos/lint/verify normal, visual y revisión independiente del SHA. Histórico, mock, JSDOM, PGlite, exit 0 con SKIPs y prueba en otra base no suplen lo faltante. |
| **M1** | H `facturacion/actions.ts`, alrededor de 696: conteo de recibos previo al crédito sin rechazo de error/count null. | Error o count null detiene antes de revertir crédito o llamar void. Filtro de tenant correcto. Cero conocido permite continuar; positivo bloquea. Preservar aviso recuperable cuando el crédito se revirtió pero la anulación posterior falló. No afirmar transacción única crédito+factura. |
| **M2** | H0497:181–195 sólo busca ventas asentadas. Decisión ratificada `280de695…`. | Cualquier venta borrador viva bloquea bajo el mismo lock antes de efectos, también si coexiste con una asentada. No borrarla/completarla/anularla silenciosamente. Factura borrador sin venta conserva flujo permitido; una única venta íntegra asentada puede revertirse; duplicada, incompleta o corrupta no. |
| **M3** | H0497:204–210 omite fecha original en greatest. | Capturar hoy Caracas una vez; reverso fechado en `greatest(hoy Caracas, closing_date+1, fecha del original)`, tratando cierre null conforme al contrato. Nunca anterior al original ni dentro del cierre. Probar original/cierre futuros y cambio de día con reloj determinista. No alterar la fecha original ni trasladar esta regla al posting ordinario. |
| **M4** | H0497:189 propaga GUC;207–210 copia motivo al memo;233–236 copia notas libres de líneas. | Motivo humano sólo en D2 `invoice_voided`; memo y líneas con referencias fijas a factura/asiento/fecha, sin motivo ni notas libres heredadas. Revisar alcance/restauración del GUC para no contaminar `journal_posted` u otro evento. Fallo del evento obligatorio revierte la mutación; rollback no deja éxito. |
| **M5** | H spec:120/137 y encargo:36: explicación inversa de FK y atribución a canVoid de paid_amount. | Corregir documentación: canVoid opera por estado; UI/servidor verifican sus controles efectivos. ON DELETE RESTRICT protege el original referenciado; B1 cubre el resto. No agregar un bloqueo UI indiscriminado por paid_amount que impida revertir créditos antes de anular. |
| **M6** | H `libro-control-queries.ts`:52/85 según precisión original. | Colocar el JSDoc «Lee completo…» junto a `leerCompleto`; revisión de diff/lint, sin test que copie un comentario. |
| **M7** | H `radiografia-integridad.sql`:77–79. | Sólo un par válido suprime B1. Diagnosticar factura aún vigente con reverso, original indebidamente anulado con reverso y vínculo de otro tenant/factura. Fixture/paridad sintéticas, ninguna radiografía de negocio ni arreglo de filas históricas. |
| **M8** | H spec y 0497:5–9; encargo:39/169. | MIGRATE-FIRST real: nueva SQL + app anterior mantiene las guardas aunque pueda degradar posting legado; app nueva sin símbolos falla cerrada sin fallback inseguro. Paquete exacto/huellas/pre-postflight/símbolos/espera/rollback. No aplicar producción para aprobar PR ni usar el comentario histórico «antes de fusionar» como permiso. |
| **M9** | H0497:255–269 sólo revisa parte de contrato y nombres. | Verificar owner postgres, firma/argumentos/retorno, definer, search_path, ACL efectiva, expresión normalizada exacta del CHECK, propiedades efectivas del índice y funciones/triggers nuevos. Owner cambiado o CHECK laxo con mismo nombre falla; no aceptar sólo presencia nominal. |

## 5. I2 ratificado: cifras, lectura, consumidores y límites

### 5.1 Cálculo y autoridad

El facturado oficial conserva estado, `issued_at`, propio/terceros/total, base sin IVA y contrato de conversión **de su base**. Para una factura anulada con par íntegro, el ajuste suma su base documental cuando la emisión cae en el rango y la resta cuando la fecha del reverso cae en él. La comparación usa **oficial + ajuste**, frente a las ventas del mayor; no sustituye el oficial ni copia el mayor para forzar igualdad. El resto del mayor y «otros ingresos» no se reclasifica para esconder el desfase.

Un par válido exige mismo tenant y factura, original `invoice`, reverso `invoice_reversal`, vínculo correcto, original/reverso vivos/asentados y relaciones/líneas financieras coherentes. Una venta por 90 respecto de base documental 100 no debe producir un ajuste de 90 ni desaparecer la diferencia mediante un filtro de elegibilidad; el control conserva la inconsistencia y su evidencia. Corrupción relacional, falta de líneas, truncamiento o error de lectura impiden certificar «Cuadra», incluso si los saldos resultan cero.

Los lectores deben recoger metadata de todas las facturas que originan movimientos del rango; filtrar únicamente por emisión pierde el reverso de una factura emitida antes. La búsqueda adicional conserva tenant y guard actuales. El CORE no importa/copiará la implementación 0572-a de #310. Las versiones posteriores conservarán su conversor, estados de completitud y contadores propios al recibir este ajuste; la versión temprana no las sobrescribe.

Mientras el mayor sea nominal VES/CNY, cualquier movimiento de venta relevante en esas monedas vuelve el control `no_comparable`, `diferenciaUsd = null`; no se llama USD a ese nominal. La conversión ausente permanece incompletitud visible y no cero. No se implementa el conversor general de 2.1 ni la conversión del libro de 2.3 dentro de I2. Los DTO exactos se fijan en el CORE según sus tipos actuales y se adaptan hacia adelante; no se exige inventar en main una API posterior que no existe.

### 5.2 Oráculos mínimos y propagación de salida

| Escenario sintético | Resultado exigido |
|---|---|
| USD100 emitida en septiembre, reverso en octubre; consultar después de anular | Septiembre: oficial0/ajuste+100/base100/mayor100. Octubre: oficial0/ajuste−100/base−100/mayor−100. Ambos: ajuste0/mayor0, con actividad válida visible y explicación del puente. |
| Documento100, venta90 y reverso correspondiente | Ajuste documental100, no90; diferencia de10 en el rango pertinente y/o incidencia explícita, nunca falso Cuadra. |
| Mismo neto0 con vínculo cruzado, líneas incompletas o estado inválido | Incidencia visible; no vacío ni éxito numérico. |
| Reverso de factura emitida fuera del rango | Metadata, moneda y par completos; no exclusión por issued_at. |
| Venta/reverso VES o CNY nominal | Estado no comparable; diferencia null; etiquetas no convierten nominal en USD. |
| Tasa ausente, lectura truncada o error | Conservar causa/estado; no cero conocido, Cuadra ni totales completos. |
| Rango realmente vacío y lecturas completas | Vacío legítimo, sin fabricar actividad por una suma ni alerta. |
| Cero conocido con movimiento íntegro | Cero válido con identidad de actividad; no usar truthiness para ocultarlo. |

`IngresoDelPeriodoCard`, texto del control, tipos/visibilidad de reportes, CSV y la proyección de Dirección deben distinguir oficial, ajuste y base de comparación. Preservar formato monetario/centavos, null distinto de0, monedas, contador/estado cuando exista en esa base y otras exportaciones. CSV no debe perder el ajuste ni reemplazar unknown por0. Dirección cambia sólo esta proyección, no margen, utilidad u otros KPIs. Las pruebas deben llegar a esos consumidores reales, no sólo al cálculo puro.

## 6. I3 ratificado: frontera propuesta de posting

### 6.1 Firma y autoridad

Firma de catálogo propuesta aceptada para desarrollar: `public.post_invoice_journal_entry_atomic(p_tenant_id uuid, p_invoice_id uuid) RETURNS jsonb`. **No existe en los cinco objetos inventariados.** Owner `postgres`, `SECURITY DEFINER`, `search_path` vacío; revocar `EXECUTE` a PUBLIC/anon/authenticated y conceder sólo a service_role. Verificar privilegios efectivos, incluidas concesiones heredadas, y no confiar en una línea GRANT aislada.

Los UUID identifican, no autorizan por sí solos. El servidor mantiene tenant resuelto y guardas de sus flujos antes de usar cliente administrativo. No aceptar del cliente dinero, fecha, cuentas, actor, force, motivo ni excepción de cierre. La RPC bloquea la factura del tenant autorizado y lee identidad, tenant, status/deleted_at, código, moneda, base, IVA, total e issued_at persistidos. Cuenta/relación de otro tenant provoca rechazo sin filtrar datos sensibles.

Conservar los permisos existentes: factura manual y anulación con sus gates financieros; automatismo de CN con su permiso/tenant vigente, sin imponer accounting al operador ni ampliar sus roles. La RPC no concede emisión ni anulación. `service_role` no es excepción de cierre. No se cambian los emisores, `sales-orders/actions.ts`, CN ni Portal para acomodar esta propuesta.

### 6.2 Estado, fecha y dinero

Aceptar documento vivo `emitida`, `parcial`, `vencida` o `pagada`; rechazar borrador/anulada/borrado. La factura pagada puede necesitar venta si un cobro ganó el lock después de emitir: probarlo no autoriza un nuevo cobro ni anular pagada.

La fecha del posting proviene de `issued_at` civil persistido, válido, sin fallback a hoy, created_at o input. En la base temprana la RPC debe ser autosuficiente para validar esa fecha y la semántica Caracas que le corresponde; no importar helper IANA/SQL de C1 inexistente. No re-fechar el documento ni convertir indiscriminadamente una fecha civil a otro día. Un nuevo posting ordinario de período cerrado bloquea. Reconocer una venta válida ya asentada es lectura y no debe alterarla porque el período cerró después. `posted_at` sigue siendo un instante.

El asiento conserva el nominal y cuentas actuales: debe1.1.2 por total; haber4.5 por base; haber2.1.5 por IVA positivo. Catálogo dentro del tenant; no nuevo conversor ni recalcular la factura desde sus líneas. La exigencia de cuentas y su estado debe quedar explícita con el catálogo real; no ampliar reglas de negocio por suposición.

Decisión monetaria de `27a4dc04…`: valores persistidos finitos, no negativos, escala decimal real y balance SQL numeric exacto `total = base + IVA`. Cero coherente conserva no-op `zero-total`; negativo, inválido, cero incoherente o diferencia de un centavo rechazan el nuevo posting. No insertar línea de ajuste ni corregir documento. Esto endurece conscientemente M/H helper:73–83, que agrupaba negativos con cero y toleraba un centavo con float. La tolerancia TS↔SQL del prorrateo0128 es otro contrato y permanece intacta. Si la base final revela un productor negativo legítimo o una tolerancia contractual incompatible, documentar evidencia antes de ampliar; no buscar filas reales ni volver a tratar la decisión ratificada como pendiente genérica.

### 6.3 Unidad, idempotencia, locks y convivencia

La factura se bloquea antes de decidir; el conjunto relevante de ventas/reversos debe permanecer coherente hasta commit. Sólo una venta original única, viva, asentada, íntegra del tenant/factura y con líneas/cuentas coherentes habilita reconocimiento. `referral_credit` no demuestra existencia de la venta. Borrador, cabecera vacía, duplicidad, relación cruzada o par corrupto no son éxito. Antecedentes anulados/borrados o un reverso incompatible requieren revisión; no resurrección ni limpieza automática.

Código, cabecera y todas las líneas nacen en una unidad transaccional; fallo de línea/cuenta/cierre/auditoría revierte toda la nueva unidad. Generar código con el mecanismo vigente no convierte max+1 en una reserva durable; conservar formato y año, y probar colisiones. No dejar cabecera asentada sin líneas ni compensar después con un DELETE best-effort.

Máximo **tres intentos totales**, sólo por la constraint real de unicidad `(tenant_id, entry_code)` comprobada en catálogo, incluyendo tabla/columnas/tipo. Cada subintento revierte su unidad y conserva el lock externo de factura. No capturar todo23505; unicidad del reverso, FK, CHECK, permiso y deadlock no son código ocupado. El nombre generado por PostgreSQL no se declara medido en producción.

Orden de referencia: factura y después asientos/líneas/cuentas pertinentes con orden estable. Verificar los caminos reales: un UPDATE directo o RPC manual puede tomar primero el asiento. Hay que probar dos conexiones, espera y rollback completo de la víctima si hay interbloqueo; un diagrama no demuestra ausencia de deadlocks. No agregar GUC secreto ni bypass de B1.

La guarda no puede exigir un estado transitorio imposible: el histórico inserta el reverso antes de actualizar factura. El diseño debe ordenar o diferir la comprobación de forma segura y no dejar confirmado un par incompatible. Las mismas guardas deben impedir posting antiguo tardío después de una anulación. En MIGRATE-FIRST, header antiguo incompleto bloquea void; líneas tardías y transiciones directas revalidan estado/tenant/relaciones bajo lock. Si falla el posting anterior durante la ventana, se declara degradación y recuperación, no compatibilidad total.

### 6.4 Resultado y desconocido

Propuesta de objeto escalar versionado: `version:1`, `outcome: posted | already_posted | not_posted`, `reason`, `invoice_id`, `entry_id`, `entry_code`, `entry_date`. Nunca array/null. Éxito exige identidades y campos de asiento válidos; not_posted lleva campos de asiento nulos y motivo finito. Motivos propuestos: `invoice_unavailable`, `invoice_not_postable`, `invalid_issue_date`, `zero_total`, `invalid_amounts`, `totals_mismatch`, `missing_accounts`, `period_closed`, `existing_sale_requires_review`. Son contrato candidato de nombres, no símbolos ya implementados. No retornar PII ni SQL crudo.

`not_posted` dice que esta operación no confirmó una nueva venta ni reconoció una válida; no afirma que no exista cabecera/antecedente. HTTP200 no basta. El adapter valida versión/outcome/identidad/campos. Timeout, pérdida de conexión, forma ilegible o identidad inválida y duda de commit exterior significan **posting-state-unknown**; no es un cuarto éxito SQL. No puede prometer persistencia si una transacción exterior se revierte después.

Conservar `InvoicePostingInput` y `InvoicePostingResult` para callers existentes. Sólo tenant/factura viajan a la RPC; invoiceCode/importes/entryDate antiguos permanecen por compatibilidad de tipo, sin autoridad. posted→oktrue/código; already_posted→oktrue/skipped entry-already-exists; cero coherente→oktrue/skipped zero-total, explícitamente sin asiento; rechazos→okfalse con motivo estable; desconocido→okfalse sin afirmar ausencia. No fallback a INSERTs si falta la RPC.

Un reintento autorizado posterior opera sobre la misma factura persistida, nunca repite emisión0128, emisión manual, cobro ni crédito. Reconoce el estado actual y no reconstruye causalidad del intento ambiguo. No bucle automático general. El prefijo heredado de algunos logs «no creado» es una deuda acotada de observabilidad ya reconocida, no prueba de ausencia ni permiso para expandir sales-orders/0575.

## 7. Allowlist acumulada CORE exacta

48 rutas únicas, sin R1. En GO0 sólo autoría propia de spec/handoff/índice generado y dos metadatos; el resto es fuente y alcance FUTURO, no permiso de implementar.

```text
supabase/migrations/0497_reverso_al_anular_factura.sql
supabase/tests/0497_reverso_al_anular_factura.test.sql
lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts
supabase/tests/0467_reversion_credito_carrera.test.sql
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
app/studio/(app)/facturacion/actions.ts
app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts
app/studio/(app)/facturacion/[code]/page.tsx
app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx
app/studio/(app)/facturacion/_components/InvoiceDetailClient.anular.test.tsx
lib/studio/journal-types.ts
app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx
lib/studio/accounting/libro-control.ts
lib/studio/accounting/libro-control-queries.ts
lib/studio/accounting/__tests__/libro-control-queries.test.ts
lib/studio/accounting/__tests__/libro-control-reverso.test.ts
lib/studio/borrado/asistente.ts
lib/studio/borrado/__tests__/asistente.test.ts
lib/studio/borrado/__tests__/asistente-servidor.test.ts
app/studio/(app)/embarques/__tests__/asistente-borrado-action.test.ts
app/studio/(app)/embarques/_components/__tests__/AsistenteBorrado.test.tsx
scripts/qa/radiografia-integridad.sql
scripts/qa/radiografia-integridad.fixture.sql
scripts/__tests__/radiografia-integridad.test.ts
scripts/__tests__/subdiario-radiografia-paridad.test.ts
docs/specs/0573-reverso-al-anular/spec.md
docs/specs/README.md
.agents/handoffs/0573-reverso-al-anular.md
app/studio/(app)/contabilidad/actions.ts
lib/studio/journal-queries.ts
app/studio/(app)/contabilidad/__tests__/reverso-factura-acciones.test.ts
app/studio/(app)/contabilidad/__tests__/libro-diario-reverso.test.tsx
lib/studio/__tests__/journal-queries-reverso.test.ts
lib/studio/accounting/invoice-posting.ts
lib/studio/accounting/__tests__/invoice-posting-reverso.test.ts
supabase/tests/0497_reverso_al_anular_factura_carrera.test.sql
lib/studio/accounting/ingreso-periodo.ts
lib/studio/accounting/__tests__/ingreso-periodo.test.ts
lib/studio/accounting/__tests__/ingreso-fixture.ts
app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard.tsx
app/studio/(app)/contabilidad/__tests__/reportes-tab.test.tsx
lib/studio/reports/export-csv.ts
lib/studio/reports/__tests__/export-csv.test.ts
lib/studio/direccion/queries.ts
lib/studio/direccion/__tests__/queries.test.ts
lib/studio/reports/types.ts
lib/studio/reports/__tests__/types.test.ts
```

R1 lib/studio/accounting/__tests__/fechas-caracas-posting.test.ts pertenece exclusivamente a C1 posterior; no crearla/copiarla ni importar helper IANA/SQL futuro. scripts/__tests__/invoice-read-boundary.test.mjs sigue excluida: sólo presentar ampliación ante lectura nueva detectable con caller/tenant/guard/conteo exactos; no modificar analizador/raíces/excepciones. Sales-orders/CN/Portal/invoice-types/SQL0498/0499/0500 son referencias/regresiones de lectura.

## 8. Objetos de anclaje y contratos que no deben perderse

| Fuente inmutable | Blob Git | Evidencia aplicable |
|---|---|---|
| H `supabase/migrations/0497_reverso_al_anular_factura.sql` | `cd795051ac6380204c3af90ccd5f2f9194e2511b` | Líneas113–246 firma/flujo;97–104 vínculo;154–160 lock;166–236 recibos/asiento/reverso;255–269 postflight incompleto. |
| H `supabase/tests/0497_reverso_al_anular_factura.test.sql` | `42b4cafb896b1b1ece077a68dabbe99de9883792` | Evidencia histórica, no test ejecutado ahora ni contrato ya reparado. |
| H `docs/specs/0573-reverso-al-anular/spec.md` | `77743f26c000f1e902627d87ec3d468711e6c10d` | Decisiones/evidencia antigua; deben corregirse M5/M8 y clasificación AUD. |
| H `.agents/handoffs/0573-reverso-al-anular.md` | `6e7711a1b421a9281de7ffab482421741a3caf99` | Historia de tarea, no permiso vigente de aplicar ni cierre nuevo. |
| M `app/studio/(app)/facturacion/actions.ts` | `fa0eb5c41350bf8bb1b3eb443dff772635c8f30a` | 633–677 conserva VES del día, override/precisión y CAS;684–706 posting separado y tasa persistida del aviso;780–862 void/aviso vigentes. |
| H misma ruta | `ce0ef717b2e00c911b6f8bddff7e53784fef6ef0` | No sobreescribir el archivo M al adoptar H; sus bloques difieren. |
| M/H `lib/studio/accounting/invoice-posting.ts` | `abf4a7a7576d109a9052396204fbb520a50ac6ba` | 28–46 tipos;62–83 idempotencia/dinero;112–176 escrituras separadas. Mismo blob en los cinco checkpoints. |
| M/H `lib/studio/accounting/ingreso-periodo.ts` | `dc4a6d80f8760dcfc0297023668aa78863b054d4` | 261–330 cálculo y diferencia;374–447 estados. Mismo blob en los cinco; no es versión310. |
| M/H `app/studio/(app)/contabilidad/actions.ts` | `13e66b65cc8627b5f101216da6d0e4dca1187ebd` | Acción manual del par, mismo blob en los cinco. |
| M/H `lib/studio/journal-queries.ts` | `8b78f54f68e814417338e14a10d308a0baeac34e` | Lectura de diario, mismo blob en los cinco. |
| M `supabase/migrations/0493_cierre_contable_superclave.sql` | `dc34fb9779434c05e670e044d0cdd7aa0138c63a` | 494–556 guardas reales OLD/NEW/cierre y prohibición de mover línea;473–478 vincula excepción a nonce/txid. |
| M `supabase/migrations/0078_contabilidad.sql` | `792ffc167934d80e9f7cdfcae6d2546630c3423d` | 44–57 cabecera/unique;71–83 líneas numeric14,2/XOR;91 en adelante generador. CHECK XOR no demuestra no-negatividad ni balance. |
| M `docs/governance/AGENT-BRIEF.md` | `c31cd25d6817cee920c876b2fd3ffb5ea1bb39b6` | Secuencia/allowlist/clasificación y frontera normativa. |
| M `docs/governance/README.md` | `f98814bd5b7a6bc7bbd99db05f8243d717ab070d` | 241–273 políticas aprobadas;275–288 precedencia;214–239 diferencia diseño/conformidad. |
| M `docs/governance/policies/sge-00.md` | `31e98628be06149c1d9eb745b22624796f66424f` | Doce principios y evidencia por principio, no aprobación general. |
| M `docs/governance/policies/aud-01.md` | `ea437d2eb0714e59629163e836a79f34491b1e4e` | Mutación/evento obligatorio atómicos, fallo de auditoría y minimización. |
| M `docs/governance/policies/aud-02.md` | `9e0ffeba6b73cee93752bacbcd48fe99e2bafb55` | Motivo/payload sensible, permisos, append-only; no propagación libre a memo. |

El operador futuro debe registrar blobs de **toda** la allowlist de su base real, no sólo estos anclajes, y distinguir heredados/propios. Los SHA de fuentes posteriores C1/C2 de las notas históricas son evidencia de diseño de aquella fecha; no fijan por sí mismos la cabeza final de propagación.

## 9. SQL, cierre real y paquete de release

Reusar0497 pendiente, sin nueva numeración. La dependencia física observada de0497 no incluye0498/0499/0500 ni redefine sus mismas funciones; esto no prueba compatibilidad de locks, auditoría o runtime. CORE debe poder reconstruirse sobre sus predecesores sin esos cuerpos futuros.

Cargar y probar el cierre **0493 real**, no un stub0133. Sus triggers verifican OLD/NEW y líneas; su excepción gobernada para casos existentes no permite desarmar un par ni da permiso al posting ordinario para re-fechar. Probar tanto rechazo de nuevo posting cerrado como reverso en la fecha abierta aceptada, y bloqueo B1 aun al intentar el camino de excepción.

El paquete0497 futuro incluye fuente exacta, checksum, preflight/postflight, owner/ACL/definiciones, baseline de espera, símbolos y plan de rollback revisado. Preflight verifica los cuerpos/firmas/privilegios esperados de la base y aborta ante deriva; no reescribe silenciosamente un antecedente distinto. Postflight demuestra contenido efectivo, no nombres. El rollback de pruebas acredita ausencia de efectos parciales. El rollback operativo del paquete es una propuesta separada: no borrar un par, quitar guardas a datos usados ni ejecutar DROP automático; exige revisar el estado real autorizado y preservar historia. No se promete que rollback de código restaure por sí solo el estado previo del negocio.

Dos momentos de prueba SQL, con recibos independientes:

- **CORE:** reconstrucción sintética de sus predecesores hasta0496 y0497 reparada, contratos/cierre/ACL/audit/carreras y ventana helper anterior→SQL nueva. App nueva sin símbolo responde de forma controlada, sin escritura insegura. No se incorporan SQL posteriores para aparentar autosuficiencia.
- **Propagación posterior:** reconstrucción ordenada0496→0497→0498→0499→0500 y la composición que recibe0497 pendiente en presencia de las posteriores, con cuerpos reales/huellas/ACL/pre-postflight intactos. Acreditar 0128/readback, Portal, cobros/pagos/gastos de C1 y ventanas C2 en sus ramas propietarias. La prueba de este segundo momento no se atribuye al CORE.

MIGRATE-FIRST es un contrato de release, no permiso de aplicar SQL a producción antes de una PR. El ledger productivo puede seguir pendiente y se informa como tal; nunca se obtiene verde aplicando DB sin autorización. OK nominal de Sam para0496 y0497, previa de metadatos y ejecución productiva los coordina el Director por el runbook vigente, fuera de este encargo candidato.

## 10. Evidencia futura proporcionada y gobernanza

Todas las pruebas de esta sección están **NO EJECUTADAS en esta preparación**. Su orden y recursos se activan sólo mediante encargo y turno. No se fija una cuota artificial de tests, mutantes o tiempo para declarar éxito; se exige cubrir los contratos concretos y conservar límites.

1. Adopción/guard/claim/identidad; lectura completa de AGENTS, Worker/runbook/project-rules, brief/políticas aplicables, backend Norte y, antes de UI, BRAND/diseño/Norte vigente. Inventario exacto de producto, pruebas, metadatos y originales; ninguna copia de secretos. Registro durable de decisiones y48rutas CORE antes de producto.
2. Autoría de regresiones y ROJO sobre SHA compuesto congelado. Distinguir aserción funcional de importación, TypeError, preparación o infraestructura. Un fallo de preparación no prueba B1/I3. Preservar originales y después VERDE de esos mismos casos; suplementarios se cuentan separados, no duplicados como nuevos.
3. SQL/PGlite para el contrato que realmente soporten; PostgreSQL local con al menos dos conexiones para las intercalaciones posting↔void, cobro↔posting/void, manual↔par, app vieja↔SQL nueva e inserción tardía de líneas. Comprobar resultado, espera, datos/audit finales y rollback, no sólo duración. Conservar las19 aserciones0467 y sus distinciones. No llamar a PGlite prueba de locks.
4. Negativas de tenant/rol/estado/recibo/count null/cuenta cruzada/borrador/duplicado/header vacío/cierre; fecha inválida/futura original/cierre; cero coherente/incoherente, negativo, centavo desbalanceado, valores grandes representables en columnas y decimales; respuesta scalar/version/identidad/campos, ausencia de símbolo, timeout después de posible commit. No prueba con datos reales.
5. Mutantes ligados a reglas: quitar guard del par, tenant/cuenta, lock/estado, atomicidad de líneas, condición de borrador, fecha original, captura selectiva de código, validación de retorno, metadatos fuera del rango, estado no comparable, ajuste documental, visibilidad neto0, CHECK/owner o aislamiento del motivo. Cada mutante debe fallar funcionalmente por el oráculo previsto y restaurarse por hashes; sobreviviente/inconcluso no se cuenta como detectado. No se debilita el test para encajar el parche.
6. Pruebas de lectores→DTO→UI/CSV/Dirección y radiografía sintética; preservar permisos/completitud/formato y otras salidas. Lector parcial/error no se absorbe como cero, vacío, sin reverso o Cuadra.
7. Tipos/lint/gobernanza/componentes/docs/numbering y receta **normal `pnpm verify` mediante el gestor/preflight vigente**, con build incluido, sobre SHA aprobado y turno exclusivo. No invocación directa de un script para eludir preflight ni cambio de filtros/timeouts/gates para sacar verde. Una corrida con omisiones/retry/flaky se reporta tal cual. Resolver prerrequisitos locales sólo con alcance/receta aprobados; no descargar/instalar por efecto lateral sin evidencia.
8. Revisión UI local acotada con datos sintéticos: detalle de factura, diario y tarjeta I2, avisos de error/espera/sin permiso/par protegido/lectura incompleta/neto0, teclado/foco/confirmación/motivo y anchos relevantes con tipografía real. Aplicar `/ui-check` como rúbrica existente; no diseñador inexistente ni cambio de marca global. Capturas/JSDOM/SSR no equivalen a dispositivo real, hidratación completa o auditoría A11Y integral. Vincular bytes/SHA a cada evidencia.
9. Revisión independiente de la entrega completa; commit selectivo/push/PR DRAFT sólo cuando la asignación lo autorice. Readback head/base/body, remoto/ahead/árbol y recursos por identidad. No merge/deploy. Si después sólo cambia documentación, acreditar equivalencia de producto/SQL/tests, no transferirla por declaración.
10. Impacto documental en spec/handoff; conocimiento con turno aparte y capas separadas (estructura, semántica, Archify, archivos de bóveda, apertura visible). Publicación compartida sólo desde main integrado comprobado; una PR o esta nota no publica conocimiento. No encadenar un ciclo pesado por rutina.

### 10.1 Matriz normativa que debe completar el Worker

Riesgo R3 por mutación financiera/permanencia. No se modifica ninguna política, no se concede excepción ni se declara conforme el legado. Clasificación de esta preparación: las decisiones documentales de I2/M2/I3 y el aislamiento propuesto son **cumplimiento de contrato documental**; B1/I1/I3/M1/M4 y los falsos estados descritos son **no conformidades pendientes de producto**; capacidades ajenas al slice son **no aplica** con motivo; **excepción: ninguna nueva**. Pruebas/visual/runtime pendientes no se etiquetan cumplimiento.

| Principio SGE-00 | Evidencia requerida en cierre del slice |
|---|---|
| .01 Predecible | Anular factura produce contra-asiento conforme; anular manual del par bloquea con razón. |
| .02 Conservación | Rollback de posting completo y recuperación/desconocido sin reemisión ni borrado silencioso. |
| .03 Riesgo/fricción | MP-01 P3/R3, motivo/confirmación existentes, no nueva fricción arbitraria. |
| .04 Auditoría | D2/eventos obligatorios atómicos, actor/contexto real, fallo del log probado. |
| .05 Tenant/permisos/estado | ACL efectiva, rol/tenant negativos, cierre0493 y B1 no eludible por UI o superclave. |
| .06 Prevención | Recibos/error/count null y borradores validados antes de efectos; errores recuperables. |
| .07 Estado verdadero | Espera/éxito/error/desconocido; I2 oficial/ajuste/base; nada de Cuadra por null/neto0 inválido. |
| .08 Frecuencia/complejidad | Mantener flujos existentes; explicar las nuevas restricciones sin nuevos formularios generales. |
| .09 Reutilización | Componentes canonical existentes; no nuevos consumidores deprecated. |
| .10 Accesibilidad | Teclado, foco restaurado/visible, avisos textuales y controles operables; límites reales documentados. |
| .11 Lenguaje | Mensajes precisos: posting falló/no disponible/desconocido y crédito previo ya revertido, sin afirmar ausencia no probada. |
| .12 Autoridad | Esta preparación no ejecuta acción financiera ni IA autónoma; producción/integración conservan su autorización separada. |

Aplicabilidad adicional para abrir/comprobar sobre la base final: MP-01/BTN-01/HTD-01/AVS-01 para permanencia y confirmación existentes; AUD-01/AUD-02 para D2/minimización; ERR-01/FRM-01/LOD-01 para errores/motivo/espera; NUM-01 para exactitud y presentación; TBL-01/A11Y-01/VIS-01/VIS-02/CMP-01 para las superficies tocadas. No se afirma haber revalidado todas esas políticas por ejecución ni todo el diseño del ERP. El registro M:241–273 confirma sus estados normativos; el gate final debe usar sus textos aplicables, no inferir conformidad del nombre de un componente.

## 11. Propagación hacia adelante y dos aceptaciones

Después de aceptar CORE, propagar serialmente **CORE→#310→#311→C1→C2→C3→BCV**, mediante encargos de sus propietarios y relevo de sesiones. No invadir un árbol por antigüedad ni fusionar una cabeza posterior de vuelta a CORE/#307. No crear otra PR0573 que integre todo el stack fuera de orden.

| Frontera | Qué conservar/adaptar | Qué no certifica CORE |
|---|---|---|
| #310 / 0572-a | Ajuste I2 + conversor/completitud/null/contadores/CSV/Dirección de esa base; conflictos selectivos sin restaurar tipos antiguos. | Que 0572-a sigue correcta por compartir nombres de archivos. |
| #311 / 0572-b | anual_v2, decimal/signo/estados/contadores/roles/lectores/nominal CRM legítimo. Oficial anual no recibe el ajuste del control I2. | Compatibilidad de ambas ramas sólo por pasar el helper CORE. |
| C1 | issued_at persistido/readback0128 estricto, CN emisión verdadera, helper IANA, Portal/replay y cierre de gastos; adaptar R1 sólo para factura, resto de posters intactos. | Existencia/funcionalidad de helpers de C1 en la base temprana. |
| C2 | Ventana Portal sin upper y Studio p_asof±1/upper inclusivo, reloj caller único, contratos anuales v2. | Compatibilidad de cuerpos SQL posteriores sin reconstrucción. |
| C3 y BCV | Guardas/fechas móviles y captura/publicación diaria/manual/FX de sus cabezas finales autorizadas; no cambios por reflejo. | Los SHAs finales aún no fijados para este encargo ni pruebas productivas. |

**Aceptación A — CORE integrable:** un SHA propio contra la base temporal exacta, sólo ancestría permitida y máximo48rutas propias, matriz14 reparada con pruebas/limitaciones de esa base, nueva0497 exacta, revisión independiente y PR DRAFT. La matriz R1 queda explícitamente pendiente para C1, no omitida como si no existiera. Las pruebas de convivencia con SQL futuro se identifican pendientes de la aceptaciónB, sin rebajar los contratos propios del CORE.

**Aceptación B — composición posterior:** otro SHA real de la cadena final, manifests de propagación y resolución de cada frontera, R1 adaptada en C1, pruebas SQL de ambos órdenes, preservación de b/Caracas/móvil/BCV y evidencia canónica proporcionada a cambios reales. No transferir resultados entreA/B ni repetir por rutina todos los casos si el delta revisado no lo exige. Defecto del núcleo se corrige en CORE y se propaga; defecto de adaptación se corrige primero en su rama propietaria.

Orden humano de integración conservado: **#301→#304/#306→#307→0573→#310→#311→Caracas/móvil/BCV**. Las autorizaciones de ejecución local, PR DRAFT, integración, migración y publicación son fronteras distintas.

## 12. Cierre específico GO0 y gates posteriores

GO0 completó creación/adopción/composición R0 y evidencia de padres/árbol/ascendencias/delta/metadata. El cierre respalda sólo la rama propia y conserva el recibo posterior al push en 0573-core-cierre-go0.json, dentro de la carpeta de evidencia. Árbol quieto y claim propio retenido por instrucción concreta mientras Director revisa R0 y da nuevo GO/turno; no PR en GO0.

Los14hallazgos y ambas aceptaciones siguen abiertos. ROJO funcional, implementación, VERDE, PG real/carreras/ACL/cierre0493/audit, mutantes, tipos/lint/verify normal, UI real y conocimiento requieren nuevo GO/turno. Histórico/mocks/PGlite/verde con SKIPs/pruebas de otra base no acreditan lo faltante.

Antes de futura edición0497 revalidar metadata/autoridad y ausencia de aplicación conocida; si hay aplicación nueva, detener edición y reportar sin renumerar. No DB real ni retiro de esperas para obtener verde en GO0.

Handoff durable: [.agents/handoffs/0573-reverso-al-anular.md](../../../.agents/handoffs/0573-reverso-al-anular.md). Spec/handoff históricos se conservan en objetos H y preimágenes, sin editar su checkout.

## GO1 · adopción de regresiones autorales, 2026-10-21

GO0 fue aceptado por Director sólo como composición/adopción/respaldo. R0 bd2eeb29af909bc0d62b902ab4973386ee0e2d98 y checkpoint db5f84aab482252ada9030ba20f9e527338b66e2 quedan preservados. B fija e834dc6eef597421d10f880b5deb8d689dcc7078. Misma raíz, rama, owner y claim; sin nuevo Writer.

Encargo GO1: C:/tmp/director-traspaso-20261020/0573-core-go1-regresiones-autorales-director.md; 6024 bytes, SHA256 0192fa90cba290e6c1579138d105cd08dc0e2d2625267e1087fc87332fc3ab6a. Recibos Director GO0: 0573-core-R0-cotejo-director.json SHA256 19569b1b78d1224868f8fef8a52f3cfa9a64ab52a6ab6636ba2056927a655e6c y 0573-core-go0-adopcion-respaldo-director.json SHA256 869a70d0f80854e24bcab5eacf855ee17386f2b3c47a398a071ac3ad1ade6d81.

Autoría permitida sólo en este subset de la allowlist acumulada de48; no cambia la frontera CORE/R1:

```text
app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts
lib/studio/accounting/__tests__/ingreso-periodo.test.ts
lib/studio/accounting/__tests__/ingreso-fixture.ts
lib/studio/accounting/__tests__/libro-control-reverso.test.ts
lib/studio/accounting/__tests__/invoice-posting-reverso.test.ts
docs/specs/0573-reverso-al-anular/spec.md
.agents/handoffs/0573-reverso-al-anular.md
```

Se conservaron preimágenes db5 y sellos de producto/package/lock/config antes de editar: C:/tmp/director-traspaso-20261020/0573-core-go1-worker-20261021/0573-core-go1-adopcion-preimagenes.json.

GO1 permite escribir regresiones M1/I2/I3 y receta futura, hacer checkpoint selectivo/push y crear una única PR CORE DRAFT contra codex/0573-base-temprana-20261021, con attach/readback. Todas las pruebas quedan NO EJECUTADAS. No instala ni ejecuta ROJO, parser, tipos, lint, SQL/DB/Docker/browser/HTTP/build/verify/conocimiento; no repara producto ni cambia0497. Árbol quieto/claim retenido al entregar fuente; runtime requiere otro GO/turno.

Preservar pruebas/asserts heredados. Los dobles deben admitir las llamadas reales actuales y el contrato candidato sin importar DTO futuros: una falta de import, TypeError, preparación o infraestructura no acredita ROJO. I3 sólo mide adapter TS; no atribuye atomicidad/commit/locks a un mock. I2 helper no certifica sus lectores ni UI/CSV/Dirección.

Los14hallazgos, SQL/PG/carreras/cierre0493/ACL/audit, consumidores y aceptaciones A/B siguen pendientes. M5/M6 no reciben pruebas de comentarios.0495 aplicada una vez no se repite;0496/0497 pendientes según metadata, sin ledger real.

### GO1 · fuentes redactadas y receta propuesta

Se redactó únicamente el subset de siete rutas. Producto, SQL0497, tipos/DTO, package/lock/workspace/.npmrc y configuración permanecen sellados: 14 comprobaciones de bytes sin diferencias. No hubo instalación ni ejecución de tests, parser, tipos, lint, SQL/DB/Docker, browser/HTTP, build/verify o conocimiento.

| Bloque autoral | Casos nuevos previstos | Estado |
|---|---:|---|
| M1: count/error/tenant y efectos separados | 7 | NO EJECUTADO |
| I2: lector real, puente documental y estados | 15 | NO EJECUTADO |
| I2: vínculo coherente en cruce puro | 7 | NO EJECUTADO |
| I3: adapter público/RPC/resultado/desconocido | 28 | NO EJECUTADO |

57 casos nuevos previstos; 64 casos literales heredados conservados (20 M1, 38 ingreso, 6 cruce). Total previsto de los cuatro archivos completos: 121. Son conteos de fuente/tablas de casos, no discovery de Vitest ni resultados; cero casos ejecutados, cero ROJO observado, cero VERDE observado. No hay cuota para cerrar el contrato.

Se preservan los escenarios heredados. M1 amplía el doble válido para count nulo/error y recibos de otro tenant; su aserción de filtros mantiene invoice_id/deleted_at y agrega tenant, con cardinalidad exacta de tres y orden indiferente. El aviso de crédito liberado antes de void fallido conserva dos pasos separados.

I2 llama a ingresoDelPeriodo/describirIngreso reales y al paginador real con datos sintéticos; el doble aplica sesión/tenant, filtros, proyección plana y páginas. ajusteAnulacionesUsd/baseComparacionUsd son nombres de salida propuestos en expectativas, sin importar DTO futuro. Una proyección relacional aún no modelada es preparación, no ROJO. No se trajo implementación 310. Lectores completos y consumidores UI/CSV/Dirección no quedan aceptados por este bloque.

I3 importa sólo InvoicePostingInput/Result y postInvoiceJournalEntry existentes. El doble admite también el camino legado completo (contador, cuentas, next_entry_code/string, header y líneas), para observar fallos por salidas/llamadas/efectos; no fabricar TypeError. La RPC de dos UUID, resultado version1 y motivos finitos son contrato candidato, no catálogo instalado. Ningún mock TS demuestra commit/atomicidad/locks/tres intentos internos SQL.

La receta externa conserva comandos completos por archivo, captura de SHA/exit/logs, clasificación de errores y propuesta de plazo/cleanup. Node nativo 24.20.0; PNPM disponible fuera del principal 11.25.0 frente CI 11.19.0; dependencias propias ausentes. Director debe revisar la versión/receta de instalación congelada con scripts deshabilitados y store propio, o provisionar el gestor que fije; no ejecutar el alias PNPM del principal ni copiar deps/env/secretos.

El futuro turno runtime requiere GO y SHA concretos. Import, TypeError, binario/setup, proyección no modelada y TIMEOUT son preparación/infraestructura, nunca ROJO funcional. Se conservan los timeouts del repo; la propuesta administrativa es 180 s por archivo y comunicación cada 30 s, sin retry automático. Logs y store se conservan; sólo el proceso propio puede detenerse por identidad en un futuro watchdog, sin borrar árboles o datos.

La siguiente entrega es checkpoint selectivo/push y una única PR CORE DRAFT contra B, con attach/readback. La PR describirá herencia+composición+fuentes NO EJECUTADAS y los 14 hallazgos abiertos. Árbol quieto/claim retenido después; no runtime ni reparación por adelantado. Aceptaciones A/B, cierre0493/ACL/audit/carreras, consumidores, normal verify, visual y conocimiento siguen pendientes.

Receta: C:/tmp/director-traspaso-20261020/0573-core-go1-worker-20261021/0573-core-go1-receta-y-oraculos.md; SHA256 8ce8c568b88b288c75911f456511dfe5c442a180e84b72ca233df53b9f951aaa.
Manifiesto de fuente/14 sellos/inventario/receta: 0573-core-go1-receta-y-fuentes.json; SHA256 8afa09ce4f56d12447f132203f02cff882739ca9d0c9ed48d7ac706016f88033.

### GO1 · custodia publicada y cierre de autoría

GO0 fue aceptado por Director como composición/adopción; GO1 completó autoría y respaldo, sin reparación ni ejecución. Checkpoint fuente: 8a588ccab2e0dc943a5c4b8a6610c3c612c6402e (árbol 04e109975831dbab7e1ada7ad0777f5b6cf8ecdb), hijo de db5f84aab482252ada9030ba20f9e527338b66e2. Su delta es exactamente el subset7 autorizado.

Única PR CORE creada: [#320, DRAFT](https://github.com/SoftAgentes/DTDCARGO/pull/320), abierta contra codex/0573-base-temprana-20261021 / e834dc6eef597421d10f880b5deb8d689dcc7078. Se adjuntó mediante herramienta oficial. Readback inicial verificó draft, head, base, cuerpo y 32 rutas acumuladas dentro48. R0 aportaba29 rutas; fixture, ingreso-periodo.test e invoice-posting-reverso.test suman3 al diff frenteB. GO1 no escribió32 rutas: escribió7.

Este commit de cierre sólo actualiza spec/handoff para registrar la entrega; todos los bytes de las cinco fuentes autorales y de producto/SQL permanecen iguales al checkpoint fuente. El recibo externo 0573-core-go1-cierre.json guardará su SHA final, remoto, diff,14 sellos y readback final de PR sin autorreferencia documental.

57 casos nuevos y64 heredados,121 previstos: inventario textual,0 ejecutados,0 ROJO observado,0 VERDE observado. Los14 hallazgos y aceptaciones A/B siguen abiertos. Dependencias propias ausentes; receta y diferencia PNPM11.25/CI11.19 pendientes de revisión antes de otro GO/turno runtime. Ningún check de PR sustituye esa evidencia.

Árbol quieto y claim propio retenido al entregar. Sin instalación, parser/tipos/lint/tests/SQL/DB/Docker/browser/HTTP/build/verify/conocimiento, main/merge/deploy/producción. Histórico intacto;0495 no se repite,0497 no se edita. Fuentes/recibos/logs conservados para revisión de Director.

### GO2 · oráculo L1 y preparación externa UNBOUND, sin runtime

Encargo adoptado completo: C:/tmp/director-traspaso-20261020/0573-core-go2-oraculo-preparacion-director.md, SHA256747424b7f73ac51628abdbea702c775094c68ec6c8aa3db3eea30e27a9851c69. Revisión peer final leída completa:0573-core-go1-revision-pruebas-peer.md, SHAc10290f3a52f57591cf4cd7394d775b3cc7722c6ed3faef7e462a2ba1a77ba3c. Entrada1c4b859d26d80033c6f8d3b971ee0f1f8e691e9c; misma raíz/rama/owner/claim. Adopción y tres preimágenes de entrada guardadas antes de editar; GO0/GO1 e histórico preservados.

Allowlist escritora GO2, subset exacto de48, sin nuevas rutas:

```text
lib/studio/accounting/__tests__/invoice-posting-reverso.test.ts
docs/specs/0573-reverso-al-anular/spec.md
.agents/handoffs/0573-reverso-al-anular.md
```

L1 era una omisión de oráculo por fuente, no un bug observado de producto: los ocho not_posted conocidos admitían cualquier string, incluido unknown. Se conserva toda aserción anterior y se agregan toBe(skipped) y not.toBe(posting-state-unknown), con esta correspondencia pública ratificada para implementación posterior:

| SQL | skipped público |
|---|---|
| invoice_unavailable | invoice-unavailable |
| invoice_not_postable | invoice-not-postable |
| invalid_issue_date | invalid-issue-date |
| invalid_amounts | invalid-amounts |
| totals_mismatch | totals-mismatch |
| missing_accounts | missing-accounts |
| period_closed | period-closed |
| existing_sale_requires_review | existing-sale-requires-review |

zero_total/zero-total y already_posted/entry-already-exists siguen iguales. Forma/identidad/versión inválida y motivo desconocido conservan unknown. La variante hipotética que transforma todo rechazo conocido aunknown ahora incumpliría cada fila: razonamiento de fuente, no mutante ejecutado. No cambia28 casos I3,57 nuevos,64 heredados o121 previstos. Cero discovery/ejecución/ROJO/VERDE; cuatro fuentes autorales restantes y14 sellos intactos. No se cambió producto,0497, tipos/DTO/package/lock/config.

Preparación externa nueva: C:/tmp/director-traspaso-20261020/0573-core-go2-preparacion/. Contiene adopción/preimágenes, metadataCLI actual, receta, launcher y manifestUNBOUND. Perfil C:/tmp/sdd0573-core-runtime-01a15a4e, node_modules y salidas I/T no creados. Launcher no cargado ni validado por parser/ejecución. No instalar ni probar este launcher por GO2.

Por metadata/hash actual, Nodebundled24.19.0 y PNPMpackage11.25.0 coinciden con la selección del Director; --version NO EJECUTADO. CI fija11.19.0 y no se declara equivalencia. dist/pnpm.mjs SHA256ddc64218bc85fb88d28b5def06eb01fafb39cb67f7a9465ce736456658cc7f11. El argv0578 fue rechazado y no es validado: parser326097–326263 convierte install→add si quedan posicionales; opciones globales/rcInstall327698–327719/225656–225725 no tipan varios ajustes. Explicación de lectura, sin reproducción.

La receta propone argv de opciones tipadas con rutas --key=value y PNPM_CONFIG_* tipado para runtimeOnFailerror/npmrcAuthFile/stateDir/globalvirtualstorefalse; XDG_CONFIG_HOME propio determina config/pnpm, pues171185 sobrescribe config-dirCLI. Conserva frozen, ignore-scripts/ignore-pnpmfile, pmOnFailerror, TLS normal, ausencia de fallback, store/cache/state/config/virtualstore propios y child1/network2/copy. Todos los hijos propuestos limpian Environment y reciben whitelist sin secretos/proxies/NODE_PATH/config del usuario; no se modifican variables del anfitrión.

Fases futuras separadas: I00–I03 instalación/metadatos; T cuatro archivos completos seriales,1worker/no-file-parallelism/reporterverbose,180s por archivo y sin cambiar20s heredados. Presupuesto propuesto único1800s desde primerI00, incluye pausa entre fases y cierre; no renovable. Observación≤5s/progreso30s/comunicación≤45s; heap3GiB, RAMlibre<2GiB/árbol>6GiB por dos muestras, stream64MiB; captura binaria doble desdeStart. VoidTaskResult descartado, JSON con DateKindString y UTC.NET exacta/ParseExactInvariant, identidadPID+nacimiento.NET y CIMsólo filiación. UNKNOWN conserva null/turno retenido, nunca cero. Cierre de recursos primero≤60s compartidos, sin cleanup destructivo ni retry automático.

Lo anterior es fuente propuesta no verificada operacionalmente. Director debe decidir argv/env/versiones/presupuesto, fijar SHA/tree/manifestBOUND/GO por fase y asignar turno; no hay turno heredado de0578. Un exit nativo/121 textos no acredita resultado funcional; import/TypeError/doble/setup/timeout/captura incompleta son preparación/infraestructura. Los14 hallazgos, SQL/PG/locks/cierre0493/ACL/audit, lectores/UI/CSV/Dirección y aceptaciones A/B permanecen pendientes. Conocimiento todas las capas NO EJECUTADO. Árbol quieto/claim retenido al entregar, misma PR320 DRAFT/baseB, sin nueva PR/merge/deploy.

Índice externo manifiesto-preparacion-go2.json SHA256e7f9a872ba40392fd25147460849d0e85b75d51dfa36f3bae1f31eee059768ff; receta-UNBOUND.md SHA25612606b0d9e3925fd54e2429e660605499d7016b5d8b8238ac8d6af9a8c40ae66. El recibo externo cierre-go2.json guardará SHA fuente/final/tree/parent, diff y readback final de PR sin autorreferencia.

### GO2 · sellado final v2 de preparación, sin ejecución

Candidato fuente L1 publicado: f9acd0eb9b02cb1392899c8a3e5015dec48c94d0, árbol d027ed9057193c62dcfda559dd9f72124e69c4a7, padre1c4b859d26d80033c6f8d3b971ee0f1f8e691e9c. La lectura final del launcher propuesto detectó una inicialización explícita necesaria de CloseUntil antes del primer paso bajo StrictMode. Se conserva v1/recibos y se crea v2 con esa sola línea operacional; no se cargó, parseó para validación ni ejecutó. Este commit posterior sólo actualiza spec/handoff: pruebas y producto idénticos a f9acd.

La preparación vigente para revisión es launcher-runtime-UNBOUND-v2.ps1 SHA25642a829b41ea855b2ba7de189b0f9436d746dc1c049fbc7f73eaba805af8d08fc, manifest-UNBOUND-v2.json SHA256b9dc3117405ae3dc3e5c9fce1ac5a4fdd254e52f216215f475c76607b101e8f6 y receta-UNBOUND-v2.md SHA256b7073c0a931f9bab457c05fe2e78cdd245030de829c4dfb440121a09695dd749. Índice manifiesto-preparacion-go2-v2.json SHA256d5e6966625a30263316d20b9658a2eb3c16f5b6e6340546ac8f3c19457d309fc, todos bajo C:/tmp/director-traspaso-20261020/0573-core-go2-preparacion/. El manifest sigue UNBOUND/executableNowfalse/runtimeApprovedfalse; perfil/deps/salidas no creados,121 previstos/0 ejecución y14 hallazgos/A/B abiertos.

Recibo final cierre-go2-final-v2.json registrará SHA fuente f9acd y SHA final documental, árbol/padre, delta GO2 completo/subset3,14+4 sellos y readback de la mismaPR320 DRAFT/baseB. Claim retenido/árbol quieto; otra decisión y turno son necesarios para cualquier runtime. Las verificaciones descritas son de fuente/Git/metadatos, no pruebas operacionales del launcher.
## Checkpoint local M1 · fuente implementada, VERDE pendiente

Encargo vigente 0573-M1-producto-checkpoint-director.md (5960 bytes, SHA256 9385a175fc62381e8d7dcbea089e638075e8563e4781f74757b0876e84ca6aaf) y criterio peer M1 (9025 bytes, SHA256 faa1c1b2a4847c899a0c1c5802e40a7b6f4cafd9cf71c187c6c195dde87f918c) leídos completos. Misma raíz/rama/owner/claim; entrada 0e5a28567b5d5df43e92f3fd52eb0662ca55842a. La allowlist escritora de este checkpoint contiene sólo actions.ts de Facturación, este spec y el handoff propio; conserva las 48 rutas CORE acumuladas.

ROJO previo observado sobre esa entrada: T01 descubrió y ejecutó sus 27 casos, 22 PASÓ y 5 FALLÓ por aserción, exit 1/reason null/quiet true. Evidencia cerrada en C:/tmp/director-traspaso-20261020/0573-core-runtime-T-04/: T01-stdout.log (6203 bytes, SHA256 cb10d746a8ae6d7346e269f0ca43d9f1161745a084f3ebf91be9290e71b45803) y T01-stderr.log (3390 bytes, SHA256 5cdcfdd3bfe6702fcd506e527dc08be14009e213ac2610cf1993cd4f158891de). No se repite el ROJO.

M1 ahora captura error y count del conteo exact/head de payment_receipts, conserva invoice_id/deleted_at NULL y agrega tenant_id desde current.tenant_id, obtenido por el flujo de sesión existente. Error, incluso junto a count 0, o count null/undefined devuelve un mensaje recuperable de cobros sin texto crudo de DB y antes de crédito, void, revalidaciones o éxito. Cero conocido conserva el flujo legítimo; positivo conocido mantiene la orientación a Cobranzas. Permisos/motivo/estado, control RPC bajo lock, orden reversión→void y avisos heredados de crédito no liberado/entries/crédito confirmado seguido de void fallido permanecen iguales.

Gobernanza: R3/P3; corrección acotada de las no conformidades M1 SGE-00.05/.06/.07/.11 y prevención/recuperación ERR-01, sin excepción nueva. Los efectos/auditoría y la autoridad del tenant se conservan; los mocks no prueban SQL/RLS, carrera real ni transacción única crédito+factura.

Los 27 oráculos permanecen inmutables, SHA256 daa0f5d7f46d3222539951c80557a42e12fffe2976bc92b333b91134dc2809ff. Los otros 18 inputs del manifest runtime previo se conservan; sólo actions cambia entre sus 19 entradas. El recibo externo de checkpoint registrará después de existir el commit su SHA/tree/padre directo 0e5a, diff y sellos, sin autorreferencia documental.

Estado de esta entrega: M1 implementada POR FUENTE, VERDE pendiente de revisión y GO focal con margen. Ningún runner/test/parser/instalación/SQL/DB/verify/visual/conocimiento ni censo en este checkpoint; sin push o modificación de PR. El baseline parcial total fue 80 = 64 PASÓ + 16 FALLÓ, con 41 previstos T03/T04 NO EJECUTADOS; su supervisión/UNKNOWN y recibos originales false siguen intactos tras devolución administrativa limitada. No se cierra I2/I3/I4/B1/M2–M9 ni los 14 hallazgos/A/B. El reloj original I no se renueva ni transfiere. Impacto canónico/Graphify/Archify/semántico/Obsidian y verificación completa quedan pendientes del cierre CORE autorizado.
