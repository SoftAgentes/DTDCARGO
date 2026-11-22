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
- **Docs:** spec 0.9 (apartado y allowlist al final de §3) y runbook §15 (el §14 es del tapado, 0700/0705).

## Decisiones tomadas en esta PR (revisables)

- **Sin interruptor de entorno.** Todo lo del cable nace apagado, pero esto es el freno: pausar tiene que estar siempre
  a mano. El candado es el de la base (`is_platform_admin()` y motivo). Si el DG lo prefiere con interruptor, es un
  cambio chico; conviene que, en ese caso, el interruptor esconda solo «Despausar».
- **Despausar pide confirmación; pausar no.** Pausar es el lado seguro y tiene que ser rápido.
- **Con el estado desconocido solo se puede pausar.**
- **Los avisos de la pausa tienen su propio texto** (`pausa_sin_permiso`, `pausa_invalida`, `pausa_error`): los de la
  revisión dicen «no se guardó la revisión», que aquí confundiría.

## Puesta al día con main (2026-11-22, Worker que adoptó la rama)

El #664 ya está en main. Se hizo `git merge origin/main` (sin rebase ni force) y se resolvió así:

- **Ruta:** la oficina pasó a `/studio/admin/oficina-virtual` (#720). Git movió `TarjetaPausa.tsx`; `actions.ts`
  y las pruebas (`pausa.test.ts`, `oficina-contraste.test.ts`) apuntan a la ruta nueva. En `pausa.test.ts` el
  regex del REDIRECT ahora acepta `&c=…&n=…` (la 0678 agrega parámetros al aviso).
- **Avisos:** los códigos de la pausa siguen en el mapa `AVISOS` de la página, que ya usa `AvisoResultado` (0678):
  `ok_*` sale en tono éxito y el resto en error. Sin cambios de lógica.
- **Contador del inventario (`rbac-actions-guard.test.ts`):** main trae **502** (0704 F1-A); esta PR suma una
  acción exportada, `cambiarPausaAction` → **503**. Los 502 de main no se tocaron.
- **Docs:** runbook — main ya usa el §14 (tapado 0700/0705), la pausa pasó a **§15**. Spec — versión 0.15, fila
  nueva en la tabla y allowlist con la ruta nueva; se conserva todo lo de main (Anthropic y Haiku de respaldo, 0.14, etc.).
- **Verificación del botón:** sigue llamando a `office_cambiar_pausa` (0541) con la sesión del usuario, con los dos
  candados (`moduleEditDenial("admin")` y `platformAdminDenial`); la tarjeta no se pinta sin `is_platform_admin`
  (`leerPausa` devuelve `sin_permiso`). Colores solo con variables (`--bg-surface`, `--ink`, `--border`); el botón
  pasó a `studio-btn-primary` (azul de acción). Sin vino.
- Los candados de rama: `docs:check`, tsc y eslint (ver PR). Vitest (`pausa`, `oficina-contraste`, `rbac-actions-guard`): 3 archivos y 537 pruebas en verde sobre 6742b42eb (turno de PC dado por Sam).
- **Auto-pausa:** el texto de la tarjeta, el runbook §15 y la spec ya no dicen solo «tope de gasto»: la 0570 también pausa por las llamadas del plan fijo.

## Qué se ejecutó y qué no

Ver la descripción de la PR.

- La página no se abrió en un navegador: pide sesión y base. La tarjeta se pinta en las pruebas y la acción se prueba
  con dobles de la base y de los candados.
- No se tocó staging ni producción, y no se pausó ni despausó la oficina real.
- Contratos SQL, Docker y `pnpm verify`: no se corrieron en local (van en CI).
