# Handoff — e1-archivos-generados-serializan

- Fecha: 2026-09-10
- Owner / sesión: `codex-worker-e1-20260910`
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/e1-archivos-generados-serializan`
- Rama: `codex/e1-archivos-generados-serializan`
- Base asignada y verificada: `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2` (`main`)
- Estado: lista para revisión técnica; alcance implementado, con límite hospedado pendiente de decisión del Director
- SDD: no aplica. Es harness/gobernanza del repositorio, sin comportamiento de producto ni migración. La decisión se registra como ADR y no se tomó un número coordinado por el Director.
- Dependencia: `.github/workflows/quality.yml` quedó intacto, como exigía el encargo por la PR #44.

## DECISIÓN VISIBLE

Se eligió **B con un driver de unión semántica propio para ambos archivos**, no
`merge=union` de líneas. El índice permanece versionado y se fusiona por número
SDD, regenerando conteo, orden y huecos; `pendingBelowCutoff` se fusiona por
clave y conserva las adiciones de ambos lados.

La opción A se descartó porque el índice tiene 122 referencias versionadas y
siete lectores activos fuera de specs, archivo e handoffs. La mixta conserva el
driver obligatorio del baseline y además pierde el índice navegable en GitHub,
así que suma costo sin quitar el bloqueo decisivo.

**Límite no oculto:** el driver se configura en `.git/config` de cada clon.
GitHub no ejecuta el instalador para calcular la mergeabilidad ni para su botón
Update branch. Por eso esta entrega resuelve la fusión sin intervención y sin
pérdidas en clones configurados y permite probar el contrato en CI, pero **no
resuelve por sí sola E1 en el merge hospedado de GitHub ni evita la nueva corrida
que exige el ruleset estricto**. Para cerrar también esa parte hace falta una
decisión posterior de merge queue/ruleset o automatización autorizada con push.

Decisión completa: `docs/architecture/decisions/0002-merge-semantico-registros-generados.md`.

## OBJETIVO ORIGINAL

Evitar que PR independientes se bloqueen por `docs/specs/README.md` y
`supabase/migrations-baseline.json`, conservando que el índice refleje las specs
reales y que el baseline nunca pierda entradas de `pendingBelowCutoff`.

## COMPLETADO

- `.gitattributes` asigna ambos registros al driver `dtd-generated-records` y
  prohíbe explícitamente la unión textual.
- `scripts/merge-generated-records.mjs` implementa un three-way semántico:
  - claves distintas de `pendingBelowCutoff` se conservan;
  - una eliminación unilateral no borra una entrada que el otro lado conserva;
  - borrar contra editar, textos distintos para la misma clave, JSON inválido,
    claves duplicadas y cualquier ambigüedad fallan cerrados;
  - `%A` solo se escribe después de validar el resultado completo;
  - el índice se une por SDD y se vuelve a renderizar, nunca se elige un lado.
- `scripts/install-merge-drivers.mjs` instala en un comando la configuración
  local y `--check` la verifica sin mutarla.
- `scripts/build-docs-index.mjs --check` ahora compara el bloque versionado con
  las specs reales; quitar una fila deja `docs:check` rojo.
- `scripts/tests/merge-generated-records.node.mjs` crea repositorios Git
  temporales y ejecuta merges reales de ramas independientes.
- No se modificaron `supabase/migrations-baseline.json`,
  `docs/specs/README.md`, `.github/workflows/quality.yml`, el cutoff ni ninguna
  entrada existente.

## OPERACIÓN POR CLON Y CI

Instalación por clon, un solo comando:

```text
node scripts/install-merge-drivers.mjs
```

Comprobación:

```text
node scripts/install-merge-drivers.mjs --check
```

Si alguien no instala el driver, Git usa su merge textual normal. La simulación
demuestra que el escenario de adiciones vecinas queda en conflicto: el merge se
bloquea y no inventa una unión ni pierde una entrada. Ese fallback es seguro,
pero no automático.

Después de integrar la PR #44, el Director debe secuenciar este paso en
`.github/workflows/quality.yml`, inmediatamente después del checkout, sin que
esta rama toque el archivo:

```yaml
- name: Configurar drivers semánticos de merge
  run: |
    node scripts/install-merge-drivers.mjs
    node scripts/install-merge-drivers.mjs --check
- name: Simular fusiones de registros compartidos
  run: node --test scripts/tests/merge-generated-records.node.mjs
```

Esto prueba el contrato y configura merges que el runner ejecute después del
checkout. No altera la mergeabilidad calculada antes por GitHub.

## VALIDACIÓN

- **PASÓ** — `corepack pnpm install --frozen-lockfile` (exit 0, 57,9 s). pnpm
  emitió un aviso preexistente sobre `pnpm.onlyBuiltDependencies`; no impidió la
  instalación.
- **PASÓ** — `node scripts/install-merge-drivers.mjs` y
  `node scripts/install-merge-drivers.mjs --check`.
- **PASÓ** — `node --check` para driver, instalador y prueba.
- **PASÓ** — simulación de fusión, 5/5:

```text
✔ fusiona dos ramas con claves baseline y specs distintas sin perder entradas
✔ falla cerrado si ambos lados cambian la misma clave del baseline
✔ una eliminación unilateral no puede borrar una entrada del baseline
✔ sin instalar el driver el merge bloquea y no inventa una unión textual
✔ rechaza JSON con claves duplicadas antes de sobrescribir %A
ℹ tests 5
ℹ pass 5
ℹ fail 0
```

  El primer caso conservó `base_wait`, `9001_branch_other` y
  `9002_branch_current`, conservó los dos motivos, ordenó las specs `0002` y
  `0003`, y pasó `docs:check`. Luego la prueba quitó la fila `0002` del índice y
  confirmó exit 1 por índice desactualizado.
- **PASÓ** — `corepack pnpm docs:check`: índice sincronizado con 395 specs.
- **PASÓ** — `corepack pnpm sdd:check`: 395 specs, 403 migraciones, colisiones
  históricas exentas y `[OK] numbering: sin números repetidos`.
- **PASÓ** — `corepack pnpm lint`: cero errores y ocho warnings
  preexistentes fuera del alcance.
- **PASÓ** — `git diff --check`.
- **FALLÓ** — `corepack pnpm verify`: 15 de 16 pasos corrieron; el único paso
  rojo fue E2E. Build de producción sí pasó.
  - PASÓ: harness 12/12, lint sin errores (ocho warnings preexistentes), límite
    RSC 1.596 módulos, typecheck, Edge 4/4, Vitest 513 archivos y 6.496 tests,
    docs, numbering, feature constants 5/5, componentes 5/5, gobernanza 28,
    SQL 145, schema rebuild 385 migraciones + 18 ledger-only e aislamiento de
    219 tablas con dos tenants, y build Next de producción.
  - NO EJECUTADO: `migrations-applied`, por ausencia de
    `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; no se leyó
    producción.
  - FALLÓ: E2E. Primera corrida: 151 pasaron, 2 flaky, 18 omitidas y 15
    fallaron. Reintento: 153 pasaron, 18 omitidas y las mismas 15 fallaron; las
    cinco rutas de auth/Studio/Back/global-search fallaron en tres navegadores
    porque faltaban `NEXT_PUBLIC_SUPABASE_URL` y
    `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Además, Playwright forzó el cierre de
    `worker-45` tras 300.000 ms de teardown. No se copiaron secretos.

Este es un cambio de harness; no modifica comportamiento de producto. Las
pruebas de producto que sí corrieron se registran arriba, pero no sustituyen el
caso focal de merge. E2E autenticado, UAT y producción no quedaron certificados.

## COMMITS

- `8ed9f5e8` — `chore(harness): serializa registros generados con merge semantico`
- El commit que contiene este documento — cierre durable y handoff.

## PR / BRANCH

- Branch: `codex/e1-archivos-generados-serializan`
- PR draft: [#51](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/51)
- Merge/deploy: NO AUTORIZADO y no ejecutado.

## PENDIENTES DE ESTA TAREA

- El Director debe agregar los dos pasos de CI indicados arriba después de
  integrar la PR #44; esta rama no podía tocar `quality.yml`.
- E1 no queda resuelto en el cálculo hospedado de GitHub ni en la serialización
  del ruleset. Hace falta escoger y autorizar una segunda capa: merge queue,
  ajuste del ruleset o bot que actualice la rama desde un clon configurado.

## FUERA DE ALCANCE DETECTADO

- Las 15 fallas E2E y el teardown de Playwright pertenecen al entorno/producto,
  no a los archivos de esta tarea; no se corrigieron.
- Los ocho warnings de lint preexistentes no se tocaron.
- No se validó el ledger contra Supabase ni se leyó/escribió producción por
  falta de autorización y credenciales.

## HANDOFF AL DIRECTOR

1. Revisar el ADR y, en particular, aceptar o rechazar el límite hospedado antes
   de presentar esto como cierre total de E1.
2. Después de #44, integrar en `quality.yml` exactamente los pasos documentados.
3. Exigir `node scripts/install-merge-drivers.mjs` en clones que actualicen ramas.
4. Mantener la PR en draft hasta decidir la segunda capa para GitHub/ruleset.
5. No hay migración, deploy, merge a `main` ni cambio de ruleset en esta entrega.
