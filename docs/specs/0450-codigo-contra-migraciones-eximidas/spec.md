---
sdd: "0450"
title: "Código contra símbolos de migraciones pendientes"
status: done
author: "Codex"
created: 2026-09-10
updated: 2026-09-11
supersedes: null
superseded_by: null
related: ["0443", "0444"]
confidencialidad: interno
---

# SDD-0450 — Código contra símbolos de migraciones pendientes

> Gate local y de CI, sin credenciales, para impedir que código fusionable dependa
> silenciosamente de objetos de base de datos que todavía no existen en producción.

## Contexto y problema

El ledger productivo y `scripts/check-migrations-applied.mjs` responden si una
migración del repo fue aplicada, pero ese check degrada sin credenciales y no
determina si el código ya depende de los objetos ausentes. El árbol `94a94f2d`,
resultado de fusionar la PR #33, mostró la falla: código alcanzable desde rutas
de `app/**` referenciaba `receive_prealerta_boxes_as_operario`,
`save_shipping_label_presentation` y `shipping_label_versions`, aunque la
migración 0449 seguía declarada pendiente.

Se necesita una señal determinista antes de integrar: solo repo contra repo,
sin consultar Supabase, sin red y sin posibilidad de SKIP.

## Objetivo

Fallar cuando un símbolo que nace únicamente en una migración registrada en
`pendingBelowCutoff` es referenciado por un módulo alcanzable transitivamente
desde una entrada Next de `app/**`, salvo que exista una declaración explícita,
completa y vigente del degradado. Integrar esa decisión en `pnpm verify` y como
paso propio del workflow `Calidad local sin secretos`.

## Alcance

- `scripts/check-pending-migration-symbols.mjs` y sus pruebas focales.
- Declaraciones en `supabase/pending-migration-symbol-declarations.json`.
- Un paso adyacente a `migrations-applied` en `scripts/verify.mjs`.
- Un paso obligatorio propio en `.github/workflows/quality.yml` y su contrato.
- Esta spec, el índice SDD generado y el handoff de la tarea.

Quedan excluidos cambios a migraciones SQL, `findMissing`, el `cutoff`, código
de producto, rulesets, merge, deploy y cualquier operación sobre producción.
El número SDD-0450 no implica una migración 0450: las dos secuencias son
independientes.

## Diseño

### Fuente de verdad y ausencia

El check lee las claves de `pendingBelowCutoff` desde
`supabase/migrations-baseline.json` y exige que cada clave tenga su `.sql`.
Extrae de todas las migraciones del checkout estos DDL:

- `CREATE [OR REPLACE] FUNCTION`;
- `CREATE TABLE [IF NOT EXISTS]`;
- `CREATE [OR REPLACE] VIEW`;
- `ALTER TABLE ... ADD COLUMN [IF NOT EXISTS]`.

Los comentarios, literales y cuerpos dollar-quoted no cuentan como DDL, con
una excepción: el cuerpo de un bloque `DO`, que se ejecuta al aplicar la
migración. Su DDL estático y los literales pasados directamente a `EXECUTE`,
solos o como plantilla de `format()`, sí cuentan (corrección 2026-09-11,
bloques DO). Los identificadores se normalizan con reglas de PostgreSQL y las
columnas se identifican como `tabla.columna`.

Un símbolo extraído de una migración pendiente es **ausente** solo cuando
ninguna migración no eximida crea el mismo símbolo. Si una función aparece en
una aplicada y luego en una pendiente con `CREATE OR REPLACE`, el gate la trata
como redefinición, no como ausencia.

### Alcanzabilidad y referencias

Las raíces son los archivos convencionales de rutas Next bajo `app/**` (`page`,
`layout`, `route`, `loading`, `error`, entre otros). El grafo sigue imports y
reexports literales relativos o `@/`, además de `import()` y `require()`
literales. Los comentarios JS/TS no crean aristas ni referencias.

Desde ese cierre transitivo se buscan menciones exactas de los símbolos
ausentes. El resultado tiene tres niveles:

- **ROJO:** al menos un sitio alcanzable y ninguna declaración válida; exit 1.
- **AMARILLO:** los mismos riesgos están agrupados en una declaración explícita
  válida; se imprimen y el proceso sale 0.
- **silencio:** el símbolo solo aparece en módulos sin importador transitivo
  desde una entrada de `app/**`; no se imprime una excepción.

No se interpreta control de flujo, `try/catch` ni respuesta de Supabase para
ascender un rojo. El degradado es un contrato escrito, no una heurística.

### Contrato de declaraciones

El archivo separado usa `schemaVersion: 1` y una lista `degradations`. Cada
declaración debe incluir:

- `id`, migración y `primarySymbol` que representa el AMARILLO impreso;
- cada símbolo cubierto con tipo, nombre y la lista **exacta** de sitios
  alcanzables `ruta:línea`;
- evidencia no vacía con `site`, un fragmento `contains` verificable en esa
  línea y una explicación `degradation`.

El gate falla con exit 2 si una declaración es ambigua, duplicada, incompleta,
ya no es alcanzable, no corresponde a la migración o si cambian sus sitios o
evidencias. Un caso puede agrupar varios símbolos bajo un solo degradado, pero
debe nombrarlos todos individualmente.

Las declaraciones no viven dentro de `migrations-baseline.json`. Ese baseline
es generado/versionado y cambia con el estado de release; mezclar allí la
justificación por sitio de código aumentaría el solapamiento y la serialización
E1 entre PRs. El archivo separado solo cambia cuando aparece, cambia o desaparece
un degradado real; la pertenencia de migraciones pendientes sigue teniendo una
única fuente en el baseline.

### Caso actual

La única declaración vigente se imprime como AMARILLO
`shipping_label_versions` para la migración 0449. Nombra además
`save_shipping_label_presentation`, porque ambas ausencias comparten el mismo
degradado:

- lectura en `lib/studio/label-presentation-queries.ts:5`, con presentación
  predeterminada y bandera `available` explícita;
- guardado en `app/studio/(app)/admin/etiquetas/actions.ts:13`, deshabilitado y
  protegido por `available` en el editor.

Las seis tablas `no_olvidar_*` de 0017 aparecen en
`lib/studio/no-olvidar-queries.ts`, pero ese módulo no tiene importador
transitivo desde `app/**`; permanecen en silencio.

## Límites conocidos

- **Solo ve migraciones declaradas.** Si una migración ausente no está en
  `pendingBelowCutoff`, el check no sabe que sus objetos faltan. La 0447 entró
  por la PR #27 sin registrarse inicialmente y habría sido invisible. E4
  complementa a E3; este gate no reemplaza el control de completitud de las
  declaraciones.
- **Solo ve DDL que crea los cuatro tipos cubiertos.** La 0428 contiene
  `ALTER POLICY`, no crea un símbolo de este contrato y por diseño no produce
  señal. Tampoco demuestra que una policy, grant, trigger o dato seed exista.
- **El grafo es estático y literal.** Imports calculados, nombres DB construidos
  dinámicamente y acceso indirecto sin el nombre del símbolo pueden escapar.
- **Del DDL dinámico solo se lee el literal.** En un bloque DO cuentan el DDL
  estático y las plantillas literales de `EXECUTE`. Un `EXECUTE` de una variable
  o un nombre de objeto calculado (`%I`, `||`) no crea símbolo.
- **No certifica producción.** Clasifica el código según el baseline del repo;
  no consulta el ledger real ni prueba RLS, permisos, datos o comportamiento.
  `migrations-applied`, E2E autenticado y pruebas Supabase conservan fronteras
  separadas.
- La búsqueda de columnas usa su token de columna y es conservadora; una
  coincidencia homónima alcanzable puede exigir declaración o ajuste del código
  futuro, en vez de caer a verde por omisión.

## Criterios de aceptación

- [x] Parser puro/exportado para las cuatro formas DDL.
- [x] Redefiniciones presentes en migraciones aplicadas no cuentan como ausencia.
- [x] Grafo transitivo desde entradas `app/**` y tres niveles rojo/amarillo/silencio.
- [x] Declaraciones explícitas validan símbolo, todos los sitios y evidencia.
- [x] Fixture de regresión reproduce los tres rojos del árbol `94a94f2d`, incluida
      la llamada de recepción en `app/m/cn/recibir/actions.ts:186`.
- [x] Árbol actual: un AMARILLO primario `shipping_label_versions`, cero ROJO y
      las seis tablas `no_olvidar_*` sin importador transitivo.
- [x] El ejecutable no usa credenciales, red ni SKIP.
- [x] Paso agregado en `pnpm verify` y gate obligatorio propio en CI.
- [x] Índice SDD regenerado y validación completa registrada en el handoff.

## Validación ejecutada

- **PASÓ** `corepack pnpm install --frozen-lockfile` con pnpm 12.3.4 y lockfile
  congelado. La forma directa `pnpm install --frozen-lockfile` **FALLÓ** porque
  `pnpm` no estaba en `PATH`; `corepack` ejecutó el mismo gestor/versionado sin
  modificar el lockfile.
- **PASÓ** `node scripts/check-pending-migration-symbols.mjs`: cero ROJO y un
  AMARILLO primario, `shipping_label_versions`; las seis tablas
  `no_olvidar_*` quedaron en silencio.
- **PASÓ** la prueba focal del check y el contrato CI: 29/29 casos en 2 archivos;
  la regresión aislada del check aporta 7/7 casos.
- **PASÓ** `corepack pnpm harness:test`: 12/12.
- **PASÓ** `corepack pnpm docs:index`, `corepack pnpm docs:check` y
  `corepack pnpm sdd:check`.
- **FALLÓ** el resultado global de `corepack pnpm verify`: 16/17 pasos corrieron
  realmente. El gate `pending-migration-symbols` pasó con el AMARILLO esperado;
  lint, typecheck, 6509 pruebas Vitest, 145 contratos SQL, reconstrucción de 385
  migraciones y build de producción también pasaron. `migrations-applied` fue
  **NO EJECUTADO** por falta de credenciales. E2E terminó 153 pasadas, 15 fallidas
  y 18 omitidas; las 15 fallas fueron las mismas cinco rutas dependientes de
  Supabase en Chromium, Mobile Chrome y Mobile Safari sin URL/clave anónima.
  Además, Playwright forzó el cierre de un worker WebKit tras 300000 ms.

Por ser un cambio de harness, no se harán correcciones de producto ni pruebas
manuales funcionales con datos. E2E autenticado y comportamiento contra
Supabase quedan **NO DISPONIBLES** sin credenciales; un verde de CI sin secretos
no los cubre ni certifica corrección de producto.

## Hallazgo excluido

`app/p/[token]/page.tsx:46` y
`app/portal/(app)/compras/[code]/etiquetas/page.tsx:67` consumen la presentación
sin usar la bandera `available`. Es un hallazgo real de producto y se registra
en el handoff como **FUERA DE ALCANCE DETECTADO**; no se corrige en esta rama.

## Corrección 2026-09-11: enmascarado por unidades UTF-16

**Defecto.** `maskSqlNonCode` y `maskJavaScriptComments` construían la máscara
con `[...texto]`, que itera code points, pero la escribían con índices UTF-16
(`texto[i]`, `startsWith(…, i)`, `indexOf`). Cada carácter astral (emoji fuera
del BMP) desplazaba una posición el resto de la máscara: se blanqueaban
caracteres de código real tras cada comentario o literal, quedaban visibles
restos de comentario y, en JS/TS, se borraban saltos de línea. El gate reportaba
líneas equivocadas y podía omitir DDL e imports; una arista perdida convierte un
ROJO real en silencio.

**Corrección.** Ambas máscaras parten del texto en unidades UTF-16 (`split("")`,
mediante un único helper documentado). La máscara solo sustituye unidades por
espacios: conserva longitud, índices y saltos de línea. No cambian las formas
DDL cubiertas, el grafo, el contrato de declaraciones ni los niveles
ROJO/AMARILLO/silencio.

**Regresión.** `scripts/tests/pending-migration-symbols-utf16.node.mjs` corre en
`pnpm harness:test`. Sus siete casos fallan con el enmascarado anterior, también
al retirar el invariante de máscara, y pasan con el nuevo:

- un par sustituto enmascarado ocupa dos espacios;
- TS con astrales antes de `.rpc()` reporta la línea exacta, con LF y CRLF;
- SQL con astrales en un comentario justo antes de `create function` extrae el
  símbolo;
- las formas de 0090 (astrales en literales) y 0128
  (`ALTER TABLE ... ADD COLUMN`) conservan sus símbolos;
- una declaración anclada a la línea real pasa como AMARILLO;
- un import tras un comentario con astrales conserva la arista y el ROJO.

**Impacto medido sobre main `3c610701`.**

- 9 de 420 migraciones contienen astrales; con la máscara anterior, 8 producían
  texto enmascarado de otra longitud. La extracción pasa de 1076 a 1080
  símbolos, sin pérdidas y sin cambios en migraciones sin astrales. 0090
  recupera `function:public.comments_freeze_immutable`, y 0128 recupera
  `column:public.sales_orders.invoicing_total_boxes`,
  `function:public.prealerta_sales_order_in_tenant` y
  `function:public.sales_order_claim_and_invoice`. Ambas migraciones son no
  eximidas: si una pendiente reemplaza esos símbolos, ahora cuenta como
  redefinición y no como ausencia.
- 130 de 2480 fuentes JS/TS contienen astrales; con la máscara anterior 120
  cambiaban su número de líneas enmascaradas, y con la corrección ninguna. Dos
  imports externos (`react`, `node:fs`) se perdían sin crear aristas; los 1637
  módulos alcanzables no cambian.
- El conjunto de símbolos pendientes-únicos no cambia y el gate sigue en
  `0 ROJO · 0 AMARILLO`: no aparecen ROJO nuevos.

**Caso que lo destapó.** En el head remoto de L06 (`1b655967`), la llamada real
a `get_portal_packing_list_documents` está en
`lib/portal/packing-list-queries.ts:231`. El gate anterior la situaba en `:125`,
rechazaba la declaración anclada a la línea real (exit 2) y dejaba el símbolo en
ROJO. Con la corrección, sobre una extracción de ese head: `0 ROJO · 1 AMARILLO`,
con el sitio `:231`.

- [x] Máscaras SQL y JS/TS por unidades UTF-16, con longitud, índices y líneas
      conservados.
- [x] Siete regresiones del harness que fallan con el código anterior y pasan
      con el nuevo.
- [x] Main sin ROJO nuevos; extracción comparada en todas las migraciones.
- [x] Extracción del head de L06: `0 ROJO · 1 AMARILLO` en `:231`.

**Validación.** PASARON `pnpm harness:test` (33/33, siete nuevas), la prueba
focal existente del check con el contrato CI (29/29), el checker en el árbol y
sobre la extracción de L06, `pnpm lint` (0 errores; 8 avisos preexistentes
ajenos), `pnpm docs:check`, `pnpm sdd:check` y `git diff --check`.
`pnpm verify` quedó NO EJECUTADO: el cambio es solo de harness y se valida con
sus pruebas propias. Detalle en `.agents/handoffs/c-fix-pending-symbols-utf16.md`.

## Corrección 2026-09-11: DDL en bloques DO

**Defecto.** `maskSqlNonCode` dejaba en blanco todo cuerpo dollar-quoted,
también el de `DO $…$`. A diferencia del cuerpo de una función, un bloque DO se
ejecuta al aplicar la migración. La 0426 de L17 (PR #80, head `07e54dfc`) crea
`reserve_public_verify_attempt` con
`execute pg_catalog.format($ddl$ create or replace function … $ddl$, v_body)`
dentro de `do $migration$`. El símbolo no nacía en la pendiente: la llamada de
`lib/public/verify-throttle.ts:27`, alcanzable desde `app/verificar/page.tsx`,
quedaba en `0 ROJO`, y declararla daba exit 2 («no identifica un único símbolo
pendiente ausente»).

**Alternativas evaluadas.**

1. **Extraer el DDL que corre en bloques DO (elegida).** Solo entra en lo que se
   ejecuta al aplicar: el cuerpo de cada `DO [LANGUAGE plpgsql]` y, dentro de
   él, los literales pasados directamente a `EXECUTE`, solos o como plantilla de
   `[pg_catalog.]format()`. Sigue siendo repo contra repo, sin credenciales,
   red, Docker ni SKIP, y no depende de que alguien recuerde anotar.
2. **Anotación explícita en la migración, validada contra el catálogo efímero
   de `check-schema-rebuild`.** Descartada como mecanismo principal:
   - `schema-rebuild` sale con SKIP sin Docker o con `VERIFY_SKIP_SQL=1`. La
     validación heredaría esa omisión y rompería la propiedad «sin SKIP» de
     este gate: en local, una anotación sin verificar pasaría.
   - Hoy solo compara una huella de esquema para `LEDGER_ONLY`. Validar
     anotaciones exigiría fotografiar el catálogo antes y después de cada
     pendiente, un contrato nuevo dentro de otro gate crítico.
   - Depende de disciplina: si se olvida la anotación, el punto ciego sigue.
3. **Desenmascarar todo el dollar-quoting.** Descartada: leería DDL de cuerpos
   de función que solo corre al invocarlos, como el
   `execute 'create table public.dynamic_only…'` que la prueba Vitest existente
   exige ignorar.

La corrección es una enmienda y no una SDD nueva: no cambia el objetivo, los
niveles ni el contrato de declaraciones; amplía la lectura de las cuatro formas
DDL que ya cubría.

**Contrato resultante.**

- Cuentan como DDL de la migración:
  - el texto fuera de literales, como antes;
  - el código del cuerpo de un bloque DO, por ejemplo un `alter table … add
    column` dentro de un `if`;
  - el contenido de un literal que es argumento directo de `EXECUTE` o la
    plantilla de `format()` bajo `EXECUTE`. Los literales simples se
    desescapan (`''` → `'`).
- No cuentan cuerpos de función, asignaciones a variables, `raise`,
  `comment on … is`, `perform format(…)` ni datos. Se siguen hasta cuatro
  niveles DO → EXECUTE → DO.
- **Nombre completo.** A un nombre extraído no pueden seguirle más caracteres
  de identificador, un punto, un marcador `%` de `format()` ni el fin del
  fragmento; `if` y `only` tampoco cuentan como nombre. Así, las plantillas con
  nombre calculado (`%I.%I`, `public.%I`, `if not exists %I`, `fixture_%s`,
  `'…_' || sufijo`) no dan símbolos falsos como `public` o `if`, que
  coincidirían con cualquier token alcanzable.
- **Simetría con aplicadas.** Un símbolo creado en un bloque DO de una
  migración no eximida cuenta como existente; si una pendiente lo redefine, es
  redefinición y no ausencia.
- No cambian las formas DDL cubiertas, el grafo, las declaraciones, los niveles
  ni el formato de salida.

**Regresión.** `scripts/tests/pending-migration-symbols-do-blocks.node.mjs`
corre en `pnpm harness:test` con seis casos:

- ROJO exacto para una RPC creada con `EXECUTE format()` dentro de un DO
  pendiente (forma de 0426, con astrales) y llamada desde TS alcanzable;
  `revoke`, `grant` y `comment` no crean símbolos;
- la declaración anclada a la llamada real pasa como AMARILLO;
- DDL estático en DO, `do language plpgsql`, literal simple con comillas
  escapadas y `format()` sin marcadores;
- una función creada en un DO aplicado y redefinida por una pendiente no es
  ausencia;
- guardas: cuerpos de función, literales no ejecutados y comentarios no crean
  símbolos, y los nombres calculados no dan símbolos falsos.

Los cuatro primeros fallan con el checker de `origin/main` `07d00097` y pasan
con el nuevo; las dos guardas pasan en ambos. Mutaciones del nuevo: sin la
guarda de nombre completo falla el caso de nombres calculados; entrar en todo
literal (desenmascarado ingenuo) o en todo literal de un DO falla el de cuerpos
de función; sin bloques DO fallan los cuatro primeros.

**Impacto medido.**

- **main `07d00097`:** 421 migraciones, 140 con 215 bloques DO. La extracción
  pasa de 1081 a 1082 símbolos, sin pérdidas y sin cambios en migraciones sin
  DO. El único nuevo es `column:public.fiscal_settings.iva_withholding_agent`,
  de 0141 (aplicada: `add column` condicional dentro de un DO). En todo el árbol
  hay siete plantillas `EXECUTE` en bloques DO y ninguna contiene DDL cubierto.
  Pendientes-únicos: ninguno antes ni después. Gate `0 ROJO · 0 AMARILLO` en
  ambos, con 1637 módulos alcanzables.
- **Extracción de L17 `07e54dfc` (`git archive`):** el checker anterior da
  `0 ROJO`, exit 0; el nuevo, `1 ROJO`: `reserve_public_verify_attempt` (0426)
  en `lib/public/verify-throttle.ts:27`, exit 1. Con una declaración de
  demostración, solo en una copia descartable, el anterior da exit 2 y el nuevo
  `0 ROJO · 1 AMARILLO`, exit 0.

**Límites que persisten.**

- `EXECUTE` de una variable. El único caso de main es 0296 (`execute v_after`):
  reescribe la definición de `operario_action` leída con `pg_get_functiondef`,
  una redefinición y no un símbolo nuevo.
- Nombres de objeto o esquemas calculados (`%I`, `||`) no se extraen.
- Los literales con DDL que no se pasan a `EXECUTE`, como las etiquetas
  `'CREATE TABLE'` del event trigger de 0277, se ignoran por diseño.
- Complemento posible, no implementado: que `schema-rebuild` compare lo que
  cada pendiente crea en el catálogo efímero con la extracción estática.
  Necesita SDD propia, porque suma Docker como fuente de verdad.

- [x] Una función creada con DDL dinámico literal en un bloque DO pendiente y
      llamada desde TS alcanzable da ROJO; su declaración valida como AMARILLO.
- [x] Cuerpos de función y literales no ejecutados siguen sin crear símbolos;
      los nombres calculados no producen símbolos falsos.
- [x] Main sin cambios de veredicto ni pendientes-únicos nuevos; extracción
      comparada en todas las migraciones.
- [x] Extracción de L17: ROJO en `lib/public/verify-throttle.ts:27`, sin tocar
      su worktree.

**Validación.** PASARON `pnpm harness:test` (39/39, seis nuevas), la prueba
focal Vitest del check con el contrato CI (29/29), el checker en el árbol y
sobre la extracción de L17, ESLint, `pnpm docs:check`, `pnpm sdd:check` y
`git diff --check`. `pnpm verify` quedó NO EJECUTADO: el cambio es solo de
harness y se valida con sus pruebas propias. Detalle en
`.agents/handoffs/pending-symbols-do-blocks.md`.
