# Handoff — SDD-0641 · GEO y AEO: radar de respuestas de IA y auditoría por página

Fecha: 2026-11-16. Task ID: `sdd-0641-geo-aeo-radar-respuestas-ia`.
Rama: `claude/geo-aeo-radar-respuestas-ia-f8211b`, desde `main` `94f555f93`.
Reserva: rama `codex/sdd-reserve-0641-geo-aeo-radar-respuestas-ia` y `refs/dtd/reservations/0641`, publicadas.
Estado: **lista para revisión del Director General.** Solo documentos; sin código, sin producción, sin VPS.

## OBJETIVO ORIGINAL
Medir qué del método de un video de TikTok (lista de 100 comprobaciones en 10 grupos y 5 bots semanales)
ya hace DTD Cargo, y proponer fases con lo que ya existe, orden y qué no copiar.

## COMPLETADO
- Spec `docs/specs/0641-geo-aeo-radar-respuestas-ia/spec.md`: tabla por grupo y por bot con evidencia
  etiquetada (CÓDIGO / SITIO / DOC / INFERIDO / SIN DATOS), cinco fases con lo que necesita de Sam,
  costo y riesgo, orden recomendado y lista de lo que no conviene copiar.
- Medición del sitio público el 2026-11-16: robots.txt, sitemap (48 URL, 5 con lastmod), llms.txt,
  llms-full.txt (200) y el HTML de 28 URL (título, description, canonical, H1, tipos JSON-LD, palabras).

## Hallazgos que cambian algo
- Lo técnico (robots, llms, schema, sitemap) está hecho; falta **medir** y **menciones fuera del sitio**.
- 2 títulos de más de 60 caracteres: `/fcl` 76 y `/servicios/puerta-a-puerta` 63 (`/servicios/lcl` está en 60 y `/servicios/fcl` en 57).
- `/puerta-a-puerta` y `/servicios/puerta-a-puerta` cubren el mismo tema (riesgo de canibalización, sin datos).
- La fase E repite P2 de la SDD-0613; no la adelanta.

## LÍMITES
- No pude ver el video: la descripción del método viene del encargo. Cifras del autor: no verificables, no usadas.
- No medido: velocidad, enlaces internos, fecha visible por página, precios de API de IA.
- El escaneo del sitio es una pasada de lectura; puede cambiar con cada despliegue.

## PENDIENTES DE ESTA TAREA
- Revisión y fusión: Director General.

## FUERA DE ALCANCE DETECTADO
- Revisar los 2 títulos largos (decisión de redacción).
- Impacto documental: si se aprueba, enlazar la spec desde `docs/marketing/README.md` al integrar.

## VALIDACIÓN
- `pnpm docs:check`: PASÓ (índice sincronizado, 624 specs).
- `pnpm sdd:check`: PASÓ (sin números repetidos).
- `pnpm verify`: NO EJECUTADO, no aplica (solo documento).

## REVISIÓN
Revisión independiente del Director General: aprobada con menores; segunda pasada aplicó títulos, criterios por fase, regla D-2, tope de 15 USD (aprobado por Sam 2026-11-16), allowlist, citas de línea y `related`.
