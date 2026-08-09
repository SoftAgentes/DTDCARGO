# Investigación · Cómo conversar con un lead en redes y mensajería

> **Qué es esto:** el volcado completo de la investigación que sustenta
> [`docs/marketing/conversacion-crm.md`](../docs/marketing/conversacion-crm.md).
> Acá viven las fuentes, los números y —sobre todo— **qué está verificado y qué es mentira
> repetida**. El documento operativo se lee para trabajar; este se lee para discutir.
>
> **Fecha:** 2026-08-03 · **Método:** 3 agentes de investigación web en paralelo, con
> verificación adversarial de las cifras más citadas.
>
> **Precedente:** `research/INVESTIGACION-adquisicion-clientes.md` (2026-07-17).

---

## 0. Cómo leer este documento

Este campo está contaminado. La mayoría de los "datos" que circulan en blogs sobre velocidad
de respuesta y venta por DM son **agregadores citándose entre sí**, sin fuente primaria. Por eso
todo va clasificado:

| Marca | Qué significa |
|---|---|
| 🟢 **VERIFICADO** | Estudio revisado por pares, o documentación oficial del fabricante, con metodología y muestra identificables. |
| 🟡 **VENDOR** | Datos reales, pero de la plataforma de una empresa que vende la solución. Muestra grande, sesgo conocido, sin auditoría externa. Direccional. |
| 🔴 **FOLKLORE** | Sin fuente primaria rastreable. **No lo uses.** Si alguien te lo cita, pídele el estudio. |

**La regla que resume todo:** cuando una cifra suena redonda, dramática y aparece en cien
blogs con la misma redacción, casi siempre es folklore.

---

## 1. Velocidad de respuesta

### 1.1 🟢 Harvard Business Review (2011) — la fuente que sí existe

Oldroyd, McElheran & Elkington, *"The Short Life of Online Sales Leads"*, **HBR 89(3), marzo 2011**.

Doble metodología, y es lo que la hace fuerte:
1. Análisis de **1,25 millones de leads** de 42 empresas (29 B2C, 13 B2B).
2. Auditoría tipo cliente incógnito sobre **2.241 empresas** de EE.UU.: les mandaron un lead
   de prueba y midieron cuánto tardaban en responder.

Resultados de la auditoría:

| Cuánto tardaron | % de empresas |
|---|---|
| Menos de 1 hora | 37% |
| Entre 1 y 24 horas | 16% |
| Más de 24 horas | 24% |
| **Nunca respondieron** | **23%** |

- **Tiempo promedio de respuesta: 42 horas.**
- Contactar dentro de **la primera hora** hace **~7×** más probable calificar el lead que una
  hora después, y **más de 60×** más probable que esperar 24 horas o más.

https://hbr.org/2011/03/the-short-life-of-online-sales-leads

### 1.2 🟡 El estudio del "21×" — Oldroyd / InsideSales (2007)

Este es el origen real de las cifras que todo el mundo atribuye al MIT.

- **Autor:** Dr. James B. Oldroyd, entonces investigador visitante en MIT Sloan.
- **Muestra:** 3 años, 6 empresas, **más de 15.000 leads** y **más de 100.000 intentos de llamada**.
- **5 vs. 30 minutos** → las probabilidades de **contacto** caen **100×**.
- **5 vs. 30 minutos** → las probabilidades de **calificar** caen **21×**.
- **5 vs. 10 minutos** → las de calificar caen **4×**.
- ⭐ **El corolario que nadie cita: pasadas ~20 horas, los intentos adicionales de llamada
  EMPEORAN la probabilidad de contacto.** Insistir tiene un punto donde se vuelve en contra.
- Mejores días: miércoles y jueves. **Lunes es consistentemente el peor.**
- Mejor franja: 16:00–18:00 para lograr contacto.

⚠️ **Corrección de atribución obligatoria:** esto **no es un paper del MIT**. Es un análisis
sobre datos de la plataforma de InsideSales.com, coordinado por alguien con afiliación a MIT
Sloan en ese momento. No es un ensayo controlado. Cítalo como *"el estudio de Lead Response
Management de Oldroyd/InsideSales (2007)"*.

https://www.leadresponsemanagement.org/lrm_study

**Y la autocrítica del propio vendor, que vale más que el estudio:** InsideSales publicó
después que **no saben si la respuesta inmediata sirve igual para todo tipo de consulta**.
Distinguen ofertas de *"Buying Signal"* (pide precio, propuesta, demo → responder ya) de
*"Tire Kicker"* (descargó un PDF → no está claro si el contacto inmediato ayuda o quema).

https://www.insidesales.com/rethinking-our-lrm-study-about-lead-response-management/

### 1.3 🟡 Datos recientes (2024–2026)

**Optifai — 939 empresas B2B SaaS, Q2 2025 a Q1 2026:**

| Tiempo de respuesta | Tasa de cierre |
|---|---|
| < 5 min | **32%** |
| 5–30 min | 24% |
| 30 min – 1 h | 18% |
| 1–24 h | 15% |
| > 24 h | 12% |

Multiplicador entre el tramo más rápido y el más lento: **2,6×**. Solo 23% responde en menos de
5 minutos; 42% tarda más de 24 horas.

**Blazeo (2026, 573 empresas) — el hallazgo más barato de aplicar:**

| | Cumple el estándar de 15 min |
|---|---|
| **Con** SLA formal escrito | **54,9%** |
| **Sin** SLA | **29,5%** |

**25 puntos porcentuales de diferencia, y no los produce la tecnología: los produce tener el
compromiso escrito.**

También: **más del 40% de las consultas de alta intención llegan de noche y en fin de semana.**

### 1.4 🟢 Qué espera el cliente (mensajería específicamente)

**Kantar para Meta, "State of Business Messaging" 2025** — 11.056 adultos, 22 mercados,
**incluidos México, Brasil, Argentina y Colombia**:

- **73,3%** prefiere la mensajería para hablar con una empresa.
- **74,6%** confía más en un negocio si puede intercambiar mensajes con él.
- **79,3%** exige prueba de legitimidad (verificación) antes de interactuar.
- **75%** quiere escribirle a las empresas **igual que le escribe a un amigo**.
- 42,9% cree que la IA mejoraría su experiencia de mensajería.

**HubSpot Research:** 82% de los consumidores califica como importante una respuesta inmediata
a consultas de ventas. HubSpot define "inmediata" como **10 minutos o menos**.

**Sprout Social Index 2025:** 73% espera respuesta en 24 h o menos en redes; **84% dice que la
velocidad afecta cómo percibe la marca después.**

**🟢 El estándar oficial de Meta:** la insignia *"Muy receptivo a los mensajes"* exige **tasa de
respuesta ≥90% y tiempo de respuesta <15 minutos**. Esto no es opinión de blog: es el umbral que
la propia plataforma publica.

### 1.5 🔴 Folklore de velocidad — no uses nada de esto

| Claim | Problema |
|---|---|
| **"78% de los clientes le compran a quien responde primero"** | Se atribuye a una "encuesta de Lead Connect" que **no existe públicamente**. Es el dato más citado y más falso del sector. |
| "78% de los consumidores en LATAM le compran al primero" | El mismo mito, reetiquetado como LATAM por vendors de WhatsApp. |
| "35–50% de las ventas van al primer vendedor que responde" | Sin fuente primaria. Se le cuelga a InsideSales sin verificación. |
| "Después de 5 minutos la calidad del lead cae 80%" | Circula atribuido a HBR. **No aparece en el artículo de HBR.** |
| "WhatsApp tiene 98% de tasa de apertura" | Sin fuente primaria. Se repite en todos los blogs de vendors de WhatsApp en español. |
| "Los DM de Instagram tienen 90% de open rate vs. 20% de email" | Cadena circular de blogs de vendors. Sin medición independiente. |
| "WhatsApp mejora los tiempos de respuesta 225%" | Sin fuente. |

**Qué usar en su lugar:** 7× / 60× (HBR 2011), 21× / 100× (Oldroyd 2007), 2,6× (Optifai 2026),
y el 54,9% vs. 29,5% del SLA escrito (Blazeo 2026).

---

## 2. El arte de preguntar

### 2.1 🟡 SPIN Selling — Neil Rackham (1988)

La metodología de ventas con la base empírica más seria que existe. Cifra canónica: **35.000
llamadas, 10.000 vendedores, 23 países, 12 años.**

**Las 4 etapas de toda visita de venta:** Preliminares → **Investigación** → Demostración de
capacidad → Obtención de compromiso.

⭐ **El hallazgo central: el éxito en ventas complejas se decide en la etapa 2 (preguntar), no
en la 4 (cerrar).** Toda la industria estaba entrenando el cierre.

**La estructura S-P-I-N:**

| | Qué hace | Correlación con el éxito |
|---|---|---|
| **S — Situación** | Recoge hechos y contexto. *"¿Qué usas hoy?"* | ⚠️ **Las que MÁS usan los mediocres y las que MENOS correlacionan.** Aburren al comprador. Haz la tarea previa y elimina el 80%. |
| **P — Problema** | Saca a la superficie dificultades. *"¿Qué es lo más frustrante de eso?"* | Buena en ventas pequeñas. Insuficiente en grandes. |
| **I — Implicación** | Explora consecuencias y costo. *"¿Cómo afecta eso a tus objetivos?"* | ⭐ **La joya. La más difícil y la que más correlaciona en ventas grandes.** |
| **N — Necesidad-beneficio** | Que el comprador enuncie el valor. *"¿Qué significaría si eso desapareciera?"* | **El comprador se vende a sí mismo.** Reduce objeciones porque el argumento sale de su boca. |

**Necesidades implícitas vs. explícitas:** una queja ("el sistema es lento") es implícita; un
deseo enunciado ("necesito que procese en menos de 2 segundos") es explícita. **En ventas
grandes solo las explícitas predicen el éxito.** Todo el trabajo de I y N es esa conversión.

#### ⭐ 2.1.1 El mito de las preguntas abiertas — desmontado por quien lo midió

**Lo que la industria enseña:** *"Haz siempre preguntas abiertas. Las cerradas matan la conversación."*

**Lo que Rackham encontró:**

> El uso de preguntas abiertas o cerradas **no tuvo ningún efecto medible** sobre si la venta se
> cerraba o no.

La contraportada del libro lista *"en la venta de alto valor las preguntas abiertas son más
efectivas que las cerradas"* **dentro de su lista de creencias FALSAS.**

Los puntos finos:
1. La distinción abierta/cerrada resultó estadísticamente irrelevante. Los vendedores exitosos
   hacían montones de preguntas cerradas cuando servían para obtener un dato útil.
2. **Lo que importa es el CONTENIDO, no la forma gramatical.** Una pregunta de Implicación
   cerrada (*"¿Ese retraso te ha costado clientes?"*) vale más que una de Situación abierta
   (*"Cuéntame de tu negocio"*).
3. Rackham intentó hacer funcionar la clasificación y falló. Su propio equipo se resistió al
   resultado: *"estaban indignados, porque iba en contra de todo lo que habían enseñado."*
4. ⭐ **El daño real del consejo:** empuja a hacer más preguntas de **Situación**, que son las
   peor correlacionadas con vender y las que producen sensación de interrogatorio.

https://www.huthwaiteinternational.com/blog/neil-rackham-research-spin

#### 2.1.2 Los otros dos hallazgos que van contra el consenso

**Técnicas de cierre:** el cierre asumido, el alternativo, el del miedo — **correlacionaron
NEGATIVAMENTE con el éxito** en operaciones por encima de ~$10.000. Funcionan en ventas
pequeñas de una sola visita; en ventas grandes destruyen confianza.

**Objeciones:** los mejores vendedores **recibían menos objeciones**, no las manejaban mejor.
Y además:
- Las **Características** provocan preocupación por el precio.
- Las **Ventajas** provocan objeciones.
- Los **Beneficios** (= cómo esto cubre una necesidad explícita que el cliente enunció)
  provocan apoyo.

> ⭐ **Implicación para DTD: la objeción de precio se PREVIENE en la etapa de preguntas. No se
> resuelve en la etapa de negociación.**

#### 2.1.3 ⚠️ La honestidad sobre "los 35.000 llamados"

La propia Huthwaite publica cómo se acumularon, y matiza la cifra:
- No fueron 35.000 observaciones independientes de investigadores neutrales.
- Buena parte vino de proyectos de coaching integrado con Xerox, IBM y Motorola.
- Los gerentes de ventas eran entrenados para codificar llamadas, alcanzando **correlación 0,85
  contra grabaciones patrón** antes de ser autorizados a observar.
- El resultado reportado (**+17% de volumen** entre los primeros 1.000 entrenados) Rackham lo
  atribuye **al programa completo de coaching, no a "cuatro preguntitas"**.

**Veredicto:** la mejor evidencia disponible en el campo, y aun así no es un ensayo controlado.
Los datos crudos nunca fueron publicados ni auditados por terceros.

### 2.2 🔴 Sandler — el Pain Funnel

Sin investigación publicada. **Pero** su mecánica coincide exactamente con lo único que sí tiene
respaldo experimental fuerte (§4.1): es una cadena pura de preguntas de seguimiento.

**Las 8 preguntas, en orden:**

| # | Pregunta |
|---|---|
| 1 | **"Cuéntame más sobre eso…"** |
| 2 | **"¿Puedes ser más específico? Dame un ejemplo."** |
| 3 | **"¿Desde hace cuánto es eso un problema?"** |
| 4 | **"¿Qué has intentado hacer al respecto?"** |
| 5 | **"¿Y funcionó?"** |
| 6 | **"¿Cuánto crees que te ha costado eso?"** |
| 7 | **"¿Y cómo te sientes con lo que te ha costado?"** |
| 8 | **"¿Has renunciado a intentar resolverlo?"** |

**La lógica del orden** — tres tramos que bajan por niveles de dolor:
- **1–2 · queja de superficie:** de lo abstracto a lo concreto. No interpretes, no propongas.
- **3–5 · historia e intentos:** la 5 (*"¿funcionó?"*) es demoledora — obliga a admitir el
  fracaso de lo anterior, y eso abre el hueco para una alternativa.
- **6–8 · consecuencia y compromiso:** de lo operativo → financiero → **emocional**. La 7 es el
  pivote a lo personal.

⭐ **Regla de ejecución: cada pregunta profundiza la respuesta anterior. Ninguna introduce tema
nuevo.** Ese es todo el secreto.

**El Up-Front Contract** (el otro aporte de Sandler): acordar al inicio propósito, agenda de
ambos, tiempo y resultados aceptables — **incluido el permiso explícito para decir que no.**
Décadas antes que Voss, Sandler ya había encontrado que dar permiso para el "no" reduce la
resistencia.

https://offers.customgrowth.sandler.com/hubfs/PDFs/Sandler%20Pain%20Funnel.pdf

### 2.3 🟡 The Challenger Sale — Dixon & Adamson (2011)

Encuesta a ~6.000 vendedores de ~100 empresas grandes. Cinco perfiles; el **Challenger**
representó ~40% de los top performers en ventas complejas, mientras el **Relationship Builder**
—el arquetipo que la industria idealizaba— apenas ~7%.

**Teach / Tailor / Take Control.** Y el *Commercial Teaching Pitch* en 6 pasos:

1. **Warmer** — demuestras que hiciste la tarea describiendo SUS problemas.
2. **Reframe** — el giro: el problema no es lo que creen.
3. **Rational Drowning** — datos y caso de negocio.
4. **Emotional Impact** — una historia que lo hace personal.
5. **A New Way** — describes las capacidades necesarias **sin mencionar tu producto**.
6. **Your Solution** — recién ahora apareces tú.

⭐ **El paso 5 es el más violado y el más importante.** Si mencionas tu producto antes, todo lo
anterior se lee como pitch.

**Las críticas, que importan:**
- Correlación, no causalidad. Que el 40% de los top sean Challengers no prueba que entrenar
  Challenger produzca top performers. Nunca hubo estudio de intervención publicado.
- Muestra sesgada a enterprise B2B grande. Poca validez para PYME o venta transaccional.
- **Riesgo de mal uso:** mal interpretado, degrada la habilidad de preguntar — vendedores que
  llegan a "enseñar" sin haber entendido nada. **Rackham escribió específicamente sobre esto.**

### 2.4 🔴 Gap Selling — Keenan (2018)

Sin datos publicados, pero **operacionaliza SPIN mejor que el propio SPIN.**

**Tesis:** la venta es la distancia entre el estado actual y el estado futuro. Sin brecha, no
hay venta. *"El descubrimiento ES la venta."*

> ⭐ **"Cuantifica la brecha en dólares o el comprador no puede justificar la compra
> internamente. Sin número, no hay urgencia."**

**Los 4 tipos de pregunta:**
1. **Sondeo** — abiertas, piden detalle. *"Llévame paso a paso por…"*
2. **Proceso** — cómo hacen lo que hacen, no a alto nivel.
3. **Provocadoras** — retan supuestos. *"Si eso lleva tres años pasando, ¿qué te dice de la
   solución actual?"*
4. ⭐ **Validación — NO son abiertas, son cerradas a propósito.** Repites lo que entendiste para
   confirmar. *"Entonces, si te entendí: el problema no es X sino Y, y eso te cuesta $Z. ¿Correcto?"*

El cuarto tipo es la refutación práctica del dogma "siempre abiertas", y coincide exactamente
con el hallazgo de Rackham.

### 2.5 🔴 Question-Based Selling — Thomas Freese

> *"Lo que los vendedores preguntan —y cómo lo preguntan— importa más que cualquier cosa que digan."*

⭐ **El aporte que más nos sirve: empezar CERRADO, no abierto.**

> Empieza con preguntas diagnósticas, **estrechas y cerradas**, para establecer credibilidad.
> Solo después amplía hacia preguntas abiertas.

**La lógica:** una pregunta abierta al inicio (*"cuéntame de tu negocio"*) **te expone como
alguien que no sabe nada**. Una pregunta diagnóstica precisa **demuestra que perteneces al mundo
del comprador** y te compra el derecho a preguntar lo abierto después.

> **Regla: la credibilidad se gana con preguntas estrechas; la información se gana con preguntas
> amplias. En ese orden.**

Y el segundo aporte: *"los vendedores promedio intentan satisfacer la curiosidad del prospecto;
los mejores intentan hacerlo más curioso."* La curiosidad es un activo que se administra, no se
gasta.

### 2.6 🟡 Calificación — MEDDIC y BANT

| | **BANT** (IBM, años 60) | **CHAMP** | **MEDDIC** (PTC, años 90) |
|---|---|---|---|
| Componentes | Budget, Authority, Need, Timeline | Challenges, Authority, Money, Prioritization | Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion |
| Orden | Presupuesto primero | **Problema primero** | Métricas + mapa político |
| Para | Ciclos cortos, ticket bajo | Venta consultiva, presupuesto fluido | Enterprise complejo |

**Patrón práctico:** BANT o CHAMP ligero para triage en la primera conversación; MEDDIC para
gestionar el deal una vez que pasa el filtro.

🔴 Las cifras *"BANT bien implementado = +59% de conversión"* y *"MEDDIC = +25% de win rate"*
aparecen sin estudio. **Ignóralas.**

⚠️ **Para mensajería: BANT completo es demasiado invasivo para el primer contacto.** CHAMP
funciona mejor porque empieza por el problema en vez de por el dinero.

---

## 3. Negociación

### 3.1 🔴 Chris Voss — *Never Split the Difference* (2016)

Voss es explícito: su método viene de su experiencia en el FBI, **no de estudios académicos**.
Dicho eso, varias de sus técnicas tienen respaldo colateral.

**Empatía táctica.** Entender los sentimientos del otro y lo que hay detrás. **No es simpatía ni
acuerdo** — es demostrar comprensión sin conceder nada.

**Mirroring (espejo).** Repetir **las últimas 1 a 3 palabras** con entonación de pregunta.
Protocolo: voz grave y lenta → *"Lo siento…"* → espejo → **silencio de al menos 4 segundos** →
repetir. La mentalidad correcta: *"Por favor, ayúdame a entender."*

> 🟢 **Y aquí sí hay ciencia colateral:** Maddux, Mullen & Galinsky (2008), *J. Exp. Soc.
> Psychol.* 44 — en una negociación con zona de acuerdo aparentemente negativa, **67% de las
> díadas llegaron a acuerdo cuando el comprador imitaba al vendedor, contra 12,5% cuando no se
> les instruía a imitar.** Mediador del efecto: la confianza interpersonal.
> ⚠️ Ese estudio mide mimetismo **corporal**, no el espejo verbal de Voss. La extrapolación es
> razonable pero no está probada.

**Labeling (etiquetado).** Nombrar en voz alta la emoción que percibes:
- **"Parece que…"** · **"Suena a que…"** · **"Se ve como que…"**
- ⭐ **Regla crítica: nunca "yo escucho que" ni "yo creo que".** La palabra "yo" pone al otro a
  la defensiva. La etiqueta debe ser impersonal.
- ⭐ **Regla 2: cállate después de etiquetar.**

**El "No" como puerta, no como muro.** *"'No' no es rechazo; es el comienzo de la negociación."*

| ❌ Orientada al Sí | ✅ Orientada al No |
|---|---|
| "¿Tienes unos minutos?" | **"¿Es mal momento para hablar?"** |
| "¿Estás de acuerdo?" | **"¿Me estoy equivocando en algo?"** |
| "¿Seguimos adelante?" | **"¿Ya descartaron este proyecto?"** |

**"Eso es" vs. "Tienes razón"** — la distinción más útil del libro:

| Frase | Qué significa | Valor |
|---|---|---|
| **"Eso es." / "Exacto."** | Se siente genuinamente comprendido. Llegó solo a la conclusión. | 🟢 **Es la meta.** |
| **"Tienes razón."** | Un desaire cortés. Te da la razón para que te calles. | 🔴 **Señal de alarma.** |

Cómo provocarlo: **resume y parafrasea hasta que él mismo diga la frase.**

**Preguntas calibradas.** Abiertas, empiezan con **"qué"** o **"cómo"**, transfieren el problema
al otro sin confrontar. **Prohibido empezar con "¿por qué?"** — dispara defensa casi
universalmente. Las más útiles:

- "¿Cuál es el mayor desafío al que te enfrentas?"
- "¿Qué de esto es importante para ti?"
- "¿Cómo se supone que haga eso?"
- "¿Qué te llevó a…?" ← la versión no defensiva de "¿por qué?"
- "¿Qué haría falta para que esto funcione?"

**Las 4 formas de decir "no" sin decirlo:**
1. "¿Cómo se supone que haga eso?"
2. "Tu oferta es muy generosa, lo siento, pero no me funciona."
3. "Lo siento, me temo que simplemente no puedo hacer eso."
4. "Lo siento, no."

#### ⚠️ 3.1.1 La crítica académica formal a Voss

Existe y es relevante. *"Building on the Differences: A Rejoinder to Chris Voss"*,
**Negotiation Journal (MIT Press)**:

> Muchos preceptos de Voss son difíciles de transferir a entornos con **interdependencia mutua y
> de largo plazo**. En negociaciones que no son de rehenes, con periodos largos de
> implementación, *"los trucos invariablemente salen a la luz, las ilusiones se disipan, y la
> relación sufre."*

⭐ **Lectura recomendada para DTD:** usa la **capa de empatía** (etiquetado, espejo, resumen,
"eso es") sin reservas — es humanamente robusta y compatible con relaciones largas, que es
exactamente nuestro negocio (recompra cada 30–45 días). Usa la **capa táctica** (Ackerman,
accusation audit) con criterio y solo en negociaciones puntuales.

https://direct.mit.edu/ngtn/article/doi/10.1162/NGTN.a.38/134142/

### 3.2 🟢 Getting to Yes — Fisher, Ury & Patton (Harvard, 1981)

**Los 4 principios:** separa a las personas del problema · **enfócate en intereses, no en
posiciones** · genera opciones de beneficio mutuo antes de decidir · insiste en criterios
objetivos.

**Posición** = lo que dice que quiere ("no pago más de $700/m³").
**Interés** = por qué lo quiere (su margen, un competidor que le dio otro número, miedo a que le
cobren extras después).

⭐ **Solo los intereses se pueden negociar; las posiciones solo se ganan o se pierden.**

**Las preguntas que revelan intereses:**
- ⭐ **"¿Cómo llegaste a esa cifra?"** — pide el criterio objetivo detrás de la posición. **Es la
  pregunta más importante frente a una objeción de precio.**
- "¿Qué te preocuparía si aceptaras esto?"
- "Si te doy X, ¿qué me das a cambio?"

**BATNA / MAAN** — tu mejor alternativa si no hay acuerdo. **La única fuente real de poder.** En
vez de fijar un "precio mínimo" arbitrario, evalúa y mejora tu alternativa. Y estima la del
otro: si su alternativa es mala, tienes más margen del que crees.

### 3.3 🟡 La objeción de precio — con datos

**Regla #0: la objeción de precio casi nunca es sobre el precio.** Tres escuelas independientes
llegan a lo mismo:
- **Rackham:** hablar de características genera preocupación por el precio.
- **Keenan:** objeción de precio = brecha sin cuantificar.
- **Gong:** *"cuando dicen 'es muy caro', en realidad dicen 'todavía no veo por qué vale la pena'."*

**La secuencia:**

| Paso | Movimiento | Fuente |
|---|---|---|
| 1 | **Pausa.** Los mejores pausan ~5× más que lo normal tras una objeción; los promedio casi interrumpen. | Gong |
| 2 | **Espejo.** *"¿Fuera de tu presupuesto…?"* + silencio | Voss |
| 3 | **Etiqueta.** *"Parece que el número te sorprendió."* | Voss |
| 4 | ⭐ **"¿Comparado con qué?"** y **"¿Cómo llegaste a esa cifra?"** | Fisher-Ury |
| 5 | **Re-ancla en la brecha cuantificada.** | Keenan |
| 6 | Si hay que ceder: concesiones **decrecientes**, y siempre a cambio de algo. | Voss |

**🟡 Lo que NO hacer, con números (Gong):**

| Error | Efecto |
|---|---|
| **Descontar de inmediato** | Cierran **~25% menos** negocios a largo plazo |
| **Negociar precio por escrito** | Solo email **5%** · solo teléfono **15%** · **teléfono + email 35%** de win rate (n=37.671) |
| Decir "precio de lista" | Alarga el ciclo **~19%** |
| Acelerar el habla tras la objeción | Promedio suben a 188 palabras/min; los top mantienen 176 |
| Monologar la respuesta | Promedio: monólogos de 21,45 s. Los top responden más corto |
| **Responder sin preguntar** | ⭐ Los top responden a objeciones **con una pregunta el 54,3%** de las veces, vs. **31%** los promedio |
| Evitar el tema del precio | **Win rates 10% más altos cuando el precio se toca en la primera llamada** |

https://www.gong.io/blog/handling-sales-objections

---

## 4. Preguntas abiertas, "loops" y el techo

### 4.1 ⭐ 🟢 La mejor evidencia de todo este documento

Huang, Yeomans, Brooks, Minson & Gino (2017), *"It Doesn't Hurt to Ask: Question-Asking
Increases Liking"*, **Journal of Personality and Social Psychology.**

**Diseño:** 2 experimentos de conversación entre desconocidos + **1 estudio de campo con speed
dating**, con machine learning sobre transcripciones reales.

**Hallazgos:**
1. Relación robusta: **quien hace más preguntas cae mejor.** Se replica en los tres estudios.
2. ⭐ **Son las preguntas de SEGUIMIENTO las que más aportan** — las que demuestran que
   escuchaste la respuesta anterior. Son el marcador de *responsiveness*.
3. ⭐ **Resultado conductual, no autorreportado:** los que hicieron más preguntas de seguimiento
   **consiguieron significativamente más segundas citas.** Es una decisión con consecuencias, no
   una encuesta de "¿te caí bien?".
4. **La gente NO sabe esto.** Los participantes subestiman sistemáticamente cuánto los
   beneficiaría preguntar más. La intuición dice "habla de ti para caer bien"; los datos dicen
   lo contrario.

https://www.hbs.edu/ris/Publication%20Files/Huang%20et%20al%202017_6945bc5e-3b3e-4c0a-addd-254c9e603c60.pdf

> 👉 **Esta es la base científica de por qué el Pain Funnel funciona a pesar de no tener
> investigación propia: es una cadena pura de preguntas de seguimiento.**

### 4.2 El techo: preguntar de más también destruye

Aquí es donde casi todos los coaches de ventas se equivocan.

| Fuente | Muestra | Hallazgo |
|---|---|---|
| 🟢 **Boomerang** | Corpus grande de email real | ⭐ **1–3 preguntas = ~50% más probabilidad de respuesta. Pasando de 3, CAE.** Longitud óptima: 50–125 palabras |
| 🟡 Gong | 519.000 llamadas de descubrimiento | **11–14 preguntas** = máximo éxito. Más → *"se siente como interrogatorio"* |
| 🟡 Gong (2025) | 326.000 llamadas ≥10 min | Ganadas: **15–16 preguntas** · Perdidas: **~20** |
| 🟡 **Chorus.ai** | Descubrimiento | ⭐ **Con un comprador ya informado, pasar de 5 preguntas → −24% de cierre** |
| 🟡 Gong | C-Suite | Demasiadas preguntas de descubrimiento con alta dirección **daña gravemente** la venta |

⚠️ **Nota de honestidad:** los dos estudios de Gong no coinciden entre sí (11–14 vs. 15–16).
Muestras y años distintos. Lo consistente en ambos: **existe un óptimo, y pasarse correlaciona
con perder.**

**Cómo se evita la sensación de interrogatorio:**
1. **Elimina las preguntas que puedes responder investigando antes** (Rackham).
2. ⭐ **Distribuye, no amontones.** Los top reparten las preguntas parejo; los promedio **las
   amontonan al inicio** — exactamente la sensación de formulario.
3. **Profundidad sobre amplitud:** 3–4 problemas por conversación. Menos → dolor insuficiente.
   Más → prioridades en competencia.
4. **Alterna pregunta con aporte.** Después de 2–3 preguntas, da algo: un dato, un benchmark.
   Deja de ser extracción y pasa a ser intercambio.
5. **Usa preguntas de validación** que resumen en vez de extraer.
6. **Pide permiso.** *"¿Te importa si te hago un par de preguntas sobre cómo lo haces hoy?"*

### 4.3 ❌ El efecto Zeigarnik está refutado — el "loop abierto" funciona por otra razón

**El origen (1927):** Bluma Zeigarnik observó que los meseros recordaban mejor los pedidos no
cobrados. De ahí: *"las tareas inconclusas permanecen más activas en la memoria."*

**🟢 Meta-análisis 2025** — *"Interruption, recall and resumption"*, **Humanities and Social
Sciences Communications (Nature Portfolio)**:

> **NO se encontró ventaja de memoria para las tareas inconclusas.**
> **SÍ se encontró tendencia a retomar las tareas interrumpidas** (efecto Ovsiankina).

https://www.nature.com/articles/s41599-025-05000-w

| Afirmación popular | Estatus |
|---|---|
| "Un loop abierto hace que te recuerden mejor" | ❌ **Refutado.** Sin ventaja de memoria |
| "Un asunto sin cerrar genera tensión que empuja a resolverlo" | ✅ Respaldado — es motivación, no memoria |
| "Termina cada mensaje con una pregunta" | ⚠️ **Funciona, pero NO por Zeigarnik.** Funciona por reciprocidad conversacional y por Huang et al. |

⭐ **El matiz que sí cambia cómo escribimos:** el tirón de un asunto abierto **depende de que la
persona sepa qué hacer con él.** Una obligación sin resolver pesa en parte porque la mente no ha
decidido si actuar, esperar o soltarlo.

> **Traducción operativa: una pregunta al final de un mensaje solo funciona si es FÁCIL de
> contestar.** Una pregunta vaga y grande (*"¿cuál es tu visión para el próximo año?"*) no crea
> tensión productiva: crea parálisis, y el mensaje se archiva.

### 4.4 🔴 Conversational threading

Técnica de coaching social sin investigación propia. **Pero** es literalmente la
operacionalización de Huang et al.: hacer preguntas de seguimiento sistemáticamente.

**La mecánica:** casi toda frase contiene múltiples "hilos" de los que tirar.

> *"Este fin de semana fui a Valencia con mi hermano a ver un partido."*
> Hilos: **Valencia** · **hermano** · **partido** · **fin de semana**. Cuatro rutas legítimas.

**Los 3 movimientos:** tirar del hilo con una pregunta · con una historia propia · con una
opinión.

---

## 5. Escucha activa y rapport en texto

### 5.1 ⚠️ La evidencia es más matizada de lo que te venden

**Weger, Castle & Emmett (2010)**, *International Journal of Listening* 24(1). n=180.

- La **paráfrasis** se asoció con **mayor atractivo social del que escucha**…
- …pero **NO** con mayor satisfacción conversacional **ni con sentirse comprendido**.

⚠️ **Esto va contra el discurso estándar de "parafrasea y el otro se sentirá comprendido".
Parafrasear te hace caer mejor. No garantiza que el otro se sienta entendido.**

**Veredicto honesto:** la escucha activa funciona, pero su efecto principal documentado es
**sobre cómo te perciben a ti**, no sobre el estado interno del otro. La técnica con mejor
perfil no es la paráfrasis aislada sino **paráfrasis + pregunta de seguimiento + implicación
sostenida**.

### 5.2 Cómo se ejecuta cada herramienta EN TEXTO

En chat desaparecen el tono, la pausa y el cuerpo — donde vive la mitad del efecto. Hay que
compensar con estructura.

**Espejo:** en texto el espejo puro se lee frío o sarcástico. Necesita andamiaje.
- ❌ "¿Complicado…?"
- ✅ "¿Complicado en qué sentido? Quiero entender bien antes de proponerte nada."

**Etiquetado:** funciona **mejor** en texto que en voz, porque se puede releer. Sin "yo", en
tono tentativo, y **sin encadenar una pregunta inmediatamente después** — el etiquetado funciona
por el silencio que lo sigue; en texto, el silencio es **terminar el mensaje ahí**.

**Parafraseo:** aquí el texto **gana** a la voz — el otro puede leerlo, verificarlo y corregirlo
con precisión. Es la vía más eficiente para provocar el "Eso es" por escrito.

**Resumen** (= etiquetado + paráfrasis): la herramienta más potente. En venta escrita es el
mensaje de recapitulación, cerrado con **una** pregunta orientada al "no": *"¿Me falta algo o me
pasé de algo?"*

**🟢 Mimetismo lingüístico:** usa **las palabras exactas del comprador**, no tus sinónimos
corporativos. Si dice "envíos", no le contestes "logística de última milla". Copiar su
vocabulario es el mimetismo disponible en texto, y el mimetismo tiene respaldo experimental
(Maddux et al., §3.1).

---

## 6. Redes sociales y mensajería

### 6.1 Los frameworks de los expertos

**🔴 Gary Vaynerchuk — "Jab, Jab, Jab, Right Hook".** Dar, dar, dar, pedir. Los *jabs* son
contenido que beneficia al cliente sin pedir nada; el *right hook* es la petición.

⭐ **El matiz que el propio Vaynerchuk aclaró y casi nadie cita:** dar valor **no te da derecho a
cobrar el gancho**. Solo te da la audacia de pedir. **Te ganas el derecho de preguntar, no la
venta.**

> **Aplicación a DM:** si el primer mensaje que le mandas a alguien es tu precio o tu link,
> estás tirando el gancho sin haber dado un solo jab.

**🔴 Tim Hughes — *Social Selling*.** Su regla central: **deja de pitchear.** Las redes son "ser
social en un medio", no un canal de emisión. Y su tesis sobre conversión: **son las
conversaciones, no el contenido, las que convierten.** El contenido educa sobre el dolor; la
conversión pivota en la conversación.

**🔴 Daniel Disney — *The Ultimate LinkedIn Messaging Guide*** (Wiley, 2023). El único libro de
primera línea dedicado a la anatomía del mensaje directo. Su posición sobre notas de voz:
prefiere la nota de voz sobre el video, y **atribuye buena parte del efecto a la novedad** — lo
cual implica que **el efecto se degrada conforme se populariza**.

**🟡 LinkedIn SSI.** Los números que promociona (45% más oportunidades, 51% más probabilidad de
alcanzar cuota) son **marketing propio de LinkedIn, correlacionales**. Un SSI alto no *produce*
resultados: refleja los comportamientos que sí los producen.

### 6.2 🟡 El framework operativo de DM

**TRIGGER → QUALIFY → CONVERT → FOLLOW UP**

1. **Trigger.** Señales de alta intención: comentario con palabra clave, **respuesta a una
   story**, DM con consulta concreta. ⭐ **La señal más subestimada es la respuesta a una story**
   — el esfuerzo de la acción es el filtro.
2. **Qualify.** ⭐ **Exactamente UNA pregunta relevante antes de mandar cualquier link.** Impacto
   reportado: +30–50% de conversión frente a mandar el link genérico.
3. **Convert.** Precio exacto en el mensaje, no en un link. Una línea de prueba social. Todo en
   un mensaje.
4. **Follow up.** 20–30% de los que no compraron convierten tras el seguimiento.

### 6.3 Los 4 asesinos de conversación

⚠️ **Declaro el nivel de evidencia:** no existe ningún estudio cuantitativo que mida el efecto
de responder solo con precio o solo con un link en mensajería. Lo que sigue es consenso de
practicantes **más** inferencia desde datos adyacentes verificados.

1. **El link solo.** Te saca de la app: le entregas la conversación al navegador, donde no
   tienes contexto ni segunda oportunidad.
2. **El precio desnudo.** *"$800."* Punto. El cliente tiene dos opciones: comprar o irse. Y se
   va, porque un precio sin marco de valor solo se puede comparar contra otro precio.
3. **La respuesta de una palabra.** Cierra el turno sin devolver la pelota.
4. **El cierre inseguro.** *"¿Qué te parece?"* / *"¿Alguna otra pregunta?"* — no son preguntas,
   son la ausencia de una, y **señalan que no tienes confianza en tu solución.**

**🟡 El dato adyacente que sí está verificado:** Gong, sobre 25 millones de emails — **pitchear
reduce la tasa de respuesta hasta 57%.** Un link o un precio como primera respuesta **es un
pitch**.

### 6.4 🟢 Emojis: la ciencia va contra la intuición

Glikson, Cheshin & van Kleef (2018), *"The Dark Side of a Smiley"*, **Social Psychological and
Personality Science** 9(5).

> A diferencia de una sonrisa real, **los emoticones sonrientes NO aumentan la percepción de
> calidez, y SÍ reducen la percepción de competencia.** Y esa percepción de baja competencia
> **reduce la cantidad de información que la otra persona comparte contigo.**

**Matices honestos:** hay una réplica preregistrada con resultados mixtos (Collabra 2023), e
investigación de 2026 encuentra que emojis positivos con frases positivas o neutras **sí mejoran**
la percepción de competencia. El moderador clave es la **apropiación contextual**.

⭐ **Regla defendible:** **cero o mínimos en el primer contacto con un desconocido** (es
exactamente el escenario de "primera impresión virtual" donde el efecto negativo está
documentado). **Una vez hay rapport y si el cliente los usa, refléjalos.**

### 6.5 🔴 Notas de voz: aquí NO hay datos, y lo digo

Los claims de *"+30–40% de respuesta"* son **de vendors de herramientas de outreach. No hay
estudio independiente ni revisado por pares.** Una de esas propias fuentes lo admite.

**Lo que sí se puede afirmar honestamente:**
1. Daniel Disney la recomienda, y atribuye el efecto a la **novedad** — o sea, se degrada.
2. Transporta tono y emoción, lo que reduce malentendidos en decisiones caras.
3. Hablar es ~3× más rápido que escribir en móvil.
4. Duración recomendada por consenso práctico (no por dato): **10–15 segundos**.
5. **Es cultura por defecto en Brasil**, India y el Sudeste Asiático — relevante para LATAM.
6. **Contra:** no es buscable, no se puede escanear, obliga al receptor a poder escuchar.

⭐ **Recomendación: úsala como desempate emocional** (una objeción difícil, un malentendido, una
relación ya tibia), **no como primer contacto. Y no le prometas a nadie un porcentaje.**

### 6.6 LATAM y WhatsApp

**🟢 Penetración:** Brasil 93–99% · México ~93% (alcanza 92,2% de la audiencia online) · México
y Colombia >80% de adopción. LATAM total ~420 millones de usuarios.

**🟢 BCG + Meta (2024)** — la fuente más sólida sobre mensajería de negocio en LATAM, y casi
nadie la cita. México: encuesta a **400 empresas** + 30 entrevistas. **7 de cada 10 consumidores
mexicanos** consideran la mensajería más rápida y fácil; **90%** de las empresas la considera
importante para su éxito.

https://www.bcg.com/publications/2024/new-horizons-in-business-messaging-pioneering-approaches-for-mexican-businesses

#### 🟢 6.6.1 La ventana de 24 horas — la regla que más gente desconoce

Documentación oficial de Meta:

- Cuando un usuario te escribe, se abre un temporizador de **24 horas** (*customer service window*).
- **Dentro** de la ventana puedes enviar mensajes de formato libre sin cargo de plantilla.
- Si el usuario vuelve a escribir antes de que expire, **el temporizador se reinicia**.
- **Fuera** de la ventana, solo plantillas aprobadas por Meta.

⭐ **Implicación estratégica directa: el temporizador se reinicia solo si el cliente RESPONDE.
Por eso terminar cada mensaje con una pregunta no es solo buena práctica conversacional — es lo
que mantiene abierto tu canal gratuito. Un dead end en WhatsApp Business te cuesta dinero
literal: la próxima vez tendrás que pagar una plantilla.**

Instagram tiene su propia ventana de 24 h desde la última interacción del usuario.

---

## 7. Buenas prácticas de CRM

### 7.1 Higiene de datos

**🟡 Por qué fallan los CRM:** el rango citado es 30–70% de implementaciones fallidas, con **la
baja adopción como causa #1**. Que el rango sea tan amplio es en sí la señal de que no hay un
estudio sólido detrás.

⭐ **El hallazgo con lógica causal clara y el más útil de la sección:** cuando mides a los
vendedores por **cumplimiento de registro** en vez de por **calidad del registro**, registran
rápido, incompleto y con cualquier valor que les deje avanzar. **Forzar campos obligatorios sin
diseñarlos bien produce datos basura con apariencia de datos completos.**

**🟢 Campos obligatorios — el criterio correcto (Salesforce, oficial):** no "muchos campos
obligatorios", sino **atarlos a etapas**. Tres conceptos por etapa: *entry rules* (qué debe ser
cierto para entrar), *key fields* (los pocos que se llenan ahí), *exit rules* (la evidencia para
avanzar). Y explícitamente: **minimiza el número de etapas.**

**🟢 Deduplicación (Salesforce, oficial):** separa *matching rules* (qué cuenta como duplicado)
de *duplicate rules* (qué hacer: alertar o bloquear). ⭐ **Empieza en modo alerta, no bloqueo**,
para medir el volumen real sin frenar a los usuarios.

**🟡 Decaimiento:** los datos B2B se degradan 30–40% anual; los emails son lo que más rápido se
pudre. No pude acceder al estudio primario de ninguna atribución — orden de magnitud, no cifra.

🔴 *"La mala calidad de datos cuesta USD 12,9M al año (Gartner)"* — circula también como 15M y
como 100M+. **La inconsistencia entre versiones delata la cita de segunda mano.**

### 7.2 Diseño del pipeline

⭐ **El principio central: las etapas se definen por ACCIONES DEL COMPRADOR, no por actividades
del vendedor.**

- *"Envié la propuesta"* es una actividad del vendedor que ocurre independientemente del interés
  del comprador.
- *"El decisor dio feedback de la propuesta"* es un compromiso del comprador que demuestra
  progresión real.

> **Regla operativa: si un vendedor no puede articular la acción del comprador que justifica la
> etapa, el negocio no avanza.**

**🟡 Cuántas etapas:** 5 a 8 máximo. Venta transaccional 5–6; enterprise 7+.

**Plantilla de definición de etapa:**

```
ETAPA: [nombre]
Definición:        qué significa que un lead esté aquí (1 frase)
Entra cuando:      [acción observable del comprador]
Campos clave:      [2-3 campos que deben llenarse aquí]
Sale cuando:       [acción observable del comprador, no del vendedor]
Duración esperada: [X días] → si excede, es un deal estancado
```

### 7.3 Cadencias de seguimiento

🔴 **LEE ESTO PRIMERO.** Las estadísticas más citadas del mundo del follow-up **no tienen fuente
primaria**:
- *"80% de las ventas requieren al menos 5 toques"*
- *"80% de las ventas ocurren entre el 5° y el 12° contacto, pero 92% se rinde en el 4°"*
- *"44% de los vendedores se rinde tras un solo seguimiento"*
- *"Gartner B2B Sales Benchmark Study 2026, 4.200 deals, 8,4 toques promedio"* — **no encontré
  ese estudio. Trátalo como inventado hasta que aparezca el documento.**

Una de las fuentes que las reporta **admite** que "el estadístico se ha adoptado como dato
estándar de la industria y se repite sin citar la investigación original".

**🟡 Lo que sí hay:** consenso de 7 a 13 toques distribuidos en 21 a 27 días, **concentrados en
los primeros 3 días**, y **multicanal** — la efectividad viene de variar el canal, no de repetir
el mismo.

**🟡 Y el dato duro de conversación (Gong):** la ratio óptima hablar/escuchar es **~43:57**.
Hablar más del 65% del tiempo baja el win rate. ⚠️ Las cifras de Gong varían entre publicaciones
(43% / 46% / 57%); toma **~45–57% de talk time** como zona sana y no memorices un número mágico.

⭐ **Métrica mejor que el ratio bruto:** *speaker switches per minute*. Un 50/50 con dos
monólogos de 20 minutos es pésimo; más ida y vuelta es mejor.

### 7.4 Motivos de pérdida — la sección más importante

**🟡 Los errores documentados:**

1. ⭐ **No confíes en el autorreporte.** Se cita que **los vendedores se equivocan sobre por qué
   ganan y pierden ~60% de las veces.** (Fuente: Clozd, que vende análisis win/loss — hay
   conflicto de interés, pero la dirección del sesgo es intuitivamente correcta.)
2. Menos del 20% de las empresas hace entrevistas post-decisión formales.
3. **Usa un tercero neutral** — alguien fuera de la interacción de venta obtiene razones más honestas.
4. ⭐ **Taxonomía cerrada** de códigos: precio, funcionalidad faltante, timing, política interna,
   competidor, sin respuesta. **Sin lista cerrada no hay análisis posible.**

### 7.5 🟢 Kommo — documentación oficial

Esta es la sección con más documentación verificada, y las restricciones son reales y estrechas.

**Pipelines:**
- Pipeline por defecto: Initial Contact, Offer Made, Negotiation, Closed-Won, Closed-Lost.
- La etapa **"Incoming leads"** recibe todo lo que llega de chat, email o formularios. **No se
  puede renombrar ni eliminar**, solo desactivar.
- Closed-Won / Closed-Lost: no se eliminan ni se mueven, pero **sí se renombran**.
- ⚠️ **No existe campo nativo de "motivo de pérdida".** Hay que crearlo como campo personalizado
  de lista desplegable y hacerlo obligatorio.

**Digital Pipeline:** Leads → Automate → etapa → Add Trigger. ⚠️ **Setting crítico:** *"Apply the
trigger to all leads already in this stage"* — si no lo marcas, **los leads que ya estaban ahí
se ignoran.** Fuente clásica de "el bot no se disparó".

**Salesbot:** scripting JSON con bloques Question / Answer / Finish, 16+ handlers. ⚠️ **Techo
duro: la configuración JSON no puede exceder 64 KB.** Y **no hay mecanismo documentado explícito
de "transferir a humano"** en Salesbot — el handoff se implementa indirectamente.

#### ⭐ 7.5.1 El AI Agent de Kommo — los límites que condicionan todo el diseño

| Aspecto | Límite |
|---|---|
| **Rol y personalidad (Persona)** | **máx. 1.500 caracteres** |
| **Guidelines** | **hasta 50 líneas × 300 caracteres por línea** |
| **Actions** | **máx. 20 por agente** · WHEN hasta 5 condiciones · DO hasta 5 acciones |
| Tono de voz | Casual / Friendly / Professional |
| Largo de respuesta | Short 100–200 car. · Medium 150–250 · Long 200–300 |
| Idioma | optimizado para inglés, **español**, portugués, turco, indonesio y ruso |
| Delay antes de responder | 1 a 86.400 s (default **600 s = 10 min**) |
| **Sources** | URL, PDF, DOC, DOCX, texto manual · **máx. 45 MB** · trial 10 fuentes / pago **100** |
| Crawling de URL | hasta 1.500 páginas; **no parsea páginas con login, CAPTCHA o contenido dinámico** |

**Comportamiento — lo crítico:**
- ⭐ **Solo responde a mensajes entrantes. NO puede iniciar conversaciones.**
- ⭐ **"Replies are generated only when relevant information is available in your knowledge
  sources"** — si no hay info relevante, **NO RESPONDE**, en lugar de dar una respuesta genérica.
  Es buen comportamiento anti-alucinación, **pero significa que los huecos de tu KB producen
  SILENCIO, no un "no sé". Hay que cubrirlo con un Action de fallback.**
- ⚠️ **Advertencia oficial de Kommo:** *"Instructions based on system logic aren't interpreted
  correctly by the AI agent and shouldn't be added"* — **no escribas lógica de sistema en
  lenguaje natural en el prompt. La lógica va en Actions.**
- Múltiples agentes comparten un mismo pool de créditos.
- Transcripción de mensajes de voz: **solo en plan Pro**.

**Actions — las opciones que nos sirven:**
- **WHEN:** *Client wants to* (purchase, support, **speak to agent**…) · *Client asks about*
  (price, delivery, order status…) · *Client sentiment* (**frustrated**, confused…) ·
  *Client provides* (email, phone, name…) · *Message contains* · *Working hours* ·
  **Response timeout** (configurable hasta 24 h).
- **DO:** ⭐ **Transfer to user** (el handoff a humano) · **Answer using knowledge base source** ·
  ⭐ **Don't mention certain topics** (el guardrail negativo) · Add task · Set field · Manage tags
  · **Change lead stage** · Change responsible user · Send file.

https://support.kommo.com/docs/kommo-ai-agent · https://support.kommo.com/docs/add-and-manage-ai-knowledge-sources

---

## 8. Entrenar y configurar la IA

### 8.1 🟢 Cómo se escribe un documento que una IA consume bien (Zendesk, oficial)

Las reglas más específicas que encontré, y **varias chocan con cómo están escritos nuestros
documentos hoy**:

**Contenido:**
- **Un tema por artículo, completo.** Nada de mezclar temas no relacionados.
- **Responde directamente; no impliques la respuesta.**
- ⭐ **Artículos autocontenidos. NO enlaces hacia afuera** — el retriever no sigue enlaces.
- **Elimina duplicados y contradicciones.**
- **Usa el vocabulario del cliente**, no el interno. Explica los acrónimos en el primer uso.
- ⭐ **Repite el sustantivo en vez de usar un pronombre que depende del contexto anterior.**
  ("Este", "eso", "el mismo" se rompen al fragmentar.)

**Estructura:**
- Encabezados claros. Viñetas para hechos, listas numeradas para tareas secuenciales.
- **Evita pasos anidados** — si hay varias soluciones, cada una como instrucción separada.
- ⭐ **La regla más importante y menos obvia: REPITE LA PREGUNTA DENTRO DEL CUERPO.** *"Esto
  asegura que el contexto no se pierda durante el chunking, y evita separar las preguntas de sus
  respuestas."*
- ⭐ **Evita tablas.** La información en tablas es *"harder for an LLM to understand"* que la
  prosa. ⚠️ Contradice la intuición: las tablas se ven "estructuradas" pero **se fragmentan mal**.
- Toda imagen necesita su equivalente en texto.

**Para procedimientos:** patrón ⭐ **Tell → Ask → Conditional**, no Tell → Conditional. Cuando hay
una bifurcación, la IA primero **hace la pregunta aclaratoria** y luego ramifica. Si escribes la
condicional sin la pregunta, la IA asume.

https://support.zendesk.com/hc/en-us/articles/4408845739162-Optimizing-your-knowledge-content-for-generative-AI

### 8.2 🟢 Gobernanza del contenido (Intercom, oficial)

- ⭐ **La métrica más simple y directa:** rastrea *"involved"* (cuántas veces la IA usó el
  contenido) vs. *"resolved"* (cuántas veces lo resolvió). **La brecha entre las dos columnas es
  tu lista de trabajo.** Bajo 50% de resolución = candidato a reescritura.
- **El ciclo base:** rastrea dónde la IA hace handoff → identifica qué no sabía → agrega o
  corrige conocimiento.
- Cadencia: actualizaciones de producto semanales; refresco mensual de lo que lleva 6+ meses sin
  tocarse.

### 8.3 🟢 Chunking y recuperación (Anthropic, con números medidos)

**Contextual Retrieval** — antepone a cada fragmento un contexto explicativo generado por el
modelo antes de embeberlo.

| Configuración | Tasa de fallo de recuperación | Reducción |
|---|---|---|
| Baseline | 5,7% | — |
| + Contextual Embeddings | 3,7% | **−35%** |
| + Contextual Embeddings + BM25 | 2,9% | **−49%** |
| + reranking | 1,9% | **−67%** |

- Tamaño de chunk: *"no more than a few hundred tokens"* típicamente, pero es un parámetro a
  tunear, no una constante.
- Recuperar **top-20** superó a top-5 y top-10.
- ⭐ **Híbrido semántico + BM25 supera a cualquiera solo.** BM25 atrapa coincidencias exactas —
  crítico para **códigos e identificadores**. Muy relevante para logística: `DTD-XXXX`, códigos
  de puerto, números de contenedor.

https://www.anthropic.com/news/contextual-retrieval

⭐ **Metadato que en logística no puede faltar: la fecha de vigencia de una tarifa va DENTRO del
cuerpo del chunk, no solo en el nombre del archivo — el nombre de archivo no viaja al contexto.**

### 8.4 🟢 System prompts (Anthropic, oficial)

**Estructura mínima:** contexto de la tarea · descripción detallada y reglas · tarea inmediata ·
formato de salida. Se agregan según necesidad: tono, ejemplos, guardrails.

**⭐ Hallazgos que contradicen la práctica común:**
- **El lenguaje agresivo empeora los resultados.** "CRITICAL!", "YOU MUST", "NEVER EVER"
  sobre-disparan y producen peores resultados que instrucciones calmadas y directas. **Si tu
  prompt de ventas está lleno de mayúsculas y signos de exclamación, probablemente lo estés
  empeorando.**
- **Los modelos siguen instrucciones literalmente: si no lo pides, no lo obtienes.**
- **Las etiquetas XML son el mejor método de estructuración**, por encima de Markdown.
- **Prompt caching:** contenido estático primero, variable al final.

**Arquitectura (Anthropic, "Building Effective Agents"):** de los 5 patrones, el que aplica a un
bot de leads es ⭐ **Routing** — clasificar la entrada y dirigirla a tareas especializadas. El
ejemplo que la propia guía menciona es *"dirigir consultas de servicio al cliente al canal
apropiado"*.

Y el principio general: *"Start with simple prompts, optimize them with comprehensive
evaluation, and add multi-step agentic systems only when simpler solutions fall short."*

### 8.5 🟢 Anti-alucinación (Anthropic, oficial) — lo más accionable del informe

**1. Permite explícitamente decir "no sé".**
> *"Explicitly give Claude permission to admit uncertainty. This simple technique can
> drastically reduce false information."*

**2. Usa citas directas para anclar hechos.** Para documentos largos, pide extraer citas
textuales primero y luego ejecutar la tarea.

**3. ⭐ Verifica con citas — el patrón más fuerte.** Textual de Anthropic:
> *"After drafting, review each claim... For each claim, find a direct quote from the documents
> that supports it. If you can't find a supporting quote for a claim, remove that claim."*

**Traducción a ventas:** *"para cada precio, plazo o condición que menciones debe existir una
cita textual de una fuente. Si no la hay, elimina la afirmación y ofrece conectar con un asesor."*

**4. ⭐ Restricción de conocimiento externo — la instrucción de una línea con mejor relación
esfuerzo/beneficio:**
> *"Explicitly instruct Claude to only use information from provided documents and not its
> general knowledge."*

⚠️ **Advertencia oficial:** *"while these techniques significantly reduce hallucinations, they
don't eliminate them entirely."*

https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

### 8.6 ⭐ Separar hechos de guion — las tres capas

La arquitectura correcta separa tres cosas con **ciclos de vida distintos**:

| Capa | Contenido | Dónde vive | Quién la cambia | Frecuencia |
|---|---|---|---|---|
| **Hechos** | precios, plazos, rutas, políticas, capacidades | Knowledge base / Sources | Operaciones | Alta |
| **Guion** | orden de preguntas, tono, manejo de objeciones | System prompt / Persona + Guidelines | Ventas | Baja |
| **Lógica** | cuándo escalar, etiquetar, cambiar etapa | Actions / Salesbot / código | Quien administre el CRM | Baja |

⭐ **El error más común es meter precios en el system prompt.** Ahí no tienen fecha de vigencia,
no tienen fuente citable, y cambiarlos exige tocar el comportamiento del agente.

Kommo empuja hacia esta separación **por diseño** (Persona vs. Sources vs. Actions), y su
advertencia de que *"instructions based on system logic aren't interpreted correctly"* es
exactamente este principio.

### 8.7 Escalamiento a humano

**🟡 Expectativas:** 65% de los clientes espera escalamiento fluido de bot a humano. **74%
encuentra frustrante repetir su historia** a un agente distinto (Zendesk CX Trends, >11.000
encuestados — esta sí tiene metodología).

🔴 Los benchmarks de *deflection* ("mediana 41,2%, cuartil superior 58,7%") vienen de un blog sin
metodología. **No los uses.**

⭐ **Cómo escalar bien — la parte que casi todos hacen mal.** El handoff **no puede ser "espera a
un agente"**. El humano debe recibir en el traspaso:
1. Resumen de la conversación
2. El problema identificado
3. Los datos relevantes (cotización, ruta, Shipping Mark)
4. Una respuesta propuesta
5. El motivo del escalamiento

**🟢 Human-in-the-loop para acciones con efectos (OpenAI, oficial):** el patrón formal registra
una **interrupción de aprobación** en vez de ejecutar, devuelve un `state` reanudable, y
**reanuda la misma ejecución** tras la aprobación. Concepto clave: *"If the review might take
time, serialize state, store it, and resume later. That's still the same run."*

### 8.8 🟢 Evaluación (Anthropic, oficial)

**Principios:**
1. **Sé específico a la tarea** — incluye casos borde: entradas irrelevantes, excesivamente
   largas, dañinas, y **casos ambiguos**.
2. **Automatiza cuando puedas.**
3. ⭐ **Prioriza VOLUMEN sobre calidad de calificación.** *"More questions with slightly
   lower-signal automated grading is better than fewer high-quality hand-graded evals."* Es el
   consejo más contraintuitivo.

| Método | Uso | Volumen típico |
|---|---|---|
| Exact match | respuestas categóricas (clasificación) | 1.000+ |
| **Cosine similarity** | consistencia — preguntas similares → respuestas similares. **Ideal para un bot de FAQ** | 50 grupos de paráfrasis |
| LLM-as-judge, Likert 1-5 | tono y estilo, uso de contexto, relevancia | 100–500 |
| LLM-as-judge, binaria | seguridad, privacidad (¿contiene PII?) | 500+ con casos borde |

**Regla:** *"Use a different model for evaluation than the one being evaluated."*

**🟡 Precauciones con LLM-as-judge:**
- **Calibra la rúbrica contra etiquetas humanas** — objetivo 75–90% de acuerdo antes de escalar.
- ⭐ **El golden set debe salir de la distribución REAL** (consultas reales, respuestas reales),
  no de ejemplos sintéticos que le parecen plausibles a quien escribió el dataset. **Es el error
  más frecuente.**
- **Aplica checks heurísticos primero** (regex, validación de formato) antes de gastar en jueces LLM.
- ⭐ **Trata un 100% de aprobación como señal de que el eval es demasiado fácil**, no como éxito.
- **Evalúa transcripciones de sesión completas**, no turnos sueltos: los evals de un turno no ven
  preguntas repetidas sin responder ni señales de frustración.

### 8.9 🟢 Marco legal: hay que decir que es un bot

**California — B.O.T. Act (SB 1001), vigente:**
- **Es ilegal usar un bot para comunicarse con una persona en California con el fin de incentivar
  una venta sin divulgar que la comunicación es mediante un bot.**
- La divulgación debe ser **clara, conspicua y visible en la conversación misma** — no en letra
  chica ni en una política enlazada.
- **Alcance extraterritorial:** trata sobre comunicarse con personas *en* California. Tu
  ubicación no te saca del alcance.
- Sanción: hasta **USD 2.500 por infracción**.

**Unión Europea — Reglamento de IA, Artículo 50:**
- Reglamento (UE) 2024/1689. ⭐ **El artículo 50 es exigible desde el 2 de agosto de 2026.**
- Los sistemas destinados a interactuar directamente con personas deben asegurar que **un usuario
  razonablemente informado entienda que está interactuando con un sistema de IA.**
- **Para un chatbot, la notificación debe darse antes o al inicio mismo de la conversación.**
- **Alcance extraterritorial:** aplica a proveedores fuera de la UE si la salida del sistema se
  usa en la UE.

**América Latina (🟡 panorama en movimiento):** Brasil (PL 2338/2023), Colombia (obligación
explícita de divulgar la interacción con IA + permitir opt-out) y Chile (informar de forma
oportuna, clara e inteligible) tienen marcos en etapas avanzadas.
⚠️ **No encontré normativa específica de Venezuela** sobre divulgación de bots. Aplicaría el
marco general de protección al consumidor y datos personales.

**🟡 WhatsApp:** múltiples fuentes reportan que Meta exige una **ruta clara de escalamiento a
humano** dentro del flujo, que las experiencias totalmente automatizadas sin salida violan la
política, y que preocupa la **suplantación** — bots que se hacen pasar por humanos.
Se reporta una actualización del 15 de enero de 2026 ("AI-Assisted Business Messaging
Guidelines"). ⚠️ **Las fuentes son blogs de vendors, no la política en sí. Verificar en
https://whatsappbusiness.com/policy/ antes de decidir producto.**

⭐ **El denominador común de los cuatro marcos** (cumplir el más estricto te cubre en todos):
1. Divulgación **al inicio** de la conversación, no enterrada.
2. **Visible dentro del hilo**, no en un enlace.
3. **Salida a humano disponible.**
4. **No suplantar a un humano** — ni por nombre, ni por firma, ni evadiendo la pregunta "¿eres un bot?".

---

## 9. Tabla maestra: qué es cierto y qué no

| Dato | Estado | Fuente real |
|---|---|---|
| 7× calificar en la 1ª hora / 60× vs. 24 h | 🟢 | HBR, marzo 2011 — **del análisis de 1,25 M de leads**, no de la auditoría |
| 42 h de respuesta promedio; 23% nunca responde | 🟢 | HBR 2011 |
| 21× calificación / 100× contacto (5 vs. 30 min) | 🟡 | Oldroyd/InsideSales 2007 |
| **Pasadas 20 h, insistir empeora el contacto** | 🟡 | Oldroyd/InsideSales 2007 |
| 2,6× cierre (<5 min vs. >24 h) | 🟡 | Optifai 2025-26, 939 empresas |
| **SLA escrito: 54,9% vs. 29,5% de cumplimiento** | 🟡 | Blazeo 2026, 573 empresas |
| 82% espera respuesta ≤10 min | 🟢 | HubSpot Research |
| 73,3% prefiere mensajería / 75% quiere trato de amigo | 🟢 | Kantar-Meta 2025, 11.056 personas, 22 mercados |
| 90% resp. rate + <15 min = insignia de Meta | 🟢 | Meta Business Help Center |
| Ventana de 24 h de WhatsApp | 🟢 | Meta for Developers |
| 7 de 10 mexicanos prefieren mensajería | 🟢 | BCG + Meta 2024, 400 empresas |
| **Preguntar aumenta el agrado; los follow-ups son la clave** | 🟢 | Huang et al. 2017, JPSP + speed dating |
| **Abierta vs. cerrada NO afecta el cierre** | 🟡 | Rackham / Huthwaite, SPIN Selling |
| **1–3 preguntas por mensaje escrito = +50% respuesta** | 🟢 | Boomerang, corpus grande de email |
| 11–16 preguntas por llamada; ~20 = perder | 🟡 | Gong, 519K y 326K llamadas |
| **>5 preguntas a un comprador informado = −24% cierre** | 🟡 | Chorus.ai |
| **Responder a objeciones con pregunta: 54,3% vs. 31%** | 🟡 | Gong, 67.149 grabaciones |
| Descontar de inmediato = ~25% menos cierres | 🟡 | Gong |
| Negociar precio: email 5% · teléfono+email 35% | 🟡 | Gong, 37.671 oportunidades |
| Precio en la 1ª llamada = +10% win rate | 🟡 | Gong |
| Pitchear reduce respuestas hasta 57% | 🟡 | Gong, 25M emails |
| **Mimetismo: 67% vs. 12,5% de acuerdos** | 🟢 | Maddux et al. 2008, JESP |
| Emojis reducen percepción de competencia | 🟢 (réplica mixta) | Glikson et al. 2018, SPPS |
| Paráfrasis → atractivo social, **NO** "sentirse comprendido" | 🟢 | Weger et al. 2010, Int. J. Listening |
| **Zeigarnik: sin ventaja de memoria** | 🟢 | Meta-análisis 2025, Nature HSSC |
| Contextual Retrieval: −67% fallos de recuperación | 🟢 | Anthropic |
| Límites del AI Agent de Kommo (1.500 car., 20 actions…) | 🟢 | Kommo Support, oficial |
| **Kommo: sin info relevante NO responde (silencio)** | 🟢 | Kommo Support, oficial |
| Zendesk: repetir la pregunta en el cuerpo; evitar tablas | 🟢 | Zendesk, oficial |
| EU AI Act art. 50 exigible desde 2026-08-02 | 🟢 | Comisión Europea |
| — | — | — |
| **"78% le compra al primero que responde"** | 🔴 | La encuesta citada NO EXISTE |
| **"98% open rate de WhatsApp"** | 🔴 | Sin fuente primaria |
| **"90% open rate de DM de Instagram"** | 🔴 | Cadena circular de blogs |
| **"Notas de voz +30-40% de respuesta"** | 🔴 | Claims de vendors, sin estudio |
| **"80% de las ventas requieren 5+ seguimientos"** | 🔴 | Sin fuente primaria localizable |
| **"44% se rinde tras un solo seguimiento"** | 🔴 | Sin fuente |
| **"Gartner 2026: 4.200 deals, 8,4 toques"** | 🔴 | El estudio no aparece. Probablemente inventado |
| **"Calidad del lead cae 80% tras 5 min"** | 🔴 | Atribuido a HBR; no está en el artículo |
| **"Mala calidad de datos = USD 12,9M/año"** | 🔴 | Cifra inconsistente entre versiones |
| **"BANT +59% conversión / MEDDIC +25% win rate"** | 🔴 | Sin estudio |
| **"Deflection mediana 41,2%"** | 🔴 | Blog sin metodología |

---

## 10. Las 12 conclusiones que se bajaron al documento operativo

1. **Responde rápido, pero no insistas eternamente.** La primera hora vale 7×; pasadas ~20 horas
   los intentos adicionales empeoran el contacto.
2. **Escribe el SLA.** 54,9% vs. 29,5% de cumplimiento. Es la intervención más barata con mayor
   retorno documentado.
3. ⭐ **"Siempre preguntas abiertas" es falso.** Lo que importa es Situación vs. Implicación, no
   la forma gramatical. Y el consejo hace daño porque empuja a preguntas de Situación.
4. ⭐ **La pregunta de seguimiento es la unidad fundamental.** Es lo único con respaldo
   experimental sólido, y es lo que hacen bien el Pain Funnel, el threading y la escucha activa.
5. ⭐ **UNA pregunta por mensaje.** Dos preguntas producen una respuesta parcial. Cero preguntas
   producen un dead end — y en WhatsApp, un dead end te cierra la ventana gratuita de 24 horas.
6. ⭐ **La pregunta tiene que ser fácil de contestar.** El "loop abierto" no funciona por
   Zeigarnik; funciona por reciprocidad, y solo si la persona sabe cómo responder.
7. **Empieza estrecho, luego abre.** La credibilidad se gana con preguntas diagnósticas
   precisas; la información, con preguntas amplias. En ese orden.
8. ⭐ **Ante una objeción: pausa, y responde con una pregunta.** 54,3% vs. 31%.
9. ⭐ **La objeción de precio se previene preguntando, no se resuelve negociando.** Y descontar de
   inmediato cuesta ~25% de los cierres.
10. **Emojis: cero en el primer contacto, espejo después.**
11. ⭐ **Separa hechos / guion / lógica en tres capas.** Nunca metas precios en el prompt.
12. ⭐ **Un hueco en la KB de Kommo produce silencio, no un "no sé".** Hay que cubrirlo
    explícitamente.

---

*DTD Cargo · investigación interna, 2026-08-03. El documento operativo derivado es
[`docs/marketing/conversacion-crm.md`](../docs/marketing/conversacion-crm.md). Las cifras
marcadas 🔴 están acá **para que nadie las vuelva a usar**, no para citarlas.*
