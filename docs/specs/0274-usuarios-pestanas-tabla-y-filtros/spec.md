---
sdd: 0274
title: Usuarios y roles en un solo lugar — la fila se calla, los permisos se mudan
status: in-progress
author: Claude (ventana 2026-08-19)
created: 2026-08-19
updated: 2026-08-19
supersedes: null
superseded_by: null
related: [0273, 0252, 0250, 0139, 0085, 0024]
confidencialidad: interna
---

# SDD-0274 · Usuarios y roles en un solo lugar

Slices 2, 3 y 4 del rediseño acordado con el founder el 2026-08-19, más la
consolidación de pestañas que pidió después. El Slice 1 (la ficha edita rol y
alcance) es **SDD-0273** y es prerrequisito: sin él, esta spec deja el rol sin
dónde cambiarse.

## Problema

Cuatro cosas medidas, no opinadas.

**1. La columna de acciones gritaba.** Cada fila montaba dos `<select>` que
aplicaban en el `onChange` y hasta tres botones, uno de ellos
`studio-btn-primary` cuando la persona no había entrado. Con el equipo real
—9 miembros, 4 sin estrenar cuenta— eso son **45 `useActionState` montados, 18
selects que mutaban solos y 4 rellenos vino apilados en columna**. BTN-01 §2 lo
nombra: una tabla «normalmente usa enlace, terciario o icono **para no crear
decenas de primarios visuales**».

**2. La acción saltaba de sitio.** Una fila activa mostraba dos botones y una
suspendida sólo uno, así que «Reactivar» aparecía descolgado respecto del resto.
TBL-01: «acción por fila no cambia de posición según estado sin reservar
espacio».

**3. Los permisos vivían en otro módulo.** La matriz rol × módulo estaba en
`Administración` y la gente en `Usuarios`: dos sitios para una sola pregunta.
Y en `Usuarios` había además un modal read-only de la misma matriz — dos vistas
del mismo dato, ninguna editable donde hacía falta.

**4. El dato más importante del módulo no hacía nada.** De 9 miembros, **4
tienen cuenta y nunca han entrado**, algunos desde hace más de un mes. Eso se
mostraba como un «Nunca» en una celda de fecha: no se podía filtrar, no ordenaba
nada, y no había forma de arrancarlos sin abrir las 4 fichas una por una.

Además, de la revisión de gobernanza: el buscador no declaraba su alcance (sólo
un placeholder, y BUS-01 prohíbe que sea la única declaración), no había conteo
de resultados (TBL-01), y el estado vacío era uno solo para «no hay nadie» y
«tu filtro no encontró nada».

## Decisión

### Tres pestañas: Personas · Roles y permisos · Invitaciones

Todo lo que responde «¿qué puede hacer esta persona?» queda en un módulo.

**No cambia quién entra:** `users` y `admin` son los dos admin-only en
`ADMIN_ONLY_MODULES`, así que la matriz queda al alcance de exactamente la misma
gente. Los 16 módulos con candado de gobernanza siguen sin poder tocarse — ni
desde la UI, ni desde el RPC, ni desde el `CHECK` de la tabla.

En `Administración` la sección **se queda**, pero deja de renderizar una segunda
copia editable: muestra un puntero. Dos superficies escribiendo la misma tabla
es exactamente cómo se desincronizan.

Las invitaciones dejan de colgar de un acordeón al fondo y las 7 tarjetas de rol
dejan de empujar la tabla fuera de pantalla.

### La fila se calla (Slice 2)

Cero botones y cero selects. La fila entera es el enlace a la ficha; todas las
acciones viven en el drawer.

**Chevrón, no menú `⋯`.** El founder pidió que las acciones vivieran dentro del
perfil, y un menú en la fila las devuelve a la fila. De rebote se esquiva un bug
real: `ActionMenu` posiciona su panel con `position:absolute` **sin portal**, y
la tabla vive dentro de un contenedor con `overflow:auto`, así que el panel de
las últimas filas se recortaría. Su único consumidor verificado
(`ClientsClient`) lo usa en la **cabecera**, fuera de una tabla — este caso nunca
se había ejecutado. La columna mide 40 px, la misma del Norte, por si algún día
se decide poner el menú.

Siete columnas pasan a cuatro: rol y alcance se funden, estado y último acceso
también. Con eso muere el `position:sticky` de la columna de acciones, que era
un parche por el ancho que ocupaban los botones.

### Búsqueda y filtros (Slice 3)

- Label visible **«Buscar persona»** y el alcance escrito debajo, porque BUS-01
  dice que el placeholder no puede ser la única declaración: desaparece al
  escribir.
- El alcance **creció** a cargo y rol. Buscar «Contabilidad» o «Analista» antes
  no encontraba a nadie aunque el dato estuviera a la vista.
- Chips de estado con su conteo, calculado sobre el total **sin filtrar** — un
  chip que contara sobre lo ya filtrado se vaciaría a sí mismo al usarlo.
- Contador de resultados en un `role="status" aria-live="polite"`: un solo
  elemento cierra el conteo de TBL-01, el anuncio de BUS-01 y el estado dinámico
  de A11Y-01 §5.
- Dos estados vacíos distintos y un «Limpiar» visible sólo cuando hay filtro.
- **Muere el `<select>` de rol**: era redundante con las tarjetas de rol, y su
  función la absorbe el buscador.

#### Qué viaja en la URL y qué no

`?tab=`, `?estado=` y `?persona=` sí: son estados que uno quiere compartir o
recuperar, y la ficha queda enlazable.

**El texto buscado NO.** Es el nombre o el correo de una persona, y la query
string queda escrita en el historial del navegador y en los logs de cualquier
proxy. El filtro se comparte igual; el dato personal no tiene por qué viajar.
TBL-01 pide filtros restaurables y esto lo cumple para los que se pueden
restaurar sin publicar a nadie — la parte que no, queda declarada acá.

### La banda de trabajo (Slice 4)

Si hay gente con cuenta sin estrenar, aparece una banda arriba de la tabla que
lo dice, deja filtrar por ella y **manda el enlace a todos de una vez**.

Si no hay nadie pendiente, la banda **no se dibuja**: no es un tablero de
vanidad, y cada elemento lleva a una acción real en vez de a un número solo.

Además cubre lo que BTN-01 §4 exige — «una acción crítica principal del flujo no
puede quedar descubrible únicamente al abrir un menú genérico»: con la fila
muda, «Enviar acceso» sólo existiría dentro del drawer.

El orden por defecto de la tabla hace la otra mitad del trabajo gratis: los que
nunca entraron van primero, y **entre ellos el más viejo arriba** — quien lleva
un mes con la cuenta sin estrenar es el caso urgente, no el que se dio de alta
ayer.

#### El lote, y por qué no dice sólo «listo»

`orquestarLoteDeAcceso` vive en `lib/studio/access-link-bulk.ts` y recibe
**inyectada** la función que manda uno. Dos motivos, los dos reales:

1. Un archivo `"use server"` sólo puede exportar funciones async; el tope y el
   tipo del resultado son un `const` y una `interface`, y exportarlos desde la
   server action **rompe el build de Next**.
2. Lo que hay que probar es la orquestación, no el envío.

Reglas que sostiene, cada una con su prueba:

- **No reimplementa el envío**: llama a `sendAccessLinkAction` una vez por
  persona. Duplicarlo habría duplicado sus cuatro guardas (gate de `users`,
  pertenencia al tenant, rastro D5 y token propio de la migr 0354).
- **Secuencial**, para no tirarle el rate limit encima al proveedor de correo.
- **No se detiene en el primer fallo.** Un lote con `break` deja sin enviar a
  los que siguen y la UI dice «listo».
- **Veredicto por destinatario**, y la banda nombra a quién le falló. ERR-01
  pide el error cerca de su causa; en un lote las causas son filas distintas.
- **El tope (25) corta antes de mandar nada**, no a mitad de camino.
- **Los repetidos se mandan una sola vez.**

## Lo que NO hace

| No se hace | Por qué |
|---|---|
| Fusionar invitaciones y miembros en una lista | Dos entidades, dos claves, ficha bimodal. Es la pieza más cara del rediseño y la primera que se cae en review. Las invitaciones tienen su pestaña. |
| Selección múltiple con checkboxes | Con 9 miembros no se paga. El lote va por la banda, que ya sabe a quiénes les falta. |
| `?q=` en la URL | Publicaría el nombre o el correo de una persona en el historial y en los logs. Ver arriba. |
| Sort por columna, columnas configurables, paginación en servidor | `no aplica` **por escrito y con el número medido**: 9 miembros, tope de 200 por tenant en `listUsers`. BUS-01 prohíbe decidir por umbral aislado, así que queda dicho el número, no la regla. |
| Portalizar `ActionMenu` | No hace falta: con chevrón el clipping no existe. El bug del componente queda **reportado y sin cerrar** — el día que alguien meta un `⋯` dentro de una tabla, se va a recortar. |
| Confirmación al suspender desde la fila | La fila ya no suspende: eso vive en la ficha (SDD-0273). Ponerle confirmación con motivo a suspender es su propio slice. |

## Superficie tocada (allowlist exacta)

| Archivo | Qué |
|---|---|
| `app/studio/(app)/usuarios/_components/UsersClient.tsx` | reescrito: pestañas, estado en URL, orquesta las tres vistas |
| `app/studio/(app)/usuarios/_components/MembersTable.tsx` | reescrito: 4 columnas, fila clicable, cero botones, dos vacíos |
| `app/studio/(app)/usuarios/_components/personas/ToolbarPersonas.tsx` | **nuevo** — buscador con alcance, chips, contador |
| `app/studio/(app)/usuarios/_components/personas/BandaDeTrabajo.tsx` | **nuevo** — el pendiente al frente + lote |
| `app/studio/(app)/usuarios/actions.ts` | `sendAccessLinkBulkAction`, cáscara del orquestador |
| `app/studio/(app)/usuarios/page.tsx` | carga los overrides para la pestaña Roles; título y subtítulo |
| `app/studio/(app)/admin/page.tsx` | la sección apunta a Usuarios en vez de renderizar la matriz |
| `lib/studio/access-link-bulk.ts` | **nuevo** — el orquestador puro |
| `lib/studio/user-types.ts` | `accessStage`, sus etiquetas y `compareByAccessStage` |
| `app/studio/_components/icons.tsx` | `chevronR` (ICO-01: el glifo sale del registro de iconos) |
| `app/studio/studio.css` | `.studio-tab`, `.studio-chip`, `.studio-row-linkable`, `.studio-sr-only` |
| `lib/studio/__tests__/access-stage.test.ts` | **nuevo** |
| `lib/studio/__tests__/access-link-bulk.test.ts` | **nuevo** |

## Verificación

- `node scripts/verify.mjs` en verde.
- Mutaciones probadas, cada una deja una prueba en rojo:
  - meterle un `break` al lote cuando un envío falla;
  - invertir la antigüedad en `compareByAccessStage` (el más nuevo primero).
- Pendiente: `/ui-check` sobre las tres pestañas, y medir la tabla a 375 px —
  con la fila clicable el chevrón es el único indicio y queda al extremo
  derecho.
