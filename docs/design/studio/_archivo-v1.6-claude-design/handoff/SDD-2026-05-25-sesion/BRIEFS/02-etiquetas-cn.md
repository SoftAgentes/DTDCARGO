# Brief · Etiquetas suppliers CN (v1.4 + v1.4.1)

> Plancha PDF bilingüe ES/中文 con MARKBOX + Box X/Y + QR mock para que el cliente DTD-Cargo (o el admin) la mande al supplier chino antes del despacho a almacén CN.

---

## Problema y para quién

Los suppliers chinos reciben pedidos de múltiples freight forwarders. Sin una etiqueta clara en la caja, las cajas llegan al almacén CN como "huérfanas" (sin MARKBOX visible) y no se pueden asociar a un cliente DTD-Cargo. Eso bloquea la consolidación LCL y demora todo el flujo.

**Resuelve:**
- Cliente DTD-Cargo necesita una forma rápida de imprimir etiquetas para mandarle al supplier antes del despacho
- Admin DTD-Cargo necesita lo mismo para clientes que no usan portal directo (clientes "B2B clásicos")
- Supplier chino necesita etiquetas bilingües con info clara en mandarín del destino + contacto del almacén

### Roles servidos

| Rol | Acceso |
|---|---|
| **Cliente DTD-Cargo** | Vía portal (futuro) o pedirle al admin que se las mande por WhatsApp/Email |
| **Admin DTD-Cargo (ERP)** | Sidebar OPERACIÓN → "Etiquetas CN" · genera, descarga PDF, manda al supplier por Compose o copy al portapapeles para WeChat |
| **Supplier chino** | Recibe el PDF · imprime · pega en cada caja antes del despacho |
| **Almacén CN DTD-Cargo** | Escanea el QR mock al recibir (futuro · hoy lee MARKBOX visualmente) |

---

## Flujo end-to-end

```
[1] Admin abre sidebar OPERACIÓN → "Etiquetas CN"

[2] Configura en panel izquierdo:
    - Cliente (selector de D.CLIENTS) → muestra MARKBOX
    - Supplier opcional (selector D.SUPPLIERS) → auto-sugiere almacén CN por ciudad
    - Almacén CN destino (YIW-A1 / GZ-B2 / SZ-C1)
    - Box inicial (X) + Total cajas (Y)
    - Etiquetas por caja (×1 / ×2 / ×3 / ×4) · default ×2
    - Formato papel (A4 8-up / A4 4-up / térmico 100×150 / térmico 100×100)
    - Toggle "Incluir QR" (default ON)

[3] Preview en panel derecho actualiza en vivo
    - Etiquetas mostradas en tamaño real (mm)
    - Paginación visual con sombra de papel
    - Header con conteo + páginas + badge del formato

[4] Click "Imprimir / Guardar PDF"
    → window.print() · @page { size: ${w}mm ${h}mm; margin: 0; }
    → diálogo del navegador · usuario elige "Guardar como PDF"
    → PDF descargado con el tamaño exacto

[5] Click "Mensaje al supplier" (opcional)
    → modal con 2 textos bilingües ES + 中文
    → Botón "Copiar" en cada uno (para WeChat)
    → Botón "Abrir en Compose" → wire a window.openQuickEmail({to: supplier.email, body: ES+CN, subject})
```

---

## Reglas de negocio

### Copias por caja (v1.4.1)

**Trazabilidad redundante:** durante la descarga del contenedor en VE, una sola etiqueta por caja puede taparse con otra caja, romperse al manipular o mancharse. Pegando 2-4 copias en distintas caras de la misma caja se garantiza la trazabilidad.

- Las copias son **idénticas** (mismo MARKBOX, mismo Box X/Y, mismo QR)
- **No se marcan "copia 1 de 3"** porque las cajas se descargan en orden arbitrario
- Default `×2` (recomendado · una en cara superior, otra en cara lateral)
- `×4` para cargas críticas (industrial pesado, frágil)

### Formato bilingüe (todas las etiquetas)

| Sección | Español | 中文 |
|---|---|---|
| Header | SHIPPING TO · DTD-CARGO | 寄至：DTD-Cargo 国际货运 |
| MARKBOX eyebrow | MARKBOX | 货主代码 |
| Caja | BOX | 箱号 |
| Footer | (dirección almacén CN) | 收货地址 |

### Auto-sugerencia de almacén CN por ciudad del supplier

| Ciudad supplier | Almacén default |
|---|---|
| Yiwu | YIW-A1 |
| Guangzhou | GZ-B2 |
| Shanghai | GZ-B2 |
| Shenzhen | SZ-C1 |
| otra | YIW-A1 (fallback) |

Editable después: el dropdown del almacén destino permite cambiarlo manualmente.

### QR mock (no escaneable real)

Generado deterministicamente del string `DTD:{markbox}|{boxIndex}/{totalBoxes}` con PRNG seedeada por hash djb2. 21×21 cells con 3 finder patterns en esquinas (TL/TR/BL). **Visual:** parece un QR real. **Funcional:** no decodifica con app de QR estándar — es solo para demos y mockups.

**TODO post-port:** sustituir por librería real (`qrcode-svg` o `qr-image`) que genere QR escaneables.

---

## Permisos por rol

Cualquier usuario con acceso al ERP puede generar etiquetas para cualquier cliente (no hay restricción adicional). En prod debería filtrarse por tenant + rol.

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Total cajas = 1 | Resumen dice "1 caja × 2 copias = 2 etiquetas" |
| Box inicial > Total | Botón "Imprimir" deshabilitado · mensaje "Box inicial debe ser ≤ Total" |
| Total cajas > 200 | Capeado a 200 (suficiente para LCL grandes) |
| Cliente sin company | Solo se muestra `name` en la etiqueta |
| Sin supplier seleccionado | Modal "Mensaje al supplier" usa saludo genérico "Hola equipo" |
| Sin QR (toggle OFF) | Layout se ajusta: MARKBOX ocupa todo el ancho izquierdo |

---

## Dependencias

- **Provider:** lee de `window.ERPData.CLIENTS` + `window.ERPData.SUPPLIERS` (seed)
- **Consumer:** wire a `window.openQuickEmail` (modal de Compose existente)
- **Print:** `window.print()` con `@page` CSS · NO necesita librería externa de PDF
- **Sin bridge:** la feature es pura lectura, no escribe al bridge

---

## Archivos

| Archivo | Líneas |
|---|---|
| `nuevo/modules/label-generator.jsx` | ~770 |
| Modificación `erp/shell.jsx` | 1 entry sidebar |
| Modificación `DTD Studio · ERP.html` | 2 líneas (script + moduleMap) |
