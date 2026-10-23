# Plan de mejoras de la web — seguimiento, móvil y medición

Dueño: Director de ingeniería DTD Cargo, con revisión comercial de Sam.
Estado: plan preparado; implementación NO EJECUTADA; publicación NO AUTORIZADA.
Fecha: 2026-10-23 · America/Caracas.
Clasificación: interno.
Base revisada: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.

## Resultado buscado y frontera del encargo

Preparar tres entregas revisables: respuestas que describan el seguimiento realmente disponible, botones móviles legibles y una medición cuya configuración pueda comprobarse sin contaminar Google Ads. Este documento conserva los contratos para ejecutarlas después; no inicia Workers de producto ni modifica runtime.

El encargo actual permite preparar este plan en una rama documental aislada. No autoriza implementar producto, publicar rama/PR, mergear, desplegar, operar cuentas Ads/GA/Kommo, cambiar campañas o conversiones, enviar mensajes, copiar secretos ni consultar datos de clientes. Las futuras pruebas usarán datos sintéticos y servicios locales. No se aplican migraciones.

El [runbook de publicación](../runbooks/publicacion-automatica-web.md) indica publicación automática desde `main`, incluso para documentación. Por ello no se debe hacer push a `main` ni mergear este plan mientras siga vigente «sin tocar producción». Tampoco se ejecuta un preview alojado ni se cambia el publicador para eludir esa frontera.

## Evidencia que guía las decisiones

| Hecho | Fuente y límite |
|---|---|
| La calculadora, `/nosotros`, `sameAs`, datos de sedes y ALT descriptivos ya existen. | Revisión pública del 23-oct y fuentes locales de la base indicada. No crear duplicados ni aplicar los precios de ejemplo del auditor. |
| La FAQ pública promete eventos «en vivo» mientras el footer avisa «Seguimiento en construcción». | `/faq`, `lib/faqs.ts` y `components/Footer.tsx`; comprobado en la revisión pública del 23-oct. Es el primer problema a corregir. |
| SDD-0521 y SDD-0528 ya tienen integración registrada. | [0521](../specs/0521-tracking-en-construccion-aviso/spec.md), PR #221, merge `1b19ba5c`; [0528](../specs/0528-textos-rastreo-restantes/spec.md), PR #229, merge `19d4128e`. La 0528 conserva aceptación editorial pendiente aunque su código esté integrado. |
| FAQ/Kommo y privacidad fueron exclusiones explícitas de 0528. | No presentar la continuación como un defecto de ejecución de esa tarea. Requiere nueva spec acotada, relacionada con 0514/0521/0528 y las fuentes de FAQ. |
| «Seguimiento de cada envío…» en `llms.txt` fue conservado por decisión editorial de 0528. | Es una ambigüedad revisable, no una regresión demostrada. Fechas y otras afirmaciones del archivo se revisan en P4. |
| El botón móvil puede tener un conflicto entre altura fija y contenido en varias líneas. | `ShippingMarkCta` y CSS existente. Es hipótesis hasta reproducir el recorte en navegador local con fuentes cargadas. |
| La CSP omite algunos orígenes documentados para funciones Ads. | No demuestra uso de cada función ni pérdida total de conversiones. El parche se condiciona a una solicitud concreta bloqueada. |

No se usan el 76/100, el supuesto +30–40 % de conversión ni una simulación de «Cita #1» como línea base de resultados.

### Revisión del segundo enlace de AI Studio

El 23-oct Sam aportó [la app compartida con justificaciones adicionales](https://ai.studio/apps/2942a1d1-6adc-4bf1-8ff6-c61568eb4776). Se leyeron sus diez justificaciones y su hoja de ruta. Mantiene los diagnósticos incorrectos sobre ausencia de calculadora, sameAs y ALT, y la propuesta CSP con `unsafe-eval`. No aporta mediciones nuevas que justifiquen alterar las prioridades de este plan.

Las afirmaciones de pesos H1=1, H2=0,6–0,7 y H3=0,3, promedio de vectores del footer, +35 % de leads, 15 minutos ahorrados por asesor, 40 % de tráfico recurrente y 30 % de jornada dedicada a rastreo no incluyen fuentes ni evidencia de DTD. Son hipótesis o afirmaciones no demostradas, no criterios de aceptación. Tampoco se acepta el salto de un beacon CSP bloqueado a caída de Quality Score, CPC mayor o medición ROAS 100 % precisa. Las propuestas de tablas/H1 se evaluarán por utilidad y rendimiento observado, sin prometer posición cero ni top 3.

La estructura de la app ayuda a presentar ideas, pero su explicación algorítmica no acredita funcionamiento interno de Google u otros buscadores. Deben corregirse el diagnóstico y los supuestos antes de convertirlos en instrucciones de implementación.

Contraste oficial: [Google Ads, calidad del anuncio y conversiones reportadas](https://support.google.com/google-ads/answer/156066?hl=en), [guía SEO y encabezados](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) y [contenido móvil y acordeones](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing). Google admite contenido en acordeones; el problema diferente es cargarlo solo después de una interacción que el crawler no ejecuta.

## Entorno de validación obligatorio para P1, P2 y P3

Antes de abrir páginas o ejecutar tests, build y subprocesos de verify, usar entorno limpio sin `.env` reales y servicios sintéticos locales. Sustituir los endpoints públicos de negocio por fixtures o un servidor local y bloquear las salidas a producción/terceros también desde el servidor y los subprocesos; una interceptación del navegador por sí sola no cubre generación estática ni Server Components. La red permitida será loopback o la red local de pruebas explícitamente creada para la tarea.

La medición estará apagada en el build normal y los ensayos activos tendrán loader inerte y eventos en memoria. Registrar los intentos bloqueados sin tokens/payloads y hacer fallar la prueba ante una conexión inesperada. Un guard requerido que no pueda configurarse se declara NO DISPONIBLE y suspende esa comprobación; no se sustituye por una consulta al servicio real. No desactivar protecciones del equipo ni debilitar las pruebas para obtener verde.

## Orden de ejecución propuesto

| Prioridad | Entrega | Responsable al ejecutar | Estimación orientativa | Condición de cierre local |
|---|---|---|---|---|
| P1 | Promesas de seguimiento coherentes en web y fuentes locales | Worker de contenido + Director; Sam revisa el significado comercial | 1–2 jornadas | Matriz antes/después, UI/JSON-LD coherentes y fuente Kommo preparada, sin subirla |
| P2 | CTA móvil completo, accesible y sin solapamientos | Worker de frontend | 1 jornada | Reproducción y capturas antes/después, reflow, zoom, teclado y regresiones |
| P3a | Diagnóstico local de Ads/CSP sin eventos externos | Worker de medición | 1–2 horas | Matriz de solicitudes/directivas y decisión justificada: cambiar o no cambiar |
| P3b | Corrección CSP mínima, solo si P3a la demuestra | Mismo Worker de medición | 0,5–1,5 jornadas | Pruebas de política y build release local; cero eventos a cuentas reales |
| P4 | Contenido y SEO de páginas existentes | Worker editorial, tras cerrar P1 | 1–2 jornadas | Propuesta contrastada con Operaciones; sin cifras ni promesas inventadas |
| P5 | Claridad y medición de la calculadora existente | Worker de UX/analítica, tras P2/P3 | 1–2 jornadas | Hipótesis medible y mejora local; fórmula y tarifas intactas |

Las tres primeras entregas, con revisión conjunta, se estiman en 4–6 jornadas de ingeniería en secuencia. Son rangos de planificación desde el inicio de ejecución, no fechas comprometidas ni garantía de que un defecto se reproduzca. P4/P5 quedan en segunda tanda.

P1 tiene prioridad de entrega. El inventario P3a puede comenzar en paralelo con P1; P2 puede preparar su reproducción sin esperar a Ads. Para limitar conflictos y competencia por build, mantener como máximo dos Workers escribiendo producto a la vez, y un turno para `pnpm verify`. Los índices y el README de marketing se actualizan selectivamente por tarea y se reconcilian antes de revisión; no son un tablero compartido de escritura concurrente.

## P1 · Continuación de promesas de seguimiento

### Cambio propuesto

1. Inventariar las respuestas afectadas de `lib/faqs.ts` y la base markdown de Kommo. Distinguir identificación de carga, seguimiento por el equipo y visualización de eventos por el cliente.
2. Preparar una tabla antes/después para cada promesa. Propuesta de respuesta principal:

   > El seguimiento de la carga dentro del portal está en construcción. Para conocer el estado de tu envío, escríbenos por WhatsApp. Te avisaremos apenas esté activo.

   La última frase reutiliza el texto que Sam aprobó expresamente en SDD-0521. No añade un canal, plazo ni automatización de notificación, y no autoriza enviar avisos. La tabla de copy debe conservar ese antecedente en la revisión editorial.

3. Alinear las respuestas de registro, acceso y seguimiento sin prometer otras funciones no comprobadas ni fecha de activación. No cambiar el estado del interruptor existente.
4. Preparar el mismo significado en la fuente markdown de Kommo. El archivo local y la fuente instalada en Kommo son entregas distintas: aquí no se sube ni reemplaza ninguna fuente.
5. Revisar en privacidad únicamente la referencia obsoleta a consulta pública por código. Conservar los tratamientos operativos que siguen siendo ciertos; no borrar el tratamiento histórico ni cambiar finalidades, retención, derechos o base jurídica por una corrección de copy. Si cambia el significado jurídico, entregar propuesta marcada para revisión de Sam y su responsable legal.
6. Alinear el copy fuente de la infografía de pre-alerta para evitar que vuelva a circular la promesa. No regenerar ni publicar imágenes, PDF o campañas.

### Alcance candidato, a cerrar en la spec antes de editar producto

- `lib/faqs.ts`.
- `docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`.
- `app/privacidad/page.tsx`, solo la referencia de consulta pública ya retirada.
- `docs/marketing/servicios-infografias/prealerta-compra.md`, solo promesa de visualización.
- `app/__tests__/faq-seguimiento-coherente.test.tsx`, nuevo contrato propuesto.
- Documentación de la tarea: spec/handoff propios, `docs/specs/README.md`, `docs/marketing/README.md` y una entrada en `docs/marketing/seo.md`.

La numeración de la nueva SDD queda SIN RESERVAR. Director debe inventariar refs, PRs y archivos sin commit, reservar un stub en la rama de ejecución y cerrar la allowlist exacta. No reutilizar ni ampliar silenciosamente las autorizaciones de 0528. Si la solución requiere otro archivo, revisar primero la ampliación y sus consumidores.

### Aceptación

- Con seguimiento en construcción, las respuestas afectadas no prometen eventos en vivo ni un rastreador disponible. Describen el canal real de consulta y no dan fecha de activación.
- `/faq` muestra el mismo significado en texto y JSON-LD; el cambio llega correctamente a sus consumidores `/shipping-mark` y `/puerta-a-puerta`, sin vaciar selecciones ni alterar categorías/widgets.
- La fuente markdown de Kommo contiene el texto equivalente. El handoff dice «fuente preparada localmente / subida NO EJECUTADA».
- Si se usa el interruptor actual, se prueban ambas posiciones; no se crea otra bandera y se documenta que Kommo, como fuente estática, no cambia automáticamente.
- Capturas y revisión local de FAQ, Shipping Mark y privacidad. No se envían registros, formularios ni mensajes reales.
- Privacidad conserva finalidades y tratamiento operativo; las dudas jurídicas quedan visibles para revisión, sin forzar una redacción final.

Fuera del slice inicial: activación real del seguimiento, APIs/DB, datos de clientes, alta/aprobación de cuentas, `llms.txt`, PWA manifest, tabla comercial `PuertaAPuerta`, subida a Kommo y las 20 preguntas completas del documento editorial. Las últimas fuentes de texto pasan a P4, con decisión explícita de alcance.

## P2 · Botón de Shipping Mark y recorrido móvil

### Cambio propuesto

1. Reproducir ambos CTA de la home: hero claro y cierre oscuro. Registrar ancho, zoom, fuente y cajas del enlace y sus dos renglones.
2. Si se confirma el recorte, permitir que el componente crezca con su contenido mediante el selector mínimo. No resolverlo reduciendo la fuente, truncando el texto ni ocultando overflow global.
3. Mantener «Casillero» tachado debajo de Shipping Mark, el destino `/registro`, colores, contraste y foco de la marca.
4. Comprobar el botón flotante WhatsApp en home, tarifas y FAQ: si tapa una acción, documentar la intersección y proponer un segundo ajuste acotado. No añadir de entrada una barra fija ni rediseñar navegación.
5. Confirmar si los caracteres chinos fallan en algún dispositivo. Si no falla, cerrar como no reproducido; cambiar fuentes requiere evidencia y alcance propio.

### Alcance candidato

- `components/ShippingMarkCta.tsx`.
- `app/globals.css`, exclusivamente las reglas necesarias del CTA/home; no cambiar `.btn` global sin revisar consumidores y ampliar el contrato.
- `e2e/sin-scroll-horizontal.spec.ts`, ampliando la cobertura existente.
- Spec/handoff nuevos, índice y nota mínima en `docs/marketing/README.md`.

No requiere cambiar `app/page.tsx` inicialmente: ambos CTA ya usan el componente compartido. WhatsApp y CJK son comprobaciones del recorrido, no permiso para modificar sus componentes sin una ampliación nombrada.

### Aceptación

- Ambos CTA íntegros a 320, 360, 375, 390, 414 y 430 px; revisión de escritorio a 768 y 1280 px.
- Texto ampliado/zoom 200 % sin recorte, solapamiento ni scroll horizontal; control con mínimo táctil 44 × 44 CSS px.
- Medir también el contenido vertical dentro del control: la ausencia de scroll horizontal no detecta este defecto.
- Teclado, foco visible, nombre accesible y toque conservan la acción. La navegación se verifica localmente sin enviar el formulario de registro.
- Capturas antes/después con fuentes cargadas y mismas condiciones. Chromium y WebKit si está disponible; cualquier motor no probado se declara.
- Ninguna regresión observada en botones de tarifas/FAQ ni en los dos fondos del CTA. Cambios visuales sustanciales requieren `/ui-check` según el repositorio.
- Si no se reproduce, entregar evidencia y condición pendiente; no fabricar un parche para dar por cerrado el hallazgo.

## P3 · Medición de Ads y CSP

### P3a: decidir si hay un defecto corregible de CSP

Inventariar etiquetas e inicialización existentes, consentimiento, eventos y políticas por ruta. Reutilizar 0371 (fronteras privadas), 0518 (respaldo de GA) y 0544 (apagado) como contratos de regresión, no como prueba de que el fallo nuevo ya está resuelto. SDD-0413 tiene documentación que no coincide con los archivos de esta base; no asumir que su nonce está implementado ni reconstruirlo dentro de esta tarea.

Por cada solicitud sospechosa conservar: host/ruta técnica sin identificadores, tipo `script/connect/img/frame`, directiva que bloquea, iniciador y función prevista. Distinguir CSP, adblocker/extensión, consentimiento, error de aplicación y diagnóstico de atribución. No guardar cookies, tokens ni payloads de clientes.

Reproducir la política de release en navegador local con recursos sintéticos/interceptados y registrar `securitypolicyviolation`. Esta prueba demuestra compatibilidad de la política, no recepción o atribución en Google.

- **Cambiar:** un origen utilizado por el flujo público está bloqueado y la apertura mínima documentada corrige ese bloqueo en el ensayo.
- **No cambiar todavía:** solo hay una afirmación genérica, un servicio no utilizado o un problema de atribución sin bloqueo CSP.
- **Separar tarea:** se descubre duplicidad de eventos, consentimiento incorrecto o definición equivocada de conversión. No ampliar a `Analytics.tsx` por conveniencia.

### P3b: parche y aceptación

Allowlist técnica inicial: `next.config.ts`, `lib/runtime/__tests__/next-config.test.ts`, nuevo `e2e/analytics-csp-offline.spec.ts` y nueva `playwright.analytics-csp-offline.config.ts`. Más spec/handoff propios, índice y notas de marketing. Solo permitir hosts y directivas demostrados, conservar medios, WSS, `base-uri`, `form-action`, `object-src`, `frame-ancestors` y las excepciones por ruta. No introducir `unsafe-eval` público en release ni un comodín cuando baste un host concreto. Cloudflare Insights solo entra si se confirma su uso.

Validación sin cuentas reales:

1. Ejecutar las pruebas existentes de `Analytics.test.tsx`, `__tests__/analytics.test.ts`, `Analytics.respaldo-ga.test.tsx`, `Analytics.apagado.test.tsx`, `Analytics.apagado-build.test.ts`, `CookieConsentBanner.test.tsx` y la configuración real de Next.
2. Probar consentimiento aceptado/rechazado, cambios SPA, loader tardío y rutas privadas con `gtag` simulado y scripts inertes. Cero solicitudes enviadas a Google/Meta/Kommo u otros servicios reales.
3. Bloquear salida externa antes de navegar; interceptación total, service workers bloqueados y control de WebSockets. Un ID GA sintético o `consent=denied` por sí solos no garantizan ausencia de pings, porque Ads conserva un ID real y puede emitir señales restringidas.
4. Build local de release con `NEXT_PUBLIC_GA_ID=off`, sin credenciales reales; comprobar headers efectivos, ausencia de `unsafe-eval` y que las defensas anteriores siguen presentes. El modo `off` valida shell/headers, no el flujo activo de Ads; la fixture activa sintética aporta la otra evidencia.
5. Conservar un build para el smoke HTTP local: el build canónico usa una salida temporal y la elimina. No confundir `next dev` con CSP de release.

Entrega: diff mínimo o diagnóstico de no cambio, matriz de pruebas y límites. No cambiar IDs, acciones principales/secundarias de Ads, campañas, audiencias, presupuestos ni configuración de GA/Kommo. Recepción, deduplicación remota y atribución comercial quedan NO EJECUTADAS hasta una fase posterior autorizada.

## P4 y P5 · Segunda tanda

**P4, contenido y SEO:** reutilizar [las preguntas desde el CRM](seo-aeo-preguntas-crm.md), con sus validaciones pendientes; corregir enlaces desfasados a `/calculadora`, revisar fechas en `llms.txt` (fundación 2015, experiencia desde 2008, oficina 2010) y resolver su ambigüedad de «seguimiento» sin presentarla como regresión. Revisar también manifest PWA y tabla comercial si se incluyen nominalmente. Proponer title descriptivo de home, enriquecer páginas existentes y comparar modalidades con tablas cuando ayuden. Operaciones valida inclusiones, cobertura, plazos y restricciones. No cambiar H1/marca de forma masiva, rellenar ALT redundantes, crear `/blog` paralelo ni inventar perfiles/reseñas/certificaciones. Publicar cada bloque exige alcance y revisión propios.

**P5, calculadora:** conservar motor, tarifas, mínimos, peso, baterías y destino. Evaluar descubrimiento de la herramienta, explicación de CBM, claridad del estimado y si el campo tarifa editable confunde. Definir embudo agregado: uso → estimado → clic WhatsApp → conversación → cotización válida → cliente. Clic no equivale a conversación ni venta. Los estados posteriores necesitan evidencia del proceso comercial y no se capturan leyendo conversaciones/PII sin permiso. Un porcentaje de mejora exige línea base y experimento; este plan no promete +30–40 %.

## Dependencias, entrega y autorización posterior

| Cruce | Clasificación | Tratamiento |
|---|---|---|
| P1 texto ↔ P2 componente | PARALELIZABLE | Fuentes runtime distintas; revisar juntos el recorrido y reconciliar documentación. |
| P3a ↔ P1/P2 | PARALELIZABLE | Diagnóstico aislado; no envía eventos ni comparte servidor con otra sesión. |
| P3b ↔ P3a | DEPENDIENTE | Solo hay parche si la evidencia lo requiere. |
| P4 ↔ P1 | DEPENDIENTE | Reutiliza la definición de capacidad aprobada; evita volver a prometer tracking. |
| P5 ↔ P2/P3 | DEPENDIENTE | Medir un flujo usable; no atribuir resultados a una instrumentación sin validar. |
| Cierre de cada rama ↔ revisión conjunta | DEBE ESPERAR | Validar combinación contra base/head actuales, sin integrar en main. |
| Publicación ↔ esta preparación | REQUIERE AUTORIZACIÓN POSTERIOR | Merge puede publicar automáticamente; Kommo tiene un canal aparte. |

Antes de iniciar cada Worker: revalidar base y PRs —incluidas las de base distinta de main—, cambios sin commit y claims; confirmar dueño del worktree y reservar la SDD. La revisión de 18 PRs abiertas del 23-oct no equivale a disponibilidad de sesiones ni aprobación de sus cambios. El repositorio remoto resuelve actualmente a `SoftAgentes/DTDCARGO`.

Cada Worker debe recibir objetivo único, SDD reservada, allowlist exacta, aceptación anterior, dependencias y contrato de permisos, con commits locales y handoff propios. El presente documento no es una asignación a una sesión existente ni autorización de push.

La entrega inicial de cada tarea incluirá: spec y matriz antes/después; diff y commits selectivos; capturas/evidencia sintética; validación focal y `pnpm verify` cuando corresponda a producto; handoff con impacto documental, límites y fuera de alcance. El cierre canónico debe prepararse sin credenciales ni conexiones productivas; el ledger de producción se declara NO EJECUTADO/NO DISPONIBLE si exige acceso excluido. No se aplican migraciones ni se modifica el verificador para conseguir verde. Un exit 0 con omisiones conserva esas omisiones.

Antes de una futura publicación: Director revisa SHA/base y combinación de ramas; Sam revisa copy/capturas/diff y autoriza el efecto productivo concreto. Solo después se prepara una ventana de release con reversión a la imagen anterior y comprobaciones públicas. La subida de fuente a Kommo y las comprobaciones en Ads/GA se autorizan y registran por separado. Este plan no solicita esas acciones ahora.

## Estado de este documento

Plan y revisión de fuentes: PREPARADOS. Implementación, pruebas de producto nuevas, eventos reales, subida a Kommo, push, PR, merge y deploy: NO EJECUTADOS. Los hechos de la auditoría anterior conservan su fecha; las pruebas de aceptación enumeradas son trabajo futuro.
