import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Usuarios" };

export default function UsuariosPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD-0024"
      title="Usuarios"
      description="Roles, permisos por módulo, scope por almacén y 2FA."
    />
  );
}
