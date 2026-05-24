import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export const metadata = { title: "Proveedores CN" };

export default function ProveedoresPage() {
  return (
    <EmptyState
      eyebrow="Próximamente · SDD futuro"
      title="Proveedores CN"
      description="Contactos WeChat, ratings y embarques históricos de cada proveedor en China."
    />
  );
}
