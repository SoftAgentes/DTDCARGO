# Handoff · SDD-0705 · Oficina_Virtual: aviso al cliente y guion explicar-servicio

**Pedido:** Sam, el 21/11/2026, al aprobar con «Sí, apruebo» los dos textos que redactó Hermes DIRECTOR en el buzón
Kanban t_a5065638. Lo implementa el Director Ofi_Hermes, en esta sesión.

## Qué cambia

- `lib/studio/oficina/guiones-soporte.ts`: guion nuevo `explicar-servicio` y `VERSION_GUIONES` 0.3. Los pasos están
  verificados en los docs de DTD; la tabla está en la spec.
- `lib/studio/oficina/aviso-cliente.ts` (nuevo): `AVISO_CLIENTE`, `esPrimeraRespuesta` y `conAvisoAlCliente`.
- `lib/studio/oficina/despachador.ts`: el texto que se entrega pasa por `conAvisoAlCliente(salida.texto, mensajes)`,
  después de `revisarRespuesta`.
- `docs/runbooks/oficina-cable.md` §14: el alcance del tapado de SDD-0700 (el nombre y la guía no se tapan) y el aviso.
- Spec: `docs/specs/0705-oficina-aviso-y-guion-servicio/spec.md`.

## Pruebas

- Nuevo: `lib/studio/oficina/__tests__/aviso-guion-servicio.test.ts`.
- `lib/studio/__tests__/oficina-despachador.test.ts`: aserción del aviso en la corrida buena, más un caso nuevo
  (con una respuesta previa de DTD no hay aviso).
- En local, solo los 6 archivos de la Oficina_Virtual, sin suite amplia: 155/155 en verde.

## Lo que NO hace

- No toca migraciones, el envío, la huella, el webhook ni la pantalla.
- No toca producción. La Oficina_Virtual sigue pausada (office_paused id 5).

## Pendiente

- El merge, por el Director DTD.
- La sección §14 describe el tapado de SDD-0700, que rige cuando se fusione la #755.
