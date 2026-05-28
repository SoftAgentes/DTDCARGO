-- ─────────────────────────────────────────────────────────────
-- Plan v4 · Phase B — Seed inicial de news_posts desde NEWS_POSTS hardcoded
--
-- Migra los 5 posts existentes de lib/design-tokens.ts → tabla news_posts
-- con:
--   - Nuevas categorías (operacion/industria/tutorial → operaciones/
--     industria-global/tutoriales-guias)
--   - Fechas rotativas 2025/2026
--   - Author = "DTD Cargo" (escritos por el equipo, sin disclaimer)
--   - Source = 'manual'
--
-- Bodies: posts 1-3 quedan SIN body (próximamente). Posts 4-5 tienen
-- body Markdown convertido desde HTML inline (<b> → **).
--
-- Aplica para todos los tenants existentes.
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_tenant_id uuid;
begin
  -- Asumimos 1 tenant (DTD). Si hay más, el seed aplica al primero.
  select id into v_tenant_id from public.tenants order by created_at limit 1;
  if v_tenant_id is null then
    raise notice 'No hay tenants — skip seed';
    return;
  end if;

  -- Post 1: guia-incoterms-2020 → tutoriales-guias (informativo) · 2026-05-15
  insert into public.news_posts (
    tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
    author_name, author_role, date, read_time_min, published, source,
    focus_keyword, secondary_keywords, meta_description
  ) values (
    v_tenant_id,
    'guia-incoterms-2020',
    'informativo',
    'tutoriales-guias',
    'Guía rápida de Incoterms 2020 para importadores venezolanos',
    'Los 11 términos comerciales explicados sin jerga. Cuál elegir según tu tipo de carga y la relación que tienes con tu proveedor en China.',
    '',
    'DTD Cargo',
    null,
    '2026-05-15',
    5,
    true,
    'manual',
    'incoterms 2020',
    '["importar de china a venezuela","FCL LCL china","puerta a puerta"]'::jsonb,
    'Guía completa de Incoterms 2020 explicada para importadores venezolanos: cuándo usar EXW, FOB, CIF, DDP y más.'
  ) on conflict (slug) do nothing;

  -- Post 2: yiwu-ventaja-estrategica → china (curiosidad) · 2025-11-08
  insert into public.news_posts (
    tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
    author_name, author_role, date, read_time_min, published, source,
    focus_keyword, secondary_keywords, meta_description
  ) values (
    v_tenant_id,
    'yiwu-ventaja-estrategica',
    'curiosidad',
    'china',
    'Por qué Yiwu es el mejor punto de partida para tu importación',
    '75.000+ tiendas, 2 millones de productos disponibles, MOQ excepcionalmente bajo. Lo que hace a Yiwu único en el mapa logístico mundial.',
    '',
    'DTD Cargo',
    null,
    '2025-11-08',
    4,
    true,
    'manual',
    'yiwu importadores',
    '["cómo invertir en china","agente de compras china","mercado china yiwu"]'::jsonb,
    'Por qué Yiwu es el mejor hub de sourcing para importar de China: 75.000 tiendas, MOQ bajos y consolidación eficiente.'
  ) on conflict (slug) do nothing;

  -- Post 3: tiempos-yiwu-puerto-cabello → operaciones (informativo) · 2026-04-22
  insert into public.news_posts (
    tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
    author_name, author_role, date, read_time_min, published, source,
    focus_keyword, secondary_keywords, meta_description
  ) values (
    v_tenant_id,
    'tiempos-yiwu-puerto-cabello',
    'informativo',
    'operaciones',
    'Tiempos reales de tránsito: Yiwu → Puerto Cabello',
    'ETD, ETA, despacho de aduana, last mile. Desglose del recorrido completo con tiempos típicos por modalidad (FCL, LCL DDP, courier aéreo).',
    '',
    'DTD Cargo',
    null,
    '2026-04-22',
    6,
    true,
    'manual',
    'puerta a puerta',
    '["carga DDP china venezuela","FCL LCL china","tiempos puerto cabello"]'::jsonb,
    'Tiempos reales de tránsito de Yiwu a Puerto Cabello: FCL 30 días, LCL DDP 45 días, courier aéreo 7 días. Desglose paso a paso.'
  ) on conflict (slug) do nothing;

  -- Post 4: navieras-mas-grandes-mundo → industria-global (curiosidad) · 2025-08-15
  insert into public.news_posts (
    tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
    author_name, author_role, date, read_time_min, published, source,
    focus_keyword, secondary_keywords, meta_description
  ) values (
    v_tenant_id,
    'navieras-mas-grandes-mundo',
    'curiosidad',
    'industria-global',
    'Navieras más grandes del mundo',
    'Las 8 navieras más grandes del mundo en cargas marítimas. El transporte marítimo es columna vertebral del comercio global, moviendo mercancías a través de los océanos.',
    $md$**Las 8 Navieras Más Grandes del Mundo en Cargas Marítimas**

El transporte marítimo es una columna vertebral del comercio global, moviendo mercancías esenciales a través de los océanos de todo el mundo. Las navieras más grandes y poderosas del planeta desempeñan un papel crítico en esta industria.

## 1. Maersk Line

**Sede**: Copenhague, Dinamarca.

**Flota**: Maersk opera una de las flotas de contenedores más grandes del mundo, con barcos de última generación y una presencia global sólida. Son conocidos por su eficiencia operativa y su compromiso con la sostenibilidad.

Fundada en 1904 en Copenhague, Dinamarca, **Maersk** se ha mantenido como la naviera más grande del mundo. Cuenta con una fuerza de trabajo de 79.000 empleados en 130 países y opera más de **700 buques** de carga que visitan 343 puertos a nivel mundial. Puede transportar **más de 4 millones** de contenedores (TEU), lo cual le otorga una cuota de mercado de **17.7%**.

## 2. Mediterranean Shipping Company (MSC)

**Sede**: Ginebra, Suiza.

**Flota**: MSC es una de las navieras más grandes en términos de capacidad de contenedores. Opera una red extensa de rutas que conectan los cinco continentes y se enfoca en la innovación tecnológica.

Fundada en 1970 por el italiano Gianluigi Aponte, **MSC** cuenta con una flota de **517 buques** que acuden a 315 puertos. Capacidad de **3,3 millones de TEU**, participación de mercado de **14,5%**.

## 3. CMA CGM

**Sede**: Marsella, Francia.

**Flota**: CMA CGM es líder en transporte de contenedores y es conocida por su compromiso con la sostenibilidad y la reducción de emisiones. También opera servicios logísticos y terminales portuarias.

Fundada en 1978, **CMA CGM** cuenta con **492 buques** de carga. Capacidad de **2,6 millones de TEU**, alrededor de **11.4%** del mercado.

## 4. COSCO Shipping Lines

**Sede**: Shanghái, China.

**Flota**: Parte del grupo COSCO, esta naviera china es una de las más grandes del mundo y ha aumentado su presencia global en los últimos años, especialmente después de la adquisición de OOCL.

**COSCO** tiene una capacidad de **2.7 millones de TEU** con **473 buques** y una porción de mercado del **12,2%**.

## 5. Evergreen Marine Corporation

**Sede**: Taipéi, Taiwán.

**Flota**: Evergreen es conocida por su flota de barcos verdes y su presencia en rutas comerciales clave. Se ha centrado en la eficiencia energética y la reducción de emisiones.

Fundada en 1968, **Evergreen** cuenta con una flota de **203 buques** y puede transportar **1.1 millón de TEU**. Cuota de mercado de **5.2%**.

## 6. Hapag-Lloyd

**Sede**: Hamburgo, Alemania.

**Flota**: Hapag-Lloyd es una de las navieras más antiguas y grandes del mundo. Se ha centrado en modernizar su flota y en la digitalización de sus operaciones.

Fundada en 1970 (de la fusión HAPAG + NDL), en 2014 se fusionó con CSAV. **Hapag-Lloyd** tiene **223 buques** y capacidad de **1.6 millones de TEU**, **7.3%** de participación.

## 7. China Shipping Container Lines (CSCL)

**Sede**: Shanghái, China.

**Flota**: Parte del conglomerado chino China COSCO Shipping Corporation, CSCL ha crecido significativamente en términos de flota y rutas en los últimos años.

CSG opera **400 buques** con un peso muerto total de 11,5 millones de toneladas. Activos totales: RMB 40 mil millones (~US$4.82 mil millones).

## 8. Yang Ming Marine Transport Corporation

**Sede**: Taipéi, Taiwán.

**Flota**: Yang Ming es una naviera de Taiwán que ha estado operando durante más de 40 años. Su flota se ha modernizado y ha expandido su presencia global.

Fundada en 1972, **Yang Ming** opera **97 buques** de carga que manejan **656,491 TEU**, **2.9%** del mercado.

## Conclusión

Estas navieras son gigantes en el mundo del transporte marítimo, moviendo una parte sustancial de la carga global en contenedores y contribuyendo significativamente al comercio internacional. Su influencia se extiende desde la gestión de flotas de última generación hasta iniciativas de sostenibilidad que buscan reducir el impacto ambiental.

Si quieres conocer más sobre nuestros servicios puedes escribirnos a info@doortudoor.com
$md$,
    'DTD Cargo',
    null,
    '2025-08-15',
    6,
    true,
    'manual',
    'navieras más grandes del mundo',
    '["transporte marítimo","contenedores TEU","comercio internacional","puerta a puerta"]'::jsonb,
    'Las 8 navieras más grandes del mundo en transporte de contenedores: Maersk, MSC, CMA CGM, COSCO y más. Cuota de mercado y capacidad TEU.'
  ) on conflict (slug) do nothing;

  -- Post 5: buques-cargueros-mas-grandes → industria-global (curiosidad) · 2026-02-10
  insert into public.news_posts (
    tenant_id, slug, tipo, categoria, title, excerpt, body_markdown,
    author_name, author_role, date, read_time_min, published, source,
    focus_keyword, secondary_keywords, meta_description
  ) values (
    v_tenant_id,
    'buques-cargueros-mas-grandes',
    'curiosidad',
    'industria-global',
    'Buques cargueros más grandes del planeta',
    'Buques de carga son naves utilizadas para transportar todo tipo de mercancías. El transporte marítimo mueve 90% del comercio mundial. Repaso a los gigantes del océano.',
    $md$**BUQUES DE CARGA**

**Un buque de carga es una nave utilizada para transportar todo tipo de mercancías, de un punto a otro.**

De acuerdo con la OMI (Organización Marítima Internacional), **el transporte marítimo mueve un 90% del comercio mundial**, por lo que estamos muy acostumbrados a ver este tipo de embarcaciones por nuestros mares.

Estos buques pueden trasladar todo tipo de mercancías: ropa, juguetes, minerales, carbón, petróleo. Según los materiales transportados reciben un nombre u otro: portacontenedores, buques Ro-Ro, granelero, petrolero. Acá los englobamos todos en buques de carga, entre los barcos más grandes del mundo.

## 1. Evergreen Ever a lot

El buque de carga más grande del mundo y **el primero en superar los 24.000 TEUs** (contenedores tamaño estándar) de capacidad. Portacontenedor del grupo de astilleros chino CSSC. Medidas aproximadas: **400 m de eslora y 61,50 m de manga**.

Fue fabricado en 2022. Su extensión es comparable a tres o cuatro campos de fútbol.

## 2. HMM Algeciras y HMM Oslo

Hyundai Merchant Marine (HMM) es el naviero del mayor portacontenedores del mundo. El Algeciras fue construido en septiembre de 2019 y el Oslo en 2020. Después del Evergreen, el Algeciras es el mayor con **capacidad de 23.964 TEUs** — segundo lugar por una diferencia de solo 28 contenedores.

Tiene **400 metros de eslora y 61 metros de manga**. Quilla sumergida más de trece metros bajo la superficie. **Primero de la clase Megamax 24**.

El HMM Oslo es el hermano gemelo con capacidad de 23.820 TEUs.

## 3. MSC Gülsün y MSC Mina

La naviera MSC (Mediterranean Shipping Company) es una compañía muy conocida de buques de carga. Además de carga, opera cruceros (MSC Cruises).

El MSC Mina, fabricado en 2019, **fue el primero en superar los 23.000 TEUs** (capacidad 23.756). Dispone de casi 2.000 contenedores frigoríficos para alimentos y medicamentos refrigerados.

El MSC Gülsun (22.960 TEUs) fue el más grande hasta que su hermano Mina lo superó. **La diferencia entre ambos son las cubiertas**: el Mina dispone de 13 cubiertas, el Gülsün de 12.

## Conclusión

Los buques de carga modernos son auténticas ciudades flotantes. Comprender su capacidad y rutas ayuda a planificar mejor las importaciones desde China a Venezuela: elegir naviera y modalidad (FCL/LCL) tiene impacto directo en costo y tiempo.
$md$,
    'DTD Cargo',
    null,
    '2026-02-10',
    3,
    true,
    'manual',
    'buques cargueros',
    '["portacontenedores TEU","navieras","transporte marítimo china","puerta a puerta"]'::jsonb,
    'Los buques cargueros más grandes del mundo: Evergreen Ever a lot, HMM Algeciras, MSC Mina. Capacidades, medidas y récords TEU.'
  ) on conflict (slug) do nothing;

  raise notice 'Seed news_posts completado para tenant %', v_tenant_id;
end $$;
