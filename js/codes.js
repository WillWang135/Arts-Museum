/* ============================================================
   JOIN CODES
   ============================================================ */
/* No I, L, O, 0 or 1 — nothing a student can misread aloud. */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode() {
  const buf = new Uint32Array(6);
  for (let tries = 0; tries < 40; tries++) {
    (window.crypto || window.msCrypto).getRandomValues(buf);
    let code = "", digits = 0;
    for (let i = 0; i < 6; i++) {
      const ch = CODE_CHARS[buf[i] % CODE_CHARS.length];
      if (ch >= "2" && ch <= "9") digits++;
      code += ch;
    }
    if (digits >= 2) return code;   // guarantees it never spells a word
  }
  return "M" + Date.now().toString(36).toUpperCase().slice(-5);
}

function normCode(v) {
  return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
function prettyCode(v) {
  return v && v.length === 6 ? v.slice(0, 3) + "-" + v.slice(3) : (v || "");
}
