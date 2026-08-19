# Archivo de conversaciones

> ⚠️ **Estos documentos son HISTÓRICOS: no se reescriben.** Contienen la marca
> **"DoorTuDoor"**, retirada del vocabulario el 2026-08-19
> (ver [`docs/marketing/identidad.md`](../marketing/identidad.md)). Son transcripciones
> de lo que se dijo en su momento — corregirlas falsearía el registro. Si un barrido
> de marca las reporta, la respuesta correcta es **omitirlas**, no limpiarlas.

Transcripciones de sesiones de Claude Code rescatadas de los JSONL en
`~/.claude/projects/C--Users-Trabajo-Desktop-DTDCargo/`.

## Archivos rescatados

Transcripciones de sesiones de Claude Code, en orden cronológico:

| Archivo | Sesión | Fecha | Líneas | Qué contiene |
|---|---|---|---:|---|
| `backend-45234c46-fullsession.md` | `45234c46` | 21-may 19:48 → 20:05 | 608 | **Semilla Payload original** — briefing inicial CMS para landing, primer intento de backend con Payload (hoy en `_payload-disabled/`) |
| `backend-45234c46-briefing.md` | `45234c46` | — | 47 | 1 mensaje tuyo |
| `22may-3aa4afc5-fullsession.md` | `3aa4afc5` | 21-may 22:55 → 22-may 01:31 | 4316 | **Terminología DDP + polish** — convención "Puerta a Puerta DDP + prepago", glosario, alerts visuales, WhatsApp logo |
| `22may-3aa4afc5-briefing.md` | `3aa4afc5` | — | 585 | 40 mensajes tuyos |
| `23may-madrugada-603ef943-fullsession.md` | `603ef943` | 22-may 08:00 → 23:53 | 4024 | **Muerte de Payload + WhatsApp FAB** — rediseño FAB con IG speed dial, FlagCN/VE, drag-to-scroll Timeline, security fixes (PAYLOAD_SECRET, GraphQL) |
| `23may-madrugada-603ef943-briefing.md` | `603ef943` | — | 515 | 32 mensajes tuyos |
| `doortudoor-cc3a88f5-fullsession.md` | `cc3a88f5` | 23-may 07:27 → 12:56 | 8070 | **Planning final DoorTuDoor** — replanteo a ERP operativo con Supabase, 4 servicios, 13 estados, las 8 decisiones arquitectónicas, matriz por servicio |
| `doortudoor-cc3a88f5-briefing.md` | `cc3a88f5` | — | 2421 | 50 mensajes tuyos |

**Total: ~20.000 líneas de historial rescatado.**

## Cómo regenerar / extraer otras sesiones

Scripts en `docs/archive/scripts/` (versionados) — también hay copia en `.gstack/` (gitignored, local):

```bash
# Conversación completa de una sesión (filtro opcional por keyword)
node docs/archive/scripts/extract-session.mjs <sessionShortId> [keyword]

# Solo mensajes del usuario (briefing)
node docs/archive/scripts/extract-user-only.mjs <sessionShortId>

# Buscar mensajes user con un keyword en TODAS las sesiones
node docs/archive/scripts/extract-user-msgs.mjs <keyword>
```

Donde `<sessionShortId>` son los primeros 8 chars del `.jsonl` en
`~/.claude/projects/C--Users-Trabajo-Desktop-DTDCargo/`.

### Sesiones disponibles en disco

| Short ID | Tamaño | Fecha |
|---|---:|---|
| `cc3a88f5` | 6.0 MB | 2026-05-23 (planning DoorTuDoor) ✅ rescatada |
| `3aa4afc5` | 5.1 MB | 2026-05-21/22 ✅ rescatada |
| `603ef943` | 4.7 MB | 2026-05-22 ✅ rescatada |
| `45234c46` | 777 KB | 2026-05-21 (backend Payload) ✅ rescatada |
| `65ceb788` | varía | sesión actual (rescate) |
| `105f8847` | 321 KB | 2026-05-23 (sin hits relevantes) |

## Ejemplos

```bash
# Volcar conversación entera de una sesión nueva
node docs/archive/scripts/extract-session.mjs <id8chars> > docs/archive/nueva-sesion.md

# Buscar el keyword "DDP" en TODAS las sesiones
node docs/archive/scripts/extract-user-msgs.mjs DDP
```

## Genealogía del backend

Estos archivos cuentan la historia completa de cómo evolucionó la visión del backend:

```
21-may  → CMS Payload para editar landing       (45234c46)  ❌ deprecado
22-may  → polish visual + terminología DDP      (3aa4afc5)
22-may  → muerte de Payload + WhatsApp FAB      (603ef943)
23-may  → DoorTuDoor ERP con Supabase           (cc3a88f5)  ✅ vigente
        → SDD-0003/0004/0005 plasmados en docs/specs/
```

Si en el futuro un import a `payload` aparece sin razón, mirar `_payload-disabled/`
y `backend-45234c46-*.md` para entender qué intento histórico es.
