-- ─────────────────────────────────────────────────────────────
-- SDD-0140 (Fase 1): Perfiles de puesto en nómina — nomina_positions
--
-- Capa 2 del doc del founder `estructura-perfiles-dtdcargo.md`: el PERFIL de
-- cada puesto, desacoplado de la persona ("¿qué necesita Contabilidad, sin
-- importar quién lo ocupe hoy?"). Implementa el follow-up que ese doc dejó
-- escrito en §7/§9: "la Matriz rol→persona debe volverse una TABLA en la DB".
--
-- El perfil NO es PII (no hay datos de personas, solo la definición del rol)
-- → el seed es el modelo REAL del founder, no ficticio.
--
-- Seguridad: misma que el resto de nómina — RLS por tenant Y rol
-- (admin/accounting) vía nomina_can_access() (definida en 0160). El módulo
-- 'nomina' es dinero + PII; los perfiles viven ahí (RRHH).
--
-- `rbac_role` es una SUGERENCIA/plantilla para el alta unificada (Fase 2);
-- el control real de permisos sigue en lib/studio/rbac.ts (matriz en código,
-- SDD-0139). No crea roles nuevos: reusa el enum StudioUserRole (SDD-0024).
--
-- Aditiva. text+check para el enum de rol. NO aplicar a prod (lo hace la
-- coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.nomina_positions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  slug               text not null,                       -- kebab-case, único por tenant
  title              text not null,                       -- "Administración / PMO / Tesorería"
  area               text not null,                       -- agrupador: Administración, Comercial, …
  -- Rol RBAC sugerido (plantilla del alta). null = puesto sin asiento en el ERP.
  rbac_role          text
    check (rbac_role in ('admin','commercial','operations','accounting','warehouse','support','marketing')),
  triggers           text,                                -- disparadores (enrutan la tarea)
  responsibilities   text,                                -- responsabilidades
  skills             text,                                -- skills duras + blandas
  kpi                text,                                -- KPI principal
  owner_note         text,                                -- titular/suplente sugerido (referencial)
  governance_note    text,                                -- candado de gobernanza (separación de poderes)
  sort_order         int  not null default 100,
  active             boolean not null default true,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (tenant_id, slug)
);

comment on table public.nomina_positions is
  'SDD-0140: perfil de puesto (Capa 2 del doc estructura-perfiles). Decoplado de la persona. RLS por tenant Y rol (admin/accounting). rbac_role = plantilla del alta, NO fuente de permisos (esa es lib/studio/rbac.ts).';
comment on column public.nomina_positions.rbac_role is
  'Rol RBAC sugerido para el alta unificada (enum StudioUserRole). null = puesto sin cuenta en el ERP.';
comment on column public.nomina_positions.governance_note is
  'Candado de separación de poderes del doc §5.11/§7 (ej: accounting mueve plata pero NO admin).';

create index nomina_positions_tenant_area_idx
  on public.nomina_positions (tenant_id, area)
  where deleted_at is null;

-- Trigger updated_at (función existente 0002/0012).
create trigger nomina_positions_touch
  before update on public.nomina_positions
  for each row execute function public.touch_updated_at();

-- GRANTS explícitos (auto-expose OFF).
grant select, insert, update, delete on public.nomina_positions to authenticated;

-- RLS por tenant Y rol (admin/accounting) — reusa nomina_can_access() de 0160.
alter table public.nomina_positions enable row level security;

create policy "nomina_positions by tenant and role"
  on public.nomina_positions for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and deleted_at is null
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- ── Seed: perfiles REALES del doc estructura-perfiles-dtdcargo.md (tenant 'dtd') ──
-- Definiciones de puesto (no personas → no PII). Idempotente por slug.
insert into public.nomina_positions
  (tenant_id, slug, title, area, rbac_role, triggers, responsibilities, skills, kpi, owner_note, governance_note, sort_order)
select
  t.id, x.slug, x.title, x.area, x.rbac_role, x.triggers, x.responsibilities, x.skills, x.kpi, x.owner_note, x.governance_note, x.sort_order
from public.tenants t
join lateral (values
  ('direccion-general', 'Dirección General (CEO)', 'Dirección', 'admin',
   'Decisión de rumbo/prioridad/recurso; conflicto entre áreas; validar la visión del ERP; correr la reunión semanal.',
   'Visión y estrategia; decir "no"; decisiones de capital/personas/prioridades; ritmo semanal; dueño de la visión del ERP.',
   'Estrategia, finanzas básicas, negocio China–VE, priorización, vibe-coding. Blandas: decisión, foco, delegar.',
   'Avance del MVP del ERP + progreso a 2 contenedores/mes.', 'Titular: Sam.', null, 10),
  ('direccion-marketing', 'Dirección de Marketing y Crecimiento', 'Marketing', 'marketing',
   'Definir estrategia/campaña; aprobar presupuesto/oferta; definir ICP o mensaje por cadencia; medir resultados.',
   'Estrategia de marca y campañas; ICP y mensaje por cadencia (30/45d); presupuesto y retorno; cerrar el embudo con CRM.',
   'Marketing B2B, funnels, métricas (CAC/LTV/ROAS), presupuesto. Blandas: criterio comercial, liderazgo.',
   'Leads calificados de los 2 perfiles/mes.', 'Titular: Fátima.',
   'Marketing vive en Kommo/GA4, no mueve plata del ERP.', 20),
  ('contenido-social', 'Producción de Contenido / Social Media', 'Marketing', 'marketing',
   'Grabar/editar/publicar video o post; responder comentarios/DMs; ejecutar el calendario.',
   'Guion+grabación+edición; calendario y publicación por plataforma; community; derivar al CRM la intención de compra.',
   'Producción/edición de video, copywriting de redes, diseño básico, schedulers. Blandas: creatividad, consistencia.',
   'Volumen+consistencia; engagement; leads a CRM.', 'Titular: Fiorella.', null, 21),
  ('vibe-marketing', 'Vibe Marketing / Automatización con IA', 'Marketing', 'admin',
   'Automatizar contenido/anuncios/reportes; conectar marketing↔CRM; montar un flujo con IA.',
   'Pipelines de IA; integración con Kommo; dashboards y experimentos A/B.',
   'Prompting/IA, no-code (n8n/Make), APIs, analítica. Blandas: pensamiento de sistemas, iteración.',
   '% de tareas de marketing automatizadas; costo por lead.', 'Titular: Alejandro (sombrero #1).',
   'Admin solo por config de agentes; NO es el que mueve plata (ver Operador de ERP).', 22),
  ('atencion-cliente-crm', 'Atención al Cliente / CRM', 'Comercial', 'commercial',
   'Un lead/cliente escribe, cotiza o reclama; activar recompra (día 30/45); cliente llega al local (presencial).',
   'Trabajar el embudo de Kommo; responder rápido; calificar, cotizar, dar seguimiento; escalar a operaciones; recompra.',
   'Ventas consultivas B2B, Kommo, WhatsApp Business, conocer el servicio. Blandas: empatía, rapidez, orden.',
   'Conversión lead→cliente; tiempo de 1ª respuesta; recompras activadas.',
   'Titular digital: José · presencial: Alberto.', null, 30),
  ('sourcing-compras', 'Sourcing / Compras (Proveedores)', 'Comercial', 'commercial',
   'Buscar/negociar con un proveedor; cotizar producto nuevo; pedir muestras; colocar orden a fábrica.',
   'Búsqueda de proveedores (Yiwu/1688/Alibaba); negociación; muestras; colocar y seguir órdenes; coordinar QC en origen.',
   'Sourcing/compras, negociación con fábricas, chino, producto, Incoterms. Blandas: negociación, ojo de calidad.',
   'Costo+calidad de compra; % órdenes sin incidencia.', 'Titular: José (+Sam).',
   'Los proveedores NUNCA acceden al ERP (candado permanente).', 31),
  ('inteligencia-tarifas', 'Inteligencia de Tarifas y Competencia', 'Comercial', 'commercial',
   'Actualizar una tarifa; revisar precios/ofertas de la competencia; alimentar la calculadora.',
   'Investigar/actualizar tarifas (navieras, SeaRates); monitorear competencia; alimentar /estimacion.',
   'Investigación de mercado, análisis de tarifas, freight, Excel. Blandas: rigor, síntesis.',
   'Tarifas al día; margen protegido.', 'Titular: Alberto. Las tarifas se trabajan CON Dirección.', null, 32),
  ('operador-erp', 'Operador de ERP / Data-entry & Verificación', 'Administración', 'operations',
   'Verificar un pago/monto/transacción; validar datos de cliente (KYC ligero); conciliar; cargar/corregir datos.',
   'Verificar transacciones multimoneda; validar datos de clientes (anti-fraude); conciliar; alimentar el ERP.',
   'Detalle operativo, hojas de cálculo, contabilidad básica, ERP, multimoneda. Blandas: meticulosidad, integridad.',
   '% transacciones sin error; clientes con datos completos.', 'Titular: Alejandro (sombrero #2).',
   'Candado: VERIFICA la plata pero NO la mueve, y NUNCA es admin (separación de poderes §4.5/§4.12).', 40),
  ('administracion-pmo', 'Administración / PMO', 'Administración', 'accounting',
   'Sale una tarea de una reunión; algo necesita seguimiento; pagos/proveedores/documentos admin; reportar avances.',
   'Levantar tareas y perseguir hasta cierre; administración general; verificación de pagos, nómina y cobranza.',
   'Gestión de proyectos (PMO), tareas, admin/finanzas básicas, ofimática. Blandas: seguimiento implacable, orden.',
   '% de tareas de reunión cerradas a tiempo; cero tareas perdidas.', 'Titular: Yolimar (+Sam suplente).',
   'Yolimar = accounting, NO admin (candado del doc §7).', 41),
  ('tesoreria', 'Tesorería', 'Administración', 'accounting',
   'Entra o sale dinero; pago/cobro; conversión o transferencia en USDT; operación con cambistas; transferencia intl.',
   'Manejar caja y cuentas; ejecutar pagos y cobros; USDT y cambistas; transferencias intl; cuadrar saldos.',
   'Finanzas/tesorería, control de caja, multimoneda, cambistas. Blandas: rigor, discreción, integridad.',
   'Liquidez; cero errores en transferencias; FX controlado.',
   'Titular general: Yolimar · online/intl: José.',
   '2ª firma intl/USDT = Yolimar o Sam (rompe la concentración financiera en José, §5.11).', 42),
  ('aduanas-ve', 'Gestor / Negociador de Aduanas (VE)', 'Operaciones', 'operations',
   'Un contenedor va a aduana; trámite/negociación/impuestos o incidencia de despacho; coordinar last mile.',
   'Trámites (La Guaira/Puerto Cabello); negociación con agentes; documentación DDP; impuestos; resolver incidencias.',
   'Legislación aduanera VE, clasificación arancelaria, negociación, documentación. Blandas: negociación dura, ética.',
   'Costo+tiempo de despacho; cero retenciones/multas evitables.', 'Titular: Sam (+Alberto comunicación).', null, 50),
  ('coordinacion-china', 'Dirección / Coordinación China', 'China', 'admin',
   'Cualquier tema de la operación en China: coordinar al operador externo, QC, apoyo a sourcing, incidencias en origen.',
   'Coordinar al Operador de Consolidación (externo, Candy); asegurar que la mercancía salga bien; relación y financiamiento; puente China↔VE.',
   'Logística de consolidación, QC, relación con operadores, negociación, multimoneda. Blandas: relación de largo plazo.',
   'Contenedores que salen bien y a tiempo; cero incidencias graves en origen.', 'Titular: Sam.',
   'El almacén/bodega de Yiwu es EXTERNO (Candy), no personal propio.', 51),
  ('almacen-bodega-ve', 'Almacén / Bodega Venezuela', 'Operaciones', 'warehouse',
   'Llega mercancía a la bodega VE; almacenar, organizar, verificar contra packing list o preparar entrega.',
   'Recepción en VE; almacenaje y orden; verificación contra packing list; preparación para reparto; registro en ERP.',
   'Almacén/inventario, verificación, ERP, manejo de carga. Blandas: orden, detalle físico.',
   'Exactitud de inventario en VE; mercancía lista a tiempo.', 'Titular: Javier (+Alberto recepción).', null, 60),
  ('transporte-last-mile', 'Transporte / Last Mile (VE)', 'Operaciones', 'operations',
   'Llevar la mercancía al cliente; coordinar un reparto local; contratar transporte terrestre de terceros.',
   'Entrega a clientes; coordinación de rutas; gestión de transportistas terceros; confirmación de entrega; oír quejas → CRM.',
   'Logística de reparto, conducción, zonas, coordinación con terceros. Blandas: puntualidad, trato con el cliente.',
   'Entregas a tiempo; costo de reparto; cero mercancía dañada.', 'Titular: Javier + terceros.', null, 61),
  ('reclamos-postventa', 'Gestión de Reclamos / Postventa', 'Comercial', 'accounting',
   'Cliente reclama por carga dañada/faltante, entrega tardía o error de facturación; incidencia post-entrega.',
   'Abrir el caso; enrutar al área (Bodega/Last Mile/Aduanas/Tesorería); perseguir la resolución; cerrar con el cliente; causa raíz.',
   'Gestión de casos, flujo end-to-end, comunicación de servicio. Blandas: empatía bajo presión, firmeza, orden.',
   'Tiempo de resolución; % de reclamos cerrados; recurrencia por causa.', 'Titular: Yolimar (dueña del caso).',
   'Es el corazón de la marca "confianza"; cruza varias áreas.', 62),
  ('qa-transversal', 'Control de Calidad Transversal (QA China↔VE)', 'Operaciones', 'operations',
   'El packing list de Yiwu no cuadra con lo recibido en VE; discrepancia origen↔destino; insumo de un reclamo.',
   'Conciliar packing-list-Yiwu vs recibido-VE; cerrar el loop de discrepancias; causa raíz; mejora del operador externo.',
   'Detalle operativo, conciliación, ERP. Blandas: rigor, constancia.',
   '% discrepancias detectadas y cerradas; margen protegido.', 'Titular: Javier (+Alejandro concilia, Sam cierra con China).', null, 63),
  ('tramites-visado-marca', 'Trámites (Visado / Registro de Marca)', 'Trámites', 'operations',
   'Cliente pide visado de negocios chino o registro de marca en China.',
   'Coordinar el trámite con el tercero; preparar/traducir documentos; seguimiento por hitos; vigilar el SLA.',
   'Documentación, coordinación de terceros, traducción. Blandas: seguimiento, rigor.',
   'Trámites a tiempo; SLA del tercero cumplido.', 'Titular: Sam (coord.) · ejecuta tercero.', null, 70),
  ('formacion-cursos', 'Formación (Cursos de Importación)', 'Formación', 'commercial',
   'Lanzar/dictar un curso de importación; armar el material.',
   'Contenido (academia); facilitador (tercero); campaña (Marketing); inscripciones (CRM).',
   'Contenido/academia, importación. Blandas: didáctica, consistencia.',
   'Inscripciones; conversión curso→cliente.', 'Titular: Alberto (academia).', null, 71)
) as x(slug, title, area, rbac_role, triggers, responsibilities, skills, kpi, owner_note, governance_note, sort_order) on true
where t.slug = 'dtd'
on conflict (tenant_id, slug) do nothing;
