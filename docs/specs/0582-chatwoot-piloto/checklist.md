# Checklist — SDD-0582 programa Kommo → Chatwoot

Línea base: v2 · 2026-10-29 · alcance 109,25 persona-días
Línea base anterior: v1 · alcance 99,75

> **Cambio de alcance v2** (Sam, aprobación del plan v3 del Director, 2026-10-29): dos números de WhatsApp (leads y clientes) y enrutamiento por segmento desde el ERP. Se suman 0.8 (+0,25), 4.9 (+1), 6.3 pasa de 4 a 5 días (+1) y la etapa E10 (+7,25): 99,75 → 109,25 días. No se descarta nada y no se pierde nada aceptado; el % baja solo porque crece el denominador.
>
> - **En esta rama** (`codex/0582-e0-preparacion`, aceptados 5 días de E0): **5,0 % → 4,6 %**, salida de `avance-checklist`.
> - **Con las aceptaciones de las otras ramas** (2.1, 4.2 y 9.1; se juntan al integrar), 7,75 días aceptados: **7,8 % → 7,1 %** (7,75 ÷ 99,75 y 7,75 ÷ 109,25).
>
> Detalle y evidencia: [spec, «Cambio de alcance v2»](spec.md#cambio-de-alcance-v2-2026-10-29).

> Fuente única del avance. Se actualiza en el mismo commit que cierra cada paso. El cálculo sale de:
>
> `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`

**Reglas**

- **Fórmula:** `avance = Σ días base de pasos aceptados ÷ alcance`. Solo `aceptado` suma.
- **Esfuerzo:** «Días reales» y «Días restantes» miden esfuerzo y no mueven el %.
- **Estados:** `pendiente`, `en curso`, `entregado`, `aceptado`, `bloqueado`, `espera externa` y `descartado`.
- **Unidad:** persona-día de 8 h.
- **Cambios de alcance:** descartar un paso o cambiar el alcance exige una línea base nueva (`v2`) con la línea `Línea base anterior: v1 · alcance 99,75`. El script muestra el % antes y después.
- **Esperas:** pesan 0. Se anotan en «Puerta / espera» y el paso pasa a `espera externa` mientras duren.
- **Responsables:** S = Sam · IA = IA ejecutora · S+IA = juntos.

## Etapas

| Etapa | Nombre | Días base | Peso |
|---|---|---|---|
| E0 | Preparación y puertas | 5,25 | 4,8 % |
| E1 | Chatwoot en el VPS | 4,75 | 4,4 % |
| E2 | Bandeja en Studio, usuarios y permisos | 17,75 | 16,2 % |
| E3 | Actualizaciones desde Studio | 5 | 4,6 % |
| E4 | Canales en paralelo a Kommo | 9 | 8,2 % |
| E5 | Historial de Kommo | 7,75 | 7,1 % |
| E6 | Embudo propio y reemplazos | 17 | 15,6 % |
| E7 | Bot propio | 16,5 | 15,1 % |
| E8 | Corte, salida de Kommo y limpieza del ERP | 10 | 9,2 % |
| E9 | Guía interactiva «Antes en Kommo → Ahora aquí» (termina antes de 8.1) | 9 | 8,2 % |
| E10 | Enrutamiento por segmento (SDD hija nueva; se reserva al arrancar, después de 2.3) | 7,25 | 6,6 % |

Pesos = días base de la etapa ÷ 109,25, redondeados a décimas por resto mayor para que sumen 100 %. Son informativos: el % se calcula por pasos.

## Pasos

| ID | Etapa | Paso | Resp. | Días base | Días reales | Días restantes | Estado | Puerta / espera | Evidencia |
|---|---|---|---|---|---|---|---|---|---|
| 0.1 | E0 | Programa SDD-0582: spec, checklist v1, instrucciones, registro de evidencia y script de avance | IA | 1,25 | — | 0 | aceptado | PR → OK Sam | PR #327; aceptado por Sam el 2026-10-29 («Acepto los tres») |
| 0.2 | E0 | Decisiones: máquina, roles, tope de gasto del bot, fecha de renovación de Kommo y dónde vive «analiza mi contestación» | S | 0,25 | 0,25 | 0 | aceptado | OK Sam | `investigacion-2026-10-29-e0.md` (E0-D1–D5; Kommo vence el 29.05.2027); aceptado por Sam el 2026-10-29 («Acepto los tres») |
| 0.3 | E0 | Gate Meta (bloqueante): modelo de cuenta, propietarios, WABA, app del token, suscripciones, callbacks, overrides, enrutamiento, 2FA, pago y 2.º número. Valores previos fuera de Git y vuelta atrás escrita | S+IA | 0,75 | 0,9 | 0 | aceptado | OK Sam: vuelta atrás, propuesta de la cuenta de mensajes y nota cifrada; callbacks, overrides y PIN pasan a la lectura por API previa a 4.5 | `e0-guias.md#03`; M-1–M-31 (T); aceptado por Sam («Apruebo todo», 2026-10-29) |
| 0.4 | E0 | Inventario de Kommo: backup, agentes, plantillas, 15 Salesbots (disparadores, temporizadores, efectos), integraciones y matriz de paridad de fuentes de leads | S+IA | 1 | 0,75 | 0 | aceptado | — | K-1–K-22 (T en Kommo); `e0-guias.md#04`; aceptado por Sam el 2026-10-29 («Acepto los tres») |
| 0.5 | E0 | Inventario de correo: `info@` (buzón, alias o reenvío), remitente SMTP y Resend Inbound (dominios, rutas, consumidores) | S+IA | 0,25 | 0,3 | 0 | aceptado | — | C-1–C-13 (DNS, Resend y Hostinger: T); `e0-guias.md#05`; aceptado por Sam el 2026-10-29 («Acepto 0.5») |
| 0.6 | E0 | Prueba de extracción de Kommo: `talks/{id}/messages`, alcance, plan, enumeración, paginación y muestra representativa | S+IA | 1 | 1 | 0 | aceptado | OK Sam (lectura de PII, 2 OK nominales) y OK de la integración, 2026-10-29; ratifica E5 | X-1–X-17 (R); `investigacion-2026-10-29-e0.md`; aceptado por Sam el 2026-10-29 («Acepto 0.6») |
| 0.7 | E0 | Expedientes de trámites largos (verificación del negocio) y método de pago propio en Meta comprobado | S+IA | 0,5 | 0,3 | 0 | aceptado | Verificación y pago propio ya existen en «Importador de China» (M-13, M-25); App Review se abre en E4 | `e0-guias.md#07`; M-8, M-13, M-25; aceptado por Sam («Apruebo todo», 2026-10-29) |
| 0.8 | E0 | Decisión de dos números y regla de segmentos: confirmar la regla de «cliente» (con o sin carga recibida en China) | S | 0,25 | — | — | pendiente | OK Sam | Línea base v2 (aprobación del plan v3 del Director, 2026-10-29); spec «Cambio de alcance v2» |
| 1.1 | E1 | Compose con `v4.19.1-ce` fija, Postgres pgvector, Redis, Sidekiq y límites | IA | 1 | — | — | pendiente | OK Sam (despliegue en VPS) | — |
| 1.2 | E1 | DNS, TLS, Traefik, `frame-ancestors` acotado y `/super_admin` detrás de Tailscale | IA | 0,5 | — | — | pendiente | — | — |
| 1.3 | E1 | Variables: cifrado, signup cerrado, `MAX_USER_SESSIONS` y SMTP | IA | 0,25 | — | — | pendiente | — | — |
| 1.4 | E1 | Platform App, cuenta por API y usuario de servicio | IA | 0,5 | — | — | pendiente | — | — |
| 1.5 | E1 | Respaldo conjunto (Postgres, adjuntos, claves) en custodia separada, RPO/RTO y restauración conjunta ensayada | IA | 0,75 | — | — | pendiente | — | — |
| 1.6 | E1 | Uptime Kuma, memoria, disco y adjuntos durante 72 h | IA | 0,25 | — | — | pendiente | Espera: 3 días | — |
| 1.7 | E1 | revisar-datos-ve, redacción de logs (Rails, Sidekiq, proxy) probada con datos sintéticos, inventario de terceros y nota sobre `/privacidad` | IA | 1,5 | — | — | pendiente | — | — |
| 2.1 | E2 | Prueba de concepto en Chrome, Edge, Firefox y Safari: iframe, SSO y micrófono | IA | 1 | — | — | pendiente | Sí/no; si no, pestaña aparte | — |
| 2.2 | E2 | CSP (`frame-src`, `Permissions-Policy`), módulo, RBAC, flag, i18n, vínculos, `lib/studio/chatwoot`, SSO, capa persistente, página y `signOut` | IA | 5,5 | — | — | pendiente | Migración: OK Sam aparte | — |
| 2.3 | E2 | Contador, webhook con push y tarjeta en la ficha | IA | 3,5 | — | — | pendiente | — | — |
| 2.4 | E2 | Dashboard App «Ficha DTD» | IA | 2,25 | — | — | pendiente | — | — |
| 2.5 | E2 | Ciclo de vida de los agentes: Usuarios, cron y salud | IA | 1,25 | — | — | pendiente | — | — |
| 2.6 | E2 | revisar-datos-ve, `/ui-check`, QA de navegadores y runbook | IA | 1,75 | — | — | pendiente | PR → OK Sam | — |
| 2.7 | E2 | Usuarios y permisos: matriz real de CE (bandejas, equipos, contactos, API, acceso directo), sincronización, pruebas por usuario y revocación del SSO | IA | 2,5 | — | — | pendiente | OK Sam (matriz) | — |
| 3.1 | E3 | Runbook de versiones: RPO/RTO, ventana, drenaje, respaldo conjunto, prueba, producción, smoke y recuperación del tráfico | IA | 1 | — | — | pendiente | — | — |
| 3.2 | E3 | Vigilante de versiones (`GET /api` y releases) | IA | 1 | — | — | pendiente | — | — |
| 3.3 | E3 | Pantalla «Actualizaciones» (solo admin) con «Analizar con IA» y «Pedir actualización». No despliega sola | IA | 1,5 | — | — | pendiente | — | — |
| 3.4 | E3 | Análisis con IA del diff de versiones contra la superficie de DTD. Motor con proveedor, plan y escenario admitidos; OpenCode aislado y autenticado | IA | 1,5 | — | — | pendiente | OK Sam (motor) | — |
| 4.1 | E4 | App de Meta de DTD (la existente «Whats DTD» u otra), usuario del sistema, token y cuenta de mensajes propia en «Importador de China» | S+IA | 0,5 | — | — | pendiente | — | Decisión B (2026-10-29) |
| 4.2 | E4 | Protección de `/register`: initializer que aborta el registro para los Phone Number IDs protegidos, probado | IA | 0,75 | — | — | pendiente | — | — |
| 4.3 | E4 | Número de prueba: alta manual, plantillas y pruebas | S+IA | 1 | — | — | pendiente | OK Sam (línea) | — |
| 4.4 | E4 | Messenger como piloto: determinar nivel de acceso y demostración | IA | 1 | — | — | pendiente | — | — |
| 4.5 | E4 | WhatsApp principal, convivencia corta (requiere 0.3, 4.2, pago propio y la lectura por API de suscripciones y overrides tras 4.1, guardada en la nota cifrada): entrega, estados y sin duplicados en ambos lados; vuelta atrás que restaura los valores previos | S+IA | 1,25 | — | — | pendiente | OK Sam; espera: 3 días | — |
| 4.6 | E4 | Instagram: demostración y envío a App Review | IA | 1 | — | — | pendiente | Espera: App Review | — |
| 4.7 | E4 | TikTok: condicional, con salida si no hay elegibilidad | IA | 0,75 | — | — | pendiente | Espera: TikTok | — |
| 4.8 | E4 | Correo: bandeja IMAP/SMTP, SPF/DKIM/DMARC y pruebas de hilo, adjuntos, rebotes y caída de más de 1 día | S+IA | 1,75 | — | — | pendiente | OK Sam (Hostinger y DNS en Cloudflare) | — |
| 4.9 | E4 | Número de leads: línea, alta en Importador de China, nombre visible, verificación y bandeja Leads en Chatwoot | S+IA | 1 | — | — | pendiente | OK Sam (línea); requiere 4.3 | Línea base v2 (aprobación del plan v3 del Director, 2026-10-29) |
| 5.1 | E5 | Backup y CSV cifrados fuera de Git | S+IA | 0,5 | — | — | pendiente | — | — |
| 5.2 | E5 | Medir volumen y decidir alcance | S+IA | 0,5 | — | — | pendiente | OK Sam | — |
| 5.3 | E5 | Extractor idempotente e incremental, con instante de corte, a staging cifrado | IA | 1,5 | — | 1,5 | pendiente | — | Ratificado por 0.6 (X-15) |
| 5.4 | E5 | E.164, vínculo con el ERP y deduplicación | IA | 1,5 | — | — | pendiente | — | — |
| 5.5 | E5 | Modo de importación sin efectos, bandeja «Archivo Kommo» y cargador que conserva IDs, autor y fecha | IA | 1,75 | — | — | pendiente | — | — |
| 5.6 | E5 | Ensayo en copia: cero efectos externos y muestra revisada con Sam | S+IA | 1 | — | — | pendiente | OK Sam | — |
| 5.7 | E5 | Carga en producción | IA | 0,5 | — | — | pendiente | OK nominal Sam (carga y PII) | — |
| 5.8 | E5 | Acta de conciliación parcial con conteos por canal y objeto | IA | 0,5 | — | — | pendiente | — | — |
| 6.1 | E6 | SDD y contrato de sistema maestro por objeto y fase | IA | 2 | — | — | pendiente | OK Sam | — |
| 6.2 | E6 | Modelo de datos y migración | IA | 2 | — | — | pendiente | Migración: OK Sam | — |
| 6.3 | E6 | Tablero Kanban con dos embudos Leads/Clientes (paso automático de uno a otro) y ficha del lead | IA | 5 | — | — | pendiente | — | Línea base v2 (aprobación del plan v3 del Director, 2026-10-29): 4 → 5 días |
| 6.4 | E6 | Entrada de leads desde Chatwoot y la web, con atribución | IA | 2 | — | — | pendiente | — | — |
| 6.5 | E6 | Migrar leads, etapas, tareas, mappings e IDs | IA | 1,5 | — | — | pendiente | OK nominal Sam (carga) | — |
| 6.6 | E6 | Reemplazos de Kommo en el ERP: vista CRM nueva, conversión lead→cliente, etapas desde el cotizador, reporte por asesor, KPI de leads y alerta «sin atender» | IA | 2,5 | — | — | pendiente | — | — |
| 6.7 | E6 | Reemplazar los Salesbots según el inventario de 0.4 (se reestima) | IA | 2 | — | 0,75 | pendiente | — | Reestimado: `investigacion-2026-10-29-e0.md` |
| 7.1 | E7 | Cuentas de pago (proyecto con facturación), retención y DPA registrados, y corte local duro de gasto | S+IA | 1 | — | — | pendiente | OK Sam | — |
| 7.2 | E7 | Excepción IA-01 acotada, redactada para aprobar. Hasta entonces, solo Sugerir | S+IA | 0,5 | — | — | pendiente | OK Sam | — |
| 7.3 | E7 | Respaldar el conocimiento de Kommo y ubicar «analiza mi contestación» | S+IA | 0,5 | — | — | pendiente | — | — |
| 7.4 | E7 | Base de conocimiento canónica con reglas duras | IA | 1,5 | — | 1 | pendiente | — | Reestimado: `investigacion-2026-10-29-e0.md` |
| 7.5 | E7 | Prueba ciega de modelos | IA | 1,5 | — | — | pendiente | OK Sam (modelo) | — |
| 7.6 | E7 | `dtd-bot`: cola durable antes del 2xx, watchdog, modo comprobado antes de enviar, invalidación si escribe una persona, filtro de autor, privacidad y dirección, respaldo y topes | IA | 5,5 | — | — | pendiente | — | — |
| 7.7 | E7 | Modos desde Studio: interruptor por bandeja, Apagado / Sugerir / Contesta solo y horario | IA | 1,5 | — | — | pendiente | — | — |
| 7.8 | E7 | Respuesta sugerida: nota privada y botón Copiar en la Ficha DTD | IA | 1,5 | — | — | pendiente | — | — |
| 7.9 | E7 | Pruebas IA-01: inyección, cancelación, doble ejecución, fallback, apagar mientras genera, caída tras el acuse y nota propia que vuelve | IA | 1 | — | — | pendiente | — | — |
| 7.10 | E7 | Evaluación final y ajuste | IA | 1 | — | — | pendiente | — | — |
| 7.11 | E7 | Modo sombra (Sugerir sobre tráfico real) | IA | 1 | — | — | pendiente | Espera: 7 días (en 8.1) | — |
| 8.1 | E8 | Convivencia final de 7 días, capacitación con la guía de E9, ensayo y checklist de corte firmado | S+IA | 1 | — | — | pendiente | OK nominal Sam con fecha; requiere E9 | — |
| 8.2 | E8 | Instante de corte y corte de WhatsApp: se apagan la IA y los Salesbots de Kommo y el bot queda en el modo aprobado | S+IA | 0,5 | — | — | pendiente | — | — |
| 8.3 | E8 | Corte de Messenger e Instagram en el Enrutamiento | S+IA | 0,25 | — | — | pendiente | — | — |
| 8.4 | E8 | Monitoreo; Kommo de respaldo con límite declarado (no tiene lo enviado desde Chatwoot) | IA | 0,5 | — | — | pendiente | Espera: 1–2 semanas | — |
| 8.5 | E8 | Extracción incremental final y 2.º backup | IA | 0,5 | — | — | pendiente | — | — |
| 8.6 | E8 | Acta de conciliación final firmada por Sam (puerta de 8.7–8.12) | S+IA | 0,75 | — | — | pendiente | OK Sam | — |
| 8.7 | E8 | Detener productores de Kommo (push del alta, writeback del cotizador, crons, webhook) y resolver o congelar la outbox | IA | 0,75 | — | — | pendiente | PR; despliegue: OK Sam | — |
| 8.8 | E8 | Quitar el canal en Kommo y a Kommo como socio en Meta | S+IA | 0,25 | — | — | pendiente | Sin retorno; OK Sam | — |
| 8.9 | E8 | Exportar cifradas fuera de Git las tablas y columnas Kommo; revisar-datos-ve del borrado con conteo de `entity_audit_log` y respaldos | IA | 0,75 | — | — | pendiente | OK Sam (lectura de PII) | — |
| 8.10 | E8 | SDD de limpieza: vista y módulo Kommo, `lib/studio/kommo-*`, edge functions, crons, variables, secretos y scripts de ops; `clients` al vínculo propio; `git grep -i kommo` solo con historia | IA | 3,5 | — | — | pendiente | PR → OK Sam | — |
| 8.11 | E8 | Migración de borrado de tablas y columnas Kommo | IA | 0,5 | — | — | pendiente | Migración: OK nominal Sam; sin retorno | — |
| 8.12 | E8 | Cancelar la licencia de Kommo | S | 0,25 | — | — | pendiente | Sin retorno; OK Sam | — |
| 8.13 | E8 | Runbooks, retrospectiva y handoff (cierre de PRG-01) | IA | 0,5 | — | — | pendiente | 100 % | — |
| 9.1 | E9 | Guion «Antes en Kommo → Ahora aquí» de las tareas diarias con Sam y la persona que atiende; textos en i18n | S+IA | 1 | — | — | pendiente | OK Sam (guion) | — |
| 9.2 | E9 | Motor de guía propio y liviano en Studio: puntos anclados a `data-guia`, tarjeta pequeña, sin modal que bloquee, accesible y con la marca | IA | 2 | — | — | pendiente | — | — |
| 9.3 | E9 | Estado por usuario: primera vez automática, botón «Guía», «No volver a mostrar», reanudar y reiniciar; tabla por usuario (patrón 0233) y caché con contrato de hidratación | IA | 1,5 | — | — | pendiente | Migración: OK Sam | — |
| 9.4 | E9 | Guía dentro de Chatwoot: script por `DASHBOARD_SCRIPTS` activado por `postMessage`, selectores en un archivo y smoke en E3 | IA | 2 | — | — | pendiente | Despliegue: OK Sam | — |
| 9.5 | E9 | Recorridos por rol: Bandeja, Embudo, Ficha DTD e IA; para admin, además, Usuarios y Actualizaciones | IA | 1,5 | — | — | pendiente | — | — |
| 9.6 | E9 | `/ui-check`, prueba con la persona que atiende y ajustes | S+IA | 1 | — | — | pendiente | PR → OK Sam | — |
| 10.1 | E10 | Regla de segmento en el ERP: función SQL de solo lectura, sin datos personales en la salida, `service_role`, contrato en PGlite | IA | 1,5 | — | — | pendiente | Migración: OK Sam; requiere 0.8 y 2.3 | — |
| 10.2 | E10 | Endpoint `clasificar` con secreto (patrón `lib/http/secret-compare.ts`) y webhook de Chatwoot que pone etiqueta, equipo y la respuesta de redirección sin IA | IA | 2 | — | — | pendiente | Requiere 10.1 | — |
| 10.3 | E10 | Usuarios sin teléfono (BSUID): respuesta neutra y se guarda el BSUID | IA | 0,5 | — | — | pendiente | — | — |
| 10.4 | E10 | Web al número de leads; portal según el segmento | IA | 1 | — | — | pendiente | Despliegue: OK Sam; con el número de 4.9 vivo | — |
| 10.5 | E10 | Tickets del portal a los embudos (Clientes / Leads registrados) | IA | 1,25 | — | — | pendiente | Requiere 6.3 | — |
| 10.6 | E10 | revisar-datos-ve y prueba de punta a punta con el número de prueba | IA | 1 | — | — | pendiente | — | — |
