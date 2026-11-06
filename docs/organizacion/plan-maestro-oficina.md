# Plan maestro de la oficina de agentes de DTD Cargo

> Para el **Hermes director** (perfil `director`, con llave de Junta temporal) y para Sam.
> Revisión documental del 2026-10-20. Fuente de estado: el
> [handoff de instalación](../../.agents/handoffs/2026-10-20-sdd-0564-vps-opencode.md),
> incluido su cierre hasta las 14:48 UTC, y
> [SDD-0564 D11](../specs/0564-instalacion-piloto-paperclip-hermes/spec.md).
> No se consultó el VPS ni Paperclip en esta revisión: el estado vivo es **NO VERIFICADO**.
> Este documento no autoriza repetir operaciones ya registradas ni ejecutar las pendientes.
>
> **Actualización del 2026-11-05 ([SDD-0605](../specs/0605-oficina-reestructura/spec.md)).**
> Sam aprobó una reestructura: 13 agentes, marketing por plataforma, un Revisor, la Vigía de
> mejoras, un modelo por perfil y Discord en lugar de Telegram. Está en la
> [sección 7](#7-reestructura-del-2026-11-05-sdd-0605). Las secciones 1 a 6 conservan el
> registro del 2026-10-20 y siguen valiendo como historia y como reglas; donde la sección 7
> las cambia, lo dice. **Nada de la sección 7 está ejecutado.**
>
> **Resolución 3.1 del 2026-11-06.** Sam ajustó el plan al configurar Paperclip: ALFRED pasa a
> Claude Code, entra el **Auxiliar de ALFRED** (son **14 agentes**), todas las subtareas van
> con GLM en Hermes y no se actualiza Paperclip a la versión 1023 ni Hermes a 0.22.4 o más.
> Está en §7.2, §7.5, §7.7 y §7.8; la fuente es la
> [resolución 3.1 en el handoff de la SDD-0605](../../.agents/handoffs/sdd-0605-oficina-reestructura.md#anexo-resolución-31-del-2026-11-06).
>
> **Contexto que debes leer antes de actuar**, todo de solo lectura en el VPS:
>
> | Archivo | Qué es |
> |---|---|
> | `/srv/oficina/diseno/organigrama-paperclip.md` | El organigrama aprobado: puestos, quién es persona y quién agente, olas, reglas, riesgos |
> | `/srv/oficina/diseno/01-organigrama-dtd-cargo.svg` | El gráfico del organigrama |
> | `/srv/oficina/diseno/hermes-oficina.md` | Cómo funcionan Hermes y Paperclip juntos: perfiles, memoria, skills, controles |
> | `/srv/oficina/diseno/sdd-0564.md` | La especificación aprobada de la instalación: accesos, topes, secretos, datos |
> | `/srv/oficina/diseno/agentes/` | Identidades (`SOUL`), contexto (`hermes.md`) e instrucciones de Paperclip por puesto |
> | `/srv/oficina/diseno/guia-continuar-con-hermes.md` | Cómo trabaja Sam y lo pendiente fuera de Paperclip |
> | `/srv/oficina/conocimiento/` | La biblioteca de la empresa: empresa, voz, reglas, norte interno |
> | `/srv/oficina/trabajo/ceo/estrategia-90-dias.md` | La estrategia de ALFRED, aprobada por Sam con ajustes |

## 1. Qué quedó documentado

| Pieza | Estado |
|---|---|
| Empresa «DTD Oficina» (id `9e183be0-4269-4dba-9dd9-7e5cef57c7c2`) | El handoff registra tope 100 USD/mes y aprobación obligatoria de agentes nuevos. Su estado y la parada efectiva no se volvieron a verificar |
| Meta de empresa | «Pasar de 1 a 2 contenedores al mes, sostenido» (`80911124-…`) |
| **ALFRED**, CEO (`07f7ba5c-…`) | Registrado activo, Hermes, perfil `ceo`. Rutinas documentadas: latido diario a las 7:00 y parte del viernes a las 14:00 (America/Caracas) |
| Jefe de gabinete, Puente de ingeniería, Editor de contenido | Registrados activos. Hermes, perfiles `gabinete`, `ingenieria` y `contenido`; reportan a ALFRED |
| Asesor comercial, Analista de operaciones, Analista de CRM/datos, Community manager asistente | El cierre registra las cuatro contrataciones correctas y sus perfiles `asesor`, `operaciones`, `crm`, `community`. No volver a solicitarlas por seguir este plan |
| Estrategia de 90 días (HAI-6) | Escrita por ALFRED y aprobada por Sam con dos ajustes |
| Agentes de prueba y ALFRED viejo (`claude_local`) | El handoff registra al ALFRED viejo pausado y deja la limpieza pendiente por elemento. Comprobar el estado antes de cualquier acción; no borrar ni reactivar por esta lista |

**Cómo corre cada agente:**
- comando `/usr/local/bin/dtd-hermes`, que lo ejecuta como `agentes-run`; la prueba histórica
  negó acceso a secretos del usuario `agentes`. No demuestra aislamiento de secretos entre
  perfiles del mismo `agentes-run`;
- `env.DTD_PERFIL` elige su perfil de Hermes, con su propia memoria, skills y `SOUL`;
- su carpeta es `/srv/oficina/trabajo/<perfil>`, con git local;
- modelo `glm-5.3` con el proveedor `zai`, por el plan GLM Coding de Sam.

## 2. Plantilla de solicitud de contratación ordinaria

Sirve para preparar la solicitud dentro del alcance aprobado por la Junta; la contratación
sigue pendiente hasta que Sam la apruebe. Primero se comprueba que el puesto no tenga ya un
agente correcto. El envoltorio evita el fallo histórico de ejecución como `agentes`;
no convierte los perfiles de `agentes-run` en usuarios aislados entre sí.

```json
{
  "name": "<Nombre del puesto>",
  "role": "general",
  "title": "<Nombre del puesto>",
  "adapterType": "hermes_local",
  "reportsTo": "07f7ba5c-3486-4b5d-9589-b0bdef2762ff",
  "budgetMonthlyCents": 2000,
  "runtimeConfig": {"heartbeat": {"enabled": false, "wakeOnDemand": true, "cooldownSec": 10, "intervalSec": 300, "maxConcurrentRuns": 1}},
  "adapterConfig": {
    "hermesCommand": "/usr/local/bin/dtd-hermes",
    "model": "glm-5.3", "provider": "zai",
    "persistSession": true, "timeoutSec": 1200, "graceSec": 20, "maxTurnsPerRun": 60,
    "cwd": "/srv/oficina/trabajo/<perfil>",
    "env": {"DTD_PERFIL": "<perfil>"},
    "toolsets": "file,terminal,memory,session_search,skills,todo"
  }
}
```

- **Dónde se envía:** `POST $PAPERCLIP_API_URL/companies/<empresa>/agent-hires`. Queda «pending»
  hasta que Sam apruebe.
- **Herramienta `web`:** solo se agrega (`,web`) a quien investiga internet: contenido y
  community. Para los perfiles nuevos, el
  [plan de entrenamiento §2](oficina-agentes/entrenamiento.md#2-quién-necesita-internet)
  **propone** sumarla a `tiktok`, `youtube`, `seo` y a `ingenieria` solo para la Vigía de
  mejoras; lo decide Sam en cada contratación, y cada perfil con web exige aprobar su memoria
  a mano.
- **Perfiles ordinarios registrados:** `ceo`, `gabinete`, `ingenieria`, `contenido`, `asesor`,
  `operaciones`, `crm` y `community`. Cada uno corresponde a su agente; no son perfiles libres
  para reutilizar en otra contratación.
- **Fuera de la contratación ordinaria:** `director`, perfil de configuración con la llave
  temporal de Junta descrita en D11, y `telegram`, cuya continuación es separada. Ninguno puede
  usarse como sustituto de un perfil ordinario.
- **Perfiles previstos por la reestructura del 2026-11-05, todavía sin crear:** `revisor`,
  `director-contenido`, `seo`, `tiktok` y `youtube` (§7.2). Su identidad ya está versionada en
  [`oficina-agentes/`](oficina-agentes/README.md); eso no los crea en el VPS.
- **Modelo y proveedor:** la plantilla muestra `glm-5.3` con `zai`, que es lo que usan hoy
  todos los perfiles. La reestructura cambia el modelo de cuatro perfiles (§7.5); ese cambio
  se hace en el perfil de Hermes y está pendiente.
- **Perfil nuevo:** lo crea una persona con acceso al VPS (Claude o el Director), no Hermes. Sin
  perfil **no se contrata**.
- **Después de aprobado:** se carga su `AGENTS.md` con
  `PUT /agents/<id>/instructions-bundle/file` y `baseRevisionId` de la versión actual. El texto
  sale de `/srv/oficina/diseno/agentes/AGENTS-paperclip.md`: la parte común más la del puesto.

## 3. Comprobaciones de continuación

Primero se contrasta el registro con la API, dentro de un encargo de lectura. Solo después se
proponen cambios concretos que sigan pendientes. Las autorizaciones históricas no son órdenes
de repetición. **Nunca apruebas nada por Sam.**

### Comprobación 1 · Equipo de la ola 1 (8 agentes documentados)

1. Contrastar los agentes correctos y los duplicados con los identificadores del cierre (§3,
   comprobación 5). El handoff dice que Sam aprobó los duplicados y después se pausaron; no que
   las solicitudes fueran rechazadas.
2. Comprobar las cuatro correspondencias registradas, sin crear nuevas solicitudes:

   | Puesto | Perfil | Extra |
   |---|---|---|
   | Asesor comercial | `asesor` | — |
   | Analista de operaciones | `operaciones` | — |
   | Analista de CRM/datos | `crm` | — |
   | Community manager asistente | `community` | con `,web` |

3. Si falta un agente o su estado difiere, informar a Sam; no recrearlo automáticamente.
4. Revisar que las instrucciones conservan sus límites:
   - el Asesor **prepara** la lista diaria y los borradores, y **nunca** escribe a clientes;
   - el de CRM **planifica y verifica**, y **nunca** entra a Kommo ni a GoHighLevel;
   - el de Operaciones documenta el piloto y alimenta los SOP;
   - el Community trabaja en borradores pendientes de Marketing.
5. Comprobar que las instrucciones de ALFRED contienen el comando, el perfil propio y las
   exclusiones de §2. La corrección de esta fuente en Git no actualiza Paperclip.
6. Registrar el estado de `prueba-opencode` y `prueba-hermes`; una limpieza necesita su propio
   alcance autorizado.

### Comprobación 2 · Proyectos y trabajo de la estrategia

El plan original propuso **un proyecto por meta**, ligado a la meta de la empresa, con espacio
de trabajo propio. No hay evidencia aquí que certifique su configuración actual. Esta tabla
conserva las metas y primeras tareas propuestas; no ordena crearlas de nuevo:

| Meta | Responsable | Primera tarea (sale de la estrategia) |
|---|---|---|
| 1 · Embarque piloto en el ERP: facturado, cobrado y costeado | Analista de operaciones + Puente de ingeniería | Checklist del piloto: quién carga cada dato |
| 2 · Dueño humano en las 5 direcciones | Jefe de gabinete | Tabla de las 5 direcciones con candidato y vacíos |
| 3 · 6 de 18 SOP | Jefe de gabinete + Analista de operaciones | Priorizar los 6 SOP y su esqueleto |
| 4 · Lista diaria y 0 leads sin atender | Asesor comercial | Formato de la lista diaria y su origen |
| 5 · Ritual del viernes 4 semanas | ALFRED | Ya está en la rutina del viernes |
| 6 · Migración Kommo → GoHighLevel | Analista de CRM + Puente de ingeniería | Plan de migración con inventario y verificación (Sam aprueba antes de ejecutar) |

Antes de proponer estructura o tareas nuevas, comparar con lo existente y la decisión vigente
de Sam. El reparto posterior corresponde a ALFRED dentro de esa decisión.

### Comprobación 3 · Revisión de entregables

- El diseño prevé **revisión por ALFRED** (`executionPolicy`, revisor agente) antes de cerrar
  tareas que producen SOP, borradores o pedidos. Su configuración actual es **NO VERIFICADA**.
  Nadie se revisa a sí mismo.
- Lo que va hacia afuera (textos a clientes, publicaciones) lleva además **aprobación humana**:
  la de Sam o la del dueño humano del puesto.

### Comprobación 4 · Ciclo completo

- Revisar el parte existente; esta lista no pide adelantar otro ni crea una tarea.
- Confirmar que el parte trae los cuatro bloques:
  1. avance por meta;
  2. atrasos;
  3. memorias y skills nuevas de cada agente;
  4. un solo lote de decisiones con ⭐.
- Entregarle a Sam el resumen y la lista de decisiones.

### Comprobación 5 · Cierre de la configuración

- Dejar a Sam un informe final:
  - agentes activos con su perfil, tope y jefe;
  - proyectos y rutinas;
  - pendientes que no son de Paperclip (§5).
- El handoff ya registra revocadas las dos llaves sobrantes «paperclipai cli (board)»:
  `de189091` y `e619f8d0`. No repetir las revocaciones por seguir una versión antigua del plan.
  La vigencia y revocación de `hermes-director` al terminar siguen pendientes de comprobación
  por Sam; el vencimiento registrado es 2026-10-27 13:37 UTC.
- **Duplicados pausados**: 2c4e223f, 88f167e4, 6035783c y 1a6b7d65 son contrataciones de ALFRED
  sin aislamiento. No se usan, no se reactivan y no se les asignan tareas. Los buenos son
  3ad1b6a9, 7714d984, 7e1b14c0 y d07161e2.

## 4. Lo que viene después (no es parte de esta configuración)

| Ola | Agentes | Condición para empezar (organigrama §4.4) |
|---|---|---|
| **2** | Vigía de tránsito, Analista de embudo, Controller de cobro y cuadres, Analista de crecimiento, Oficial de cumplimiento, Analista de datos | Un tablero de indicadores **agregados** del ERP, de solo lectura y sin datos personales: una SDD nueva con `revisar-datos-ve`. Además, 4 semanas de la ola 1 dentro del presupuesto. El Analista de embudo espera el corte a GoHighLevel |
| **3** | Postventa, documental de aduana, conciliación de calidad | Se construyen **dentro del ERP** (agentes del Studio), no en Paperclip |

Con 8 agentes la ola 1 queda llena: no se contrata a nadie más sin decisión de Sam.

**Actualización del 2026-11-05.** Esa decisión llegó: Sam aprobó una estructura de 13 agentes
(§7.2). Los cinco nuevos no son de las olas 2 ni 3: son el Revisor y el subgrupo de
marketing. Si los 13 caben en el tope de 100 USD al mes sigue pendiente (§7.8), y cada
contratación sigue pasando por la plantilla de §2 y por la aprobación de Sam.

**Resolución 3.1 (2026-11-06).** Entra un agente más, el Auxiliar de ALFRED: la estructura pasa
a 14 (§7.2). Las contrataciones las crea Sam en la pantalla de Paperclip con una hoja de alta,
porque una llave de agente no puede fijar el comando, la carpeta ni el entorno del agente.

## 5. Pendientes fuera de Paperclip (Hermes no puede)

| Pendiente | Quién |
|---|---|
| Revisar e integrar la documentación de #306; D11 ya está incorporada | Director |
| Decidir la actualización del diseño e instrucciones del VPS después de integrar; esta corrección no los publica | Director / Sam |
| Verificar vigencia y recuperación del respaldo diario registrado en el handoff | Persona con encargo y acceso al VPS |
| Perfiles nuevos y fijar o revertir skills (`hermes curator`) | Claude o el Director |
| Manifiesto de la copia filtrada: cumplimiento de todas las exclusiones **NO VERIFICADO** | Director |
| Corregir la sección 29 de Kommo v7: el seguro es «próximamente» | Sam |
| Revocar la llave de Anthropic que no se usa | Sam |
| Revocar las llaves de Junta al terminar | Sam |
| Comprobar el aislamiento de la llave de Junta frente a otros perfiles; continuación de Telegram en una PR separada después de #306 | Director / Sam |

## 6. Reglas que no se rompen

- **Tú no apruebas nada**: contrataciones, estrategia ni topes. Solo Sam, con su mano.
- No apagas la aprobación de agentes nuevos ni subes topes sin la orden explícita de Sam, escrita
  en el chat.
- No borras agentes, tareas ni proyectos sin un OK de Sam para ese elemento.
- No tocas el ERP, la base de datos, el servidor de DTD Cargo, Kommo ni GoHighLevel.
- No imprimes llaves ni secretos.
- Antes de cada cambio dices qué vas a hacer; después lo verificas por la API.

**Límite de seguridad documentado:** la llave temporal de Junta figura en
`profiles/director/paperclip.env`, modo `600`, dueño `agentes-run`. Todos los perfiles ordinarios
comparten ese usuario; elegir `HERMES_HOME` o no cargar la llave en su entorno no demuestra que
no puedan leerla. No se probó ese acceso en esta revisión documental. Falta una comprobación
específica de aislamiento, sin leer ni mostrar el valor de la llave; este texto no elige una
arquitectura nueva ni amplía la aceptación histórica del riesgo del Director a otros agentes.

## 7. Reestructura del 2026-11-05 (SDD-0605)

> Lo que Sam aprobó el 2026-11-05, pasado a este documento por la
> [SDD-0605](../specs/0605-oficina-reestructura/spec.md). Es un plan: **no hay perfiles
> nuevos, contrataciones, cambios de modelo ni canales de Discord creados por esta sección.**
> Quién es cada agente está en el [organigrama §9](organigrama-paperclip.md#9-reestructura-de-la-oficina-de-agentes-2026-11-05--sdd-0605);
> aquí va cómo y en qué orden se llega.

### 7.1 Estado y lo medido

| Pieza | Estado |
|---|---|
| Los 8 agentes de la ola 1 | Según los documentos del 2026-10-20 (§1). Estado vivo **NO VERIFICADO** |
| Hermes | v0.22.2, **medido el 2026-11-05** en solo lectura. Ya trae la conexión de Discord |
| Paperclip | v2026.1012.0, **medido el 2026-11-05** |
| Modelo de los perfiles | Los 10 perfiles usan GLM 5.3 y ninguno tiene Telegram ni Discord, **medido el 2026-11-05** |
| Canal de Sam | Sam no habla directo con ALFRED: habla con un perfil de recepción llamado `telegram`, que corre como servicio y le pasa los encargos a ALFRED por un puente propio. **Medido el 2026-11-05** |
| Servidor de Discord «DTD Cargo» | 12 miembros, medidos por la invitación pública. No se sabe quiénes son |
| VPS de la oficina | Tenía un reinicio pendiente al medirlo. Su mantenimiento es un paso aparte (§7.7) |

Lo medido es de esa fecha y no se repitió al escribir este documento.

### 7.2 Los 14 agentes y lo que le falta a cada uno

Eran 13 en la SDD-0605; la resolución 3.1 (2026-11-06) suma el Auxiliar de ALFRED y cambia
los motores de ALFRED, el Revisor, el Director de contenido y el Redactor.

| # | Agente | Perfil o carpeta | Qué hay que hacer | Necesita |
|---|---|---|---|---|
| 1 | ALFRED (CEO) | `ceo` | Pasarlo a Claude Code (`claude_local`) dentro de Paperclip, con el plan Max de Sam; el modelo lo elige Sam después (candidato: Claude Fable 5.1, esfuerzo `high`). Su perfil de Hermes `ceo` queda de respaldo y no se borra. Conectarlo a Discord; actualizar sus instrucciones con el equipo nuevo | Sam conecta su plan en la pantalla de conexiones de IA de Paperclip y cambia el motor; envoltorio `dtd-claude` (SDD pendiente) |
| 2 | Auxiliar de ALFRED | `auxiliar` (nombre de la carpeta por confirmar) | Crearlo y contratarlo con Codex (`gpt-6-astra`, esfuerzo `high`). Es el crítico de los planes de ALFRED (§7.5) | Sam conecta su ChatGPT Plus y crea el agente en la pantalla; envoltorio `dtd-codex` (SDD pendiente) |
| 3 | Revisor | `revisor` | Crear perfil, contratar con GLM en Hermes, ponerlo como etapa de revisión | Perfil nuevo; aprobación de Sam |
| 4 | Coordinador de procesos y seguimiento | `gabinete` | Renombrar el agente en Paperclip y cargar su identidad ajustada | — |
| 5 | Puente de ingeniería | `ingenieria` | Crearle la rutina semanal «Vigía de mejoras» (§7.4) | Darle una forma de leer las notas de versión |
| 6 | Director de contenido | `director-contenido` | Crear perfil y contratar con GLM en Hermes | Perfil nuevo; aprobación de Sam |
| 7 | Experto en SEO, GEO y AEO | `seo` | Crear perfil y contratar | Perfil nuevo; la salida de temas del Studio para trabajar con datos reales |
| 8 | Experto en TikTok | `tiktok` | Crear perfil y contratar, en su turno | Perfil nuevo |
| 9 | Experto en YouTube | `youtube` | Crear perfil y contratar, en su turno | Perfil nuevo |
| 10 | Experto en Instagram y Facebook | `community` | Renombrar el agente y cargar su identidad | — |
| 11 | Redactor de noticias | `contenido` | Renombrar el agente y cargar su identidad ajustada. Sigue en GLM | — |
| 12 | Asesor comercial | `asesor` | Nada | — |
| 13 | Analista de CRM/datos | `crm` | Nada | — |
| 14 | Analista de operaciones | `operaciones` | Nada | — |

Para cada perfil nuevo vale la regla de §2: lo crea una persona con acceso al VPS, y sin
perfil no se contrata. **Cada contratación la crea Sam en la pantalla de Paperclip**, con una
hoja de alta: una llave de agente no puede fijar `command`, `cwd` ni `env` (ALFRED recibió un
403 el 2026-11-06 al intentar contratar al Director de contenido, y está bien que así sea).
Después de aprobado se carga su `AGENTS.md`. Las instrucciones de Paperclip de los puestos
de Hermes están en [`oficina-agentes/AGENTS-paperclip.md`](oficina-agentes/AGENTS-paperclip.md);
las de ALFRED en Claude Code y las del Auxiliar las escribe la SDD de los envoltorios
`dtd-claude` y `dtd-codex`, **pendiente**.

### 7.3 Orden de entrada de los expertos

Recomendación del plan, **pendiente** de que Sam la confirme o pida todos de una vez:

1. **Instagram y Facebook:** ya existe el agente y es el canal principal.
2. **SEO, GEO y AEO:** junto con el primero.
3. **TikTok:** después.
4. **YouTube:** cuando haya un ritmo de videos que sostenerle.

El Director de contenido entra antes o junto con el primer experto, porque es quien reparte
(**INFERIDO**: el plan no le pone turno). Entrar por turnos cuida la atención de Sam: cada
agente trae identidad, entrenamiento, revisión de lo que aprende y más cosas que aprobar.

**Entrenamiento de cada agente que entra:**

- **Biblioteca** ([`oficina-conocimiento/`](oficina-conocimiento/README.md)): ya trae
  marketing, SEO/GEO/AEO, noticias y el catálogo «quién hace qué».
- **Identidad** ([`oficina-agentes/`](oficina-agentes/README.md)): su `SOUL.md`, con lo que
  hace y lo que nunca hace.
- **Skills:** las fija con aprobación durante sus primeras dos semanas.
- **Pregunta de control** al contratarlo: «¿qué no puedes hacer nunca?».

### 7.4 Vigía de mejoras

- **Qué es:** una rutina semanal del Puente de ingeniería que lee las novedades de Hermes y
  Paperclip.
- **Qué entrega:** un resumen en el canal de actividad de la oficina y en el parte del
  viernes, con cuatro partes: qué salió, qué arreglaron, qué nos sirve y para qué, y si hay
  avisos de seguridad.
- **Qué no hace:** actualizar. No toca versiones, llaves ni configuración.
- **Cómo se actualiza cuando la Vigía avisa:** una persona, con respaldo, y primero en una
  instancia de pruebas de Paperclip en el mismo VPS, en otro puerto y sin los agentes reales.
  Antes se leen las notas de la versión, para aprovechar lo nuevo y para ver qué puede romper
  el aislamiento.
- **Primer caso:** al medir el 2026-11-05 había versiones más nuevas de las dos piezas que las
  instaladas. Decidir si se actualiza es parte del mantenimiento del VPS (§7.7, paso 3).
- **Lo que no se sube todavía (resolución 3.1, 2026-11-06):** Paperclip v2026.1023.0, porque
  bloquea el uso sin precio (`unpricedUsagePolicy: block`) y congelaría a los agentes de Hermes,
  cuyo gasto Paperclip no mide, y porque tiene abierto un problema que congela la empresa
  (#18956 de Paperclip); y Hermes 0.22.4 o más, porque un problema abierto impide reanudar
  sesiones (#18314 de Hermes). La Vigía lo vuelve a mirar cuando salgan versiones nuevas.

### 7.5 Un motor y un modelo por agente

**Resolución 3.1 (decisión de Sam, 2026-11-06).** Reemplaza el reparto de la SDD-0605, que
ponía a ALFRED en Fable dentro de Hermes, al Director de contenido y al Redactor en Sonnet y al
Revisor en Codex. Ahora **todas las subtareas van con GLM en Hermes** y solo cambian ALFRED y
su Auxiliar:

| Agente | Motor en Paperclip | Modelo | Cómo se paga |
|---|---|---|---|
| ALFRED (CEO) | Claude Code (`claude_local`), con el envoltorio `dtd-claude` | Lo elige Sam después; candidato: Claude Fable 5.1, esfuerzo `high` | Plan Max de Anthropic de Sam, conectado por él en la pantalla de conexiones de IA de Paperclip |
| Auxiliar de ALFRED | Codex, con el envoltorio `dtd-codex` | `gpt-6-astra`, esfuerzo `high` | ChatGPT Plus de Sam, conectado igual |
| Los otros doce, incluidos el Revisor, el Director de contenido y el Redactor | Hermes, con `dtd-hermes` | GLM 5.3 | Plan fijo de Z.AI, como hoy |

**El ciclo de ALFRED y el Auxiliar:**

1. ALFRED instruye: escribe un documento `plan` en la tarea.
2. El Auxiliar critica: escribe un documento `critica` y deja una tarjeta
   `request_confirmation`. **No bloquea:** ALFRED puede seguir sin esperar.
3. ALFRED reestructura el plan, **como máximo dos vueltas**.
4. Los agentes de GLM ejecutan como subtareas hijas.

La decisión final es de ALFRED. El Auxiliar no reemplaza al Revisor: el Auxiliar critica el
plan antes de repartir; el Revisor comprueba cada entregable antes de que llegue a Sam.

**Condiciones:**

- **El riesgo de usar las suscripciones de Sam lo asumió Sam** al decidirlo; él conecta sus
  planes en Paperclip. Esto sustituye la condición anterior de «llave propia de la oficina con
  límite en el proveedor» para ALFRED y el Auxiliar.
- **GLM sigue en Hermes** aunque Hermes no figure en la lista de herramientas del plan de Z.AI;
  Sam lo aceptó.
- **Aislamiento:** `dtd-claude` y `dtd-codex` siguen la misma regla que `dtd-hermes`: cada
  agente corre en `/srv/oficina/trabajo/<perfil>` con `DTD_PERFIL`. Los describe la SDD de los
  envoltorios, **pendiente** (la escribe la sesión que configura Paperclip).
- **Paperclip no registra el gasto de Hermes,** así que su tope no frena a los doce de GLM; el
  freno es el plan fijo de Z.AI.
- La llave de Anthropic que §5 pide revocar sigue siendo otra: no se usa para esto.

**Pendiente:** que Sam elija el modelo de ALFRED y la prueba con tres tareas reales
([entrenamiento §4](oficina-agentes/entrenamiento.md#4-qué-se-mide)). Kimi K3 sigue como candidato para los
expertos que tengan que mirar videos o miniaturas, con prueba previa. DeepSeek queda fuera.

### 7.6 Discord como central única

**Decisión de Sam (2026-11-05):** Discord reemplaza a Telegram para hablar con los agentes y
para todos los avisos. Servidor «DTD Cargo». Todo lo que sigue funciona en el plan gratis de
Discord.

#### Qué avisa hoy por Telegram

| Origen | Qué manda | Cómo |
|---|---|---|
| Oficina (Hermes) | La conversación de Sam con el perfil de recepción y sus reportes | Conexión de Telegram de Hermes |
| Studio | 5 categorías: registro de clientes, conversaciones del portal, bugs, reporte diario y otros avisos al equipo | `lib/studio/telegram/alert-routing.ts`: categoría → destinos, configurable en Ajustes › Alertas de Telegram |
| Studio, por persona | Avisos al asesor asignado y a quien reportó un bug | Chat de Telegram enlazado en el perfil de cada usuario |
| Servidor de producción | Publicaciones de la web y vigilancia de salud | `infra/ops/web/publicar-web.sh` y la herramienta de vigilancia |
| CRM anterior | Su propio bot | Se retira con ese CRM; no se migra |

#### Un bot y varios avisos automáticos

- **Bot:** para conversar. Solo uno: ALFRED, conectado por Hermes. Menos bots es menos llaves
  que cuidar.
- **Aviso automático de canal:** para publicar sin conversar. No requiere crear un bot: se
  genera desde los ajustes del canal y cada uno lleva su propio nombre y foto. Solo puede
  escribir en su canal: no lee ni recibe órdenes.

**Camino para la oficina:** cambiar la conexión del mismo perfil de recepción de Telegram a
Discord, para conservar su memoria y el puente con ALFRED, y cambiar el puente para que
devuelva los avisos a Discord. El puente no aprueba ni publica nada: solo crea tareas para
ALFRED, comenta y consulta. Su código no está en el repositorio; versionarlo es un pendiente
aparte.

#### Canales

| Categoría | Canal | Quién escribe |
|---|---|---|
| Oficina | `#alfred` | Sam y ALFRED. Cada pedido abre su propio hilo |
| Oficina | `#decisiones` | ALFRED: lo que espera la aprobación de Sam |
| Oficina | `#actividad-oficina` | Paperclip: tarea asignada, terminada, agente con error |
| Oficina | `#parte-semanal` | ALFRED: el parte del viernes |
| Operación | `#registro-clientes` | Studio |
| Operación | `#conversaciones-portal` | Studio |
| Operación | `#bugs` | Studio |
| Operación | `#reporte-diario` | Studio |
| Operación | `#avisos-equipo` | Studio |
| Servidor | `#publicaciones` | Script de publicación |
| Servidor | `#salud` | Herramienta de vigilancia y avisos de correo |

Las cinco de Operación calzan una a una con las categorías que el Studio ya tiene.
`#actividad-oficina` se alimenta con una extensión propia de Paperclip que escucha sus
eventos y publica por un aviso automático: es de una sola vía.

#### Roles: quién ve qué

| Rol | Para quién | Oficina | Operación | Servidor |
|---|---|---|---|---|
| Dirección | Sam | Ve y escribe | Ve y escribe | Ve y escribe |
| Atención | Quien atiende clientes | No ve | Ve `#registro-clientes`, `#conversaciones-portal`, `#avisos-equipo` y `#reporte-diario` | No ve |
| Técnico | Quien resuelve fallas | No ve | Ve `#bugs` | Ve todo |
| Recepción (bot) | El bot de la oficina | Ve y escribe | No ve | No ve |
| Todos los demás | El resto de miembros | No ve | No ve | No ve |

Cómo se configura, en este orden:

1. Crear los roles Dirección, Atención y Técnico, sin permisos de administración.
2. Crear las tres categorías como **privadas**: en cada una, negar «Ver canal» a todos y
   permitirlo solo a los roles de la tabla.
3. Crear los canales dentro de su categoría y dejarlos sincronizados con ella; solo `#bugs`
   lleva un permiso propio para Técnico.
4. En Operación y Servidor, quitar «Enviar mensajes» a Atención y Técnico: son canales de
   avisos, no de conversación.
5. Gestionar avisos automáticos, canales y roles queda solo en Dirección.
6. El bot recibe su rol sin permisos de administrador y solo con acceso a la categoría
   Oficina.
7. Comprobar con «Ver servidor como rol» que cada rol ve lo que dice la tabla, y con una
   cuenta sin rol que no ve nada.
8. Activar la verificación en dos pasos para acciones de moderación.

**Arranque (decisión de Sam, 2026-11-05): solo Sam.** Los tres roles se crean, pero al inicio
solo los tiene Sam. Después Sam nombra a dos personas y decide qué ve cada una. Para que nadie
externo vea canales, hable con ALFRED ni vea avisos aunque entre al servidor:

- canales cerrados por defecto: sin rol no se ve ninguna de las tres categorías;
- el bot solo le responde a Sam, por lista de usuarios permitidos, también en mensajes
  privados;
- el bot solo aparece donde tiene acceso: la categoría Oficina;
- la invitación compartida deja entrar a cualquiera que la tenga y vence el 2026-12-05:
  conviene revocarla y dejar la creación de invitaciones solo en Dirección;
- comprobación final con una cuenta sin rol: no ve canales, no ve al bot y no recibe
  respuesta de él.

#### Reglas

- **Sin menciones por defecto:** un aviso automático no le suena a nadie. Solo lo crítico
  menciona un rol.
- **Un canal por tipo de aviso,** para que no se mezclen y nadie termine silenciando todo.
- **Lo de poco valor va resumido** una vez al día, no uno por uno.
- **La dirección de cada aviso automático es una llave:** quien la tenga puede escribir en el
  canal. Va en el gestor de secretos del servidor, nunca en el repositorio, y se cambia si se
  filtra.
- **La llave del bot vive en el VPS de la oficina,** con permisos mínimos.
- **Límites de Discord:** mensajes más cortos que los de Telegram, así que hay que recortar, y
  reintento cuando Discord pide esperar.
- **Avisos por persona:** en lugar de un chat privado, se menciona a la persona en el canal.
  Cada usuario del Studio enlaza su usuario de Discord en su perfil.
- **Discord es un servicio externo:** no se escriben ahí datos de clientes, montos ni llaves.

#### Privacidad

Discord pasa a ser un tercero que recibe datos, y los avisos del Studio llevan hoy datos de
clientes. Antes de migrar esos avisos:

- revisión con `revisar-datos-ve` y alta de Discord en
  [`docs/legal/privacidad/inventario-terceros.md`](../legal/privacidad/inventario-terceros.md),
  donde Telegram ya figura;
- los avisos llevan lo mínimo: código y enlace al Studio, no nombre, teléfono ni montos.

#### Cómo se migra sin perder un aviso

1. Sam crea los canales, los avisos automáticos y el bot de ALFRED, con una guía.
2. Oficina: Hermes pasa de Telegram a Discord y se cambia la instrucción de cada agente para
   que reporte ahí.
3. Studio, con SDD propia: el envío se generaliza a un «destino» de Telegram o de Discord,
   reutilizando el ruteo por categoría y la pantalla de Ajustes. Se conserva la regla actual:
   si una categoría no tiene destino, cae al respaldo en vez de callar.
4. Servidor: el script de publicación y la herramienta de vigilancia apuntan a
   `#publicaciones` y `#salud`.
5. **Corte directo, sin semana de doble envío** (decisión de Sam, 2026-11-05: «quitar Telegram
   de una vez»). En cada pieza, Telegram se apaga en el mismo paso en que Discord queda
   probado con un mensaje real de ida y vuelta. No se apaga antes, porque dejaría a Sam sin
   canal.
6. Las llaves de Telegram se retiran al cortar, y el código del Studio que ya no se use, en la
   misma SDD.

El paso 3 es código del Studio y solo llega a producción cuando Sam descongele la publicación
de la web. Los pasos 1, 2 y 4 no dependen de eso.

### 7.7 Orden de ejecución

Sam eligió **Discord primero**. La entrada al VPS de la oficina que usó la sesión del plan no
tiene permisos de administrador: no sirve para crear perfiles ni para actualizar.

| # | Paso | Dónde | Necesita de Sam |
|---|---|---|---|
| 0 | Discord primero: guía para crear el bot, estructura de canales y configuración de Hermes lista para aplicar | Discord y VPS de la oficina | Crear el bot, invitarlo y dar una entrada con permisos al VPS |
| 1 | Cerrar la fase A de SEO, GEO y AEO del sitio (SDD-0604, en su rama) | Repositorio | Lo que pida esa SDD |
| 2 | **Esta reestructura en documentos (SDD-0605)** | Repositorio, solo documentos | Hecho el 2026-11-05: confirmó los nombres y autorizó publicar. Queda la integración |
| 3 | Mantenimiento del VPS de la oficina: respaldo, Paperclip, decidir Hermes, reinicio y repetir la prueba de aislamiento. **Sin subir Paperclip a v2026.1023.0 ni Hermes a 0.22.4 o más** (§7.4, resolución 3.1) | VPS de la oficina | Autorizarlo y dar una entrada con permisos |
| 4 | Recorrido de Paperclip: tablero, panel en vivo, «qué necesita de mí», organigrama | Paperclip | Estar presente |
| 5 | Crear 5 perfiles, contratar y renombrar 3 agentes, por turnos | VPS de la oficina y Paperclip | Crear cada contratación en la pantalla de Paperclip con su hoja de alta |
| 5b | Pasar ALFRED a Claude Code y crear el Auxiliar con Codex (resolución 3.1), con los envoltorios `dtd-claude` y `dtd-codex` | Repositorio (SDD de envoltorios, pendiente), VPS de la oficina y Paperclip | Conectar sus planes en Paperclip, cambiar el motor de ALFRED, crear el Auxiliar y pegar las instrucciones |
| 6 | Discord como central: canales, bot de ALFRED, avisos de la oficina y del servidor | Discord y los dos VPS | Crear el bot, los canales y los avisos automáticos; dar acceso |
| 6b | Avisos del Studio a Discord: SDD propia, revisión de privacidad y corte directo de Telegram | Repositorio y producción | Aprobar la SDD y descongelar la publicación |
| 7 | Puertas del Studio y estado de revisión de noticias | Repositorio y producción | OK de la migración, cuenta de servicio y descongelar la publicación |
| 8 | Resumen semanal del CRM sin datos personales | Repositorio y producción | Aprobar la SDD con revisión de privacidad |
| 9 | Calendario, si hace falta | Extensión de Paperclip | Decidir tras el paso 4 |
| 10 | Oficina dibujada | Extensión de Paperclip | Decidir después de usar Paperclip unos días |
| 11 | Verificación de indexación y vigilancia de tráfico | Studio | Nada nuevo |

Los pasos 2, 3 y 4 no dependen entre sí. El 6 puede ir antes del 5 si Sam quiere estrenar
Discord con los agentes actuales.

### 7.8 Decisiones y pendientes

**Tomadas por Sam el 2026-11-05:**

- Esquema mixto: la oficina piensa; el Studio guarda datos, llaves, aprobación y publicación.
- Sam habla solo con ALFRED.
- Discord en lugar de Telegram, primero y con corte directo.
- Marketing como subgrupo con Director de contenido y expertos por plataforma.
- Un Revisor nuevo.
- Vigía de mejoras semanal; actualizar leyendo las notas y probando antes.
- Un modelo por perfil de Hermes. **Reemplazado el 2026-11-06** por el reparto de la
  resolución 3.1 (§7.5).
- Paperclip tal cual más Discord como oficina visual; la oficina dibujada se decide después.
- Arranque de Discord solo con Sam.
- Los nombres «Coordinador de procesos y seguimiento», «Revisor» y «Director de contenido»,
  confirmados al revisar la SDD-0605.
- Las noticias se publican solas, con filtros. No está vigente: necesita su SDD y el registro
  de la excepción a IA-01.

**Tomadas por Sam el 2026-11-06 (resolución 3.1):**

- ALFRED pasa a Claude Code con el plan Max de Sam; su perfil de Hermes `ceo` queda de
  respaldo.
- Entra el Auxiliar de ALFRED, crítico con Codex en el ChatGPT Plus de Sam: son 14 agentes.
- Todas las subtareas van con GLM en Hermes, incluidos el Revisor, el Director de contenido y
  el Redactor.
- El ciclo plan → crítica (no bloquea) → reestructura (máximo dos vueltas) → subtareas de GLM;
  la decisión final es de ALFRED.
- Sam asume el riesgo de usar sus suscripciones y conecta él sus planes.
- GLM sigue en Hermes aunque Hermes no figure en la lista de herramientas del plan de Z.AI.
- Las contrataciones las crea Sam en la pantalla; no se crea otra llave de Junta para
  `director`.

**Pendientes:**

1. **Tope de la oficina:** 14 agentes y el tope de 100 USD al mes.
2. **Orden de entrada de los expertos** (§7.3) o todos de una vez.
3. **Quién más está en el servidor de Discord «DTD Cargo».**
4. **Modelo de ALFRED** dentro del plan Max (§7.5); candidato: Claude Fable 5.1, esfuerzo
   `high`. Cómo pagar quedó resuelto el 2026-11-06.

### 7.9 Riesgos

- El aislamiento entre perfiles de Hermes no está verificado (§6). Por eso ninguna llave de
  producción vive en la oficina. ALFRED y el Auxiliar usan las suscripciones de Sam, un riesgo
  que Sam asumió el 2026-11-06.
- GLM a veces dice que guardó algo sin guardarlo; el Studio y el Revisor comprueban del otro
  lado.
- No se sabe si GLM redacta con la voz que Sam quiere. Con la resolución 3.1 el Redactor sigue
  en GLM: el Revisor lo mira y la prueba de tres tareas del entrenamiento lo mide.
- Hallazgos menores de la revisión de Paperclip del 2026-11-06, sin corregir todavía: el
  prompt de Hermes viaja por argumento, así que queda en el registro de `sudo` y se ve con
  `ps`; Hermes corre con `--yolo` y sin reglas `deny`; los subordinados pueden contratar y
  crear skills; y las skills de Paperclip no llegan a los perfiles de Hermes.
- Paperclip no registra el costo de Hermes: su tope no es el límite real.
- Una extensión de Paperclip corre con la sesión de la Junta, o sea con todo el poder de Sam.
  Las que hagan falta se escriben propias y se revisan; no se instalan de terceros.

### 7.10 Verificación por paso

| Paso | Cómo se comprueba |
|---|---|
| 2 | `pnpm docs:check` y `pnpm sdd:check`; ningún archivo de biblioteca trae nombres, montos ni datos de clientes |
| 3 | La versión decidida (no la v2026.1023.0) en la comprobación de salud de Paperclip, prueba de aislamiento repetida, los 8 agentes responden |
| 5 | Pregunta de control a cada agente nuevo: «¿qué no puedes hacer nunca?» |
| 6 | Una tarea de punta a punta desde `#alfred`; otro usuario del servidor no logra que el bot responda; `#actividad-oficina` refleja la corrida |
| 7 | El servidor rechaza publicar sin aprobación; la puerta de entrada no puede publicar ni leer |
| 8 | El resumen no trae nombres, teléfonos ni textos literales; prueba automática que lo exige |
| 10 | El estado de cada escritorio coincide con el de Paperclip en una corrida real |
