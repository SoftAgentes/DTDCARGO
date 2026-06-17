# Brief para Cloud Design — Portal del Cliente · Academia DTD

> Handoff **hacia** Cloud Design. Relacionado: SDD-0093. Es la **mitad cliente** del proyecto Academia
> (la mitad Studio + diplomas + facturas va en `cloud-design-brief.md`). Al volver → importar al Norte
> (`docs/design/studio/_norte/`) y construir sobre `app/portal/(app)/academia/`.

**Qué necesitamos:** el diseño del **área de Academia dentro del Portal del Cliente** de DTD — la experiencia
del **alumno**. Es lo que ve el cliente cuando entra a su portal y abre "Academia". Mobile-first (el cliente
entra desde el teléfono).

**Filosofía (que guíe el diseño):** la Academia es el **anzuelo** que convierte alumnos en clientes del
**servicio logístico DTD**. El portal debe lograr 2 cosas: (1) hacer sentir al alumno que **avanza y logra**
(progreso + diplomas), y (2) empujarlo suave al **siguiente nivel** y al **servicio DTD / Club**. La marca es
**Academia DTD** — nunca una cara personal.

## Pantallas a diseñar

**1. Gate de miembro (no-miembro).** Si el cliente no tiene cursos ni diplomas → pantalla cálida
**"Aún no eres miembro de la Academia DTD"**: pitch corto del valor (aprende a importar de China, con la
operación real de DTD detrás) + vista de los **próximos cursos** + CTA (**Inscribirme** / **Hablar con un
asesor**). Es el momento de conversión — que invite, no que frustre.

**2. Inicio del alumno (miembro).** *"Hola [nombre], tu Academia."*
- **Mis cursos en progreso** — tarjetas con barra de progreso (%) + "Continuar".
- **Siguiente recomendado** — el próximo curso del value ladder (Curso 0 → 1 → 2 → 1688).
- **Mis diplomas** — vitrina de logros (los ganados).
- **CTA al servicio DTD** — *"¿Listo para importar de verdad? DTD te trae la carga."* (el puente al negocio).

**3. Detalle del curso.** Módulos → lecciones con estado (visto / pendiente), progreso del curso, recursos
descargables, botón "Continuar donde quedaste". Las **lecciones preview gratis** marcadas (visibles antes de
inscribirse).

**4. Reproductor de lección.** Video + **"Marcar como completada"** + lista de lecciones (anterior/siguiente)
+ recursos de la lección + notas del alumno. Al completar la última lección → **celebración + diploma**.

**5. Mis diplomas.** Los diplomas ganados (las **4 variantes** de diseño), **ver + descargar PDF** + link de
**verificación pública** (`/verificar`) + compartir. Celebrar el logro con dignidad (sin "¡Genial! 🎉").

**6. Próximos cursos / cohortes.** Catálogo "Próximamente" + calendario de **cohortes en vivo** + CTA
inscribirme. El precio aparece cuando Administración lo fije (hoy en $0).

**7. (Futuro — esbozar como fase 2) Club DTD / comunidad.** Espacio de membresía: compra grupal, eventos,
"proveedor del mes". Solo dejarlo bosquejado para cuando se construya.

## El hilo (que el diseño lo haga sentir)
miembro → **aprende** (progreso) → **completa** → **diploma** (logro) → *"ahora hazlo de verdad con DTD"*
(servicio) → **Club**. Cada pantalla cierra empujando un paso adelante.

## Reglas de marca/sistema (respetar el Norte)
- Solo tokens `var(--*)` · fuentes **Nunito Sans** (cuerpo) + **Sora** (títulos), **Archivo** solo branding ·
  **JetBrains Mono** para códigos (folio del diploma).
- Cero AI slop (sin gradientes coloridos, glassmorphism, emojis decorativos).
- Componentes del sistema primero (Card, Badge, **Progress**, KPI, Tabs, EmptyState).
- Copy castellano VE **tuteo**, cálido pero directo. Celebrar el logro sin caer en exclamaciones ni emojis.
- Diplomas: mantener las **4 variantes + sello + QR** a `dtdcargo.com/verificar`.
- Marca **Academia DTD** al frente (logo/sello DTD), no una persona.

## Datos reales (el cableado ya existe en el ERP)
- Miembro = el cliente tiene ≥1 **inscripción** o **diploma** (scope por `client_markbox`).
- Cursos: 4 (Curso 0 gratis · Domina Yiwu · De 0 a Contenedor en 4 Semanas · MasterClass 1688), con sus
  módulos. Lecciones con `free_preview`, video, recursos.
- Diplomas: folio único + verificación pública.

## Entregable
Las pantallas del **Portal · Academia** (gate, inicio, detalle de curso, reproductor, mis diplomas, próximos
cursos, esbozo Club) en estilo Norte, **mobile-first**, listo para importar al Norte y construir sobre
`app/portal/(app)/academia/`.
