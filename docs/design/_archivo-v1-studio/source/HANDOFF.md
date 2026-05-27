# DTD-Cargo · Handoff a Claude Code

> **Para Claude Code:** este archivo se lee al inicio de cada sesión junto con `CLAUDE.md`. Define qué está diseñado, qué falta y la regla de oro: **NO inventes pantallas sin diseño**.

---

## 🚦 REGLA DE ORO

**Si te piden modificar/crear algo que NO tiene diseño aprobado en este handoff**, antes de codear mostrá este aviso:

```
🎨 DESIGN-CHECK

Lo que pediste:    <descripción>
Estado actual:     ❌ No hay diseño aprobado para esto
Recomendación:     Diseñar primero en Design para mantener
                   consistencia visual (paleta, tipografía,
                   componentes del sistema).

¿Querés:
A) Diseñar primero en Design y volver acá con el mockup
B) Que yo lo construya intentando seguir el sistema, con
   riesgo de inconsistencia (queda como deuda de diseño)
```

Esperá confirmación antes de aplicar B.

---

## ✅ LO QUE ESTÁ DISEÑADO Y ENTREGADO

### Archivos principales (16 totales)
- `DTD Studio · ERP.html` — ERP completo (admin)
- `Portal del Cliente.html` — portal externo
- `Brand Book DTD v2.4.html` — manual de marca
- `Operario CN.html` — app móvil recepción China
- `Operario VE.html` — app móvil chofer Venezuela
- `Bodeguero VE.html` — app móvil bodega Venezuela
- `Operario Multi.html` — app móvil multi-rol

### Módulos del ERP (con diseño completo)
1. **Dashboard** (con ojo ocultar valores 👁)
2. **Embarques** (Tabla + Kanban + drawer detalle)
3. **Tracking** (mapa + timeline)
4. **Calendario** operativo (mes/semana/agenda + feriados CN/VE)
5. **Almacén CN** (con scope, traductor, parciales)
6. **Almacén VE** (con scope)
7. **TMS · Transporte** (flota + choferes + rutas + GPS + incidencias)
8. **Cotizador** (calculadora en vivo)
9. **Clientes & MARKBOX** (con estados color)
10. **CRM · Leads** (Kanban + Tabla + Timeline + drawer)
11. **Proveedores CN** (con contactos WeChat, ratings)
12. **Tarifas**
13. **Facturación** (con links)
14. **Documentos**
15. **Reportes** (7 tabs por área)
16. **Costing & Margen** (con editor, templates por ruta, USD/VES, forecast)
17. **Aduana SENIAT · Workflow**
18. **Mailing** (Templates · Firmas · Compose · Reglas · Config · Logs)
19. **Vault** (caja fuerte con master password)
20. **Usuarios** (con scope por almacén)
21. **Administración** (Casos de uso ON/OFF + 11 secciones)

### Apps móviles (con flow completo)
- Operario CN: recepción + fotos + HS detector + traductor + QR print
- Operario VE: carga + GPS + docs + firma + POD + parciales
- Bodeguero VE: recibir contenedor + armar camión + WhatsApp a externos
- Operario Multi: picker + previews de modos

### Cross-módulo
- Quick Email modal (window.openQuickEmail)
- Comments con @menciones
- Scope por rol/almacén con "Ver como…"
- Theme light/dark + densidades

---

## ❌ LO QUE FALTA DISEÑAR (pendiente para próxima sesión en Design)

### 🔴 Visuales que NO existen todavía

1. **Perfil individual de Chofer** — al click en card de chofer en TMS
2. **Perfil individual de Camión** — al click en patente AC542XK
3. **Perfil individual de Agente Aduanal** — al click en card en SENIAT
4. **Perfil individual de Usuario** — al click en @mención en comments o en owners de Vault
5. **Cola de impresión QR · vista oficina** — donde la oficina ve las órdenes de impresión que Operario CN mandó
6. **Editor de Dashboard** — drawer para configurar qué KPIs mostrar (eligibles por usuario)
7. **Bandeja unificada de tareas** — "Tu día" cross-módulo
8. **Estado de cuenta detallado del cliente** — vista profunda en detalle Cliente
9. **Conciliación bancaria** — subir extracto bancario + match con facturas
10. **Vista "modo cliente real"** — preview de cómo se ve el ERP filtrado por cliente externo
11. **Detalle de comentario individual / hilo expandido**
12. **Modal "Adjuntar archivo" rico** — hoy solo tiene botón placeholder
13. **AI Copilot conversacional** — modal de chat dentro del ERP
14. **Vista de auditoría profunda** — drill-down en un registro afectado del audit log

### 🟡 Funcionalidad que existe visual pero NO funciona

- Toggles del panel "Casos de uso ON/OFF" **no esconden** módulos del ERP (solo visual)
- Cola de impresión QR no existe en el ERP (la app móvil manda la orden pero nadie la recibe)
- "Atajos de teclado" en menú de usuario — no abre nada
- "Programar" en Compose de Mailing — no abre date picker
- "Adjuntar" en varios composes — no abre file picker
- "Cambiar contraseña" / "Mi perfil" — botones sin destino
- "Conectar con Google/Microsoft" en SMTP setup — no hace OAuth real
- Botones de "Sincronizar" en HS/AES — animación visual nomás
- "Generar BL" en Documentos — sin flow de generación

### 🟢 Mejoras de pulido pendientes

- Dashboard → "Actividad reciente" clickeable (3 items ya wirearon en intento previo, revisar)
- Topbar → bell notifications clickeables
- Aplicar `hideValues` también a tablas y gráficos (hoy solo KPI hero)
- Persistencia del ojo en localStorage
- TMS → editor de incidencias
- Costing → comparativa mes vs mes anterior además de YTD
- Suppliers → sección "Embarques históricos" de este supplier
- Calendar → drag de eventos para reprogramar
- Vault → exportar credenciales cifradas a archivo

---

## 📋 ORDEN SUGERIDO PARA PRÓXIMAS SESIONES

### Sprint A · Visuales que faltan
1. Editor de Dashboard + persistencia
2. Cola de impresión QR (vista oficina)
3. Perfiles individuales (chofer + camión + agente)

### Sprint B · Conexiones funcionales
4. Wirear feature flags (Casos de uso ON/OFF) realmente
5. Conectar app móvil → ERP en tiempo real (push de recepciones, POD, etc.)
6. Cola de impresión QR conectada a Operario CN

### Sprint C · Profundidad
7. Estado de cuenta detallado del cliente
8. Conciliación bancaria
9. Audit log con drill-down
10. AI Copilot

---

## 🎨 REGLAS QUE NO SE ROMPEN (recordatorio)

Ver `CLAUDE.md` para detalle. Resumen:
1. Solo tokens CSS (`var(--*)`) — cero hex inventados
2. Solo fuentes Archivo + JetBrains Mono + Noto Sans SC
3. Cero AI slop (gradientes coloridos, emojis decorativos, glassmorphism)
4. Componentes del sistema primero (`<Btn>`, `<Input>`, etc.)
5. **Avisar antes de inventar** con formato `BRAND-CHECK` o `DESIGN-CHECK`

---

## 🚀 STACK / DÓNDE VIVE QUÉ

```
DTD-Cargo/
├── CLAUDE.md              · Brand guardrails
├── HANDOFF.md             · Este archivo (estado + pendientes)
├── DTD Studio · ERP.html  · ERP principal
├── Portal del Cliente.html
├── Brand Book DTD v2.4.html
├── Operario CN.html       · Mobile
├── Operario VE.html       · Mobile
├── Bodeguero VE.html      · Mobile
├── Operario Multi.html    · Mobile
├── erp/
│   ├── tokens.css         · Design tokens (light + dark)
│   ├── data.jsx           · Mock data (clientes, embarques, etc.)
│   ├── icons.jsx          · Set de iconos SVG
│   ├── components.jsx     · UI primitives
│   ├── shell.jsx          · Sidebar + topbar
│   ├── tweaks-panel.jsx   · Panel de tweaks
│   └── modules/           · 21 módulos del ERP
└── operario/
    ├── app.jsx            · Operario CN
    ├── ve.jsx             · Operario VE
    └── bodeguero.jsx      · Bodeguero VE
```

Cuando agregues módulos nuevos, seguí esta convención.
