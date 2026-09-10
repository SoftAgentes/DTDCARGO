---
sdd: "0450"
title: "Código contra símbolos de migraciones pendientes"
status: done
author: "Codex"
created: 2026-09-10
updated: 2026-09-10
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

Los comentarios, literales y cuerpos dollar-quoted no cuentan como DDL. Los
identificadores se normalizan con reglas de PostgreSQL y las columnas se
identifican como `tabla.columna`.

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
