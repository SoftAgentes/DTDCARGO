# Design Handoff — DTD Studio v1.0

**Origen:** Claude Design (sesión paralela del founder Sam)
**Destino:** este repo, para implementación por Claude Code
**Estado:** ⏳ Pendiente — esperando archivos de Claude Design

---

## Qué va acá

Esta carpeta es el **handoff oficial** del diseño visual del Studio (ERP interno
de DTD·CARGO + base futura del ERP HailuWay). Cuando esté completo, Claude Code
procesa los archivos y genera:

- `design-tokens.md` consolidado (paleta, tipografía, spacing)
- `module-map.md` mapeando módulos del diseño → estado actual del código
- `roadmap.md` con secuencia de SDDs ordenados por prioridad

---

## Archivos esperados (de Claude Design)

| # | Archivo | Estado | Notas |
|---|---|:---:|---|
| 1 | `dtd-studio.html` | ⏳ | Single-file HTML con los 14 módulos. Fuente de verdad visual. |
| 2 | `design-tokens.json` | ⏳ | Paleta, tipo, spacing, radius, shadows, breakpoints. |
| 3 | `modules.md` | ⏳ | Inventario de los 14 módulos con propósito + pantallas + acciones. |
| 4 | `components.md` | ⏳ | Componentes reutilizables (botones, badges, tablas, etc.). |
| 5 | `copy.md` | ⏳ | Microcopy por módulo en español-VE. |
| 6 | `ux-decisions.md` | ⏳ | Decisiones de UX no obvias con su porqué. |
| 7 | `priority.md` | ⏳ | Roadmap de implementación priorizado. |
| 8 | `README.md` (de Claude Design) | ⏳ | Índice de los 7 anteriores. Se renombra a `_source-readme.md` al subir, para no pisar este. |

## Screenshots

| Carpeta | Contenido |
|---|---|
| `_screenshots/` | Capturas Win+Shift+S de cada módulo del preview de Claude Design. Nombrar `01-embarques.png`, `02-tracking.png`, etc. |

---

## Cómo subir los archivos

1. Generar archivos en Claude Design con el prompt acordado.
2. Descargar/copiar cada archivo a `docs/design/v1-studio/`.
3. Renombrar el README de Claude Design a `_source-readme.md` (no pisa este).
4. Tomar screenshots manuales (Win+Shift+S) y guardarlas en `_screenshots/` con
   los nombres numerados.
5. Commit: `docs(design): handoff v1 Studio desde Claude Design`
6. Avisar a Claude Code para que arranque el procesamiento.

---

## Invariantes a respetar (no cambian con el diseño)

Estas decisiones de SDD-0003 NO se modifican aunque el mockup sugiera otra cosa.
Si el diseño contradice alguna, Claude Code va a avisar antes de implementar:

1. **4 servicios cerrados**: `consolidacion` / `puerta_a_puerta_DDP` / `reserva_FCL` / `transporte_terrestre`
2. **13 estados con matriz por servicio** (ver `lib/studio/shipment-state-machine.ts`)
3. **Soft delete + RLS + `tenant_id` por JWT** (seguridad)
4. **Multi-tenant ready** (schema preparado para HailuWay)
5. **Español-VE exclusivo**, sin estructura i18n
6. **"Puerta a Puerta DDP"** siempre con **"prepago"** en chico (convención memoria persistente)

---

## Estado de la implementación actual (snapshot al 23-may-2026)

Para que Claude Design (o el lector) entienda qué existe ya en el código antes
de mockear:

- ✅ `app/studio/(app)/tracking/` — lista + detalle + filtros (SDD-0005, SDD-0006)
- ✅ `app/studio/(app)/tracking/nuevo/` — form de creación
- ✅ `app/studio/(app)/resumen/` — dashboard KPIs
- ✅ `app/studio/(auth)/login/` — auth
- ✅ `app/studio/(app)/ajustes/` — placeholder vacío
- ⏳ **SDD-0007 — Módulo Tarifas** — pausado esperando este handoff
- 🔮 Todo lo demás del diseño (Clientes, CRM, Cotizador, Almacenes, Facturación,
  Documentos, Vault, Reportes, Mailing, Usuarios&Roles) — no existe aún
