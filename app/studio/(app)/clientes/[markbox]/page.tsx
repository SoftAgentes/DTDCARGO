/**
 * Detalle de cliente — datos + histórico de envíos.
 *
 * SDD-0010. Server component lee cliente + shipments via lookup textual
 * (sin FK constraint). El botón "Editar" se maneja en ClientDetailClient.
 *
 * SDD-0558: la cabecera de cuenta (`ClientAccountHeader`) muestra saldo
 * abierto, vencido, último pago y embarques en curso, con la definición única
 * del saldo (`client_outstanding`, migración 0492). La ve todo el que ve
 * clientes (decisión 14 de Sam, `puedeVerSaldoCliente`); el botón «Estado de
 * cuenta», solo finanzas (`puedeVerEstadoDeCuenta`).
 *
 * SDD-0669: solo presentación. Franja fija (identidad y acciones), avisos,
 * pestañas Resumen · Envíos · Documentos · Configuración y las conversaciones a
 * la derecha. Lee lo mismo que antes, con las mismas condiciones: cada tarjeta
 * conserva quién la ve.
 */

import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { markboxVigenteDeCodigoViejo } from "@/lib/studio/client-codigo-viejo";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getClientByMarkbox,
  listCodigosDeLaFicha,
  listShipmentsDeLaFicha,
  getClientPortalAccess,
  getClientPortalApprovedAt,
  getClientAccountState,
} from "@/lib/studio/client-queries";
import { puedeVerEstadoDeCuenta, puedeVerSaldoCliente } from "@/lib/studio/client-account";
import { listTenantAdvisors } from "@/lib/studio/user-queries";
import {
  clientCompleteness,
  docKindLabel,
  tierBadgeTone,
  tierLabel,
} from "@/lib/studio/client-types";
import {
  SERVICE_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";
import { isAutoVerifyEnabled } from "@/lib/studio/identity";
import {
  accionesRapidas,
  codigosConCaida,
  ENVIOS_EN_RESUMEN,
  nombreDeLaFicha,
} from "@/lib/studio/ficha-cliente";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import { ClientDetailClient } from "../_components/ClientDetailClient";
import { ClientAccountHeader } from "../_components/ClientAccountHeader";
import { PortalAccessCard } from "../_components/PortalAccessCard";
import { AdvisorAssignCard } from "../_components/AdvisorAssignCard";
import { AliadoCard } from "../_components/AliadoCard";
import { ShippingMarkChip } from "../_components/ShippingMarkChip";
import { getAliadoByClientId, listAliadoOptions } from "@/lib/studio/aliados/aliado-queries";
import { listPriceBooks } from "@/lib/studio/price-books/price-book-queries";
import type { PriceBookOption } from "@/lib/studio/price-books/price-book-types";
import { listMarkboxHistory } from "@/lib/studio/markbox-history-queries";
import type { MarkboxHistoryEntry } from "@/lib/studio/markbox-history-types";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule, canEditModule } from "@/lib/studio/rbac";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { isModuleEnabled } from "@/lib/studio/feature-flags-types";
import { listConversacionesDeCliente, type ConversacionDeCliente } from "@/lib/studio/chatwoot/conversations-queries";
import { ConversacionesFichaCargando } from "../_components/ConversacionesFichaCard";
import { PanelConversacionesFicha } from "../_components/PanelConversacionesFicha";
import { readCanSeeClientNames } from "@/lib/studio/privacidad-cn";
import { DeliveryAddressesCard } from "../_components/DeliveryAddressesCard";
import { IdentityVerificationCard } from "../_components/IdentityVerificationCard";
import { ClientBillingCard, type ClientBillingIdentityRow } from "../_components/ClientBillingCard";
import { listClientDeliveryAddresses } from "@/lib/studio/client-address-queries";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";
import {
  getPublicCalculatorCities,
  getPublicCarrierTariffs,
  combinarDestinos,
} from "@/lib/public/rates-queries";
import { DocsPanel } from "@/app/studio/_components/documents/DocsPanel";
import { listDocumentsByEntity } from "@/lib/studio/documents/queries";
import { listarAdjuntosDelCliente } from "@/lib/studio/documents/adjuntos-queries";
import { textoAdjuntos } from "@/lib/studio/documents/adjuntos";
import { TodosLosAdjuntos } from "../_components/TodosLosAdjuntos";
import {
  getOpenChangeRequest,
  listResolvedChangeRequests,
  resolveReviewerNames,
} from "@/lib/portal/change-request-queries";
import type { ClientChangeRequest } from "@/lib/portal/change-request-types";
import { ChangeRequestCard } from "../_components/ChangeRequestCard";
import { ChangeRequestHistory } from "../_components/ChangeRequestHistory";
import { EnlacePestana, FichaPestanas } from "../_components/FichaPestanas";
import { NotaDeLaFicha } from "../_components/NotaDeLaFicha";

export const metadata = { title: "Detalle cliente" };

type ShipmentRow = {
  id: string;
  code: string;
  origin: string | null;
  destination: string | null;
  shipment_service: ShipmentService;
  status: ShipmentStatus;
  created_at: string;
  client_markbox: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ markbox: string }>;
}) {
  const { markbox } = await params;
  const supabase = await createClient();

  const client = await getClientByMarkbox(supabase, markbox);
  if (!client) {
    // SDD-0664 · un Shipping Mark anterior (renombrado o fusión) lleva a la
    // ficha vigente en vez de a un 404.
    let vigente: string | null = null;
    try {
      vigente = await markboxVigenteDeCodigoViejo(supabase, decodeURIComponent(markbox));
    } catch {
      vigente = null;
    }
    if (vigente && vigente !== markbox) {
      redirect(`/studio/clientes/${encodeURIComponent(vigente)}`);
    }
    notFound();
  }

  const portalAccess = await getClientPortalAccess(supabase, client.id);
  const portalApprovedAt = await getClientPortalApprovedAt(supabase, client.id);

  // Asesores asignables (ERP→Norte · clients.advisor_id). El listado de miembros
  // del tenant se resuelve con el admin client (la RLS de user_tenants tapa a los
  // no-admin más allá de su propia fila), scopeado por el tenant del usuario.
  const { data: tenantLink } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const advisors = tenantLink?.tenant_id
    ? await listTenantAdvisors(createAdminClient(), tenantLink.tenant_id)
    : [];

  // Aliados white-label (SDD-0255). `aliado` es la ficha de aliado que cuelga de
  // ESTE cliente (null si todavía no lo es); `aliadoOptions` son todos los del
  // tenant, y hacen falta para elegir aliado padre y para componer la cadena de
  // prefijos sin pagar un RPC por fila.
  const [aliado, aliadoOptions, studioAccess] = await Promise.all([
    getAliadoByClientId(supabase, client.id),
    listAliadoOptions(supabase),
    getStudioAccess(supabase),
  ]);
  const studioRole = studioAccess.role;
  const puedeEditarClientes = canEditModule(studioRole, "clients");

  // Su lista de precios (SDD-0269). Best-effort igual que el histórico de
  // Shipping Marks: si la migr 0382 todavía no está aplicada, la ficha muestra
  // "cotiza con la de la casa" en vez de caerse entera.
  let priceBook: PriceBookOption | null = null;
  if (aliado) {
    try {
      const books = await listPriceBooks(supabase);
      priceBook = books.find((b) => b.aliadoId === aliado.id) ?? null;
    } catch {
      priceBook = null;
    }
  }

  // Shipping Marks que este cliente TUVO (SDD-0258). Best-effort igual que las
  // direcciones: si la migr 0367 no está aplicada, degradamos a lista vacía en
  // vez de tumbar la ficha entera.
  let markboxHistory: MarkboxHistoryEntry[] = [];
  try {
    markboxHistory = await listMarkboxHistory(supabase, client.id);
  } catch {
    markboxHistory = [];
  }

  // SDD-0650 F1: los embarques salen de TODOS los códigos de la ficha (vigente,
  // historial y fichas fusionadas), como el saldo de la 0492. Si la cadena de
  // códigos no se puede leer, cae al vigente: la ficha muestra lo de siempre en
  // vez de caerse. El listado de embarques lanza igual que antes.
  const codigosFicha = await codigosConCaida(
    () => listCodigosDeLaFicha(supabase, client, markboxHistory.map((h) => h.markbox)),
    client.markbox,
  );
  const shipments = (await listShipmentsDeLaFicha(supabase, client.tenant_id, codigosFicha)) as ShipmentRow[];
  const embarquesConCodigoAnterior = shipments.filter((s) => s.client_markbox !== client.markbox).length;

  // SDD-0558: la cuenta del cliente. No lanza: sin permiso no pide el saldo,
  // y si el cálculo falla la cabecera lo dice con una referencia (ERR-01).
  const cuentaCliente = await getClientAccountState(supabase, client, {
    puedeVerSaldo: puedeVerSaldoCliente(studioRole, studioAccess.overrides, studioAccess.grants),
    codigosConocidos: markboxHistory.map((h) => h.markbox),
  });
  const puedeAbrirEstadoDeCuenta = puedeVerEstadoDeCuenta(studioRole);

  // SDD-0487: empresa o datos personales que el cliente cargó para facturar.
  // RLS de 0466: sólo accounting, admin y commercial la leen. Sin 0466 o sin
  // permiso, no hay tarjeta.
  let billingIdentity: ClientBillingIdentityRow | null = null;
  try {
    const { data, error } = await supabase
      .from("client_billing_identities")
      .select("kind, legal_name, doc, fiscal_address, is_billing_default")
      .eq("client_id", client.id)
      .maybeSingle<ClientBillingIdentityRow>();
    billingIdentity = error ? null : data ?? null;
  } catch {
    billingIdentity = null;
  }

  // SDD-0585 E2-D23: conversaciones de Chatwoot de ESTE cliente. El client_id
  // solo existe si el teléfono del contacto cruzó con un único cliente (0504):
  // un cruce ambiguo no aparece acá. Solo con acceso a la Bandeja y el flag
  // encendido; sin 0504 o con error, no hay tarjeta.
  let conversacionesChatwoot: ConversacionDeCliente[] | null = null;
  if (tenantLink?.tenant_id && canAccessModule(studioRole, "bandeja", studioAccess.overrides, studioAccess.grants)) {
    try {
      if (isModuleEnabled("bandeja", await listFeatureFlags(supabase))) {
        conversacionesChatwoot = await listConversacionesDeCliente(supabase, tenantLink.tenant_id, client.id);
      }
    } catch {
      conversacionesChatwoot = null;
    }
  }

  // Documentos del DMS genérico (SDD-0049) adjuntos a este cliente — KYC, RIF,
  // contratos, poderes. Coexiste con shipment_documents.
  const dmsDocuments = await listDocumentsByEntity(supabase, "client", client.id);

  // SDD-0507: «Todos los adjuntos» — los de la ficha y los de sus embarques
  // vivos, con la misma definición que el conteo del listado. `null` si no se
  // pudo leer: la sección lo dice.
  const todosLosAdjuntos = await listarAdjuntosDelCliente(supabase, {
    id: client.id,
    markbox: client.markbox,
  });

  // Direcciones de entrega (SDD-0138 Slice B). Best-effort: si la migración 0198
  // todavía no está aplicada, la query falla → degradamos a lista vacía sin romper.
  let deliveryAddresses: ClientDeliveryAddress[] = [];
  try {
    deliveryAddresses = await listClientDeliveryAddresses(supabase, client.id);
  } catch {
    deliveryAddresses = [];
  }
  // Slice C: catálogo de ciudades CON su precio de entrega, para mostrar cómo se
  // cobra el tramo nacional de cada dirección.
  //
  // El cruce con el tarifario es lo que hace útil a la card: `calculator_cities`
  // sola no trae precio, así que sin esto TODAS las direcciones decían "la
  // cotiza un asesor" — incluidas las 169 que sí tienen tarifa. Se usa el mismo
  // `combinarDestinos` que la calculadora pública para que el asesor y el
  // cliente vean exactamente el mismo número (la DB manda en el precio, el
  // código manda en la cobertura). Ninguna de las dos tira: sin data, la card
  // simplemente no muestra estimado.
  const [calcCities, calcTariffs] = await Promise.all([
    getPublicCalculatorCities(),
    getPublicCarrierTariffs(),
  ]);
  const calcDestinos = combinarDestinos(calcCities, calcTariffs);

  // SDD-0046: la verificación de identidad aplica a clientes self-registrados
  // o con foto de documento. El badge es advisory — nunca bloquea al cliente.
  // SDD-0131: además de portal/foto, mostramos la card en cualquier cliente que
  // ya tenga documento (el alta interna ahora fija doc_kind → se puede rutear la
  // verificación y ofrecer el piso manual). El badge sigue siendo advisory.
  const hasDocument = client.rif != null && client.rif.trim() !== "";
  const showIdentityCard =
    client.registration_channel === "portal" ||
    client.cedula_photo_path != null ||
    hasDocument;

  // SDD-0131: completitud del perfil — checklist derivado de qué falta para
  // tener el cliente listo para operar/analizar.
  const completeness = clientCompleteness(client);

  // SDD-0151: solicitud de cambio de datos pendiente (la propuso el cliente
  // desde el portal). Best-effort: sin migración 0220 → null, sin romper.
  let changeRequest: ClientChangeRequest | null = null;
  let changeRequestHistory: ClientChangeRequest[] = [];
  let reviewerNames: Record<string, string> = {};
  try {
    changeRequest = await getOpenChangeRequest(supabase, client.id);
    changeRequestHistory = await listResolvedChangeRequests(supabase, client.id);
    reviewerNames = await resolveReviewerNames(
      supabase,
      changeRequestHistory.map((r) => r.reviewedBy),
    );
  } catch {
    changeRequest = null;
    changeRequestHistory = [];
    reviewerNames = {};
  }

  // Signed URL (60s) de la foto de cédula/RIF (bucket privado client-docs). La RLS
  // de storage deja al admin del tenant leerla. Si no hay foto o el sign falla → null.
  let identityPhotoUrl: string | null = null;
  if (showIdentityCard && client.cedula_photo_path) {
    const { data: signed } = await supabase.storage
      .from("client-docs")
      .createSignedUrl(client.cedula_photo_path, 60);
    identityPhotoUrl = signed?.signedUrl ?? null;
  }

  // SDD-0046 (V1 manual-only): la verificación AUTO solo se habilita si hay un
  // provider wired (CNE vía IDENTITY_CNE_URL; SENIAT no construido). Si no, la
  // card oculta el botón auto y deja prominente el piso manual — no ofrecemos un
  // botón que siempre falla.
  const autoVerifyEnabled = showIdentityCard
    ? isAutoVerifyEnabled(client.doc_kind)
    : false;

  // SDD-0650 F1: acciones rápidas de la cabecera. Cada una aparece solo si el
  // rol abre el módulo de destino: un botón que rebota no es una acción.
  // Sin Bandeja, `conversacionesChatwoot` es null y no hay «Abrir chat».
  const { cotizacionesHref, chatHref } = accionesRapidas({
    markbox: client.markbox,
    puedeVerCotizaciones: canAccessModule(studioRole, "quotes", studioAccess.overrides, studioAccess.grants),
    conversaciones: conversacionesChatwoot,
  });
  // Fichas que vinieron del sistema anterior o de Kommo sin nombre (SDD-0650 §F1).
  const nombreFicha = nombreDeLaFicha(client.name);
  const sinNombre = nombreFicha.sinNombre;
  // SDD-0650 F2 · SDD-0531: el texto de los mensajes y el «Nombre en el chat» solo
  // salen del servidor si el usuario puede ver datos de clientes. Solo se pregunta
  // con panel: sin Bandeja no se lee nada de Chatwoot.
  const puedeVerDatosDelChat = conversacionesChatwoot ? await readCanSeeClientNames(supabase) : false;

  // SDD-0669: el asesor en la franja es el mismo nombre que enseña
  // `AdvisorAssignCard` a quien abre la ficha; se cambia en Configuración.
  const asesor = client.advisor_id ? advisors.find((a) => a.userId === client.advisor_id) ?? null : null;
  const totalAdjuntos = todosLosAdjuntos !== null ? todosLosAdjuntos.total : null;

  // SDD-0669: las cuatro pestañas existen para todo el que abre la ficha; dentro
  // de cada una, cada tarjeta conserva su condición de antes. La URL solo elige
  // entre las pestañas que llegan a `FichaPestanas` (`pestanaDeLaFicha`).
  // Con Bandeja, las conversaciones van en su columna, fuera de las pestañas.
  const conPanel = Boolean(conversacionesChatwoot && tenantLink?.tenant_id);

  const encabezado = (
    <>
      {/* SDD-0258: el Shipping Mark es la IDENTIDAD del cliente. El historial
          cuelga de acá y no ocupa nada cuando está vacío. */}
      <ShippingMarkChip
        clientId={client.id}
        markbox={client.markbox}
        historial={markboxHistory}
        canEdit={puedeEditarClientes}
      />
      <h1
        className="studio-display"
        style={{
          fontSize: 26,
          margin: 0,
          color: sinNombre ? "var(--ink-soft)" : "var(--ink)",
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        {nombreFicha.texto}
      </h1>
      {client.doc_kind && (
        <Badge tone="neutral" size="md">
          {docKindLabel(client.doc_kind)}
        </Badge>
      )}
      <Badge tone={tierBadgeTone(client.tier)} size="md">
        {tierLabel(client.tier)}
      </Badge>
      <span
        style={{
          font: "500 12px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          whiteSpace: "nowrap",
        }}
      >
        Asesor:{" "}
        <b style={{ color: asesor ? "var(--ink)" : "var(--ink-soft)", fontWeight: 700 }}>
          {asesor ? asesor.name ?? "Sin nombre" : "Sin asignar"}
        </b>
      </span>
      {/* SDD-0507: el total, a la vista. SDD-0669: lleva a la pestaña Documentos. */}
      {totalAdjuntos !== null && totalAdjuntos > 0 && (
        <EnlacePestana
          pestana="documentos"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-2)",
            minHeight: 32,
            padding: "0 var(--s-3)",
            borderRadius: "var(--r-pill)",
            border: "1px solid var(--border-strong)",
            background: "var(--bg-surface)",
            color: "var(--ink)",
            font: "700 12px/1 var(--f-sans)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true" style={{ display: "inline-flex" }}>
            {Icon.doc(14)}
          </span>
          {textoAdjuntos(totalAdjuntos)} · ver todos
        </EnlacePestana>
      )}
    </>
  );

  const resumen = (
    <div className="studio-ficha-resumen">
      {/* Card datos */}
      <section style={TARJETA}>
        <div className="studio-eyebrow" style={{ marginBottom: 14 }}>
          Datos del cliente
        </div>
        <DataRow label="Tipo" value={docKindLabel(client.doc_kind)} mono={false} />
        {client.doc_kind === "empresa" && (
          <DataRow label="Contacto" value={client.contact_name} mono={false} />
        )}
        <DataRow label="Email" value={client.email} mono={false} />
        <DataRow label="Teléfono" value={client.phone} mono />
        <DataRow label="Dirección" value={client.address} mono={false} />
        <DataRow
          label={client.doc_kind === "empresa" ? "RIF" : "Cédula"}
          value={client.rif}
          mono
        />
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Creado {formatDate(client.created_at)}
        </div>
      </section>

      <PerfilDelCliente completeness={completeness} />

      <div className="studio-ficha-resumen-ancho">
        <HistorialEnvios
          shipments={shipments}
          markbox={client.markbox}
          conCodigoAnterior={embarquesConCodigoAnterior}
          limite={ENVIOS_EN_RESUMEN}
        />
      </div>
    </div>
  );

  const envios = (
    <HistorialEnvios
      shipments={shipments}
      markbox={client.markbox}
      conCodigoAnterior={embarquesConCodigoAnterior}
    />
  );

  // SDD-0669: un solo bloque de documentos. Los de la ficha (con subir,
  // versiones y borrar) y, debajo, los de sus embarques, sin repetir.
  const documentos = (
    <div className="studio-ficha-col">
      <section style={TARJETA}>
        <DocsPanel
          entityType="client"
          entityId={client.id}
          documents={dmsDocuments}
          title="Documentos de la ficha"
          formularioPlegado
        />
      </section>
      <TodosLosAdjuntos datos={todosLosAdjuntos} soloEmbarques />
    </div>
  );

  const configuracion = (
    <div className="studio-ficha-configuracion">
      <PortalAccessCard
        clientId={client.id}
        markbox={client.markbox}
        email={client.email}
        access={portalAccess}
        approvedAt={portalApprovedAt}
        canEdit={puedeEditarClientes}
      />

      <AdvisorAssignCard
        clientId={client.id}
        markbox={client.markbox}
        currentAdvisorId={client.advisor_id}
        advisors={advisors}
      />

      <AliadoCard
        clientId={client.id}
        clientName={client.name}
        markbox={client.markbox}
        aliado={aliado}
        aliados={aliadoOptions}
        priceBook={priceBook}
        canEdit={puedeEditarClientes}
      />

      <DeliveryAddressesCard
        clientId={client.id}
        markbox={client.markbox}
        addresses={deliveryAddresses}
        cities={calcDestinos.map((c) => ({
          id: c.id,
          label: c.label,
          km: c.km,
          casco: c.casco,
          ventaCbm: c.ventaCbm,
        }))}
      />

      {showIdentityCard && (
        <IdentityVerificationCard
          clientId={client.id}
          markbox={client.markbox}
          name={client.name}
          docKind={client.doc_kind}
          rif={client.rif}
          docVerifyStatus={client.doc_verify_status}
          docVerifySource={client.doc_verify_source}
          docRegistryName={client.doc_registry_name}
          docVerifiedAt={client.doc_verified_at}
          photoUrl={identityPhotoUrl}
          autoEnabled={autoVerifyEnabled}
        />
      )}

      {billingIdentity ? (
        <ClientBillingCard principalKind={client.doc_kind} identity={billingIdentity} />
      ) : null}

      {/* Historial de solicitudes ya resueltas (SDD-0151) — traza read-only.
          Se auto-oculta si no hay ninguna. */}
      <ChangeRequestHistory
        items={changeRequestHistory}
        isEmpresa={client.doc_kind === "empresa"}
        reviewerNames={reviewerNames}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 1440 }}>
      <Link
        href="/studio/clientes"
        style={{
          font: "500 12px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 14 }}>←</span> Volver al listado
      </Link>

      <ClientDetailClient
        client={client}
        canViewStatement={puedeAbrirEstadoDeCuenta}
        quotesHref={cotizacionesHref}
        chatHref={chatHref}
        encabezado={encabezado}
      >
        {/* SDD-0558: saldo, vencido, último pago y embarques en curso. */}
        <ClientAccountHeader estado={cuentaCliente} canViewStatement={puedeAbrirEstadoDeCuenta} />

        {/* SDD-0669: avisos arriba de las pestañas, a la vista en todas. La
            solicitud de cambio (SDD-0151) es lo único que espera una acción del
            asesor; la nota es la misma que antes iba en «Datos del cliente». */}
        {(changeRequest || client.notes) && (
          <div className="studio-ficha-avisos">
            {changeRequest && (
              <ChangeRequestCard
                req={changeRequest}
                markbox={client.markbox}
                isEmpresa={client.doc_kind === "empresa"}
              />
            )}
            {client.notes ? <NotaDeLaFicha nota={client.notes} /> : null}
          </div>
        )}

        {/* SDD-0669: pestañas a la izquierda; conversaciones a la derecha, en
            todas las pestañas. Sin acceso a la Bandeja no hay columna. */}
        <div className={conPanel ? "studio-ficha-cuerpo" : "studio-ficha-cuerpo studio-ficha-cuerpo--sin-panel"}>
          <div className="studio-ficha-principal">
            <FichaPestanas
              pestanas={[
                { id: "resumen", etiqueta: "Resumen", contenido: resumen },
                { id: "envios", etiqueta: "Envíos", n: shipments.length, contenido: envios },
                { id: "documentos", etiqueta: "Documentos", n: totalAdjuntos, contenido: documentos },
                { id: "configuracion", etiqueta: "Configuración", contenido: configuracion },
              ]}
            />
          </div>

          {/* SDD-0650 F2: lectura en vivo de los chats unidos, aparte (Suspense);
              apagada o sin uniones, la tarjeta de la F1. */}
          {conversacionesChatwoot && tenantLink?.tenant_id ? (
            <aside className="studio-ficha-conversaciones" aria-label="Conversaciones">
              <Suspense fallback={<ConversacionesFichaCargando />}>
                <PanelConversacionesFicha
                  supabase={supabase}
                  tenantId={tenantLink.tenant_id}
                  clientId={client.id}
                  markbox={client.markbox}
                  acceso={{ role: studioRole, overrides: studioAccess.overrides, grants: studioAccess.grants }}
                  puedeVerDatos={puedeVerDatosDelChat}
                  fichaSinNombre={sinNombre}
                  conversacionesF1={conversacionesChatwoot}
                />
              </Suspense>
            </aside>
          ) : null}
        </div>
      </ClientDetailClient>
    </div>
  );
}

const TARJETA = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: 20,
} as const;

/** Perfil del cliente · qué falta para completar (SDD-0131). */
function PerfilDelCliente({ completeness }: { completeness: ReturnType<typeof clientCompleteness> }) {
  return (
    <section style={TARJETA}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span className="studio-eyebrow">Perfil del cliente</span>
        <Badge tone={completeness.isComplete ? "success" : "warning"} size="md">
          {completeness.isComplete ? "Completo" : `${completeness.doneCount}/${completeness.total}`}
        </Badge>
      </div>

      {/* Barra de progreso */}
      <div
        aria-hidden
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--bg-elevated)",
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${completeness.pct}%`,
            height: "100%",
            background: completeness.isComplete ? "var(--success)" : "var(--ink)",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {completeness.items.map((item) => (
          <div
            key={item.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 0",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 16,
                height: 16,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 999,
                color: item.done ? "var(--ink-inv)" : "var(--ink-mute)",
                background: item.done ? "var(--success)" : "transparent",
                border: item.done ? "none" : "1px solid var(--border)",
              }}
            >
              {item.done ? Icon.check(10) : null}
            </span>
            <span
              style={{
                font: item.done ? "500 13px/1.4 var(--f-sans)" : "600 13px/1.4 var(--f-sans)",
                color: item.done ? "var(--ink-soft)" : "var(--ink)",
              }}
            >
              {/* Estado accesible: el ✓/borde es aria-hidden; el lector lee
                  "completo"/"falta" para no depender solo de color/forma. */}
              <span
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0 0 0 0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              >
                {item.done ? "Completo: " : "Falta: "}
              </span>
              {item.label}
            </span>
            {!item.done && (
              <span
                style={{
                  marginLeft: "auto",
                  font: "600 10.5px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Falta
              </span>
            )}
          </div>
        ))}
      </div>

      <p
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "var(--s-3) 0 0",
        }}
      >
        {completeness.isComplete
          ? "El perfil tiene todos los datos para operar."
          : "Usa «Editar» para completar los datos que faltan; la foto y la verificación se cargan en sus paneles."}
      </p>
    </section>
  );
}

/**
 * Historial de envíos de todos los códigos de la ficha (SDD-0650 F1). Con
 * `limite` (el Resumen, SDD-0669) muestra los primeros y enlaza a la pestaña
 * Envíos.
 */
function HistorialEnvios({
  shipments,
  markbox,
  conCodigoAnterior,
  limite,
}: {
  shipments: ShipmentRow[];
  markbox: string;
  conCodigoAnterior: number;
  limite?: number;
}) {
  const lista = limite ? shipments.slice(0, limite) : shipments;
  const recortada = lista.length < shipments.length;
  return (
    <section style={TARJETA}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--s-3)",
          marginBottom: 14,
        }}
      >
        <span className="studio-eyebrow">{limite ? "Últimos envíos" : "Historial de envíos"}</span>
        <span
          style={{
            font: "500 12px/1 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {recortada
            ? `${lista.length} de ${shipments.length} envíos`
            : `${shipments.length} ${shipments.length === 1 ? "envío" : "envíos"}`}
        </span>
      </div>
      {!limite && conCodigoAnterior > 0 && (
        <p
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 var(--s-3)",
          }}
        >
          Incluye {conCodigoAnterior === 1 ? "1 envío" : `${conCodigoAnterior} envíos`} con un código
          anterior o de una ficha fusionada.
        </p>
      )}

      {shipments.length === 0 ? (
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            padding: "var(--s-5) 0",
            textAlign: "center",
          }}
        >
          Sin envíos registrados con los códigos de esta ficha todavía.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {lista.map((s, i) => (
            <Link
              key={s.id}
              href={`/studio/tracking/${s.id}`}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 120px 100px",
                gap: 10,
                padding: "var(--s-3) var(--s-2)",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-1)",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    font: "700 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                  }}
                >
                  {s.code}
                </span>
                {/* SDD-0650 F1: llegó con otro código de la ficha. */}
                {s.client_markbox !== markbox && (
                  <span
                    title="Código anterior o de una ficha fusionada"
                    style={{
                      font: "500 10.5px/1.2 var(--f-mono)",
                      color: "var(--ink-soft)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    con {s.client_markbox}
                  </span>
                )}
              </span>
              <div
                style={{
                  font: "500 12px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {s.origin ?? "?"} → {s.destination ?? "?"}
              </div>
              <span
                style={{
                  font: "600 11px/1 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {SERVICE_LABELS[s.shipment_service].primary}
              </span>
              <span
                style={{
                  font: "500 11px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {formatDate(s.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {recortada && (
        <div style={{ marginTop: "var(--s-3)" }}>
          <EnlacePestana pestana="envios" className="studio-btn studio-btn-ghost studio-btn-sm">
            Ver los {shipments.length} envíos
          </EnlacePestana>
        </div>
      )}
    </section>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: 10,
        padding: "var(--s-2) 0",
        borderBottom: "1px solid var(--border)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          font: "600 10.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: mono
            ? "500 13px/1.3 var(--f-mono)"
            : "500 13px/1.4 var(--f-sans)",
          color: value ? "var(--ink)" : "var(--ink-mute)",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
