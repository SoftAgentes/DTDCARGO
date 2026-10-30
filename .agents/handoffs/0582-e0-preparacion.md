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
| 0.3 | aceptado | «Importador de China» leído completo (M-16–M-31, T) | Aceptado («Apruebo todo», 2026-10-29). Nota cifrada de Sam con los valores; PIN, callbacks y overrides por API tras 4.1 |
| 0.4 | aceptado | Kommo leído en solo lectura (K-13–K-22, T): 15 bots y 4 agentes apagados, 7 fuentes, 7 plantillas, integraciones, sin exportación de chats | Aceptado («Acepto los tres», 2026-10-29) |
| 0.5 | aceptado | `info@` = alias de `vzla@` (único buzón); DKIM, SPF, MX y DMARC en verde; Resend sin recepción (C-1–C-13, T) | Aceptado («Acepto 0.5», 2026-10-29) |
| 0.6 | aceptado | Historial leído con la integración nueva; paginación medida (X-1–X-17, R) | Aceptado por Sam («Acepto 0.6», 2026-10-29). Revocar la integración al cerrar E5 |
| 0.7 | aceptado | Portfolio verificado y pago propio en la cuenta de mensajes del número (M-25, T) | Aceptado («Apruebo todo», 2026-10-29). App Review de Messenger e Instagram en E4 |

Evidencia: [registro E0](../../docs/specs/0582-chatwoot-piloto/investigacion-2026-10-29-e0.md) y [guías](../../docs/specs/0582-chatwoot-piloto/e0-guias.md).

## Cierre de E0 (2026-10-29)

Los 7 pasos de E0 están aceptados: 5 de 5 días base. Real: 3,5 d frente a 5 d base. La reestimación de E5, 6.7 y E7 queda como está abajo; no hay cambio de línea base.

## Reestimación

- 6.7: restante 0,75 d (base 2). 11 Salesbots sin disparador y los 15 apagados; solo se reemplaza el aviso de ventana de 24 h.
- 7.4: restante 1 d (base 1,5). Base v7 y textos de los 4 agentes ya están en el repo.
- E5: ratificado en 7,75 d. La integración con alcance de historial funciona y la paginación es simple; el trabajo extra quedó en 0.6. Riesgo: Messenger sin muestra.
- Resto de E7: sin cambio.

Los días base no cambian (eso exige la línea base v2 y el OK de Sam).

## Decisión que cambia la spec

Sam eligió el VPS actual del ERP en lugar de un VPS 4 dedicado. La decisión G de la spec se actualizó. Riesgo medido: presión de CPU `some` del 31 % a 5 min antes de sumar Chatwoot (VPS-4). Mitigación: límites por servicio en 1.1, respaldo fuera del host en 1.5 y vigilancia del ERP en 1.6; plan B, el VPS dedicado.

## Autorizaciones registradas

- 0.8, 2026-10-30: Sam respondió por el selector de la app; el Director pasó las respuestas literales: «¿Cuenta como cliente quien ya tiene carga recibida en China, aunque todavía no tenga envío creado?» → «Sí cuenta (Recomendado)»; «Si a un cliente le cancelan o borran su único envío, ¿qué pasa?» → «Vuelve a lead (Recomendado)»; «¿El bot responde con 1 mensaje o con 3?» → «1 mensaje (Recomendado)». Cubre aceptar 0.8 y escribir la regla. No cubre la migración de 10.1, que tiene su propio OK.

- Línea base v3, 2026-10-29: Sam aprobó el análisis comparativo del Director (video y kit de Basdonax, guía de Meta, calculadora, contraplan de Codex y costo por chat). No hay frase literal; se registra como «aprobación del análisis comparativo del Director, 2026-10-29» (texto que pasó el Director). Cubre escribir la v3 en el checklist y la spec. Las decisiones nuevas de 0.8 y el 2.8 opcional siguen pendientes de Sam.

- Línea base v2, 2026-10-29: Sam aprobó el plan v3 del Director en la app. No hay frase literal; se registra como «aprobación del plan v3 del Director, 2026-10-29» (texto que pasó el Director). Cubre escribir la v2 en el checklist y la spec. La regla de «cliente» queda para 0.8.

- Meta, 2026-10-29: Sam, «Apruebo todo», 2026-10-29, a: dejar el número en «Importador de China»; cuenta de mensajes propia para Chatwoot con sus plantillas y pago; la vuelta atrás de 0.3; y aceptar 0.3 y 0.7. Se aplicó a la spec (decisión B y prohibiciones) e `instrucciones-ia.md`.

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
- Meta (2026-10-29, acceso de la oficina, solo lectura): Información del negocio, Personas, Socios, Usuarios del sistema, Apps, Cuentas de WhatsApp, Cuentas de mensajes, Páginas, Perfiles de Instagram, Enrutamiento, Apps conectadas, Centro de seguridad y Facturación. Se cerraron 2 avisos informativos (aprobación de pares y herramientas fijadas). Nada se cambió.
- Kommo (2026-10-29, lectura): detalle del número en la integración WhatsApp Business.
- Meta «Importador de China» (2026-10-29, lectura, después de que Sam verificara su cuenta): Cuentas de WhatsApp (pestañas Resumen, Personas, Socios, cuentas vinculadas, cuentas de mensajes y enrutamiento), Cuentas de mensajes, Personas, Usuarios del sistema, Aplicaciones, Socios, Centro de seguridad y WhatsApp Manager (Números, Insights, Perfil y Plantillas). Se cerraron 2 avisos informativos. El menú «⋯» de la cuenta de WhatsApp («Asignar personas», «Suprimir del portfolio») se abrió y se cerró sin elegir nada.
- Se cerró, sin pulsar nada, una ventana de Kommo de «Inicio de sesión con Facebook para empresas» que pedía compartir «Importador de China» y crear una cuenta publicitaria. La IA no la abrió.

## Línea base v2 (2026-10-29)

Encargo del Director tras la aprobación del plan v3: 0.8, 4.9, 6.3 de 4 a 5 días y la etapa E10 (10.1–10.6). Alcance 99,75 → 109,25 días. Pesos de etapa por resto mayor en décimas, que suman 100 %. Sección «Cambio de alcance v2» en la spec y filas V2-1 a V2-14 en el registro E0.

- **El % de esta rama no es el del plan.** Aquí solo están aceptados los 5 días de E0, así que da 5,0 % → 4,6 %. El 7,8 % → 7,1 % del plan incluye 2.1, 4.2 y 9.1, aceptados en otras ramas; se juntan al integrar. El checklist pone las dos cifras.
- **Correcciones al plan v3, leídas en `main` `ec5786bb8`:**
  - `conversation_messages` no tiene `client_id`; se liga por `conversation_id` (V2-7).
  - `CONTACT.ve.whatsapp` está en las líneas 245-246 de `lib/design-tokens.ts`, no en la 244.
  - `buildWhatsAppLink` aparece en 44 archivos fuera de pruebas, no en «unos 41» (V2-9).
- **Prueba del avance:** fija la v2 (alcance, anterior, días por etapa, firma de ID=días de cada paso y pesos de la tabla de etapas) y recalcula el % antes y después por su cuenta. La firma es nueva: sin ella, mover días entre dos pasos de la misma etapa no hacía fallar nada.
- **Mutantes, todos muertos** (el control sin mutar dio 12/12):
  - contar `entregado` en el %;
  - el mismo, con 1.1 entregado en el real;
  - peso de 0.1 +1 sin tocar el alcance;
  - peso de 0.1 +1 con el alcance y la tabla de etapas ajustados;
  - mover 0,25 d de 10.4 a 10.3;
  - peso de E10 en la tabla, 6,6 % → 6,7 %;
  - % con días reales.

Salida de `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`:

```text
Etapa 1 de 11 · E0 Preparación y puertas · paso 0.8 · Avance 4,6 % (falta 95,4 %) · Esfuerzo: real 3,5 d, restante 102,5 d
Línea base v2 (2026-10-29) · alcance 109,25 d · aceptado 5 d
Cambio de alcance: v1 99,75 d → v2 109,25 d · avance antes 5,0 % → ahora 4,6 %
Ritmo real: 1,07 d base por día real · faltan ≈ 95,79 días de trabajo
Entregados sin aceptar: ninguno
Esperando: ninguno
Bloqueados: ninguno
Por etapa:
  E0 Preparación y puertas: 5 de 5,25 d (95,2 %)
  E1 Chatwoot en el VPS: 0 de 4,75 d (0,0 %)
  E2 Bandeja en Studio, usuarios y permisos: 0 de 17,75 d (0,0 %)
  E3 Actualizaciones desde Studio: 0 de 5 d (0,0 %)
  E4 Canales en paralelo a Kommo: 0 de 9 d (0,0 %)
  E5 Historial de Kommo: 0 de 7,75 d (0,0 %)
  E6 Embudo propio y reemplazos: 0 de 17 d (0,0 %)
  E7 Bot propio: 0 de 16,5 d (0,0 %)
  E8 Corte, salida de Kommo y limpieza del ERP: 0 de 10 d (0,0 %)
  E9 Guía interactiva «Antes en Kommo → Ahora aquí» (termina antes de 8.1): 0 de 9 d (0,0 %)
  E10 Enrutamiento por segmento (SDD hija nueva; se reserva al arrancar, después de 2.3): 0 de 7,25 d (0,0 %)
```

## Línea base v3 (2026-10-29)

Encargo del Director tras la aprobación del análisis comparativo. Alcance 109,25 → **115,5 días** (114,5 sin el 2.8 opcional).

- **Pasos:**
  - 0.8 (+0,25), 2.3 (+1,5), 2.6 (+0,5), 4.9 (+0,75), 6.7 (+0,25), 7.5 (+0,5), 7.6 (+0,75), 7.7 (+0,25) y 7.9 (+0,5);
  - 2.8 opcional, nuevo (+1);
  - 4.3 gana la salida, sin días.

  El análisis agrupa los +5,25 por bloques; **el reparto por fila es mío (I)** y está dicho en la spec.
- **% exacto en esta rama:** 4,58 % → **4,33 %** (5 ÷ 109,25 y 5 ÷ 115,5). Con las aceptaciones de las otras ramas (7,75 d): 7,1 % → 6,7 %.
- **Leído otra vez en esta tarea:** las páginas de precios y de registro de Meta (V3-1 y V3-3, D). Lo demás (video, kit, calculadora, Chatwoot y Codex) viene del análisis y la fila dice quién lo leyó.
- **Correcciones:**
  - V2-14 queda refutada a partir de 1.000 respuestas al mes por número;
  - el `pin` de `register` es el de verificación en dos pasos, con un tope de 10 cada 72 h;
  - la tarifa de octubre para +58 queda NV (la de enero es US$0,0113).
- **2.3:** queda con la puerta «no se acepta hasta arreglar la idempotencia».
- **Prueba del avance:** pasa a la v3 (alcance y anterior como constantes, días por etapa, firma ID=días y pesos de la tabla).
- **Mutantes, todos muertos** (el control dio 12/12):
  - contar `entregado`;
  - el mismo, con 1.1 entregado en el real;
  - peso de 0.1 +1;
  - peso de 0.1 +1 con alcance y tabla ajustados;
  - mover 0,25 d entre 10.3 y 10.4;
  - peso de E10 en la tabla;
  - descartar el 2.8 sin línea base nueva;
  - % con días reales.

Salida de `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`:

```text
Etapa 1 de 11 · E0 Preparación y puertas · paso 0.8 · Avance 4,3 % (falta 95,7 %) · Esfuerzo: real 3,5 d, restante 108,75 d
Línea base v3 (2026-10-29) · alcance 115,5 d · aceptado 5 d
Cambio de alcance: v2 109,25 d → v3 115,5 d · avance antes 4,6 % → ahora 4,3 %
Ritmo real: 1,07 d base por día real · faltan ≈ 101,64 días de trabajo
Entregados sin aceptar: ninguno
Esperando: ninguno
Bloqueados: ninguno
Por etapa:
  E0 Preparación y puertas: 5 de 5,5 d (90,9 %)
  E1 Chatwoot en el VPS: 0 de 4,75 d (0,0 %)
  E2 Bandeja en Studio, usuarios y permisos: 0 de 20,75 d (0,0 %)
  E3 Actualizaciones desde Studio: 0 de 5 d (0,0 %)
  E4 Canales en paralelo a Kommo: 0 de 9,75 d (0,0 %)
  E5 Historial de Kommo: 0 de 7,75 d (0,0 %)
  E6 Embudo propio y reemplazos: 0 de 17,25 d (0,0 %)
  E7 Bot propio: 0 de 18,5 d (0,0 %)
  E8 Corte, salida de Kommo y limpieza del ERP: 0 de 10 d (0,0 %)
  E9 Guía interactiva «Antes en Kommo → Ahora aquí» (termina antes de 8.1): 0 de 9 d (0,0 %)
  E10 Enrutamiento por segmento (SDD hija nueva; se reserva al arrancar, después de 2.3): 0 de 7,25 d (0,0 %)
```

## Paso 0.8 aceptado (2026-10-30)

- **0.8 → aceptado** con las tres respuestas de Sam (S08-1 a S08-3 en el registro). E0 queda completa: 5,5 de 5,5 días.
- **Regla de «cliente»** en la spec: algún envío vivo o algún recibo vivo en China con uno de sus códigos (vigente, historial o fichas fusionadas). Se calcula en el momento y no se guarda; quien pierde su único envío y no tiene carga viva en China vuelve a lead registrado, sin migración.
- **Recibo vivo = `deleted_at is null`** (C, S08-5): la tabla no tiene estado «anulado». **Si un recibo en `incidencia` cuenta es NV** y queda para 10.1 (S08-6).
- **E7 (7.6) y E10 (10.2):** responden en 1 mensaje. Costo de referencia ≈ US$11 al mes con la tarifa de enero (I/NV).
- **Sin cambio de línea base.** % en esta rama: 4,33 % → **4,76 %** (5 y 5,5 ÷ 115,5). Con las otras ramas (2.1, 4.2 y 9.1): 6,71 % → **7,14 %** (8,25 ÷ 115,5). La línea «avance antes» del script compara con la v2 (5,03 %), no con el estado previo a 0.8.
- La prueba del avance no cambia: su lector calcula el % de los aceptados del checklist real, y la firma de línea base sigue igual.

Salida de `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`:

```text
Etapa 2 de 11 · E1 Chatwoot en el VPS · paso 1.1 · Avance 4,8 % (falta 95,2 %) · Esfuerzo: real 3,5 d, restante 108,25 d
Línea base v3 (2026-10-29) · alcance 115,5 d · aceptado 5,5 d
Cambio de alcance: v2 109,25 d → v3 115,5 d · avance antes 5,0 % → ahora 4,8 %
Ritmo real: 1,07 d base por día real · faltan ≈ 101,17 días de trabajo
Entregados sin aceptar: ninguno
Esperando: ninguno
Bloqueados: ninguno
Por etapa:
  E0 Preparación y puertas: 5,5 de 5,5 d (100,0 %)
  E1 Chatwoot en el VPS: 0 de 4,75 d (0,0 %)
  E2 Bandeja en Studio, usuarios y permisos: 0 de 20,75 d (0,0 %)
  E3 Actualizaciones desde Studio: 0 de 5 d (0,0 %)
  E4 Canales en paralelo a Kommo: 0 de 9,75 d (0,0 %)
  E5 Historial de Kommo: 0 de 7,75 d (0,0 %)
  E6 Embudo propio y reemplazos: 0 de 17,25 d (0,0 %)
  E7 Bot propio: 0 de 18,5 d (0,0 %)
  E8 Corte, salida de Kommo y limpieza del ERP: 0 de 10 d (0,0 %)
  E9 Guía interactiva «Antes en Kommo → Ahora aquí» (termina antes de 8.1): 0 de 9 d (0,0 %)
  E10 Enrutamiento por segmento (SDD hija nueva; se reserva al arrancar, después de 2.3): 0 de 7,25 d (0,0 %)
```

## Validación

| Check | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (565 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ |
| `node scripts/avance-checklist.mjs …/checklist.md` | PASÓ (v3: 4,58 % → 4,33 %; con 0.8 aceptado, 4,76 % en esta rama) |
| `scripts/__tests__/avance-checklist.test.mjs` | PASÓ (12/12, con el `node_modules` de main enlazado y quitado al terminar); v3: 8 mutantes muertos; con 0.8 aceptado, otra vez 12/12 |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO APLICA: cambio solo de docs |
| Graphify / Archify / knowledge:status | NO EJECUTADO: docs de una spec sin código; lo publica el Director desde main |

## Pendientes de esta tarea

1. Hecho: 0.1, 0.2 y 0.4 aceptados por Sam el 2026-10-29.
2. Hecho (2026-10-29): 0.3 y 0.7 aceptados, propuesta y vuelta atrás aprobadas. Queda de Sam: la nota cifrada con los valores vistos. La 2FA en «Importador de China» queda sin exigir por decisión de Sam (2026-10-29, «No quiero activar el verificador de dos pasos de importador de China. Déjalo así por ahora. Quítalo del checklist y avancemos»): riesgo aceptado (M-28).
2b. Hecho: propuesta aprobada y aplicada a la spec.
3. Hecho: Kommo leído el 2026-10-29.
4. Hecho: Hostinger y Resend leídos (0.5 entregado).
5. Hay 3 tokens de la integración «DTD 0582 historial» vigentes 100 días y ninguno guardado; se pueden revocar en Kommo → la integración → Llaves y alcances, y la integración se revoca al cerrar E5.
6. Hecho: verificación del negocio y método de pago propio comprobados (0.7).
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
- En «Importador de China» la 2FA no se le exige a nadie (M-28); Sam decidió dejarlo así (riesgo aceptado).
