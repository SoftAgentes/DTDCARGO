# Handoff · SDD-0626 · Paso 4: la mini-vista de solo lectura (§3.6)

**Pedido:** Sam, el 18/11/2026, con la etapa 1 ya encendida en producción (cuenta 2, bandeja 11): «Haz esta tarea
aquí: "Cable Paso 4 · mini-vista de solo lectura"». Es la siguiente pieza de construcción del tablero de Hermes
(DIRECTOR). Rama `claude/0626-paso4-mini-vista`, desde `main` en `9a0186228`.

## Qué se hizo

- **`lib/studio/oficina/mini-vista.ts`:** `leerMiniVista` lee la bandera (`office_paused`), la cola (`office_tasks`),
  los eventos (`event_inbox`), la bitácora (`task_events`) y el gasto del mes (`office_gasto_del_mes()`). Últimas filas
  de cada tabla, de lo nuevo a lo viejo, y un conteo por estado. No escribe y no llama a nada de fuera.
- **El candado.** Las 4 tablas solo las lee `service_role` (0541: RLS sin policies), así que se leen con el cliente de
  servicio. `leerMiniVista` le pregunta primero a la base si quien mira es `is_platform_admin()` y **solo con ese «sí»
  crea el cliente de servicio**. Si la pregunta falla, es un «no».
- **`app/studio/(app)/admin/oficina/vista/page.tsx`:** la página, bajo el layout de la revisión. Sin formularios ni
  botones. Con `OFICINA_VISTA_ACTIVA` apagada (el valor por defecto) es un 404 para todos.
- **`app/studio/(app)/admin/oficina/page.tsx`:** un enlace a la mini-vista, solo cuando está encendida.
- **`lib/studio/oficina/config.ts`:** `vistaActiva()`, con la misma regla de los demás interruptores.
- **Docs:** spec 0.8 (§3.6: cómo se construyó y allowlist), runbook §13 y las dos `.env.example`.

## Decisiones tomadas en esta PR (revisables)

- **Sin migración.** La alternativa era una función SECURITY DEFINER por tabla que exigiera `is_platform_admin()`, como
  las de la 0549. Se descartó porque pide una migración en producción solo para leer, y el patrón de leer con el
  cliente de servicio detrás de un candado ya existe en `admin/notificaciones/estado`. Si el DG prefiere el candado en
  la base, la lectura cambia en un solo archivo (`mini-vista.ts`) y la página queda igual.
- **Columnas.** No se piden `meta_datos` ni `clave_dedupe`. `titulo` y `resumen` sí: pasan por `exigirTextosDelCable`.
- **El motivo de la pausa** se muestra tal cual. Lo escribe un superadministrador (`office_cambiar_pausa`) o la base
  (auto-pausa); no pasa por la regla del cable.

## Hallazgo, fuera de esta PR

**El panel no tiene botón de pausa.** `office_cambiar_pausa` no se llama desde `app/` ni desde `lib/`: hoy solo se
puede pausar o despausar con SQL. El kit de la etapa 1 le pide a Sam pausar al terminar cada sesión, y no tiene dónde.
El §3.6 es de solo lectura, así que el botón no va aquí: queda propuesto al DG como PR aparte (sin migración: la
función ya exige `is_platform_admin()` y un motivo).

## Qué se ejecutó y qué no

Ver la descripción de la PR: ahí está la lista de comprobaciones locales con su resultado.

- La página no se abrió en un navegador: no hay prueba que la pinte entera (pide sesión y base). Lo que se fija por
  prueba es la lectura, el candado, el interruptor y el código fuente de la página.
- No se tocó staging ni producción. `OFICINA_VISTA_ACTIVA` no está puesta en ningún entorno.
- Contratos SQL, Docker y `pnpm verify`: no se corrieron en local (van en CI).

## Para encenderla

Runbook §13: `OFICINA_VISTA_ACTIVA=1` en el `.env` y relevar el `web`, con OK de Sam y aviso al DG.
