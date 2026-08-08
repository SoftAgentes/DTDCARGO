-- ─────────────────────────────────────────────────────────────
-- SDD-0251 · f) `confirm_payment_report` exige ROL, no sólo tenant.
--
-- EL HUECO. El mismo de (b) y (e). La función (SDD-0134 Slice B, migr 0195)
-- arranca con `if v_tenant is null then raise` — o sea que valida QUE seas del
-- equipo, no QUIÉN eres dentro de él.
--
-- La matriz dice `invoices: ["accounting"]` (lib/studio/rbac.ts:112) y la server
-- action tiene su gate (`moduleEditDenial(supabase, "invoices")` en
-- app/studio/(app)/facturacion/payment-report-actions.ts:31), pero PostgREST
-- expone la RPC directo.
--
-- QUÉ SE PODÍA HACER. Confirmar el reporte de pago de un cliente: suma el monto
-- a `invoices.paid_amount` y recomputa el `status` de la factura. Es decir,
-- **dar una factura por pagada** sin ser de contabilidad.
--
-- POR QUÉ ACÁ SÍ SIRVE EL CANDADO EN LA FUNCIÓN (y en los `void_*` no).
-- Medido el 2026-08-08: los cinco `void_*_with_audit_reason` NO son
-- `SECURITY DEFINER` — corren como invoker y quien los protege es la RLS de la
-- tabla, que es `(tenant_id = get_user_tenant_id())`, sin rol. Como
-- `authenticated` tiene UPDATE/DELETE sobre `invoices` y hermanas, ponerles un
-- candado adentro sería teatro: se esquiva con un UPDATE directo por PostgREST.
-- `confirm_payment_report` es distinta: es `SECURITY DEFINER` y su lógica
-- (bloqueo del reporte, recálculo de `paid_amount` y del `status`) no se
-- reproduce escribiendo la tabla a mano. Acá el candado sí cierra algo.
-- El agujero de la capa —RLS ciega al rol sobre 161 tablas con UPDATE para
-- `authenticated`— es otra conversación y necesita su propio SDD.
--
-- POR QUÉ NO ARRASTRA EL LÍMITE DE LA 0358. `invoices` está en la lista de
-- módulos con candado de gobernanza de la migr 0357 (no se edita desde la
-- matriz por tenant), así que la matriz BASE **es** el permiso efectivo. Acá no
-- hay override que pueda desalinearse.
--
-- EL CANDADO. `assert_studio_role(array['admin','accounting'])` de PRIMERO,
-- antes de tocar `payment_reports`. Los roles salen de la matriz + `admin`,
-- igual que en 0351 y 0358.
--
-- QUÉ NO ROMPE. Un solo llamante (la server action, con el cliente del USUARIO
-- — verificado por grep: ningún flujo interno la invoca con service_role).
-- `accounting` y `admin` pasan igual que siempre. El cuerpo se copió TEXTUAL de
-- la migr 0195: el diff contra ella son las 6 líneas del candado y nada más.
-- ─────────────────────────────────────────────────────────────

create or replace function public.confirm_payment_report(
  p_report_id uuid,
  p_action    payment_report_status,   -- 'confirmado' | 'rechazado'
  p_note      text default null
) returns public.payment_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_rep    public.payment_reports;
  v_inv    public.invoices;
  v_new_paid numeric(14,2);
  v_new_status invoice_status;
begin

  -- ── EL CANDADO NUEVO (SDD-0251 f) ────────────────────────────────────────
  -- De primero, antes de mirar el reporte: sin permiso no se puede usar el
  -- 'reporte no encontrado' como oráculo para sondear ids ajenos.
  perform public.assert_studio_role(array['admin', 'accounting']);

  if v_tenant is null then
    raise exception 'no autorizado: solo el equipo puede confirmar/rechazar reportes'
      using errcode = 'insufficient_privilege';
  end if;
  if p_action not in ('confirmado', 'rechazado') then
    raise exception 'acción inválida: %', p_action using errcode = 'check_violation';
  end if;

  -- Bloquea el reporte (evita doble confirmación concurrente).
  select * into v_rep
  from public.payment_reports
  where id = p_report_id and tenant_id = v_tenant and deleted_at is null
  for update;

  if v_rep.id is null then
    raise exception 'reporte no encontrado o ajeno al tenant' using errcode = 'no_data_found';
  end if;
  if v_rep.status <> 'reportado' then
    raise exception 'el reporte ya fue % (no se puede volver a procesar)', v_rep.status
      using errcode = 'check_violation';
  end if;

  if p_action = 'confirmado' then
    -- Bloquea la factura y suma el monto reportado al acumulador de pagado.
    select * into v_inv
    from public.invoices
    where id = v_rep.invoice_id and tenant_id = v_tenant and deleted_at is null
    for update;

    if v_inv.id is null then
      raise exception 'la factura del reporte ya no existe' using errcode = 'no_data_found';
    end if;

    v_new_paid := round((coalesce(v_inv.paid_amount, 0) + v_rep.amount)::numeric, 2);

    -- Recompute del status visible (no toca borrador/anulada). pagada si cubre el
    -- total; parcial si hay algo pagado; si no, se queda como estaba.
    v_new_status := v_inv.status;
    if v_inv.status in ('emitida', 'parcial', 'vencida') then
      if v_new_paid >= v_inv.total_amount then
        v_new_status := 'pagada';
      elsif v_new_paid > 0 then
        v_new_status := 'parcial';
      end if;
    end if;

    update public.invoices
    set paid_amount     = v_new_paid,
        last_payment_at = now(),
        status          = v_new_status
    where id = v_inv.id;
  end if;

  update public.payment_reports
  set status       = p_action,
      note         = coalesce(p_note, note),
      confirmed_by = auth.uid(),
      confirmed_at = now()
  where id = v_rep.id
  returning * into v_rep;

  return v_rep;
end;
$$;

comment on function public.confirm_payment_report(uuid, payment_report_status, text) is
  'SDD-0134 Slice B · confirma o rechaza el reporte de pago del cliente. SDD-0251 f): exige rol de la matriz `invoices` (+admin) vía assert_studio_role, porque antes sólo validaba que el llamante tuviera tenant.';

revoke all on function public.confirm_payment_report(uuid, payment_report_status, text) from public, anon;
grant execute on function public.confirm_payment_report(uuid, payment_report_status, text) to authenticated, service_role;
