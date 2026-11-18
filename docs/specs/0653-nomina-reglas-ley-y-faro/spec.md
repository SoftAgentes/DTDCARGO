---
sdd: "0653"
title: "Nómina: reglas al día con la ley a noviembre de 2026 y un estante de ley pública para Faro"
status: in-progress
author: "Claude (Worker 0653) + Sam"
created: 2026-11-16
updated: 2026-11-17
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

**Estado:** `in-progress`. La fase A2a se fusionó con la PR #631; las decisiones quedaron aprobadas por Sam el
2026-11-17 (§7). La fase A3 (tope del motor, D6) la pidió Sam el mismo día: «Sí, arráncala», a la pregunta de si
arrancaba la corrección. Sin migración y sin cambios en producción. A2b, A4, B1 y B2 no empiezan hasta que el Director
General las asigne.

**Instrucción de Sam (2026-11-16, tras leer la primera versión):** implementar estas cosas en las reglas; lo que no
esté verificado se implementa igual y lleva una nota simple en el sistema («no está verificado, consultar con un
abogado»); la versión muestra su fecha de actualización; lo no verificado va con un asterisco que abre algo
llamativo; y volver a comprobar las dudas contra las Gacetas mismas. Esta PR entrega eso sin tocar la base de
datos (§4, fase A2a, y §2.2). Lo que necesita migración o cambia cálculos ya tiene sus decisiones (§7) y espera la asignación del DG.

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

## 2. Parte A — reglas frente a la ley (corte: 2026-11-17)

Grado de verificación:

- **V** = el texto se leyó en la Gaceta Oficial: en el PDF de la Imprenta Nacional, o en un facsímil de esa misma
  Gaceta cuando el sitio oficial la tiene solo escaneada. Lleva número y fecha de Gaceta y fecha de vigencia. En el
  sistema: `verificado`.
- **A** = anunciado por el Ejecutivo; **no** se encontró decreto en Gaceta Oficial. En el sistema: `anuncio`.
- **O** = página de un organismo oficial que da el valor sin citar ley, artículo ni fecha.
- **R** = reproducción del texto, sentencia que lo transcribe o fuente secundaria.
- **N** = no se pudo confirmar.

**O**, **R** y **N** son `por-confirmar` en el sistema: llevan asterisco y la nota de consultar a un abogado. Un
medio que cita una Gaceta no cuenta como V, y tampoco una Gaceta que no está en el sitio oficial.

| # | Regla | Valor en el sistema (Git) | Valor según la ley | Fuente y vigencia | Grado | ¿Cambia? |
|---|---|---|---|---|---|---|
| 1 | Salario mínimo (SML) | `min_salary` = 130 (Bs) — `0162:121` | **Bs 130,00 mensuales** | Decreto N° 4.653, G.O. N° 6.691 Extraordinario, 15-03-2022; vigente desde el 15-03-2022. Sin cambio a nov. 2026 | V | No |
| 2 | Ingreso mínimo integral indexado (IMI) | **No existe** | **USD 240/mes**, pagados en Bs a tasa BCV (antes USD 190). Es la suma de bonos; no es salario. El aumento es del sector público; a la empresa privada solo se le exhortó | Anuncio del Ejecutivo, 30-04-2026, vigente desde el 01-05-2026. Sin decreto en Gaceta encontrado. La figura legal existe: Art. 7 de la Ley de Protección de las Pensiones (G.O. 6.806 Ext., 08-05-2024) | A | **Sí: falta el campo** |
| 3 | Cestaticket / bono de alimentación | `cestaticket` = 40 (Bs) — `0162:121` | **USD 40/mes indexado** (anuncio). Último monto en Gaceta: **Bs 1.000** | El beneficio es de la Ley del Cestaticket Socialista, que alcanza al sector privado (su Gaceta no se leyó). El monto de USD 40 viene de los anuncios de 2024 y del 30-04-2026; no se sabe desde cuándo rige. Último monto en Gaceta: Bs 1.000 (G.O. N° 6.746 Ext., 12-05-2023, que no está en el sitio oficial) | A (USD 40) / R (Bs 1.000) | **Sí: unidad errada** (40 «Bs» parece querer decir USD 40) |
| 4 | Bono contra la Guerra Económica | `bono_guerra` = 90 (Bs) — `0162:121` | **USD 200/mes** (antes USD 150; USD 90 en mayo de 2024) | Anuncio del 30-04-2026. En Gaceta solo el de 2023 para la administración pública (G.O. 6.746 Ext., Bs 750). Ningún texto lo hace obligatorio para el sector privado | A | **Sí: monto y unidad** |
| 5 | SSO / IVSS, trabajador | `sso_pct` = 4 %, tope `sso_cap_sm` = 5 SM — `0162:44,49` | **4 %**, tope **5 SML** | Página oficial del IVSS (no cita ley, artículo ni fecha) | O | No |
| 6 | SSO / IVSS, patrono | **No existe** | **9 %, 10 % u 11 %** según el riesgo de la empresa | Página oficial del IVSS: 9 % riesgo mínimo, 10 % medio, 11 % máximo | O | **Sí: falta el campo** |
| 7 | RPE, trabajador | `rpe_pct` = 0,5 %, tope `rpe_cap_sm` = 10 SM — `0162:45,50` | **0,5 %**, tope **10 SML** | Ley del Régimen Prestacional de Empleo, Art. 46 (G.O. 38.281, 27-09-2005): 2,50 % en total, 20 % el trabajador | R | No |
| 8 | RPE, patrono | **No existe** | **2 %** | Mismo Art. 46: 80 % del 2,50 % lo paga el empleador | R | **Sí: falta el campo** |
| 9 | FAOV, trabajador | `faov_pct` = 1 %, sin tope — `0162:46` | **1 %**, sin tope. Una fuente lo calcula sobre el **salario integral**; el motor usa el sueldo base | Ley del Régimen Prestacional de Vivienda y Hábitat; BANAVIH | R (1 %) / N (base) | Revisar la base con el contador |
| 10 | FAOV, patrono | **No existe** | **2 %** | Ley del Régimen Prestacional de Vivienda y Hábitat; BANAVIH | R | **Sí: falta el campo** |
| 11 | INCES, patrono | **No existe** | **2 %** del salario normal, si hay **5 o más** trabajadores. Trimestral | Ley del INCES (Decreto de 2008, Art. 14 num. 1-2 y 15; Decreto de 2014, Arts. 49-50), según una sentencia del TSJ que los transcribe | R | **Sí: falta el campo** |
| 12 | INCES, trabajador | **No existe** | **0,5 %** de las utilidades anuales, que retiene el patrono | Ley del INCES, mismos artículos. Es una **retención al trabajador**: en el formulario va con las deducciones del empleado, no con los aportes del patrono | R | **Sí: falta el campo** |
| 13 | Contribución especial para las pensiones | **No existe** | **9 %** de todo lo pagado a los trabajadores (salario **y** bonos no salariales). Base mínima por trabajador: el IMI. Mensual, ante el SENIAT. Solo personas jurídicas. La paga la empresa, no el trabajador | Ley de Protección de las Pensiones de Seguridad Social, G.O. 6.806 Ext., 08-05-2024, Arts. 6, 7 y 9 (tope legal 15 %). Decreto N° 4.952, G.O. 42.880, 16-05-2024 (fija 9 %). Providencia SNAT/2024/000042, G.O. 42.881, 17-05-2024 (declaración y pago) | V | **Sí: falta el campo** |
| 14 | Recargo de hora extra diurna | `overtime_pct` = 50 % — `0162:53` | **50 %** | LOTTT Art. 118 (G.O. 6.076 Ext., 07-05-2012) | V | No |
| 15 | Bono nocturno | `night_pct` = 30 % — `0162:54` | **30 %** | LOTTT Art. 117 | V | No |
| 16 | Trabajo en día feriado | `holiday_pct` = 50 % — `0162:55` | **50 %** de recargo sobre el salario del día | LOTTT Art. 120 | V | No |
| 17 | Utilidades | `utilidades_days` = 30, mínimo 30 — `0162:58`, `payroll-rules-types.ts:180` | **30 días mínimo, 120 máximo** | LOTTT Art. 131 | V | Agregar el tope de 120 al validador |
| 18 | Vacaciones | `vacaciones_days` = 15 fijos — `0162:60` | **15 días hábiles** + **1 día por año** de servicio, hasta **15 adicionales** | LOTTT Art. 190 | V | **Sí: falta la escala por antigüedad** |
| 19 | Bono vacacional | `bono_vacacional_days` = 15 fijos — `0162:59` | **15 días** + **1 día por año**, hasta **30** en total | LOTTT Art. 192 | V | **Sí: falta la escala por antigüedad** |
| 20 | Prestaciones sociales | `prestaciones_method` = `mejor` — `0179:46` | Garantía trimestral frente a retroactivo; se paga **la mayor** | LOTTT Art. 142 | R | No |
| 21 | Intereses sobre prestaciones | `prestaciones_interest_pct` = 0 — `0179:48` | Tasa que fija el **BCV** (la carga el contador) | LOTTT Art. 143 | R | Cargar la tasa vigente |
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

### 2.2 Comprobación contra las Gacetas mismas (2026-11-17)

Sam pidió comprobar con las Gacetas y no solo con internet, y saber si publicaron algo nuevo.

**Dónde se miró.** El sitio de la Imprenta Nacional, `gacetaoficial.gob.ve`: calendario por año, búsqueda por
número y fecha, sumario de cada Gaceta y su PDF. La búsqueda por texto del sitio **no funciona**: una búsqueda de
control («salario mínimo», marzo de 2022) devuelve cero aunque la Gaceta 6.691 está ahí. Por eso se recorrieron
los sumarios uno por uno.

**Leído en la Gaceta:**

| Norma | Gaceta en el sitio oficial | Qué se leyó |
|---|---|---|
| Salario mínimo | N° 6.691 Ext., 15-03-2022 | Decreto N° 4.653, Art. 1: Bs 130,00 mensuales, sectores público y privado, desde el 15-03-2022. El sumario trae también el Decreto N° 4.654 del cestaticket |
| Ley de Protección de las Pensiones | N° 6.806 Ext., 08-05-2024 | Art. 6 (personas jurídicas privadas), Art. 7 (hasta 15 % de salario y bonos; base nunca menor al ingreso mínimo integral indexado), Art. 9 (mensual, SENIAT) |
| Alícuota de pensiones | N° 42.880, 16-05-2024 | Decreto N° 4.952, Art. 1: 9 %. Art. 2: exonera a los emprendimientos registrados |
| LOTTT | N° 6.076 Ext., 07-05-2012 (en el sitio es un escaneo sin texto) | Arts. 117, 118, 120, 131, 190 y 192, leídos en el facsímil de esa Gaceta que guarda FAOLEX (FAO) |

**¿Publicaron algo nuevo en 2026?** Se leyeron los sumarios de las **273 Gacetas de 2026** que tiene el sitio (del
2 de enero al 2 de noviembre; 204 ordinarias y 69 extraordinarias; 4 ordinarias fallaron al cargar y no se
reintentaron; las 69 extraordinarias se releyeron completas). **Ninguna trae un decreto de salario mínimo, ingreso mínimo integral, cestaticket, bono de guerra,
pensiones, seguro social ni reforma de la LOTTT.** Lo único laboral es una convocatoria del Ministerio del Trabajo
(G.O. 43.325, 27-02-2026, Art. 500 de la LOTTT).

**Límite que hay que decir.** El sitio oficial **no tiene todas las Gacetas**: en la numeración de las
Extraordinarias de 2026 (6.954 a 7.090) faltan **68**. Entre ellas, las N° 7.021 a 7.024, que caen entre el
16 de abril y el 22 de mayo, justo las fechas del anuncio de los USD 240, y las N° 7.026 a 7.032. Esas direcciones
responden «no existe». Tampoco está la N° 6.746 Ext. de 2023 (cestaticket Bs 1.000), ni nada posterior al
2 de noviembre. Entonces: **no hay decreto publicado a la vista, pero no se puede afirmar que no exista**. Coincide
con lo que dijeron Acceso a la Justicia (18-05-2026) y un abogado laboral citado por Finanzas Digital (08-05-2026):
el decreto no había salido en Gaceta.

**¿Vienen cambios?** No se encontró ningún anuncio oficial nuevo. El 06-11-2026 El Diario desmintió un video que
atribuía a la presidenta encargada un salario mínimo de USD 500 desde diciembre. El ministro del Trabajo dijo en
mayo que se evalúa una reforma de la LOTTT; no hay proyecto aprobado ni Gaceta.

**Sigue sin comprobar:** el FAOV (no se pudo abrir el sitio de BANAVIH: su certificado no es válido; la tasa de
1 % y 2 % y la base vienen de fuentes secundarias), el texto del INCES en su Gaceta (se conoce por una sentencia
del TSJ que lo transcribe) la Gaceta de 2005 del RPE (no está en el sitio; se leyó una reproducción) y la norma detrás de las tasas del
IVSS (su página las da sin citar ley, artículo ni fecha). En el sistema todo eso queda «por confirmar».

### 2.3 Hallazgo en el motor (no es un cambio de la ley) — corregido en la fase A3

`calcReciboDraft` (`lib/studio/nomina/payroll-run-types.ts`) calculaba el tope de SSO y RPE como `cap_sm × min_salary` y lo
comparaba con el sueldo del período, que está en **USD**. Pero `min_salary` está en **Bs** (migración 0162, «Montos
base (Bs)»). Con SML = 130 el tope quedaba en «650» y se aplicaba como si fueran USD 650. Además, el tope es mensual y
se comparaba con un período que puede ser quincenal o semanal. El recibo es borrador para el contador, pero la
deducción salía mal: con topes en Bs contra sueldos en USD, el tope casi nunca actuaba y el borrador descontaba de más
al empleado respecto del tope legal. Era la decisión D6.

**Corrección (fase A3, D6 opción a):**

- El tope mensual en Bs pasa a USD con la tasa BCV del último día del período del corte (`fx_rate_on`, SDD-0569)
  y se prorratea al período con los mismos días que el sueldo (días / 30).
- **La tasa no puede ser vieja.** `fx_rate_on` devuelve la última tasa anterior sin límite de antigüedad, así que la fecha de valor
  debe ser el último día del período o, a lo sumo, 4 días naturales antes (fines de semana y feriados). Más vieja, el
  corte falla y dice qué fecha cargar.
- **Período en curso = tasa provisional.** Si el corte se genera antes de que termine el período, no existe la tasa del
  cierre: el borrador calcula con la vigente hoy (misma tolerancia), el renglón dice «tasa PROVISIONAL» con su fecha y
  **no se congela**. Al regenerar con el período cerrado se congela la del cierre. **Confirmar exige la tasa del cierre
  congelada**: un corte provisional no se confirma.
- La tasa definitiva, su fuente y su fecha de valor se congelan en el `rules_snapshot` del corte (`cap_fx_rate`,
  `cap_fx_source`, `cap_fx_valid_on`): regenerar un borrador no cambia la cifra. Sin migración (es jsonb).
- Sin tasa y con topes activos el corte **no se calcula**: el error dice qué cargar en Admin › Tasas. El motor lanza
  `FaltaTasaParaTopeError` antes de calcular Bs contra USD en silencio. Con topes desactivados (cap 0 o salario mínimo 0)
  no hace falta tasa.
- El renglón del recibo muestra la cuenta, la tasa y su fecha: «tope 5 SM = Bs 650 ≈ USD 50/mes a Bs 13/USD, tasa BCV del 2026-11-30».
- Los cortes anteriores a la A3 no traen la tasa congelada: al regenerarlos se usa la del último día del período, con la
  misma tolerancia, y para confirmarlos hay que regenerarlos. Un corte ya confirmado o pagado no se regenera (solo
  borradores), así que no cambia.
- **Falta el visto bueno del contador** sobre la tasa de conversión (D6): la tasa del último día del período es la que
  decidió Sam; el contador confirma si es la que corresponde. Hasta entonces el recibo sigue siendo borrador.

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
  vigenteDesde: string | null;   // AAAA-MM-DD; null = no se pudo establecer, y Faro lo dice
  vigenteHasta: string | null;
  grado: "verificado" | "anuncio" | "por-confirmar";  // los mismos tres de §2
  alcance: "obliga" | "referencia";   // si la norma obliga a una empresa privada
  comprobadoEn: string;               // dónde se leyó: Gaceta oficial, organismo, reproducción
  procedencia: Procedencia;           // revisado, responsable, fuentes (tipos.ts:30-37)
}
```

Es la forma que ya tiene `lib/studio/nomina/ley/parametros.ts` (fase A2a). B1 la reutiliza; no crea otra tabla
de leyes.

Reglas del estante:

1. **Solo información pública.** El estante no importa nada de `@/lib/db`, `@supabase/*` ni consultas de nómina.
   Una prueba de importaciones lo hace cumplir. Faro nunca lee salarios, recibos, finiquitos ni fichas.
   `parametros.ts` importa un solo símbolo de `payroll-rules-types`, y lo hace con `import type`: se borra al
   compilar y no ejecuta ese módulo. La prueba de B1 permite únicamente importaciones de tipo; cualquier otra falla.
2. **Una sola fuente de verdad legal.** El mismo archivo alimenta a Faro y a la columna «según la ley» de la pestaña
   Reglas (Parte A, fase A2). Si la ley cambia, se cambia en un solo lugar y en una PR revisada.
3. **La cita la pone el servidor, no el modelo.** La ficha de respuesta de Faro (`0637 spec.md:174-190`) suma
   `fuentesLey: string[]`, con ids del estante. El verificador descarta ids que no existan, y la tarjeta de la
   respuesta muestra la gaceta, el artículo y la fecha de vigencia **leídos del archivo**. El modelo no puede
   inventar un número de Gaceta. Una respuesta sobre la ley sin `fuentesLey` válidas se reemplaza por «no tengo
   esa norma en mi base».
4. **Anuncio no es ley, y «por confirmar» se dice.** Las entradas `grado: "anuncio"` se muestran como «anunciado
   por el Ejecutivo el …; no encontramos la Gaceta». Caso actual: el IMI de USD 240, el bono de USD 200 y el monto
   de USD 40 del cestaticket. Las `por-confirmar` llevan la nota de consultar a un abogado. Si `alcance` es
   `referencia`, Faro dice que no consta que obligue a la empresa privada.
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

### 3.3 Proveedor de IA y la regla SDD-0639 D-2

El estante no lleva datos de clientes ni de empleados. Aun así:

- Faro usa **el mismo motor** de la 0637, con su lista permitida sin proveedores chinos.
- La pregunta de un empleado puede traer datos personales suyos («gano tanto, ¿está bien?»). Por eso el estante no
  abre ninguna excepción a la regla **SDD-0639 D-2** de Sam: **los datos de clientes, y aquí también los de
  empleados, nunca van a un proveedor chino.**
- **Prohibido OpenRouter y cualquier agregador o intermediario de modelos.** Un agregador decide por su cuenta a
  qué proveedor manda cada llamada, así que no se puede garantizar la regla anterior. Las consultas de ley van por
  la llamada directa al proveedor de la lista permitida, o no van.
- Antes del primer envío real se pasa `revisar-datos-ve` (`0637 spec.md:279`), ahora con preguntas de nómina en el
  inventario.

## 4. Fases

| Fase | Entrega | Depende de | Cómo se comprueba |
|---|---|---|---|
| A1 | Esta spec | — | `docs:check` y `sdd:check` |
| A2a | **Hecho en esta PR, sin migración.** Estante legal `lib/studio/nomina/ley/parametros.ts` con grado y fuente por norma; pestaña Reglas rediseñada: versión y fecha de actualización, barra «obligaciones al día» (no cuenta anuncios ni referencias), columnas «tus reglas» y «ley», asterisco en lo no verificado que abre la ficha legal con la fuente y la nota de consultar a un abogado; pistas «según la ley» en el formulario | Instrucción de Sam | Pruebas del módulo y de contratos del Studio, typecheck y lint |
| A2b | **Hecho en la rama `claude/0653-a2b-vigencia` (PR #660), migración 0556 EN ESPERA.** Lo de A2 que sí necesita base de datos: estante legal (`lib/studio/nomina/ley/parametros.ts` o el de Faro, según D1), migración **0556**, reglas con fecha de vigencia, aportes patronales y escalas; pestaña Reglas con columna «según la ley» | D1-D5, D10 | Pruebas de tipos y de la migración en PGlite; ensayo de la migración en local |
| A3 | **Hecho en la rama `claude/0653-a3-tope-motor`, sin migración.** Arreglo del tope en el motor (§2.3): tope en Bs a USD con la tasa del corte, prorrateado al período, tasa congelada en el snapshot, falla cerrado sin tasa | D6; el contador valida la tasa | Pruebas con mes, quincena, semana, tasa distinta, sin tasa y sin topes |
| A4 | Carga de los valores en producción, como nueva versión de las reglas | A2 en `main`, D8 y OK nominal de Sam | El contador valida en pantalla; runbook de producción |
| B1 | Estante «Ley» en el minicerebro, con sus pruebas (importaciones, fuentes completas, vigencia) | D1, D7, D8, D9 | Pruebas unitarias; revisión del contador |
| B2 | `fuentesLey` en la ficha, verificador y tarjeta con la cita | Fase 3 de la 0637 (motor) | Pruebas del verificador: id inexistente, sin cita, pregunta personal |

## 5. Migración 0556 (fase A2b)

Migración **0556** en `supabase/migrations/`, con el nombre `nomina_reglas_vigencia_y_aportes`. **Existe en la rama de la fase A2b y está EN ESPERA:** no se aplicó a ningún entorno; se declara en el baseline como pendiente y aplicarla pide el OK nominal de Sam y el runbook de producción. Es aditiva, sobre `nomina_payroll_rules`:

- `vigente_desde date` **nullable** y `fuente_legal text` (texto corto: «G.O. 6.691 Ext.», hasta 200 caracteres). Las filas nuevas toman por
  omisión **hoy en Caracas** (`(now() at time zone 'America/Caracas')::date`), no la fecha del servidor en UTC; las versiones anteriores
  quedan en NULL = «sin fecha de vigencia registrada», y la pantalla lo dice así (NOT NULL obligaba a inventar una fecha). Por D11 la fecha
  es **informativa**: el corte usa siempre la versión vigente; el validador y la función rechazan una fecha posterior a hoy en Caracas.
- `ingreso_minimo_integral_usd numeric(14,2)` **nullable, sin default**: es un anuncio (D3b), no una obligación, y «sin configurar» no es cero.
- Unidad explícita: `cestaticket_moneda` y `bono_guerra_moneda` `text not null default 'VES' check (in ('VES','USD'))`: las filas
  existentes quedan en bolívares para no reinterpretar sus montos, y quien edita una versión en VES la conserva en VES. El contador corrige
  el monto al crear la nueva versión (D4).
- Aportes patronales: `sso_patronal_pct`, `rpe_patronal_pct`, `faov_patronal_pct`, `inces_patronal_pct`, `pension_contrib_pct`
  (`numeric(5,2)` **nullable, sin default**, con CHECK de 0 a 100 y la contribución de pensiones con tope de 15, Art. 7). Una columna sin
  configurar no se lee nunca como cero: la comparación con la ley dice «falta». Los valores de la norma conocida (9, 2, 2, 2 y 9) los
  propone el **formulario solo como placeholder** (los campos nacen vacíos y la propuesta no viaja al guardar), por confirmar con el contador; un botón explícito «Usar la propuesta» la copia a los campos vacíos del grupo. No son un default de la base.
- `inces_utilidades_pct` (0,5 % de las utilidades) es una **retención al trabajador**: misma forma que los aportes, pero el formulario la
  agrupa con las deducciones del empleado.
- Escalas: `vacaciones_extra_max` y `bono_vacacional_max_days` (`integer` nullable, sin default, de 0 a 365); propuestas 15 y 30.
- Validador de `utilidades_days` entre 30 y 120 (CHECK, y el preflight aborta si una versión ya está fuera, contando filas sin leerlas).
- **Guardado atómico:** la función `public.nomina_guardar_reglas(p_datos jsonb) returns uuid` (SECURITY INVOKER, `search_path = ''`,
  EXECUTE solo para `authenticated`) archiva la versión vigente y crea la siguiente **en una sola transacción**, con la RLS de quien llama:
  el tenant sale de la sesión, bloquea la fila vigente, y si el insert falla (un CHECK, un desborde, una fecha futura) el archivado se
  deshace y la versión vigente queda intacta. Reemplaza los dos pasos de la app, que podían dejar un tenant sin versión vigente.
  Comprueba además, de forma explícita, que haya tenant y acceso a nómina (no depende solo de la RLS), y exige `vigente_desde` como
  AAAA-MM-DD, desde 2000-01-01 y no posterior a hoy en Caracas (rechaza `epoch`, `-infinity`, `today` y otros formatos que el cast aceptaría).
  Si la lectura vio las columnas pero la función no existe (desarme parcial o caché de esquema vieja), la app **no degrada**: dice «La base
  se está actualizando; recarga e inténtalo de nuevo» y no guarda nada. Dos guardados simultáneos dicen «Otra persona guardó al mismo
  tiempo; recarga».
- **Idempotente** (ADD COLUMN IF NOT EXISTS, `create or replace function` y restricciones con guarda), con postflight que comprueba la forma
  de cada columna, los 8 CHECK, la función (invoker, search_path y grants), y que la RLS y los grants de la tabla quedaron intactos. Con
  desarme en `supabase/desarmes/` (sin número; borra la función y pierde lo guardado en las columnas nuevas).
- **Degradación:** sin la 0556 la pestaña Reglas lee y guarda solo las columnas de la 0162 (como en la fase A2a) y el formulario deshabilita
  los campos nuevos con un aviso (`payroll-rules-queries.ts`: la lectura reintenta sin ellas; la escritura usa los dos pasos de siempre y,
  si el insert falla, **restaura** la versión archivada; es de mejor esfuerzo: un corte del proceso entre archivar e insertar la deja sin hacer). La degradación está declarada en
  `supabase/pending-migration-symbol-declarations.json`. Las columnas de la 0179 (método de prestaciones, interés, Art. 78) no las lee ni las
  guarda esta pantalla, ni antes ni ahora: es un hallazgo fuera de alcance, anotado en el handoff.
- Sin `update` de filas existentes. El histórico ya lo da el versionado (`0162:80-83`): cada cambio legal crea una
  versión nueva con su `vigente_desde`, y los cortes viejos conservan su snapshot (`0175:54`).
- Sin cambios a RLS ni grants de la tabla: hereda `nomina_can_access()`.

El estante legal no necesita tabla si D1 elige archivos en Git.

## 6. Allowlist

**Esta PR (A1 y A2a):** `docs/specs/0653-nomina-reglas-ley-y-faro/spec.md`, `docs/specs/README.md` (índice
regenerado), `.agents/handoffs/0653-nomina-reglas-ley-y-faro.md`, `lib/studio/nomina/ley/parametros.ts` y
`parametros.test.ts`, `app/studio/(app)/nomina/_components/ReglasTab.tsx` (nuevo),
`_components/PistaLey.tsx` (nuevo), `_components/__tests__/ReglasTab.test.tsx` y `PistaLey.test.tsx` (nuevos),
`_components/NominaClient.tsx` (la pestaña sale a su archivo) y `_components/ReglasDrawer.tsx` (usa la pista).

**A2b:** la migración 0556 (`nomina_reglas_vigencia_y_aportes`, por crear en `supabase/migrations/`);
`lib/studio/nomina/__tests__/nomina-0556.migration.test.ts`; `lib/studio/nomina/ley/parametros.ts` y su prueba;
`lib/studio/nomina/payroll-rules-types.ts`, `payroll-rules-types.test.ts`, `payroll-rules-queries.ts`;
`app/studio/(app)/nomina/actions.ts`, `_components/ReglasDrawer.tsx`, `_components/NominaClient.tsx`; la guía de
Faro de nómina y su novedad si la pantalla cambia (D-10 de la 0637).

**A2b (ampliada):** además de lo de arriba, `lib/studio/nomina/payroll-rules-queries.test.ts` (nuevo), `app/studio/(app)/nomina/page.tsx`,
`_components/ReglasTab.tsx` y su prueba, `supabase/tests/` (el contrato de la 0556), `supabase/desarmes/` (el desarme), `supabase/migrations-baseline.json`
(la espera) y `supabase/pending-migration-symbol-declarations.json` (la degradación). La guía y la novedad de Faro de nómina **no**
entran: `nomina` sigue reservada en el minicerebro y `novedades/` no existe en `main` (D-10 de la 0637 queda para cuando exista).

**A3:** `lib/studio/nomina/payroll-run-types.ts` y `payroll-run-types.test.ts`; `lib/studio/nomina/tope-fx.ts` y `tope-fx.test.ts`
(nuevos: la tasa de los topes y lo que se congela); `app/studio/(app)/nomina/actions.ts` (solo el corte: resolver la tasa
antes de crearlo y al regenerarlo).

**B1:** `lib/studio/asistente/contenido/ley/*.ts`, `lib/studio/asistente/contenido/tipos.ts`,
`lib/studio/asistente/contenido/__tests__/ley.test.ts`.

**B2:** los archivos de verificador y ficha que cree la fase 3 de la 0637; se fijan cuando esa fase exista.

## 7. Decisiones para Sam

**Aprobadas por Sam el 2026-11-17.** En el chat del Director General, a la pregunta «¿Apruebas las decisiones
recomendadas de nómina (#631) y de la Vista simple (#633)?», Sam respondió, literal: **«Sí, ambas»**. La cita la
transmitió el DG a esta sesión, que no presenció ese chat.

Quedan decididas, con la opción recomendada de la tabla: **D1, D2, D3a, D3b, D4, D5, D6, D7, D8, D9 y D10**. En las
once la recomendada es la opción (a).

Lo que esta aprobación **no** es:

- No autoriza cargar valores en producción ni aplicar la migración 0556: eso sigue pidiendo el OK nominal de Sam y el
  runbook de producción (fase A4).
- No da por verificado lo que el sistema marca «por confirmar» o «solo anuncio». Según D3a y D8, el monto del
  cestaticket y los textos legales los confirma el contador o un abogado laboral antes de usarse.
- No arranca fases: A2b, A3, B1 y B2 esperan la asignación del DG.
- **D11 sigue abierta** (ver la tabla): la decisión de Sam sobre si «Rige desde» elige la versión de un corte está pendiente.

| D | Pregunta | Opciones | Recomendada |
|---|---|---|---|
| D1 | ¿Dónde vive la ley? | (a) Archivo en Git, revisado por PR, que leen Faro y la pestaña Reglas. (b) Tabla en la base, editable desde el Studio | **(a)**: la ley es pública y la misma para todos; su historia queda en Git; Faro ya trabaja así; no hace falta migración para la ley. **Esta PR ya lo hace así en la práctica** para la pestaña Reglas (`lib/studio/nomina/ley/parametros.ts`); elegir (b) obligaría a rehacerlo |
| D2 | ¿Cómo se actualizan las reglas? | (a) Nueva versión con `vigente_desde` y fuente, conservando las anteriores. (b) Editar la fila vigente | **(a)**: el versionado ya existe; los cortes viejos no cambian |
| D3a | **Cestaticket.** El beneficio sí obliga a la empresa privada por ley; lo que no tiene Gaceta a la vista es el monto de USD 40 | (a) Tratarlo como obligación y pagar, como mínimo, lo que el contador o un abogado confirme que es el monto vigente; mientras tanto la pantalla lo marca «solo anuncio» y no lo cuenta en la barra. (b) Tratarlo como referencia opcional | **(a)**: con (b) DTD podría pagar menos de lo obligatorio. Esta decisión necesita al contador (D8) |
| D3b | **Bono de guerra e ingreso mínimo integral.** Se anunciaron para el sector público; a la empresa privada solo se le exhortó | (a) Guardarlos como «referencia», y que Sam y el contador decidan lo que DTD paga. (b) Tratarlos como obligación legal | **(a)**: ningún texto encontrado los impone al sector privado. Ojo: el ingreso mínimo integral sí cuenta como base mínima de la contribución del 9 % |
| D4 | Unidad de los montos | (a) Moneda explícita por monto: SML en Bs; IMI, cestaticket y bono en USD indexados a BCV. (b) Todo en Bs | **(a)**: concuerda con «todo en dólares, Bs como vista» y con cómo se fijan hoy los bonos |
| D5 | ¿Agregar aportes patronales y el 9 % de pensiones? | (a) Sí, como config para el costo de la nómina; no se descuentan al trabajador. (b) No por ahora | **(a)**: hoy el costo real de un empleado no aparece en ninguna parte |
| D6 | Tope de SSO/RPE en el motor (§2.3) | (a) Convertir el tope a USD con la tasa BCV del día del corte y prorratearlo al período. (b) Dejarlo hasta que el contador defina | **(a)**, con el visto bueno del contador sobre la tasa |
| D7 | ¿Quién ve el estante «Ley» en Faro? | (a) Todo usuario del Studio. (b) Solo quien tiene acceso a nómina | **(a)**: el objetivo es la transparencia hacia todos los empleados; el estante no tiene datos internos |
| D8 | ¿Quién aprueba los textos y valores legales? | (a) El contador (o un abogado laboral) y Sam, por PR. (b) Solo Sam | **(a)**: hay valores marcados O, R y N que necesitan ojo profesional |
| D9 | Aviso de las respuestas legales | (a) «Información general de la ley vigente al {fecha}. No es asesoría para tu caso.» (b) Otro texto | **(a)** |
| D10 | Escala de vacaciones y bono vacacional por antigüedad | (a) Agregarla en A2 (Arts. 190 y 192). (b) Dejar los 15 días fijos | **(a)**: los 15 fijos subpagan desde el segundo año |
| D11 | **PENDIENTE DE SAM.** ¿La fecha «Rige desde» elige la versión de las reglas que usa un corte? | (a) No: es informativa; el corte usa siempre la versión vigente y la fecha no puede ser posterior a hoy. (b) Sí: el corte usa la versión cuyo «Rige desde» no pasa del fin del período, y se podrán programar cambios futuros | **(a)** por ahora, como la fijó el DG para esta fase: (b) cambia el motor de cálculo y los cortes ya hechos, y necesita su propia spec y al contador |

## 7 bis. Clasificación de gobernanza (AGENT-BRIEF, paso 4)

Superficie: Studio, módulo Nómina, pestaña Reglas. Riesgo: lectura; no muta datos, no cambia permisos ni cálculos.

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento parcial | Un guardado que falla dice qué pasó y que la versión vigente no cambió; lo escrito se conserva (`conservar-lo-escrito.test.tsx`, con y sin la 0556); lo que la base todavía no admite se avisa en pantalla. Parcial: el formulario hereda las no conformidades de FRM-01 |
| MP-01 | cumplimiento | Nada se borra: guardar archiva la versión vigente y crea la siguiente, en una transacción; los cortes viejos conservan su snapshot. El desarme solo existe para revertir la migración antes de aplicarla |
| AUD-01 | **no conformidad heredada** | Guardar reglas no emite un evento auditable propio (ni antes ni después de la 0556): el rastro es la versión misma (`version`, `created_by`, `created_at`, estado). Seguimiento S-0653-2 en el handoff |
| AUD-02 | no aplica | No hay consulta, exportación ni retención de auditoría nueva en esta fase |
| BTN-01 | cumplimiento | Una sola acción primaria («Editar reglas»); el asterisco y el nombre son botones con nombre accesible y área de 32 px |
| A11Y-01 | cumplimiento | Todo se abre con teclado; la ficha usa `useDialogA11y` (foco, Escape, retorno del foco); el estado va en texto e icono (`Badge`); el asterisco decorativo se oculta al lector y hay texto equivalente (`studio-sr-only`) |
| MOT-01 | cumplimiento | Solo `--dur-fast`, `--dur` y `--dur-slow` con `--ease`; nada se repite; con movimiento reducido no hay escala ni desplazamiento. Lo vigila `ReglasTab.test.tsx` |
| VIS-01, VIS-02 | cumplimiento | Solo tokens; cabecera en tinta con texto invertido (los dos tokens se invierten juntos en oscuro); `dark-theme-contrast-contract` pasa |
| ICO-01 | cumplimiento | Iconos del catálogo (`Icon.close`, `Icon.check`); el botón de cerrar lleva nombre accesible y `title` |
| NUM-01 | cumplimiento parcial | Cada valor muestra su unidad o moneda (USD o Bs según el campo; los bonos dicen la suya); «—» distingue lo que no existe de un cero. Los campos del formulario son `type="number"`, no `NumericInput` (heredado, ver FRM-01) |
| CMP-01 | cumplimiento | Usa los canónicos `Badge`, `Aviso`, `EmptyState`, `SegmentedControl` y `useDialogA11y`. `ReglasTab` y `PistaLey` son piezas del módulo, no componentes compartidos nuevos |
| FRM-01 | **no conformidad heredada, ampliada en A2b** | El formulario de Reglas (anterior a esta spec) usa `<input type="number">` y valida al enviar, sin el ciclo progresivo. La fase A2b le suma campos con el mismo patrón en vez de rehacerlo. Labels persistentes, grupos por decisión y validación completa en servidor (que repite los rangos de la base). Seguimiento S-0653-1 (sitio: `app/studio/(app)/nomina/_components/ReglasDrawer.tsx`): migrarlo a `NumericInput` y al ciclo pristine→blur→invalid es otra tarea |
| ERR-01 | cumplimiento parcial | Cada campo nuevo muestra su error junto al campo con qué corregir («entre 0 y 15 % (tope legal)», «Fecha de vigencia inválida (AAAA-MM-DD)»); sin la 0556 el motivo se dice en un aviso, no con un error genérico |
| IA-01 | no aplica en esta PR | La parte de Faro es diseño (§3); al implementarla aplica entera, junto con privacidad |
| TBL-01 | no aplica | La comparación es una ficha de lectura de 21 filas en tarjetas, no un listado operativo de módulo |

Dos no conformidades heredadas, con seguimiento propio y sin resolver en esta fase: FRM-01 (S-0653-1) y AUD-01 (S-0653-2). `pnpm governance:check` y `pnpm components:check`: PASAN.

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

Comprobación del 2026-11-17 (§2.2):

- Imprenta Nacional, `gacetaoficial.gob.ve`: sumarios de 2026 y PDF de las Gacetas 6.691 Ext., 6.806 Ext., 42.880 y
  42.881.
- IVSS, `ivss.gov.ve/ciudadano/informacion-general`: 4 %, 9/10/11 % y tope de 5 salarios mínimos.
- LOTTT, facsímil de la G.O. 6.076 Ext. en `faolex.fao.org/docs/pdf/ven219669.pdf`.
- Ley del Régimen Prestacional de Empleo, Art. 46, reproducción en
  `venezuela.justia.com/federales/leyes/ley-del-regimen-prestacional-de-empleo/gdoc`.
- Decreto sin publicar: `lapatilla.com/2026/05/18/acceso-a-la-justicia-aun-no-se-ha-publicado-en-gaceta-oficial-el-decreto-al-aumento-minimo-integral/`.
- Video falso del salario de USD 500: `eldiario.com/2026/11/06/delcy-rodriguez-aumento-salario/`.

Sigue sin confirmar: la base y las tasas del FAOV en fuente oficial, y los artículos 142 y 143 de la LOTTT (marcados C).
