# ui-pro reference: contexto por superficie

Carga esto en el Paso 0 (brief) — clasifica el alcance ANTES de juzgar. Rutas verificadas contra el árbol el 2026-07-06.

## Mapa superficie → contexto

| Superficie | Rutas | Tipografía | Término del ID | Densidad | Tokens / escala | Temas |
|---|---|---|---|---|---|---|
| **Sitio público** | `app/{estimacion,track,contacto,calculadora,servicios,noticias,glosario,registro,enlaces}/` + `components/` (raíz) | Archivo + Archivo Black | **MARKBOX** | Espaciosa (heros, prosa 65ch, body ≥16px) | `app/globals.css` + `lib/design-tokens.ts`; **escala 4px vía Tailwind** (`p-`/`gap-`/`m-`) + px crudos legítimos en `globals.css` — **NO** hay `--s-*` ni `--ease`/`--dur` | light |
| **Studio ERP** | `app/studio/(app)/<módulo>/` (55+ módulos) + `app/studio/_components/` | Nunito Sans + Sora (sistema del Norte) | **"Shipping Mark"** | Densa (tablas, KPIs; body 14px por diseño) | `app/studio/tokens.css` (canónico Norte: `docs/design/studio/_norte/erp/tokens.css`, read-only); `--s-*`, `--ease`, `--dur-*` | light + dark |
| **Portal cliente** | `app/portal/(app)/` + `app/portal/(auth)/` | Nunito Sans + Sora | **"Shipping Mark"** | Media | tokens del Studio (`--s-*`/`--ease`); hero temático usa `--hero-*` sobre navy (nunca `text-white`) | light + dark |
| **Móvil PWA** | `app/m/{cn,ve,emp,erp}/` | Nunito Sans + Sora | **"Shipping Mark"** | Media-densa; targets 44px; `h-dvh`; `safe-area-inset` | tokens del Studio + `app/m/m.css` | light + dark |
| **Back (CMS)** | `app/back/(app)/` | **Archivo** (usa `var(--font-archivo)`; el layout **NO** aplica `.studio-sys`, así que NO es Nunito/Sora) | — | Media | **Archivo/`app/globals.css` + hex propios del layout** (p. ej. `#FBFAF7`); el layout **NO** importa `tokens.css` del Studio, así que no asumas `--s-*` del ERP | light |

## Detección rápida por ruta

`app/studio/` → Studio · `app/portal/` → Portal · `app/m/` → Móvil · `app/back/` → Back · `components/` raíz o ruta pública de la tabla → Público. `app/invitar/` = onboarding del Studio (NO es público).

## Reglas transversales (aplican en todas las superficies)

- **Wordmark siempre Archivo Black** vía `<BrandMark>` (`components/BrandMark.tsx`) — único punto de entrada del logo; 4 variantes; `primary` jamás sobre navy (1.56:1).
- **JetBrains Mono** para códigos en TODAS las superficies. **Noto Sans SC** solo chino.
- `markbox` = identificador interno (columnas, RPCs, props); lo VISIBLE es **MARKBOX** (público) o **"Shipping Mark"** (superficies logueadas) — SDD-0065.
- **Frontera dura:** el sitio público NUNCA importa `@/lib/studio`, `@/lib/db` ni `@supabase/*` (ESLint la fuerza en `eslint.config.mjs`). Si el alcance mezcla superficies, audítalas por separado.
- **Norte vigente:** la versión vive al tope de `docs/design/studio/_norte/HANDOFF.md` (`## 🟢 Estado actual · vX.Y`) — detectala en vivo, nunca la hardcodees. `_norte/` es read-only.
- **Escala de spacing/motion por superficie:** Studio/Portal/Móvil usan tokens (`--s-*`, `--ease`, `--dur-*`); **el público usa Tailwind + px de `globals.css`** — no marques esos px como violación ni busques `--s-*`/`--ease` ahí (dimensiones 4 y 8).
- **La densidad calibra el juicio de spacing** (dimensión 4): una tabla ERP compacta correcta NO es "apretada"; un hero público con aire NO es "vacío".
- **Tablas de datos densas:** scroll horizontal propio en contenedor `overflow-x: auto` es CORRECTO (y las exime del reflow 2D de WCAG 1.4.10); el chrome de la página sí debe reflow a 320px.
- **Componentes del sistema primero** (Studio): `app/studio/_components/ui/` — ActionButton, Avatar, Badge, ClientCombobox, ColumnConfig, ConfirmDialog, DrawerShell, EmptyState, ErrorAlert, KpiCard, NumericInput, RealtimeIndicator, SegmentedControl, SplitActionButton, ToastProvider — + `_components/icons.tsx`.
- **Drawer:** patrón `<form id="X">` en el cuerpo + `<button type="submit" form="X">` en el footer (HTML5; no `requestSubmit()`).
- **Tema oscuro:** sobre navy usa `--ink-inv-soft`/`--ink-inv-mute` (Studio) o `--hero-*` (portal), nunca `rgba(255,255,255,X)` inline ni `text-white`.
