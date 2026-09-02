# Cierre local · SDD-0362 · Aprendizaje de Academia Portal

Fecha: 2026-09-02
Rol: worker aislado
Tarea: `01a05f15-80ff-77b1-9f3a-6b07d21df02d` — Audita y limpia worktrees
Rama: `codex/saneamiento-integral`
Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\codex-saneamiento-integral`
Base: `eabb230b257579d3b5527a8721eebc328d748f79`
Estado: cierre técnico local; CI del nuevo SHA, integración y Cloud pendientes.

## Resultado y alcance

0418 sustituye ocho policies en cursos, módulos, lecciones, inscripciones,
diplomas y progreso. Cada acceso Portal exige principal activo, cliente vivo
y tenant coherente. Completar exige además inscripción propia y padres vivos
coherentes. Catálogo publicado, previews permitidos y curso inscrito no
publicado siguen disponibles; lecciones en borrador no. Los diplomas de
inscripciones archivadas y el progreso histórico propio no se purgan.

No se agrega SECURITY DEFINER ni se modifican ACL, RPC, triggers, Storage,
UI, políticas de equipo, datos de negocio o migraciones históricas. No se
certifican cohortes/Club, asistencia, RBAC interno ni las demás entidades
Portal. Son siete rutas propias, enumeradas en la allowlist exacta de SDD-0362.
El subagente de reproducción fue dueño únicamente del contrato SQL y no
ejecutó Docker, commits, push ni cambios alojados.

## Verificación ejecutada

- RED antes de crear 0418: PostgreSQL 17.10 local con 0080/0105/0144/0145/0149
  reales. Reproduce seis lecturas cruzadas, una lectura de borrador, DELETE
  ajeno e INSERT sin inscripción; exit 1 por visibilidad incorrecta, no por
  falta del archivo de corrección.
- GREEN del mismo contrato: exit 0. Matriz A/B con Shipping Mark repetido,
  principales inválidos/sin sesión, padres incoherentes, idempotencia,
  UPDATE no otorgado, CRUD Portal rechazado, equipo y principal dual.
- Ocho preflights negativos ejecutan la migración real y rechazan policies
  adicionales/ausentes y RLS apagada. Conservación bidireccional de las otras
  policies, ACL, funciones y triggers. Rollback total del fixture comprobado.
- `node scripts/run-sql-tests.mjs`: 159 contratos aprobados, sin SKIP.
- `node scripts/check-schema-rebuild.mjs`: 415 migraciones, 397 desde cero y
  18 sólo-ledger; barrido estructural de 219 tablas y dos tenants sintéticos.
- Vitest de Academia: 2 archivos / 68 pruebas aprobadas. Sin cambios de app:
  no se repite build/E2E local; el CI completo del nuevo SHA es independiente.
- `pnpm audit --audit-level high`: exit 0; dos moderados de desarrollo en qs,
  cero altos/críticos. Registrados como deuda separada, sin cambiar lockfile.
- Índice SDD regenerado; docs, numeración, gobernanza (28 políticas aprobadas),
  componentes y diff aprobados. Inventario: 354 specs reales, 264 done,
  1 superseded y 89 abiertas; la plantilla no se cuenta como una spec.
- CI completo de la base eabb230b: run `33671435585`, success a las 19:22:45
  UTC del 2026-09-02 (14 min 54 s), incluido build y árbol reproducible.
- Contenedores SQL/rebuild propios ausentes después del cierre. Fixture
  `dtd_academia_0362_codex_20260902` retirado tras verificar ID/etiquetas;
  sólo datos sintéticos descartables. No se tocaron contenedores ajenos.

## Publicación y continuidad

Preflight Git: remoto privado, permiso ADMIN, upstream 0/0 y 59 commits
delante / cero detrás de origin/main antes de este lote. Índice vacío; sólo
rutas propias sin staged ajeno. Listado Codex de 50 tareas: sólo esta tarea
de DTDCargo; ninguna otra usa este worktree. No se afirma haber inspeccionado
sesiones de otras herramientas ni se ejecuta limpieza de worktrees.

Commit de una sola intención: el que contiene este archivo. Publicación sólo
de la rama propia, con verificación del SHA/upstream y recibo en la tarea;
PR #21 permanece en borrador. Nunca main, force-push, merge ni promoción.
Se conservan los dos worktrees y ambas ramas de archivo. Siguiente responsable
de integración: carril exclusivo después de los gates de compatibilidad.

Cloud requiere autorización nominal de
`0418_portal_academia_tenant_boundary.sql`, preflight y smoke independientes.
No requiere RPC/deploy previo. Son 20 migraciones preparadas (0399–0418) sin
aplicación en esta tarea; ningún resultado sintético demuestra Producción.
El checklist maestro conserva los pendientes de reclamos, pagos y otros
dominios, y distingue el cierre técnico de la puesta en servicio.
