/** Sólo fixture local: componente real, direcciones ficticias, sin sesión. */
import { createRoot } from "react-dom/client";
import { PortalAddresses } from "../../app/portal/(app)/perfil/PortalAddresses";
import type { ClientDeliveryAddress } from "../../lib/studio/client-address-types";

const addresses: ClientDeliveryAddress[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: "33333333-3333-4333-8333-333333333333",
    label: "Casa de prueba",
    line: "Dirección ficticia A, edificio de prueba, piso 2, oficina de recepción",
    city: "Valencia",
    citySlug: null,
    state: "Carabobo",
    reference: "Referencia ficticia para verificar el ajuste de texto en móvil",
    isDefault: false,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    clientId: "33333333-3333-4333-8333-333333333333",
    label: "Oficina de prueba",
    line: "Dirección ficticia B, local de prueba 2",
    city: "Valencia",
    citySlug: null,
    state: "Carabobo",
    reference: null,
    isDefault: false,
  },
];

createRoot(document.getElementById("root")!).render(
  <div
    className="portal-sys"
    style={{ "--font-nunito": "system-ui", "--font-sora": "system-ui" } as React.CSSProperties}
  >
    <div data-portal-theme="dark" className="min-h-screen bg-paper text-ink">
      <main className="max-w-[800px] mx-auto p-4 sm:p-8">
        <h1 className="text-xl font-bold mb-3">Prueba local de direcciones</h1>
        <p className="text-sm text-grey-700 mb-6">
          Datos ficticios. Sin sesión, sin Cloud y sin borrar registros reales.
        </p>
        {/* Mismas clases de la card de direcciones en perfil/page.tsx. */}
        <section className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
          <PortalAddresses addresses={addresses} framed={false} />
        </section>
      </main>
    </div>
  </div>,
);
