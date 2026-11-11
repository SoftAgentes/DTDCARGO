/**
 * lib/news/prompts.ts · Plan v4 — Builders puros de prompts para Claude
 *
 * Funciones que devuelven STRINGS de prompt. Reusables por:
 *  - Modo Auto: las server actions usan estos builders + llaman a Anthropic SDK
 *  - Modo Manual: el modal ManualPromptModal usa los mismos builders + muestra
 *    el prompt al usuario para que lo pegue en claude.ai
 *
 * Single source of truth — si cambia el prompt, cambia en un solo lugar.
 *
 * Todos los prompts:
 *  - Castellano neutro Latam
 *  - SEO-first (inyectan keywords)
 *  - Pain points framework (resuelven dolores del cliente)
 *  - JSON discipline (output estructurado)
 */

import {
  NEWS_CATEGORIES_V4,
  NEWS_TIPOS,
  type NewsCategoria,
  type NewsTipo,
} from "./categories";
import {
  ALL_ANGULOS,
  ALL_CANALES,
  CEREBRO_TIPOS,
  type Angulo,
} from "./cerebro";
import {
  keywordsForPrompt,
  painPointsFor,
} from "./seo-keywords";

export type Tone = "informativo" | "curiosidad" | "polemico";

/**
 * Dialecto del castellano usado en el cuerpo del artículo. Default
 * "neutro-latam". El operador puede pedir "ve" para activar
 * venezolanismos naturales cuando el lector objetivo es claramente VE.
 */
export type NewsDialecto = "neutro-latam" | "ve";

const DIALECT_INSTRUCTIONS: Record<NewsDialecto, string> = {
  "neutro-latam":
    "Castellano neutro Latam — no voseo argentino, no españolismos peninsulares. Vocabulario común a México, Colombia, Venezuela, Perú, Argentina.",
  ve: "Castellano venezolano natural — el lector objetivo es importador VE. Usa venezolanismos cuando encajen orgánicamente ('real' como dinero, 'chévere', 'pana', 'echarle pichón', 'arrochar'). Evita el voseo argentino, evita los españolismos peninsulares.",
};

/**
 * Target de longitud por tipo editorial. Rangos amplios (800-1200) le dan
 * pereza al modelo; targets específicos producen piezas más consistentes.
 * Valores afinados con feedback editorial (Plan v5).
 */
const LENGTH_TARGET_BY_TIPO: Record<NewsTipo, { mid: number; band: number }> =
  {
    informativo: { mid: 1000, band: 100 },
    curiosidad: { mid: 700, band: 80 },
    polemica: { mid: 1100, band: 100 },
    especial: { mid: 850, band: 100 },
  };

/** Instrucción universal anti-fabricación de datos · Plan v5. */
const VERIFY_INSTRUCTION = `IMPORTANTE — Marcadores [VERIFICAR]:
- Marca con [VERIFICAR: <dato>] CUALQUIER dato numérico, fecha específica, cita textual atribuida, estadística o porcentaje que no puedes confirmar como hecho público.
- Ejemplos de qué marcar: "el flete subió [VERIFICAR: 30%] el último trimestre", "según [VERIFICAR: cita de directivo de Maersk] el corredor...", "en [VERIFICAR: 2024] entró en vigencia...".
- Es preferible MARCAR de más a inventar de menos: el editor humano resolverá cada marcador antes de publicar.
- NO marques afirmaciones generales o conocimiento común (ej: "el yuan es la moneda china" NO necesita marca).`;

/**
 * Brief del operador antes de elegir tipo/categoría. Plan v5 — Brief primero.
 * El operador escribe tema + links opcionales + ángulo; Claude deriva el
 * resto (tipo + categoría + tono) vía buildDetectBriefIntentPrompt.
 */
export interface NewsBrief {
  topic: string;
  refs: string[]; // 0-3 URLs
  angle: string; // 1 oración, opcional (puede ser "")
}

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  informativo:
    "tono informativo, claro y directo, estilo periodístico serio. Sin adjetivos vacíos.",
  curiosidad:
    "tono que despierte curiosidad, con gancho, que haga clic sin caer en clickbait barato.",
  polemico:
    "tono polémico y provocador, que genere debate honesto, sin desinformación.",
};

// ──────────────────────────────────────────────────────────────
// 00. routeIdea — el CEREBRO clasificador (SDD-0089 F-A)
//
// Antecede a detectBriefIntent. El operador mete SOLO nombre + título de
// una idea; Claude clasifica el tipo (8), corre el Test de Noticia (5
// preguntas), decide flujo/canales/categoría/ángulo y propone títulos.
//
// El prompt es el "cerebro" literal de §9 del manual de comunicación
// (Downloads/dtd-sistema-comunicacion-v1.md) + las líneas rojas de §8.
// La regla A/B y el score se RECALCULAN en server (defensa anti-alucinación);
// acá solo le pedimos al modelo los 5 booleanos + su recomendación cruda.
// ──────────────────────────────────────────────────────────────

/**
 * Líneas rojas del manual (§8) — válidas para TODO lo que genere el motor.
 * Constante exportada para reuso (tests + futuros builders de F-B).
 */
export const LINEAS_ROJAS = `LÍNEAS ROJAS (no se cruzan nunca):
- PÚBLICO OBJETIVO: pyme / emprendedor exitoso que YA tiene capital y YA compra recurrente en China, pero cada ~3 meses en compras grandes. El objetivo es jalarlo a repartir sus compras por mes. NO le hablamos a empresas grandes, NI a compradores de una sola vez, NI al importador que ya trae frecuente.
- LENGUAJE DE CALLE, cero técnico. Plata, billete, caja, mercancía, depósito. Nada de "flujo de caja", "rotación", "CCC" en lo que ve el cliente.
- NUNCA pedirle que compre menos volumen. El mensaje es "no congeles todo de golpe", no "compra menos".
- SENSIBILIZAR, no acusar. El lector es exitoso; el costo es invisible, no un fracaso.
- CONFIDENCIAL: el operador de consolidación NUNCA se nombra (solo "el Operador de Consolidación"). DTD es la cara.`;

export function buildRouteIdeaPrompt(
  nombre: string,
  titulo: string,
  angulo?: Angulo,
): string {
  const tiposList = ALL_CEREBRO_TIPOS_FOR_PROMPT.map(
    ([slug, info]) => `- "${slug}" → ${info.label}: ${info.description}`,
  ).join("\n");

  const catsList = (Object.entries(NEWS_CATEGORIES_V4) as Array<
    [NewsCategoria, typeof NEWS_CATEGORIES_V4[NewsCategoria]]
  >)
    .map(
      ([slug, info]) =>
        `- "${slug}" → ${info.label}: ${info.description}`,
    )
    .join("\n");

  const canalesList = ALL_CANALES.map((c) => `"${c}"`).join(", ");
  const angulosList = ALL_ANGULOS.map((a) => `"${a}"`).join(", ");

  const anguloBlock = angulo
    ? `\n\nEl operador ya pidió un ÁNGULO preferido: "${angulo}". Úsalo salvo que sea claramente incompatible con la idea (en ese caso elige el mejor y explica por qué en "reason").`
    : "";

  return `Eres el editor de comunicación de DTD Cargo (logística y trading puerta a puerta China-Venezuela, enfocada en pymes y emprendedores). Te doy una IDEA de contenido (nombre + título). NO la escribas todavía: rutéala con este sistema y devuélveme una recomendación estructurada.

IDEA:
- Nombre / tema: ${nombre.trim()}
- Título propuesto: ${titulo.trim()}${anguloBlock}

PASOS QUE SIGUES:
1. Clasifica la idea por TIPO (elige UNO):
${tiposList}
2. Corre el TEST DE NOTICIA — 5 preguntas sí/no a la idea:
   a) busca_google: ¿Alguien lo buscaría en Google?
   b) ia_responde: ¿Una IA lo daría como respuesta a alguien?
   c) sirve_6_meses: ¿Sirve igual dentro de 6 meses (no caduca)?
   d) ensena_resuelve: ¿Enseña o resuelve algo de verdad?
   e) parece_experto: ¿Te hace ver como el que sabe?
   Responde cada una con true o false honestamente — no infles el score.
   Regla: 3 o más SÍ = Flujo A (Noticia + atomizar). 2 o menos = Flujo B (directo al canal).
3. Decide FLUJO "A" o "B" según el test y explica la razón en 1 línea.
   - Promo/Oferta, Pregunta/Conversación y Detrás de cámara van SIEMPRE a Flujo B (nunca al blog), aunque el test dé alto.
   - Actualidad va a blog SOLO si el ángulo perdura y afecta decisiones; si caduca, Flujo B.
4. Recomienda los CANALES (subset de: ${canalesList}). Si es Flujo B, NO incluyas "noticias". Si es Flujo A, incluye "noticias" + los altavoces que apliquen.
5. Si es Flujo A, asigna la CATEGORÍA del blog (una de):
${catsList}
   Si es Flujo B, categoria = null.
6. Elige el ÁNGULO del gancho (uno de: ${angulosList}).
7. Propón 2-3 TÍTULOS afilados para el canal principal, con el lenguaje de calle de DTD.

${LINEAS_ROJAS}

Devuelve SOLO JSON válido sin prosa ni bloques de código, con este shape EXACTO:
{
  "tipo": "<slug del tipo del cerebro>",
  "test_noticia": {
    "busca_google": <true|false>,
    "ia_responde": <true|false>,
    "sirve_6_meses": <true|false>,
    "ensena_resuelve": <true|false>,
    "parece_experto": <true|false>
  },
  "flujo": "<A|B>",
  "categoria": "<slug de categoría o null>",
  "canales": ["<canal>", ...],
  "angulo": "<slug de ángulo>",
  "titulos": ["<título 1>", "<título 2>"],
  "reason": "<1-2 oraciones explicando flujo + categoría>",
  "confidence": <0-100>
}`;
}

/**
 * Entradas del cerebro pre-tipadas para el prompt. Se computa una vez al cargar
 * el módulo (lista chica fija). Evita repetir el cast Object.entries en cada call.
 */
const ALL_CEREBRO_TIPOS_FOR_PROMPT = Object.entries(CEREBRO_TIPOS) as Array<
  [string, { label: string; description: string }]
>;

// ──────────────────────────────────────────────────────────────
// 0. detectBriefIntent — brief completo → tipo + categoría + tono
//
// Plan v5: el operador escribe brief (tema + refs + ángulo) en step 0
// y Claude propone tipo + categoría + tono automáticamente. Reemplaza
// funcionalmente a detectCategory cuando hay brief con angle (más rico
// que solo "topic + tipo ya elegido").
// ──────────────────────────────────────────────────────────────

export function buildDetectBriefIntentPrompt(brief: NewsBrief): string {
  const tiposList = (Object.entries(NEWS_TIPOS) as Array<
    [NewsTipo, typeof NEWS_TIPOS[NewsTipo]]
  >)
    .map(([slug, info]) => `- "${slug}" → ${info.label}: ${info.description}`)
    .join("\n");

  const catsList = (Object.entries(NEWS_CATEGORIES_V4) as Array<
    [NewsCategoria, typeof NEWS_CATEGORIES_V4[NewsCategoria]]
  >)
    .map(
      ([slug, info]) =>
        `- "${slug}" (tipo=${info.tipo}) → ${info.label}: ${info.description}`,
    )
    .join("\n");

  const refsBlock =
    brief.refs.length > 0
      ? `\n\nLINKS DE REFERENCIA aportados por el operador:\n${brief.refs
          .map((r) => `- ${r}`)
          .join("\n")}`
      : "";

  const angleBlock = brief.angle.trim()
    ? `\n\nÁNGULO EDITORIAL (qué se debe llevar el lector):\n"${brief.angle.trim()}"`
    : "";

  return `Eres editor jefe de DTD Cargo (logística China-Venezuela). El operador escribió un brief para una nueva pieza editorial del sitio público /noticias. Tu tarea: leer el brief y proponer la clasificación editorial más apropiada — tipo + categoría + tono sugerido.

TEMA: ${brief.topic.trim()}${refsBlock}${angleBlock}

Tipos editoriales disponibles:
${tiposList}

Categorías disponibles (con su tipo asociado):
${catsList}

Tonos disponibles:
- "informativo" → claro y directo, periodístico serio
- "curiosidad" → con gancho, despierta interés sin clickbait barato
- "polemico" → provocador, genera debate honesto

Reglas:
- Elige UN tipo, UNA categoría (debe pertenecer al tipo elegido), UN tono.
- Si el brief tiene ángulo polémico declarado, prioriza tipo="polemica".
- Si el brief no tiene ángulo, asume tipo="informativo".
- "novedades-dtd" (tipo="especial") SOLO si el brief habla de la empresa misma.

Devuelve SOLO JSON válido sin prosa ni bloques de código:
{
  "tipo": "<slug del tipo>",
  "categoria": "<slug de la categoría>",
  "tone_suggested": "<informativo|curiosidad|polemico>",
  "reason": "<1-2 oraciones explicando la elección>",
  "confidence": <0-100>
}`;
}

// ──────────────────────────────────────────────────────────────
// 1. detectCategory — usuario tipea tema + ya eligió tipo
// ──────────────────────────────────────────────────────────────

export function buildDetectCategoryPrompt(
  topic: string,
  tipo: NewsTipo,
): string {
  const cats = (Object.entries(NEWS_CATEGORIES_V4) as Array<[NewsCategoria, typeof NEWS_CATEGORIES_V4[NewsCategoria]]>)
    .filter(([, info]) => info.tipo === tipo)
    .map(([slug, info]) => `- "${slug}" → ${info.label}: ${info.description}`)
    .join("\n");

  return `Eres editor SEO senior de DTD Cargo (logística China-Venezuela). El usuario eligió tipo "${NEWS_TIPOS[tipo].label}" y ahora propone este tema:

TEMA: ${topic}

Categorías disponibles del tipo "${tipo}":
${cats}

Devuelve SOLO JSON válido con la categoría más apropiada para este tema, sin prosa adicional ni bloques de código:
{"categoria": "<slug>", "reason": "<1 oración explicando por qué>", "confidence": <0-100>}`;
}

// ──────────────────────────────────────────────────────────────
// 2. suggestKeywords — keywords SEO para el post
// ──────────────────────────────────────────────────────────────

export function buildSuggestKeywordsPrompt(
  topic: string,
  categoria: NewsCategoria,
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const pains = painPointsFor(categoria).map((p) => `- "${p}"`).join("\n");

  return `Eres editor SEO senior de DTD Cargo. Sugiere keywords SEO para este post:

TEMA: ${topic}
CATEGORÍA: ${catInfo.label} (${catInfo.description})

KEYWORDS OBJETIVO DEL NEGOCIO (priorizadas):
${keywordsForPrompt(14)}

PAIN POINTS DEL CLIENTE en esta categoría:
${pains || "- (no aplica para esta categoría)"}

Devuelve SOLO JSON válido sin prosa adicional ni bloques de código:
{
  "focus_keyword": "<1 keyword principal, idealmente del listado priorizado o variante natural>",
  "secondary_keywords": ["<3 keywords secundarias relacionadas>"],
  "pain_points_addressed": ["<2-3 pain points concretos del listado que este post va a atacar>"],
  "reason": "<1 oración explicando la elección>"
}`;
}

// ──────────────────────────────────────────────────────────────
// 3. generateHeadlines — 5 titulares con prefix literal + SEO
// ──────────────────────────────────────────────────────────────

export function buildGenerateHeadlinesPrompt(
  topic: string,
  tone: Tone,
  categoria: NewsCategoria,
  focusKeyword?: string,
  secondaryKeywords?: string[],
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const keywordsBlock = focusKeyword
    ? `\n\nKEYWORD PRINCIPAL: "${focusKeyword}"${secondaryKeywords?.length ? `\nKEYWORDS SECUNDARIAS: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")}` : ""}\n\nIncorpora la keyword principal en al menos 2 de los 5 titulares, de forma natural (no keyword stuffing). Las secundarias pueden aparecer en otros.`
    : "";

  return `Eres editor SEO senior de DTD Cargo (logística China-Venezuela). Genera EXACTAMENTE 5 titulares alternativos optimizados para SEO en castellano neutro Latam.

TEMA: ${topic}
CATEGORÍA: ${catInfo.label} (${catInfo.description})
TONO: ${TONE_INSTRUCTIONS[tone]}${keywordsBlock}

Restricciones IMPORTANTES:
- Cada titular DEBE arrancar EXACTAMENTE con: "${catInfo.titlePrefix}"
- Después del prefix, el resto del titular entre 35 y 50 caracteres (total ~50-65 con prefix)
- Sin comillas envolventes, sin numeración interna, sin emojis
- Castellano neutro Latam (no voseo argentino, no españolismos)
- Optimizado para clicks orgánicos (intent del lector)

Devuelve SOLO JSON válido sin prosa adicional ni bloques de código:
{"headlines": ["${catInfo.titlePrefix}...", "${catInfo.titlePrefix}...", "${catInfo.titlePrefix}...", "${catInfo.titlePrefix}...", "${catInfo.titlePrefix}..."]}`;
}

// ──────────────────────────────────────────────────────────────
// 4. generateBullets — 8-10 secciones del artículo
// ──────────────────────────────────────────────────────────────

export function buildGenerateBulletsPrompt(
  headline: string,
  categoria: NewsCategoria,
  secondaryKeywords?: string[],
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const pains = painPointsFor(categoria);
  const painsBlock = pains.length > 0
    ? `\n\nPAIN POINTS RELEVANTES de esta categoría:\n${pains.map((p) => `- "${p}"`).join("\n")}\n\nAl menos 2-3 bullets deben RESOLVER pain points concretos del listado.`
    : "";
  const kwBlock = secondaryKeywords?.length
    ? `\n\nKEYWORDS SECUNDARIAS a incorporar en titles de bullets de forma orgánica: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")}`
    : "";

  return `Eres editor SEO senior de DTD Cargo. Genera la estructura de un artículo para este titular:

TITULAR: ${headline}
CATEGORÍA: ${catInfo.label}${painsBlock}${kwBlock}

Devuelve entre 8 y 10 secciones (bullets) en orden lógico de lectura. Cada bullet:
- title: subtema concreto, corto (máx 60 chars), optimizado para SEO + intención de búsqueda
- desc: 1 línea (máx 120 chars) explicando qué cubrirá la sección

Devuelve SOLO JSON válido sin prosa adicional ni bloques de código:
{"bullets": [{"title": "...", "desc": "..."}, ...]}`;
}

// ──────────────────────────────────────────────────────────────
// 4b. generateOutlines — 3 outlines completos alternativos (Plan v5)
//
// Reemplaza funcionalmente a generateBullets. En vez de 8-10 bullets
// para destildar (trabajo de checkbox), Claude propone 3 arquitecturas
// narrativas distintas para el mismo titular. El editor compara
// outlines completos y elige uno (radio). Refleja cómo decide un
// editor jefe en un newsroom real.
// ──────────────────────────────────────────────────────────────

export function buildGenerateOutlinesPrompt(
  headline: string,
  categoria: NewsCategoria,
  secondaryKeywords?: string[],
): string {
  const catInfo = NEWS_CATEGORIES_V4[categoria];
  const pains = painPointsFor(categoria);
  const painsBlock =
    pains.length > 0
      ? `\n\nPAIN POINTS DEL CLIENTE en esta categoría:\n${pains
          .map((p) => `- "${p}"`)
          .join("\n")}\n\nAl menos 1 de los 3 outlines debe RESOLVER pain points concretos del listado.`
      : "";
  const kwBlock = secondaryKeywords?.length
    ? `\n\nKEYWORDS SECUNDARIAS a incorporar de forma orgánica en titles de secciones: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")}`
    : "";

  return `Eres editor jefe de DTD Cargo. Genera 3 OUTLINES ALTERNATIVOS para este titular. Cada outline debe ser una arquitectura narrativa distinta — NO variaciones cosméticas del mismo enfoque.

TITULAR: ${headline}
CATEGORÍA: ${catInfo.label}${painsBlock}${kwBlock}

Cada outline debe traer:
- thesis: 1 oración (máx 200 chars) que resuma el punto central del artículo. Es el "nut graf" del periodismo — la columna vertebral editorial.
- sections: array de 5-7 secciones (cada una con title máx 60 chars + desc 1 línea máx 120 chars).
- closing_type: uno de:
    "conclusion-analitica"  → cierre que sintetiza y concluye
    "llamada-a-la-accion"   → cierre que invita a actuar (cotizar, contactar, etc.)
    "pregunta-abierta"      → cierre que abre debate o reflexión

Los 3 outlines deben TENER ENFOQUES DISTINTOS:
- Outline 1 (pragmático): "cómo funciona / qué hacer en la práctica". Foco operativo.
- Outline 2 (contextual): "por qué importa / historia detrás". Foco narrativo.
- Outline 3 (analítico): "desafío al supuesto / posición editorial". Foco crítico.

Devuelve SOLO JSON válido sin prosa adicional ni bloques de código:
{"outlines": [{"thesis": "...", "sections": [{"title": "...", "desc": "..."}, ...], "closing_type": "conclusion-analitica"}, {...}, {...}]}`;
}

// ──────────────────────────────────────────────────────────────
// 5. generateArticle — artículo Markdown 800-1200 palabras
// ──────────────────────────────────────────────────────────────

export function buildGenerateArticlePrompt(
  headline: string,
  sections: Array<{ title: string; desc: string }>,
  focusKeyword?: string,
  secondaryKeywords?: string[],
  tipo: NewsTipo = "informativo",
  dialecto: NewsDialecto = "neutro-latam",
): string {
  const sectionsList = sections
    .map((s, i) => `${i + 1}. ${s.title} — ${s.desc}`)
    .join("\n");

  const kwBlock = focusKeyword
    ? `\n\nKEYWORD PRINCIPAL: "${focusKeyword}" — debe aparecer en intro + al menos 1 H2 + 2-3 veces en el body (density 1-2%, NO stuffing).${secondaryKeywords?.length ? `\nKEYWORDS SECUNDARIAS: ${secondaryKeywords.map((k) => `"${k}"`).join(", ")} — incorporar de forma natural cuando encajen.` : ""}`
    : "";

  const len = LENGTH_TARGET_BY_TIPO[tipo];
  const dialectoInstr = DIALECT_INSTRUCTIONS[dialecto];

  return `Eres redactor editorial senior de DTD Cargo (logística China-Venezuela). Escribe un artículo completo siguiendo estas reglas estrictamente.

TITULAR: ${headline}
TIPO EDITORIAL: ${tipo} · target ${len.mid} palabras (±${len.band})

SECCIONES (en este orden):
${sectionsList}${kwBlock}

ESTRUCTURA EDITORIAL OBLIGATORIA:
1. Párrafo de introducción (sin H2) — gancho que enmarca el problema o pregunta. 2-3 oraciones.
2. NUT GRAF — el SEGUNDO párrafo del artículo debe ser el "párrafo de tesis": resume el ángulo central del artículo en 2-3 oraciones. Esta es la columna vertebral editorial — el lector que lee solo los primeros 2 párrafos debe quedarse con el punto central.
3. Cada sección con un H2 en Markdown (## Título). Title exacto = el del outline elegido.
4. Transiciones naturales entre secciones (no inicies cada sección con "En esta sección…").
5. Conclusión al final con H2 "## Conclusión" (o equivalente apropiado).
6. SI Y SOLO SI hay pain points declarados (ver bloque KEYWORD PRINCIPAL abajo): después de la conclusión, agrega una sección "## Preguntas frecuentes" con 2-4 Q+A derivadas de los pain points. Formato EXACTO obligatorio:

## Preguntas frecuentes

### ¿Pregunta 1?
Respuesta breve y directa (60-120 palabras). Sin citas, sin listas, prosa pura.

### ¿Pregunta 2?
Respuesta…

REGLAS DE LENGUA:
- ${dialectoInstr}
- Voz "tú" neutro. Evita el voseo argentino siempre.
- Pain points del cliente como subtexto — el contenido debe RESOLVER, no solo informar.
- Sin AI slop ("en conclusión", "es importante destacar", "no podemos olvidar que…").

${VERIFY_INSTRUCTION}

OUTPUT:
- SOLO Markdown puro. NO uses bloques de código \`\`\`. NO agregues preámbulo ni notas.
- Empieza directamente con el párrafo de introducción.`;
}
