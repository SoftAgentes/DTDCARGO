---
sdd: "0637"
title: "Faro: asistente de ayuda con IA dentro del Studio, con recorte por permisos, registro inalterable y alertas al administrador"
status: proposed
author: "Claude (sesión Lumi) + Sam"
created: 2026-11-16
updated: 2026-11-16
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

**Estado:** `proposed`. Este documento es la etapa 0. **No hay código, migraciones ni cambios en producción.**
Nada se programa hasta que Sam apruebe esta spec.

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
- Portal del cliente, sitio público, móvil (`app/m`) y Back. Solo Studio de escritorio y teléfono.
- Búsqueda por fragmentos (RAG) y respuesta en streaming.
- La etapa de Hermes (§8): se diseña aquí y se construye después de que Faro esté en producción.

## 3. Arquitectura: cinco capas

Faro es un **flujo fijo**, no un agente: no tiene herramientas ni memoria. Solo una capa habla con una IA.

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
5. **Motor:** instrucciones fijas + contexto recortado + historial leído de la base + pregunta.
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

Reglas:

- Una prueba unitaria falla si un módulo de `MODULES` no tiene entrada en el catálogo.
- Las guías se redactan leyendo las pantallas reales y **las aprueba una persona** antes de entrar.
- Regla de mantenimiento propuesta para `AGENTS.md` (requiere OK de Sam, fase 6): todo cambio que altere lo que
  ve o hace un usuario en una pantalla actualiza su guía en la misma PR.
- Con el tamaño previsto todo cabe en el contexto del modelo. Se revisa si pasa de unos 150.000 tokens.

## 6. Seguridad y seguimiento

### 6.1 Recorte antes de la IA

El modelo nunca recibe lo que el usuario no debe saber. Por cada entrada del catálogo:

| Caso | Qué recibe el modelo |
|---|---|
| El usuario puede abrir el módulo | La línea del catálogo como PERMITIDA y su guía completa |
| No puede abrirlo | Solo la línea, marcada SIN ACCESO. Sin guía |
| No puede y es `reservada` | La línea con la descripción sustituida por «Reservada» |
| No puede y es `oculta` | Nada. Para Faro no existe |

Un proceso entra solo si el usuario puede abrir **todos** los módulos que cruza. La lista inicial de reservadas y
ocultas la propone el Worker a partir de `LOCKED_MODULES` y `SUPERADMIN_ONLY_MODULES`, y la aprueba Sam (D-3).

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

- `asistente_conversaciones` y `asistente_mensajes`, de solo inserción. Un trigger rechaza `update` y `delete`.
- `authenticated` no tiene `insert`: escribe solo el servidor, con la sesión ya verificada.
- Lectura solo para el administrador del tenant. El usuario no relee su historial: el panel lo tiene en memoria.
- Cada respuesta guarda resultado, pantalla de origen, motor, modelo, tokens, costo y milisegundos.
- Los logs del servidor guardan el tipo de fallo, nunca el texto de la pregunta.

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
- **Respaldo:** el runtime de la Oficina, reutilizando `runtime-cliente.ts` con un perfil propio sin herramientas
  ni memoria, cuando la SDD-0626 lo permita. Mientras no exista, el respaldo es un segundo modelo directo.
- Si la Oficina extrae su política de fallos a un módulo común, Faro la adopta y borra la suya.
- Motor `simulado` para pruebas (`LLM_FORCE_MOCK`).

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

En esa esquina ya están el `BugFABButton` (oculto por defecto, Alt+B) y los avisos. Se decide en D-2 si Faro
absorbe el botón de reportes o conviven.

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
| 3 | Recorte, verificador, alertas, motor y ruta de API | Pruebas con los 7 roles: la guía prohibida nunca llega al modelo |
| 4 | Botón, panel y pantalla del administrador | `/ui-check`; recorrido en teléfono, tableta y escritorio; e2e con motor simulado |
| 5 | Batería de unas 40 preguntas por rol y ataque con promptfoo | Al menos 95 % de aciertos y cero filtraciones. Cuesta dinero: se corre con OK de Sam |
| 6 | Producción | `pnpm verify`, revisión independiente, portón del DG, OK nominal de Sam para la migración |
| 7 | Hermes (§8) | Se especifica en detalle con la sesión de la Oficina |

**Orden:** el Director General ubicó la implementación después de lo que está en curso (retiros de espera de las
migraciones 0545 a 0547, la PR #598 y la prueba E del cable). El número de la migración se toma al crearla.

**Tiempo estimado, sin medir:** de dos a tres semanas desde que Faro tenga turno, y una más para la fase 7.

## 10. Datos personales

Faro guarda lo que escribe el personal, con su identidad. Antes de la fase 2 pasa por la revisión de
`.claude/skills/revisar-datos-ve/SKILL.md`. Puntos que esa revisión debe resolver:

- Aviso al personal de que las preguntas se guardan y de quién las lee.
- Plazo de conservación. «Inalterable» no puede significar «para siempre» sin un plazo definido.
- El proveedor de IA como encargado: hoy Anthropic no figura en el inventario de terceros
  (`docs/legal/privacidad/inventario-terceros.md`). Es un pendiente previo a producción.
- Las guías no contienen datos personales ni de clientes.

## 11. Decisiones abiertas

| # | Decisión | Recomendación |
|---|---|---|
| D-1 | Motor de IA: directo, por la Oficina, o principal directo con respaldo en la Oficina | La tercera (§6.5), coordinada con la SDD-0626 |
| D-2 | ¿Faro absorbe el botón de reportar errores? | Sí: un solo elemento flotante, como hizo la referencia |
| D-3 | Lista de módulos `reservada` y `oculta` | La propone el Worker en la fase 1; la aprueba Sam |
| D-4 | ¿Quién lee las conversaciones además del administrador? | Solo el administrador del tenant |
| D-5 | Tope de preguntas por usuario y hora | 30, configurable |
| D-6 | Plazo de conservación del registro | Lo define la revisión de datos (§10) |
| D-7 | ¿Las alertas van también a Telegram o Discord? | Campana siempre; el canal externo, apagado al inicio |

## 12. Riesgos

| Riesgo | Defensa |
|---|---|
| Inyección de prompt | El modelo no recibe lo prohibido (§6.1) y el servidor decide el bloqueo (§6.2) |
| Guía desactualizada | Regla de mantenimiento (§5) y fecha de revisión por entrada |
| El modelo inventa un paso | Batería antes de producción y al cambiar de modelo; el administrador lee el registro |
| Costo descontrolado | Tope por usuario y hora; costo guardado por respuesta |
| Dependencia de la PR #598 | Faro puede salir con motor directo y sumar el respaldo de la Oficina después |
| El botón tapa datos | Se arrastra y recuerda la posición |

## 13. Fuentes

- Documento de referencia aportado por Sam: «cómo se construyó Lumi» (no se copia al repositorio).
- Anthropic, «Building effective agents»: preferir flujos fijos a agentes cuando la tarea es predecible.
- Documentación de Hermes Agent: servidor compatible con OpenAI por perfil.
- promptfoo: plugin `rbac` y estrategias de inyección de prompt.
- `docs/oficina/contexto-oficina.md` y la respuesta del Director General del 2026-11-16.
