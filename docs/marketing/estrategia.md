# Estrategia — DTD Cargo

> **Identidad y norte del negocio.** Fuente canónica de propósito, misión, visión, valores y
> objetivos. Lo **público** alimenta la web, el schema (`app/layout.tsx`) y `llms.txt`. Lo
> **interno** es el norte operativo y **no se publica**.
>
> **Estado (2026-06-08):** identidad cerrada con el founder. Reemplaza las versiones de 2020.

## 1 · Identidad pública (canónica)

Año canónico: **fundada 2010** + narrativa **"+15 años"**.

**Propósito (por qué existimos)**
Importar de China sigue siendo, para la mayoría, caro, lento y arriesgado. No tiene por qué
serlo. Existimos para que cualquier comercio o emprendedor en Venezuela pueda hacerlo con
confianza, sin viajar ni arriesgar su capital — de la fábrica a su puerta.

**Misión (qué hacemos)**
Llevamos tu mercancía de China a tu puerta con rapidez, economía y seguridad. Compramos,
inspeccionamos, consolidamos y nacionalizamos a nuestro nombre. Tú solo recibes. Cliente a
cliente, contenedor a contenedor.

**Visión (a dónde vamos)**
Ser el referente en logística entre China y Venezuela: la forma más confiable, económica y
rápida de importar puerta a puerta. Con equipo propio en Yiwu y Valencia, +15 años de
trayectoria y tecnología propia, hacemos que importar desde China sea simple, transparente y
rentable.

**Valores**
Confianza · Seguridad · Puntualidad · Transparencia · Cercanía · El cliente como razón de ser.

**Objetivos (públicos)**
1. Trazabilidad y tracking en tiempo real.
2. Un solo punto de contacto, sin traspasos.
3. Mejor precio por comprar directo en origen (Yiwu).
4. Calidad garantizada con inspección en China.

## 2 · Norte interno (NO publicar)

**Meta (1–2 años): duplicar el volumen mensual — de 1 a 2 contenedores/mes sostenido.**

No es solo crecimiento: es el **umbral de equilibrio operativo**. Con la estructura de costos
actual, **1 carga/mes no cubre los costos fijos**; el modelo cierra a partir de ~2
contenedores/mes. *(El detalle financiero —costos, márgenes, capital por tanda— vive en Drive,
no en git: regla de financieros.)*

**Dos motores para llegar** (detalle y plantilla en [`ventas.md`](ventas.md)):
1. **Mayoristas recurrentes** — comercios que reabastecen cada 30–45 días con precio especial
   condicionado a la cadencia.
2. **Aliados / revendedores** — socios que revenden el **servicio** DTD (white-label sobre el
   ERP) y aportan el volumen de sus propios clientes.

**Dos líneas de negocio** (decisión 2026-06-08):
- **Servicio logístico (PÚBLICO)** — el cliente importa lo suyo; DTD cobra flete + servicio. Es
  lo que vende la web y lo que revenden los aliados (white-label).
- **Trading / rotación de producto propio (INTERNO)** — DTD compra producto en origen y lo
  revende por margen vía la red. Modelo de negocio interno; **no se comunica en el sitio**.

## 3 · Linaje (de dónde viene)

Heredado de los documentos fundacionales (presentación al inversionista jul-2020 + doc web
abr-2020; reevaluación de costos 2026). Conservado como antecedente — **superado** por la
identidad de la sección 1.

- **Tagline:** *"Servicio de confianza, de China a la puerta de tu casa"* (2020) → **"Con
  Confianza, de China a tu puerta"** (brand book vigente; casing con C mayúscula desde 2026-06-05).
- **Misión 2020 (web):** servicios logísticos puerta a puerta + asesoría de compra; "rapidez,
  economía y seguridad"; "+13 años en el gigante asiático".
- **Visión/Misión 2020 (presentación):** "la empresa puerta a puerta más confiable… de la zona
  central… oportunidades de emprendimiento a sus aliados" / "organizar procesos… líder
  China→Venezuela".
- **Valores 2020 (10):** Seguridad, Responsabilidad, Puntualidad, Solidaridad, Calidad, Trabajo
  en equipo, Respeto al medio ambiente, Transporte oportuno, Personal calificado, El cliente
  como razón de ser → destilados a los 6 de la sección 1.
- **Qué cambió:** de "zona central del país" a **referente nacional China–Venezuela**; de
  cadencia ~45–60 días a **2 contenedores/mes**; las "oportunidades de mejora" de 2020 (sistema
  digital, tracking, marketing) son hoy el **ERP en construcción**.

## Punteros
- **Identidad legal + NAP + nombres:** [`identidad.md`](identidad.md).
- **Plan de ventas / cliente-ancla:** [`ventas.md`](ventas.md).
- **Versión-máquina (schema):** `@graph` en `app/layout.tsx` (`#organization` + `#website`),
  datos desde `CONTACT` en `lib/design-tokens.ts`.
- **Financieros / capital / márgenes:** Drive (no en git).
