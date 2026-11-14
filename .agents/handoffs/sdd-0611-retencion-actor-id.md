# SDD-0611 · Retención de `actor_id` cerrada (2026-11-14)

Solo documentos. Cierra la decisión abierta de §11.4.1 de
`docs/specs/0611-noticias-publicacion-automatica/spec.md`.

## Qué decidió Sam
Respuestas en la pantalla del Subdirector SEO, relatadas al Director General (que las
reconfirma). Opciones elegidas, textualmente: «12 meses (Recomendado)»; «Sí, las 4 columnas
(Recomendado)»; «Vaciar solo el uuid (Recomendado)»; «En la PR del cron de noticias
(Recomendado)».

## Qué cambió
- §11.4.1 pasa de «decisión abierta» a «cerrada», con las opciones y las 5 condiciones antes de
  encender (purga existe, aplicada con OK nominal, columnas con `NULL`, contrato SQL con mutante,
  encendido al final).
- §11.3.1 (b): la excepción temporal vence cuando la purga esté aplicada.
- Punto 6 de «Abiertas»: decidido; falta construir y aplicar la purga.
- `updated:` 2026-11-14.

## Pendiente de esta tarea
- Migración de purga (migrate-first, OK nominal de Sam para aplicarla, la pide el Director
  General) y su contrato SQL. No está en esta PR.

## FUERA DE ALCANCE DETECTADO
- SDD-0612 D3 «Con título» y SDD-0610 D3 «Modelo de lenguaje» y D7 «Solo sumarla» no son la
  recomendación de sus specs fusionadas; el Director General los reconfirma con Sam.

## Impacto documental
Allowlist: `docs/specs/0611-noticias-publicacion-automatica/spec.md` (modificado) y este
handoff (nuevo). Sin código, sin migraciones. Verificado: `docs:check` y `sdd:check` PASÓ.
No corrí verify ni vitest.
