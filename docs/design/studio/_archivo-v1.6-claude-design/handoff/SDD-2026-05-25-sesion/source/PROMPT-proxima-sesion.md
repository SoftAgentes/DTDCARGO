# Prompt de continuidad · próxima sesión Claude Code · DTD-Cargo v1.7

Copialo tal cual al iniciar la próxima sesión con Claude Code.

---

```
Continuamos trabajando en DTD-Cargo. La sesión anterior con Claude Design
(2026-05-25) entregó 4 releases consecutivos: v1.4 → v1.4.1 → v1.5 → v1.6.

Antes de tocar nada, leé:

1. CLAUDE.md (guardrails de marca + nomenclatura oficial MARKBOX)
2. HANDOFF.md (estructura del proyecto + regla de oro)
3. nuevo/CHANGELOG.md (TODO lo construido · ver el resumen del día
   al tope + entradas v1.6, v1.5, v1.4.1, v1.4)
4. nuevo/README.md (convención: nuevo va a nuevo/, anotar archivos
   viejos modificados)

────────────────────────────────────────────────────────────────
RESUMEN: dónde estamos · qué se hizo el 2026-05-25
────────────────────────────────────────────────────────────────

✅ v1.4 · GENERADOR DE ETIQUETAS PDF PARA SUPPLIERS CN
  Archivo: nuevo/modules/label-generator.jsx
  Sidebar: OPERACIÓN → "Etiquetas CN"
  - Plancha PDF bilingüe ES / 中文 con MARKBOX + Box X/Y + QR mock
  - 4 formatos: A4 8-up · A4 4-up · térmico 100×150 · térmico 100×100
  - Print stylesheet con @page en mm reales (PDF via Save as)
  - Modal "Mensaje al supplier" con copy ES + 中文 + Compose

✅ v1.4.1 · COPIAS POR CAJA (×1 a ×4)
  Misma etiqueta repetida N veces por caja para trazabilidad
  redundante. Las copias son idénticas (no se marcan 1 de 3 porque
  las cajas se descargan en orden arbitrario).

✅ v1.5 · MARKBOX VALIDATION + EMAIL BIENVENIDA REAL
  - erp/data-bridge.jsx · helpers expuestos en window.DTDData:
    · validateMarkboxFormat(code)  → regex /^DTD-\d{4,5}$/
    · isMarkboxUnique(code)        → check contra bridge + seed
    · nextMarkbox()                → secuencial defensivo con retry
    · sendWelcomeEmail(client)     → renderiza template m-05
                                      + push a emailsSent store
                                      + push a audit log
    · Store nuevo: emailsSent (key dtd-emails-sent)
  - portal/registro.jsx submit() ahora usa nextMarkbox() +
    sendWelcomeEmail(). UI muestra feedback "Email enviado" verde.
  - erp/modules/clients.jsx drawer detalle: 2 botones nuevos
    "Estado de cuenta" (abre nuevo/pantallas/estado-cuenta.html en
    pestaña nueva) y "Etiquetas" (goTo('labels', markbox)).
  - nuevo/modules/qr-queue.jsx: storage listener para refresh
    real-time cuando la app móvil pushea órdenes.

✅ v1.6 · 9 CONEXIONES ROTAS REPARADAS (sprint quick)
  Archivo nuevo: nuevo/modules/wiring.jsx
  Expone en window.DTDWiring un singleton de modals globales:
  - openAttachModal({ onSelect })     → dropzone + file input
  - openScheduleModal({ onSchedule }) → date/time + atajos + tz
  - openProfileModal({ tab })         → 3 tabs (profile/password/prefs)
  - openShortcutsModal()              → 5 grupos de keyboard shortcuts
  - openGenerateBLModal()             → flow embarque → tipo → preview
  - openOAuthFlow(provider)           → mock 3 pasos para Google/MS
  Wireados en:
  - erp/modules/mailing-compose.jsx (Programar + Adjuntar)
  - erp/modules/documents.jsx (Generar BL)
  - erp/modules/mailing-config.jsx (Conectar con Google/Microsoft)
  - erp/shell.jsx (Mi perfil / Cambiar contraseña / Preferencias /
    Atajos / Cerrar sesión con confirm + reload)
  - erp/modules/admin.jsx (CodesSyncHeader persiste lastSync en
    localStorage dtd_codes_lastsync_${source}, muestra "hace N min")
  - erp/modules/dashboard.jsx + nuevo/modules/dashboard.jsx
    (RecentActivityWidget clickeable, navega por type)
  - erp/modules/mailing-logs.jsx (lee + suscribe a emailsSent del
    bridge, mergea con seed mock)

────────────────────────────────────────────────────────────────
🔲 PENDIENTES PARA ATACAR (en orden de impacto)
────────────────────────────────────────────────────────────────

🔴 LÓGICA REAL · necesita backend o decisiones de producto

  1. EMAIL BIENVENIDA · SMTP real
     · Hoy: sendWelcomeEmail() solo pushea a localStorage
     · Necesita: integrar SMTP_PROVIDERS configurado (Gmail OAuth o
       SMTP) y disparar el email de verdad. OAuth flow ya tiene el
       UI mock; falta el callback real.
     · Archivos: erp/data-bridge.jsx + erp/modules/mailing-config.jsx

  2. PROFILE MODAL · persistencia
     · Hoy: openProfileModal muestra "Guardado" toast pero no
       actualiza window.__currentUser ni persiste a USERS
     · Necesita: setUser callback que actualice el state del shell
       + escribir a un store persistente (futuro: backend /me)

  3. OAUTH SMTP · completar callback
     · Hoy: openOAuthFlow tiene 3 pasos visuales con setTimeout
     · Necesita: al completar (step 3) actualizar el provider.account
       del SMTP_PROVIDERS (D.SMTP_PROVIDERS) con el email del usuario
       que autorizó. Hoy queda como p.account vacío.

  4. ATTACH FILES · persistir en draft
     · Hoy: openAttachModal({ onSelect }) sólo console.log de archivos
     · Necesita: pasarlo al state local del MailingCompose para que
       muestre la lista de adjuntos en el draft. Update count badge
       cuando hay 1+ archivos.

  5. SCHEDULED SEND · cola visible
     · Hoy: openScheduleModal cierra modal + setSentOk
     · Necesita: pushear el email programado a un nuevo store
       scheduledEmails con { iso, draft, status: 'queued' }
       y mostrarlo en una tab nueva "Programados" en Mailing → Logs

🟡 PULIDO VISUAL · todo en mock

  6. DRAG & DROP ANIMADO · Despacho V1
     · Hoy: reordenar paquetes es instantáneo
     · Necesita: animación spring (Popmotion ya está disponible) +
       placeholder de drop zone + feedback de "snap" al soltar

  7. SKELETONS DE LOADING · todos los módulos
     · Hoy: las tablas/cards aparecen instantáneamente con mock
     · Necesita: U.Skeleton ya existe (window.ERPUI.Skeleton),
       envolver los principales módulos con un loading state de
       300ms para sentirse menos "instantáneo"

  8. HIDEVALUES (👁) · aplicar a tablas y gráficos
     · Hoy: el ojo del dashboard solo oculta KPI hero
     · Necesita: tablas (Embarques, Facturas, Cuentas) y charts
       deben respetar el flag. Persistir en localStorage (key
       dtd_dashboard_hide).

  9. CALENDAR · drag de eventos para reprogramar
     · Hoy: eventos del calendario operativo son estáticos
     · Necesita: html5 drag-drop o react-dnd para mover events de
       un día a otro, con confirm modal.

  10. TMS · editor de incidencias
      · Hoy: las incidencias son read-only
      · Necesita: U.Drawer con form (severity / categoría /
        descripción / fotos / chofer / camión) + push al state.

  11. COSTING · comparativa mes vs mes anterior
      · Hoy: solo muestra YTD
      · Necesita: agregar un toggle "Comparar con mes anterior" que
        muestre delta % por categoría.

  12. SUPPLIERS · tab "Embarques históricos"
      · Hoy: en detalle de supplier solo se ven KPIs + contacto
      · Necesita: nueva tab que liste todos los SHIPMENTS asociados
        a ese supplier con filtro fecha + estado.

  13. VAULT · exportar credenciales cifradas a archivo
      · Hoy: el módulo Vault no tiene export
      · Necesita: botón "Exportar todo (.enc)" con un blob de
        localStorage cifrado simulado.

  14. MULTI-TENANT · filtrado real
      · Hoy: el selector de tenant existe pero los datos NO se
        filtran. Todos los módulos muestran todo.
      · Necesita: cada módulo lee window.__currentTenant y filtra
        sus arrays. CLIENTS, SHIPMENTS, SUPPLIERS al menos.

🔴 VISUALES NUEVAS · falta diseño primero (volver a Claude Design)

  15. PERFIL DE USUARIO (al click en @mención en comments / owners
      de Vault). Patrón: ver chofer-perfil.html / camion-perfil.html.

  16. BANDEJA UNIFICADA "Tu día" cross-módulo. Lista personal de
      tasks pendientes del usuario actual.

  17. VISTA "MODO CLIENTE REAL" · preview del ERP filtrado por
      cliente externo para hacer demos.

  18. DETALLE DE COMENTARIO INDIVIDUAL / hilo expandido.

  19. AI COPILOT · modal conversacional dentro del ERP.
      Puede usar window.claude.complete() con haiku-4-5.

⚪ REQUIERE BACKEND REAL · no hacerlo en mock

  - Geocoding real (Google Maps / Mapbox)
  - Push notifications (FCM / APNs)
  - Haptics mobile (navigator.vibrate ya existe en navegador)
  - OAuth callbacks reales

────────────────────────────────────────────────────────────────
⚠ NOTAS PARA CLAUDE CODE
────────────────────────────────────────────────────────────────

- TODO archivo nuevo va a nuevo/. Si tocás un archivo viejo, anotalo
  en nuevo/CHANGELOG.md con archivo + línea + razón.
- Tokens CSS (var(--*)) SIEMPRE · cero hex inventados (excepto en
  components con render fijo en blanco como las etiquetas PDF).
- Solo fuentes Archivo + Archivo Black + JetBrains Mono + Noto Sans SC.
- Sin emoji decorativo · sin gradientes coloridos · sin AI slop.
- Antes de implementar lógica MARKBOX nueva, leer CLAUDE.md y los
  comentarios al inicio de portal/registro.jsx.
- Para SMTP/email real: revisar erp/data.jsx → MAIL_TEMPLATES y
  SMTP_PROVIDERS. El template m-05 ya está completo en ES/EN/ZH.

NO REHAGAS NADA EXISTENTE. Solo trabajá sobre los pendientes o
sobre lo que el usuario te pida explícitamente. Si hay duda,
preguntá antes de codear.
```
