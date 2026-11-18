---
sdd: "0663"
title: "Subaliados: a quién se le cobra"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0177", "0255", "0258", "0269", "0287", "0336", "0456", "0461", "0543", "0640"]
confidencialidad: interno
---

# SDD-0663 — Subaliados: a quién se le cobra

> Un aliado puede tener subaliados. Hoy todo lo de un subaliado se le cobra al aliado raíz. Esta spec propone que cada subaliado diga a quién se le cobra, y que el estado de cuenta del raíz muestre a sus subaliados por separado, como los *jobs* de QuickBooks.
> **Estado:** `proposed`. Solo spec: sin código y sin migración. Las cinco decisiones del §6 son de Sam y están abiertas. Si al final lleva migración, el número lo da el Director General cuando Sam apruebe.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Los ejemplos usan nombres genéricos: «aliado raíz A» (prefijo `AA`) y «subaliado B» (prefijo `BB`).

## 1. Pedido

Sam, 2026-11-18: un aliado raíz está ofreciendo alianza a otros agentes de carga, cada uno con su propio código. Es un subaliado dentro de un aliado. En QuickBooks eso se lleva como *jobs*: el estado de cuenta del cliente principal trae sus jobs abajo, y se puede sacar un reporte con todo junto o uno por cada job. Pidió analizar cómo integrarlo en logística, administración y contabilidad, dentro de lo que ya se está trabajando.

El mismo día la oficina aclaró un caso: un subaliado y su aliado principal **se cobran por separado, porque así lo pidió el principal**.

## 2. Lo que hay

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La insignia es jerárquica: el cliente de un subaliado se guarda `AA-BB-1232` y se imprime `BB-1232` | SDD-0255 §3.1 y §3.2; `lib/shared/markbox-chain.ts` | D, C |
| `aliados.parent_aliado_id` nulo es aliado raíz; no nulo es subaliado. `clients.aliado_id` apunta al aliado más profundo | `supabase/migrations/0362_aliados_base.sql`; `lib/studio/aliados/aliado-types.ts` | C |
| El subaliado se da de alta desde la ficha, con un selector de aliado padre, y la ficha del padre lista sus subinsignias | `app/studio/(app)/clientes/_components/AliadoCard.tsx` | C |
| El prefijo es único en todo el tenant, de 2 a 4 letras, con prefijos reservados y guarda anticiclo | 0362, 0371, 0372 | C |
| La cadena de aliados no cruza tenants | SDD-0456 y SDD-0461 (migraciones 0450 y 0451) | D |
| Portal, etiquetas y comprobantes salen con la marca del aliado del cliente | SDD-0336 (migración 0401); `lib/studio/aliados/brand-resolve.ts` | D, C |
| La lista de precios vive solo en el aliado raíz. `resolve_price_book` sube por `parent_aliado_id` hasta el raíz, y un trigger impide que un aliado con lista pase a ser subaliado | SDD-0269; `supabase/migrations/0382_price_books.sql` (`aliados_guard_raiz_con_lista`) | D, C |
| La regla de negocio escrita: la tarifa se pacta con el raíz y el subaliado no factura con DTD | SDD-0255 §3.3 | D |
| Los lotes de contenedor emiten la factura «al aliado raíz» | SDD-0543, tabla de `invoices` | D |
| El portal del raíz muestra facturas cuyas líneas nombran envíos con la marca de sus subclientes | `lib/portal/portal-legal-queries.ts` (`embarquesDeLasLineas`) | C |
| `aliados.billing_model` admite `tarifa_fija`, `comision_pct` y `spread`. La liquidación no está construida | `aliado-types.ts`; SDD-0255 §8.1 | C, D |
| El estado de cuenta es por cliente, en portal y en PDF | SDD-0177 y SDD-0287 | D |
| No hay integración con QuickBooks; solo una investigación de cómo trabaja | `docs/architecture/contabilidad-qbo-online.md` | D |
| Cuántos subaliados hay en producción y de quién cuelgan | — | NV |

## 3. El problema

La SDD-0255 §3.3 fija que al subaliado le cobra su aliado raíz y no DTD. Con la aclaración de la oficina esa regla deja de ser general: hay subaliados que se cobran aparte.

Hoy el sistema no puede expresarlo:

- la factura del lote va siempre al raíz;
- el saldo del subaliado queda mezclado en la cuenta del raíz;
- el subaliado no puede tener tarifa propia;
- el estado de cuenta del raíz no separa lo que es de cada subaliado.

## 4. Propuesta

### 4.1 Dos datos independientes por subaliado

| Dato | Qué responde | Estado |
|---|---|---|
| **De quién es** | La jerarquía: `AA` → `BB`. Decide el código y la marca | Existe |
| **A quién se le cobra** | `raiz`: se le cobra al aliado raíz, como hoy. `propio`: la factura y el saldo van a nombre del subaliado | Nuevo |

El valor por defecto es `raiz`, así que nada cambia para los aliados actuales. El dato solo aplica a subaliados; un aliado raíz siempre se cobra a sí mismo.

Es el modelo de QuickBooks: cliente `AA` con los jobs `AA:BB` y `AA:CC`. Cada job puede llevar sus propias facturas, y el estado de cuenta del cliente los agrupa.

**El pagador de un envío** se resuelve así: se toma el aliado del cliente y se sube por la cadena hasta el primero que tenga `propio`, o hasta el raíz. Con tres niveles, un sub-subaliado en `raiz` bajo un subaliado en `propio` se le cobra a ese subaliado. (I: hoy no se conoce ningún caso de tres niveles.)

### 4.2 Logística

- No cambia el código, la etiqueta, la recepción ni el contenedor: todo sigue por Shipping Mark y marca del aliado más profundo.
- Cambia el destino de la factura: el generador de lotes (SDD-0543) y «Revisar lote» (SDD-0640) emiten una factura **por pagador y contenedor**, no siempre al raíz. Un contenedor con carga del raíz A y del subaliado B en `propio` produce dos facturas.
- La pantalla de revisión dice, en cada fila de un cliente de aliado, a quién se le va a cobrar.

### 4.3 Administración

- La tarjeta del aliado gana el campo «Se le cobra a», visible solo en subaliados, con las dos opciones y el nombre del raíz.
- Cambiar el campo no toca facturas ya emitidas: rige para las siguientes. El cambio queda en el log de auditoría.
- Tarifa del subaliado en `propio`: ver decisión 2. Si se elige tarifa propia, hay que ajustar `resolve_price_book` y el trigger `aliados_guard_raiz_con_lista` para admitir una lista en un subaliado que se cobra aparte.
- Acceso al portal del subaliado: ver decisión 4. Depende de dos pendientes de la SDD-0255: cuántos accesos puede tener un aliado (§8.3) y la cláusula de tratamiento de datos para aliados (§8.5). Sin esa cláusula no se le da a un aliado acceso a datos personales de terceros.

### 4.4 Contabilidad

- Las facturas, las cobranzas y el saldo por cobrar se llevan a nombre del pagador.
- El estado de cuenta tiene dos vistas:
  - **Consolidado**, para el aliado raíz: lo suyo arriba y una sección por subaliado debajo, cada una con su subtotal. Qué subaliados entran depende de la decisión 3.
  - **Individual**, por subaliado: solo lo de ese subaliado.
- Para que el reporte del Studio cuadre con el de QuickBooks se usa la misma estructura: cliente = aliado raíz, job = subaliado. La conciliación sigue siendo manual o por exportación; esta spec no construye una integración.
- Si el raíz gana una comisión sobre lo que paga el subaliado (decisión 5), eso es la liquidación pendiente de la SDD-0255 §8.1 y va en una fase propia. Con tarifa fija y cobro `propio` no hay comisión que calcular.

## 5. Fases propuestas

| Fase | Qué entrega | Depende de |
|---|---|---|
| F1 | El dato «Se le cobra a», la regla del pagador y la factura por pagador en lotes y en «Revisar lote» | Decisiones 1 y 2 |
| F2 | Estado de cuenta consolidado e individual, en Studio, portal y PDF | Decisión 3 |
| F3 | Acceso del subaliado al portal | Decisión 4 y SDD-0255 §8.3 y §8.5 |
| F4 | Comisión del raíz sobre lo que paga el subaliado | Decisión 5 y SDD-0255 §8.1 |

F1 lleva migración (una columna en `aliados` y, según la decisión 2, cambios en la resolución de la lista de precios). Las pantallas del Studio pasan por `/ui-check`.

## 6. Decisiones abiertas de Sam

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| 1 | ¿Cuáles de los códigos de aliado que hoy llegan en los contenedores son subaliados, y de qué raíz? | Que Sam dé la lista fuera del repo, antes de F1 | Sin ella no se sabe qué fichas hay que colgar de un padre. No va en Git |
| 2 | El subaliado que se cobra aparte, ¿paga la tarifa del raíz o una propia pactada con DTD? | Hereda la del raíz por defecto, con la opción de una lista propia | Cubre los dos casos sin obligar a duplicar listas |
| 3 | ¿El aliado raíz ve en su estado de cuenta lo de los subaliados que se cobran aparte? | Sí, como sección informativa que no suma a su saldo | Es como QuickBooks muestra los jobs, y el raíz es quien trajo al subaliado |
| 4 | ¿Los subaliados tienen acceso propio al portal? | No en F1; se decide con la cláusula de datos para aliados | Darlo antes expone datos personales de terceros sin base contractual |
| 5 | ¿El raíz gana una comisión sobre lo que paga el subaliado, o ese arreglo queda entre ellos? | Queda entre ellos; DTD no la calcula | Evita construir la liquidación para un caso que quizá no existe |

## 7. Fuera de alcance

- Integración con QuickBooks.
- Renombrar códigos de clientes que ya existen (SDD-0258).
- Mover facturas ya emitidas de un pagador a otro.
- Consultas o cambios en producción: esta spec se escribió leyendo el repo.

## 8. Aceptación de esta spec

- [ ] Sam responde las cinco decisiones del §6.
- [ ] El Director General asigna las fases y, si aplica, el número de migración.
