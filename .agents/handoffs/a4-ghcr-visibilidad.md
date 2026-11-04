# A4 · Visibilidad del paquete GHCR `softagentes/dtdcargo`

Fecha: 2026-11-02. Rama `claude/a4-ghcr-visibilidad-5bc386`. Solo docs y un comentario de workflow.

## Conclusión

**El paquete es privado** (inferido de un contraste anónimo; la lectura directa de la API no fue posible). `build-image.yml` decía «imagen pública» y estaba equivocado; `servidor-contabo.md` tenía razón al pedir `docker login` con `read:packages`.

## Evidencia (solo lectura, sin tokens impresos)

| Comando | Salida |
|---|---|
| `gh api orgs/SoftAgentes/packages/container/dtdcargo` | 404: `SoftAgentes` es un usuario, no una organización (`gh api users/SoftAgentes --jq .type` → `User`) |
| `gh api users/SoftAgentes/packages/container/dtdcargo --jq .visibility` | 403 «You need at least read:packages scope». **NO VERIFICADO por API**: el token de `gh` no tiene ese alcance |
| `curl ghcr.io/token?scope=repository:softagentes/dtdcargo:pull` (anónimo) | **401** `authentication required` |
| Control inexistente: `repository:softagentes/no-existe-xyz-123:pull` | 403 |
| Control público: `repository:github/gh-aw:pull` | 200 |

Lectura: un paquete público da 200 anónimo; uno inexistente, 403; el nuestro da 401, es decir, existe y exige autenticación. Además `publicacion-automatica-web.md` registra que el `docker manifest inspect` del VPS lo ve con login. Es inferencia fuerte, no lectura del campo `visibility`.

## Cambios

- `.github/workflows/build-image.yml`: solo el comentario (líneas 16-20).
- `docs/runbooks/servidor-contabo.md` (§1.9): dice que es privado y por qué hace falta el login.
- `docs/runbooks/entorno-prueba.md` (§3): aviso de que el `pull` necesita el login del servidor.

## Pendientes de esta tarea

- Que Sam confirme la visibilidad mirando Settings del paquete, o corriendo `gh auth refresh -s read:packages` y luego `gh api users/SoftAgentes/packages/container/dtdcargo --jq .visibility`.

## FUERA DE ALCANCE DETECTADO

- No se cambió la visibilidad ni el login del VPS (necesitan OK de Sam).
- `docs/runbooks/servidor-contabo.md:695` aún cita `ghcr.io/hailuwaycom-sketch/dtdcargo` (dirección vieja, SDD-0541).
- La spec 0540 (FUERA DE ALCANCE 6 del handoff 0540) la edita A1; hay que marcar la contradicción como resuelta allí.
- Si el `login` del VPS venció, `desplegar-prueba.sh` fallará en `pull`; el login actual es NO VERIFICADO.

## Comprobaciones

Ver el cierre de la PR.
