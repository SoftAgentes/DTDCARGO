---
sdd: "0653"
title: "Nómina: reglas al día con la ley a noviembre de 2026 y un estante de ley pública para Faro"
status: proposed
author: "Claude (Worker 0653) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0103", "0109", "0226", "0637"]
confidencialidad: interno
---

# SDD-0653 — Las reglas de nómina al día con la ley, y Faro consultando la ley pública

> Sam pidió dos cosas (2026-11-16): revisar si la ley venezolana cambió en nóminas y sueldos mínimos para
> actualizar la ficha de «Reglas», y que Faro responda a los empleados lo que dice la ley «tal como está», para que
> vean que DTD trabaja bajo lo que la ley estipula. Esta spec mide la distancia entre las reglas y la ley vigente,
> propone cómo cerrarla con fecha de vigencia e histórico, y diseña un estante de **ley pública** para Faro, que
> nunca toca datos de empleados.

**Estado:** `proposed`. Solo documentación. No hay código, migración ni cambio en producción. Nada se implementa
antes de que Sam responda las decisiones D1 a D10 (§7).

**Advertencia de origen.** Esta investigación es de un agente con búsqueda web, no de un abogado laboral ni de un
contador. Cada valor trae su fuente y su grado de verificación. Antes de cargar valores en producción, el contador
los confirma contra el texto de la Gaceta (D8).

## 1. Dónde viven hoy las «reglas»

| Pieza | Dónde | Qué dice |
|---|---|---|
| Spec del módulo | `docs/specs/0103-nomina/spec.md:198-260` (§8, Slice B) | `payroll_rules` es config, no cálculo; el contador ajusta los valores |
| Tabla de reglas | `supabase/migrations/0162_nomina_payroll_rules.sql:25-71` | Columnas y valores por defecto |
| Valores sembrados | `supabase/migrations/0162_nomina_payroll_rules.sql:113-130` | Ruleset **demo ficticio** del tenant `dtd`: SML 130, cestaticket 40, bono 90 (en «Bs») |
| Versionado | `supabase/migrations/0162_nomina_payroll_rules.sql:80-83` | Un `vigente` por tenant; editar archiva el anterior y sube `version` |
| Config de liquidación | `supabase/migrations/0179_nomina_settlements.sql:45-49` (SDD-0109 §3.3) | `prestaciones_method`, `prestaciones_interest_pct`, `ajena_78_incluye_92` |
| Snapshot por corte | `supabase/migrations/0175_nomina_payroll_run.sql:54` | Cada corte congela las reglas usadas |
| Tipos y validación | `lib/studio/nomina/payroll-rules-types.ts:94-132` y `:180` | `utilidades_days ≥ 30` (Art. 131) |
| Motor del recibo | `lib/studio/nomina/payroll-run-types.ts:274-345` | SSO/RPE/FAOV sobre sueldo base con topes en SM |
| Pantalla | `app/studio/(app)/nomina/_components/NominaClient.tsx:423-462` (pestaña «Reglas») y `ReglasDrawer.tsx:128-129` | Muestra «Montos base (Bs)» |
| Anulación de finiquito | `docs/specs/0226-nomina-anulacion-finiquito-gobernada/spec.md` | Gobierno de la anulación; no define parámetros legales |

**Lo que no se leyó:** los valores que el tenant real tiene cargados en producción. Producción es real y la nómina
es sensible, así que la columna «valor en el sistema» de §2 muestra los **valores por defecto y la siembra demo que
están en Git**. Si el contador ya los corrigió en producción, la tabla lo subestima. Comprobarlo requiere el OK de
Sam para una consulta de solo lectura de la fila vigente de `nomina_payroll_rules`, sin montos de empleados.

## 2. Parte A — reglas frente a la ley (corte: 2026-11-16)

Grado de verificación:

- **V** = verificado en esta investigación con la Gaceta o con un organismo o medio que cita la Gaceta.
- **A** = anunciado por el Ejecutivo; **no** se encontró decreto en Gaceta Oficial.
- **C** = norma conocida de la LOTTT u otra ley; el artículo no se volvió a leer en el texto oficial en esta corrida.
- **N** = no se pudo confirmar.

| # | Regla | Valor en el sistema (Git) | Valor según la ley | Fuente y vigencia | Grado | ¿Cambia? |
|---|---|---|---|---|---|---|
| 1 | Salario mínimo (SML) | `min_salary` = 130 (Bs) — `0162:121` | **Bs 130,00 mensuales** | Decreto N° 4.653, G.O. N° 6.691 Extraordinario, 15-03-2022; vigente desde el 15-03-2022. Sin cambio a nov. 2026 | V | No |
| 2 | Ingreso mínimo integral indexado (IMI) | **No existe** | **USD 240/mes**, pagados en Bs a tasa BCV (antes USD 190). Es la suma de bonos; no es salario | Anuncio del Ejecutivo, 30-04-2026, vigente desde el 01-05-2026. Sin decreto en Gaceta encontrado. La figura legal existe: Art. 7 de la Ley de Protección de las Pensiones (G.O. 6.806 Ext., 08-05-2024) | A | **Sí: falta el campo** |
| 3 | Cestaticket / bono de alimentación | `cestaticket` = 40 (Bs) — `0162:121` | **USD 40/mes indexado** (anuncio). Último monto en Gaceta: **Bs 1.000** | Ley del Cestaticket Socialista. Monto en Gaceta: G.O. N° 6.746 Ext., 12-05-2023 (Bs 1.000). USD 40 se mantiene en los anuncios de 2024 y del 30-04-2026 | V (Gaceta 2023) / A (USD 40) | **Sí: unidad errada** (40 «Bs» parece querer decir USD 40) |
| 4 | Bono contra la Guerra Económica | `bono_guerra` = 90 (Bs) — `0162:121` | **USD 200/mes** (antes USD 150; USD 90 en mayo de 2024) | Anuncio del 30-04-2026. En Gaceta solo el de 2023 para la administración pública (G.O. 6.746 Ext., Bs 750). Ningún texto lo hace obligatorio para el sector privado | A | **Sí: monto y unidad** |
| 5 | SSO / IVSS, trabajador | `sso_pct` = 4 %, tope `sso_cap_sm` = 5 SM — `0162:44,49` | **4 %**, tope **5 SML** | Ley del Seguro Social | V (fuentes secundarias) | No |
| 6 | SSO / IVSS, patrono | **No existe** | **9 %, 10 % u 11 %** según el riesgo de la empresa | Ley del Seguro Social y su reglamento | N | **Sí: falta el campo** |
| 7 | RPE, trabajador | `rpe_pct` = 0,5 %, tope `rpe_cap_sm` = 10 SM — `0162:45,50` | **0,5 %** | Ley del Régimen Prestacional de Empleo | V (0,5 %) / N (tope 10 SM) | No (confirmar el tope) |
| 8 | RPE, patrono | **No existe** | **2 %** | Ley del Régimen Prestacional de Empleo | N | **Sí: falta el campo** |
| 9 | FAOV, trabajador | `faov_pct` = 1 %, sin tope — `0162:46` | **1 %**, sin tope. Una fuente lo calcula sobre el **salario integral**; el motor usa el sueldo base | Ley del Régimen Prestacional de Vivienda y Hábitat; BANAVIH | V (1 %) / N (base) | Revisar la base con el contador |
| 10 | FAOV, patrono | **No existe** | **2 %** | Ley del Régimen Prestacional de Vivienda y Hábitat; BANAVIH | V | **Sí: falta el campo** |
| 11 | INCES, patrono | **No existe** | **2 %** del salario normal, si hay **5 o más** trabajadores. Trimestral | Ley del INCES (Decreto de 2008, Art. 14 num. 1-2 y 15; Decreto de 2014, Arts. 49-50) | V | **Sí: falta el campo** |
| 12 | INCES, trabajador | **No existe** | **0,5 %** de las utilidades anuales, que retiene el patrono | Ley del INCES, mismos artículos | V | **Sí: falta el campo** |
| 13 | Contribución especial para las pensiones | **No existe** | **9 %** de todo lo pagado a los trabajadores (salario **y** bonos no salariales). Base mínima por trabajador: el IMI. Mensual, ante el SENIAT. Solo personas jurídicas. La paga la empresa, no el trabajador | Ley de Protección de las Pensiones de Seguridad Social, G.O. 6.806 Ext., 08-05-2024, Arts. 6, 7 y 9 (tope legal 15 %). Decreto N° 4.952, G.O. 42.880, 16-05-2024 (fija 9 %). Providencia SNAT/2024/000042, G.O. 42.881, 17-05-2024 (declaración y pago) | V | **Sí: falta el campo** |
| 14 | Recargo de hora extra diurna | `overtime_pct` = 50 % — `0162:53` | **50 %** | LOTTT Art. 118 (G.O. 6.076 Ext., 07-05-2012) | C | No |
| 15 | Bono nocturno | `night_pct` = 30 % — `0162:54` | **30 %** | LOTTT Art. 117 | C | No |
| 16 | Trabajo en día feriado | `holiday_pct` = 50 % — `0162:55` | **50 %** de recargo sobre el salario del día | LOTTT Art. 120 | C | No |
| 17 | Utilidades | `utilidades_days` = 30, mínimo 30 — `0162:58`, `payroll-rules-types.ts:180` | **30 días mínimo, 120 máximo** | LOTTT Art. 131 | C | Agregar el tope de 120 al validador |
| 18 | Vacaciones | `vacaciones_days` = 15 fijos — `0162:60` | **15 días hábiles** + **1 día por año** de servicio, hasta **15 adicionales** | LOTTT Art. 190 | C | **Sí: falta la escala por antigüedad** |
| 19 | Bono vacacional | `bono_vacacional_days` = 15 fijos — `0162:59` | **15 días** + **1 día por año**, hasta **30** en total | LOTTT Art. 192 | C | **Sí: falta la escala por antigüedad** |
| 20 | Prestaciones sociales | `prestaciones_method` = `mejor` — `0179:46` | Garantía trimestral frente a retroactivo; se paga **la mayor** | LOTTT Art. 142 | C | No |
| 21 | Intereses sobre prestaciones | `prestaciones_interest_pct` = 0 — `0179:48` | Tasa que fija el **BCV** (la carga el contador) | LOTTT Art. 143 | C | Cargar la tasa vigente |
| 22 | Reforma de la LOTTT | — | En debate en la Asamblea Nacional desde abril de 2026; **no se encontró aprobación ni Gaceta** | Prensa de abril y mayo de 2026 | N | No, por ahora |

### 2.1 Qué cambia, en limpio

1. **El salario mínimo no cambió**: sigue en Bs 130 desde marzo de 2022.
2. **Lo que subió fue el «ingreso mínimo integral»**: USD 240 desde el 1 de mayo de 2026, pero solo por anuncio y por
   bonos. No hay Gaceta. Los bonos no son salario: no cuentan para vacaciones, utilidades ni prestaciones.
3. **La siembra tiene un problema de unidades**: cestaticket 40 y bono 90 están rotulados en Bs, pero son los montos
   de 2024 en **dólares**. Con Bs 40 el sistema dice que el cestaticket vale centavos de dólar.
4. **Faltan los aportes patronales** (IVSS, RPE, FAOV, INCES) y la **contribución del 9 % para las pensiones**.
   Hoy las reglas solo modelan lo que se le descuenta al trabajador.
5. **Faltan las escalas por antigüedad** de vacaciones y bono vacacional.
6. **Las reglas no tienen fecha de vigencia**: tienen versión, pero no dicen «desde cuándo rige» ni «qué ley lo dice».

### 2.2 Hallazgo en el motor (no es un cambio de la ley)

`lib/studio/nomina/payroll-run-types.ts:327-339` calcula el tope de SSO y RPE como `cap_sm × min_salary` y lo
compara con el sueldo del período, que está en **USD** (`:292`). Pero `min_salary` está en **Bs**
(`0162:77-78`). Con SML = 130 el tope queda en «650» y se aplica como si fueran USD 650. Además, el tope es mensual
y se compara con un período que puede ser quincenal o semanal. El recibo es borrador para el contador
(`:255-256`), pero la deducción sale mal. Es la decisión D6.

## 3. Parte B — Faro con la ley pública

### 3.1 Cómo sabe Faro hoy

- Spec: `docs/specs/0637-faro-asistente-ayuda/spec.md` (PR #600 y #605 de contenido; PR #611 de la migración 0550).
- Su única fuente es el **minicerebro**: archivos `.ts` versionados en `lib/studio/asistente/contenido/`
  (`0637 spec.md:115-134`; `contenido/tipos.ts:1-12`). Lo que no está ahí, Faro no lo sabe.
- El servidor recorta por permisos **antes** de llamar al modelo (`0637 spec.md:146-166`). `nomina` es un módulo
  `reservada` (`contenido/catalogo.ts:100`): quien no tiene acceso no recibe ni la descripción, y preguntar dispara
  una alerta inmediata.
- **Estado real:** en `main` hay contenido (fase 1) y la tabla de registro (0550, aplicada en producción y sellada
  en #627). El **motor** que llama al modelo es la fase 3 de la 0637 y todavía no existe
  (`lib/studio/asistente/` no tiene `motor/`). La Parte B depende de esa fase.
- **Proveedor:** la 0637 propone Anthropic directo (`@anthropic-ai/sdk`) como principal, con un respaldo de un
  proveedor **no chino** o ninguno, y una lista permitida en `motor/config.ts` que impide arrancar con un proveedor
  chino (`0637 spec.md:243-273`, AC-16). La D-1 de la 0637 sigue abierta.

### 3.2 Diseño: un estante «Ley» en el minicerebro

Nuevo estante `lib/studio/asistente/contenido/ley/`, con datos puros como el resto del minicerebro:

```ts
interface FuenteLegal {
  instrumento: string;      // «LOTTT», «Decreto N° 4.952», «Ley de Protección de las Pensiones»
  gaceta: string | null;    // «G.O. N° 42.880»; null si solo hay anuncio
  fecha: string | null;     // AAAA-MM-DD de la publicación
  articulo: string | null;  // «Art. 131»
}

interface EntradaLey {
  id: string;               // «utilidades», «salario-minimo», «contribucion-pensiones»
  tema: string;
  texto: string;            // lo que dice la norma, en lenguaje llano; sin consejo para casos personales
  valor?: { monto: number; unidad: "VES" | "USD" | "pct" | "dias" | "sml" };
  fuente: FuenteLegal;
  vigenteDesde: string;     // AAAA-MM-DD
  vigenteHasta: string | null;
  grado: "oficial" | "anuncio";   // «anuncio» = sin Gaceta encontrada
  procedencia: Procedencia;       // revisado, responsable, fuentes (tipos.ts:30-37)
}
```

Reglas del estante:

1. **Solo información pública.** El estante no importa nada de `@/lib/db`, `@supabase/*` ni consultas de nómina.
   Una prueba de importaciones lo hace cumplir. Faro nunca lee salarios, recibos, finiquitos ni fichas.
2. **Una sola fuente de verdad legal.** El mismo archivo alimenta a Faro y a la columna «según la ley» de la pestaña
   Reglas (Parte A, fase A2). Si la ley cambia, se cambia en un solo lugar y en una PR revisada.
3. **La cita la pone el servidor, no el modelo.** La ficha de respuesta de Faro (`0637 spec.md:174-190`) suma
   `fuentesLey: string[]`, con ids del estante. El verificador descarta ids que no existan, y la tarjeta de la
   respuesta muestra la gaceta, el artículo y la fecha de vigencia **leídos del archivo**. El modelo no puede
   inventar un número de Gaceta. Una respuesta sobre la ley sin `fuentesLey` válidas se reemplaza por «no tengo
   esa norma en mi base».
4. **Anuncio no es ley.** Las entradas `grado: "anuncio"` se muestran como «anunciado por el Ejecutivo el …; no
   encontramos la Gaceta». Caso actual: el IMI de USD 240 y el bono de USD 200.
5. **Lo personal se corta.** «¿Cuánto gano yo?», «¿me pagaron bien?», «¿cuánto me toca de utilidades?» reciben una
   respuesta fija: Faro explica la regla general y remite a Recursos Humanos, porque no ve recibos. No es una
   alerta; es la respuesta correcta.
6. **Aviso fijo** al pie de toda respuesta legal: «Información general de la ley vigente al {fecha}. No es asesoría
   para tu caso.»
7. **Visibilidad (D7):** el estante lo ve **todo usuario del Studio**, tenga o no acceso a `nomina`. Preguntar por
   la ley no cuenta como preguntar por el módulo `reservada` y no dispara su alerta.
8. **Mantenimiento:** cada entrada tiene fecha de revisión. Si una entrada pasa de 90 días sin revisión, una prueba
   avisa en amarillo (no rompe CI). Hermes puede proponer actualizaciones al ver una Gaceta nueva, pero entra por
   PR con aprobación humana (`0637 spec.md:337`).

### 3.3 Proveedor de IA y la regla D-2

El estante no lleva datos de clientes ni de empleados. Aun así:

- Faro usa **el mismo motor** de la 0637, con su lista permitida sin proveedores chinos.
- La pregunta de un empleado puede traer datos personales suyos («gano tanto, ¿está bien?»). Por eso el estante no
  abre ninguna excepción a la regla D-2 de Sam: **los datos de clientes, y aquí también los de empleados, nunca van
  a un proveedor chino.**
- Antes del primer envío real se pasa `revisar-datos-ve` (`0637 spec.md:279`), ahora con preguntas de nómina en el
  inventario.

## 4. Fases

| Fase | Entrega | Depende de | Cómo se comprueba |
|---|---|---|---|
| A1 | Esta spec | — | `docs:check` y `sdd:check` |
| A2 | Estante legal (`lib/studio/nomina/ley/parametros.ts` o el de Faro, según D1), migración **0556**, reglas con fecha de vigencia, aportes patronales y escalas; pestaña Reglas con columna «según la ley» | D1-D5, D10 | Pruebas de tipos y de la migración en PGlite; ensayo de la migración en local |
| A3 | Arreglo del tope en el motor (§2.2) | D6 y criterio del contador | Prueba con quincena y SML en Bs |
| A4 | Carga de los valores en producción, como nueva versión de las reglas | A2 en `main`, D8 y OK nominal de Sam | El contador valida en pantalla; runbook de producción |
| B1 | Estante «Ley» en el minicerebro, con sus pruebas (importaciones, fuentes completas, vigencia) | D1, D7, D8, D9 | Pruebas unitarias; revisión del contador |
| B2 | `fuentesLey` en la ficha, verificador y tarjeta con la cita | Fase 3 de la 0637 (motor) | Pruebas del verificador: id inexistente, sin cita, pregunta personal |

## 5. Migración 0556 (propuesta, fase A2)

`supabase/migrations/0556_nomina_reglas_vigencia_y_aportes.sql`, aditiva, sobre `nomina_payroll_rules`:

- `vigente_desde date not null default current_date`, y `fuente_legal text` (texto corto: «G.O. 6.691 Ext.»).
- `ingreso_minimo_integral_usd numeric(14,2) not null default 0`.
- Unidad explícita: `cestaticket_moneda` y `bono_guerra_moneda text check (in ('VES','USD'))`, con el valor actual
  en `'VES'` para no reinterpretar filas existentes. El contador corrige el monto al crear la nueva versión (D4).
- Aportes patronales: `sso_patronal_pct` (default 9), `rpe_patronal_pct` (2), `faov_patronal_pct` (2),
  `inces_patronal_pct` (2), `inces_utilidades_pct` (0,5), `pension_contrib_pct` (9), con `check` de 0 a 100 y la
  contribución de pensiones con tope legal de 15.
- Escalas: `vacaciones_extra_max` (15) y `bono_vacacional_max_days` (30).
- Validador de `utilidades_days` entre 30 y 120.
- Sin `update` de filas existentes. El histórico ya lo da el versionado (`0162:80-83`): cada cambio legal crea una
  versión nueva con su `vigente_desde`, y los cortes viejos conservan su snapshot (`0175:54`).
- Sin cambios a RLS ni grants: hereda `nomina_can_access()`.

El estante legal no necesita tabla si D1 elige archivos en Git.

## 6. Allowlist

**Esta PR (A1):** `docs/specs/0653-nomina-reglas-ley-y-faro/spec.md`, `docs/specs/README.md` (índice
regenerado), `.agents/handoffs/0653-nomina-reglas-ley-y-faro.md`.

**A2:** `supabase/migrations/0556_nomina_reglas_vigencia_y_aportes.sql`;
`lib/studio/nomina/__tests__/nomina-0556.migration.test.ts`; `lib/studio/nomina/ley/parametros.ts` y su prueba;
`lib/studio/nomina/payroll-rules-types.ts`, `payroll-rules-types.test.ts`, `payroll-rules-queries.ts`;
`app/studio/(app)/nomina/actions.ts`, `_components/ReglasDrawer.tsx`, `_components/NominaClient.tsx`; la guía de
Faro de nómina y su novedad si la pantalla cambia (D-10 de la 0637).

**A3:** `lib/studio/nomina/payroll-run-types.ts` y `payroll-run-types.test.ts`.

**B1:** `lib/studio/asistente/contenido/ley/*.ts`, `lib/studio/asistente/contenido/tipos.ts`,
`lib/studio/asistente/contenido/__tests__/ley.test.ts`.

**B2:** los archivos de verificador y ficha que cree la fase 3 de la 0637; se fijan cuando esa fase exista.

## 7. Decisiones para Sam

| D | Pregunta | Opciones | Recomendada |
|---|---|---|---|
| D1 | ¿Dónde vive la ley? | (a) Archivo en Git, revisado por PR, que leen Faro y la pestaña Reglas. (b) Tabla en la base, editable desde el Studio | **(a)**: la ley es pública y la misma para todos; su historia queda en Git; Faro ya trabaja así; no hace falta migración para la ley |
| D2 | ¿Cómo se actualizan las reglas? | (a) Nueva versión con `vigente_desde` y fuente, conservando las anteriores. (b) Editar la fila vigente | **(a)**: el versionado ya existe; los cortes viejos no cambian |
| D3 | Bono de guerra y cestaticket sin Gaceta para el sector privado | (a) Guardarlos como «referencia anunciada», y que el contador decida lo que DTD paga. (b) Tratarlos como obligación legal | **(a)**: es lo que dicen los textos encontrados; Faro lo explica así |
| D4 | Unidad de los montos | (a) Moneda explícita por monto: SML en Bs; IMI, cestaticket y bono en USD indexados a BCV. (b) Todo en Bs | **(a)**: concuerda con «todo en dólares, Bs como vista» y con cómo se fijan hoy los bonos |
| D5 | ¿Agregar aportes patronales y el 9 % de pensiones? | (a) Sí, como config para el costo de la nómina; no se descuentan al trabajador. (b) No por ahora | **(a)**: hoy el costo real de un empleado no aparece en ninguna parte |
| D6 | Tope de SSO/RPE en el motor (§2.2) | (a) Convertir el tope a USD con la tasa BCV del día del corte y prorratearlo al período. (b) Dejarlo hasta que el contador defina | **(a)**, con el visto bueno del contador sobre la tasa |
| D7 | ¿Quién ve el estante «Ley» en Faro? | (a) Todo usuario del Studio. (b) Solo quien tiene acceso a nómina | **(a)**: el objetivo es la transparencia hacia todos los empleados; el estante no tiene datos internos |
| D8 | ¿Quién aprueba los textos y valores legales? | (a) El contador (o un abogado laboral) y Sam, por PR. (b) Solo Sam | **(a)**: hay valores marcados N y C que necesitan ojo profesional |
| D9 | Aviso de las respuestas legales | (a) «Información general de la ley vigente al {fecha}. No es asesoría para tu caso.» (b) Otro texto | **(a)** |
| D10 | Escala de vacaciones y bono vacacional por antigüedad | (a) Agregarla en A2 (Arts. 190 y 192). (b) Dejar los 15 días fijos | **(a)**: los 15 fijos subpagan desde el segundo año |

## 8. Fuera de alcance

- Que Faro lea datos de un empleado (su recibo, su salario, sus vacaciones). Es otra frontera y otra spec.
- Calcular la contribución de pensiones o los aportes patronales en un reporte para el SENIAT. A2 solo guarda los
  porcentajes.
- Facturación fiscal y libros legales de nómina.

## 9. Fuentes consultadas (2026-11-16)

Oficiales o que reproducen la Gaceta:

- G.O. N° 6.691 Ext., 15-03-2022, Decreto N° 4.653 (SML Bs 130): reproducción en
  `radiofeyalegrianoticias.com/wp-content/uploads/2022/03/GOE-6.691.pdf`; nota en `eldiario.com/2022/03/16`.
- G.O. N° 6.746 Ext., 12-05-2023 (cestaticket Bs 1.000; bono para la administración pública):
  `eldiario.com/2023/05/13/oficializaron-en-gaceta-oficial-el-aumento-del-cestaticket-y-del-bono-de-guerra-economica/`.
- G.O. N° 6.806 Ext., 08-05-2024, Ley de Protección de las Pensiones (Arts. 6-9):
  `accesoalajusticia.org/ley-de-proteccion-de-las-pensiones-de-seguridad-social/`.
- G.O. N° 42.880, 16-05-2024, Decreto N° 4.952 (9 %): copia en
  `traviesoevans.com/travieso/wp-content/uploads/gacetas/2024/05-mayo/2024-05-16-42880.pdf`.
- G.O. N° 42.881, 17-05-2024, Providencia SNAT/2024/000042: `finanzasdigital.com/gaceta-oficial-42881-seniat/`.
- Ley del INCES, aportes del 2 % y 0,5 %: `accesoalajusticia.org/contribucion-parafiscalinces/`.

Prensa sobre anuncios sin Gaceta:

- IMI USD 240, bono USD 200, alimentación USD 40, anuncio del 30-04-2026:
  `eldiario.com/2026/04/30/gobierno-aumento-salario-minimo/`, `eldiario.com/2026/05/01/aumento-ingreso-minimo-integral-claves/`
  (dice que el ajuste aún no estaba en Gaceta), `finanzasdigital.com/pago-retroactivo-bono-incremento-integral-2026-ajuste-salarial/`,
  `infobae.com/venezuela/2026/05/05/...` (el aumento va en bonos).
- IMI USD 130 de mayo de 2024, sin norma publicada:
  `accesoalajusticia.org/mas-4-meses-despues-1-de-mayo-persiste-inseguridad-juridica-politica-salarial-venezolana/`.
- Reforma de la LOTTT en debate: `eldiario.com/2026/04/20/diputados-an-pidieron-reforma-laboral-frenar-devaluacion-salario/`.

No confirmado en esta corrida: el aporte patronal al IVSS (9-11 %), el aporte patronal al RPE (2 %), el tope de
10 SML del RPE, la base del FAOV y el texto literal de los artículos de la LOTTT marcados C. No se encontró nada
publicado entre junio y noviembre de 2026 que cambie la tabla.
