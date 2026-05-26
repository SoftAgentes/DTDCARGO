// Inline test del sanitizer · valida los 7 vectores P1 + sanity checks
const REDACTED = "[REDACTED]";
const SENSITIVE_QUERY_KEYS = new Set(["token","access_token","refresh_token","id_token","auth","password","api_key","apikey","secret","key","session_id","sid","code","state","nonce","client_secret","passwd","pwd","pass"]);
const TOKEN_PATTERNS = [
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "Bearer", re: /\bBearer\s+[A-Za-z0-9._\-+/=]{16,}/gi },
  { name: "Stripe", re: /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: "Custom prefix", re: /\b[a-z][a-z0-9_]{1,15}_(?:live|test|prod|dev)_[A-Za-z0-9]{16,}\b/gi },
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "GitHub", re: /\bgh[oprusti]_[A-Za-z0-9]{30,}\b/g },
  { name: "Generic credential", re: /\b(token|secret|password|api[_-]?key|auth(?:[_-]?token)?|bearer)\s*[:=]\s*['"]?([A-Za-z0-9_\-+/=.]{16,})['"]?/gi },
];
function tryDecodeOnce(s){ if(!s.includes("%")) return null; try { const d = decodeURIComponent(s); return d===s?null:d; } catch { return null; } }
function redactTokenPatternsOnly(text){
  if(!text||typeof text!=="string") return text;
  let out = text;
  for(const {name, re} of TOKEN_PATTERNS){
    out = out.replace(re, (match, ...args) => {
      if(name === "Generic credential"){
        const groups = args.slice(0, -2);
        const value = groups[1];
        if(typeof value === "string" && value.length > 0) return match.replace(value, REDACTED);
        return REDACTED;
      }
      return REDACTED;
    });
  }
  return out;
}
function redactTokensInText(text){
  if(!text||typeof text!=="string") return text;
  let out = redactTokenPatternsOnly(text);
  out = out.replace(/\bhttps?:\/\/[^\s'"<>)]+/g, m => redactUrl(m));
  out = out.replace(/(?<![\w/])\/[^\s'"<>)]+\?[^\s'"<>)]+/g, m => redactUrl(m));
  return out;
}
function redactUrl(url){
  if(!url||typeof url!=="string") return url;
  const decoded = tryDecodeOnce(url);
  const working = decoded ?? url;
  let out = working;
  out = out.replace(/^(https?:\/\/)([^:@/?#\s]+:[^@/?#\s]+)@/i, (_m, scheme) => `${scheme}${REDACTED}@`);
  out = redactTokenPatternsOnly(out);
  try {
    const u = new URL(out, "http://__placeholder__/");
    const params = u.searchParams;
    for(const key of Array.from(params.keys())){
      if(SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) params.set(key, REDACTED);
    }
    if(u.hash.length > 1){
      const hashQuery = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
      if(/^[A-Za-z0-9_\-]+=/.test(hashQuery)){
        const hashParams = new URLSearchParams(hashQuery);
        let ch = false;
        for(const key of Array.from(hashParams.keys())){
          if(SENSITIVE_QUERY_KEYS.has(key.toLowerCase())){ hashParams.set(key, REDACTED); ch = true; }
        }
        if(ch) u.hash = `#${hashParams.toString()}`;
      }
    }
    if(working.startsWith("http")) return u.toString();
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return out;
  }
}

const tests = [
  { name: "P1#1 Stripe sk_live", input: "API call with sk_live_abcdefghijklmnopqrstuvwx in headers", fn: redactTokensInText, mustNotContain: "sk_live_abc" },
  { name: "P1#2 JWT en path", input: "/api/auth/jwt/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxxxx.yyyyyyyyyyyyy/callback", fn: redactUrl, mustNotContain: "eyJhbG" },
  { name: "P1#3 Hash access_token", input: "https://x.com/callback#access_token=abc123&refresh_token=def456", fn: redactUrl, mustNotContain: "abc123" },
  { name: "P1#4 Basic auth", input: "https://user:password@host.com/api", fn: redactUrl, mustNotContain: "password" },
  { name: "P1#5 Query en console msg", input: "failed /api/login?token=abc1234567890&other=ok", fn: redactTokensInText, mustNotContain: "abc1234567890" },
  { name: "P1#6 Custom prefix _live_", input: "dt_live_1234567890abcdefghijklmnopqrstuv", fn: redactTokensInText, mustNotContain: "dt_live_123" },
  { name: "P1#7 URL-encoded key", input: "https://x.com/cb?%74oken=abc1234567890", fn: redactUrl, mustNotContain: "abc1234567890" },
  { name: "URL absoluta inline en mensaje (recursion test)", input: "Error: failed POST https://api.x.com/auth?token=abc1234567890 returned 401", fn: redactTokensInText, mustNotContain: "abc1234567890" },
  { name: "Sanity: URL normal OK", input: "https://api.x.com/users?limit=10&offset=0", fn: redactUrl, mustContain: "limit=10" },
  { name: "Sanity: texto normal OK", input: "Hello world", fn: redactTokensInText, mustEqual: "Hello world" },
  { name: "Sanity: JWT en texto", input: "token eyJabc1234567890123456.eyJ12345678901.signaturexxxxxxxxxx leaked", fn: redactTokensInText, mustNotContain: "eyJabc1234" },
  { name: "Sanity: GitHub token", input: "ghp_abcdefghijklmnopqrstuvwxyz1234567890ABCD", fn: redactTokensInText, mustNotContain: "ghp_abc" },
  { name: "Sanity: AWS key", input: "AKIAIOSFODNN7EXAMPLE", fn: redactTokensInText, mustNotContain: "AKIAIOSF" },
  { name: "Sanity: Bearer", input: "Authorization: Bearer 1234567890abcdef1234567890", fn: redactTokensInText, mustNotContain: "1234567890abcdef" },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const out = t.fn(t.input);
  let ok = true, reasons = [];
  if (t.mustNotContain && out.includes(t.mustNotContain)) { ok = false; reasons.push(`STILL CONTAINS "${t.mustNotContain}"`); }
  if (t.mustContain && !out.includes(t.mustContain)) { ok = false; reasons.push(`MISSING "${t.mustContain}"`); }
  if (t.mustEqual && out !== t.mustEqual) { ok = false; reasons.push(`NOT EQUAL "${t.mustEqual}"`); }
  if (ok) { pass++; console.log(`OK   ${t.name}`); }
  else { fail++; console.log(`FAIL ${t.name}`); for (const r of reasons) console.log(`     ${r}`); console.log(`     in:  ${t.input}`); console.log(`     out: ${out}`); }
}
console.log(`\nResult: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
