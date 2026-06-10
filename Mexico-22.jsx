import { useState, useEffect } from "react";

const NUM_APARTMENTS = 32;
const STORAGE_KEY = "mexico22-signatures";

const BUILDING_ADDRESS = "מכסיקו 22, ירושלים";
const DATE = new Date().toLocaleDateString("he-IL");
const AGENDA = "1. חניה בכניסה\n2. חניה מאחור\n3. מקומות ריקים שלא בשימוש בבניין\n4. מצלמות\n5. גינון\n6. תחזוקה וניקיון\n7. הצבעה להוספת אנשים לועד הבית";

const emptySignatures = Array.from({ length: NUM_APARTMENTS }, (_, i) => ({
  apt: i + 1, name: "", phone: "", signed: false, signedAt: null, drawing: null,
}));

function SignaturePad({ onSave, onClear }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState("");

  function getPos(e, el) {
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
  function startDraw(e) {
    e.preventDefault();
    const pos = getPos(e, e.currentTarget);
    setIsDrawing(true);
    setCurrentPath(`M ${pos.x} ${pos.y}`);
  }
  function draw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e, e.currentTarget);
    setCurrentPath(p => p + ` L ${pos.x} ${pos.y}`);
  }
  function endDraw(e) {
    e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath) {
      const newPaths = [...paths, currentPath];
      setPaths(newPaths);
      onSave(newPaths.join("|"));
    }
    setCurrentPath("");
  }
  function clear() { setPaths([]); setCurrentPath(""); onClear(); }

  return (
    <div style={{ position: "relative" }}>
      <svg width="220" height="70"
        style={{ border: "1.5px solid #b0b8c9", borderRadius: "6px", background: "#f8f9fb", cursor: "crosshair", display: "block", touchAction: "none" }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      >
        <text x="110" y="42" textAnchor="middle" fill="#c8cdd6" fontSize="11" fontFamily="sans-serif">
          {paths.length === 0 && !currentPath ? "חתום כאן" : ""}
        </text>
        {paths.map((p, i) => <path key={i} d={p} fill="none" stroke="#1a2540" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
        {currentPath && <path d={currentPath} fill="none" stroke="#1a2540" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {paths.length > 0 && (
        <button onClick={clear} style={{ position: "absolute", top: 2, right: 4, background: "none", border: "none", color: "#888", fontSize: "13px", cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}

function SignatureSVGInline({ drawing, width = 80, height = 28 }) {
  if (!drawing) return <span style={{ color: "#ccc", fontSize: "11px" }}>—</span>;
  const scaleX = width / 220, scaleY = height / 70;
  const pathList = drawing.split("|");
  function scalePath(d) {
    return d.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_, cmd, x, y) =>
      `${cmd} ${(parseFloat(x) * scaleX).toFixed(1)} ${(parseFloat(y) * scaleY).toFixed(1)}`);
  }
  return (
    <svg width={width} height={height} style={{ display: "inline-block", verticalAlign: "middle" }}>
      {pathList.map((p, i) => <path key={i} d={scalePath(p)} fill="none" stroke="#1a2540" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

function generatePDF(sigs) {
  const signedSigs = sigs.filter(s => s.signed);
  function sigSVGDataUri(drawing) {
    if (!drawing) return "";
    const w = 150, h = 50, scaleX = w / 220, scaleY = h / 70;
    const pathList = drawing.split("|");
    function scalePath(d) {
      return d.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_, cmd, x, y) =>
        `${cmd} ${(parseFloat(x) * scaleX).toFixed(1)} ${(parseFloat(y) * scaleY).toFixed(1)}`);
    }
    const pathsHTML = pathList.map(p => `<path d="${scalePath(p)}" fill="none" stroke="#1a2540" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${pathsHTML}</svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  }
  const agendaLines = AGENDA.split("\n").map(l => `<li style="margin:3px 0">${l}</li>`).join("");
  const allRows = sigs.map(s => {
    const sigUri = s.signed ? sigSVGDataUri(s.drawing) : "";
    return `<tr style="border-bottom:1px solid #e0e4ef;${s.signed ? "background:#f0faf6" : "background:#fff"}">
      <td style="padding:8px 12px;font-weight:700;font-size:14px;color:#1a2540;text-align:center;width:60px">${s.apt}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1a2540;">${s.name || "—"}</td>
      <td style="padding:8px 12px;font-size:12px;color:#555;">${s.phone || "—"}</td>
      <td style="padding:8px 4px;text-align:center;width:160px;">${s.signed && sigUri ? `<img src="${sigUri}" width="150" height="50" style="display:block;margin:0 auto"/>` : '<span style="color:#ccc;font-size:12px">לא חתם</span>'}</td>
      <td style="padding:8px 12px;font-size:11px;color:#888;text-align:center">${s.signedAt || "—"}</td>
    </tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"/>
<title>אסיפה כללית — ${BUILDING_ADDRESS}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Heebo',Arial,sans-serif;background:#fff;color:#1a2540;direction:rtl}
  .page{max-width:900px;margin:0 auto;padding:32px 28px}
  .header{background:#1a2540;color:#fff;padding:28px 32px;border-radius:10px;margin-bottom:24px}
  .header h1{font-size:22px;font-weight:800;margin-bottom:4px}.header .sub{font-size:13px;color:#8fa8d0}
  .meta{display:flex;gap:32px;margin-bottom:20px;flex-wrap:wrap}.meta-item{flex:1;min-width:180px}
  .meta-label{font-size:11px;color:#8a92a3;margin-bottom:3px}.meta-value{font-size:14px;font-weight:600}
  .section-title{font-size:13px;font-weight:700;margin:20px 0 8px}
  .agenda-box{background:#f8f9fb;border:1px solid #dde1eb;border-radius:8px;padding:14px 18px;margin-bottom:20px}
  .agenda-box ul{padding-right:18px;font-size:13px;line-height:2;color:#333}
  .stats{display:flex;gap:16px;margin-bottom:20px}.stat-card{flex:1;background:#f0f2f7;border-radius:8px;padding:14px;text-align:center}
  .stat-num{font-size:28px;font-weight:800}.stat-label{font-size:12px;color:#8a92a3;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-family:'Heebo',Arial,sans-serif}
  thead tr{background:#1a2540;color:#fff}thead th{padding:10px 12px;font-size:12px;font-weight:700;text-align:right}
  .progress-bar{height:8px;background:#dde1eb;border-radius:4px;overflow:hidden;margin-top:8px}
  .progress-fill{height:100%;background:#2d6be4;border-radius:4px}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #dde1eb;font-size:11px;color:#aaa;text-align:center}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="page">
  <div class="header"><div class="sub">מסמך רשמי — בית משותף</div>
    <h1>דרישה לכינוס אסיפה כללית שלא מן המניין</h1>
    <div class="sub" style="margin-top:6px">בהתאם לחוק המקרקעין תשכ"ט-1969</div></div>
  <div class="meta">
    <div class="meta-item"><div class="meta-label">תאריך</div><div class="meta-value">${DATE}</div></div>
    <div class="meta-item"><div class="meta-label">כתובת הבניין</div><div class="meta-value">${BUILDING_ADDRESS}</div></div>
    <div class="meta-item"><div class="meta-label">מספר דירות</div><div class="meta-value">${NUM_APARTMENTS}</div></div>
  </div>
  <div class="stats">
    <div class="stat-card"><div class="stat-num" style="color:#1a8a5a">${signedSigs.length}</div><div class="stat-label">חתמו</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#e05a2b">${NUM_APARTMENTS - signedSigs.length}</div><div class="stat-label">טרם חתמו</div></div>
    <div class="stat-card" style="flex:2"><div style="font-size:13px;font-weight:700;margin-bottom:6px">${Math.round(signedSigs.length / NUM_APARTMENTS * 100)}% מהדירות חתמו</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(signedSigs.length / NUM_APARTMENTS * 100)}%"></div></div></div>
  </div>
  <div class="section-title">סדר היום לאסיפה</div>
  <div class="agenda-box"><ul>${agendaLines}</ul></div>
  <div class="section-title">רשימת חתימות — כל הדירות</div>
  <table><thead><tr>
    <th style="text-align:center">דירה</th><th>שם בעל הדירה</th><th>טלפון</th>
    <th style="text-align:center">חתימה</th><th style="text-align:center">תאריך ושעה</th>
  </tr></thead><tbody>${allRows}</tbody></table>
  <div class="footer">מסמך זה הופק דיגיטלית · ${BUILDING_ADDRESS} · ${DATE}</div>
</div><script>window.onload=()=>window.print();</script></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `אסיפה_כללית_מכסיקו22.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}


const OG_IMAGE_URL = "https://i.imgur.com/TaVjlpK.jpeg";

function OGPreview() {
  return (
    <div style={{ margin: "0 0 16px", borderRadius: "12px", overflow: "hidden", border: "1.5px solid #dde1eb", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", background: "#fff" }}>
      <img src={OG_IMAGE_URL} alt="אסיפת דיירים מכסיקו 22" style={{ width: "100%", display: "block", maxHeight: "240px", objectFit: "cover" }} />
      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid #eee", background: "#1a2540" }}>
        <div style={{ fontSize: "11px", color: "#8fa8d0", marginBottom: "3px", letterSpacing: "0.5px" }}>claude.ai</div>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "3px" }}>אסיפת דיירים — מכסיקו 22 ירושלים</div>
        <div style={{ fontSize: "12px", color: "#a8b8d0", lineHeight: 1.5 }}>דרישה לכינוס אסיפה כללית שלא מן המניין · חתימה דיגיטלית לפי דירה</div>
      </div>
    </div>
  );
}

export default function App() {
  const [sigs, setSigs] = useState(emptySignatures);
  const [expandedApt, setExpandedApt] = useState(null);
  const [view, setView] = useState("form");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from persistent storage on mount
  useEffect(() => {
    async function load() {
      try {
        const result = await window.storage.get(STORAGE_KEY, true);
        if (result && result.value) {
          const stored = JSON.parse(result.value);
          // Merge stored signed sigs with empty template (preserves all 32 apts)
          setSigs(emptySignatures.map(empty => {
            const found = stored.find(s => s.apt === empty.apt);
            return found ? found : empty;
          }));
        }
      } catch (e) {
        // No stored data yet, start fresh
      }
      setLoading(false);
    }
    load();
  }, []);

  // Save to persistent storage — only signed entries, never overwrites a signed entry
  async function persistSig(updatedSigs) {
    setSaving(true);
    try {
      // Load current stored to avoid overwriting another user's signature
      let base = emptySignatures;
      try {
        const result = await window.storage.get(STORAGE_KEY, true);
        if (result && result.value) base = JSON.parse(result.value);
      } catch (e) {}
      // Merge: stored signed entries always win, then add new signed entries
      const merged = emptySignatures.map(empty => {
        const stored = base.find(s => s.apt === empty.apt);
        const local = updatedSigs.find(s => s.apt === empty.apt);
        if (stored && stored.signed) return stored; // never overwrite stored signed
        if (local && local.signed) return local;    // save new local signed
        return local || empty;
      });
      await window.storage.set(STORAGE_KEY, JSON.stringify(merged), true);
      setSigs(merged);
    } catch (e) {
      console.error("שגיאה בשמירה:", e);
    }
    setSaving(false);
  }

  function updateSig(apt, field, value) {
    setSigs(prev => prev.map(s => s.apt === apt ? { ...s, [field]: value } : s));
  }

  async function signApt(apt) {
    const sig = sigs.find(s => s.apt === apt);
    if (!sig.name.trim()) return alert("יש למלא שם בעל הדירה לפני החתימה.");
    if (!sig.drawing) return alert("יש לחתום בתיבת החתימה לפני האישור.");
    const updated = sigs.map(s =>
      s.apt === apt ? { ...s, signed: true, signedAt: new Date().toLocaleString("he-IL") } : s
    );
    setExpandedApt(null);
    await persistSig(updated);
  }

  const signedCount = sigs.filter(s => s.signed).length;

  const colors = {
    bg: "#f0f2f7", card: "#ffffff", header: "#1a2540", accent: "#2d6be4",
    accentLight: "#e8effd", muted: "#8a92a3", border: "#dde1eb",
    signed: "#1a8a5a", signedBg: "#eaf7f1",
  };

  if (loading) return (
    <div dir="rtl" style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center", color: colors.muted }}>
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔄</div>
        <div style={{ fontSize: "16px" }}>טוען חתימות שמורות...</div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: colors.bg, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: colors.header, color: "#fff", padding: "28px 24px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#8fa8d0", marginBottom: "6px" }}>מסמך דיגיטלי · {BUILDING_ADDRESS}</div>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>דרישה לכינוס אסיפה כללית</h1>
        <div style={{ margin: "4px 0 0", fontSize: "13px", color: "#a8b8d0" }}>חתימה דיגיטלית לפי דירה — נשמר באופן קבוע</div>
        <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <div style={{ fontSize: "13px", color: "#c0d0e8" }}>
            {signedCount} מתוך {NUM_APARTMENTS} דירות חתמו
            {saving && <span style={{ marginRight: "8px", fontSize: "11px", color: "#8fa8d0" }}>💾 שומר...</span>}
          </div>
          <div style={{ width: "220px", height: "6px", borderRadius: "3px", background: "#2d3e5c", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(signedCount / NUM_APARTMENTS) * 100}%`, background: "#2d6be4", borderRadius: "3px", transition: "width 0.4s" }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `2px solid ${colors.border}`, background: colors.card }}>
        {[["form", "📋 המסמך"], ["summary", "📊 סיכום חתימות"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: "12px", border: "none", background: "none",
            fontWeight: view === v ? 700 : 400, color: view === v ? colors.accent : colors.muted,
            borderBottom: view === v ? `3px solid ${colors.accent}` : "3px solid transparent",
            cursor: "pointer", fontSize: "14px", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px 14px 40px" }}>

        {view === "form" && (<>
          {/* Fixed document info */}
          <div style={{ background: colors.card, borderRadius: "12px", padding: "20px", marginBottom: "16px", border: `1px solid ${colors.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "12px", color: colors.muted, marginBottom: "4px" }}>תאריך</div>
                <div style={{ padding: "8px 10px", borderRadius: "6px", background: "#f4f6fb", fontSize: "14px", fontWeight: 600, color: colors.header }}>{DATE}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: colors.muted, marginBottom: "4px" }}>כתובת הבניין</div>
                <div style={{ padding: "8px 10px", borderRadius: "6px", background: "#f4f6fb", fontSize: "14px", fontWeight: 600, color: colors.header }}>{BUILDING_ADDRESS}</div>
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "12px", color: colors.muted, marginBottom: "6px" }}>סדר היום לאסיפה</div>
              <div style={{ padding: "10px 14px", borderRadius: "6px", background: "#f4f6fb" }}>
                {AGENDA.split("\n").map((line, i) => (
                  <div key={i} style={{ fontSize: "13px", lineHeight: "2", color: "#333" }}>{line}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Storage notice */}
          <div style={{ background: "#eaf7f1", border: "1px solid #a8dfc0", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "12px", color: "#1a8a5a", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "16px" }}>🔒</span>
            <span>החתימות נשמרות באופן קבוע ומאובטח — לא ניתן למחוק חתימה לאחר אישורה</span>
          </div>

          <div style={{ fontWeight: 700, fontSize: "14px", color: colors.header, marginBottom: "10px" }}>חתימות בעלי הדירות</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sigs.map((s) => (
              <div key={s.apt} style={{
                border: `1.5px solid ${s.signed ? colors.signed : expandedApt === s.apt ? colors.accent : colors.border}`,
                borderRadius: "10px", background: s.signed ? colors.signedBg : colors.card, overflow: "hidden",
              }}>
                <div onClick={() => !s.signed && setExpandedApt(expandedApt === s.apt ? null : s.apt)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", cursor: s.signed ? "default" : "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center",
                      background: s.signed ? colors.signed : colors.accentLight,
                      color: s.signed ? "#fff" : colors.accent, fontWeight: 700, fontSize: "14px",
                    }}>{s.apt}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: colors.header }}>דירה {s.apt}</div>
                      {s.signed && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "12px", color: colors.signed }}>✓ {s.name}</span>
                          <SignatureSVGInline drawing={s.drawing} />
                        </div>
                      )}
                      {!s.signed && s.name && <div style={{ fontSize: "12px", color: colors.muted }}>{s.name}</div>}
                    </div>
                  </div>
                  <div>
                    {s.signed && <span style={{ fontSize: "18px" }}>🔒</span>}
                    {!s.signed && <div style={{ fontSize: "20px", color: colors.muted, transition: "transform 0.2s", transform: expandedApt === s.apt ? "rotate(180deg)" : "none" }}>⌄</div>}
                  </div>
                </div>

                {expandedApt === s.apt && !s.signed && (
                  <div style={{ borderTop: `1px solid ${colors.border}`, padding: "14px", background: "#fbfcff" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                      <div>
                        <label style={{ fontSize: "12px", color: colors.muted, display: "block", marginBottom: "3px" }}>שם בעל הדירה *</label>
                        <input value={s.name} onChange={e => updateSig(s.apt, "name", e.target.value)} placeholder="שם מלא"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${colors.border}`, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", color: colors.muted, display: "block", marginBottom: "3px" }}>טלפון (אופציונלי)</label>
                        <input value={s.phone} onChange={e => updateSig(s.apt, "phone", e.target.value)} placeholder="05X-XXXXXXX" type="tel"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${colors.border}`, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "12px", color: colors.muted, display: "block", marginBottom: "4px" }}>חתימה *</label>
                      <SignaturePad
                        onSave={(d) => updateSig(s.apt, "drawing", d)}
                        onClear={() => updateSig(s.apt, "drawing", null)}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button onClick={() => { setExpandedApt(null); updateSig(s.apt, "name", ""); updateSig(s.apt, "drawing", null); }} style={{ padding: "8px 18px", borderRadius: "7px", border: `1px solid ${colors.border}`, background: "none", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}>ביטול</button>
                      <button onClick={() => signApt(s.apt)} disabled={saving} style={{ padding: "8px 22px", borderRadius: "7px", border: "none", background: saving ? "#aaa" : colors.accent, color: "#fff", cursor: saving ? "default" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit" }}>
                        {saving ? "שומר..." : "אשר חתימה"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>)}

        {view === "summary" && (
          <div>
            <div style={{ background: colors.card, borderRadius: "12px", padding: "20px", marginBottom: "16px", border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: "13px", color: colors.muted, marginBottom: "6px" }}>סיכום</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: colors.header }}>{signedCount} <span style={{ fontSize: "16px", fontWeight: 400, color: colors.muted }}>/ {NUM_APARTMENTS} דירות חתמו</span></div>
              <div style={{ height: "8px", borderRadius: "4px", background: colors.border, marginTop: "12px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(signedCount / NUM_APARTMENTS) * 100}%`, background: colors.accent, borderRadius: "4px", transition: "width 0.4s" }} />
              </div>
              <div style={{ marginTop: "10px", fontSize: "13px", color: colors.muted }}>📍 {BUILDING_ADDRESS}</div>
            </div>

            <button onClick={() => generatePDF(sigs)} style={{
              width: "100%", padding: "14px", borderRadius: "10px", border: "none",
              background: "#1a2540", color: "#fff", cursor: "pointer", fontSize: "15px",
              fontWeight: 700, fontFamily: "inherit", marginBottom: "20px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              📄 הורד מסמך PDF עם כל החתימות
            </button>

            <div style={{ fontWeight: 700, fontSize: "13px", color: colors.header, marginBottom: "8px" }}>✅ חתמו ({sigs.filter(s => s.signed).length})</div>
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: "10px", overflow: "hidden", marginBottom: "16px" }}>
              {sigs.filter(s => s.signed).length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: colors.muted, fontSize: "13px" }}>אין חתימות עדיין</div>
              )}
              {sigs.filter(s => s.signed).map((s, i, arr) => (
                <div key={s.apt} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ background: colors.signedBg, color: colors.signed, borderRadius: "5px", padding: "2px 8px", fontSize: "12px", fontWeight: 700 }}>{s.apt}</span>
                    <span style={{ fontSize: "14px" }}>{s.name}</span>
                    <SignatureSVGInline drawing={s.drawing} />
                  </div>
                  <div style={{ fontSize: "11px", color: colors.muted }}>{s.signedAt}</div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: "13px", color: colors.header, marginBottom: "8px" }}>⏳ טרם חתמו ({sigs.filter(s => !s.signed).length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "24px" }}>
              {sigs.filter(s => !s.signed).map(s => (
                <span key={s.apt} style={{ padding: "5px 12px", borderRadius: "6px", border: `1px solid ${colors.border}`, background: colors.card, fontSize: "13px", color: colors.muted }}>דירה {s.apt}</span>
              ))}
            </div>

            <div style={{ background: colors.accentLight, border: `1px solid #c0d4f8`, borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px", color: colors.accent, marginBottom: "8px" }}>🔗 שיתוף המסמך</div>
              <div style={{ fontSize: "12px", color: "#6a82a8", marginBottom: "10px" }}>כך ייראה הקישור כשישותף ב-WhatsApp / פייסבוק:</div>
              <OGPreview />
              <div style={{ fontSize: "13px", color: "#4a6fa8", lineHeight: 1.6, marginBottom: "10px" }}>
                שלח את הקישור לכל בעלי הדירות. החתימות נשמרות אוטומטית — כל מי שיפתח יראה את כל החתימות שנאספו עד כה.
              </div>
              <button onClick={() => { try { navigator.clipboard.writeText(window.location.href); alert("הקישור הועתק!"); } catch(e) {} }}
                style={{ width: "100%", padding: "10px 18px", borderRadius: "7px", background: colors.accent, color: "#fff", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 600, fontFamily: "inherit" }}>
                📤 העתק קישור לשיתוף
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}