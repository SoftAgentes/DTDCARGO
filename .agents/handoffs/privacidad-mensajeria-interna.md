# Handoff — `/privacidad`: mensajería interna del equipo (SDD-0606 y SDD-0608)

- **Owner:** Worker `local_discord_consulta_clientes`, por encargo del Director General vía el Subdirector («SEO, GEO y AEO»), 2026-11-06.
- **Ruta:** `DTD-worktrees/privacidad-mensajeria-interna` · **Rama:** `codex/privacidad-mensajeria-interna` · **Base:** `origin/main` `60c5dc902`.
- **SDD:** sin spec propia: es el texto público que piden las revisiones de privacidad de la SDD-0606 (PR #380) y de la SDD-0608 (PR #387). La propuesta está en `docs/specs/0608-discord-consulta-clientes/privacidad.md` §5 de la rama de la #387 (`e31a70f39`).

## OBJETIVO ORIGINAL

PR chica contra `main` con el texto de `/privacidad` que Sam aprobó el 2026-11-06 (~18:05Z, botón «Apruebo el texto», según el Subdirector), copiado palabra por palabra, más la fecha de la página y una sola fila de Discord en el inventario de terceros. Sin tocar la #380 ni la #387, y sin fusionar.

## COMPLETADO

- `app/privacidad/page.tsx`: párrafo propio «Mensajería interna del equipo» en §4, después de la lista y antes de «No compartimos…»; frase final del primer párrafo de §5. Fecha: «6 de noviembre de 2026». La página no nombra a Discord.
- `docs/legal/privacidad/inventario-terceros.md`: una sola fila de Discord, fundida, con el «Qué recibe» de la §4 del informe.
- Pruebas: `app/__tests__/privacidad-mensajeria-interna.test.tsx` (página renderizada: los dos textos literales, la posición fuera de la lista, sin «Discord», la fecha). `app/__tests__/privacidad-chat.test.ts` se actualizó en dos puntos: el final de §5 ahora termina con la frase nueva (Sam aprobó ponerla al final) y la fecha.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| vitest de los dos archivos de `/privacidad` | NO EJECUTADO en local: el worktree no tiene dependencias y la instalación necesita turno. Lo corre el CI de la PR |
| Textos literales en lo que ve el visitante | Cubierto por la prueba nueva, que renderiza la página: resultado en el CI |

## PENDIENTES DE ESTA TAREA

- Ver el CI en verde.
- Al integrar la #380 y la #387: quitarles su fila de Discord del inventario (esta es la única).

## HANDOFF AL DIRECTOR

Los avisos a Discord (SDD-0606) y `/cliente` (SDD-0608) no se encienden hasta que este texto esté publicado. Fusionar y publicar son del Director General.
