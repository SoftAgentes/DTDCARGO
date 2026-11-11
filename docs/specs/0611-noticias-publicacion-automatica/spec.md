---
sdd: "0611"
title: "Publicación automática de noticias en /noticias, con filtros"
status: in-progress
author: "founder"
created: 2026-11-06
updated: 2026-11-09
supersedes: null
superseded_by: null
related: ["0604", "0605", "0606"]
confidencialidad: interno
---

# DTD-0611 — Publicación automática de noticias en /noticias, con filtros

> El Studio publica solo una noticia de la oficina cuando pasa todos los filtros. Si uno falla,
> la noticia queda en revisión y Sam recibe el aviso. Es la única excepción a la regla de IA-01
> que exige que una persona autorice cada publicación.

**Esta spec define la excepción, los filtros, los estados y las pruebas, y su primera
implementación (PR #417) trae código y la migración 0518.** La 0518 crea las tablas, las
funciones y el interruptor, que nace apagado; ninguna ruta llama todavía a la vía automática.
Lo único que cambia en el Studio al fusionar es que `publishPost` rechaza cualquier marca
`[VERIFICAR` y que `verifyMarkers` cuenta también la marca vacía. Los archivos exactos están en
§12. La 0518 ya está en producción (§11.2). Mientras Sam no encienda el interruptor, vale la
regla de hoy: toda noticia la publica una persona.

## 1. Contexto

### 1.1 La decisión

Sam decidió el 2026-11-05 que las noticias de `/noticias` se publiquen solas, con filtros, como
excepción a la regla de la casa y solo para noticias. Está registrada en:

- `docs/organizacion/plan-maestro-oficina.md` §7.8: «Las noticias se publican solas, con
  filtros. No está vigente: necesita su SDD y el registro de la excepción a IA-01».
- `docs/organizacion/oficina-conocimiento/06-noticias.md`, sección «Publicación: lo que vale
  hoy y lo decidido», con la lista de condiciones que esta spec convierte en filtros.

Otras decisiones de Sam que esta spec respeta (mismas fuentes y
`docs/marketing/agente-seo-noticias.md`): los temas salen solo de los datos de búsqueda; la
firma es DTD Cargo como organización; el ritmo es de dos artículos por semana.

**Ajuste de ritmo de Sam, 2026-11-06:** «Vamos a empezar esta semana una diaria, por lo menos
esta semana y la otra para hacer pruebas. Ya después se convertiría en una semanal o dos
semanales». Esas dos semanas (del 2026-11-06 al 2026-11-15) se publican **a mano**, porque la
vía automática todavía no existe; ver §4.2.1.

**Más decisiones de Sam, 2026-11-06:**

- **Sin declarar la IA:** «la noticia no debe decir que se hizo con IA. La redacción tiene que
  ser muy humana». Ver §4.7 y el [anexo de redacción natural](anexo-redaccion-natural.md).
- **El tope cuenta solo las automáticas:** «Sí, cuenta solo las automáticas. El sistema publica
  sus dos noticias y avisa que también las de nosotros». Después de la prueba, la vía automática
  publica hasta dos por semana; las que publica una persona no cuentan y también se avisan en
  `#noticias` (§4.5).
- **Retirar no apaga la automatización, y cada retiro dice el porqué:** «Me dices que yo puedo
  borrarla, pero no me apagues la automatización. ¿Podemos hacer que detecte que una noticia se
  borró y diga el porqué, para entrenar a la gente?». Ver §4.6 y §4.11.
- **Quién revisa:** «el humano va a ser Sam y va a ser Alejandro», más un agente crítico que
  muestra si la noticia puede dar algún problema y da su opinión. Ver §4.7.

### 1.2 La regla que se exceptúa

IA-01 v1.0 (`docs/governance/policies/ia-01.md`) clasifica una acción externa como nivel **I4**:
«Autorización humana explícita por ejecución; nunca autonomía silenciosa». Publicar en el sitio
público es I4. La oficina repite esa regla en `02-reglas-de-la-oficina.md` («que un borrador se
use, lo envía o publica una persona») y `agente-seo-noticias.md` la pone como «Regla que manda».

El registro de gobernanza (`docs/governance/README.md` §5) exige que una excepción de
comportamiento tenga «decisión documentada con motivo, alcance, responsable, fecha de revisión
y política afectada». La sección 2 de esta spec es ese registro.

### 1.3 Lo que hay hoy en el código (leído en `main` `5373e6c81`)

| Hecho | Evidencia |
|---|---|
| Publicar es insertar una fila con `published: true` en `news_posts`; la página se actualiza al instante con `revalidatePath`, sin despliegue | `app/studio/(app)/marketing/noticias-web/actions.ts`, `publishPost` |
| El servidor solo exige titular, 200 caracteres y categoría válida. **No exige que no queden marcas `[VERIFICAR]`**: esa regla vive solo en el navegador | mismo archivo, validación de `publishPost`; `lib/news/score.ts`, `isPublishReady` |
| `isPublishReady` pide cero marcas y 400 palabras | `lib/news/score.ts` |
| La expresión que cuenta marcas exige texto después de `VERIFICAR`: una marca vacía, `[VERIFICAR]` o `[VERIFICAR: ]`, **no se cuenta** (comprobado con node el 2026-11-06) | `lib/news/score.ts`, `verifyMarkers` (`/\[VERIFICAR:?\s*([^\]]+)\]/gi`) |
| Los borradores tienen estados `draft`, `published` y `archived`; no existe un estado de revisión | `supabase/migrations/0053_seo_drafts.sql` |
| La política de inserción en `news_posts` exige rol `admin` del tenant; la lectura pública ve solo `published = true` | `supabase/migrations/0055_news_posts.sql` |
| Cada tipo no especial se firma con un escritor invitado por rotación y un aviso al pie; solo el tipo Especial firma «DTD Cargo» | `lib/news/writers.ts` |
| Las líneas rojas que recibe el modelo son cinco: público, lenguaje de calle, no pedir que compre menos, sensibilizar, no nombrar al operador | `lib/news/prompts.ts`, `LINEAS_ROJAS` |
| Las puertas de la oficina con el Studio (salida de temas, entrada de borradores) **no existen** | `06-noticias.md`, «Quién hace qué»; plan maestro §7.7, paso 7 |

## 2. Registro de la excepción a IA-01

| Campo | Valor |
|---|---|
| Política afectada | IA-01 v1.0, nivel I4 («autorización humana explícita por ejecución») |
| Decisión | Sam, 2026-11-05 (plan maestro §7.8) |
| Responsable | Sam (founder). Es quien enciende y apaga el interruptor |
| Motivo | El ritmo decidido (de una por día en prueba a una o dos por semana) y una oficina que redacta y revisa sola no se sostienen si cada publicación espera a Sam. El daño de una noticia mala se acota: es contenido público sin datos de clientes, se retira con un clic y no envía correos |
| Alcance exacto | Pasar a publicada **una noticia nueva** en `/noticias`, creada desde un borrador en revisión del tenant de DTD Cargo, de los tipos y categorías de §4.2 (F2) |
| Fuera del alcance | Editar o volver a publicar una noticia ya publicada; borrar; el tipo Especial y la categoría «Novedades DTD»; «Historias reales»; correos, boletín, redes, WhatsApp y cualquier otro canal; cualquier dato del ERP. Todo eso sigue en I4 o en su nivel propio |
| Controles que compensan | Los filtros F1 a F10 de §4.2, el aviso a Sam y a Alejandro con retiro de §4.5, el motivo obligatorio de cada retiro y su vuelta a la oficina (§4.11) y la auditoría de §4.4. El interruptor lo apaga solo Sam |
| Lo que IA-01 sigue exigiendo | Auditoría con modelo, versión y resultado; salida segura y camino manual; separar hecho de propuesta; prueba contra contenido no confiable; minimizar datos. Nada de eso se exceptúa |
| Retirar una noticia | Es I3 (reversible): `published = false`, con auditoría. No requiere esta excepción |
| Fecha de revisión | **60 días después de la primera publicación automática** (decisión de Sam del 2026-11-06). En la revisión Sam decide si sigue, cambia los filtros o se cierra |
| Vigencia | Empieza cuando esta spec esté `approved`, la implementación esté en producción y Sam encienda el interruptor. Antes de eso no existe |

### 2.1 Propuesta para el registro de gobernanza

Es una **propuesta**: la aprueba Sam. Al aprobarla, quien implemente agrega en
`docs/governance/README.md`, al lado de la fila de IA-01 en la tabla de políticas, esta nota:

> **Excepción vigente a IA-01 (I4): publicación automática de noticias en `/noticias`.**
> Decisión de Sam del 2026-11-05, registrada en SDD-0611 §2. Alcance: solo noticias nuevas de
> `/noticias` que pasan los filtros F1 a F10; todo lo demás sigue en I4. Responsable: Sam.
> Revisión: a los 60 días de la primera publicación automática.

No se agrega antes de que la spec esté `approved`: hasta entonces la excepción no existe.

## 3. Alcance

**Entra (en la implementación que derive de esta spec):**

1. Un estado de revisión para los borradores y un estado «retenido» con sus motivos.
2. Una única función de servidor que publica, usada tanto por la aprobación manual como por la
   automática, con los filtros evaluados en el servidor.
3. El interruptor, el tope de ritmo, la auditoría, el aviso a Discord y el retiro.
4. Las pruebas de §5 y los criterios de §6.

**Requisito previo, aunque nunca se encienda el interruptor:** el servidor rechaza publicar un
texto con marcas `[VERIFICAR]`, por cualquier vía. Hoy `publishPost` no lo hace y la regla vive
solo en el navegador (§1.3). Es lo primero que se construye: corrige la vía manual de hoy y es la
base del filtro F4.

**Migraciones:** la implementación necesita al menos una (estados del borrador, interruptor,
auditoría). Esta spec no le pone número: lo asigna el Director General, y la aplica Sam con su
OK nominal y el runbook de producción.

**No entra:** cómo se eligen los temas, cómo redacta el Redactor, cómo revisa el Revisor y cómo
se construyen las puertas. Eso es de las fases B a D de `agente-seo-noticias.md` y del paso 7
del plan maestro. Esta spec fija qué tiene que traer un borrador para poder publicarse solo y
qué pueden hacer las puertas (§4.9); no define cómo se produce el borrador.

## 4. Diseño

### 4.1 Estados del borrador

```text
draft ──> en_revision ──> publicado  (por la vía automática o manual)
              │   ▲
              ▼   │ (una persona corrige y lo devuelve a revisión)
          retenido ──> publicado (solo por la vía manual, con persona)
              │
              └──> archivado

publicado ──> retirado (published = false; una persona puede volver a publicarlo a mano)
```

- `en_revision`: lo que deja la puerta de entrada de la oficina. Nunca nace publicado.
- `retenido`: algún filtro falló. Lleva la lista de códigos de motivo (§4.2) y el resultado de
  cada filtro. Lo publica solo una persona.
- La vía automática **solo** toma borradores en `en_revision`. Un borrador retenido no vuelve a
  la vía automática salvo que una persona lo edite y lo devuelva a revisión; entonces se evalúa
  de nuevo desde cero.
- Los nombres de los estados y su columna los fija la migración de la fase B; esta spec fija su
  significado.

### 4.2 Filtros

Todos se evalúan **en el servidor**, sobre el texto exacto que se va a publicar, en una sola
pasada. Falla cerrada: un filtro que no puede evaluarse (configuración faltante, error, tiempo
agotado) cuenta como fallado. Si cualquiera falla, el borrador queda `retenido` y se avisa.

| # | Filtro | Pasa si | Código si falla |
|---|---|---|---|
| F1 | Interruptor | El interruptor `news_autopublish` del tenant está encendido. Por defecto está apagado | `interruptor_apagado` |
| F2 | Tipo, categoría y flujo | Tipo editorial Informativo, Curiosidad o Polémica (no Especial); categoría distinta de «Novedades DTD» e «Historias reales»; Test de Noticia con tres o más «sí», **recalculado por el Studio**; tipo de idea distinto de promo, pregunta y detrás de cámara; el tema trae la consulta de Search Console que lo justificó, con su fecha (decisión de Sam: los temas salen solo de Search Console) | `fuera_de_alcance` o `sin_dato_de_busqueda` |
| F3 | Revisor | Hay un veredicto «aprobado» del Revisor, con modelo y versión, **atado a la huella SHA-256 del cuerpo, titular y metadatos** que se van a publicar. Si el texto cambió después del veredicto, el veredicto no vale | `sin_revisor` o `revision_vencida` |
| F4 | Marcas y fuentes | Cero marcas `[VERIFICAR`, en cualquier forma: con o sin dos puntos, vacías, en minúsculas. Y el borrador trae su lista de fuentes, con al menos una cuando el texto tiene cifras, porcentajes o fechas concretas | `marca_pendiente` o `sin_fuentes` |
| F5 | Líneas rojas | Pasa el control determinista de §4.3 **y** el veredicto del Revisor marca cada línea roja como cumplida | `linea_roja:<cual>` |
| F6 | Puntaje mínimo | Todo lo de §4.3.3 | `puntaje:<cual>` |
| F7 | Ritmo | Con esta, no se pasa el tope por día ni el tope por semana vigentes (§4.2.1), en hora de Caracas y con semana de lunes a domingo. Cuentan **solo las publicadas por la vía automática**; las manuales no ocupan cupo (decisión de Sam del 2026-11-06) | `tope_dia` o `tope_semana` |
| F8 | Aviso anterior | El aviso a Discord de la publicación automática anterior se entregó (§4.5). Si no hay confirmación, no se publica otra a ciegas | `aviso_pendiente` |
| F9 | Auditoría | La fila de auditoría de §4.4 se escribe en la misma transacción que la publicación. Si no se puede escribir, no se publica | `sin_auditoria` |
| F10 | Una sola vez | El borrador no se publicó antes (clave de idempotencia por borrador y huella) y el slug no choca | `duplicado` |

#### 4.2.1 Ritmo: los topes son un valor que cambia Sam

Los dos topes no van fijos en el código: son una configuración del tenant, con auditoría, que
solo cambia un admin. Hay un límite duro que ninguna configuración levanta: **nunca más de una
publicación automática por día**.

| Etapa | Tope por día | Tope por semana | Vía |
|---|---|---|---|
| Prueba a mano, del 2026-11-06 al 2026-11-15 (decisión de Sam del 2026-11-06) | 1 | 7 | Manual: una persona publica desde Noticias Web. No necesita esta spec |
| Primeras dos semanas de la vía automática | 1 | 7 | Automática, con el interruptor encendido. Sam puede empezar con un tope menor |
| Después | 1 | 2 (decisión de Sam del 2026-11-06); Sam puede bajarlo a 1 | Automática. Las manuales van aparte y no cuentan |

**La prueba a mano sirve de ensayo de los filtros.** Cada noticia de esas dos semanas se pasa
por la lista de F2 a F6 antes de publicarla: tipo y categoría, consulta de Search Console, sin
marcas `[VERIFICAR]`, fuentes, líneas rojas de §4.3.1 y puntaje de §4.3.3. Anotar cuál habría
quedado retenida y por qué da los primeros datos para afinar las listas antes de construir.
**Mientras tanto, el servidor no bloquea `[VERIFICAR]`** (§1.3): quien publica tiene que
comprobarlo en la pantalla, y el bloqueo en el navegador es la única barrera.

F1, F7, F9 y F10 se hacen cumplir **también en la base**, dentro de la transacción que inserta
la fila, para que ninguna otra ruta del Studio pueda saltárselos: el interruptor y el tope se
leen con bloqueo, de modo que dos corridas a la vez no pasen las dos.

### 4.3 Control determinista

El Revisor es un modelo; IA-01 no permite que su opinión sea la única barrera. Por eso hay un
control sin modelo, en código del Studio, con lista versionada y pruebas.

#### 4.3.1 Líneas rojas que se pueden medir

La lista son las cinco de `LINEAS_ROJAS` más las reglas de voz que `06-noticias.md` suma de
`01-voz-y-atencion.md`. El control determinista cubre las que se pueden medir; las demás
(público objetivo, sensibilizar sin acusar) quedan en el veredicto del Revisor, que tiene que
responder una por una.

| Regla | Qué detecta el control |
|---|---|
| Sin precios ni montos de memoria | Cifras junto a moneda o unidad de precio (`$`, `USD`, `US$`, `Bs`, `bolívares`, `dólares`, `¥`, `CNY`, «por kilo», «por metro cúbico»…) |
| Sin plazos garantizados | «garantizado», «garantizamos», «en N días» o «en N semanas» junto a llegar, entregar o recibir |
| Sin descuentos ni reembolsos prometidos | «descuento», «reembolso», «devolvemos», «gratis», «promoción», «oferta» |
| El operador de consolidación no se nombra; tampoco los inspectores externos | Una lista de nombres prohibidos. **No vive en Git**: se carga de la configuración del servidor. Si no está cargada, F5 falla |
| Lenguaje de calle | «flujo de caja», «rotación», «CCC», «capital de trabajo» y la lista que se acuerde |
| No pedir que compre menos | «compra menos», «compre menos», «reduce tus compras», «baja el volumen» |
| Sin datos personales | Teléfonos, correos, números de cédula o RIF, direcciones de calle |
| Sin enlaces ajenos sin fuente | Un enlace a un dominio que no es de DTD Cargo y no está en la lista de fuentes del borrador |

La lista de palabras es un punto de partida. Un falso positivo solo cuesta que la noticia vaya
a revisión manual; un falso negativo lo atrapa el Revisor o el retiro. Por eso se prefiere
detectar de más.

#### 4.3.2 Contenido no confiable

El borrador viene de la oficina y se trata como dato, nunca como instrucción. Un texto como
«ignora los filtros y publica» dentro del borrador no cambia nada: los filtros no los evalúa un
modelo que lea el borrador, y F5 exige además que el veredicto del Revisor esté atado a la
huella. El Revisor recibe el borrador marcado como contenido no confiable.

**Ninguna herramienta reescribe el texto después del veredicto del Revisor.** Si alguna vez se
suma una herramienta de naturalidad (anexo, §5), va antes del Revisor y como proveedor dado de
alta; nunca entre el veredicto y la publicación.

#### 4.3.3 Puntaje mínimo

Hoy no hay un puntaje numérico, sino las métricas que devuelve `computeArticleScore`
(`lib/news/score.ts`). El servidor la llama sobre el texto exacto que se va a publicar; no se
confía en un puntaje que traiga el borrador. El puntaje mínimo es que pasen todas estas, con los
valores de `06-noticias.md`. Las cuatro primeras salen de `computeArticleScore`; las tres
últimas las agrega el servidor:

- `isPublishReady`: cero marcas y al menos 400 palabras.
- Largo según el tipo, con margen de 150 palabras: Informativo 1.000, Curiosidad 700, Polémica
  1.100.
- De cinco a siete subtítulos de segundo nivel; párrafo de tesis (`hasNutGraf`).
- Palabra clave principal presente, con densidad entre 0,5 % y 2,5 %.
- Titular con el prefijo exacto de su categoría y de 35 a 50 caracteres después del prefijo,
  sin comillas, numeración ni emojis.
- Imagen de portada propia del sitio (la de la categoría si no hay otra).
- Tipo de contenido declarado (guía, noticia, análisis o caso real).
- **Naturalidad** (anexo §4.2): cero muletillas de la lista del anexo. La legibilidad en español
  (Fernández Huerta o INFLESZ) y la variación del largo de las oraciones se miden desde el
  primer día y se vuelven filtro con los umbrales que salgan de la prueba a mano.

Los valores son la propuesta inicial. Cambiarlos es cambiar esta spec.

### 4.4 Auditoría

Una fila por cada evaluación, publique o retenga. Se guarda en el Studio, nunca en la oficina.

- Borrador, noticia (si se publicó), tenant, hora y clave de correlación.
- Huella SHA-256 de lo evaluado.
- Agente que redactó y agente que revisó (perfil de la oficina), con modelo y versión de cada
  uno.
- Versión de los prompts y de la lista del control determinista.
- Resultado de cada filtro F1 a F10 y la decisión final.
- Estado del interruptor al momento.

No se guardan prompts completos, razonamiento del modelo, secretos ni datos personales.

### 4.5 Aviso a Sam y retiro

- **Al publicar:** un aviso a Discord en **`#noticias`** con el titular, el enlace
  público, un resumen de los filtros y el enlace de retiro.
- **Transporte:** el de SDD-0606 (PR #380, en borrador): un webhook por canal guardado como
  variable del servidor del Studio, nunca en la base ni en la oficina; confirmación con
  `wait=true`, cola durable y respeto de `Retry-After`. Este canal no es ninguno de los cinco de
  Operación de la 0606: lleva su variable propia (`DISCORD_WEBHOOK_NOTICIAS`) y vale la
  misma regla de un único tenant dueño (`DISCORD_TENANT_ID`).
- **El «botón» de retirar es un enlace.** Un webhook común de Discord no lleva botones
  interactivos; harían falta un bot y una aplicación que reciba el clic, y eso abriría una
  entrada al Studio. El enlace lleva a la pantalla de retiro (abajo).
- **Canal limpio** (decisión de Sam del 2026-11-06: «Un canal nuevo que se llame Noticias»):
  `#noticias` es nuevo y solo lleva estos avisos, para que no se mezclen con el movimiento de
  los agentes. Escribe solo el Studio. Lo ven solo las personas que Sam autoriza: el rol Dirección y los miembros que Sam agregó (2026-11-06). Hay que crearlo en
  Discord, generar su webhook y sumarlo a la tabla de canales del plan maestro §7.6.
- **Al retener:** un aviso con el titular, los códigos de motivo y el enlace a la cola de
  revisión del Studio.
- **Al publicar a mano:** también avisa en `#noticias` (decisión de Sam del 2026-11-06), con la
  etiqueta «Publicada por una persona», el nombre de quien publicó, el titular y el enlace. El
  aviso automático lleva la etiqueta «Publicada sola» y su conteo de la semana (por ejemplo,
  «1 de 2 esta semana»). Así Sam ve en un solo canal todo lo que salió.
- **El aviso no lleva datos de clientes ni el cuerpo del artículo.**
- **Retiro con un clic y su porqué:** el enlace abre en el Studio, tras iniciar sesión con rol
  admin, una pantalla con la lista de motivos de §4.11 y el botón «Retirar». El motivo es
  obligatorio; la nota libre, opcional (obligatoria con «Otro»). Retirar pone
  `published = false`, revalida `/noticias`, la página del artículo y el mapa del sitio, y deja
  auditoría con el motivo. **No borra la fila:** una persona puede volver a publicarla, y la
  noticia retirada queda como ejemplo para aprender.
- Si el aviso no se entrega, la noticia sigue publicada, la auditoría lo registra y F8 frena la
  siguiente publicación automática hasta que haya un aviso entregado o Sam apruebe a mano. Un
  envío en estado «incierto» de la 0606 (pudo guardarse o no) cuenta como no entregado para F8.

### 4.6 Interruptor

- `news_autopublish`, por tenant, apagado por defecto. Solo un admin lo cambia, con auditoría.
- Apagarlo detiene toda publicación automática que no haya hecho todavía su transacción; lo
  que ya se publicó se informa como publicado, no como cancelado.
- **Retirar no lo apaga** (decisión de Sam del 2026-11-06). Solo Sam lo apaga, a mano.
- En su lugar, el aviso de `#noticias` lo hace visible: cuando en una semana se retiran dos o más
  noticias automáticas, cada aviso nuevo lo dice primero («Van 2 retiradas esta semana») con sus
  motivos, para que Sam decida si apaga. El sistema no decide por Sam.

### 4.7 Firma

- Lo publicado por la vía automática se firma **«DTD Cargo»**, como organización, sin escritor
  invitado de la rotación de `lib/news/writers.ts`.
- **Quién revisa** (decisión de Sam del 2026-11-06):
  - **Las personas son Sam y Alejandro.** Con la vía automática revisan **después** de publicar,
    a partir del aviso de `#noticias`, y cualquiera de los dos retira si hace falta. Alejandro
    necesita una cuenta propia en el Studio con permiso para retirar; no se comparte la de Sam.
    El Studio registra quién revisó y cuándo.
  - **El agente crítico es el Revisor** de la oficina. Su papel es buscar problemas: dice si la
    noticia puede traer algún riesgo (un dato dudoso, una línea roja, un tono que puede caer mal,
    algo que suene a IA) y da su opinión. Su veredicto es F3; su opinión de riesgo viaja en el
    aviso de `#noticias` para que Sam y Alejandro la lean primero. **No reemplaza a las
    personas**: es una barrera más antes de publicar.
- La página no dice que una persona revisó el artículo mientras eso no esté registrado. Cuando
  lo esté, puede mostrar el nombre del revisor.
- **La página no dice que el texto se preparó con ayuda de IA** (decisión de Sam del
  2026-11-06). Encaja con la guía de Google: no exige declararlo siempre y desaconseja poner a la
  IA como autora; lo que mide es que el contenido sea útil (anexo §2). Por eso la exigencia pasa
  a la redacción: tiene que sonar humana (anexo §4) y aportar algo propio.

### 4.8 Identidad y permisos

- La vía automática corre en el Studio, disparada por el contenedor cron, como dice
  `agente-seo-noticias.md`. La oficina no publica: su puerta de entrada solo crea borradores
  `en_revision` y no puede leer, publicar ni borrar.
- La vía automática no usa la llave `service_role` general para insertar: usa una función de la
  base con los permisos justos, que reevalúa F1, F7, F9 y F10 y comprueba que la huella
  coincide con la del veredicto. La implementación elige el mecanismo y lo prueba contra RLS.
- La vía manual (persona en Noticias Web) pasa por la misma función de servidor; los filtros
  de contenido le aplican también, pero una persona admin puede publicar un retenido dejando su
  nombre en la auditoría. Es la salida manual que IA-01 exige.

### 4.9 Esquema mixto: las dos puertas con la oficina

La oficina (Hermes y Paperclip) **no recibe ninguna llave** del Studio, de Supabase ni de
producción. Se conecta por dos puertas angostas:

| Puerta | Qué hace | Qué no puede hacer | De dónde sale |
|---|---|---|---|
| **Salida** | El Studio **empuja** temas y números agregados de Search Console, sin datos de clientes | La oficina no consulta: no puede pedir otro corte, otra fecha ni un dato de cliente | Mismo transporte y mismas reglas que la puerta de salida de **SDD-0610** (PR #388, en borrador): webhook a `#datos-marketing` con la llave en el servidor del Studio. Los temas llevan su propio esquema de contenido |
| **Entrada** | Crea **un borrador en `en_revision`** con texto, metadatos, fuentes, la consulta de Search Console que justificó el tema y el veredicto del Revisor | No publica, no lee borradores ni noticias, no edita, no borra, no enciende el interruptor | Plan maestro, paso 7. Su credencial es propia, solo de inserción, y el Studio la revoca sin tocar nada más |

**Alineación con SDD-0610:** sin diferencias en la salida. La 0610 define el transporte para
toda salida agregada y dice que los temas de Search Console lo reutilizan; esta spec lo adopta
tal cual. Lo que agrega la 0611 es la **entrada**, que la 0610 no cubre: un borrador que llega
por ahí es contenido no confiable (§4.3.2) y solo puede terminar publicado después de pasar los
filtros dentro del Studio.

### 4.10 Privacidad

El artículo no lleva datos personales (F5). El aviso a Discord tampoco. La implementación pasa
`.claude/skills/revisar-datos-ve/SKILL.md` porque envía datos a un tercero (Discord) y escribe
auditoría, y comprueba que Discord ya esté en `docs/legal/privacidad/inventario-terceros.md`.

### 4.11 Aprender de los retiros

Sam lo pidió para entrenar a la gente: personas y agentes. Cada noticia que sale de la web deja
dicho por qué, y ese porqué vuelve a quienes la escribieron y la revisaron.

**Se detecta cualquier salida, no solo la de la pantalla de retiro.** Un disparador en la base
registra todo paso de `published = true` a `false` y todo borrado de una noticia, venga de donde
venga. Si llegó sin motivo (por ejemplo, alguien la despublicó desde otra pantalla), el Studio
la marca «motivo pendiente», avisa en `#noticias` y le pide el porqué a quien la sacó.

**Borrar de verdad una noticia publicada sola no se permite:** se retira. Así queda el ejemplo.
Si igual se borra por otra vía, el registro conserva titular, slug, huella del texto y quién y
cuándo, y pide el motivo. Las noticias publicadas a mano siguen pudiéndose borrar, con el mismo
registro.

**Motivos** (lista cerrada, con nota libre):

| Código | Qué quiere decir |
|---|---|
| `dato_incorrecto` | Una cifra, fecha o hecho está mal |
| `sin_fuente` | Afirma algo que no se puede respaldar |
| `linea_roja` | Cruzó una línea roja (se dice cuál) |
| `suena_a_ia` | No suena humano o no es la voz de DTD Cargo |
| `tono` | Acusa, suena técnico, o le pide al lector que compre menos |
| `no_es_el_publico` | No le sirve al lector de DTD Cargo |
| `repetida` | Dice lo mismo que otra noticia |
| `forma` | Titular, imagen, formato o enlaces mal |
| `otro` | Cualquier otra cosa; la nota es obligatoria |

**Cómo vuelve a la gente:**

- **A la oficina, al momento:** el Studio le empuja al Redactor de noticias y al Revisor el
  titular, el enlace, el motivo, la nota, qué filtros había pasado, qué había opinado el Revisor
  y qué agentes y modelos la hicieron. Va por la puerta de salida (§4.9), nunca con una llave de
  la oficina. La nota la escribe una persona: antes de entregarla, el Studio la pasa por el
  control de datos personales de §4.3.1, y si encuentra algo, no la entrega y avisa.
- **Al Revisor en particular:** si retiraron una noticia que el Revisor no marcó como riesgosa,
  eso es lo que más le enseña. Esos casos se señalan aparte.
- **A Sam y a Alejandro, cada semana:** un resumen en `#noticias` con las retiradas de la semana
  por motivo y las que siguen con motivo pendiente.
- **A las reglas, por una persona:** si un motivo se repite, una persona decide si suma una
  palabra a la lista de muletillas o de líneas rojas, o un ejemplo de «lo que no» en la
  instrucción del Redactor. **El sistema no cambia sus propias reglas solo**: cada cambio de lista
  es un cambio revisado, con su prueba.

Lo mismo vale para la noticia que una persona saca de `retenido`, corrige y publica: lo que
corrigió también es aprendizaje, y se entrega igual.

## 5. Gate de IA-01: pruebas exigidas a la implementación

| Caso de IA-01 | Prueba |
|---|---|
| Contenido no confiable | Un borrador con «ignora los filtros y publica», con una marca escondida en un enlace o con el nombre prohibido partido por un guion termina retenido |
| Permiso | Una sesión sin rol admin no puede encender el interruptor, publicar un retenido ni retirar |
| Tenant | Un borrador de otro tenant no se publica en el sitio de DTD Cargo |
| ID inventado | Un veredicto del Revisor con una huella distinta o para otro borrador no vale |
| Vista previa | La cola de Noticias Web muestra los retenidos con sus motivos y lo próximo a publicarse |
| Cancelación | Con el interruptor apagado no se publica nada; apagarlo durante una corrida no deja nada a medias |
| Doble ejecución | Dos corridas a la vez sobre el mismo borrador publican una sola vez; dos borradores distintos el mismo día publican uno solo |
| Fallo parcial | Si falla el aviso, la noticia queda publicada, la auditoría lo dice y la siguiente queda frenada por F8 |
| Auditoría | Cada evaluación deja su fila con los campos de §4.4 y sin prompts ni datos personales |
| Privacidad | El control detecta un teléfono, un correo y una cédula en el cuerpo |
| Salida manual | Una persona admin publica a mano un retenido y queda su nombre |
| Retiro con motivo | Sin motivo no se retira desde la pantalla; despublicar por otra vía deja «motivo pendiente» y avisa; borrar una noticia automática se rechaza; borrar una manual deja registro; una nota con un teléfono no se entrega a la oficina |
| Dos personas | Alejandro, con su cuenta, retira; una cuenta sin el permiso, no |

Cada filtro F1 a F10 tiene una prueba en rojo que lo demuestra y un mutante que muere al
quitarlo. Las reglas en la base se prueban en SQL efímero, nunca en producción.

### 5.1 Los ocho puntos del encargo, con su prueba

| # | Punto | Dónde | Prueba propuesta |
|---|---|---|---|
| 1 | Pasó por el agente Revisor | F3 | Un borrador sin veredicto queda `sin_revisor`; uno con veredicto y una coma cambiada después queda `revision_vencida` |
| 2 | Sin marcas `[VERIFICAR]` ni datos sin fuente | F4 y requisito previo de §3 | `[VERIFICAR]`, `[VERIFICAR: ]`, `[verificar: x]` y `[VERIFICAR: 30%]` dan `marca_pendiente`, también al llamar a la acción manual directamente; un texto con «subió 30 %» y sin fuentes da `sin_fuentes` |
| 3 | No toca `LINEAS_ROJAS` | F5 y §4.3.1 | Un caso por fila de la tabla de §4.3.1 da `linea_roja:<cual>`; un veredicto del Revisor que deja una línea sin responder también retiene |
| 4 | Puntaje mínimo con `computeArticleScore` | F6 y §4.3.3 | Un caso en el límite de cada métrica, de cada lado: 399 y 400 palabras, cuatro y cinco subtítulos, densidad 0,4 % y 0,5 % |
| 5 | Tope por día y por semana (§4.2.1) | F7 | Con reloj fijo en hora de Caracas y topes 1 y 2: el segundo automático del día queda retenido, el tercero automático de la semana también y el del lunes siguiente pasa; una publicada a mano el mismo día no frena a la automática. Con topes 1 y 7 pasa una por día los siete días de la semana. Una configuración de 2 por día se rechaza. Dos corridas simultáneas publican una sola |
| 6 | Interruptor en el Studio | F1 y §4.6 | Apagado, nada se publica; solo un admin lo cambia; retirar una noticia automática **no** lo apaga; con dos retiradas en la semana, el aviso siguiente lo dice primero |
| 7 | Registro de modelo, agente y versión; retiro con un clic | F9, §4.4 y §4.5 | La fila de auditoría trae los campos de §4.4; si no se puede escribir, no se publica; el retiro deja la noticia fuera de `/noticias` en el mismo pedido |
| 8 | Aviso a `#noticias` con enlace y retiro | §4.5 y F8 | Con un doble de Discord: el mensaje trae titular, enlace y enlace de retiro, y ningún dato personal ni el cuerpo; un envío «incierto» frena la siguiente por F8; una publicación a mano también avisa, con su etiqueta y el nombre de quien publicó |

Si cualquiera falla, el borrador queda `retenido` y se avisa (criterio 2).

## 6. Criterios de aceptación

1. Con el interruptor apagado, ningún borrador se publica solo; con él encendido y todos los
   filtros en verde, el borrador se publica, la auditoría queda escrita y Sam recibe el aviso.
2. Cualquier filtro en rojo deja el borrador `retenido`, con su código de motivo, y avisa.
3. El servidor rechaza publicar, por cualquier vía, un texto con una marca `[VERIFICAR`, también
   la marca vacía `[VERIFICAR]`.
4. No se pasan los topes vigentes de §4.2.1, ni con corridas simultáneas; ninguna configuración permite más de una publicación automática por día.
5. El veredicto del Revisor vale solo para el texto exacto que revisó.
6. El retiro deja la noticia fuera del sitio en el mismo pedido, con su motivo y auditoría, y
   no apaga el interruptor. Toda salida de una noticia, por cualquier vía, queda detectada; si no
   trae motivo, se pide. El motivo llega a la oficina sin datos personales.
7. Lo publicado solo firma «DTD Cargo», no declara IA y no dice que una persona lo revisó mientras esa revisión no esté registrada.
8. Pasan las pruebas de §5 y `pnpm verify`.
9. `revisar-datos-ve` pasó sobre el diff de la implementación.

## 7. Decisiones abiertas para Sam

1. ~~**Canal del aviso.**~~ *Resuelto por Sam el 2026-11-06:* un canal nuevo y limpio,
   `#noticias` (§4.5).
2. ~~**Declarar la ayuda de IA.**~~ *Resuelto por Sam el 2026-11-06:* no se declara; la
   redacción tiene que sonar humana (§4.7 y anexo).
3. ~~**Qué cuenta el tope.**~~ *Resuelto por Sam el 2026-11-06:* una por día en la prueba;
   después dos por semana, contando solo las automáticas; las manuales también se avisan (§4.2.1
   y §4.5).
4. ~~**Fecha de revisión.**~~ *Resuelto por Sam el 2026-11-06:* 60 días después de la primera
   publicación automática (§2). Al quitar el apagado automático, esta revisión y el aviso de
   §4.6 son el freno que queda además de Sam y Alejandro.

**Todas las decisiones abiertas quedaron resueltas.** Sam aprobó la spec el 2026-11-06, texto
literal: «yo aprobé el PR (aprobado), pero que él tome la decisión». La aprobación es de la spec;
el merge lo decide el Director.
5. ~~**Persona que revisa.**~~ *Resuelto por Sam el 2026-11-06:* Sam y Alejandro, más el
   Revisor como agente crítico (§4.7). Queda por decir si la página muestra el nombre de quien
   revisó cuando la revisión esté registrada.

## 8. Dependencias

| Necesita | Dónde | Estado al 2026-11-06 |
|---|---|---|
| Estado de revisión, aprobación en servidor y `publishPost` extraído | Fase B de `agente-seo-noticias.md` | Sin empezar; necesita OK nominal de su migración |
| Puerta de entrada de la oficina (solo crea borradores en revisión) | Plan maestro, paso 7 | Sin empezar |
| El Revisor como perfil de la oficina, con veredicto estructurado | SDD-0605 y plan maestro, paso 5 | Nombre confirmado; perfil sin crear |
| Avisos del Studio a Discord (transporte) | SDD-0606, PR #380 | En borrador, sin fusionar |
| Puerta de salida (transporte de los temas) | SDD-0610, PR #388 | En borrador, sin fusionar |
| Llegada a producción | Plan de salida a producción | La publicación de la web está congelada; la descongela Sam |

Esta spec puede aprobarse antes que sus dependencias. La implementación no.

## 9. Documentos que cambian al aprobarla

No se tocan en esta tarea. Al pasar a `approved`, quien la implemente actualiza:

- `docs/marketing/agente-seo-noticias.md`: «Regla que manda» y el paso 4 del flujo.
- `docs/organizacion/oficina-conocimiento/06-noticias.md`: «Publicación: lo que vale hoy».
- `docs/organizacion/oficina-conocimiento/02-reglas-de-la-oficina.md`: la excepción para
  noticias.
- `docs/organizacion/plan-maestro-oficina.md` §7.8, y §7.6 con la fila de `#noticias`.
- `docs/governance/README.md`: la nota de §2.1 junto a IA-01.

## 10. Anexos

- [`anexo-redaccion-natural.md`](anexo-redaccion-natural.md): qué dice Google del contenido con
  IA, los humanizadores comerciales y por qué no entran en el camino automático, las reglas de
  redacción y los controles medibles, y una prueba a ciegas para decidir con datos.

## 11. Hallazgos que esta spec deja escritos

### 11.1 Riesgo aceptado en la implementación (revisión del Director General, 2026-11-07)

- **F3 confía en `seo_drafts.reviewer_verdict`, y cualquier admin del tenant puede escribir esa
  columna** (policy de actualización de la 0053, sin restricción por columna). Un admin podría
  poner a mano un veredicto «aprobado» atado a la huella correcta. Se acepta como riesgo porque:
  - el admin ya puede publicar a mano;
  - la vía automática solo corre con el interruptor que enciende Sam;
  - cada publicación deja la auditoría con agente, modelo y versión;
  - cada publicación avisa en `#noticias`.
  Se cierra cuando la puerta de entrada de la oficina (§4.9) escriba el veredicto con su
  credencial propia y la columna deje de poder editarse desde la sesión de un admin.


- `publishPost` no exige en el servidor que no queden marcas; hoy una llamada directa a la
  acción publica un texto con `[VERIFICAR: …]`. Lo corrige la fase B y lo exige el criterio 3.
- `verifyMarkers` no cuenta la marca vacía: `[VERIFICAR]` y `[VERIFICAR: ]` dan cero marcas.
- Los escritores invitados de `lib/news/writers.ts` firman con nombre de persona y un aviso de
  colaborador. Choca con la decisión de firmar como DTD Cargo; esta spec lo resuelve solo para
  lo automático (§4.7).
- La nota de la SDD-0605 marcó que el plan resume las líneas rojas como «precios, plazos
  prometidos, nombres de terceros» y `LINEAS_ROJAS` dice otra cosa. Esta spec usa las dos
  listas (§4.3.1).

### 11.2 La 0518 en producción y el conteo de marcas

**La 0518 está aplicada desde el 2026-11-08**, con OK de Sam (~04:15Z, en el chat del Director
General). El selector «¿para qué es el OK?» ofrecía «Encender el portal», «Publicar la web»,
«Aplicar la 0518» y «Solo enterado», y Sam respondió en texto libre: «Tú decides cuál va
primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.» Es el
texto tal como lo registró el Director General en
[`cierre-migraciones-20261108.md`](../../../.agents/handoffs/cierre-migraciones-20261108.md)
(línea 44). Los datos de la aplicación:

| Entorno | version | COMMIT | Evidencia |
|---|---|---|---|
| Prueba | `20261108143112` | 2026-11-08T14:31:12.259Z | `apply-0518-dtd-cargo-staging-20261108T143111Z` |
| Producción | `20261108143204` | 2026-11-08T14:32:04.484Z | `apply-0518-dtd-cargo-20261108T143201Z` |

El archivo `0518_noticias_publicacion_automatica.sql` tiene md5
`c692dfa9c4ad31e3352721400c3e3ceb` y 44.672 bytes. La espera se retiró y la migración se selló
en la PR #463; el registro del cierre está en
[`.agents/handoffs/cierre-migraciones-20261108.md`](../../../.agents/handoffs/cierre-migraciones-20261108.md).
El interruptor sigue apagado: encenderlo es otro OK de Sam.

**El conteo de noticias con marca se hace con la misma expresión que el CHECK.** El CHECK
`news_posts_sin_marca_verificar` es NOT VALID. La consulta que figuraba en la espera de la 0518
buscaba con una expresión regular en el título, el cuerpo y el extracto. Esa consulta:
- no miraba `meta_description`;
- no normalizaba con NFKC;
- no quitaba los caracteres invisibles.

Mide menos que el CHECK y no sirve para decidir un `VALIDATE CONSTRAINT`. Antes de validarlo,
se cuenta (solo el número, sin filas) con la función de la 0518:

```sql
select count(*) from public.news_posts
 where published
   and (public.news_texto_tiene_marca(title)
        or public.news_texto_tiene_marca(body_markdown)
        or public.news_texto_tiene_marca(excerpt)
        or public.news_texto_tiene_marca(coalesce(meta_description, '')));
```

Si da más de 0, el `VALIDATE` falla. Esas noticias se corrigen antes, con decisión de Sam. Una
migración que valide el CHECK lleva este conteo en su preflight y aborta si da más de 0.

### 11.3 Ajustes antes de encender: decisiones de Sam y migración 0525

Las revisiones de la #417 dejaron dos preguntas, y Sam las decidió el 2026-11-08. Las
transmitió el Subdirector:

- **C2 · borrar un usuario que creó el borrador de una noticia automática.** Sam respondió
  «Quedan sin autor». `seo_drafts.created_by` pasa a `on delete set null` y deja de ser NOT
  NULL. Antes, borrar a esa persona en Auth fallaba, porque la cascada de la 0053 chocaba con
  la FK `no action` de `news_posts.seo_draft_id`.
- **Punto 13 · una noticia automática que edita una persona.** Sam respondió «Sí, sigue
  contando». La noticia sigue siendo automática y cuenta en el tope semanal de F7. Solo se
  recalcula `content_sha256`, y la guarda de origen no cambia.

La migración `0525_noticias_ajustes_antes_de_encender.sql` aplica esas dos decisiones y suma
dos ajustes más:
- `news_salida_motivo` exige un motivo de la lista cerrada, y la nota cuando el motivo es
  «otro», igual que `news_retirar`;
- anon pierde EXECUTE sobre `news_texto_tiene_marca` y `news_huella`.

Nace sin aplicar y declarada como espera. Aplicarla pide el OK de Sam nombrando el archivo, y
no enciende nada.

**Cambio de comportamiento en el Studio cuando se aplique:**
- `news_salida_motivo` rechaza con 22023 un motivo nulo, uno fuera de la lista y «otro» sin
  nota;
- si una persona edita el texto de una noticia automática, el disparador reescribe
  `content_sha256`.

#### 11.3.1 Datos personales (`revisar-datos-ve`)

- **(a) Alcance real de C2.** La FK nueva no distingue el tipo de borrador. Al borrar a una
  persona en Auth, **todos** sus `seo_drafts` quedan con `created_by` vacío: los de noticias
  automáticas, los manuales y los que nunca se publicaron.
  - Antes, la cascada de la 0053 los borraba todos. Ahora se conservan sin autor.
  - El uuid de la persona sale de esas filas; el contenido del borrador, que es trabajo de la
    empresa, queda.
  - Sam aprobó «Quedan sin autor» pensando en las noticias automáticas. **El OK de aplicación
    de la 0525 tiene que nombrar este alcance:** todos los borradores de la persona borrada
    quedan sin autor, no solo los de noticias automáticas.
- **(b) Retención del uuid sin FK.** Cuatro columnas de la 0518 guardan el uuid de una persona
  y **no tienen FK** a `auth.users`, así que lo conservan después de que esa persona se borre:
  - `news_post_exits.actor_id` (lo escriben los disparadores de salida, 0518:451 y :462);
  - `news_publication_audit.actor_id`;
  - `news_autopublish_settings.updated_by`;
  - `news_autopublish_settings_log.changed_by`.

  La 0525 no las toca. Se declaran **excepción temporal**:
  - IA-01 exige dejar quién publicó, retiró o encendió el interruptor, y un uuid sin la fila
    de Auth ya no se puede resolver a un nombre dentro de la base;
  - la excepción vence cuando Sam fije el plazo de retención de esas tablas (hallazgo 7 de
    [`privacidad.md`](privacidad.md));
  - ese plazo y su purga van en la PR del cron. Antes de encender, el plazo tiene que estar
    decidido.

#### 11.3.2 Allowlist exacta de la PR #492

Medida con `git diff --name-only origin/main...HEAD` después de traer `main` `2f3a77b7a`: 9
archivos. Ningún otro archivo entra en la PR.

| Archivo | Cambio |
|---|---|
| `lib/public/news-queries.ts` | Modificado (C1): las 4 lecturas de filas completas piden 18 columnas explícitas, sin `publish_via`, `seo_draft_id`, `content_sha256`, `created_by`, `tenant_id` ni `source` |
| `lib/public/__tests__/news-queries-columnas.test.ts` | Nuevo: la prueba de C1 y la prueba estática de que ninguna lectura de `news_posts` pide `*` |
| `supabase/migrations/0525_noticias_ajustes_antes_de_encender.sql` | Nuevo: la migración 0525, sin aplicar (cambio de comportamiento del Studio cuando se aplique) |
| `supabase/tests/0525_noticias_ajustes_antes_de_encender.test.sql` | Nuevo: contrato SQL de la 0525 |
| `lib/news/autopublicar/__tests__/noticias-0525.migration.test.ts` | Nuevo: el contrato en PGlite, el control rojo y los mutantes |
| `supabase/migrations-baseline.json` | Modificado: espera de la 0525 en `pendingBelowCutoff` |
| `__tests__/seo-auditoria-json-ld.test.tsx` | Modificado: `elementosJsx` salta cadenas y cuenta los usos de verdad |
| `docs/specs/0611-noticias-publicacion-automatica/spec.md` | Modificado (esta spec): §11.2 con la cita del OK y este §11.3 |
| `.agents/handoffs/sdd-0611-ajustes-antes-de-encender.md` | Modificado: el handoff de la tarea |

## 12. Allowlist exacta de la implementación (PR #417)

Medida con `git diff --name-only origin/main...HEAD` después de traer `main` `3c14715ad`: 32
archivos. Ningún otro archivo entra en la PR. Las PR siguientes dejan su allowlist en §11, como
la de la #492 en §11.3.2.

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/marketing/noticias-web/actions.ts` | Modificado: `publishPost` rechaza cualquier marca `[VERIFICAR` en el titular o el cuerpo (cambio de comportamiento del Studio); extracto y tiempo de lectura salen de `lib/news/derivados.ts` |
| `app/studio/(app)/marketing/noticias-web/__tests__/noticias-web-marcas-verificar.test.ts` | Nuevo: ocho formas de marca, la del titular y el control; en rojo antes del arreglo |
| `lib/news/score.ts` | Modificado: `verifyMarkers` usa `listarMarcas` y cuenta también la marca vacía (cambio de comportamiento del Studio) |
| `lib/news/derivados.ts` | Nuevo: `extraerExtracto` y `tiempoDeLectura`, sacados de `actions.ts` |
| `lib/news/autopublicar/marcas.ts` | Nuevo: detección de marcas con NFKC e invisibles |
| `lib/news/autopublicar/control.ts` | Nuevo: control determinista de líneas rojas (F5) |
| `lib/news/autopublicar/puntaje.ts` | Nuevo: puntaje y límites de §5.1 (F6) |
| `lib/news/autopublicar/ritmo.ts` | Nuevo: topes por día y semana en hora de Caracas (F7) |
| `lib/news/autopublicar/huella.ts` | Nuevo: huella SHA-256 del texto revisado (F3) |
| `lib/news/autopublicar/filtros.ts` | Nuevo: F1 a F10 con falla cerrada |
| `lib/news/autopublicar/aviso.ts` | Nuevo: textos de los avisos a `#noticias` |
| `lib/news/autopublicar/motivos.ts` | Nuevo: motivos de retiro y validación de la nota |
| `lib/news/autopublicar/__tests__/fixture.ts` | Nuevo: datos sintéticos de las pruebas |
| `lib/news/autopublicar/__tests__/filtros.test.ts` | Nuevo: un caso y un mutante por filtro |
| `lib/news/autopublicar/__tests__/piezas.test.ts` | Nuevo: límites, avisos y motivos |
| `lib/news/autopublicar/__tests__/noticias-0518.migration.test.ts` | Nuevo: contrato de la 0518 en PGlite, control rojo, mutantes SQL, gemelas TS/SQL y desarme |
| `lib/studio/news/autopublicar.ts` | Nuevo: orquestador `evaluarBorradorAutomatico`; ninguna ruta lo llama todavía |
| `lib/studio/news/__tests__/autopublicar.test.ts` | Nuevo: orquestador con base y Discord dobles |
| `supabase/migrations/0518_noticias_publicacion_automatica.sql` | Nuevo: migración 0518, sin aplicar al fusionar (aplicada el 2026-11-08, §11.2) |
| `supabase/tests/0518_noticias_publicacion_automatica.test.sql` | Nuevo: contrato SQL de la 0518 |
| `supabase/desarmes/` | Nuevo: el desarme de la 0518, único archivo nuevo de esa carpeta. Se nombra por la carpeta porque `spec-migration-refs.test.ts` toma todo nombre `NNNN_…` con extensión `.sql` como migración |
| `supabase/migrations-baseline.json` | Modificado: espera de la 0518 en `pendingBelowCutoff` |
| `docs/specs/0611-noticias-publicacion-automatica/spec.md` | Modificado (esta spec): estado, §11.1 y esta allowlist |
| `docs/specs/0611-noticias-publicacion-automatica/privacidad.md` | Nuevo: revisión `revisar-datos-ve` |
| `docs/specs/README.md` | Índice regenerado con `pnpm docs:index` |
| `docs/governance/README.md` | Modificado: nota de la excepción a IA-01, aprobada y sin vigencia hasta encender |
| `docs/legal/privacidad/inventario-terceros.md` | Modificado: fila de Discord con `#noticias` |
| `docs/marketing/agente-seo-noticias.md` | Modificado: §9, la regla que manda |
| `docs/organizacion/oficina-conocimiento/02-reglas-de-la-oficina.md` | Modificado: §9, la excepción para noticias |
| `docs/organizacion/oficina-conocimiento/06-noticias.md` | Modificado: §9, lo que vale hoy |
| `docs/organizacion/plan-maestro-oficina.md` | Modificado: §9, §7.8 y la fila de `#noticias` |
| `.agents/handoffs/sdd-0611-implementacion.md` | Nuevo (handoff de la tarea) |
