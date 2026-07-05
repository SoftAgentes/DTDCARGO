# Secretaria Bitácora ERP / Escucha Activa SAM — Documento de contexto

> Handoff que reúne: resumen del proyecto, decisiones tomadas, preguntas abiertas
> (incluida la del transcriptor), referencia a los DOS system prompts, el kit de prueba
> y el contrato JSON. Fuente del founder, portada al repo (SDD-0150).

## 0. TL;DR
Dos agentes analistas de reuniones para el ERP de DTD Cargo. Reciben **texto ya
transcrito** (el audio lo transcribe una herramienta externa; los agentes NO manejan
audio). Convierten lo dicho en tareas (para empleados) o pendientes (para externos),
vinculan al interlocutor con la tabla de clientes, cosen los temas dispersos (hilos) y
emiten un JSON para que el backend cree el trabajo.

Dos agentes, mismo tronco operativo:
- **Secretaria Bitácora ERP** — DEFAULT de la oficina. Operativa y NEUTRA. No lee
  intención oculta ni analiza personas. La usa cualquier empleado.
- **Secretaria Escucha Activa SAM** — personal del founder, activación manual (toggle en
  su usuario). Suma la capa de suspicacia: lectura entre líneas, rebobinados, black swans.

Stack objetivo: Next.js + Supabase (Postgres, RLS multi-tenant) + Anthropic API
(Sonnet/Opus gama alta). El toggle default->SAM se resuelve en capa de aplicación (qué
system prompt se manda según usuario/estado), NO dentro del prompt.

## 1. Fundamento (marcos de escucha, resumido)
La lectura entre líneas se apoya en tres cuerpos técnicos:
- **Escucha activa (Rogers):** recibir->comprender->recordar->responder; parafraseo de
  verificación; hipótesis tentativa (base del "rebobinar").
- **Empatía táctica (Voss):** labeling, "eso es/exacto" vs "sí, claro", explicación no
  pedida = dónde duele, black swans (dato suelto que cambia todo).
- **Pragmática (Grice):** máximas (cantidad/calidad/relación/modo); violar una máxima =
  implicatura (quiso decir algo sin decirlo); las implicaturas son DERROTABLES (por eso
  el agente nunca afirma intención como hecho: la marca con confianza y la deja abierta).
Sumado luego: actos de habla (Searle) para extraer tareas, hedging para el estado del
compromiso, presuposición, pares adyacentes/bucles abiertos (motor del rebobinado) y
distancia/evasión (indicio DÉBIL, solo en SAM).

## 2. Decisiones ya tomadas
1. Los agentes NO procesan audio; solo texto transcrito.
2. Empleado -> TAREA asignable. Cliente/Proveedor/Contratista -> PENDIENTE (recordatorio).
   Nunca se le asigna tarea a un externo.
3. Ante duda de rol (empleado vs externo) -> no se decide, va a "dudas de clasificación".
4. Vínculo con cliente al cierre: coincide->ata / duda->pregunta / sin match->abierto
   (posible cliente nuevo) / proveedor->no aplica. Nunca inventa un cliente.
5. Tareas sin dueño claro -> "EN EL AIRE, presuntamente para X" + flag de confirmar.
6. Hilos (Paso 2): tras leer todo, cose temas dispersos; si un dato se corrigió, usa el
   FINAL; si hay contradicción no resuelta, va a preguntas de cierre (no elige solo).
7. Se emite un JSON con compuertas de seguridad (flags que frenan la automatización).
8. La capa suspicaz (lectura entre líneas, rebobinados, black swans, distancia/evasión)
   vive SOLO en SAM, para evitar vigilancia lateral entre empleados.

## 3. Preguntas abiertas / tareas para Code
- [RESUELTA] **Transcriptor y diarización.** El transcriptor actual (Cloudflare Whisper
  large-v3-turbo) NO diariza (devuelve texto plano + timestamps por palabra). Señales que
  SÍ sobreviven al texto: palabras exactas, contradicciones (hilos), evasivas léxicas,
  hedging, preguntas sin respuesta, voz pasiva. Señales que se PIERDEN sin buen
  transcriptor: tono, pausas, titubeos, ironía, quién interrumpió. **Decisión del founder
  (SDD-0150, Fase C):** sumar un proveedor con diarización (AssemblyAI recomendado /
  Deepgram alternativa) + derivar marcas de pausa `[pausa Ns]` de los timestamps.
  Escucha Activa corre sobre transcript enriquecido en Claude (NO audio-nativo/Gemini).
- [APLICADA] **Regla en AMBOS prompts:** "Analiza solo lo que está en el texto; no
  infieras tono, pausas ni gestos que no estén transcritos." Ya está en los dos prompts.
- [DIFERIDO] **Canal de observaciones humanas:** permitir que Sam (o quien esté en la
  reunión) anote a mano "aquí dudó / esto fue tenso", y pasarlo al agente como input
  confiable. Definir formato — post-v1.
- [Fase D] **Router del toggle:** lógica en app para elegir prompt según usuario y estado
  (default = ERP; Sam con un clic = SAM). Vía capability `escucha_activa`.
- [Fase A] **Bloque común compartido:** clasificación, vínculo cliente, hilos y JSON base
  son idénticos en los dos. Mantener UN bloque común + el diferencial de cada agente,
  para no desincronizar.
- **Persistencia:** en v1 el JSON rico vive en el jsonb `acta` (sin migración); respetar
  las compuertas (necesita_confirmar_responsable, vinculo_cliente.necesita_confirmar,
  dudas_clasificacion no vacío, contradiccion_sin_resolver) antes de materializar.
- **Modelo:** default Sonnet; Escucha Activa puede usar Opus (env `BITACORA_ESCUCHA_MODEL`).

## 4. Contrato de salida JSON (unificado)
Ambos agentes comparten el núcleo (`tipo_reunion`, `hilos`, `vinculo_cliente`, `tareas`,
`pendientes_externos`, `dudas_clasificacion`). Diferencia: SAM agrega `bucles_abiertos`
(con interpretación); ERP usa `puntos_sin_cerrar` (neutro). Mismo parser base, solo
ramifica en ese campo. Flags que frenan automatización:
`necesita_confirmar_responsable`, `vinculo_cliente.necesita_confirmar`,
`dudas_clasificacion` no vacío, `hilos[].contradiccion_sin_resolver`.

## 5. System prompts
- `secretaria-bitacora-erp.md` (default oficina).
- `secretaria-escucha-activa-sam.md` (founder, activación manual).

## 6. Kit de prueba
`kit-prueba-transcripcion.md` — reunión falsa con trampas puestas a propósito (plazo
corregido 15->10 para probar hilos; cliente "González" ambiguo entre dos fichas; tarea
sin dueño; proveedor->pendiente; compromiso blando "voy a tratar"; pregunta sin
respuesta). Correr el mismo kit contra los dos agentes y comparar: ERP se queda en lo
operativo; SAM agrega lectura entre líneas.
