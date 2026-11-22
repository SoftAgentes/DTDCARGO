/**
 * Administración · /studio/admin (SDD-0708).
 *
 * Pinta en línea las secciones que viven en esta página, elegidas por
 * `?section=`. El encabezado y el menú lateral los pone `layout.tsx`, que
 * acompaña también a las subrutas (`/studio/admin/ia`, `/rutas`, …).
 *
 * Las secciones con ruta propia no se pintan aquí: `?section=<id>` redirige a
 * su `href` (enlaces viejos siguen funcionando) y el menú enlaza directo. La
 * tarjeta puente «Abrir X →» se retiró (SDD-0708): era un clic de más.
 * El catálogo vive en `_components/admin-sections.ts`.
 */

import { requireModuleView } from "@/lib/studio/rbac-guard";
import { canSpecial } from "@/lib/studio/rbac";
import { createClient } from "@/lib/db/server";
import { listContainerTypes } from "@/lib/studio/naviera/queries";
import type { ContainerType } from "@/lib/studio/naviera/types";
import { getCompanyData } from "@/lib/studio/company-queries";
import { CompanySection } from "./_components/CompanySection";
import { AppearanceSection } from "./_components/AppearanceSection";
import { NumberingSection } from "./_components/NumberingSection";
import { AuditLogSection } from "./_components/AuditLogSection";
import { MasterDataSection } from "./_components/MasterDataSection";
import { ExchangeRatesSection } from "./_components/ExchangeRatesSection";
import { CalendarSection } from "./_components/CalendarSection";
import { ApiIntegrationSection } from "./_components/ApiIntegrationSection";
import { ImportExportSection } from "./_components/ImportExportSection";
import { CalculatorSection } from "./_components/calculator/CalculatorSection";
import { RecepcionAddonsSection } from "./_components/RecepcionAddonsSection";
import { listPrealertaAddonsConfig } from "@/lib/studio/prealertas/queries";
import { PortalBackfillSection } from "./_components/PortalBackfillSection";
import {
  listPortalInviteCandidates,
  getPortalAdoptionStats,
  listPortalColdInvitees,
  listPortalContactlessClients,
  type PortalInviteCandidate,
  type PortalAdoptionStats,
  type PortalColdInvitee,
  type PortalContactlessClient,
} from "@/lib/studio/client-queries";
import type { PrealertaAddon } from "@/lib/studio/prealertas/addons";
import { getNumberingOverview } from "@/lib/studio/numbering-queries";
import {
  listGovernedAuditEvents,
  parseAuditFilters,
  type AuditSearchParams,
} from "@/lib/studio/audit-queries";
import { getExchangeRatesOverview } from "@/lib/studio/exchange-rates-queries";
import { getOperationalCalendar } from "@/lib/studio/op-calendar-queries";
import { getApiIntegration } from "@/lib/studio/api-integration-queries";
import { getCalculatorSettings } from "@/lib/studio/calculator-settings-queries";
import { listCalculatorCities } from "@/lib/studio/calculator-cities-queries";
import {
  listAllTariffs,
  listFreightCarriers,
} from "@/lib/studio/freight-carriers/queries";
import {
  listLegalDocs,
  listAcceptances,
  legalOverview,
} from "@/lib/studio/legal/queries";
import { LEGAL_GATE_HARD_BLOCK } from "@/lib/studio/legal/gate-config";
import type { LegalAcceptance, LegalDoc } from "@/lib/studio/legal/types";
import {
  LegalDocsRepo,
  LegalAcceptancesLog,
} from "../legal/_components/LegalClient";
import type { CompanyData } from "@/lib/studio/company-types";
import type { NumberingOverview } from "@/lib/studio/numbering-types";
import type {
  AuditListFilters,
  AuditListResult,
} from "@/lib/studio/audit-types";
import type { ExchangeRatesOverview } from "@/lib/studio/exchange-rates-types";
import type { CalendarEvent } from "@/lib/studio/op-calendar-types";
import type { ApiIntegrationData } from "@/lib/studio/api-integration-types";
import type { CalculatorSettings } from "@/lib/studio/calculator-settings-types";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import type {
  CarrierTariff,
  FreightCarrier,
} from "@/lib/studio/freight-carriers/types";
import { redirect } from "next/navigation";
import {
  DEFAULT_ADMIN_SECTION,
  findAdminSection,
  type AdminSection,
} from "./_components/admin-sections";

export const metadata = { title: "Administración" };

/** Datos de las dos secciones legales (SDD-0054, parity Norte admin-legal). */
type LegalSectionData = {
  docs: LegalDoc[];
  acceptances: LegalAcceptance[];
  currentVersions: Record<string, string>;
  kpis: { total: number; thisMonth: number; onCurrent: number };
  gateHardBlock: boolean;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  const role = await requireModuleView("admin");
  const sp = await searchParams;
  const sectionParam = Array.isArray(sp.section) ? sp.section[0] : sp.section;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const requested = findAdminSection(sectionParam);
  // Enlace viejo a una sección con ruta propia: directo a la pantalla real.
  if (requested?.href) redirect(requested.href);
  const active: AdminSection =
    requested ?? findAdminSection(DEFAULT_ADMIN_SECTION)!;
  const calcInitialTab =
    tabParam === "ciudades" || tabParam === "transportistas" ? tabParam : "parametros";
  const auditFilters = parseAuditFilters(sp);

  // Solo la sección "company" tiene implementación real (SDD-0120): fetch acá
  // para no pegarle a la DB en las secciones que aún son placeholder.
  let companyData: CompanyData | null = null;
  let numberingData: NumberingOverview | null = null;
  let auditResult: AuditListResult | null = null;
  let ratesData: ExchangeRatesOverview | null = null;
  let calendarEvents: CalendarEvent[] | null = null;
  let apiData: ApiIntegrationData | null = null;
  let importData: { calendar: CalendarEvent[]; company: CompanyData } | null = null;
  let legalData: LegalSectionData | null = null;
  let calcData: { settings: CalculatorSettings | null; cities: CalculatorCity[]; carriers: FreightCarrier[]; tariffs: CarrierTariff[] } | null = null;
  let addonsData: PrealertaAddon[] | null = null;
  let containerTypes: ContainerType[] | null = null;
  let inviteCandidates: PortalInviteCandidate[] | null = null;
  let adoptionStats: PortalAdoptionStats | null = null;
  let coldInvitees: PortalColdInvitee[] | null = null;
  let contactlessClients: PortalContactlessClient[] | null = null;
  if (active.id === "legal-docs" || active.id === "acceptances") {
    const supabase = await createClient();
    // RLS ya acota al tenant del admin logueado; listLegalDocs sin tenantId se
    // apoya en RLS (a diferencia del gate, que corre como service_role).
    const [docs, acceptances] = await Promise.all([
      listLegalDocs(supabase),
      listAcceptances(supabase),
    ]);
    const { currentVersions, kpis } = legalOverview(docs, acceptances);
    legalData = {
      docs,
      acceptances,
      currentVersions,
      kpis,
      gateHardBlock: LEGAL_GATE_HARD_BLOCK,
    };
  } else if (active.id === "company") {
    const supabase = await createClient();
    companyData = await getCompanyData(supabase);
  } else if (active.id === "numbering") {
    const supabase = await createClient();
    numberingData = await getNumberingOverview(supabase);
  } else if (active.id === "audit") {
    const supabase = await createClient();
    auditResult = canSpecial(role, "audit_view")
      ? await listGovernedAuditEvents(supabase, auditFilters)
      : { ok: false, events: [], code: "forbidden" };
  } else if (active.id === "rates") {
    const supabase = await createClient();
    ratesData = await getExchangeRatesOverview(supabase);
  } else if (active.id === "holidays") {
    const supabase = await createClient();
    calendarEvents = await getOperationalCalendar(supabase);
  } else if (active.id === "api") {
    const supabase = await createClient();
    apiData = await getApiIntegration(supabase);
  } else if (active.id === "import") {
    const supabase = await createClient();
    const [calendar, company] = await Promise.all([
      getOperationalCalendar(supabase),
      getCompanyData(supabase),
    ]);
    importData = { calendar, company };
  } else if (active.id === "calculadora") {
    const supabase = await createClient();
    const [settings, cities, carriers, tariffs] = await Promise.all([
      getCalculatorSettings(supabase),
      listCalculatorCities(supabase),
      listFreightCarriers(supabase),
      listAllTariffs(supabase),
    ]);
    calcData = { settings, cities, carriers, tariffs };
  } else if (active.id === "masterdata") {
    const supabase = await createClient();
    containerTypes = await listContainerTypes(supabase);
  } else if (active.id === "recepcion-addons") {
    const supabase = await createClient();
    addonsData = await listPrealertaAddonsConfig(supabase);
  } else if (active.id === "portal-invites") {
    const supabase = await createClient();
    [inviteCandidates, adoptionStats, coldInvitees, contactlessClients] =
      await Promise.all([
        listPortalInviteCandidates(supabase),
        getPortalAdoptionStats(supabase),
        listPortalColdInvitees(supabase),
        listPortalContactlessClients(supabase),
      ]);
  }

  return (
    <Content
      section={active}
      companyData={companyData}
      numberingData={numberingData}
      auditResult={auditResult}
      auditFilters={auditFilters}
      ratesData={ratesData}
      calendarEvents={calendarEvents}
      apiData={apiData}
      importData={importData}
      legalData={legalData}
      calcData={calcData}
      calcInitialTab={calcInitialTab}
      addonsData={addonsData}
      containerTypes={containerTypes}
      inviteCandidates={inviteCandidates}
      adoptionStats={adoptionStats}
      coldInvitees={coldInvitees}
      contactlessClients={contactlessClients}
    />
  );
}

function Content({
  section,
  companyData,
  numberingData,
  auditResult,
  auditFilters,
  ratesData,
  calendarEvents,
  apiData,
  importData,
  legalData,
  calcData,
  calcInitialTab,
  addonsData,
  containerTypes,
  inviteCandidates,
  adoptionStats,
  coldInvitees,
  contactlessClients,
}: {
  section: AdminSection;
  companyData: CompanyData | null;
  numberingData: NumberingOverview | null;
  auditResult: AuditListResult | null;
  auditFilters: AuditListFilters;
  ratesData: ExchangeRatesOverview | null;
  calendarEvents: CalendarEvent[] | null;
  apiData: ApiIntegrationData | null;
  importData: { calendar: CalendarEvent[]; company: CompanyData } | null;
  legalData: LegalSectionData | null;
  calcData: { settings: CalculatorSettings | null; cities: CalculatorCity[]; carriers: FreightCarrier[]; tariffs: CarrierTariff[] } | null;
  calcInitialTab: "parametros" | "ciudades" | "transportistas";
  addonsData: PrealertaAddon[] | null;
  containerTypes: ContainerType[] | null;
  inviteCandidates: PortalInviteCandidate[] | null;
  adoptionStats: PortalAdoptionStats | null;
  coldInvitees: PortalColdInvitee[] | null;
  contactlessClients: PortalContactlessClient[] | null;
}) {
  return (
    <div key={section.id}>
      {/* Header del content */}
      <div style={{ marginBottom: 20 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 6 }}
        >
          {section.group}
        </div>
        <h2
          className="studio-display"
          style={{
            fontSize: 22,
            margin: "0 0 8px",
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          {section.label}
        </h2>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "72ch",
          }}
        >
          {section.description}
        </p>
      </div>

      {section.id === "legal-docs" && legalData ? (
        <LegalDocsRepo
          docs={legalData.docs}
          acceptances={legalData.acceptances}
          gateHardBlock={legalData.gateHardBlock}
        />
      ) : section.id === "acceptances" && legalData ? (
        <LegalAcceptancesLog
          acceptances={legalData.acceptances}
          docs={legalData.docs}
          currentVersions={legalData.currentVersions}
          kpis={legalData.kpis}
        />
      ) : section.id === "company" && companyData ? (
        <CompanySection data={companyData} />
      ) : section.id === "appearance" ? (
        <AppearanceSection />
      ) : section.id === "numbering" && numberingData ? (
        <NumberingSection data={numberingData} />
      ) : section.id === "audit" && auditResult ? (
        <AuditLogSection
          result={auditResult}
          filters={auditFilters}
          governedViewerEnabled={process.env.AUDIT_GOVERNED_VIEWER !== "false"}
        />
      ) : section.id === "masterdata" ? (
        <MasterDataSection containerTypes={containerTypes} />
      ) : section.id === "rates" && ratesData ? (
        <ExchangeRatesSection data={ratesData} />
      ) : section.id === "holidays" && calendarEvents ? (
        <CalendarSection events={calendarEvents} />
      ) : section.id === "api" && apiData ? (
        <ApiIntegrationSection data={apiData} />
      ) : section.id === "calculadora" && calcData ? (
        <CalculatorSection
          settings={calcData.settings}
          cities={calcData.cities}
          carriers={calcData.carriers}
          tariffs={calcData.tariffs}
          isAdmin
          initialTab={calcInitialTab}
        />
      ) : section.id === "recepcion-addons" && addonsData ? (
        <RecepcionAddonsSection addons={addonsData} />
      ) : section.id === "portal-invites" && inviteCandidates ? (
        <PortalBackfillSection
          candidates={inviteCandidates}
          stats={adoptionStats}
          coldInvitees={coldInvitees ?? []}
          contactlessClients={contactlessClients ?? []}
        />
      ) : section.id === "import" && importData ? (
        <ImportExportSection
          calendar={importData.calendar}
          offices={importData.company.offices}
          bankAccounts={importData.company.bankAccounts}
        />
      ) : null}
    </div>
  );
}
