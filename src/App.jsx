import { useState, useEffect } from "react";
import { supabase, SIGNATURES_TABLE } from "./supabaseClient.js";

const NUM_APARTMENTS = 32;

const BUILDING_ADDRESS = "מכסיקו 22, ירושלים";
// תאריך המסמך — קבוע. היה new Date() שגרם לתאריך "לזוז" בכל יום שהאתר נפתח;
// למסמך דרישה רשמי התאריך חייב להיות יציב. ערוך כאן אם תאריך האסיפה משתנה.
const DATE = "13.6.2026";
const AGENDA = "1. חניה בכניסה\n2. חניה מאחור\n3. מקומות ריקים שלא בשימוש בבניין\n4. מצלמות\n5. גינון\n6. תחזוקה וניקיון\n7. ליקויי בדק בית ותקלות — פשרה מול פנייה משפטית";

// ── נוסח המכתב הרשמי (ערוך כאן בחופשיות) ──────────────────────
const LETTER_TO = ["לכבוד", "ועד הבית", BUILDING_ADDRESS];
const LETTER_SUBJECT = "הנדון: דרישה לכינוס אסיפה כללית שלא מן המניין";
const LETTER_INTRO =
  "אנו, הח\"מ, בעלי דירות בבניין ברחוב מכסיקו 22, ירושלים, מבקשים בזאת לכנס אסיפה כללית שלא מן המניין, בהתאם לחוק המקרקעין תשכ\"ט-1969 וחוקת הבית המשותף.";
const LETTER_OUTRO =
  "אנו פונים אליכם בדרישה לקבוע מועד לאסיפה בהקדם האפשרי, ולא יאוחר מ-21 יום מקבלת פנייה זו.";
const LETTER_SIGNOFF = ["בכבוד רב,", "בעלי הדירות החתומים מטה"];

const emptySignatures = Array.from({ length: NUM_APARTMENTS }, (_, i) => ({
  apt: i + 1, name: "", signed: false, signedAt: null, drawing: null,
}));

// ממיר שורה ממסד הנתונים (snake_case) לאובייקט שהאפליקציה משתמשת בו
function rowToSig(row) {
  return {
    apt: row.apt,
    name: row.name || "",
    signed: !!row.signed,
    signedAt: row.signed_at || null,
    drawing: row.drawing || null,
  };
}

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
  const agendaItems = AGENDA.split("\n").map(l => `<div style="line-height:1.9">${l}</div>`).join("");
  const letterToLines = LETTER_TO.map((l, i) => `<div style="${i === 0 ? "font-weight:600" : ""}">${l}</div>`).join("");
  const signoffLines = LETTER_SIGNOFF.map((l, i) => `<div style="${i === 0 ? "font-weight:600" : ""}">${l}</div>`).join("");
  const allRows = sigs.map(s => {
    const sigUri = s.signed ? sigSVGDataUri(s.drawing) : "";
    return `<tr style="border-bottom:1px solid #e0e4ef;${s.signed ? "background:#f0faf6" : "background:#fff"}">
      <td style="padding:8px 12px;font-weight:700;font-size:14px;color:#1a2540;text-align:center;width:60px">${s.apt}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1a2540;">${s.name || "—"}</td>
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
  .letter-box{background:#f8f9fb;border:1px solid #dde1eb;border-radius:8px;padding:20px 22px;margin-bottom:22px;font-size:13.5px;line-height:1.8;color:#2a3242;text-align:right}
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
  <div class="letter-box">
    <div style="margin-bottom:14px">${letterToLines}</div>
    <div style="font-weight:700;color:#1a2540;text-decoration:underline;text-underline-offset:3px;margin-bottom:14px">${LETTER_SUBJECT}</div>
    <p style="margin:0 0 14px;text-align:justify">${LETTER_INTRO}</p>
    <div style="font-weight:600;margin-bottom:4px">סדר היום המוצע לאסיפה:</div>
    <div style="margin-bottom:14px">${agendaItems}</div>
    <p style="margin:0 0 16px;text-align:justify">${LETTER_OUTRO}</p>
    <div>${signoffLines}</div>
  </div>
  <div class="section-title">רשימת חתימות — כל הדירות</div>
  <table><thead><tr>
    <th style="text-align:center">דירה</th><th>שם בעל הדירה</th>
    <th style="text-align:center">חתימה</th><th style="text-align:center">תאריך ושעה</th>
  </tr></thead><tbody>${allRows}</tbody></table>
  <div class="footer">מסמך זה הופק דיגיטלית · ${BUILDING_ADDRESS} · ${DATE}</div>
</div></body></html>`;

  // הפקת PDF דרך דיאלוג ההדפסה של הדפדפן ("שמור כ-PDF"). מודפס מתוך
  // iframe נסתר — לא נחסם ע"י חוסם חלונות קופצים, והטקסט בעברית והחתימות
  // (SVG וקטורי) נשארים חדים, בלי צורך בספריות חיצוניות.
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
    win.addEventListener("afterprint", () => setTimeout(cleanup, 300));
    // השהייה קצרה כדי שגופן Heebo והחתימות ייטענו לפני ההדפסה
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) { console.error("print failed", e); cleanup(); } }, 450);
    setTimeout(cleanup, 60000); // רשת ביטחון אם afterprint לא נורה
  };
  iframe.srcdoc = html;
}


const OG_IMAGE_URL = "/yard-3.jpg";

function OGPreview() {
  return (
    <div style={{ margin: "0 0 16px", borderRadius: "12px", overflow: "hidden", border: "1.5px solid #dde1eb", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", background: "#fff" }}>
      <img src={OG_IMAGE_URL} alt="אסיפת דיירים מכסיקו 22" style={{ width: "100%", display: "block", maxHeight: "240px", objectFit: "cover" }} />
      <div style={{ padding: "10px 14px 12px", borderTop: "1px solid #eee", background: "#1a2540" }}>
        <div style={{ fontSize: "11px", color: "#8fa8d0", marginBottom: "3px", letterSpacing: "0.5px" }}>mexico-22.vercel.app</div>
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
  // מסך הפתיחה מוצג לפחות 3 שניות כדי שיספיקו לראות את תמונת החצר,
  // גם אם החתימות נטענו מהר יותר.
  const [splashReady, setSplashReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dbError, setDbError] = useState(null);

  // טוען את כל החתימות ממסד הנתונים וממזג עם תבנית 32 הדירות
  async function loadSignatures() {
    try {
      const { data, error } = await supabase.from(SIGNATURES_TABLE).select("*");
      if (error) throw error;
      const rows = data || [];
      setSigs(emptySignatures.map(empty => {
        const found = rows.find(r => r.apt === empty.apt);
        return found ? rowToSig(found) : empty;
      }));
      setDbError(null);
    } catch (e) {
      console.error("שגיאה בטעינה:", e);
      setDbError("לא ניתן להתחבר למסד הנתונים. בדוק את הגדרות Supabase.");
    }
    setLoading(false);
  }

  // טעינה ראשונית + מנוי לעדכונים בזמן אמת (כל חתימה חדשה מופיעה אצל כולם מיד)
  useEffect(() => {
    loadSignatures();
    const splashTimer = setTimeout(() => setSplashReady(true), 3000);
    const channel = supabase
      .channel("signatures-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SIGNATURES_TABLE },
        () => loadSignatures()
      )
      .subscribe();
    return () => { clearTimeout(splashTimer); supabase.removeChannel(channel); };
  }, []);

  function updateSig(apt, field, value) {
    setSigs(prev => prev.map(s => s.apt === apt ? { ...s, [field]: value } : s));
  }

  async function signApt(apt) {
    const sig = sigs.find(s => s.apt === apt);
    if (!sig.name.trim()) return alert("יש למלא שם בעל הדירה לפני החתימה.");
    if (!sig.drawing) return alert("יש לחתום בתיבת החתימה לפני האישור.");

    setSaving(true);
    try {
      // בדיקה שהדירה לא נחתמה כבר במסד הנתונים (מונע דריסה)
      const { data: existing } = await supabase
        .from(SIGNATURES_TABLE)
        .select("signed")
        .eq("apt", apt)
        .maybeSingle();

      if (existing && existing.signed) {
        alert("דירה זו כבר חתומה ולא ניתן לשנות אותה.");
        await loadSignatures();
        setExpandedApt(null);
        setSaving(false);
        return;
      }

      const signedAt = new Date().toLocaleString("he-IL");
      const { error } = await supabase.from(SIGNATURES_TABLE).upsert({
        apt,
        name: sig.name.trim(),
        signed: true,
        signed_at: signedAt,
        drawing: sig.drawing,
      });
      if (error) throw error;

      setSigs(prev => prev.map(s =>
        s.apt === apt ? { ...s, signed: true, signedAt } : s
      ));
      setExpandedApt(null);
    } catch (e) {
      console.error("שגיאה בשמירה:", e);
      alert("אירעה שגיאה בשמירת החתימה. נסה שוב.");
    }
    setSaving(false);
  }

  const signedCount = sigs.filter(s => s.signed).length;

  const colors = {
    bg: "#f0f2f7", card: "#ffffff", header: "#1a2540", accent: "#2d6be4",
    accentLight: "#e8effd", muted: "#8a92a3", border: "#dde1eb",
    signed: "#1a8a5a", signedBg: "#eaf7f1",
  };

  if (loading || !splashReady) return (
    <div dir="rtl" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', Arial, sans-serif", textAlign: "center", padding: "24px",
      backgroundImage: `linear-gradient(rgba(14,19,32,0.55), rgba(14,19,32,0.72)), url("/yard-1.jpg")`,
      backgroundSize: "cover", backgroundPosition: "center",
    }}>
      <div style={{ color: "#fff", maxWidth: "460px" }}>
        <div style={{ fontSize: "12px", letterSpacing: "3px", color: "#bcd0ee", marginBottom: "10px" }}>מסמך דיגיטלי · ירושלים</div>
        <h1 style={{ margin: 0, fontSize: "56px", fontWeight: 800, letterSpacing: "1px", lineHeight: 1.05, textShadow: "0 3px 22px rgba(0,0,0,0.6)" }}>מכסיקו 22</h1>
        <div style={{ margin: "12px 0 4px", fontSize: "18px", fontWeight: 600, color: "#eef3fb", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>דרישה לכינוס אסיפה כללית</div>
        <div style={{ margin: "0 0 26px", fontSize: "14px", color: "#cdd8ec" }}>חתימה דיגיטלית לפי דירה</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#cdd8ec" }}>
          <span style={{
            width: "18px", height: "18px", borderRadius: "50%",
            border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
            display: "inline-block", animation: "mx-spin 0.8s linear infinite",
          }} />
          טוען חתימות שמורות...
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {/* שכבת רקע קבועה + באנרים בצדדים (דסקטופ) */}
      <div className="bg-fixed">
        <div className="side-banner side-left" />
        <div className="side-banner side-right" />
      </div>

      {/* גיליון התוכן הצף מעל רקע החצר */}
      <div className="sheet" style={{ minHeight: "100vh", background: colors.bg }}>
      {/* Header — hero עם צילום החצר מאחורי שכבת הכחול */}
      <div style={{
        backgroundImage: `linear-gradient(rgba(26,37,64,0.78), rgba(26,37,64,0.90)), url("/yard-2.jpg")`,
        backgroundSize: "cover", backgroundPosition: "center",
        color: "#fff", padding: "28px 24px 20px", textAlign: "center",
      }}>
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

      {dbError && (
        <div style={{ background: "#fdecea", color: "#b3261e", padding: "10px 16px", fontSize: "13px", textAlign: "center", borderBottom: "1px solid #f5c6cb" }}>
          ⚠️ {dbError}
        </div>
      )}

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
            <div style={{ marginTop: "14px", padding: "18px 18px 20px", borderRadius: "6px", background: "#f4f6fb", fontSize: "13.5px", lineHeight: "1.8", color: "#2a3242", textAlign: "right" }}>
              {/* לכבוד */}
              <div style={{ marginBottom: "14px" }}>
                {LETTER_TO.map((line, i) => (
                  <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{line}</div>
                ))}
              </div>

              {/* הנדון */}
              <div style={{ fontWeight: 700, color: colors.header, textDecoration: "underline", textUnderlineOffset: "3px", marginBottom: "14px" }}>
                {LETTER_SUBJECT}
              </div>

              {/* פתיחה */}
              <p style={{ margin: "0 0 14px", textAlign: "justify" }}>{LETTER_INTRO}</p>

              {/* סדר היום */}
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>סדר היום המוצע לאסיפה:</div>
              <div style={{ paddingInlineStart: "4px", marginBottom: "14px" }}>
                {AGENDA.split("\n").map((line, i) => (
                  <div key={i} style={{ lineHeight: "1.9" }}>{line}</div>
                ))}
              </div>

              {/* סיום */}
              <p style={{ margin: "0 0 16px", textAlign: "justify" }}>{LETTER_OUTRO}</p>

              {/* חתימה */}
              <div>
                {LETTER_SIGNOFF.map((line, i) => (
                  <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{line}</div>
                ))}
              </div>
            </div>
          </div>

          {/* גלריית החצר — נראית בכל מכשיר, גם במובייל */}
          <div style={{ background: colors.card, borderRadius: "12px", padding: "14px", marginBottom: "16px", border: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: colors.header, marginBottom: "10px" }}>🌳 החצר המשותפת המשופצת</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {["/yard-1.jpg", "/yard-2.jpg", "/yard-3.jpg"].map((src, i) => (
                <img key={i} src={src} alt={`החצר ${i + 1}`} loading="lazy"
                  style={{ width: "100%", height: "82px", objectFit: "cover", borderRadius: "8px", display: "block" }} />
              ))}
            </div>
            <div style={{ marginTop: "8px", fontSize: "11px", color: colors.muted, textAlign: "center" }}>* התמונות להמחשה בלבד</div>
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
                    {/* באנר חצר — נראה תמיד בזמן החתימה */}
                    <div style={{
                      position: "relative", height: "92px", borderRadius: "8px", overflow: "hidden", marginBottom: "14px",
                      backgroundImage: `url("/yard-3.jpg")`, backgroundSize: "cover", backgroundPosition: "center",
                    }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(14,19,32,0.15), rgba(14,19,32,0.55))" }} />
                      <div style={{ position: "absolute", right: "12px", bottom: "9px", color: "#fff", fontWeight: 700, fontSize: "16px", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
                        מכסיקו 22 · דירה {s.apt}
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ fontSize: "12px", color: colors.muted, display: "block", marginBottom: "3px" }}>שם בעל הדירה *</label>
                      <input value={s.name} onChange={e => updateSig(s.apt, "name", e.target.value)} placeholder="שם מלא"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${colors.border}`, fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }} />
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
              📄 הורד / הדפס מסמך PDF (שמור כ-PDF)
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
      </div>{/* .sheet */}
    </div>
  );
}
