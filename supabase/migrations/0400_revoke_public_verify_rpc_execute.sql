-- 0400_revoke_public_verify_rpc_execute.sql — SDD-0328
--
-- /verificar aplica su throttle por IP en el servidor y sólo después consulta
-- estas funciones mediante service_role. Los grants históricos a anon y
-- authenticated permitían invocarlas por Data API sin pasar por ese límite.
-- Se conserva la lógica y la compatibilidad del servidor; sólo se cierra el
-- camino directo que convertía folios y Shipping Marks secuenciales en oráculos.

revoke all on function public.academy_verify_diploma(text)
  from public, anon, authenticated;
grant execute on function public.academy_verify_diploma(text)
  to service_role;

comment on function public.academy_verify_diploma(text) is
  'Verifica un diploma para /verificar después del throttle server-side. Sólo service_role; sin acceso Data API anon/authenticated. SDD-0328.';

revoke all on function public.markbox_existe_publico(text)
  from public, anon, authenticated;
grant execute on function public.markbox_existe_publico(text)
  to service_role;

comment on function public.markbox_existe_publico(text) is
  'Resuelve Shipping Marks actuales, históricos e impresos para /verificar después del throttle server-side. Sólo service_role; sin acceso Data API anon/authenticated. SDD-0328.';
