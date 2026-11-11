# SDD-0588: los correos de SDD-0583 como pieza propia (handoff)

Rama `codex/0588-piezas-correos`, worktree `DTD-worktrees/0588-piezas-correos`, desde `main` en `7a8afdd2c`. Encargo del Director General, 2026-11-06. Va después de la #382, de documentos. **Fusionarla pide OK de Sam**, porque está fuera del mandato: lo decidió el Director General el 2026-11-05. La fusión es de él.

## Qué cambia

- `lib/studio/chatwoot/analisis.ts`: `PiezaId` suma `correo` y `PIEZAS` suma la pieza. Sus rutas de Chatwoot, con el motivo de cada una, están en la SDD-0588.
- `lib/studio/chatwoot/__tests__/analisis.test.ts`: una prueba de que cada ruta de la pieza la toca, y de que una plantilla que DTD no reemplaza no la toca.

No cambia lo que viaja al motor, salvo el diff de esas rutas cuando una versión las cambie. No toca el VPS ni Chatwoot.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Pruebas de análisis, motor, superficie, acciones y panel | PASÓ: 76 de 76 |
| 6 mutantes | PASÓ: 6 de 6 caen por la prueba nueva |
| eslint | PASÓ |
| Rutas de Chatwoot | Leídas en el repositorio público, etiqueta `v4.19.1`: `app/views/mailers/`, `app/views/devise/mailer/`, `app/views/layouts/mailer/base.liquid`, `app/mailers/application_mailer.rb` y `config/initializers/devise.rb` (`parent_mailer`) |
| `pnpm verify`, con turno del Director General, de 02:18Z a 03:08Z | FALLÓ solo por dos vencimientos de 600 s en pruebas de scripts bash, ajenas al diff. Typecheck, lint, e2e y build: PASÓ. Detalle en la SDD-0588 |
| Esas dos pruebas a solas | PASÓ: 32 de 32 |
| migrations-applied, sql-tests y schema-rebuild | NO DISPONIBLE: sin `.env.local` y con Docker apagado. El cambio no toca SQL |

## Pendiente

- ~~Subirla cuando entre la #382, y abrir la PR en borrador.~~ Hecho el 2026-11-06, con `main` en `186d505ff` traído. El único conflicto fue la spec 0588: se conservaron las dos secciones, sin quitar nada de `main`. Pruebas puntuales otra vez: 76 de 76.
- **Queda en borrador**, sin pasar a lista, hasta que Sam dé el OK para fusionarla. Se lo lleva el Director General junto con la #376.

## FUERA DE ALCANCE DETECTADO

- Las vistas de `infra/chatwoot/correo/views` no viajan al motor: `FUENTES_SUPERFICIE` no recorre subcarpetas. El motor ve la descripción de la pieza y el diff de Chatwoot, pero no la plantilla de DTD. Sumarlas cambia la superficie y su prueba negativa de secretos. Es una decisión aparte.
