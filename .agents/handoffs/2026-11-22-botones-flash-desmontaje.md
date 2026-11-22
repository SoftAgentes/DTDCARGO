# Handoff · Botones del Studio: el flash de éxito tras el desmontaje (complemento de la #761)

**Pedido:** Sam, el 21/11/2026 («Revisa qué es y repáralo»), por el rojo falso del CI de la #760
(`ReferenceError: window is not defined` desde el temporizador del flash de `ActionButton`). La #761 ya arregló
`ActionButton` (cancela el temporizador al desmontar). Su revisión dejó pendientes dos cosas, y van aquí.

## Qué cambia (solo lo que la #761 no cubre)

1. **`SplitActionButton.tsx`** tenía el mismo defecto que `ActionButton` (un `setTimeout(() => setSuccessKey(null))`
   sin cancelar). Ahora el temporizador va en un ref y se cancela al desmontar.
2. **La acción async que termina DESPUÉS del desmontaje**, en los dos botones: `onAction` puede resolverse cuando
   el cleanup ya corrió. Sin un flag de montaje, el temporizador se creaba igual sobre un botón muerto. Ahora, si
   el botón ya no está montado, no se marca el éxito ni se crea el temporizador.

## Pruebas

- `ActionButton.test.tsx`: un caso nuevo (onAction termina tras el desmontaje → 0 temporizadores). Los casos de la
  #761 quedan igual.
- `SplitActionButton.test.tsx`: dos casos nuevos con temporizadores falsos (desmontar durante el flash → 0
  temporizadores; la acción termina tras el desmontaje → 0 temporizadores).
- vitest: con el turno de PC que da el Director DTD.

## Allowlist exacta

- `app/studio/_components/ui/ActionButton.tsx`
- `app/studio/_components/ui/ActionButton.test.tsx`
- `app/studio/_components/ui/SplitActionButton.tsx`
- `app/studio/_components/ui/SplitActionButton.test.tsx`
- `.agents/handoffs/2026-11-22-botones-flash-desmontaje.md`

## Lo que NO hace

No cambia el aspecto, la duración del flash, las props ni el comportamiento de los botones montados. No toca
producción.
