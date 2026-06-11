/* global React */
/* ── DTD ERP · Fidelización & Referidos · Datos & helpers ───── */
/* Motor de niveles (tiers) + programa de referidos.             */
/* "Construyendo confianza cliente a cliente, contenedor a       */
/*  contenedor." El tier ya se usaba en Reportes; acá vive.      */

// ── Niveles (tiers) · umbral por facturación anual (USD) ──────
const TIERS = [
  { id: 'bronze',   label: 'Bronze',   tone: 'neutral', min: 0,      color: 'var(--ink-soft)',
    benefits: ['Soporte estándar', 'Tracking en portal', 'Etiquetas bilingües'] },
  { id: 'silver',   label: 'Silver',   tone: 'info',    min: 50000,  color: 'var(--info)',
    benefits: ['−5% en almacenaje', 'Prioridad media en consolidación', 'Estimado en 12 h'] },
  { id: 'gold',     label: 'Gold',     tone: 'warning', min: 150000, color: 'var(--warning)',
    benefits: ['−10% en almacenaje', 'Agente comercial dedicado', 'Cupo prioritario en contenedor', 'Crédito 15 días'] },
  { id: 'platinum', label: 'Platinum', tone: 'wine',    min: 300000, color: 'var(--wine)',
    benefits: ['−15% en almacenaje', 'Gerente de cuenta', 'White-label en correos', 'Cupo garantizado', 'Crédito 30 días'] },
];

function tierOf(billed) {
  const b = Number(billed) || 0;
  return [...TIERS].reverse().find(t => b >= t.min) || TIERS[0];
}
function nextTier(tier) {
  const idx = TIERS.findIndex(t => t.id === tier.id);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}
// Progreso (%) hacia el siguiente nivel
function tierProgress(billed) {
  const t = tierOf(billed);
  const nt = nextTier(t);
  if (!nt) return { pct: 100, toNext: 0, tier: t, next: null };
  const span = nt.min - t.min;
  const pct = Math.min(100, ((billed - t.min) / span) * 100);
  return { pct, toNext: Math.max(0, nt.min - billed), tier: t, next: nt };
}

// ── Reglas del programa de referidos ──────────────────────────
const REFERRAL_RULES = {
  referrerReward: 80,   // USD de crédito para quien refiere, al primer embarque del referido
  referredReward: 60,   // USD de descuento para el referido en su primer embarque
  currency: 'USD',
};

// Estados del referido
const REFERRAL_STATUS = {
  invitado:        { label: 'Invitado',        tone: 'neutral', step: 0 },
  registrado:      { label: 'Registrado',      tone: 'info',    step: 1 },
  'primer-embarque': { label: 'Primer embarque', tone: 'warning', step: 2 },
  acreditado:      { label: 'Acreditado',      tone: 'success', step: 3 },
};
const REFERRAL_STEPS = ['invitado', 'registrado', 'primer-embarque', 'acreditado'];

// ── Referidos (seed) ──────────────────────────────────────────
// referrer = Shipping Mark del cliente que refiere.
const REFERRALS = [
  { id: 'REF-0091', referrer: 'DTD-5392', referredName: 'Jorge Calderón', referredCompany: 'Calderón Industrial', date: '2026-05-18', status: 'primer-embarque', rewardUsd: 80, lead: 'L-0140' },
  { id: 'REF-0090', referrer: 'DTD-5452', referredName: 'Pedro Mejías',   referredCompany: 'Mejías Construcción', date: '2026-05-12', status: 'acreditado',      rewardUsd: 80, lead: 'L-0135' },
  { id: 'REF-0089', referrer: 'DTD-5354', referredName: 'Felipe Acosta',  referredCompany: 'F. Acosta Trading',   date: '2026-05-20', status: 'registrado',     rewardUsd: 0,  lead: 'L-0146' },
  { id: 'REF-0088', referrer: 'DTD-5392', referredName: 'Lucía Pérez',    referredCompany: 'LP Importaciones',    date: '2026-05-08', status: 'acreditado',      rewardUsd: 80, lead: null },
  { id: 'REF-0087', referrer: 'DTD-5241', referredName: 'Marcos Vivas',   referredCompany: 'Vivas Comercial',     date: '2026-05-22', status: 'invitado',       rewardUsd: 0,  lead: null },
  { id: 'REF-0086', referrer: 'DTD-5452', referredName: 'Ana Rondón',     referredCompany: 'Rondón Retail',       date: '2026-04-29', status: 'acreditado',      rewardUsd: 80, lead: null },
  { id: 'REF-0085', referrer: 'DTD-5340', referredName: 'Hugo Salas',     referredCompany: 'Salas Distribución',  date: '2026-05-15', status: 'primer-embarque', rewardUsd: 80, lead: null },
  { id: 'REF-0084', referrer: 'DTD-5354', referredName: 'Teresa Gil',     referredCompany: 'Gil & Hijos',         date: '2026-05-02', status: 'acreditado',      rewardUsd: 80, lead: null },
];

// Código de referido determinístico por Shipping Mark (DTD-5452 → REF-5452)
function referralCode(markbox) { return 'REF-' + String(markbox || '').replace(/^DTD-/, ''); }

// ── Helpers de agregación ─────────────────────────────────────
function clientsWithTier() {
  return (window.ERPData?.CLIENTS || []).map(c => ({ ...c, tier: tierOf(c.billed) }));
}
function tierCounts() {
  const counts = {};
  TIERS.forEach(t => counts[t.id] = 0);
  clientsWithTier().forEach(c => { counts[c.tier.id] = (counts[c.tier.id] || 0) + 1; });
  return TIERS.map(t => ({ tier: t, count: counts[t.id] }));
}
function referralsByReferrer(markbox) { return REFERRALS.filter(r => r.referrer === markbox); }
function creditsEarned(markbox) { return referralsByReferrer(markbox).reduce((s, r) => s + (r.status === 'acreditado' ? r.rewardUsd : 0), 0); }
function pendingCredits(markbox) { return referralsByReferrer(markbox).reduce((s, r) => s + (r.status !== 'acreditado' && r.status !== 'invitado' ? REFERRAL_RULES.referrerReward : 0), 0); }

function topReferrers(n = 5) {
  const map = {};
  REFERRALS.forEach(r => {
    if (!map[r.referrer]) map[r.referrer] = { markbox: r.referrer, total: 0, acreditados: 0, credits: 0 };
    map[r.referrer].total += 1;
    if (r.status === 'acreditado') { map[r.referrer].acreditados += 1; map[r.referrer].credits += r.rewardUsd; }
  });
  const clients = window.ERPData?.CLIENTS || [];
  return Object.values(map)
    .map(m => ({ ...m, client: clients.find(c => c.markbox === m.markbox) }))
    .sort((a, b) => b.acreditados - a.acreditados || b.total - a.total)
    .slice(0, n);
}

function programStats() {
  const total = REFERRALS.length;
  const acreditados = REFERRALS.filter(r => r.status === 'acreditado').length;
  const activos = REFERRALS.filter(r => r.status !== 'acreditado' && r.status !== 'invitado').length;
  const creditsIssued = REFERRALS.reduce((s, r) => s + (r.status === 'acreditado' ? r.rewardUsd : 0), 0);
  const convRate = total ? (acreditados / total) * 100 : 0;
  return { total, acreditados, activos, creditsIssued, convRate };
}

window.FidelizacionData = {
  TIERS, REFERRAL_RULES, REFERRAL_STATUS, REFERRAL_STEPS, REFERRALS,
  tierOf, nextTier, tierProgress, referralCode,
  clientsWithTier, tierCounts, referralsByReferrer, creditsEarned, pendingCredits,
  topReferrers, programStats,
};
