# Identidades de los agentes de la oficina (fase H3)

Fuente versionada de lo que define a cada agente Hermes de Paperclip (SDD-0564, diseño en
[`../hermes-oficina.md`](../hermes-oficina.md) §2.3). En el VPS se copian así:

| Archivo | Destino en el VPS | Qué es | Quién lo carga |
|---|---|---|---|
| `<puesto>/SOUL.md` | `~agentes-run/.hermes/profiles/<puesto>/SOUL.md` | **Quién es**: identidad, voz y límites | Hermes, siempre primero |
| `USER.md` | `~agentes-run/.hermes/profiles/<puesto>/memories/USER.md` | Quién es Sam y cómo trabaja (semilla de la memoria; el agente puede ampliarla) | Hermes, como memoria congelada |
| `<puesto>/hermes.md` | `/srv/oficina/trabajo/<puesto>/.hermes.md` | **Qué sabe y dónde buscar**: qué archivos de la biblioteca leer y cuándo | Hermes, por estar en su carpeta de trabajo |
| `<puesto>/AGENTS.md` | Instrucciones del agente en Paperclip (modo administrado), fase H4 | **Qué le toca**: alcance, entregables y cadencia | Paperclip, antes del prompt |

Regla: cada cosa se dice una sola vez. La biblioteca está en
[`../oficina-conocimiento/`](../oficina-conocimiento/).
