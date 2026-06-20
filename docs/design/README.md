# `docs/design/` · Índice maestro de diseño y marca

> **Carpeta predeterminada para TODO lo relacionado con branding, diseño visual, mockups, handoffs y assets de marca.** Si llega un entregable visual nuevo desde un diseñador, agencia o Cloud Design, esta es la única ubicación válida.

---

## ⚠️ Estado (purga brand v3.7 · 2026-06-10)

- **Lo único vigente es el Norte:** [`studio/_norte/`](studio/_norte/) (protocolo NORTE-SYNC; bitácora en [`studio/NORTE-CHANGELOG.md`](studio/NORTE-CHANGELOG.md)).
- **El Brand Book vigente es UNO solo** — el de mayor versión en `_norte/` (hoy **`Brand Book DTD v4.4.html`**). Al llegar uno nuevo: se reemplaza y **se borra el anterior** (acá y en `public/marca/`). Publicado privado: `/marca/brand-book` · hub interno del equipo: `/interno/marca`.
- **Las carpetas históricas de diseño se eliminaron del working tree el 2026-06-10** (decisión founder; la historia completa vive en git — lista exacta en la entrada 2026-06-10 de [`studio/NORTE-CHANGELOG.md`](studio/NORTE-CHANGELOG.md)). Para consultarlas: `git log --oneline -- "docs/design/<carpeta>"` y checkout del commit.
- **Anti-drift:** `/radar` corre el **gate de marca** (Regla 0.5) — cero referencias a books/carpetas pre-v3.7 en archivos vivos, casing "Con Confianza", terminología Shipping Mark, y book publicado == book del Norte.

## Estructura actual

```
docs/design/
├── README.md                  ← este archivo
└── studio/
    ├── _norte/                ← ÚNICO material de diseño vigente (Cloud Design · NORTE-SYNC)
    ├── NORTE-CHANGELOG.md     ← bitácora humana de las cargas del Norte
    └── bug-reporter-v1.4.1/   ← handoff del módulo Bug Reporter (asset de la spec SDD-0036; registro, no marca)
```

## Reglas de organización

1. **Material de Cloud Design** → SIEMPRE vía protocolo NORTE-SYNC a `studio/_norte/` (mirror del ZIP + exclusiones + entrada en `NORTE-CHANGELOG.md`). No crear carpetas por versión.
2. **Entregable visual de OTRO origen** (agencia, freelance) → `docs/design/<producto>/<vM.m.p-origen>/` con README adentro (origen, fecha, alcance).
3. **Assets de producción del sitio** → `public/brand/` (ver su README; copias derivadas del book).
4. **Adjuntos de docs** → `docs/.../assets/` si <1 MB (regla ISO §7.5 en `docs/README.md`).

## Convención de nombres

- **Productos**: `studio/`, `sitio-publico/`, `mobile/`, `micro-sites/`
- **Versiones** (solo para material fuera del Norte): `vM.m.p-<origen>/`
- **Archivado**: ya NO se archivan copias en el working tree — se borran y se consultan por git (`git log -- <path>`).

## Relación con BRAND.md (raíz)

`BRAND.md` (en la raíz del repo) sigue siendo la **fuente única de las reglas de marca** (colores prohibidos, tipografías permitidas, tonos de copy, anti AI slop) — re-sincronizado con el CLAUDE.md del Norte en cada carga. Este README es el índice de **dónde viven los materiales**.

- Reglas de marca → `BRAND.md` (espejo del `_norte/CLAUDE.md`)
- Materiales visuales → `docs/design/studio/_norte/`
- Tokens CSS de producción → `app/globals.css` (web) · `app/studio/tokens.css` (Studio)
