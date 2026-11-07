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
   - `e4-correo.md`: estado, EC-2, §5, §6.1 (hallazgo), §6.2, §6.3, PC-5 en §7, decisión 6 con recomendación, §9 y §10;
   - checklist, fila 4.8: de `pendiente` a `en curso`, porque PC-1 está en curso desde el 2026-10-30. Puerta PC-5 y evidencia del tramo.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (596 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ (sin números repetidos; los choques históricos conocidos, sin cambios) |
| `git diff --check` | PASÓ |
| `bash -n prueba-correo-sistema.sh` y los 7 `sed` de los mutantes en local | PASÓ: cada uno cambia solo su línea |
| `node scripts/avance-checklist.mjs …/checklist.md` | PASÓ: 49,0 %, línea base v4 de 129,5 d, igual que `main` |
| `scripts/__tests__/avance-checklist.test.mjs` | NO EJECUTADO todavía: turno pedido al Subdirector; el worktree no tiene `node_modules` |
| `prueba-correo-sistema.sh` (Docker) | NO EJECUTADO en la PC, porque Docker Desktop levanta 22 contenedores ajenos. Corre en la PR |
| Ruby (sintaxis del inicializador y de la sonda) | NO DISPONIBLE en la PC (no hay `ruby`); lo cubre la corrida de Actions |
| `pnpm verify` | NO APLICA: no hay cambio de producto. El cierre se eligió por el diff |

## COMMITS

Se anotan al cerrar (ver PR).

## PR / BRANCH

PR en borrador desde `claude/goofy-archimedes-797aef` hacia `main`. Sin fusionar ni desplegar.

## PENDIENTES DE ESTA TAREA

- Correr el vitest del checklist cuando el Subdirector dé turno.
- Leer el resultado de «Correo automático en Chatwoot» en la PR y anotarlo en §6.3 con su SHA. Si sale rojo, corregir la sonda o el inicializador, nunca la expectativa.
- Al instalar, si Sam elige la opción (b):
  - sumar la pieza a `docs/runbooks/chatwoot-versiones.md`;
  - sumarla a la lista de piezas de `lib/studio/chatwoot/analisis.ts`, que es código de Studio, con su propia SDD;
  - mover el archivo a `rails/` solo si se quiere que el análisis de versiones lo lea solo.
- Lo vivo (P7, P3, P4, PC-5, borrar PC-1 y PC-3) espera los OK de Sam en el orden de §9.

## FUERA DE ALCANCE DETECTADO

- La allowlist de `docs/specs/0582-chatwoot-piloto/spec.md` no lista `e4-correo.md` ni los archivos de 4.8. Ahora están en §10 del diseño; sumarlos a la spec lo decide el Director.
- El texto de `/privacidad` con H3 de PC-2 (personas en copia o citadas) es requisito de PC-3. No se comprobó si ya está.
- DMARC sin `rua`: nadie recibe reportes del dominio. Es mejora aparte, con su OK, porque también cubre a Resend y a la web.
- Desde esta PC, el DNS por UDP 53 a resolvedores públicos no responde (por DoH sí).

## HANDOFF AL DIRECTOR

- **Impacto documental:** `e4-correo.md` y la fila 4.8. No se corrió Graphify ni Archify: los publica el Director desde `main` integrado.
- **Lo que necesita Sam** está en §9, en orden. El primer paso no toca nada vivo: leer «Mostrar original» de una respuesta del chat que ya tiene.
- **Riesgo de la opción (b), escrito en §6.3:** un correo real con `Auto-Submitted` queda resuelto con «sistema». Se mitiga con la revisión diaria de la primera semana.
