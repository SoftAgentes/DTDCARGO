# e2e · Playwright

Tests end-to-end de DTD Cargo. Separados de los unit (`__tests__/`, Vitest).

## Cómo correr

```bash
pnpm test:e2e                          # auto-levanta dev en :3001 (config webServer)
pnpm test:e2e e2e/auth.spec.ts         # un solo spec
pnpm test:e2e:ui                       # modo interactivo
```

⚠️ **Windows:** el `webServer` del config invoca `next` pelado y no resuelve por PATH.
Workaround: levantá el dev a mano y apuntá `BASE_URL` (saltea el webServer):

```bash
node node_modules/next/dist/bin/next dev --port 3001    # en otra terminal
BASE_URL=http://localhost:3001 node node_modules/@playwright/test/cli.js test e2e/auth.spec.ts --project=chromium
```

## Estado de cobertura

| Spec | Tier | Estado | Requiere |
|---|---|---|---|
| `smoke.spec.ts` | 0 | ✅ | nada (rutas públicas, 200 + contenido) |
| `auth.spec.ts` | 1 | ✅ | nada (render + negativos de los 4 logins) |
| `journey-core.spec.ts` | 1 | ⬜ pendiente | branch + seed-e2e |
| `portal-cliente.spec.ts` | 2 | ⬜ | branch + seed-e2e |
| `mobile-operario.spec.ts` | 2 | ⬜ | branch + seed-e2e |
| `studio-crud.spec.ts` | 3 | ⬜ | branch + seed-e2e |
| `finanzas.spec.ts` | 3 | ⬜ | branch + seed-e2e |
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
2. **Seed e2e** (`scripts/seed-e2e.ts`, pendiente): 1 tenant + usuarios auth con
   email/password conocidos (Studio/Back) + 1 operario con PIN + datos operativos con
   IDs fijos (cliente, cotización, embarque) para asserts deterministas.
   - Usuarios auth se crean con service-role (`auth.admin.createUser`).
   - Sesión del Portal se mintea con `auth.admin.generateLink` (magic link no tipeable).
3. **Correr** Playwright con `BASE_URL` apuntando al deploy/preview del branch.
4. **Destruir branch** (`delete_branch`) al terminar.

### Pendiente de wiring (próximos pasos, en orden)
1. `scripts/seed-e2e.ts` — seed operativo determinista (hoy `scripts/seed.ts` solo siembra
   catálogos globales, no data de tenant).
2. `e2e/fixtures/auth.ts` — helpers de login por rol + `storageState` reutilizable
   (password para Studio/Back, inyección de sesión para Portal, cookie/numpad para operario).
3. `.github/workflows/e2e.yml` — **primer workflow CI del repo**: create_branch → seed →
   test → delete_branch. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Specs Tier 1 con seed: `journey-core.spec.ts` (cotización → prealerta → orden → embarque).

## Convención
- Un spec por dominio/journey. Asserts sobre selectores estructurales (`name=`, roles),
  no sobre copy exacto que cambie seguido.
- Tests que necesitan seed van marcados con `test.describe` que documenta el prerequisito.
