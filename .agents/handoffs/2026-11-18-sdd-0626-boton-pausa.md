# Handoff · SDD-0626 · El botón de pausa de la oficina

**Pedido:** Sam, el 18/11/2026: «Sí, haz el botón». Lo acordó antes el Director General: PR chica aparte de la
mini-vista (#664), después de ella, con la sesión de Sam y sin migración. Rama `claude/0626-boton-pausa`.

## Por qué

La etapa 1 está encendida en producción desde el 18/11/2026 (cuenta 2, bandeja 11) y el kit le pide a Sam pausar la
oficina al terminar cada sesión. No tenía dónde: `office_cambiar_pausa` (0541) existía, pero ninguna pantalla la
llamaba. La despausa del encendido la aplicó una sesión por SQL, a nombre de un administrador y con un motivo que dice
que no fue un clic del titular.

## Qué se hizo

- **`lib/studio/oficina/pausa.ts`:**
  - `cambiarPausa(supabase, { pausar, motivo })` llama a `office_cambiar_pausa` con el cliente que recibe (la sesión
    del usuario) y traduce los códigos de la base. Si la base no devuelve el valor pedido, no lo da por hecho.
  - `leerPausa({ esAdmin, crearAdmin })` lee la última fila de `office_paused`. Esa tabla solo la lee `service_role`,
    así que usa el candado de la mini-vista: el cliente de servicio solo se crea después del «sí» de
    `is_platform_admin()`. Sin filas, pausada.
- **`app/studio/(app)/admin/oficina/actions.ts`:** `cambiarPausaAction`. Los dos candados de las demás acciones antes
  de leer el formulario; despausar exige la casilla `confirmo`; el motivo pasa por `motivoDe` (regla del cable).
- **`_components/TarjetaPausa.tsx`** y la página: el bloque arriba de la revisión, con un solo botón.
- **`lib/studio/oficina/mini-vista.ts`:** exporta `cambioDePausa` (antes privada) para no repetirla.
- **Guardas:** `rbac-actions-guard.test.ts` (488 → 489) y `oficina-contraste.test.ts` (suma la tarjeta).
- **Docs:** spec 0.9 (apartado y allowlist al final de §3) y runbook §14.

## Decisiones tomadas en esta PR (revisables)

- **Sin interruptor de entorno.** Todo lo del cable nace apagado, pero esto es el freno: pausar tiene que estar siempre
  a mano. El candado es el de la base (`is_platform_admin()` y motivo). Si el DG lo prefiere con interruptor, es un
  cambio chico; conviene que, en ese caso, el interruptor esconda solo «Despausar».
- **Despausar pide confirmación; pausar no.** Pausar es el lado seguro y tiene que ser rápido.
- **Con el estado desconocido solo se puede pausar.**
- **Los avisos de la pausa tienen su propio texto** (`pausa_sin_permiso`, `pausa_invalida`, `pausa_error`): los de la
  revisión dicen «no se guardó la revisión», que aquí confundiría.

## Va detrás del #664

La rama se cortó de `claude/0626-paso4-mini-vista` (c241e296d) porque las dos tocan la página de revisión, la spec y el
runbook. Cuando el #664 se fusione: `git rebase --onto origin/main c241e296d`. Al rebasar hay que volver a mirar el
número del inventario en `rbac-actions-guard.test.ts` (aquí 489 = el de la base + 1).

## Qué se ejecutó y qué no

Ver la descripción de la PR.

- La página no se abrió en un navegador: pide sesión y base. La tarjeta se pinta en las pruebas y la acción se prueba
  con dobles de la base y de los candados.
- No se tocó staging ni producción, y no se pausó ni despausó la oficina real.
- Contratos SQL, Docker y `pnpm verify`: no se corrieron en local (van en CI).
