# Handoff · SDD-0547 K1-K4 · escritor del estado de publicaciones (Contabo)

| Campo | Valor |
|---|---|
| Owner | Sesión «Contabo VPS y dockerización de proyectos» (Claude), sesión `76245a75-33b5-45af-b48c-cf16c34dd436` |
| Pedido | Director, 2026-10-17, por la SDD-0547 (PR #264): K1-K4 de la spec §5 como PR propia en borrador, solo repo y pruebas, sin instalar nada |
| Ruta | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0547-escritor-publicaciones` |
| Rama | `codex/0547-escritor-publicaciones`, desde `origin/main` `c2fabdcc` |
| SDD | [0547](../../docs/specs/0547-panel-publicaciones-servidor/spec.md), en la PR #264 (cabeza `5dc41943`), §4 y §5 |
| Depende de | La PR #264 en `main`. Sin ella, `scripts/__tests__/infra-env-example.test.ts` sale rojo por el commit del `.env.example` (la raíz todavía declara `VERCEL_API_TOKEN=`) |
| Permisos | Rama propia y PR en borrador (el Director lo pidió). Sin merge, sin instalar en el VPS: K5 se coordina con el Director después del merge |

## Objetivo

- **K1.** `publicar-web.sh` escribe `publicaciones.json` (§4) al final de `vigilar`, `publicar`, `volver`, `congelar` y `descongelar`.
- **K2.** Cada `MOTIVO=` lleva su código de §4.4.
- **K3.** Pruebas del escritor en `infra/ops/tests/prueba-publicar-web.sh`.
- **K4.** El montaje en el servicio `web` de `infra/dtd-cargo/compose.yml`.
- **Además:** quitar `VERCEL_API_TOKEN` del comentario de `infra/dtd-cargo/.env.example:193`.

## Qué cambió

| Archivo | Cambio |
|---|---|
| `infra/ops/web/publicar-web.sh` | `CODIGO` junto a cada `MOTIVO`: 30 asignaciones y 14 códigos, más `rechazada`, que pone `vigilar`. Funciones `evento`, `retenida_una_vez`, `estado_vigilante` y `escribir_estado_web`. Trampa de salida que escribe el estado sin cambiar el código de salida. Historial en `estado/historial.jsonl` (200 líneas; el archivo lleva 20). Vigilante en `estado/vigilante.json`. Marca `estado/congelado-automatico` cuando el script congela al fallar una vuelta atrás. Destino `${PUBLICAR_ESTADO_WEB:-${DIR}/estado-publicacion}` |
| `infra/ops/tests/prueba-publicar-web.sh` | 46 pruebas nuevas en seis secciones «estado …» (50 con la #264 en el árbol), 12 mutantes nuevos y el mutante «no espera healthy» al día con `CODIGO=salud`. El resultado cuenta también los NO VERIFICADO |
| `infra/dtd-cargo/compose.yml` | `- ./estado-publicacion:/var/lib/dtd-cargo/publicacion:ro` en `web` |
| `infra/dtd-cargo/.gitignore` | `estado-publicacion/` |
| `infra/dtd-cargo/.env.example` | Sin `VERCEL_API_TOKEN` en la lista de variables «para scripts locales» |
| `docs/runbooks/publicacion-automatica-web.md` | Fila nueva en «Cómo funciona», sección «Estado para el Studio (SDD-0547)» con la instalación K5 paso a paso, y la nota de pruebas |

Decisiones de implementación (dentro del contrato):

- **`motivo` de `vuelta-atras-fallida`.** Es el de la versión nueva: lo que desató la vuelta atrás. El de la vuelta atrás queda en el aviso urgente y en la evidencia. Lo prueba un caso con «salud» en la nueva y «prueba-rapida» en la vuelta.
- **`actualizado`.** Es la hora en que se escribió el archivo. Un comando a mano también lo renueva.
- **`publicable`.** Es la etiqueta de la copia local de `:publicable`: lo que vio la última vuelta que la bajó. No baja nada.
- **El `vigilante` en los comandos a mano.** Es el de la última vuelta. Con `CONGELADO` dice `congelado`; al descongelar queda en `null` hasta la vuelta siguiente.
- **`retenida`.** Se anota una vez por clave (`clase|digest` + hash del texto del aviso), igual que `avisar_una_vez`. Si cambian las migraciones que faltan, se anota otra.
- **Fuera del historial.** Los estados `detenido` (descarga, disco, ensayo, imagen) y la `rechazada` del minuto siguiente solo cambian el vigilante, no agregan eventos.

## Validación

| Comprobación | Resultado |
|---|---|
| Línea base, antes del cambio: `prueba-publicar-web.sh` en `node:24` | PASÓ: 94 PASÓ · 0 FALLÓ |
| La suite con el cambio, en el árbol de la rama | PASÓ: 140 PASÓ · 0 FALLÓ · 3 NO VERIFICADO (el ejemplo, el parser y la ruta del loader viven en la #264) |
| La suite con los tres archivos de la #264 (`5dc41943`) puestos sobre una copia del árbol | PASÓ: 144 PASÓ · 0 FALLÓ · 0 NO VERIFICADO. `parseEstadoPublicaciones` acepta lo escrito, con `descartados=0`; el ejemplo canónico pasa el validador de formas; el montaje apunta a `RUTA_ESTADO_PUBLICACIONES` |
| Mutantes nuevos y el actualizado, con control rojo (`MUTANTES_SOLO`, 13) | PASÓ: el control rojo da 119 FALLÓ contra un script vacío; 13 muertos · 0 vivos. Entre ellos: sin `chmod 644`, sin `mv`, retenida cada minuto, texto libre al historial, sin topes, sin candado, congelado siempre automático y el motivo de la vuelta en la fallida |
| Batería completa de mutantes, también los de la SDD-0541 (con la #264 en el árbol) | PASÓ: 50 muertos · 0 vivos, ninguno «mal armado». Los 38 de la 0541 siguen muriendo, aunque cambiaron las líneas con `MOTIVO` |
| `vitest run` de `infra-env-example`, `entorno-prueba-compose` y `entorno-prueba-scripts` | 19 PASÓ · 1 FALLÓ. El rojo es el esperado: `VERCEL_API_TOKEN` sigue en el `.env.example` de la raíz de `main`. La misma regla, contra la raíz de `5dc41943`: 122 variables, 0 sin documentar |
| `pnpm verify` | NO EJECUTADO. No hay código de producto (solo `infra/`, pruebas y docs); el cierre se elige por el diff |
| `pnpm docs:check` (`node scripts/build-docs-index.mjs --check`) | PASÓ: índice sincronizado con 531 specs. Los enlaces del runbook y de este handoff a la spec 0547 quedan bien cuando la #264 está en `main` |
| `git diff --check` | PASÓ |

Las corridas de Linux fueron en `node:24` (Docker local), montando el worktree en solo lectura y, para las de la #264, una copia con `lib/studio/publicaciones-types.ts`, `publicaciones-loader.ts` y el ejemplo de `5dc41943` encima. Para el vitest usé temporalmente un junction al `node_modules` del checkout principal, sin instalar nada; ya lo quité.

## Impacto documental

- **Actualizado:** `docs/runbooks/publicacion-automatica-web.md`. Fila del estado en «Cómo funciona», sección «Estado para el Studio (SDD-0547)» con la instalación K5 y la nota de pruebas.
- **Sin tocar:**
  - La spec 0547 vive en la #264. Su §13 (seguimiento) y el criterio 9 los actualiza la #264 o el Director al integrar; esta rama no edita la spec para no chocar con la #264.
  - `docs/runbooks/servidor-contabo.md` no cambia: el estado vive en el runbook de la publicación.
- **Graphify, Archify y Obsidian:** NO EJECUTADOS en este worktree. Esta tarea es solo de infra y su runbook. Lo publica el Director desde `main` integrado.

## Pendientes de esta tarea

- Cuando la #264 esté en `main`: `git merge origin/main` en esta rama, volver a correr la suite (sin NO VERIFICADO) y el vitest de `infra-env-example`, y sacar la PR de borrador.
- K5 (instalación en el VPS): después del merge de esta PR, en la misma ventana y coordinada con el Director (runbook, «Instalación (K5)»).

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.

## Handoff al Director

- PR en borrador, base `main`. **Fusionar después de la #264.** Al fusionar, avisarme: en los ~5 min siguientes instalo `publicar-web.sh`, `compose.yml` y `.env.example` en el VPS, antes de que `:publicable` llegue al merge. Si no, esa publicación queda retenida con motivo `huellas`.
- No toqué el VPS.
