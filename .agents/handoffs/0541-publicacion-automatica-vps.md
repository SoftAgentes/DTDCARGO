# Handoff 0541 · Publicación automática de la web en el servidor propio

- Fecha: 2026-10-16 (trabajo de 07:20Z a 09:30Z, aprox.)
- Owner/sesión: `worker-0541-publicacion-automatica` (Claude Code, Worker subagente del Director)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-ac2e6de11fa61947f`
- Rama: `codex/publicacion-automatica-vps`. Era `worktree-agent-ac2e6de11fa61947f` y la
  renombré dentro de mi propio worktree.
- Base: `main` `6da8aebc`, con `origin/main` `8761618d` (SDD-0539) mezclado en la rama.
- PR: en el reporte final y en el cuerpo de la PR (borrador, contra `main`, sin fusionar).
- SDD: [0541](../../docs/specs/0541-publicacion-automatica-vps/spec.md), `in-progress`.
  - La reservé en local con `corepack pnpm sdd:next --reserve publicacion-automatica-vps`:
    ref `codex/sdd-reserve-0541-publicacion-automatica-vps`, commit `b6f07abb`, sin
    publicar. La traje con cherry-pick.
  - `sdd:next` propuso la **0541**, igual que el encargo. No toqué la 0539 ni la 0540.
- Estado de la tarea: lista para revisión. La instalación en el VPS queda pendiente.
- Permisos usados:
  - commits locales, push de mi rama a sí misma y PR en borrador;
  - Docker local, solo para contenedores sin red (`node:24`, `koalaman/shellcheck`,
    `rhysd/actionlint`);
  - lectura de corridas y commits de GitHub con `gh`.

  No hice SSH al VPS, no usé GHCR con credenciales, no toqué Vercel ni producción y
  no corrí `pnpm verify`.

## Objetivo original

Que cada merge a `main` llegue solo a la web del servidor propio, coordinado con la
sesión de Contabo. El encargo pedía:

- spec con alternativas y una recomendación;
- implementación en el repo sin tocar el VPS;
- pruebas con dobles, control rojo y mutantes;
- plan de instalación;
- este handoff, con la tarea aparte del panel del Studio.

## Lo que llegó a mitad de camino (por el Director)

1. **Restricciones de la sesión de Contabo**, medidas en el VPS: root, `.env` 600,
   GHCR privado con login de root, el comando exacto, una sola línea
   `DTD_WEB_IMAGE` sin líneas vacías, la prueba rápida, el **gate de migraciones**,
   compose y cron fuera de la imagen, vuelta atrás, `flock`, `CONGELADO` y tirar
   desde el VPS. Las tomé como requisitos (spec § Contexto).
2. **El script interino de Contabo**, en la misma ruta:
   `/srv/ops/web/publicar-web.sh <sha>` (700, sha16 `507df8e0155f59c7`). Publicó a
   las 08:20Z `sha-8761618d` con pull → sharp → copia del `.env` → `DTD_WEB_IMAGE` →
   `up` → healthy en 24 s → smoke con 14 PASÓ → vuelta atrás. Mi script conserva
   esa interfaz (`<sha>` y también `sha-<sha>`).
3. **El texto exacto del interino (32 líneas) y tres notas de Contabo**, por el
   Director. La comparación paso a paso quedó en la spec, § Comparación con el
   script interino. Las notas, resueltas cada una con su prueba y su mutante:
   1. **Sharp:** el mío ya convertía a WebP (el interino solo hace `require`).
      Sumé `-w /app` como el interino. Con la imagen local vieja
      `dtdcargo:0505-test`, anterior al arreglo de libvips, las dos pruebas fallan
      igual: `libvips-cpp.so.8.18.3: cannot open shared object file`. El caso
      bueno no lo pude medir en local (sin GHCR no tengo una imagen nueva).
   2. **Copias `.env.bak-publicar-*`:** se conservan las 3 últimas
      (`PUBLICAR_CONSERVAR_COPIAS_ENV`), con el mismo nombre del interino, así que
      también rota las suyas. Las demás copias no se tocan y nunca se imprime su
      contenido.
   3. **Vuelta atrás segura:**
      - si la anterior es la misma imagen que la nueva, lo dice y no hace nada (a
        mano sale 0 y no deja `:publicable` rechazada; `volver` sale 1);
      - si la anterior no está en el servidor, la baja antes de publicar, y si
        tampoco puede, no publica;
      - la limpieza protege por id la vigente, la anterior y la que corría, y ni
        siquiera intenta borrarlas.

   También se niega con `compose.ensayo.yml`, como el interino: en `vigilar`, a
   mano y en `volver`. Lo que difiere del interino y conviene saber: la evidencia
   pasa de un `.txt` a una carpeta con otro nombre.

   **La sesión de Contabo confirma en el paso C2a** que el archivo del servidor es
   ese texto (sha16) y lo guarda antes de reemplazarlo.

## Recomendación

**(a′) Timer de systemd en el VPS que sigue `:publicable`.** Es la recomendación de
Contabo con un solo cambio: la etiqueta solo se mueve con la imagen y el CI en
verde, porque `:main` quedó el 16-10 en un commit con el CI en rojo (`6da8aebc`).
No hay llave del servidor en GitHub ni token de GitHub en el servidor.

## Completado

- `infra/ops/web/publicar-web.sh`:
  - `vigilar` (el timer), `<sha>`/`publicar <sha>` (la interfaz del interino),
    `volver`, `revisar`, `congelar`/`descongelar`, `aceptar-pendiente` y `estado`;
  - puertas: migraciones contra el ledger (todas por encima del corte, también las
    esperas, salvo las aceptadas a mano), compose y cron iguales al commit, y sharp
    dentro de la imagen;
  - cambia solo `DTD_WEB_IMAGE`, fijada por digest, con copia previa;
  - el comando exacto de Contabo, healthy, la prueba rápida con un reintento y la
    vuelta atrás automática; la imagen fallida queda rechazada y, si la vuelta
    atrás también falla, se congela solo;
  - `flock`, evidencia con `SHA256SUMS`, Telegram y Kuma (una vez por motivo) y la
    limpieza de imágenes de su repositorio;
  - los avisos largos se recortan (Telegram a 3500 caracteres, Kuma a 200). La
    lista entera de migraciones faltantes queda en la salida del servicio (el
    journal): una retención no abre carpeta de evidencia.
- `infra/ops/web/huellas-fuera-de-imagen.sh`: las mismas huellas en GitHub y en el
  VPS (compose, cron, `.env.example`, plantillas, volúmenes y la unión de
  `functions/`). También dan lo mismo en Git Bash: está normalizado el formato
  binario de su `sha256sum`.
- `infra/ops/web/publicable.mjs` y `.github/workflows/publicable.yml`:
  - deciden y mueven `:publicable` (CI de main o atajo de la PR con la rama al día y
    el mismo árbol; nunca retrocede);
  - copian los mismos bytes del manifiesto por la API del registro;
  - se congelan con `PUBLICABLE_CONGELADO`.
- `.github/workflows/build-image.yml`: un paso con `continue-on-error` suma tres
  etiquetas (`org.dtdcargo.migraciones`, `…-en-espera` y `…fuera-de-imagen`). El
  resto del workflow no cambia.
- `infra/dtd-cargo/systemd/dtd-cargo-publicar.{service,timer}`: oneshot, cada 60 s
  desde que termina la vuelta anterior.
- Pruebas:
  - `infra/ops/tests/prueba-publicar-web.sh`: dobles de `docker`, `curl` y la
    prueba rápida, más `--mutantes`;
  - `infra/ops/tests/publicable.test.mjs`: Vitest; entra en `pnpm test` del CI.
- Docs:
  - la spec, con 7 alternativas comparadas, el diseño, la seguridad, los tiempos y
    5 decisiones para Sam;
  - `docs/runbooks/publicacion-automatica-web.md`: el plan de instalación A/B/C/D con
    una comprobación por paso, más la operación;
  - el índice de specs regenerado.
- No toqué `corte-paso2.sh`, `smoke-web.sh`, `telegram-webhook.sh`, las etiquetas de
  Traefik, el compose ni `quality.yml`.

## Validación

| Comprobación | Resultado | Detalle literal |
|---|---|---|
| `bash infra/ops/tests/prueba-publicar-web.sh` en `node:24`, sin red | **PASÓ** | `RESULTADO: 94 PASÓ · 0 FALLÓ` sobre el árbol final, con las tres notas de Contabo y `compose.ensayo.yml` (antes de esas notas: 82) |
| `--mutantes`, tercera corrida completa (38 mutantes, después de las notas de Contabo, repartidos en dos contenedores con `MUTANTES_PARTE`) | **PASÓ** después de corregir el corredor | Control rojo `76 FALLÓ` en los dos. Mitad 1: `17 muertos · 2 vivos`; los 2 eran «mal armados» porque `perl` tomaba como opción un texto que empieza con guion (`Unrecognized switch: --entrypoint…`). Mitad 2: `19 muertos · 0 vivos`. Con el corredor corregido (`--`), los 2 y el de las copias (cambié su línea de prueba): `3 muertos · 0 vivos`. Total: **38 de 38** |
| Prueba de sharp contra una imagen real (`dtdcargo:0505-test`, local, sin red) | **PASÓ** como control | Es una imagen vieja, anterior al arreglo de libvips. Fallan las dos: el `require` del interino y la conversión del nuevo (`ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3`), con exit 1. Caso bueno: **NO DISPONIBLE** en local (sin GHCR no hay imagen nueva) |
| `--mutantes`, primera corrida (21 mutantes) | **PASÓ** después de corregir | `control rojo: contra un script vacío la suite falla (59 FALLÓ)`. Primero: `19 muertos · 2 vivos`. Uno vivo («borra la imagen anterior») porque la anterior caía entre las 2 más nuevas: la prueba ahora la deja como la más vieja. El otro estaba mal armado (texto viejo). Repetidos solos con `MUTANTES_SOLO`: los 2 `MUERTO`, control con 60 FALLÓ |
| `--mutantes`, segunda corrida completa (24 mutantes, con sharp y la interfaz del interino) | **PASÓ** | `control rojo: contra un script vacío la suite falla (66 FALLÓ)` · `RESULTADO MUTANTES: 24 muertos · 0 vivos`. Los 7 primeros corrieron antes del recorte de avisos; ver § Mutantes finales |
| Huellas de `huellas-fuera-de-imagen.sh` en Linux y en Git Bash | **PASÓ** después de corregir | Antes diferían en las 3 carpetas: el `sha256sum` de Git Bash escribe `*./ruta`. Normalizado: la salida de Linux quedó idéntica byte a byte (`cmp`) y Git Bash ahora coincide con Linux |
| `vitest run infra/ops/tests/publicable.test.mjs` | **PASÓ** | `Tests  30 passed (30)` (también después del merge de `origin/main`) |
| Mutantes de `publicable.mjs` (scratchpad, `node` directo) | **PASÓ** | `RESULTADO MUTANTES: 19 muertos · 1 vivos`. El vivo es el CONTROL sin cambio, que tiene que quedar con «Tests 30 passed». El primer intento dio «19 vivos»: el `shell: true` partía la ruta con espacios y ninguna corrida tenía línea `Tests`. Era un arranque roto, no mutantes vivos |
| actionlint 1.7.12 (`build-image.yml`, `publicable.yml`, `quality.yml`) | **PASÓ** | exit 0 |
| shellcheck 0.11.0 `-S warning` sobre los 3 scripts | **PASÓ** | exit 0. Con `-S info` quedan notas: SC2016 (textos literales de los mutantes, a propósito), SC2015 (`A && ok \|\| ko`, el estilo de las pruebas de `infra/ops/tests`), SC2012 y un SC2094 falso (`SHA256SUMS` está excluido del `find`) |
| `bash -n` de los scripts | **PASÓ** | dentro de la suite |
| `corepack pnpm docs:check` | **PASÓ** | `✓ docs:check — índice sincronizado con 526 specs` (después del merge) |
| `corepack pnpm sdd:check` | **PASÓ** | `[OK] numbering: sin números repetidos` |
| `git diff --check` | **PASÓ** | exit 0 (corregí dos líneas con espacios en la spec) |
| `pnpm verify` | **NO EJECUTADO** | lo prohíbe el encargo (una corrida pesada a la vez). El diff es infra, CI y docs: el único archivo que entra en `pnpm test` es `publicable.test.mjs`, ya verde |
| Primera corrida real de `publicable.yml` y de las etiquetas en GHCR | **NO DISPONIBLE** | solo después del merge (`workflow_run` exige el archivo en `main`). Si falla, no mueve nada y el servidor sigue igual |

### Mutantes finales

La segunda corrida completa (24 muertos de 24) usó el script con la prueba de sharp
y la interfaz del interino. A mitad de esa corrida sumé el recorte de los avisos
largos (solo cambian `telegram()` y `kuma()`). Para que los 7 primeros también
queden medidos sobre el script final, más los 2 mutantes nuevos del recorte, los
corrí otra vez filtrados:

- `control rojo: contra un script vacío la suite falla (67 FALLÓ)`;
- `RESULTADO MUTANTES: 9 muertos · 0 vivos`. Los dos del recorte murieron por la
  prueba de 300 faltantes: `telegram=13337` con el mutante de Telegram y
  `kuma=13132` con el de Kuma.

Después de las notas de Contabo sobre el interino corrí otra vez **todos** (38: los
26 de antes y 12 nuevos), porque `publicar_imagen` cambió de forma. Los 38 mueren
contra el script final (ver la tabla). Los 12 nuevos:

- sharp solo `require`;
- sharp fuera de `/app`;
- conserva todas las copias del `.env`;
- borra copias del `.env` ajenas;
- republica la misma imagen;
- publica sin imagen anterior;
- no baja la anterior que falta;
- la limpieza borra la vigente;
- la limpieza borra la anterior;
- sin la negativa del ensayo;
- el no-op deja `:publicable` rechazada;
- `volver` a la misma imagen.

Los 19 de `publicable.mjs` también mueren, con su control vivo. Reproducir:
`MUTANTES_SOLO="a|b" bash infra/ops/tests/prueba-publicar-web.sh --mutantes`
(en Linux). El corredor de `publicable.mjs` quedó en el scratchpad de la sesión.
Para reescribirlo: reemplazar un texto exacto, correr
`node node_modules/vitest/vitest.mjs run infra/ops/tests/publicable.test.mjs` sin
shell, contar como muerto solo con una línea `Tests … failed`, y restaurar
comparando el sha256. Mutantes (uno por garantía):

- el atajo acepta una rama atrasada;
- el atajo acepta otro árbol;
- en la PR vale cualquier evento;
- en main vale un `workflow_dispatch` del CI;
- ignora el modo solo CI de main;
- el atajo acepta un commit directo;
- sin puerta de imagen;
- puede retroceder;
- simular sube igual;
- congelado no frena;
- exime las esperas;
- sube otros bytes;
- no compara la cabecera con los bytes;
- no verifica el digest después de subir;
- cuenta corridas de otro workflow;
- cuenta corridas en rojo;
- cuenta corridas de otro sha;
- acepta nombres raros;
- sin ventana.

## Commits

| Commit | Propósito |
|---|---|
| `de15a329` | reserva de la SDD-0541 (cherry-pick del stub) |
| `37a091e2` | `publicar-web.sh`, huellas, la prueba con dobles y las unidades de systemd |
| `5d680af6` | `publicable.mjs`, su prueba, `publicable.yml` y las etiquetas de `build-image.yml` |
| `edf5773a` | la limpieza protege la imagen anterior aunque sea la más vieja (mutante vivo) |
| `e1db5c66` | spec, plan de instalación e índice |
| `e78f274e` | merge de `origin/main` (`8761618d`, SDD-0539); el driver resolvió el índice |
| `197a18e8` | la interfaz del interino (`<sha>`) y la prueba de sharp |
| `cdcbd361` | la prueba de Vitest borra sus temporales |
| `ea1c31f5` | docs: el interino, el paso C2a y tres correcciones de texto |
| `2f866f93` | los avisos largos se recortan para Telegram y Kuma |
| `d2e758b8` | las huellas son iguales en Linux y en Git Bash |
| `b3981a0f` | el handoff (primera versión; CI verde en la PR, run 38875760362) |
| `85902e85` | merge de `origin/main` (#245 y #248, solo docs y la 0539) |
| `1442188f` | las tres notas de Contabo sobre el interino y `compose.ensayo.yml` |
| `21709da7` | docs: comparación con el interino, paso C2a y avisos nuevos |
| `569860cc` | el corredor de mutantes acepta textos con guion; `find` en vez de `ls \| grep` |
| commit que contiene este documento | el handoff, al día |

## PR / rama

- Rama `codex/publicacion-automatica-vps`, publicada a sí misma.
- PR en borrador contra `main` (la URL va en el reporte final y en la PR).
- Worktree `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-ac2e6de11fa61947f`.

## Decisiones para Sam (spec § Decisiones)

1. **Atajo de la PR.** Recomendado y encendido. Sin él, la web entra a los ~30 min y
   una seguidilla de merges no publica.
2. **0422 y 0423** aceptadas al instalar como esperas que van después de la web.
3. **Funciones distintas:** recomendado avisar, no frenar.
4. **Chat de Telegram y bot** para los avisos. Kuma alcanza para encender.
5. **El corte de 25-30 s por publicación** (estimado, NO MEDIDO): se acepta o se
   abre una tarea aparte con dos contenedores.

## Plan de instalación

En [docs/runbooks/publicacion-automatica-web.md](../../docs/runbooks/publicacion-automatica-web.md):

- A · Director: merge, etiquetas y la primera corrida de «Imagen publicable».
- B · Sam: las decisiones, el monitor push de Kuma, el chat opcional y el OK nominal
  para encender.
- C · sesión de Contabo, después del corte:
  - **C2a: comparar con el interino** y guardarlo;
  - copiar los scripts y las unidades, y crear `publicar.env`;
  - `revisar`, `aceptar-pendiente` de la 0422 y la 0423, y sincronizar los compose
    si difieren;
  - la primera publicación a mano, el simulacro de `volver` y encender el timer.
- D · primer merge de producto medido.

No hay nada que pagar ni secretos nuevos en GitHub. El único secreto nuevo es la URL
del monitor push de Kuma (y el chat, si se usa), en un archivo 600 del servidor.

## Pendientes de esta tarea

- Los criterios 5, 6 y 7 de la spec dependen del merge (Director, con el OK de Sam)
  y de la instalación (Contabo).
- Las decisiones B1 a B4 de Sam.

## Preguntas abiertas para la sesión de Contabo

1. ¿Algo lee las evidencias del interino, `publicar-web-<sha8>-<hora>.txt`? El
   nuevo deja carpetas `publicar-web-<hora>-publicar-<sha8>/`.
2. ¿Existen en `/srv/dtd-cargo` `.env.example`, `supabase/templates/` y
   `supabase/volumes/` como copias de `main`? Si no, `revisar` los muestra como
   `ausente`. Solo avisan: no frenan la web.
3. ¿`DTD_FUNCTIONS_DIR` está en el `.env`? El script lo respeta. Sin él usa
   `./functions`.
4. ¿El login de GHCR de root vence? Si vence, el vigilante avisa «no pude bajar…».

## FUERA DE ALCANCE DETECTADO

1. **`main` `6da8aebc` con «Calidad continua» en rojo** (run 38826700063, paso
   «Unitarios»). Falló una sola prueba:
   `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx › cambio en lote › si falla, el panel queda abierto con el error y la selección se conserva`.
   El mismo árbol pasó en la PR #244 (run 38823473266). Parece inestable: corresponde
   a una tarea aparte.
2. **`build-image.yml` puede dejar commits sin `sha-*`.** Su comentario dice «cada
   commit de main debe tener su `sha-*`» gracias a `cancel-in-progress: false`.
   Según la documentación de GitHub, con un grupo de concurrencia queda una sola
   corrida pendiente: la pendiente anterior se cancela aunque `cancel-in-progress`
   sea `false`. Con tres merges en menos de 4 minutos, el del medio se queda sin
   imagen. NO VERIFICADO en este repo. `:publicable` lo tolera (salta al siguiente),
   pero la vuelta atrás a ese commit puntual no existiría.
3. **No hay forma pública de ver qué SHA corre** sin el bearer de `/api/debug/health`.
   El Director lo confirma hoy solo por la sesión de Contabo o por la evidencia.
4. **El login de GHCR de root** tiene alcance y vencimiento NO VERIFICADOS (dato de
   Contabo). Conviene un token propio, solo `read:packages`, con vencimiento
   conocido y anotado.
5. **Las funciones del self-hosted no se publican solas.** El vigilante solo avisa.
   Automatizar `functions/` sería otra tarea.
6. **`infra/ops/README.md` y `docs/runbooks/servidor-contabo.md`** no enlazan todavía
   el runbook nuevo. Son de Contabo: sumar una línea cuando lo instale.

## Tarea aparte: el panel de publicaciones del Studio (NO implementada)

**Hoy:**

- `app/studio/(app)/_actions/deployActions.ts` › `getDeployStatusAction()` lista
  publicaciones con `lib/studio/vercel-deploys.ts` › `listRecentDeploys()`, que pide
  `https://api.vercel.com` con `VERCEL_API_TOKEN` y `VERCEL_PROJECT_ID`.
- `lib/studio/env-status.ts` muestra `VERCEL_*` como integración.
- Con Vercel en pausa, el panel queda vacío o en error.
- El bot de deploy (`gitPushAction` con `assertLocal()`) no cambia.

**El ajuste propuesto**, con su SDD, su allowlist y su `/ui-check` (es UI del Studio):

- **(Recomendada) Estado escrito por el servidor.**
  - `publicar-web.sh` escribe un `publicaciones.json` chico: las últimas N, con sha,
    hora, origen, resultado y motivo, sin secretos ni rutas.
  - Va en una carpeta montada de solo lectura en `web`. Es un `volumes:` en el
    compose, sin tocar las etiquetas de Traefik: lo hace Contabo.
  - El panel lo lee. Muestra lo que el servidor de verdad hizo, también las
    retenciones y las vueltas atrás, sin tokens nuevos.
- **Alternativa: leer GitHub.** Las corridas de «Imagen publicable» y el SHA que
  corre (`NEXT_PUBLIC_BUILD_SHA`). Exige un token de lectura del repo en el `.env` y
  no ve las retenciones del servidor.
- En los dos casos: quitar `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` y `VERCEL_TEAM_ID`
  de la lista de integraciones de `env-status.ts`, o marcarlas «retiradas», y
  ajustar sus pruebas.

## Impacto documental y conocimiento

- Documentos canónicos nuevos:
  - la spec 0541;
  - `docs/runbooks/publicacion-automatica-web.md`.
- Documento canónico modificado: el índice de `docs/specs/README.md`.
- No toqué `servidor-contabo.md` (de Contabo).
- `pnpm knowledge:status` en el worktree, sobre `edf5773a` (antes del merge):
  - `ok: false`;
  - structural `INVALID` (4718 pendientes, 3474 ausentes);
  - semantic `INVALID` (1244 pendientes);
  - Archify `PENDING` (`ARCHIFY_RUNTIME_MISSING`: falta extraer archify 2.16.0 en
    `graphify-out/archify-package`);
  - Obsidian `PENDING`, en la revisión `6da8aebc`.

  Es el estado de un worktree nuevo sin derivados. No corrí Graphify ni Archify: son
  corridas pesadas y el Director las publica desde `main` integrado. Pendiente
  global visible: la actualización estructural de las fuentes nuevas
  (`infra/ops/web/*`, la spec y el runbook) al integrar. Ninguna está en el piloto
  semántico.
- Gobernanza: las políticas del registro son de UI y de la app, así que **no
  aplican**. Datos personales: solo se leen nombres de migraciones del ledger, así
  que **no aplica** `revisar-datos-ve`.

## Handoff al Director

1. Revisar la PR, sobre todo:
   - la regla del atajo de la PR (`evaluarCommit`);
   - el gate de migraciones sin eximir esperas;
   - el paso nuevo de `build-image.yml`, que no puede romper la imagen
     (`continue-on-error`, la salida se escribe al final).
2. Antes del merge, pasarle a Sam las 5 decisiones y el pedido B4. Fusionar solo con
   su OK. `main` está congelado.
3. Después del merge:
   - comprobar A2 y A3 del runbook (las tres etiquetas en el log de «Imagen Docker»
     y el resumen de «Imagen publicable»);
   - si quieres ver la decisión primero: `gh workflow run publicable.yml -f simular=true`.
4. Pasarle a la sesión de Contabo el runbook y las 4 preguntas. Lo primero es el
   paso C2a: comparar con el interino.
5. El claim de este worktree queda liberado al cerrar. La rama y el worktree se
   conservan.
