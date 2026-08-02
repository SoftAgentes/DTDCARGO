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

### 2.1 Flujo operativo — se corta en el último metro 🔴

**`camionero_pod` sólo inserta en `dispatch_pods` y ahí termina.** No toca
`shipments.status`, no inserta en `shipment_events`, no programa aviso. O sea: **la
entrega física con foto y firma no cierra el embarque, no genera evento de rastreo y
no le avisa a nadie.**

Peor: el módulo Tracking bloquea el estado `delivered` a mano y le dice al operador
*"usa el POD sellado de Despacho"* — **una promesa que el código no cumple.**

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

### ✅ Lote 3a — XSS de JSON-LD · `696ccf18`

15 bloques inyectaban `JSON.stringify` pelado con `dangerouslySetInnerHTML`,
incluidos los de `/noticias` que serializan **contenido del CMS**. Contrato validado
con mutación.

### ⬜ Lote 3b — Sesión y permisos · alto · ~1,5 h

- [ ] `proxy.ts` no refresca la sesión en `/portal` ni `/m/erp` (matcher sólo cubre
      `/studio` y `/back`) → al vencer el token la navegación server-side ve sesión
      muerta
- [ ] 3 sub-rutas del Studio sin gate de vista RBAC
- [ ] `/studio/debug` fuera del registro y de la matriz RBAC
- [ ] 3 route handlers de `app/api/studio` sin verificación de sesión
- [ ] `apiError()` en los 36 handlers que devuelven `error.message` crudo de Postgres

### ⬜ Lote 4 — Feature flags que mienten · crítico · ~1,5 h

- [ ] 16 de 21 toggles del admin escriben en la DB y **no gatean nada**
- [ ] `marketing_news` no lo siembra ninguna migración y la RPC exige fila existente
      → el toggle **siempre falla** y Noticias Web es inalcanzable
- [ ] No hay trigger que siembre flags al crear un tenant → en un tenant nuevo
      (aliados white-label) el panel entero está roto
- [ ] `dispatch.show_warehouse_location` es un flag vivo que no aparece en el panel

### ⬜ Lote 5 — Poda y documentación de entrada · medio · ~1 h

- [ ] Código muerto **verificado uno por uno** (ver §5: la lista del auditor tenía un
      falso positivo que habría roto la calculadora)
- [ ] Basura de raíz: informe stub, directorio vacío, `.md` de 0 bytes
- [ ] 6 variables de entorno ausentes de `.env.example`
- [ ] **`AGENTS.md`: la tabla de integraciones públicas es falsa** — cita `/estimacion`
      y `/calculadora`, que hoy son 301 a `/tarifas`, y afirma que el endpoint crea
      `EST-XXXX` cuando el propio código dice que ya no. Es lo primero que lee todo
      agente que entra al repo.
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
