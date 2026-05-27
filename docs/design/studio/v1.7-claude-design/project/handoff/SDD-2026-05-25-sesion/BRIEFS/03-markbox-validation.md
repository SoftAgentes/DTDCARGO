# Brief · MARKBOX validation server-side (v1.5)

> Helpers en `window.DTDData` para validar formato + unicidad + generar secuenciales defensivos del código MARKBOX de cliente DTD-Cargo.

---

## Problema y para quién

Hasta v1.4 el flujo de registro (`portal/registro.jsx`) generaba MARKBOX inline con `max + 1` directamente contra `clients.read()`. Problemas:

- **Sin validación de formato**: nada impedía que un MARKBOX terminara siendo `DTD-1` (3 dígitos), `DTDX-5500` (typo), o `dtd-5500` (lowercase).
- **Sin check de unicidad robusto**: si dos tabs abrían el flujo simultáneamente y ambos pedían `nextMarkbox`, podían colisionar.
- **Lógica duplicada**: cualquier feature futura que necesite asignar MARKBOX (admin → Clientes → Crear, import bulk, API REST) tendría que re-implementar la lógica.

**Resuelve:** centralizar la lógica en el bridge para que CUALQUIER consumidor (portal registro, admin crear cliente, futuro endpoint API, import CSV) la use.

### Roles servidos

| Rol | Acceso |
|---|---|
| **Cliente final** (portal registro) | Indirecto · ve un MARKBOX válido garantizado |
| **Admin DTD-Cargo** | Indirecto · al crear cliente desde ERP también usa el helper |
| **Sistema** (cualquier código JS del ERP) | `window.DTDData.{validateMarkboxFormat, isMarkboxUnique, nextMarkbox}` |

---

## Flujo end-to-end

```
[1] Frontend (portal registro o admin crear) llama:
    → window.DTDData.nextMarkbox()

[2] Helper:
    a. Lee allKnownMarkboxes() = bridge.clients ∪ seed.ERPData.CLIENTS
    b. Calcula max = max(parseInt(m.replace('DTD-','')))
    c. Para i in 1..10:
       candidate = `DTD-${max + i}`
       if validateMarkboxFormat(candidate) && !known.has(candidate):
         return candidate
    d. Fallback: `DTD-${max + 1}` (extremadamente improbable que se ejecute)

[3] Frontend valida defensivamente:
    if (!validateMarkboxFormat(newMarkbox))
      → fallback random + console.error

[4] Frontend persiste:
    bridge.clients.write([newClient, ...prev])
    → newClient.markbox queda con el código validado
```

---

## Reglas de negocio

### Formato oficial MARKBOX

**Regex:** `/^DTD-\d{4,5}$/`

- Prefijo literal `DTD-`
- 4 o 5 dígitos (rango operativo actual: 5000-99999)
- Sin letras adicionales, sin lowercase, sin espacios
- Ejemplos válidos: `DTD-5452`, `DTD-99999`, `DTD-5500`
- Ejemplos inválidos: `DTD-1` (3 dígitos), `DTDX-5500` (prefijo malo), `dtd-5500` (lowercase), `DTD- 5500` (espacio)

### Unicidad

- Check contra **dos fuentes**: bridge `dtd-clients` (clientes registrados durante la sesión) ∪ seed `window.ERPData.CLIENTS` (data legacy del repo Next.js).
- En prod: contra tabla `clients` del backend via API REST.

### Secuencial defensivo

- Empieza desde **5500** (baseline conservador para no colisionar con seed legacy que tiene IDs en rango 5215-5452).
- Retry de hasta **10 candidatos** si alguno colisiona (race condition).
- Fallback **siempre devuelve un string válido**, nunca tira excepción.

---

## State machine

N/A · funciones puras sin estado.

---

## Permisos por rol

Las helpers son **read-only public** · cualquier JS puede llamarlas. No hay protección por rol (es lógica de generación, no de modificación de datos).

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Bridge sin clients y seed vacío | Devuelve `DTD-5500` (baseline) |
| Bridge con cliente que tiene MARKBOX inválido (legacy data dirty) | Lo ignora · `parseInt('DTDX-1234'.replace('DTD-',''))` = NaN |
| Race condition (dos tabs piden simultáneamente) | El primero gana · el segundo retry con +1 hasta encontrar libre |
| Llamado con formato inválido (`isMarkboxUnique('XYZ')`) | Devuelve `false` (no es único porque no es válido) |
| Bridge offline (localStorage error) | `clients.read()` devuelve `[]` (defaultValue) · helper sigue funcionando contra seed |

---

## Dependencias

- **Lee de:** `window.DTDData.clients` (bridge) + `window.ERPData.CLIENTS` (seed)
- **Llamado por:** `portal/registro.jsx` `submit()` (hoy) · futuro: `erp/modules/clients.jsx` create form · import bulk CSV
- **No escribe a:** nada · es lógica pura

---

## Archivos

| Archivo | Líneas |
|---|---|
| `erp/data-bridge.jsx` | ~58-110 (helpers nuevos) |
| `portal/registro.jsx` | ~52-65 (consume helper) |
