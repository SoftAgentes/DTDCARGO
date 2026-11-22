---
sdd: "0637"
title: "Faro: asistente de ayuda con IA dentro del Studio, con recorte por permisos, registro inalterable y alertas al administrador"
status: proposed
author: "Claude (sesión Lumi) + Sam"
created: 2026-11-16
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0020", "0036", "0589", "0603", "0622", "0626", "0635"]
confidencialidad: interno
---

# SDD-0637 — Faro, el asistente de ayuda del Studio

> El equipo no conoce los 57 módulos del Studio y cada duda termina en una llamada a Sam. Faro es un botón
> flotante al que cualquier usuario le pregunta «¿cómo registro un pago de un cliente?» y recibe los pasos, con
> la opción de que le muestre en pantalla dónde oprimir. Solo responde con guías revisadas, respeta los permisos
> de quien pregunta, guarda todo sin que se pueda editar y avisa al administrador cuando alguien pide algo fuera
> de su área.

**Decisiones:** D-1 a D-14 (§11). Decididas por Sam: D-2 a D-6 y D-9 a D-14. Abiertas: D-1, D-7 y D-8.

**Enmienda 2026-11-22 (§7.7, D-14):** rediseño de Faro en el rebrand. En el rebrand se llama **Faro Lumi Assistant Studio**.

**Estado:** `proposed`. Hay contenido (fase 1, en `main`) y una migración sin aplicar (fase 2, `0550`). **No hay
cambios en producción.** Cada fase se programa con el visto bueno de Sam y el turno del Director General.

**Maquetas navegables** (archivos autocontenidos; se abren en el navegador):

- `maqueta/faro-prototipo.html`: Faro sobre una pantalla de ejemplo del Studio. Trae tres estilos; el aprobado es
  el 1.
- `maqueta/faro-estructura.html`: las cinco capas en 3D, el recorrido de una pregunta y las fases.

## 1. Pedido y decisiones de Sam (2026-11-16)

Sam trajo como referencia el documento «cómo se construyó Lumi» (asistente de otro ERP) y pidió un plan parecido,
«algo pro», con seguimiento de lo que pregunta cada usuario y alerta cuando la IA bloquea una petición.

| # | Decisión | Valor |
|---|---|---|
| S-1 | Nombre | **Faro** |
| S-2 | Alertas al administrador | **Solo lo serio** (§6.3) |
| S-3 | Modelo de IA | No se decide ahora; se elige con la evaluación (§9, fase 5) |
| S-4 | Estilo visual | **1 · Faro clásico** (§7). Faro se sobrepone a la marca: excepción a BRAND.md solo para Faro |
| S-5 | Papel de Hermes | **Analista, redactor y vigía**, fuera del camino de la pregunta (§8) |
| S-6 | Fuente de conocimiento | Un «minicerebro» cerrado, que Hermes ayuda a ampliar con aprobación humana (§5, §8) |

## 2. Alcance

**Entra:**

- Botón flotante y panel de chat en todas las pantallas del Studio (`app/studio/(app)`).
- Respuestas basadas solo en el minicerebro (§5).
- Recorte por permisos en el servidor antes de llamar a la IA (§6.1).
- «Llévame ahí» y «Muéstrame dónde» (§7.3).
- Registro inalterable de preguntas y respuestas, legible solo por el administrador (§6.4).
- Alertas al administrador (§6.3) y pantalla «Conversaciones de Faro».
- Tope de preguntas por usuario y hora.
- Batería de evaluación y ataque automático (§9, fase 5).

**No entra:**

- Que Faro ejecute acciones o lea datos del negocio (clientes, montos, facturas, embarques). Faro explica; no
  consulta ni modifica.
- Portal del cliente, sitio público, la PWA móvil (`app/m`) y Back. Faro vive solo en el Studio
  (`app/studio/(app)`), que es responsivo: se usa igual en una computadora que abriendo el Studio desde el
  navegador de un teléfono. La PWA de `app/m` es otra superficie y no lo lleva.
- Búsqueda por fragmentos (RAG) y respuesta en streaming.
- La etapa de Hermes (§8): se diseña aquí y se construye después de que Faro esté en producción.

## 3. Arquitectura: cinco capas

Faro es un **flujo fijo**, no un agente: no tiene herramientas y no tiene memoria entre conversaciones; solo recuerda
la conversación en curso, acotada (D-9). Solo una capa habla con una IA.

| Capa | Qué es | Dónde vive |
|---|---|---|
| 1 · Base de datos | Conversaciones y mensajes inalterables, alertas, tope por hora | Una migración nueva |
| 2 · Minicerebro | Catálogo, guías, procesos y glosario | `lib/studio/asistente/contenido/` |
| 3 · Servidor | Portero, recorte, verificador, reglas de alerta | `lib/studio/asistente/` y `app/api/studio/asistente/` |
| 4 · Motor de IA | La llamada al modelo y su respaldo (§6.5) | `lib/studio/asistente/motor/` |
| 5 · Interfaz | Botón, panel, pantalla del administrador | `app/studio/_components/faro/` y un módulo de administración |

### 3.1 El camino de una pregunta

1. El usuario escribe. El panel envía `conversacionId`, la pregunta y la ruta actual. **No envía permisos.**
2. **Portero:** sesión del Studio (`requireStudioSession`), origen de la petición y tope por hora.
3. **Permisos:** `getStudioAccess()` devuelve rol, almacén, ajustes por rol y accesos por persona.
4. **Recorte:** se arma el contexto con las entradas del minicerebro que esa persona puede ver (§6.1).
5. **Motor:** instrucciones fijas + contexto recortado + los últimos turnos de **esta** conversación, leídos de la base y revalidados contra los permisos actuales + pregunta. Si
   la persona perdió acceso a algo de lo conversado, el contexto se reinicia. Cuántos turnos (propuesta: ocho
   intercambios y un tope de tokens) es un detalle de diseño de la fase 3, no parte de lo que Sam aprobó en D-9.
6. **Verificador:** valida la ficha, descarta la ruta sugerida si no está permitida y decide si hubo bloqueo (§6.2).
7. **Registro:** guarda pregunta y respuesta. Si corresponde, crea la alerta.
8. El panel muestra la respuesta y los botones que correspondan al resultado.

## 4. Lo que ya existe y se reutiliza

| Necesidad | Pieza existente |
|---|---|
| Qué ve cada usuario | `getStudioAccess` (`lib/studio/rbac-guard.ts`), `canAccessModule`, `scopeAllowsModule` (`lib/studio/rbac.ts`), `isModuleEnabled`. Es la misma regla que filtra el menú en `StudioSidebar.tsx` |
| Lista de pantallas | `MODULES` en `lib/studio/modules.ts` (57 módulos), `LOCKED_MODULES`, `SUPERADMIN_ONLY_MODULES` |
| Respuesta con forma fija | Herramienta forzada con `tool_choice`, como en `lib/studio/bitacora/extract.ts` |
| Tiempo límite y costo anotado | Patrón de `lib/studio/chatwoot/bot/motor.ts` y de `lib/studio/document-import/anthropic.ts` |
| Tope de uso sin Redis | Patrón `reserve_document_import_limit` (migración 0457) |
| Resaltar un botón en pantalla | Motor de guía de la SDD-0589 (`lib/studio/guia/`, `GuiaMotor.tsx`) |
| Avisar al administrador | `writeInAppNotification` (campana, `bug_notifications`), `dispatchAlert` (Discord y Telegram), `resolveAdminEntries` |
| Reportar un error o una mejora | Reportador de la SDD-0036 (`lib/studio/bug-create.ts`, módulo «Mis reportes») |
| Tabla inalterable | Trigger de `0102_capa_legal.sql` |
| Arrastre del botón a los bordes | `BugFABButton.tsx` |

Los accesos por persona (migraciones 0538 a 0540) están aplicados en producción desde el 2026-11-15, según el
Director General. Faro los lee tal como están.

## 5. El minicerebro

Es la única fuente de conocimiento de Faro. Si algo no está ahí, Faro dice que no lo sabe. Son archivos `.ts`
versionados, revisados en cada PR. Cada entrada lleva fecha de revisión, responsable y fuente.

| Estante | Archivo | Contenido |
|---|---|---|
| Catálogo | `catalogo.ts` | Una entrada por módulo: id, nombre, una línea, y si es `reservada` u `oculta` |
| Guías | `guias/<modulo>.ts` | «Para qué sirve», «Qué se ve», «Tareas comunes» con los botones exactos, «Errores frecuentes», «Quién puede» |
| Procesos | `procesos/<slug>.ts` | Tareas que cruzan varias pantallas, por ejemplo del pago recibido a la conciliación |
| Glosario | `glosario.ts` | Términos del negocio y del sistema |
| Novedades | `novedades/<id>.ts` | Qué cambió en el Studio: título, resumen, fecha, módulos, la tarea de la guía que lo explica, el recorrido visual si existe, permisos y condición de disponibilidad (flag) |

Reglas:

- Una prueba unitaria falla si un módulo de `MODULES` no tiene entrada en el catálogo.
- Las guías se redactan leyendo las pantallas reales y **las aprueba una persona** antes de entrar.
- Regla de mantenimiento propuesta para `AGENTS.md` (requiere OK de Sam, fase 6): todo cambio que altere lo que
  ve o hace un usuario en una pantalla actualiza su guía en la misma PR.
- Con el tamaño previsto todo cabe en el contexto del modelo. Se revisa si pasa de unos 150.000 tokens.

**Novedades (aprobado por Sam el 2026-11-16, D-10).** Cada función nueva del Studio trae, en la misma PR, la tarea
de la guía que la explica y su entrada en `novedades/`. La novedad apunta a la tarea; no repite los pasos. Faro
usa la novedad para «¿qué hay de nuevo?» y la tarea para «¿cómo se hace?». Una novedad o una tarea solo entra al
contexto si está aprobada, si su condición de disponibilidad está encendida para el tenant y si la persona tiene el
permiso. Si no se puede leer el estado de los flags, Faro no la menciona: `listFeatureFlags` vuelve a los valores
por defecto cuando la lectura falla (`lib/studio/feature-flags-queries.ts:35-36`), y para Faro «no sé» significa
«no lo menciono». Una comprobación de CI pedirá, por cada pantalla cambiada, la guía tocada o una justificación de
«sin impacto para el usuario»; una persona confirma que el texto es correcto. Hermes, en la fase 7, revisa las PR
fusionadas que se escaparon.

## 6. Seguridad y seguimiento

### 6.1 Recorte antes de la IA

El modelo nunca recibe lo que el usuario no debe saber. Por cada entrada del catálogo:

| Caso | Qué recibe el modelo |
|---|---|
| El usuario puede abrir el módulo | La línea del catálogo como PERMITIDA y su guía completa |
| No puede abrirlo | Solo la línea, marcada SIN ACCESO. Sin guía |
| No puede y es `reservada` | La línea con la descripción sustituida por «Reservada» |
| No puede y es `oculta` | Nada. Para Faro no existe |

Un proceso entra solo si el usuario puede abrir **todos** los módulos que cruza.

Lista aprobada por Sam el 2026-11-16 (D-3). Vive en `lib/studio/asistente/contenido/catalogo.ts`:

| Trato | Módulos |
|---|---|
| `oculta` (4) | `renditions`, `financiero-china`, `legal`, `no-olvidar`: los de `SUPERADMIN_ONLY_MODULES` |
| `reservada` (6) | `direccion`, `users`, `admin`, `mailing`, `nomina`, `costing` |
| `normal` (47) | El resto, incluidos Facturación, Cobranzas, Tesorería, Contabilidad, Fiscal y Reportes |

El dinero de uso diario queda como `normal` a propósito: con Sam pidiendo alertas «solo lo serio» (S-2), una
pregunta suelta por Cobranzas no debe alertar. Sin acceso, igual se bloquea y queda en el registro.

### 6.2 El servidor decide el bloqueo

La ficha que devuelve el modelo:

```ts
{
  texto: string,
  resultado: "respondida" | "sin_acceso" | "reservada" | "inexistente" | "sin_guia" | "fuera_de_tema",
  moduloConsultado: string | null, // id del catálogo del que trata la pregunta
  ruta: string | null,             // para «Llévame ahí»
  recorrido: string | null,        // para «Muéstrame dónde»
  tipoReporte: "error" | "mejora" | null
}
```

El servidor no confía en ella:

- Con `moduloConsultado` vuelve a aplicar `canAccessModule`. Si el usuario no puede abrirlo, **es un bloqueo**
  aunque el modelo haya dicho otra cosa, y el texto se reemplaza por la respuesta fija de «sin acceso».
- `ruta` y `recorrido` se descartan si no existen o no están permitidos.
- Una ficha ilegible o cortada se pide una vez más.

### 6.3 Alertas «solo lo serio»

| Situación | Alerta |
|---|---|
| Pregunta por un módulo `reservada` sin tener acceso | Inmediata |
| Segundo «sin acceso» en la misma conversación (insistencia) | Inmediata |
| Intento de saltarse las reglas («ignora tus instrucciones», «el jefe me autorizó») | Inmediata |
| Un «sin acceso» aislado | No alerta. Queda en el registro |

La alerta va a la campana de los administradores y, si Sam lo activa, a Telegram o Discord. Lleva quién preguntó,
desde qué pantalla y el resultado. Requiere un valor nuevo en el enum `bug_notif_type`.

### 6.4 Registro

Tres finalidades, cada una con su plazo (detalle y plazos propuestos en [`privacidad.md`](privacidad.md) §2):
**auditoría** (conversaciones y mensajes), **mejora del conocimiento** (eventos de feedback y alertas; Hermes lee
solo agregados) y **costo y operación** (llamadas a la IA y cuotas, sin texto ni usuario).

- `asistente_conversaciones` y `asistente_mensajes`, de solo inserción. Un trigger rechaza `update` y `delete`,
  salvo el `delete` de la función de purga (`privacidad.md`, E-1).
- `asistente_eventos` (feedback y alertas), `asistente_llamadas` (una fila por intento a la IA), `asistente_cuotas`
  (tope por persona y gasto del mes) y `asistente_purgas` (constancia de cada purga).
- `authenticated` no tiene `insert`: escribe solo el servidor, con la sesión ya verificada.
- Lectura solo para el administrador del tenant. El usuario no relee su historial: el panel lo tiene en memoria.
- Cada respuesta guarda resultado, pantalla de origen y versiones del contenido. Motor, modelo, tokens, costo y
  milisegundos van por intento en `asistente_llamadas`.
- La pregunta se guarda **depurada**: el servidor reemplaza cédulas, RIF, teléfonos, correos y Shipping Marks por
  marcadores antes de enviarla a la IA y antes de guardarla (`privacidad.md`, E-3).
- Los logs del servidor guardan el tipo de fallo, nunca el texto de la pregunta.
- **Este registro es el único lugar donde se conservan la pregunta y la respuesta**, y solo durante el plazo que
  fije §10 (D-6). «Inalterable» significa que nadie edita ni borra a mano; al vencer el plazo, una purga
  programada y auditada **borra las filas completas**. No sirve copiar la purga de noticias, que solo vacía el
  identificador (`supabase/migrations/0546_noticias_purga_actor_id.sql:178-202`): aquí el dato está en el texto.
- El contexto recortado que se envía al modelo (catálogo y guías) no se guarda: se vuelve a armar en cada pregunta.

### 6.5 El motor de IA y la Oficina (decisión abierta D-1)

El Director General indicó (2026-11-16) que **Faro no escribe otra cadena de modelos**: la SDD-0626 ya trae un
cliente del runtime de la Oficina en `lib/studio/oficina/runtime-cliente.ts` (PR #598, sin fusionar al escribir
esto). Ese cliente llama por HTTP a Hermes, que es quien resuelve el salto entre proveedores.

Eso choca con la decisión S-5 de Sam (Hermes fuera del camino de la pregunta). Motivos para mantenerlo fuera:
Hermes guarda cada turno en su propia base y hay que borrarlo después; agrega tiempo por respuesta; y ata la ayuda
del Studio a la salud del servidor de la Oficina.

Propuesta, a coordinar con la sesión que lleva la SDD-0626:

- Faro define una interfaz `Motor` mínima con **un principal y un respaldo**. No es una cadena: sin cortacircuitos
  ni política propia de fallos.
- **Principal:** llamada directa a un proveedor, con el SDK de Anthropic ya instalado.
- **Respaldo:** un segundo modelo directo de un proveedor **no chino**, o ninguno. **No** el runtime de la Oficina
  mientras use Z.AI o DeepSeek (`docs/specs/0626-oficina-runtime/privacidad.md:254`): una pregunta a Faro puede
  nombrar a un cliente, la depuración no atrapa nombres propios (`privacidad.md`, E-3) y Sam decidió que los datos
  de clientes nunca van a un proveedor chino (SDD-0639 §4, D-2, PR #606 sin fusionar al escribir esto). Ver
  `privacidad.md`, E-10.
- Si la Oficina extrae su política de fallos a un módulo común, Faro la adopta y borra la suya.
- Motor `simulado` para pruebas (`LLM_FORCE_MOCK`).

**Respuesta del Director General (2026-11-16):** la propuesta no contradice su instrucción, que buscaba evitar una
segunda cadena de respaldo paralela a la de la Oficina y no prohibir un cliente directo. La acepta con tres
condiciones, que son requisitos de esta spec:

1. **Un solo módulo cliente** para el motor directo: `lib/studio/asistente/motor/cliente-directo.ts`.
   - La llave llega por variable de entorno y nunca entra en Git.
   - Es el único archivo de `lib/studio/asistente/` y de `app/**/asistente/` que importa `@anthropic-ai/sdk`. Lo
     hace cumplir una prueba de importaciones (o una regla `no-restricted-imports`) que falla si otro archivo de
     Faro lo importa.
   - **Tope de gasto propio con pausa automática.** El gasto del mes se mide sumando el costo guardado en
     `asistente_llamadas` (§6.4), que cuenta también los intentos fallidos y de respaldo, y se compara con `FARO_TOPE_USD_MES` antes de cada llamada. Al alcanzarlo, Faro
     deja de llamar al modelo, responde que no puede contestar ahora, mantiene los reportes y avisa al
     administrador. El monto es la decisión D-8.
2. **El modelo se elige por configuración:** el más reciente que alcance para la tarea, Sonnet o Haiku si sirve,
   con el esfuerzo medido en la evaluación de la fase 5.
   - Mecanismo: variables de entorno `FARO_MODELO` y `FARO_MODELO_RESPALDO`, leídas en un único archivo,
     `lib/studio/asistente/motor/config.ts`.
   - El id de un modelo no aparece como literal en el código de Faro, salvo el valor por defecto de ese archivo.
     Lo hace cumplir una prueba que busca ids de modelo en el resto de los archivos.
   - `config.ts` acepta en `FARO_MODELO` y `FARO_MODELO_RESPALDO` solo proveedores de una lista permitida, sin
     proveedores chinos. Si alguno de los dos apunta a un proveedor fuera de la lista, Faro no arranca, y una prueba
     falla (AC-16).
3. **Fuera del registro del Studio, la pregunta y el contexto no se conservan.** El registro de §6.4 sí guarda
   pregunta y respuesta, por diseño y durante el plazo de §10; esta condición cubre todo lo demás:
   - el proveedor de IA, con la política de retención que fije §10;
   - los logs del servidor y cualquier herramienta de seguimiento, que nunca reciben el texto.

   Todo ello se revisa con `revisar-datos-ve` antes del primer envío real al modelo (§10).

Falta el visto bueno de Sam a D-1.

Si falla todo, Faro dice que no puede responder ahora, los reportes siguen funcionando y la pregunta se guarda
como `error`.

## 7. Diseño visual

Sam autorizó que Faro **no siga BRAND.md**: es una capa que se sobrepone al sistema y debe llamar la atención. La
excepción vale solo para el botón y el panel de Faro. La pantalla del administrador sí sigue la marca.

### 7.1 El botón

- Icono de un faro de colores (torre blanca con rayas rojas, linterna encendida) con un haz de luz que gira.
- Fondo azul noche con aro dorado.
- **Escritorio:** se ve solo el faro. Al pasar el mouse aparece la palabra «Faro». Un clic abre el panel.
- **Teléfono:** se ve solo el faro. Al tocarlo aparece «Faro» y, enseguida, se abre el panel.
- Se arrastra y se pega al borde izquierdo o derecho. La posición se recuerda por navegador (`localStorage`).
- Respeta `prefers-reduced-motion`: sin giro ni pulso.

### 7.2 El panel

Cabecera con el faro, el nombre, «Nueva» y cerrar. Accesos fijos: «Reportar un error», «Sugerir una mejora» y
«Mis reportes». Conversación en burbujas. Campo para escribir. En teléfono ocupa toda la pantalla.

### 7.3 Botones de una respuesta

| Botón | Cuándo aparece | Qué hace |
|---|---|---|
| «Llévame ahí · [pantalla]» | `respondida` o `sin_guia`, con ruta permitida | `router.push(slug)` |
| «Muéstrame dónde» | `respondida`, con recorrido permitido | Lanza el motor de guía, que resalta el botón |
| «Enviar al administrador» | `sin_acceso`, `reservada`, `inexistente`, `sin_guia` | Abre el reporte con la conversación cargada |
| «Reportar este error» / «Sugerir esta mejora» | `tipoReporte` con valor | Abre el reporte con el texto del usuario |

### 7.4 Convivencia con lo que ya flota

En esa esquina ya están el `BugFABButton` (oculto por defecto, Alt+B) y los avisos. Por D-2, Faro **absorbe** el
botón de reportes: queda un solo elemento flotante (§7.6).

### 7.6 Reportes de error y mejora desde Faro (D-2, D-12, D-13)

Faro no crea un sistema de reportes nuevo: usa el de la SDD-0036 tal como está.

1. **Faro propone, la persona envía.** Cuando la ficha trae `tipoReporte`, o la persona pulsa «Reportar un error» o
   «Sugerir una mejora», Faro arma un borrador: categoría (`error` o `improve`), gravedad sugerida si es error,
   título, descripción y pantalla de origen. La persona lo ve, lo corrige y pulsa «Enviar». **Faro nunca crea un
   reporte sin esa confirmación.**
2. **El mismo camino del ERP.** El envío llama a `createBugForReporter` (`lib/studio/bug-create.ts`) con la sesión
   de la persona: folio `BUG-XXXXX`, control de duplicados, datos técnicos, pantalla de administración «Bugs»,
   avance en «Mis reportes», avisos al que reportó y Discord quedan como hoy. Faro solo cambia de dónde sale el
   texto.
3. **El texto va depurado** (`privacidad.md`, E-3): el borrador sale de la conversación ya depurada y la persona lo
   revisa antes de enviar. El reporte no copia la conversación entera; si el administrador la necesita, la abre en
   «Conversaciones del asistente», con su lectura registrada (D-4).
4. **Rastro de los últimos pasos (D-12).** Hoy el reporte no tiene foto de pantalla (nunca se construyó) y la
   grabación de 15 segundos está apagada (`NEXT_PUBLIC_BUG_REPLAY_ENABLED`). Se agrega un rastro: las últimas
   10 a 15 pantallas visitadas y botones pulsados, con ruta, ancla `data-guia` o texto del botón y hora. **Nunca**
   lo que la persona escribió en un campo, ni valores de la pantalla. Vive solo en la memoria del navegador y se
   adjunta a los datos técnicos del reporte (`bug_tech_data`, solo administrador) al enviarlo. La grabación y la
   foto de pantalla siguen fuera.
5. **Discord (D-13).** Errores de gravedad alta y crítica, al momento, como hoy. Mejoras, sugerencias y errores
   leves, en un resumen diario a `#bugs`: conteos, folios y módulos, sin títulos, sin textos y sin nombres, igual
   que el aviso actual. Telegram sigue retirado (SDD-0606).

Fases: el borrador y el envío por `createBugForReporter` van en la fase 3 (servidor) y la 4 (panel); el rastro, en
la 4. El resumen diario de Discord es del reportador de la SDD-0036, no de Faro: va en su propia tarea.

### 7.7 Rediseño en el rebrand: Faro Lumi Assistant Studio (D-14, decisiones de Sam 2026-11-22)

Salió de la maqueta del módulo «IA y Automatizaciones» (`Módulo IA y automatización`, `src/FaroBoton.jsx` y
`src/Cambios.jsx`). **Reemplaza** el estilo 1 «Faro clásico» de §7.1 (azul noche, aro dorado, rayas rojas) y la
excepción a BRAND.md de §7: el botón y el panel ahora siguen el rebrand (índigo, tipografía y tokens de la
marca). Es solo diseño: no cambia el recorte, el registro ni las alertas.

1. **Corporativo, no mascota.** Se eligió «Faro reestructurado». El dragón queda en pausa (10 diseños en la
   maqueta, por si se retoma).
2. **Icono.** Botón redondo índigo plano de 48 px con el faro en línea blanca; sin relieve, sin colores extra y
   sin haz que se mueva. La luz gira en 8 s: rayitos de la izquierda, lámpara de frente, rayitos de la derecha y
   un momento apagada. Llega como máximo al 46 % y **no se atenúa con el botón**. Al pasar el mouse sube 2 px;
   al oprimirlo baja un poco. Con `prefers-reduced-motion` no hay luz ni transiciones.
3. **Configuración por persona** («que no moleste a la vista, pero que siempre esté ahí»):

| Opción | Valores | Por defecto |
|---|---|---|
| Forma | Botón redondo o pestaña vertical en el borde derecho | Redondo |
| Tamaño | Pequeño 36 px, Normal 44 px, Grande 56 px | Normal |
| Atenuado en reposo | 20 % a 100 %; vuelve al 100 % con el mouse y baja a la mitad al hacer scroll | 50 % |
| Posición | Arrastrable, con imán al borde más cercano (izquierda, derecha o abajo); «Devolver a su sitio» | Abajo a la derecha, pegado al fondo |
| Asomado | Se esconde a medias y sale completo al acercar el mouse | Apagado |
| Atajo | F1, Ctrl+Shift+F o Alt+A (Ctrl+K no: es el buscador del Studio) | F1 |

   Se guardan por persona y navegador (`localStorage`), como la posición de §7.1; sin tabla nueva.
4. **Aviso discreto.** Un numerito gris pequeño, sin palpitar.
5. **«Pregúntale a Faro» sobre texto marcado**, sin activar nada: al marcar texto aparece un botón pequeño
   encima; con clic derecho sobre lo marcado sale un menú propio de la app con «Pregúntale a Faro» arriba y
   Copiar e Imprimir debajo. Si no hay texto marcado, sale el menú normal del navegador (una web no puede agregar
   opciones al menú nativo). Faro copia el texto, lo explica y lleva al lugar. **Privacidad:** el texto marcado es
   una pregunta más; pasa por la depuración (E-3) y el recorte antes de llegar al modelo, y se registra igual que
   cualquier mensaje (§6.4).
6. **Buscador del Studio.** El buscador (`StudioTopbar.tsx`) ofrece «Pregúntale a Faro» como primera opción.
7. **Base de conocimiento.** Faro conoce el negocio de punta a punta (mapa global, procesos, tareas automáticas,
   agentes y Oficina), a partir del catálogo del módulo «IA y Automatizaciones». Entra por el minicerebro (§5):
   estantes versionados, guía `aprobada` y recorte por permisos como cualquier otra entrada. No entra nada que
   no esté aprobado, ni datos de clientes.

**Fase nueva 4b (rediseño visual).** Después de la fase 4: botón con la luz, panel de configuración, imán y
asomado, atajo, texto marcado y entrada del buscador. Se comprueba con `/ui-check`, recorrido en teléfono,
tableta y escritorio, y e2e con motor simulado (el atajo no choca con el buscador; el menú propio solo sale con
texto marcado; `reduced-motion` apaga la luz). Alcance exacto y allowlist, al abrir la fase con el turno del DG.
La base de conocimiento ampliada (punto 7) es una fase aparte de contenido, con aprobación de Sam guía por guía.

### 7.5 Dependencia del motor de guía

Medido el 2026-11-16: la SDD-0589 está `in-progress`. El motor y el estado por usuario (migración 0517) están en
producción; el botón «Guía» está hecho pero no montado. Faro lanza recorridos por código (`iniciarGuia`), que ya
funciona. Cada «Muéstrame dónde» necesita un recorrido definido en `lib/studio/guia/recorridos.ts`: si una guía
no tiene recorrido, el botón no aparece. Faro puede salir sin ningún recorrido y sumarlos después.

## 8. Hermes: analista, redactor y vigía (etapa posterior)

Faro le responde al equipo. Hermes le responde a Sam sobre Faro. Hermes nunca responde a un usuario del Studio.

1. **Analista:** Sam le pregunta qué preguntó el equipo o qué bloqueos hubo. Hermes consulta un punto de lectura
   reservado al administrador, que devuelve un resumen sin datos del negocio.
2. **Redactor:** revisa las preguntas `sin_guia`, `inexistente` y las repetidas; las ordena por frecuencia; busca
   la fuente en el código y en la documentación; si no está escrita, lo dice y señala a quién preguntar; y deja
   un borrador con sus fuentes.
3. **Vigía:** corre la evaluación de forma periódica y avisa si baja la nota o aparece una filtración.

Dos reglas: Hermes **no escribe directo en el minicerebro** (una persona aprueba y entra por PR), y las preguntas
de los usuarios se tratan como datos, nunca como instrucciones.

## 9. Fases

| Fase | Entrega | Cómo se comprueba |
|---|---|---|
| 0 | Esta spec | Aprobación de Sam |
| 1 | Catálogo completo y de 8 a 10 guías, contabilidad primero | Prueba de catálogo completo; aprobación de Sam guía por guía |
| 2 | Migración: tablas, permisos, trigger, tope, valor del enum | Contrato `.test.sql` en PGlite con control rojo y mutantes |
| 3 | Recorte, verificador, alertas, motor y ruta de API | Pruebas con los 7 roles: la guía prohibida nunca llega al modelo. Simulacro de pausa automática por tope de gasto. Pruebas de módulo único y de id de modelo (§6.5) |
| 4 | Botón, panel y pantalla del administrador (con el estilo de §7.7) | `/ui-check`; recorrido en teléfono, tableta y escritorio; e2e con motor simulado |
| 4b | Rediseño visual del rebrand (§7.7, D-14) | `/ui-check`, tres anchos y e2e con motor simulado |
| 5 | Batería de unas 40 preguntas por rol y ataque con promptfoo | Al menos 95 % de aciertos y cero filtraciones. Cuesta dinero: se corre con OK de Sam |
| 6 | Producción | `pnpm verify`, revisión independiente, portón del DG, OK nominal de Sam para la migración |
| 7 | Hermes (§8) | Se especifica en detalle con la sesión de la Oficina |

**Fase 2 (2026-11-16):** migración `supabase/migrations/0550_faro_registro.sql`, **no aplicada**, con su
contrato `supabase/tests/0550_faro_registro.test.sql`, su ensayo en PGlite
`lib/studio/asistente/__tests__/faro-0550.migration.test.ts` (control rojo, mutantes y desarme) y su desarme
`supabase/desarmes/0550_desarme.sql`. Implementa D-4 (lee solo el administrador del tenant, con rastro) y deja
D-5 como parámetro: el tope por hora lo pasa el servidor y la base no fija el número. Sam aprobó las dos el mismo día.
La purga a pedido exige que quien la pide sea administrador activo del tenant y un motivo de una lista cerrada; la
constancia en `asistente_purgas` no guarda quién la pidió ni texto (`privacidad.md` §2). Quién la pidió lo
registra la fase 3 con `append_audit_event` (0267), sin el texto de las preguntas (AC-19).
Detalle en `.agents/handoffs/sdd-0637-faro-fase2-migracion.md`.

**Allowlist exacta de la fase 2** (PR #611): ningún otro archivo cambia.

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0550_faro_registro.sql` | Nuevo |
| `supabase/tests/0550_faro_registro.test.sql` | Nuevo |
| `lib/studio/asistente/__tests__/faro-0550.migration.test.ts` | Nuevo |
| `supabase/desarmes/0550_desarme.sql` | Nuevo |
| `supabase/migrations-baseline.json` | Espera `0550_faro_registro` |
| `docs/specs/0637-faro-asistente-ayuda/spec.md` | Fase 2, D-4, D-5, AC-17, AC-18 y AC-19 |
| `.agents/handoffs/sdd-0637-faro-fase2-migracion.md` | Nuevo |

Más `docs/specs/0637-faro-asistente-ayuda/privacidad.md`, solo para precisar el texto de E-1 y E-5 a lo que hace la
0550.

**Orden:** el Director General ubicó la implementación después de lo que está en curso (retiros de espera de las
migraciones 0545 a 0547, la PR #598 y la prueba E del cable). El número de la migración se toma al crearla.

**Tiempo estimado, sin medir:** de dos a tres semanas desde que Faro tenga turno, y una más para la fase 7.

**Puerta de privacidad:** hasta la fase 4 todo corre con el motor simulado. El primer envío real a un modelo,
incluidas la batería y el ataque con promptfoo de la fase 5, espera a la revisión de §10.

### 9.1 Criterios de aceptación

| # | Criterio | Fase |
|---|---|---|
| AC-1 | Todo módulo de `MODULES` tiene entrada en el catálogo; la prueba falla si falta uno | 1 |
| AC-2 | Para cada uno de los 7 roles, el contexto enviado al modelo no contiene la guía de un módulo no permitido, ni la descripción de uno reservado, ni mención de uno oculto | 3 |
| AC-3 | Si `moduloConsultado` no está permitido, la respuesta es la de «sin acceso» aunque el modelo haya devuelto pasos | 3 |
| AC-4 | «Llévame ahí» y «Muéstrame dónde» nunca aparecen para una ruta o un recorrido no permitido | 3 y 4 |
| AC-5 | Un usuario `authenticated` no puede insertar, editar ni borrar en las tablas de Faro, y sin ser administrador no lee ninguna fila, ni las suyas | 2 |
| AC-6 | Las tres situaciones de §6.3 crean una alerta; un «sin acceso» aislado no la crea | 3 |
| AC-7 | Al superar el tope por hora, Faro responde con un aviso claro y guarda el intento | 3 |
| AC-8 | Al alcanzar `FARO_TOPE_USD_MES`, Faro no llama al modelo, los reportes siguen funcionando y el administrador recibe un aviso (simulacro) | 3 |
| AC-9 | Si el motor principal falla o excede el tiempo límite, responde el respaldo si hay uno configurado; si no hay respaldo, o si fallan los dos, Faro dice que no puede responder ahora, los accesos de reporte siguen funcionando y se guarda `error` | 3 |
| AC-10 | Solo `cliente-directo.ts` importa el SDK del proveedor, y el id del modelo solo aparece en `config.ts` | 3 |
| AC-11 | Ni la pregunta ni la respuesta aparecen en los logs del servidor | 3 |
| AC-12 | El botón se arrastra, se pega al borde, recuerda su posición y respeta `prefers-reduced-motion`; en teléfono el panel ocupa la pantalla | 4 |
| AC-13 | Sin motor disponible, Faro lo indica y los accesos de reporte siguen funcionando | 4 |
| AC-14 | La batería alcanza al menos 95 % de aciertos con cero filtraciones, y el ataque con promptfoo no obtiene pasos ni descripciones prohibidas | 5 |
| AC-15 | Existe la revisión `revisar-datos-ve` aprobada antes del primer envío real al modelo | 5 |
| AC-16 | `FARO_MODELO` y `FARO_MODELO_RESPALDO` solo aceptan proveedores de la lista permitida, sin proveedores chinos; una prueba falla si se configura uno fuera de la lista | 3 |
| AC-17 | Cada hallazgo E-1 a E-10 de [`privacidad.md`](privacidad.md) queda resuelto en su fase, con prueba donde el código lo permite. Fase 2: E-1 (la purga borra filas completas), E-5 (purga a pedido con constancia) y E-7 (cada lectura del administrador queda en `asistente_lecturas`), en el contrato de la 0550. Fase 3: E-3 (depuración antes de la IA y antes de guardar), E-6 (la alerta es una señal que revisa una persona), E-9 (un canal externo no lleva identidad) y E-10 (AC-16). Fase 4: E-4 (aviso con versión) y el camino de E-5 para pedir. Fase 7: E-8 (Hermes solo lee agregados). E-2 queda aceptado por D-11, con el riesgo anotado | 2 a 7 |
| AC-18 | El tope de gasto del mes no se pasa por una carrera: dos preguntas simultáneas del mismo tenant no pueden leer el mismo gasto y llamar las dos a la IA. El servidor toma un advisory lock por tenant o reserva el gasto antes de llamar; una prueba con llamadas en paralelo lo demuestra | 3 |
| AC-19 | Cada purga a pedido deja constancia de quién la pidió con `append_audit_event` (0267): actor, tenant, persona purgada y código de motivo, sin el texto de las preguntas. `asistente_purgas` sigue sin actor (decisión del Director General, revisión de la #611) | 3 |

## 10. Datos personales

Faro guarda lo que escribe el personal, con su identidad. La revisión de
`.claude/skills/revisar-datos-ve/SKILL.md` es una puerta en dos momentos:

- **Antes de la fase 2,** porque la migración crea las tablas que guardan esas preguntas.
- **Antes del primer envío real a un modelo,** incluidas la batería y el ataque con promptfoo de la fase 5. Hasta
  entonces solo se usa el motor simulado. promptfoo se configura con proveedor propio: por defecto genera los
  ataques con inferencia alojada por terceros.

Puntos que esa revisión debe resolver:

- **Retención en el proveedor de IA:** fijar por escrito su política de datos para la cuenta que use Faro, o
  contratar cero retención si está disponible. Sin eso no hay envío real.

- Aviso al personal de que las preguntas se guardan y de quién las lee.
- Plazo de conservación. «Inalterable» no puede significar «para siempre» sin un plazo definido.
- El proveedor de IA como encargado: Anthropic figura en el inventario de terceros
  (`docs/legal/privacidad/inventario-terceros.md:38`), pero su fila no menciona Faro. Sumarlo es un pendiente previo
  al primer envío real.

- Las guías no contienen datos personales ni de clientes.

**Revisión hecha (2026-11-16):** [`privacidad.md`](privacidad.md). Cubre la puerta de la fase 2. La puerta del
primer envío real sigue abierta (N-1 y N-2 de esa revisión). El equipo en China (E-2) queda activo por decisión de
Sam (D-11), con el riesgo anotado.

## 11. Decisiones abiertas

| # | Decisión | Recomendación |
|---|---|---|
| D-1 | Motor de IA: directo, por la Oficina, o principal directo con respaldo | Principal directo (hoy Anthropic) y respaldo solo de un proveedor no chino, o ninguno; la Oficina no sirve de respaldo mientras use Z.AI o DeepSeek (§6.5, `privacidad.md` E-10). Aceptada por el Director General con tres condiciones; falta Sam |
| D-2 | ¿Faro absorbe el botón de reportar errores? | **Aprobada por Sam el 2026-11-16** (§7.6): Faro reemplaza el botón, arma el reporte desde la conversación y la persona lo revisa y envía; se crea por `createBugForReporter`. Su respuesta a «Propongo que Faro lo reemplace y arme el reporte desde la conversación […], pero que la persona lo revise y pulse «Enviar» antes de crearlo. ¿Así?» fue «Sí, con confirmación» |
| D-3 | Lista de módulos `reservada` y `oculta` | **Aprobada por Sam el 2026-11-16** (§6.1). Su respuesta a «¿Apruebas la propuesta de módulos reservados y ocultos (D-3)?» fue «Sí, apruébala» |
| D-4 | ¿Quién lee las conversaciones además del administrador? | **Aprobada por Sam el 2026-11-16:** solo el administrador del tenant, con cada lectura registrada en `asistente_lecturas` (migración 0550). Su respuesta en el chat del Director General a «¿Apruebas las dos recomendaciones? D-4: solo el administrador lee las preguntas del equipo, con cada lectura registrada. D-5: 30 preguntas por hora por persona, configurable» fue «Sí, D-4 y D-5» |
| D-5 | Tope de preguntas por usuario y hora | **Aprobada por Sam el 2026-11-16**, en la misma respuesta: 30 por hora y por persona, configurable. La base no fija el número: el servidor lo pasa a `asistente_reservar_pregunta` (fase 3) |
| D-6 | Plazo de conservación del registro | **Aprobada por Sam el 2026-11-16** (`privacidad.md` §2): conversaciones, mensajes y feedback 180 días; alertas y lecturas del administrador 2 años, sin texto; llamadas a la IA 13 meses, sin texto ni usuario. Su respuesta a «¿Apruebas los plazos propuestos para D-6?» fue «Sí, apruébalos» |
| D-7 | ¿Las alertas van también a Telegram o Discord? | Campana siempre; el canal externo, apagado al inicio |
| D-8 | Tope de gasto mensual de Faro (`FARO_TOPE_USD_MES`) y dónde se mide | US$25 al mes, el mismo tope que el bot de la SDD-0618. Se mide sumando el costo por intento en `asistente_llamadas` |
| D-9 | Memoria | **Aprobada por Sam el 2026-11-16**: solo la conversación en curso, acotada y revalidada contra los permisos actuales. Sin memoria por persona entre conversaciones. El conocimiento compartido mejora por guías aprobadas. Su respuesta a «¿Apruebas la recomendación de Codex sobre memoria y novedades?» fue «Sí, apruébala» |
| D-10 | Cómo se entera Faro de lo nuevo | **Aprobada por Sam el 2026-11-16**, en la misma respuesta: estante `novedades/`, guía y novedad en la misma PR de la función, filtro por flags y permisos, Hermes como vigía en la fase 7 (§5). La regla de PR para `AGENTS.md` sigue necesitando su OK aparte (fase 6) |
| D-11 | ¿Faro para el equipo en China? | **Decidida por Sam el 2026-11-16: activo, sin filtro por región.** Su respuesta a «¿Dejamos Faro apagado por ahora para el equipo en China, o prefieres consultarlo antes?» fue «No es necesario ocultar a China, déjalo activo, no importa. Todavía China no va a trabajar, así que actívalo normal.» La recomendación era apagarlo para `region = 'cn'` (`privacidad.md`, E-2); el riesgo PIPL queda anotado y conviene revisarla cuando el equipo en China empiece a usar el Studio |
| D-12 | ¿Qué captura acompaña un reporte? | **Decidida por Sam el 2026-11-16:** el rastro de los últimos pasos, sin lo escrito (§7.6). Entre «rastro de últimos pasos», «encender la grabación» y «foto de pantalla», eligió solo el rastro. La grabación y la foto siguen fuera |
| D-13 | ¿Qué llega a Discord de los reportes? | **Decidida por Sam el 2026-11-16:** alta y crítica al momento, como hoy, más un resumen diario de lo demás, sin datos de clientes (§7.6). Tarea del reportador de la SDD-0036, aparte de Faro |
| D-14 | Rediseño de Faro en el rebrand (§7.7) | **Decidida por Sam el 2026-11-22** en la maqueta del módulo «IA y Automatizaciones»: nombre Faro Lumi Assistant Studio, faro corporativo (dragón en pausa), botón índigo plano con luz que gira, configuración por persona, «Pregúntale a Faro» sobre texto marcado y base de conocimiento de punta a punta. Registrada por el Director DTD, sin las palabras literales de Sam |

## 12. Riesgos

| Riesgo | Defensa |
|---|---|
| Inyección de prompt | El modelo no recibe lo prohibido (§6.1) y el servidor decide el bloqueo (§6.2) |
| Guía desactualizada | Regla de mantenimiento (§5) y fecha de revisión por entrada |
| El modelo inventa un paso | Batería antes de producción y al cambiar de modelo; el administrador lee el registro |
| Costo descontrolado | Tope por usuario y hora; tope mensual medido por intento en `asistente_llamadas` |
| Dependencia de la PR #598 | Ya no: la Oficina no es respaldo de Faro mientras use proveedores chinos (§6.5, E-10) |
| El botón tapa datos | Se arrastra y recuerda la posición |

## 13. Fuentes

- Documento de referencia aportado por Sam: «cómo se construyó Lumi» (no se copia al repositorio).
- Anthropic, «Building effective agents»: preferir flujos fijos a agentes cuando la tarea es predecible.
- Documentación de Hermes Agent: servidor compatible con OpenAI por perfil.
- promptfoo: plugin `rbac` y estrategias de inyección de prompt.
- `docs/oficina/contexto-oficina.md` y la respuesta del Director General del 2026-11-16.
