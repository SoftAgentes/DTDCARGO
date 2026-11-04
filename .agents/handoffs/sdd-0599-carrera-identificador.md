# SDD-0599: rojo intermitente de la prueba del identificador

- **Fecha:** 2026-11-04. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/id-intento-carrera`. **Rama:** `codex/id-intento-carrera`, desde `origin/main` en `ec56a4ac4`, sin PR.
- **Alcance:** sólo pruebas. El hook no cambia.
- **Encargo del Director General:** el rojo salió en el CI de la #329, sobre `6b97ce8a2`, corrida `41774172959`. `use-action-keeping-draft.test.tsx:200`, «cambia después de ok»: 1 de 13.682.

## Causa

Confirmada. El identificador se renueva en un `useEffect` del hook, y ese efecto puede correr después de pintar. La prueba reenviaba apenas salía «Listo», a veces antes de que corriera.

| Medición | Resultado |
|---|---|
| El archivo sin corregir, sin carga añadida | Rojo en 1 de 15 corridas, en esa prueba |
| El archivo sin corregir, con 16 procesos de carga | Rojo en 1 de 20 corridas, en esa prueba |
| Sonda temporal que reenvía en el instante en que aparece el aviso, con un render de más de 5 ms | Mismo identificador, 5 de 5 |
| El archivo sin corregir, con el `setImmediate` del Scheduler retrasado 15 y 40 ms | Rojo siempre, en esa prueba: es el orden malo, forzado |

## Si existe para una persona

Sí, pero sólo en el hueco de milisegundos entre pintar y correr el efecto, y hacia el lado seguro. Un envío que caiga ahí reusa el identificador del que ya entró: el servidor responde `replayed` y la pantalla dice que ya estaba registrado. No duplica ni pierde lo escrito, porque el formulario sigue a la vista. El tamaño del hueco en un navegador real está **sin medir**.

**No se cambió el hook.** Decidir en `onSubmit` a partir de `state` quitaría el hueco: un envío ahí llevaría otro identificador, igual que uno hecho milisegundos después. Para una persona no gana nada, porque hoy ese envío responde `replayed` y no duplica. No hace falta para corregir esta prueba, y cambiaría código ya medido con mutantes. Sería una simplificación válida en otra tarea.

## COMPLETADO

| Archivo | Cambio |
|---|---|
| `use-action-keeping-draft.test.tsx`, «cambia después de ok» | Espera una marca que pone un efecto declarado después de los del hook. Es por orden, no por tiempo |
| `use-action-keeping-draft.test.tsx`, «una respuesta con error» | Espera el efecto antes de afirmar que el foco no se movió. Podía pasar en falso |
| `la-accion-lanza.test.tsx`, formularios | `toHaveFocus` con `waitFor`. Con `act` antes, y el orden malo forzado, daba rojo en 11 a 16 de 32 |
| `la-accion-lanza.test.tsx` y `conservar-lo-escrito.test.tsx`, `AcceptInvitationForm` | Espera a que el efecto vacíe la clave. Con el orden malo forzado daba rojo en las dos |
| `la-accion-lanza.test.tsx`, «la pantalla lo dice» | Espera 5 s en lugar de 1 s. Ver el rojo abierto, abajo |

**Repetir no bastaba:** en 35 corridas con carga, ninguna de estas dio rojo por foco ni por clave. Lo destapó forzar el orden malo.

## VALIDACIÓN

Con un worker.

| Comprobación | Resultado |
|---|---|
| `use-action-keeping-draft.test.tsx`, sobre `2eeb30d8e`, con 16 procesos de carga | PASÓ, 40 de 40 corridas |
| Lo mismo, sin carga añadida | PASÓ, 30 de 30 corridas |
| Mutantes del hook, sobre `2eeb30d8e` | PASÓ, 7 de 7 mueren: identificador tras `ok`, en cada intento, sin pedirlo, y el foco |
| `la-accion-lanza.test.tsx`, sobre `2eeb30d8e`, con 16 procesos de carga | 34 de 35 corridas. Ver el rojo abierto |
| Las tres pruebas, con la espera de 5 s, sin carga añadida | PASÓ, 76 de 76, una corrida. **No se repitió con carga:** a 1 de 35, pocas corridas no distinguirían |
| Las tres pruebas con el orden malo forzado, 15 y 40 ms, en su versión final | PASÓ: 14 de 14, 32 de 32 y 30 de 30, en las dos esperas |
| Otras diez pruebas en `main`, con el orden malo forzado, 15 y 40 ms: `useDialogA11y`, `CityDrawer`, `TransportistasPanel`, `PrestamoDrawer.foco`, `form-bits`, `TruckDrawer.campos`, `PortalClaims` y tres de `app/entrar/__tests__` | PASÓ, sin cambios: no tienen este patrón |
| Mutante que quita el aviso de `NewPurchaseWizard`, con la espera de 5 s | Muere |
| Mutante que no vacía la clave de `AcceptInvitationForm`, en las dos pruebas | Muere en las dos |
| Las tres pruebas en su versión final, sin carga añadida | PASÓ, 76 de 76, una corrida |
| ESLint de las dos pruebas | PASÓ |
| `tsc` limitado a las dos pruebas | Sin errores en ellas; 1 ajeno de la configuración limitada |
| `pnpm verify` | NO EJECUTADO: otra sesión trabaja con un worker, y son sólo pruebas |

## Rojo abierto, sin diagnóstico cerrado

`la-accion-lanza.test.tsx`, «la pantalla lo dice», caso `NewPurchaseWizard`: **1 rojo en 35 corridas con carga, sin mensaje guardado.** El script sólo guardaba el nombre, y las 25 corridas siguientes, que sí lo guardaban, pasaron.

Es inferencia que fue la espera de 1 s de `findBy`: es el caso más lento, con hasta 584 ms con carga corriendo sólo esos casos, y ahí no hay efecto: `done` se deriva al pintar. Por eso subí la espera a 5 s. **Si vuelve a salir, esa inferencia estaba mal,** y hay que leer el mensaje.

## FUERA DE ALCANCE DETECTADO

Ninguno nuevo.

## Impacto documental

Este handoff. Sin spec nueva, y no cambian políticas.
