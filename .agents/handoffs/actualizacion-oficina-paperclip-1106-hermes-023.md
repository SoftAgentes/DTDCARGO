# Handoff · Evaluación para actualizar la oficina (Paperclip 2026.1106.0 y Hermes v0.23.0)

- **Sesión:** Worker abierta el 2026-11-07 por la sesión `local_b5be0d12…` (oficina).
- **Rama:** `claude/practical-cannon-f13640`, en el worktree
  `.claude/worktrees/practical-cannon-f13640`.
- **Base:** `main` `f28c5dcc1`.
- **Alcance:** evaluar y preparar un plan probado. **No se instaló nada.** El VPS de la oficina
  solo se leyó: cuatro conexiones, la base con `default_transaction_read_only = on` y sin imprimir
  secretos.
- **Entregable:** `docs/organizacion/oficina-agentes/actualizacion-paperclip-hermes.md`.

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
| Pruebas de humo del plan | NO EJECUTADO: el plan se corre con el OK de Sam |
| Búsqueda de IP, correos y llaves en los archivos nuevos | Sin coincidencias |

## Pendientes de esta tarea

1. Publicar la PR en borrador (encargo: «Abre la PR en borrador»). La fusión es del Director
   General.

## FUERA DE ALCANCE DETECTADO

- **Cambio A:** agregar `HERMES_EPHEMERAL_SYSTEM_PROMPT` a
  `infra/oficina/envoltorios/91-agentes-run`, con su prueba y su mutante. Toca la allowlist de la
  SDD-0615 (PR #407), así que necesita su propia SDD o una enmienda.
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
