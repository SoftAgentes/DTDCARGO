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

```powershell
$env:E2E_PORT = "3001"
$env:BASE_URL = "http://localhost:3001"
$env:E2E_START_WEB_SERVER = "1"
node node_modules/@playwright/test/cli.js test e2e/auth.spec.ts --project=chromium
```

Para reusar un servidor ya levantado, usar `E2E_START_WEB_SERVER=0`. El host
local canónico es `localhost`; no usar `127.0.0.1`, porque Next bloquea por
seguridad el HMR cross-origin de ese origen.

**Auth WebKit / H2 (diagnóstico 2026-09-10):** esa nota de HMR no explica por sí
sola un `Fetch API cannot load .../auth/v1/user due to access control checks`.
WebKit también usa ese mensaje cuando falla el transporte del preflight; un
puerto cerrado reproduce `Load failed` sin respuesta ni cabecera CORS que validar.
La sonda anónima nativa contra Supabase HTTPS real expuso **401 en ambos motores**,
incluido el origen de documento `https://dtdcargo.com`. El transporte directo local
no estaba publicado; la medición auxiliar contra Kong se documenta separadamente.
Consulta el [dictamen, matriz y recibos D2](../docs/qa/d2-webkit-auth-cors.md) antes
de clasificar ese mensaje como fallo confirmado de producto. El mecanismo exacto
del evento H histórico sigue inconcluso: no se conserva respuesta Auth de Safari.
Conserva el error y verifica transporte, OPTIONS, respuesta visible desde JS y
navegaciones; no lo silencies ni generalices una excepción a todo `Load failed`.
El `beforeEach` de 90 s de la corrida E es una incidencia distinta según sus
primarios, anterior a cargar producto; tampoco es el cierre de workers mencionado
abajo. La sonda opt-in vive en `e2e/diagnostics/` y no entra en la suite general.

En una corrida local general el harness abre `min(8, max(1, floor(núcleos/2)))`
workers —la mitad de la máquina con tope de ocho, nunca más que el default
histórico de Playwright— y 1 en CI o cuando `E2E_ENVIRONMENT_KIND=ephemeral`.
Esto evita convertir las 168 pruebas sobre un único branch efímero en una prueba
de carga accidental. `E2E_WORKERS=1..32` permite un override explícito cuando se
mida otro perfil de concurrencia, y es la única vía para pedir más de lo que da
la máquina. El kind se recorta igual que en el guard: ` ephemeral ` conserva un
worker. Serializar es una concesión consciente: con un worker no se detectan
regresiones de paralelismo (ver la tabla de gobernanza de SDD-0440).
Aparte de eso, `mobile-safari` se limita a un worker en Windows porque el cierre
de WebKit deja el proceso colgado; el límite es por proyecto y no afecta a
`chromium` ni a `mobile-chrome`.

## Sin Supabase público (SDD-0470)

`proxy.ts` crea el cliente Supabase con `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` en cada ruta de su `matcher` (`/studio`, `/back`,
`/portal`, `/m/erp`, `/m/emp`, `/entrar`, `/registro`). Sin esas variables lanza
«Your project's URL and Key are required» y la ruta responde con la página de
error del dev server. Un worktree nuevo no trae `.env.local`, y en el checkout
principal `.env.local` es un directorio.

- **Detección única:** `e2e/_helpers/supabase-publico.cjs`. Mira el entorno del
  proceso y los `.env*` que carga `next dev`, con su misma precedencia
  (`.env.development.local`, `.env.local`, `.env.development`, `.env`). Un
  `.env.local` que no es archivo se ignora, igual que en Next. Sólo aplica si
  `baseURL` es local: contra un Preview no se omite nada.
- **Declaración explícita:** cada prueba que necesita Supabase llama a
  `requiereSupabase()` (de `e2e/_helpers/supabase.ts`) en la primera línea de
  su cuerpo. Sin las variables, la prueba queda **omitida** con un motivo que
  empieza por `SIN SUPABASE PÚBLICO`. No falla, no se reintenta y no pasa en
  falso.
- **Quiénes la llaman, con evidencia:** la corrida base sin variables del
  2026-09-15 (SDD-0470) muestra estos cinco casos fallando en chromium,
  mobile-chrome y mobile-safari, en el intento y en el reintento:
  - `auth.spec.ts:21` (Studio), `:91` (Back), `:98` y `:105` (Portal);
  - `global-search.spec.ts:22`.

  El inventario vive también en `scripts/tests/verify-e2e-sin-supabase.node.mjs`:
  quitar o agregar una llamada sin actualizarlo rompe `harness:test`.
- **Siguen corriendo sin Supabase**, porque lo que afirman no depende de él:
  - `auth.spec.ts:42` y `:74` (`/acceso`, fuera del matcher; la página atrapa el
    error del cliente admin);
  - `auth.spec.ts:130` (`/m/ve/login`, fuera del matcher);
  - `smoke.spec.ts:150` (afirma la URL de destino del redirect, que llega a
    `/entrar` igual);
  - `attachments-gastos-pilot-network.spec.ts:4` (abre `/studio/login` sólo como
    origen y afirma el cuerpo del `fetch` que lanza).
- **En `pnpm verify`:** el preflight avisa qué falta. Después del paso sale
  `[AVISO] e2e: COBERTURA PARCIAL — N prueba(s) omitidas sin Supabase público
  (…)` con la lista `archivo:línea «título» [proyectos]`. El veredicto dice
  `CIERRE INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL: e2e [...]`. Es la misma
  semántica que una omisión crítica: exit 0 si no hubo otros fallos, y nunca
  `TODO VERDE`.
- **Para medirlas:** hace falta un Supabase autorizado (branch efímero o
  Supabase local) con sus variables públicas. Nunca copies credenciales de
  producción a un worktree para ponerlo verde.

Los Tier 3 que se omiten por falta de seed (`STUDIO_E2E_*`) conservan su
propio `test.skip` y su motivo. Esta sección no cambia cómo se reportan.

## Estado de cobertura

| Spec | Tier | Estado | Requiere |
|---|---|---|---|
| `smoke.spec.ts` | 0 | ✅ | nada (rutas públicas, 200 + contenido) |
| `auth.spec.ts` | 1 | ✅ | Supabase público en 4 de 7 casos (render + negativos de los 4 logins); ver «Sin Supabase público» |
| `comments-lifecycle.spec.ts` | 1 | ✅ | Preview + branch efímero + `seed:e2e` |
| `journey-core.spec.ts` | 1 | ⬜ pendiente | branch + seed-e2e |
| `portal-cliente.spec.ts` | 2 | ⬜ | branch + seed-e2e |
| `mobile-operario.spec.ts` | 2 | ⬜ | branch + seed-e2e |
| `studio-crud.spec.ts` | 3 | ⬜ | branch + seed-e2e |
| `finanzas.spec.ts` | 3 | ⬜ | branch + seed-e2e |
| `nomina-settlement-void.spec.ts` | 3 | ✅ | branch efímero + `seed:e2e` + `STUDIO_E2E_*` |
| `rls-isolation.spec.ts` | 4 | ⬜ | branch + seed-e2e (2 tenants) |

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

1. **Crear branch** (Supabase MCP `create_branch` o `supabase branches create`) → DB limpia
   con todas las migraciones aplicadas.
2. **Seed e2e** (`scripts/seed-e2e.ts`): fixture mínimo y determinista para
   SDD-0168, SDD-0226 y SDD-0243 (tenant + 2 usuarios + perfiles/membresías +
   embarque + gasto determinista `EXP-E2E-0243` por USD 24,30 + empleado y
   finiquito ficticios). El gasto queda ligado al embarque y al admin, con fecha
   fija al día 15 a las 12:00 UTC del mes de ejecución. Se niega a
   ejecutar contra el `project_ref` productivo y valida que URL/ref coincidan.
   Acepta únicamente `https://<ref>.supabase.co` o su raíz con `/`, sin userinfo,
   puertos explícitos, paths, query/hash ni dominios alternativos. No confundir
   compartir el primer segmento del hostname con pertenecer al mismo origen.
   También normaliza la fila `calculator_settings` del tenant público `dtd`
   con los `DEFAULT_PARAMS` del código vigente; así un branch recién reconstruido
   no conserva los defaults históricos de 0103 ni cambia los totales esperados.
   Esa es la única escritura fuera del tenant de fixture y no lleva respaldo, así
   que el seed imprime primero una línea
   `{"step":"calculator-settings-baseline",…}` con los valores previos y aborta
   si no puede leerlos: un apuntado equivocado queda en el log de la corrida.
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
   `E2E_START_WEB_SERVER=0`. Si el Preview usa Vercel Authentication, definir
   también `VERCEL_AUTOMATION_BYPASS_SECRET`; el spec envía los headers
   oficiales de bypass sin volver obligatoria esa variable para entornos
   desprotegidos. Cuando `E2E_ENVIRONMENT_KIND=ephemeral`, el config valida el
   guard completo y deriva automáticamente los tres aliases `STUDIO_E2E_*` del
   fixture sembrado; si alguno fue definido con otro valor, aborta en vez de
   omitir silenciosamente los casos Tier 3.
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

### Pendiente de wiring (próximos pasos, en orden)
1. Ampliar `scripts/seed-e2e.ts` más allá del fixture SDD-0168 al journey operativo
   transversal.
2. `e2e/fixtures/auth.ts` — helpers de login por rol + `storageState` reutilizable
   (password para Studio/Back, inyección de sesión para Portal, cookie/numpad para operario).
3. `.github/workflows/e2e.yml` — **primer workflow CI del repo**: create_branch → seed →
   test → delete_branch. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Specs Tier 1 con seed: `journey-core.spec.ts` (cotización → prealerta → orden → embarque).

## Convención
- Un spec por dominio/journey. Asserts sobre selectores estructurales (`name=`, roles),
  no sobre copy exacto que cambie seguido.
- Tests que necesitan seed van marcados con `test.describe` que documenta el prerequisito.
