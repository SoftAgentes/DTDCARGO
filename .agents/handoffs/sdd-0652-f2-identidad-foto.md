# Handoff · SDD-0652 fase 2 — Identidad, revelado y foto de la ficha del empleado

- **Owner:** Claude Worker `0652-f2-foto-enlace` (sesión hija del Director General)
- **Ruta:** `.claude/worktrees/guia-compacta-20428c`
- **Rama:** `claude/0652-f2-foto-enlace-18332d`. Base: `main`, integrada por merge en `5f394f40b` (#646)
- **PR:** ver «VALIDACIÓN» y «HANDOFF AL DIRECTOR» (se completa al publicar). No fusionar: lo decide el DG
- **SDD:** `docs/specs/0652-ficha-empleado-360/spec.md` (`in-progress`), §F2 y §7 F2
- **Migración:** **0555**, EN ESPERA. No se aplicó en ningún entorno real. Aplicarla exige el OK nominal de Sam en el chat del DG y el runbook
- **Autorización del encargo:** Sam, 2026-11-17, «Sí, las dos» (fase 2 de la ficha y fase 2 de la Vista simple), transmitido por el DG. Decisiones D1-D13 ya aprobadas («Sí, las recomendadas»)

## OBJETIVO ORIGINAL

Fase 2 de la SDD-0652: (1) foto del empleado, (2) enlace explícito ficha ↔ usuario del Studio, (3) migración 0555 con su contrato y los archivos de control en espera, (4) corregir N2 de la revisión de la fase 1 (las solicitudes de registro mandaban `national_id` y `bank_account`). Con `revisar-datos-ve`, RBAC y RLS con casos negativos, `/ui-check`, sin aplicar la migración y sin leer producción.

## COMPLETADO

**Migración 0555** (en espera):

- tres tipos en el catálogo de auditoría (`nomina_employee_access`/`access`, `nomina_employee_photo`/`governance`, `nomina_employee_sensitive_view`/`security`);
- `nomina_employees.photo_path` y el bucket privado `employee-photos` (2 MB, JPEG/PNG/WebP, sin policies);
- `nomina_ficha_actor_tenant` (sin EXECUTE para nadie) y cinco RPC `security definer`, `search_path` vacío, EXECUTE solo `authenticated`: enlazar y quitar enlace (solo admin, con motivo), foto y revelado (admin y Contabilidad), línea de tiempo;
- preflight que aborta, topes de 5 s y 30 s, postcondiciones;
- contrato `.test.sql` con el writer AUD-01 real y su envoltorio PGlite con control rojo, 8 casos de preflight y 14 mutantes.

**Enlace ficha ↔ usuario (§4):**

- «Enlazar con usuario» (selector de miembros activos sin ficha, con motivo) y «Quitar enlace», solo admin;
- la sugerencia por correo propone y no enlaza; a Contabilidad no le llegan ni los candidatos ni la sugerencia (no se piden);
- **correctivo de `ensureEmployeeAuthUser`** (`lib/studio/nomina/employee-auth-user.ts`): crea, «ya existe» o error. Nunca reutiliza una cuenta. Con «ya existe» la ficha nace sin acceso y el panel lo dice; con error no se crea nada; si la ficha no nace, la cuenta recién creada se descarta.

**Foto (UPL-01, MP-01):**

- subir, cambiar y quitar desde la cabecera de la ficha; foto también en la fila de Empleados;
- el servidor valida el tipo por contenido y el tamaño, reescala a 512 px, guarda WebP sin EXIF, sube con ruta `{tenant}/{ficha}/{uuid}.webp` y firma URL de 10 minutos después del control de rol;
- reconciliación de huérfanos `/api/cron/purge-employee-photo-orphans`, diaria, **apagada por omisión**.

**Revelado (D9 b):** «Mostrar» pide motivo; la RPC deja `bank_account_revealed` sin el número antes de devolver; en el navegador vive en memoria un minuto. Excepción a AUD-02 §3 escrita en `docs/governance/reviews/excepcion-aud-02-revelado-cuenta-nomina-2026-11-17.md`.

**Línea de tiempo:** suma los eventos de la ficha (enlace, foto, consultas de la cuenta, finiquito anulado) con quién los hizo.

**N2:** `listRegistrations` ya no lee la cédula ni la cuenta (`REG_LIST_COLUMNS`); la bandeja muestra la fecha de recibida. El panel de revisión pide los datos con `getRegistrationReviewAction`, solo para una solicitud pendiente del tenant, con la cuenta enmascarada. La foto del candidato deja de leerse.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check` (`node scripts/build-docs-index.mjs --check`) | PASÓ |
| `sdd:check` (`node scripts/check-numbering.mjs`) | PASÓ |
| `governance:check` | PASÓ |
| `node scripts/build-crontab.mjs --check` | PASÓ, 30 crons |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 rojos, 3 amarillos declarados |
| `node scripts/migrations-lock.mjs verificar` | PASÓ: 1 espera sin sellar (la 0555) |
| `git diff --check` | PASÓ |
| `/ui-check` sobre el diff | Hecho, OK con ajustes menores (aplicados: etiqueta del selector de archivo y ayuda del motivo) |
| `pnpm install --frozen-lockfile` en el worktree | PASÓ, con turno de PC del DG (React 19.3.1, Vitest 4.1.12) |
| `tsc --noEmit` | PASÓ, dos veces: antes y después de corregir las pruebas |
| `eslint` sobre `nomina`, el cron, `lib/studio/nomina` y las dos pruebas tocadas | PASÓ |
| vitest de `lib/studio/nomina`, `app/studio/(app)/nomina`, `app/studio/(app)/usuarios`, `rbac-actions-guard`, el cron de fotos y `build-crontab` | PASÓ: 51 archivos, 1.186 pruebas, sobre el árbol final |
| Contrato SQL de la 0555 en PGlite (dentro de esa corrida) | PASÓ: 80 aserciones, control rojo, 8 casos de preflight y 14 mutantes que caen |
| Primera corrida de ese vitest | FALLÓ en 5 de 1.186 y se corrigió: contador de archivos de acciones (82 → 83), `conservar-lo-escrito` (el panel de solicitudes ahora carga antes de mostrar el formulario), un mutante con la aserción mal anotada y **un mutante que sobrevivía** (el desempate por id del cursor no se medía: se sembraron tres eventos en el mismo instante y se agregó T7) |
| `lib/studio/__tests__` completo (207 archivos, sumado por error a una corrida) | 4.373 pasaron y 1 FALLÓ por tiempo (`solo-superadmin-crea-admin`, 20 s) con procesos de vitest que no arrancaron; **aislada PASÓ** (36 pruebas). Es contención de la máquina, no contenido, y no es de esta tarea |
| Contratos SQL en Docker (`run-sql-tests.mjs`) | NO EJECUTADO: lo corre el CI («Contratos SQL») |
| `pnpm verify` completo, build y e2e | NO EJECUTADO: el portón es el CI |
| Prueba en el navegador | NO EJECUTADO: sin la 0555 aplicada en local no hay foto, enlace ni revelado que probar |
| Aplicar la 0555 | NO EJECUTADO, a propósito |
| Lectura de producción | NO EJECUTADO, a propósito |

## DATOS PERSONALES (`revisar-datos-ve`)

Alcance: Venezuela (CRBV arts. 28 y 60). No es asesoría legal.

| Estado | Qué | Evidencia |
|---|---|---|
| CORRECTO | La foto se guarda sin EXIF y reescalada | `lib/studio/nomina/employee-photo.ts` (`procesarFotoEmpleado`); prueba con EXIF y GPS sintéticos |
| CORRECTO | El bucket es privado, sin policies; sube y firma el servidor tras el control de rol | migración 0555 §3; `empleados/[codigo]/page.tsx`; `nomina/page.tsx` |
| CORRECTO | La cuenta completa solo sale por la RPC, con motivo y evento sin el número; si el evento falla, no sale | migración 0555 §7; contrato R3-R7 |
| CORRECTO | La bandeja de solicitudes no lee cédula ni cuenta | `registration-queries.ts` (`REG_LIST_COLUMNS`) |
| CORRECTO | Aprobar una solicitud no reutiliza cuentas | `employee-auth-user.ts` |
| CORRECTO | Los logs del cron llevan conteos, no rutas | `purge-employee-photo-orphans/route.ts` y su prueba |
| ENCONTRADO | El revisor de una solicitud pendiente ve la cédula completa. Se deja: tiene que cotejarla antes de crear la ficha | `RevisarSolicitudDrawer.tsx` |
| ENCONTRADO | Los nombres del equipo (quién hizo cada cambio) ahora se cargan también para Contabilidad en la línea de tiempo | `empleados/[codigo]/page.tsx` (`nombresDelTenant`) |
| ENCONTRADO | Con el cron apagado, las fotos cambiadas o quitadas siguen en el bucket | `mapa-de-borrado.md` §12 |
| NO VERIFICABLE | Base de licitud y consentimiento de la foto (hoy la sube la empresa, no el empleado) | abogado; C1 de la spec |
| NO VERIFICABLE | Que el borrado de la foto borre de verdad: no se sembró ni se borró nada contra una base real | exige la 0555 aplicada |
| NO VERIFICABLE | PIPL: fotos y fichas de personas del equipo en China | abogado |

Conviene que otro modelo revise este análisis.

## PENDIENTES DE ESTA TAREA

- CI de la PR en verde (ahí corren los contratos SQL en Postgres real, la suite completa y el build).
- **«Reenlazar su cuenta de empleado»** (§4 punto 6) no se construyó: falta decidir cómo se reconoce una cuenta «solo de `/m/emp`» sin leer datos de otra persona. Hoy el empleado que vuelve queda sin acceso y con el aviso.
- «Ver más» de la línea de tiempo (la RPC ya pagina; la pantalla trae 50).
- Carrera real de dos enlaces a la vez (dblink en la suite SQL de Docker): no escrita.
- Medir en el navegador la cabecera con la foto de 72 px y los controles a 320 px.
- Después de aplicar la 0555: quitar la espera del baseline y las tres declaraciones, sellar el lock, probar en pantalla, leer los conteos del cron y decidir si se enciende.
- Entrada de la excepción D9 en la línea base del registro maestro de gobernanza (protocolo L3): es del DG.

## FUERA DE ALCANCE DETECTADO

- `nomina_employee_registrations` conserva cédula, cuenta y la columna `photo_path` de solicitudes ya aprobadas o rechazadas, sin plazo (`registro-tratamiento.md`). Ya no viajan al navegador, pero siguen en la base.
- `sharp` no se usaba en el runtime del Studio (solo en scripts). No está comprobado que la imagen Docker del servidor lo traiga con sus binarios.
- El gate de símbolos pendientes cuenta como sitios de `nomina_employees.photo_path` los `photo_path` de `dispatch_pods` (`app/m/ve/camionero/actions.ts`, `lib/studio/dispatch-mobile-types.ts`). Quedaron declarados como homónimos; el gate podría distinguirlos.
- Los pendientes de la fase 1 siguen igual: F3 (`audit_list_events` sin filtro por actor), F5 (cambios de sueldo y banco sin evento), plazos de conservación de la ficha.

## Impacto documental

- Spec §7 F2 con la lista real de archivos y las diferencias con lo propuesto.
- `docs/legal/privacidad/registro-tratamiento.md` (§3 y §4) y `mapa-de-borrado.md` (§12).
- `docs/governance/reviews/excepcion-aud-02-revelado-cuenta-nomina-2026-11-17.md`.
- `.env.example` e `infra/dtd-cargo/.env.example`: `PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED`.

## HANDOFF AL DIRECTOR

Pendiente de publicar. Al abrir la PR se anota aquí el número y la cabeza, y se avisa por mensaje.
