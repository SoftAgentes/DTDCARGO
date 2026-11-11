# SDD-0611 — Revisión de datos personales: avisos a `#noticias` y registros de la publicación automática

Hecha el 2026-11-07 con [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md), sobre la rama `claude/wizardly-murdock-7db565` (PR #417). Pidió la revisión el Director General: es una salida nueva de contenido a un tercero (Discord).

**Alcance:** solo lo que agrega esta implementación:
- qué sale a `#noticias`;
- qué guardan las tablas nuevas de la migración 0518;
- la nota libre del retiro, que vuelve a la oficina.

No es una auditoría del sistema. El resto del Studio con Discord lo cubre la [revisión de la SDD-0606](../0606-avisos-studio-a-discord/privacidad.md).

**No es asesoría legal y no afirma que el proyecto cumple.** Cada punto queda en uno de tres estados:
- `ENCONTRADO`: un problema visto en el código;
- `CORRECTO`: la implementación que lo resuelve, vista en el código;
- `NO VERIFICABLE`: no se puede comprobar leyendo el repositorio.

**Marco aplicable**, citado desde la skill y su [checklist](../../../.claude/skills/revisar-datos-ve/references/checklist-datos-ve.md). El texto de los artículos está en `marco-legal-ve.md`, que esta revisión no reproduce.
- **Venezuela:** Constitución, arts. 28 (habeas data) y 60 (vida privada, honor e intimidad), y la Ley Especial contra los Delitos Informáticos, arts. 20 a 22. No hay ley especial ni autoridad administrativa de datos.
- **PIPL (China):** no aplica a este flujo. Las noticias son contenido público y los avisos no llevan datos de personas en China.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 8 |
| `ENCONTRADO` | 2 |
| `NO VERIFICABLE` | 4 |

## 2 · Inventario

### Qué sale a Discord (`#noticias`)

| Aviso | Sale a Discord | Lo que no sale | Evidencia |
|---|---|---|---|
| Publicada sola | Etiqueta, «N de M esta semana», titular (público), enlace público, resumen de filtros, opinión de riesgo del Revisor (recortada a 300 caracteres) y enlace de retiro | El cuerpo del artículo; la opinión del Revisor si trae un dato personal; menciones masivas | `lib/news/autopublicar/aviso.ts:54`, `:63` |
| Retenida | Etiqueta, titular, códigos de motivo y enlace a la cola del Studio | El cuerpo. **Con `linea_roja:datos_personales`, o si el titular trae un dato personal, tampoco el titular**: va solo el código del borrador | `lib/news/autopublicar/aviso.ts:101-106` |
| Publicada por una persona | Etiqueta, **nombre de quien publicó** (decisión de Sam, SDD-0611 §4.5), titular y enlaces | El cuerpo | `lib/news/autopublicar/aviso.ts:78`. No está enganchado a ninguna ruta |

El transporte es el de la 0606:
- webhook en la variable del servidor `DISCORD_WEBHOOK_NOTICIAS`;
- solo para el tenant de `DISCORD_TENANT_ID`;
- apagado con `APP_ENV=staging` (`lib/studio/news/autopublicar.ts:109-110`);
- sin menciones por defecto.

### Qué se guarda (migración 0518)

| Tabla.campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `news_publication_audit.actor_id` | uuid de la persona que publicó a mano | La salida manual de IA-01 exige dejar el nombre | Sin plazo | Admins del tenant; service_role |
| `news_publication_audit.writer` / `.reviewer` | Agente, modelo y versión (de la oficina, no son personas) | Auditoría de IA-01 | Sin plazo | Ídem |
| `news_autopublish_settings.updated_by`, `news_autopublish_settings_log.changed_by` | uuid de quien cambió el interruptor | Registro del interruptor (§4.6) | Sin plazo | Ídem |
| `news_post_exits.actor_id` | uuid de quien retiró o sacó la noticia | Aprender de los retiros (§4.11) | Sin plazo | Ídem |
| `news_post_exits.note` | Nota libre de quien retiró (hasta 1.000 caracteres) | El porqué del retiro, para entrenar | Sin plazo | Ídem; y viaja a la oficina |
| `news_post_exits.title`, `.slug`, `.content_sha256` | Titular, dirección y huella de una noticia que fue pública | Que el retiro quede como ejemplo | Sin plazo | Ídem |

Los titulares del personal son Sam, Alejandro y los admins. No hay datos de clientes en ninguna columna nueva.

## 3 · Hallazgos y puntos

| # | Punto del checklist | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | 1 · Inventario | `CORRECTO` | La tabla de arriba. Ninguna columna nueva guarda datos de clientes |
| 2 | 2 · Minimización: el aviso no lleva el cuerpo | `CORRECTO` | `aviso.ts:54-75`, con pruebas en `lib/news/autopublicar/__tests__/piezas.test.ts` («sin el cuerpo») |
| 3 | 2 · Minimización: titular de una retenida por datos personales | `CORRECTO` (era `ENCONTRADO` en la revisión del Director General sobre `2e6e678b9`) | `aviso.ts:101-106`. Pruebas en rojo antes del arreglo: `piezas.test.ts` y `lib/studio/news/__tests__/autopublicar.test.ts` («retenida por datos personales…») |
| 4 | 2 · Minimización: opinión del Revisor | `CORRECTO` | `aviso.ts:63`: no viaja si `tieneDatosPersonales` la marca, y se recorta a 300 caracteres |
| 5 | 2 · Minimización: la nota del retiro | `CORRECTO` en el código; `NO VERIFICABLE` en la base | `motivos.ts:39` rechaza una nota con teléfono, correo, cédula, RIF o dirección (`nota_con_datos_personales`), y `notaParaOficina` (`motivos.ts:48`) la vuelve a filtrar antes de entregarla. La función `news_retirar` de la base no la filtra: depende de que la pantalla del Studio, que falta, use `validarRetiro` |
| 6 | 2 · Minimización: el control detecta datos personales en el artículo | `CORRECTO` | `control.ts:84` (teléfono, correo, cédula, RIF, dirección) y prueba de §5 «Privacidad» en `piezas.test.ts` |
| 7 | 5 · Borrado | `ENCONTRADO` | Las tablas nuevas no tienen plazo de retención ni purga. Guardan uuids del personal y notas libres. **Arreglo:** fijar con Sam un plazo (por ejemplo, 24 meses para salidas y auditoría) y una purga en el cron de la segunda PR; mientras tanto, la nota se valida (punto 5) |
| 8 | 6 · Trazabilidad | `CORRECTO` | Cada publicación, retención, retiro y cambio de interruptor deja fila con quién y cuándo (0518, `news_publication_audit`, `news_post_exits`, `news_autopublish_settings_log`) |
| 9 | 8 · Inventario de terceros | `CORRECTO` | `docs/legal/privacidad/inventario-terceros.md`: la fila de Discord ahora nombra `#noticias` y lo que sale |
| 10 | 8 · El nombre de quien publica a mano sale a Discord | `ENCONTRADO` (bajo) | `aviso.ts:78`. Es una decisión de Sam (§4.5) y son datos del personal, no de clientes. Falta declararlo a ese personal. **Arreglo:** anotarlo en la política interna del equipo (no en `/privacidad`) antes de enganchar la vía manual |
| 11 | 9 · Transferencia internacional | `NO VERIFICABLE` | Igual que en la 0606: Discord Inc. en EE. UU., con la ubicación de los datos sin verificar y sin acuerdo de tratamiento |
| 12 | 10 · Decisiones automatizadas | No aplica a personas | La vía automática decide sobre contenido, no sobre personas |
| 13 | 12 · Titulares que no son usuarios | `NO VERIFICABLE` | El control detecta contactos, no **nombres** de personas. Un artículo podría nombrar a un cliente o a un tercero: lo frenan la línea roja del Revisor y el retiro. **Arreglo posible:** sumar al Revisor una línea «personas nombradas» |
| 14 | Roles del canal `#noticias` | `NO VERIFICABLE` | La spec dice que lo ven solo las personas que Sam autoriza. Se configura en Discord, fuera del repositorio |

## 4 · No verificable: qué mirar y dónde

1. **Base real:** que `news_retirar` no reciba notas con datos personales por otra vía. Se comprueba cuando exista la pantalla.
2. **Discord:** los roles de `#noticias`, quién tiene el webhook y la retención del canal.
3. **Discord Inc.:** la ubicación de los datos y los términos de la cuenta gratuita, como en la 0606.
4. **Nombres de personas en los artículos:** solo se cubren con el Revisor y el retiro.

## 5 · Fuera de alcance (abogado)

- El plazo de retención de las tablas de auditoría.
- Si el nombre de quien publica en `#noticias` necesita un aviso formal al personal.

*Esto no es asesoría legal. Conviene que otro modelo audite el mismo flujo.*
