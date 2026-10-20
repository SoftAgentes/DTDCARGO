# Handoff del Director · continuidad Codex · 2026-10-20

| Campo | Valor |
|---|---|
| Owner | Director Codex, sesión `01a15a4e-ddf0-7d82-8656-d9dc56b58468` |
| Task ID | `director-continuidad-codex-20261020` |
| Objetivo | Retomar el plan contable y su carril de embarques sin perder trabajo ni omitir las fronteras de producción |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\director-continuidad-codex-20261020` |
| Rama y base | `codex/director-continuidad-codex-20261020`, desde `origin/main` `8e9e0f505322cd57b3230cce6b16b45b5554cb8a` |
| Estado | En progreso: tasa única validada localmente y en previa, CI final pendiente; tarifa corregida y A/B local en ejecución |
| Alcance escritor del Director | Este handoff y `docs/audits/2026-10-20-plan-contable-seguimiento-codex.md`, vista resumida autorizada por Sam al pedir continuar con el plan abierto; ningún archivo de producto |
| Autorización | Sam ordenó seguir `C:\tmp\director-traspaso-20261020\PROMPT-CODEX-DIRECTOR.md`. El prompt autoriza continuidad con Workers, commits y ramas propias/PR, y establece el orden de integración/publicación; cada migración y borrado siguen exigiendo aprobación nominal independiente |

## 0. Fuentes y estado de partida

- Prompt recibido y leído en esta sesión. Sam señaló después su **versión final**; se releyó el archivo modificado `2026-10-20T17:24:09Z`, que confirma el verify terminado de 0571 y la implementación de 0574.
- Handoff anterior leído desde `origin/director/traspaso-codex-20261020`, archivo `.agents/handoffs/director-traspaso-codex-20261020.md`; conserva la evidencia histórica.
- AGENTS, skill Director/Worker, runbooks de ingeniería, migraciones, respaldo/restauración y conocimiento.
- Plan contable leído desde `origin/main`, especialmente §8 y §9. El checkout principal local estaba en `fa79394d`, 14 commits detrás. Tras comprobar que no tenía cambios rastreados ni staged, se sincronizó por fast-forward a `8e9e0f50`; se conservaron los archivos sin seguimiento.
- Las reglas y evidencias de la memoria Claude se revisaron mediante un subagente de solo lectura: 108 Markdown = índice + 107 lecciones. Las copias congelada y original coinciden por SHA-256. Son antecedentes, no autorizaciones.
- El enlace adicional de Sam `https://claude.ai/artifact/A1hEYVry1GXFZJdnj2ui1z#d53c897e-ffb6` pidió inicialmente inicio de sesión. Después Sam abrió el plan y ordenó continuar: se leyó directamente su contenido en el navegador integrado. Título «Plan contable: avance y pendientes», corte `17:10Z`; estados desactualizados reconciliados en la vista resumida.

## 1. Límites y permisos

- Director coordina; el código lo cambia un Worker en la tarea y worktree asignados.
- Una sola corrida local pesada a la vez, con turno del Director.
- La aprobación nominal de `0495_fx_rates_conversor_usd`, `0496_tarifa_congelada_por_embarque` y `0497_reverso_al_anular_factura` NO está recibida en esta sesión. Los nombres corresponden a los archivos observados en sus ramas.
- Producción: no se autorizan lecturas de negocio/PII, radiografías nuevas, borrados ni migraciones por el mero traspaso.
- Conservados todos los worktrees/ramas y los archivos preexistentes del checkout principal, incluida `.pnpm-store/`.
- #262 permanece fuera del trabajo: espera Excel 60/64 y costo HR.
- No modificar planes Vercel/Supabase, Tailscale del VPS DTD ni llaves/cuentas externas.

## 2. Recepción y propiedad

El mandato de Sam de adoptar las sesiones Codex en los mismos worktrees incluye la pausa de las sesiones Claude y el relevo explícito. No se basa en antigüedad ni en ausencia de actividad.

### Relevo 0572-a

- Worktree: `DTD-worktrees/sdd-0572-conversor-usd-reemplazos`.
- Cabeza verificada: `4f24a1db09704b1d34cd6073589c95dc84c22ccd`, igual a remoto mediante `git ls-remote`.
- Árbol limpio y `git rev-list --count origin/codex/sdd-0572-conversor-usd-reemplazos..HEAD = 0`.
- Claim recibido: `contabilidad-2026-10-18`, creado `2026-10-20T15:00:03.599Z`.
- Handoff leído en su rama: `.agents/handoffs/0572-conversor-usd-reemplazos.md`.
- Antes de la cesión se comprobó que no quedaba `verify`, `tsc`, `vitest` ni `next build` local corriendo. La validación 0571 terminó.
- El Director liberó explícitamente el claim anterior como parte del relevo solicitado; el nuevo Worker reclamó `codex-0572-01a15a4e-ddf0`, verificó el guard y adoptó la metodología.
- Autorización del Worker: cerrar validación de 0572-a, corregir únicamente defectos propios dentro de su allowlist, commits selectivos y push a su misma rama. La PR espera la integración de #301. Prohibidos merge/deploy/DB real y 0572-b.
- Cierre parcial comprobado: `9c254107c7c1b9544bf91ebff177ab790b438f5f`, local/remoto iguales, árbol limpio y ahead 0. Reparó formatos, fixtures y añadió cinco casos. Pasaron 71 pruebas focales, typecheck y lint. Verify/build/e2e/mutantes NO EJECUTADOS por cambio de prioridad a la dependencia 0569. Claim liberado.
- Pendiente propio adicional: probar que `topAndWorst` no clasifique embarques con ingreso parcial y facturas sin tasa. No se certifica aceptación completa.

### Relevo 0569

- Árbol original limpio en `3d0c9028`, remoto actualizado a `e6579944` por integración del Director. A `17:39:24Z` no se observaron pruebas pesadas ni procesos Node con la ruta 0569.
- Por el relevo explícito de Sam, se liberó el claim anterior `contabilidad-2026-10-18`, creado `11:48Z`. El worktree de integración del Director quedó limpio y su claim también se liberó.
- El Worker confirmó la adopción, ff-only a `e6579944` y claim `codex-0569-01a15a4e-ddf0`. Se le asignó, después de cerrar 0572, el arreglo de los dos P1 y bordes de captura. La allowlist se amplió de 38 a 39 rutas para actualizar el fake del contrato preexistente `app/studio/(app)/facturacion/__tests__/update-invoice-conserva-embarque.test.ts`: conserva sus aserciones de embarque y totales y reproduce los filtros y la fila afectada, sin convertirlo en éxito incondicional.
- Se permite ajustar la 0495 todavía no aplicada si se necesita procedencia persistente o protección transaccional; no se permite renumerar ni tocar migraciones previas. Esto invalida el paquete antiguo si cambia SQL.

### Relevo 0571

- Worktree: `DTDCARGO/.claude/worktrees/peaceful-franklin-a3831e`; rama `claude/peaceful-franklin-a3831e`. Cabeza de adopción local/remota `b70be5d792ca4ee0417426266301a9e2e7fd9ffc`, árbol limpio y sin consumidores observados por ruta.
- El revisor pasó a Worker por asignación del Director y reclamó `codex-0571-cierre-01a15a4e`.
- Encargo: resolver los tres P2 de la revisión actual, sin cambios de SQL ni RBAC. Allowlist de nueve rutas: `propuesta.ts` y su prueba; `RateSnapshotDrawer.tsx` y una prueba nueva de ese componente; spec 0571; handoff 0571; índice de specs solo si lo exige el generador; traducciones warehouse es-VE y zh-CN solo si se necesitan mensajes.
- Preparación de código y regresiones autorizada. Pruebas locales pendientes de turno después de 0569. El verify final se hará sobre la base que corresponda después de integrar las dependencias, sin presentar la validación de `b70be5d7` como prueba del código nuevo.

## 3. Estado contrastado

| Tarea | Cabeza verificada | Estado | Siguiente paso / owner |
|---|---|---|---|
| #301 / 0569 / 0495 | `eb22e2d4` | Pruebas anteriores documentadas; revisión independiente encontró un P2 en la tasa del correo. Esta cabeza deja de ser candidata a aprobación; reparación asignada | Corregir payload, validar y revisar nuevo SHA; regenerar identidad/previa antes de pedir aprobación nominal |
| #307 / 0571 / 0496 | `ba43747a` | Tres P2 corregidos; 62 focales, siete controles, tipos/lint y UI local PASÓ. Árbol limpio, remoto igual y claim liberado; CI nuevo en curso | Actualizar base y ejecutar validación canónica final; después revisión/previa y aprobación nominal |
| 0572-a | `9c254107` | Cierre parcial publicado, árbol limpio y claim liberado; 71 focales, typecheck y lint PASÓ | Retomar después de #301 corregida: ranking sin tasa, verify, mutantes y revisión visual |
| 0573 / 0497 | `89f15a5d` | Implementada; B1, I1–I4 y M1–M9 pendientes según traspaso; sin verify | Worker posterior del carril contable, antes de consideración de integración |
| #304 / 0570 | `1077ff21` | Draft; CI PASÓ. Segundo A/B autorizado y empezado tras devolver 0571 el turno; criterio 5 pendiente | Worker completa ambas fases, comprueba identidad/restauración y entrega al Director antes de publicar evidencia |
| #306 / oficina | `2f9b336c` | Correcciones documentales publicadas y revisadas; Draft. Árbol limpio, claim liberado; CI PASÓ | Director incorpora base y revalida después de #301; no confundir corrección documental con aislamiento del VPS |
| 0574 / 4.5 | `18edcd81` | Implementada; preparación leída, 10/10 rutas propias en allowlist, sin dependencias locales instaladas; depende de #307 | Adopción posterior, instalación congelada, verify con turno y revisión visual |
| 0575 / 2.2 | `8a614250` | Cinco decisiones y propuesta transaccional publicadas; revisión documental PASÓ, spec sigue draft. Árbol limpio y remoto igual | Antes de implementar: contratos, allowlists, base integrada con Caracas y reserva de migración; no iniciar código contable en paralelo |

### GitHub Actions

Sam respondió en esta sesión: **«Ya quedó resuelto»**, sobre el pago/límite de gasto.

Relanzados los runs de las cabezas vigentes:

- main, Calidad: `39453056471`.
- main, Imagen Docker: `39453056216`.
- #304 `59e8491b`, Calidad: `39460332474`.
- #307 `b70be5d7`, Calidad: `39465283137`.

Se confirmó ejecución real de pasos después del relanzamiento. La facturación dejó de impedir el arranque. Docker de main `39453056216` y la imagen publicable `39466238021` terminaron SUCCESS. La publicación posterior se acredita en el apartado siguiente.

Calidad terminó SUCCESS para main `8e9e0f50` (`39453056471`, `17:58:20Z`), #304 `59e8491b` (`39460332474`), #307 `b70be5d7` (`39465283137`) y #301 `e6579944` (`39466459315`). El verde de #301 es anterior a su reparación y no resuelve los hallazgos de revisión.

No se relanzó el run obsoleto `39453136909` de #304 (`e6311891`); se usó la cabeza actual.

### Publicación del main que estaba pendiente

Lectura autorizada de metadatos operativos del VPS, sin filas de negocio ni PII:

- `/srv/dtd-cargo/estado-publicacion/publicaciones.json`, actualizado `18:05:15Z`, informa `corre=publicable=8e9e0f505322cd57b3230cce6b16b45b5554cb8a`, vigilante `al-dia`, sin congelación ni faltantes.
- La publicación automática de ese main ocurrió `17:28:50Z`, tras reactivar las verificaciones.
- Evidencia `/srv/ops/evidencias/publicar-web-20261020T172837Z-publicar-8e9e0f50/salida.txt`: `RESUMEN: 14 PASÓ · 0 FALLÓ (código 0)` y `PUBLICADA 8e9e0f50`.
- Esto acredita el despliegue del main ya integrado por el Director anterior. No hubo merge nuevo ni aplicación de migración por este Director. Smoke funcional autenticado en Studio: NO EJECUTADO.

### Revisión 0571 y límites del verify

Evidencia primaria: `C:\Users\AKX generator\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-peaceful-franklin-a3831e\e35a16e7-ac63-460a-bb7a-2d3925137e99\scratchpad\verify-0571-final.log`.

- Verify sobre `a81dbbd7`, `16:49:56Z`–`17:20:04Z`; `b70be5d7` cambia solo su handoff.
- PASÓ en lo medido: 856 archivos/12.242 pruebas unitarias, 246 contratos SQL, 471 migraciones reconstruidas, build y demás gates locales.
- Omisiones: 1 prueba unitaria y 20 e2e; e2e 176 passed y 2 flaky al reintento, con aviso del harness por salida de WebKit.
- `migrations-applied`: NO DISPONIBLE, sin credenciales. Cierre 16/17, no verde completo.
- La revisión confirmó presencia de las ocho correcciones anteriores; no equivale a una auditoría exhaustiva nueva.
- Al iniciar la revisión, el claim estaba ausente aunque el handoff decía vigente. Después se realizó el relevo explícito y se reclamó `codex-0571-cierre-01a15a4e`.

Revisión actual sobre `b70be5d7`, con lectura del SQL, acciones, consultas y formulario; sin acceso a filas reales:

1. **P2 · búsqueda truncada.** `propuesta.ts` recorta candidatos parciales antes de comprobar coincidencia exacta normalizada. Un cliente exacto detrás de 50 coincidencias parciales, o un estimado exacto detrás de 20, queda omitido. Reproducido en memoria con las funciones reales y datos ficticios. Corregir con paginación estable: resolver ambigüedad de clientes y reunir los estimados exactos sin confundir límite de candidatos con límite de resultados.
2. **P2 · precio previo mientras recalcula.** Después de cambiar un precio manual, el total anterior puede quedar visible y el botón aceptar la entrada nueva antes de terminar su consulta. La base calcula con la entrada nueva; no se atribuye un cálculo incorrecto al SQL. Invalidar inmediatamente la vista previa y exigir que corresponda a los valores actuales tanto en el botón como en el envío. Reproducción UI ejecutada: NO EJECUTADO.
3. **P2 · respuesta anterior después de cambiar servicio.** Una consulta LCL lenta puede sustituir los datos de una DDP más reciente. El RPC rechaza una tarifa de otro servicio; el problema visible es la selección obsoleta y el intento fallido. Descartar respuestas que no correspondan a la recepción y servicio actuales. Reproducción UI ejecutada: NO EJECUTADO.

No se encontró un P1 nuevo en el alcance revisado. El SQL conserva controles de cliente, servicio y reemplazo atómico. Los límites de roles y alcance de almacén previamente documentados no se amplían dentro de este encargo.

### Integración preparatoria y revisión 0569

Worktree propio del Director: `DTD-worktrees/director-pr301-codex-20261020`; rama `codex/director-pr301-codex-20261020`; claim `director-pr301-01a15a4e-ddf0`.

- Merge limpio de `origin/main` `8e9e0f50` sobre `3d0c9028`; nueva cabeza `e6579944c5bfdc5c4addf23a59fa477f3219db7b`, publicada en la rama de #301.
- `docs:check`, numeración y `git diff --check`: PASÓ. No cambia el SQL ni el producto de 0569 al incorporar main.
- Paquete local: `C:\tmp\director-traspaso-20261020\0495-codex-e6579944`; blob `eb07813af789d05cf6ae94b3ed4e8872da810194`, md5 `409aca3756233d41afaf831b96394657`, 23.514 bytes. Preparación y previa **en seco** PASÓ.
- Previa en VPS: **NO EJECUTADO** en esta sesión. Aplicación: **NO EJECUTADO**.
- Revisión nueva: `tasaDelDocumento` hereda `source=manual` del catálogo; `emitInvoice` interpreta ese mismo valor como tasa manual de la factura y omite refrescarla. Escenario: borrador usa tasa de tabla del día 1, tabla cambia, emisión posterior conserva la anterior. No basta CI verde: resolver procedencia y prueba de regresión antes de aprobación.
- Segundo P1: `updateInvoice` y `emitInvoice` escriben solo por ID después de leer el estado. Una edición puede cambiar VES a CNY mientras emisión resuelve VES, o una edición iniciada en borrador puede terminar después de emitir. Exigir actualización atómica o condicional sobre la versión comprobada, verificar fila afectada y no continuar con asiento/correo tras perder una carrera.
- Aceptación complementaria del mismo cierre: el drawer debe limpiar o resolver tasa al cambiar moneda; duplicar y emitir otro día debe seguir la procedencia correcta; rechazar una tasa positiva que no pueda persistirse positiva en `numeric(20,8)`. Este último borde de precisión era preexistente, no se atribuye al merge de main.
- Revisión manual completa de 38 archivos contra main: todos en allowlist. No se detectó salto nuevo de tenant/rol en la ruta normal de 0495. Límite explícito: `service_role` conserva privilegios amplios; la auditoría no cubre TRUNCATE. Reproducción ejecutada y scan formal del plugin: NO EJECUTADOS.
- Se reservó el verify canónico de 0572 hasta corregir esta dependencia; su Worker termina primero las correcciones focales y un handoff parcial, antes de cambiar de tarea.
- El paquete `e657` es evidencia de preparación local, no candidato aprobado para aplicar. Si la reparación cambia SQL, deben recalcularse blob/md5/bytes y repetir revisión, previa viva y aprobación sobre el paquete nuevo.

### Precisión delegada del contrato de tasa

El resolver histórico admite tasas con fecha anterior (`valid_on <= día`). El Director precisó por la delegación del §9 del plan maestro que la **emisión automática de una factura VES exige tasa con fecha de valor igual a la fecha de emisión**. Si solo hay una anterior, falla cerrado. Se conserva el override documental explícito y trazable; no se extiende por inferencia esta exigencia a CNY ni se cambia el resolver histórico de borradores/CxP.

La precisión queda asignada a la spec y regresiones de 0569. No implementa autocarga BCV, reglas de fines de semana ni la unificación de hora de Caracas. El Worker prepara también una versión de escritura que cambie en toda actualización, independiente de los valores enviados por el cliente, para impedir efectos después de perder una carrera.

El parche de producto de ocho rutas quedó preparado fuera del worktree, en `C:\tmp\director-traspaso-20261020\0569-codex-validation\prepared`, mientras se conserva la base con las regresiones para observar el fallo inicial. El Director leyó las ocho rutas: marca persistente de override, versión de escritura, comparación de versión/estado/moneda, limpieza de tasa al cambiar moneda y rechazo de valores que redondean a cero. Sin hallazgo adicional en esa lectura; ejecución roja/verde, SQL, mutantes y verify todavía pendientes de turno. El paquete 0495 anterior queda obsoleto cuando se aplique este cambio.

### Reparación 0569 publicada y revisión visible · 18:44Z

- Cabeza local/remota y de #301: `5f0d04ad0749df5aa79c3a3f4635e83ce2c1eeae`, árbol limpio, ahead 0. Cambió 20 archivos dentro de las 39 rutas permitidas. El Director leyó los cambios de producto/SQL, los contratos y el ajuste final del reset del formulario; sin hallazgo adicional en esa revisión.
- Control rojo sobre `e6579944`: 24 fallos de aserción de app, sin errores de preparación, y fallo SQL por falta de intención documental. Verde actual: seis archivos/89 pruebas de app; 32 pruebas PGlite con 26 mutantes; 13/13 mutantes adicionales de app muertos y restaurados por SHA-256. Typecheck, lint y gates documentales PASÓ; símbolos 0 rojo/1 amarillo declarado, solo 0495.
- La primera vuelta verde reveló que el valor interno de NumericInput sobrevivía al cambio de moneda; se corrigió con `key={currency}`. La revisión visible encontró luego que el reset de React devolvía el selector a USD tras un error: regresión roja y corrección local del formulario con listener nativo. El componente compartido no se cambió para resolver estos dos bordes.
- Revisión independiente del Director en navegador integrado: VES 36 → CNY deja el campo vacío; Guardar muestra la falta de tasa de CNY y conserva el selector/etiqueta CNY. **PASÓ en fixture local**, componente real, datos sintéticos, acciones simuladas, sin base de datos. Captura fuera de Git: `C:\tmp\director-traspaso-20261020\0569-codex-validation\director-cny-error-local.png`. No certifica persistencia real, tipografía completa ni Studio en producción.
- Verify canónico iniciado sobre `5f0d04ad`; log `C:\tmp\director-traspaso-20261020\0569-codex-validation\verify-5f0d04ad.log`. CI `39477364923` en curso. El Worker no editará producto durante la corrida.
- Paquete nuevo desde esa cabeza: `C:\tmp\director-traspaso-20261020\0495-codex-5f0d04ad`; blob `c6d17d946d957a29791fec426a1213a05efa7bf4`, md5 `c0c9dac855a516179085950a187737d7`, 28.118 bytes; md5 de aplicar `871eafcb1b6850e96d1eba112a62ede3`. Preparación y previa en seco PASÓ. Si cambia la cabeza antes de aprobación, regenerar identidad y previa. El paquete `e657` quedó obsoleto.
- **Previa viva PASÓ** `18:45:25Z`–`18:45:26Z`, evidencia `/srv/ops/evidencias/previa-0495-dtd-cargo-20261020T184525Z`. Lectura de `previa.out/err` comprobada: 498 filas de ledger, última versión `20261020131949`, 0495 ausente, 0 esperando locks, 0 transacciones largas, las seis funciones nuevas ausentes como esperaba el repositorio y preflight propio aprobado. Transacción `READ ONLY` terminada con `ROLLBACK`; ninguna migración aplicada. Los scripts remotos coincidieron por SHA-256 con los del checkout. No se leyeron filas de negocio/PII.
- Conteos de volumen a las `18:57:07Z`, transacción de solo lectura y rollback: `invoices` 7 filas/90.112 bytes totales; `supplier_bills` 0 filas/40.960 bytes. Evidencia fuera de Git: `C:\tmp\director-traspaso-20261020\0495-counts-readonly.sql` y su `.out`. Son conteos, sin contenido de filas; no clasifican esas siete facturas como datos de prueba ni autorizan tocarlas. El comentario histórico del SQL no se cambió para perseguir este conteo.
- Primera pasada general del verify actual: 859 archivos PASÓ, uno FALLÓ y uno OMITIDO; 12.276 pruebas PASÓ, una FALLÓ y una OMITIDA. Único fallo informado: timeout de 20 s en `app/p/[token]/supplier-flow.test.tsx`, caso de corrección y reenvío sin vaciar el formulario. Duración 610,68 s. **Reintento canónico 1/1 PASÓ** sin cambios: 860 archivos/12.277 pruebas aprobados y una prueba omitida, 544,09 s. No se cambió portal, configuración ni timeout; el fallo no persistió y no se repitió una focal sin nueva razón.
- **Verify canónico sobre `5f0d04ad`: cierre incompleto, 14/17 pasos medidos, sin fallos en su resultado final.** E2E: 176 PASÓ, dos flaky (carrusel visual Chromium y selector calculadora mobile-chrome, ambos aprobados en reintento), 20 OMITIDOS; build PASÓ. `migrations-applied` NO DISPONIBLE por ausencia de credenciales de producción en el worktree; `sql-tests` y `schema-rebuild` NO DISPONIBLES porque Docker estaba detenido. Exit 0 no equivale a cierre completo.
- Diagnóstico de Docker del Worker: cliente y Desktop instalados, contexto local `desktop-linux`, pipe del motor ausente y Desktop detenido; no es ausencia de binario ni override remoto. El Director autorizó arrancar la instalación local oculta **después** del build y ejecutar contratos SQL/rebuild secuenciales, sin reinstalar, modificar configuración ni tocar contenedores ajenos. El Worker conserva el turno pesado hasta esas comprobaciones y la retirada de su recurso propio. El resultado suplementario se registrará separado de los SKIPs originales.
- **Complementos locales PASÓ**, sobre el mismo `5f0d04ad`: SQL `19:15:50Z`–`19:18:06Z`, 246 contratos incluida 0495, rollback total; rebuild `19:18:19Z`–`19:18:57Z`, 471 migraciones aplicadas, 18 solo-ledger y aislamiento de 219 tablas. Imagen local `postgres:17`, digest `sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`. Logs/JSON cotejados por el Director en `0569-codex-validation/`. Ambos contenedores propios retirados; los cuatro ajenos siguieron detenidos. Docker volvió al estado detenido y el Worker comprobó cero procesos propios. El verify original no se reescribió: sus tres SKIPs siguen visibles, con dos resueltos por estas evidencias. Ledger productivo pendiente de release, no motivo para aplicar antes de revisar la PR.
- **Cabeza final de #301: `eb22e2d4b414deb7d0983fa2e6524e0c99697fc8`.** El Director revisó íntegramente el cambio desde `5f0d04ad`: solo spec y handoff, 82 inserciones/10 eliminaciones; comparación excluyendo esos dos documentos vacía. El producto y el SQL conservan exactamente los bytes validados. Base comprobada `8e9e0f50`; rama limpia, respaldada y claim liberado. El CI de esta cabeza es `39483179492`, iniciado `19:24:50Z`, todavía en curso; no se reutiliza como resultado suyo el CI de otra cabeza.
- Paquete definitivo desde `eb22e2d4`: `C:\tmp\director-traspaso-20261020\0495-codex-eb22e2d4`, generado `19:26:03Z`. Blob `c6d17d946d957a29791fec426a1213a05efa7bf4`, md5 `c0c9dac855a516179085950a187737d7`, 28.118 bytes, SHA-256 SQL `964abe064db544ac2b6f19592a24d3d45d6bef68c0ffa2e1e43279d2b20e8ab7`; md5 de aplicar `871eafcb1b6850e96d1eba112a62ede3`. Identidad, comprobación local y previa en seco PASÓ. El paquete anterior `5f0d04ad` ya no identifica la cabeza final aunque el SQL sea idéntico.
- **Previa definitiva PASÓ `19:29:17Z`**, evidencia `/srv/ops/evidencias/previa-0495-dtd-cargo-20261020T192916Z`. Salidas leídas: 498 registros, última versión `20261020131949`, 0495 ausente, cero locks en espera y cero transacciones largas; seis funciones nuevas ausentes como se esperaba, sin deriva aceptada y preflight propio aprobado. `BEGIN READ ONLY`/`ROLLBACK`; ninguna aplicación ni lectura de filas de negocio. Falta CI verde de `eb22e2d4` antes de presentar el OK nominal.
- Respaldo diario: lectura de metadatos systemd a `19:35:21Z` informa `Result=success`, `ExecMainStatus=0`, salida del servicio `2026-10-20 08:06:27 CEST` = `06:06:27Z` = `02:06:27` Caracas; próxima activación mostrada para el 21 de octubre. No se leyeron dumps ni claves. Es resultado del servicio, no una restauración comprobada nueva; los restores del 21/22 siguen pendientes.

### Recuperación del informe de revisión 0573

Se recuperó el informe completo del Director anterior desde su registro local, entrada de `2026-10-20T16:38:57.720Z`, UUID `9c280073-37eb-4882-a244-28592b36c880`. Fuente: `C:\Users\AKX generator\.claude\projects\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\267f5ded-5bbc-4289-a807-7248e4322009.jsonl`, línea 15292. Es evidencia histórica de revisión, no una autorización adicional. Los hallazgos siguen pendientes sobre la cabeza `89f15a5d`; ningún Worker nuevo ha comenzado a repararlos.

| ID | Hallazgo recibido y aceptación de la reparación |
|---|---|
| B1 | Impedir anular manualmente un asiento de reverso o el asiento original ya revertido. El guard de base debe evitar duplicar el reverso o revivir el original; ocultar también la acción en el libro diario y probar ambos casos. |
| I1 | Acotar por tenant todas las lecturas de asientos, líneas y recibos del RPC. Verificar cuenta y enlace `reverses_entry_id` dentro del mismo tenant, factura y fuente; distinguir la restricción de unicidad al manejar conflictos. Probar contaminación cruzada con datos ficticios. |
| I2 | Reconciliar factura y reverso cuando caen en meses distintos. Definir una comparación consistente para ambos lados; no tratar reversos VES/CNY como USD comparable. Probar los períodos separados. |
| I3 | Evitar que una emisión y una anulación concurrentes dejen un asiento de venta activo después de anular. El posting debe comprobar estado y serializarse con la anulación dentro de la transacción; no basta otra lectura separada desde la aplicación. |
| I4 | Ejecutar typecheck, lint y verify, registrar omisiones y revisar el SHA resultante. |
| M1 | Si falla el conteo de recibos al anular, bloquear la operación; no interpretar el error como cero cobros. |
| M2 | Un asiento de venta en borrador no puede quedar vivo al anular la factura: rechazar o anularlo de manera definida y atómica. |
| M3 | La fecha del reverso no debe anteceder hoy, el primer día abierto ni la fecha del asiento original. |
| M4 | Mantener el motivo humano solo en el registro previsto D2. El memo contable usa referencias fijas de factura, asiento y fecha; no copia texto libre. |
| M5 | Corregir el contrato de `canVoid` y `restrict` en la spec para que corresponda al comportamiento. |
| M6 | Corregir el JSDoc desplazado en `libro-control`. |
| M7 | La radiografía debe detectar reversos de facturas no anuladas y originales anulados incorrectamente. No ejecutar esa lectura en producción sin autorización. |
| M8 | Documentar y mantener la dependencia de aplicar la migración aprobada antes de integrar el código que la requiere. |
| M9 | El postflight debe comprobar propietario de la función y definición exacta del CHECK. |

Puntos de partida del informe: `LibroDiarioTab`/`accounting/actions`, `0497_reverso_al_anular_factura.sql`, `libro-control`, `ingreso-periodo`, `facturacion/actions`, `invoice-posting` y `sales-orders/actions`. El siguiente Worker debe leer las rutas y líneas vigentes antes de editar, revisar su allowlist y demostrar cada cierre. La numeración de líneas del informe antiguo no es una ubicación garantizada después de actualizar la base.

### Corrección documental de #306

Commit `2f9b336cd3a10b244f30be58f7e6466a2dd2b08c`, local/remoto/PR coincidentes según cierre comprobado. Siete rutas de las 23 de la allowlist original; el Director leyó el diff de las correcciones. Se excluyen perfiles privilegiados de contratación ordinaria, se elimina compartir perfiles, se retiran órdenes de repetir contrataciones y se separan evidencia histórica y estado vivo.

El aislamiento entre procesos del mismo usuario `agentes-run` y la conformidad de la copia filtrada siguen **NO VERIFICADOS**. No se leyó una llave, no se probó acceso al VPS ni se modificó su configuración. El anexo Telegram permanece para una PR posterior.

Docs (555 specs), numeración, diff y 24 enlaces locales PASÓ. Los lanzadores pnpm intentaron instalar dependencias: el Worker detuvo solo sus procesos y usó las entradas Node directas; no cambió el lockfile. La instalación parcial ignorada se conserva. Conocimiento devolvió `ok=false`, estructura INVALID; derivados pendientes. CI del nuevo SHA: run `39472795934`, **PASÓ**, check completado `18:47:57Z`. Base `fa79394d`, aún pendiente actualizar después de #301.

### Decisiones delegadas de 0575

En `b4bd7cc23394fde1e8543ffc400e271bbd2b9006`, publicadas en su rama y verificadas:

1. RPC atómica por documento, con fallo cerrado.
2. Período cerrado bloquea salvo excepción gobernada por 0566; no cambiar fecha silenciosamente.
3. Sección dentro de «Por contabilizar».
4. Tres PR secuenciales; número de migración pendiente de inventario y reserva.
5. Gasto incluido desde el contrato de 0575-a y conectado en 0575-b.

El intento fallido debe quedar consultable sin cabeceras, líneas ni vínculos parciales; falta concretar cómo persistir ese motivo sin que el rollback lo elimine. La radiografía del 18 de octubre se clasifica como datos de prueba según decisión de Sam en el §9 del plan; no autoriza reparación ni borrado.

Solo cambiaron spec y handoff de la tarea. `docs:check` (556 specs), numbering y diff-check PASÓ; pruebas de producto NO EJECUTADAS por alcance documental. Claim liberado y árbol conservado. Evidencia: `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md` en su rama.

Actualización documental posterior: **`8a61425055ca5a8023e526fa5a218d70ee6381ad`**, local/remoto comprobados, ahead/behind 0/0, limpio. Tres archivos: spec, handoff y `assets/contrato-transaccional-propuesto.md`; no producto, SQL ni nuevo número. El Director revisó el diff de la spec, la propuesta original completa, la matriz por flujo y la adaptación al asset; cotejó su SHA-256 `3c702db1870eecf41e15f8a03e11268f082ed55ecb8e4329c3b8d37af32072f0` y la ref remota. **Aceptación documental PASÓ sobre ese SHA**; integración e implementación pendientes.

El asset conserva 17 referencias y hashes de fuentes, 16 criterios por probar y una matriz de diez casos. Corrige `supplier_bill` frente al posible kind de UI `bill`, la protección de unicidad de gasto ya existente y la definición de asiento válido como `asentado`. Se revisó la dirección de subbloque reversible/motivo exterior condicionado a commit, ensayo sin efectos, resultado desconocido/reconciliación y guarda de cierre en la mutación de origen. No basta una RPC contable posterior para deshacer un documento ya confirmado. Los permisos de retry manual y los de operación automática quedan separados; `service_role` no concede excepción de cierre. Las firmas, capacidades definitivas, allowlists por PR y base con Caracas siguen pendientes del contrato futuro.

Validación de ese cierre documental: generador/índice de 556 specs, numbering sin conflictos nuevos (11 excepciones históricas conservadas), 34 enlaces locales, 27 anclas y diff incluido el asset: PASÓ. Sin procesos pesados ni nueva PR. El Worker informó claim liberado. El temporal original permanece fuera de Git en `C:\tmp\director-traspaso-20261020\0575-contrato-propuesto.md`, SHA-256 `177d4b07450cded9f229358ef4bf0eb4c043788f29f019db842e9474a22ce760`; sus enlaces absolutos se adaptaron al asset.

### Dependencias y concurrencia

| Relación | Clasificación | Motivo |
|---|---|---|
| 0569 → 0572-a | REQUIERE INTEGRACIÓN PREVIA | Contrato del conversor/procedencia; PR 0572 espera #301 |
| 0572 / 0573 | DEPENDIENTE | Carril contable serial; diffs acumulados comparten facturación y declaraciones de migraciones |
| 0571 → 0574 | REQUIERE INTEGRACIÓN PREVIA | 0574 lee `shipment_rate_snapshots` de 0496 |
| 0572 / 0574 | PARALELIZABLE con coordinación | Producto separado; índice y declaraciones se reconcilian al integrar. Pruebas pesadas seriales |
| 0575 | DEBE ESPERAR para código | Solo decisiones documentales en este bloque; contrato, número y allowlists de cada PR pendientes |

0574 está limpio y respaldado en `18edcd81`, ahead/behind 0/0 y claim ausente. No se observaron consumidores por ruta ni chat asociado; no prueba ausencia de cwd ocultos. No tiene `node_modules` ni `.env.local`. El código final de 0571 `2e94bccc` ya es ancestro: los posteriores `a81dbbd7`/`b70be5d7` solo agregan evidencia documental. No necesita producción para probarse localmente.

Los contratos de 0574 conservan `shipment_id`, `client_markbox` y `status`; el único solapamiento de archivos propios con 0572/0573 es el índice de specs. Aun así, 0572 modifica otros componentes de Dirección y Reportes: hace falta revisión combinada de la pantalla, no afirmar que no toca esos módulos.

Turno de máquina actual: **0569, reparación del aviso de tasa**, concedido después de recibir la devolución explícita de A/B304 a `19:54:13Z`, con restauración y procesos comprobados. No iniciar otra corrida pesada, Graphify update ni Archify build hasta su devolución. El cierre de #304 continúa solo con documentos.

El A/B usa los mismos 34 archivos, 2 workers y semilla/entorno/lockfile iguales. A restaura temporalmente solo imports/constructores previos; B usa los bytes de la cabeza original, con respaldos y hashes. Conserva aserciones y mutantes. Un preflight del comprobador falló antes de lanzar pruebas y restituyó 36/36 archivos; quedó separado. Duración inicialmente estimada 10–18 minutos, revisada a 25–30 al observar los primeros archivos; el Director autorizó completar hasta 35 minutos con aviso si necesita más. No hay resultado de aceptación todavía.

El watchdog de 20 minutos interrumpió A: `18:11:47.770Z`–`18:31:48.616Z`, 1.200,846 s, salida controlada 1; 26/34 archivos y 649 casos informados sin fallas. B **NO EJECUTADO**; no hay JSON final de Vitest ni identidad completa de casos A/B. Se restauraron 36/36 archivos por SHA-256, cero diferencias, sin procesos Node observados de esa ruta. Commit documental `1077ff216956d2062f3ce281971f68d084fe0a92`, árbol limpio, remoto igual y claim liberado. El criterio 5 permanece pendiente: no hay excepción ni conclusión local de rendimiento. El próximo intento necesita un watchdog suficiente fijado antes de arrancar.

GitHub de #304 sobre `1077ff21` y base `8e9e0f50`: run `39476193413`, **PASÓ**, check completado `19:01:29Z`. Este resultado no reemplaza la comparación local incompleta. El runner del intento anterior conserva SHA, directorio y watchdog antiguos; el siguiente encargo debe actualizar los tres antes de comenzar, manteniendo respaldos y restauración verificada de 36 archivos.

0571 dejó preparados ocho archivos y pruebas de los tres P2: paginación estable, descarte de respuestas antiguas y vista previa ligada a los valores actuales, incluyendo A→B→A. El Director leyó los cambios; todavía no hay ejecución roja/verde. La prueba de componente usa NumericInput real. El Worker conserva `codex-0571-cierre-01a15a4e` y espera turno.

Tras recibir el turno, el encargo de 0571 comprende focales rojo/verde, mutantes pertinentes, tipos/lint/documentación y fixture visual con datos sintéticos; commit/push y actualización de #307 autorizados. No incluye SQL/0496, migraciones, DB real, entorno ni cambios de RBAC. Verify completo espera la base integrada final. La redacción anterior conserva el estado de preparación previo, no un resultado de pruebas actuales.

**0571, resultado focal comprobado por el Director:** cinco archivos/62 pruebas PASÓ; siete controles rojos/mutantes detectados y hashes de las cuatro fuentes iguales antes/después. Cubren paginación exacta, ambigüedad entre páginas, confirmación de una preview obsoleta, respuestas cruzadas de carga/preview, regreso A→B→A e identidad del traductor. Typecheck, lint de seis archivos sin warnings, docs y numbering PASÓ. Evidencia: `C:\tmp\worker-0571-cierre-20261020\`. No sustituye el verify completo en la base final.

Revisión visible independiente del Director en IAB: formulario real con NumericInput, estilos y traducciones, acciones sintéticas y sin conexión a DB. Tarifa 900 retira el cálculo viejo mientras espera, luego muestra 1.800 USD; error simulado 999 elimina el importe anterior, conserva los datos y bloquea confirmar. Captura `director-error-sintetico.png` en esa carpeta. Pestaña del Director cerrada; Worker autorizado a cerrar su servidor y devolver explícitamente el turno antes del A/B. Su revisión adicional de móvil, chino, oscuro, rol de lectura y teclado queda atribuida al Worker. `SERVICE_OPTIONS` conserva un texto español preexistente bajo chino; fuera de alcance, no se presenta como traducción completa.

**Preparación del segundo A/B de #304 revisada:** `C:\tmp\director-traspaso-20261020\0570-ab-local-reintento\`, cabeza `1077ff21`. 33 archivos afectados/846 casos más helper de ocho, 34/854 por fase; 27 archivos/36 constructores temporalmente revertidos para A. Dos workers, semilla 570 y límite de 45 minutos por fase fijado antes de mutar. Respaldos de bytes de 36 archivos y restauración/hash después de A y nuevamente al salir. Comparador exige mismos casos, resumen completo y restauración limpia antes de calcular porcentajes. El intento previo solo respaldaba bytes de 27 archivos y comprobaba hashes de 36; no se confunden ambas medidas. Sintaxis de runner/comparador PASÓ; pruebas nuevas NO EJECUTADAS y claim aún ausente al cierre de preparación. No se usa el resultado parcial anterior para completar este par.

**Inicio posterior autorizado del A/B:** 0571 confirmó servidor detenido y cero procesos propios. El Worker de #304 revalidó identidad, limpieza, hashes y consumidores; adquirió `codex-0570-ab-reintento-01a15a4e` y guardó autorización/adopción fuera de Git antes de ejecutar. No se cambiará su árbol durante el par aunque avance `origin/main`; cualquier integración posterior requiere revisar compatibilidad con esa base. Sin reintento automático, SQL real, instalación ni commit de evidencia antes de revisar el resultado.

**Cierre 0571 respaldado:** `ba43747a803ea9aec3b8750d1b461d69795834a5`, rama/remoto/PR coincidentes y ahead/behind 0/0; ocho archivos permitidos, ningún SQL/RBAC y claim ausente. Director leyó el cierre documental y cotejó las pruebas/captura; CI nuevo `39484581257`, iniciado `19:34:18Z`. GitHub informa base `f9b86db1` de la PR; `origin/main` sigue `8e9e0f50`, comprobado por fetch sin prune. Debe incorporar la base final después de #301; no se considera listo para merge por este cierre focal.

### Checklist visible solicitado por Sam y revisión final · 19:47Z

Sam pidió un checklist del segundo documento trabajado con Claude, para seguir los avances con checks en el panel derecho. Se conservó el archivo propio de seguimiento y se amplió a todas las fases del plan: pasos terminados, tareas abiertas, 2.1 desglosada, secuencia de entrega, pendientes de Sam, controles periódicos y partes en pausa. Se interpretó el documento como «Plan contable: avance y pendientes», usando el contenido ya recuperado y el plan maestro. El enlace Claude no pudo reabrirse al no haber una pestaña disponible; no se presenta esta actualización como una nueva lectura de la interfaz.

Los seis puntos originales y cinco extras se cotejaron con las PR fusionadas #277, #280, #283, #286, #284, #298, #287, #288, #291, #293 y #300; sus once commits son antecesores de `origin/main` `8e9e0f50`. Metadatos del VPS a `19:40:32Z`: corre/publicable `8e9e0f50`, vigilancia al día; recibo de publicación ya comprobado 14 PASÓ / 0 FALLÓ. Esto sustenta «integrado y publicado», no una nueva comprobación funcional de los once recorridos.

El archivo Markdown se envió al panel derecho con `open_in_codex`; la app devolvió `queued`, no confirmación de visualización. Se conserva enlace directo para Sam. Ninguna tarea se marca completada por el solo hecho de crear el checklist.

Revisión documental independiente del checklist contra plan maestro y handoff: **PASÓ**, sin puntos activos omitidos ni cierres materiales sin sustento. Se comprobó que permanecen 7.2, conciliación bancaria, saldos iniciales, permisos, alcance Excel de 4.1, pausas fiscales y exclusión del conector/corte QuickBooks. El revisor no volvió a abrir Claude ni revalidó los once merges; esas comprobaciones siguen atribuidas al Director.

**P2 nuevo de 0569:** el informe independiente `C:\tmp\director-traspaso-20261020\0569-codex-validation\revision-independiente-final.md` revisó las 39 rutas sobre `eb22e2d4`/base `8e9e0f50`, sin nuevos P1. En `emitInvoice`, el CAS persiste la tasa vigente, pero el correo toma `current.fx_rate` previo: un borrador 36 emitido a 40 podría entregar `bcv_rate="36"` si una regla de correo usa esa variable. Confirmado también por lectura del Director; no se consultaron reglas ni datos productivos. Prueba roja nueva NO EJECUTADA. La cabeza `eb22e2d4` y su previa quedan como evidencia anterior; no procede pedir aún la aprobación de 0495.

Reparación asignada al Worker de 0569 en su worktree/ramal propios, con guard y claim previos. Allowlist exacta de esta corrección: `app/studio/(app)/facturacion/actions.ts`, `app/studio/(app)/facturacion/__tests__/factura-congela-la-tasa.test.ts`, `docs/specs/0569-conversor-usd-tasas/spec.md` y `.agents/handoffs/0569-conversor-usd-tasas.md`. Debe usar la tasa persistida devuelta por el CAS, cubrir 36→40, override, tasa antes ausente y cero correo/asiento al perder carrera. Sin SQL, RBAC, helper de correo ni otras rutas. Preparación autorizada; tests, commit y push esperan instrucción posterior. A/B304 conserva su turno.

**0573, propuesta entregada:** `C:\tmp\director-traspaso-20261020\0573-encargo-reparacion-codex.md`, SHA-256 `2b8e62ff71098e812d9e29804530884f152c4ffee2e179c667e1199372f8e2ef`. Matriz de 14 hallazgos B1, I1–I4 y M1–M9, pruebas propuestas y dependencias; 29 rutas existentes, ocho ampliaciones propuestas y cinco condicionadas a I2. No se concedió escritura en esas ampliaciones ni se ejecutaron pruebas. I2 sigue como propuesta; el Director aún debe cerrar el encargo antes de una reparación. Conserva 0497, sin renumerar/aplicar.

### Comparación local completa de #304 y traspaso de turno · 19:56Z

Par `20261020T193515078Z` sobre `1077ff216956d2062f3ce281971f68d084fe0a92`: A `19:35:16.406Z`–`19:45:57.971Z`, B `19:45:59.674Z`–`19:52:01.424Z`. Cada fase terminó exit 0, 34/34 archivos y 854/854 casos, cero fallos/omitidos y firmas iguales por archivo. El Director leyó reporte TXT, manifest, resúmenes JSON, restauraciones y criterio 5 de la spec; acepta la comparación local completa.

Pared A/B: 641,565 → 361,750 s, reducción observada 43,614 %. Suma de los 33 archivos afectados: 1.212,711 → 630,722 s, reducción 47,991 %; no equivale a pared con dos workers. El helper intacto fue 16,675 → 20,909 s y se excluye del agregado de afectados. Un solo par A→B, sin repeticiones AB/BA ni intervalo de confianza; no extrapolar al CI ni afirmar mejora garantizada bajo otra carga. No se mezcla el intento parcial anterior.

Evidencia: `C:\tmp\director-traspaso-20261020\0570-ab-local-reintento\runs\20261020T193515078Z\`; `comparacion-local.json` SHA-256 `c96139535505af4f6d6373c2909e21fcaea0313933636e0160c29eb17cca2f69`, TXT `a87741d0a68e8d0fa3972a8540f54045061e850b3b98c2316ccecc016bbabb1a`. Restauración intermedia y final 36/36 hashes, seis configuraciones y tres entradas de runtime iguales; árbol limpio, cero procesos propios/consumidores visibles y claim liberado según recibo `liberacion.json`, `19:54:13Z`. Turno devuelto expresamente.

Criterio 5 aceptado sin excepción. Worker autorizado a reclamar solo para spec/handoff y evidencias documentales previstas, commit selectivo, push y actualización de #304. Producto/helper intactos; cabeza y CI nuevos pendientes de revisión. El turno pesado pasó a 0569 para rojo/verde, control del P2, tipos/lint y verify canónico sobre su nuevo SHA. Commit/push de sus cuatro rutas autorizado tras los controles focales; sin SQL/Docker/UI repetidos si se acredita identidad intacta.

`knowledge:status` de lectura repetido desde main `8e9e0f50`; resultado en `C:\tmp\director-traspaso-20261020\knowledge-checklist-20261020.json`: estructura PENDING/453, piloto 12/16, global 12/1320, Archify/Obsidian PENDING. Sin actualización ni publicación de derivados mientras el turno está ocupado.

## 4. Checklist vivo de continuidad

Vista con checks para Sam: [Checklist del plan contable](../../docs/audits/2026-10-20-plan-contable-seguimiento-codex.md). Este §4 sigue siendo el registro vivo de coordinación; ambos documentos pertenecen al Director.

El checklist histórico del §4 anterior conserva 36 tareas vivas, 6 hechas, 1 en curso y 29 pendientes; esos conteos no se vuelven a afirmar como medición actual sin reconciliar cada entrega.

- [x] Leer prompt, handoff anterior, plan y reglas.
- [x] Actualizar referencias e inventariar PR/worktrees.
- [x] Confirmar respaldo remoto y ausencia de cambios sin commit en las ocho ramas de la tabla del traspaso.
- [x] Confirmar que 0572-a ya está subida; no repetir su implementación.
- [x] Obtener de Sam el estado de facturación y relanzar CI vigente.
- [x] Confirmar Calidad de main/#301/#304/#307 y publicación automática del main pendiente con evidencia 14/0.
- [x] Leer memoria Claude completa mediante revisor.
- [x] Crear el checklist visible de todas las fases y cotejar los seis puntos y cinco extras integrados.
- [x] Completar revisión independiente de #301 sobre `eb22e2d4`; P2 nuevo documentado.
- [x] Completar y revisar el par A/B local de #304, 854/854 casos por lado, restauración comprobada.
- [ ] Corregir la tasa del aviso de factura y validar/revisar su nueva cabeza.
- [ ] Cerrar el relevo y la validación de 0572-a.
- [ ] Revisar/preparar #301 en su cabeza actual y con base actual.
- [ ] Obtener OK nominal de 0495 cuando el paquete sea concreto y revisable.
- [ ] Integrar en orden #301 → #304/#306 → #307 → 0573; cada migración exige su OK, previa y aplicación antes del merge.
- [ ] Verificar publicación 14/0 y recorrido Studio después de cada integración, con su alcance de lectura autorizado.
- [ ] Crear los sellos mediante PR separadas.
- [x] Registrar decisiones delegadas de 0575 en su spec y verificar push.
- [ ] Continuar cola contable y carril de embarques según dependencias.

Decisiones de negocio vigentes: ERP como libro único; QuickBooks temporal sin conector; USD con USDT 1:1; bolívares en reportes; impuestos en espera. La delegación no autoriza borrado ni migraciones.

Se preserva la cola recibida, sin promover implementación a producción: 0572 → hora de Caracas unificada → 2.2/0575 → 2.6 → 2.3 → 2.7 (0422 y 0423 con previa y OK nominal) → 2.8 → 2.4 → 2.9 → 2.10 → conciliación bancaria → 3.9 → 5.4. Carril de embarque paralelo: 4.5/0574 y después 4.2.

Pasos de Sam para la puesta en marcha: definir superclave, cargar tasas BCV después de 0569, decidir expresamente sobre datos de prueba y fijar la primera fecha de cierre. No se asumen realizados.

Controles periódicos heredados: radiografía mensual solo con autorización; «Por contabilizar» en cero; subdiario contra mayor; excepciones al cierre; respaldos semanales; restores del 21/22 de octubre; ocho cuadres de fin de mes. No se han ejecutado en este bloque.

## 5. Oficina de agentes y pendientes de Sam

Antecedentes del traspaso, aún no revalidados en este bloque:

- Definir la superclave del cierre.
- Probar el bot de Telegram con `/sethome`.
- Revocar la llave Anthropic sin uso.
- Cambiar el seguro a «próximamente» en Kommo.
- Decidir sobre los agentes pausados; no borrarlos sin aprobación.
- La llave de Junta `hermes-director` requiere revocación con OK de Sam antes del 27 de octubre.
- Anexo Telegram en `C:\tmp\handoff-oficina-telegram-2026-10-20.md`: PR nueva después de #306; reporte Paperclip permanece sin enviar.

## 6. Fechas

- 21 y 22 de octubre: restauración de prueba según runbook.
- Antes del 27 de octubre: resolver la llave de Junta con Sam.
- 28 de octubre: posible pausa de Cloud solo tras comprobar las cuatro condiciones; planes preservados.

Fechas recibidas del traspaso; no se ha creado automatización.

## 7. Validación y conocimiento

- Git/remoto/worktrees: PASÓ para el inventario acotado.
- `node scripts/director-status.mjs`: PASÓ, snapshot de `17:20:21Z`, 74 worktrees, 472 ramas y 5 PR abiertas. Archivo fuera de Git: `C:\tmp\director-traspaso-20261020\inventario-codex-20261020.json`. Es inventario, no prueba de inactividad.
- `corepack pnpm knowledge:status`: ejecutado al inicio. Repetido con la entrada Node equivalente del runbook desde main sincronizado `8e9e0f50`; `ok=false`. JSON completo fuera de Git: `C:\tmp\director-traspaso-20261020\knowledge-codex-20261020.json`.
- Graphify `0.9.61`: estructura PENDING, 453 pendientes. Semántica global: 12/1320 verificadas, 1308 pendientes; piloto: 12/16, cuatro pendientes (`README.md`, reglas técnicas, marketing y runbook de ingeniería). No se infiere semántica a partir del AST.
- Archify PENDING por `ARCHIFY_STALE_REVISION`; Obsidian PENDING. Publicación, regeneración y revisión visible de Obsidian: NO EJECUTADAS. No se alteraron derivados compartidos para simular vigencia.
- Piloto semántico: completadas y revisadas las cuatro fuentes pendientes de main `8e9e0f50`, 1.016 líneas completas, ninguna con YAML. Fragmento y recibo fuera de Git en `C:\tmp\director-traspaso-20261020\knowledge-pilot-20261020\`: `pilot-four-sources.fragment.json` SHA-256 `57ad9db2e3207c3e304daca436b95b666ef33aa6846a89f19b9ea9948e165218`; `pilot-four-sources.review.json` SHA-256 `dda113a95949e5d936201286af111f9e633c0df11d9d69fa01b10d6231d4d28a`. 111 nodos, 173 relaciones (158 EXTRACTED, 11 INFERRED, 4 AMBIGUOUS) y una hiperrelación. El Director leyó fuentes, nodos, relaciones no extraídas y recibo; revisión semántica PASÓ. Los conteos de tokens están marcados como no disponibles, no como consumo cero.
- Se conservan tres IDs con referencias semánticas externas y 14 anclas estructurales externas del snapshot examinado. Los seis IDs anteriores retirados no tienen referencias entrantes de otras fuentes. El README dice Pre-MVP: queda atribuido como afirmación histórica en conflicto, sin promoverlo a estado actual. Los hashes de fuentes y grafo no cambiaron durante la preparación. El `--check` del importador exige antes AST CURRENT; importación, reagrupación y publicación **NO EJECUTADAS** mientras otro Worker conserva el turno pesado, actualmente 0569. Obsidian reportó cero conflictos y 42 advertencias de enlaces en el estado guardado; no 42 conflictos.
- Vista interactiva 2.1 creada fuera de Git: `C:\Users\AKX generator\.codex\visualizations\2026\10\20\01a15a4e-ddf0-7d82-8656-d9dc56b58468\plan-contable-21.html`. Navegación entre tasa única y reemplazos comprobada en navegador, captura `C:\tmp\director-traspaso-20261020\plan-contable-21-preview.png`. Servidor local de preview cerrado al terminar. El documento Markdown de seguimiento permanece como registro versionado; el artefacto no declara tareas implementadas o desplegadas sin evidencia.
- Pruebas de producto propias del Director: NO EJECUTADO; es recepción/coordinación documental.
- Producción: lectura de metadatos de publicación PASÓ, main `8e9e0f50` y recibo de smoke automático 14/0 comprobados. Lecturas de negocio, migraciones y smoke funcional autenticado: NO EJECUTADOS.

## 8. Pendientes y handoff al Director

**OBJETIVO ORIGINAL:** continuidad del plan hasta contabilidad completa en Studio.

**COMPLETADO:** recepción y reconciliación; respaldo de tareas; CI reactivado; publicación del main pendiente con 14/0 comprobado; cierre parcial 0572; decisiones 0575; correcciones documentales #306 y seguimiento visible del plan.

**COMMITS / PR:** `11fabc85` y `e4c7389b` iniciaron la rama propia; evidencia posterior publicada hasta `af1f061f` y en el commit que contiene esta actualización. [PR #308](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/308), en borrador, con solo los dos documentos del Director; integración pendiente. Las PR #301, #304, #306, #307 y #308 están adjuntas a este chat.

**PENDIENTES DE ESTA TAREA:** revisar resultados, completar paquetes revisables, coordinar Workers y actualizar este registro antes de cerrar.

**FUERA DE ALCANCE DETECTADO:** archivos sin seguimiento del checkout principal; notas históricas de memoria con procedimientos reemplazados; enlace wiki faltante `ufw-limit-ssh-oficina`. Se preservan sin reparar por reflejo.

**HANDOFF AL DIRECTOR:** mantener autorizaciones separadas, pruebas locales seriales, cabezas exactas y documentación de cada resultado. No considerar un proceso iniciado como trabajo terminado.
