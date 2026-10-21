# Handoff · SDD-0578 · Envíos por cliente, camino normal prospectivo

## OBJETIVO ORIGINAL

Implementar el encargo Director íntegro copiado abajo, con cohorte prospectiva OFF y límites legacy/financieros/productivos preservados.

## ADOPCIÓN Y OWNERSHIP

- Rol Worker adoptado explícitamente para esta asignación nueva, separado de la preparación interna read-only anterior.
- Task ID: 042-envio-cliente-camino-normal.
- Owner único: worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal.
- Rama: codex/sdd-0578-envios-cliente-camino-normal.
- Base inicial comprobada: 1ec5e85f736b7826cf5b6e8781757dc4cf950733. Árbol limpio al inicio.
- Harness guard: PASÓ. Claim exclusivo: ADQUIRIDO antes de este primer archivo.
- Fuente: C:/tmp/director-traspaso-20261020/042-activacion-worker-0578-director.md.
- SHA256 de fuente íntegra cotejado: 1939a04752338b66bc5187961f8a1a216093dc6101fdb28771bec2efae607be4; 60.909 bytes; 284 líneas leídas sin truncación en tres rangos.
- Fase P1 ligera; BCV GO03 conserva el único turno pesado. Instalación, tests, SQL/DB, Docker, browser, tipos completos, build, verify y knowledge: NO EJECUTADO y sin turno.

## CONTRATO DIRECTOR ÍNTEGRO

<!-- Inicio del contenido íntegro de la activación Director sellada; no editar esta sección. -->

# Worker SDD-0578 · activación de 4.2, camino normal prospectivo

**Estado: ACTIVADO para trabajo local ligero y publicación DRAFT.** Decisión del Director del 21 de octubre de 2026, después de aceptar el cierre local de 0574 y comprobar su claim liberado. Este encargo convierte el candidato revisado en una tarea concreta; no autoriza producción ni concede ahora el turno pesado.

## 1. Asignación ejecutable

`$worker`. La sesión interna antes denominada `revision_042_alcance` adopta ahora explícitamente esta tarea como **una nueva sesión escritora aislada**, con el único owner siguiente. Su preparación anterior era de lectura y no se presenta como implementación ni aceptación. El Director conserva su rol y no escribe producto/tests.

| Campo | Valor autorizado |
| --- | --- |
| Objetivo | Implementar y entregar para revisión el camino normal prospectivo LCL/DDP de envíos por cliente: formación y extensión aditiva desde Naviera, medidas y tarifa parcial honestas, código protegido, plan/estiba/sello, tránsito y llegada operativa gobernados y entrega completa. Preservar legacy y mantener enrolamiento OFF. |
| Task ID | `042-envio-cliente-camino-normal` |
| Owner único | `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468` |
| Worktree | `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal` |
| Rama propia | `codex/sdd-0578-envios-cliente-camino-normal` |
| Base exacta D1 | `1ec5e85f736b7826cf5b6e8781757dc4cf950733` |
| SDD | `docs/specs/0578-envios-cliente-camino-normal/spec.md` |
| Migración nueva coordinada | `supabase/migrations/0502_consolidacion_cliente_camino_normal.sql` |
| Handoff propio | `.agents/handoffs/042-envio-cliente-camino-normal.md` |
| Base remota de la futura PR | `codex/sdd-0574-embarques-cierre`, verificada en D1; volver a comprobar antes de crear/actualizar PR. No retarget automático a main. |
| Permiso de publicación | Sí: commits selectivos propios, push de la rama propia y PR **DRAFT**, incluidos un primer checkpoint de reserva/spec/contrato con pruebas aún NO EJECUTADAS y actualizaciones posteriores. Adjuntar cada PR creada con la herramienta del app. No enviar mensajes a personas. |

Inventario fresco y reserva atómica del Director: `042-reserva-director-0578-20261021.log`, 504 refs más worktrees, siguiente SDD 0578 y SQL 0502. Reserva SDD publicada `refs/heads/codex/sdd-reserve-0578`, commit `4ea14d8a520f48cdfccb15db14e2d186b8aa9b3b`, cuyo delta es exclusivamente el stub de esta spec. El harness creó el árbol/rama indicados desde D1, sin entorno ni dependencias ni claim. Verificar raíz/rama/HEAD y reclamar el owner propio antes de editar.

Después del claim, adoptar **sólo el delta del stub propio** con cherry-pick de `4ea14d8a520f48cdfccb15db14e2d186b8aa9b3b`. Su padre es main D410: **no mergear la reserva ni origin/main**, lo cual incorporaría otra ascendencia a esta entrega apilada. Conservar la reserva remota; no borrar ni reciclar números. Crear y respaldar el stub SQL 0502 en el primer checkpoint propio, antes del cuerpo DDL. Si aparece una colisión nueva, detener sólo esa reserva y devolver evidencia al Director; no elegir otro número por cuenta propia.

D1 hereda producto 0574 `639c8954`, canónica `8394a560`, corrección de pruebas donante c4 y #307/0496. 0574 fue aceptado localmente con canónica exit 0/**CIERRE INCOMPLETO 16/17**, timeout y retry nativo conservados. Conocimiento posterior: estructura y Archify CURRENT, semántica piloto 0/16 y global 0/1326 PENDING, preview 1325 documentos, check exit 1 por MAIN_REQUIRED y SEMANTIC_PILOT_PENDING, 43 avisos y cero conflictos; sin apertura visible, integración o producción. El claim de 0574 se liberó a las 13:33:59.669 UTC. Estos resultados no se trasladan como pruebas de 0578 ni se retocan sus documentos congelados.

## 2. Fuentes, precedencia y fases concretas

Leer y cotejar íntegramente antes de producto: AGENTS vigente suministrado por Sam; skill Worker y runbook Director/Worker, reglas técnicas/dominio, AGENT-BRIEF y políticas aprobadas aplicables, Norte backend y, antes de UI, BRAND/diseño/Norte vigente. Para identidad/evidencia, skill de privacidad; para cierre, runbook de conocimiento. Leer el plan canónico y su 4.2, manteniendo separados 4.3/4.4/4.6. Clasificar gobernanza como cumplimiento, no aplica, excepción documentada o no conformidad; no inventar excepciones.

| Fuente externa congelada bajo `C:/tmp/director-traspaso-20261020/` | SHA256 |
| --- | --- |
| `042-contrato-slice-normal-propuesto.md` | `f27d04f884923569a33af893207d223de98690ed1a873ad2dbd109f5d96caa64` |
| `042-decisiones-manifiesto-codigo-baseline.md` | `be5778c0e5f7428d4705ee05a62b7db2eb8627f4e51586e429534635d5b44e9a` |
| `042-extension-aditiva-grupo-propuesta.md` | `de88bece32c259466504147cc376599f50c383ad0c0473f5093c028a216e5420` |
| `042-decision-director-extension-codigo-20261021.md` | `c57ffc0e9c14610b0220e46cafd41e7cb2c3869d43a4f78274e60fa86eddb44c` |
| `042-decision-director-transito-manual-preparacion.md` | `ad1c1e0286828ed264c12bd52ed142acd913a2e793d9dfdb752f76d09e51cce1` |
| `042-encargo-worker-propuesto.md` | `87dc488f97fbd4ea9e1777e2c9dc94a4719d840f9ef1ddc1d67da97d988078c5` |

Las secciones 3–11 y 13 que siguen adoptan el contrato completo ya revisado, con sus 50 rutas sustituidas por nombres literales. El candidato original y las notas permanecen intactos como antecedentes. Esta cabecera y la sección 12 concreta prevalecen únicamente sobre sus referencias históricas a no activación, numeración pendiente y orden de turnos. Las decisiones c57 y tránsito manual acotado se ratifican como diseño de esta tarea; no son una reforma global ni un permiso productivo.

- **P1 vigente ahora:** guard/claim, lecturas, guardar este encargo íntegro en el handoff propio, spec/allowlist/contratos y matriz de aceptación; adoptar stub propio y reservar SQL; autoría ligera de producto, migración, fixtures y pruebas dentro de las 50 rutas; commits/push y DRAFT temprano. Se amplía expresamente el antiguo P1 del candidato para permitir esta autoría. No presentar código escrito como probado. Herramientas de Git, harness y generación/check de índice documental proporcionales permitidas.
- **P2, pendiente de turno explícito:** instalación propia con lockfile congelado y ejecución de regresiones/oráculos/DB local/HTTP/UI. BCV conserva en exclusiva el turno GO03. Ahora no instalar, abrir Docker/DB/browser de prueba ni ejecutar Vitest, tipos completos, lint amplio, build, verify o conocimiento. No crear un proceso oculto para eludirlo. Preparar el plan local y avisar al Director cuando esté listo; continuar todo trabajo ligero independiente.
- **P3, después de checkpoint revisable:** Director revisa head/base/diff y coordina la receta canónica normal `pnpm verify` que ya incluye build. Un único pesado a la vez; preservar fuentes, nativos, fallos, SKIPs y recursos propios. No debilitar gates o repetir build/canónica por rutina.
- **P4, publicación autorizada:** toda la rama propia queda en DRAFT con base comprobada, dependencias y cobertura real. Una PR parcial no se etiqueta lista para integrar. El cambio de base o de allowlist requiere coordinación concreta.
- **P5, cierre posterior:** documentos estables y un ciclo local de conocimiento con turno coordinado; separar estructura, semántica, Archify/preview, integración y revisión visible. Publicación compartida desde esta rama NO autorizada.

Únicas excepciones de escritura fuera de las 50 rutas rastreadas: claim/metadatos Git propios mediante harness; evidencia ficticia, scripts auxiliares de ejecución y logs del owner en `C:/tmp/director-traspaso-20261020/0578-normal-validation/`; dependencias y derivados locales ignorados que creen las herramientas nativas en el árbol propio cuando reciban turno. No son permiso para cambiar un runner, contrato, entorno global o archivo rastreado adicional. No copiar `.env`, secretos, `node_modules`, datos ni cambios ajenos. Si un auxiliar externo afecta el oráculo, sellar sus fuentes/hashes y justificarlo; no sustituye la prueba del producto real.

No merge, main, deploy, VPS, bases reales, PII, altas de cohorte, cambios de cuenta/pago, lectura de filas reales, publicación compartida ni contactos. 0495 aplicada nunca se repite; 0496/0502 no se aplican por este encargo. El OK nominal productivo de cada migración corresponde sólo a Sam. Ejecutar autónomamente todos los pasos autorizados hasta handoff revisable, sin pedir permisos rutinarios otra vez.


## 3. Contrato común de cohorte y permisos

Cohorte persistente protegida en DB, **OFF por defecto**, independiente del prefijo del código, de una fecha aproximada, del browser y de tener tarifa. La activación nominal futura fija tenant/ámbito/comienzo; callers no pueden elegir legacy/cohorte. Al desactivar altas futuras se preservan marcas/miembros ya enrolados y sus guardas.

Primer ámbito: LCL/DDP únicamente. Primer enrolamiento/formación de contenedor sin carga legacy, plan ni posiciones preexistentes, autorizado y `consolidando`. Recepción nueva enrolada viva, pendiente, sin shipment/membresía ni estiba/entrega/asignación anteriores; cliente estable resuelto sin ambigüedad, destino/servicio y medidas completos. Huérfana/sin medidas queda pendiente visible sin fallback C-. No se activa un ámbito que necesite servicios o casos excluidos sin tratamiento revisado.

Un grupo por **tenant+contenedor+cliente**, un shipment con `client_id`, un código y un item Naviera; una recepción sólo pertenece a un grupo. `client_id` nuevo es compatible con legacy nullable, no una exigencia global para toda alta antigua. Servicio y destino del grupo quedan fijos; la selección sin tarifa requiere elección operativa explícita y validada, sin sobreescribir datos incompatibles. Cliente se resuelve exactamente con el contrato estricto de 0496 por identidad/marca canónica viva del tenant, no por nombre/primer candidato/redirect supuesto. Catálogo de destino completo por referencia activa y texto canónico persistido; un destino faltante puede capturarse expresamente, uno incompatible no se pisa. Preservar redacción de nombres para CN sin permiso y Portal por principal propio.

| Operación | Autoridad actual que se preserva, sin nueva facultad implícita |
| --- | --- |
| Formar/extender | Sesión y membresía activa de tenant; edición efectiva CN+Naviera+Tracking, overrides y scope CN vigentes. Defaults admin/operations según matriz actual; no sustituir resolución efectiva por un rol hardcodeado ni ampliar matriz. |
| Tránsito manual ratificado | Permiso efectivo Tracking y tenant/scope vigentes, actor/membresía activos, identidad completa de cohorte y sello, estado `shipped` y revisión esperados, motivo/ref; sin exigirle por accidente los tres módulos de formación ni ampliar la matriz. |
| Plan/cerrar | Edición efectiva Naviera y contexto/scope vigente de la operación; cierre nuevo gobernado con estado/revisión. No exigir por accidente los tres módulos de formación a toda operación posterior. |
| Zarpar/arribar | 0477: membresía activa y Naviera+Tracking, decisión de avance/saltos/`already`, locks y evidencia vigentes. |
| Congelar tarifa regular/elevada | 0496: regular admin/operations/warehouse/accounting; manual, excepción 1000 o reemplazo eleva a admin/accounting con motivo según el cuerpo. Vista previa/lectura no equivalen a poder congelar. Binding no concede nuevos roles. |
| Estiba/desestiba | Identidad de operario CN activo y contrato/scope de `requireCnOperario`/RPC actuales; conservar actor operario. No inventar acceso de un JWT ni nuevo rol físico. |
| Liberación VE / reparto | Permiso efectivo VE y scope actuales en las operaciones vigentes, con estado/motivo/referencia; no ampliar por el permiso de formación. |
| SENIAT | 0484: membresía activa del tenant con admin/operations/accounting, trámite/documentos/fecha/motivo/referencia y resto de guardas actuales. No simular que VE revisó esos documentos. |
| TMS | 0486: membresía activa admin/operations/warehouse y ruta/camión/chofer/locks/replay vigentes. |
| Entrega manual | 0487/0321: membresía activa admin/operations/warehouse, receptor/motivo/referencia, estado y terminal vigentes; atestación expresa del grupo sellado completo. |
| POD | 0336: operario VE activo camionero/supervisor, vínculo OD/evidencia y estados origen vigentes; sin activar caller/flag v2. |
| Portal | Principal vivo propio y tenant; cohorte por `client_id` propio, legacy por marca+tenant. Política permisiva vieja por marca no puede seguir concediendo otra identidad de cohorte. |

Todas las operaciones DB derivan actor/tenant/contexto autorizado; API/browser no aportan autoridad. Contexto privado transaccional inaccesible a roles API para habilitar cambios de cohorte; una GUC/flag falsificable no basta. Guardas alcanzan DML equivalente y service_role. Componer firmas/ACL/owner/seguridad de funciones actuales mediante la migración nueva, verificando cuerpos base; **no editar SQL histórico ni dejar helpers alternativos ejecutables que eviten las guardas**.

## 4. Formar, extender, revisar y reproducir sin efectos duplicados

Vista previa paginada/completa por ámbito/IDs: candidatos, grupos existentes/nuevos, conflictos, versiones/huellas, servicio/destino/código canónico, medidas reales y tarifa conocida/ausente. Selección editable/cancelable antes de confirmar. «Seleccionar todo» no son las primeras 100/200 filas; error/tope/lectura parcial no equivale a vacío o conjunto completo. CN/Tracking generales siguen como pantallas acotadas; la rama nueva usa lector específico con prueba de completitud y revalida en DB.

**Intención autoritativa y durable:** mismo espacio tenant+referencia para formación/extensión, distinguiendo operación, actor derivado, objetivo, delta de IDs ordenados/sin duplicados, servicio/destino/código canónicos cuando se crean, revisiones y versiones fuente. Conservar intención estructurada junto a huella de servidor; el hash del browser no prueba igualdad. Una referencia con intención distinta o de otro actor no reutiliza la atestación; dos referencias no pueden apropiarse de la misma recepción. Un replay exacto exige autoridad actual de lectura y devuelve el resultado original, incluso después de otra extensión, tarifa, cierre o estado posterior: sin sumas, fechas, eventos, auditoría de éxito o avisos nuevos. UI lee el estado actual por separado.

**Formación — una transacción:** permisos/cohorte/estado; intención/locks de contenedor y recepciones en orden estable, identidad/fuentes relevantes y snapshots después de recepción; revisión y selección revalidadas; cliente/servicio/destino compatibles; medidas y conjunto de cajas comprobados; crear grupo/shipment `consolidating` con client_id y sumas, item/membresías/recepciones `consolidado`, enlace activo compatible de 0496, como máximo una alerta activa según contrato inicial de f27 y evidencia obligatoria. Todo confirma o revierte junto, incluido AUD-01. Ningún helper C-, alta Tracking con mail/workflow/costos u OV se usa para crear la cohorte. No tomar como pura la acción `createShipment` existente.

**Extensión — operación distinta de un grupo existente:** sólo grupo `consolidating` y contenedor `consolidando` sin sello; delta no vacío de recepciones NUEVAS completas y compatibles, sin pertenencia previa. Se mantienen identidad/servicio/destino/código/reserva/shipment/item/creación y todos los miembros anteriores. Cada recepción anterior mantiene medidas, cajas declaradas y asociación. No se agranda una recepción antigua; recibir por tandas de 0449 crea otra recepción que luego puede anexarse. Un dato/estado incompatible rechaza todo el delta sin retirar, reasignar, dividir, cancelar o reabrir.

La extensión mínima afecta un grupo por operación. Se serializa por intención → contenedor → grupo/envío → recepciones nuevas ordenadas → sus snapshots; cajas/posiciones según protocolo común antes de mutarlas. Agrega membresías, liga recepciones al mismo envío y actualiza sólo derivados/versiones autorizados. No exige que el contenedor ya formado carezca de plan/estiba: preserva la carga anterior y exige ausencia de esos efectos sólo en el delta. Invalida plan vigente de revisión anterior en el mismo commit. No crea otro código/reserva/item/alerta, no reabre alerta resuelta ni repite formación inicial/costos/workflow/OV. Fallo de auditoría o de cualquier miembro revierte entero el delta.

**Versiones:** grupo +1 por cada extensión efectiva; contenedor +1 por cada operación efectiva de membresía, incluida creación de otros grupos/oleadas. Conservar medidas/conjunto de cajas por miembro y revisión de incorporación. Tarifa, escaneo, POD o estado no incrementan la revisión de pertenencia. Revisión de plan es independiente. Nueva intención compara revisiones y estados/sello; no rebase silencioso. Dos extensiones sobre revisión antigua: una gana y la otra refresca. Otra referencia con un receipt ya miembro es conflicto, no replay implícito.

**Medidas:** sumar todos los miembros fijos y el delta en DB con precisión/overflow comprobados, CBM positivo, peso/cajas conocidos/válidos; null no es cero. Guardar/coherir identidad exacta de cajas recibidas y cantidad, sin inferir IDs físicos de un conteo. Proteger campos de recepción y los INSERT/retarget/borrado de cajas que cambien el universo ya incorporado, además de posiciones. API no edita medidas/client_id/destino/servicio/identidad/miembros/derivados de cohorte; sólo RPC autorizada de extensión puede aumentar derivados. No usar medidas monetarias o promedios por caja como realidad física.

## 5. Composición 0496 y precio observado

Conservar `0496_tarifa_congelada_por_embarque.sql`, sus fórmulas/mínimos, precisión, excepción de peso, ACL y fuente. La presencia en Git no demuestra aplicación. Sin schema/funciones requeridos, mostrar prerrequisito no disponible y fallar antes de efectos; no usarlo como una tarifa ausente revisada.

- En formación/extensión, enlazar sólo snapshots **activos** presentes de las recepciones incorporadas, null→envío una vez, verificando tenant/cliente/servicio/destino/medidas. Un vínculo previo incompatible es conflicto, no limpieza. No rellenar históricos reemplazados sin enlace.
- Extender no escribe snapshots de miembros anteriores, importes ni fechas. Los nuevos miembros pueden quedar sin tarifa: no crear snapshot sintético ni cero, ni bloquear físicamente por sólo faltar precio.
- En congelación/reemplazo separado vigente, la composición DB deriva el mismo envío desde receipt→miembro fijo en cada INSERT, incluso si el caller omite `shipment_id`; devuelve la fila enlazada. Comprobar compatibilidad y al commit que ningún snapshot vivo de miembro quede NULL/desvinculado/incompatible. Si falla, también se revierte supersede. 0496 por sí sola permite INSERT null y sólo protege OLD/tenant/reemplazo; no afirmar activa hoy esa guarda de grupo.
- Reemplazo mantiene autoridad/motivo/historia de 0496; no es una corrección financiera o de membresía nueva de este encargo. Un cambio de importe por otra operación ya autorizada se identifica como nuevo snapshot activo de esa operación, no como efecto de añadir carga.
- 0496 bloquea recepción antes de snapshot; preservar ese orden. Binding tardío lee la asociación fija/valores fijos del grupo **sin tomar locks de grupo/contenedor después de recepción ni incrementar versiones**. Congelar primero → formar/extender espera y enlaza lo activo; formar/extender primero → congelar espera y nace ligado al mismo envío. No certificar esto con mocks o una sola sesión.

Proyectar tarifa por recepción: IDs de snapshots activos observados, revisión de miembros, cantidad/faltantes/completitud/hora de lectura; sumar exactamente sus importes generados en centavos enteros/decimal exacto. Contar cada mínimo una vez por snapshot/recepción; no recalcular mínimo por grupo, promediar ni aplicar precio viejo a CBM nuevo. Subtotal conocido separado; **total=null / «Total pendiente»** si falta tarifa o completitud. Snapshot inválido/incompatible es error, no ausencia. Resultado durable conserva lo observado entonces; refresco muestra precio actual por lectura separada. No persistir esa proyección como deuda, factura, pre-factura, costo o saldo.

Preservar 0574: unidad/detalle por recepción, sumas exactas/faltantes/completitud y contrato de desconocido. No llamar su clasificador de facturas para validar una formación ni convertirlo en productor de 4.3. Su exclusión actual por shipment+marca no certifica el futuro contrato de factura parcial. No cambiar el módulo de reporte de producto por comodidad; los tests asignados demuestran compatibilidad con varias recepciones del mismo envío.

## 6. Código manual y duplicados frente a todos los escritores pertinentes

Para cada grupo NUEVO adoptar el contrato de lectura pública de 0326: normalización autoritativa SQL `upper(btrim(coalesce(...,'')))`, regex exacta `^S-[0-9]{4}-[0-9]{4,10}$`, sin autonúmero/formato alterno ni regla de año actual. UI muestra valor normalizado/error; RPC recalcula y DB exige código canónico válido para cohorte, incluidos writers directos. No asumir equivalencia JS trim()/SQL btrim(). La intención compara el valor canónico; duplicado dentro del lote falla entero. Extender no crea ni cambia código/reserva.

La alta ERP actual sólo recorta/obliga texto y conserva UNIQUE(tenant_id,code); no se presenta como si ya tuviera esta regex. CN WR-/SIN-CODIGO-, C-, códigos de caja, Shipping Mark y nº físico Naviera son identidades distintas. Mantener sus contratos legacy y el UNIQUE por tenant, que tampoco se libera por soft-delete.

**Reserva mínima de be5778/c57ffc0, sin ampliación:** reserva global única sólo de códigos NUEVOS de cohorte, ligada al envío y sin liberar/retargetear aquí. Al reservar, comprobar ese código contra todos los envíos vivos cuyo `upper(code)` coincida, incluidos otros tenants/legacy. Error genérico «Código no disponible», sin IDs/identidad de otro tenant. No sanear colisiones históricas ni crear backfill de reservas.

Reserva/check no bastan sin carrera cerrada: confirmar y cualquier INSERT/cambio/reactivación que pueda introducir una coincidencia deben serializarse por la misma clave aun antes de existir reserva, incluidos legacy/service_role y cambios de `code`/`deleted_at`. Fuera de reservas, conservar política legacy; no imponer regex global o limpieza por esta tarea. Las operaciones con varias claves usan orden estable documentado y pruebas de los dos órdenes. Mantener los guardas de identidad del shipment de cohorte para que no se renombre como escape.

**Gate obligatorio:** no prometer/activar tracking público de la nueva cohorte sin demostrar unicidad frente a esos escritores. La consulta 0326 no tiene tenant y usa LIMIT 1; UNIQUE por tenant, una preconsulta o copiar sólo la regex no resuelven ambigüedad. Probar SQL local del lector para códigos reservados; consumidor/despliegue público real no verificados y siguen gate de release separado. No ampliar esta tarea a rediseñar su consulta o sanear historia.

## 7. Plan, estiba y sello completo

Plan por revisión completa de contenedor/vector de grupos y huella de input, no número de items. Un item sigue siendo un lote de cliente; extender conserva su ID/created_at y cambia su carga. Nuevo lector completo sin cap silencioso 500 ni fallback piezas=1 para datos inválidos de cohorte. Motor puro/heurística legacy se conservan; no convertir orden de asignación del item en prioridad operativa garantizada por tanda.

Guardar/archivar el plan de cohorte con una RPC atómica bajo lock/revisión; calcular fuera de la transacción no concede permiso para publicar luego un input viejo. Invalidar vigencia en el commit de cada cambio de membresía; conservar historia. Numeración de plan continúa sobre toda la historia aunque no haya is_current; no usar sólo `(vigente?.version_no ?? 0)+1`. Impedir INSERT/UPDATE directo como escape y evitar que un cálculo previo gane después de extender.

Escaneo valida caja.receipt_id→miembro→envío→contenedor, tenant, revisión/estado y conjunto físico confirmado; si cualquiera de caja/recepción/contenedor es de cohorte, aplicar guarda incluso enrolada sin confirmar. No montar nueva caja en contenedor legacy ni introducir legacy/ajenos en uno nuevo. Preservar same-tenant, recibida y UNIQUE de posición viva actuales; cubrir caja/lote/DML equivalente/service_role. El lote real actual se selecciona por prealerta, admite partirlo y puede incluir otra tanda recibida aún no incorporada: validar **todas las cajas que intentará montar** y rechazarlo entero si cruza el manifiesto, sin subconjunto oculto. Caja individual incorporada conserva su vía. No reinterpretar prealerta como grupo.

Para cohorte ordenar lock de contenedor antes de locks físicos que pudieran invertirlo; no resolverlo sólo con un trigger tardío. Corrección física/desestiba/reestiba dentro del mismo contenedor abierto conserva posiciones cerradas, actor e historia; nunca cambia membresía ni mueve a otro contenedor. Comprobar estado también al deshacer. Manual sin plan sigue válido con estas guardas; recalcular no mueve cajas ni prueba optimización de huecos ocupados.

Sugerencia/anotación de plan se liga a la revisión vigente. Nuevos escaneos no se atribuyen a plan vencido; posiciones ya registradas conservan su plan histórico. El UPDATE actual de traza es posterior/best-effort: si se rechaza tras estibar, reportar traza pendiente sin repetir la estiba efectiva. La página móvil y el cliente deben mostrar cobertura/revisión/incompletitud y descartar respuestas viejas.

**Cerrar** en RPC de cohorte serializada con formación/extensión/plan/estiba: comparar revisión y estado esperado, leer todos los grupos/miembros/cajas sin truncación, validar medidas y cobertura exacta de posiciones vivas sin ajenos/faltantes/duplicados y crear sello durable con revisión de contenedor/vector de grupos/huellas/miembros/cajas/sumas. Cambiar a `cerrado` en el mismo commit; no inventar otro estado de shipment por cerrar. Guard DB cubre el UPDATE directo del action antiguo. Después no se añade/retargetea/corrige carga ni se reabre este sello. Capacidad sigue advisory, no un tope comercial nuevo. La cobertura es del registro declarado/escaneado, no certificación física externa.

## 8. Estados, llegada y entrega — sin factura automática

No convertir `STATE_MACHINE` TS en CHECK global: sus hints por servicio no representan todas las operaciones vigentes; TMS escribe legítimamente last_mile para LCL/DDP. Autorizar por operación+predecesor+contexto, con actor/tenant/fuente/estado esperado, sello cuando corresponda, referencia, hora servidor, evento y AUD-01 atómicos.

| Operación | Resultado/condición candidata que debe probarse |
| --- | --- |
| Formación / extensión | Nace `consolidating`; extender lo conserva, añade nota de delta y no otro hito inicial. |
| Cierre | Contenedor `consolidando→cerrado` con sello; shipment no cambia por inferencia. Aviso `consolidated` existente sólo tras resultado efectivo. |
| Zarpe / arribo Naviera | 0477 intacto para legacy y compuesto para cohorte: `cerrado→zarpado` a `shipped`, `zarpado→arribado` a `in_customs`, avance/saltos/already y permisos/evidencia/avisos actuales. Requiere sello coherente; no limitar por error su decisión a un hint TS. |
| Tránsito manual ratificado | `shipped→in_transit` mediante RPC atómica con permiso efectivo Tracking/tenant/scope actuales, actor/membresía/identidad/sello de cohorte completos, estado y revisión esperados, motivo/ref idempotente. Hora/evento/AUD atómicos, replay histórico. No UPDATE+evento separados. Naviera conserva avance/saltos a aduana desde ese estado, sin bloqueo/retroceso. Ratificación de implementación del Director para activación futura; no política global. |
| Liberación operativa VE | RPC `in_customs→arrived_destination` bajo permiso/scope VE actual, motivo/ref/estado esperado. Significa liberado de aduana/listo para retiro. No declara haber revisado seis documentos SENIAT ni limpia un trámite. |
| Liberación SENIAT | 0484 conserva trámite pagado/documentos/fecha/motivo/ref y roles; `in_customs→arrived_destination`. Contexto de cohorte no sustituye gates por una bandera. |
| Reparto | RPC VE `arrived_destination→out_for_delivery`, autoridad actual, dirección/nota acotadas, sello y evidencia. PATCH genérico no es entrada alternativa. |
| Completar TMS | 0486 conserva ruta/recursos/locks/ref/replay, `out_for_delivery→last_mile`, válido para cohorte LCL/DDP sin cambiar TS global. |
| Entrega manual | 0487/0321 desde `out_for_delivery`/`last_mile`, receptor/motivo/ref y atestación explícita del grupo sellado completo; UI muestra el objeto/cobertura antes de confirmar. No llamarla POD ni afirmar foto/firma. |
| POD | 0336 conserva identidad/evidencia y estados/terminal; registrar POD parcial legítimo y cerrar sólo al acreditar toda la membresía sellada según apartado siguiente. No activa flag/caller v2. |

Comparar todos los receipt_id del grupo sellado contra asignación/entrega vigente del tenant entre ODs: ningún miembro faltante, pendiente, rechazado, retornado, duplicado/contradictorio o lectura incompleta. El cierre 0336 actual sólo cuenta el shipment dentro de la OD actual; la rama de cohorte debe **conservar el POD parcial pero omitir el UPDATE delivered** hasta cobertura global. Último cierre efectivo: un hito/auditoría; dos PODs concurrentes bloquean y verifican el mismo sello antes de decidir. La referencia idempotente cubre también POD que aún no cerró. No hacer rollback de una entrega parcial legítima sólo para fingir que toda OD equivale al grupo.

Detectar asignación/POD previo incompatible mientras aún figura consolidando como estado fuera del camino normal; no extender ni cancelar/reparar esa historia. Tras sello no se admiten miembros nuevos que un POD anterior pudiera cerrar. La vía manual y la POD verifican el mismo sello, con autoridades/evidencia diferentes.

Caller observado en H/D1: `app/m/ve/camionero/actions.ts` usa v1 `camionero_pod`; no se localizó caller v2/flag en los árboles buscados. v1 conserva captura, no se convierte aquí en cierre. Probar composición v2 por RPC local y el recorrido manual real; no declarar una jornada móvil v2 end-to-end si no hay caller autorizado en el alcance.

**Fechas/efectos:** nueva operación captura una sola `clock_timestamp()` servidor después de locks/validaciones para comando/miembros/evento nuevos; now() es inicio de transacción y no se usa para fingir ese momento. Preservar creación/primera formación, received_at, frozen_at y eventos anteriores. Referencias/revisiones determinan causalidad sin prometer reloj monótono. Snapshot/reemplazo y auditoría conservan sus contratos propios de hora. Replay no toca fechas. Notas nuevas sólo con estado actual/hora servidor; eventos manuales no fabrican hitos. `arrived_destination_at` queda anclado, no renovado por replay/PATCH; no backdate. Llegada actual no prueba ingreso físico ni desconsolidación. Ninguna operación nueva crea/emite factura, pre-factura, cargo, costo, asiento o saldo ni llama a OV; preservar OV legacy. No añadir el gate financiero de entrega 4.4.

## 9. Escapes, lectores y rollout OFF

- CN individual verifica cohorte **antes** del helper C-/alerta/OV; acción nueva dirige a Naviera sin efectos antiguos. Bulk no vuelve miembros a pendiente/incidencia, borra ni quita marca/asociación; DML/RPC alternativos también quedan protegidos. Recibos enrolados aún no formados sólo conservan acciones vigentes compatibles que no creen/desvinculen shipment.
- Naviera `assignLooseCargo`/`removeConsolidationItem`/DML directo no manipulan cohorte fuera de RPC. Drawer legacy sigue fuera de ella. Tracking alta/API no puede autoasignar protocolo o capturar recepción enrolada por UPDATE posterior. PATCH, eventos, borrados, identidad/medidas/timestamps y universo de cajas tienen guard DB más errores seguros en adaptadores.
- Portal: policy compuesta que separa cohorte por client_id propio de legacy por marca+tenant. No sumar una policy permisiva y dejar la antigua como bypass. Lector admin de contenedor sólo después de verificar envío propio y sin exponer clientes ajenos.
- Lectores específicos devuelven completitud y revisiones, con límites explícitos/fallo visible; no convertir error en cero. Preservar los límites veraces de 0574 y de las pantallas generales. No corregir todo el ERP ni alterar paginador/motor compartido por esta tarea.
- Enrolamiento y activación permanecen **OFF al entregar**, incluso si las pruebas locales pasan. Schema/funciones/guardas aditivos primero; callers compatibles después; activación nominal separada sólo tras comprobar prerequisitos, SQL autorizado y retiro/drain de versiones/peticiones antiguas. Una guarda de receipt por sí sola no impide el C- huérfano que un caller antiguo crea en una llamada previa separada. Si ese corte no puede probarse, **no activar**, sin backfill para disimularlo ni fallback al helper viejo.
- Nueva migración pendiente: baseline con basename real/motivo/dependencias/orden/OK nominal; símbolos pendientes coherentes y fail-closed. No entry por capability o placeholder, no subir cutoff 238, no retirar 0496/esperas ajenas, no afirmar aplicado con Git. 0496 no se aplica y 0495 no se repite por este encargo.

## 10. Las 50 rutas autorizadas y su alcance

Allowlist ejecutable de esta tarea: cincuenta rutas únicas y literales. Los directorios [id] y [consolidationId] conservan sus nombres Next, sin comodines. No se habilitan archivos vecinos. No hay obligación de tocar una ruta existente sin necesidad; una adición o exclusión material se coordina con Director antes de editar.

| # | Ruta literal autorizada | Alcance exacto / writer o reader y aceptación |
| --- | --- | --- |
| 01 | `lib/studio/client-consolidation/types.ts` | NUEVO. DTO de cohorte, preview/formación/extensión, revisiones/sello, resultado durable/estado actual separados y conflictos seguros; fuente/actor/tenant no confiados al browser. |
| 02 | `lib/studio/client-consolidation/queries.ts` | NUEVO. Candidatos/miembros/items/ciudades/cajas y metadata completos por ámbito/IDs; prueba de completitud/revisión, sesión y privacidad. Adaptadores RPC y lectura Portal propia; no service_role para fabricar tenant. |
| 03 | `lib/studio/client-consolidation/normal-flow.ts` | NUEVO. Operaciones/proyección del camino normal, compatibilidad de servicio/destino/estado y gates de UI en paridad con DB; no reemplaza el hint TS global ni política fiscal. |
| 04 | `app/studio/(app)/naviera/_components/ConfirmarEnviosClienteDrawer.tsx` | NUEVO. Preparación cancelable, grupos nuevos o delta al existente, código canónico sólo al crear, antes+añadido=después, precio parcial, versiones/conflictos y una confirmación por intención; foco/pending/consecuencias veraces. |
| 05 | `app/studio/(app)/naviera/actions.ts` | Writers de formar/extender/cerrar por RPC y traducción de conflicto; bloquear atajos assign/remove en cohorte antes de efectos. Mantener avance/avisos legacy, no C-/OV/costos. |
| 06 | `app/studio/(app)/naviera/page.tsx` | Reader servidor de metadata/gates/revisiones/plan/sello para cohorte; conservar roles/redacción CN y no pasar universos truncados. |
| 07 | `app/studio/(app)/naviera/_components/NavieraClient.tsx` | Drawer según cohorte, grupos/revisiones/sumas, añadir/extender mientras abierto, plan sin cobertura y resumen/sello de cierre. Mantener acciones legacy fuera de cohorte. |
| 08 | `app/studio/(app)/naviera/plan-actions.ts` | Rama cohorte: input completo y persistencia atómica RPC ligada a revisiones, secuencia sobre toda historia y conflictos de cálculo en vuelo. Motor/legacy conservados. |
| 09 | `app/studio/(app)/cn/actions.ts` | Writer individual corta antes de C-/OV; bulk no deshace miembros/protocolo; errores/derivación a Naviera. Mantener hook OV y comportamiento legacy correspondiente. |
| 10 | `app/studio/(app)/cn/page.tsx` | Reader de metadata de filas visibles, pertenencia/revisiones y capacidad de preparación; lista de 100 no se presenta como selección completa. |
| 11 | `app/studio/(app)/cn/_components/AlmacenCnClient.tsx` | Pasar metadata/gates/resultados a filas/bulk existentes, redacción y estado actual coherentes; sin rediseño general. |
| 12 | `app/studio/(app)/cn/_components/ReceiptRowActions.tsx` | Preparación/ir a Naviera, recepción nueva o ya miembro, explicación de restricciones/estado; no ofrecer el helper viejo dentro de cohorte. |
| 13 | `app/studio/(app)/tracking/[id]/actions.ts` | Rama RPC normal para tránsito manual ratificado y notas, con sello/revisión/estado/motivo/ref; cortar edición/cancelación/borrado incompatible. Resolver cohorte antes de aplicabilidad TS; autoridad vigente y cero nuevos efectos financieros. |
| 14 | `app/studio/(app)/tracking/[id]/page.tsx` | Cargar manifiesto actual/sellado/revisiones/gates y pasarlos a paneles; no confundir resultado antiguo con estado actual. |
| 15 | `app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx` | Identidad/servicio/destino/medidas derivados de cohorte como lectura; revisión/miembros/sumas y límites de corrección explícitos. |
| 16 | `app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx` | Sólo operaciones disponibles; llegada con significado liberación actual, sin ingreso físico supuesto; no salto genérico/TS como contrato DB. |
| 17 | `app/studio/(app)/tracking/[id]/_components/FooterActions.tsx` | No ofrecer cancelación/retiro/reapertura de cohorte sin política; explicación contextual conservando legacy. |
| 18 | `app/api/studio/shipments/[id]/route.ts` | PATCH/DELETE no cambian protocolo, miembros, identidad, medidas, derivados o estado por atajo; mapping de negación/conflicto consistente con guard DB, sin identidad ajena. |
| 19 | `app/api/studio/shipments/[id]/events/route.ts` | Cohorte por RPC atómica; notas con estado actual/hora servidor; no UPDATE+evento/compensación ni timeline como sustituto de hito. |
| 20 | `app/studio/(app)/ve/actions.ts` | Liberación/reparto por RPC cohorte y entrega manual con sello/manifiesto completo; conservar autoridad/legacy, receptor/motivo/ref y cero factura/cargos. |
| 21 | `app/studio/(app)/ve/_components/VeRowActions.tsx` | Confirmar liberación con su significado y entrega manual como atestación del grupo entero; resumen actual/sello antes de confirmar, sin llamarla POD. |
| 22 | `app/m/cn/estibar/actions.ts` | Adaptar errores de pertenencia/revisión caja/lote/deshacer, traza de plan y éxito físico separado de fallo de anotación; identidad operario/privacidad vigentes. |
| 23 | `app/m/cn/estibar/_components/EstibaClient.tsx` | Contexto de revisión/cobertura y conflictos de lote/confirmación; retirar sugerencias viejas/respuestas obsoletas y no repetir estiba ya efectiva. Sin cambiar algoritmo físico. |
| 24 | `lib/portal/portal-queries.ts` | Reader cohorte con client_id propio/principal vivo/tenant y agrupación Naviera; rama legacy por marca+tenant; admin lector sólo tras autorización del envío, sin clientes ajenos. |
| 25 | `lib/studio/rate-snapshots/types.ts` | Errores públicos de binding/compatibilidad/cohorte, sin cambiar precios/mínimos/validación comercial o dar autoridad nueva. |
| 26 | `lib/i18n/es-VE/warehouse.ts` | Claves de formar/extender, revisiones/sello, conflictos, precio pendiente y plan sin cobertura en infraestructura existente. Sin errores crudos/PII. |
| 27 | `lib/i18n/zh-CN/warehouse.ts` | Paridad de claves CN y privacidad con ruta 26; sin nombres reales ni reglas operativas inventadas. |
| 28 | `supabase/pending-migration-symbol-declarations.json` | Símbolos de la migración real asignada, guards y prerequisitos fail-closed conforme al protocolo; no declarar aplicación/capability activa. |
| 29 | `supabase/migrations-baseline.json` | Entrada concreta de espera por basename real pendiente, motivo/orden/OK nominal; conservar cutoff/otras esperas. Nunca fingir aplicación ni placeholder. |
| 30 | `docs/specs/README.md` | Índice del SDD asignado, mediante mecanismo vigente; no numeración manual ni reserva en esta preparación. |
| 31 | `.agents/handoffs/042-envio-cliente-camino-normal.md` | NUEVO futuro. Encargo íntegro/owner/base/allowlist, evidencia y límites por gate, commits/PR/recursos propios/pendientes/impacto documental; sin tablero global. |
| 32 | `app/m/cn/estibar/[consolidationId]/page.tsx` | Reader adicional justificado por de88/c57: metadata de cohorte/revisión, completitud del conteo y plan vigente; actual lee sólo id/result y descarta complete. Usar lector nuevo propio para no exponer sugerencia/cobertura vieja. |
| 33 | `docs/specs/0578-envios-cliente-camino-normal/spec.md` | NUEVO tras asignación. Contrato y decisiones c57, estados/roles/locks/DTO/errores/rollout OFF, 50 rutas exactas, oráculos y evidencias con límites. No done si falta aceptación. |
| 34 | `supabase/migrations/0502_consolidacion_cliente_camino_normal.sql` | NUEVO tras asignación. Schema/FK/índices/RLS/ACL, enrolamiento OFF, grupos/miembros/medidas/cajas/revisiones/sello/intenciones, reserva mínima, RPC/guardas/contextos y composición condicionada de writers existentes, 0496 y Portal. Preflight/locks/postflight/rollback documentados; sin backfill/SQL histórico editado/activación. |
| 35 | `supabase/tests/consolidacion_cliente_normal.test.sql` | NUEVO. Oráculo DB real de toda la cohorte: gates/RLS/tenant, formar/extender/replay, medidas/cajas, código global, 0496, plan/estiba/sello/transiciones/POD/entrega, bypasses y AUD; legacy/OV sin efectos nuevos. |
| 36 | `supabase/tests/_consolidacion_cliente_normal_schema.sql` | NUEVO. Fixture mínima ficticia con cuerpos reales de helpers/guardas/RPC compuestos; sin stubs permisivos que hagan desaparecer el riesgo, sin datos productivos. |
| 37 | `lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts` | NUEVO. Ejecutar el contrato DB con los cuerpos reales, paridad operación/servicio/estado/gates y mutantes críticos. PGlite no certifica carreras de dos sesiones. |
| 38 | `scripts/check-client-consolidation-concurrency.mjs` | NUEVO. PostgreSQL local desechable/two-session con barreras y resultados deterministas para disputa, extensiones, freezer, reserva vs legacy/reactivación, plan/estiba/cierre/POD. Sin producción/servicios permanentes; recurso propio serial por turno. |
| 39 | `app/studio/(app)/naviera/__tests__/envios-cliente-actions.test.ts` | NUEVO. Gates/adaptador, una mutación RPC por intención, códigos/delta/resultados, no confiar medidas/tenant browser, conflictos/replay y cero C-/OV/costing. |
| 40 | `app/studio/(app)/naviera/_components/__tests__/ConfirmarEnviosClienteDrawer.test.tsx` | NUEVO. Selección cancelable, crear vs extender, código/precio parcial, versiones/consecuencia/pending, foco y conservación de contexto al fallar. No sustituye browser/UI real. |
| 41 | `app/studio/(app)/cn/__tests__/consolidacion-cohorte.test.ts` | NUEVO. Individual corta antes de helper/OV, bulk y borrar no deshacen miembros, pendientes no caen a C-, y caso legacy correspondiente conserva su hook. |
| 42 | `app/studio/(app)/naviera/__tests__/plan-carga-cohorte.test.ts` | NUEVO. >500/input completo, mismo item con carga añadida, revisión/cálculo en vuelo, numeración tras invalidación, persistencia atómica y legacy conservado. |
| 43 | `app/studio/(app)/tracking/[id]/__tests__/cohorte-normal-actions.test.ts` | NUEVO. Edición/evento/cancelación/estado rechazan atajos; tránsito ratificado prueba permiso/scope/sello/revisión/ref, replay y rollback; TMS last_mile válido no se rechaza por hint TS. |
| 44 | `app/api/studio/shipments/[id]/__tests__/cohorte-normal.test.ts` | NUEVO. HTTP PATCH/eventos/DELETE, auth/tenant/payload malicioso, errores y RPC atómica; sin compensación separada ni fallo de auditoría con residuos. |
| 45 | `app/m/cn/estibar/__tests__/cohorte-pertenencia.test.ts` | NUEVO. Adaptadores y página/props de revisión/completitud, caja/lote/deshacer, plan vencido y traza best-effort, redacción CN; pertenencia real y DML se verifican también en DB. |
| 46 | `app/studio/(app)/ve/__tests__/cohorte-normal.test.ts` | NUEVO. Liberación/reparto/entrega manual con sello completo, autoridad/motivo/ref/replay, fecha anclada y cero llamadas financieras. |
| 47 | `lib/portal/__tests__/envios-cohorte.test.ts` | NUEVO. Principal/client_id propio, tenant/marca ajenos, agrupación Naviera y legacy; RLS real también en SQL, no sólo mocks. |
| 48 | `lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts` | EXISTENTE. Varias recepciones de un envío y extensiones, suma exacta de mínimos por snapshot, tarifa parcial/lectura incompleta y replay observado sin alterar unidad del reporte 0574. |
| 49 | `app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts` | EXISTENTE. Regular/elevada/lote, errores de binding y conteos parciales honestos; pertenencia/tarifa activa enlazada se prueba con SQL real. |
| 50 | `e2e/consolidacion-clientes-camino-normal.spec.ts` | NUEVO. Recorrido sintético browser→API→DB local desechable: formar, recibir/añadir tanda compatible, ver un envío propio, plan/estiba/sello, avance/liberación/reparto/entrega manual completa. Caller POD v2 sólo si entra por autorización aparte; RPC v2 se prueba en SQL. |

Lectura sí, edición no por esta lista: SQL históricos 0321/0336/0449/0477/0484/0486/0487/0496, RBAC/guards generales, paginador general, motor `lib/shared/estiba-plan.ts`, lectores `shipment-queries.ts`/`warehouse-cn-queries.ts`/`naviera/plan-queries.ts`, acciones/queries de tarifa, producto del reporte 0574, acciones SENIAT/TMS/caller móvil v1. La migración nueva puede reemplazar/componer cuerpos DB con base/ACL/legacy comprobados sin modificar sus archivos históricos. Si una ruta más fuera necesaria, elevar evidencia/ajuste a Director antes de editarla; no ampliar por comodidad, no transferir el problema a una segunda tarea con bypasses activos.

## 11. Matriz de oráculos de aceptación y validación

**Todos los estados actuales de esta matriz son NO EJECUTADO.** Estos casos son aceptación exigida de la tarea activada; no son pruebas pasadas. Cada caso registra fixture, entrada/actor/estado, salida/efectos esperados, archivo/oráculo y log/resultado real. Un error por import/RPC ausente sólo demuestra ausencia de feature, no que una guarda funcional fue probada. Para invariantes críticos usar controles negativos/mutantes que quiten la guarda, observar el fallo pertinente y restaurar los bytes; no tests que sólo transcriban implementación.

| ID | Oráculo observable requerido | Cobertura principal de rutas |
| --- | --- | --- |
| A01 Normal | Dos clientes compatibles en un contenedor → dos shipments con client_id/códigos/items propios; varias recepciones compatibles de uno → un solo grupo. Medidas exactas, alerta inicial máxima una, no C-/OV/costos/factura. Selección completa y cancelable antes del commit. | 04–12, 34–37, 39–41, 50 |
| A02 Prospección | OFF mantiene legacy. Caller no puede enrolar/desenrolar a voluntad. Primer contenedor con legacy/plan/posiciones preexistentes no se convierte. Huérfana/sin medida/prerrequisito fuera permanece pendiente visible sin C-. | 01–03, 05, 09, 34–37, 41 |
| A03 Atomicidad/identidad | Otro tenant/actor inactivo/scope/override sin permiso, cliente ambiguo o cambiado, destino/servicio incompatible, fuente vieja, code repetido o fallo AUD → cero grupos/links/sumas/alertas/eventos parciales. RLS también con SQL y API. | 05, 18–19, 24, 34–39, 44, 47 |
| A04 Extensión real | Recibir una prealerta en tandas 0449, formar primera y extender segunda mientras abierto → mismo shipment/item/código/reserva/creación; miembros/snapshots/posiciones anteriores intactos; medidas y ambas revisiones aumentan una vez. Otra ciudad/servicio/identidad, receipt previo, delta vacío o estado cerrado rechaza entero. | 04–08, 10–15, 34–40, 42, 50 |
| A05 Replay/versiones | Misma referencia/intención antes/después de otra extensión, nueva tarifa o cierre devuelve IDs/sumas/fechas/revisiones originales sin efectos; UI refresca estado actual aparte. Referencia compartida formar/extender distinta intención o actor falla. Dos refs misma recepción y dos extensiones con versión vieja no duplican/rebasan. | 01–08, 34–40, 50 |
| A06 Medidas/cajas | Null vs cero, precisión/overflow/CBM/peso/cajas y roster físico. SUM sobre miembros fijos completa sin usar tarifa. Intentos directos de cambiar receipt/box/miembro/item/totales o mover/borrar cajas ya incorporadas fallan, incluido service_role y bulk. | 09, 13, 18, 22, 34–38, 41, 44–45 |
| A07 Snapshot | Delta con snapshot vivo null se enlaza una vez; incompatible falla sin limpiar; sin tarifa sigue desconocido. Freezer posterior/reemplazo autorizado de miembro queda vivo ligado al mismo envío; incompatible revierte también supersede. Old snapshot/enlace/fecha/importe no cambia por extensión. Roles/motivo/1000 de 0496 se conservan; histórico reemplazado sin enlace no se backfillea. | 25, 34–38, 48–49 |
| A08 Precio parcial | Un miembro con tarifa y otro sin: subtotal exacto, faltantes y total null. Todos conocidos con lectura completa: suma de importes/min por recepción una vez. Incompleto/error/importe inválido no se vuelve total cero; vector de snapshots observado y refresh separado de resultado anterior. No cambia unidad de 0574 ni se consulta/emite factura para confirmar. | 01–04, 14–15, 34–37, 40, 48–49 |
| A09 Código | Normalizador/regex de 0326 idénticos en UI/RPC/DB; no asumir JS trim. Vacío/formato/no canónico/repetido en lote o tenant falla sin efectos. Colisión normalizada viva de otro tenant/legacy da error genérico. Archived/rename/reactivación/reserva conservada y ambos órdenes de carrera no producen código público ambiguo; legacy fuera de reservas conserva contrato. | 04–05, 34–39, 40, 50 |
| A10 Plan | >500 items/miembros/cajas leídos completos o error claro. Extender mismo item invalida plan en el mismo commit. Cálculo/anotación vieja no publica ni atribuye escaneo nuevo; persistencia fallida no deja estado partido; próximo número sigue historia aun sin vigente. Posiciones/historia intactas, manual sin plan válido. | 02, 06–08, 22–23, 32, 34–38, 42, 45 |
| A11 Estiba | Caja/lote/INSERT/UPDATE/service_role con tenant/pertenencia/estado válidos pasa; ajeno/no confirmado/legacy mezclado falla. Lote de prealerta con una tanda aún no incorporada rechaza entero, no sólo filtrado favorable. Caja individual válida y lote partido autorizado conservan su vía. Deshacer sólo abierto y dentro del mismo contenedor sin borrar historia/membresía. | 22–23, 32, 34–38, 45, 50 |
| A12 Sello | Cierre exige conjunto actual completo, sumas y cobertura exacta viva; faltante/ajeno/duplicado/incompleto falla. Extensión/estiba/plan concurrentes o entran antes con revisión actual o fallan tras sello; ninguna carga queda fuera ni se añade después. UPDATE antiguo a cerrado no lo evita. | 05–08, 22, 32, 34–39, 42, 45, 50 |
| A13 Estados/llegada | Ejecutar composición real 0477+0484+0486+0487/0321: autoridades, predecesores, saltos/already/replay/locks/correlation vigentes, sello y eventos/auditoría. Tránsito shipped→in_transit ratificado sólo con Tracking/tenant/scope/identidad/membresía/sello/estado/revisión/motivo/ref válidos; negar permiso o membresía retirados, estado/revisión viejos, sello ausente/incompatible, motivo/ref inválidos y ref reutilizada con intención distinta. Inyectar fallo real de AUD/evento: rollback conserva status/fecha/revisión/sello y no deja evento/auditoría de éxito parcial; replay conserva hora/evento originales. Después, 0477 avanza a aduana sin bloqueo/retroceso por in_transit. VE conserva significado aduanal/timestamp anclado; TMS last_mile no se rompe por TS. PATCH/evento/GUC/RPC previa directos no evaden contexto. Cero factura/cargo/costo. | 13–21, 34–38, 43–46, 50 |
| A14 POD/entrega | Un grupo sellado entre ODs no cierra con la primera fracción. POD parcial se conserva y reporta pendiente; último completo cierra una vez; falta/rechazado/retornado/contradictorio no cierra. Replays y dos PODs concurrentes no duplican hito/fechas. Entrega manual atesta grupo completo y no se llama POD. Caller v1/v2 y límites de UI honestos. | 20–21, 34–38, 46, 50 |
| A15 Privacidad/Portal | Cohorte sólo principal/client_id propio; otra marca/tenant/client_id no obtiene acceso por policy vieja ni por lector admin. Legacy propio sigue visible. CN sin nombres conserva redacción. Conflictos de código no revelan tenant/identidad ajena. | 02, 06, 10–12, 24, 26–27, 34–37, 40, 45, 47, 50 |
| A16 Fechas/efectos | Hora nueva capturada una vez tras locks; old creación/received/frozen/hitos preservados. Nota extensión no reinicia estado ni llega/entrega; replay no reavisa. Fallo AUD revierte todo. Extender no duplica/reabre alerta ni ejecuta C-/OV/workflow/costing. Legacy que corresponde mantiene OV. | 05, 09, 13, 19–20, 34–41, 44, 46, 49 |
| A17 Rollout/metadatos | Enrolamiento OFF; funciones ausentes/pendientes fail-closed sin helper viejo. Baseline sólo basename real y símbolos correctos; cutoff/esperas ajenas intactos. Compatibilidad de callers/old inflight y gate público no se declara pasada por mocks o por SQL aditivo. | 01–03, 05, 09, 28–29, 33–39, 41 |
| A18 UI real | Browser sintético con componentes/CSS reales: crear→extender→grupo actual→plan/estiba/sello→liberación/reparto→entrega manual, errores conservan contexto/foco/pending y no duplican acción. `/ui-check` claro/oscuro, móvil390/escritorio, teclado/reflow/zoom/tabla/última columna, privacidad y límites veraces. | 04, 06–07, 10–17, 21–23, 26–27, 32, 40, 45, 50 |

**Concurrencia obligatoria real y acotada en PostgreSQL desechable, no PGlite/mocks:** misma recepción; mismo grupo/dos refs; dos extensiones de versión vieja; freezer→formar/extender y formar/extender→freezer; reemplazo de miembro anterior concurrente; recepción 0449 vs extensión; reserva→writer legacy y writer legacy→reserva con INSERT/cambio/reactivación y otras filas/tenants; cálculo/guardado/anotación de plan vs membresía; caja/lote/deshacer vs extensión/cierre; cierre vs nueva oleada; dos PODs del sello. Usar barreras verificables, asserts sobre commit/rollback/filas finales, timeout y logs por sesión. Deadlock/error/timeout no es un éxito funcional. Documentar orden de locks y toda superficie de writer alcanzada; no certificar cobertura con sleep/timing casual.

**Validación futura por capas, en el turno que entregue Director:** pruebas DB/unitarias/adaptadores/HTTP/contratos y mutantes; lint/tipos/diff-check/SDD/numeración/índice y gates aplicables; e2e y `/ui-check`; regresiones de contratos SQL que se componen y legacy; después receta canónica normal `pnpm verify` del SHA revisado, que ya incluye build. No repetir build/canónica por rutina. Registrar configuración/fuentes/lockfile/runners y bytecheck tras EXIT antes de actualizar docs. Mantener fixtures ficticias, DB/servicios loopback propios y evidencia externa del owner; nada de sesión productiva, credenciales reales, teléfonos/PII/media reales o afirmación de A11Y global. No escribir tests sólo de forma que imiten la implementación.

No modificar scripts generales/configuración/invoice boundary para acomodar el cambio: el nuevo producto no introduce un lector nuevo de invoices. Si un gate detecta una dependencia real fuera de allowlist, registrar evidencia y decisión del Director antes de alterar. `migrations-applied` es gate de release separado; estado omitido/no disponible se conserva explícito, no se usa como motivo para aplicar producción o inventar verde.


## 12. Dependencias operativas fijadas por Director

| Dependencia | Estado y condición |
| --- | --- |
| Base 0574/#307 | D1 exacto y rama remota fijados en la cabecera; cierre local de 0574 aceptado, claim liberado. Dependencias DRAFT, sin integración/producción. |
| IDs y aislamiento | SDD 0578 reservado de forma atómica y publicado; SQL 0502 coordinado por inventario fresco y pendiente de stub en rama propia. Worktree/rama creados desde D1, claim propio por tomar. No escoger números ni mezclar ascendencia de main. |
| Turno de ejecución | BCV GO03 es el único pesado actual; 0578 hace autoría ligera. Instalación, DB, pruebas, UI y conocimiento esperan transferencia explícita del Director. |
| Código público | Se adopta la reserva mínima y gates de be5778/c57. Probar guardas y ambos órdenes de carrera localmente; acceso/despliegue real quedan fuera. |
| Tránsito y autoridades | Tránsito manual shipped a in_transit ratificado con A13; preservar contratos exactos 0477/0484/0486/0487/0321/0336, scope y significado de llegada. No requiere otra pregunta a Sam. |
| Allowlist | Las cincuenta rutas son concretas. La página móvil adicional está autorizada. Cualquier dependencia rastreada adicional exige evidencia y decisión del Director antes de editar. |
| Rollout | Cohorte prospectiva OFF al entregar; no convertir historia ni activar callers/cohorte/flags en ambientes reales. |

Las diferencias de diseño ratificadas frente a f27 son: miembros anteriores fijos con extensión aditiva antes del sello; ausencia de plan/posiciones exigida al primer enrolamiento, sin impedir ampliar después; código manual compatible S- con reserva mínima; página móvil adicional y baseline por migración concreta. Se conserva el resto de autoridades, legacy y exclusiones. Si aparece una contradicción material, documentar blob/función/rango, reproducción, impacto y propuesta conservadora; mantener OFF la vía afectada y coordinarla sin reescribir contratos ni ampliar alcance.

## 13. Entrega, exclusiones y criterios de cierre

Entregar implementación local completa dentro de esta cohorte y PR DRAFT revisable con la publicación autorizada en la cabecera: commits selectivos propios, SHA/base/diff heredado vs delta propio, SDD/handoff completos, matriz de escritores/lectores/guardas, resultados y logs/hashes, UI revisada con límites, dependencias/rollout OFF y evidencia de que los SQL históricos/legacy protegidos no cambiaron. Conservar árbol/rama; liberar claim sólo al terminar la escritura conforme al runbook y coordinación. PR nueva se adjunta a la tarea con herramienta del app. Si cambia la base apilada, no mergear origin/main/retargetear por reflejo; coordinar base con Director.

Formato del handoff según skill/runbook: OBJETIVO ORIGINAL, COMPLETADO, VALIDACIÓN, COMMITS, PR / BRANCH, PENDIENTES DE ESTA TAREA, FUERA DE ALCANCE DETECTADO, HANDOFF AL DIRECTOR. Cada comprobación lleva PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE y SKIPs reales. SDD done sólo con todos sus criterios; local probado, PR, integración, release y prueba visible son estados distintos. Nunca declarar «4.2 completo», «listo en producción» o «limpieza global» por una receta verde con omisiones.

Fuera de alcance: backfill/purga/conversión C-/renumeración/historia o datos de prueba reales; modificar miembros anteriores/identidad/medidas o retirar/reasignar/dividir/reabrir/cancelar; FCL/terrestre/mezclas y recuperación de excepción/bodegaje no acordadas; certificar llegada física/desconsolidación; facturación 4.3, pre-factura/cargos/gates financieros 4.4, costing 4.6 y contabilidad/cuentas; cambiar motor/heurísticas/RBAC/ERP entero o política pública legacy; saneamiento de colisiones históricas; activar caller/flag POD v2, nueva captura PII/media o auditoría integral Despacho; cambios de BCV/0574 fuera de los tests asignados; main/merge/auto-merge/deploy/VPS/DB real/migraciones productivas/secretos/contactos externos/publicación de conocimiento compartido. Una solución financiera o histórica no se cuela como dependencia técnica de la formación.

**Regla de persistencia del Worker:** ejecutar autónomamente todo lo autorizado por su fase, corregir fallos propios hasta cumplir aceptación sin debilitar pruebas, conservar evidencia y coordinar turnos/decisiones con Director. No pedir a Sam permisos rutinarios ya cubiertos; no continuar con producción/irreversibles no autorizados. Un paquete parcial con estados/medidas/escaneo/cierre accesibles por bypass no satisface este encargo, aunque la confirmación inicial pase.


<!-- Fin del contenido íntegro de la activación Director sellada. -->

## COMPLETADO

- Leído/cotejado el encargo completo y sus seis hashes fuente congelados.
- Comprobados raíz/rama/HEAD/árbol y delta exclusivo de la reserva 4ea14d8a520f48cdfccb15db14e2d186b8aa9b3b.
- Guard y claim propios adquiridos. Contrato íntegro guardado antes de adoptar el stub.
- Stub SDD adoptado por cherry-pick exclusivo; nuevo commit 8059daadf723c0db9814bea92cbeee0fe5cc5b74, padre único D1. No se incorporó ascendencia main/reserva.
- SQL 0502 respaldado primero como stub SIN CUERPO DDL en dc8bc10688db013d8554ec5e748e0b2c0e8b9be9, con espera concreta en baseline; cutoff y esperas ajenas preservados. Ahora está en autoría parcial y conserva un fusible explícito que aborta su ejecución.
- Spec en progreso con contrato/50 rutas/oráculos íntegros y clasificación R3/P4; motivo humano por helper canónico, sin sustituir el límite propio 0496.
- Índice regenerado mediante herramienta nativa: 559 specs, 19 huecos; no se tomó ningún hueco ni se reservó otro número.
- PR #318 creada, publicada y adjuntada OPEN/DRAFT sobre la base exacta D1; el checkpoint inicial contiene cinco rutas propias y ninguna implementación funcional.
- Redactados tipos, normalización/validación pura, proyección exacta de centavos y lectores específicos que no presentan una página fallida/truncada como completa. Sus pruebas están redactadas y NO EJECUTADAS.
- Cuerpo parcial 0502: esquema privado y sin altas, contexto no falsificable por GUC, marcación prospectiva por reloj servidor, reserva sólo de códigos nuevos con mutex separado, guardas de identidad/medidas/cajas/eventos, binding vivo 0496, lector/manifiesto y RPC de formación/extensión/cierre. Es borrador sin validación, con composición/ACL/postflight restantes; no es SQL de release.
- Referencias concretas R3/P4/motivo/confirmación guardadas en la spec; no amplían autoridad ni alteran miembros anteriores.

## VALIDACIÓN

- Lectura y cotejo de integridad: PASÓ.
- Generación/validación proporcional del índice documental: PASÓ; no es validación de producto.
- Producto, pruebas, DB, tipos, lint amplio, build, verify, UI, conocimiento y producción: NO EJECUTADO.

## COMMITS

- 8059daadf723c0db9814bea92cbeee0fe5cc5b74: adopción exclusiva del stub SDD 0578, padre único D1.
- dc8bc10688db013d8554ec5e748e0b2c0e8b9be9: checkpoint temprano; spec/contrato, stub SQL y espera, índice generado. Pruebas aún NO EJECUTADAS.
- Checkpoint P1 de autoría: commit que contiene esta actualización; cuerpo parcial con fusible y primeros contratos/oráculos. No es aceptación funcional.

## PR / BRANCH

Rama `codex/sdd-0578-envios-cliente-camino-normal`, PR https://github.com/SoftAgentes/DTDCARGO/pull/318 OPEN/DRAFT, adjuntada a la tarea. Base `codex/sdd-0574-embarques-cierre` en D1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733`, cotejada al crearla. Publicación propia autorizada; no merge/retarget de base por reflejo.

## PENDIENTES DE ESTA TAREA

1. Completar lecturas normativas de marca/Norte/privacidad/conocimiento y políticas de UI aplicables; lecturas base de AGENTS/Worker/runbook/reglas/registro/SGE/MP/AUD-01/backend realizadas, sin dar por consultado lo pendiente.
2. Completar cuerpo SQL: escritores de estado/estiba/plan/POD y composición de funciones/ACL/preflight/postflight, invariantes diferidas y fixtures reales. Preservar el contrato y registrar evidencia por oráculo; quitar el fusible sólo con cuerpo completo revisable.
3. Adaptadores/UI/bulk/Portal dentro de las 50 rutas, fixtures/oráculos, commits y actualización de la PR DRAFT. Plan de relevo externo en `C:/tmp/director-traspaso-20261020/0578-normal-validation/plan-ejecucion-p1.md`.
4. Recibir turno explícito del Director antes de cualquier ejecución pesada; no heredar GO de otra tarea.

## FUERA DE ALCANCE DETECTADO

Ninguno nuevo; exclusiones del contrato preservadas. No absorbe BCV, 0573 ni pendientes de 0574.

## HANDOFF AL DIRECTOR

Trabajo EN PROGRESO, owner retenido. Enrolamiento OFF; código parcial escrito y NO PROBADO, SQL con fusible que aborta. No instalar/ejecutar ni activar aún. Este handoff no es cierre de producto ni de 4.2 completo.
