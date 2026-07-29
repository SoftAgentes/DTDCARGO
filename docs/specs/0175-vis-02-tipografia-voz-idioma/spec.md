---
sdd: "0175"
title: "VIS-02 — tipografía por voz, destinatario e idioma"
status: approved
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0165"]
confidencialidad: interno
---

# SDD-0175 — VIS-02 · tipografía por voz, destinatario e idioma

## 1. Propósito

Implementar [VIS-02 v1.0](../../governance/policies/vis-02.md) sin crear una
fuente paralela a BRAND/Norte y con pruebas separadas para UI, email y PDF.

## 2. Gate V0 — resuelto

VIS-02 exige `Noto Serif SC` para chino documental y seis tokens de voz.
`BRAND.md`:

- permite Archivo, Archivo Black, JetBrains Mono y Noto Sans SC;
- prohíbe fuentes serif;
- no registra excepción Song Ti/Noto Serif SC.

BD-035 solo gobierna Nunito Sans + Sora del ERP. La decisión posterior
**BD-036**, autorizada por Sam el 2026-07-29, aprueba Noto Serif SC únicamente
para documento formal `zh-CN` y mantiene Noto Sans SC para UI.

V0 queda cerrado. Esta decisión no carga todavía la fuente.

## 3. Inventario

- `app/layout.tsx` carga Archivo, Archivo Black y Noto Sans SC;
- `.studio-sys` usa Nunito Sans + Sora;
- `app/studio/tokens.css` expone `--f-cn` para UI;
- no existen `--f-cn-ui` ni `--f-cn-document`;
- correos usan fallbacks locales Archivo/Arial/system-ui;
- no hay renderer transversal ni evidencia de incrustación CJK en PDF;
- existen usos editoriales Georgia/Times en Marketing que requieren un alcance
  separado, no se corrigen de forma oportunista.

## 4. Plan por gates

1. **V0 marca:** cerrado mediante BD-036 y sincronización
   BRAND/Norte/VIS-02.
2. **V1 tokens:** cargar fuente autorizada y añadir aliases compatibles.
3. **V2 email:** inventariar/normalizar renderers con fallback seguro.
4. **V3 PDF:** incrustación, glifos, selección/copy-paste y peso.
5. **V4 visual:** español/zh-CN, Studio, Gmail, Outlook, Apple Mail e impresión.

Cada gate conserva commit, integración y publicación separados. No se cambia
tipografía de pantallas existentes en V0.

## 5. Criterios

- cero fuente no autorizada;
- `lang="zh-CN"` en bloques chinos;
- Noto Sans SC para interfaz y Song Ti solo para documento formal aprobado;
- fallbacks legibles sin webfonts;
- ninguna diferencia de fuente es la única señal;
- PDF incrusta glifos usados;
- typecheck, lint, tests, build, docs y revisión visual verdes.

## 6. Estado

SDD aprobado; Gate V0 cerrado. V1–V4 permanecen pendientes. No se modificó
código ni se cargó Noto Serif SC.
