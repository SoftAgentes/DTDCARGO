# `docs/design/` · Índice maestro de diseño y marca

> **Carpeta predeterminada para TODO lo relacionado con branding, diseño visual, mockups, handoffs y assets de marca.** Si llega un entregable visual nuevo desde un diseñador, agencia o Claude Design, esta es la única ubicación válida.

---

## ⚠️ Estado (reorg ISO · 2026-05-29)

- **Versión activa del Studio: `v1.7-claude-design`.** Anteriores: `_archivo-*` (no consultar para decisiones nuevas).
- **Reglas de ubicación de archivos → [`/CLAUDE.md`](../../CLAUDE.md) §"Organización · ISO 9001 §7.5"** (fuente única; este README es índice de *materiales*, no de reglas).
- Backups ZIP de `handoffs-archive/` están **fuera de git** (gitignored); ver su README.
- La "Estructura actual" de más abajo quedó desactualizada (menciona v1.3.1) — refresh completo pendiente para una sesión de diseño dedicada.

## Regla de organización (vigente desde 2026-05-24)

A partir de hoy:

1. **TODO handoff visual nuevo** → `docs/design/<producto>/<version-origen>/` con README.md adentro explicando origen, fecha y alcance.
2. **Asset de marca** (logo, isotipo, favicon, OG image) → `docs/design/brand-assets/<categoría>/`.
3. **Rollback visual** → `docs/design/rollbacks/YYYY-MM-DD-<feature>/`.
4. **Documentación de tokens** (colores, fonts, spacing extraídos del handoff) → `docs/design/tokens/`.

**NO usar** `_handoff_preview/` ni `BANDBOOK V1/` para nada nuevo (quedan como legacy histórico, no se borran para no romper links pero no se agregan más archivos ahí).

---

## Estructura actual

```
docs/design/
├── README.md                              ← este archivo
├── module-map.md                          ← mapa de módulos del Studio v1
├── studio/                                ← Producto 1: ERP Studio interno
│   ├── v1-original/                       ← (pendiente migrar v1-studio/)
│   └── v1.3.1-claude-design/              ← entrega Claude Design 2026-05-24
│       ├── README.md
│       ├── PROMPT-CLAUDE-CODE.md          ← guía de operación del sandbox
│       ├── proyecto/                      ← v1.3.1 actual (119 archivos)
│       └── _archivo-v1.3/                 ← v1.3 anterior, para diff histórico
├── v1-studio/                             ← (legacy: handoff inicial del Studio, migrar después)
└── handoffs-archive/                      ← backups ZIP originales
    ├── DTD-Cargo-v1.3.1.zip
    └── DTD-Cargo-handoff-v1.3.1.zip
```

### Carpetas futuras (cuando aparezcan entregables)

```
docs/design/
├── studio/<version-nueva>/                ← próximas iteraciones del Studio
├── sitio-publico/                         ← Producto 2: dtdcargo.com (migrar _handoff_preview/dtd-cargo)
├── mobile/                                ← Producto 3: app móvil nativa (futuro)
├── micro-sites/                           ← landings standalone (migrar _handoff_preview/transporte-cbm-china-venezuela)
├── brand-assets/                          ← logos, isotipos, favicons (transversal)
├── tokens/                                ← referencia colors.json + typography.json
└── rollbacks/                             ← cambios visuales revertidos
```

---

## Convención de nombres

- **Productos**: `studio/`, `sitio-publico/`, `mobile/`, `micro-sites/`
- **Versiones**: `vM.m.p-<origen>/` (ej: `v1.3.1-claude-design`, `v2.0-figma`, `v1.0-agencia-x`)
- **Rollbacks**: `YYYY-MM-DD-<slug-feature>/`
- **Sub-carpeta del proyecto descomprimido**: siempre se llama `proyecto/` (consistencia entre handoffs)
- **Sub-carpetas archivadas** (versiones anteriores conservadas): prefijo `_archivo-` (ej: `_archivo-v1.3/`)

---

## Material legacy (NO mover sin sesión dedicada)

Estos paths existen desde antes de la regla, los respetamos por compatibilidad pero NO se les agrega nada nuevo:

- `_handoff_preview/dtd-cargo/project/` — handoff inicial del sitio público (Brand Book v1, Glosario DDP mockup, WhatsApp FAB mockup)
- `_handoff_preview/transporte-cbm-china-venezuela/` — mini-sitio CBM standalone v1.6
- `_handoff_preview/_rollback-2026-05-21-fab/` — rollback fechado del WhatsApp FAB
- `_handoff_preview/tarifas-terrestres/` — referencias de tarifas (PDFs)
- `BANDBOOK V1/` — Brand Book v1 archivado
- `docs/design/v1-studio/source/` — handoff oficial inicial del Studio v1 (módulos JSX + Brand Book v2.4 + portales/operarios HTML)

**Migración futura**: en sesión dedicada mover todos a `docs/design/<producto>/<version>/` con READMEs de redirect en los paths viejos.

---

## Relación con BRAND.md (raíz)

`BRAND.md` (en la raíz del repo) sigue siendo la **fuente única de las reglas de marca** (colores prohibidos, tipografías permitidas, tonos de copy, anti AI slop). Este `docs/design/README.md` es el índice de **dónde viven los materiales** que aplican esas reglas.

- Reglas de marca → `BRAND.md`
- Materiales visuales → `docs/design/`
- Tokens CSS de producción → `app/studio/tokens.css`
