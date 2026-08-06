# 03 · El ERP por dentro
### DTD Cargo · documento para el equipo / CRM

> Para qué sirve: que el equipo sepa **qué hace el sistema**, dónde se mira cada cosa y qué
> puede contestarle a un cliente sobre lo que el sistema hace o no hace.
>
> **Dos sistemas distintos, no los confundas:**
> - **Studio** (`dtdcargo.com/studio`) — el ERP **interno**. Lo usa el equipo. 57 módulos.
> - **Portal** (`dtdcargo.com/portal`) — lo que ve **el cliente**. Entra sin contraseña.

---

## 🔴 Regla de acceso

**El Studio no se le muestra a un cliente. Nunca.** Ni capturas de pantalla, ni "mira, acá
aparece tu carga". El cliente ve **su** información desde **su** portal. Ahí están sus envíos,
sus facturas y sus documentos, y solo los de él.

Cada quien ve solo los módulos de su rol. Si un módulo no te aparece, no es un error: es que no
te corresponde.

---

## Studio · los 5 grupos de módulos

### 🚚 OPERACIÓN — sigue el viaje de la carga (19 módulos)

El orden de los módulos **es el orden real del viaje**:

**Visión diaria**
- **Dashboard** — la foto del día
- **Embarques** — cada envío y en qué etapa va
- **Tracking** — seguimiento
- **Calendario** — agenda
- **Bitácora** — actas de reunión y tareas del equipo

**Almacenes** — el recorrido China → Venezuela
- **Almacén CN** (Yiwu) → **Cola de QR** → **Etiquetas CN** → **Almacén VE** (Valencia)

**Tránsito**
- **Naviera & Consolidación** — armado del contenedor
- **Aduana SENIAT** — nacionalización

**Última milla**
- **TMS · Transporte** · **Despacho** (+ sus reglas y dashboard) · **Rutas y ciudades**

**Stock y post-venta**
- **Inventario · WMS** · **Reclamos** · **Inspecciones**

### 💼 COMERCIAL — cliente → CRM → órdenes → catálogo → lealtad (13 módulos)

- **Estimados** — el cotizador interno
- **Clientes** — la ficha de cada cliente y su Shipping Mark
- **Conversaciones** — mensajería
- **CRM · Leads** — los prospectos
- **Kommo CRM** — 👈 **el módulo que más va a usar este equipo.** Sincroniza con Kommo
  (leads, contactos, pipelines). Tiene una pestaña **Recuperación** que arma los enlaces de
  WhatsApp para la campaña de base dormida: seleccionas hasta 10 y te los genera.
- **Órdenes de venta** — lo que le vendemos al cliente
- **PreAlertas de servicios** — las solicitudes de servicio que entra el cliente
- **Compras asistidas** — cuando DTD le compra al proveedor por encargo del cliente
- **Servicios** y **Tarifas** — el catálogo y los precios
- **Fidelización** · **Club DTD** · **Academia · Formación**

### 💰 FINANZAS (12 módulos)

**Dinero diario:** Facturación · Cobranzas · Gastos · Tesorería
**Libros:** Contabilidad · Fiscal · SENIAT
**Análisis:** Costing & Margen · Reportes
**Personas y dirección:** Nómina · RRHH · Rendiciones · Financiero China · Dirección

> 🔒 **Dirección, Rendiciones y Financiero China son solo de administración.** Márgenes y
> costos internos **no salen** de acá.

### 📣 MARKETING (3 módulos)

- **Marketing** — el panel
- **Noticias Web** — publica en `dtdcargo.com/noticias`
- **Documentos** — 👈 **lector de toda la documentación de marketing** dentro del ERP. Se
  actualiza solo. Ahí están los guiones, la estrategia, el embudo, la competencia.

### ⚙️ SISTEMA (10 módulos)

Menciones · Documentos · Mis reportes · Bug Tracker · Operarios PWA · Usuarios ·
Administración · Mailing · Legal · No-Olvidar

> 🐛 **Si algo falla, se reporta en Bug Tracker.** No se arregla por WhatsApp.

---

## Portal del cliente · qué ve él

Entra en `dtdcargo.com/portal` **sin contraseña** (passwordless: le llega un enlace o código).

| Sección | Qué encuentra |
|---|---|
| **Envíos** | Sus embarques y en qué etapa va cada uno |
| **Compras** | Registra una compra nueva y genera las **etiquetas** para el proveedor |
| **Cotizaciones** y **Estimados** | Lo que ha pedido cotizar |
| **Facturas** | Ver, **aceptar**, **reportar el pago** y el comprobante |
| **Finanzas** | Su saldo |
| **Documentos** | Sus archivos |
| **Proveedores** | Sus proveedores registrados |
| **Reclamos** | Abrir un reclamo |
| **Mensajes** y **Soporte** | Hablar con nosotros |
| **Perfil** y **Cuenta** | Sus datos |
| **Academia** · **Club** · **Referidos** | Formación y fidelización |

### Lo que esto significa para tu respuesta

Cuando un cliente pregunta algo que él mismo puede ver, **mándalo al portal** — es más rápido
para todos:

| Pregunta | Respuesta |
|---|---|
| "¿Dónde está mi carga?" | → Envíos, en el portal |
| "¿Cuánto debo?" | → Finanzas / Facturas |
| "Ya pagué" | → que **reporte el pago** desde la factura, en el portal |
| "¿Cómo le mando la dirección a mi proveedor?" | → Compras → genera el enlace y las etiquetas |
| "Quiero reclamar algo" | → Reclamos, en el portal |

---

## Los estados de un envío

Esto es lo que el cliente ve en su portal. Sirve para traducirle en qué va:

| Estado | Qué significa en cristiano |
|---|---|
| Borrador | Todavía no está armado |
| **En bodega** | Llegó a nuestra bodega en China |
| **Consolidando** | Lo estamos juntando con otra carga para el contenedor |
| **Embarcado** | Ya salió |
| **En tránsito** | Navegando |
| **En aduana** | En nacionalización |
| **En bodega VE** | Llegó a Valencia |
| Bodegaje | Está esperando en bodega |
| **En reparto** / **Última milla** | Va camino a su dirección |
| **Entregado** | Listo |
| Alerta | Pasó algo — hay que revisar |
| Cancelado | Se anuló |

---

## El Shipping Mark (MARKBOX)

- Formato **`DTD-XXXX`**. Se genera solo al registrarse.
- **El nombre que se le dice al cliente es "Shipping Mark".** "MARKBOX" es el nombre interno
  que aparece en el sistema y en el CRM — es lo mismo, no lo uses con el cliente.

---

## Lo que el ERP hace hoy y lo que todavía no

**Sí hace:** todo el viaje de la carga, facturación y cobranzas, portal del cliente,
sincronización con Kommo, avisos al cliente, reportes y contabilidad.

**Ojo con prometer:**
- **Transporte terrestre nacional** figura como *"próximamente"*.
- **Seguimiento en tiempo real** no está garantizado para todos los embarques.
- El **registro de marca en China** no tiene alcance comercial cerrado.

> 🔴 **Si un cliente pregunta si el sistema hace algo y no lo ves en este documento, no digas
> que sí.** Di que lo confirmas y escala.

---

*DTD Cargo · uso interno. El registro de módulos sale de `lib/studio/modules.ts`; los estados,
de `lib/shared/shipment-public.ts`. Si un módulo cambió de nombre, manda el aviso — este
documento se actualiza.*
