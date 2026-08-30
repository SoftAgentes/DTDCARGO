# Revalidación Preview E2E de comentarios MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-005 |
| SDD | [SDD-0168](../../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Fecha | 2026-07-28 |
| Resultado técnico | Preview aislado y Producción aprobados después de DB-2 |
| Commit correctivo local | `592226e9` |
| Estado operativo | integración, despliegue y E2E de Producción cerrados; fixtures retirados |

## 1. Veredicto

La aplicación fue revalidada después de aplicar
`0265_comments_lifecycle_hardening`. El recorrido autenticado controlado aprobó
en Chromium y no dejó errores reales del navegador, respuestas HTTP fallidas,
errores de runtime ni respuestas 5xx en el despliegue.

Esta revisión cierra el gate Preview de SDD-0168. Durante la ejecución, otra
ventana integró en `main` el historial hasta `b92116d4` mediante el merge
`67b1a46b`; Vercel creó automáticamente un despliegue de Producción `READY`.
Ese despliegue no contiene `592226e9` ni esta revisión y no recibió validación
funcional de Producción desde este gate.

Sam autorizó después el push exacto de `592226e9` y `1f831b63`. La rama remota
`codex/sdd-0168-db1-local` avanzó por fast-forward hasta `1f831b63` y su check
Vercel terminó en `success`.

Sam autorizó después la integración exacta de `592226e9`, `1f831b63` y
`21b86297` mediante merge de `origin/main` y push a `main`, aceptando el
despliegue automático de Producción. El merge final `d93c56e4` fue publicado
por fast-forward y Vercel terminó en `success`.

## 2. Entorno aislado

- organización Supabase confirmada: `DTDCARGO`;
- costo vigente confirmado antes de crear la rama: USD 0,01344 por hora;
- rama efímera: `sdd-0168-e2e-20260728`;
- project ref aislado: `qwlzgsponaardokxfmen`;
- sin datos de Producción y vinculada únicamente al Preview de
  `codex/sdd-0168-db1-local`;
- despliegue validado: `dpl_A1zitqZPxHNdwsFJq5afXF4VKpYy`;
- la rama Supabase, las tres variables exclusivas de Preview y el archivo
  temporal de credenciales fueron eliminados al cerrar la prueba;
- una consulta posterior confirmó que sólo permanece la rama `main` de
  Supabase y que el override Vercel de la rama devuelve `envs: []`.

El URL temporal dejó de ser un entorno funcional al retirar su base aislada y
no se promovió.

## 3. Evidencia funcional

El seed controlado preparó un tenant, dos usuarios y un embarque exclusivos de
SDD-0168. La prueba ejecutó:

1. autenticación del administrador E2E;
2. creación de un comentario con mención;
3. reacción sobre el comentario;
4. eliminación propia;
5. Deshacer dentro de la ventana de 10 segundos;
6. segunda eliminación;
7. restauración ordinaria por administrador.

La inspección final de la rama confirmó:

- comentario restaurado con el mismo `id` y autor;
- una mención y una reacción con identidad preservada;
- cuatro eventos de auditoría;
- acciones `self_delete`, `undo`, `self_delete` y `ordinary_restore`;
- `deleted_at`, `deletion_mode` y demás estado de eliminación nuevamente
  nulos.

Resultado ejecutado: `1 passed` en 14,1 segundos.

## 4. Correctivos cerrados durante la validación

- El aviso **Deshacer** dejó de comparar el reloj absoluto del navegador con
  el reloj de PostgreSQL. El servidor calcula la duración restante y el
  navegador inicia un deadline local, mientras la RPC conserva el control
  autoritativo de 10 segundos.
- El capturador rrweb dejó de configurar selectores que, en la versión alfa
  instalada, llamaban `matches()` sobre nodos de texto. Se conservan
  `maskAllInputs` y las clases privadas estándar `rr-mask` y `rr-block`.
- El E2E espera la persistencia real del comentario, la restauración y los
  cuatro eventos de auditoría antes de afirmar el resultado.
- El detector conserva como fallos todos los `pageerror`, errores de consola,
  HTTP 4xx/5xx y requests fallidos de la aplicación. Sólo excluye la
  cancelación normal `net::ERR_ABORTED` y el script de feedback inyectado por
  Vercel que la CSP de la aplicación bloquea deliberadamente.

Verificación local del correctivo:

- 3 archivos de prueba y 25 casos aprobados;
- TypeScript aprobado;
- ESLint puntual aprobado;
- build Preview aprobado;
- cero logs runtime de nivel error y cero respuestas 5xx para el despliegue
  validado.

Gate integral posterior, ejecutado con `node scripts/verify.mjs`:

- lint completo aprobado con cero errores; 172 warnings preexistentes;
- frontera RSC aprobada sobre 1.406 módulos;
- TypeScript aprobado;
- 288 archivos y 3.926 pruebas Vitest aprobados;
- índice documental aprobado;
- ledger de Producción conforme, sin migraciones nuevas pendientes;
- 19 E2E generales aprobados y 3 Tier 3 omitidos por falta deliberada de
  credenciales/seed.

El E2E autenticado de SDD-0168 pertenece a esos Tier 3 y se omitió en esta
segunda ejecución porque la rama efímera ya había sido eliminada. Su ejecución
aislada previa permanece acreditada por el resultado `1 passed` y la evidencia
relacional de la sección 3.

Recibo del push y CI:

- rama remota: `codex/sdd-0168-db1-local`;
- HEAD publicado: `1f831b63`;
- push fast-forward confirmado;
- despliegue automático de CI:
  `dpl_ExccfvZZpdLBGp2VTZftnDxGmvGb`;
- Vercel Preview `READY`;
- status GitHub `Vercel: success`;
- cero logs runtime de nivel error y cero respuestas 5xx observadas.

Este Preview de CI sólo acredita build y disponibilidad. No repite el E2E
aislado, porque la rama Supabase temporal y sus variables fueron retiradas al
cerrar la sección 3.

## 5. Hallazgo de infraestructura temporal

La creación inicial de la rama no reconstruyó dos piezas históricas que el
ledger marcaba como presentes: el barrido de EXECUTE de `0209` y la FK de
`0036` entre `user_tenants` y `user_profiles`. Ambas se repararon sólo en la
rama efímera para reproducir el estado estructural de Producción. Luego la
rebase incorporó 0264 y 0265 y dejó el contrato de 14 políticas, ACL, RLS y
advisors del dominio conforme.

Producción no fue modificada durante estas reparaciones.

## 6. Cierre de integración y Producción

Antes del push final se ejecutó `node scripts/verify.mjs` sobre el merge con la
última versión de `origin/main`:

- lint aprobado con cero errores y 172 warnings preexistentes;
- frontera RSC aprobada sobre 1.412 módulos;
- TypeScript y documentación aprobados;
- 291 archivos y 3.971 pruebas Vitest aprobados;
- ledger conforme, sin migraciones nuevas sin aplicar;
- 19 E2E aprobados y 3 omitidos por requerir seed.

El commit `d93c56e4` quedó simultáneamente en el worktree y en `origin/main`.
GitHub registró el deployment `5649697855` con ambiente `Production`, Vercel
reportó `success` y el artefacto quedó disponible en
`dtdcargo-lgvo7lbrs-hailu-wey.vercel.app`. Inicio, Studio, `robots.txt` y
`sitemap.xml` respondieron HTTP 200; el smoke público contra
`https://dtdcargo.com` aprobó 14 de 14 casos.

Con autorización individual posterior, el 2026-07-28 se ejecutó en el proyecto
Supabase Producción `xpfuzqombmjmxvprjgmi` el fixture determinístico
`e2e-sdd-0168`. El recorrido autenticado aprobó en 17,8 segundos:

1. crear comentario con mención y reacción;
2. eliminar y deshacer;
3. eliminar y restaurar desde recuperación;
4. comprobar la misma identidad, mención y reacción;
5. comprobar los cuatro eventos AUD-01 esperados;
6. comprobar ausencia de errores de consola, requests fallidos y respuestas
   HTTP de error de la aplicación.

La limpieza corrió en `finally`, eliminó exactamente un tenant y dos usuarios
fixture y fue revalidada por IDs. El conteo final fue cero para tenant,
embarque, membresías, comentarios, menciones, reacciones y auditoría; ambos
usuarios Auth quedaron ausentes. La contraseña aleatoria existió únicamente
durante el proceso y no fue escrita a disco.

El conector de Vercel no permitió consultar logs runtime internos de la
organización (`403`). Por eso la evidencia de Producción se limita al estado
oficial `success`, respuestas HTTP, smoke público y listener estricto del E2E
autenticado; no se afirma una consulta de logs que no pudo ejecutarse.

## 7. Límites que permanecen separados

1. cualquier corrección global de ACL históricos;
2. cualquier purga, hard-delete o política de retención futura;
3. ampliación de restauración a roles no administradores.

La integración y la validación de Producción no habilitan ninguno de esos
alcances.

## 8. Addendum local de evidencia gobernada · 2026-08-29

La evidencia histórica de esta revisión comprobó las cuatro acciones, pero no
cerró como contrato separado que su lectura proviniera de la RPC redacted. El
paquete local `0398_audit_comment_action_summary` corrige ese hueco sin abrir
la tabla: el Tier 3 ahora exige `self_delete`, `undo`, `self_delete` y
`ordinary_restore` desde `audit_list_events.summary.action`.

La prueba SQL cubre allowlist positiva, aislamiento por tenant, denegación a
no-admin, ACL sin SELECT directo y casos negativos de schema, acción, entidad
y evento. Este addendum no cambia el recibo histórico ni declara aplicada la
migración; commit, Cloud y push permanecen separados.
