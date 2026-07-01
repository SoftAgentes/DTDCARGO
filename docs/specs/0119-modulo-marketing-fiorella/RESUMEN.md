# RESUMEN — SDD-0119 Módulo de Marketing (cascarón / "el vestido")

**Rama:** `feat/sdd-0119-modulo-marketing` · **Ventana:** secundaria · **Fecha:** 2026-06-30

## Qué se construyó (cascarón completo del módulo)

Vista de inicio del módulo de Marketing + navegación de las 6 secciones, sobre los
patrones existentes del Studio (sin migración nueva en este trabajo; la 0189 del rol
ya estaba en la rama).

### Archivos nuevos
- `app/studio/(app)/marketing/page.tsx` — Dashboard "buenos días": saludo dinámico
  por usuario autenticado (reusa el patrón del dashboard operativo), "Tareas del día"
  (placeholder del Motor de Noticias), grid de 5 cards de herramientas, card
  "reportar fricción".
- `app/studio/(app)/marketing/hub/page.tsx` — **HUB de marca (estructura + secciones)**:
  sección "Logos" REAL (los 4 isólogos oficiales de `public/brand/` descargables, cada
  uno sobre su fondo previsto) + 3 secciones placeholder (Fondos/portadas, Plantillas,
  Herramientas). Los tiles de logo fijan los 2 colores canónicos de BRAND.md (navy/paper)
  porque `--color-*` se invierte con el tema dark del Studio — uso correcto para galería
  de assets, documentado en el archivo.
- `app/studio/(app)/marketing/calendario/page.tsx` — **Calendario de contenido 2026**:
  semilla curada de 18 fechas clave VE + China (cierres de fábrica: Año Nuevo Chino,
  Semana Dorada, 11.11, Feria de Cantón, etc.) agrupadas por mes, con badge de región y
  nota "por qué importa". Borrador: se afina con la Sra. Fátima; sync Notion futuro.

### Archivos modificados
- `lib/studio/modules.ts` — registra el módulo dedicado `marketing` (icono `spark`,
  slug `/studio/marketing`) antes de Noticias Web en el grupo MARKETING.
- `lib/studio/rbac.ts` — entrada en la matriz: `marketing → [marketing, commercial, support]`
  (+admin siempre).
- `app/studio/studio.css` — clase `.studio-card-link` (hover lift + focus-visible +
  prefers-reduced-motion).

### Decisiones
- Motor/Academia/Comunidad **enlazan** a sus módulos existentes (noticias-web/academia/
  club), no se duplican (como dicta la spec §Alcance).
- HUB y Calendario son las únicas rutas internas nuevas, en placeholder.

## Gates verdes
- `tsc --noEmit` ✅
- ESLint (incluye frontera público↔ERP) ✅
- 13 tests RBAC anti-drift (matriz↔modules) ✅
- `next build` ✅ — las 3 rutas `/studio/marketing/{,hub,calendario}` compilan
- UI/UX review (ui-ux-designer) ✅ aprobado; se aplicaron sus 2 fixes de mayor valor
  (Badge del sistema para status + diferenciar cards "Próximamente") y se cazó un bug
  de token (`var(--surface)` no existía → cambiado a `var(--bg-surface)`).

## Pendiente del Director (no lo hace la ventana secundaria)
- Aplicar la **migración 0189** (rol `marketing`) a producción — sin eso, asignar el
  rol falla el CHECK en DB.
- Integrar/mergear esta rama tras `node scripts/verify.mjs` + `pnpm build`.
- **No** se hizo push (espera OK del founder).

## Próximo (futuro, no en este cascarón)
- Construir HUB real (logos/fondos/plantillas), Calendario anual (VE/China) y la sync
  Notion ↔ ERP; cablear "Tareas del día" al Motor de Noticias; "reportar fricción" →
  cola de automatización con `<ActionButton>`.
