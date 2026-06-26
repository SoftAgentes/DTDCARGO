# MEJORAS — SDD-0107 (lane pragmático · academia ligada a la persona)

Mejoras de UX/patterns **dentro de las convenciones del Studio** (sin Zod, sin
arquitectura nueva, sin romper la frontera público↔ERP). Cada una nace de un
patrón ya documentado en `app/studio/CLAUDE.md` o de un gap operativo del alta de
inscripción. La base de la spec (migración + person_id + validación + link lazy)
queda intacta; esto es el plus.

---

## 1. Feedback de identidad en vivo al inscribir (on-blur de la cédula)

**Qué:** al salir del campo "Documento (cédula)" en el `EnrollmentDrawer`, una
server action de SOLO LECTURA (`lookupStudentCiAction`) busca la persona por
cédula normalizada y devuelve uno de tres estados, que el drawer pinta inline:

- `existing` con carga → **"Este alumno ya es cliente DTD: DTD-1234 (María …)."** (verde)
- `existing` sin carga → **"Persona ya registrada: María …. Se reusa su identidad."** (verde)
- `new` → **"Alumno nuevo · se registrará la persona V-18.452.110."** (info)
- `invalid` → aviso rojo con el formato esperado.

**Por qué:** el operador sabe ANTES de confirmar si está duplicando un humano que
ya es cliente de carga o creando uno nuevo. Cierra el loop "carga + academia =
misma persona" de cara a quien tipea, no solo en la DB. Es el espíritu de la
sección "Trazabilidad visual" del CLAUDE.md aplicado al alta.

**Convención respetada:** server action `"use server"` con gate de vista RBAC
(`canAccessModule`), sin Zod, lectura pura (no crea persona ni inscribe — la
creación lazy ocurre recién al confirmar).

## 2. Normalización visible de la cédula

**Qué:** `formatStudentCi()` reescribe el campo al salir: `v18452110` →
`V-18.452.110`, `j123456789` → `J-12345678-9`. Lo que se guarda en `student_ci`
es ese formato canónico; el ancla a `persons` usa `normalizeCedula` (idéntico al
índice SQL de 0170/0177), así que el formato visible no afecta el dedupe.

**Por qué:** consistencia de datos (mismo humano tipeado de 3 formas → un solo
registro visible y normalizado) + confirmación visual inmediata, igual que el
preview de `NumericInput`. Un test verifica `normalizeCedula(raw) ===
normalizeCedula(formatStudentCi(raw))` (idempotencia del ancla).

## 3. Validación inline de cédula reusando los validadores del Studio

**Qué:** `isValidStudentCi()` acepta cédula venezolana simple (V/E + 5..10
dígitos, con/sin puntos/guiones/espacios) **y** el RIF completo de clientes
(reusa `RIF_REGEX` + `formatRif` de `client-types.ts`). En el alta, cédula con
formato inválido → `fieldErrors.studentCi` (patrón Server Action de AGENTS.md,
sin Zod).

**Por qué:** el operador de Academia tipea la cédula simple, que NO pasa el
`RIF_REGEX` estricto (que exige 8 dígitos + verificador). En vez de inventar un
validador nuevo desconectado, se compone con los existentes y se cubre el caso
real sin meter basura en `persons`.

## 4. Sugerencia de nombre desde la persona conocida

**Qué:** si el lookup encuentra una persona y el campo "Nombre del alumno" aún
está vacío, se autocompleta con `persons.name`. No pisa lo que el operador ya
escribió.

**Por qué:** ahorra re-tipear datos que el tenant ya tiene de la carga. Bajo
riesgo (solo rellena vacío), alto valor en mesa de inscripción.

## 5. Toast de confirmación contextual al inscribir

**Qué:** la action devuelve `person: { created, name, cargoMarkbox }` y el toast
final dice cómo quedó anclada la identidad:
- ya es cliente → "… inscrito · ya es cliente DTD-1234"
- alumno nuevo → "… inscrito · alumno nuevo registrado"
- sin cédula → "… inscrito" (sin ancla, comportamiento previo).

**Por qué:** regla 2 de "Trazabilidad visual" (cambio de estado → toast con
resumen). El operador retoma contexto tras una interrupción sabiendo qué pasó
con la identidad, no solo que "se inscribió".

## 6. Creación lazy de persona con guarda anti-carrera (23505)

**Qué:** `resolvePersonForEnrollment` ubica-o-crea la persona; si dos altas
concurrentes con la misma cédula chocan el índice único parcial de `persons`
(0170), captura el `23505` y re-busca en vez de fallar. Espejo en runtime del
backfill (a)/(c) de la migración 0177.

**Por qué:** robustez sin arquitectura nueva — mismo patrón de reintento que la
emisión de diplomas (`MAX_FOLIO_RETRIES`) ya presente en el módulo.

---

### Lo que NO se hizo (respetando el alcance de la spec)

- No se tocó `academy_lesson_progress` ni el RLS del portal (siguen por
  `client_markbox`).
- No se creó fila `clients` para alumnos academia-only (diferido por la spec).
- No se metió combobox cédula-first ni decisión de ruta `[markbox]` vs `[id]`
  (eso es Fase 3 / SDD-0108).
- Cero imports cruzados público↔ERP; todo vive en `lib/studio` / `app/studio`.
