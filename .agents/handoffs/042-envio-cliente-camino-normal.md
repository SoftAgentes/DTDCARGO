# Handoff · SDD-0578 · Envíos por cliente, camino normal prospectivo

> Estado actual P1-67: superficie autoral67 redactada para revisión; PR318DRAFT/baseD1, SQL0502fusible/cohorteOFF, aceptación NO EJECUTADA. BCV GO05B conserva turno pesado. Ver checkpoint final y plan7ad04189; antecedentes fechados se conservan completos.

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

## ADDENDUM ADOPTADO — alcance acumulado de 52 rutas

Lectura íntegra y cotejo SHA256: 4d976df8afbe3a21538b66e582b65fa7f191b6dd2edcae20d8cf88d1666d853e. Se adopta sólo para autoría P1, sin turno runtime. Contrato1939 preservado arriba. Inicio del contenido íntegro:

# SDD-0578 — addendum Director: dos fixtures legacy, 52 rutas

21 de octubre de 2026. AUTORIZADO sólo para la autoría P1 vigente del mismo Worker, no para ejecución de producto. Este addendum sustituye únicamente el límite numérico 50 por la unión literal 52 de abajo y concreta la preservación del transporte legacy al adaptar dos fixtures. No concede otro turno, nueva capacidad de negocio, permiso ni excepción normativa.

Raíz `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal`, rama `codex/sdd-0578-envios-cliente-camino-normal`, owner `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468`; base D1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733`, PR318 DRAFT. Contrato original íntegro conservado: `042-activacion-worker-0578-director.md`, SHA256 `1939a04752338b66bc5187961f8a1a216093dc6101fdb28771bec2efae607be4`. Claim retenido y una sola sesión escritora. BCV conserva GO03 y el único turno pesado.

## Evidencia leída y decisión acotada

Director leyó completos ambos tests en D1 por objetos Git. `delete-receipts-action.test.ts`, blob `7ac012cd32b55f1f483adf4b7959ca56b52942b8`, simula sólo la RPC de borrado y exige una llamada global. También conserva el rollback de creación legacy con admin, id y tenant. `create-receipt-code.test.ts`, blob `a20ef0d2da05e13e96834b0f780d1b4d9b47b252`, exige código asignado por DB0469, ausencia de RPC de generación de código, transporte INSERT legacy y eventos/avisos reales; una variante exige cero RPC globales.

La guarda de pertenencia/roster y el intake prospectivo del contrato requieren reconocer el ámbito antes de la mutación y cerrar la carrera de alta/ítems. Se permite adaptar únicamente los dobles de esas dos rutas y sus expectativas de transporte a las nuevas lecturas/operación prevista; conservar íntegros los oráculos de dominio siguientes. Esta autorización no acepta la implementación todavía parcial ni acredita pruebas; SQL0502 mantiene su fusible mientras no esté completa.

1. Borrado: permisos/usuario desactivado/lote/motivo inválidos cortan antes de la nueva consulta de cohorte y de la RPC escritora. Admin válido puede consultar metadata completa; error/null/parcial no son permiso de borrar ni ausencia de cohorte. El borrado legacy sigue efectuando exactamente una RPC escritora con IDs deduplicados y motivo recortado, sin DML directo; mantener errores bilingües, blockers, conteos y revalidaciones. La pertenencia de cohorte se protege en DB y acción, sin convertir una nueva lectura en éxito implícito.
2. Captura prospectiva ON: la operación aprobada crea cabecera, ítems y evento received en una unidad con el actor CN/tenant/almacén validados y contexto privado verificable. Código sigue perteneciendo a DB0469, no al cliente ni a next_receipt_code/next_orphan_code. Fallo de ítem/evento no deja cabecera ni éxito parcial. No usar borrado compensatorio de una recepción que ya pueda ser miembro.
3. OFF conserva literalmente la ruta legacy de INSERT, ítems, rollback técnico por admin acotado a id+tenant y sus avisos/eventos/OV existentes. Una consulta/RPC prospectiva puede responder OFF explícito sin escribir; falta de schema/RPC, error o respuesta ilegible nunca se interpreta OFF. Las pruebas de transporte deben distinguir esa consulta prevista de una RPC prohibida de generación de código; no retirar los asserts del origen DB del código o el rollback legacy.
4. La guarda de nacimiento debe cerrar el cambio OFF→ON entre la lectura de ámbito y el INSERT anterior: si el contexto requerido no está presente, revierte ese INSERT completo y pide refrescar, sin cabecera huérfana. Esta decisión no habilita contexto por GUC libre, nuevo rol ni bypass de actor/tenant. Las versiones antiguas requieren MIGRATE-FIRST/caché y drain comprobado antes de ON; esa operación futura conserva su autorización y no se certifica por esta fixture.
5. Mantener tests originales aplicables de autorización, estados, errores, código, events y avisos; añadir casos concretos de los nuevos caminos en las rutas ya autorizadas. No eliminar assertions para sacar verde, volver genéricos los errores, alterar el doble compartido, scanner, gates, RBAC, políticas o tests ajenos. Ante dependencia nueva, evidencia y decisión antes de editar.

## Allowlist acumulada literal: 52 rutas únicas

```text
lib/studio/client-consolidation/types.ts
lib/studio/client-consolidation/queries.ts
lib/studio/client-consolidation/normal-flow.ts
app/studio/(app)/naviera/_components/ConfirmarEnviosClienteDrawer.tsx
app/studio/(app)/naviera/actions.ts
app/studio/(app)/naviera/page.tsx
app/studio/(app)/naviera/_components/NavieraClient.tsx
app/studio/(app)/naviera/plan-actions.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/page.tsx
app/studio/(app)/cn/_components/AlmacenCnClient.tsx
app/studio/(app)/cn/_components/ReceiptRowActions.tsx
app/studio/(app)/tracking/[id]/actions.ts
app/studio/(app)/tracking/[id]/page.tsx
app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx
app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx
app/studio/(app)/tracking/[id]/_components/FooterActions.tsx
app/api/studio/shipments/[id]/route.ts
app/api/studio/shipments/[id]/events/route.ts
app/studio/(app)/ve/actions.ts
app/studio/(app)/ve/_components/VeRowActions.tsx
app/m/cn/estibar/actions.ts
app/m/cn/estibar/_components/EstibaClient.tsx
lib/portal/portal-queries.ts
lib/studio/rate-snapshots/types.ts
lib/i18n/es-VE/warehouse.ts
lib/i18n/zh-CN/warehouse.ts
supabase/pending-migration-symbol-declarations.json
supabase/migrations-baseline.json
docs/specs/README.md
.agents/handoffs/042-envio-cliente-camino-normal.md
app/m/cn/estibar/[consolidationId]/page.tsx
docs/specs/0578-envios-cliente-camino-normal/spec.md
supabase/migrations/0502_consolidacion_cliente_camino_normal.sql
supabase/tests/consolidacion_cliente_normal.test.sql
supabase/tests/_consolidacion_cliente_normal_schema.sql
lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts
scripts/check-client-consolidation-concurrency.mjs
app/studio/(app)/naviera/__tests__/envios-cliente-actions.test.ts
app/studio/(app)/naviera/_components/__tests__/ConfirmarEnviosClienteDrawer.test.tsx
app/studio/(app)/cn/__tests__/consolidacion-cohorte.test.ts
app/studio/(app)/naviera/__tests__/plan-carga-cohorte.test.ts
app/studio/(app)/tracking/[id]/__tests__/cohorte-normal-actions.test.ts
app/api/studio/shipments/[id]/__tests__/cohorte-normal.test.ts
app/m/cn/estibar/__tests__/cohorte-pertenencia.test.ts
app/studio/(app)/ve/__tests__/cohorte-normal.test.ts
lib/portal/__tests__/envios-cohorte.test.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts
e2e/consolidacion-clientes-camino-normal.spec.ts
app/studio/(app)/cn/__tests__/delete-receipts-action.test.ts
app/studio/(app)/cn/__tests__/create-receipt-code.test.ts
```

## Adopción y fronteras que continúan

Guardar íntegros este addendum y su hash en el handoff propio antes de editar las dos rutas nuevas; actualizar spec/allowlist a52 y registrar el delta de transporte con su SHA. Commits selectivos, push propio y el mismo PR318 DRAFT siguen autorizados. No nueva PR de alcance diferente ni edición del árbol de0574/BCV.

Durante P1 sólo autoría y comprobaciones ligeras de Git/harness/docs permitidas por el contrato. No instalar ni ejecutar Vitest/SQL/DB/Docker/tipos/lint amplio/browser/build/verify/conocimiento hasta transferencia expresa del Director; la canónica necesita además checkpoint revisado y GO propio. Una prueba redactada no es ejecutada ni aceptación.

No main, merge, deploy, VPS, DB real, PII/secretos, cuentas/pagos, contactos, historia o facturación4.3. Cohorte prospectiva OFF; no activar ámbito/caller.0495 no se edita ni repite y0496/0502 no se aplican. No nueva política ni autoridad humana. El resto del contrato1939 permanece íntegro y vigente.
<!-- Fin del addendum Director íntegro. -->

## CHECKPOINT P1 — CN, roster y composición en autoría

Alcance acumulado: las 52 rutas literales del addendum anterior. Claim propio retenido; publicación propia sigue autorizada en PR318 DRAFT. No ejecución de producto ni turno pesado heredado.

- CN individual/bulk/borrado consulta pertenencia antes de C-/OV/efectos. Un lote mixto corta entero. La tabla general sigue siendo una vista acotada; sus metadatos no se presentan como el universo de formación. UI diferencia cohorte y prerrequisito no disponible, conserva las acciones de pago/verificación vigentes y dirige a Naviera según permiso real.
- Transporte de creación: `client_consolidation_intake` sólo escribe en ámbito ON; cabecera, ítems, `received` y auditoría se redactaron en una transacción. OFF devuelve sólo una clasificación y conserva el bloque legacy de INSERT, ítems, rollback técnico admin por id+tenant y avisos/OV. Se mantiene DB0469 como asignador WR-/SIN-CODIGO-. Falta/error/respuesta ilegible no degrada a OFF. Una activación entre OFF e INSERT rechaza ese INSERT por falta del contexto privado de nacimiento. Este corte sigue necesitando el gate futuro de schema/caché/callers/drain, no demostrado aquí.
- Roster: editores legítimos adquieren la recepción antes de sus cajas; el contexto privado de edición/nacimiento no autoriza alterar miembros. La composición de 0449 adopta las cajas exactas de una recepción NUEVA, sin tocar otra tanda. Los snapshots conservan recepción→snapshot y asociación viva compatible derivada; ningún lock posterior de grupo/contenedor en el binding tardío.
- Estiba/plan: autores de caja/lote/deshacer serializan por contenedor; la rama de cohorte valida el conjunto intentado completo, no un subconjunto filtrado. La corrección física conserva historia y el mismo contenedor abierto. Anotación de plan separada por revisión; fallo de traza no permite repetir estiba efectiva. Lecturas/catálogo específicos completos sustituyen caps/fallbacks sólo en la rama nueva. El catálogo correcto es `dispatch_city_catalog`, el usado por CN; ID activo y ciudad canónica se conservan separados de la etiqueta de selección.
- Estados: se redactaron wrappers que preservan cuerpos base comprobados de 0477/0484/0486/0487, sus roles y gates. Tránsito ratificado sigue Tracking, llegada operativa VE no acredita ingreso físico ni documentos SENIAT. La firma legacy de entrega manual no puede atestar una cohorte no vista; la nueva RPC compara sello/revisiones/lista completa con motivo/referencia. La composición de POD global y su replay parcial, Portal/RLS, ACL/postflight, interfaces y las pruebas reales aún están pendientes.
- Aislamiento RR/concurrencia: el contenedor público recibe un cambio técnico de tuple al cambiar pertenencia para que un writer con snapshot previo no omita la marca privada tras esperar; guardas equivalentes participan en locks de padres. Esto es diseño escrito, sin prueba de dos sesiones todavía. Un deadlock/40001 no contará como carrera positiva probada.
- Huellas LF de cuerpos originales leídos: 0045 `f9e61f3ae50fca3f4752d61fb1d20f86`; 0449 `bf85211ecef554d573b9670d6011af37`; 0072 + casts0296 `b0839c00d60dbeecf7e98c4c281f9fdc`; 0241 stuff/unstuff `74c9486fd9b9b6a175f9bd521a61ba3a` / `ccfe127d2b3ec1b3edd255728878c0c6`; 0246 stuff/unstuff `77b5e161cc1c81a527fd03dc9693b6d0` / `33554f0c1794aa185f7c2a2d3f9965f4`; 0477 `95d1f9971f13ea798173eca51ef962ef`; 0484 `04d5cf691b31bfa0fc3976b6a143b46b`; 0486 `8f72f0e10f86b079b2cb345289f02ee5`; 0487 `651252cda7e8354058ecb83b8cc0e324`. 0502 conserva fuente histórica intacta y rechaza otro cuerpo. La restauración de ACL usa el contrato efectivo comprobado, incluida reparación0288; no se deduce autoridad de comentarios antiguos.
- Dos fixtures legacy adaptados únicamente tras adoptar el addendum íntegro. Se conservan pruebas de permiso antes de RPC, una única RPC escritora de borrado, generación DB0469 y ausencia de numeradores, rollback literal OFF y eventos/avisos. Casos nuevos de transporte ON y falta de prerrequisito están redactados; no son prueba SQL de rollback.

SQL0502 conserva el fusible que aborta antes de DDL. Estado de Vitest/SQL/DB/2 sesiones/tipos/lint/build/verify/browser/conocimiento/producción: **NO EJECUTADO**. El checkpoint es autoría parcial respaldada, sin aceptación funcional ni cierre de 4.2.


## Adopción Worker P1 — addendum acumulado55

Leído íntegramente y cotejado por SHA256 `8dd76b80bb2de54580d69b6a6b43c12a65d983177d8fd47c9b52f39348eec69b` antes de editar las tres fixtures añadidas. Autoriza únicamente autoría P1 en 55 rutas; contratos 1939a047/4d976df8 intactos. Owner/raíz/rama y claim comprobados con guard. SQL0502 conserva fusible, cohorte OFF, BCV mantiene GO03. Pruebas y validación funcional: NO EJECUTADO.

<!-- ADDENDUM55 DIRECTOR ÍNTEGRO INICIO -->
# SDD-0578 — addendum Director: tres fixtures Naviera, 55 rutas

21 de octubre de 2026. AUTORIZADO por Director sólo para autoría P1 del Worker vigente. Sustituye exclusivamente el límite acumulado52 por la unión literal55 de abajo. No concede ejecución de producto, turno pesado, nuevo permiso de negocio ni excepción normativa. SQL0502 conserva su fusible hasta implementación completa.

Raíz `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal`; rama `codex/sdd-0578-envios-cliente-camino-normal`; owner `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468`; baseD1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733`; misma PR318 DRAFT y claim retenido. BCV conserva GO03/turno pesado; este addendum no lo transfiere.

Se preservan íntegros `042-activacion-worker-0578-director.md`, SHA256 `1939a04752338b66bc5187961f8a1a216093dc6101fdb28771bec2efae607be4`, y `042-addendum-director-0578-52-rutas-tests-legacy.md`, SHA256 `4d976df8afbe3a21538b66e582b65fa7f191b6dd2edcae20d8cf88d1666d853e`. No reescribirlos ni ampliar otras rutas por comodidad.

## Evidencia y decisión concreta

Director leyó completa la nota independiente `0578-revision-fixtures-naviera-55-rutas-peer.md`, SHA256 `2f9051654fcca5c672d3803e7f3a3b8ef59f7ae937513cd1dc152ce762f27b8c`. El revisor leyó completas las tres fixtures por objetosD1; Director no atribuye a sí mismo esa lectura íntegra ni ejecución de pruebas. La necesidad es adaptación de preparación a metadata nueva explícita; no hay fallo funcional reproducido todavía.

| Ruta añadida | BlobD1 / cobertura leída por el revisor |
| --- | --- |
| `app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts` | `f4bd1cd26449edb9b8508df4eadd5c60f06ae2e5`,1–378 |
| `app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx` | `94d0740a512a1b5998d08a801a8b8f01bde27304`,1–268 |
| `app/studio/(app)/naviera/_components/__tests__/NavieraClient.avance.test.tsx` | `c1aa125f9d2a0db66852ff4142445d7267f0fa1a`,1–153 |

Se permite adaptar exclusivamente sus dobles/props de metadata y las expectativas estrictas de lecturas nuevas previstas; no editar producto por estas tres rutas, dobles compartidos, permisos o gates para acomodarlas. Conservar los oráculos siguientes:

1. **Zarpe/arribo:** misma RPC escritora y argumentos, estados/already/saltos, pieza sin envío, avisos exactos por tenant, conteo realmente programado, permisos Naviera/Tracking y errores42501/P0002/PGRST202/ilegible sin fan-out. Cierrelegacy no exige Tracking ni llama la RPC de avance y conserva aviso consolidated. El cliente mínimo del casoTracking también declara su metadata. Separar contador de lecturas del contador de escrituras; una consulta nueva no permite cambiar una sola RPC escritora por conteo laxo. Se puede precisar el título «sin RPC de avance» conservando el oráculo.
2. **PrivacidadCN:** página/acción/redacción reales, nombres nominales sintéticos y colisión de marca de otrotenant se conservan. Examinar todas las props, incluida metadata nueva: cero nombres paraCN, ShippingMark y avisos redactados; VE conserva nombre/plan/bandera. AsignaciónCN deriva nombre del envío correcto o marca del mismotenant y guardaNULL si no lo conoce, nunca el nombre del browser. No vaciar fuentes ni reemplazar funciones reales por un éxito prefabricado. DrawerCN conserva ausencia de Cliente y explicación; VE conserva campo.
3. **NavieraClient:** DTO real de lectura legacy exitosa/completa para identidad/ámbito correcto y mantenido al rerender. Conservar dos envíos distintos pese a piezas repetidas, pieza sin envío, diálogo antes del efecto, cero llamadas previas, una sola llamada con el contenedor y estado esperados, resumen persistente y botón de siguiente avance. Error de permiso permanece en diálogo sin resumen de éxito; no alterar respuesta preparada o introducir casts/bypasses para sortear guardas.
4. **Frontera negativa obligatoria:** error/schema ausente, null/shape ilegible, incompletitud/ID omitido o tenant ajeno no habilitan legacy/OFF ni mutación/avisos de éxito. Probar la frontera efectiva en las pruebas de cohorte ya autorizadas o en estas fixtures; la UI conserva explicación visible sin drawerlegacy de fallback. OFF de altas nuevas no retira miembros ya enrolados ni convierte cohorte enlegacy. No inventar firma de DTO/RPC; usar la implementación revisable porSHA, sin aprobarla por este documento.
5. Antes de aceptar el delta, cotejar preparación/metadata exactas y conservación de oráculos. Todas las pruebas nuevas/adaptadas y runtime siguen NO EJECUTADOS hasta su turno y recibos. Este addendum no acredita layout, A11Y, navegador, SQL o funcionamiento.

## Allowlist acumulada literal:55 rutas únicas

```text
lib/studio/client-consolidation/types.ts
lib/studio/client-consolidation/queries.ts
lib/studio/client-consolidation/normal-flow.ts
app/studio/(app)/naviera/_components/ConfirmarEnviosClienteDrawer.tsx
app/studio/(app)/naviera/actions.ts
app/studio/(app)/naviera/page.tsx
app/studio/(app)/naviera/_components/NavieraClient.tsx
app/studio/(app)/naviera/plan-actions.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/page.tsx
app/studio/(app)/cn/_components/AlmacenCnClient.tsx
app/studio/(app)/cn/_components/ReceiptRowActions.tsx
app/studio/(app)/tracking/[id]/actions.ts
app/studio/(app)/tracking/[id]/page.tsx
app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx
app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx
app/studio/(app)/tracking/[id]/_components/FooterActions.tsx
app/api/studio/shipments/[id]/route.ts
app/api/studio/shipments/[id]/events/route.ts
app/studio/(app)/ve/actions.ts
app/studio/(app)/ve/_components/VeRowActions.tsx
app/m/cn/estibar/actions.ts
app/m/cn/estibar/_components/EstibaClient.tsx
lib/portal/portal-queries.ts
lib/studio/rate-snapshots/types.ts
lib/i18n/es-VE/warehouse.ts
lib/i18n/zh-CN/warehouse.ts
supabase/pending-migration-symbol-declarations.json
supabase/migrations-baseline.json
docs/specs/README.md
.agents/handoffs/042-envio-cliente-camino-normal.md
app/m/cn/estibar/[consolidationId]/page.tsx
docs/specs/0578-envios-cliente-camino-normal/spec.md
supabase/migrations/0502_consolidacion_cliente_camino_normal.sql
supabase/tests/consolidacion_cliente_normal.test.sql
supabase/tests/_consolidacion_cliente_normal_schema.sql
lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts
scripts/check-client-consolidation-concurrency.mjs
app/studio/(app)/naviera/__tests__/envios-cliente-actions.test.ts
app/studio/(app)/naviera/_components/__tests__/ConfirmarEnviosClienteDrawer.test.tsx
app/studio/(app)/cn/__tests__/consolidacion-cohorte.test.ts
app/studio/(app)/naviera/__tests__/plan-carga-cohorte.test.ts
app/studio/(app)/tracking/[id]/__tests__/cohorte-normal-actions.test.ts
app/api/studio/shipments/[id]/__tests__/cohorte-normal.test.ts
app/m/cn/estibar/__tests__/cohorte-pertenencia.test.ts
app/studio/(app)/ve/__tests__/cohorte-normal.test.ts
lib/portal/__tests__/envios-cohorte.test.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts
e2e/consolidacion-clientes-camino-normal.spec.ts
app/studio/(app)/cn/__tests__/delete-receipts-action.test.ts
app/studio/(app)/cn/__tests__/create-receipt-code.test.ts
app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts
app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx
app/studio/(app)/naviera/_components/__tests__/NavieraClient.avance.test.tsx
```

## Adopción y límites

Leer completo/cotejar hash y guardar adopción íntegra+hash en handoff/spec antes de editar las tres rutas añadidas. Conservar ownership, SDD0578 y SQL0502. Commits selectivos y push al mismo DRAFT autorizados; no git add-A ni cambio de base/main/árbol ajeno. El resto del contrato y addendum52 permanece vigente.

Sin instalación, tests, tipos, lint amplio, DB/Docker, navegador, verify/build o conocimiento por este addendum. Sin main/merge/deploy/VPS/DBreal/PII/secretos/pagos/contactos/publicación compartida.0495 no se edita ni reaplica;0496/0502 no se aplican. CohorteOFF, sin historia/facturación4.3 ni caller/flagPODv2. Ninguna autorización nueva de actor/tenant o política global.

<!-- ADDENDUM55 DIRECTOR ÍNTEGRO FIN -->

## Checkpoint P1 — Naviera, cobertura explícita y límite POD A14

Autoría adicional sobre `930e93ea87eeafc05dde7cdea0b44a572f29d190`, todavía sin ejecución de producto. La allowlist acumulada vigente es 55, con addendum íntegro y hash arriba. Las tres fixtures Naviera se adaptan sólo en preparación de metadata explícita y nuevas lecturas; sus oráculos de avance, errores, permisos, avisos, privacidad, diálogo y resumen permanecen. No se modifican dobles compartidos.

Naviera: el drawer nuevo prepara selección por cliente o extensión de un único grupo; muestra manual S-, servicio/destino, fuentes/versiones, sumas fijas antes+delta+después y subtotal conocido/total pendiente. Sólo la confirmación final envía una intención durable; motivo/referencia/revisión se conservan ante error incierto y el bloqueo síncrono impide dos envíos simultáneos. El cierre revisa cobertura completa y sella, sin inferir estado de shipment. El plan usa entrada completa y versión máxima histórica, con replay de la referencia propia antes de derivar otra intención. La vista general limitada no se usa como prueba de pertenencia/cobertura de cohorte.

La RPC de scope debe validar existencia y tenant de TODOS los IDs, rechazar nulos/duplicados/ajenos y devolver `complete:true` más `checked` exacto. El decoder compara conjuntos exactos y prohíbe cohortes fuera de checked. Un subconjunto cohorte vacío sólo habilita legacy después de esa cobertura explícita. Naviera requiere checked del contenedor concreto. Error, schema ausente, null, omisión, extra o incompletitud no equivalen a legacy/OFF ni generan aviso de éxito. Metadata no concede permisos; los writers conservan autoridad propia. OFF de altas no elimina marcas existentes. El lector de shipment verifica también su ID aunque `cohort:false`; el lector de manifiesto verifica el contenedor solicitado. La página minimiza nombres en metadata nueva con la redacción existente, además de la minimización DB.

Para el camino normal, una asignación OD temprana de miembros previos impide seguir agregando o sellar ese manifiesto: queda fuera de los predecesores de esta vía y no se repara historia. Esa detección no revierte ni impide por sí misma una captura parcial válida. Tipo de contenedor queda fijo para conservar coherencia del plan; número físico mantiene su acción vigente. Son guardas de este protocolo prospectivo, no reglas globales sobre legacy.

### Ratificación Director de POD: alcance A14

Lectura aplicable conservada: `0024_dispatch_core.sql` filas 421–445: OD×receipt almacena boxes_total/boxes_shipped y motivo de fracción, no IDs físicos por fracción. `0072_fix_audit_entity_type.sql` función `operario_action`, rama partial_delivery 275–353: estado por fila, autoridad VE camionero/supervisor y OD en_ruta/entregada. `0336_pod_closes_shipment.sql`, `camionero_pod_v2` 48–296: captura POD y cierre calculado sólo dentro de la OD; MD5 normalizado de su cuerpo `52fedc4c33bc71b1483e7fb4192b4940`. `0300_pod_seal.sql` 1–238: evidencia sellada, hash y guardas append-only. El v1/caller/flag no se activa ni sustituye por este slice.

Director acepta para P1 una guarda conservadora de cierre automático: sumar boxes_shipped de fracciones o duplicados de una recepción no acredita identidad no superpuesta de todas las cajas del sello. Una cobertura no unívoca conserva el POD parcial válido y su captura, con señal pendiente, sin cerrar automáticamente. No es una política global aprobada ni prueba de aceptación A14.

Oráculo positivo requerido: miembros distintos en varias ODs; cada recepción aparece completa y única en el conjunto, cantidades coinciden con su roster fijo, todas las filas tienen estado entregado y evidencias POD selladas/válidas; sólo el último POD completo cierra una vez, con evento/hora/AUD atómicos y replay histórico. Oráculos negativos: miembro faltante, fracción o recepción duplicada aunque las sumas coincidan, estado pendiente/rechazado/retornado, POD faltante/ilegible/hash inválido, OD ajena o referencias incompatibles no acreditan cierre. Los casos de cobertura dudosa no deshacen una captura POD válida. Fallo real de evento/AUD de un cierre elegible revierte el cierre y sus efectos de esa transacción. Vía manual 0487 permanece separada, con autoridad actual y atestación explícita del grupo sellado completo; no se le exige inventar POD ni hecho físico no acreditado.

Pendientes de esta tarea: composición efectiva POD/ACL, Portal/RLS, Tracking/API/VE y móvil, fixtures SQL/concurrencia y aceptación completa. Todos los tests nuevos/adaptados, SQL, DB, tipos, lint amplio, navegador/A11Y, build/verify y conocimiento siguen NO EJECUTADOS. SQL0502 mantiene fusible que aborta antes del DDL; rollout/cohorte OFF. No cierre de 4.2, integración, migración, producción o comprobación semántica.
## Checkpoint P1 — composición POD y escapes Tracking/API redactados

Sobre d39aa7c40956a23499a694729ee4c804d7d07cfa continúa autoría parcial, sin aceptación funcional. Se corrigió en la sección propia anterior el nombre de la función0336: es `public.camionero_pod_v2(uuid,uuid,uuid,text,text,text,text,text,text,numeric,numeric,numeric,text)`. Su cuerpo normalizado se volvió a cotejar por MD5 nativo `52fedc4c33bc71b1483e7fb4192b4940`; no se ejecutó SQL. No se alteran contratos congelados ni SQL histórico.

0502 redacta el desplazamiento de ese cuerpo conservando firma/ACL para postflight: una inyección exacta omite sólo su cierre limitado a OD para grupos nuevos; validaciones, captura y cierre legacy permanecen en el cuerpo fuente. Wrapper nuevo propone cobertura global del sello por receipt completo/único, estado y POD sellado/hash vigente, con señal `normal_pending` para evidencia dudosa. Replay propio guarda sólo hash de solicitud/vector observado/resultado y devuelve incluso la captura parcial antigua sin cerrarla después por accidente. No copia PII cruda a ese ledger ni activa v2/caller/flag.

Se redactaron serialización/fence por contenedor y guardas de DOP/cohorte: el status por paquete se escribe a través de la rama vigente0072 y contexto privado; campos de identidad/cantidad de entregas ya cerradas no se convierten en una vía de historia. DOP fraccionado/duplicado sigue pudiendo capturarse cuando su writer actual lo permite, pero no se interpreta como cobertura unívoca para el cierre. El v1 conserva cuerpo/ACL/caller y no cierra; un trigger de cohorte ordena locks y fija su hora antes del sello0300 sin exigir manifiesto completo o sello para guardar un POD parcial válido. Estados y autoridad actual de OD/operario siguen en originales. Cancelación de OD o revisión histórica no obtiene una nueva autoridad por esta composición. Locks tardíos equivalentes pueden abortar por conflicto/deadlock y no cuentan como prueba positiva. Concurrencia real pendiente.

Tracking/API: guardas de protocolo antes de campos/plan/cancelación/borrado/destino/estado/evento genéricos. Cohorte se resuelve antes del hint TS global, preservando TMS last_mile. Tránsito manual ratificado y nota del estado actual usan RPC atómica con estado/revisiones/motivo/referencia; notas no aceptan hora retroactiva ni crean hitos. Sólo un tránsito efectivo usa su aviso vigente; replay no lo repite y fallo de avisos posterior al commit queda como warning. API separa lectura scope de writer y niega atajos con409 o metadata desconocida con503. El replay tipado conserva lectura actual como autoridad, mientras el writer DB conserva permisos propios. No UPDATE+evento/compensación para cohorte.

UI Tracking redactada: datos derivados y pertenencia/revisiones/tarifa observada como lectura; sólo hito ratificado/notas actuales y enlaces a operaciones existentes; sin controles genéricos de cancelación/edición de identidad, excepción/retorno o planificación fuera del protocolo. Completitud/ID explícitos: ausencia, parcialidad o ID ajeno no abren legacy. El historial reciente se presenta como vista acotada y no como prueba completa. Legacy sigue en sus componentes actuales cuando la lectura conocida lo acredita. No se afirma revisión visible/A11Y/runtime.

Tests nuevos de adaptadores Tracking/API redactados dentro43/44. Las tres fixtures adicionales propuestas en `0578-propuesta-fixtures-tracking-api-58.md`, SHA256 dde0404abe9aa75358f38450d02c19d2f57a084c9274280eec6ec76b1a842fb1, fueron leídas completas pero NO editadas ni incluidas en allowlist55. Esperan addendum; no se adapta un doble compartido ni se debilita producto para acomodarlas.

Pendientes propios: Portal/RLS, VE, móvil, ACL/pre/postflight completo, fixture SQL/concurrencia/e2e y toda ejecución. SQL0502 con fusible antes de DDL; cohorte/rollout OFF; claim retenido. Todas las verificaciones de producto/SQL, tipos/lint amplio, browser/UI/A11Y, build/verify y conocimiento NO EJECUTADO. La autoría no cierra4.2 ni autoriza merge, migración o producción.

## Adopción Worker P1 — addendum acumulado58

Leído íntegramente y cotejado SHA256 `557b81d02d9307cc128e4b515f910b74fb9c863c4db899aee49656e1b3957bf3` antes de editar las tres fixtures Tracking/API añadidas. Se conserva contrato1939 y addendums52/55 íntegros. Sin concesión runtime, permisos o política. Misma raíz/rama/D1/owner/PR318; claim retenido, SQL0502 con fusible y cohorte OFF.

<!-- ADDENDUM58 DIRECTOR ÍNTEGRO INICIO -->
# SDD-0578 — addendum Director: fixtures Tracking/API, 58 rutas

21 de octubre de 2026. AUTORIZADO sólo para autoría P1 del Worker vigente. Sustituye exclusivamente el límite acumulado55 por la unión literal58. Añade tres fixtures existentes para compatibilidad con metadata/lectura de ámbito explícitas. No amplía producto, permisos, políticas o runtime. SQL0502 conserva su fusible y cohorteOFF hasta implementación y aceptación completas.

Misma raíz `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal`, rama `codex/sdd-0578-envios-cliente-camino-normal`, owner `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, baseD1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733`, PR318 DRAFT y claim retenido. BCV prepara su comprobación general; este addendum no transfiere turno ni concede ejecución.

Conservar inmutables los contratos anteriores: `042-activacion-worker-0578-director.md`, SHA256 `1939a04752338b66bc5187961f8a1a216093dc6101fdb28771bec2efae607be4`; addendum52 `4d976df8afbe3a21538b66e582b65fa7f191b6dd2edcae20d8cf88d1666d853e`; addendum55 `8dd76b80bb2de54580d69b6a6b43c12a65d983177d8fd47c9b52f39348eec69b`. Todos sus límites/oráculos siguen vigentes.

## Evidencia revisada y decisión

Director leyó completas la propuesta `0578-propuesta-fixtures-tracking-api-58.md`, SHA256 `dde0404abe9aa75358f38450d02c19d2f57a084c9274280eec6ec76b1a842fb1`, y la revisión independiente `0578-revision-fixtures-tracking-api-58-peer.md`, SHA256 `7dc4027954273f49597b351b25a2d4d29959b42698076d615b8f8cabadbd5ad6`. El revisor leyó las447líneas de los tres archivos por objetosD1 y cotejó sus blobs; Director atribuye esa lectura al revisor, sin afirmar ejecución o lectura propia íntegra de los tres. La necesidad es inferencia de las interfaces nuevas, no fallo funcional reproducido.

| Ruta añadida literal | BlobD1 / lectura independiente |
|---|---|
| `app/studio/(app)/tracking/[id]/__tests__/datos-reservados-actions.test.tsx` | `2e2896f7a8614f4d9f57e90d9bef0c7229f66b4f`,1–190 |
| `app/studio/(app)/tracking/[id]/_components/__tests__/FooterActions.borrado.test.tsx` | `164a7c2e754e7688e5e1f4e28195b8d22238c8ad`,1–131 |
| `app/api/studio/shipments/[id]/events/__tests__/module-gate.test.ts` | `a91d82bd6378fb82e1c53a0bf08f21b09ca797b5`,1–126 |

1. **Datos reservados:** preparar sólo las dos instancias reales de ShipmentDataPanel con el DTO completo/legacy del mismo s1, conservando tenant t1 y servicio transporte_terrestre de la fixture. No mockear su decisión o la acción. Mantener selección del envío correcto frente a otro primero, GPS del servidor, rechazo del GPS del navegador, GPS ausente sin inventar, permisos antes de lecturas/delegación, envío ausente y puerta CN/VE real. No agregar casts/bypasses o cambiar servicio/estado para mostrar formulario. El mock de updateShipment observa delegación, no prueba SQL/RLS/persistencia.
2. **FooterActions:** metadata completa de shp-1 en cada instancia, incluido bloquear(). Mantener permisos de Eliminar/Cancelar legacy, código exacto, motivo3inválido/4habilitado, consecuencia legible sin tecnicismos, dependencia visible, asistente ausente si no bloqueado y asistente real cuando corresponde. Conservar cierre del primer modal, calcularPlan real, segundo diálogo, vuelta aTracking y aviso único con eventKey/mensaje. El caso existente escribe código correcto; no afirmar que ya prueba el negativo de código incorrecto. Metadata nunca concede borrado/cancelación de cohorte ni amplía canDelete.
3. **API events:** doblar exclusivamente client_consolidation_scope para s-1/t-1 con args y respuesta completa/checked exactos, aparte del registro de dominio. Mantener get_user_tenant_id, auth y moduleEditDenial real. Support403 y membershipausente403 antes de dominio/nueva lectura; inválido400 antes de efectos. Positivooperations201 llega a shipments:select y shipment_events:insert de la ruta real; no mock de éxito o guard. RPC no reconocida no recibe fallbacklegacy. El doble registra operaciones y no filtra eq/is ni persiste: no acredita UPDATE/RLS real.
4. **Frontera negativa:** null/error/schema ausente/shape ilegible/incompleto, IDs omitidos/extra/duplicados/ajenos o cohorte fuera dechecked nunca habilitan legacy/OFF o éxito. OFF de nuevas altas no retira pertenencia ya enrolada. Los negativos efectivos pueden estar en pruebas de cohorte ya allowlisted, con referencias concretas al handoff. No fallback vacío, metadata opcional, dobles compartidos/gates/permissions/SQL tests ajenos ni reducción de asserts. UI con metadata fallida conserva explicación y no controles genéricos de fallback.
5. Usar DTO/RPC reales del futuro SHA congelado, sin dar por aprobadas firmas de código mutable. Antes de aceptar el delta se cotejan preparación y oráculos conservados. Ningún test/readscope dobla autoridad de actor/tenant. La fixture VE actions-auth no se añade ni edita por este documento.

## Allowlist acumulada literal:58 rutas únicas

```text
lib/studio/client-consolidation/types.ts
lib/studio/client-consolidation/queries.ts
lib/studio/client-consolidation/normal-flow.ts
app/studio/(app)/naviera/_components/ConfirmarEnviosClienteDrawer.tsx
app/studio/(app)/naviera/actions.ts
app/studio/(app)/naviera/page.tsx
app/studio/(app)/naviera/_components/NavieraClient.tsx
app/studio/(app)/naviera/plan-actions.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/page.tsx
app/studio/(app)/cn/_components/AlmacenCnClient.tsx
app/studio/(app)/cn/_components/ReceiptRowActions.tsx
app/studio/(app)/tracking/[id]/actions.ts
app/studio/(app)/tracking/[id]/page.tsx
app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx
app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx
app/studio/(app)/tracking/[id]/_components/FooterActions.tsx
app/api/studio/shipments/[id]/route.ts
app/api/studio/shipments/[id]/events/route.ts
app/studio/(app)/ve/actions.ts
app/studio/(app)/ve/_components/VeRowActions.tsx
app/m/cn/estibar/actions.ts
app/m/cn/estibar/_components/EstibaClient.tsx
lib/portal/portal-queries.ts
lib/studio/rate-snapshots/types.ts
lib/i18n/es-VE/warehouse.ts
lib/i18n/zh-CN/warehouse.ts
supabase/pending-migration-symbol-declarations.json
supabase/migrations-baseline.json
docs/specs/README.md
.agents/handoffs/042-envio-cliente-camino-normal.md
app/m/cn/estibar/[consolidationId]/page.tsx
docs/specs/0578-envios-cliente-camino-normal/spec.md
supabase/migrations/0502_consolidacion_cliente_camino_normal.sql
supabase/tests/consolidacion_cliente_normal.test.sql
supabase/tests/_consolidacion_cliente_normal_schema.sql
lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts
scripts/check-client-consolidation-concurrency.mjs
app/studio/(app)/naviera/__tests__/envios-cliente-actions.test.ts
app/studio/(app)/naviera/_components/__tests__/ConfirmarEnviosClienteDrawer.test.tsx
app/studio/(app)/cn/__tests__/consolidacion-cohorte.test.ts
app/studio/(app)/naviera/__tests__/plan-carga-cohorte.test.ts
app/studio/(app)/tracking/[id]/__tests__/cohorte-normal-actions.test.ts
app/api/studio/shipments/[id]/__tests__/cohorte-normal.test.ts
app/m/cn/estibar/__tests__/cohorte-pertenencia.test.ts
app/studio/(app)/ve/__tests__/cohorte-normal.test.ts
lib/portal/__tests__/envios-cohorte.test.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts
e2e/consolidacion-clientes-camino-normal.spec.ts
app/studio/(app)/cn/__tests__/delete-receipts-action.test.ts
app/studio/(app)/cn/__tests__/create-receipt-code.test.ts
app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts
app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx
app/studio/(app)/naviera/_components/__tests__/NavieraClient.avance.test.tsx
app/studio/(app)/tracking/[id]/__tests__/datos-reservados-actions.test.tsx
app/studio/(app)/tracking/[id]/_components/__tests__/FooterActions.borrado.test.tsx
app/api/studio/shipments/[id]/events/__tests__/module-gate.test.ts
```

## Adopción y fronteras

Leer completo y cotejar hash; guardar adopción íntegra+hash en handoff/spec ANTES de editar estas tres rutas. Un único Worker escritor, mismo SDD/SQL/claim, commits selectivos y push al mismo DRAFT autorizados. Sin add-A, nueva base, main, árbol ajeno, reescritura de contratos o trabajo histórico.

Sin instalar/compilar/ejecutar tests, tipos, lint amplio, Node de producto, SQL/DB/Docker, HTTP, navegador, verify/build o conocimiento por este addendum. Sin main/merge/deploy/VPS/DBreal/PII/secretos/pagos/contactos/publicación compartida.0495 no se modifica/reaplica;0496/0501/0502 sin aplicar. CohorteOFF; no facturación4.3/historia/caller o flagPODv2. No nueva política global, permiso o afirmación funcional. El paso runtime requiere su propio turno y plan concreto; preservar preparación previa y comprobar porSHA al cierre.

<!-- ADDENDUM58 DIRECTOR ÍNTEGRO FIN -->

## P1 · propuesta técnica Portal y dependencias de fixtures (sin aceptación)

Tras reanudar en45fe con guard/owner vigentes, se conserva WIP SQL y se redacta lectura Portal dentro24/34. Referencia externa íntegra `C:/tmp/director-traspaso-20261020/0578-propuesta-portal-y-fixtures-64.md`, SHA256 `8c22a256030f55eb6567bc87237445114ab1a75b6271defeb14b60e81e881795`. Seis fixtures fuera58 permanecen SIN EDITAR hasta addendum Director. La nota registra sus blobsD1/rangos íntegros y oráculos, sin resultados runtime.

Hecho vigente:0416 conserva policies Portal permisivas junto a by-tenant Studio. Principal Portal vivo/coherente de client_users+clients y tenant activo Studio son identidades distintas; la sesión híbrida conserva derechos de equipo actuales. Propuesta: RPC `client_consolidation_portal_read()` sin autoridad browser, snapshot propio completo con tenant/client_id para cohorte y tenant/marca para legacy. App coteja principal, complete, fecha, shape e IDs; no fallback de error/null/parcial a vacío/legacy. Se retienen todos los grupos propios frente a ventanas100/50legacy. Documentos autorizan padre antes de lectura y conservan marca documental legacy; su ventana200 no acredita cobertura documental completa. No se cambia autoridad/filtros de facturas/cotizaciones; sólo códigos de envíos enlazados usan la misma identidad propia.

Composición propuesta de policies: sustituir0416self por rama cohorte/client_id y rama legacy original; restrictiva sólo sobre cohorte, permitiendo derecho Studio actual del tenant O principal Portal propio. Rama legacy true deja resolver sus policies actuales; no introduce límite nuevo al equipo/hijos legacy. Helpers no conceden permisos de escritura ni exponen schema privado. Pendiente decisión/lectura Director y aceptación SQL/RLS real; esta autoría no constituye diseño aceptado.

BCV recibió GO04B para preparar su comprobación general, con turno reservado. Worker continúa exclusivamente autoría P1; instalación/tests/tipos/lint amplio/DB/Docker/HTTP/browser/verify/build/conocimiento NO EJECUTADO por límite de turno. SQL0502 conserva fusible antes de DDL y cohorteOFF; main/merge/producción y0495 fuera de alcance.

Lectura primaria adicional Portal: búsqueda acotada de definiciones de get_user_tenant_id en migracionesD1 encuentra0001/0012/0200/0453; última definición efectiva0453, líneas235–250, blob `2ca2f68a708394016d68ade17927c864ad47e369`, devuelve sólo la única membresía user_tenants activa de auth.uid(), sin fallback Portal. Huella prosrc LF propuesta para preflight `5ff0c51c26a49419c34abc78f1d95c37`, calculada del literal local, pendiente cotejo SQL real. El predicado RLS de cohorte además verifica EXISTS de esa membresía Studio activa y tenant concreto; no infiere pertenencia de metadata/helper aislado ni concede el ámbito Studio al lector Portal propio. No se cambian helpers históricos.

Corrección material de preparación Portal a partir de lectura propia0439:106–217 y0444:102–169 y aviso Director:0416 ya no es el contrato completo de shipment_documents.0439:152–183 sustituyó ALL by-tenant por SELECT/INSERT/UPDATE/DELETE con document_entity_authorized;0444 es su autorizador efectivo (huella prosrc `4eb9fd08721e8f754087dddc5cb88953`, además referenciada por0456/0492). La propuesta externa64 anterior queda fechada y esta precisión prevalece sobre su mención genérica a by-tenant de las tres tablas. WIP0502 preserva las cuatro policies documentales y ACL/cuerpo del autorizador, compone sólo Portal self y restrictiva de cohorte con derecho Studio documental efectivo+tenant/membresía o principal Portal propio. Predicados no sustituyen el permiso por metadata o mera membresía. Preflight/postflight conserva snapshot de policies de equipo para cotejo exacto. Pendiente revisión Director/SQL real; ninguna aceptación funcional.


## Adopción Worker P1 — addendum acumulado64

Leído íntegro y cotejado SHA256 f877118d85c19f31d29d82e4083042366ccd92f45bb008827e4c7a87af39d108 (13546bytes), antes de editar seis fixtures Portal. Dirección técnica acotada conforme al addendum; no aceptación de WIP o funcionamiento. Se preservan contratos1939/52/55/58, owner, D1, PR318DRAFT, SQL0502 con fusible y cohorteOFF. P1 sin runtime; turno BCV GO04B.

<!-- ADDENDUM64 DIRECTOR ÍNTEGRO INICIO -->
# SDD-0578 — addendum Director: Portal y seis fixtures, 64 rutas

21 de octubre de 2026. AUTORIZADO únicamente para autoría P1 del Worker vigente. Sustituye el máximo acumulado58 por la unión literal64 de abajo; agrega seis fixtures de compatibilidad del lector Portal. Acepta la dirección técnica de una lectura Portal propia con las condiciones de este documento, dentro de las rutas de producto ya autorizadas. No aprueba SQL/código WIP, funcionamiento, política de negocio nueva, permisos adicionales ni runtime. SQL0502 conserva su fusible y cohorte OFF.

Mismos raíz `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal`, rama `codex/sdd-0578-envios-cliente-camino-normal`, owner `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, baseD1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733`, claim y PR318 DRAFT. BCV GO04B mantiene el único turno pesado; este addendum no lo transfiere. Se preservan los contratos anteriores1939a047/4d976df8/8dd76b80/557b81d0 y sus límites, completos e inmutables.

## Evidencia realmente revisada

Director leyó completas la propuesta `0578-propuesta-portal-y-fixtures-64.md`, SHA256 `8c22a256030f55eb6567bc87237445114ab1a75b6271defeb14b60e81e881795`, y la nota independiente `0578-revision-portal-fixtures-64-peer.md`,19517bytes/SHA256 `493ff828234c0767a1bee45664283d2ec0033ed7e179f48133792fb5561d9071`. El revisor leyó1275/1275líneas de las seis fixtures por objetosD1 y las fuentes de autoridad efectivas indicadas; Director atribuye esa lectura primaria al revisor, sin afirmar que leyó íntegros todos esos archivos o que ejecutó pruebas. La necesidad de adaptar el transporte es inferida del diseño, no un fallo reproducido.

## Decisión técnica acotada y condiciones obligatorias

1. **Lector Portal propio:** puede concretarse `client_consolidation_portal_read()` sin tenant/client_id recibidos como autoridad browser. Resuelve en DB el actor autenticado y un único vínculo activo client_users/clients, con tenant coherente y cliente vivo. Cada grupo Y shipment de cohorte debe pertenecer a ese tenant/client_id. Legacy conserva tenant+marca, padre vivo y las relaciones efectivas de documentos/eventos; no basta comparar una marca aislada. Proyección mínima Portal y asociaciones/revisiones/sello propios, sin información financiera o nombres ajenos. No rescatar errores/principal inválido mediante service_role/admin o tenant Studio.
2. **Autoridades separadas:** el híbrido conserva el derecho Studio que ya posea, pero esa amplitud no entra en la RPC Portal propia. get_user_tenant_id efectivo D1 está en0453:235–250 (blob2ca2f68a708394016d68ade17927c864ad47e369): única membresía user_tenants activa, sin fallback Portal. El camino Studio exige membresía activa del tenant y coherencia con el helper; deshabilitada/ajena o varias activas no se convierten en permiso Studio. Esto no revoca automáticamente un principal Portal propio válido. Metadata no concede autoridad ni edición.
3. **RLS de lectura y catálogo efectivo:** las policies Portal0416 se adaptan sólo para distinguir cohorte por client_id y legacy con sus predicados actuales; una restricción SELECT sólo cohorte impide revivir el grant por marca. Para legacy deja actuar los permisos existentes. Documentos NO conserva `shipment_documents by tenant` ALL:0439:152–183 lo reemplazó por cuatro policies Studio; SELECT exige también document_entity_authorized('shipment',tenant_id,'view'). El cuerpo efectivo de ese autorizador es0444:102–168 (blob4f8e9d5d7f7049fe11157585f7dc11f6208a425d), con Tracking/overrides. Conservar íntegros los cuatro permisos, sus ACL y Storage/bucket. No sustituir el permiso documental por membresía ni copiar el preflight histórico0416. Medir catálogo real esperado antes/después: comandos, roles, expresiones, polpermissive, propietario, ACL, search_path y minimización. No nuevas escrituras Portal, grants de datos/rol humano o API privada de identidad ajena. Helpers históricos no se editan por comodidad.
4. **Completitud y errores:** envelope available/complete/principal/observedAt/shipments con principal exacto y shape válido, sin duplicados o filas ajenas. Error/null/shape incompleta/principal ajeno no son vacío, count0, no-arribo, legacy u OFF. Completo y vacío sí es ausencia conocida; sin principal válido se conserva el corte anterior sin dominio/RPC. Todos los grupos propios sobreviven las ventanas legacy100/50; complete exige fuente completa, no contar lo recibido. Snapshot coherente de identidad/grupos/asociaciones/revisiones requiere evidencia SQL/HTTP futura; observedAt no lo demuestra por sí solo. Documentos posterior exige padres propios+tenant/IDs y marca legacy, manteniendo200 como ventana de presentación, sin afirmar transacción conjunta con la RPC. Errores deben llegar a un estado recuperable seguro del consumidor real; si necesita una ruta no permitida, justificar antes de editar, nunca degradar a vacío para conservar firma.
5. **Finanzas y cotizaciones:** preservar filtros/paginación completa de facturas, tenant+marca, borradores/borrados, importes/saldos/monedas/anuladas, detalle y errores actuales. Cotizaciones conserva su principal mínimo válido SIN exigir nombre, filtros de quotes web/Studio y100másrecientes. Sin enlace no hay RPC; enlace ajeno en lectura propia completa da código null. Error de transporte no se convierte en envelope vacío exitoso. No nuevo endurecimiento numérico, conversión o autoridad de cotizaciones por este tramo.
6. **Aceptación futura:** dentro de los tests de cohorte/SQL/concurrencia ya permitidos, medir Portal-only, híbrido, otro tenant/mismo mark, otroclient/misma marca, grupo-shipment discordantes/borrados/padres ajenos; más de100grupos y arribo tras50terminales; membresía inválida/helperNULL sin rescate; documento con overrideTracking que permite/niega conservando alternativa Portal propia; ACL/PUBLIC/anon/search_path/proyección real. Decoder y consumidores efectivos rechazan null/error/parcial/duplicado/ajeno, completo vacío se distingue, aprobación corta antes de RPC y quote mínimo sin nombre funciona. Nada de esto está ejecutado o aceptado por lectura. No se trasladan los resultados de los dobles a SQL/RLS real.

## Seis fixtures añadidas y conservación de oráculos

| Ruta literal / blobD1 | Adaptación mínima y cobertura que permanece |
|---|---|
| `lib/portal/__tests__/activation.test.ts` / `7f3f8f5d92808315aa34bd34c5cf0315d2a4bc52` | Envelope0/N completo del principal y contadorRPC separado; conservar pendiente/aprobada/conenvíos/anónimo, aprobación antes de leer envíos y cero dominio/RPC sin principal. Error no es cero. |
| `lib/portal/__tests__/dashboard.test.ts` / `a20d12116d4766a5fad34f12aedbde75b3ed0400` | Metadata legacy completa/identidad; no tocar builder.range/error de facturas. Conservar activos/YTD/ETA/terminales,1500facturado/600saldo/una pendiente del caso base, cero válido, monedas, anuladas, recorte de sobrepago y fallo de facturas sin perder envíos. |
| `lib/portal/__tests__/invoices.test.ts` / `4b90585aaccfe7ba73c1df695ce858881cb33815` | Sólo transporte listMyShipments y su assert: RPC sin autoridad browser/principal exacto y ausencia de lectura genérica. Preservar filtros tenant+mark de facturas/detalle, importes/formato/tonos/estados y corte sin principal. Cambia dónde se demuestra scope, no elimina aislamiento. |
| `lib/portal/__tests__/estimates.test.ts` / `de09c7c46faa10c3c9a3d83d456f62f665a3f141` | Mantener principal mínimo sin name; separar quotes deRPC. Conservar dos filas/campos/importe1250.5, vínculo propio/código, ajeno null, no-link sin lectura, total null y labels/tonos. Sólo completo vacío es ausencia válida. |
| `lib/portal/__tests__/portal-queries-principal-scope.test.ts` / `ce68e0e08dd9aa3069014200f4727f647430728e` | AdaptadorRPC local sobre store exacto del escenario, sin tocar doble compartido. Dar a documentos padres propios/ajenos/otrocliente REALES de la fixture, no IDs inexistentes que borren la distinción0416. Preservar mismo código entre tenants, misma marca/otro cliente, borrado/arribo ajeno, aprobación porclient_id y cero dominio/RPC ante principal inválido. Adaptar también invocaciones directas del doble. |
| `lib/portal/__tests__/portal-quote-scope.test.ts` / `6bf01be51aaceb5e3a27099e0a1d52249705e788` | Mantener filtros reales del doble y principal mínimo; resolver sólo código enlazado. Conservar aislamiento tenant/marca/borrado, splitweb-Studio, auth/vínculo inválidos, tenant/client incoherentes, cliente ausente/borrado, relación múltiple rechazada/singular aceptada,100másrecientes, código propio/null ajeno, error dequotes y no-link sin RPC. |

Nada de envelope feliz genérico para toda RPC/principal, casts nuevos, mocks de acción/guard, cambios de permisos, eliminación de asserts o bypass para obtener verde. El doble compartido `portal-tenant-double.ts`, blob9c72c02383e39953d50824549855ad3b5a4b8083, queda fuera y sin editar. Toda la implementación se revisará por SHA fijo, con firmas reales y pruebas futuras; esta aprobación técnica no valida WIP todavía mutable.

## Allowlist acumulada literal:64 rutas únicas

```text
lib/studio/client-consolidation/types.ts
lib/studio/client-consolidation/queries.ts
lib/studio/client-consolidation/normal-flow.ts
app/studio/(app)/naviera/_components/ConfirmarEnviosClienteDrawer.tsx
app/studio/(app)/naviera/actions.ts
app/studio/(app)/naviera/page.tsx
app/studio/(app)/naviera/_components/NavieraClient.tsx
app/studio/(app)/naviera/plan-actions.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/page.tsx
app/studio/(app)/cn/_components/AlmacenCnClient.tsx
app/studio/(app)/cn/_components/ReceiptRowActions.tsx
app/studio/(app)/tracking/[id]/actions.ts
app/studio/(app)/tracking/[id]/page.tsx
app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx
app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx
app/studio/(app)/tracking/[id]/_components/FooterActions.tsx
app/api/studio/shipments/[id]/route.ts
app/api/studio/shipments/[id]/events/route.ts
app/studio/(app)/ve/actions.ts
app/studio/(app)/ve/_components/VeRowActions.tsx
app/m/cn/estibar/actions.ts
app/m/cn/estibar/_components/EstibaClient.tsx
lib/portal/portal-queries.ts
lib/studio/rate-snapshots/types.ts
lib/i18n/es-VE/warehouse.ts
lib/i18n/zh-CN/warehouse.ts
supabase/pending-migration-symbol-declarations.json
supabase/migrations-baseline.json
docs/specs/README.md
.agents/handoffs/042-envio-cliente-camino-normal.md
app/m/cn/estibar/[consolidationId]/page.tsx
docs/specs/0578-envios-cliente-camino-normal/spec.md
supabase/migrations/0502_consolidacion_cliente_camino_normal.sql
supabase/tests/consolidacion_cliente_normal.test.sql
supabase/tests/_consolidacion_cliente_normal_schema.sql
lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts
scripts/check-client-consolidation-concurrency.mjs
app/studio/(app)/naviera/__tests__/envios-cliente-actions.test.ts
app/studio/(app)/naviera/_components/__tests__/ConfirmarEnviosClienteDrawer.test.tsx
app/studio/(app)/cn/__tests__/consolidacion-cohorte.test.ts
app/studio/(app)/naviera/__tests__/plan-carga-cohorte.test.ts
app/studio/(app)/tracking/[id]/__tests__/cohorte-normal-actions.test.ts
app/api/studio/shipments/[id]/__tests__/cohorte-normal.test.ts
app/m/cn/estibar/__tests__/cohorte-pertenencia.test.ts
app/studio/(app)/ve/__tests__/cohorte-normal.test.ts
lib/portal/__tests__/envios-cohorte.test.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts
e2e/consolidacion-clientes-camino-normal.spec.ts
app/studio/(app)/cn/__tests__/delete-receipts-action.test.ts
app/studio/(app)/cn/__tests__/create-receipt-code.test.ts
app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts
app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx
app/studio/(app)/naviera/_components/__tests__/NavieraClient.avance.test.tsx
app/studio/(app)/tracking/[id]/__tests__/datos-reservados-actions.test.tsx
app/studio/(app)/tracking/[id]/_components/__tests__/FooterActions.borrado.test.tsx
app/api/studio/shipments/[id]/events/__tests__/module-gate.test.ts
lib/portal/__tests__/activation.test.ts
lib/portal/__tests__/dashboard.test.ts
lib/portal/__tests__/invoices.test.ts
lib/portal/__tests__/estimates.test.ts
lib/portal/__tests__/portal-queries-principal-scope.test.ts
lib/portal/__tests__/portal-quote-scope.test.ts
```

## Adopción y fronteras

Leer completo/cotejar hash y guardar adopción íntegra+hash en spec/handoff ANTES de tocar las seis rutas nuevas. Conservar ownership, SDD0578/SQL0502 y contratos anteriores. Una sesión escritora, commits selectivos/push al mismo DRAFT autorizados; no add-A, base nueva, main, resets o edición ajena. El ámbito heredado no es permiso para cambiar otros archivos.

P1 sigue SIN instalación, tests, tipos, lint amplio, SQL/DB/Docker, HTTP, navegador, verify/build o conocimiento hasta turno explícito. BCV mantieneGO04B/freeze. Sin main/merge/deploy/VPS/DBreal/PII/secretos/pagos/contactos/bóveda compartida.0495no se modifica/reaplica;0496/0501/0502sinaplicar. CohorteOFF, sin facturación4.3/historia/caller o flagPODv2. No política nueva de negocio ni autorización de producción. Gobernanza: preparación documental conforme al alcance, evidencia funcional/SQL/UI pendiente, ninguna excepción nueva; no llamar PASÓ al funcionamiento por esta nota.

<!-- ADDENDUM64 DIRECTOR ÍNTEGRO FIN -->

## Checkpoint P1 · Portal, VE y estiba redactados; aceptación pendiente

Autoría nueva dentro64: Portal snapshot propio y composición SELECT/cohorte con0439+0444; seis fixtures adaptadas después de adopción64; VE separa legacy comprobado y RPCs de liberación/reparto/entrega manual con atestación del sello completo. Entrega0487 conserva autoridad propia; la liberación es hito operativo aduanal, no ingreso físico ni factura. Estiba incluye proyección operario mínima/atómica sin nombres/tarifas, revisión explícita para caja/lote/deshacer, contexto privado para la firma nueva y guardas en firmas antiguas durante drain. Se conserva la selección real por prealerta/cantidad; no se intersecta silenciosamente el lote. La traza del plan permanece separada de éxito físico; falla de anotación da aviso sin repetir estiba. Página no certifica conteos truncados ni usa sugerencia de revisión anterior.

SQL0502 redacta restauración/comprobación de ABI, owner, ACL, cuerpos privados y policies documentales actuales; prerequisitos/fusible antes deDDL y altaOFF permanecen. Estos son oráculos escritos, no resultados SQL. Nuevos tests de adaptadores VE/móvil/Portal y regresiones tarifa/reporte están redactados, SIN EJECUTAR. Matriz DB, fixture, carreras dos sesiones, recorrido HTTP/browser, declaración de símbolos y plan final todavía pendientes de autoría/revisión. Runtime completo y aceptación A1–A16/global siguen pendientes. Propuesta adicional67 externa `0578-propuesta-eventos-portal-67.md`, SHA256 `14daf4aa1a00ce738177507368a80b61a8b4fcc4330c65789f0a18e43e07a372`: lector eventos/feed aún por marca,3rutas fuera64 SIN EDITAR hasta decisión Director. No cerrar4.2 con ese escape pendiente.

Consumidor de error Portal ya existente leído íntegro: app/portal/(app)/error.tsx1–104, blobD1c6c3b929c383d6082905b631bba3efc1babfb573; ofrece alerta segura y Reintentar/Ir al inicio. No se editó. El detalle getMyShipment autoriza envío propio antes de lectores admin de Naviera/avisos/documentos; lectura primaria app/portal/(app)/envios/[code]/page.tsx1–135. Ausencia completa conocida sigue distinta de error/incompleto. Herencia Studio de híbridos fuera de la RPC propia se conserva.

BCV GO04B conserva turno; todas las comprobaciones funcionales/SQL/HTTP/UI/verify/conocimiento de0578 NO EJECUTADAS. Handoff continúa abierto y claim retenido. Este checkpoint sólo respalda autoría parcial revisable, no aprobación de SQL ni capacidad activa.

## Adopción P1 del addendum Director67

Leído íntegro y cotejado:12862bytes/SHA256 `64d2eb92b6847c822fdc607ea631cc382f6cd8681753bec63dcd549497720ead`. Se adopta exclusivamente para autoría P1 dentro de la unión67, antes de editar el lector de eventos y sus dos fixtures. Raíz/rama/HEAD e7d0f4f0 y guard/owner comprobados; WIP propio de fixture SQL se conserva. Helper Studio NULL no invalida Portal-only; se retirará el mock de principal del fixture antiguo y se usará el resolver real. Funcionalidad/SQL/RLS/UI siguen NO EJECUTADAS. BCV GO04B terminó FALLÓ por paridad de dos variables; su GO05A limitado a plantilla/focal sigue separado del turno0578. Fusible0502 y cohorteOFF permanecen.

<!-- ADDENDUM67 DIRECTOR ÍNTEGRO INICIO -->
# SDD-0578 · addendum Director67, identidad de eventos Portal

21 de octubre de2026. **AUTORIZADO sólo para autoría P1 del Worker vigente.** Unión literal64→67: un lector y sus dos fixtures. No aprueba WIP/SQL/RLS/funcionamiento/UI ni transfiere turno de pruebas. Misma baseD1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733`, rama `codex/sdd-0578-envios-cliente-camino-normal`, worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal`, owner `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, claim y PR318DRAFT. SQL0502 conserva fusible antesDDL y cohorteOFF. BCV tiene GO05A propio;0573 sigue preparado/inactivo.

Los contratos1939a047/4d976df8/8dd76b80/557b81d0 y el addendum64 `042-addendum-director-0578-64-rutas-portal-fixtures.md`,13546bytes/SHA256 `f877118d85c19f31d29d82e4083042366ccd92f45bb008827e4c7a87af39d108`, permanecen completos e inmutables. Este documento sustituye sólo el máximo64 por67 y concreta el lector de eventos y sus pruebas. No autoriza una cuarta ruta adicional ni edición de helpers históricos, pagos, notificaciones, Storage, páginas o doble compartido.

## Fuentes, necesidad y límites de lectura

Director leyó íntegros la propuesta `0578-propuesta-eventos-portal-67.md`,5327bytes/SHA256 `14daf4aa1a00ce738177507368a80b61a8b4fcc4330c65789f0a18e43e07a372`, y el peer `0578-revision-eventos-portal-67-peer.md`,SHA256 `39640a587b56df94afc5a0a05f7765a000d36e20b331f0884c29fd54280fa7c1`. El peer leyó363/363 líneas de las tres rutas, ambos callers completos y boundary104, más autoridad efectiva SQL/RLS por objetosD1. Director leyó además íntegro el lector114. Se atribuyen las lecturas primarias restantes al peer; ninguna fue ejecución de producto ni acceso a filas reales.

El feed actual filtra tenant+marca del padre. La identidad de cohorte es tenant+client_id del grupo Y shipment. Un híbrido conserva derecho Studio, por lo que esa amplitud no autoriza incluir eventos ajenos en su Portal propio. Una marca histórica distinta también puede ocultar hitos propios. Es dependencia lógica demostrada por fuente, no filtración reproducida o autorización de cambiar marcas/historia. El detalle tiene autorización de shipment previa; no atribuirle automáticamente la filtración hipotética del feed.

Preimágenes D1 de las tres nuevas rutas: lector `443f205ed614a5993397ccae2464967a6f10786d`; shipment-events.test `bac6d4dcfbbf8a04ca9adf58f28feaeb8013a100`; portal-read-principal-scope.test `2528616c29e7f3f9bfe8aecbd6725a3fd46afc71`. El boundary existente c6c3b929c383d6082905b631bba3efc1babfb573 tiene alert/Reintentar/Inicio y no muestra detalle técnico. Por lectura, una excepción segura de eventos llega a ese boundary de segmento; no se promete granularidad sólo del feed ni recorrido UI ejecutado.

## Contrato técnico obligatorio de autoría

1. Dentro de0502 ya allowlisted, concretar la RPC de lectura `client_consolidation_portal_events(p_shipment_id uuid default null,p_limit integer default null)` y el decoder local del lector. Derivar auth.uid y un único vínculo Portal activo con cliente vivo/tenant coherente; sin tenant/client_id browser como autoridad, sin admin/service_role o helperStudio para rescatar principal. Evento/padre vivos, tenant evento=padre=principal. Legacy conserva predicados efectivos tenant+marca/relaciones0416; cohorte exige grupo Y shipment del client_id propio. Proyección mínima de los campos consumidos, sin identidad/actor/finanzas ajenas ni nuevo permiso de escritura.
2. **Autoridades separadas:** helperStudioNULL es normal en Portal-only propio y no invalida su lectura. Ausencia/ambigüedad/revocación del principal Portal sí corta antes del dominio. Híbrido conserva su derecho Studio legítimo fuera de esta RPC, que siempre devuelve sólo lo propio. Una membresía de equipo ambigua/deshabilitada/ajena no concede Studio ni rescata datos Portal. Mantener0012/0416/0453 efectivas y condiciones documentales0439/0444 del addendum64; no modificar helpers o quitar derechos globalmente para compensar el filtro de aplicación.
3. ShipmentId es selector, no autoridad. Principal válido y selector ajeno/inexistente producen ausencia indistinguible. Dos vistas explícitas: historia completa de un shipment propio y actividad reciente topN. Historia no admite límite que la trunque; feed conserva default8 y el4 solicitado por tests. Concretar combinaciones/validación de argumentos, sin coerciones, clamp silencioso o cambio accidental de semántica. Envelope coteja principal, vista, selector, límite, observedAt y eventos; completo sólo si consulta interna es completa para esa vista. Un JSON único evita truncamiento externo de filas PostgREST, pero no demuestra por sí solo consulta interna completa.
4. Historia ascendente occurred_at y desempate estable; feed descendente con desempate estable. Mantener fechas reales, note nullable, status y shipmentCode del padre propio. Conservar `stepDatesFromEvents`, DTO público y mapas/avisos puros; primera fecha de cada status gana. No sustituir occurred_at por created_at/observedAt, fabricar hitos, backdate, alterar catálogo, notificar o cambiar dinero/estado por leer.
5. ErrorRPC/SQLausente/null/parcial/shape/principal distinto/vista-selector-límite discordantes/duplicados/filas ajenas **no son[] exitoso**. Completo/válido/vacío es ausencia conocida; sin principal válido conserva corte anterior sin dominio/RPC. Eliminar el fallback de error a[] para esta lectura; no consulta genérica alternativa a shipment_events. Excepción segura/sanitizada para el boundary existente, que además registra errores; sin mensajes SQL/filas/PII/auth.
6. ACL explícita de lectura authenticated, sin concesión residual PUBLIC/anon ni nueva API de identidad. Derivación auth.uid y checks internos obligatorios; propietario/search_path/ACL/pre-postflight/catálogo quedan en pruebas ya autorizadas. Conservar derechos Studio/legacy y políticas de escrituras existentes. No declarar SQL/RLS conforme por mocks o por esta autorización de autoría.

## Delta mínimo por cada nueva ruta y oráculos conservados

- `lib/portal/shipment-events-queries.ts`: sólo transporte y validación de listMyShipmentEvents/listMyRecentActivity y comentarios de autoridad efectiva. Mantener DTO/mapas/fechas/hitos y firmas de consumidores. No páginas/boundary/Storage/documentos/admin/notificaciones.
- `lib/portal/__tests__/shipment-events.test.ts`: **retirar dentro del mismo archivo el mock preexistente vi.mock('../portal-queries') de22–32**. Preparar auth.getUser y client_users/clients del escenario para operar el resolver real; no trasladar mock/cast/doble compartido. RPC local responde sólo al nombre/args/actor correspondientes. Conservar primera fecha in_warehouse10jun aunque se repita12jun, shipped20jun, deliveredundefined y mapa vacío. Conservar notificación sí in_warehouse/shipped/out_for_delivery/delivered y no arrived_destination/in_transit/in_customs/draft. Sustituir el lugar del assert tenant+mark por selector/principal/vista exactos y ausencia de consulta genérica; SQL real medirá el scope aparte. Sin principal conserva[] temprano/ceroRPC.
- `lib/portal/__tests__/portal-read-principal-scope.test.ts`: resolver real y actores sintéticos existentes; adaptar sólo el dobleRPC específico y asserts de eventos/feed. Principal incoherente corta pagos/eventos y ceroRPC. **Filtros de pagos tenant-a/DTD-0001/INV-1 literales intactos**, sin editar payment-report-queries. Actividad conserva límite4; historia selector exacto, nunca autoridad browser.

Pruebas nuevas futuras en rutas ya autorizadas: Portal-only válido con helperStudioNULL, híbridoB con marca histórica coincidente deA no revelaA mientras mantiene Studio, propioB con marca distinta sí visible; tenant ajeno/grupo-shipment discordante/padres/clientes/vínculos borrados o múltiples/evento discordante. Historia>1000 conserva primer hito y todos los eventos propios; feed8/4 topN estable distinto de historia total. Selector ajeno/inexistente indistinguible; errores/funciónausente/null/parcial/duplicados/envelopeajeno o vista incorrecta rechazan; completo vacío válido. Medir SQL/API/RLS real, concurrencia y recorrido boundary/reintento/teclado cuando haya GO; hoy **NO EJECUTADO**. No afirmar que el sobre del doble acredita aislamiento de DB.

## Allowlist acumulada literal67

```text
lib/studio/client-consolidation/types.ts
lib/studio/client-consolidation/queries.ts
lib/studio/client-consolidation/normal-flow.ts
app/studio/(app)/naviera/_components/ConfirmarEnviosClienteDrawer.tsx
app/studio/(app)/naviera/actions.ts
app/studio/(app)/naviera/page.tsx
app/studio/(app)/naviera/_components/NavieraClient.tsx
app/studio/(app)/naviera/plan-actions.ts
app/studio/(app)/cn/actions.ts
app/studio/(app)/cn/page.tsx
app/studio/(app)/cn/_components/AlmacenCnClient.tsx
app/studio/(app)/cn/_components/ReceiptRowActions.tsx
app/studio/(app)/tracking/[id]/actions.ts
app/studio/(app)/tracking/[id]/page.tsx
app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx
app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx
app/studio/(app)/tracking/[id]/_components/FooterActions.tsx
app/api/studio/shipments/[id]/route.ts
app/api/studio/shipments/[id]/events/route.ts
app/studio/(app)/ve/actions.ts
app/studio/(app)/ve/_components/VeRowActions.tsx
app/m/cn/estibar/actions.ts
app/m/cn/estibar/_components/EstibaClient.tsx
lib/portal/portal-queries.ts
lib/studio/rate-snapshots/types.ts
lib/i18n/es-VE/warehouse.ts
lib/i18n/zh-CN/warehouse.ts
supabase/pending-migration-symbol-declarations.json
supabase/migrations-baseline.json
docs/specs/README.md
.agents/handoffs/042-envio-cliente-camino-normal.md
app/m/cn/estibar/[consolidationId]/page.tsx
docs/specs/0578-envios-cliente-camino-normal/spec.md
supabase/migrations/0502_consolidacion_cliente_camino_normal.sql
supabase/tests/consolidacion_cliente_normal.test.sql
supabase/tests/_consolidacion_cliente_normal_schema.sql
lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts
scripts/check-client-consolidation-concurrency.mjs
app/studio/(app)/naviera/__tests__/envios-cliente-actions.test.ts
app/studio/(app)/naviera/_components/__tests__/ConfirmarEnviosClienteDrawer.test.tsx
app/studio/(app)/cn/__tests__/consolidacion-cohorte.test.ts
app/studio/(app)/naviera/__tests__/plan-carga-cohorte.test.ts
app/studio/(app)/tracking/[id]/__tests__/cohorte-normal-actions.test.ts
app/api/studio/shipments/[id]/__tests__/cohorte-normal.test.ts
app/m/cn/estibar/__tests__/cohorte-pertenencia.test.ts
app/studio/(app)/ve/__tests__/cohorte-normal.test.ts
lib/portal/__tests__/envios-cohorte.test.ts
lib/studio/rate-snapshots/__tests__/sin-facturar.test.ts
app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts
e2e/consolidacion-clientes-camino-normal.spec.ts
app/studio/(app)/cn/__tests__/delete-receipts-action.test.ts
app/studio/(app)/cn/__tests__/create-receipt-code.test.ts
app/studio/(app)/naviera/__tests__/zarpe-avanza-envios.test.ts
app/studio/(app)/naviera/__tests__/ocultar-nombres-cn.test.tsx
app/studio/(app)/naviera/_components/__tests__/NavieraClient.avance.test.tsx
app/studio/(app)/tracking/[id]/__tests__/datos-reservados-actions.test.tsx
app/studio/(app)/tracking/[id]/_components/__tests__/FooterActions.borrado.test.tsx
app/api/studio/shipments/[id]/events/__tests__/module-gate.test.ts
lib/portal/__tests__/activation.test.ts
lib/portal/__tests__/dashboard.test.ts
lib/portal/__tests__/invoices.test.ts
lib/portal/__tests__/estimates.test.ts
lib/portal/__tests__/portal-queries-principal-scope.test.ts
lib/portal/__tests__/portal-quote-scope.test.ts
lib/portal/shipment-events-queries.ts
lib/portal/__tests__/shipment-events.test.ts
lib/portal/__tests__/portal-read-principal-scope.test.ts
```

## Adopción, respaldo y fronteras

Leer íntegro y cotejar hash; copiar contrato completo al spec/handoff y confirmar adopción ANTES de tocar estas tres rutas. Revalidar guard/claim/raíz/rama y preimágenes; preservar WIP propio ya respaldado e7d0f4f0. Una sesión escritora. Commits selectivos/push/actualización del mismo PR318DRAFT autorizados; sin gitaddglobal, nueva base o SDD/SQL, main/reset/merge/deploy/producción/VPS/datos/PII/secretos/billing/contactos.

P1 sólo autoría: no install/Nodeproducto/tests/tipos/lintglobal/SQL/DB/Docker/navegador/verify/build/conocimiento todavía. Sí inspección de fuentes y diffcheck/documentación proporcionales ya permitidos. Al terminar autoría, entregar SHA y diff fijo de todo el producto/SQL/tests, matriz de aceptación y plan de pruebas/recursos para revisión. No retirar fusible0502 o activarcohorte hasta GO local específico; no aplicar0496/0501/0502. Cualquier cuarta necesidad debe demostrarse antes de editarla. Dirección técnica autorizada no equivale a aceptación funcional.

<!-- ADDENDUM67 DIRECTOR ÍNTEGRO FIN -->

## Ajustes P1 por revisión estática del Director y peer · sin aceptación funcional

La confirmación coteja operación, referencia, contenedor, revisión histórica esperada+1 y grupos exactos por cliente/servicio/destino/selección; alta exige código y revisión1, extensión exige mismo grupo y siguiente revisión. El cierre usa decoder propio closed/replay con contenedor/revisión/sello UUID completos; recorded/transitioned/UNKNOWN o sobre incoherente no confirma éxito, no revalida ni avisa y pide conservar referencia/leer estado. El replay se contrasta contra su intención histórica, sin exigir una lectura mutable posterior. Fixtures negativos/positivo escritos, NO EJECUTADOS.

Lectura primaria0321_warehouse_ve_delivery_governance.sql:37–44 confirma UNIQUE tenant+event_type+payload.request_ref sin entity_id; guard53–100 no altera esa clave. En0502 el POD que cierre varios grupos no puede reutilizar request_ref literal para cada AUD. Ajuste local propuesto/redactado: request_ref por grupo = client-normal-pod: + md5(JSON[referenciaPOD,shipmentId]); payload.pod_request_ref conserva la referencia original, pod_intentions y correlación client-normal-pod:shipment:md5(ref) permanecen. Cada grupo conserva AUD propio en la misma transacción; falla del segundo AUD revierte captura/cierres/eventos/ledger completos. Replay devuelve resultado histórico y no reapende AUD. Índice0321, cuerpos históricos/ACL y vía manual0487 no se editan. Compatibilidad de catálogo/SQL y casos multi-grupo/últimoOD/rollback/replay siguen pendientes de ejecución conGO.
## Checkpoint P1-67 · paquete autoral fijable para revisión, SIN ejecución

Las67 rutas de la unión Director67 tienen autoría. No se añadieron superficies fuera de esa unión ni se tocaron fuentes históricas. Este checkpoint compone eventos Portal y sus dos fixtures, respuestas de Naviera más estrictas, propuestas F1/F2 de POD, fixture/contratoSQL/PGlite, arnés de dos sesiones, recorridoE2E y declaración concreta0502. No certifica implementación correcta ni4.2completo. Spec sigue in-progress; PR318DRAFT apilada enD1; fusible0502 anterior aDDL y cohorteOFF. BCV GO05B EN CURSO conserva el único turno pesado, según Director;0578no hereda sus autorizaciones o resultados.

**Respuestas e identidad:** confirmar coteja operación/referencia/contenedor, revisión histórica esperada+1 y selección por cliente/servicio/destino/grupo. Formación exige código/revisión1 y miembros exactos; extensión conserva grupo y suma sólo los nuevos. Cierre tiene decoder propio closed/replay con contenedor/revisión/selloUUID completos; recorded/transitioned/UNKNOWN/ausente/discordante no produce ok, aviso ni revalidación. Negativos y replay histórico válido están redactados en el fixture deacciones. La respuesta incierta conserva intención y pide lectura; no se la transforma en fallo seguro de persistencia que autorice otro intento nuevo.

**Eventos Portal67:** RPC authenticated con auth.uid/principal vivo único, legacy tenant+marca, cohorte grupo Y shipment client_id propios. No recibe identidad browser ni usa helperStudio como rescate. Portal-only/helperStudioNULL válido; híbrido conserva Studio fuera deRPC. Historia selectorpropio/limitNULL íntegra ascendente por occurred_at/id; feed selectorNULL/entero1..2147483647, topN descendente estable, APIappdefault8/test4. Ambas opciones NULL o ambas noNULL son inválidas; sin coerción/clamp. Un JSON agrupa consulta completa para su vista. Envelope valida principal/vista/selector/límite/observaciónISO/filas únicas propias/orden/status/note; error o sobre incompleto no es[]. Selector ajeno/inexistente con principal válido sí da ausencia indistinguible. DTO, primera fecha y hitos notificables quedan literales. Mock anterior del principal retirado de shipment-events.test; resolver real con auth/client_users del doble, sin editar doble compartido ni pagos. Las pruebas escritas incluyen1105eventos/default8/4, errores/duplicados/ajenos y corte ceroRPC. No prueban RLS por ser dobles.

**POD F1/F2:** Director reportó peer completo 0578-revision-sql0502-e7d0f4f0-peer.md,21496bytes/SHA2561affbf103354383d69750dc944fed78bca139a90a0b10ccbb6a849ae09ff5599; aquí se cotejaron los cuerpos primarios pertinentes.0321unique tenant+tipo+payload.request_ref exige referencia AUD por grupo;0502deriva client-normal-pod:+md5(JSON[refPOD,shipmentId]), conserva pod_request_ref original, intenciónPOD y correlación anterior. No modifica índice ni0487. NOWAIT sólo en guardas de paquetes/captura que pueden entrar después de locks legacy; comandos nuevos mantienen bloqueo/orden padre→grupos/envíos→OD/paquetes. Contención produce NORMAL_CONFLICT y rollback del comando completo, sin esperar el padre en orden inverso.0184se conserva íntegra (blobD1 774ecd95287ebab892f93d1e0f5f8ed201f3e4c1,prosrcMD5LFce9d72146b0c734ce64e50e899e581fe). Ramas PODv1/v2 por rol singular y partial_delivery por roles[] permanecen distintas; no se amplía autoridad. Fixturev1 corregida a cuerpo efectivo0068 (blobD1 5a016d5d0a211932efa3c6d3a544d01a893f89f7,MD5LFf486d0990e8d9204c7e9c483923a81aa);0288esledger y no redefine ese cuerpo. Efectividad funcional/ACL pendiente.

**Pruebas autorales y límites:**35usa esquema mínimo propio y funciones/guardas reales; tras cada comandoAPI completo fuerza constraints diferidas y restaura deferred para no omitir invariantes por ROLLBACK. Migración0502tieneCOMMIT, por lo que ROLLBACK final revierte semillas, no instalaciónDDL: correr sólo en DB exclusiva descartable y destruirla al salir. PGlite instancia/cierra su DB propia;38crea/droppea sólo sdd0578_uuid en contenedor local con nombre/label de tarea. Las dos sesiones observan pg_blocking_pids/pg_stat_activity; no una espera de duración supuesta. Casos escritos incluyen intención/replay, código cohorte→legacy, congelar0496→link, plan viejo→extensión, sello→extensión y split0184/POD→conflicto limpio/reintentoP0013. SQLPOD prueba dosgrupos/unPOD/AUDdistintos, últimaODde miembros distintos, fracciones/duplicados pendientes, replay histórico y rollback ante fallo del segundoAUD. ParcialPOD válido se conserva; no caller/flagv2 activo. El vectorSQL de plan all-unplaced verifica persistencia, no acredita cálculoestiba@1; ese algoritmo real se conserva y se ejercita por adaptador/E2E. Fixture no modela ERP entero ni declara cobertura de ramas no alcanzadas.

E2E redactado para app/Auth/DB/Storage loopback propios, sin intercepción deRPC/HTTP/componente/cookie falsa: primera recepción0449→Drawer→permiso revocado real con misma referencia→formación→recepción tardía→mismo envío→plan→PIN/PWA390/estiba→sello→0477→liberaciónUIVE→entrega manual por teclado, con facturas constantes. Reparto intermedio usa RPC tipada y no se etiqueta UI deTMS. Recurso/manifest externo sintético aún no preparado ni usado; sin él, SKIP=NO DISPONIBLE y no aceptación. Claro/oscuro/UI-check/reflow/boundary/RLS real quedan explícitos para el turno futuro, sin A11Yglobal prometida.

Declaración pendiente0502:18funciones/26sitios alcanzables inventariados por lectura nativa y4anclas de fail-closed. JSON parseado con PowerShell; detector AST/alcanzabilidad/columnas NO EJECUTADO. Baseline sigue pending basename0502, cutoff/esperas ajenas intactos.0495no reaplicada;0496/0501/0502sinaplicar. No C-/OV nuevo; legacy conserva su vía anterior. Sin backfill, purga, conversión C-, costing4.6, factura4.3, autoridad/historia de cancelación/reapertura/reasignación o producción.

### Validación y aceptación pendiente

| Capa | Estado de este checkpoint | Evidencia que falta |
|---|---|---|
| Guard/owner, raíz/rama, scope67, diffcheck | PASÓ por comprobaciones nativas; se revalida antes decommit | Recibo fijo Git/PR del commit publicado |
| JSON declarativo | PASÓ parseo nativo únicamente | Checker real de símbolos/AST/SDD/docs/tipos/lint |
| Unidad/adaptadores/UI de componente | NO EJECUTADO | Vitest focal y oráculos conservados52/55/58/64/67 |
| SQL/ACL/RLS/ABI/AUD/0496/estados/POD | NO EJECUTADO | PGlite+PostgreSQL reales, regresiones actuales y mutantes |
| Concurrencia/códigos/drain/roster | NO EJECUTADO | Barreras reales escritas y ampliar ambosórdenes RC/RR/rename/reactivación/bulk/OFF→ON/lote mixto/PODsimultáneo |
| HTTP/browser/UI-check/A11Y | NO EJECUTADO | Recurso efímero real, errores/foco, claro/oscuro/móvil/teclado/reflow y límites visibles |
| Canónica/build | NO EJECUTADO | pnpm verify del SHA revisado tras foco verde, sin convertirSKIPs en cobertura |
| Conocimiento/Archify/Obsidian | NO EJECUTADO | Runbook leído íntegro; estructura/semántica/preview pendientes deGO, integración/publicación sóloDirector |

Plan nuevo íntegro externo: `C:/tmp/director-traspaso-20261020/0578-normal-validation/plan-relevo-p1-67.md`,12311bytes/SHA2567ad0418905f72489b138dad57631197fe4e62e45a8e57a88e0024c30b0dabca8. Conserva plan6eb46941previo. Contiene orden/comandos/recursos/condiciones de fusible, regresiones, matrizA1–A18y casos aún por extender antes de cierre. Una ruta redactada no equivale a oráculo completo o funcionalidad probada. Todas A1–A18aceptación pendiente; no trocear un bypass y llamarlo4.2completo.

### Pendientes de esta tarea y siguiente acción Director

Revisar delta fijo/0502/fixtures/67rutas y F1/F2; después Director decide turno/recursoGO y eventual retiro revisado del fusible. No se inicia P2, SQL, tests, tipos, build, navegador o conocimiento por este handoff. El checkpoint y su diff/blobs/hashes se entregan por Git/recibo externo y PR318DRAFT; no integra main ni producción. Claim retenido para revisión/corrección/continuación de la misma tarea; no Writer nuevo ni reset. El trabajo no tiene aceptación funcional todavía.

### FUERA DE ALCANCE DETECTADO

El caller móvil Bodeguero actual humanizeRpcError(197–209) devuelve mensajes desconocidos literalmente; un conflicto nuevo de la guarda puede verse como NORMAL_CONFLICT. No se editó su ruta fuera67 ni se amplió su autoridad/contrato. Evaluar presentación en UI real al validar la contención; el rechazo DB es atómico, no éxito parcial. Permisos/roles y excepciones históricas no se normalizan por conveniencia. Semántica/CI/producción de0574y trabajos BCV/0573no ascienden a verde por este checkpoint.