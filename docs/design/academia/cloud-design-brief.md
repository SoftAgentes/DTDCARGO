# Brief para Cloud Design — Academia DTD (un solo proyecto)

> Handoff **hacia** Cloud Design (no es material recibido). Relacionado: SDD-0093. Al volver el diseño →
> importar al Norte (`docs/design/studio/_norte/`) y construir.

**Objetivo:** unificar y extender en **UN SOLO PROYECTO** los módulos que Cloud Design ya tiene (**Academia** +
**Diplomas**) hasta cubrir todo el ciclo de la Academia DTD, listo para importar al Norte y construir en el ERP.

**Filosofía que guía el diseño:** la Academia es el **anzuelo de captación**, no un negocio de cursos. Todo el
flujo empuja suave del aprendizaje al **servicio logístico DTD** (DDP + recompra) y a la comunidad. La marca es
la estrella; el facilitador/cara es vocero, no protagonista.

## Lo que ya existe (reusar/unificar)
- Academia: cursos/eventos → inscritos → asistencia (≥75% aprueba) → emisión de diplomas.
- Diplomas: 4 variantes + sello + QR a `dtdcargo.com/verificar`.

## A diseñar — 3 frentes + el hilo que los conecta

### 1) Academia (Studio/ERP) — dos capas
- **Catálogo on-demand:** los cursos como producto. Tarjetas con estado (Próximamente / Publicado). Detalle:
  módulos → lecciones (video/texto/descarga), duración, recurso descargable, **1-2 lecciones preview gratis**,
  barra de progreso. Editor para crear/ordenar módulos+lecciones y subir video.
  - **Títulos de los cursos:** **Curso 0 · "Importar desde China: Guía Rápida para Venezolanos"** (GRATIS,
    lead magnet) · **Curso 1 · "Domina Yiwu: De la Pantalla al Contenedor"** · **Curso 2 · "De 0 a Contenedor
    en 4 Semanas"** (con sesiones en vivo) · **MasterClass 1688 · "Compra como los chinos"**.
  - **Precio:** lo fija **Administración** (rol contable), NO la Dirección → diseñar el campo de precio
    **gateado por rol** (el Director gestiona el contenido, no el precio). El curso se registra como servicio
    del catálogo, ligado a una cuenta de ingresos.
- **Cohortes en vivo (ya existe):** programar cohorte → inscritos → asistencia → diplomas.

### 2) Portal del cliente · Academia (NUEVO, UI amena)
- Sección **"Academia"** dentro del portal del cliente.
- **Gate de miembro:** si NO tiene cursos/diplomas → pantalla cálida **"Aún no eres miembro de la Academia
  DTD"** + CTA (inscribirme / hablar con un asesor).
- **Si es miembro:** **Mis cursos** (tarjetas con progreso, "continuar") · **Mis diplomas** (ver + **descargar
  PDF**) · (opcional) próximas cohortes / Club.
- Celebra el logro (el diploma), invita al siguiente nivel y al servicio DTD.

### 3) Facturas de cursos (NUEVO, conectar con Facturación)
- La factura de un curso: línea (nombre del curso), monto, método de pago.
- Pago flexible: USD + **bolívares (tasa preferencial)**, Zelle, transferencia, cuotas.
- Se contabiliza a "Otros ingresos por servicios".
- Flujo: comprar curso → factura → acceso en el portal → completar → diploma.

### El hilo (diseñar el flujo completo)
catálogo → compra/inscripción → **factura** → acceso en **portal (mis cursos)** → completar → **diploma**
(portal + verificación pública) → CTA al **servicio DTD / Club**.

## Reglas de marca/sistema (respetar el Norte)
- Solo tokens `var(--*)` · fuentes Nunito Sans + Sora (sistema), Archivo (branding), JetBrains Mono (códigos).
- Cero AI slop (sin gradientes coloridos, glassmorphism, emojis decorativos).
- Componentes del sistema primero (Card, Badge, Table, KPI, Drawer, Tabs, Progress, EmptyState).
- Copy castellano VE **tuteo**, verbos directos. Terminología "Shipping Mark", DDP "Pagas al llegar".
- Diplomas: mantener las 4 variantes + sello + QR.

## Entregable
Un proyecto único (estilo Norte) con las pantallas de los 3 frentes + el flujo conectado, listo para importar
al Norte y construir.
