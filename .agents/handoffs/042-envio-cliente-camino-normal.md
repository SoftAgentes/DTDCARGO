# Handoff · SDD-0578 · Envíos por cliente, camino normal prospectivo

> Estado actual P1-72 claves no-op: nuevo delta sobre792f de las seis rutas Director, prepaso sólo gate y general con UPSERT único; oráculos/mutantes redactados. PR318DRAFT/baseD1,0502fusible/OFF. P2 por fuente NO REPRODUCIDO, matriz NO EJECUTADA y sin GO runtime. Ver planfdbd7dcd y checkpoint final; cortes anteriores intactos.

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

## Adopción P1 del addendum Director70 · split pendiente, SIN ejecución

SHA256 verificado: 8f5614ebd8683d1bff5b44c410b50089c2e964087cf16aba1d6f20a32c595ef4; 11865 bytes. Leído íntegro y copiado antes de editar las tres rutas nuevas. Se conserva a6a8c6c3601356d5647609ea1fa1ed5a8e7c8b44 como corte inmutable de revisión, SQL0502 con fusible y cohorteOFF, claim vigente. Adoptado sólo P1 sin runtime. Hallazgo de fuente NO REPRODUCIDO. Las inferencias OFF→ON/RR esperan dictamen separado y no cambian0502 por esta adopción.

<!-- ADDENDUM70 DIRECTOR ÍNTEGRO INICIO -->
# SDD-0578 · addendum Director70, conservar el split pendiente ante contención

21 de octubre de2026. **AUTORIZADO sólo para autoría P1 del mismo Worker. NO es GO de ejecución.** Amplía literalmente67→70 mediante tres rutas. Mismos raíz `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal`, rama `codex/sdd-0578-envios-cliente-camino-normal`, owner `worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468`, claim vigente, baseD1 `1ec5e85f736b7826cf5b6e8781757dc4cf950733` y PR318DRAFT. El objeto `a6a8c6c3601356d5647609ea1fa1ed5a8e7c8b44` permanece corte inmutable de revisión; las ampliaciones actuales forman otro delta propio. Fusible0502 antesDDL y cohorteOFF intactos. BCV GO05B mantiene turno pesado y freeze propios.

Los contratos1939a047, addenda52/55/58/64 y67 permanecen íntegros e inmutables. El67 `042-addendum-director-0578-67-rutas-eventos-portal.md`,12862bytes/SHA256 `64d2eb92b6847c822fdc607ea631cc382f6cd8681753bec63dcd549497720ead`, sólo cambia de máximo67 a70 para este relevo de dependencia. No modifica identidad Portal, permisos, SQL legado, planes o decisiones de negocio. Sin cuarta ruta nueva.

## Evidencia y clasificación

Director leyó íntegra la propuesta `0578-normal-validation/propuesta-presentacion-conflicto-split-a6a8.md`,6673bytes/SHA256 `c3e3ddd339e3885cb19f02e16f5c7ff8451b677bd2ec9de4164b6b44b86bbb65`. Leyó por objetos a6 completos: actionsBodeguero209líneas, SplitQueueRetryRunner110 y split-queue.test118, más fixtureVE46 completa87. Leyó sólo967–1016 de BodegueroClient y1–28 de `lib/studio/dispatch-mobile-types.ts`; no se atribuye esos archivos completos. ERR-01 aprobado leído íntegro. La nueva rama0502 NOWAIT/fail y su delta fueron leídos; su eficacia SQL sigue NO EJECUTADA y en revisión independiente.

Blobs a6/D1 inmutables de las tres nuevas rutas: actions `153721b2d111661ba918171d794ff0e699f216e5`; runner `a4e1d140b9c4027e3e4e6ba4a0ed501110e9b464`; fixture `406022af568c50030822135b6f104db5b64562b8`. El cuerpo0184 no se edita: blob `774ecd95287ebab892f93d1e0f5f8ed201f3e4c1`, MD5prosrcLF `ce9d72146b0c734ce64e50e899e581fe`. Shared split-queue.ts, dispatch-mobile-types y BodegueroClient son referencias excluidas, no superficies escritoras.

**Hallazgo de fuente, NO REPRODUCIDO:** el error nuevo del guard se devuelve por splitPackageP2Action como mensaje técnico porque humanizeRpcError termina en returnmsg. El runner47–67/95–105 interpreta todo `{error}` resuelto como terminal, retira la entrada y cuenta «aplicado». Un rechazo atómico por contención no acredita split ni permite perder esa intención. Es dependencia introducida porF2, no deuda ajena ya resuelta. No se afirma pérdida real, reproducción, prueba ni defecto productivo activo.

Clasificación normativa de esta preparación: ERR-01 y SGE-00.02/.07/.11 exigen estado verdadero, conservación y mensaje recuperable; contrato documental conforme, producto NO EJECUTADO. No nueva excepción, política o traducción global. La deuda heredada de otros errores terminales se conserva acotada, sin declararla correcta en general ni ampliarla a la rama nueva.

## Autoría mínima obligatoria

1. Sólo en splitPackageP2Action, reconocer la terna exacta `error.code === "P0001"`, `error.message === "NORMAL_CONFLICT"`, `error.hint === "dtd-client-normal"`, antes del humanizador. Devolver error seguro y `retryable:true`, sin ok/createdOdId/revalidate/notificación. Copy aprobado para esta rama: «El despacho está cambiando. No se fraccionó este paquete. Revisa la orden e inténtalo de nuevo.» La afirmación de no fraccionar sólo corresponde a esa denegación transaccional identificada; transporte ambiguo no se convierte en este resultado.
2. El tipo de retorno se amplía localmente en ESTA action mediante MobileActionState y la marca opcional; no editar tipo compartido ni aceptar retryable desdeFormData. Conservar requireBodegueroSession, región/roles, validator, payload y una sola RPC0184. No reintento de RPC dentro de la action, fallback, cambio de privilegios o cuerpoSQL. Otros códigos/hints/messages conservan exactamente su manejo anterior, incluidoP0013.
3. En retryOne del runner, sólo `result.retryable === true` con error presente retorna false ANTES de la rama terminal. Conservar entrada/localId/fecha/campos íntegros. No removeSplit, settled++, toast de aplicado o refresh atribuibles a esa entrada; no lanzar otro intento inmediato ni confundir contención con desconexión. Próximo eventoonline/mount conserva el mecanismo existente y vuelve a estar sometido a las guardas0184/P0013. La marca no promete que un intento posterior vaya a aprobar.
4. Si otras entradas sí se resuelven en el mismo drain, sólo ellas participan del conteo/toast/refresh; no impedir su drenaje legítimo ni contar la retenida. No rediseñar almacenamiento, dedup, cap, identidad, encolado o descarte global. No leer ni tocar la cola real del usuario al implementar/verificar; fixtures locales ficticias solamente. No extraer ni imprimir notas o identificadores reales.
5. La presentación manual ya conserva campos/error en BodegueroClient967–1016. No editar ese componente, registrar éxito cuando hay rechazo o cerrar el diálogo. Para aceptar después harán falta pruebas del caller/runner y UI real con el alcance medido; fuente y mocks no bastan para declarar SQL/locks/catálogo/flujo completo.

## Oráculos futuros, todos NO EJECUTADOS

- Fixture46 ya permitida `app/studio/(app)/ve/__tests__/cohorte-normal.test.ts`: callerBodeguero real con dobles locales de sesión/admin; terna exacta→unRPC, error fijo y retryabletrue; variaciones de code/message/hint no obtienen marca. Sesión/región/rol/input inválidos→ceroRPC. P0013 mantiene «ya fraccionado» sin marca; éxito mantiene createdOdId/revalidate. Conservar todos los oráculos VE/0487 ya escritos, sin casts o mocks compartidos que sustituyan guards.
- `app/m/_lib/__tests__/split-queue.test.ts`: mantener cada assert actual round-trip/dedup/cap/id/corrupción; agregar runnerREAL montado, sin exportar retryOne sólo para tests. Entrada exacta permanece byte equivalente tras errorretryable, sin toast/refresh/removal ni segundoRPC inmediato; posterioronline con éxito retira exactamente una. Cola mixta conserva la retenida y cuenta sólo las resueltas. Throw de red sigue conservando y P0013/errores terminales mantienen el comportamiento legado acotado. No convertir un import/sintaxis/fixturefallida en ROJO funcional. El archivo.ts conserva formato válido sin agregar una cuarta ruta por usarJSX.
- SQL/runner38 ya dentro67 deberán acreditar rechazo y rollback reales del comando, barrera de contención y reintento0184; no se atribuyen esas propiedades al doble de la action. No exigir ejecutar ahora ni retirar el fusible para estos oráculos autorales.

## Allowlist acumulada literal70

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
app/m/ve/bodeguero/actions.ts
app/m/ve/bodeguero/_components/SplitQueueRetryRunner.tsx
app/m/_lib/__tests__/split-queue.test.ts
```

## Adopción, respaldo y límites

Antes de editar las tres rutas nuevas: leer íntegro este addendum, cotejar su SHA256, adoptar/copiar completo en spec/handoff y confirmar al Director; revalidar guard/claim/raíz/rama y preimágenes. Mantener a6 y la revisión actual como corte independiente; registrar delta posterior y todas sus rutas. Una sola sesión escritora, sin copiar otro árbol. Commits selectivos/push/actualización dePR318DRAFT ya autorizados; no gitaddglobal, force/reset, nueva base o nuevaSDD/SQL.

P1 sigue sólo autoría: ningún install/Nodeproducto/tests/tipos/lintglobal/SQL/DB/Docker/browser/verify/build/conocimiento, ni captura/lectura de datos reales o inspección de localStorage del usuario. Sin main/merge/deploy/VPS/producción/flags/PODv2/PII/secretos/billing/contactos/memoria/bóveda compartida. No quitar fusible0502 ni activarcohorte.0495intacta;0496/0501/0502sinaplicar. La hipótesis separada OFF→ON/RR y los otros oráculos dentro70 se revisan por su fuente; esta ampliación no acepta una reparación de fence ni activa ningún ensayo.

Al entregar: nuevo SHA fijo, diff completo contraa6 y contraD1, ruta por ruta/manifest70, matriz de aceptación honesta, propuesta de recursos y pendientes propios vs ajenos. Todo hallazgo de fuente conserva NO REPRODUCIDO hasta evidencia funcional pertinente. Director revisará porversión y dará GO porseparado; este texto no cierra4.2 ni aceptaSQL.
<!-- ADDENDUM70 DIRECTOR ÍNTEGRO FIN -->


## Adopción P1 de decisión Director · fence de ámbito, SIN ejecución

SHA256 verificado3f0a4243cf244de6333a7919af15cf88de2a2dffe2239d297a6695c7f2f09c44; 6749 bytes. Leída íntegra y copiada antes de modificar0502 para el fence. Mismaallow70/owner/claim; a6 inmutable. F3 sustentado por fuente/NO REPRODUCIDO, nueva dirección autorizada sólo de autoría local. El mecanismo final y la funcionalidad todavía requieren revisión y GO posterior.

<!-- DECISION FENCE SCOPE DIRECTOR ÍNTEGRA INICIO -->
# SDD0578 · decisión de autoría para el fence de ámbito prospectivo

21 de octubre de2026. **AUTORIZADO sólo para autoría P1 dentro de70; NO GO de ejecución ni aceptación de SQL.** Misma raíz/rama/owner/baseD1/claim/PR318DRAFT del addendum70 SHA8f5614ebd8683d1bff5b44c410b50089c2e964087cf16aba1d6f20a32c595ef4.0502 conserva fusible antesDDL y cohorteOFF; BCV mantiene turno pesado. La activación real de ámbitos sigue fuera de este permiso.

## Evidencia y alcance de la decisión

Director leyó íntegros la propuesta `0578-normal-validation/hipotesis-off-on-rr-a6a8-propuesta.md`,5609bytes/SHA085aa941ca6e6626b68e9fe3a97ce1c93d24fe3a6b3911466748660d3e98797b, y el informe independiente `0578-revision-sql0502-a6a8c6c3-peer.md`,24069bytes/SHA9de49eb3d7d47769eedcf94d52f2df30176a86ed5e0a82f2b1af0410c043fda4. Cotejó fuente a6 en0502:58–84,116–153,252–326,424–476,493–553. El peer distingue sus rangos/antecedentee7 y leyó fixture1843/contrato459/runner200 completos, sin runtime. Siete cuerpos copiados iguales son evidencia textual, no ejecución.

F1AUD yF2NOWAIT tienen mecanismos corregidos por fuente para sus intercalaciones; prueba dinámica pendiente. El nuevo P2 de prospección queda **sustentado por fuente / NO REPRODUCIDO**: enrol_receipt y wrappers pueden leerOFF bajo snapshotRR anterior aON; el FOR SHARE deintake no protege el INSERT legado/directo que no pasó por allí. Las guardas posteriores sólo miran marcas que podrían no haberse creado. Este permiso repara el contrato existente deA17/addendum52, no inventa una política nueva de activación.

## Dirección de implementación aprobada, sujeta a revisión del nuevo SHA

1. Adoptar el mecanismo propuesto de **fence privado durable de escritura por tenant+warehouse**, mediante clave única y UPSERT que produzca versión de fila. Debe confrontar también un scope antes inexistente, sin depender de bloquear una fila que el snapshot aún no puede ver. No basta advisory/tablelock, SELECT previo o filtrar primero enabled=true. El helper sincroniza; no autoriza, activa, enrola historia ni cambia pertenencia antigua.
2. Configuración scopes INSERT/UPDATE/DELETE y altas/protocolos existentes deben participar en el mismo orden antes de decidir disponibilidad. Considerar identidad anterior/nueva con claves en orden estable. Conservar filas de fence para mantener el significado de una versión y no abrir un hueco por borrar/configurar de nuevo. Evitar el ciclo configuradorconscoperow→mutex frente a intakeconmutex→FORSHAREscope: después de tomar el fence no agregar un lock de scope en orden inverso. La propuesta concreta sustituye el FOR SHARE actual por el protocolo común y debe justificar catálogo/orden real de triggers en el nuevo diff.
3. Capturar el reloj de decisión después de la espera. El corte de starts_at no puede usar una hora anterior al bloqueo. Conservar relojes/identidades de intenciones históricas y replays; no re-fechar eventos ya confirmados ni trasladar esta sincronización a finanzas. OFF que confirmó un nacimiento antes deON conserva su vía legítima; ON confirmado antes del nacimiento tardío no deja una cabecera sin gobernar.
4. Conservar permisos, región/rol/tenant/warehouse/validadores de cada writer y ABI/defaults/owner/ACL/bodies originales0045/0449/0184/0496. No convertir parámetros browser o GUC en autoridad. No producir nuevos rechazos fuera del ámbito válido por imponer supuestos a entradas que antes eran legítimas; si aparece una incompatibilidad de contrato, documentarla antes de ampliar. Las relaciones nuevas son privadas, sin grantsAPI y con search_path/propiedad/postflight efectivos.
5. Un conflicto de escritura bajoRR o contención es rechazo de la operación completa, no éxito/no-op ni permiso de reintentar sólo una parte. Preservar SQLSTATE/causa en evidencia y mensaje seguro en las fronteras reales según el contrato. No ampliar silenciosamente retryable del split a cualquier error ni absorber40001/deadlock/timeouts como verde. Si la presentación exige otra ruta fuera70, demostrar caller/alcance antes de editarla. Transporte desconocido no se transforma en «no persistió».
6. La autoría cabe en0502 y los contratos/runner/tests/doc ya dentro70. Mantener a6 como corte anterior; nuevo diff separado incluye tablas/helpers/triggers de fence y conteos/pre-postflight/declaraciones coherentes. No modificar SQL histórica, number/base, fuerza, allowlists de detectores, librerías o configuración para ocultar un gate.

## Evidencia que deberá probarse después de GO, NO EJECUTADA ahora

RC yRR en ambos órdenes: OFFpreview→ONcommit→INSERTsincontexto rechaza/rollback/ceroheader-cajas-marcas parciales; birthOFF posee fence y ON espera hasta su commit; ámbito ausente→scopeINSERTON→RRviejo no evade la frontera; intakeON frente aOFF posterior mantiene clasificación y contexto serializados; starts_at que pasa durante espera usa hora posterior; OFF posterior conserva recibos/grupos ya nacidos. Comprobar también cambio de identidad/configuración sin inversión y ON/OFF repetidos, sin renovar historia o borrar fences usados.

Usar barreras reales y fixture válida. Un40001 aislado no demuestra corrección: rollback completo, reintento fresco autorizado y estado/AUD final deben corresponder a la intención. No reemitir documentos ni duplicar recepciones para satisfacer un assert. El primer éxito indebido del código previo será ROJO sólo al ejecutarse el oráculo funcional; errores de importación/fixture/preflight no cuentan. No retirar el fusible o aplicarSQL para obtener ese ROJO antes de GO.

La mejora de oráculos Portal aprobada permanece: conjunto/IDs/orden/empates/top8/4 exactos, historia sin cap; UNIQUE0080 intacto, cero vínculo con nombre honesto y duplicado real23505. No se exige fabricar dos vínculos imposibles o alterar esquema para proclamar ambigüedadSQL. No es otro defecto confirmado deRPC.

## Adopción y entrega

Leer/cotejar/copiar íntegro este documento en spec/handoff y confirmar adopción ANTES de modificar0502 por esta dirección. Revalidar guard y proteger sourcea6/contratos anteriores. Entregar nuevo SHA/diff/manifiesto70, matriz de oráculos/locks/errores/ACL y pendientes, con source/NO REPRODUCIDO frente a ejecución separados. Director revisará ese SHA; autorización de autoría no acepta el mecanismo final ni garantiza ausencia universal de deadlocks.

Sin install/tests/tipos/SQL/DB/Docker/HTTP/browser/verify/build/conocimiento por ahora. Sin main/merge/deploy/VPS/producción/PII/secretos/flags/activación nominal/billing/contactos/memoria/sharedObsidian.0495no se repite;0496/0501/0502sinaplicar. Las otras tareas y la receta actualBCV conservan sus propios límites.

<!-- DECISION FENCE SCOPE DIRECTOR ÍNTEGRA FIN -->

## Checkpoint autoral P1-70 posterior a a6 — fuente revisable, NO EJECUTADO

Misma tarea/claim/owner y baseD1. El corte a6a8c6c3601356d5647609ea1fa1ed5a8e7c8b44 permanece inmutable para la revisión anterior; este delta es otro checkpoint. La unión literal70 del addendum8f5614eb y la decisión fence3f0a4243 se cotejaron y copiaron íntegras arriba ANTES de sus cambios. No hay ruta71, nueva SDD/SQL/ABI/autoridad ni activación. Plan nuevo externo `C:/tmp/director-traspaso-20261020/0578-normal-validation/plan-relevo-p1-70.md`,12651bytes/SHA256 `22f41ffadd86b00d1cbf6e189f5f4094c5e2306d903850386d670b6e39fcb214`; planes6eb46941 y7ad04189 conservados. El recibo del checkpoint fija SHA, diff íntegroD1, deltaa6 y blobs de70.

### Diseño único adoptado para autoría del fence

0502 conserva fusible antes deDDL y rolloutOFF. Blob autoral0502 `a07a5c482eaae5cd9aa761da70ce404a40773fbf`, SHA256 `c781b5acb3d6684c97d94cc1de90198b85133bd43619f562d441effdc92e64e3`. La dirección aprobada por Director sólo autoriza redactar este diseño; no acepta parche/SQL/deadlocks ni lo convierte en política global.

- `scope_fences` es clave técnica durable tenant+warehouse, sin FKs/grants API. `fence_scope` toma gate de la misma identidad y siempre hace UPSERT de versión, incluso si scope aún no existe. El gate solo no evita snapshots RR obsoletos. Al competir con una escritura más reciente,40001 obliga rollback de todo comando y una lectura/decisión nueva, sin convertirlo en OFF o éxito parcial.
- `enrol_receipt` es el punto común después de validación y del INSERT real. Toma fence y luego `clock_timestamp()` para decidir vigencia. Una lectura OFF anterior no autoriza el nacimiento después de ON; una desactivación posterior no desmarca miembros. El FK implícito de receipts.scope_id hacia scopes.id toma KEY SHARE después del fence y forma parte del orden, no se ignora.
- Wrappers0045/0449 sólo preparan principal privado cuando las claves no son nulas, llaman cuerpos originales literales y limpian sólo su contexto. No hacen consulta/fence anticipada de scope que sustituya los errores heredados. El contexto no concede autoridad: en ON birth coteja operario activo/CN/tenant además de la identidad privada; en OFF conserva autoridad original0045. Error revierte la preparación con el comando. Llamada que se rechaza/no llega al INSERT, incluido replay0449 de caja recibida, conserva su error/ABI y no renueva reloj ni decide cohorte. No deja contexto vivo reutilizable.
- Studio obtiene ROW EXCLUSIVE de warehouse_receipts_cn antes de decidir/fence; coincide con el modo del INSERT que ya necesitaría y respeta0449 SHARE ROW EXCLUSIVE previamente en cola. No hay upgrade posterior ni camino nuevo fence→mesa en configuración.
- Config BEFORE INSERT/UPDATE/DELETE deduplica OLD/NEW y recorre tenant,warehouse en orden estable. ON/OFF/startsat usa gate bloqueante. Sólo DELETE/rekey con rowlock ya incompatible con el FK usa pg_try para entrar: P0001, message NORMAL_CONFLICT, hint dtd-client-normal, rollback íntegro, nunca retries parciales. Si entra, también escribe fence. Cambiar tenant/warehouse de un scope usado rechaza NORMAL_GOVERNED; DELETE/id conservan FK RESTRICT real. No borrar fence al borrar scope; recreación conserva versión. No se extiende este rechazo no bloqueante a intake, ON/OFF ordinario, roles API o split salvo su terna previamente aprobada.

### Matriz de órdenes y contextos, sujeta a prueba

| Camino efectivo | Orden local relevante | Autoridad/error y límite |
|---|---|---|
| Studio intake | sesión/permisos/input→ROW EXCLUSIVE receipts→gate bloqueante→UPSERT fence→scope vigente→header→birth reentrante→FK KEY SHARE scope | ON atómico; OFF explícito devuelve OFF.40001 no se reintenta en adaptador; sin revalidate/OV/avisos de éxito |
| INSERT legacy directo | validaciones SQL/ROW EXCLUSIVE del INSERT→birth gate→UPSERT→reloj/scope→contexto exigido si ON→FK | ON sin protocolo aborta comando. Clave ausente también serializa; OFF anterior no promete nacimiento futuro |
|0045 móvil | preparar principal privado→validadores/cuerpo literal0045→ROW EXCLUSIVE implícito→birth gate/fence→FK | Unknown/inactivo/qty0/nullwarehouse conservan errores originales antes del fence; contexto no sustituye cookie/pin/ABI |
|0449 boxes | preparar principal→cuatro validadores operario originales→SHARE ROW EXCLUSIVE receipts→compra/boxes originales→header→birth gate/fence→FK→adopción | P0130/P0137 y errores previos no cambian. No nuevo callerTS ni UI de0449 por este delta |
| Config INSERT | gate→UPSERT clave incluso ausente→FK catálogo/constraints nominales | privado, sin privilegio browser/API; no toma receipts ni scopeFORSHARE después del fence |
| Config ON/OFF/startsat | rowlock NO KEY UPDATE→gate bloqueante→UPSERT→cambio | compatible con FK KEY SHARE del birth; RR exige rollback/retry completo si40001 |
| Config DELETE/id/tenant/warehouse rekey | scope rowlock incompatible ya tomado→pg_try gate para claves OLD/NEW ordenadas→UPSERT en cada una→guards/constraints/FK | si gate ocupado: terna exacta, rollback también de primera clave; si usado: identidad intacta NORMAL_GOVERNED o23503 FK. No autoridad nueva ni retry parcial |
|0496 freeze/link | warehouse_receipt→snapshot vivo | orden previo intacto; no recalcular miembros previos ni crear snapshot vivo libre tras reemplazo |
|0184 split/POD |0184 paquete ya bloqueado→guard contenedor NOWAIT; POD contenedor→paquetes | F2 conserva cuerpo0184/roles; terna exacta tiene presentación local70. No40P01 como oráculo correcto |

La matriz describe estos caminos y claves OLD/NEW de una configuración. No certifica ausencia universal de deadlocks ni orden global de cualquier UPDATE administrativo multi-fila arbitrario. El configurador debe revertir todo comando ante conflicto; no continuar por fila. La aceptación exige interleavings reales con FK/ACL/cuerpos efectivos, también clave ausente/varias claves/recreación.

### Oráculos nuevos redactados dentro70

- Runner38: insert/rename/reactivación/bulk de código contra cohorte, ambos ganadores RC/RR y estado final único; el bulk perdedor tampoco deja su primera fila. Sin ampliar reserva global legacy. Roster edit vs form ambos órdenes RC/RR; misma recepción/dos contenedores; dos extensiones con revisión antigua. Perdedor completo no deja grupo, receipt link, ítem, snapshot, evento, alerta o AUD; refresh explícito requiere nueva intención y replay anterior conserva resultado.
-0496: congelar antes/después de link usa receipt→snapshot, live único ligado incluso primer freeze tardío compatible, replay antiguo inmutable. No habilita corrección tarifaria o membresía histórica. Fixture usaba origen sintético inválido a_mano y receipt sin destino: se corrigieron a manual actual0496 y preparación explícita Valencia antes de freeze; errores de fixture detectados por fuente, no fallos ejecutados del producto.
- Lote mixto:0244 real genera1/2/3,0449 recibe1+3 y luego2. Formar sólo1+3, intentar lote físico1+2 rechaza entero; no intersectar silenciosamente1+3. Extensión admite2, preserva snapshots/posiciones anteriores y exige revisión nueva antes de estibar2. Carreras lote/extensión ambos órdenes y dos PODs distintos del mismo grupo: ambos POD válidos, último completo cierra una vez; replay parcial histórico no cierra retroactivamente.
- Fence: RC/RR OFFpreview→ON comprometido, scope/fence antes ausente, nacimiento antesON/antesOFF, starts_at cruza espera real con reloj posterior; cola3sesiones ROW EXCLUSIVE→0449 fuerte en cola→Studio; FK scopeFORUPDATE contra birth gate, DELETE/rekey con terna exacta y rollback total. En rekey se fuerza NEW menor que OLD para escribir primera clave y fallar la segunda: no queda primera escritura incluso dentro del configurador. Reintento fresco protege scope usado con NORMAL_GOVERNED/23503.8 casos de validación/replay originales con snapshot RR viejo comprueban que no aparece40001/NORMAL en lugar del rechazo anterior ni contexto residual.
- Portal67: historia>1105 con conjunto exacto de IDs y fechas/ordenASC(clock,id);12 IDs literales adicionales con10fechas empatadas prueban historia y top8/top4 DESC(clock,id). Mutante recent ascendente y cap1000 deben morir por esos oráculos, no longitud sola. `portal-unlinked` conserva cero vínculos. Duplicado de auth_user_id real rechaza23505 y conserva UNIQUE0080; no fabricar dos vínculos SQL imposibles. TS ambiguo sólo defensa. Principal propio/tenant/client_id/error≠vacío y permisos documentales0439+0444 intactos.
- Addendum70:68 `app/m/ve/bodeguero/actions.ts`,69 `app/m/ve/bodeguero/_components/SplitQueueRetryRunner.tsx`,70 `app/m/_lib/__tests__/split-queue.test.ts` efectivamente editados. Sólo code P0001+message NORMAL_CONFLICT+hint dtd-client-normal devuelve mensaje aprobado y retryable local. Runner guarda entrada byte equivalente, sin toast/refresh/cuenta/reintento inmediato por ella; cola mixta sólo cuenta resueltas. Fixture46 conserva VE/0487 y agrega caller real/terna/negativos/P0013/autoridad. No tocar tipo/doble compartido/BodegueroClient/0184/0321.
- CN Studio/fixture52: INSERT tras preview OFF que recibe40001 devuelve error seguro normalFlowError, sin retry, código, ítems, evento, OV o revalidate de éxito. Otros errores legacy y0469 siguen intactos. Mock sólo cuenta transporte, no persistencia/RLS.

### Matriz de aceptación pendiente

| Contrato | Autoría/oráculo al checkpoint70 | Estado y faltantes propios |
|---|---|---|
| A1–A4 normal/actor/identidad | SQL35+39/Drawer y metadatos completos/checked | NO EJECUTADO: SQL/ACL/API/UI y matriz servicio/destino/tenant completa |
| A5–A8 extensión/0496 |35/38 recepción/caja/snapshot/replay/carreras | NO EJECUTADO: deferred/catálogo/reemplazo compatible e incompatible y permisos reales |
| A9 código | global mínimo / ambos órdenesRC-RR insert/rename/reactivate/bulk | NO EJECUTADO: mutex/rollback/fresh-retry/lector público sin tenant reales |
| A10–A12 plan/estiba/sello | lote mixto real + carreras extensión/planviejo/sello | NO EJECUTADO: faltan ampliar carreras plan antes/anotar/deshacer, close vs estiba/plan y variantes de drain; no se declaran escritas o aceptadas |
| A13–A14 estados/POD |0477/transición técnica/VE/roles originales, F1AUD/F2guards, PODdistintos | NO EJECUTADO: ACL/0484/0486/SENIAT/TMS/0487 completos, regresiones, retorno/contradicción y prueba real rollback/locks |
| A15 Portal/CN | IDs/orden/empate/feeds/23505, reales TS de principal e historia | NO EJECUTADO: RLS/documentos/Storage/Portal-only/helperNULL/híbrido y errores reales |
| A16 efectos | AUD/ref por grupo+pod_request_ref, fechas/replay/alertas, OVlegacy fuera confirmación | NO EJECUTADO: trazas/fechas/facturas constantes y finanzas legacy, no4.3 |
| A17 rollout/fence | fusible/OFF,19guards/20RPC+2helpers privados, scope/key ausente y reloj/cola/FK oráculos | NO EJECUTADO: catálogo, símbolos18/26, schema cache, drain/serialización y configuración reales |
| A18 visible | UI/Demo fixtures/E2E50 y split runner autoral | NO EJECUTADO: infraestructura real no preparada/GO, HTTP/Auth/Storage/browser/CSS/oscuro/móvil/teclado/UI-check |

Todos los oráculos son autoría, no tests pasados. F1/F2 reparados por fuente y F3 dirección autorizada se mantienen NO REPRODUCIDO/NO EJECUTADO hasta prueba del SHA nuevo. A6 no se altera retrospectivamente. `pnpm verify`, tests, SQL, tipos/lint, runtime, recursos, UI y conocimiento no se ejecutaron. Comparaciones Git/nativas de hashes, copia contractual íntegra/allowlist y diffcheck no son aceptación funcional.

### Pendiente propio fuera70 — propuesta sin edición

Dependencia introducida por el fence, no bug ajeno cerrado: `app/m/cn/nueva/actions.ts` devuelve mensaje bruto de0045;40001 o denegación gobernada podría verse técnico. Leídas completas143líneas y fixture372 en a6/D1; blobs `c587353da84ae32da584d22a6ee162d647ac4ed1` y `320b22001309bb1d2c4a0c1cd0bc89c380ff594d`. Propuesta externa `C:/tmp/director-traspaso-20261020/0578-normal-validation/propuesta-presentacion-intake-movil-0045.md`,4239bytes/SHA256 `9a8397c80f30e6fab354e7775b3d8f126f14e33a74fc7ccd0aa32251d73a4aa1`, sólo esas dos rutas, mapper local exacto/no retryable/no reintento y positivos/negativos heredados conservados. Ambas permanecen intactas hasta addendum/adopción. No hay petición de decisión rutinaria a Sam; sólo revisión de ampliación al Director. Mientras tanto no aceptar esa presentación en carrera móvil. No paraliza la revisión del delta70 ni autoriza nueva superficie.

### Fuentes y límites de lectura de este delta

- SQL0502 blob a07a5c48: fence_scope274–291, guard_scope_configuration292–314, trigger315–316, enrol_receipt318–351, wrappers0045/0449 493–542, client_consolidation_intake577–628 y postflight2400–2459 leídos por cuerpos completos del delta. move_original/contratos de origen464–491 conservan MD5 originales0045 f9e61f3ae50fca3f4752d61fb1d20f86 y0449 bf85211ecef554d573b9670d6011af37. Migraciones históricas0184/0321/0496 intactas frente a a6/D1;0184 blob774ecd95287ebab892f93d1e0f5f8ed201f3e4c1 y prosrcLFce9d72146b0c734ce64e50e899e581fe preservados. No ejecución de catálogo.
- Runner38 blob6d900e4dc45b8a35a0ee7e5b7162c4ebf9f94810: revisión1–682 por rangos; Session/lock helpers1–156, code157–203, roster204–233, mismo receipt234–251, extensiones252–275,0496 276–300, lote301–330, POD331–364, scope365–380, OFF→ON381–413, birth/config414–439, reloj440–463, cola464–491, FK492–529, validadores530–563, orquestación/cleanup564–682. Fixture35: helpers1–282, scope286–335, Portal474–547, lote549–572 leídos completos. Fixture52 completa1–246 blob318d393dea852336faaf92473404d0c2d39d8c2b. Tres rutas70 completas: actions218, runner113, fixture205 líneas, blobs c28d84bccb143b4a3a70c3a58646a4f3000fed49/eeb612ac54d1c0c6382454f21c550ddfb2382e40/d638a0a400d42e8445ee60eddf4edcabdb657357. Pruebas sólo redactadas, sin import/parse/exec.
- Acción móvil0045 y fixture sólo lecturas propias externas; búsqueda app/lib sin caller TS0449. El lector antiguo recibir usa otraRPC y no se altera por inferencia. No nuevo inventario masivo ni atribución de prueba a lecturas.

La siguiente acción requiere revisión del SHA fijo y asignación explícita de turno por Director. Este checkpoint no cierra4.2, no libera claim, no retira fusible, no activa cohorte, no integra ni permite producción. Conserva legacy, facturaOV anterior y límites financieros4.3.


## Adopción íntegra addendum72 antes de las dos rutas móviles

Fuente externa042-addendum-director-0578-72-rutas-intake-movil.md,8267bytes/SHA256 b7800a86b399b4478d5d905cd1e5f9f8a1ae8fc306135b805f56bf649c05a058, leída completa y cotejada. Unión literal72 única =70previas+exactamente app/m/cn/nueva/actions.ts y su actions.test.ts. Guard/owner retenidos, preimágenes b85 c587353da84ae32da584d22a6ee162d647ac4ed1/320b22001309bb1d2c4a0c1cd0bc89c380ff594d intactas antes de tocar ambas. Registro externo adopcion72-preimagenes-b85.json. Sólo mapper local exacto y oráculos; sin runtime ni inferir funcionamiento. El corte70 b85 permanece inmutable y su pendiente sólo se incorpora en otro SHA. Turno siguiente reservado al diagnósticoPortal, P1 sigue autoría exclusivamente.

<!-- ADDENDUM72 DIRECTOR ÍNTEGRO INICIO -->
# SDD0578 · addendum Director72, presentación del rechazo de alta móvil

21 de octubre de2026. AUTORIZADO SÓLO PARA AUTORÍA P1. NO GO de instalación, runtime o pruebas. Mismos raíz C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0578-envios-cliente-camino-normal, rama codex/sdd-0578-envios-cliente-camino-normal, owner worker-0578normal-01a15a4e-ddf0-7d82-8656-d9dc56b58468, claim vigente, baseD1 1ec5e85f736b7826cf5b6e8781757dc4cf950733 y PR318DRAFT. Unión literal70+2=72, sin tercera ruta nueva. No cambia la dirección de fence/orden gate→fence→FK, cohortesOFF ni fusible0502 antesDDL. a6a8c6c3601356d5647609ea1fa1ed5a8e7c8b44 conserva su revisión anterior; toda nueva implementación requiere revisión de otro SHA.

## Evidencia y alcance

Director leyó íntegros propuesta0578-normal-validation/propuesta-presentacion-intake-movil-0045.md,4239bytes/SHA2569a8397c80f30e6fab354e7775b3d8f126f14e33a74fc7ccd0aa32251d73a4aa1, y objetos a6 de actions.ts143líneas/blob c587353da84ae32da584d22a6ee162d647ac4ed1 y actions.test.ts372líneas/blob320b22001309bb1d2c4a0c1cd0bc89c380ff594d. La acción llama0045 real, luego vincula/avisa y revalida sólo tras código exitoso. Su error101–104 interpola message sin mapper. La nueva respuesta de concurrencia/denegación daría texto técnico por fuente, NO REPRODUCIDO. Fixtures prueban acción/motor con store sintético, no DB/RLS/serialización.

La búsqueda del Worker no halló callerTS0449 en app/lib y recibir/actions.ts usa otraRPC; no es prueba universal de inexistencia y no autoriza tocar ese flujo. No se cambia0045/0449 históricos, librería compartida, móvilVE o regla de avisos/OV. ERR-01 y estado veraz se satisfacen por el contrato de autoría; eficacia/recorrido todavía NO EJECUTADOS.

## Cambio acotado y aceptación futura

1. Sólo rama de error de createReceiptFromOperarioAction en app/m/cn/nueva/actions.ts. Conservar sesión, validación, privacidad del nombre resuelto en servidor, argumentos y únicaRPC. Reconocer code EXACTO40001 o terna codeP0001/hintdtd-client-normal/message EXACTO en NORMAL_GOVERNED,NORMAL_CONFLICT,NORMAL_FORBIDDEN. No includes, coerción o reconocimiento por texto parcial.
2. Copy fijo de esas respuestas: «No se pudo confirmar la recepción. Revisa su estado y vuelve a intentarlo.» Sin dato técnico/identidad y sin afirmar persistencia o no-persistencia desconocida. Sin ok/receiptId/receiptCode, retryable, reintentoRPC, referencia nueva, vínculo/aviso/updates o revalidate de éxito. No ampliar tipos compartidos ni importar mapperStudio. El formulario conserva su gestión de error actual.
3. Otros errores conservan exactamente contrato heredado, incluidoP0002 y transporte que no cumpla los predicados. No normalizar cualquiererror a esta rama. Mantener console existente sin nueva captura o datos. Positivo existente y vínculos/OV/privacidad no se tocan.
4. En actions.test.ts mantener todos los casos/oráculos actuales y el store/motor real. Doblar sólo respuesta de RPC ya doblada, sin editar lectores-admin-double o notificadores. Añadir cada código exacto y negativos discordantes de code/hint/message, P0002literal y desconocido. Verificar única llamada con argumentos conservados, cero escritura/vínculo/aviso/revalidate/retry y ninguna forma de éxito. No fabricar ROJO funcional por fixture/import y no afirmar atomicidadDB con el doble.
5. Adopción íntegra y guard antes de editar las dos rutas. Conservar preimágenes/D1 y contrato70 SHA8f5614ebd8683d1bff5b44c410b50089c2e964087cf16aba1d6f20a32c595ef4 intacto. Copiar literal72 en spec/handoff y permitir al guard sólo esta unión. Puede sellarse primero el checkpoint70, conservando este pendiente hasta que se incorpore; no atribuirle aceptación móvil antes del delta72 revisado.

## Allowlist acumulada literal72

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
app/m/ve/bodeguero/actions.ts
app/m/ve/bodeguero/_components/SplitQueueRetryRunner.tsx
app/m/_lib/__tests__/split-queue.test.ts
app/m/cn/nueva/actions.ts
app/m/cn/nueva/actions.test.ts
```

## Entrega y límites

Entregar SHA/árbol/diff propio vsD1 y delta desde corte anterior, manifiesto de blobs y huellas, cobertura72 exacta, contratos/oráculos/ACL/ordenes y pendientes. Tests, instalación, SQL local, DB, Docker, navegador, types/lintglobal/verify/build y conocimiento requieren turno/GO posterior. Todos siguen NO EJECUTADOS por este permiso.

Sin main/merge/deploy/VPS/producción/PII/secretos/cuentas/billing/contactos/memoria/sharedObsidian/flags o activación nominal.0495 no se repite y0496/0501/0502 no se aplican. Nueva rama de sincronización no autoriza integrar o publicar en producción ni cambia las condiciones de los demás Workers. Preparación por fuente es reversible y no necesita permiso adicional de Sam dentro del encargo vigente.
<!-- ADDENDUM72 DIRECTOR ÍNTEGRO FIN -->

## Checkpoint autoral P1-72 — presentación móvil, sin cambio SQL

Delta separado sobre corte70 `b85d2ae7b8cbb7748df1a9bb02c8a97fc6488e24`; b85/a6 siguen inmutables. Adopción72 fuente8267bytes/SHA b7800a86b399b4478d5d905cd1e5f9f8a1ae8fc306135b805f56bf649c05a058 copiada íntegra arriba y confirmada al Director ANTES de tocar las dos rutas. Preimágenes b85=D1/a6 guardadas en `C:/tmp/director-traspaso-20261020/0578-normal-validation/adopcion72-preimagenes-b85.json`,SHA256 a912e0ef7ede98ad0e8683a66b0f5bc39c738c88e9958df822620b69b5dd0073. Unión72 literal sin ruta73, mismo owner/claim/WT/rama/baseD1.

- Ruta71 `app/m/cn/nueva/actions.ts`,150líneas/blob `965a0ad6e63bd61f21dad9a310aea07c72107c31`: cambio101–111 en la rama existente de error de createReceiptFromOperarioAction; leída completa. Sólo code exacto40001 o P0001+hintdtd-client-normal+message exactamente NORMAL_GOVERNED/NORMAL_CONFLICT/NORMAL_FORBIDDEN devuelven copy aprobado. No includes/coerción/texto parcial. No nuevo retryable/retry, ok/id/código, referencia, permiso, aviso/OV o revalidate de éxito. Sesión, validador, privacidad de nombre servidor, argumentos0045 y console mantienen sus cuerpos existentes; resto de errores conserva retorno literal, incluidoP0002.
- Ruta72 `app/m/cn/nueva/actions.test.ts`,442líneas/blob `3824db617d25e0fb41fdc5f53c757e37db9b9507`: dos imports de mocks ya locales y nuevo bloque374–442. Comparación Git/nativa verificó el cuerpo anterior exacto después de excluir sólo los dos imports y los casos añadidos: todos los oráculos precedentes1–374 permanecen sin cambio.4positivos y9discordancias/códigos/transportes, más sesión/input previo:14escenarios redactados, ninguno ejecutado. Una únicaRPC con argumentos completos, nombre no confiable del dispositivo ignorado, store idéntico/cero inserts/updates/avisos/revalidate y ningún éxito/retryable; P0002literal/errores desconocidos intactos. Sólo cambia respuesta deRPC ya doblada, no lectores-admin-double, motor o notificadores. Mock API no prueba rollback, RLS, serialización ni persistencia real.
-0502/runner/fence/ACL/ordenes/fechas/catálogos no cambian frente a b85; mismo blob0502 a07a5c482eaae5cd9aa761da70ce404a40773fbf/SHA256c781b5acb3d6684c97d94cc1de90198b85133bd43619f562d441effdc92e64e3. Fusible antesDDL/OFF intactos.0184/0321/0045/0449/0496 históricos y compartidos intactos. Sin nueva RPC pública/declaración/capability ni número SQL.

La propuesta9a8397c8 antes fuera70 está incorporada sólo como autoría72. No es aceptación funcional: el caso de presentación móvil requiere revisión del nuevo SHA y pruebas futuras. Todo A1–A18 conserva NO EJECUTADO y los faltantes del plan70; ninguna inferencia de bloqueo/permiso/cobertura o política nueva se convierte en verde por este mapper.

Plan actual externo `C:/tmp/director-traspaso-20261020/0578-normal-validation/plan-relevo-p1-72.md`,3640bytes/SHA256 `4c52c6cbfe4a17d65d6f5c11be494daec21fcdcabf5099fc44665693fb3a84f9` compone plan70 conservado22f41ffa y sólo añade focal de ruta72. Recibo inmutable70 `checkpoint-p1-70-b85d2ae7b-recibo.md`,3082bytes/SHA2567ff27293fecb03361dfc870784714b6715c1fe8c8e6a18b68f1675cd202b40a8 confirma push/GH318DRAFT/headb85/baseD1/70rutas/checks[]/body exacto antes de este delta. Recibo nuevo fija SHA/árbol/diffs/blob72/readback. Cambios rastreados del delta72: sólo estas dos rutas+spec/handoff, cuatro en total.

Estado de turnos actualizado por Director: BCV GO05B FALLÓ+INCOMPLETO y recursos devueltos, turno siguiente reservado al diagnósticoPortal.0578 sigue sólo P1 sin GO; no tests/instalación/parser/tipos/lint/SQL/DB/Docker/HTTP/Auth/Storage/browser/UI/build/verify/conocimiento. Guard, copia literal/adopción/hash/diffcheck y preservación fuente son comprobaciones nativas/Git, no eficacia del código. Claim retenido, PRDRAFT, sin main/merge/deploy/prod/0495/activación4.2 ni cambios financieros4.3.


## Adopción previa de informe y decisión P2 claves no-op

Informe peer31488bytes/SHA c04d28b2a510788a82d33e01ecb48dd001f68228b307c522d5ba5bf4acf3a831 leído completo211líneas; salida inicial truncada completada79–137. Decisión Director4918bytes/SHA06367e187616599a10ea5c208461ad5bbe479587a406878cc8efc63f6b678dfb leída completa/cotejada. Copias íntegras abajo ANTES de editar producto/oráculos. Dirección concreta aprobada: prepaso sólo gate, general siempre escribe fence una vez; sustituye exclusivamente alternativa de doble UPSERT del peer§5.2. Es P2 por fuente NO REPRODUCIDO, sin aceptación funcional. Preimagen792f y seis rutas fijadas en claves-noop-preimagenes-792f.json. Misma unión72/claim/baseD1/fusible/OFF; no runtime.

<!-- INFORME PEER FENCE 792 ÍNTEGRO INICIO -->
# SDD-0578 · revisión independiente del fence b85 / 792

2026-10-21. Revisor: `/root/revision_bcv_prevuelo`. Destinatario: Director. Sólo fuentes fijas, comparaciones textuales y documentación primaria; ninguna ejecución de producto, SQL o pruebas. Única escritura de esta revisión: este informe externo. BCV permanece quieto después del handoff documental b179363d; su claim retenido y GO05B FALLÓ/INCOMPLETO no cambian por esta lectura.

**Dictamen acotado:** el fence durable de b85 corrige por mecanismo la lectura OFF antigua descrita en a6, incluso con scope antes ausente, y mueve el reloj después de la espera. Su aceptación RC/RR sigue **NO EJECUTADA**. F1 AUD por grupo y F2 locks 0184/POD conservan sus mecanismos corregidos; C1 de conjuntos/orden/top-N tiene ahora oráculos y mutantes específicos escritos. Encontré **un P2 material residual por fuente, NO REPRODUCIDO**: la entrada bloqueante para un UPDATE que nombra una clave sin cambiar su valor todavía permite la inversión fila→gate frente a gate→FK. Se detalla en §4, con solución prospectiva estrecha y oráculo futuro; no es un bypass de autoridad ni un deadlock medido.

## 1. Corte, precedencia y lecturas efectivas

- Base primaria D1: `1ec5e85f736b7826cf5b6e8781757dc4cf950733`.
- Anterior a6: `a6a8c6c3601356d5647609ea1fa1ed5a8e7c8b44`.
- Candidato: `b85d2ae7b8cbb7748df1a9bb02c8a97fc6488e24`.
- Sucesor: `792f00a8d1d7883cce6ad7691eef74b2980382ea`.
- Almacén de objetos leído: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`. No se usa el checkout mutable de 0578 como identidad del corte. Git se limitó a show/rev-parse/diff/cat-file de lectura; sin refs, commits, claims, checkout o configuración modificados.
- Informe base leído **completo antes del delta**: `C:/tmp/director-traspaso-20261020/0578-revision-sql0502-a6a8c6c3-peer.md`, 24069 bytes, SHA256 `9de49eb3d7d47769eedcf94d52f2df30176a86ed5e0a82f2b1af0410c043fda4`. Sus resultados son antecedentes de lectura; no se hereda ejecución inexistente.
- Decisión de fence leída completa: `0578-decision-fence-scope-rr-director.md`, SHA256 `3f0a4243cf244de6333a7919af15cf88de2a2dffe2239d297a6695c7f2f09c44`. Autoriza autoría previa, no aplicación o aceptación de este candidato.
- Los cinco objetos asignados tienen el mismo blob en b85 y 792; diff exclusivo de esas rutas entre ambos terminó sin diferencias. La fixture estructural también es idéntica a a6. Las trece fuentes históricas enumeradas en §10 son idénticas entre D1 y b85, comprobado por diff fijo.

| Fuente | Lectura humana efectivamente realizada |
|---|---|
| `supabase/migrations/0502_consolidacion_cliente_camino_normal.sql` en b85 | Delta a6→b85 completo, 103 inserciones/20 eliminaciones. Rangos actuales 1–674 y 1959–2468; incluye tablas/contexto/fence, guardas de recepción, wrappers 0045/0449, binding 0496, POD/F1/F2, Portal y ACL/postflight. No afirmo lectura humana íntegra de las 2468 líneas: 675–1958 sólo se inventarió por funciones y conserva fuera de este foco su revisión anterior. |
| `scripts/check-client-consolidation-concurrency.mjs` | **Completo, 1–682**. |
| `supabase/tests/consolidacion_cliente_normal.test.sql` | **Completo, 1–632**. |
| `lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts` | **Completo, 1–243**. |
| `supabase/tests/_consolidacion_cliente_normal_schema.sql` | 1–85,704–716,735–825,1820–1843 e inventario de includes/funciones. Comparación textual completa de siete cuerpos copiados, separada de lectura humana completa. No afirmo releer las 1843 líneas de fixture. |
|0045/0449/0184/0321/0336/0296| Cuerpos completos pertinentes:0045 1–163;0449 1–250;0184 1–159;0321 1–264;0336 1–335;0296 1–136. |
|0068/0072/0211/0487/0496|0068 PODv1 71–156;0072 21–80,264–341,498–506;0211 19–22, además de otros fragmentos de su sweep;0487 90–282;0496 275–405,408–490,650–747. No se atribuye lectura íntegra de los archivos largos. |
|0502 anterior a6| Relectura 264–290,430–479,509–521 para confrontar el cambio de decisión/validación; el informe base conserva sus demás rangos. |

Las primeras salidas largas truncadas se completaron con rangos menores antes de cerrar las lecturas completas declaradas. No se interpretó output no visible como leído. Se aplicó la skill Supabase ya adoptada y se leyó `supabase-postgres-best-practices/SKILL.md` con sus referencias de orden de locks y advisory. Son apoyo de lectura, no permiso de runtime. La recomendación genérica de advisory no sustituye el fence durable aprobado: aquí la escritura de versión cumple una finalidad MVCC/RR adicional.

## 2. F3 de a6 · mecanismo corregido y autoridad preservada

En a6:268–269, `enrol_receipt` decidía con SELECT de scope y podía observar OFF bajo snapshot RR fijado antes de ON. Sus wrappers 440–441/459–460 también decidían por SELECT. Este antecedente sigue **NO REPRODUCIDO**; no se etiqueta ROJO dinámico.

En b85:

- `scope_fences`69–74 tiene PK `(tenant_id,warehouse_id)` y contador durable. No depende de FK a una scope visible ni elimina la fila al borrar/recrear configuración. El helper274–291 toma gate y después hace UPSERT con incremento real, no DO NOTHING. Puede confrontar una clave que no existía en el snapshot.
- `guard_scope_configuration`292–316 reúne OLD/NEW, elimina duplicados y los ordena por tenant/warehouse. Configuración INSERT/UPDATE/DELETE participa en el mismo gate y escritura. DELETE y cambio efectivo de id/tenant/warehouse usan try; ON/OFF/starts_at ordinarios mantienen espera. Un retarget tenant/warehouse de scope ya usado rechaza NORMAL_GOVERNED; las FK/UNIQUE siguen decidiendo el DML real.
- `enrol_receipt`325–328 pasa por el fence, **después** captura `clock_timestamp()` y consulta enabled/starts_at. Si está ON exige el contexto privado, identidad del writer y estado de nacimiento; también revalida operario CN activo/tenant340–342. Un caller directo antiguo no obtiene permiso por atravesar el gate.
- El intake Studio589–592 toma ROW EXCLUSIVE de la mesa de recepciones **antes** de gate/fence y ya no añade FOR SHARE de scope después. Los wrappers 493–542 no consultan ON ni toman el fence antes de sus validadores originales; preparan sólo el principal privado y delegan al cuerpo preservado.

La inferencia RC/RR está apoyada en la [documentación oficial de aislamiento PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html): bajo RC ON CONFLICT DO UPDATE puede alcanzar la versión concurrente; bajo RR una modificación incompatible exige abortar/reintentar toda la transacción. `enrol_receipt` conserva volatilidad por defecto y el helper es VOLATILE explícito; las consultas internas no quedan etiquetadas STABLE. La regla de snapshots internos se consultó en [volatilidad de funciones](https://www.postgresql.org/docs/17/xfunc-volatility.html). Esto justifica el diseño por fuente; no acredita el SQLSTATE ni el estado final de una ejecución local.

No se promete exclusión universal, disponibilidad diaria, ausencia total de deadlocks, exactly-once o protección frente a DDL concurrente. El gate no autoriza activar un ámbito nominal, enrolar historia o modificar una pertenencia ya nacida.

## 3. Orden de locks leído y oráculos nuevos escritos

| Camino | Orden por fuente / caso escrito |
|---|---|
|Intake Studio| Mesa `warehouse_receipts_cn` ROW EXCLUSIVE589 → advisory gate590 → UPSERT durable → decisión de scope → INSERT de cabecera605 → enrolamiento/fence reentrante325 → FK de scope344. |
|Alta0045| Validadores0045:52–76 → DML INSERT de la línea 86 y lock implícito de mesa → trigger de nacimiento325 → gate/fence → decisión y FK. No adelantar fence para ocultar errores de cantidad/identidad. |
|Recepción0449| Validadores de operario28–44 → SHARE ROW EXCLUSIVE de mesa48 → prealerta FOR UPDATE72 → cajas FOR UPDATE92 → INSERT109 → gate/fence/FK del nacimiento. |
|Config no-clave ordinaria| UPDATE obtiene NO KEY UPDATE de fila; trigger adquiere gate bloqueante → fence. Ese modo de fila es compatible con KEY SHARE del FK. No se añade lock explícito de scope después del gate. |
|DELETE/rekey efectivo| Fila puede estar bloqueada en modo incompatible antes de BEFORE; try del gate evita esperar en sentido inverso, o rechaza íntegramente NORMAL_CONFLICT. Claves OLD/NEW ordenadas. |

El runner ahora escribe, **sin ejecución acreditada**:

- `offToOnSnapshot`381–411: RC/RR, OFF real y ámbito/fence antes ausentes; snapshot fijado, ON confirmado antes del INSERT antiguo, rechazo o40001 admitido sólo con rollback y cero cabecera/cajas/marca. Retry fresco por intake, OFF posterior conserva cohorte nacida.
- `birthBeforeConfig`414–438: ambos órdenes (birth OFF antes de ON e intake ON antes de OFF), espera real observada,40001 de configurador RR y retry del comando completo; compara la cabecera completa y clasificación/reloj anteriores.
- `startsAfterWait`440–462: observa bloqueo antes de starts_at, espera la condición de reloj DB y confirma después; nacimiento antiguo debe rechazar y el intake fresco queda enrolado con reloj posterior. No usa una pausa sola como oráculo.
- `receiptTableQueue`464–490: tres sesiones, ROW EXCLUSIVE antigua → SHARE ROW EXCLUSIVE0449 en cola → intake Studio. Coteja bloqueadores reales y estados finales, dos recepciones/cajas, sin enrolamiento inventado en OFF.
- `scopeForeignKeyInversion`492–527: DELETE/rekey, RC/RR; retiene la fila y fuerza al intake real a esperar por FK. Exige estado/message/hint exactos de NORMAL_CONFLICT, rollback de la primera escritura cuando el rechazo ocurre en la segunda clave, luego birth confirmado y FK/retarget intactos. El caso modela el lock previo al BEFORE, no sustituye la FK por un lock inventado del producto.
- SQL 286–335: ON/OFF repetidos, ambas claves, delete/recreate con fence persistente, historia de receipts igual, scope usado sin retarget y API sin permiso. SQL 324–334 y runner 530–562: rechazos0045/0449 antes de nacimiento mantienen causa y no dejan autoridad prestada; incluye cantidad/warehouseNULL/unknown box/already-received/opNULL/inactivo/VE/sin warehouse.

El caso nuevo de §4 **no aparece** entre esos DELETE/rekey efectivos. No se le hereda cobertura desde ellos.

## 4. P2 residual de fuente · clave nombrada sin cambio de valor

**Estado: defecto material del mecanismo de contención por fuente, NO REPRODUCIDO.** No es bypass de enrolamiento, lectura de datos ajenos ni éxito parcial demostrado. Afecta al configurador nominal privado cuando nombra una clave en SET, aunque conserve el valor; no depende de que un rol API tenga acceso a scopes.

0502:298–303 selecciona la entrada try según diferencias de valores: DELETE o `new.id/tenant_id/warehouse_id IS DISTINCT FROM old...`. Para `UPDATE ... SET id=id`, esas tres diferencias son falsas y el helper288 elige advisory bloqueante. Lo mismo puede suceder al reenviar warehouse_id o tenant_id iguales, incluso junto a un cambio real de enabled. La sintaxis actual admite esos comandos y ninguna guarda los excluye.

Fuentes primarias PostgreSQL 17 consultadas, rangos **L de la vista textual** de REL_17_STABLE, sin atribuirlos al binario local no ejercido:

| Pasaje primario | Hecho leído |
|---|---|
|[execUtils.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/executor/execUtils.c), L1208–1225 yL1242–1254| ExecGetUpdatedCols toma el bitmap de columnas de la sentencia; ExecGetAllUpdatedCols lo combina con las generadas. No compara OLD/NEW. |
|[execMain.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/executor/execMain.c), L2268–2284| ExecUpdateLockMode intersecta ese bitmap con INDEX_ATTR_BITMAP_KEY; si hay intersección devuelve LockTupleExclusive. |
|[trigger.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/commands/trigger.c), L2827–2844, L2892–2923 yL3196–3199| Obtiene la fila con el modo calculado antes de invocar el BEFORE de usuario; GetTupleForTrigger usa table_tuple_lock con LockWaitBlock. |
|[ri_triggers.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/adt/ri_triggers.c), L334–363 yL390–402| La comprobación FK de INSERT construye la consulta al padre con KEY SHARE; el enrolamiento0502:344 referencia scopes.id definido en76–80. |

La documentación [CREATE TRIGGER, notas y parámetros](https://www.postgresql.org/docs/17/sql-createtrigger.html) distingue una columna nombrada de su cambio de valor; UPDATE OF se activa también cuando se asigna el mismo valor. La [tabla de locks de fila](https://www.postgresql.org/docs/17/explicit-locking.html) distingue el conflicto de FOR UPDATE con KEY SHARE y la compatibilidad de NO KEY UPDATE. No se ejecutó el ejemplo ni se obtuvo un 40P01 local.

Intercalación sustentada, **resultado inferido**:

1. Configuración obtiene el lock exclusivo de la fila de scope para un UPDATE que nombra id, aunque el valor final sea igual; el planificador/ejecutor ya eligió ese modo antes del BEFORE.
2. Un intake posee el gate y ha escrito el fence; llega a insertar la marca y espera KEY SHARE de esa fila padre. Es el corte entre adquisición de fila y ejecución del trigger que ya modela el runner para DELETE/rekey.
3. El BEFORE del configurador ve OLD=NEW en claves, escoge entrada bloqueante y espera el gate que mantiene el intake.
4. Queda ciclo fila→gate y gate→FK/fila. El detector o timeout puede abortar una parte; no es el rechazo controlado previsto y el runner actual no mide esta variante.

No se requiere afirmar un caller de producción que hoy emita ese UPDATE. El SQL prospectivo gobierna todo UPDATE permitido de esa relación privada; la omisión es demostrable en su selección de modo. No se eleva a P1 ni se presenta como incidencia productiva.

## 5. Solución mínima prospectiva propuesta, todavía sin código ni autorización

Conservar la espera ordinaria para UPDATE que **no nombre** id/tenant_id/warehouse_id. Detectar por definición de trigger las claves nombradas, sin interpretar texto de consulta, claims, GUC de aplicación o diferencias de valores como sustituto del bitmap sintáctico.

Una opción acotada, para decisión del Director/Writer:

1. Añadir un BEFORE UPDATE OF `id,tenant_id,warehouse_id` a scopes que se ejecute alfabéticamente **antes** del guard general. Puede reutilizar `guard_scope_configuration` con argumento literal de trigger que fuerce try, o un helper privado equivalente. Ese argumento nace del catálogo controlado por owner; no de p_input/browser. No se presupone una variable PL/pgSQL inexistente para leer columnas actualizadas.
2. Su primera entrada deduplica/ordena las mismas claves OLD/NEW y toma **try gate → UPSERT** o falla con la terna existente NORMAL_CONFLICT. El guard general se mantiene para INSERT/DELETE y todo UPDATE, incluidos los no-clave ON/OFF/starts_at. Si ambos BEFORE se ejecutan, el general entra sobre gates ya poseídos por la misma transacción; su segunda escritura técnica no renueva historia o relojes de negocio. Evitar agregar estado de autoridad sólo para omitir esa segunda pasada.
3. No generalizar try a todos los UPDATE, no retirar FK/UNIQUE, no devolver OFF/éxito ante conflicto y no cambiar bodies0045/0449/0184/0496. Conservar el rechazo de retarget usado y el orden estable de varias claves. La clasificación por diferencia de valor puede seguir como defensa, pero no como único detector de UPDATE con lock de clave.
4. Revalidar catálogo real: trigger ligado a la relación correcta, BEFORE/ROW/UPDATE, atributos de las tres claves, argumentos literales esperados y orden previo efectivo. Actualizar el postflight de 19 guardas de b85 al conjunto exacto resultante, sin sustituir la comprobación por una cifra permisiva. Reutilizar mismas ACL/owner/search_path privados.

La base oficial para esa opción es UPDATE OF y el orden alfabético documentados en [CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html). Esta es una propuesta de revisión, no SQL instalado, política nueva ni edición del árbol. El Writer debe mostrar el diff y el Director aceptar la dirección concreta.

Rutas que podrían requerir edición prospectiva: 0502, su contrato SQL, el runner de concurrencia y postflight/oráculos pertinentes del test de migración, más spec 0578 / handoff 042. Ya son superficies de 0578; este informe **no cambia ni amplía** la allowlist 72. No requiere tocar históricas ni adaptadores de aplicación revisados por el Director.

Oráculo mínimo futuro, **NO EJECUTADO**:

- Reutilizar fixture descartable y dos sesiones del caso de FK, con barrera real que certifique al intake esperando al configurador después de poseer gate/fence. El lock previo explícito modela la ventana del BEFORE; declarar ese montaje y comprobar por separado la elección de modo a través de la sentencia de clave, sin adjudicar al producto un SELECT añadido.
- Ensayar `SET id=id`, clave warehouse igual y clave igual junto a enabled cambiado. No aceptar40P01,55P03,57014,25P02 ni «cualquier excepción». Con la terna actual conservada, esperar P0001/NORMAL_CONFLICT/hint dtd-client-normal, rollback completo y liberación que permita confirmar exactamente el birth autorizado.
- Comparar scope/recibos/cajas/contextos/intakes/eventos/AUD antes-después, y la primera clave escrita si hay dos. Cero efecto parcial del configurador; un birth legítimo, historia/reloj preservados, ningún éxito cacheado. Retry fresco explícito y positivo no contencioso del UPDATE sin cambio.
- Contrastar que UPDATE de enabled/starts_at **sin nombrar claves** aún espera y se ordena, con RC/RR y reglas anteriores; conservar todos los positivos, ausencia/recreación y clocks actuales. No basta un error de fixture/fusible ni la posterior elección de víctima del detector de deadlock.

## 6. Wrappers, errores originales y contexto privado

`move_original`470–491 coteja cuerpo MD5, owner postgres/DEFINER y ausencia de anon; conserva firma/defaults/ACL antes de mover el original al schema privado. Los wrappers reciben el ABI original493–542, preparan `intakes` sólo con identidades no nulas y llaman **el cuerpo histórico**. Se eliminan filas por transacción/backend/tenant/warehouse/operario y actorNULL en éxito. Una excepción que se propaga revierte también las inserciones privadas; no hay catch que convierta rechazo en OFF.

0045:52–76 valida operario activo y cantidad/marca antes del INSERT de la línea 86. No tenía restricción CN en todo legacy: el SQL nuevo diferencia expresamente CN obligatorio dentro de ON de la vía antigua OFF; test 328–332 escribe ambos resultados. No se inventó una matriz uniforme que quite derechos antiguos.

0449:28–48 valida identidad/region/warehouse antes de su lock de mesa; desconocido, inactivo, VE y warehouseNULL conservan causas originales. Las validaciones de cajas/prealerta y la adopción exacta permanecen en el cuerpo original; boxes0 transitorio se completa antes de constraints diferidas. Una llamada que rechaza antes de insertar no debe tocar el fence ni dejar contexto. Runner 530–562 escribe esa prueba sobre RR antiguo y versión actual del fence; su resultado sigue pendiente.

`authorized_context`244–252 busca la fila privada por txid/pid/operación y selección concreta. `intakes`150–158 exige actor XOR operario; el gate no la fabrica para el caller directo. API no puede escribir esas tablas, y los GUC falsos del contrato392–393 no otorgan contexto. El contexto es mecanismo de DB, no autoridad del parámetro browser.

Hay una inexactitud de comentario, no otro bug de producto:0502:575 dice que OFF retorna sin escrituras; desde b85 el helper escribe el fence técnico antes de devolver OFF. No nace recepción/cohorte/evento/AUD por esa devolución. Conviene precisar ese comentario en la futura autoría sin transformar la escritura necesaria para RR en un incumplimiento de «cero DML de negocio» o en permiso de activar scope.

## 7. ACL, roles efectivos y copias

No existe ni se exige «17 roles». Se separan identidad de aplicación, membresías de operario y permisos de PostgreSQL:

| Autoridad | Fuente y distinción conservada |
|---|---|
|PODv1 yv2|0068:98–111 y 0336:85–111 usan **role escalar** camionero/supervisor, región VE, activo y tenant de OD.0502:2046–2048/2120–2125 conserva ese contrato; la delegación inválida vuelve al rechazo original. |
|partial_delivery|0072:275–323 usa **membresías roles[]**, camionero o supervisor, región/activo y OD/estado/paquete.0502:1996–2005 prepara sólo cuando ese contrato autoriza y vuelve al original en caso contrario. No unificarlo con POD escalar. |
|split0184|Role escalar bodeguero/supervisor, VE/activo; lock de paquete y P0013 tras lock se mantienen literales. |
|Studio|0502:213–242 deriva auth.uid, tenant único0453, membership activa, rol/overrides y warehouse_scope; support no edita. No derivar permisos Studio de roles[] del operario. |
|API y schema privado|Schema55–56 y tablas194–201 revocan acceso a PUBLIC/anon/authenticated/service_role y activan RLS. Privadas2380–2381 revocadas, defaults de EXECUTE cerrados. Postflight2425–2435 consulta privilegios efectivos de los tres roles API, incluidos los que obtengan por PUBLIC/herencia; no afirma haber inspeccionado membresías vivas en producción. |
|RPC nuevas|2386–2412 conserva20 firmas; tres comandos operario service_role-only, las demás authenticated. Revoca roles contrarios y verifica owner/search_path/DEFINER. Son tres roles API inspeccionados por el contrato, no un censo global de roles. |
|Wrappers antiguos|2358–2377 restaura ACL capturada, defaults/nombres/tipos/retorno/owner y postflight 2413–2423 coteja grants efectivos catalogados.0211:21–22 había retirado authenticated de 0045; no se infiere su ACL viva desde el grant intermedio 0209. 0449/0068/0072/0336 son service-only en sus primarios pertinentes. |

Comparación textual nueva de siete cuerpos copiados: iguales tras normalizar únicamente CRLF→LF. Se compararon fuentes D1 con fixture b85; no se ejecutó SQL ni se reconstruyó catálogo:

| Función copiada | MD5 del cuerpo |
|---|---|
|get_user_tenant_id0453|5ff0c51c26a49419c34abc78f1d95c37|
|document_entity_module_contract0444|9c78c98fb29c311926f93a1c28ce1c32|
|document_entity_authorized0444|4eb9fd08721e8f754087dddc5cb88953|
|create_receipt_as_operario0045|f9e61f3ae50fca3f4752d61fb1d20f86|
|operario_action0072, antes 0296|64fd617982cec37a58b2912a15980dbc|
|receive_prealerta_boxes_as_operario0449|bf85211ecef554d573b9670d6011af37|
|camionero_pod0068|f486d0990e8d9204c7e9c483923a81aa|

Aplicar **sólo en texto** las dos cualificaciones de enum que dicta0296:56–65 produce `b0839c00d60dbeecf7e98c4c281f9fdc`, el MD5 que0502 exige al mover operario_action. La fixture incluye0296 real en1833. Incluye también AUD0258/0261/0267/0294,0300/0321/0487/0184/0336/0496 reales; no reemplaza append por éxito incondicional. Fixture1–23 crea auth/roles sintéticos,1820–1843 sus grants/paths de preparación y privilegios públicos de DB propia. No prueba Auth/JWT/Storage/RLS vivos o toda la instancia productiva.

## 8. F1 AUD y F2 locks conservados

**F1 corregido por fuente; aceptación dinámica NO EJECUTADA.** El índice0321:37–44 es único por tenant/event_type/request_ref y no incluye entity_id.0502:2182 deriva referencia acotada de la tupla estructurada referencia POD+shipment;2184 la usa en el GUC y 2194 en payload.request_ref, preservando pod_request_ref. AUD2191–2195 conserva actor operario/source rpc/motivo fijo significativo/correlación acotada. No elimina el segundo AUD ni cambia el índice global. Replay2132–2137 exige operario/huella y devuelve el resultado histórico antes de captura/cierre.

SQL 574–592 escribe dos cierres/AUD distintos, intención única y replay sin eventos nuevos;609–630 falla el segundo append real con P5780, exige rollback de POD/eventos/AUD/ambos estados/intención y retry íntegro. Mutante 209–216 del test TS espera duplicate key/índice real, no cualquier error. No sumar este diseño como mutante ya detectado ni prometer exactamente-una-vez universal.

**F2 corregido por fuente para la intercalación0184/POD; concurrencia NO EJECUTADA.**0502:1966–1986 ordena contenedores y usa NOWAIT sólo desde las guardas tardías2017/2049; transforma lock_not_available a NORMAL_CONFLICT sin éxito/no-op. Preparación partial_delivery toma contenedor antes de OD; v2 toma contenedores→grupos→shipments→ODs→paquetes.0184 real mantiene lock de paquete62–66, P0013 75–76 y creación P2 sin reescritura.

Runner 626–645 fuerza split ya dueño de paquete y POD dueño de contenedor, observa bloqueo, exige P0001/NORMAL_CONFLICT y rechaza deadlock; tras rollback exige POD parcial válido, un P2 por retry y luego P0013. No se le acredita eliminar todos los ciclos o ejercitar cada combinación de roles.

0496 no cambia. Se releyó guard/ACL e identidad fija275–405; congelación no-dry-run obtiene receipt antes de snapshot485/666; permisos elevados699–714 intactos.0502:631–671 respeta ese orden, vincula shipment una vez y difiere el check final; runner 276–298 escribe ambos órdenes freeze/link, fila viva única ligada y replay histórico. No re-fecha tarifas ni convierte subtotal parcial en total financiero. No se ejecutó ninguna de esas carreras.

## 9. C1 de evidencia Portal y límites del runner

La insuficiencia escrita de a6 queda atendida por fuente: SQL 490–497 compara el vector completo de IDs/orden y reloj real;503–524 añade12 IDs literales, diez empatados y predecesor de un microsegundo, historia ASC y top8/4 DESC exactos. El oráculo literal no copia el mismo predicado de autorización del producto. Mutantes227–242 aíslan oldest-first y cap1000 con mensajes de aserción específicos. No están detectados hasta ejecutar el contrato sin fusible bajo GO.

Cero vínculo tiene nombre honesto y precondición533–536; duplicado real540–545 espera23505 con UNIQUE0080 intacto. El negativo híbrido y selector ajeno/ausente siguen526–530. El test combinado217–225 de identidad conserva su límite: muta dos proyecciones a la vez y falla en portal_read, no acredita dos mutantes independientes. No se absorbe aquí la revisión de adaptadores ni manifiesto72 que realiza el Director.

Runner 42–100 usa PGAPPNAME corto/único, drena stdout/stderr y no acepta marcador de error antes de disponer de la línea ERROR completa. `blocked`102–112 consulta pg_blocking_pids y wait_event_type; delay sólo sondea. `rejected`140–145 excluye40P01/55P03/57014/25P02 y admite40001 sólo donde luego hay rollback/retry/estado final. El vector124–135 son **conteos**, no comparación íntegra de todas las filas; los casos añaden igualdades de las filas/identidades pertinentes. No se sobreafirma bytecheck de todo el negocio por ese vector.

La instalación sigue bloqueada por el fusible0502:22–24. Runner 568 y test TS193 lo rechazan **antes** de crear DB/PGlite; no lo retiran, no hay SKIP verde ni ROJO funcional medido por su presencia. El contrato incluye0502 con BEGIN/COMMIT propio y después rollback de datos632; no se afirma que ese ROLLBACK desinstale todo el DDL.

Cleanup escrito: nombre/label de contenedor acotados, DB nueva aleatoria, sesiones propias y finally676–681 termina conexiones sólo de esa DB y la elimina. Session.close espera dos segundos y puede terminar su propio child; no hay prueba de cierre físico o recursos cero aquí. Los límites8/12/18/20 segundos son por sondeo/SQL/query; sql() puede esperar un spawnSync de hasta30 segundos, por lo que no son deadline global rígido. Recursos/EXIT/cleanup deben acreditarse en la futura ejecución, sin heredar BCV ni ejecutar ahora para mejorar evidencia.

## 10. Huellas de objetos y cierre

SHA256 nuevos calculados sobre bytes crudos de `git cat-file blob` en memoria; no sobre salida numerada. Las cinco filas siguientes son idénticas en b85 y 792; no confundimos blob Git con SHA256:

| Ruta | Blob | Bytes | SHA256 |
|---|---|---:|---|
|0502 SQL|a07a5c482eaae5cd9aa761da70ce404a40773fbf|203550|c781b5acb3d6684c97d94cc1de90198b85133bd43619f562d441effdc92e64e3|
|fixture estructural|62c334eb0a599a8fc79ea92ca4b01b10f51714f9|78686|f384ad632fb45e4a4ae5e47a03a3539d6e4bfaf1f938cc66a4fea92b547af8f2|
|contrato SQL|4bb74e9d25f8f1e86544ab800ba0aaeb12922d14|60268|13b14d34ef6b0e5a5ff59c4f7fa8eefabd8f2109db42b8ba8f0e63c02b2299d5|
|runner concurrencia|6d900e4dc45b8a35a0ee7e5b7162c4ebf9f94810|55295|2a0d9876014e8e5ef593921806c838f497a440773fabac986399e66ac6763bd2|
|test TS migración|c3e5ed63f1c2d21ca1719f1e68851b518b288cbf|16550|75e503758eabd40e443a755dae1c30e4ba4e25a7a2a43d1451f107030c3b05c2|

Primarios D1 y b85 iguales; bytes crudos/hash nuevos, con lectura humana limitada a los rangos declarados:

| Migración | Blob | SHA256 |
|---|---|---|
|0045|e1d628f2b9b5f39f7d676eab89d240d933a9269e|129cfef3aca773eccf2759b2e9e80c9eae362db1195b8c3576d8db01b22c7f8f|
|0068|5a016d5d0a211932efa3c6d3a544d01a893f89f7|6bcde029bf781a821878e50ee4bb7d997a7fc5e51c7b980af48cd9df6c32d519|
|0072|62e3e71767ed50d31bea2a57762c8220060db987|c24f1f98cdece872de60ba83e67b9f418c3f10fd376caac7524ea51420f3fff5|
|0184|774ecd95287ebab892f93d1e0f5f8ed201f3e4c1|ba83f7bf1fcfd64c662f517485af0f1e466eda9d8b4cbea9b4b2a925bf5b16ac|
|0211|3355dcadb3d138ef1f5ad7fe2ca9aefce32fbf55|22ef217c780afe48d3bc02d1170becb516a5e14858e7e25425a9c007ef6277e8|
|0296|2c021232a9153442193a3c5adb9a75e911f5f6a6|fec70b3a2771f2f2f833d222416215ba952c5add005bb525359c4e76da7f2610|
|0321|2a9bfa3de932e7eec3dca762c6c8ad19f0d4a822|c039bb72d0f35c5f4fccf3aee15fdaf9ca231bf9c491a5980671f52e0551ca7b|
|0336|956831b05b535306269567400c24f3137fbb143e|789588414ded6c910479f3088f45173eab8140a2e4b05213d2b17181344a0ad5|
|0444|4f8e9d5d7f7049fe11157585f7dc11f6208a425d|297be7156a75b0d9710823bf0e438dfc8a085e84158668755c13b28cf398792e|
|0449|7b1e84fec2060edcb22d17389284b1ed4f7c1b3c|65bb32f52b322ba346a18665de462eb2dc4f57d1a3ddedf9bf96707d87574819|
|0453|2ca2f68a708394016d68ade17927c864ad47e369|4f622ea95dd93ba54891081ffb6350e4abecdfa80ce54a22613e7eb0db34f30f|
|0487|d2e5eb4f9f07f4924b6005d19373247651278f58|b272c77dad37a1d9d1c42bdd676b4d0e4c455ee45ec9187aac84ecf06416a3e9|
|0496|10eea03c3a1d616994940656b312d16adae3c141|f59163473ec8c8575d1309575391b69ea455adbb33069911aecd72f3d8325a3d|

La revisión concluye con un P2 residual concreto para autoría posterior y sin otro defecto material nuevo identificado en las superficies leídas. F1/F2 y C1 sólo tienen dictamen de fuente/cobertura escrita, no PASÓ dinámico. Revisar la corrección mínima y su nueva fuente antes de conceder ejecución. No basta transferir el resultado de a6, un 40001, una aserción que no corrió o una revisión de aplicación.

**NO EJECUTADOS:** Node/Python de producto, suites, SQL/PGlite/DB/Docker/HTTP/browser/instalación/tipos/lint/build/verify/conocimiento. Sólo red de documentación primaria PostgreSQL, sin BCV nuevo, cuentas o servicios reales. Sin datos, entornos, secretos o PII, sin mutaciones Git/claim/worktree/SQL. No se activó0578, no se retiró fusible y no se aplicó0496/0501/0502. Ninguna escritura adicional en BCV/0578/main, ninguna autorización de merge/deploy/producción o memoria. El informe base y soportes previos conservan sus bytes.
<!-- INFORME PEER FENCE 792 ÍNTEGRO FIN -->

<!-- DECISION CLAVES NOOP DIRECTOR ÍNTEGRA INICIO -->
# 0578 · decisión de autoría acotada para claves nombradas sin cambio

Director, 21 de octubre de 2026. Misma tarea, owner, claim, rama y base D1.
Preimagen inmutable `792f00a8d1d7883cce6ad7691eef74b2980382ea`.
Esta decisión permite **autoría ligera y checkpoint DRAFT**, no runtime ni SQL.
La allowlist acumulada sigue en 72 rutas; no se amplía.

Director leyó íntegros el informe independiente de 31488 bytes, SHA256
`c04d28b2a510788a82d33e01ecb48dd001f68228b307c522d5ba5bf4acf3a831`, y la propuesta
Writer de 10508 bytes, SHA256
`bcea0f34fcf493c8f54844e4d688f8c23f5ba1370f34f549b7e9bfc6ac474e4c`.
Contrastó además las fuentes oficiales PG17 execMain.c, trigger.c y CREATE
TRIGGER. Es **P2 material por fuente, NO REPRODUCIDO**; no se afirma deadlock,
afectación productiva o bypass de autoridad observado.

## Dirección concreta adoptada

Adoptar la variante Writer de prepaso **sólo gate**, que evita duplicar la
escritura durable propuesta como alternativa por el peer. Un BEFORE ROW UPDATE
OF id, tenant_id, warehouse_id en scopes debe ordenarse antes del general y
operar también cuando OLD y NEW tienen los mismos valores. No WHEN basado en
diferencias de valores ni interpretación del texto del comando.

Reutilizar la guarda privada con un argumento literal de catálogo exclusivo del
prepaso. Verificar modo y contexto de trigger exactos; no aceptar un argumento
de aplicación, browser, GUC o payload para elegirlo. Deduplicar y ordenar claves
OLD/NEW con la misma identidad y hash de gate vigentes. El prepaso sólo usa try
gate o rechaza con P0001 / NORMAL_CONFLICT / hint dtd-client-normal, y retorna NEW.
No escribe fence, modifica la fila, crea contexto o concede autoridad.

El general **siempre continúa**: reentra gates de su propia transacción, ejecuta
una sola escritura durable por fila y conserva validación, identidad usada,
FK/UNIQUE, conteos, reloj y clasificación. El UPDATE ordinario que sólo nombra
enabled/starts_at/protocol_version mantiene espera bloqueante. DELETE/rekey
efectivos conservan el mecanismo y rollback aprobados. No try universal.

Mantener owner/search_path/DEFINER y revokes privados. Postflight debe comprobar
la relación, BEFORE/ROW/UPDATE, tres columnas exactas, argumento literal, función,
habilitación y orden de ambos triggers; conjunto de veinte guardas exactas y
sin debilitar las diecinueve anteriores. No nueva ABI o función pública ni grants.
Precisar el comentario OFF: puede escribir el fence técnico, sin DML de negocio.

## Rutas de esta corrección, subconjunto de las 72 ya adoptadas

1. supabase/migrations/0502_consolidacion_cliente_camino_normal.sql
2. supabase/tests/consolidacion_cliente_normal.test.sql
3. scripts/check-client-consolidation-concurrency.mjs
4. lib/studio/client-consolidation/__tests__/normal-path.migration.test.ts
5. docs/specs/0578-envios-cliente-camino-normal/spec.md
6. .agents/handoffs/042-envio-cliente-camino-normal.md

No editar fixture estructural, históricas, adaptadores, baseline, package, lock o
tipos por esta decisión. Si una necesidad no cabe, justificarla antes de editar.
0502 conserva el fusible anterior al DDL y cohorte OFF. No renumerar ni aplicar.

## Oráculos que redactar, sin ejecutarlos todavía

Usar UPDATE no-op **real** para cada clave, las tres juntas y combinaciones con
enabled/starts_at. Gate libre debe permitirlos con una sola versión durable por
fila. Gate ocupado debe producir la terna controlada antes de liberar al dueño,
con rollback íntegro, intake real posterior sin FK residual y retry fresco del
comando completo. SELECT FOR UPDATE de una barrera no sustituye esos comandos.

Positivos ordinarios enabled/starts_at, incluidos no-op y sin claves nombradas,
deben esperar realmente, dejando completar intake/FK y preservando reloj e
historia. RC/RR separados; 40001 sólo con rollback/retry íntegro y estado final.
No aceptar 40P01, 55P03, 57014 o 25P02 como rechazo funcional. Mantener ausencia,
recreación, orden inverso, OLD/NEW y fallo en segunda clave ya escritos. Catálogo
sin ejecución no acredita el interleaving. Añadir mutantes pertinentes de quitar
o reordenar prepaso y de try universal; no contarlos como detectados sin correrlos.

Leer y adoptar íntegra esta decisión con hash en spec/handoff antes de editar.
Conservar las preimágenes y todos los oráculos previos. Entregar delta desde
792f, SHA nuevo, manifiesto exacto de hasta 72 rutas, plan de relevo actualizado y
PR318 DRAFT con cuerpo/readback cotejados. Sin instalación, parser de producto,
tests, SQL/PGlite/DB/Docker, navegador, lint/tipos/build/verify o conocimiento.
Revisión de la nueva fuente antes de conceder cualquier ejecución.

No main, merge, deploy, VPS, datos reales, PII, secretos, cuentas, pagos,
contactos, memoria, Obsidian compartido o activación nominal. BCV conserva su
resultado FALLÓ/INCOMPLETO y el diagnóstico0577 sus permisos separados.
<!-- DECISION CLAVES NOOP DIRECTOR ÍNTEGRA FIN -->

## Checkpoint P1-72 claves no-op posterior a792f — sólo autoría

Decisión06367e18 e informe c04d28b2 adoptados íntegros antes de producto arriba. Seis rutas exactas; misma unión72/baseD1/owner/claim. Preimagen792f conserva sus artefactos/PRrecibo y matriz; no se reescribe. Este delta atiende P2 material por fuente NO REPRODUCIDO, sin aceptar funcionamiento o ausencia de deadlocks.

0502 blob3072c7519ee4737547923004976ca261b20ac97e/SHA25684652dbbd921873935064e293526906cc13403ba15cb7b064f41697d22b9acf3. guard_scope_configuration292–340 valida relación/schema/tabla/BEFORE/ROW, nombre exacto y modo literal TG; pretrigger341–342 UPDATE OF id,tenant_id,warehouse_id ordenado antes del general343–344. OLD/NEW deduplica/ordena la misma identidad/hash. Prepaso sólo try gate, sin UPSERT/contexto/modificarNEW; general continúa y escribe fence una sola vez. Misma terna P0001/NORMAL_CONFLICT/hint dtd-client-normal, rollback completo. UPDATE ordinario sin claves conserva espera. Sin nuevas funciones públicas/ABI/grants/helpers privados. Postflight2429–2522 exige20 nombres/relaciones/estado exactos, dos definiciones de scope con tipos19/31, attrs1/2/3 vs vacío, args literales/función y orden; dos helpers y20RPC públicas originales sin cambio. No se debilitó conjunto previo19. Comentario603 precisa OFF con escritura técnica de fence y cero DML de negocio.

Oráculos nuevos, todos NO EJECUTADOS:

- SQL35 scope_named_key_once339–369: UPDATE real de cada clave y las tres, puros/con enabled/starts_at; libre debe completar con una sola versión durable/identidad íntegra. Noop ordinario también escribe general una vez. Historia de receipts anterior igual.
- Runner38 namedScopeKeyNoop540–583:24 combinaciones RC/RR de4formas×3extras; primero configuración libre/intake posterior (orden inverso), luego gate real retenido por fixturepropietaria, UPDATE no-op/combinado REAL debe rechazar con terna mientras sigue retenido. No SELECT FOR UPDATE sustitutivo. Rollback entero/scope igual/fence igual, intake real+FK válido/retry fresco, header y marca/reloj completos históricos intactos. La barrera privada no concede permiso ni fabrica intakes/contexto.
- ordinaryScopeUpdate585–633: cinco formas sin claves×RC/RR; espera real pg_blocking_pids, permite intake/FK, configuraciónRC completa oRR40001 con rollback/retry entero. Valores exactos y un solo fence/header/marca/reloj histórico iguales. Rechazo prematuro es error específico, no éxito; timeouts/40P01 no aceptados. Casos antiguos de ausencia/recreación/rekey/segunda clave y validadores originales conservados.
- PGlite37: dos mutantes de catálogo (quitar pretrigger y renombrar todas sus referencias para ordenar después del general), errores específicos conjunto/orden. No prueba dinámica de locks. Archivo completo ahora tiene7instancias seriales: contrato real+6mutantes; ninguna ejecutada, fusible siempre hardstop.
- Runner opcional --scope-mutant try-universal: corrida SEPARADA en DB nueva propia/etiquetada, cambio sólo en memoria tras hardstopdelFUSE original; hash efectivo registrado. Sólo retorno prematuro del UPDATE ordinario y terna exacta confirmada con gate aún retenido generan ScopeOrdinaryWaitViolation/MUTANTE DETECTADO. Otro error/fusible/parser/timeout no lo mata válidamente. No equivale a productoPASÓ ni reemplaza baseline. No infraestructura nueva o comando lanzado enP1.

Plan externo actualizado `C:/tmp/director-traspaso-20261020/0578-normal-validation/plan-relevo-p1-72-claves-noop.md`,5636bytes/SHA256fdbd7dcd631fe32fb147e36a74efe3fc8f8cc94c1d78531bd72483ace91cadf2 compone planes70/72 anteriores preservados. Mantiene toda matrizA1–A18 NO EJECUTADA y faltantes propios/recursos/permisos; no cierre4.2. Nueva fuente requiere revisión/GO antes de cualquier runtime o retiro revisado del fusible.

Guard/owner, copias contractuales íntegras, hashes y diffcheck nativos/Git verificados. Comparación textual de20 nombres definidos contra lista esperada PASÓ tras acotar selector a triggers (el primer selector también recogía3policies); no fue parser/catalogo/SQL. Fuente conservada: fixture estructural/históricas/adaptadores/baseline/package/lock/tipos fuera de este delta, ACL originales intactas,0495no se repite. Tests/Nodeparser/SQL/PGlite/DB/Docker/browser/types/lint/build/verify/knowledge NO EJECUTADO. FusibleantesDDL/cohorteOFF, PR318DRAFT, sin main/merge/prod/deploy, sin activaciónnominal o efectos financieros4.3. Claim retenido; diagnóstico0577 conserva permisos separados y BCVFALLÓ+INCOMPLETO no se convierte en verde.
