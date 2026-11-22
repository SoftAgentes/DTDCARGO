# Rebrand del ERP · Versus: Ant Design contra Carbon

> Estado: **análisis y recomendación**; no instala nada ni autoriza cambios. Insumos: [evaluación de Ant Design](evaluacion-ant-design.md) y [evaluación de Carbon](evaluacion-carbon.md).
> Fecha: 2026-11-19. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** no verificado · **W** lo dice la web (con la fuente y su sesgo).

## 1. Respuesta corta

**Si hubiera que escoger una de las dos para el Studio, conviene más Carbon.** No porque sea «mejor» en general (Ant Design tiene más comunidad y una tabla más potente), sino porque **encaja mejor con lo que Sam pidió mirar y con nuestras reglas duras**:

1. **Sus reglas de botones y avisos son casi las nuestras** (una primaria por pantalla, orden de botones, verbo + sustantivo, sentence case, tipos de mensajes con reglas de persistencia).
2. **Sus colores por defecto ya cumplen AA** (5,00:1); los de Ant Design no (2,27 a 4,10:1).
3. **Pinta con CSS estático y variables**, no con CSS-in-JS: no choca con el Norte («no CSS-in-JS») y es amable con la CSP.
4. **Publica con atestación de procedencia**; Ant Design no.

**Lo que juega en su contra:** unas 30 veces menos descargas semanales, una versión 2.0 en alfa (cambios grandes por venir), telemetría de IBM en la instalación, fuentes desde la CDN de IBM por defecto (ambas con apagado), aspecto «IBM» (esquinas rectas, 48 px) y dependencia de Sass.

**Y la recomendación anterior se mantiene:** antes de instalar cualquiera, la opción A (arreglar botones y lecturas con lo nuestro) sigue siendo lo que resuelve el dolor medido. El laboratorio de mañana decide si además se adopta una librería.

## 2. Versus por criterio

Puntaje de **0 a 5 por criterio, juicio propio** sobre la evidencia citada; no es una medición.

| Criterio | Ant Design 6.7.1 | Carbon 1.121.0 | Gana | Evidencia |
|---|---|---|---|---|
| **Reglas de botones** (una primaria, orden, copy) | 4 · mismas ideas, sin orden automático | **5** · `ButtonSet` ordena por tipo, reglas escritas de verbo+sustantivo, danger en 3 énfasis | Carbon | C |
| **Tipos de botón vs los nuestros** | 4 · primario/defecto/discontinuo/texto/enlace + peligro/fantasma (dos ejes) | 4 · 8 tipos; **`secondary` = acción negativa**, distinto a nuestro `dark`/`ghost` | Empate | C |
| **Alturas mínimas (nuestra regla ≥ 32 px)** | 2 · pequeño 24, mínimo 16 por defecto | **4** · `sm` 32 existe; el botón por defecto es 48 | Carbon | C |
| **Colores por defecto vs AA** | 1 · primario 4,10; error 3,27; éxito 2,27; advertencia 1,90 | **5** · azul 5,00; rojo 5,00 | Carbon | M |
| **Títulos (jerarquía)** | 3 · `Typography.Title` nivel 1-5 **a mano** | **5** · `Heading`+`Section` calculan el nivel solos | Carbon | C |
| **Diferencia título / mensaje** | 3 · `Alert` y `message`; sin pauta de persistencia en el código | **5** · en línea, toast, accionable, llamada con reglas de persistencia y de severidad | Carbon | C / M |
| **Guardado («Guardando… / Guardado»)** | 2 · `loading` es solo un círculo; no hay estado «terminado» | **4** · `InlineLoading` inactivo/activo/terminado/error con `onSuccess` | Carbon | C |
| **Tabla, formularios y fechas de ERP** | **5** · muy completa (virtual, fija, filtro, árbol) | 3 · buena, menos potente | Ant Design | C / I |
| **Encaje con el Norte (sin CSS-in-JS)** | 1 · CSS-in-JS de ejecución | **4** · Sass → CSS (pero un compilador nuevo) | Carbon | C |
| **CSP y estilos** | 3 · inyecta `<style>`; admite nonce y `zeroRuntime` | **4** · sin estilos inyectados | Carbon | C / I |
| **Server Components / Next 16** | 2 · todo cliente; registro aparte; sin prueba con Next 16 | 2 · casi todo cliente; solo la entrada raíz marca `"use client"`; sin prueba con Next 16 | Empate | M / NV |
| **Tema oscuro y capas** | 3 · algoritmo `dark` | **4** · 4 temas y `Layer` | Carbon | C |
| **Peso (estimado)** | 2 · 71 KiB solo el botón; unos 250-350 KiB una pantalla típica (I) | 3 · sin medir; CSS aparte, JS por componente | Carbon (poca certeza) | C / NV |
| **Seguridad de la cadena** | 3 · sin avisos, sin scripts, **sin atestación**, ~7 cuentas | 3 · sin avisos, **con atestación**, pero **20 `postinstall` de telemetría** | Empate | M |
| **Datos a terceros (D-2)** | 4 · sin red propia; origen chino, sin flujo de datos | 4 · sin red propia; IBM CDN de fuentes y telemetría, apagables | Empate | M / I |
| **Comunidad y ecosistema** | **5** · 5,45 M descargas/semana; 100 k estrellas | 2 · 171 mil/semana; 9,6 k estrellas | Ant Design | M |
| **Estabilidad de versión** | 4 · v6 estable, entregas semanales | 3 · v1 estable, **v2 en alfa** | Ant Design | M |
| **Idioma es-VE** | 3 · hay `es_ES`/`es_US` | 2 · hay que escribir el diccionario | Ant Design | C |

**Total sobre 90 (18 criterios):** Ant Design **54**, Carbon **66**. (Pesa más lo que Sam pidió mirar; con otra ponderación la diferencia se achica, y en «tablas grandes» y «comunidad» gana Ant Design con claridad.)

## 3. Lo que dice internet contra lo que yo analicé

Búsquedas web hechas hoy (cuatro). **Aviso:** casi todo lo que apareció son páginas de comparación de proveedores o agregadores con interés comercial; **no apareció ningún hilo de Reddit ni de Hacker News** y no hay opinión directa de usuarios de Carbon contra Ant Design. La evidencia de «comunidad» es **delgada**; yo la trato como pista, no como prueba.

| Tema | Lo documentado en internet (W) | Lo que yo analicé (C/M) | ¿Coinciden? |
|---|---|---|---|
| Tamaño de la comunidad | Un rastreador de menciones cuenta 107 enlaces a Ant Design y 5 a Carbon (la búsqueda no permite identificar con certeza cuál página lo dice) | 5,45 M contra 171 mil descargas por semana (npm); 100 k contra 9,6 k estrellas. **Pero** los contribuyentes son parecidos (~379 contra ~377) y el ritmo de cambios también (181 contra 161 PR en 30 días) | **Sí en tamaño de uso; no en vitalidad del proyecto**, que es similar |
| Ant Design: peso y CSS-in-JS | Se critican «un estilo pesado» y la tabla a gran escala; una guía sitúa el CSS en +70-100 KB y avisa de parpadeo de estilos en SSR; el equipo de Ant lo reconoce en su [blog de variables CSS](https://5x.ant.design/docs/blog/css-var-plan) y v5 subió ~55 KB al dejar moment ([issue](https://lightrun.com/answers/ant-design-ant-design-bundle-size-increased-a-lot-with-v5)) | Confirmado el diseño (CSS-in-JS de ejecución, topes de 71-197 KiB por componente). v6 usa variables CSS por defecto y ofrece `zeroRuntime` (C). **No medí** el peso real | **Sí**, con mejora en v6 |
| Ant Design: personalización | «Opinionado»; valoración mixta (3 de 5) en una comparación; otros alaban los tokens por componente | Los tokens por componente existen (C); su aspecto por defecto no cumple nuestro AA | **Parcial** |
| Ant Design con Next y App Router | Hay que usar `AntdRegistry`; los subcomponentes con punto no funcionan; un caso de estilos perdidos en la primera pantalla por versiones distintas de `cssinjs` ([blog](https://www.cnblogs.com/deerblog/p/19353638)) | Idéntico en la documentación oficial (C). **No hay reporte específico de v6 con Next 16 y React 19**; no lo probé | **Sí**; incertidumbre abierta |
| Carbon: «muy opinionado» | Una página de alternativas lo llama «extremadamente opinionado» y poco flexible ([Subframe](https://subframe.com/tips/carbon-design-alternatives-77477), de un competidor) | Esquinas rectas, 48 px y temas propios por defecto (C); pero el radio y los tokens son configurables (`--cds-button-radius`) | **Sí en defectos; no en imposibilidad** |
| Carbon: cambio de versión | La migración a v11 exigió cambiar nombres de tokens ([FAQ de Carbon](https://carbondesignsystem.com/migrating/faq)); hay quejas sobre sobrescribir tokens (una pregunta de Stack Overflow) y sobre los selectores de estado de los componentes ([discusión en GitHub](https://git.tdem.in/carbon-design-system/carbon/discussions/16035)) | **Hay una v2.0 en alfa hoy** (12 alfas). Riesgo repetido | **Sí** |
| Carbon: accesibilidad y tablas de datos | Se afirma «mejor accesibilidad y componentes de datos» (un agregador, **de una respuesta generada por IA**) | Colores AA por defecto (M); `addon-a11y` en su Storybook (C); tabla menos potente que la de Ant (I) | **Parcial**; la afirmación de IA no la tomo |
| Carbon con Next y React 19 | No apareció nada específico | Solo la entrada raíz lleva `"use client"` (M) | **Sin información externa** |
| Quién gana en «dashboards de administración» | Ant Design: «más plantillas y más adopción» (comparativas) | Coincido en ecosistema y tabla; no en encaje con nuestras reglas | **Sí en ecosistema**; **no en encaje** |

Fuentes consultadas hoy: [Subframe: alternativas a Carbon](https://subframe.com/tips/carbon-design-alternatives-77477), [Infragistics: alternativas a Ant Design](https://www.infragistics.com/blogs/?p=3362), [blog de Ant Design sobre variables CSS](https://5x.ant.design/docs/blog/css-var-plan), [FAQ de migración de Carbon](https://carbondesignsystem.com/migrating/faq), [documentación de Next.js de Ant Design](https://ant.design/docs/react/use-with-next). **Sesgo:** vendedores de la competencia y agregadores; ninguna fuente es una encuesta.

## 4. Lo que Sam pidió mirar, lado a lado

| Tema | Hoy en el Studio (SDD-0603, BTN-01) | Ant Design | Carbon |
|---|---|---|---|
| **Botones: tipos** | `primary` (vino), `dark`, `ghost` (contorno), `danger`, `warning`; `success` solo transitorio | primary, default, dashed, text, link × `danger` × `ghost` | primary, secondary, tertiary, ghost, danger (×3 énfasis) |
| **Botones: «qué hacen»** | Relleno o contorno de tinta, sombra y verbo; elevación por nivel | Relleno/contorno, onda al pulsar | Relleno/contorno **sin sombra**, esquinas rectas, etiqueta a la izquierda e icono a la derecha |
| **Reglas** | Una primaria por contexto (BTN-01 §2); primaria a la derecha; destructiva aparte; verbos de BTN-01 §3 | «Una primaria por sección» | **Una primaria por pantalla**; secundaria = negativa; `ButtonSet` ordena solo; verbo+sustantivo |
| **Títulos** | `.studio-display` + `.studio-eyebrow`; nivel de `h` a mano | `Typography.Title` nivel 1-5 a mano | `Heading` + `Section` con nivel automático |
| **Título vs mensaje** | `Aviso`: franja plana con icono (info/atención/éxito/error), rol `alert` solo para error o urgente; toast aparte; estados como texto con icono | `Alert` (4 tipos, `banner`, cerrable) y `message` (con `loading`) | 4 tipos de notificación con reglas de persistencia y severidad |
| **Guardado** | `ActionButton`: reposo → cargando → éxito verde 2,5 s; toast con enlace; resalte de fila (3 reglas de rastro) | `loading` = círculo; el resto lo hace el código | `InlineLoading`: cuatro estados, `successDelay` 1,5 s |
| **Experiencia** | Compacto y oscuro por defecto; nada oprimible bajo 32 px | Compacto por algoritmo; 24 px por defecto en pequeño | Cuatro temas, capas y densidad; 48 px por defecto |

**Lectura:** en lo que Sam pidió, **Carbon coincide con nuestras reglas** en casi todo y aporta lo que hoy nos falta: un orden automático de botones, títulos con nivel calculado y una taxonomía de mensajes con persistencia explícita. **Nuestro sistema ya iguala o supera a los dos** en elevación, rastro visual del guardado y contraste medido por contrato. Por eso la primera ganancia es **copiar reglas**, no instalar.

## 5. Plan para mañana: el laboratorio de las dos versiones

Objetivo de Sam: ver el Studio completo con las dos librerías **instaladas al 100 %, sin tocar nuestro brand**, y luego empezar a darles nuestro color. Esto **no se hizo hoy**: instalar paquetes de terceros exige turno de PC del Director y una carpeta desechable.

**Condiciones (propongo):**

- **Fuera del repo DTDCARGO**, en una carpeta desechable; **datos de mentira** (sin Supabase, sin producción, sin PII).
- Instalación con scripts de terceros apagados (`--ignore-scripts` o la lista `allowBuilds` de pnpm), y `IBM_TELEMETRY_DISABLED=true` para Carbon.
- **Dos aplicaciones Next 16 + React 19 idénticas**, una con cada librería, con **sus temas de fábrica** primero. «Sin tocar el brand» = aspecto de fábrica; el color propio viene después.
- **Un módulo de prueba** igual en ambas (por ejemplo, Embarques con tabla, filtros, drawer de edición y confirmación) para comparar con el mismo contenido.

**Qué instalar (sin ejecutar hoy):**

| | Ant Design | Carbon |
|---|---|---|
| Paquetes | `antd`, `@ant-design/nextjs-registry` | `@carbon/react`, `sass` |
| Ajustes | `AntdRegistry` en el layout; importar subcomponentes por ruta | Estilos con `$css--font-face: false`; archivos `"use client"` propios; compilar Sass |
| Idioma | `ConfigProvider locale={es_ES}` | Diccionario propio es-VE y `locale` de `flatpickr` |

**Qué medir (la misma lista para ambas):**

1. **Botones:** los 5 tipos nuestros mapeados; reposo, hover, foco, cargando, deshabilitado y error; alturas (¿hay algo < 32 px?).
2. **Títulos y mensajes:** una pantalla con título, aviso en línea, toast, accionable y llamada; ¿se distingue qué se oprime, qué avisa y qué solo se lee?
3. **Guardado:** flujo «guardando → guardado → error» con la misma acción simulada.
4. **Reglas:** orden de botones en diálogo, drawer y fila de tabla.
5. **Técnico:** primera pantalla sin parpadeo de estilos, hidratación, cabecera CSP real (sin relajarla), peso JS/CSS en producción, `axe` sin violaciones, claro y oscuro.
6. **Seguridad:** que ninguna petición salga a dominios ajenos (pestaña de red) y que no corra ningún `postinstall`.

**Decisión de mañana (tres puertas):** (1) ¿alguna librería pasa los puntos duros: CSP, ≥ 32 px, AA, Server/Client, red limpia? (2) ¿cuál se ve y se siente mejor con nuestros datos? (3) ¿vale su costo frente a la opción A? Si ninguna pasa, se sigue con A y se toman las ideas (opción B).

**Después (tampoco hoy):** colorear con nuestros tokens: en Carbon, mapear `--cds-*` a `--wine`, `--ink` y compañía; en Ant Design, `ConfigProvider theme.token`. Eso exige BRAND-CHECK y la aprobación de Sam.

## 6. Límites de este análisis

No ejecuté nada de terceros. No medí peso, hidratación ni accesibilidad en vivo. La comunidad en redes (Reddit, Hacker News, X) **no se pudo verificar con fuentes directas**: la búsqueda devolvió sobre todo sitios comerciales. Los puntajes de la sección 2 son juicio propio.
