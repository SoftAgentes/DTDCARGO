# Bug Reporter · v1.4.1 (handoff 2026-05-26)

Mockup y spec funcional del módulo **Bug Reporter** del DTD Studio ERP.

## Estado

- **Diseño:** ✅ cerrado v1.4.1 (8 iteraciones previas: v0.1 → v1.4.1)
- **Spec formal:** `docs/specs/0036-bug-reporter/spec.md` (basada en `HANDOFF.md`)
- **Implementación:** ❌ pendiente · 6 fases · 12-14 días estimado

## Contenido

```
bug-reporter-v1.4.1/
├── README.md                                ← este archivo
├── HANDOFF.md                               ← spec funcional + decisiones cerradas
└── proyecto/
    └── Bug_Reporter_Demo_v1.4.1_FIX.html    ← mockup vigente (abre en navegador)
```

## Qué es

Sistema interno de reporte de bugs/mejoras/sugerencias dentro del propio ERP.

**Cara reportador** (María/Yiwu/Luis): FAB flotante para reportar + vista "Mis reportes"
con progreso visual + notificaciones automáticas.

**Cara admin** (Sam): Kanban + tabla + estadísticas, drawer con conversación + datos
técnicos auto-capturados + integración Claude Code (botón "Copiar prompt" genera
prompt completo para resolver el bug).

## Features clave

- Auto-captura invisible: 3 errores consola + 5 network requests + 30s session replay (rrweb v2)
- 5 fotos max por reporte (sin anotación en MVP)
- Folio `BUG-XXXXX`
- 5 estados Kanban con % progreso fijo
- Detección automática de duplicados (hash sha256 de módulo+url+stack)
- 4 canales notificación: in-app + push browser + email + Telegram
- Integración GitHub webhook: commits con `fix: BUG-XXXXX` cierran bug automático
- Dark/light/auto theme con persistencia

## Reglas de marca

Brand Book v2.4 estricto. NO usar gradientes, NO glassmorphism, NO emojis decorativos,
NO gamificación infantil. Engagement profesional (barra progreso, timeline, mensaje
agradecimiento), no medallas/trofeos/confetti.

## Stack target

| Capa | Tech |
|---|---|
| Frontend | React 19 + Tailwind v4 + tokens Brand Book v2.4 |
| Backend | Supabase (Postgres + RLS + Edge Functions + Realtime + Storage) |
| Session replay | rrweb v2 |
| Email | Resend (depende de SDD-0026 Fase 2) |
| Push browser | Web Push API + SW |
| Telegram | Bot API |

## Origen

Diseñado fuera del repo en sesión del 2026-05-26 a través de 8 iteraciones (v0.1 → v1.4.1).
Movido a `docs/design/` el 2026-05-26 al arrancar implementación (regla `docs/design/`
de CLAUDE.md sec. final).

## Próximo paso

Leer `docs/specs/0036-bug-reporter/spec.md` y arrancar Fase 1 (DB + RLS + endpoints).
