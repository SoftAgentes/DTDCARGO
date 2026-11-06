# Identidades de los agentes de la oficina (fase H3)

Fuente versionada de lo que define a cada agente Hermes de Paperclip (SDD-0564, diseño en
[`../hermes-oficina.md`](../hermes-oficina.md) §2.3). En el VPS se copian así:

| Archivo | Destino en el VPS | Qué es | Quién lo carga |
|---|---|---|---|
| `<puesto>/SOUL.md` | `~agentes-run/.hermes/profiles/<puesto>/SOUL.md` | **Quién es**: identidad, voz y límites | Hermes, siempre primero |
| `USER.md` | `~agentes-run/.hermes/profiles/<puesto>/memories/USER.md` | Quién es Sam y cómo trabaja (semilla de la memoria; el agente puede ampliarla) | Hermes, como memoria congelada |
| `<puesto>/hermes.md` | `/srv/oficina/trabajo/<puesto>/.hermes.md` | **Qué sabe y dónde buscar**: qué archivos de la biblioteca leer y cuándo | Hermes, por estar en su carpeta de trabajo |
| [`AGENTS-paperclip.md`](AGENTS-paperclip.md): la parte común más la del puesto | Instrucciones del agente en Paperclip (modo administrado), fase H4 | **Qué le toca**: alcance, entregables y cadencia | Paperclip, antes del prompt |

Regla: cada cosa se dice una sola vez. La biblioteca está en
[`../oficina-conocimiento/`](../oficina-conocimiento/).

## Perfiles y qué tiene cada uno versionado

Actualizado el 2026-11-06. La [SDD-0605](../../specs/0605-oficina-reestructura/spec.md)
reestructuró la oficina en 13 agentes, 14 desde la resolución 3.1 del 2026-11-06 con el Auxiliar
de ALFRED
([organigrama §9](../organigrama-paperclip.md#9-reestructura-de-la-oficina-de-agentes-2026-11-05--sdd-0605))
y dejó las identidades; el 2026-11-06 se completaron los contextos de trabajo, las instrucciones
de Paperclip y el [plan de entrenamiento](entrenamiento.md).
Esta tabla dice qué hay **en Git**. No dice qué hay en el VPS: copiar una identidad allí, crear un
perfil o contratar un agente son pasos aparte, con su propia autorización.

| Perfil | Agente | `SOUL.md` | `hermes.md` | Instrucciones de Paperclip | Nota |
|---|---|---|---|---|---|
| `ceo` | ALFRED (CEO) | **Ajustado** el 2026-11-06, con su historia | **Ajustado** | **Ajustadas** | Nombra al equipo de 13 y a Discord `#alfred`; ya no limita la ola 1 a 8 agentes |
| `revisor` | Revisor | Nuevo | **Nuevo** | **Nuevas** | Perfil sin crear |
| `gabinete` | Coordinador de procesos y seguimiento | Ajustado, con su historia | **Ajustado** | **Ajustadas** | Antes «Jefe de gabinete» |
| `ingenieria` | Puente de ingeniería | **Ajustado**, con la Vigía de mejoras | **Ajustado**, con la plantilla de la Vigía | **Ajustadas**, con su cadencia | La Vigía necesita web o que una persona le deje las notas ([entrenamiento §2](entrenamiento.md#2-quién-necesita-internet)) |
| `director-contenido` | Director de contenido | Nuevo | **Nuevo** | **Nuevas** | Perfil sin crear |
| `seo` | Experto en SEO, GEO y AEO | Nuevo | **Nuevo** | **Nuevas** | Perfil sin crear |
| `tiktok` | Experto en TikTok | Nuevo | **Nuevo** | **Nuevas** | Perfil sin crear |
| `youtube` | Experto en YouTube | Nuevo | **Nuevo** | **Nuevas** | Perfil sin crear |
| `community` | Experto en Instagram y Facebook | Nuevo en Git | **Nuevo** | **Nuevas** | Antes «Community manager asistente». El perfil figura en los documentos del 2026-10-20, pero su identidad no estaba versionada |
| `contenido` | Redactor de noticias | Ajustado, con su historia | **Ajustado** | **Ajustadas** | Antes «Editor de contenido». El calendario pasa al Director de contenido |
| `asesor` | Asesor comercial | No | No | No | Sin cambios en la reestructura. Su identidad no está versionada |
| `crm` | Analista de CRM/datos | No | No | No | Igual |
| `operaciones` | Analista de operaciones | No | No | No | Igual |
| `director` | Configuración de la oficina | Sí | No | No aplica | No es un agente del organigrama y no se contrata |

**Pendiente, fuera de Git:** crear los perfiles nuevos en el VPS, copiar allí estos archivos,
contratar cada agente con la aprobación de Sam y cargar sus instrucciones. El orden y las
prácticas de cada uno están en [`entrenamiento.md`](entrenamiento.md). Siguen sin versionar las
identidades e instrucciones de `asesor`, `crm` y `operaciones`.
