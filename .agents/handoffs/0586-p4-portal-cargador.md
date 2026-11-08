# SDD-0586 · P4 (10.7): el cargador del chat del portal a Chatwoot (handoff de Worker)

- **Owner:** Worker de Claude Code (E5), sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Encargo del Director General, relayado por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`) el 2026-11-08.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0586-portal-historial-cargador`.
- **Rama:** `codex/0586-portal-historial-cargador`, desde `2e2ddeb34`.
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md) §10.5.10, pasos 3 y 5.6. La spec la edita E10 en su rama (`codex/0586-e10-7-p4-carga`), así que esta rama no la toca para no compartir archivos con E10. El formato de los dos ndjson es el de E10 en `4bdc781b4`, con las tres respuestas y las aclaraciones (i) a (iii) de E5.

## Alcance de esta PR (la primera de E5)

1. `infra/ops/portal-historial/cargar-portal.rb`. Es una copia adaptada de `kommo-historial/cargar-archivo-kommo.rb`, no un import, porque la 0619 retira esa carpeta.
   - Lee `preparado.ndjson` y escribe `vinculos.ndjson`, con solo ids, en `VINCULOS=<ruta>` o en la salida estándar (`VINCULOS=-`).
   - Escribe con `insert_all`, sin callbacks.
   - Antes de escribir comprueba el archivo entero: la cuenta y la bandeja de la cabecera, los conteos, el hilo de cada mensaje, el contacto de cada conversación, los agentes y `AGENTE_SERVICIO`.
   - Reconoce lo ya cargado: el contacto por `identifier = dtd-portal:<identificador>`, la conversación por `additional_attributes.dtd_hilo` y el mensaje por `source_id`.
   - Si el contacto ya tiene un `contact_inbox`, usa ese.
   - Mete la nota de archivo como mensaje de actividad.
   - Tiene un modo seco.
2. La prueba en GitHub Actions: `pruebas/prueba-cargador.sh`, `sonda-portal.rb`, `escenario-portal.rb` y `compose.cargador.yml` (este último, copia del de Kommo), con el workflow `.github/workflows/portal-historial-cargador.yml`.
   - Una corrida real, con un `rails runner` por paso.
   - El control M0.
   - 24 mutantes.

## Allowlist

- `infra/ops/portal-historial/cargar-portal.rb`, nuevo, adaptado de `infra/ops/kommo-historial/cargar-archivo-kommo.rb`.
- `infra/ops/portal-historial/pruebas/prueba-cargador.sh`, nuevo, adaptado de `kommo-historial/pruebas/prueba-cargador.sh`.
- `infra/ops/portal-historial/pruebas/sonda-portal.rb`, nuevo, adaptado de `kommo-historial/pruebas/sonda-cargador.rb`.
- `infra/ops/portal-historial/pruebas/escenario-portal.rb`, nuevo, adaptado de `kommo-historial/pruebas/escenario-mutante.rb`.
- `infra/ops/portal-historial/pruebas/compose.cargador.yml`, nuevo, copia de `kommo-historial/pruebas/compose.cargador.yml`.
- `.github/workflows/portal-historial-cargador.yml`, nuevo.
- `.agents/handoffs/0586-p4-portal-cargador.md`, nuevo.

## Límites

- PR en borrador, sin fusionar.
- Nada en producción ni en el VPS.
- Todos los datos son inventados.
- No se corrió nada en la PC. Para hacerlo hay que pedirle turno al Subdirector.

## Pendientes de esta tarea

- **`webhook_url`.** La guarda sigue en rechazo (G1), como en E5, mientras E10 no confirme cómo queda configurada la bandeja. Si lleva `webhook_url`, se acepta, y C-4 tiene que dar 0.
- **`nota_archivo` y `AGENTE_SERVICIO`.** Hay que ajustarlos cuando E10 publique la versión cerrada del formato.
- **El ensayo (5.6).** Va en una copia efímera con las guardas de `ensayo-archivo.sh`, copiadas a esta carpeta. Va a correr las consultas de control de Studio que escriba E10 (`controles-studio.sql`, C-6 a C-8), si E10 lo confirma.
- **La sección de la spec.** El diseño, la allowlist y la evidencia de esta PR los tiene que llevar la spec 0586, en el commit de E10 o después de que entre su rama.

## Validación

| Comprobación | Resultado |
|---|---|
| `bash -n` de `prueba-cargador.sh` | PASÓ |
| `ruby -c` de los `.rb` | NO DISPONIBLE en la PC, porque no hay Ruby. Los compila la prueba en Actions |
| Workflow «Cargador del chat del portal» | Ver la PR |
| `pnpm verify` | NO EJECUTADO: el cambio es de `infra/ops` y de un workflow, sin producto |

## FUERA DE ALCANCE DETECTADO

Nada por ahora.

## Estado

En curso.
