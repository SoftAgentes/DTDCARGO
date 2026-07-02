# RESUMEN · lane `configuracion-erp`

**Ventana:** secundaria (no push, no merge, no migrations a prod).
**Rama:** `feat/configuracion-erp` (off `main`, sin upstream).
**Worktree:** `DTD-worktrees/configuracion-erp`.
**Tarea:** llevar el side-nav del módulo **Administración** (`/studio/admin`) a la
estructura del **Norte** (`docs/design/studio/_norte/erp/modules/admin.jsx`).

## Qué se hizo

Un solo archivo tocado:
`app/studio/(app)/admin/page.tsx` — reorganizado el array `SECTIONS`, el tipo
`SectionGroup` y `GROUP_ORDER` para que el sidebar interno espeje el Norte.

### Antes (prod) → Después (Norte)

| Grupo | Antes | Después (= Norte) |
|---|---|---|
| **BÁSICO** | company · features · masterdata · rates · holidays · appearance (6) | + **fiscal** (Impuestos · IVA/SENIAT) · + **routes** (Administrar rutas) · holidays renombrado "Feriados CN/VE" (8) |
| **MARCA** | *(no existía)* | **grupo nuevo**: brand-system · brand-icons · brand-apps · brand-ads · brand-studio (5) |
| **INTERMEDIO** | permissions · audit · numbering (3) | + **legal-docs** (Documentos legales) · + **acceptances** (Aceptaciones T&C) (5) |
| **PRO** | agents · api · workflows · import (4) | api · workflows · import + **agents al final** (ver decisión) (4) |

### Cableado de las secciones nuevas

- **fiscal** → `href /studio/fiscal` (módulo dedicado, ya vivo).
- **routes** → `href /studio/admin/rutas` (módulo dedicado, ya vivo).
- **legal-docs** → `href /studio/legal` (módulo dedicado, ya vivo).
- **MARCA (5)** y **acceptances** → placeholders (`PendingSectionPanel`), como el
  resto de secciones aún no construidas. No inventé rutas: cada descripción apunta
  a dónde vive hoy la fuente de verdad (Norte / Brand Book / módulo Marketing /
  docs/marketing).

El componente `Content` ya resolvía automático: con `href` → CTA "módulo dedicado";
sin `href` → placeholder "por implementar". No hubo que tocarlo.

## Decisiones (para revisión del Director/founder)

1. **Agentes y Skills se CONSERVA** aunque el Norte no lo lista. Es feature LIVE
   (SDD-0020, `/studio/admin/agentes`) y esta era su única entrada de nav —
   borrarla la dejaba huérfana. Queda al final de PRO, marcado como desvío del
   Norte en su descripción. → ¿Se mantiene o se saca del nav de admin?
2. **MARCA (5) queda visible como placeholders.** El Norte lo muestra poblado, así
   que "espejar el Norte" implica mostrarlo. Alternativa: ocultar hasta construir.
   → ¿Se dejan visibles (marcan roadmap) o se ocultan hasta tener contenido real?
3. **fiscal/routes/legal-docs enlazan a módulos top-level** que ya existen en el
   sidebar principal (patrón `href`, igual que features→feature-flags). Es
   duplicación intencional de acceso, no de código. → OK salvo objeción.

## Verificación

- `tsc --noEmit` → **exit 0**.
- `eslint app/studio/(app)/admin/page.tsx` (incluye regla de frontera) → **exit 0**.
- **Pendiente (Director):** `node scripts/verify.mjs` + `pnpm build` antes de merge.
- **Pendiente:** check `ui-ux-designer` pre-merge (regla del founder; cambio de nav).

## Nada de esto se pushea. Merge + push los hace el Director con OK del founder.
