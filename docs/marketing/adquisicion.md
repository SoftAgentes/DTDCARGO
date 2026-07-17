# Sistema de adquisición de clientes — DTD Cargo

> **Qué es:** el sistema completo de adquisición — **UNA oferta, UN canal primario, UN proceso repetible** —
> que llena el frente del embudo. Cubre lo que NINGÚN otro doc cubría: cómo SALIR a buscar los mayoristas
> (prospección) y la operación diaria escrita para **una sola persona, nivel principiante**.
>
> **Dónde empalma:** este proceso termina cuando el prospecto entra a la etapa **"Nuevo"** del embudo de
> 5 etapas de [`embudo-ventas.md`](embudo-ventas.md). Desde ahí mandan ese doc (etapas, SLAs, recompra) y
> [`manual-vendedores-peso.md`](manual-vendedores-peso.md) (precio y negociación). El perfil objetivo y los
> 2 motores están en [`ventas.md`](ventas.md).
>
> **Base:** deep research 2026-07-17 (6 líneas + verificación adversarial; dump completo con fuentes en
> [`research/INVESTIGACION-adquisicion-clientes.md`](../../research/INVESTIGACION-adquisicion-clientes.md))
> **+** merge con lo ya construido en este repo. Decisiones del founder: **$0 de pauta en Fase 1** (Ads = Fase 2)
> · proceso operado por **1 persona con manual de principiante**.
>
> **Estado:** propuesto · 2026-07-17.

---

## 1. El sistema en una página

**El norte** (interno, no se publica): 2 contenedores/mes = ~7–14 cuentas mayoristas activas reabasteciendo
cada 30–45 días. No necesitamos mil leads: necesitamos **1–2 cuentas ancla nuevas por mes** hasta llenar el volumen.

| Pieza | Decisión | Por qué (evidencia) |
|---|---|---|
| **La oferta** | **Puerta a Puerta** "pagas al llegar" (todos los gastos pagados) empaquetado con nombre propio + precio preferencial condicionado a cadencia. Es LA oferta principal: **~80% de lo que buscan los clientes**. LCL consolidado = para empresas | El sector vende "landed cost, no flete"; la promesa de costo final sin sorpresas admite precio premium (línea F). Nadie del campo local comunica "pagas al llegar" como promesa central (línea C) |
| **El avatar** | Mayorista que repone cada 30–45 días (ferretería, repuestos, hogar, electrónica) + aliado revendedor. **Se le dice NO al comprador de una vez** | Ya definido en [`ventas.md`](ventas.md); "one avatar · one channel · one offer" (línea A) |
| **El canal primario** ⭐ | **Calor propio: base de clientes existente + referidos pedidos activamente** | Referido convierte **10–25% end-to-end vs 0,5–2% del frío** (3–5x, CONFIRMADO) y cierra ~38% más rápido (BNI, CONFIRMADO). Con 1 vendedor, la matemática solo da con calor (línea E) |
| **Canal de soporte** | Instagram (5.003 seguidores) → DM → WhatsApp | El funnel real de IG es: feed descubre → Story activa → DM califica → WhatsApp cierra. Convertir seguidores existentes vale más que crecer la cuenta (línea A) |
| **El proceso** | Rutina diaria fija: responder en <5 min → calificar con 5 preguntas → cotizar → cadencia de 6 toques → nurture mensual | Responder en 5 min vs 30 min = **21x más probabilidad de calificar** el lead (MIT, CONFIRMADO). La mayoría del mercado responde en horas o nunca (línea D) |
| **El CRM** | Kommo, embudo único de 5 etapas + regla "ninguna tarjeta sin tarea" | Ya diseñado en [`embudo-ventas.md`](embudo-ventas.md); falta configurarlo (§10) |

**La ventaja injusta que ya tenemos y no explotamos:** una base de ~400 clientes históricos en el ERP
(la mayoría jamás recontactada), ~2.100 leads dormidos en Kommo, 5.000 seguidores de IG, equipo propio EN Yiwu,
y una calculadora pública con precio visible **en un nicho donde la norma es esconder la tarifa** (línea C:
el líder Asiaven pide registro para ver precio). No hay que fabricar demanda: hay que cosechar la que ya existe.

## 2. La oferta (empaquetada, con nombre)

> **Regla de nombre (founder, 2026-07-17):** el servicio se llama **Puerta a Puerta** — "DDP" se **elimina**
> como nombre de servicio y solo puede aparecer como aclaración entre paréntesis: *(todos los gastos pagados)*.
> Puerta a Puerta es **la oferta principal (~80% de lo que buscan los clientes** — el servicio completo);
> el **LCL consolidado** se posiciona aparte, **para empresas**. *(El enum interno `puerta_a_puerta_DDP` del
> ERP no cambia: es identificador, no copy.)*

La oferta base ya existe (puerta a puerta todo incluido, [`ventas.md`](ventas.md) + [`manual-vendedores-peso.md`](manual-vendedores-peso.md)).
Lo que faltaba es **empaquetarla como promesa con nombre**, al estilo del sector (APL vende su garantía como
producto "OceanGuaranteed", no como cláusula). Tres paquetes propuestos (nombres = decisión del founder, §10):

### 2a. "Precio Final Garantizado" (el ancla — para todo mayorista)
- **Promesa:** un solo precio por m³, todo incluido hasta tu puerta: flete + aduana + impuestos + entrega.
  Una vez medida tu carga en China, **ese número es el final — cero cobros sorpresa en destino**.
- **Refuerzo:** "y no adelantas nada: pagas cuando tu carga llega".
- **Condición** (ya cubierta por [`condiciones-cotizacion.md`](condiciones-cotizacion.md)): el estimado web es
  referencial; el precio se fija con peso/volumen reales medidos al recibir la carga.
- **Por qué funciona:** ataca el anti-patrón del sector ("flete barato + sorpresas después") y la fricción #1
  del nicho local (tarifas ocultas tras registro). El research confirma que esta promesa admite precio premium.

### 2b. "Primera Carga Tranquila" (el piloto — para el mayorista nuevo que duda)
- **Promesa:** tu primer embarque desde 0,5–1 m³ para que nos pruebes chiquito, con seguimiento por el portal
  en cada hito y un asesor fijo por WhatsApp.
- **Condición:** perfil mayorista con intención de recompra (30–45 días) — no compra única.
- **Táctica founder-led (línea A, Kracov):** eliminar la fricción HACIENDO el trabajo por el prospecto — el
  asesor le arma el estimado, le explica el packing list, le muestra el portal en un video de 30s. No se le
  manda a un formulario.
- **Opcional a evaluar (§10):** crédito de 10–20% del flete en el PRÓXIMO embarque si nos pasamos de la ventana
  de tránsito comprometida (precedente APL OceanGuaranteed 20%, CONFIRMADO). El crédito — no reembolso —
  fuerza la recompra. **No prometer hasta validar tiempos reales con el founder.**

### 2c. "Programa Aliado DTD" (el motor 2 — revendedores white-label)
Estándares del mercado internacional (CONFIRMADO, línea F), a fijar por el founder (§10):
- **Nivel Referidor** (solo pasa el contacto): 2–5% recurrente del revenue del referido, o un $/CBM fijo
  equivalente. El pago recurrente alinea al referidor con la recompra.
- **Nivel Aliado white-label** (vende y atiende bajo su marca): 30–50% del margen bruto, escalonado por
  volumen trimestral. Ya tenemos la base técnica: multi-tenant + portal (SDD-0042).
- **Exclusividad por ciudad/zona SOLO mientras cumpla volumen mínimo** (práctica estándar de las redes de
  forwarders), con acuerdo simple de 1 página.
- **Materiales:** lista de precios marca blanca + tracking brandeado + guiones de WhatsApp + 1 caso trimestral.

## 3. El avatar y dónde vive (mapa de prospección)

**El avatar** (sin cambios — [`ventas.md`](ventas.md)): volumen recurrente + proveedor fijo en China +
rubro de alta rotación. Formalidad NO es criterio.

**Dónde vive (mapa del research, línea C — verificado jul-2026):**

| Territorio | Qué hay | Cómo entrar |
|---|---|---|
| **La base propia** ⭐ | ~400 clientes históricos del ERP + ~2.100 leads en Kommo + opt-ins de email | Warm outreach (§5). Es el territorio #1 y es gratis |
| **Valencia (casa)** | Cámara de Comercio de Valencia (Av. Bolívar Norte) con **directorio de afiliados público** = lista de prospección legítima; centro de la ciudad | Ruta física + afiliación; el founder es local |
| **Caracas** | La Hoyada / Mercado San Jacinto (hub mayorista del centro) · Quinta Crespo (alimentos/hogar) | Visita comercial con lista previa |
| **Maracaibo** | Las Playitas (~15.000 comerciantes) · Mercado 21 Norte | Igual, cuando haya capacidad |
| **Margarita** | Puerto Libre **reactivado en 2025** — comerciantes insulares reabasteciéndose | Ventana de oportunidad a explorar |
| **Gremios** | Cámara Venezolano-China (asesora importadores para ferias) · Cámara de Pto. Cabello (ya dicta cursos "cómo importar de China") · Consecomercio | Ofrecer al equipo Yiwu+Valencia como **ponente/aliado logístico** de esos cursos — captación a costo $0 |
| **Yiwu (punto de compra)** ⭐ | El mayorista venezolano que viaja a Yiwu/Cantón es el lead más caliente del año y está físicamente al lado de nuestro equipo | Acompañamiento en mercado + contenido "estamos en Yiwu hoy". **Ningún competidor sin oficina puede copiarlo** |
| **Grupos online** | Grupos de WhatsApp/Telegram de importadores venezolanos | Presencia selectiva, cero spam |

**El campo competitivo (fichas completas en el [dump](../../research/INVESTIGACION-adquisicion-clientes.md), línea C):**
el líder visible es **Asiaven Cargo** (~118K seguidores IG, oficina en Valencia + almacén en Foshan, precio
oculto tras registro — CONFIRMADO); le siguen marcas personales como @elchinoimport (~56K) y una cola larga.
**Nadie comunica "pagas al llegar" como promesa central, nadie publica cadencia de recompra, y casi nadie
publica precio.** Contra 118K seguidores no se compite en volumen: se compite en promesa (precio visible +
pagas al llegar + reabastecimiento programado).

## 4. El canal primario (decisión y por qué)

**⭐ Primario: calor propio — la base existente + referidos pedidos activamente.**
Toda la evidencia converge (líneas A, B, E): el referido convierte 10–25% end-to-end contra 0,5–2% del frío,
cierra ~38% más rápido, y es el canal #1 del sector freight en calidad de lead. Para cerrar 1 cliente/semana
solo con frío harían falta 50–200 contactos semanales (inviable con 1 persona); con calor, 4–10 (viable).

**Soporte: Instagram → DM → WhatsApp.** Los 5.003 seguidores son demanda tibia sin cosechar. La mecánica:
contenido con cara visible desde Yiwu (la marca personal funciona: @elchinoimport creció así) + CTA en Stories
→ DM → pasar a WhatsApp → cotizar en minutos. El research es claro: **feed descubre, Story activa, DM
califica, WhatsApp cierra** — y responder el DM en minutos multiplica la conversión.

**Complementario: prospección dirigida con lista de ~50** (founder-led, línea A). No listas masivas: 50
mayoristas perfectos identificados a mano (directorio de la Cámara de Valencia, zonas mayoristas, referencias
de clientes actuales). WhatsApp con disciplina de cold-email: mensajes <150 palabras que nombren el rubro y la
ruta, máximo 3 toques, cero blasting (reply del frío puro ~4% y riesgo de bloqueo del número).

**Explícitamente NO (por ahora):** pauta paga (Fase 2, §10) · redes de forwarders WCA/JCTrans ($3.500–5.000/año
— generan partners forwarder-a-forwarder, no mayoristas) · cold email masivo (0,45% reply en frío estricto +
riesgo de quemar el dominio en Resend) · migrar a WhatsApp Business API (la app + Kommo cubre la escala de 1–2
personas; revisar solo al pasar 256 contactos de difusión o 3 agentes — CONFIRMADO, línea D).

## 5. El proceso repetible de prospección (manual paso a paso)

> **Para quien lo opera:** esto se hace TODOS los días hábiles, en el mismo orden, con los mismos guiones.
> No hay que inventar nada. Si un día no da el tiempo, se corta por abajo (el paso 4 es sacrificable; el
> paso 1 nunca).

### La rutina diaria (60–90 min de venta activa)

**Paso 1 — Responder lo que llegó (primera hora de la mañana + durante el día). SLA: <5 minutos en horario laboral.**
Todo lo que entre por WhatsApp, DM de Instagram, estimado web (llega aviso por email/Telegram) o formulario de
contacto se responde en minutos, no horas. Un lead respondido en 5 minutos vale 21 veces más que uno respondido
en 30 (MIT, CONFIRMADO). La primera respuesta NUNCA es un menú frío — siempre incluye la pregunta 1 de calificación:

> *"¡Hola [nombre]! Gracias por escribirnos 🙌 Cuéntame: ¿qué producto manejas y a qué se dedica tu negocio?
> Así te oriento de una vez con números."*

**Paso 2 — Calificar con las 5 preguntas (en la conversación, no como interrogatorio).**
Se hacen conversando, 1 o 2 por mensaje. Guardarlas como respuestas rápidas de WhatsApp Business:

1. *"¿Qué producto manejas y a qué se dedica tu negocio?"* → fit de rubro; descarta al comprador ocasional.
2. *"¿Ya importas directo desde China o le compras a distribuidores aquí?"* → madurez; contra quién compites.
3. *"¿Cuánto volumen mueves por pedido (cajas, m³ o kilos, aproximado) y cada cuánto repones?"* → **LA pregunta**:
   separa al mayorista recurrente del one-shot. Mapea directo a los criterios de ancla de [`ventas.md`](ventas.md).
4. *"¿Tú decides la compra? ¿Para cuándo necesitas tu próxima reposición?"* → autoridad + urgencia.
5. *"¿Qué es lo que más te cuesta hoy al traer mercancía?"* → el dolor elige el argumento: aduana/confianza →
   "pagas al llegar"; mínimos → consolidación; proveedor → compra asistida.

**Resultado del paso 2:** el lead se clasifica igual que la etapa "Calificado" del embudo —
`Mayorista recurrente` / `Aliado potencial` / `No-fit`. Al No-fit se le atiende bien y NO entra a cadencia
(sale en el toque D5 como mucho). El calificado pasa al cotizador → desde ahí manda [`embudo-ventas.md`](embudo-ventas.md).

**Paso 3 — Los 10 toques cálidos del día (la Rule of 100 adaptada a 1 persona).**
Cada día hábil, **10 contactos de la base propia** que no compran hace más de 45 días (el ERP los lista;
mientras no exista el reporte, sacarlos del módulo de clientes ordenado por última compra). Guion warm (estilo
ACA: reconocer–valorar–preguntar), personalizar los corchetes SIEMPRE:

> *"¡[Nombre], ¿cómo estás?! Te saluda [asesor] de DTD Cargo. Vi que tu último embarque fue [mes] — ¿cómo te
> fue con [producto]? Te escribo porque estamos cerrando el consolidado de [mes próximo] y quería avisarte con
> tiempo por si te toca reponer. ¿Te preparo números?"*

**Paso 4 — Prospección dirigida (2–3 nuevos por día de la lista de 50).**
Mensaje corto, específico, con la ruta y el rubro del prospecto. Máximo 3 toques y se archiva:

> *"Hola [nombre], soy [asesor] de DTD Cargo (Valencia). Trabajamos con [rubro: ferreterías/repuestos/hogar]
> trayendo mercancía de Yiwu puerta a puerta — tú pagas cuando la carga llega, sin adelantos ni sorpresas de
> aduana. Si estás trayendo de China (o pagando de más por intermediarios), te armo un comparativo con tus
> números sin compromiso. ¿Te interesa?"*

**Paso 5 — Pedir 1 referido al día (el multiplicador).**
El momento correcto: cuando un cliente **recibe su carga** o **acepta su recompra** (máxima satisfacción).
Guion:

> *"[Nombre], me alegra que llegara todo bien 🙌 Una pregunta: ¿conoces a otro comerciante que traiga de China
> (o quiera empezar)? Si me lo presentas y embarca, [beneficio del programa — §2c] para ti en tu próximo flete.
> Solo pásame el contacto y yo me encargo."*

### La cadencia de seguimiento (para todo calificado que no cerró en el día)

La regla del embudo ya existe ("ninguna tarjeta sin tarea abierta"); esta tabla dice **qué tarea y cuándo**.
El enemigo real: el 44% de los vendedores abandona tras 1 solo toque, y las respuestas llegan entre el toque 3 y el 8.

| Día | Toque | Qué se dice (intención) |
|---|---|---|
| **D0 (0–5 min)** | Respuesta inmediata | Confirmar + pregunta 1 de calificación |
| **D0 (+4 h)** | Si no contestó | Recordatorio suave + 1 dato de valor ("puerta a puerta incluye X"). Cerrar con pregunta |
| **D2** | Valor + prueba social | Caso del MISMO rubro: *"un cliente de repuestos trae 3 m³ cada 45 días, le llega a su depósito sin tocar aduana"*. Pregunta cerrada |
| **D5** | Empujar al entregable | *"¿Te preparo el estimado con lo que me dijiste?"* — mover de charla a documento. (El No-fit sale aquí) |
| **D10** | Atacar SU objeción | Una sola: precio → valor y palancas del [manual](manual-vendedores-peso.md); confianza → portal + caso; tiempos → fechas del próximo consolidado |
| **D18–21** | Breakup suave | *"Lo dejo hasta aquí para no caerte a mensajes 🙂 Cuando te toque reponer, escríbeme y lo retomamos — el consolidado de [mes] cierra el [fecha]."* (14–33% responde justo aquí) |
| **D30+** | Nurture mensual | 1 mensaje útil/mes: **fecha de cierre del próximo consolidado**, cambio de tarifa, temporada (pedidos antes del Año Nuevo chino). El calificado NUNCA se borra |

**Reglas de parada:** "no me interesa" explícito = stop y etiqueta. Calificado sin cerrar = nurture, no basura.
El ciclo de reposición 30–45 días del mayorista hace que el "no" de hoy sea el lead de la próxima reposición.

### Dónde se registra todo

En **Kommo** (embudo único de 5 etapas — [`embudo-ventas.md`](embudo-ventas.md)) cuando esté configurado (§10).
**Mientras tanto**, el pipeline mínimo son las **etiquetas de WhatsApp Business**: `Nuevo` / `Calificado` /
`Estimado enviado` / `Seguimiento` / `Cliente` / `Nurture`, revisadas 15 min cada mañana. La cadencia D2/D5/D10
depende de disciplina humana o de las tareas de Kommo — no de la memoria.

## 6. Metas y métricas semanales

**La matemática del norte** (pipeline inverso con los rangos verificados del sector, línea E):
para sumar **1–2 cuentas ancla nuevas al mes** vía calor (convierte 10–25% end-to-end), hacen falta del orden de
**10–20 contactos cálidos por semana** — exactamente lo que produce la rutina del §5 (10 toques/día ≈ 50/semana
da margen de sobra incluso si la mitad no responde). El frío madura en 2–4 meses; el calor, en semanas.

**El tablero semanal del asesor (5 números, se llenan el viernes):**

| Métrica | Meta | De dónde sale |
|---|---|---|
| Mediana de primera respuesta | **<5 min** en horario laboral | WhatsApp (a ojo al inicio; honesto) |
| Toques cálidos hechos | **50/semana** (10/día) | Conteo simple |
| Conversaciones nuevas calificadas | **5–10/semana** | Etiqueta `Calificado` |
| Estimados enviados (con monto) | **3–6/semana** | Cotizador del ERP |
| Referidos pedidos | **5/semana** (1/día) | Conteo simple |

**Los KPI de dirección** siguen siendo los de volumen ([`embudo-ventas.md`](embudo-ventas.md) §7): CBM en
pipeline, USD cotizado/aceptado, clientes en ventana de recompra, **recompra vencida** (la fuga #1) — no "%
de conversión". La plantilla mensual de [`ventas.md`](ventas.md) se llena con estas metas.

## 7. El motor de referidos y aliados (con lo ya construido)

Lo que ya existe en código y se usa YA:
- **Crédito automático al referido en su 1ª factura** (SDD-0051/0137, LIVE) + link de referido (`?ref=` en
  `/registro`, `lib/portal/referral-link.ts`). El guion del §5 paso 5 lo activa — hoy nadie lo pide.
- **Invitaciones al portal por tandas** (`/studio/admin` › Invitaciones): ~231 clientes con correo válido sin
  invitar. Cada invitado que entra al portal es un cliente reactivado que ve sus envíos y su historial — y a
  quien pedirle referidos. *(Escalar con cuidado: hay ~20% de rebote medido en el 1er lote — ver memoria.)*
- **Fidelización por niveles** (SDD-0051, LIVE): el nivel del cliente es argumento del nurture mensual.

Lo que falta definir (founder, §10): los % del **Programa Aliado** (§2c) y su acuerdo de 1 página. La mecánica
de pago ya la soporta el ERP (crédito en factura).

## 8. Qué se enciende en código (estado real)

| # | Pieza | Estado | Acción |
|---|---|---|---|
| 1 | **Aviso de estimados web al equipo** (la fuga #1: el EST- quedaba huérfano si el visitante no mandaba el WhatsApp) | ✅ **HECHO 2026-07-17** — email a info@ + admins + Telegram con link wa.me directo al prospecto (`lib/studio/estimado-lead-notify.ts`) | Vive con el próximo deploy. El asesor le escribe ÉL al prospecto (paso 1 del §5) |
| 2 | **Write-back ERP→Kommo** (valor + etapa + MARKBOX automáticos) | Código LIVE, **dormido**: falta cron del drain + flip de flags | Runbook: [`../runbooks/activar-crm-kommo.md`](../runbooks/activar-crm-kommo.md) — lo ejecuta coordinación + founder |
| 3 | **Recordatorio de recompra día 30/45** (aviso interno al asesor de clientes sin estimado nuevo) | ❌ No existe — hoy depende de la tarea manual de Kommo | Backlog (SDD futuro). Plantilla: cron `portal-cold-reminder` |
| 4 | **Persistir `/contacto` en DB** (hoy solo email+Telegram, sin fila consultable) | ❌ No existe | Backlog (requiere migración) |
| 5 | **Sender de campañas** para los opt-in de email (SDD-0082 captura, nadie envía) | ❌ No existe | Backlog — el mailing por eventos (SDD-0143) ya cubre lo transaccional |

## 9. El ritual semanal (founder + asesor, 30–45 min, viernes)

1. **Tablero del asesor** (§6): los 5 números de la semana. ¿Se cumplió el SLA? ¿Se hicieron los toques?
2. **Recompras vencidas** (la fuga #1): lista de clientes pasados de su ventana 30/45 — cada uno sale con
   tarea fechada.
3. **Pipeline de volumen**: ¿los estimados enviados suman CBM suficiente para el ritmo de 2 contenedores/mes?
4. **Tabla de prospectos ancla** de [`ventas.md`](ventas.md): altas/bajas de la lista de 50; siguiente
   territorio del mapa (§3).
5. **1 decisión de mejora**, máximo (un guion que no funciona, una objeción nueva para el manual, un
   territorio nuevo). No más de una por semana: el sistema gana por constancia, no por novedad.

## 10. Decisiones abiertas del founder

1. **Nombres y letra chica de los paquetes** (§2): "Precio Final Garantizado" / "Primera Carga Tranquila" /
   "Programa Aliado DTD" son propuestas. La garantía opcional de fecha (crédito 10–20% del flete) requiere
   validar los tiempos reales de tránsito antes de prometerla.
2. **Tarifa preferencial mayorista**: el número exacto y la condición de cadencia (pendiente desde
   [`ventas.md`](ventas.md); el [manual](manual-vendedores-peso.md) ya da la palanca: $/m³ contra recurrencia).
3. **% del Programa Aliado**: fijar referidor (2–5% rec. o $/CBM) y aliado (30–50% margen, escalones).
4. **Config Kommo** (vía navegador, ~1 h — pasos exactos en [`embudo-ventas.md`](embudo-ventas.md) §8):
   refundar a 5 etapas · custom fields · limpieza única del cementerio (2.118) · repartir cartera · cargar
   `stage_map` + activar write-back ([runbook](../runbooks/activar-crm-kommo.md)).
5. **Google Ads — Fase 2**: criterio de activación propuesto = cuando el SLA <5 min se cumpla 4 semanas
   seguidas y la rutina del §5 esté corriendo (de nada sirve pagar leads que se responden tarde). La
   reestructura está lista en [`ads-reestructura-search.md`](ads-reestructura-search.md); al reactivar, no
   pausar por ≥2 semanas.
6. **Discrepancia de límites a reconciliar**: el [README](README.md) describe el manual con "1.000 kg/m³ ·
   9.000 kg · 15 m³" pero [`manual-vendedores-peso.md`](manual-vendedores-peso.md) usa tope de derivación
   **68 m³ / 27.000 kg** (y la calculadora pública deriva a asesor en 9.000 kg). Alinear los tres antes de
   entrenar al asesor con este playbook.
7. **Barrido "DDP" en el sitio público**: la regla de nombre del §2 deja 24 menciones "DDP" en 12
   componentes (`components/`, incl. `DdpHero.tsx` y `ServiciosExplorer`) por pasar a "Puerta a Puerta"
   con la aclaración "(todos los gastos pagados)". Es copy + posible SEO (títulos/schema) — tarea aparte
   con `/ui-check`.

---

*Fuentes: dump completo con URLs y veredictos de verificación en
[`research/INVESTIGACION-adquisicion-clientes.md`](../../research/INVESTIGACION-adquisicion-clientes.md).
Claims marcados CONFIRMADO tienen evidencia independiente múltiple; los números refutados por la verificación
(curva de win-rate por velocidad de GoFreight, cifras infladas de WhatsApp-vs-email) NO se usaron acá.*
