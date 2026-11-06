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

## Perfiles y qué tiene cada uno versionado

Actualizado el 2026-11-05 por la [SDD-0605](../../specs/0605-oficina-reestructura/spec.md), que
reestructura la oficina en 13 agentes
([organigrama §9](../organigrama-paperclip.md#9-reestructura-de-la-oficina-de-agentes-2026-11-05--sdd-0605)).
Esta tabla dice qué hay **en Git**. No dice qué hay en el VPS: copiar una identidad allí, crear un
perfil o contratar un agente son pasos aparte, con su propia autorización.

| Perfil | Agente | `SOUL.md` | `hermes.md` | Nota |
|---|---|---|---|---|
| `ceo` | ALFRED (CEO) | Sí, del 2026-10-20 | Sí | **Pendiente:** nombra al equipo de la ola 1; falta actualizarlo con el equipo nuevo y con Discord |
| `revisor` | Revisor | **Nuevo** | No | Perfil sin crear |
| `gabinete` | Coordinador de procesos y seguimiento | **Ajustado**, con su historia | Sí, con el nombre anterior en el título | Antes «Jefe de gabinete» |
| `ingenieria` | Puente de ingeniería | Sí, del 2026-10-20 | Sí | **Pendiente:** la rutina «Vigía de mejoras» todavía no está en su identidad ni en sus instrucciones |
| `director-contenido` | Director de contenido | **Nuevo** | No | Perfil sin crear |
| `seo` | Experto en SEO, GEO y AEO | **Nuevo** | No | Perfil sin crear |
| `tiktok` | Experto en TikTok | **Nuevo** | No | Perfil sin crear |
| `youtube` | Experto en YouTube | **Nuevo** | No | Perfil sin crear |
| `community` | Experto en Instagram y Facebook | **Nuevo en Git** | No | Antes «Community manager asistente». El perfil figura en los documentos del 2026-10-20, pero su identidad no estaba versionada |
| `contenido` | Redactor de noticias | **Ajustado**, con su historia | Sí, con el nombre y los entregables anteriores | Antes «Editor de contenido» |
| `asesor` | Asesor comercial | No | No | Sin cambios en la reestructura. Su identidad no está versionada |
| `crm` | Analista de CRM/datos | No | No | Igual |
| `operaciones` | Analista de operaciones | No | No | Igual |
| `director` | Configuración de la oficina | Sí | No | No es un agente del organigrama y no se contrata |

**Pendiente de escribir,** al preparar cada contratación o cambio: el `hermes.md` de los perfiles
nuevos y el ajuste de los de `gabinete` y `contenido`; las instrucciones de Paperclip de los
puestos nuevos en [`AGENTS-paperclip.md`](AGENTS-paperclip.md), que hoy cubre los cuatro primeros
y limita la ola 1 a 8 agentes; y la identidad de `ceo` e `ingenieria`.
