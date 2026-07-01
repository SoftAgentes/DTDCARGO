# RESUMEN · feat/portal-nav-norte

Ventana secundaria (Modo Forja). Rama `feat/portal-nav-norte`. **NO push.**

## Objetivo (founder)

Llevar el **menú de arriba del Portal del Cliente** al Norte: el "nav de seis destinos"
(`docs/design/studio/_norte/Portal del Cliente · Rediseño`, sección 01). Alcance elegido:
**menú + fusionar rutas** (a nivel IA). Club **oculto por defecto** (solo si el cliente
está habilitado).

## Qué se hizo

### Top-nav → 6 destinos (Norte)
Antes (11): Inicio · Mis envíos · Compras · Finanzas · Documentos · Reclamos · Referidos ·
Academia · Club · Mensajes · Cuenta.
Ahora (6 + Club gated): **Inicio · Mis envíos · Finanzas · Referidos · [Club] · Academia · Soporte**.

- **Compras (proveedores/compras) y Documentos** salieron del top-nav → viven **dentro de
  Mis envíos** (sub-pestañas `EnviosHubTabs`: Envíos · Compras · Documentos).
- **Mensajes + Reclamos** → **Soporte** (sub-pestañas `SoporteHubTabs`). El destino se
  llama "Soporte" y apunta a `/portal/mensajes`.
- **Cuenta** salió del top-nav → **cuelga del nombre** (`PortalAccountMenu`: Mi cuenta ·
  Mi perfil · Cerrar sesión, con avatar de iniciales).
- **Club** junto a Referidos, pero **gated**: solo aparece si `isPortalClubMember` (hoy =
  es miembro del Club; `TODO` para el flag de módulo por tenant cuando exista el admin del Club).

### Archivos
Nuevos:
- `app/portal/_components/PortalHubTabs.tsx` — `EnviosHubTabs` + `SoporteHubTabs` (client, theme-aware).
- `app/portal/_components/PortalAccountMenu.tsx` — menú del nombre (dropdown, cierre por clic-afuera/Escape).

Cambiados:
- `app/portal/_components/PortalNav.tsx` — LINKS a 6 destinos, `showClub` prop, match de hubs.
- `app/portal/_components/PortalHeader.tsx` — usa `PortalAccountMenu`, recibe `showClub`.
- `app/portal/(app)/layout.tsx` — calcula `showClub` con `isPortalClubMember`.
- `lib/portal/portal-club-queries.ts` — helper barato `isPortalClubMember`.
- Sub-pestañas inyectadas en: `envios` (ramas Norte + clásica), `proveedores`, `compras`,
  `documentos` (EnviosHubTabs); `mensajes`, `reclamos` (SoporteHubTabs).

## Lo que se DEFIRIÓ (necesita al Director)

**Embed profundo de Compras dentro del detalle del envío** (join en BD compras↔envíos, el
"paso 1 → resultado" del Norte). El mapa confirmó que compras (prealertas) y envíos son
**entidades paralelas, no jerárquicas** → es refactor grande. **Pisa `feat/portal-inventario`
+ SDD-0075 §1.** Acá se hizo la fusión a nivel **IA/menú** (Compras/Documentos viven dentro
de Mis envíos por sub-pestañas), sin tocar el modelo de datos. El embed profundo lo secuencia
el Director vs. portal-inventario.

## ⚠️ Colisión conocida

`feat/portal-inventario` trabaja el portal→Norte. Tocamos `PortalNav.tsx` y páginas del
portal — el Director debe resolver el merge/orden vs. esa rama.

## Verificación

- `node scripts/verify.mjs` → **TODO VERDE**: lint (0 errores), rsc-boundary, typecheck,
  **2965 tests** (205 archivos), docs:check.
- Revisión `ui-ux-designer` (regla del founder) — [ver estado abajo].
- node_modules del worktree = junction al repo principal (mismo commit base); se remueve al cerrar.

## Follow-ups
- Admin del Club: flag de módulo activo por tenant → completar `isPortalClubMember`.
- Embed profundo Compras↔Envíos (con el Director / portal-inventario).
- El nav "Soporte" apunta a `/portal/mensajes`; evaluar una ruta canónica `/portal/soporte` si se quiere.
