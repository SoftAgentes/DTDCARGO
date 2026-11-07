# SDD-0589 · pasos 9.4 y 9.5: guía dentro de Chatwoot y recorridos por rol (handoff)

Rama `codex/0589-e9-recorridos`, worktree `.claude/worktrees/sweet-kowalevski-931455`, desde `main` en `7a3cde25d`. Owner del claim: `worker-0589-e9-recorridos`. Encargo del Subdirector de Chatwoot, 2026-11-06: 9.4 y 9.5 de E9, en una PR en borrador contra `main`, sin desplegar nada. La 9.6 queda fuera.

## OBJETIVO ORIGINAL

- **9.4:** script cargado por `DASHBOARD_SCRIPTS` y activado por `postMessage`, con los selectores en un solo archivo y un smoke en E3. Primero el diseño en la spec, después el código y las pruebas locales con DOM sintético. Desplegar en el VPS no es parte de esta tarea.
- **9.5:** recorridos por rol con el motor de `main` (Bandeja, Embudo, Ficha DTD e IA; para admin, además, Usuarios y Actualizaciones). Solo en pantallas de `main`, con anclas `data-guia` y textos del guion. Lo que no tenga pantalla queda pendiente.

## COMPLETADO

El detalle está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-06 · Pasos 9.4 y 9.5»: diseño, protocolo, decisiones D7 a D14, allowlist, aceptación y evidencia.

- **9.4 · El script solo mide** (`infra/chatwoot/panel/guia-panel.html`). La tarjeta la dibuja Studio encima del marco. Acepta mensajes solo de Studio y de la ventana que lo enmarca, y no lee texto, cookies ni almacenamiento.
- **9.4 · Selectores en un solo archivo de Studio** (`lib/studio/guia/chatwoot-selectores.json`), que viajan en el mensaje. Salen del código fuente de Chatwoot `v4.19.1`. **No están medidos en el panel vivo (NV).**
- **9.4 · Puente en la Bandeja:** `usePuenteChatwoot`, con `lib/studio/guia/puente-chatwoot.ts` y `ubicadores.ts`. Si una ancla de Chatwoot no aparece, la tarjeta va al marco (`bandeja.marco`).
- **9.4 · Smoke de E3:** `infra/chatwoot/pruebas/smoke-guia.mjs`, con su núcleo probado. Entra en §4 y S13 del runbook de versiones; el de agentes explica cómo pegar los dos scripts y su marcha atrás.
- **9.5 · Recorridos:**
  - `bandeja`: B1–B6, F1 y U1. B4 la ven admin, commercial y support (S-2 cerrada el 2026-11-07); U1, solo admin;
  - `embudo`: E1–E4, para admin y commercial;
  - `cliente`: F3;
  - `actualizaciones`: A1–A3, solo admin.

  `recorridosParaRol` filtra con el rol del layout.
- **9.5 · Sin arranque automático** (D11). La 0517 está aplicada en producción: sin este freno, fusionar abriría estas guías solas a todo el equipo. Se abren con `?guia=bandeja`, `?tab=embudos&guia=embudo`, `?guia=cliente` y `?guia=actualizaciones`.
- **Pendientes con su motivo, sin inventar pantallas:**
  - F2, I2 e I3: la Ficha DTD enmarcada no monta el motor;
  - F4: el contador está en el sidebar del rediseño;
  - I1 e I4: no hay pantalla de modos de la IA (7.7);
  - U2: no hay pantalla;
  - U3: tiene el texto aprobado y el ancla en el botón Suspender acceso de la ficha de la persona. La ficha es un cajón (capa 100) y la tarjeta va debajo (capa 90): arrancar desde la ficha es de la 9.6.

  Los textos de U1 y U3 los aprobó Sam el 2026-11-07 a las 07:02Z («Apruebo los dos») y están aplicados, con sus huellas en la spec.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Pruebas de la guía (9 archivos) | PASÓ: 140 de 140, 69 nuevas |
| Pantallas tocadas (18 archivos) | PASÓ: 170 de 170 |
| 12 mutantes, uno por vez | PASÓ: 12 de 12 muertos, archivos restaurados |
| `tsc --noEmit` | PASÓ |
| ESLint, con `--max-warnings=0` | PASÓ |
| `docs:check`, `sdd:check`, `components:check`, `governance:check`, `rsc-boundary` y `git diff --check` | PASÓ |
| `/ui-check` | OK con ajustes menores; aplicado el cambio a comillas «» |
| Smoke contra un Chatwoot real | NO EJECUTADO: sin Docker en esta PC y sin OK de despliegue |
| `pnpm verify` | NO EJECUTADO: pide turno del Director General; queda el CI de la PR |
| 2026-11-07, S-2, U1 y U3: guía (9 archivos), Bandeja y Usuarios (11 archivos) | PASÓ: 144 de 144 y 131 de 131. El rojo previo de B4 con `["admin"]` está en la spec |
| 2026-11-07, 3 mutantes: sin ancla U1, sin ancla U3 y texto de U3 cambiado | PASÓ: 3 de 3 caen por su prueba, archivos restaurados |
| 2026-11-07, revisión del DG: merge de `main` `5650ac4fe` y hallazgos 1 y 2, cada uno con su prueba roja antes | PASÓ: guía 146 de 146, Bandeja y Usuarios 145 de 145, `tsc`, gate de símbolos (0 ROJO) y `migrations-lock`. Detalle en la spec |

## COMMITS

Ver la PR. Commits selectivos con `git commit -F`.

## PR / BRANCH

`codex/0589-e9-recorridos` → `main`, en borrador. Su número y su cabeza están en el reporte al Subdirector.

## PENDIENTES DE ESTA TAREA

- **Pegar `guia-panel.html` en `DASHBOARD_SCRIPTS`,** debajo de `dashboard-scripts.html`: OK de Sam. Antes, guardar el valor vivo con su sha256 (runbook `chatwoot-agentes.md`) y resolver los hallazgos 3 y 4 del DG.
- **Hallazgo 3 del DG (2026-11-07):** el panel pasa a `querySelector` cualquier selector que le mande Studio. La propuesta es una lista fija dentro del script, y choca con D8: cada versión de Chatwoot pediría pegarlo otra vez.
- **Hallazgo 4 del DG (2026-11-07):** `bandeja.asignar` (clases de maquetación) y `ficha.panel` (`nth-child`) son frágiles, y el smoke solo mide que algo coincida, no que sea el control correcto.
- **Correr `smoke-guia.mjs`** contra el ensayo local con un agente y una conversación sintéticos, o S13 con la bandeja de prueba, para pasar los selectores de NV a medidos.
- **`pnpm verify`,** con turno del Director General.
- **Filas 9.4 y 9.5 del checklist:** no se tocaron, igual que la 9.3; las mueve quien cuenta el avance. Propuesta: `entregado`, con 0,4 y 0,3 días reales, y la evidencia de la sección de la spec.
- **9.6:**
  - prueba en vivo con quien atiende;
  - colocación de la tarjeta cuando cae al marco: hoy queda abajo a la derecha, encima del composer del chat;
  - encender `arranqueAutomatico` por recorrido, con OK de Sam;
  - arrancar U3 desde la ficha de la persona: la tarjeta tiene que quedar encima del cajón y dentro de su trampa de foco.
- **S-1, S-3 y S-8,** cuando Sam conteste. S-2 se cerró el 2026-11-07 a las 07:00Z («También quien atiende») y ya cambió `ROLES_ASIGNAR`.
- **P-13 (2026-11-07):** la guía tiene que llegar a Embudos sin `?tab=`. Es un paso aparte de la SDD-0589, con PR propia, después de la #408. No arranca hasta que el DG cierre esa revisión, y S3 de la 6.6 no se fusiona antes. Ya pasa hoy, con Dirección por defecto: `?guia=embudo` solo abre con `?tab=embudos`. Ver la spec, sección «2026-11-07 · Paso pendiente: la guía llega a Embudos con Resumen por defecto (P-13)».

## FUERA DE ALCANCE DETECTADO

- **El Embudo vive en `/studio/crm?tab=embudos`.** El motor compara solo el `pathname`, así que cambiar de pestaña no vuelve a evaluar el arranque automático. No importa mientras D11 lo tenga apagado. Antes de encenderlo, el motor tendría que mirar la pestaña. Ahora es el P-13: ver Pendientes.
- **La Ficha DTD dentro de Chatwoot** (`app/studio/(panel)/ficha-chat`) no monta el motor. Las tarjetas F2, I2 e I3 necesitan una decisión de diseño propia.

## HANDOFF AL DIRECTOR

- Fusionar no enciende nada solo: los recorridos nuevos no arrancan sin `?guia=` y el script no está pegado.
- El único efecto visible al publicar es que `?guia=<id>` funciona en esas cuatro pantallas. En Embudos hace falta además la pestaña: `/studio/crm?tab=embudos&guia=embudo`.
- Sin el script, las tarjetas de Chatwoot señalan el marco de la Bandeja.
