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
| 0.2 | en curso | 4 de 5 decisiones de Sam (E0-D1–D4) | Fecha de renovación de Kommo (Sam la mira) |
| 0.3 | en curso | Guía de 13 puntos, nota cifrada y vuelta atrás escritas; M-1–M-7 | Lectura en Meta con Sam; aprobación de la vuelta atrás |
| 0.4 | en curso | Inventario del repo (K-1–K-12), tabla de los 15 Salesbots y matriz de paridad | Confirmar en Kommo «activo hoy», agentes, fuentes, usuarios, integraciones y backup |
| 0.5 | en curso | DNS medido (T): Cloudflare, MX Hostinger, sin MX de `inbound.` | Paneles de Hostinger (tipo de `info@`, DKIM) y Resend (recepción, webhooks) |
| 0.6 | pendiente | Protocolo de la prueba | OK nominal de lectura de PII |
| 0.7 | en curso | Plantilla de expedientes | Verificación del negocio y pago propio comprobados |

Evidencia: [registro E0](../../docs/specs/0582-chatwoot-piloto/investigacion-2026-10-29-e0.md) y [guías](../../docs/specs/0582-chatwoot-piloto/e0-guias.md).

## Reestimación

- 6.7: restante 0,75 d (base 2). 11 Salesbots sin disparador y los 15 apagados; solo se reemplaza el aviso de ventana de 24 h.
- 7.4: restante 1 d (base 1,5). Base v7 y textos de los 4 agentes ya están en el repo.
- E5: sin cambio (7,75 d) hasta medir en 0.6.
- Resto de E7: sin cambio.

Los días base no cambian (eso exige la línea base v2 y el OK de Sam).

## Decisión que cambia la spec

Sam eligió el VPS actual del ERP en lugar de un VPS 4 dedicado. La decisión G de la spec se actualizó. Riesgo medido: presión de CPU `some` del 31 % a 5 min antes de sumar Chatwoot (VPS-4). Mitigación: límites por servicio en 1.1, respaldo fuera del host en 1.5 y vigilancia del ERP en 1.6; plan B, el VPS dedicado.

## Validación

Ver la sección final, que se actualiza al cerrar.

## FUERA DE ALCANCE DETECTADO

- Los documentos que dicen «DNS en Hostinger» (`docs/runbooks/servidor-contabo.md:778-798`, handoff 0505) están desfasados: el DNS está en Cloudflare.
- `docs/runbooks/setup-resend-inbound.md` §6 (respuesta por correo en el mismo hilo) no coincide con el código (`app/studio/(app)/conversaciones/actions.ts:135-141`).
- La presión de CPU del VPS del ERP (31 % `some` a 5 min) existe sin Chatwoot: conviene que el Director mire qué la causa.
- `docs/marketing/kommo-campos-y-cartera.md` contiene correos del personal.
