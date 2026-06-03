---
sdd: "0031"
title: "Etiquetas suppliers CN · PDF bilingüe ES/中文 + QR mock + copias por caja"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0008", "0010", "0029"]
confidencialidad: interno
---

# DTD-0031 — Etiquetas para suppliers CN

> **Fase 3a del bundle Claude Design v1.6** (releases v1.4 + v1.4.1).
> Generador de planchas PDF bilingües ES / 中文 con MARKBOX + Box X/Y +
> QR mock + 4 formatos + control de copias por caja (×1-×4). UI-only,
> sin schema ni server actions. Pure client-side print via `window.print()`
> con `@page` en mm reales.

---

## 1. Resumen en una línea

`/studio/etiquetas` deja al admin elegir un cliente del tenant, configurar
total de cajas + box inicial + copias por caja + formato de papel +
toggle QR, ver el preview en vivo y exportar PDF con el diálogo nativo
del navegador. Bonus: modal "Mensaje al supplier" con texto ES + 中文
listo para copiar al portapapeles y mandar por WeChat / email.

---

## 2. Scope

### Incluye

- Página `/studio/etiquetas` server component que fetcha:
  - Clientes del tenant (`public.clients` con `markbox + name + company`)
  - Catálogo `warehouses_cn` (3 hubs YIW-A1 / GZ-B2 / SZ-C1 ya seedados
    en SDD-0008) para mostrar dirección + WeChat del destino en cada etiqueta
- Componentes client:
  - `LabelGeneratorClient` · orquestador con state + panel config + preview
  - `Label` · etiqueta individual con header bilingüe + MARKBOX + QR + Box X/Y + footer warehouse
  - `QrMock` · QR procedural (PRNG djb2 + 21×21 grid + 3 finder patterns) — visualmente parece QR real pero NO escanea
  - `SupplierMessageModal` · 2 textareas (ES + CN) con botón copy al clipboard + botón mailto
- Print stylesheet con `@page` size en mm dinámico según formato
- Sidebar entry "Etiquetas CN" en OPERACIÓN (después de "Almacén CN")
- Preselect via `?id=<markbox>` query param (cross-link desde Clientes drawer llega en SDD-0032)

### Fuera de scope

- Tabla `suppliers_cn` en DB · el selector de supplier en este SDD es **input libre** (nombre contacto + ciudad + WeChat). Cuando exista SDD de suppliers, reemplazo por dropdown.
- QR escaneable real · queda mock. Cuando se valide el módulo y haya volumen real, sustituir por librería `qrcode-svg` o equivalente.
- Cross-link "Etiquetas" en `/studio/clientes` drawer · va en SDD-0032 junto con los otros cross-links + MARKBOX validation + email bienvenida.
- Wire al modal Compose (`window.openQuickEmail`) · queda como `mailto:` link. El wiring real llega con SDD-0034 (DTDWiring modals).

---

## 3. Decisiones de diseño

### D1 · Print PDF nativo, sin librería

Usamos `@page { size: WWmm HHmm; margin: 0 }` + `window.print()`. El usuario elige "Guardar como PDF" en el diálogo del browser. Cero dependencias.

Alternativas descartadas:
- `pdfmake` / `jspdf` · ~250 KB de JS extra; sin beneficio real para una plancha estática.
- Server-side render con headless Chrome · overkill para algo que el navegador hace nativo.

Trade-off: el usuario no puede customizar el PDF post-generación (firma, watermark). Si se necesita, abrir un SDD nuevo con generador server-side.

### D2 · 4 formatos hardcodeados

A4-8up · A4-4up · térmico 100×150 · térmico 100×100. Cubre los casos reales (Avery L7165 para PYME, térmicas Zebra/Brother para hubs CN). Si aparece un quinto formato, agregar al array y listo — el layout es declarativo via CSS grid.

### D3 · QR mock determinista

PRNG djb2 + 21×21 cells + 3 finder patterns en esquinas. Visualmente engaña al ojo (parece QR real); funcionalmente no decodifica. Suficiente para piloto y demos. Pasaje a QR real en SDD futuro cuando haya scanner en bodega CN.

### D4 · Copias por caja idénticas

`×1-×4` duplica la misma etiqueta N veces consecutivas. Las copias son **idénticas** (mismo MARKBOX, mismo Box X/Y, mismo QR) — el supplier las pega en distintas caras de la misma caja. Razón operativa: si una se tapa con otra caja al cargar el contenedor, las otras mantienen la trazabilidad.

### D5 · Catálogo warehouses CN desde DB, no inline

A diferencia del mockup del bundle que tiene `WAREHOUSES_CN` hardcoded inline en el JSX, acá leemos de la tabla `warehouses_cn` ya existente (SDD-0008). Razones:
- Wang Hua YIW-A1 ya está seedeado
- Si el founder agrega un cuarto hub CN, no hay que recompilar
- Es la única fuente de verdad operativa

### D6 · Supplier como input libre (deuda chica documentada)

No hay tabla `suppliers_cn` en el repo (proveedores es EmptyState). Hacer el supplier dropdown requeriría:
- Crear migration `0026_suppliers_cn.sql`
- Tabla + RLS + seed + CRUD admin
- Etcétera

Eso es un SDD aparte. Por ahora: supplier es 3 inputs (nombre contacto · ciudad · WeChat) que se usan para armar el mensaje del modal. Cuando exista la tabla, el dropdown reemplaza a los inputs.

---

## 4. Flujo end-to-end

```
[1] Admin abre /studio/etiquetas
    ?id=DTD-5452 preselect (opcional)

[2] Panel config (izquierda):
    - Selector cliente → MARKBOX visible
    - Inputs supplier (opcional, free-form)
    - Selector almacén CN destino (auto-sugerido por ciudad supplier)
    - Inputs Box inicial + Total cajas
    - Toggle ×1/×2/×3/×4 copias
    - Selector formato (4 opciones)
    - Checkbox "Incluir QR"

[3] Preview (derecha) actualiza en vivo:
    - N etiquetas paginadas
    - Tamaño físico mm en sombra de papel
    - Badge formato seleccionado

[4] Click "Imprimir / Guardar PDF"
    → window.print()
    → @page CSS controla tamaño exacto
    → diálogo browser → "Guardar como PDF"

[5] (Opcional) Click "Mensaje al supplier"
    → modal con 2 textareas (ES + 中文)
    → botones "Copiar" → navigator.clipboard
    → botón "Abrir en email" → mailto: con body pre-armado
```

---

## 5. Permisos

Cualquier usuario con acceso al ERP del tenant puede generar etiquetas
para cualquier cliente. Sin restricciones por rol en V1.

---

## 6. Casos borde

| Caso | Comportamiento |
|---|---|
| Total cajas = 1 | Resumen: "1 caja × N copias = N etiquetas" |
| Total cajas > 200 | Capeado a 200 (suficiente para LCL grandes; protege el browser) |
| Box inicial > Total | Botón "Imprimir" disabled · banner "Box inicial debe ser ≤ Total" |
| Total cajas = 0 | Mismo, botón disabled |
| Cliente sin company | Solo se muestra `name` en la etiqueta |
| Sin supplier asignado | Modal mensaje supplier usa saludo genérico "Hola equipo" |
| QR toggle OFF | Layout se reajusta: MARKBOX ocupa todo el ancho izquierdo |
| Browser sin clipboard API | Botón copy hace `document.execCommand('copy')` fallback |
| `?id=<markbox-inválido>` | Cae al primer cliente del tenant + console.warn |

---

## 7. Open questions

1. **¿Logo DTD en la etiqueta?** Hoy es solo texto "SHIPPING TO · DTD-CARGO". Si querés branding visual, pasame el SVG del isotipo y lo embebo. Trade-off: pesa 3-5 KB por página, suma al PDF.
2. **¿Adicionar QR del MARKBOX al footer del PDF?** Tipo "Página 1 de 2 · QR resumen" para que el operario CN pueda scanear el packet sin abrir cada caja. Útil pero no en V1.

---

## 8. Origen y trazabilidad

- **Bundle:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Brief:** `BRIEFS/02-etiquetas-cn.md`
- **Source JSX:** `source/nuevo/modules/label-generator.jsx` (~770 líneas)
- **Releases:** v1.4 + v1.4.1 del sandbox.
