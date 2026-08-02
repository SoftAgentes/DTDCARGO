# Radiografía del ERP DTD Cargo — 2026-08-02

> **Método.** 10 auditores en paralelo sobre dimensiones distintas → 2 refutadores
> adversariales sobre los hallazgos graves → 1 crítico de completitud que trazó los
> flujos de negocio de punta a punta → síntesis. **44 veredictos: 39 hallazgos
> reales, 5 falsos positivos descartados.**
>
> **Rama:** `claude/radiografia-erp-20260802` · worktree
> `DTD-worktrees/radiografia-erp-20260802`. **Nada pusheado.**

---

## 1. Dónde estamos

**El ERP no está roto: está desalineado.** Esa distinción define todo el plan.

La calidad interna es alta y verificable. Gate completo sobre `origin/main`: los 12
pasos verdes, **4.597 tests en 383 archivos sin un fallo**, `typecheck` y `lint` sin
una sola advertencia, 64 contratos SQL contra Postgres efímero, el schema se
reconstruye desde cero con las 326 migraciones, cero archivos con BOM, 27 políticas
de gobernanza aprobadas. Eso no es un proyecto enfermo.

**230 specs** (198 cerradas) · **326 migraciones** en repo contra **336** en el ledger
de prod · **57 módulos** registrados con sus 57 carpetas y sus 57 entradas RBAC —
el registro está sano, y sólo 2 de 57 son placeholder puro (`leads`, `no-olvidar`).

Lo que sí duele:

- **El campo `status:` miente en las dos direcciones.** Trece specs están construidas
  y en producción sin voltear el campo. Y la 0224 dice `approved` ("no autoriza
  código") con su Fase 1 construida y **9 migraciones aplicadas en producción**.
- **Nadie auditó las 199 specs `done`.** Las dos dimensiones de specs se repartieron
  las 32 abiertas. Ya hay un caso probado de `done` falso: **SDD-0030**, cuya parte
  pendiente sigue declarada como TODO en el código. *Un `done` falso es peor que un
  `in-progress` falso: nadie lo vuelve a mirar.*
- **Trabajo real varado fuera de `main`:** 17 ramas con commits propios. Cinco
  migraciones de seguridad (0316, 0326–0329) que la spec 0235 —que sí está en
  `main`— lista como entregables, y cuyos archivos no están en el árbol.
- **El drift de migraciones va en la dirección que el gate no mira.** Repo→prod
  limpio. Pero prod tiene 336 filas contra 326 archivos, y
  `0316_nomina_settlement_void_governance` está **aplicada y activa en producción con
  su archivo ausente de `main`**.

---

## 2. Lo que impide que el ERP sea funcional: los dos flujos se cortan

El crítico de completitud trazó los dos caminos completos en el código. Esto es lo
que ninguna dimensión aislada vio.

### 2.1 Flujo operativo — el último metro no está cableado ⚠️ *(corregido con datos de prod)*

**`camionero_pod` sólo inserta en `dispatch_pods` y ahí termina.** No toca
`shipments.status`, no inserta en `shipment_events`, no programa aviso. Y
`camionero_advance_od` —que según el comentario del propio RPC "cambia el status"—
sólo actualiza `dispatch_orders`, nunca `shipments`. El módulo Tracking bloquea
`delivered` a mano y le dice al operador *"usa el POD sellado de Despacho"*: **una
promesa que el código no cumple.**

**Pero medido contra producción, esto NO está sangrando hoy:**

| Tabla | Filas en prod |
|---|---|
| `dispatch_orders` | **0** |
| `dispatch_order_packages` | **0** |
| `dispatch_pods` | **0** |
| `warehouse_receipts_cn` con `shipment_id` | **0 de 6** |
| `shipments` entregados | 4 (cerrados por `/studio/ve`, que sí funciona) |

El flujo del camionero **nunca se ha usado**. No se están perdiendo entregas: no ha
pasado ninguna por ahí. Es una bomba con la espoleta puesta, no un incendio.

**Y eso condiciona cómo se arregla.** El único camino legal para marcar `delivered`
es `complete_ve_delivery_governed` (migración 0321): el trigger
`guard_ve_delivery_completion` exige dos variables de sesión, restringe las columnas
que se pueden tocar y hace el hito **terminal e inmutable**. O sea que marcar el
embarque equivocado no se deshace.

Y el vínculo POD → embarque va por una cadena que hoy está vacía:
`dispatch_pods.od_id` → `dispatch_order_packages` (FK **polimórfico**) →
`warehouse_receipts_cn.shipment_id` → `shipments`. Ese último campo está **poblado al
0%**. Implementar el cierre siguiendo esa cadena, tal cual está, resolvería a `NULL`
siempre: un no-op silencioso que parece arreglado.

> El comentario de `dispatch_order_packages` dice *"FK polimórfico (FK explícito en
> SDD-0030)"*. **SDD-0030 está marcada `done`** y esa parte nunca se construyó — es el
> mismo `done` falso que detectó el crítico de completitud. **La deuda del POD y el
> `done` falso de 0030 son el mismo problema.**

**Decisión de diseño para el arreglo:** cuando el POD no pueda resolver el embarque,
**falla con error explícito, no sigue de largo**. Un cierre que se salta en silencio
reproduce exactamente el pecado que se está corrigiendo.

Y antes de eso hay otro corte: **Despacho arma las órdenes leyendo
`warehouse_receipts_cn`** (China) con status `consolidado`. "Consolidado" significa
que la caja entró al contenedor en Yiwu — o sea que **entra a la cola de despacho de
Valencia mientras todavía navega 40 días**. Las recepciones reales de Venezuela
(`warehouse_receipts_ve`, lo que escanea el bodeguero en `/m/ve`) no alimentan la cola.

Además, **ninguna de las 5 transiciones de Almacén VE programa aviso al cliente**: el
motor de SDD-0156 tiene sólo 2 llamadores y Almacén VE no es ninguno.

### 2.2 Flujo comercial — cableado, salvo el documento y el aviso 🔴

Estimado → OV/embarque → factura → cobro → asiento está conectado. Pero:

- **La factura no se puede imprimir** y **nadie le avisa al cliente de que existe**:
  `invoice_emitted` está declarado en el motor de correo y **jamás se dispara**.
- **6 de los 10 eventos del motor de correo no tienen un solo emisor**, incluidos
  «Factura emitida» y «Factura vencida». No existe cobranza automática.
- **Los leads públicos no se guardan en ningún lado.** `/contacto` y `/estimacion`
  mandan un email best-effort dentro de un `try/catch` que sólo hace `console.warn`,
  y devuelven `{ok:true}`. Cero filas. Por eso **CRM · Leads es un EmptyState: no
  porque falte construirlo, sino porque nada lo alimenta.**

### 2.3 Y un dato que cambia el costo del arreglo

Los auditores reportaron los botones PDF muertos como trabajo por construir. **No lo
es.** `@react-pdf/renderer` está instalado y en producción, con layout base
compartido, dos documentos escritos, dos route handlers de referencia y tests
unitarios. **La factura en PDF está a un documento de distancia, no a un proyecto.**

---

## 3. CUBETA 1 — sin autorización

### ✅ Lote 1 — Integridad del gate · `2ee8c6fd`

El gate imprimía `verify: TODO VERDE ✓` **habiendo omitido pasos en silencio**.
Cuatro de doce degradan si falta Docker, red o credenciales, y salían con código 0.
Justamente `schema-rebuild` y `migrations-applied` —los dos que vigilan el drift
contra producción— son los primeros en omitirse.

Ahora el gate pasa `VERIFY_CHILD=1`, los hijos devuelven 78 al omitirse (a mano
siguen saliendo 0), el resumen nombra lo no verificado y `VERIFY_STRICT=1` lo vuelve
rojo. **Probado con el gate completo: `[PARCIAL] 10/12 verdes, 2 sin verificar`.**

### ✅ Lote 2 — Texto invisible en tema Oscuro · `681dd359`

`--ink-inv*` voltea entre temas; `--bg-sidebar` es oscuro en los dos. Medido:
**1,18:1** en Contabilidad, Facturación, Cotizador, Despacho, Costing, Inventario,
SENIAT y Fidelización. 58 usos corregidos en 22 archivos.

Lo importante fue **no** hacer el reemplazo masivo: sobre `--danger` el token actual
es correcto (6,31/5,61) y el arreglo "obvio" lo habría roto (2,61).

Contrato de regresión validado **con mutación** — y la primera versión del contrato
era ciega: un divisor de 1px tapaba el contenedor navy y la ventana de 30 líneas no
alcanzaba a uno que estaba 62 líneas arriba. Al ampliarla aparecieron **8
violaciones más** que el barrido original no vio.

**`/ui-check` (2026-08-02).** Los tests prueban que ningún `--ink-inv*` quedó sobre
navy; no prueban que se vea bien. Se cerró ese hueco renderizando los tokens reales
con Playwright: [evidencia](assets/2026-08-02-lote2-contraste-antes-despues.png),
reproducible con `node scripts/proof-contraste-lote2.mjs`.

- En **oscuro** el antes está prácticamente borrado y el después es legible.
- En **claro** es un no-op. La preocupación de que la jerarquía se aplanara (el nivel
  intermedio pasa de `0.75` a `0.85` de opacidad) **no se materializa**.
- El Norte confirma las dos decisiones: *"sobre sidebar navy → cream/`--ink-side`"* y
  *"en dark, texto sobre relleno semántico = `--ink-inv`, nunca blanco"* — por eso
  `--danger` y `--success` se dejaron como estaban.
- ⚠️ **Deuda con el Norte:** `--ink-side-strong` **no existe** en el `tokens.css`
  canónico (que sólo tiene `--ink-side` y `--ink-side-soft`). Es vocabulario
  repo-local, con consumidores previos en `app/m/cn/`, así que no lo introdujo este
  lote — pero le suma 28 usos. Si un NORTE-SYNC reemplaza `tokens.css` completo, el
  token se evapora y `var()` sin fallback hereda en silencio. **Pedirle a Cloud Design
  que lo incorpore, o declararlo como extensión local.**

### ✅ Lote 3a — XSS de JSON-LD · `696ccf18`

15 bloques inyectaban `JSON.stringify` pelado con `dangerouslySetInnerHTML`,
incluidos los de `/noticias` que serializan **contenido del CMS**. Contrato validado
con mutación.

### ✅ Lote 3b — Sesión del portal y del ERP móvil · `44b4f052`

`proxy.ts` existe para refrescar el access token en cookies, pero su matcher era
sólo `/studio` y `/back`. `/portal` y `/m/erp` autentican con el **mismo** Supabase
y estaban fuera: al vencer el token (1 h) la navegación server-side veía la sesión
muerta y echaba al cliente **aunque su refresh token siguiera vivo**. Es el bug que
se reporta como *"me saca solo"* y que nadie reproduce porque hay que esperar una
hora. `/m/cn` y `/m/ve` quedan fuera a propósito: el operario entra con PIN.

### ⬜ Lote 3c — Permisos y route handlers · alto · ~1,5 h

- [ ] 3 sub-rutas del Studio sin gate de vista RBAC
- [ ] `/studio/debug` fuera del registro y de la matriz RBAC
- [ ] 3 route handlers de `app/api/studio` sin verificación de sesión
- [ ] `apiError()` en los handlers que devuelven `error.message` crudo de Postgres

### ⬜ Lote 4 — Feature flags que mienten · crítico · ~1,5 h

- [ ] 16 de 21 toggles del admin escriben en la DB y **no gatean nada**
- [ ] `marketing_news` no lo siembra ninguna migración y la RPC exige fila existente
      → el toggle **siempre falla** y Noticias Web es inalcanzable
- [ ] No hay trigger que siembre flags al crear un tenant → en un tenant nuevo
      (aliados white-label) el panel entero está roto
- [ ] `dispatch.show_warehouse_location` es un flag vivo que no aparece en el panel

### ✅/⬜ Lote 5 — Poda y documentación de entrada

- [x] **`AGENTS.md`** · `7a807805` — la tabla de integraciones públicas tenía **3 de
      4 filas falsas** y hasta la nota al pie. El RPC `public_track_shipment` figuraba
      usado por `/track`, que hoy es 301 a `/portal/login` y dejó al RPC **sin un solo
      consumidor**; `/api/contact` figuraba usado por `/contacto`, cuando en realidad
      `/contacto` manda sólo por WhatsApp y quien lo usa es `/academia`.
- [x] **`.env.example`** · `08cac148` — no eran 6 variables sino **18**, entre ellas
      `MARCA_ACCESS_SECRET` (sin valor cae a un default de desarrollo) y las tres de
      SeaRates que protegen la cuota mensual del plan.
- [ ] Código muerto **verificado uno por uno** (ver §5: la lista del auditor tenía un
      falso positivo que habría roto la calculadora)
- [ ] Basura de raíz: el informe stub está **sin trackear en el checkout principal**,
      no en git — hay que borrarlo desde allá, no desde esta rama
- [ ] Sitemap: faltan 6 páginas indexables; 21+ URLs huérfanas sin enlace interno

### ⬜ Lote 6 — Alinear specs con la realidad · medio · ~1,5 h

- [ ] Voltear `status:` de las 13 verificadas como construidas
- [ ] **Auditar las 199 specs `done`** — hay al menos un `done` falso probado (0030)
- [ ] `0152` con metadata contradictoria · `0184` §7 cita migraciones renumeradas ·
      `0224` dice `approved` con 9 migraciones en producción
- [ ] `/portal/envios` sin sus tabs — hallazgo abierto de SDD-0179 §5 desde el 20-jun

---

## 4. CUBETA 2 — requiere tu decisión

| # | Qué es | La pregunta |
|---|---|---|
| 1 | **POD que no cierra el embarque.** La entrega muere en `dispatch_pods`. | ¿Construyo el cierre (POD → `shipments` + evento + aviso)? Es el corte más grave del ERP. |
| 2 | **Rescatar las 5 migraciones de seguridad varadas** (0316, 0326–0329). `git merge-tree` dice que mergea limpio. | ¿Las rescato a mi rama, o queda para su propia ventana? |
| 3 | **Aplicar 0316 a prod.** Sin ella "Anular" de Finiquito falla y descuadra el asiento. Además, con su archivo fuera del repo, `schema-rebuild` y los contratos SQL **validan un schema que no es el de producción**. | ¿Autorizas aplicarla, nombrándola? |
| 4 | **`ve_locality_catalog`**: RLS sin política deja 98 localidades invisibles → `/studio/admin/rutas` roto en prod. | ¿Escribo la migración y la aplicas tú? |
| 5 | **Leads que no se guardan.** | ¿Persisto los leads públicos en tabla? Sin eso, CRM·Leads y la medición de Ads no existen. |
| 6 | **Factura en PDF** — está a un documento, no a un proyecto. Pero `invoices` **no tiene `control_number`** y el Libro de Ventas lo declara vacío. | ¿Construyo el PDF? ¿Y agrego el número de control fiscal? |
| 7 | **Despacho lee China, no Venezuela.** | ¿Extiendo la cola a `warehouse_receipts_ve`? |
| 8 | **SDD-0195: el sync de Kommo se auto-traba.** Incidente real de 13 días muertos. | ¿Lo construyo? |
| 9 | **Studio sin recuperación de contraseña.** Hoy se arregla por SQL. | ¿Lo construyo? |
| 10 | **Storage sin respaldo ni runbook de recuperación.** Los backups de Supabase cubren la base, **no los objetos**: POD, comprobantes, cédulas, evidencia legal. | ¿Prioridad? Bloquea evaluar la migración a VPS. |
| 11 | **`mobile_operator = false`** oculta "Cola de QR" y "Operarios PWA" con la PWA en producción. | ¿Lo enciendo? |
| 12 | **`/servicios` promete un recargo que DTD no cobra.** El copy vive en una **fila de producción**. | ¿Corrijo el texto en la base? |
| 13 | **Google Ads**: Final URL y 2 de 3 sitelinks apuntan a URLs que hacen 301. | ¿Actualizo la campaña? |
| 14 | **53 de 70 ramas locales y 26 worktrees sin un commit propio.** | ¿Podo? |

---

## 5. Los 5 falsos positivos (no los persigas)

La refutación adversarial mató cinco hallazgos que parecían graves:

1. **`/contacto` "perdió la captura server-side"** → decisión tuya documentada en el
   propio código (mockup Cloud Design, variante C).
2. **El aviso del estimado "está muerto"** → intencional: el CTA es WhatsApp directo
   desde Fase 3.
3. **`review-no-olvidar` "sin backup fuera de git"** → falso: está publicada en
   `origin/feat/no-olvidar`.
4. **La 0257 sin aplicar** → declarada a propósito en `migrations-baseline.json`.
5. **3 funciones SECURITY DEFINER "expuestas a anon"** → falso positivo del advisor:
   son funciones de *trigger*, no RPCs.

Y uno más que caché yo al verificar antes de borrar: el auditor reportó
**`EstimadoModal.tsx` como código muerto**. Es falso — está importado y usado en
`CalculadoraForm.tsx`. Borrarlo rompía la calculadora. `EstimacionForm.tsx` sí está
muerto. **Por eso el Lote 5 se ejecuta archivo por archivo, no por lista.**

---

## 6. Orden de ataque

1. **Sincronizar primero.** `origin/main` avanzó durante la auditoría (a `9a178614`,
   otra ventana cerró SDD-0238). Ya está mergeado en esta rama. Los `archivo:línea`
   de los informes pueden estar corridos: verificar antes de aplicar.
2. **Integridad del gate antes que nada** (hecho): sin un gate honesto, el verde de
   todo lo demás no prueba nada.
3. La 0316 envenena `schema-rebuild` y `sql-tests`: **su archivo tiene que entrar al
   repo antes de confiar en cualquier verde de esos dos pasos.**
4. **El gate no compila el proyecto** — no hay paso `build` en `verify.mjs` ni CI
   remoto. En una corrida sin supervisión hay que correr `pnpm build` a mano.

---

## 7. Lo que no se toca

- **`PURGE_RECEIPT_ORPHANS_ENABLED` y `BITACORA_PURGE_ORPHANS_ENABLED`**: prohibidos
  por mandato del founder (SDD-0224 §8.1).
- **SDD-0025 (No-Olvidar)**: dormante por decisión del founder. Cero gasto.
- **Los 104 `BASELINE-*.md`**: son registro de gobernanza referenciado. No se borran.
- **Ninguna migración ya aplicada se renumera.**
- **Cero push.**
