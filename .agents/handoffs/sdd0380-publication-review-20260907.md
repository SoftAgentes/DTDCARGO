# Director — publicación de la extracción SDD-0380

Fecha: 2026-09-07. Owner: 01a073cc-1278-7422-81da-9f85c2fff047.
Task: sdd0380-publication-review-20260907.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd0380-publication-review-20260907.
Rama: codex/sdd0380-publication-review-20260907.
Base: main74bb52ab9677f96908cc032a15f2364ab9d94716.
Candidato de producto: 3f03569abc0a1015f198353e5fc56282eea38913.
SDD: docs/specs/0380-portal-quotes-principal-tenant/spec.md.

## Objetivo y límites

Publicar una PR draft independiente con la extracción de seguridad0380 de PR21, conservando el resto de aquella PR y sus conflictos fuera de esta entrega. Sam delegó el2026-09-07 la priorización y ejecución de pendientes del goal continuo; Director aplica esa autorización a publicación para revisión. El encargo local anterior y sus prohibiciones de publicación quedan como evidencia histórica. No se integra main ni se ejecuta SQL productivo. CI y preview pueden dispararse al publicar.

Allowlist propia: únicamente este handoff. Los nueve archivos de la extracción se mantienen idénticos a3f03569a, ya descendiente de main74bb52ab. No se modifica el árbol original ni su claim. Se creó worktree propio y se adquirió claim antes de editar; se libera después de publicar y verificar la PR.

## Comportamiento

La lectura Portal resuelve un vínculo activo y coherente entre usuario, cliente y tenant. Cotizaciones y códigos de envíos asociados se filtran por tenant y Shipping Mark; un Shipping Mark aislado o el ámbito Studio de una sesión híbrida no bastan como autoridad. Si no se puede verificar el vínculo, se devuelve vacío sin usar un cliente elevado. La migración0428 restringe la policy SELECT Portal de quotes y conserva la policy del equipo.

## Validación del candidato

- SQL causal: RED sin0428; GREEN63 aserciones con rollback. Aplicación: RED18 fallos/4 pases; GREEN33/33. Se verificó equivalencia de15 funciones ajenas. Evidencia propia de la extracción, no heredada del conjunto completo de PR21.
- Intento canónico verify del2026-09-07: TIMEOUT durante Vitest a los20 minutos. Cinco gates anteriores pasaron: harness12, lint0 errores/8 advertencias, límite RSC, typecheck y Edge. El recibo original permanece intacto.
- Continuación independiente sobre3f03569a: Vitest6215/6215 en502 archivos sin omisiones; docs, numeración, constantes, componentes y gobernanza aprobados. SQL140/140, reconstrucción381 aplicadas+18 sólo-ledger y219 tablas con aislamiento sintético aprobados.
- Build: comando terminó naturalmente exit0, compilación/tipos/158 páginas/postbuild completos. El supervisor conserva INCOMPLETO_PASO/exit5 por una lectura intermedia de metadata perdida. Auditoría posterior verificó ausencia de procesos/descendientes y contenedores propios. Director acepta el resultado del comando con esa reserva del monitor; no reescribe su recibo ni declara una ejecución canónica completa.
- Ledger: NO DISPONIBLE, exit3/SKIP por ausencia de credenciales; E2E: NO EJECUTADO. No hay certificación Auth nativa o productiva.
- Evidencia durable: DTD-backups/pr21-global-validation-20260907 y continuation-1. Informe independiente director-build-observation-review.md SHA256f7b8f4d4416beddfccd5a733fe98a1182032df53561b279cde3293b67ed8b1eb; manifest complementario artifacts-sha256.json SHA256b3a403d046b0e6b0c10c371cd1783ac08beacb8675afb15a68efecf5c942dc86.
- Esta publicación sólo añade documentación: se verifican diff, ancestralidad, docs y numeración. CI remoto se consulta para el nuevo head después de publicar.

## Release y pendientes

Migrate-first: antes de habilitar el código en producción, revisar el catálogo real y el inventario de policies, obtener aprobación nominal y aplicar0428 siguiendo el runbook productivo. Una consulta previa del ledger reportó0428 ausente; ese dato fechado no demuestra ausencia de SQL manual ni sustituye un preflight de release. No aplicar la migración para convertir un gate en verde.

La PR queda draft para revisar el head publicado, CI, clasificación del E2E pendiente y secuencia de release. La autorización específica de PR29 sigue siendo revisión, y esta extracción no contiene0448 ni0449. No se recibe PR21 completa por publicar esta unidad.

El commit que contiene este handoff es exclusivamente documental. SHA final y URL se registran en la descripción y recibo externo de publicación. Pendientes propios al preparar: push de la rama nueva, PR draft, checks y liberación del claim. Fuera de alcance: resolver global0382, asesor, perfil, prealertas y cleanup de árboles anteriores.
