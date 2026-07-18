---
sdd: "0119"
title: "Módulo de Marketing en el ERP — Dashboard de Marketing (saludo personalizado por usuario) + centralización de herramientas"
status: done
author: "Claude Code (ventana kickoff-marketing) + founder"
created: 2026-06-30
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0052", "0088", "0089", "0090", "0091", "0093", "0099", "0107", "0114", "0116"]
confidencialidad: interno
---

# SDD-0119 · Módulo de Marketing (Dashboard de Fiorella + centralización de herramientas)

> Crear un **módulo de Marketing separado dentro del ERP** que centraliza TODAS las
> herramientas de marketing (HUB de marca, Motor de Noticias, calendario, academia,
> comunidad) y le da a Fiorella un **dashboard tipo "buenos días"**: cada mañana lo abre
> y le dice qué tiene que hacer. El principio rector: **lo que le quita tiempo o no le
> gusta se automatiza con IA en el ERP; ella se enfoca en su fortaleza (crear contenido).**

## Contexto

Esta spec nace de la **1ª reunión de enfoque Sam × Fiorella de Vita** (30-jun-2026, ver
transcripción completa en el Apéndice A). Fue una reunión de **visión**, no operativa:
definir cómo van a trabajar para hacer crecer el área de marketing dentro del ERP y fijar
las nuevas metas.

**El cambio de rol de Fiorella.** Hoy "sube contenido" (eso ya lo hace el ERP). El norte es
que pase a ser **supervisora/estratega**: el ERP absorbe lo operativo y repetitivo, y ella
se dedica a lives, comunidad y cerrar confianza del cliente.

**El principio rector (corazón de la reunión).** Lo que a Fiorella le **quita tiempo** o
**no le gusta hacer** debe pasárselo a Sam para **automatizarlo con IA dentro del ERP**.
Se juega a favor de su fortaleza:
- **Su fortaleza = crear contenido**: salir, hablar en redes, estar frente a cámara. Ahí
  rinde y disfruta → ahí debe enfocarse al 100%.
- **Lo que NO es su fuerte (ej. diseño gráfico)** lo resuelve el **HUB** y sus herramientas,
  que le dan la idea de *cómo* diseñar rápido sin ser diseñadora.
- **Regla operativa:** en vez de obligarla a lo que no le gusta → ella lo reporta → Sam lo
  automatiza en el ERP.

**No se construye de cero.** Ya existen piezas dispersas que este módulo **centraliza**, no
reemplaza:
- **0088 motor-contenido-marketing** — el Motor de Noticias / cerebro de ruteo (Test de
  Noticia) + SEO/GEO en `/noticias`. Es la herramienta estrella.
- **0089 motor-clasificador-multicanal**, **0090 motor-oferta-cliente**, **0091
  motor-flujo-interno** — motores de atomización multi-red y ruteo.
- **0093 academia-formacion** / **0107 academia-persona** — la academia (cursos Alibaba).
- **0099 guia-comprar-alibaba** — contenido de "cómo comprar en Alibaba sin que te estafen".
- **0114 dashboard-configurable** — la base técnica del dashboard (catálogo de KPIs/widgets,
  `useDashboardConfig`, persistencia por usuario). El dashboard de marketing es una **vista
  especializada** sobre esa base.
- **0116 club-dtd** — semilla de la comunidad.

## El Norte del negocio (define todo el speech)

Giro de target que ordena el contenido y las campañas:

| Antes (actual) | Norte (hacia dónde vamos) |
|---|---|
| Pequeños importadores (~$500 de compra en China) | **Medianas y pequeñas empresas** |
| Dolor: "que no me estafen en Alibaba" | Dolor: **flujo de caja, rotación de inventario, compra internacional inteligente** |
| Cliente unitario | Campañas a empresas |

**Nuevo speech (despertar un dolor que el cliente no sabía que tenía):** en vez de comprar
$300k que llegan en 3 meses y se venden en 6 (capital congelado), enseñar a **fraccionar el
crédito** (ej. $300k en 6 meses, comprar $50k, rotar, recibir mensual "como una alcancía").
*La diferencia entre el importador exitoso y el que no: el exitoso mantiene líquido su flujo
de caja.*

⚠️ **Regla de oro de contenido:** enfocarse en los **DOLORES del cliente, no en la empresa**.

## Alcance

**Dentro del alcance (este módulo):**
1. **Módulo "Marketing" separado** en el ERP (`app/studio/(app)/marketing/`) que agrupa
   todas las sub-herramientas bajo una navegación propia.
2. **Dashboard de Marketing** ("buenos días"): vista de inicio del módulo, con **saludo
   personalizado por usuario autenticado** ("Buenos días, {nombre}") y tareas del día
   auto-generadas. Es del **módulo/rol de marketing**, no de una persona concreta.
3. **El HUB de marca**: repositorio de logos descargables, fondos/portadas por red,
   plantillas de marca (incluye plantillas de historias de TikTok), framework y herramientas.
4. **Calendario de contenido anual** (fechas Venezuela + China) que alimenta las tareas.
5. **Bandeja de tareas auto-generadas** por el Motor de Noticias y los motores multicanal.
6. **Captura de fricción**: mecanismo para que Fiorella reporte "esto me quita tiempo" →
   cola de automatización para Sam.

**Fuera del alcance (specs propios, este módulo solo los enlaza):**
- Construcción interna del Motor de Noticias (0088) y motores multicanal (0089/0090/0091).
- La academia (0093/0107) y la guía Alibaba (0099).
- La comunidad / Club DTD (0116) y el grupo privado de Facebook de importadores.
- La conexión técnica TikTok→empresa→CRM (tarea de Sam, fuera del módulo).

## Diseño

### Navegación del módulo
Módulo `Marketing` en el shell del Studio, con secciones:
- **Inicio (Dashboard "buenos días")** ← vista por defecto de Fiorella
- **HUB** (marca + herramientas)
- **Calendario** (anual VE/China)
- **Motor de Noticias** → enlaza a 0088
- **Academia** → enlaza a 0093/0107
- **Comunidad** → enlaza a 0116

### Dashboard "buenos días" (la pieza central)
Construido sobre la base de **0114 dashboard-configurable** como vista especializada. Es del
**módulo de marketing** (lo ve quien tenga el rol de marketing), **no de una persona**. El
saludo es **dinámico según el usuario autenticado**: lee el nombre del perfil de la sesión y
muestra *"Buenos días, {nombre}"* (Fiorella hoy, otra persona mañana). Secciones propuestas:

1. **Tareas del día** — auto-generadas por el Motor de Noticias + calendario + motores
   multicanal. Fiorella **revisa y da play** (rol supervisora), no monta desde cero.
2. **Calendario de contenido** — próximas fechas clave (VE + China) y qué publicar.
3. **Cola por red** — TikTok / Instagram / Facebook con sugeridos atomizados de cada noticia.
4. **Pendientes de comunidad** — responder, lives programados, reseñas por conseguir.
5. **Metas / métricas** — interacción, reseñas Google conseguidas, historias de éxito cerradas.
6. **Reportar fricción** — botón "esto me quita tiempo" → cola de automatización de Sam.

### Sincronización Notion ↔ ERP
- El equipo usa **Notion** hoy. El módulo debe **conectar Notion ↔ ERP** (sincronización):
  lo que se hace en el ERP se ve en Notion y viceversa.
- Construcción **conjunta** Sam × Fiorella → requiere dedicación de ella (ver cadencia).

### Principio de automatización
Toda tarea que Fiorella reporte como "me quita tiempo" (edición, montaje de contenido) entra
a una **cola de automatización con IA en el ERP**. Meta: que ella opere como supervisora
("llega, revisa, play").

### Tácticas de contenido que el módulo debe soportar
- **Recepción de mercancía** a inicio de mes, con contenido para todo el mes (sin revelar
  "cómo llegó" el contenido).
- **Storytelling de cajas** (*"esta caja costó $30…"*): abrir caja, mostrar productos **con
  autorización del cliente**, mostrar productos reales de bodega. **No** contenido ficticio.
- Mostrar que **DTD recibe contenedores** (confianza) y que **se vende** (más confianza) →
  **generar la necesidad de venta**.
- **Cerrar historias de éxito** + conseguir **reseñas en Google** (la encuesta): exigir a
  **José y el equipo** que pidan reseñas, idealmente **notas de voz**.
- Referencia de estilo: los creadores que sigue Sam (contenido diario, simple, mucha
  interacción, enfocado en clientes pequeños — *no requieren mucha producción*).

## RBAC · rol `marketing` (IMPLEMENTADO 30-jun-2026)

Decisión del founder: el módulo de marketing debe ser **exclusivo del área**, así que se
creó un **7º rol oficial: `marketing`** (antes solo existían los 6 de SDD-0024). Implementado
en esta misma rama:

- **App layer:** `lib/studio/user-types.ts` (`StudioUserRole` + `STUDIO_USER_ROLES` + label
  "Marketing" + descripción + badge tone `danger`*) · `lib/studio/rbac.ts` (el rol accede a
  `noticias-web`; la entrada del módulo dedicado `marketing` se agrega al registrarlo en
  `modules.ts`).
- **DB:** migración `supabase/migrations/0189_marketing_role.sql` — agrega `marketing` a los
  CHECK de `user_tenants.role` y `user_invitations.role`, a las RPC `studio_invite_user` y
  `studio_change_user_role`, y al CHECK `service_workflow_steps.owner_role` (motor de flujo).
- **UI/i18n:** páginas de Usuarios (counts, matriz de permisos, drawer de invitación) +
  claves `users.role.marketing` en es-VE y zh-CN.
- **Verificación:** `tsc --noEmit` limpio · 58 tests de RBAC en verde.

> *El badge tone quedó en `danger` (rojo) por ser el único tono libre de los 6 oficiales;
> ajustable si el founder prefiere otro.
>
> ⚠️ **Pendiente del Director:** aplicar la migración 0189 a producción (los agentes no
> aplican migraciones). Hasta entonces, asignar el rol `marketing` fallaría el CHECK en DB.

## Cadencia de trabajo (cómo se construye)
- **1 día fijo por semana, 2–3 horas**, Sam y Fiorella sentados construyendo el módulo
  (Fiorella elige el día).
- Fiorella **exige** recursos (Sam lo pidió explícitamente); Sam **facilita y automatiza**.

## Tareas → ver tablero Kanban
Las tareas accionables de esta reunión están en el **tablero Kanban** del módulo:
`docs/specs/0119-modulo-marketing-fiorella/kanban.md` (y su versión interactiva si se genera).

Resumen:
- **Fiorella:** calendario anual (con Sra. Fátima) · organizar comunidad · exigir recursos ·
  arrancar lives · contenido recepción + storytelling de cajas · conseguir reseñas Google ·
  aportar lógica al Motor de Noticias · investigar "ciclo de compras" · elegir día semanal ·
  reportar lo que le quita tiempo.
- **Sam:** conectar TikTok empresa+CRM · construir el HUB · construir el dashboard · conectar
  Notion↔ERP · desarrollar Motor de Noticias · crear academia (Alibaba con expertos) ·
  automatizar lo repetitivo · facilitar 3D.

## Adjuntos
- **Apéndice A** — transcripción completa de la reunión (abajo).
- Transcripción cruda: `assets/transcripcion-kickoff-30jun26.txt`
- Audio original: `Documents/Grabaciones de sonido/REUNION MARKETING FIORELA 30JUN26.m4a`
  (binario >1 MB, fuera de git).

---

## Apéndice A — Transcripción de la reunión (30-jun-2026)

> Transcripción automática (Whisper, modelo `small`, español). Algunas frases vienen
> imperfectas por el audio; se conserva textual como registro de la reunión.

```
Vamos a retomar rápido para que tengas un concepto.
La idea hoy es establecer, bueno, tener un panorama general de qué se quiere con el módulo.
Primero, quiero de ti como persona. ¿Cómo es tu nombre? — Fiorela. — ¿Fiorela qué? — De Vita.
Yo quiero de Fiorela de Vita, que se ponga a hacer cosas, que las cosas funcionen.
O sea, no solamente subir contenido, porque ya lo estamos haciendo con el ERP.
Facilitar el tema de diseño, porque tú no eres diseñador.
Facilitar el tema de establecer cómo va a ser, como los esquemas de... plantillas.
Plantillas de historias de TikTok. Estoy conectando hoy TikTok.
Para editar la aplicación para que sea empresa, para alinearlo con el CRM, con cómo va a ser el CRM,
para que ya pueda yo contestar TikTok qué es lo que nos hace falta.
Tú manejas la comunidad, pero no hay una comunidad para que la manejes. Solamente estás contestando.
Hay una atención al cliente. Para generar la comunidad, requiero de mi parte.
Tú lo requieres de mi parte: exigirme cosas. Que me las exijas.
Esas cosas que vas a exigir es dónde están los cursos de Alibaba. Dónde está la academia que hablamos.
Cómo yo genero una comunidad si no tenemos un canal de Facebook de importadores.
Tú sabes que hacen comunidad en Facebook. Exígeme que hagamos un canal de Facebook privado para los
importadores que se conozcan. ¿Cuál es el problema? Para los cursos, para la academia.
Entonces ahí generas una comunidad. Entonces yo necesito que organices el tema de la comunidad, que es
una de las tareas, para ver qué herramientas me vas a exigir a mí para ayudarte a generarlas en el tiempo.
Entonces esa es una línea del proyecto a mediano plazo.
Regresamos otra vez. Yo te estuve mostrando en el ERP lo que te estoy diciendo que se llama el HUB.
El HUB son cosas que te van a facilitar. El HUB son mis logos, todos descargables.
Necesito el fondo de Facebook. Ahí está. Tú entras al fondo de Facebook. Te vas a bajar.
Estoy creando una red nueva que acaba de salir y me piden un formato. Ahí está. Descarga.
El HUB va a tener todas las plantillas de la marca. Y todas las herramientas.
Aparte el framework, las herramientas son... ya vemos los motores que te van a generar contenido para Insta.
Pero yo tengo otra herramienta, un ejemplo, de noticias. Que es lo que hablé al principio.
La idea del motor de noticias: qué es. Que necesito trabajarlo contigo, porque yo lo estoy haciendo a mi
lógica y necesito tu lógica. Yo estoy contando una noticia, ejemplo, por qué los fletes de China subieron,
en un video. Pero la verdad tiene que nacer desde noticias. ¿Para qué? Yo tengo algo en la página web,
que es www.dtd.com/noticias. Esas noticias hacen SEO, o sea, Google las encuentra. Y aparte hice algo que
se llama GEO, que las IA las encuentren. Entonces cuando la gente quiere buscar "¿por qué subieron los
fletes de China?" nos hayamos nosotros y ese nos conoce. Entonces hay un trabajo para las noticias.
Pero al momento de yo desarrollar esa herramienta me di cuenta: oye, ¿por qué no aprovecho esa noticia
para lanzar otras herramientas, para otras campañas, para otras redes sociales? Entonces dije, chévere.
"¿Por qué subieron los fletes?" me está dando una idea de cómo tiene que ser en TikTok. Pero TikTok tiene
un reglamento. ¿Cuánto continúa con el texto? Mejor lo mandamos a noticias. Entonces te va a dar el
continuo TikTok, el continuo de Instagram, o sugeridos. O sea, te sugiere esto en Instagram, esto en
Facebook, estructurado. Yo te genero una herramienta que esa herramienta te va a dar tareas. ¿Quién hace
esas tareas? ¿Quién le da vida a esa herramienta? Tú. Pero yo no quiero construirlo solo. Me gustaría
construirlo contigo. Entonces listamos a ver cómo. Ingeniamos la idea.
Entonces, ¿qué pasa? Que tú tienes que enfocarte en los dolores, no en la empresa. Ya no me hables más de
la empresa. Ahora te vas a enfocar solamente en los dolores. Como ahorita estamos en pequeños importadores,
todos los dolores son con 500 dólares de compra en China, como que no te estafen en Alibaba. Pero yo ahorita
estoy creando contenido de Alibaba para que estas preguntas sean respondidas rápido. ¿Qué pasa? Que tú no
has comprado en Alibaba. Entonces, como tú no has comprado, ¿cómo le respondes? Le quitas el "mío" al
seguimiento si no tienes la experiencia. Entonces, ¿qué estoy creando? Estoy yendo a buscar expertos en
Alibaba, estoy sacando su contenido, y necesitamos hacer esos videos. Mi tarea ahorita es generarte la
academia para que eso te ayude.
Pero nuestro norte realmente: estructuramos la empresa y definimos que nuestro norte son... el objetivo es
que yo pueda traer dos controles reales que de otra no los vamos a obtener bien. Al yo traer los controles
reales, yo saco mi punta de crédito y estoy ganando dinero. Entonces, para lograrlo, necesito decir: es a
campañas de medianas y pequeñas empresas, no a cliente unidad. Entonces, como yo estoy enfocando mi campaña
sea eso, el speech cambia y los dolores cambian, porque no van a importar con quinientos dólares. Le vas a
decir qué tan importante es el flujo de caja, qué tan importante es la rotación de inventario, qué tan
importante es la compra internacional. En vez de comprar 300 mil dólares y que te lleguen tres meses y que
lo vendas en tres meses pero estés seis meses de daño: oye, haz mínimo, prueba con algo mínimo. Tienes 300
mil dólares de crédito en China, invierte con 50, al otro mes 50; o sea, los 300 mil dividir en seis meses
y te está llegando mensual en la alcancía. Entonces, al hacer ese speech para esos clientes, se van a sentir
identificados con esa información. Le estás despertando al cliente algo que no sabía que le dolía. Es un
dolor que no sabía que tenía. ¿Sabes la diferencia entre los importadores exitosos y los que no? Los que
quieren traer de China 300 mil dólares de un contenedor, cuando los importadores que saben traer, lo que
hacen es poner efectivo su flujo de caja: nada más compran 50 mil, los traen, y los otros tienen rotación
y la alcancía llegando cada mes. Entonces ya le estás despertando a alguien que no estaba enfocado hacia
nuestro norte nuevo. (Estamos en teoría.)
El tema del calendario: necesitas tú ya tener el año de programación completo de fechas. Nosotros nos
sentamos casualmente en el mismo periodo de junta — la señora Fátima — por todo este año, e investigamos
fechas aquí de Venezuela y de China. Tú investigas de dónde está la información. Nosotros tenemos el Notion.
¿Cómo yo ahorita contigo te apoyo para meterlo a tu dashboard de marketing? Yo necesito hacerte un dashboard.
Un dashboard es como una plantilla de "buenos días": todos los días llegas, abres y te va a decir tus tareas.
Yo puedo conectar Notion al ERP. O sea, puedo hacer una conexión para que jale toda la información de Notion,
o lo que hagas aquí se vea en Notion. Pero necesito trabajarlo contigo. Necesito dedicación de tu parte, que
tú y yo construyamos el módulo de ERP marketing. Cada cosa que a ti te tome tiempo en el día, necesito que me
lo digas. ¿Para qué? Para que tú no tengas tiempo perdido en cosas de edición, montar el contenido, sino que
tú vas a ser una supervisora. Llega, revisa el periodo, play. Facilitarte todo para que te dediques a lo que
me interesa que te dediques: hacer lives, estar presente.
Tu diario tiene que recibir mercancía. O sea, recibiste mercancía a principio de mes, pero tienes contenido
para hacer todo el mes (y el siguiente). Pero no muestres cómo llegó el contenido. Mira, hay un cliente que
compró — historias tipo storytelling. El cliente compró, abre una caja, muestra los productos (con la
autorización del cliente), muestra productos que tengamos en la bodega, cosas que llamen. No generes contenido
ficticio, pero el mensaje del video importa. El cliente entra y ve que nosotros estamos recibiendo
contenedores: genera confianza. Y entre más vea que tú estás vendiendo, más genera. Entonces necesito que
generes esa necesidad de venta. Estamos cerrando historias de éxito. Pídele a los clientes que te califiquen
en Google — en la encuesta — que te den reseñas. Exígele a José y a los muchachos que te den reseñas, que
sean notas de voz. Eso es importante para afianzar la confianza de los clientes.
Hay dos personas que yo sigo que me gusta su trabajo. Uno es este chavito de... yo te lo he pasado. Me gusta
porque es así: "esta caja costó 30 dólares", empieza a hablar así, de cosas en diario. Tiene mucha
interacción. Está enfocado en los clientes pequeños. Ese video no necesita mucho trabajo. La cualidad/calidad
es la que estoy haciendo. Necesitas empaparte conmigo, que tomes por lo menos un día a la semana que tú y yo
nos sentemos, dos o tres horitas; escoges el día.
¿Qué tareas te estoy gestionando ahorita? Que no te detenga lo que te tiene detenido respecto a los en vivo;
el lugar que quieres hacer aquí, hazlo. Si Javi no te está haciendo caso, me escribes a mí en privado. Puedes
imprimir también algo del 3D. En la página web hay algo que se llama el ciclo de compras (cotiza, compra,
recibimos en China, entregamos) — es un ciclo repetitivo, el mismo ciclo se replica; lo más difícil es
comenzar. — Sí, yo me puedo poner a investigar todo eso y la próxima semana te digo, señor Sam, mira aquí.
```

---
*Spec generado a partir de la reunión kickoff de marketing (30-jun-2026). Estado: `draft`.
Pendiente: validar con `pnpm docs:check` y regenerar índice con `pnpm docs:index`.*
