# Dirección: revisión e integración continua DTD Cargo

Corte verificable: 2026-10-26 06:03 UTC. Director: `01a160e3-92b0-76f0-bc3c-20000e81ff16`.
Este handoff nuevo registra coordinación e integración técnica. No modifica reglas estables ni acredita producción.

## Encargo y aislamiento

Sam autorizó revisar los pendientes, publicar PRs, actualizar Graphify/Archify/Obsidian e integrar y hacer push a main. La automatización permanece PAUSADA. Se conservan las autorizaciones nominales y los límites de cada lectura detenida.

- Worktree propio: `C:/Users/AKX generator/.codex/worktrees/integracion-dtd-checks-20261025/DTDCARGO`.
- Rama propia: `codex/integracion-dtd-checks-20261025`.
- Owner: `director-integracion-checks-20261025-01a160e3`.
- Guard nuevo `f70353/0`; avance fast-forward `818b62/0`, desde `99495520cc0be295320207a946eb2f5b504a1c58` hasta `ca3194791cd08175c7cbbccff4b489d7e6b4155e`, limpio y sin MERGE_HEAD. Guard posterior PASÓ.
- El Director añade únicamente este handoff. El producto fue escrito por el mismo CORE y revisado sobre commits fijos; no se copia WIP ajeno.

## Main integrado y conocimiento

Main comprobada: `421b1f677dfead822c5a4fac8ebd3991337f0a4b`, árbol `a5b332315cdb7b247bbdc67858a2e56ba5bfb16c`.

Once PRs integradas durante este encargo: #262, #304, #315, #326, #309, #306, #322, #323, #324, #307 y #316. La última, #316, tiene merge `421b1f6`, con padres `f43669b0` y `99495520`.

CI posterior de main #316: run `40269801078`, job `121399946988`, SUCCESS, quince gates 6–20 en éxito. Unit: 873 archivos PASÓ y uno omitido; 12530 tests PASÓ y uno omitido. Harness: 206 PASÓ y 31 NO DISPONIBLE. Build: 162/162. El caso corpus omitido y las dependencias de Graphify/Python no disponibles en CI no se presentan como cobertura completa.

Graphify estructural CURRENT en `421b1f6`: 44670 nodos, 81355 aristas y 2727 comunidades; hash `096cea3365fc17edaff66a9b43b3396a4132d49894d24c74bb7060967799267e`. Piloto semántico CURRENT 16/16; cobertura global PENDING 16/1345, con 1329 pendientes. Archify 2.16 y publicación Obsidian CURRENT en ese mismo SHA; cero conflictos, cero problemas de publicación. Revisión visual de Obsidian NO EJECUTADA. Comprobación independiente `ea1ffd/0`.

Cierres durables: https://github.com/SoftAgentes/DTDCARGO/pull/307#issuecomment-6408311422 y https://github.com/SoftAgentes/DTDCARGO/pull/316#issuecomment-6408557625.

## Composición técnica preparada para #320

Candidato CORE: `ca3194791cd08175c7cbbccff4b489d7e6b4155e`, árbol `8bca5d938ce5641b2390073f646b11be1a238bfe`. Padres: `dbe0f8a4188baa8a95df59597b0e89f77f479d82` y `15d34c41d08a5dcbe67269328200bc73a2b1bdd3`.

Compone main `421b1f6`, CORE/I2/declaraciones `5b6c4609756ae3631e2de1bbdd43912799d9cdfe` y la corrección de Reportes `15d34c41`. La revisión fija acredita 65 rutas frente a main: cinco unidades manuales revisadas y sesenta blobs/modos conservados, sin excepciones en la comprobación independiente. Las diez rutas de #316 permanecen iguales. El Director añadirá este handoff como ruta 66.

Revisión Root completa de frontera `2ad8b1/0`, baseline `c1a561/0` y handoff de integración `3daf24/0`; declaraciones adoptadas por blob exacto desde la revisión íntegra anterior. README se admite mediante la prueba canónica previa y su pin `5f4652d2a47f9a421bda7992dde397a635471c63`; no se volvió a presentar su cuerpo detenido. El audit independiente verificó ambas diferencias de frontera y los sesenta blobs conservados.

Gate 15 local: una ejecución nueva PASÓ según reporte auténtico del Owner, retorno terminal `edcb36/0`: 0 ROJO, 3 AMARILLOS, 3 homónimos. El retorno Native completo original no está bajo custodia del Parent; ese límite permanece.

Frontera local: NO EJECUTADA / NO DISPONIBLE por dependencias ausentes. La invocación preparada `node --test` no se adopta como runner válido de un archivo Vitest y nunca se invocó. Corresponde comprobar el test mediante el runner canónico de la nueva CI, sin instalación local ni invocación alternativa.

Control administrativo original del Owner: recepción desconocida, sin recuperación. Observación actual independiente `be43d6/0`, 05:39:52–53 UTC: rama y SHA exactos, limpio, índice HEAD, MERGE_HEAD ausente y claim DTDCARGO15 ausente. Es evidencia de ese estado actual; no repara el recibo perdido ni acredita ausencia global de procesos.

Respaldo normal Parent terminado: rama `codex/sdd-0573-integracion-main-20261026`. Preflight `b10165/0`, publicación única `afd962/0`, sin force, 05:56:17–20 UTC; lectura remota independiente `78e7da/0`, 05:56:29 UTC, SHA exacto `ca319479`. PR #320 sigue OPEN/DRAFT, HEAD F60 y base originales intactos en ese recibo. La presentación parcial de diffs del Parent permanece parcial; la admisión técnica usa las coberturas independientes acreditadas.

## Continuación y checklist

- [x] Revisar y preservar el candidato fijo ca319, sin recuperar fixtures ni lecturas detenidas.
- [x] Acreditar su respaldo normal remoto y devolver control de publicación al Director.
- [ ] Commit selectivo de este handoff nuevo, con verificación de rama, scope y árbol limpio.
- [ ] Actualizar #320: base main antes del push normal de su HEAD; cuerpo final fiel a la composición, preservando el cuerpo anterior como evidencia fechada.
- [ ] Una CI nueva por el evento de actualización: cotejar SHA/base, quince gates, omisiones y threads. No workflow_dispatch ni rerun automático.
- [ ] Sólo tras revisión y CI conformes, integrar #320 de forma serial, verificar merge/árbol, CI posterior de main y actualizar conocimiento para la nueva main.
- [ ] Resolver los hallazgos y las autorizaciones de la cola restante antes de integrarla. No declarar las veintiuna PRs cerradas.

## Cola pendiente y hallazgos verificados

- #308: dos documentos publicados; el Parent conserva sus dos documentos WIP. No revisar ni publicar ese WIP como entrega.
- #310: hallazgo P3 en `sumarEnUsd`: acumulación Number puede perder un centavo al superar 2^53 centavos. Deducción estática, sin fallo ejecutado ni caller de producción acreditado. Revisión parcial de 60/65 rutas con modalidades distintas; no son sesenta lecturas integrales. Reasignación al mismo CORE pendiente de respuesta humana nominal.
- #311: hallazgo P2: fallos/cap de cartera se transforman en lista vacía para Clientes y en ceros para Niveles. Debe conservarse el estado no disponible en ambos tabs y probarse con el componente real. Reasignación pendiente de la misma respuesta nominal. SQL 0498 y tests revisados estáticamente; DB NO EJECUTADA.
- #312: contrato de día Caracas y cambios C1 conformes dentro de la cobertura estática revisada; integración y pruebas nuevas pendientes. No se adopta el histórico verify incompleto ni sus E2E omitidos como resultado nuevo.
- #313: dos hallazgos del harness: comparación de rutas sensible a mayúsculas en Windows y limpieza condicional insuficiente si Docker conserva un contenedor después de un fallo al arrancar. No se reprodujo fuga ni se ejecutó Docker. Corrección con Owner o reasignación nominal aún pendiente.
- #314: C3 estático conforme dentro de la cobertura; handoff parcial detenido. QA real de UI y composición pendiente.
- #317: fuente BCV/CAS y SQL 0501 estáticamente conformes dentro de la cobertura revisada. Proveedor real NO DISPONIBLE; GO05B 16/17 FALLÓ/INCOMPLETO histórico no se reejecuta ni asciende.
- #318: el mismo CORE fue autorizado para las correcciones nominales; la propuesta sigue insuficiente en T3 autorización transitiva y T4 cierre efectivo de instalación antes de retirar FUSE. No nueva implementación ni recuperación de SQL detenido.
- #321: dos documentos conformes; componer después de #317 conservando sus tres documentos BCV. No aplicar el diff directo #317→#321 porque revertiría esos documentos.
- #319: FD03, respaldo, CI y demo nativa cerrados y congelados. ERP financiero y PDF/OCR/GLM siguen fuera de lo acreditado; no sondear ni despertar al Writer.

Comentarios durables de hallazgos: #310 https://github.com/SoftAgentes/DTDCARGO/pull/310#issuecomment-6408666463 ; #311 https://github.com/SoftAgentes/DTDCARGO/pull/311#issuecomment-6408667083 ; #313 https://github.com/SoftAgentes/DTDCARGO/pull/313#issuecomment-6408898809.

## Límites conservados

La 2.1, PG17 Q/B, migraciones, baseline productivo, rollback y ledger real siguen pendientes. La narrativa histórica de 0495 aplicada contradice su entrada PENDING; se conserva la discrepancia sin consultar DB ni reaplicar. 0496 MIGRATE_FIRST no queda satisfecha por esta integración técnica; 0497 sigue pendiente. CI y tests ficticios no constituyen aceptación financiera, release ni prueba de producción.

PUBLICABLE_CONGELADO=si. `build-image.yml` y `publicable.yml` permanecen disabled_manually; revalidar antes de merge. No producción, deploy, Supabase real, PII, secretos, cuentas, contactos, proveedores ni gasto. Main/push técnico no amplía esas autorizaciones.

Se conservan todos los worktrees, ramas y consumidores. No age cleanup, reset, force, copia de secretos/deps ni instalaciones. No nuevo Worker/modelo. No appinput directo al CORE; coordinación por el mismo Parent. No lecturas de sesiones humanas privadas ni intervención sobre sus procesos.

Todas las lecturas detenidas conservan su estado, incluyendo fixtures, README de composición, Reportes integral, SQL de #318, lecturas históricas de custodia y recepciones perdidas. La preparación anterior en memoria del handoff propio tampoco tuvo recepción íntegra: no se recuperó ni se escribió. Este documento nuevo incorpora el respaldo posterior y el estado actual verificado.

Admin Slice2: rama publicada, candidato `62e61f398dfa309dda980ea09f7dc89c3c5247f9`, suite única 29 PASÓ. La creación de su PR fue rechazada por la revisión automática antes de CreateProcess: `blocked by policy`. Sin URL, sin reintento ni otra vía.

FIN de coordinación o implementación no se infiere de una recepción perdida. Este corte deja publicación/CI/merge de #320 pendientes, sujetos a sus comprobaciones nuevas.
