# Recomendación fija — lote web PR 322 → 323 → 324

Fecha: 2026-10-23, America/Caracas. Director /root, misma sesión/owner de coordinación director-ads-traza-real-20261023.
Rama propia: codex/plan-mejoras-web-20261023, partida de 9ae259e824abec68b1c1016894a86bb266fa0867.
Estado: revisión individual terminada y CI SUCCESS; recomendación de integración serial CONDICIONADA. Ningún merge, aprobación de producción o activación ejecutados.

## Dictamen ejecutivo y alcance fijo

Recomiendo a Sam aprobar el lote web mínimo 322 → 323 → 324 como tres integraciones separadas, conservando los SHA fuente de esta tabla y únicamente la resolución documental mecánica descrita abajo. En cada alcance original no se identifica un defecto material nuevo pendiente que impida su revisión de integración. La combinación final no está ejecutada ni validada. Los tres checks individuales verdes acreditan sus propias cabezas contra main D410; no existe todavía un SHA combinado aprobado ni una comprobación de producción.

El paquete no incluye otras PR, cambios de producto adicionales, CSP, cuentas CRM/Ads/Analytics, datos de negocio, DB/migraciones o reglas de producción. La autorización actual es de revisión/documentación: la recomendación NO es un GO de merge/deploy, ready-for-review o auto-merge. Las tres PR siguen OPEN/DRAFT y no se emitió una aprobación GitHub mediante herramientas.

Base fija comprobada tras fetch sin prune: d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8, main local y origin/main/remoto.
Snapshot de esta revisión terminado 2026-10-23T21:07:37.317Z, 17:07:37.317 Caracas.

| PR / SDD | HEAD fuente exacto | Tree Git fuente | Rutas | CI individual |
|---|---|---|---:|---|
| [#322](https://github.com/SoftAgentes/DTDCARGO/pull/322) / 0579 | d069b5b26df962b25f6476bfd7c3c626c4764be2 | 78718464860c647cdd3fbf48c5c850cab041a233 | 16 | SUCCESS / 15 de 15 gates |
| [#323](https://github.com/SoftAgentes/DTDCARGO/pull/323) / 0580 | c2a933aac5ad8bc6ce3b8d78688e2dcaae9dc780 | 3e514a66f3796a9040fef531737a912f62a33748 | 17 | SUCCESS / 15 de 15 gates |
| [#324](https://github.com/SoftAgentes/DTDCARGO/pull/324) / 0581 | 6e3bbfbe560e97ec216d43788062b490c3cd6bd1 | d29f8cb5aefb4bc4e2547815dceb1442a8f6a439 | 15 | SUCCESS / 15 de 15 gates |

Los tres heads/ref remotos y las rutas Git coinciden con GitHub. Los títulos/cuerpos siguen byte a byte el paquete aa0bd4d14fc02ff5b5d81daf38b429964affbd38. State OPEN, isDraft true, mergeable MERGEABLE, mergeStateStatus CLEAN, mergedAt null, autoMergeRequest null en los tres. CLEAN describe el estado individual actual; no certifica el lote combinado. ReviewDecision vacío no equivale a aprobación formal.

## CI final comprobada independientemente

Se leyeron metadatos completos de los tres jobs por API oficial y se cotejó head_sha, run_id, status completed y conclusion success. No se relanzó ninguna suite ni workflow.

| PR | Run / job | Evidencia | Fin del job, 23-oct |
|---|---|---|---|
| #322 | 40018526305 / 120636745111 | [job completo](https://github.com/SoftAgentes/DTDCARGO/actions/runs/40018526305/job/120636745111) | 16:57:19 Caracas |
| #323 | 40018778021 / 120637603788 | [job completo](https://github.com/SoftAgentes/DTDCARGO/actions/runs/40018778021/job/120637603788) | 17:00:15 Caracas |
| #324 | 40019024040 / 120638438639 | [job completo](https://github.com/SoftAgentes/DTDCARGO/actions/runs/40019024040/job/120638438639) | 16:52:17 Caracas |

| Paso | Gate del job | #322 | #323 | #324 |
|---:|---|---|---|---|
| 6 | ESLint | SUCCESS | SUCCESS | SUCCESS |
| 7 | Frontera RSC | SUCCESS | SUCCESS | SUCCESS |
| 8 | TypeScript | SUCCESS | SUCCESS | SUCCESS |
| 9 | Edge Functions | SUCCESS | SUCCESS | SUCCESS |
| 10 | Unitarios | SUCCESS | SUCCESS | SUCCESS |
| 11 | Harness Director Worker | SUCCESS | SUCCESS | SUCCESS |
| 12 | Pruebas bash de operaciones | SUCCESS | SUCCESS | SUCCESS |
| 13 | Documentacion SDD | SUCCESS | SUCCESS | SUCCESS |
| 14 | Numeracion SDD y migraciones | SUCCESS | SUCCESS | SUCCESS |
| 15 | Codigo contra migraciones pendientes | SUCCESS | SUCCESS | SUCCESS |
| 16 | Constantes de features | SUCCESS | SUCCESS | SUCCESS |
| 17 | Registro de componentes | SUCCESS | SUCCESS | SUCCESS |
| 18 | Gobernanza ejecutable | SUCCESS | SUCCESS | SUCCESS |
| 19 | Build de produccion sin secretos | SUCCESS | SUCCESS | SUCCESS |
| 20 | Confirmar arbol reproducible | SUCCESS | SUCCESS | SUCCESS |

Los quince pasos 6–20 están presentes y en success, ninguno skipped. Esa afirmación se refiere al estado de los gates: no se inspeccionaron logs de cada aserción para concluir que dentro de Unitarios no hubiera pruebas omitidas, ni se transforma en cero omisiones globales. La preparación y poststeps tampoco mostraron un fallo en los jobs leídos.

quality.yml corre estos gates explícitos; no invoca el cierre canónico completo de 17 pasos. Ledger productivo, contratos SQL/reconstrucción de esquema y E2E global no quedan acreditados por un gate inexistente en este workflow. Edge sí cuenta ahora con un resultado CI SUCCESS nuevo. Este lote no modifica schema, migraciones, contratos API o políticas DB; no se pide consultar producción para fabricar una cobertura que no corresponde al cambio.

Los canónicos locales originales se conservan: 0579 FALLÓ/INCOMPLETO, 0580 FALLÓ/INCOMPLETO, 0581 doce pasos medidos PASÓ/cierre INCOMPLETO y wrapper exit 1. Sus fallos de auxiliares y rechecks siguen en sus handoffs. La CI final del SHA es evidencia posterior, independiente y favorable; no cambia retroactivamente aquellos resultados. No hace falta repetir la corrida local histórica solo para cambiar su etiqueta.

## Checklist por PR y bloqueador material residual

### #322 — 0579, promesas de seguimiento

Owner: worker-0579-promesas-seguimiento.
Rama/WT: codex/0579-promesas-seguimiento-web-kommo, C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0579-promesas-seguimiento-web-kommo.

Cumple: corrección acotada de cinco FAQ con bandera existente, fuentes KB/infografía y descripción factual de privacidad; 41 focales, UI/JSON-LD, capturas y build locales ya revisados. Final d069 conserva producto de 206728c5a y auxiliares con rechecks; la nueva CI de d069 pasó Unitarios, Harness y todos los gates 6–20.

Bloqueador de producto dentro del slice: ninguno nuevo conocido. Primera integración contra D410: elegible para aprobación de Sam, con frontera productiva explícita. No requiere que se cargue Kommo para revisar/integrar el cambio web.

Límites: la KB de Kommo es fuente preparada localmente, no subida a la cuenta. No se generaron DOCX/infografía final ni se implementó notificación real. «Te avisaremos apenas esté activo» conserva la decisión previa de 0521; no se acredita un envío o automatización. Los pendientes ajenos de newsletter/alta de cuentas no se absorben.

### #323 — 0580, CTA Shipping Mark móvil

Owner: worker-0580-cta-movil.
Rama/WT: codex/0580-shipping-mark-cta-movil, C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0580-shipping-mark-cta-movil.

Cumple: altura intrínseca de CTA y pista hero acotada, vecino Cotizar sin regresión en tamaño normal, destino/marca conservados. Matriz local 26 escenarios/52 CTA y Enter/tap revisados; E2E inicial 47/48 y recheck afectado 10/10 permanecen. Producto/pruebas/assets de b7b283107 son idénticos en c2a933; CI final de c2a933 SUCCESS.

Bloqueador de producto dentro del recorte: ninguno nuevo conocido. Residual para integrarla DESPUÉS de #322: fusionar el índice con 0579/0580, total esperado 558, y revisar la nueva cabeza/base y CI resultantes. La CI actual individual no cubre ese árbol futuro.

Límites: desbordamiento global al ampliar texto por título/estadísticas y cruces del FAB durante scroll quedan fuera del recorte. No se certifican móvil completo, accesibilidad global, zoom nativo o teléfonos físicos.

### #324 — 0581, lectura de consentimiento

Owner: worker-0581-ads.
Rama/WT: codex/0581-medicion-ads-csp-offline, C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0581-medicion-ads-csp-offline.

Cumple: lectura exacta de nombre/valor en init y helper, cookies ambiguas sin concesión al iniciar, IDs/eventos/valores/exclusiones intactos. 267 focales y 32/32 E2E inertes revisados; rename R100 y selección general cero propios/aislada 32. Producto c5a4f253 y selección bfc36c37 se conservan en 6e3bbfbe; CI final de 6e3 SUCCESS.

Bloqueador de producto dentro del parser: ninguno nuevo conocido. Residual DESPUÉS de #322/#323: índice con las tres filas, total esperado 559, y revisión de la nueva cabeza/base/CI. Es aprobable la corrección aislada de consentimiento, no una declaración de medición Ads completa.

Límites: la traza del tag real permanece INCONCLUSA/NO DISPONIBLE por conectividad, no se repitió. Cero intentos observados de pagead2 no prueba que no lo use; no habilita ampliar CSP. Recepción/atribución/acciones en las cuentas y ventas/ROAS no probados. El valor fijo 1 USD de WhatsApp es nominal. Limpieza de cookies duplicadas persistentes es independiente.

## Compatibilidad y solapamiento documental concreto

La unión de las listas de cambios contiene 44 rutas distintas. Las rutas de producto no se solapan; helpers copiados de fuentes commitidas son autónomos entre worktrees. Para cada par, las únicas rutas compartidas son docs/marketing/README.md y docs/specs/README.md.

### docs/marketing/README.md

Los hunks son inserciones en secciones distintas sobre D410:
- #322 añade la nota FAQ/fuentes debajo de las decisiones de seguimiento; línea 164 en su blob.
- #323 añade Shipping Mark bajo «Cómo usar este tree»; línea 9 en su blob.
- #324 añade el diagnóstico bajo «Analítica — GA4 + GTM»; línea 65 en su blob.

No hay solapamiento textual entre esos hunks. La resolución esperada conserva las tres notas, sus enlaces y fechas/fase histórica. No es correcto declarar dos conflictos materiales de código solo porque el archivo aparece en las tres listas. Tampoco se afirma una fusión Git ejecutada: esta conclusión viene de comparar los objetos y sus diffs. Los estados «local/sin publicar» son fotos de la fase original; el registro nuevo de PR/CI y el cierre de integración deben conservar la distinción con despliegue, sin declarar producción por adelantado.

### docs/specs/README.md

Los tres diffs tocan el mismo bloque generado: contador 556→557, una fila nueva y lista de huecos. La resolución no puede elegir completo el índice de una sola PR ni concatenarlo con merge=union.

El clon ya muestra atributo merge=dtd-generated-records y configuración local:
- name: DTD generated records semantic merge.
- driver: node scripts/merge-generated-records.mjs %O %A %B %P.
- recursive: binary.

Por fuente leída, mergeIndex combina filas por SDD, falla en misma clave divergente y renderIndex recalcula cantidad, orden y huecos. ADR-0002 documenta que GitHub no recibe esa configuración para su cálculo de merge/Update branch. No se instaló ni ejecutó el driver, generador o ensayo de merge en esta revisión.

Resultado documental ESPERADO para el lote exacto, no generado/ejecutado:
- Tras #322: 557 specs, fila 0579.
- Tras #323: 558 specs, filas 0579 y 0580.
- Tras #324: 559 specs, filas 0579, 0580 y 0581, en ese orden.

```text
| 0579 | Promesas de seguimiento coherentes en FAQ y fuentes locales | done | interno |
| 0580 | Shipping Mark CTA: altura intrínseca y recorrido móvil | done | interno |
| 0581 | Diagnóstico local de medición Ads y CSP | done | interno |
```

La lista de huecos final esperada es: 0022, 0023, 0027, 0028, 0037, 0112, 0190, 0301, 0435, 0445, 0446, 0447, 0483, 0570, 0571, 0572, 0573, 0574, 0575, 0576, 0577, 0578. 0579, 0580 y 0581 no pueden figurar como huecos. Los otros huecos siguen siendo ausencias de este árbol; no autorizan reservar IDs ni renumerar otra tarea. Fuentes: .gitattributes:42; scripts/merge-generated-records.mjs:361 y :408; docs/architecture/decisions/0002-merge-semantico-registros-generados.md. Estas condiciones se deben comprobar con docs:check al integrar de forma autorizada; no se ejecutó ese comando ahora.

## Secuencia de integración recomendada, NO EJECUTADA

1. Sam decide sobre el lote preciso de las tres fuentes y sus límites. La autorización de respaldo DRAFT ya consumida no autoriza este paso. Una aprobación de ejecución debe cubrir la transición fuera de DRAFT cuando se cumplan revisión/checks, la integración y el efecto de publicación de main o la ventana/procedimiento de release existente. No se cambia ningún estado ahora ni se desactiva la cadena de publicación para eludir su frontera.
2. Revalidar main=D410, heads exactos, PR/CI y ausencia de cambios ajenos inmediatamente antes de actuar. Si main cambió fuera de este lote, el paquete queda desactualizado y se revisa la nueva base.
3. #322 primero: integrar únicamente d069 con autorización vigente y checks/revisión satisfechos. Conservar el SHA de integración observado; no se inventa aquí.
4. Preparar #323 contra esa main nueva en aislamiento autorizado, manteniendo owner original y el driver semántico existente. Preservar nota marketing y filas 0579/0580, total 558. Sin cambios de producto adicionales ni force/rebase. Si la actualización crea cabeza nueva, revisar su delta exacto y CI; el PASS de c2a933 no certifica automáticamente la nueva cabeza. Solo después integrar #323.
5. Repetir el control de #324 sobre la main resultante: conservar las tres notas, filas 0579/0580/0581 y contador 559; revisar cabeza/base y CI nuevos antes de integrar. Esa CI acumulada será evidencia del árbol que contiene las tres entregas, todavía NO EJECUTADO hoy.
6. Aplicar el procedimiento de release autorizado y verificar el SHA realmente servido/salud y alcance; no deducir producción de un merge o build. No aplicar DB ni tocar cuentas por este lote web. Los requisitos de release del proyecto conservan su propia aprobación.

La cadena build-image/publicable documentada en el repositorio puede promover imágenes derivadas de main y un timer del servidor las consume. Su estado operativo/congelación no se verificó por esta revisión GH/Git. Cada avance de main puede tener efecto productivo; no se promete un despliegue atómico de las tres PR ni se integra la primera por inferir que «solo merge» carece de efecto. Si se exige publicar únicamente el lote completo, debe acordarse primero la ventana de release aplicable.

No se abren nuevos Writers/chats/modelos, no se mezcla con otras PR y no se autoriza reparar problemas ajenos. Resolver únicamente el índice/nota conforme a este paquete es preparación documental; una edición nueva de producto exige revisión de alcance. Una nueva cabeza invalida la revisión de su SHA anterior.

## Checklist de decisión

- [x] Tres fuentes exactas, base D410, rutas y árboles identificados.
- [x] Tres PR OPEN/DRAFT/MERGEABLE/CLEAN, sin merge ni auto-merge, títulos/cuerpos intactos.
- [x] CI individual final SUCCESS, quince gates 6–20 success por PR.
- [x] Revisiones y QA previas conservadas; errores/omisiones históricos no borrados.
- [x] Solapamientos concretos y salida semántica esperada del índice definidos.
- [x] Ningún bloqueador nuevo identificado dentro de los tres slices de producto.
- [ ] Aprobación nominal de transición fuera de DRAFT, integración y efectos de release por Sam.
- [ ] Actualización de bases, índice fusionado y CI de nuevas cabezas para #323/#324.
- [ ] SHA/árbol combinado y resultado de su CI observados.
- [ ] Release/producción y SHA servido comprobados por su procedimiento.

## Evidencia fija y cierre

[Snapshot completo](<C:/Users/AKX generator/AppData/Local/Temp/dtd-web-ci-final-0579-0581-Tr6kzn/review-snapshot.json>): 86168 bytes, SHA-256 6264e9d73c4aeaa0d10b6459df5f544760c4b684a047ea2041ce48cc6b064242. Conserva metadatos PR/jobs, pasos, rutas, objetos Git, diffs, comparación contra el paquete original y entradas/exits de consultas read-only. Los archivos individuales 0579/0580/0581.pr.json, .job.json, .docs.diff y .product.diff permiten lectura acotada; no se copiaron secretos, documentos privados o payloads bloqueados. Son recibos nuevos separados de la custodia de publicación, que queda intacta.

No se ejecutó merge/merge-tree/rebase, nueva suite/build/UI, conocimiento/gestores/install, workflow manual, cuentas, CSP, DB o producción. Solo este checklist propio cambia en Git. Los tres worktrees/owners originales se preservan; no se reclaman. Las capas de conocimiento conservan sus pendientes previos, sin nueva comprobación por orden expresa de esta fase.

La comprobación local final confirmó 0579 en d069b5b26, 0580 en c2a933aac y 0581 en 6e3bbfbe5: ramas originales, status vacío y claim ausente en los tres. Main sigue d410ab2e2 con los dos untracked preexistentes preservados. No se abrió el PDF DPA ni se modificaron archivos de otros Directores.

Guardar este único documento en commit local selectivo, comprobar limpieza y liberar el mismo claim de coordinación; SHA final se informa al entregar. No se publica la rama de coordinación ni se alteran PR, títulos o cuerpos para registrar esta recomendación.
