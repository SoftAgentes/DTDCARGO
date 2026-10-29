# Handoff — SDD-0582 etapa E0 (pasos 0.2–0.7)

- **Owner:** Claude Worker (sesión lanzada por la sesión «Chatwoot piloto»), claim `claude-0582-e0`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0582-e0-preparacion`
- **Rama:** `codex/0582-e0-preparacion`, apilada sobre `codex/chatwoot-piloto` (PR draft #327, `af3917a71`)
- **SDD:** 0582 (programa). E0 no cambia código ni infraestructura: no lleva SDD hija.
- **Objetivo:** dejar 0.2–0.7 `entregado` en el checklist con evidencia T/R donde corresponda, reestimar E5, 6.7 y E7.
- **Permisos de esta tarea:** solo lectura en Meta, Kommo, Hostinger, Cloudflare y el VPS. 0.6 exige OK nominal de Sam para leer PII. Sin push ni PR salvo autorización.

## Estado al 2026-10-29

| Paso | Estado | Qué hay | Qué falta |
|---|---|---|---|
| 0.2 | aceptado | 5 decisiones; Kommo vence el 29.05.2027 con renovación automática (T) | Aceptado («Acepto los tres», 2026-10-29); ubicar «analiza mi contestación» en 7.3 |
| 0.3 | entregado | «Importador de China» leído completo (M-16–M-31, T): 1 número, 1 socio (Kommo), 3 cuentas de mensajes, app «Whats DTD» sin activos, 5 plantillas, 2FA no exigida | Aceptación de Sam; OK a la vuelta atrás y a la propuesta; nota cifrada de Sam; PIN, callbacks y overrides por API tras 4.1 |
| 0.4 | aceptado | Kommo leído en solo lectura (K-13–K-22, T): 15 bots y 4 agentes apagados, 7 fuentes, 7 plantillas, integraciones, sin exportación de chats | Aceptado («Acepto los tres», 2026-10-29) |
| 0.5 | aceptado | `info@` = alias de `vzla@` (único buzón); DKIM, SPF, MX y DMARC en verde; Resend sin recepción (C-1–C-13, T) | Aceptado («Acepto 0.5», 2026-10-29) |
| 0.6 | aceptado | Historial leído con la integración nueva; paginación medida (X-1–X-17, R) | Aceptado por Sam («Acepto 0.6», 2026-10-29). Revocar la integración al cerrar E5 |
| 0.7 | entregado | Portfolio verificado y pago propio (Mastercard de DTD) en la cuenta de mensajes del número (M-25, T) | Aceptación de Sam; App Review de Messenger e Instagram en E4 |

Evidencia: [registro E0](../../docs/specs/0582-chatwoot-piloto/investigacion-2026-10-29-e0.md) y [guías](../../docs/specs/0582-chatwoot-piloto/e0-guias.md).

## Reestimación

- 6.7: restante 0,75 d (base 2). 11 Salesbots sin disparador y los 15 apagados; solo se reemplaza el aviso de ventana de 24 h.
- 7.4: restante 1 d (base 1,5). Base v7 y textos de los 4 agentes ya están en el repo.
- E5: ratificado en 7,75 d. La integración con alcance de historial funciona y la paginación es simple; el trabajo extra quedó en 0.6. Riesgo: Messenger sin muestra.
- Resto de E7: sin cambio.

Los días base no cambian (eso exige la línea base v2 y el OK de Sam).

## Decisión que cambia la spec

Sam eligió el VPS actual del ERP en lugar de un VPS 4 dedicado. La decisión G de la spec se actualizó. Riesgo medido: presión de CPU `some` del 31 % a 5 min antes de sumar Chatwoot (VPS-4). Mitigación: límites por servicio en 1.1, respaldo fuera del host en 1.5 y vigilancia del ERP en 1.6; plan B, el VPS dedicado.

## Autorizaciones registradas

- 0.6, lectura de PII: Sam, chat del 2026-10-29, respuesta literal «Sí, OK para esa lectura» a «leer por API, desde el VPS, los mensajes de hasta 20 conversaciones de Kommo con el token que ya usa el ERP, sin guardar su texto (solo conteos)». Se usó solo para eso; no cubre la integración nueva ni la carga.
- 0.6, integración en Kommo: Sam, 2026-10-29, «Sí, créala». Se creó «DTD 0582 historial (solo lectura)» con dos alcances (información de la cuenta e historial de chats externos) y un logo liso de 400×272. La integración aparece creada en Kommo. El token aún no se generó ni llegó al VPS: Sam contestaba las preguntas sin estar mirando la pantalla y pidió entender el procedimiento, así que se pausó. Revocarla al cerrar E5.
- 0.6, paginación: Sam, 2026-10-29, «Sí, autorizo» a revisar hasta 80 conversaciones solo para contar la primera página y leer completas hasta 5 de más de 10 mensajes, solo conteos. Hecho así; token borrado.
- 0.3–0.5 en Chrome: Sam eligió hacerlo juntos, pero el Chrome no tenía sesión en Meta y lo pospuso («Lo hacemos después»).

## Lo que se hizo en sistemas externos (todo lectura)

- VPS del ERP: `free`, `df`, `docker stats`, `ps`, `vmstat` y PSI (05:20 UTC); `kommo_connections` (conteo y estado) y lectura del token de Vault en memoria para 0.6.
- Kommo UI (lectura, 2026-10-29): Facturación, Configuraciones de IA, Fuentes de conocimiento, Usuarios (solo conteo), Bots, Agentes de IA, Plantillas y Centro de integraciones. Nada se cambió.
- Kommo UI: se creó la integración privada de 0.6 (única escritura, autorizada).
- Kommo API: `events`, `talks/{id}`, `talks/{id}/messages` (403), `account`. Nada escrito; ningún cuerpo de mensaje leído.
- DNS público por `dns.google`.
- Hostinger (lectura en el Chrome de Sam): Emails → dtdcargo.com → Buzones, Alias, Reenviadores, Catch-all y Ajustes de dominio. Nada se cambió.
- Resend: `GET /domains` y `GET /webhooks` desde el VPS con la llave del ERP en memoria (no se leyó ningún correo recibido).
- Meta (2026-10-30, acceso de la oficina, solo lectura): Información del negocio, Personas, Socios, Usuarios del sistema, Apps, Cuentas de WhatsApp, Cuentas de mensajes, Páginas, Perfiles de Instagram, Enrutamiento, Apps conectadas, Centro de seguridad y Facturación. Se cerraron 2 avisos informativos (aprobación de pares y herramientas fijadas). Nada se cambió.
- Kommo (2026-10-30, lectura): detalle del número en la integración WhatsApp Business.
- Meta «Importador de China» (2026-10-30, lectura, después de que Sam verificara su cuenta): Cuentas de WhatsApp (pestañas Resumen, Personas, Socios, cuentas vinculadas, cuentas de mensajes y enrutamiento), Cuentas de mensajes, Personas, Usuarios del sistema, Aplicaciones, Socios, Centro de seguridad y WhatsApp Manager (Números, Insights, Perfil y Plantillas). Se cerraron 2 avisos informativos. El menú «⋯» de la cuenta de WhatsApp («Asignar personas», «Suprimir del portfolio») se abrió y se cerró sin elegir nada.
- Se cerró, sin pulsar nada, una ventana de Kommo de «Inicio de sesión con Facebook para empresas» que pedía compartir «Importador de China» y crear una cuenta publicitaria. La IA no la abrió.

## Validación

| Check | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (565 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ |
| `node scripts/avance-checklist.mjs …/checklist.md` | PASÓ (parsea la tabla; avance 0,0 %) |
| `scripts/__tests__/avance-checklist.test.mjs` | NO EJECUTADO: es de Vitest y el worktree no tiene dependencias; el script no cambió |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO APLICA: cambio solo de docs |
| Graphify / Archify / knowledge:status | NO EJECUTADO: docs de una spec sin código; lo publica el Director desde main |

## Pendientes de esta tarea

1. Hecho: 0.1, 0.2 y 0.4 aceptados por Sam el 2026-10-29.
2. Hecho (2026-10-30): Sam entró a «Importador de China» y se leyó todo 0.3 y 0.7. Falta su aceptación, el OK a la vuelta atrás y su nota cifrada con los valores.
2b. Sam: OK o ajustes a la propuesta sobre el modelo nuevo de cuentas (registro E0, «Propuesta de corrección de la spec»).
3. Hecho: Kommo leído el 2026-10-29.
4. Hecho: Hostinger y Resend leídos (0.5 entregado).
5. Hay 3 tokens de la integración «DTD 0582 historial» vigentes 100 días y ninguno guardado; se pueden revocar en Kommo → la integración → Llaves y alcances, y la integración se revoca al cerrar E5.
6. Sam: verificación del negocio y método de pago propio (0.7). Va junto con 0.3, el 2026-10-30.
7. Rama publicada por la sesión principal como PR draft #328 (con la autorización de Sam «Sí, publícalas»). Los commits nuevos van con `git push` normal, sin force ni rebase.

## FUERA DE ALCANCE DETECTADO

- Los documentos que dicen «DNS en Hostinger» (`docs/runbooks/servidor-contabo.md:778-798`, handoff 0505) están desfasados: el DNS está en Cloudflare.
- `docs/runbooks/setup-resend-inbound.md` §6 (respuesta por correo en el mismo hilo) no coincide con el código (`app/studio/(app)/conversaciones/actions.ts:135-141`).
- La presión de CPU del VPS del ERP (31 % `some` a 5 min) existe sin Chatwoot: conviene que el Director mire qué la causa.
- `docs/marketing/kommo-campos-y-cartera.md` contiene correos del personal.
- El token de Kommo del ERP tiene alcances de más para lo que usa (`files_delete`, `users_add`, `users_activate`, `users_deactivate`) y vence en unos 533 días. Lo revisa el Director.
- `docs/marketing/whatsapp-business.md` y otros documentos del repo citan dígitos del número de WhatsApp y un ID parcial de la 2.ª WABA.
- En el VPS del ERP corren varias sesiones de Codex/Orca de varios proyectos (DTD, Loop 3D, Rent Awada) con días de antigüedad. Pueden explicar parte de la presión de CPU (VPS-4); lo revisa el Director antes de 1.1.
- La cuenta de Resend del ERP mezcla dominios de DTD, Hailuway y Loop 3D, y la llave del ERP los ve todos (C-13).
- La cuenta de mensajes «Door tu door» (2.ª WABA vieja, sin número) sigue con Kommo como socio y con la tarjeta de DTD. Conviene decidir si se retira; no es parte de E0.
- En «Importador de China» la 2FA no se le exige a nadie (M-28).
