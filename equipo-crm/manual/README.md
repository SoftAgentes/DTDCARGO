# Manual de operación del equipo

> **Qué es:** el "cómo se hace" del día a día — precio, procesos, portal, qué hacer cuando
> algo falla y dónde está el material de marketing.
>
> **Para quién:** el equipo de oficina (atención al cliente + marketing).
>
> **Cómo se usa:** se le da a Codex o a Claude con [`PROMPT.md`](PROMPT.md), y se consulta
> como *"tengo esto, ¿cómo lo hago?"*.

## Los archivos

| Archivo | Responde |
|---|---|
| ⭐ [`PROMPT.md`](PROMPT.md) | **El texto que se pega para arrancar.** Empieza acá. |
| [`A-como-se-calcula-el-precio.md`](A-como-se-calcula-el-precio.md) | ¿Por qué salió ese precio? ¿Por qué subió? |
| [`B-paso-a-paso-de-cada-servicio.md`](B-paso-a-paso-de-cada-servicio.md) | ¿Y ahora qué hago? ¿En qué orden va? |
| [`C-registro-portal-y-seguimiento.md`](C-registro-portal-y-seguimiento.md) | ¿Cómo se registra? ¿Dónde ve su carga? |
| [`D-cuando-algo-falla.md`](D-cuando-algo-falla.md) | Está trabado, no le carga, hay un bug |
| [`E-marketing-donde-esta-cada-cosa.md`](E-marketing-donde-esta-cada-cosa.md) | ¿Dónde está el material de marketing? |

## En qué se diferencia de la carpeta de arriba

| | `equipo-crm/01`–`07` | `equipo-crm/manual/` |
|---|---|---|
| Qué es | **Qué decir** — respuestas y guiones | **Cómo se hace** — procesos y mecanismos |
| Dónde vive | Subido al proyecto de Claude | Se lee desde el repo (Codex) |
| Cuándo lo usas | Respondiendo un chat | Aprendiendo o resolviendo un caso |

Se complementan. El `02` te da el texto para pegar; el `A` te explica por qué el precio es ese.

## 🔒 Ojo con el documento A

[`A-como-se-calcula-el-precio.md`](A-como-se-calcula-el-precio.md) tiene **cifras internas**
(tarifa por CBM, peso incluido, recargos, topes). Sirve para que el equipo entienda el
mecanismo — **no para citárselo al cliente**. Cada bloque trae al lado cómo se traduce.

## Mantenimiento

Todo deriva de fuentes vivas del repo:

| Documento | Fuente |
|---|---|
| A | [`lib/calculadora.ts`](../../lib/calculadora.ts) |
| B | [`lib/shared/shipment-public.ts`](../../lib/shared/shipment-public.ts) |
| C | `app/portal/` |
| D | módulos del Studio |
| E | [`docs/marketing/README.md`](../../docs/marketing/README.md) |

**No se sincroniza solo.** Si cambia una tarifa, un servicio o una ruta, hay que editar el
`.md`. Para dar de alta a una persona:
[`docs/runbooks/setup-asistente-equipo-crm.md`](../../docs/runbooks/setup-asistente-equipo-crm.md).
