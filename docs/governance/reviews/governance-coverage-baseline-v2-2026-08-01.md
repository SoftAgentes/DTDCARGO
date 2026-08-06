# REV-SGE-050 — Baseline de cobertura de gobernanza v2

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base | `origin/main` `67250c35de8e967562f7cfd90a578204b6173f53` |
| Modo | reconciliación documental read-only |
| Universo | cinco superficies; 57 módulos canónicos de Studio |
| Resultado | 30 `VA`, 19 `BE`, ocho `NA+BE` |

## 1. Método y límites

Se tomó LB-SGE-104 como fotografía anterior y se contrastó exclusivamente con
la evidencia durable posterior: REV-SGE-035 a REV-SGE-049, los SDD-0227 a
SDD-0234, los cierres productivos de 0317–0324 y `lib/studio/modules.ts`.

`VA` sigue significando que existe evidencia de al menos un flujo acotado. No
certifica el módulo completo. `BE` significa brecha de evidencia y no prueba por
sí sola un defecto. `NA+BE` conserva la no aplicabilidad de políticas de
mutación y la falta de evidencia UX runtime.

Esta revisión no observó sesiones autenticadas, lector de pantalla, recorrido
completo por teclado, light/dark, zoom 200 %, red lenta ni errores inducidos en
los módulos que continúan abiertos.

## 2. Cambio comprobado desde v1

| Módulo | Antes | Ahora | Evidencia acotada |
|---|---|---|---|
| Almacén VE | `BE` | `VA` | SDD-0231 · REV-SGE-042 · REV-SGE-048 |
| Naviera y consolidación | `BE` | `VA` | SDD-0232 · REV-SGE-043 · REV-SGE-048 |
| Aduana SENIAT | `BE` | `VA` | SDD-0228 · REV-SGE-037/038 · REV-SGE-048 |
| TMS | `BE` | `VA` | SDD-0230 · REV-SGE-041 · REV-SGE-048 |
| Despacho | `BE` | `VA` | SDD-0234 · REV-SGE-045 · REV-SGE-048 |
| Reclamos | `BE` | `VA` | SDD-0229 · REV-SGE-040 · REV-SGE-048 |
| Inspecciones | `BE` | `VA` | SDD-0233 · REV-SGE-044 · REV-SGE-048 |
| Financiero China | `BE` | `VA` | SDD-0227 · REV-SGE-035/036/047 |

## 3. Cinco superficies

| Superficie | Riesgo | Estado de cobertura |
|---|---|---|
| Studio ERP | R1–R3 | 57 módulos inventariados; adopción parcial trazable |
| Móvil PWA | R2/R3 | evidencia logística/Bitácora acotada; matriz por ruta y rol pendiente |
| Portal cliente | R2/R3 | invitaciones y efectos externos parciales; decisiones y documentos pendientes |
| Back CMS | R2 | publicación, permisos, error y accesibilidad sin matriz integral |
| Sitio público | R1/R2 | contenido bajo BRAND/SDD; efectos reales conservan revisión separada |

## 4. Matriz completa de Studio

| # | Grupo | Módulo | Clasificación | Evidencia o raíz pendiente |
|---:|---|---|---|---|
| 1 | Operación | Dashboard | `NA+BE` | `app/studio/(app)/dashboard/` |
| 2 | Operación | Embarques | `VA` | evidencia previa a LB-SGE-104 |
| 3 | Operación | Tracking | `VA` | evidencia previa a LB-SGE-104 |
| 4 | Operación | Calendario | `VA` | evidencia previa a LB-SGE-104 |
| 5 | Operación | Bitácora | `VA` | evidencia previa a LB-SGE-104 |
| 6 | Operación | Almacén CN | `VA` | evidencia previa a LB-SGE-104 |
| 7 | Operación | Cola de QR | `BE` | `app/studio/(app)/cola-qr/` |
| 8 | Operación | Etiquetas CN | `NA+BE` | `app/studio/(app)/etiquetas/` |
| 9 | Operación | Almacén VE | `VA` | SDD-0231 · REV-SGE-042/048 |
| 10 | Operación | Naviera y consolidación | `VA` | SDD-0232 · REV-SGE-043/048 |
| 11 | Operación | Aduana SENIAT | `VA` | SDD-0228 · REV-SGE-037/038/048 |
| 12 | Operación | TMS | `VA` | SDD-0230 · REV-SGE-041/048 |
| 13 | Operación | Despacho | `VA` | SDD-0234 · REV-SGE-045/048 |
| 14 | Operación | Reglas de despacho | `BE` | `app/studio/(app)/despacho/reglas/` |
| 15 | Operación | Dashboard despacho | `NA+BE` | `app/studio/(app)/despacho/dashboard/` |
| 16 | Operación | Rutas y ciudades | `VA` | evidencia previa a LB-SGE-104 |
| 17 | Operación | Inventario WMS | `NA+BE` | `app/studio/(app)/inventario/` |
| 18 | Operación | Reclamos | `VA` | SDD-0229 · REV-SGE-040/048 |
| 19 | Operación | Inspecciones | `VA` | SDD-0233 · REV-SGE-044/048 |
| 20 | Comercial | Estimados | `BE` | `app/studio/(app)/cotizador/` |
| 21 | Comercial | Clientes | `VA` | evidencia previa a LB-SGE-104 |
| 22 | Comercial | Conversaciones | `BE` | `app/studio/(app)/conversaciones/` |
| 23 | Comercial | CRM Leads | `NA+BE` | `app/studio/(app)/leads/` |
| 24 | Comercial | Kommo CRM | `BE` | `app/studio/(app)/kommo/` |
| 25 | Comercial | Órdenes de venta | `VA` | evidencia previa a LB-SGE-104 |
| 26 | Comercial | PreAlertas | `VA` | evidencia previa a LB-SGE-104 |
| 27 | Comercial | Compras asistidas | `VA` | evidencia previa a LB-SGE-104 |
| 28 | Comercial | Servicios | `BE` | `app/studio/(app)/servicios/` |
| 29 | Comercial | Tarifas | `BE` | `app/studio/(app)/tarifas/` |
| 30 | Comercial | Fidelización | `BE` | `app/studio/(app)/fidelizacion/` |
| 31 | Comercial | Club DTD | `BE` | `app/studio/(app)/club/` |
| 32 | Comercial | Academia | `BE` | `app/studio/(app)/academia/` |
| 33 | Finanzas | Dirección | `NA+BE` | `app/studio/(app)/direccion/` |
| 34 | Finanzas | Facturación | `VA` | evidencia previa a LB-SGE-104 |
| 35 | Finanzas | Cobranzas | `VA` | evidencia previa a LB-SGE-104 |
| 36 | Finanzas | Gastos | `BE` | `app/studio/(app)/gastos/` |
| 37 | Finanzas | Tesorería | `VA` | evidencia previa a LB-SGE-104 |
| 38 | Finanzas | Contabilidad | `VA` | evidencia previa a LB-SGE-104 |
| 39 | Finanzas | Fiscal SENIAT | `VA` | evidencia previa a LB-SGE-104 |
| 40 | Finanzas | Costing y margen | `BE` | `app/studio/(app)/costing/` |
| 41 | Finanzas | Reportes | `BE` | `app/studio/(app)/reportes/` |
| 42 | Finanzas | Nómina y RRHH | `BE` | gate nominal 0316 pendiente |
| 43 | Finanzas | Rendiciones | `VA` | evidencia previa a LB-SGE-104 |
| 44 | Finanzas | Financiero China | `VA` | SDD-0227 · REV-SGE-035/036/047 |
| 45 | Marketing | Marketing | `BE` | `app/studio/(app)/marketing/` |
| 46 | Marketing | Noticias Web | `BE` | `app/studio/(app)/marketing/noticias-web/` |
| 47 | Marketing | Documentos marketing | `NA+BE` | `app/studio/(app)/marketing/docs/` |
| 48 | Sistema | Menciones | `VA` | evidencia previa a LB-SGE-104 |
| 49 | Sistema | Documentos | `VA` | evidencia previa a LB-SGE-104 |
| 50 | Sistema | Mis reportes | `BE` | `app/studio/(app)/mis-bugs/` |
| 51 | Sistema | Bug Tracker | `BE` | `app/studio/(app)/bugs/` |
| 52 | Sistema | Operarios PWA | `VA` | evidencia previa a LB-SGE-104 |
| 53 | Sistema | Usuarios | `VA` | evidencia previa a LB-SGE-104 |
| 54 | Sistema | Administración | `VA` | evidencia previa a LB-SGE-104 |
| 55 | Sistema | Mailing | `VA` | evidencia previa a LB-SGE-104 |
| 56 | Sistema | Legal y T&C | `BE` | `app/studio/(app)/legal/` |
| 57 | Sistema | No-Olvidar | `NA+BE` | `app/studio/(app)/no-olvidar/` |

Conteo reproducible: 30 `VA`, 19 `BE` y ocho `NA+BE`.

## 5. Trabajo restante y fronteras

1. Completar por slices la evidencia de los 19 módulos `BE`, priorizando una
   acción R3 real y sin convertir el inventario en un barrido de producto.
2. Ejecutar smoke autenticado de accesibilidad y jerarquía en los ocho
   `NA+BE`; mientras no exista sesión y fixture válidos, no promoverlos.
3. Mantener móvil, portal, Back y sitio público en auditorías separadas.
4. Resolver Nómina 0316, E5 y E2E Tier-3 mediante sus gates independientes.
5. Convertir únicamente hallazgos observados en SDD y allowlists acotadas.

## 6. Conclusión

El cluster R3 redujo de 27 a 19 la brecha `BE` sin alterar la definición de
cobertura. La gobernanza ejecutable está operativa; lo restante es adopción
incremental y evidencia runtime, no un residuo técnico que autorice correcciones
transversales sin hallazgos.
