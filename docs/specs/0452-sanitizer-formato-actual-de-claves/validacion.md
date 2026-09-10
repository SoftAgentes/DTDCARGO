# Validación SDD-0452

Dueño: Worker `worker-sanitizer-0452-20260910-root`. Fecha: 2026-09-10.
Estado: en ejecución. Base: `b7ad23977b1905a25ba3154e52238f0e7baaaaa4`.
Solo entradas sintéticas, sin claves reales ni consultas a archivos archivados.

## Instalación y entorno

- PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0, 813 paquetes.
- Node `v24.20.0`; Corepack `0.35.0`; pnpm resuelto por Corepack `12.3.4`.
- pnpm avisó que ignora `pnpm.onlyBuiltDependencies` en package.json; no se
  alteró configuración ni lockfile. CI declara pnpm `11.19.0` / Node 24.

## Hueco 3 primero: E1 antes del arreglo del sanitizador

`corepack pnpm harness:test`, exit 0, usando inicialmente el glob nativo:

```text
$ node --test "scripts/tests/*.node.mjs"
✔ fusiona dos ramas con claves baseline y specs distintas sin perder entradas
✔ falla cerrado si ambos lados cambian la misma clave del baseline
✔ una eliminación unilateral no puede borrar una entrada del baseline
✔ sin instalar el driver el merge bloquea y no inventa una unión textual
✔ rechaza JSON con claves duplicadas antes de sobrescribir %A
ℹ tests 23
ℹ pass 23
ℹ fail 0
ℹ skipped 0
```

Extracto literal de nombres y contadores; se omiten duraciones y los otros
18 nombres. E1 se ejecutó y PASÓ 5/5; no fue necesario ni autorizado repararla.

El contrato nuevo detectó que el glob nativo sin coincidencias sale 0. El runner
final sustituye esa variante por descubrimiento explícito con rechazo vacío.
Su focal pasó 3/3: archivo nuevo descubierto; fallo propagado; vacío rechazado.

## ROJO antes del cambio de producción

Comando:

```text
node node_modules/vitest/vitest.mjs run scripts/tests/bug-sanitizer.test.ts --reporter=verbose
```

Con `lib/studio/bug-sanitizer.ts` todavía idéntico a la base:

```text
 Test Files  1 failed (1)
      Tests  48 failed | 44 passed (92)
   Duration  779ms
exit 1
```

## VERDE después, sin cambiar los vectores

Mismo comando, suite y entradas sintéticas:

```text
 Test Files  1 passed (1)
      Tests  92 passed (92)
   Duration  596ms
exit 0
```

Los 48 fallos previos son cuatro contratos para cada una de doce formas:
Supabase secret y publishable; GitHub PAT fino e instalación JWT; Stripe
organización y firma webhook; Slack app, workflow, refresh, bot rotado y usuario
rotado; AWS STS. Los cuatro contratos comprueban texto/puntuación, repetición e
idempotencia, consola/stack/inmutabilidad, y paths/headers/contexto de red.

Los 44 controles verdes en ambas corridas incluyen los catorce casos de la
inline, cabeceras apikey y sus tres representaciones, diez negativos de
legibilidad y dieciocho controles de familias previamente cubiertas.

Las salidas completas se conservan localmente fuera de Git bajo
`%TEMP%/dtd-sanitizer-0452-20260910/`, archivos `sanitizer-red-final.log` y
`sanitizer-green.log`; solo contienen datos sintéticos de estas pruebas.
El fallo adicional de URL visto durante exploración inicial está separado en la
spec como problema previo, no contado entre los 48 fallos de formato.

## Gates finales

- PASÓ: `corepack pnpm harness:test`, runner final, 26/26, exit 0,
  seis archivos descubiertos. Incluye E1 5/5 y descubrimiento 3/3.
- PASÓ: `node scripts/test-sanitizer-inline.mjs`, suite real 92/92, exit 0.
- PASÓ: índice regenerado, `docs:check`, `sdd:check`, `git diff --check`.
- Pendientes: verify, publicación y CI alojado. Los checks omitidos o sin entorno
  no se declararán aprobados. Ledger y E2E autenticado requieren evidencia propia.

## Revisión adversarial de legibilidad

**FALLÓ el criterio 5 fuera del corpus inicial.** Dos identificadores inventados
de configuración (`sb_secret_configuration_validation_failed` y
`sk_org_configurationvalidationfailed`) se preservaban en la base y el nuevo
patrón los convierte en `[REDACTED]`. También se identificó la misma ambigüedad
en nombres largos con prefijos de Slack. La suite 92/92 no prueba ausencia de
estas colisiones. Los mínimos evitan menciones cortas, pero no distinguen una
clave de todo texto compatible con su formato. No se debilita el sanitizador
con una excepción basada en palabras o composición no garantizada. Cierre
funcional pendiente de decisión sobre este criterio, con PR en borrador.
