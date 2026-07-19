# Los 5 sistemas de crecimiento de DTD — y dónde entra cada trabajo

Marco para ordenar TODO lo que hacemos. Un negocio crece cuando estos 5 sistemas están definidos,
documentados y son repetibles. Este doc pone los 5 en orden y **mapea dónde entra cada iniciativa**
(en especial el rediseño del portal de compras + las infografías de servicios).

> **Estado:** borrador · 2026-07-18. Entrada desde [README de marketing](README.md).

---

## 1 · Adquisición de clientes
**Define una oferta, un canal y un proceso repetible.** Si cada mes reinventas cómo conseguir clientes,
no puedes crecer.

- **Lo que ya tenemos:** oferta empaquetada y sistema de adquisición ([adquisicion.md](adquisicion.md)) ·
  canal primario (referidos + base propia, $0 pauta) · calculadora pública · registro/captación de leads ·
  Instagram/Ads (Fase 2).
- **Dónde entra el trabajo actual:** las **[infografías de servicios](servicios-infografias/)** clarifican
  **la oferta** — el cliente entiende de una qué vende DTD y qué gana. Material de la oferta, indexable
  en la web.

## 2 · Ventas
**No basta con tener prospectos.** Necesitas un proceso rápido para calificarlos, hacerles seguimiento y
cerrarlos sin rogar.

- **Lo que ya tenemos:** CRM Kommo (embudo + recuperación SDD-0157) · [guiones del asesor](guiones-asesor.md) ·
  [embudo de ventas](embudo-ventas.md) · portal de registro.
- **Dónde entra el trabajo actual:** las infografías son **material de venta** del asesor (explican cada
  servicio en segundos) · los **servicios de la llegada** (Validación, Inspección, HOLD…) son
  oportunidades de **venta adicional** dentro de cada compra.

## 3 · Entrega  ← *aquí vive el corazón de lo que estamos construyendo*
**Documenta paso a paso cómo entregas tu servicio.** Si cada cliente se atiende distinto, no puedes
meter más volumen sin que caiga la calidad.

- **Lo que ya tenemos + estamos rediseñando:** el flujo **compra (pre-alerta) → link al proveedor →
  recepción por escaneo → servicios de la llegada → aviso al cliente**. Es el pipeline de captura de
  realidad (SDD-0153/0154/0155), avisos (SDD-0156/0162) y el rediseño **SDD-0163** (modalidad de envío +
  servicios como pre-alertas + **orden accionable al operario**).
- **Por qué importa:** estandariza la entrega — **un solo código** de la mesa del proveedor en Yiwu al
  galpón en Valencia, mismo proceso para todos. Eso es lo que permite **crecer en volumen** sin perder
  calidad.

## 4 · Manual de operaciones
**Escribe todo lo que haces como si se lo explicaras a un niño.** Sin esta biblia no puedes delegar; y si
no delegas, no creces.

- **Lo que ya tenemos:** runbooks (`docs/runbooks/`) · specs SDD (`docs/specs/`) · instructivos del
  operario en la móvil (`/m/cn`, `/m/ve`).
- **Dónde entra el trabajo actual:** el **copy de las infografías** documenta **qué hace cada servicio y
  con qué reglas** — es la base del **instructivo del operario** (cómo se ejecuta Validación, Inspección,
  Etiquetado, HOLD) y del guion de atención. De aquí sale el "cómo se hace" que permite delegar.

## 5 · Contratación
**Aprende a delegar — y para eso, a contratar.** Identifica a las personas correctas, entrénalas rápido y
mide su desempeño. Si no puedes sacarte del día a día, tu negocio tiene un techo: **tú**.

- **Lo que ya tenemos:** perfiles de puesto + alta unificada (SDD-0140) · onboarding del empleado
  (`/m/emp`, SDD-0113) · RBAC por rol (SDD-0085/0139).
- **Dónde entra el trabajo actual:** cuando la **entrega** (3) y el **manual** (4) están documentados, el
  operario nuevo se entrena con las mismas infografías/instructivos y se mide contra un proceso claro. La
  orden al operario de SDD-0163 deja **traza medible** de cada servicio ejecutado.

---

## Resumen: dónde entra el rediseño del portal + infografías

| Sistema | ¿Entra el trabajo actual? | Cómo |
|---|---|---|
| 1 · Adquisición | Sí (alimenta) | Infografías = clarifican la oferta en la web |
| 2 · Ventas | Sí (alimenta) | Infografías = material del asesor; servicios de llegada = venta adicional |
| **3 · Entrega** | **Sí (núcleo)** | **SDD-0163 + pipeline de captura: estandariza cómo entregamos** |
| **4 · Manual de operaciones** | **Sí (núcleo)** | **El copy documenta cada servicio → instructivo del operario** |
| 5 · Contratación | Sí (habilita) | Proceso documentado + traza medible = se puede delegar y medir |

**Conclusión:** el rediseño del portal no es solo "una pantalla más": es cómo **industrializamos la
Entrega (3)** y escribimos el **Manual de operaciones (4)**, que son los dos sistemas que hoy le ponen
techo al crecimiento. Adquisición y Ventas ya tienen su tree; este trabajo cierra el eslabón operativo.
