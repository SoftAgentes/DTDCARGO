# SDD-0582 E4 · 4.8 Correo: la parte que no toca nada vivo (handoff del Worker, 2026-11-07)

- **Owner:** Worker 4.8 correo (claim `worker-0582-4-8-correo`), sesión hija del Subdirector de Chatwoot (`local_535053f4-…`).
- **Ruta y rama:** worktree `.claude/worktrees/goofy-archimedes-797aef`, rama `claude/goofy-archimedes-797aef`, base `main` en `eef75ebef`.
- **SDD:** 0582, paso 4.8. No tiene SDD hija: el diseño, el plan y la allowlist están en [`e4-correo.md`](../../docs/specs/0582-chatwoot-piloto/e4-correo.md) §10.
- **Encargo:** lo abrió el Director General el 2026-11-07 a las 19:38Z, limitado a lo que no toca nada vivo.
- **Permisos:** solo lectura de DNS público. Sin OK nominal de Sam no se toca el Chatwoot vivo, Hostinger ni el DNS, no se leen correos reales y no se manda ningún correo. PR en borrador desde `main`, sin fusionar.
- **Etiquetas:** C código, D documentado, T cuenta o host, R comprobado aquí, I inferencia, NV no verificado.

## OBJETIVO ORIGINAL

1. SPF, DKIM y DMARC por DNS público, en tabla.
2. Plan de lo que falta (P3 adjunto de entrada, P4 rebotes, P7 caída de más de 1 día, PC-3), paso a paso y con pasa o no pasa.
3. Lista corta y en orden de lo que tiene que hacer Sam.
4. Si P4 se arregla con código o configuración en el repo, escribirlo con una prueba que falle antes, sin desplegarlo.
5. Actualizar `e4-correo.md` y la fila 4.8.

## COMPLETADO

1. **DNS (§5 del diseño), R del 2026-11-07 19:58Z.** Leído por DNS sobre HTTPS en `dns.google` y `cloudflare-dns.com`, con los mismos resultados. El UDP 53 a 1.1.1.1 y 8.8.8.8 se agotó desde la PC.
   - MX a Hostinger; SPF con 3 de 10 consultas, que incluye MailChannels (de ahí vino el rebote de P4).
   - DKIM `hostingermail-a` con clave; `-b` y `-c` con `p=` vacío (reserva de rotación).
   - DMARC `p=none` **sin `rua`**.
   - Resend en `send.`; `inbound.` sin MX.
   - **No falta nada para 4.8.**
   - Corregido EC-2: «pasa alineado» no tenía encabezado detrás, así que queda NV hasta leer «Mostrar original».
2. **Plan (§6.2):** P7, P3, P4, cierre de PC-1 y PC-3, con quién, qué, pasa si y no pasa si.
   - P7: N = días desde el 2026-10-30 hasta hoy en UTC. `recuperar` exige el IMAP encendido (`should_fetch_email?`).
   - P4: el rebote vivo va a `@example.com` (MX nulo, R), así que no contacta a nadie.
3. **Lista para Sam (§9):** 8 pasos, cada uno con lo que tiene que ver. Nada en Hostinger ni en Cloudflare.
4. **Arreglo de P4 (§6.3), sin instalar:** [`infra/chatwoot/correo/zz_dtd_correo_sistema.rb`](../../infra/chatwoot/correo/zz_dtd_correo_sistema.rb).
   - **Qué hace:** antepone un módulo a `Imap::ImapMailbox`. Una conversación **nueva** con `auto_reply=true` y abierta queda con «sistema», resuelta y con una nota en español.
   - **Autor:** `Current.executed_by` = la bandeja, como los servicios de asignación de Chatwoot. Así no aparece la nota falsa «0 minutes of inactivity».
   - **Por qué no otra forma (C, v4.19.1):**
     - una regla en `conversation_created` no ve estas conversaciones;
     - una en `conversation_updated` las vería, pero volvería a cerrar el hilo cuando escribe una persona;
     - una tarea periódica levantaría Rails seguido en un VPS con la CPU justa.
   - **Dónde vive:** en `correo/` y no en `rails/`, y no se monta en `compose.yml`. Así ningún despliegue lo instala sin la puerta PC-5, y no dispara el flujo del cargador de Kommo (`infra/chatwoot/rails/**`).
5. **Prueba:**
   - **Archivos:** [`prueba-correo-sistema.sh`](../../infra/chatwoot/pruebas/prueba-correo-sistema.sh), con `sonda-correo-sistema.rb` y los dos overlays.
   - **Dónde corre:** en GitHub Actions ([`chatwoot-correo-sistema.yml`](../../.github/workflows/chatwoot-correo-sistema.yml)), sobre la imagen real, en la red `interna` y con datos `example.test`.
   - **Casos:** 8 (A a H).
   - **Control C sin el inicializador:** tiene que reproducir el hallazgo P4, con el rebote abierto y sin etiqueta aunque la regla «sistema» exista. Esa es la prueba que falla antes.
   - **Control M0:** carga una copia con `SONDA_CARGAR`.
   - **7 mutantes,** uno por guarda o acción. Cada uno comprueba que su `sed` cambió el archivo; se verificó en local que cada `sed` cambia solo su línea.
6. **Documentos:**
   - `e4-correo.md`: estado, EC-2, §5, §6.1 (hallazgo), §6.2, §6.3, §6.4, PC-5 en §7, decisión 6 con recomendación, §9 y §10;
   - checklist, fila 4.8: de `pendiente` a `en curso`, porque PC-1 está en curso desde el 2026-10-30. Puerta PC-5 y evidencia del tramo.
7. **Guion de PC-3** (encargo del Subdirector, 2026-11-07 ~20:35Z): [`infra/chatwoot/correo/bandeja-vzla.rb`](../../infra/chatwoot/correo/bandeja-vzla.rb), nunca corrido en el VPS. Detalle en §6.4 del diseño.
   - **Acciones:** `crear`, `estado`, `reglas`, `dominios N` y `apagar-imap`.
   - **Lo que no hace:** no escribe claves (la escribe Sam en la pantalla de la bandeja), no enciende el IMAP y no borra.
   - **Reglas:** toda regla empieza por la bandeja. En Chatwoot, «contains» con varios valores es `ILIKE ANY` (C, `FilterService#ilike_filter_string`). «Legal» gana sobre «sistema» y «no-cliente» por la guarda `does_not_contain` del asunto.
   - **Prueba:** casos V en la misma prueba de Actions, con la sonda `sonda-bandeja-vzla.rb` y los mutantes W1 (sin bandeja en «sistema») y W2 (sin la guarda del asunto). Cada mutante tiene además una comprobación que debe seguir igual.
8. **Allowlist de `spec.md`:** solo se sumaron `e4-correo.md` y las rutas del paso 4.8, con la misma lista que §10 del diseño.
9. **Arreglo de la prueba de P4 tras la primera corrida de CI:**
   - **El fallo:** el detector de notas de estado leía `content_attributes` con `->`, pero Chatwoot guarda ese `json` como texto, así que el detector no veía nada y M4 sobrevivió.
   - **La corrección:** el detector lee la nota en Ruby y el caso Z lo obliga a ver 1 nota.
   - **El chequeo de los mutantes:** ahora exige que `sed` termine bien y que cambie una sola línea. Un `sed` roto deja el archivo vacío, y el `cmp` de antes lo daba por bueno.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (596 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ (sin números repetidos; los choques históricos conocidos, sin cambios) |
| `git diff --check` | PASÓ |
| `bash -n prueba-correo-sistema.sh` y los 9 `sed` de los mutantes (M1–M7, W1 y W2) en local | PASÓ: cada uno cambia una sola línea; el control con un `sed` roto queda rechazado |
| `corepack pnpm install --frozen-lockfile --offline` (turno del Subdirector, 20:29:52Z a 20:31:23Z) | PASÓ en 1 min 31 s, sin red y sin cambios en Git |
| `node node_modules/vitest/vitest.mjs run scripts/__tests__/avance-checklist.test.mjs --maxWorkers=1` (20:31:34Z) | PASÓ: 12 de 12, en 6,5 s |
| `node scripts/avance-checklist.mjs …/checklist.md --json`, comparado campo por campo con `main` (`250e86f65`) y con la base (`eef75ebef`) | PASÓ: sin diferencias. 49,03 %, etapa E4, paso 4.4, restante 62 d, línea base v4 de 129,5 d |
| «Correo automático (datos inventados)», 1.ª corrida sobre `69eaa40f8` | FALLÓ 1 de 25: M4, porque el detector no podía ver nada (COMPLETADO, punto 9). Pasaron T (31/31), C, M0 y M1, M2, M3, M5, M6 y M7 |
| «Correo automático (datos inventados)», con el arreglo y los casos V | Corre en la PR sobre el commit nuevo; lo lee el Subdirector |
| `prueba-correo-sistema.sh` en la PC (Docker) | NO EJECUTADO, porque Docker Desktop levanta 22 contenedores ajenos |
| Ruby en la PC | NO DISPONIBLE (no hay `ruby`); lo cubre la corrida de Actions |
| `knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» en el worktree (estructural y semántica UNAVAILABLE) |
| `pnpm verify` | NO APLICA: no hay cambio de producto. El cierre se eligió por el diff |

## COMMITS

- `7ae38e229`: el inicializador de correo automático y su prueba (sin instalar).
- `69eaa40f8`: DNS, plan, lista para Sam, checklist y este handoff.
- El commit siguiente: el guion de PC-3 y su prueba, el arreglo del detector de la sonda de P4, el chequeo de los mutantes, la allowlist de `spec.md` y la evidencia de las corridas. Su SHA está en la PR.

## PR / BRANCH

PR en borrador desde `claude/goofy-archimedes-797aef` hacia `main`. Sin fusionar ni desplegar.

## PENDIENTES DE ESTA TAREA

- Resultado de la 2.ª corrida de «Correo automático» sobre el commit nuevo: lo lee el Subdirector y se anota en §6.3 con su SHA. Si sale rojo, se corrige la sonda o el código, nunca la expectativa.
- Al instalar, si Sam elige la opción (b):
  - sumar la pieza a `docs/runbooks/chatwoot-versiones.md`;
  - sumarla a la lista de piezas de `lib/studio/chatwoot/analisis.ts`, que es código de Studio, con su propia SDD;
  - mover el archivo a `rails/` solo si se quiere que el análisis de versiones lo lea solo.
- Lo vivo (P7, P3, P4, PC-5, borrar PC-1 y PC-3) espera los OK de Sam en el orden de §9.

## FUERA DE ALCANCE DETECTADO

- El texto de `/privacidad` con H3 de PC-2 (personas en copia o citadas) es requisito de PC-3. No se comprobó si ya está.
- DMARC sin `rua`: nadie recibe reportes del dominio. Es mejora aparte, con su OK, porque también cubre a Resend y a la web.
- Desde esta PC, el DNS por UDP 53 a resolvedores públicos no responde (por DoH sí).

## HANDOFF AL DIRECTOR

- **Impacto documental:** `e4-correo.md` y la fila 4.8. No se corrió Graphify ni Archify: los publica el Director desde `main` integrado.
- **Lo que necesita Sam** está en §9, en orden. El primer paso no toca nada vivo: leer «Mostrar original» de una respuesta del chat que ya tiene.
- **Riesgo de la opción (b), escrito en §6.3:** un correo real con `Auto-Submitted` queda resuelto con «sistema». Se mitiga con la revisión diaria de la primera semana.
