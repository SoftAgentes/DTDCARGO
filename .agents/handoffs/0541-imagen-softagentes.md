# Handoff — SDD-0541 · dirección de la imagen en softagentes

Fecha: 2026-11-01. Owner: `local_0541-imagen-softagentes`, sesión Worker abierta por el Director.
Worktree: `.claude/worktrees/funny-chatterjee-390769`. Rama: `claude/0541-imagen-softagentes-f62ac9`.
Base: `6d022e94b`. Estado: **INTEGRADO en la PR #345 (`1c2286f1f`) y VENTANA V1 A V6 EJECUTADA; la publicación sigue detenida y es otro paso**.

Límites del encargo, cumplidos por esta sesión: sin merge, sin instalar en el VPS, sin encender timer ni workflows, sin tocar `PUBLICABLE_CONGELADO`, GHCR ni etiquetas, sin migraciones. `compose.yml` no cambió. La integración y la ventana las hicieron el Director y la sesión de Contabo.

## VENTANA DEL 2026-11-01

Ejecutada de 19:17Z a 19:26Z. El OK es de Sam, dado a la sesión Director, que lo transmite así: «Sí, pasos V1 a V6 (Recomendado)». Resultados por paso: [runbook](../../docs/runbooks/publicacion-automatica-web.md#dirección-de-la-imagen--preparación-del-2026-11-01).

| Qué | Cómo se comprobó |
|---|---|
| Corridas `41341050688`, `41341563619` y `41341633174`, en verde sobre `1c2286f1f` | `gh run view` |
| `build-image.yml` y `publicable.yml` activos; `PUBLICABLE_CONGELADO` ya no existe | `gh workflow list`; `gh variable list`, solo nombres |
| Script `f71d27594e568f2b`, blob `397dbc7b…`; anterior `663f9e7e946caec9`, igual a `1bb7ab9fa`; huellas `f813a73425fee9ff` | `git show` y `sha256sum`, en Git. La copia del VPS, sin contar el anterior, se midió el 2026-11-02 a las 00:14Z |
| «Calidad continua» en verde sobre `M` | Corrida `41334833317` |
| Imagen en disco, `CONGELADO` de las 19:17:36Z, timer `disabled` e `inactive`, salud de la web y digest `sha256:b2d48a17…` | Medidos por esta sesión el 2026-11-02 a las 00:14Z, solo lectura y sin abrir el `.env` |
| `revisar` en V6 | **NO VERIFICADO por esta sesión:** informe del Director. No se repitió |
| `929cabf51` no es ancestro de `M`, pero su único commit propio ya está por contenido | `git cherry` da `-`, y sus cinco archivos son iguales en `M` |

`CONGELADO` no existía antes de V2. El estado del runbook decía «congelado» y nombraba timer, workflows y variable, sin esta llave del servidor. Corregí la nota del paso.

## OBJETIVO ORIGINAL

Repuntar la imagen a `ghcr.io/softagentes/dtdcargo` en workflows, script, staging, pruebas y runbook, porque la dirección vieja da «manifest unknown». Clasificar cada aparición del literal, conservar el alias de origen, probar que el script acepta los dos orígenes, medir si `build-image.yml` puede publicar en esa dirección y listar sin valores qué variables y secretos usa.

## COMPLETADO

### Apariciones del literal (252 líneas en 166 archivos en la base)

| Clase | Dónde | Qué se hizo |
|---|---|---|
| **Dirección de imagen** | `.github/workflows/build-image.yml:5,44` · `build-image-prueba.yml:4,55` · `publicable.yml:3` | Cambiada |
| | `infra/ops/web/publicar-web.sh:17,55` · `publicable.mjs:46` | Cambiada |
| | `infra/ops/staging/lib-prueba.sh:8` · `env-prueba.sh:18,50` · `desplegar-prueba.sh:10,26` · `verificar-aislamiento.sh:22,36,54` | Cambiada |
| | `infra/ops/tests/prueba-publicar-web.sh` (2) · `prueba-scripts-entorno-prueba.sh` (7) · `publicable.test.mjs` (2) | Cambiada |
| | `infra/dtd-cargo/README.md:36` · `docs/runbooks/publicacion-automatica-web.md:62` · `entorno-prueba.md:157` · `servidor-contabo.md:317,319` | Cambiada |
| **Dirección de imagen en archivo con huella** | `infra/dtd-cargo/compose.yml:47` (bloqueante) · `infra/dtd-cargo/.env.example:36` (solo avisa) | **NO cambiada aquí.** Van en la PR #348; ver pendientes |
| **Alias de origen** | `publicar-web.sh:62` (`FUENTE_HISTORICA`) · etiquetas `source` de `prueba-publicar-web.sh` · `publicacion-automatica-web.md:131` · contrato de la spec | Conservado |
| **URL del repo, no de imagen** | `lib/studio/publicaciones-types.ts:33` y sus pruebas (`publicaciones-types.test.ts:356`, `PublicacionesServidor.test.tsx:95,158`) · `docs/architecture/stack-tecnico.md:5` · `docs/runbooks/entorno-prueba.md:68` | No se tocan: el alias resuelve al mismo repo (`gh api`: id 1246490707). Ver fuera de alcance |
| **Historia** | `.agents/handoffs` (171 líneas, 121 archivos) · `docs/specs` (21, 14) · audits, governance, marketing, assets (10) · `servidor-contabo.md:695,919` | Igual |

`publicable.yml` no nombra la imagen salvo en su comentario: la obtiene de la constante `IMAGEN` de `publicable.mjs`, sin leer `GITHUB_REPOSITORY`. Cambiar el comentario solo no habría arreglado nada.

### Pruebas nuevas

- Los dobles de `prueba-publicar-web.sh` ahora distinguen direcciones: una referencia solo resuelve en la suya, y `docker images <dirección>` filtra.
- Sección «dirección de la imagen», con literales para que prueba y script no puedan equivocarse juntos:
  - `vigilar`, `publicar` y `revisar` bajan de softagentes.
  - `revisar` acepta los dos orígenes. La tabla de identidad, ya existente, cubre `vigilar`, `publicar` y `<sha>` con ambos.
  - Con la anterior en la dirección vieja publica sin intentar bajarla, y la vuelta atrás automática y `volver` llegan a ella.
  - Sin copia local de la anterior, no publica.
  - La limpieza no toca la dirección vieja.
  - El mismo digest bajo la dirección nueva cuenta como al día.
- Candado en `publicable.test.mjs`: las cinco constantes coinciden con la del promotor, y `.github/workflows`, `infra/ops/web` e `infra/ops/staging` no nombran `ghcr.io/hailuwaycom-sketch`.
- Staging rechaza una imagen `prueba-sha` de la dirección vieja en `env-prueba`, `verificar-aislamiento` y `desplegar-prueba`.
- Dos mutantes nuevos: «dirección de imagen vieja» y «la limpieza toca otras direcciones».

### ¿`build-image.yml` puede publicar en esa dirección? **SÍ, comprobado en V4**

La corrida `41341050688` salió en verde con `GITHUB_TOKEN`. Lo que se sabía antes, sin ejecutarla:

| Hecho | Evidencia |
|---|---|
| El workflow pide `packages: write` y `contents: read`, explícito | `build-image.yml:27-29`. El valor por defecto del repo es `read`, que no lo limita |
| Actions habilitado | `enabled: true`, `allowed_actions: all` |
| Última corrida en verde: **antes** del cambio de nombre | `39453056216`, 2026-10-20 15:56Z, `8e9e0f505`. El `:publicable` de esa corrida lleva el origen viejo |
| El paquete se mudó con el perfil | Medición del Director desde el VPS. `users/hailuwaycom-sketch/packages/container/dtdcargo` da 404 |
| Ajustes del paquete y acceso de Actions | **No se pudieron leer:** el token de `gh` no tiene `read:packages` (HTTP 403) |

### Variables y secretos de `build-image.yml`, sin valores

- **Secretos:** solo `GITHUB_TOKEN`, el automático. `gh secret list` del repo está vacío.
- **Variables definidas (7):** `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Usadas y sin definir (4), van como build arg vacío:** `NEXT_PUBLIC_BUG_REPLAY_ENABLED`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_HAILUWAY_API`, `NEXT_PUBLIC_WHATSAPP_NUMBER`. Inofensivo por lectura del código: `document-import/http.ts` filtra vacíos e `integration-health.ts` da «omitido». Las imágenes publicadas hasta el 2026-10-20 ya se armaron así.
- Todo `NEXT_PUBLIC_*` que lee el código está en los `ARG` del Dockerfile.

**Vercel: ninguna dependencia.** Ni el workflow ni el Dockerfile lo nombran, y ningún valor contiene «vercel» (comprobado por patrón, sin imprimirlos).

**Supabase Cloud: sin dependencia en vivo, con identidad heredada.**
- `NEXT_PUBLIC_SUPABASE_URL` apunta a `dtdcargo.com`, no a `supabase.co`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT con el `ref` de Cloud) y `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` (nombre con ese `ref`) son los de Cloud. Es la decisión de que las sesiones sobrevivieran al corte: `docs/specs/0505-dockerizar-dtd-cargo-contabo/spec.md:105`, `docs/runbooks/servidor-contabo.md:629`.
- Producción acepta esa anon: `GET <URL>/auth/v1/settings` dio **200**, y el control con clave falsa **401**. Solo código HTTP, sin datos.
- **Riesgo a futuro:** si al retirar Cloud rotan el secreto JWT o la anon, hay que actualizar esta variable antes de armar imagen. Un `build-image` con una anon vieja da 401 en el navegador.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `prueba-publicar-web.sh`, prueba nueva contra el script sin cambiar | **ROJO esperado:** 60 PASÓ · 138 FALLÓ |
| `publicable.test.mjs` contra las constantes sin cambiar | **ROJO esperado:** 9 fallan, 29 pasan |
| `prueba-publicar-web.sh` en Linux (`node:24`) | **PASÓ:** 200 PASÓ · 0 FALLÓ · 0 NO VERIFICADO |
| Mutantes de origen, dirección, limpieza y rutas que tocan los dobles | **PASÓ:** 18 muertos, 0 vivos; control rojo con 173 FALLÓ |
| Los demás mutantes del script | **NO EJECUTADO:** unos 25 min, y no tocan lo cambiado |
| `prueba-scripts-entorno-prueba.sh` vía Vitest, en Git Bash | **PASÓ** |
| Esa misma prueba en `node:24` | **No sirve de verde:** 68/16 con `mawk`, y 81/3 con `gawk`. Sobre la base da los mismos rojos (66/16 y 79/3): son del contenedor, no del cambio. Las aserciones nuevas pasan |
| Vitest focal: `publicable`, `entorno-prueba-scripts`, `build-image-prueba-workflow`, `entorno-prueba-runbook`, `ci-workflow-contract`, `pruebas-linux` | **PASÓ:** 135/135 sobre el árbol final |
| `pruebas-linux.sh` completo | **NO EJECUTADO** local. «Calidad local sin secretos» de la PR #345 salió en verde, y «Calidad continua» también sobre `M` |
| Huellas (`huellas-fuera-de-imagen.sh repo . --etiqueta`) | **PASÓ:** sha16 `7d07d4cca1c09296`, idéntico antes y después |
| actionlint de los tres workflows | **PASÓ** |
| shellcheck `--severity=warning` | **PASÓ sin avisos nuevos:** 11 avisos, los mismos que la base, por archivo y código |
| `docs:check`, `sdd:check`, `git diff --check` | **PASÓ** |
| `pnpm verify` | **NO EJECUTADO:** cambio de infraestructura; el encargo pide turno y no hizo falta |
| Registro GHCR, VPS y GitHub Actions reales | **NO EJECUTADO por las pruebas de la PR:** todo con dobles. Lo cubrió después la ventana |

Docker Desktop estaba apagado: lo arranqué para estas pruebas y lo apagué al terminar, sin contenedores vivos.

## COMMITS

- `ea8ca60d7` fix(infra): SDD-0541 — la imagen vive en ghcr.io/softagentes/dtdcargo
- `0c108378f` docs(sdd): SDD-0541 — ventana para volver a publicar desde softagentes
- `1c2286f1f` merge de la PR #345, hecho por el Director.
- El commit de `claude/0541-registro-ventana` que trae este registro de la ventana. Su SHA está en su PR.

Script instalado: blob `397dbc7b565eb8be004d0e215b37971fdb2d6c40`, sha16 `f71d27594e568f2b`, medidos en `1c2286f1f`.

## PR / BRANCH

- Código y ventana: rama `claude/0541-imagen-softagentes-f62ac9`, PR #345, fusionada.
- Registro de la ventana: rama `claude/0541-registro-ventana`, solo documentación, en borrador. La integra el Director cuando convenga, porque cada merge a `main` arma imagen y mueve `:publicable`.

## PENDIENTES DE ESTA TAREA

1. **Publicar.** Es otro paso, después de las migraciones y con su propio OK, por commit exacto: `publicar-web.sh publicar <sha> --aunque-congelado`, con el timer apagado. Encender es aparte y con su OK: `publicar-web.sh descongelar` y `systemctl enable --now dtd-cargo-publicar.timer`, y entra la punta de `:publicable` en ese minuto. Correr `revisar` justo antes de cada uno.
2. **`compose.yml:47` y `.env.example:36`: en la PR #348.** Siguen con la dirección vieja como valor por defecto hasta que se integre. Esa PR los repunta junto con el comentario del bot de deploy de sus líneas 60-61, agrega la prueba de los dos literales y describe la ventana de instalarlos.
   - En producción no se usan: el script exige una línea `DTD_WEB_IMAGE` no vacía. Si faltara, el pull falla a la vista.
   - Staging tampoco: `env-prueba.sh` fija el valor con `--set`.
3. **`compose.supabase.yml` bloquea publicar, decisión abierta.** Difiere del repo en la imagen de `storage`, y `revisar` lo tapa porque para en las migraciones. Medido el 2026-11-02. Detalle y opciones: `.agents/handoffs/0541-publicar-commit-exacto.md`, que llega con la PR #348.
4. **Scripts de staging en el VPS.** V3 instaló solo `publicar-web.sh`. Los de `/srv/ops/staging/` se copian de `main` la próxima vez que se usen.

**Limpieza:** las imágenes de la dirección vieja se quedan en el disco, unos 520 MB cada una, hasta que alguien las borre a mano.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/publicaciones-types.ts:33` arma los enlaces de commit de `/studio/debug` con el alias. Sigue resolviendo. Cambiarlo es comportamiento de Studio y pide SDD y allowlist, además de sus dos pruebas.
- `infra/templates/proyecto/.env.example:24` usa `ghcr.io/hailuwaycom-sketch/cambia-esto` en la plantilla de otros proyectos.
- `docs/runbooks/entorno-prueba.md:68` hace un `gh api -X PUT` con el nombre viejo. Es un paso ya ejecutado; no probé si un PUT sigue el redireccionamiento.
- `smoke-web.sh` tiene dos commits (`facf2b074`, `89473a902`) posteriores a la instalación de `03e0e078`. No pude comparar la copia del servidor, y la publicación la usa.
- `prueba-scripts-entorno-prueba.sh` no pasa en `node:24` porque su `awk` es `mawk` y no entiende `#{4,}`. El runbook no lo avisa.
- Los entornos `Preview` y `Production` de GitHub siguen ahí. Inferencia: los dejó la integración de Vercel. `build-image.yml` no los usa.

## HANDOFF AL DIRECTOR

La única decisión abierta es `compose.supabase.yml`, el pendiente 3, y bloquea publicar. La PR del registro no se fusiona desde aquí; es solo documentación y la integras cuando convenga.

**Impacto documental:** actualizados `publicacion-automatica-web.md`, `entorno-prueba.md`, `servidor-contabo.md`, `infra/dtd-cargo/README.md` y la spec 0541 (continuación con contrato, aceptación y allowlist). `docs/specs/README.md` no hizo falta: `docs:check` pasa. El registro de la ventana toca el runbook, este handoff y la línea de estado de la spec.

**Conocimiento:** `knowledge:status` da `structural` y `semantic` en INVALID por pendientes globales que no son de esta tarea. Las fuentes tocadas no están en `semanticPilot` de `scripts/knowledge-policy.json`. Graphify, Archify y la vista previa de Obsidian: **NO EJECUTADOS**; los publicas tú desde `main` integrado.
