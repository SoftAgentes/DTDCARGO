# `docs/` — Índice maestro

> **Fuente única de "dónde va cada cosa".** Antes de crear un archivo en `docs/`, mirá la tabla de abajo.
> Las reglas de organización viven en [`/CLAUDE.md`](../CLAUDE.md) (sección **Organización · ISO 9001 §7.5**); este README es el índice.

## Criterio (ISO 9001 §7.5 · información documentada)

No buscamos certificación — adoptamos la **disciplina**. Cada documento controlado tiene **4 cosas**:
**dueño · estado · fecha · una sola ubicación correcta.** Eso es todo el sistema de gobierno.

## ¿Dónde va X?

| Tengo un… | Va en… |
|---|---|
| Feature nueva a construir (spec) | `docs/specs/NNNN-slug/spec.md` (+ `assets/` si tiene adjuntos) |
| Diagrama / payload de ejemplo de un spec | el `assets/` **de ese spec** |
| Guía de setup / operativa | `docs/runbooks/` (+ `assets/<slug>/` si tiene capturas) |
| Auditoría (seguridad, RLS, sistema) | `docs/audits/` |
| Reporte de QA | `docs/qa/` |
| Explicación "cómo funciona el sistema" | `docs/architecture/` |
| Decisión "por qué elegimos X" (ADR) | `docs/architecture/decisions/` |
| Gobernanza transversal de experiencia del ERP | `docs/governance/` (índice, políticas, líneas base, investigación y templates) |
| Mockup / handoff / logo / asset visual | `docs/design/<producto>/<version>/` (ver su README) |
| Marketing / SEO / Ads / analítica / contenido / captación | `docs/marketing/` (ver su README) |
| Contrato / NDA firmado | `docs/legal/` (binario **fuera de git** → Drive + puntero) |
| Planilla de costos / tarifa | `docs/operaciones/` |
| Transcripción de sesión | `docs/archive/` (no crece sin control) |
| Definición de agente/skill | `docs/agents/` |

## Regla de adjuntos (memorizable)

> **"Un adjunto vive en una carpeta `assets/` al lado del documento que lo usa."**

Dos planos, NO confundir:

| Plano | Qué es | Dónde vive | ¿En git? |
|---|---|---|---|
| **1 · Documentación** (dev-time) | diagrama de un spec, captura de un runbook | `docs/.../assets/` | **Sí** (si <1 MB y revisable) |
| **2 · Runtime** (producción) | foto de operario (fachada/POD/recepción), recibo, archivo que sube un cliente | **Supabase Storage**, path `{tenant_id}/...`, signed URL | **No, nunca** |

- Naming de adjuntos: `01-descripcion.png` (numerado), kebab-case, sin acentos, fechas ISO-8601.
- Binario >1 MB o blob (ZIP, video) → **fuera de git** + un `assets/EXTERNAL.md` con el link a Drive.
- Los specs referencian diseño por **texto-código + versión**, nunca por link relativo:
  `` Diseño: `docs/design/studio/_norte/.../embarques.jsx` (v1.7) ``

## Clasificación → ubicación (ISO 27001:2022 · A.5.12/A.5.13)

| Clase | Puede vivir en | Nunca en |
|---|---|---|
| `publico` | repo, sitio | — |
| `interno` | repo privado | público |
| `confidencial` (PII, financieros, contratos) | Drive / Storage+RLS / puntero | **git** |

**Nunca-en-git absoluto** (sin importar etiqueta): secretos (`.env*`), PII de clientes (solo Supabase+RLS), financieros crudos.

## Mapa de carpetas

```
docs/
├── README.md          ← este índice (registro maestro §7.5.3)
├── specs/             ← SDD specs (NNNN-slug/spec.md + assets/)
├── runbooks/          ← guías de setup operativo (how-to)
├── architecture/      ← cómo encaja el sistema + decisions/ (ADRs)   [se crea en fases B/A2]
├── audits/            ← auditorías de seguridad/sistema
├── qa/                ← reportes de QA
├── agents/            ← definiciones de agentes/skills (SDD-0020)
├── governance/        ← gobernanza transversal de experiencia del ERP
├── legal/             ← contratos/NDA (punteros; binarios en Drive)  [se crea en fase B]
├── operaciones/       ← costos/tarifas                                [se crea en fase B]
├── design/            ← material visual (ver docs/design/README.md)
├── marketing/         ← SEO/Ads/analítica/CRM/contenido (ver docs/marketing/README.md)
└── archive/           ← transcripciones de sesión
```

## Estado de la reorganización (reorg ISO)

Este índice se creó en la **Fase A1** del reorden de carpetas (rama `reorg/iso-folders`).
Plan completo: `~/.claude/plans/eres-un-especialista-en-reflective-puffin.md`.
Pendiente: A2 (registro generado + retención + mapa de trazabilidad + READMEs por módulo), B (mover sueltos + sensibles), C (lint de fronteras). El regroupeo físico de `lib/studio` quedó **diferido**.
