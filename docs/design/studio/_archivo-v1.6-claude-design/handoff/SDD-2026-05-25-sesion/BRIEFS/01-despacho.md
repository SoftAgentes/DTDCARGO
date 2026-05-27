# Brief · Módulo Despacho (legacy v1.0/v1.1)

> Módulo de coordinación de salida de mercancía desde bodega VE hasta entrega final puerta-a-puerta. Conecta 3 roles (Admin/Oficina · Bodeguero VE · Transportista VE) sobre un pipeline compartido de Órdenes de Despacho (ODs).

---

## Problema y para quién

DTD-Cargo recibe cajas en bodega VE (Valencia/La Guaira/Punto Fijo) que pasaron por CN → tránsito → SENIAT → bodega VE. Cada caja está asociada a un MARKBOX y tiene HS code + descripción + estado de pago. Falta el último tramo: sacar la caja de bodega y entregarla.

Antes del módulo eso se hacía por Excel + WhatsApp. Problemas:
- Bodeguero no sabe qué cargar primero (¿cliente viejo? ¿que pagó? ¿cerca?)
- Admin no sabe qué camión asignar a qué ruta sin comparar capacidad vs peso en su cabeza
- Chofer no sabe en qué orden visitar ni tiene la foto de la fachada
- Cuando algo sale mal, no queda registro

### Roles servidos

| Rol | Qué obtiene |
|---|---|
| **Admin / Oficina (ERP)** | Cola priorizada · motor de reglas · asignación a flota con capacity bar · panel de ODs activas en vivo · cancel con motivo |
| **Bodeguero VE (mobile)** | Home post-cierre · 2 sub-modos (Despachar LIFO / Recibir mercancía) · escáner mock · carga fraccionada P1/P2 · bloque SENIAT |
| **Transportista VE (mobile)** | Ruta del día · GPS · card de entrega con foto fachada · Llamar/WhatsApp con un tap · POD bottom-sheet (foto+firma) |
| **Cliente final** | Notificación ETA · tracking del último kilómetro (read-only, futuro portal) |

---

## Flujo end-to-end

```
[1] Caja llega a bodega VE
    → cn.jsx · liberarADespacho() → DTDData.cnInbox

[2] Admin abre Vista 1
    → lee cnInbox + scoring por rules → cola desc
    → reordena manual (drag&drop)

[3] Admin selecciona N paquetes + "Crear OD"
    → modal asignación (ruta + camión + chofer)
    → capacity bar peso/volumen en vivo
    → fits? → DTDBridge.publish({id, status:'creada', ...})

[4] Bodeguero ve banner "OD recibida"
    → sub-modo "Despachar al camión" (LIFO)
    → escáner mock 2.4s detecta MARKBOX
    → packing list local actualiza
    → carga fraccionada P2 si no entra (motivo obligatorio)
    → "Cerrar carga" → DTDBridge.advance(id, 'lista')

[5] Transportista ve banner "OD recibida"
    → GPS ON · foto fachada en card de entrega
    → POD modal (foto + firma)
    → última POD → DTDBridge.advance(id, 'entregada')

[6] Admin ve la OD pasar a entregada en vivo
    → "Cerrar día" → status 'cerrada' (terminal)
```

---

## Reglas de negocio

### FIFO vs LIFO

| Lado | Política | Por qué |
|---|---|---|
| Bodega VE → camión | **LIFO** | Última ciudad de la ruta se carga primero al fondo, primero en bajar |
| Recepción CN → bodega CN | **FIFO** | No acumular indefinidamente; el scoring penaliza por antigüedad |
| Cola admin (Vista 1) | **Score-based** | Mezcla FIFO + pago + VIP + ciudad + cercanía a ruta |

### Motor de scoring (configurable en Vista 2)

Score 0-100 · pesos default:
- Pago completo: **30**
- Abono: **15**
- FIFO antigüedad: **0-15 lineal** (saturado a 21 días)
- Cliente VIP (Gold/Platinum): **10**
- Cercanía a ruta del día: **0-5**
- Ciudad principal (Valencia/Caracas): **40**

Niveles: ≥80 Crítico (rojo) · ≥65 Alto (wine) · ≥45 Medio (dorado) · <45 Bajo

### "Pago primero" anclada (política maestra · no se puede apagar)

3 modos:
- **Estricto** · solo pagado aparece en cola
- **Hold** · no pagados greyed-out y bloqueados
- **Crédito con whitelist** · clientes elegibles pueden despacharse sin pago

### Capacity bar

```
kgUse  = totalKg  / truck.capacityKg
cbmUse = totalCBM / truck.capacityCBM
overflow = kgUse > 1 || cbmUse > 1
```

Si overflow → botón "Confirmar OD" deshabilitado + badge rojo.

### Sello QR (escáner mock)

Cada caja tiene MARKBOX + secuencial Box X/Y. QR encodea `DTD:DTD-XXXX|1/12`. Bodeguero escanea → match contra packing list → tilda. Si no está en packing → warning.

### Carga fraccionada P1/P2

- **P1** (sale): queda en OD actual.
- **P2** (queda): genera **2da OD nueva** con status `creada` y sin camión/chofer.
- Motivo obligatorio: `falta_volumen` / `cliente_pidio_esperar` / `daño_caja` / `documentacion_pendiente` / `otro`.

---

## State machine de la OD

```
creada → cargando → lista → en-ruta → entregada → cerrada (terminal)
   │
   └→ cancelada (terminal, desde cualquier estado != cerrada/entregada)
```

| De | A | Trigger | Quién |
|---|---|---|---|
| `creada` | `cargando` | bodeguero abre app | Bodeguero |
| `cargando` | `lista` | "Cerrar carga" | Bodeguero |
| `lista` | `en-ruta` | "Iniciar ruta" | Transportista |
| `en-ruta` | `entregada` | última POD confirmada | Transportista |
| `entregada` | `cerrada` | "Cerrar día" | Admin |
| `*` | `cancelada` | confirm + motivo | Admin |

**Prohibido:** `lista→cargando`, `cancelada→*`, `cerrada→*`.

---

## Permisos por rol

| Acción | Admin | Bodeguero | Transportista |
|---|---|---|---|
| Ver cola pendientes | ✓ | parcial (su hub) | ✗ |
| Crear OD / Asignar camión | ✓ | ✗ | ✗ |
| Configurar reglas (V2) | ✓ | ✗ | ✗ |
| Editar rutas | ✓ | ✗ | ✗ |
| Cancelar OD | ✓ | ✗ | ✗ |
| Cargar / escanear cajas | ✗ | ✓ | ✗ |
| Cerrar carga | ✗ | ✓ | ✗ |
| Marcar P2 | ✗ | ✓ | ✗ |
| Iniciar ruta / GPS | ✗ | ✗ | ✓ |
| Confirmar POD | ✗ | ✗ | ✓ |
| Reportar incidencia | ✓ | ✓ | ✓ |

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Excede capacidad | Botón "Confirmar OD" deshabilitado · banner rojo |
| Chofer no contestó | Modal "Contactar chofer" con Llamar/WhatsApp/Push |
| P2 sin motivo | Botón deshabilitado hasta elegir motivo |
| Contenedor CN incompleto | Sale igual con flag `incomplete: true` + warning amarillo |
| Incidencia en ruta | Push al ERP · admin reasigna vía `DTDBridge.reassign` |
| Cancelar OD post-carga | Cajas vuelven al inbox automáticamente |
| GPS apagado | Push overlay automático · si pasan 3 min, push al admin |
| POD sin foto/firma | "Confirmar" deshabilitado hasta tener ambos |
| Cliente ausente | Marca "Re-entrega pendiente" · vuelve a cola próximo día |

---

## Dependencias

- **Provider:** lee de `cn.jsx` (cnInbox), `data.jsx` (TRUCKS, DRIVERS, CLIENTS), `admin-routes.jsx` (rutas), `despacho-rules.jsx` (rules)
- **Consumer:** bodeguero + transportista suscriben a `DTDBridge`
- **Sin dependencias:** módulos viejos no rotos (shipments, tracking, calendar quedan intactos)

Ver `DATA-MODEL.md` y `CONNECTIONS.md` para shapes + cross-module map exhaustivo.
