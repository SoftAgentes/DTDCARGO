# Handoff · Evaluación para actualizar la oficina (Paperclip 2026.1106.0 y Hermes v0.23.0)

- **Sesión:** Worker abierta el 2026-11-07 por la sesión `local_b5be0d12…` (oficina).
- **Rama:** `claude/practical-cannon-f13640`, en el worktree
  `.claude/worktrees/practical-cannon-f13640`.
- **Base:** `main` `f28c5dcc1`.
- **Alcance:** evaluar y preparar un plan probado. Durante la evaluación el VPS solo se leyó: la
  base con `default_transaction_read_only = on` y sin imprimir secretos.
- **Entregable:** `docs/organizacion/oficina-agentes/actualizacion-paperclip-hermes.md`.
- **Actualización del 2026-11-07, 14:57–15:30Z: Hermes v0.23.0 instalado** en el VPS de la oficina.
  - **Autorización:** el OK de Sam en esta sesión, literal «Sí, instálalo». Antes, el Subdirector
    (`local_61442abe…`) avisó que la sesión de la 0615 había dejado el VPS libre.
  - **Resultado:** la §7 del documento.
  - **Escrituras en Paperclip:** dos tareas de prueba creadas por la API con la sesión de Sam en el
    navegador integrado, después de que Sam respondiera «Sí, créala»: HAI-64 (`blocked` por el bug
    de HAI-51) y HAI-65 (`done`).
  - **Paperclip sigue en 1012.**

## Conclusiones

1. **Uso sin precio (1023+).**
   - **ALFRED y el Auxiliar no quedan retenidos.** Sus eventos son `subscription_included`, y el
     conteo de «sin precio» los excluye (código 1106).
   - **Los agentes GLM sí.** En 1106 cada corrida Hermes escribe un evento `unknown`/`unpriced`.
   - **`allow` lo resuelve para los GLM**, pero no el #18956.
2. **#18956.** Sigue abierto. Las 14 políticas son por agente, con corte duro; no hay políticas de
   empresa. Apagar el corte duro de las 8 vivas quita los dos riesgos.
3. **Runner por defecto (1106).**
   - ALFRED y el Auxiliar siguen en `engine: cli`, con `dtd-claude` y `dtd-codex`.
   - El chequeo de credenciales de Codex y la «Existing authentication» de Claude no cambian
     (código comparado entre 1012 y 1106).
   - Regla nueva: no presionar «Upgrade runner» y elegir «Legacy runner» en las altas.
4. **`browser_*` en Hermes 0.23.**
   - Ningún perfil los usa: solo aparecen en comentarios, en skills empaquetadas y en un registro
     de Hermes.
   - Las banderas que pasa Paperclip existen en el parser de 0.23.
   - #18314 y #18316 siguen abiertos. Hoy hay 0 sesiones Hermes guardadas, así que no hay
     regresión.
5. **Riesgo nuevo y bloqueante.**
   - Desde la 1023, Paperclip manda las instrucciones de Hermes en `HERMES_EPHEMERAL_SYSTEM_PROMPT`.
   - El `env_keep` de `/etc/sudoers.d/91-agentes-run` no la deja pasar.
   - Hay que agregarla antes de actualizar Paperclip.

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `pnpm verify` | NO APLICA: solo hay documentación |
| Paso 1, Hermes 0.23: 5.5 Hermes directo | PASÓ |
| Paso 1, Hermes 0.23: 5.3 agente GLM (HAI-65) | PASÓ |
| Paso 1, Hermes 0.23: 5.7 conexión de Discord | PASÓ del lado del servidor («Connected as ALFRED#4271»). NO VERIFICADO con un mensaje: a las 15:18Z no había llegado ninguno de Sam |
| HAI-51 en 0.23 | FALLÓ. Es un bug de Hermes (#98789), ver §7 |
| Pruebas de Paperclip 1106 (5.1, 5.2, 5.4 y 5.6) | NO EJECUTADO: es el paso 3 |
| Búsqueda de IP, correos y llaves en los archivos nuevos | Sin coincidencias |

## Pendientes de esta tarea

1. Que Sam confirme en `#alfred` que la recepción le responde (5.7).
2. La fusión de la PR es del Director General.

## FUERA DE ALCANCE DETECTADO

- **HAI-51 (Hermes #98789):** `cli_single_query.py:547` imprime la pregunta con rich sin
  escaparla, así que una tarea con `[/…]` hace salir a Hermes con exit 1. Arreglarlo en una SDD:
  pasar `-Q` desde `dtd-agente-run` (hay que medir si Paperclip lee igual esa salida) o esperar la
  corrección de Hermes.
- **Rutas `node-26.7.0`** en `dtd-agente-run` y en `dtd-hermes-telegram.service`. Hay que moverlas
  a 26.12.1 en la SDD-0615 o en otra. Mientras tanto, las carpetas viejas se quedan.
- **La HAI-64** quedó en `blocked` como evidencia. Sam decide si la cancela.
- **Cambio A:** instalado por la sesión de la 0615 el 2026-11-07 (sudoers `66b5cd84…`); ya no está
  pendiente.
- **Hojas de alta de `configuracion-paperclip.md` (PR #407):** agregar «Legacy runner» y la regla
  de «Upgrade runner».
- **La guía de la PR #407**, en «Lo que no se hace», dice que no se actualiza a 1023; habría que
  apuntarla a este documento.
- **Hermes en la línea base:** 6 de 8 corridas fallaron en 14 días. «Asesor comercial» y «Jefe de
  gabinete» están en `error`. No se investigó.
- **Roles de los miembros (preset Operator de la 1023):** no medido.

## Impacto documental

Hay un documento nuevo en `docs/organizacion/oficina-agentes/`. No hay SDD, porque no cambia
comportamiento. Graphify y Archify quedan para el Director al integrar.
