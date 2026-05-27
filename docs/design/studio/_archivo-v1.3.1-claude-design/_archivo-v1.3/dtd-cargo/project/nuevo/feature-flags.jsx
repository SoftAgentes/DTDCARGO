/* global React */
/* ── DTD ERP · Feature flags (v1.1) ──────────────────────────── */
/* Estado global de feature flags persistido en localStorage.    */
/* La SectionFeatures del admin escribe acá; la Sidebar lee.     */

const DTD_FLAGS_KEY = 'dtd_feature_flags_v1';
const DTD_FLAGS_EVENT = 'dtd-flags-changed';

// Defaults — coinciden con los del SectionFeatures original.
window.FEATURE_FLAG_DEFAULTS = {
  customs_seniat:    false,
  cargo_insurance:   false,
  hs_autodetect:     true,
  cn_translation:    true,
  ai_copilot:        false,
  whatsapp:          true,
  email_sequences:   false,
  branding_xcliente: true,
  multi_currency:    true,
  vault:             true,
  audit_log:         true,
  api_public:        false,
  webhooks:          true,
  comments:          true,
  consolidation_partial: true,
  portal_cliente:    true,
  mobile_operator:   false,
  sustainability:    false,
  backup_auto:       true,
  sso:               false,
};

// ── Lectura siempre-fresca desde localStorage ─────────────────
function getFlags() {
  try {
    const raw = localStorage.getItem(DTD_FLAGS_KEY);
    if (!raw) return { ...window.FEATURE_FLAG_DEFAULTS };
    return { ...window.FEATURE_FLAG_DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...window.FEATURE_FLAG_DEFAULTS };
  }
}

function setFlags(updater) {
  const prev = getFlags();
  const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
  try { localStorage.setItem(DTD_FLAGS_KEY, JSON.stringify(next)); } catch (e) {}
  window.dispatchEvent(new CustomEvent(DTD_FLAGS_EVENT, { detail: next }));
  return next;
}

function toggleFlag(k) {
  return setFlags(f => ({ ...f, [k]: !f[k] }));
}

// ── React hook ────────────────────────────────────────────────
// Subscribe-to-localStorage + custom event → re-render on change.
function useFeatureFlags() {
  const [flags, set] = React.useState(getFlags);
  React.useEffect(() => {
    const handler = (e) => set(e.detail || getFlags());
    const storageHandler = (e) => { if (e.key === DTD_FLAGS_KEY) set(getFlags()); };
    window.addEventListener(DTD_FLAGS_EVENT, handler);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(DTD_FLAGS_EVENT, handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  return [flags, setFlags, toggleFlag];
}

// ── Module → flag mapping ─────────────────────────────────────
// Sidebar y router consultan esto para esconder módulos.
window.MODULE_FLAG_MAP = {
  seniat:   'customs_seniat',
  vault:    'vault',
  qrqueue:  'mobile_operator',
  auditlog: 'audit_log',
};

function isModuleEnabled(moduleId, flags) {
  const flag = window.MODULE_FLAG_MAP[moduleId];
  if (!flag) return true; // sin flag = siempre visible (core)
  const f = flags || getFlags();
  return !!f[flag];
}

// Expose globally
window.DTDFlags = { getFlags, setFlags, toggleFlag, useFeatureFlags, isModuleEnabled, DTD_FLAGS_KEY, DTD_FLAGS_EVENT };
