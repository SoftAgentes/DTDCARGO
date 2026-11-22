# Handoff · SDD-0652 — Ficha 360° del empleado

- **Owner:** Claude Worker `w-0652-ficha-empleado` (sesión hija del DG)
- **Ruta:** `.claude/worktrees/0652-ficha-empleado-360-9e19a0`
- **Rama:** `claude/0652-ficha-empleado-360-9e19a0`. Base: `main`, integrada por última vez en `71ee524a9` (trae la #629, SDD-0650 F1)
- **PR:** [#632](https://github.com/SoftAgentes/DTDCARGO/pull/632), lista para revisión. No fusionar: lo decide el DG
- **SDD:** `docs/specs/0652-ficha-empleado-360/spec.md`, en `in-progress`. Decisiones D1-D13 aprobadas por Sam el 2026-11-17. Migración reservada: **0555** (F2). La 0554 es de la SDD-0650 F2
- **Encargo vigente:** F1, lectura segura, sin migración. F2 a F5 esperan su asignación

## OBJETIVO ORIGINAL

1. Fase de análisis: medir la ficha de Nómina, la de usuario, el seguimiento y los inicios de sesión; proponer el enlace explícito empleado ↔ usuario; escribir la spec con fases, allowlist, migración y decisiones; cubrir privacidad.
2. F1, por encargo del DG después de las decisiones de Sam:
   - que la lista de Nómina deje de mandar cédula, sueldo y cuenta completa al navegador;
   - ficha con correo y ruta de detalle;
   - control de rol admin/accounting en el servidor.

## COMPLETADO

- Spec completa, con tres revisiones incorporadas (DG, re-revisión del DG, Codex) y las decisiones de Sam en §8.
- **F1:**
  - la lista manda `toEmployeeListItem`, sin cédula, sueldo, nacimiento, teléfono, cuenta ni el id de la cuenta;
  - sale la columna «Sueldo / mes»;
  - el lápiz pide la ficha con `getEmployeeEditViewAction`, con la cuenta enmascarada;
  - «Nueva cuenta» vacía no toca la cuenta;
  - ruta `/studio/nomina/empleados/[codigo]` con `getFichaEmpleadoAccess` antes de leer, búsqueda en el tenant de la membresía, 404 o «No se pudo cargar» con «Reintentar», y bloques con su propio error;
  - Contabilidad no recibe correo de acceso, rol, último ingreso ni pestaña Acceso;
  - «Ver ficha de empleado» desde Usuarios;
  - la pestaña de Nómina va en la URL.
- **Revisión del DG sobre la F1** (`71ee524a9`, CHANGES REQUESTED), corregida:
  - **B1:** la validación del código decía `/^EMP-d{1,9}$/` porque se perdió la barra al editar con un script de shell. La ficha daba 404 a todos. Ahora es `/^EMP-[0-9]{1,9}$/` (sin barra, para que no se repita) y hay una prueba directa con cliente falso (`lib/studio/nomina/__tests__/employee-queries.test.ts`): códigos válidos en mayúsculas y minúsculas, inválidos sin consultar, filtro por tenant y los tres resultados.
  - **N1:** «Reintentar» (`router.refresh()`) en el error de la página y en cada bloque (`ReintentarCarga.tsx`).
  - **N3:** `updateEmployeeAction` revalida también la ruta de la ficha, y la ficha hace `router.refresh()` al cerrar el formulario.
  - **N4:** este handoff.

## VALIDACIÓN

| Comprobación | Sobre | Resultado |
|---|---|---|
| `pnpm install --frozen-lockfile` | `1e5de53a6` | PASÓ, con turno de PC del DG |
| `tsc --noEmit` | `1e5de53a6` | PASÓ |
| vitest `lib/studio/nomina`, `app/studio/(app)/nomina`, `app/studio/(app)/usuarios` | `1e5de53a6` | PASÓ, 36 archivos y 413 pruebas |
| Los 3 archivos nuevos, aparte | `1e5de53a6` | PASÓ, 40 pruebas |
| `docs:check`, `sdd:check`, `git diff --check` | cabeza actual | PASÓ |
| tsc y vitest de la corrección B1, N1 y N3 | `e2566eadf` | NO EJECUTADO en local en su momento (sin turno). Cubierto por la fila siguiente |
| Rojo del CI (run 44025362712): inventario RBAC 476 → 477, candado `moduleViewDenial` en `getEmployeeEditViewAction`, spec sin nombre de archivo 0555 | después del merge de main `39731c0bf` | Corregido |
| `tsc --noEmit` | ese arreglo, con main integrado | PASÓ, con turno de PC del DG |
| vitest: `rbac-actions-guard`, `spec-migration-refs` y los 4 archivos de la F1 | ese arreglo | PASÓ, 6 archivos y 545 pruebas |
| `pnpm verify` completo y e2e | — | NO EJECUTADO: turno acotado; el portón es el CI |
| Lectura de producción | — | NO EJECUTADO, a propósito |

**Lección:** la prueba de la página dobla `employee-queries` entero y por eso no vio la validación rota. La función real ahora tiene su propia prueba. Las ediciones con escapes (`\d`, `\s`) se hacen con la herramienta Edit, no con heredocs de shell.

## PENDIENTES DE ESTA TAREA

- CI de la #632 en verde sobre la cabeza nueva.
- Medir en el navegador dos anchos que el `/ui-check` dejó estimados: la columna de correo de la lista (180 px, con elipsis) y la fecha de la línea de tiempo (110 px, con `nowrap`).
- F2 a F5, cuando el DG las asigne. En la F2 va también registrar la excepción de D9 a AUD-02 §3.
- Medidas NV de la spec (GoTrue v2.197 en local, IP detrás del borde): al empezar la F4.

## FUERA DE ALCANCE DETECTADO

- **N2, revisión del DG sobre la F1:** las **solicitudes de registro** siguen mandando al navegador `national_id` y `bank_account` completos, también las ya aprobadas (`lib/studio/nomina/registration-queries.ts:10-13`, la pestaña Solicitudes de Nómina). Es el mismo problema que la F1 corrigió en la lista de empleados. Pendiente para la F2 (proyección sin cédula ni cuenta, o enmascarada), con su prueba.
- La ficha del empleado no audita cambios de sueldo, banco ni estado (AUD-01); los finiquitos sí (0316). La spec lo deja como F5.
- `audit_list_events` no filtra por actor, aunque AUD-02 §4 lo pide. La spec lo deja como F3.
- `nomina_employee_registrations.photo_path` sin escritor y con conservación indefinida (`registro-tratamiento.md:56`).
- `nomina_employees` sin plazo de conservación (`registro-tratamiento.md:55`).
- Un acceso extra a `nomina` (SDD-0635) pasa la puerta del módulo, pero la RLS lo deja con la lista vacía: el extra no sirve para Nómina (`rbac-guard.ts:156-157`, `0160:71-85`).

## Impacto documental

- Nuevos o cambiados: la spec, `docs/specs/README.md` y este handoff.
- `registro-tratamiento.md` y `mapa-de-borrado.md` se actualizan en la F2 (foto, revelado) y la F4 (inicios de sesión). La F1 no agrega datos personales: reduce lo que viaja al navegador.

## HANDOFF AL DIRECTOR

La #632 trae la spec y la F1 con las correcciones de tu revisión. La revisión independiente y la fusión son tuyas.

---

## Historia de las revisiones de la spec

### DG sobre `18441e8b7`, CHANGES REQUESTED

| Hallazgo | Verificado en | Corrección en la spec |
|---|---|---|
| H1: ya no hay CHECK de `entity_type` | `0261:119-133`, `0538:292-299` | Tipos en `audit_entity_types` con su `domain_code` (§F2) |
| H2: la retención choca con AUD-02 §5 y §8 | `aud-02.md` §5 y §8, `retention-schedule-v1.md` §3, `0304:68-69`, `:103-105` | Enmienda v1.1 del calendario, clase `security` de 2 años, lote controlado; sin purga mientras no se apruebe (§F4, D6) |
| H3: a la 0555 le faltaban preflight, topes, grant y límites del bucket | `0261:19-20`, `0457:103-105` | §F2 |
| H4: `ensureEmployeeAuthUser` reutiliza cuentas | `nomina/actions.ts:1891-1927` | §3.3, §4 punto 6, D2, H9 |
| H5: Nómina sí audita la anulación de finiquitos | `0316:26-32`, `:191`, `:320` | §2.1 y la Línea de tiempo |
| H6: faltaba la clasificación de gobernanza | `AGENT-BRIEF.md` paso 4 | §10 |

### DG sobre `8dcb53734`, APPROVED con ajustes menores

D9 con sus tres diferencias con AUD-02 §3; funciones de lote propias para los inicios de sesión; lo que `after()` no resuelve; primer uso del `domain_code` `security`.

### Codex sobre `8dcb53734`, solo lectura

Control de rol y tenant en el servidor (A1); correctivo de `ensureEmployeeAuthUser` antes del enlace, porque falla abierto (A2); la cuenta completa ya viajaba al navegador (A3); tres clases de inicio de sesión (A4); «lo que hizo» acotado y proyección laboral para Contabilidad (A5); la foto no es P0 (A6); error ≠ ausencia (A7); gobernanza como «diseño propuesto» (A8); B1-B5, C1-C3 y los cambios de D3, D9, D11 y D13. Fases reordenadas: F1 lectura segura → F2 identidad, revelado y foto → F3 «lo que hizo» → F4 inicios de sesión → F5 historial y alta con acceso.

### Decisiones de Sam (2026-11-17)

En el chat del DG, a «¿Apruebas las 13 decisiones recomendadas de la ficha de empleado?», Sam respondió literal: «Sí, las recomendadas». D9 = (b): Admin y Contabilidad, con motivo, sin reautenticación; excepción a AUD-02 §3 que se registra en la F2.
