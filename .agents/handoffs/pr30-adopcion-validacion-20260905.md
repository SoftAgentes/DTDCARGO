# PR30 · adopción y validación · 2026-09-05

- Owner / sesión: 01a07370-bf34-7252-a63d-186ed7d4a407.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-claridad-botones-mensajes.
- Rama: codex/portal-claridad-botones-mensajes.
- HEAD inicial: 648ded94330f035ba140a681641c76efbdfd7318.
- Base asignada: origin/main 74bb52ab9677f96908cc032a15f2364ab9d94716.
- SDD: docs/specs/0442-portal-claridad-botones-mensajes/spec.md, in-progress.
- PR: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/30 (draft).
- Estado: gate local terminado, exit 1 por E2E; aceptación de producto pendiente.

## OBJETIVO ORIGINAL

Mejorar claridad de botones, documentos y navegación del portal. Fase actual:
adoptar harness, actualizar base propia y validar sin ampliar producto.

## Alcance y permisos de esta fase

Claim, handoff, merge origin/main exclusivamente en rama propia, índice SDD
generado y commits selectivos locales. No push, merge main, producción, secretos
ni cleanup. No integrar #31; no nuevos cambios de producto sin hallazgo de
aceptación. No build completo en paralelo con verify de #31/#24.

## COMPLETADO

Guard y claim adquiridos; raíz/rama/HEAD inicial verificados y árbol limpio.
Merge de origin/main sin conflictos: 6f7535e90c783dbfde27fc567ac9411bc5881091.
Índice SDD generado actualizado a 311 specs; allowlist de adopción incorporada.
No hay cambios nuevos de producto en esta fase.

## VALIDACIÓN

Sobre merge 6f7535e9, con cambios documentales de adopción:

| Comprobación | Resultado |
|---|---|
| Focales PortalAlertasHub, DocumentsClient, SuppliersClient | PASÓ: 5/5, 3 archivos |
| pnpm typecheck | PASÓ: sin errores TypeScript |
| pnpm docs:index / docs:check | PASÓ: índice generado y válido |
| pnpm governance:check | PASÓ: 28 políticas |
| pnpm components:check | PASÓ: 5 fuentes |
| pnpm sdd:check | PASÓ con avisos de colisiones históricas exceptuadas por el script; no se modificaron |
| git diff --check | PASÓ |
| pnpm verify / build completo | Corrida posterior sobre 5029124c: ver registro abajo |
| Zoom nativo 200%, lector, sesión del PR | NO EJECUTADO en esta fase; escenarios abajo |
| QA definitiva con colores #31 | NO EJECUTADO: esperar head revisado |

La primera corrida empezó antes del merge; TypeScript fue interrumpido y se
repitió después. Solo la segunda corrida sustenta esta tabla.
Evidencia previa de producto: SDD0442/evidence.md; no sustituye el gate final.

### Gate local sobre 5029124c

Director asignó el slot después de #24. `pnpm verify` sobre
`5029124c99417c37f2222c2bc369df78f6ec0401`, base `74bb52ab` incorporada.
VITEST_MAX_WORKERS=4; Deno 2.9.6 temporal; Docker disponible. Sin archivo
`.env.local`, sin copiar secretos, sin variables de Supabase/credenciales en el
proceso hijo y sin activar omisiones manuales. E2E usa localhost:3662;
el fixture compartido con Sam en 4312 permanece intacto.

| Paso | Resultado |
|---|---|
| harness | PASÓ: 12 pruebas |
| lint | PASÓ: 0 errores, 8 warnings preexistentes |
| RSC boundary | PASÓ: 1.586 módulos |
| typecheck | PASÓ |
| edge-functions | PASÓ: 4 funciones, Deno 2.9.6 |
| test | PASÓ: 6.196 pruebas, 504 archivos |
| docs:check | PASÓ |
| numbering / sdd:check | PASÓ con excepciones históricas existentes |
| feature-constants | PASÓ: 5 flags |
| components:check | PASÓ: 5 fuentes |
| governance:check | PASÓ: 28 políticas |
| migrations-applied | NO EJECUTADO / SKIP: sin URL/service role; ledger de release, no habilitar producción para este gate |
| sql-tests | PASÓ: 139 contratos en Postgres 17 efímero |
| schema-rebuild | PASÓ: 380 migraciones de esquema + 18 ledger-only; 219 tablas y aislamiento de 2 tenants efímeros |
| e2e | FALLÓ, exit 1; segundo intento con interrupción del trabajador atascado en cierre |
| build | PASÓ: compilación 51 s, TypeScript 3,1 min, 158 páginas y postbuild; tsconfig restaurado |

Resultado terminal: `pnpm verify` exit 1, 14 pasos PASÓ, 1 FALLÓ (E2E),
1 NO EJECUTADO (migrations-applied); 15/16 ejecutados. Build registra ausencia
de configuración para contenido público, pero termina exit 0; esto no valida
contenido conectado ni autenticación. Slot liberado al Director tras terminal.

Primer intento E2E: 133 expected, 15 unexpected, 2 flaky, 18 skipped, de
168 casos, 433 s. Cuatro casos auth y uno de redirección global-search fallaron
en los tres proyectos. Los dos flaky son navegación Chromium a studio/login
en attachments-gastos-pilot-network y token inválido en acceso: timeout de
60 s recuperado en retry, causa no determinada. No atribuirlos sin prueba a
Supabase. El runner configura 11 workers E2E en esta máquina; el límite de
Vitest no limita Playwright. No se cambió la configuración durante la corrida.

Log completo fuera de Git: `%TEMP%/dtd-pr30-verify-5029124c.log`.
JSON del primer intento preservado: `%TEMP%/dtd-pr30-e2e-5029124c-1.json`.
El runner borra su JSON al empezar otro paso. El observador externo preservó
el primero, pero no alcanzó a copiar el segundo antes del borrado: JSON del
segundo intento NO DISPONIBLE. Sus totales se respaldan en el resumen textual
completo del runner y sus fallos en error-context/trace; no en un JSON inventado.

Segundo intento E2E: 132 passed, 17 failed, 1 flaky, 18 skipped, 168 casos,
11,7 min según resumen. Matriz de fallos finales:

| Caso | Chromium | Chrome móvil | Safari móvil | Evidencia / clasificación |
|---|---|---|---|---|
| auth: Studio email/password (línea 21) | FALLÓ | FALLÓ | FALLÓ | formulario ausente; error-context muestra URL/key Supabase ausente, proxy.ts:67 |
| auth: Back email/password (línea 91) | FALLÓ | FALLÓ | FALLÓ | mismo error de configuración |
| auth: Portal magic link (línea 98) | FALLÓ | FALLÓ | FALLÓ | campo email ausente; mismo error de configuración |
| auth: Portal dos puertas (línea 105) | FALLÓ | FALLÓ | FALLÓ | encabezado ausente; mismo error de configuración |
| global-search: sin sesión redirige (línea 22) | FALLÓ | FALLÓ | FALLÓ | conserva /studio/dashboard; mismo error de configuración, no evidencia de acceso exitoso |
| calculadora-hidratacion: CBM antes del JS (línea 42) | PASÓ | FALLÓ | PASÓ | React no tomó campo en 20 s; cero marcadores, causa no determinada |
| calculadora-hidratacion: toggle antes del JS (línea 61) | PASÓ | FALLÓ | PASÓ | React no tomó toggle en 20 s; causa no determinada |

Flaky segundo intento: `cbm-ayuda.spec.ts:111`, Chrome móvil: popover seguía
oculto al esperar 1.500 ms, recuperado en retry. Registrar separado
de fallos persistentes. No inferir que todos los timeouts son por Supabase.
18 SKIPs por fixtures/credenciales ausentes: comments-lifecycle 3,
gastos-expense-void 6, global-search autenticado 6, nomina-settlement-void 3.
No hubo llamadas con credenciales de producción.

Cierre atascado: último resultado 23:45:46 -04. A las 23:48:06 y 23:48:34,
Playwright PID2012 mantuvo CPU 8,984375 s y worker PID29588 3,90625 s;
sin JSON. Timeout de test y slots de teardown: 60 s. Director autorizó
recuperación limitada. Se respaldaron 53 artifacts (48.959.529 bytes), primer
JSON y log en `%TEMP%/dtd-pr30-e2e-5029124c-attempt2-artifacts`, con manifiesto
SHA-256. Se revalidó PID29588, parent2012, inicio 23:44:31.147 y ruta
Playwright 1.60 del worktree; se terminó exclusivamente ese worker. El padre
entregó exit 1 y verify continuó al build; no hubo escalada al padre ni nueva
suite manual. Clasificación: E2E FALLÓ con cierre interrumpido, nunca verde.

Respaldo durable fuera de TEMP y Git:
`C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr30-verify-20260905-5029124c`.
Incluye los 53 artifacts, primer JSON, log previo a recuperación y log final;
56 archivos verificados contra `manifest.json` con rutas relativas y SHA-256.
El segundo JSON sigue NO DISPONIBLE. Después del gate sólo se modificaron
este handoff y SDD0442/evidence.md; docs:check y git diff --check PASÓ.

## COMMITS

Previos publicados: 42b7b607, c6ee85d2, 648ded94.
Locales: 6f7535e9 (merge base), 5029124c (adopción documental, SHA medido).
Actualización de evidencia: commit documental que contiene este registro final.

## PR / BRANCH

PR #30 y rama indicadas arriba; publicación de esta fase no autorizada.

## PENDIENTES DE ESTA TAREA

1. Autenticación en entorno de prueba del PR: solicitar enlace y completar
   retorno en mismo origen; confirmar cuenta y rutas protegidas. La sesión de
   producción vista con Sam no certifica este cambio.
2. Mis envíos con datos ficticios: documentos 0/3, parcial y 3/3; abrir/cerrar;
   enlace real de packing; factura/foto sin URL sin descarga falsa; destino de
   gestión/etiquetas; carga, error y recuperación del backend.
3. Documentos: filtros, ausencia de enlace, consulta/descarga disponible y
   pestaña nueva cuando corresponde; verificar permiso del usuario de prueba.
4. Proveedores: ayuda después de lista, abrir/cerrar con teclado, alta, nueva
   compra con proveedor preseleccionado, cambiar proveedor conservando datos.
   Persistencia solo en entorno efímero autorizado, nunca cupo real.
5. Zoom nativo 200%: medir escala antes/después, revisar cabecera, filtros,
   documentos abiertos, proveedores y formulario en claro/oscuro, sin recortes,
   superposiciones ni pérdida de acciones. Reflow a 532px no sustituye zoom.
6. Lector real: nombres y orden, encabezados, selección filtros, anuncio
   expandido/contraído, destino/pestaña de enlaces, pendientes informativos,
   foco al navegar y formularios. Árbol AX no sustituye lector de pantalla.
7. Fuente JetBrains Mono móvil; contraste combinado después del HEAD revisado
   #31. Resolver pendientes del gate registrado arriba antes del cierre.

## FUERA DE ALCANCE DETECTADO

Servidor Vite de fixture no respondió; revisión sirvió compilación estática
temporal. No se convierte esta fase en reparación de servidor o autenticación.
Los dos fallos de hidratación de calculadora, el flaky del popover público y
el estancamiento de cierre WebKit se entregan al Director como hallazgos fuera
del cambio Portal. Se mantienen 8 warnings lint anteriores (6 de variables
sin usar en tests de compra y 2 de componentes CRM). No se modificó el harness
para ocultar fallos ni se repitió manualmente la suite sin nuevos prerrequisitos.

## HANDOFF AL DIRECTOR

Dependencias: #31 tokens/badges exige QA combinada, #33 cambia destino etiquetas;
#23/#27 perfil/privacidad y #24 Analytics son vecinos para QA autenticada, sin
solapamiento directo; #28 puede facilitar pruebas efímeras.
Conservar fixture PID26268 y archivos temporales usados con Sam. Conservar
worktree, node_modules, .next y tsconfig.tsbuildinfo; sin limpieza autorizada.
Claim se libera al finalizar la escritura de esta fase; confirmar resultado en
mensaje al Director. La sesión sigue consumiendo worktree/fixture: liberación
del claim NO autoriza cleanup ni transferencia automática a otro Worker.
Director asignó a #24 E2E sin backend con tres proyectos y un worker para
aislar los fallos de hidratación. Ese resultado futuro no cambia retroactivamente
el gate fallido de este SHA.

## Focal autorizada por Director · 2026-09-06

Claim retomado en el mismo worktree, HEAD
`2e64f18786329004f521868f1887dd5a9ec11470`. Equivalencia comprobada:
`git diff 5029124c..2e64f187 --name-only` sólo contiene este handoff y
SDD0442/evidence.md. No cambió producto, tests, helpers, lockfile ni configuración.

Preflight JSON validó exactamente estas tuplas y ningún otro caso:

| Archivo / proyecto | Línea / caso | Resultado por intento |
|---|---|---|
| e2e/calculadora-hidratacion.spec.ts / mobile-chrome | 42: el CBM tecleado antes del JS igual produce precio | PASÓ, retry 0, único intento, 15.320 ms |
| mismo archivo / proyecto | 61: el toggle tocado antes del JS igual abre el consolidado | PASÓ, retry 0, único intento, 6.298 ms |

Comando: Playwright test con esos dos selectores, `--project=mobile-chrome
--workers=1 --reporter=list,json` y output externo nuevo. Sin override de
aserciones, timeouts ni retries: configuración local conserva 1 retry y trace
on-first-retry. No se generaron traces porque ambos pasaron al primer intento.
Resultado terminal exit 0: 2 expected, 0 unexpected, 0 flaky, 0 skipped;
duración total 69.575 ms (incluye arranque). No se ejecutó verify ni build.

Comparación con el gate anterior: código idéntico al medido 5029124c; mismos
Next 16.2.11/Playwright 1.60, proyecto mobile-chrome y localhost:3662.
Ahora sólo dos casos y un worker frente a 168 casos/tres proyectos/11 workers.
Sin credenciales ni placeholders; GA vacío, piloto de adjuntos 0, desarrollo.
La caché .next existente se conservó: no es experimento de caché fría ni de
una sola variable. El log aún registra configuración Supabase ausente y un
timeout de solicitud de 3 s durante arranque; no hubo timeout de los tests.
Conclusión: los dos fallos NO se reprodujeron bajo estas condiciones. Un pase
no demuestra que la concurrencia sea la causa ni convierte el gate previo en
verde. El resultado #24 procede de otro SHA y no sustituye esta comprobación.

Evidencia durable:
`C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr30-focal-hydration-20260906T040940458Z`.
Preflight JSON, metadata con SHA/hashes/entorno sin secretos, runner, log,
JSON final completo, resultado terminal, resumen por intento y manifest SHA-256.
Fixture PID26268 preservado. Slot devuelto al Director tras terminal; claim se
libera tras commit documental. Sin push, main, producción ni nuevas suites.

Incidente resuelto: index.lock vacío impedía merge. Director comprobó ausencia
de operación Git y lo movió a respaldo fuera del repo. Este Worker no eliminó
locks ni procesos ajenos. El siguiente intento autorizado pasó sin conflictos.
