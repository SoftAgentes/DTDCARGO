# Revalidación Preview E2E de comentarios MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-005 |
| SDD | [SDD-0168](../../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Fecha | 2026-07-28 |
| Resultado técnico | Preview aislado y recorrido E2E aprobados después de DB-2 |
| Commit correctivo local | `592226e9` |
| Estado operativo | entorno efímero retirado; corrección final sin push ni integración |

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

REV-MP-005 no autoriza el push ni la integración del correctivo final,
validación funcional de Producción ni corrección global de ACL históricos.

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

## 5. Hallazgo de infraestructura temporal

La creación inicial de la rama no reconstruyó dos piezas históricas que el
ledger marcaba como presentes: el barrido de EXECUTE de `0209` y la FK de
`0036` entre `user_tenants` y `user_profiles`. Ambas se repararon sólo en la
rama efímera para reproducir el estado estructural de Producción. Luego la
rebase incorporó 0264 y 0265 y dejó el contrato de 14 políticas, ACL, RLS y
advisors del dominio conforme.

Producción no fue modificada durante estas reparaciones.

## 6. Gates que permanecen cerrados

1. revisión de `592226e9` y de esta evidencia, y autorización explícita de su
   push;
2. integración posterior del correctivo final en `main`;
3. validación funcional de Producción ya con el correctivo integrado;
4. cualquier corrección global de ACL históricos.

Ninguno de estos gates habilita purga o hard-delete.
