# Handoff — SDD-0653 · Reglas de nómina al día con la ley y estante de ley pública para Faro

- Rama de la fase A2a: `claude/0653-nomina-ley-faro-0b4370` · PR #631 (fusionada) · Worker 0653 · 2026-11-17
- Rama de la fase A3: `claude/0653-a3-tope-motor` · PR #640 (fusionada, CI verde, revisión APPROVED)
- Rama de la fase A2b: `claude/0653-a2b-vigencia` (worktree propio, desde `main` 725e2ef81) · PR #660 · asignada por el DG el 2026-11-17.
- A2a y A3 en `main`; A4, B1 y B2 esperan la asignación del DG.
- Spec: `docs/specs/0653-nomina-reglas-ley-y-faro/spec.md` (`in-progress`).
- Migración **0556** `nomina_reglas_vigencia_y_aportes` (reservada por el DG): creada en la rama A2b, **EN ESPERA** (no aplicada a ningún entorno).

## Instrucción de Sam que amplió el encargo (2026-11-16)

Implementar en las reglas; lo no verificado se implementa con una nota simple («no está verificado, consultar con
un abogado»); la versión muestra su fecha de actualización; lo no verificado lleva un asterisco con algo llamativo
al tocarlo; y volver a comprobar las dudas contra las Gacetas.

## Decisiones aprobadas (2026-11-17)

Sam aprobó las decisiones recomendadas. Literal, en el chat del Director General, a «¿Apruebas las decisiones
recomendadas de nómina (#631) y de la Vista simple (#633)?»: «Sí, ambas». Lo transmitió el DG; esta sesión no lo
presenció. Quedan decididas D1, D2, D3a, D3b y D4 a D10 con la opción (a). No autoriza producción ni arranca fases.

## Fase A2b (2026-11-17) — migración 0556 y pestaña Reglas con vigencia, aportes y escalas

Asignada por el DG («Sam autorizó anoche avanzar todo el roadmap en bloque»); las decisiones D1 a D5 y D10 ya estaban aprobadas. La PR #660 recibió
CHANGES_REQUESTED de la revisión independiente (11 puntos); esta es la segunda ronda, en un solo push.

**Qué entrega** (sin leer ni escribir producción):

- **Migración 0556**, aditiva y idempotente, sobre `nomina_payroll_rules`: 13 columnas (vigencia, fuente legal, ingreso mínimo integral en USD, moneda de cestaticket y bono, 5 aportes del patrono, el INCES sobre utilidades y 2 escalas), 8 CHECK (utilidades 30 a 120, pensiones máx. 15, rangos) y la función `nomina_guardar_reglas(jsonb)`, que archiva la vigente e inserta la siguiente **en una sola transacción** (SECURITY INVOKER, `search_path` vacío, EXECUTE solo `authenticated`, tenant de la sesión, fecha futura rechazada). Preflight que aborta con datos fuera de rango (cuenta, no lee) y postflight de forma, función, RLS y grants. Cabecera «NO APLICADA A PRODUCCIÓN». Desarme en `supabase/desarmes/`.
- **Espera declarada** en `supabase/migrations-baseline.json` y **degradación declarada** en `supabase/pending-migration-symbol-declarations.json` (14 símbolos: 13 columnas y la función): sin la 0556 la pantalla sigue como en A2a (la lectura reintenta sin las columnas nuevas, el guardado usa los dos pasos de siempre **con restauración** y el formulario deshabilita los campos con un aviso).
- **Contrato** `supabase/tests/` (migraciones reales 0160, 0162 y 0556): filas existentes intactas, filas nuevas con fecha de hoy en Caracas, 17 rechazos de CHECK y 10 límites válidos, reaplicar no cambia nada, RLS por tenant Y rol (otro tenant, operador, admin deshabilitado, sin membership y anon), catálogo sin cambios y el guardado atómico (fallos que dejan intacta la vigente, éxito, herencia de moneda, aislamiento entre tenants). Ensayado en PGlite con control rojo, preflights, desarme y reaplicación, mutantes (relleno con UPDATE, default de fecha UTC, moneda USD por defecto, default en un aporte, CHECK de moneda o de rango debilitado, función sin atomicidad o SECURITY DEFINER, fecha futura aceptada, tope de pensiones 100, anon con SELECT, policy abierta, no idempotente) y una prueba gemela columnas del SQL = columnas del código.
- **Código:** tipos y validador (monedas, aportes 0 a 100, pensiones tope 15, utilidades 30 a 120, escalas, fecha de vigencia no posterior a hoy en Caracas, fuente, montos que no desborden numeric(14,2)); lo no configurado es `null` y **nunca se lee como cero**; consultas con degradación; estante legal enlazado a las columnas nuevas (2 normas más: vacaciones adicionales y bono vacacional máximo; unidad del bono según su moneda; el INCES sobre utilidades es una retención al trabajador y va en deducciones); formulario de Reglas con los campos nuevos y pestaña Reglas con «Rige desde … · Fuente …».

**Decisiones tomadas** (para el DG y Sam):

1. **`vigente_desde` nullable** (la spec decía NOT NULL). Con filas existentes y sin UPDATE, NOT NULL las llenaba con la fecha de aplicación, una vigencia inventada. Las versiones anteriores quedan en NULL = «sin fecha de vigencia registrada». El default de las filas nuevas es hoy en Caracas.
2. **«Rige desde» es informativa** (decisión del DG en la revisión): el corte usa siempre la versión vigente y la fecha no puede ser posterior a hoy en Caracas (validador y función). **D11, pendiente de Sam:** si debe elegir la versión de un corte según su fecha (programar cambios futuros). Está en la tabla de decisiones de la spec.
3. **Aportes patronales, INCES sobre utilidades, pensiones, escalas e ingreso mínimo integral: nullable y sin default** (decisión del DG). La norma conocida (9, 2, 2, 2, 0,5, 9; escalas 15 y 30) la **propone el formulario solo como placeholder**: los campos nacen **vacíos** y la propuesta no viaja al guardar. Un botón explícito «Usar la propuesta» (uno por grupo: aportes del patrono, INCES sobre utilidades y escalas) la copia a los campos vacíos; sin pulsarlo se envía vacío (null = «sin configurar») y la comparación dice «falta», nunca «al día». Así quien abre una versión para cambiar otra cosa no graba como confirmados valores que el contador todavía no confirmó. Para que no dependa del gris de un placeholder, cuando uno de esos ocho campos está vacío un texto visible debajo dice «Sin configurar · propuesta: N», enlazado con `aria-describedby` (`Field` ganó una prop opcional `ayuda`); desaparece en cuanto el campo tiene un valor. El ingreso mínimo integral es un anuncio: no se propone valor.
4. **Monedas** `not null default 'VES'`: las filas existentes siguen en bolívares; al editar, la versión conserva su moneda; una versión nueva sin versión previa arranca los bonos en USD (D4).
5. **Guardado atómico** con la función de la 0556 (decisión del DG): el diseño anterior archivaba y luego insertaba, y un insert fallido dejaba al tenant sin versión vigente. Sin la 0556 se conservan los dos pasos, ahora con restauración de mejor esfuerzo (un corte entre archivar e insertar la deja sin hacer). Si la lectura vio las columnas pero la función no existe, la app **no degrada**: «La base se está actualizando; recarga e inténtalo de nuevo» y no guarda nada. La función exige fecha AAAA-MM-DD, desde 2000-01-01 y no posterior a hoy, y comprueba tenant y acceso de forma explícita (con prueba propia y mutante). Dos guardados simultáneos (23505) dicen «Otra persona guardó al mismo tiempo; recarga».
6. **Sin guía ni novedad de Faro de nómina:** `nomina` sigue reservada en el minicerebro y `novedades/` no existe en `main` (D-10 de la 0637 pendiente).
7. La fuente legal no se hereda de la versión anterior (una fuente vieja en una versión nueva engaña más que un campo vacío).

**Gobernanza (AGENT-BRIEF):** se corrigió la clasificación de la spec §7 bis. SGE-00 cumplimiento parcial, MP-01 cumplimiento, AUD-02 no aplica, y dos no conformidades heredadas **con seguimiento**:

- **S-0653-1 (FRM-01):** el formulario de Reglas usa `<input type="number">` y valida al enviar. Sitio: `app/studio/(app)/nomina/_components/ReglasDrawer.tsx`. Migrarlo a `NumericInput` y al ciclo pristine→blur→invalid es otra tarea.
- **S-0653-2 (AUD-01):** guardar reglas no emite un evento auditable propio (ni antes ni después de la 0556); el rastro es la versión misma (`version`, `created_by`, `created_at`, estado). Sitios: `savePayrollRulesAction` en `app/studio/(app)/nomina/actions.ts` y `nomina_guardar_reglas` en la 0556.

**Evidencia de la fase A2b** (cabeza local tras fusionar `origin/main`; turno de PC del DG; versiones del lockfile: typescript 6.0.3, vitest 5.1.0, instaladas con `pnpm install --frozen-lockfile` en el worktree propio):

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p tsconfig.json` | PASÓ |
| vitest `lib/studio/nomina`, `app/studio/(app)/nomina` (incluye `conservar-lo-escrito`, `ReglasDrawer.test.tsx`, la migración 0556 en PGlite) y `scripts/__tests__/spec-migration-refs.test.ts` | PASÓ (30 archivos, 479 pruebas) |
| vitest de contratos del Studio y de `scripts/__tests__` | PASÓ (80 archivos, 1157 pruebas) |
| Migración 0556 en PGlite: contrato, control rojo, preflights, desarme y reaplicación, mutantes, gemela | PASÓ |
| ESLint de `lib/studio/nomina` y `app/studio/(app)/nomina` | PASÓ |
| `check-pending-migration-symbols` | PASÓ: 0 ROJO · 5 AMARILLO declarados (los de 0549 y 0558 son ajenos) |
| `migrations-lock`, `docs:check`, `sdd:check`, `governance:check`, `components:check` (scripts directos) | PASARON |
| Contrato `.test.sql` en Postgres real (Docker) | NO EJECUTADO: lo cubre PGlite (PostgreSQL embebido) con las mismas migraciones |
| `pnpm verify` completo y build | NO EJECUTADO (fuera del turno); lo cubre el CI de la PR |
| Pantalla con sesión real (con y sin la 0556) | NO EJECUTADO |

La declaración de símbolos se genera con un script (los ~200 sitios file:línea los calcula el gate); si se edita un archivo de la lista, hay que regenerarla. Lo que entra en producción sigue siendo del DG: aplicar la 0556 pide el OK nominal de Sam y el runbook.

## Fase A3 (2026-11-17) — tope de SSO y RPE en el motor

Sam preguntó si el mensaje de una captura sobre el motor era un error o estaba bien: era correcto. Luego dijo «Sí,
arráncala» y se hizo la D6 (opción a, ya aprobada). Qué cambió:

- `calcReciboDraft`: el tope mensual en Bs pasa a USD con la tasa del corte y se prorratea al período (días / 30).
  Sin tasa y con topes activos lanza `FaltaTasaParaTopeError`.
- `lib/studio/nomina/tope-fx.ts` (nuevo): busca la tasa vigente al último día del período, o usa la congelada en el
  snapshot; avisa qué cargar si falta.
- `actions.ts`: al generar el corte se resuelve la tasa ANTES de crearlo (no queda un borrador vacío) y se congela en
  `rules_snapshot`; al regenerar se usa la congelada.
- La prueba antigua afirmaba el comportamiento errado («650» como USD) y se reescribió.
- Revisión independiente de #640 (cabeza 60ad8b391, CAMBIOS): la tasa debe ser del último día del período o de hasta 4
  días naturales antes (rechaza la vieja); con el período en curso el borrador usa una tasa PROVISIONAL que no se
  congela y confirmar exige la del cierre; el renglón muestra la fecha y el valor de la tasa; pruebas de período
  parcial, sueldo igual al tope, RPE semanal 0,13, tasa vieja y corte previo al cierre.
- Sin migración. No se leyó producción.

**Qué falta:** el contador confirma que la tasa del último día del período es la que corresponde (D6) y qué hacer con
los cortes ya confirmados o pagados con el cálculo anterior. Eso último es una consulta a producción que necesita el
OK de Sam: no se hizo.

## Hecho (fase A2a)

- Spec: tabla regla / sistema / ley / fuente, diseño del estante «Ley» de Faro, fases, migración propuesta,
  allowlist, decisiones (D1 a D10, con D3 partida en D3a y D3b) y clasificación de gobernanza (§7 bis).
- Fase A2a, sin migración ni cambio de cálculo:
  - `lib/studio/nomina/ley/parametros.ts`: 21 normas con valor, fuente, vigencia, grado, alcance y dónde se
    comprobó.
  - `ReglasTab.tsx`: pestaña Reglas nueva (sale de `NominaClient.tsx`).
  - `PistaLey.tsx`: pista «según la ley» bajo cada grupo del formulario (`ReglasDrawer.tsx`).
- Comprobación contra las Gacetas oficiales (spec §2.2).

## Revisión independiente del DG sobre e5ad95c72 (CHANGES REQUESTED) y qué se hizo

| Hallazgo | Corrección |
|---|---|
| Cestaticket de USD 40 atribuido a la G.O. 6.746 | Fuente «Anuncio del Ejecutivo», Gaceta nula, vigencia nula; la 6.746 queda en el detalle como último monto conocido |
| IMI sin aclarar el alcance | El texto dice que el aumento es del sector público y que al privado se le exhortó |
| INCES, RPE, IVSS marcados verificados sin Gaceta leída | Pasan a «por confirmar». «Verificado» ahora exige Gaceta con número y fecha, fecha de vigencia y lectura en la Gaceta; quedan 8 verificados y 13 con asterisco |
| Vigencias nulas sin marcar | La ficha dice «Vigencia: por confirmar» y una prueba impide que algo sin vigencia sea verificado |
| Spec con dos grados y V laxo | Leyenda V, A, O, R, N alineada con los tres grados del código |
| Pruebas débiles | Pruebas de qué significa cada grado, de obligaciones frente a referencias, de `PistaLey` y de movimiento |
| MOT-01 | Solo `--dur-fast`, `--dur`, `--dur-slow` y `--ease`; se quitó el pulso infinito |
| `<span aria-label>` sin rol | Asterisco oculto al lector y texto con `studio-sr-only` |
| Faro §3.3 | Prohibidos OpenRouter y cualquier agregador; la regla se cita como SDD-0639 D-2; la prueba de B1 permite solo `import type` |
| D3 y D1 | D3a (cestaticket: obliga, falta la Gaceta del monto) y D3b (bono e IMI: referencia); D1 dice que esta PR ya implementa (a) |
| Barra «Al día con la ley» | Ahora «Obligaciones al día»: no cuenta anuncios ni lo que no obliga a DTD; esas filas llevan la pastilla «Referencia» y tienen su filtro |

## Evidencia

Se llena al cerrar esta ronda (ver la descripción de la PR): pruebas del módulo, contratos del Studio, typecheck,
ESLint, `docs:check`, `sdd:check`, `governance:check` y `components:check`.

- `pnpm verify` completo: NO EJECUTADO en local (el worktree no tiene `node_modules`); lo cubre el CI de la PR.
- Pantalla dentro del Studio con sesión real: NO EJECUTADO; se revisó con capturas de una vista estática.
- No se leyó producción. No hay PII ni montos de empleados en el diff.

## Pendiente de esta tarea

- Asignación del DG para las fases siguientes; ninguna empieza sin ella.
- A2b (migración 0556: vigencia, moneda de los montos, aportes patronales, escalas), A3 (tope del motor: en `main`, falta la validación del contador), A4 (carga
  en producción con OK nominal), B1 y B2 (Faro; B2 depende del motor de la SDD-0637).
- Probar la pestaña dentro del Studio con sesión real (prueba o local con Supabase).
- Novedad y guía de Faro para la pestaña Reglas (D-10 de la 0637): `novedades/` todavía no existe en `main` y
  `nomina` no tiene guía; queda para cuando exista ese estante.
- **Nota para el contador (A3):** si el corte se genera el mismo día del cierre y todavía no existe la tasa de ese día, se
  congela la de hasta 4 días naturales antes (la tolerancia por fines de semana y feriados). El contador decide si esa
  tasa le sirve o si prefiere esperar la del día. También confirma que la tasa del último día del período es la que
  corresponde para convertir el tope (D6).
- Saber si algún corte ya confirmado o pagado salió con el cálculo anterior es una consulta a producción: necesita el OK
  de Sam y no se hizo.
- Confirmar con el contador o un abogado lo marcado «por confirmar» o «solo anuncio»: IVSS, RPE, FAOV, INCES, el
  monto del cestaticket y si el bono obliga al sector privado.

## FUERA DE ALCANCE DETECTADO

- **Mejora opcional del SQL, para cuando se toque la 0556 antes de aplicarla** (hoy no se toca: el md5 no debe cambiar sin necesidad): envolver el cast de `vigente_desde` a `date` para que una fecha imposible (p. ej. `2026-02-31`) devuelva 22023 con un mensaje propio en español. Hoy, llamando a la función por RPC directo, sale el 22008 de Postgres en inglés. Desde la pantalla no se ve: el validador de la app ya rechaza esas fechas (`isFechaIso`) y el piso 2000-01-01 antes de llamar.

- **Las columnas de la 0179 no se leen ni se guardan desde la pantalla de Reglas.** `getVigentePayrollRules` no selecciona `prestaciones_method`, `prestaciones_interest_pct` ni `ajena_78_incluye_92`: los finiquitos siempre salen con método «mejor», interés 0 y sin el Art. 78, y cada vez que se guarda una versión nueva esas tres columnas vuelven a su valor por defecto. Es anterior a esta tarea y no se arregló aquí; es una tarea aparte, con el contador (qué método, qué tasa y si aplica el Art. 78).

- (Resuelto en la fase A3.) El tope de SSO/RPE mezclaba Bs con USD; ver la sección de la fase A3.
- La siembra demo de `0162:121` rotula en Bs montos que parecen dólares (cestaticket 40, bono 90).
- El sitio de la Imprenta Nacional no publica 68 Gacetas Extraordinarias de 2026 y su búsqueda por texto no
  funciona; cualquier vigilancia automática de Gacetas tiene que recorrer sumarios.

## Impacto documental

- A2b: la §8.1 de la spec 0103 ya lista las 13 columnas nuevas y la función (hecho). Si la 0556 cambia antes de aplicarse, actualizarla.
