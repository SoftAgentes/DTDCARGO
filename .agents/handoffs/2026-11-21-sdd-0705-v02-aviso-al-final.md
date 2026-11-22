# Handoff · SDD-0705 v0.2 · El aviso al final y los menores de la revisión de la #760

**Pedido:** la revisión independiente de la #760 (aprobada sobre c9a181543) dejó cuatro menores. Sam decidió el
primero el 21/11/2026: «Doble saludo: opción B, el aviso va al final». El Director DTD pidió una PR aparte,
después de que entre la #760.

## Qué cambia

1. `lib/studio/oficina/aviso-cliente.ts`: el aviso va AL FINAL del borrador; no se duplica si el texto ya lo trae.
   Nuevos `TEXTO_MAXIMO_BORRADOR` (4000) y `cabeEnBorrador`.
2. `lib/studio/oficina/despachador.ts`: si con el aviso no cabe, escala con `borrador_largo` (antes, la base lo
   rechazaba y salía `fallo_interno`).
3. `docs/runbooks/oficina-cable.md` §14: el tapado rige desde que la #755 está en main y publicada; el aviso va al
   final; aclara el largo máximo.
4. Spec 0705: la enmienda v0.2, las políticas (IA-01 nivel I2) y la allowlist exacta.

## Pruebas

- `aviso-guion-servicio.test.ts`: el aviso al final, sin duplicar, y el límite justo de 4000 caracteres.
- `oficina-despachador.test.ts`: el borrador termina con el aviso, y uno largo escala con `borrador_largo`.
- vitest: con el turno de PC que da el Director DTD.

## Lo que NO hace

No cambia el texto del aviso ni del guion, no hay migraciones y no toca producción.
