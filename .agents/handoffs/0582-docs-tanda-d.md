# SDD-0582: documentos al cierre de la tanda D (handoff)

Rama `codex/0582-docs-tanda-d`, worktree `DTD-worktrees/0582-docs-tanda-d`, desde `main` en `7a8afdd2c`. Encargo del Director General, 2026-11-06. **Solo documentos:** no cambia código, infraestructura ni producción. Fusiona él.

## Qué se registró

| Dónde | Qué |
|---|---|
| `docs/specs/0582-chatwoot-piloto/spec.md`, seguimiento | Tandas A a D con imagen, anterior y evidencia, según el Director General. Comprobación de `/privacidad` desde fuera. Pedido de capacitación de Sam, citado y sin orden de empezar |
| `docs/specs/0582-chatwoot-piloto/checklist.md` | 4.6: «Son clientes», «Dejarlo conectado», la regla de «solo cuentas con rol» como premisa nuestra, convivencia con Kommo, salida por API sin probar, token y «Mantener la espera» vigente. 4.5 y 8.2: la alarma de la puerta 7 como condición. 4.5: la frase de Sam sobre el otro número. **Sin cambio de avance: 49,6 %** |
| `docs/specs/0583-chatwoot-vps-e1/spec.md`, seguimiento | Instalación del filtro de logs, con el paso 6 pendiente. Tanda D. `PIEZAS`, en una PR aparte |
| `docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md` | Estado de W5 a W7. Lo que dijo Sam del pendiente de E6, sin tomarlo como decisión. Primer entrante real de Instagram después del corte |
| `docs/specs/0588-chatwoot-versiones-e3/spec.md` | Tanda B y primera fila de `chatwoot_version_checks` en producción. Tandas C y D |
| `.agents/handoffs/0582-e4-canales.md` | Sección del 2026-11-05 sobre Instagram, y una nota que apunta a ella en §4.6 |
| `.agents/handoffs/0583-logs-canales.md` | Instalación hecha; el paso 6, con su hora `T` |
| `.agents/handoffs/0582-guion-publicacion-tanda-a.md` | Primer entrante de Instagram, y W5 a W7 todavía pendientes |

## De dónde sale cada dato

- **Imágenes, horas, evidencias, instalación del filtro y conteos de bandejas:** según el Director General, en sus mensajes del 2026-11-04 al 2026-11-06. No se volvieron a leer.
- **`chatwoot_version_checks`:** leído por el Subdirector el 2026-11-05 a las 13:22:22Z, en una transacción con `ROLLBACK`.
- **`/privacidad` publicada:** comprobada por el Subdirector el 2026-11-06 a las 02:04Z con `curl` al sitio público. Esta nota no cita frases de la página.
- **Lo que dijo Sam:** citado tal como lo pasó el Director General.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `docs:check` | PASÓ: índice sincronizado con 585 specs |
| `sdd:check` | PASÓ: sin números repetidos; los tres choques históricos de siempre, que no se renumeran |
| Secretos y correos en el diff | 0 y 0 |
| `avance-checklist` | 49,6 %, sin cambio |
| `pnpm verify` | NO EJECUTADO: solo documentos, y el Director General pidió no correrlo |

## Pendiente

- **W5 a W7:** los hace Sam y los cuenta el Director General.
- **Paso 6 del filtro:** contar con el primer entrante real después de 2026-11-05T16:12Z.
- **Cron y alarma del token de Instagram:** antes del 2026-12-20, con OK de Sam.
- **Siguientes PR, de a una:** `PIEZAS` con los correos, y después 9.3 con la prueba de «sin nada no abre».

## FUERA DE ALCANCE DETECTADO

- La fila 4.4 todavía dice que en Standard Access solo entran personas con rol. Para Messenger no hay medición en contra: la bandeja 4 tiene 0 entrantes. Se deja igual.
