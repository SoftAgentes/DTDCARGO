# Handoff · SDD-0642 — script de auditoría GEO/AEO (Fase A de la SDD-0641)

Fecha: 2026-11-16 · Rama: `claude/geo-aeo-script-auditoria-e8a39d` · Worker Claude · Director: sesión `local_25e2dded-103b-4eaa-b10e-6527564b9cad`.

## Qué se hizo

- `scripts/auditoria-geo-aeo.mjs`: solo lectura, sin dependencias nuevas. Sitemap por defecto `https://dtdcargo.com/sitemap.xml`; `--base`, `--sitemap` (URL o archivo), `--json [archivo]`, `--estricto`. 14 comprobaciones de máquina (sale 1 si hay FALLAS) + 2 MANUAL, estados PASA / FALLA / MANUAL / N/A, excepciones explícitas (`/enlaces`, `/privacidad`, `/cookies`). Sin puntaje.
- `scripts/__tests__/auditoria-geo-aeo.test.mjs`: 16 pruebas con HTML de ejemplo, sin red.
- `docs/specs/0642-auditoria-geo-aeo-script/spec.md`: uso, reglas, línea base. `.gitignore`: `auditoria-geo-aeo-*.json`.
- Número 0642: de `node scripts/next-number.mjs` (0641 ya reservado por la PR #613).

## Evidencia

| Comprobación | Resultado |
|---|---|
| Prueba focal `npx vitest run scripts/__tests__/auditoria-geo-aeo.test.mjs` | **PASÓ** (16/16) |
| Mutantes (MAX_TITULO 60→70; noindex sin meta; H1 `>=1`; huérfana siempre pasa) | **PASÓ**: los 4 hacen fallar la prueba; archivo restaurado |
| Corrida real contra el sitio (una pasada, 48 URL, anónima) | **PASÓ**: reproduce `/fcl` = 76 y `/servicios/puerta-a-puerta` = 63. 555 pasan, 37 fallan, 83 manuales, 93 N/A |
| Cambios por condiciones del DG (un pedido a la vez + pausa, user-agent `auditoria-geo-aeo/1`, `--html-dir`) | **PASÓ**: prueba focal 19/19; humo con carpeta local sin red; la corrida en vivo de arriba fue ANTES de estos cambios (4 en paralelo, otro user-agent) y no se repitió |
| `pnpm verify`, suite completa, Docker, install | **NO EJECUTADO** (sin turno del DG; cambio de harness/script, sin producto) |
| `docs:check` y `sdd:check` (numbering) | **PASÓ** |

## Revisión independiente (770bc3b8d → CAMBIOS NECESARIOS), atendida en commits nuevos

- Salida ≠0 por defecto (`--no-estricto` explícito); solo dominio propio (origen del sitemap, redirecciones manuales validadas, tope de 20 s también en el sitemap); `--max` (200); `--json` solo con nombre simple; `--html-dir` acotado; NFC en la longitud del título; motivo del error de red en el informe; `lastmod` anotado como pendiente. Prueba focal: 34/34; 9 mutantes muertos.

## Pendientes de esta tarea

- **Enmienda a la 0641 §11 (allowlist de la Fase A):** HECHA tras entrar la #613 en main (subsección «Enmienda: Fase A (SDD-0642)»).
- Ninguno más de código. Falta solo la revisión independiente y el turno del DG para `verify`/CI.

## FUERA DE ALCANCE DETECTADO

1. **Títulos largos** `/fcl` (76) y `/servicios/puerta-a-puerta` (63): decisión de redacción; el script los reporta, no se tocaron.
2. **Sin `#respuesta-rapida`** en `/servicios/*`, `/glosario`, `/faq`, `/importar-de-china`, las 18 geo-páginas y las 5 noticias (SDD-0641 grupo 2, ya listado como «ampliar»).
3. **Posibles huérfanas** `/puerta-a-puerta`, `/llenado`, `/brochure`, `/calculadora-terrestre`: ninguna otra URL del sitemap las enlaza en el HTML crudo. Verificar si un menú que carga con JavaScript sí las enlaza; si no, es un hueco de enlazado interno (y `/puerta-a-puerta` pesa 0,9 y compite con `/servicios/puerta-a-puerta`).
4. **`/enlaces` sin H1** (el script la deja fuera de otras reglas por excepción, pero el H1 sí se mide).
5. Los umbrales del script (100 palabras, lista de rutas con respuesta rápida, tipos JSON-LD por ruta) son propuestas mías: Sam o el DG deben confirmarlas o corregirlas.
6. Core Web Vitals, JavaScript renderizado y Search Console: siguen sin datos (fases B/E de la 0641).

## Impacto documental

Spec nueva 0642 (la índice `docs/specs/README.md` se regenera con `pnpm docs:index`). La SDD-0641 podría anotar que su Fase A tiene implementación en 0642; no se tocó esa spec porque vive en la PR #613.
