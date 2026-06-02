# DTD-Cargo · Backend (handoff)

Esta carpeta documenta **lo que falta para producto real**: el prototipo corre 100% en el
navegador (datos mock en `localStorage` vía `window.DTDData`, auth mock, flags por dispositivo).
Para producción hay que poner un backend detrás de los *seams* existentes.

- **`API-CONTRACT.md`** — el contrato: cada seam del prototipo → su endpoint REST (auth,
  clientes/MARKBOX, cotizaciones, **aceptación legal con evidencia**, bandeja del portal,
  facturación, operación CN + sync offline, config/flags, notificaciones) + orden de
  implementación.

## Principio de migración
**Mismas firmas, otra implementación.** La UI consume `window.DTDData` / `window.DTDFlags` /
`window.LegalData`; en producción se reescribe el cuerpo de esas funciones para llamar a la
API en vez de `localStorage`. No se toca el código de pantallas.

## Lo no negociable
- **Multi-tenant real:** `tenantId` en el token; el servidor filtra todo por tenant.
- **Sesión:** access+refresh tokens, revocables; PIN/biometría desbloquea, nunca guarda contraseña.
- **Evidencia legal inmutable:** IP real + hash + sello de tiempo; es prueba, no un store más.
- **El servidor es la frontera de seguridad:** verifica tenant + permisos en cada request.
