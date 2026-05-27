# Brief · Cross-links del drawer Cliente (v1.5 · quick win)

> 2 botones ghost nuevos en el drawer detalle del módulo Clientes: "Estado de cuenta" y "Etiquetas". Conectan el detalle de cliente con 2 features que ya existen pero no estaban accesibles desde acá.

---

## Problema y para quién

Al hacer click en una fila de la tabla Clientes, el drawer abre con datos del cliente + 3 botones: Email · Editar · Nueva cotización. Pero ya existen 2 features útiles desde el contexto del cliente que **no estaban accesibles**:

1. **Estado de cuenta detallado** (v1.1 · `nuevo/pantallas/estado-cuenta.html`): vista profunda con aging, balance corrido, métodos de pago, contacto facturación, condiciones de crédito. Hay que abrirla manualmente con un URL filtrado por `?id={markbox}`.
2. **Generar etiquetas suppliers CN** (v1.4 · módulo Etiquetas CN): el flujo natural es "voy al detalle del cliente → necesito mandarle etiquetas a su supplier chino". Hoy hay que ir a sidebar OPERACIÓN → Etiquetas CN → seleccionar de nuevo el cliente.

**Resuelve:** atajos directos desde el contexto donde el admin ya está parado.

### Roles servidos

| Rol | Beneficio |
|---|---|
| **Admin / Account manager** | Workflow más rápido · 1 click vs 3 |
| **Cobranza** | Acceso directo al estado de cuenta del cliente desde donde está |

---

## Flujo end-to-end

```
[1] Admin abre módulo Clientes
[2] Click fila → drawer detalle abre
[3] Header actions row tiene 5 botones ahora:
    [ghost] Estado de cuenta · [ghost] Etiquetas
    [secondary] Email · [secondary] Editar
    [primary] Nueva cotización

[4a] Click "Estado de cuenta"
     → window.open('nuevo/pantallas/estado-cuenta.html?id=DTD-5452', '_blank')
     → abre en pestaña nueva (no pierde el contexto del ERP)
     → estado-cuenta.jsx lee ?id= y filtra ACCOUNT_PROFILES

[4b] Click "Etiquetas"
     → goTo('labels', detailRecord.markbox)
     → cambia activeMod al módulo Etiquetas CN
     → selectedId se pasa como prop a ModuleLabelGenerator
     → el useState inicializa con selectedId || D.CLIENTS[0].markbox
     → cliente queda preseleccionado en el dropdown
```

---

## Reglas de negocio

- Los 2 botones usan variant `ghost` (más sutiles que los primary/secondary) para no robar atención de la acción principal "Nueva cotización".
- Aparecen **antes** de "Email" en la fila de actions, en orden de uso esperado (info → comunicación → edición → creación).
- Cada cliente tiene `markbox` (FK al módulo etiquetas) y `id` URL-safe (el MARKBOX `DTD-XXXX` ya lo es).

---

## State machine

N/A · son navegaciones.

---

## Permisos por rol

Quien pueda abrir el drawer detalle de Clientes puede usar ambos botones. Es decir: cualquier rol con acceso a módulo Clientes (no comercial-only).

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Cliente sin MARKBOX (edge case legacy) | `detailRecord && ...` guard previene crash · botón clickeable pero abre con `?id=undefined`. Pantalla estado-cuenta muestra "Cliente no encontrado" |
| Pestaña nueva bloqueada por popup blocker | `window.open` devuelve `null` · sin feedback al usuario. **TODO:** detectar y mostrar toast "Permití popups para abrir estado de cuenta" |
| Módulo Etiquetas CN no cargado (deshabilitado por feature flag) | `goTo('labels', ...)` falla silenciosamente (el moduleMap no tiene la key) · activeMod queda en 'labels' pero render muestra EmptyState "Módulo no encontrado" |

---

## Dependencias

- **Lee de:** `detailRecord` (state local del módulo Clientes)
- **Llama a:** `goTo('labels', markbox)` (helper del shell) + `window.open(url, '_blank')` (native)
- **Requiere:**
  - Módulo Etiquetas CN cargado y en moduleMap (v1.4)
  - `nuevo/pantallas/estado-cuenta.html` existente (v1.1)

---

## Archivos

| Archivo | Líneas |
|---|---|
| `erp/modules/clients.jsx` | ~131 (drawer actions extendido) |
