---
sdd: "0605"
title: "Reestructura de la oficina de agentes: 13 agentes, marketing por plataforma, Revisor y Discord"
status: proposed
author: "Claude Worker «Oficina reestructura» (Sam)"
created: 2026-11-05
updated: 2026-11-05
supersedes: null
superseded_by: null
related: ["0020", "0088", "0089", "0167", "0564", "0588"]
confidencialidad: interno
---

# SDD-0605 — Reestructura de la oficina de agentes

> Deja escrita en el repositorio la reestructura de la oficina de agentes (Hermes y
> Paperclip, [SDD-0564](../0564-instalacion-piloto-paperclip-hermes/spec.md)) que Sam aprobó el
> 2026-11-05: 13 agentes, un subgrupo de marketing con expertos por plataforma, un Revisor,
> la rutina «Vigía de mejoras», un modelo por perfil y Discord como central única.
>
> **Es solo documental.** No toca el VPS de la oficina, Paperclip, Discord ni código de
> producto. No contrata agentes, no crea perfiles, no cambia modelos y no migra ningún aviso.
> Nada de lo que describe está ejecutado.

## Pedido de Sam

El 2026-11-05 Sam aprobó un plan para su oficina de agentes. El plan se escribió en una
sesión de trabajo y vive fuera del repositorio; esta SDD pasa a documentos versionados lo
que ese plan decide sobre la estructura de la oficina. El encargo de esta tarea llegó de la
sesión que armó el plan con Sam, con estas instrucciones: actualizar el organigrama y el plan
maestro, agregar cuatro archivos a la biblioteca, escribir las identidades de los perfiles
nuevos y ajustar las de los renombrados.

## Contexto

- **Antes de esta SDD** la documentación describe la ola 1: 8 agentes Hermes que reportan a
  ALFRED, todos con GLM, y Telegram como canal de Sam
  ([plan maestro](../../organizacion/plan-maestro-oficina.md), revisión del 2026-10-20).
- **El estado vivo del VPS no está verificado**, salvo lo que el plan dice que se midió el
  2026-11-05 en solo lectura (sección «Medido»).
- La fase A de SEO, GEO y AEO del sitio es la SDD-0604. Vive en su propia rama, todavía sin
  fusionar, y esta SDD no toca sus archivos.

## Decisiones de Sam

Todas del 2026-11-05, tal como las registra el plan aprobado. Las citas literales son las
que el plan conserva entre comillas.

| # | Decisión | Cita o precisión |
|---|---|---|
| D1 | **Esquema mixto.** Los agentes piensan en la oficina; el Studio guarda datos, llaves, aprobación y publicación | Hermes no recibe llaves de producción ni de Google |
| D2 | **Sam habla solo con el CEO (ALFRED).** El CEO reparte, da seguimiento y le pasa a Sam solo lo que necesita su decisión | El perfil `director` queda para configurar la oficina |
| D3 | **Discord reemplaza a Telegram** como central única de comunicación con los agentes y de todos los avisos, y es lo primero | «quitar Telegram de una vez»: corte directo, sin semana de doble envío |
| D4 | **Marketing es un subgrupo** con un Director de contenido y expertos por plataforma: Instagram y Facebook, TikTok, YouTube, y SEO, GEO y AEO; más el Redactor de noticias | — |
| D5 | **Hay un Revisor nuevo.** Nada llega a Sam sin pasar por él | — |
| D6 | **«Jefe de gabinete» pasa a llamarse «Coordinador de procesos y seguimiento»** | Sam confirmó el 2026-11-05 los tres nombres nuevos, este incluido: «Sí, así quedan» (ver P2) |
| D7 | **Vigía de mejoras:** rutina semanal del Puente de ingeniería que lee las novedades de Hermes y Paperclip | Actualizar se hace leyendo las notas de la versión y probando antes |
| D8 | **Un modelo por perfil de Hermes:** CEO con Claude Fable 5.1; Revisor con Codex de OpenAI; Director de contenido y Redactor de noticias con Claude Sonnet 5.5; el resto con GLM 5.3 | El agente sigue siendo Hermes; solo cambian proveedor y modelo de su perfil |
| D9 | **Oficina visual:** Paperclip tal cual más Discord. La oficina dibujada se decide después de usarlo unos días | No entra en esta tanda |
| D10 | **Arranque de Discord: solo Sam.** Los roles se crean, pero al inicio solo los tiene Sam | Después Sam nombra a dos personas |
| D11 | **Las noticias se publican solas**, con filtros | «Se publican solas». Es una excepción a la política IA-01 y **no la registra esta SDD** (ver «Qué no entra») |

## Pendientes de decisión

Los cinco primeros son los que el plan lista como pendientes. Los demás salen de comparar el
plan con los documentos.

| # | Pendiente | Quién |
|---|---|---|
| P1 | **Tope de la oficina:** 13 agentes dentro del tope de 100 USD al mes | Sam |
| P2 | ~~**Nombres:** «Coordinador de procesos y seguimiento», «Revisor» y «Director de contenido»~~ **Resuelto el 2026-11-05.** El plan los listaba por confirmar. Sam los confirmó tal como están escritos, al revisar esta SDD: «Sí, así quedan» | — |
| P3 | **Orden de entrada de los expertos** (por turnos, como recomienda el plan) o todos de una vez | Sam |
| P4 | **Quién más está en el servidor de Discord «DTD Cargo»** | Sam |
| P5 | **Cómo pagar Fable 5.1 y Codex:** llave de API con límite mensual (recomendado en el plan) o los planes de suscripción | Sam |
| P6 | **Prueba antes de fijar el reparto de modelos:** las mismas tres tareas reales en cada modelo candidato | Quien ejecute el paso de modelos |
| P7 | **Que Hermes v0.22.2 conozca Fable 5.1**: sin comprobar | Persona con acceso al VPS |
| P8 | **A quién reporta cada agente nuevo en Paperclip.** El plan da las áreas y dice que el Director de contenido reparte entre los expertos; las líneas de reporte de la biblioteca salen de ahí y van marcadas como propuesta | Sam, al aprobar cada contratación |
| P9 | **Qué pasa con el «Analista de crecimiento» de la ola 2** (SEO, Ads y analítica) ahora que existe el Experto en SEO, GEO y AEO | Sam |

## Medido

Lo único del VPS que estos documentos pueden citar como comprobado es lo que el plan dice
que se midió el 2026-11-05, en solo lectura:

- Hermes v0.22.2 y su conexión de Discord ya incluida.
- Paperclip v2026.1012.0.
- Sam no habla directo con ALFRED: habla con un perfil de recepción llamado `telegram`, que
  corre como servicio y le pasa los encargos a ALFRED por un puente propio.
- Los 10 perfiles de agentes usan GLM 5.3 y ninguno tiene Telegram ni Discord.
- El servidor de Discord «DTD Cargo» tiene 12 miembros, medidos por la invitación pública.

Todo lo demás (los 8 agentes de la ola 1, sus rutinas, topes y llaves) viene de documentos
del 2026-10-20 y sigue **NO VERIFICADO**.

## Alcance

### Qué entra

1. El organigrama y el plan maestro con los 13 agentes, el orden de entrada de los expertos,
   la Vigía de mejoras, el modelo por agente y Discord como central con sus roles, separando
   decisión tomada de pendiente.
2. Cuatro archivos nuevos en la biblioteca: marketing, SEO/GEO/AEO, noticias y el catálogo
   «quién hace qué».
3. La identidad (`SOUL.md`) de los perfiles nuevos `revisor`, `director-contenido`, `seo`,
   `tiktok` y `youtube`, y el ajuste de las de los renombrados `gabinete`, `community` y
   `contenido`, conservando su historia.

### Qué no entra

- **Nada en el VPS, Paperclip ni Discord:** ni perfiles, ni contrataciones, ni llaves, ni
  canales, ni cambio de modelo.
- **La excepción a IA-01 para publicar noticias solas (D11).** Se registra en la SDD de las
  puertas del Studio y en el registro de gobernanza cuando esa SDD exista. Hasta entonces
  IA-01 sigue igual y la biblioteca lo dice así.
- **Los avisos del Studio a Discord.** Llevan SDD propia, con `revisar-datos-ve` y el alta de
  Discord en el inventario de terceros.
- **`docs/marketing/agente-seo-noticias.md`.** No existe en la base de esta rama; vive en la
  rama de la SDD-0604. Queda anotado como pendiente en el handoff.
- **Las instrucciones de Paperclip por puesto** (`AGENTS-paperclip.md`), los `hermes.md` de
  los perfiles nuevos y la identidad del CEO. Se anotan como pendientes; se escriben al
  preparar cada contratación.
- **El gráfico** `docs/organizacion/assets/01-organigrama-dtd-cargo.svg`. Es el organigrama
  de la empresa por puestos, que no cambia: se renombra el agente, no el área.
- **`hermes-oficina.md`**, que es diseño histórico.

## Allowlist exacta

Esta SDD solo crea o modifica estos archivos:

| Archivo | Cambio |
|---|---|
| `docs/specs/0605-oficina-reestructura/spec.md` | Nuevo (esta spec) |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index` |
| `docs/organizacion/README.md` | Estado y fecha de las filas tocadas |
| `docs/organizacion/organigrama-paperclip.md` | Sección nueva de la reestructura y avisos en las secciones que reemplaza |
| `docs/organizacion/plan-maestro-oficina.md` | Sección nueva de la reestructura y avisos en las secciones que reemplaza |
| `docs/organizacion/oficina-conocimiento/README.md` | Cuatro filas nuevas |
| `docs/organizacion/oficina-conocimiento/04-marketing.md` | Nuevo |
| `docs/organizacion/oficina-conocimiento/05-seo-geo-aeo.md` | Nuevo |
| `docs/organizacion/oficina-conocimiento/06-noticias.md` | Nuevo |
| `docs/organizacion/oficina-conocimiento/07-quien-hace-que.md` | Nuevo |
| `docs/organizacion/oficina-agentes/README.md` | Tabla de perfiles y su estado |
| `docs/organizacion/oficina-agentes/revisor/SOUL.md` | Nuevo |
| `docs/organizacion/oficina-agentes/director-contenido/SOUL.md` | Nuevo |
| `docs/organizacion/oficina-agentes/seo/SOUL.md` | Nuevo |
| `docs/organizacion/oficina-agentes/tiktok/SOUL.md` | Nuevo |
| `docs/organizacion/oficina-agentes/youtube/SOUL.md` | Nuevo |
| `docs/organizacion/oficina-agentes/community/SOUL.md` | Nuevo en el repositorio: el perfil `community` no tenía su identidad versionada |
| `docs/organizacion/oficina-agentes/gabinete/SOUL.md` | Ajuste por el nombre nuevo, con su historia |
| `docs/organizacion/oficina-agentes/contenido/SOUL.md` | Ajuste por el nombre nuevo, con su historia |
| `.agents/handoffs/sdd-0605-oficina-reestructura.md` | Nuevo (handoff de la tarea) |

## Reglas de contenido

1. **La biblioteca no lleva** nombres de clientes ni de personas, montos, IP ni llaves.
   Tampoco identificadores de cuentas de analítica o de anuncios.
2. **Nada del VPS se presenta como hecho** fuera de la lista «Medido». Lo que viene de
   documentos anteriores conserva su fecha y la marca **NO VERIFICADO**.
3. **Decisión, pendiente y propuesta van separados.** Lo que esta SDD deduce del plan sin que
   el plan lo diga lleva la marca **PROPUESTA** o **INFERIDO**.
4. **La biblioteca se arma con extractos** de documentos y de código que ya existen
   (`docs/marketing/`, `lib/news/`). No inventa reglas nuevas. Donde el plan y el código no
   coinciden, manda el código y la diferencia queda escrita.
5. **Las identidades conservan su historia:** el nombre anterior del puesto, la fecha del
   cambio y lo que no cambia.
6. **La fuente en Git no actualiza la oficina.** Publicar estos documentos en el VPS es un
   paso aparte, con su propia autorización.

## Criterios de aceptación

1. El organigrama y el plan maestro listan los 13 agentes con su área, estado (existe,
   renombrado, nuevo), perfil y modelo, y dicen qué es decisión y qué es pendiente.
2. El organigrama y el plan maestro traen el orden de entrada de los expertos, la Vigía de
   mejoras, el modelo por agente con sus condiciones y Discord como central con canales,
   roles y reglas.
3. Existen los cuatro archivos de biblioteca y su índice los lista.
4. `07-quien-hace-que.md` trae, por cada uno de los 13 agentes, qué hace, qué nunca hace, qué
   modelo usa y a quién reporta.
5. Existen las identidades de `revisor`, `director-contenido`, `seo`, `tiktok` y `youtube`
   con el formato de las anteriores, y las de `gabinete`, `community` y `contenido` reflejan
   el nombre nuevo sin perder su historia.
6. Una búsqueda en los archivos de biblioteca no encuentra IP, llaves, montos ni nombres de
   clientes.
7. `pnpm docs:check` y `pnpm sdd:check` pasan y el índice está regenerado.
8. El diff no toca nada fuera de la allowlist.

## Validación

| Comprobación | Aplica | Motivo |
|---|---|---|
| `pnpm docs:index` y `pnpm docs:check` | Sí | Hay una spec nueva |
| `pnpm sdd:check` | Sí | Hay un número nuevo |
| Prueba de referencias a migraciones en specs | Sí | El diff toca una `spec.md` |
| `git diff --check` y comparación del diff con la allowlist | Sí | — |
| Búsqueda de IP, llaves, montos y nombres en la biblioteca | Sí | Criterio 6 |
| `pnpm verify` | **No aplica** | El diff es solo documentación: no hay código, migraciones, rutas ni textos del sitio. `verify` mide producto (tipos, lint, unitarias, build, pruebas de base) y no leería ninguno de estos archivos |

## Riesgos

| Riesgo | Control |
|---|---|
| Que un agente o una sesión lea estos documentos como estado vivo de la oficina | Cada documento separa lo decidido de lo ejecutado y repite que el VPS no se consultó |
| Que se contrate un agente sin perfil, sin aislamiento o sin aprobación por seguir el organigrama | El plan maestro conserva la plantilla y la regla: sin perfil no se contrata y solo Sam aprueba |
| Que la biblioteca filtre datos | Regla 1 y criterio 6 |
| Que la excepción de publicación automática se dé por vigente | La biblioteca dice que IA-01 sigue igual hasta que exista su SDD y su registro |
| Llaves de modelos en una oficina cuyo aislamiento entre perfiles no está verificado | El plan pide una llave propia de la oficina con límite mensual puesto en el proveedor; queda como condición y no se ejecuta aquí |

## Relación con otras SDD

- **SDD-0564:** instalación de la oficina. Esta SDD no cambia sus controles de acceso ni sus
  topes.
- **SDD-0604** (en su rama): fase A de SEO, GEO y AEO del sitio.
- **SDD-0588:** Administración › Actualizaciones para Chatwoot, el precedente de la Vigía de
  mejoras.
- **SDD-0088, 0089 y 0167:** motor de noticias y centro editorial, fuente de `06-noticias.md`.
- **SDD-0020:** agentes del Studio, donde viven los agentes que tocan datos de clientes.

## Qué no autoriza

Esta SDD no autoriza instalar, contratar, aprobar, pagar, conectar, publicar ni migrar nada.
Cada paso de ejecución del plan (mantenimiento del VPS, perfiles, contrataciones, Discord,
modelos, puertas del Studio) necesita su propio encargo y la autorización de Sam que
corresponda.
