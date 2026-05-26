# Brief · QR queue storage listener (v1.5 · quick win)

> Listener del evento `storage` del navegador en el hook `useQrOrders` del módulo Cola QR. Permite que cuando la app móvil Operario CN pushea una orden de impresión, el ERP la vea **inmediatamente** sin refresh manual.

---

## Problema y para quién

Hasta v1.5 el flujo era:

1. Operario CN (en su tablet/teléfono) escanea cajas → click "Enviar a oficina" → `localStorage.setItem('dtd_qrqueue_v1', ...)` en el origen del Operario CN HTML.
2. ERP en otra tab muestra la cola de QR pero **NO veía la actualización** hasta refresh manual.

El bug es estructural: `useState` de React solo lee localStorage en el lazy init. Los cambios en localStorage hechos por OTROS tabs no disparan re-render automático.

**Resuelve:** sync real-time cross-tab via `storage` event nativo del navegador.

### Roles servidos

| Rol | Beneficio |
|---|---|
| **Operaciones / oficina** (ERP) | Cola QR se actualiza al instante cuando Operario CN manda · sin F5 |
| **Operario CN** (mobile) | Feedback indirecto · sabe que la orden llegó porque al volver al ERP la ve |

---

## Flujo end-to-end

```
[1] Operario CN (tab A · operario/app.jsx):
    → click "Enviar a oficina"
    → genera orden { id: 'QR-2026-0042', client, supplier, ... }
    → localStorage.setItem('dtd_qrqueue_v1', JSON.stringify([orden, ...prev]))
    → el navegador emite 'storage' event en TODAS las OTRAS tabs del mismo origen

[2] ERP (tab B · DTD Studio · ERP.html · módulo Cola QR):
    → useQrOrders() tiene 2 useEffect:
       a. Effect 1 (persistencia): cuando `orders` state cambia LOCALMENTE,
          escribe a localStorage.
       b. Effect 2 (sync · NUEVO en v1.5): listener `storage` event.
          Cuando otro tab modifica `dtd_qrqueue_v1`:
            - lee e.newValue
            - JSON.parse
            - setOrders(next)
       Sin loop: el `storage` event NO dispara en el tab que escribió,
       solo en los demás.

[3] ERP actualiza la tabla de Cola QR en vivo
    → admin ve la nueva orden al tope con status 'pendiente'
```

---

## Reglas de negocio

- **Mismo origen requerido**: `storage` event solo cruza tabs del mismo origen (mismo dominio + puerto + protocolo). En el sandbox eso es siempre cierto (mismo file://). En prod: el Operario CN debe servirse del mismo dominio que el ERP, o usar un canal alternativo (WebSocket, BroadcastChannel).
- **Solo lee desde el evento**: el listener procesa `e.newValue` (el JSON serializado) y no llama a localStorage de nuevo, evitando race conditions con el effect de persistencia.
- **Defensive JSON.parse**: try/catch que silenciosamente ignora valores corruptos.

---

## State machine

N/A · es sync de datos.

---

## Permisos por rol

N/A · el listener corre en ambos tabs siempre que el módulo Cola QR esté montado.

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Otro tab limpia el storage (`localStorage.removeItem`) | `e.newValue` es `null` · listener hace early return · state no se modifica |
| Otro tab escribe JSON corrupto | `JSON.parse` throw · try/catch silencioso · state no se modifica |
| Múltiples tabs ERP abiertas | TODAS reciben el `storage` event simultáneamente · todas sincronizan |
| Same-tab write (de adentro del ERP) | NO dispara `storage` event (intencional) · el `useEffect [orders]` se encarga de persistir |

---

## Dependencias

- **Lee/escribe:** `localStorage['dtd_qrqueue_v1']`
- **Listener nativo:** `window.addEventListener('storage', handler)`
- **No usa bridge:** este store usa una key snake_case (`dtd_qrqueue_v1`) diferente de la convención del bridge (`dtd-*`). El listener directo es lo más simple.

### En prod (Next.js)

El listener de `storage` event sigue funcionando igual en Next.js (es API nativa del browser). Pero hay opciones mejores:

1. **WebSocket / SSE** vía Pusher / Ably / Supabase Realtime para sync real-time entre dispositivos (no solo tabs del mismo browser).
2. **BroadcastChannel API** para sync solo entre tabs (más limpio que `storage` event pero requiere refactor).

Si el repo Next.js ya tiene WebSocket configurado, **reemplazar** el listener de `storage` por una subscription al canal `qr_print_orders`.

---

## Archivos

| Archivo | Líneas |
|---|---|
| `nuevo/modules/qr-queue.jsx` | ~34-50 (segundo `useEffect` en hook) |
