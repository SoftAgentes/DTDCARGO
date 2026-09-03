# e2e · Playwright

Tests end-to-end de DTD Cargo. Separados de los unit (`__tests__/`, Vitest).

## Cómo correr

```bash
pnpm test:e2e                          # auto-levanta dev en :3001 (config webServer)
pnpm test:e2e e2e/auth.spec.ts         # un solo spec
pnpm test:e2e:ui                       # modo interactivo
```

El config invoca el entry de Next mediante `node`. `BASE_URL` controla el
destino y conserva compatibilidad con Preview/servidores existentes; el arranque
se puede forzar por separado con `E2E_START_WEB_SERVER=1`:

En un worktree limpio, los casos Tier 0/1 no requieren `.env.local`: si faltan
las dos variables públicas de Supabase, Playwright levanta un servidor local
deny-only que rechaza lecturas y escrituras sin salir a la red. Fuera del modo
efímero, una pareja ya configurada se conserva intacta. Los Tier 3 siguen
exigiendo su branch efímero completo.
Si el puerto auxiliar calculado estuviera ocupado, se puede declarar
`E2E_SUPABASE_DENY_PORT` con otro puerto local libre.

La ejecución local usa ocho workers por defecto (CI usa uno) y tiene un límite
global de ocho minutos para que un teardown de navegador no deje el gate vivo
indefinidamente. Los overrides deliberados son `E2E_WORKERS` (1–32) y
`E2E_GLOBAL_TIMEOUT_MS` (60.000–3.600.000 ms).

```powershell
$env:E2E_PORT = "3001"
$env:BASE_URL = "http://localhost:3001"
$env:E2E_START_WEB_SERVER = "1"
node node_modules/@playwright/test/cli.js test e2e/auth.spec.ts --project=chromium
```

Para reusar un servidor ya levantado, usar `E2E_START_WEB_SERVER=0`. El host
local canónico es `localhost`; no usar `127.0.0.1`, porque Next bloquea por
seguridad el HMR cross-origin de ese origen.

## Cobertura de autenticación y fixtures

El árbol contiene 14 archivos `*.spec.ts` al 2026-09-02. Esta tabla describe
los relacionados con el arranque y el paquete autenticado, no toda la suite.
«Implementado» significa que existe el test; no que pasó en el entorno actual.

| Spec existente | Alcance implementado | Requisito |
|---|---|---|
| `smoke.spec.ts` | Rutas públicas, HTTP y contenido | Sin seed autenticado |
| `auth.spec.ts` | Render y negativos de los cuatro logins | Sin seed autenticado |
| `comments-lifecycle.spec.ts` | Crear, eliminar, deshacer y restaurar; identidad y auditoría | App local o Preview con branch efímero + `seed:e2e` |
| `gastos-expense-void.spec.ts` | Abrir y cancelar confirmación R3 en Studio y móvil | Branch + seed + aliases `STUDIO_E2E_*` |
| `global-search.spec.ts` | Denegación sin sesión; apertura y faceta del buscador con sesión | Los dos casos Tier 3 requieren branch + seed |
| `nomina-settlement-void.spec.ts` | Abrir y cancelar confirmación R3 de finiquito | Branch + seed + aliases `STUDIO_E2E_*` |

El selector autenticado inferior contiene **seis casos lógicos × tres
proyectos = 18 ejecuciones**. Gastos y Nómina cancelan antes de mutar: no prueban
una anulación consumada. El caso de faceta de búsqueda usa una sola identidad
por corrida y acepta `Pagos|Contabilidad`: no demuestra por sí solo dos roles.
Ninguno de estos 18 casos inicia una sesión de cliente del Portal o de Back,
ni usa el PIN de operario; `/m/erp` reutiliza la sesión Studio.

Los nombres `journey-core.spec.ts`, `portal-cliente.spec.ts`,
`mobile-operario.spec.ts`, `studio-crud.spec.ts`, `finanzas.spec.ts` y
`rls-isolation.spec.ts` son **backlog, no archivos ejecutables existentes**.
Tampoco existen todavía `e2e/fixtures/auth.ts` ni `.github/workflows/e2e.yml`.
El CI de calidad sí existe en `.github/workflows/quality.yml`; no equivale a
aprovisionar un branch ni a ejecutar el paquete autenticado.

## Las 4 superficies de auth (cada una con su mecanismo)

| Surface | Ruta | Mecanismo | Cómo loguear en e2e |
|---|---|---|---|
| Studio | `/studio/login` | email + password (`signInWithPassword`) | tipear credenciales del seed |
| Back | `/back/login` | email + password (`signInWithPassword`) | tipear credenciales del seed |
| Portal | `/portal/login` | **magic link / OTP** (solo email) | **inyectar sesión** vía service-role (`admin.generateLink`), no se puede tipear |
| Operario VE | `/m/ve/login` | **PIN** numpad (`signInWithPin`, cookie HTTP-only) | clickear dígitos del numpad o setear la cookie de sesión |

## Entorno de test: branch de Supabase efímero (decisión 2026-06-23)

Los specs que hacen login + writes corren contra un **branch efímero de Supabase por
corrida CI** — NO contra prod ni dev. Flujo:

1. **Autorizar y crear branch** desde el control plane. Comprobar identidad,
   salud y ledger contra el manifiesto del checkout que se probará; crear un
   branch no demuestra que incluya las migraciones aún locales de esa rama.
   El [runbook efímero](../docs/runbooks/e2e-supabase-efimero.md) define los gates.
2. **Seed e2e** (`scripts/seed-e2e.ts`): fixture mínimo y determinista para
   SDD-0168, SDD-0226 y SDD-0243 (tenant + 2 usuarios + perfiles/membresías +
   embarque + gasto determinista `EXP-E2E-0243` por USD 24,30 + empleado y
   finiquito ficticios). El gasto queda ligado al embarque y al admin, con fecha
   fija al día 15 a las 12:00 UTC del mes de ejecución. Se niega a
   ejecutar contra el `project_ref` productivo y valida que URL/ref coincidan.
   Antes de la primera escritura hace polling read-only y acotado sobre las
   columnas requeridas; si la caché de PostgREST del branch no converge, aborta
   sin sembrar ni reintentar escrituras.
   La ampliación al journey transversal sigue pendiente:
   1 tenant + usuarios auth con email/password conocidos (Studio/Back) + 1 operario
   con PIN + datos operativos con IDs fijos (cliente, cotización, embarque).
   - Usuarios auth se crean con service-role (`auth.admin.createUser`).
   - Sesión del Portal se mintea con `auth.admin.generateLink` (magic link no tipeable).
3. **Correr** Playwright contra una app que use exclusivamente las variables del
   branch efímero. En local, usar `BASE_URL=http://localhost:<puerto>` y
   `E2E_START_WEB_SERVER=1`; contra Preview, usar su `BASE_URL` y
   `E2E_START_WEB_SERVER=0`. **Sólo `comments-lifecycle.spec.ts` configura el
   bypass** al recibir `VERCEL_AUTOMATION_BYPASS_SECRET`. Gastos, búsqueda y
   Nómina no instalan esos headers; sus contextos no heredan la cookie de
   comentarios y el config no tiene bypass global. Por eso, el paquete de
   18 casos requiere app local o un Preview autorizado accesible para los
   cuatro specs; esa variable sola no habilita el paquete en Preview protegido.
   No desactivar protecciones para superar este límite. Cuando
   `E2E_ENVIRONMENT_KIND=ephemeral`, el config valida el
   guard completo y deriva automáticamente los tres aliases `STUDIO_E2E_*` del
   fixture sembrado; si alguno fue definido con otro valor, aborta en vez de
   omitir silenciosamente los casos Tier 3.
   Desde SDD-0369, la URL E2E exige HTTPS y el host exacto
   `<E2E_SUPABASE_PROJECT_REF>.supabase.co`, sin credenciales, ruta de API,
   query, fragmento ni puerto no estándar. El ref debe ser una etiqueta DNS
   minúscula válida; una barra raíz o `:443` son equivalentes.
   Si Next declara `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   o `SUPABASE_SERVICE_ROLE_KEY`, deben coincidir con el entorno E2E validado;
   la pareja pública parcial y el flag deny-only activo también hacen abortar.
   Cuando Playwright inicia Next local, deriva las variables ausentes y
   normaliza las equivalentes; la service-role queda sólo en la variable del
   servidor, nunca en `NEXT_PUBLIC_*`. La preparación valida todo antes de
   modificar el entorno o sus aliases.
   En Preview sólo verifica coherencia declarada: no inyecta variables al
   servidor remoto ni demuestra qué backend usa. Eso requiere validación del
   entorno alojado autorizado. Este guard no completa el bootstrap ni el journey.
4. **Destruir branch** (`delete_branch`) al terminar.

### Selector exacto de los 18 E2E autenticados

El recorrido gobernado son 6 casos lógicos en 3 proyectos. El `grep` excluye el
caso Tier 1 adicional de `global-search`; los `--project` explícitos impiden que
un proyecto futuro cambie el total sin revisar este contrato.

```powershell
$env:E2E_PORT = "3001"
$env:BASE_URL = "http://localhost:3001"
$env:E2E_START_WEB_SERVER = "1"
node node_modules/@playwright/test/cli.js test `
  e2e/comments-lifecycle.spec.ts `
  e2e/gastos-expense-void.spec.ts `
  e2e/global-search.spec.ts `
  e2e/nomina-settlement-void.spec.ts `
  --grep "SDD-0168|Tier 3" `
  --project=chromium `
  --project=mobile-chrome `
  --project=mobile-safari `
  --workers=1
```

Como preflight no mutante, agregar `--list`: debe informar exactamente
`Total: 18 tests in 4 files`.

### Paquete actual y ampliación posterior

1. **Ejecutar el paquete existente:** autorización del ciclo de vida efímero,
   identidad y ledger comprobados, secretos sólo en proceso/secret manager,
   seed, los 18 casos sin omisiones, verificación y teardown terminal. No exige
   inventar el journey transversal, pero tampoco lo certifica.
2. **Ampliar el bootstrap del producto:** especificar fixtures por superficie
   (Portal con cliente/persona/vínculo, Back, operario con PIN y datos operativos),
   helpers de sesión y aislamiento por tenant, después los recorridos positivos
   y negativos. Concretar alcance y aceptación antes de implementar los archivos
   del backlog; no cambiar la política efímera ni usar datos reales.
3. **Automatizar el ciclo ya validado:** proponer un workflow E2E separado del
   CI de calidad, con costo, permisos, secretos de mínimo alcance y teardown en
   caso de error. Su activación requiere autorización; no guardar PAT ni claves
   en el repo ni copiar `.env.local` de producción.

## Convención
- Un spec por dominio/journey. Asserts sobre selectores estructurales (`name=`, roles),
  no sobre copy exacto que cambie seguido.
- Tests que necesitan seed van marcados con `test.describe` que documenta el prerequisito.
