# Handoff del Director · continuidad Codex · 2026-10-20

| Campo | Valor |
|---|---|
| Owner | Director Codex, sesión `01a15a4e-ddf0-7d82-8656-d9dc56b58468` |
| Task ID | `director-continuidad-codex-20261020` |
| Objetivo | Retomar el plan contable y su carril de embarques sin perder trabajo ni omitir las fronteras de producción |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\director-continuidad-codex-20261020` |
| Rama y base | `codex/director-continuidad-codex-20261020`, desde `origin/main` `8e9e0f505322cd57b3230cce6b16b45b5554cb8a` |
| Estado | En progreso: recepción del traspaso, verificaciones remotas relanzadas y relevo de Workers |
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
| #301 / 0569 / 0495 | `e6579944` | Main incorporada mediante merge limpio y push; Draft. Revisión nueva detecta dos P1: procedencia ambigua de tasa y carrera editar/emitir; bloqueada para aprobación | Worker debe corregir y demostrar regresiones; después revisión/validación/paquete/previa nuevos |
| #307 / 0571 / 0496 | `b70be5d7` | Verify anterior contrastado, 16/17 con omisiones; revisión nueva encontró tres P2 de búsqueda y formulario | Worker corrige en su worktree; focales con turno, revisión y validación final antes de integración y aprobación nominal |
| 0572-a | `9c254107` | Cierre parcial publicado, árbol limpio y claim liberado; 71 focales, typecheck y lint PASÓ | Retomar después de #301 corregida: ranking sin tasa, verify, mutantes y revisión visual |
| 0573 / 0497 | `89f15a5d` | Implementada; B1, I1–I4 y M1–M9 pendientes según traspaso; sin verify | Worker posterior del carril contable, antes de consideración de integración |
| #304 / 0570 | `59e8491b` | Draft; CI PASÓ. A/B local de 34 archivos en curso desde `18:11:47Z`, con claim `codex-0570-ab-01a15a4e` | Criterio 5 sigue pendiente de resultados; después devolver turno pesado a 0569 |
| #306 / oficina | `2f9b336c` | Correcciones documentales publicadas y revisadas; Draft. Árbol limpio, claim liberado; CI nuevo en curso | Director incorpora base y revalida después de #301; no confundir corrección documental con aislamiento del VPS |
| 0574 / 4.5 | `18edcd81` | Implementada; preparación leída, 10/10 rutas propias en allowlist, sin dependencias locales instaladas; depende de #307 | Adopción posterior, instalación congelada, verify con turno y revisión visual |
| 0575 / 2.2 | `b4bd7cc2` | Cinco decisiones delegadas registradas y publicadas; spec sigue draft. Árbol limpio y ahead remoto 0 comprobados | Antes de implementar: contratos, allowlists y reserva de migración; no iniciar código contable en paralelo |

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

Docs (555 specs), numeración, diff y 24 enlaces locales PASÓ. Los lanzadores pnpm intentaron instalar dependencias: el Worker detuvo solo sus procesos y usó las entradas Node directas; no cambió el lockfile. La instalación parcial ignorada se conserva. Conocimiento devolvió `ok=false`, estructura INVALID; derivados pendientes. CI del nuevo SHA: run `39472795934`, en curso al corte.

### Decisiones delegadas de 0575

En `b4bd7cc23394fde1e8543ffc400e271bbd2b9006`, publicadas en su rama y verificadas:

1. RPC atómica por documento, con fallo cerrado.
2. Período cerrado bloquea salvo excepción gobernada por 0566; no cambiar fecha silenciosamente.
3. Sección dentro de «Por contabilizar».
4. Tres PR secuenciales; número de migración pendiente de inventario y reserva.
5. Gasto incluido desde el contrato de 0575-a y conectado en 0575-b.

El intento fallido debe quedar consultable sin cabeceras, líneas ni vínculos parciales; falta concretar cómo persistir ese motivo sin que el rollback lo elimine. La radiografía del 18 de octubre se clasifica como datos de prueba según decisión de Sam en el §9 del plan; no autoriza reparación ni borrado.

Solo cambiaron spec y handoff de la tarea. `docs:check` (556 specs), numbering y diff-check PASÓ; pruebas de producto NO EJECUTADAS por alcance documental. Claim liberado y árbol conservado. Evidencia: `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md` en su rama.

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

Turno de máquina: 0569 confirmó adopción y ausencia de pruebas y cedió temporalmente la corrida pesada al A/B local de 0570/#304 mientras implementa. El turno vuelve mediante confirmación explícita, sin dos corridas concurrentes.

El A/B usa los mismos 34 archivos, 2 workers y semilla/entorno/lockfile iguales. A restaura temporalmente solo imports/constructores previos; B usa los bytes de la cabeza original, con respaldos y hashes. Conserva aserciones y mutantes. Un preflight del comprobador falló antes de lanzar pruebas y restituyó 36/36 archivos; quedó separado. Duración inicialmente estimada 10–18 minutos, revisada a 25–30 al observar los primeros archivos; el Director autorizó completar hasta 35 minutos con aviso si necesita más. No hay resultado de aceptación todavía.

El orquestador activo conserva un watchdog de 20 minutos por fase. Si interrumpe A, se conservará evidencia parcial y se restaurarán los archivos; no se reiniciará automáticamente ni se declarará mejora local. El turno se devolverá a 0569. A los once minutos, el Worker reportó 16/34 archivos completos y sin fallos; es avance, no resultado final.

## 4. Checklist vivo de continuidad

Vista resumida para Sam: [Plan contable: avance y pendientes](../../docs/audits/2026-10-20-plan-contable-seguimiento-codex.md). Este §4 sigue siendo el registro vivo de coordinación.

El checklist histórico del §4 anterior conserva 36 tareas vivas, 6 hechas, 1 en curso y 29 pendientes; esos conteos no se vuelven a afirmar como medición actual sin reconciliar cada entrega.

- [x] Leer prompt, handoff anterior, plan y reglas.
- [x] Actualizar referencias e inventariar PR/worktrees.
- [x] Confirmar respaldo remoto y ausencia de cambios sin commit en las ocho ramas de la tabla del traspaso.
- [x] Confirmar que 0572-a ya está subida; no repetir su implementación.
- [x] Obtener de Sam el estado de facturación y relanzar CI vigente.
- [x] Confirmar Calidad de main/#301/#304/#307 y publicación automática del main pendiente con evidencia 14/0.
- [x] Leer memoria Claude completa mediante revisor.
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
- Pruebas de producto propias del Director: NO EJECUTADO; es recepción/coordinación documental.
- Producción: lectura de metadatos de publicación PASÓ, main `8e9e0f50` y recibo de smoke automático 14/0 comprobados. Lecturas de negocio, migraciones y smoke funcional autenticado: NO EJECUTADOS.

## 8. Pendientes y handoff al Director

**OBJETIVO ORIGINAL:** continuidad del plan hasta contabilidad completa en Studio.

**COMPLETADO:** recepción y reconciliación; respaldo de tareas; CI reactivado; publicación del main pendiente con 14/0 comprobado; cierre parcial 0572; decisiones 0575; correcciones documentales #306 y seguimiento visible del plan.

**COMMITS / PR:** `11fabc85` y `e4c7389b` publicados en la rama propia de coordinación; evidencia posterior en el commit que contiene esta actualización. La rama todavía no tiene PR. Las PR #301, #304, #306 y #307 están adjuntas a este chat.

**PENDIENTES DE ESTA TAREA:** revisar resultados, completar paquetes revisables, coordinar Workers y actualizar este registro antes de cerrar.

**FUERA DE ALCANCE DETECTADO:** archivos sin seguimiento del checkout principal; notas históricas de memoria con procedimientos reemplazados; enlace wiki faltante `ufw-limit-ssh-oficina`. Se preservan sin reparar por reflejo.

**HANDOFF AL DIRECTOR:** mantener autorizaciones separadas, pruebas locales seriales, cabezas exactas y documentación de cada resultado. No considerar un proceso iniciado como trabajo terminado.
