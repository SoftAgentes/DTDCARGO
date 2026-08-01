# REV-SGE-029 — Baseline de cobertura de gobernanza v1

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Base | `origin/main` `1103ccdec4949687c29d20ed22dc742e2f4c9b19` |
| Modo | auditoría read-only |
| Universo | cinco superficies; 57 módulos canónicos de Studio |
| Resultado | cobertura parcial trazable; cero cambios de producto |

## 1. Método y límites

La revisión leyó `AGENT-BRIEF.md`, el registro maestro, la cápsula, el registry
read-only del plugin, `lib/studio/modules.ts`, el mapa módulo↔SDD y la evidencia
durable de Gobernanzas 1–9. El árbol de Studio, `lib/studio` y gobernanza del
worktree auditado coincide con `origin/main`.

El inventario estático enruta políticas y riesgo, pero no prueba por sí solo
conformidad. Esta revisión no observó sesiones autenticadas, lector de
pantalla, teclado completo, light/dark, zoom 200 %, viewport móvil, red lenta,
doble ejecución ni errores inducidos.

## 2. Clasificación

| Código | Clasificación | Uso |
|---|---|---|
| `VA` | cumplimiento acotado | Existe evidencia durable de al menos un flujo; el módulo completo sigue abierto. |
| `BE` | no conformidad de evidencia | Módulo activo R2/R3 sin matriz integral. No implica por sí sola un defecto de código. |
| `NA+BE` | no aplica a mutaciones; evidencia UX pendiente | Flujo read-only o placeholder; A11Y-01/VIS-01 todavía no están demostradas. |

Resultado reproducible: 22 `VA`, 27 `BE` y ocho `NA+BE`. No se registra una
excepción nueva ni una no conformidad funcional basada solo en conteos.

## 3. Cinco superficies

| Superficie | Riesgo | Clasificación |
|---|---|---|
| Studio ERP | R1–R3 | 57 módulos inventariados; adopción parcial |
| Móvil PWA | R2/R3 | evidencia logística/Bitácora acotada; matriz por ruta y rol pendiente |
| Portal cliente | R2/R3 | invitaciones y efectos externos parciales; decisiones y documentos pendientes |
| Back CMS | R2 | publicación, permisos, error y accesibilidad sin matriz integral |
| Sitio público | R1/R2 | contenido estático bajo BRAND/SDD; efectos reales conservan revisión separada |

## 4. Matriz completa de Studio

Las raíces de slice son candidatas de lectura. Cualquier implementación futura
debe reducirlas a una acción, su frontera server-side, pruebas y un SDD; esta
tabla no autoriza editar el árbol completo.

| # | Grupo | Módulo | Riesgo | Políticas adicionales | Clasificación | Raíz candidata |
|---:|---|---|---|---|---|---|
| 1 | Operación | Dashboard | R1 | TBL, BUS, PRG | `NA+BE` | `app/studio/(app)/dashboard/` |
| 2 | Operación | Embarques | R1/R2 | CAL, DAT, BUS, TBL | `VA` | `app/studio/(app)/embarques/` |
| 3 | Operación | Tracking | R3 | CAL, DAT, UPL, MP, AUD | `VA` | `app/studio/(app)/tracking/` |
| 4 | Operación | Calendario | R2 | CAL, DAT, DND | `VA` | `app/studio/(app)/calendario/` |
| 5 | Operación | Bitácora | R2/R3 | DND, IA, MP, AUD, UPL | `VA` | `app/studio/(app)/bitacora/` |
| 6 | Operación | Almacén CN | R3 | AUD, MP, UPL, NUM | `VA` | `app/studio/(app)/cn/` |
| 7 | Operación | Cola de QR | R2 | PRG, TBL, ICO | `BE` | `app/studio/(app)/cola-qr/` |
| 8 | Operación | Etiquetas CN | R1/R2 | ICO, VIS, A11Y | `NA+BE` | `app/studio/(app)/etiquetas/` |
| 9 | Operación | Almacén VE | R3 | AUD, MP, UPL | `BE` | `app/studio/(app)/ve/` |
| 10 | Operación | Naviera y consolidación | R3 | AUD, MP, CAL, NUM | `BE` | `app/studio/(app)/naviera/` |
| 11 | Operación | Aduana SENIAT | R3 | AUD, MP, UPL, NUM | `BE` | `app/studio/(app)/seniat/` |
| 12 | Operación | TMS | R3 | AUD, MP, CAL | `BE` | `app/studio/(app)/tms/` |
| 13 | Operación | Despacho | R3 | AUD, MP, DND, PRG | `BE` | `app/studio/(app)/despacho/` |
| 14 | Operación | Reglas de despacho | R2/R3 | AUD, MP, FRM | `BE` | `app/studio/(app)/despacho/reglas/` |
| 15 | Operación | Dashboard despacho | R1 | TBL, PRG, VIS | `NA+BE` | `app/studio/(app)/despacho/dashboard/` |
| 16 | Operación | Rutas y ciudades | R2 | AUD, MP, FRM, TBL | `VA` | `app/studio/(app)/admin/rutas/` |
| 17 | Operación | Inventario WMS | R1 | TBL, BUS, A11Y | `NA+BE` | `app/studio/(app)/inventario/` |
| 18 | Operación | Reclamos | R3 | UPL, MP, AUD, TBL | `BE` | `app/studio/(app)/reclamos/` |
| 19 | Operación | Inspecciones | R3 | UPL, MP, AUD, WIZ | `BE` | `app/studio/(app)/inspecciones/` |
| 20 | Comercial | Estimados | R2/R3 | NUM, FRM, MP, AUD | `BE` | `app/studio/(app)/cotizador/` |
| 21 | Comercial | Clientes | R3 | BUS, CRT, MP, AUD, UPL | `VA` | `app/studio/(app)/clientes/` |
| 22 | Comercial | Conversaciones | R2/R3 | AUD, IA, ERR | `BE` | `app/studio/(app)/conversaciones/` |
| 23 | Comercial | CRM Leads | R1 | — | `NA+BE` | `app/studio/(app)/leads/` |
| 24 | Comercial | Kommo CRM | R3 | AUD, IA, ERR, PRG | `BE` | `app/studio/(app)/kommo/` |
| 25 | Comercial | Órdenes de venta | R3 | MP, AUD, NUM | `VA` | `app/studio/(app)/ordenes-venta/` |
| 26 | Comercial | PreAlertas | R3 | MP, AUD, CAL, UPL | `VA` | `app/studio/(app)/proveedores/` |
| 27 | Comercial | Compras asistidas | R3 | MP, AUD, NUM | `VA` | `app/studio/(app)/ordenes-compra/` |
| 28 | Comercial | Servicios | R2 | FRM, MP, AUD | `BE` | `app/studio/(app)/servicios/` |
| 29 | Comercial | Tarifas | R2/R3 | NUM, MP, AUD | `BE` | `app/studio/(app)/tarifas/` |
| 30 | Comercial | Fidelización | R2 | NUM, FRM, AUD | `BE` | `app/studio/(app)/fidelizacion/` |
| 31 | Comercial | Club DTD | R2/R3 | MP, AUD, FRM | `BE` | `app/studio/(app)/club/` |
| 32 | Comercial | Academia | R2 | FRM, WIZ, PRG | `BE` | `app/studio/(app)/academia/` |
| 33 | Finanzas | Dirección | R2 | AUD-02, TBL, VIS | `NA+BE` | `app/studio/(app)/direccion/` |
| 34 | Finanzas | Facturación | R3 | HTD, MP, AUD, NUM | `VA` | `app/studio/(app)/facturacion/` |
| 35 | Finanzas | Cobranzas | R3 | MP, AUD, NUM | `VA` | `app/studio/(app)/cobranzas/` |
| 36 | Finanzas | Gastos | R3 | MP, AUD, NUM, UPL | `BE` | `app/studio/(app)/gastos/` |
| 37 | Finanzas | Tesorería | R3 | MP, AUD, NUM | `VA` | `app/studio/(app)/tesoreria/` |
| 38 | Finanzas | Contabilidad | R3 | MP, AUD, NUM, TBL | `VA` | `app/studio/(app)/contabilidad/` |
| 39 | Finanzas | Fiscal SENIAT | R3 | NUM, AUD, A11Y | `VA` | `app/studio/(app)/fiscal/` |
| 40 | Finanzas | Costing y margen | R3 | NUM, AUD, FRM | `BE` | `app/studio/(app)/costing/` |
| 41 | Finanzas | Reportes | R2/R3 | TBL, AUD-02, UPL | `BE` | `app/studio/(app)/reportes/` |
| 42 | Finanzas | Nómina y RRHH | R3 | MP, AUD, NUM, UPL | `BE` | `app/studio/(app)/nomina/` |
| 43 | Finanzas | Rendiciones | R3 | MP, AUD, NUM | `VA` | `app/studio/(app)/rendiciones/` |
| 44 | Finanzas | Financiero China | R3 | NUM, MP, AUD, UPL | `BE` | `app/studio/(app)/financiero-china/` |
| 45 | Marketing | Marketing | R2 | IA, CAL, AUD | `BE` | `app/studio/(app)/marketing/` |
| 46 | Marketing | Noticias Web | R2/R3 | IA, AUD, CMP | `BE` | `app/studio/(app)/marketing/noticias-web/` |
| 47 | Marketing | Documentos marketing | R1 | BUS, A11Y, VIS | `NA+BE` | `app/studio/(app)/marketing/docs/` |
| 48 | Sistema | Menciones | R1/R2 | MP, AUD, A11Y | `VA` | `app/studio/(app)/menciones/` |
| 49 | Sistema | Documentos | R3 | UPL, MP, AUD, TBL | `VA` | `app/studio/(app)/documentos/` |
| 50 | Sistema | Mis reportes | R1/R2 | FRM, ERR | `BE` | `app/studio/(app)/mis-bugs/` |
| 51 | Sistema | Bug Tracker | R2 | TBL, DND, UPL | `BE` | `app/studio/(app)/bugs/` |
| 52 | Sistema | Operarios PWA | R3 | AUD, MP, A11Y | `VA` | `app/studio/(app)/operarios/` |
| 53 | Sistema | Usuarios | R3 | AUD, MP, HTD | `VA` | `app/studio/(app)/usuarios/` |
| 54 | Sistema | Administración | R3 | AUD-02, IA, MP, UPL | `VA` | `app/studio/(app)/admin/` |
| 55 | Sistema | Mailing | R3 | VIS-02, AUD, IA, ERR | `VA` | `app/studio/(app)/mailing/` |
| 56 | Sistema | Legal y T&C | R3 | MP, AUD-02, UPL | `BE` | `app/studio/(app)/legal/` |
| 57 | Sistema | No-Olvidar | R1 actual/R3 futuro | MP, AUD, UPL | `NA+BE` | `app/studio/(app)/no-olvidar/` |

## 5. Trabajo restante

1. Auditar al menos un flujo representativo de los 27 módulos `BE`, empezando
   por acciones R3.
2. Extender los 22 módulos `VA` sin reabrir los flujos ya cerrados.
3. Ejecutar smoke autenticado de accesibilidad y jerarquía en los ocho
   `NA+BE` mientras sigan read-only o placeholders.
4. Mantener móvil, portal, Back y sitio público en revisiones separadas.
5. Convertir únicamente hallazgos comprobados en SDD pequeños; cero barrido
   transversal por conteos.

Una primera pasada completa equivale aproximadamente a 10–14 ventanas de
auditoría agrupando 4–6 módulos relacionados. La cantidad de slices de
corrección no puede fijarse antes de observar runtime y escenarios de fallo.

## 6. Próximo gate

El siguiente gate recomendado es un slice R3 de un solo flujo. Nómina y RRHH
es el primer candidato por sensibilidad, amplitud de acciones y ausencia de un
recibo integral de gobernanza. Abrirlo requiere SDD, allowlist exacta y
autorización separada; esta revisión no lo implementa.
