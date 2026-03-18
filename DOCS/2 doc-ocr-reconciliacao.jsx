import { useState, useRef, useCallback } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = v => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Math.abs(v ?? 0));
const uid = () => Math.random().toString(36).slice(2, 9);

const DOC_TYPES = { fatura: { label: "Fatura", icon: "🧾", color: "#e8734a" }, recibo: { label: "Recibo", icon: "📋", color: "#4a9e6b" }, extrato: { label: "Extrato Bancário", icon: "🏦", color: "#4a7ec2" }, desconhecido: { label: "Desconhecido", icon: "📄", color: "#6b7280" } };

const MATCH_COLORS = { exato: "#4a9e6b", aproximado: "#f59e0b", sem_match: "#e8734a" };

// ── OCR via Claude Vision ─────────────────────────────────────────────────────
async function extractDocumentData(base64, mimeType, filename) {
  const prompt = `Analisa este documento financeiro português e extrai os dados estruturados.

Responde APENAS com JSON válido, sem texto extra, sem markdown, sem \`\`\`.

Formato obrigatório:
{
  "tipo": "fatura" | "recibo" | "extrato" | "desconhecido",
  "numero": "string ou null",
  "data": "YYYY-MM-DD ou null",
  "emitente": { "nome": "string", "nif": "string ou null", "iban": "string ou null" },
  "destinatario": { "nome": "string ou null", "nif": "string ou null" },
  "valor_total": number ou null,
  "valor_base": number ou null,
  "iva": number ou null,
  "descricao": "string resumindo o documento",
  "linhas": [{ "descricao": "string", "quantidade": number, "preco_unitario": number, "total": number }],
  "movimentos_bancarios": [{ "data": "YYYY-MM-DD", "descricao": "string", "valor": number, "tipo": "credito"|"debito" }],
  "confianca": "alta" | "media" | "baixa",
  "notas_ocr": "observações sobre qualidade ou ambiguidades"
}

Para faturas/recibos: preenche emitente, destinatario, valor_total, iva, linhas.
Para extratos bancários: preenche movimentos_bancarios (valor positivo=crédito, negativo=débito).
Valores monetários: sempre número, sem símbolo de moeda.
NIF português: 9 dígitos.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
  const data = await resp.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { tipo: "desconhecido", descricao: filename, confianca: "baixa", notas_ocr: "Falha no parse JSON: " + text.slice(0, 120) };
  }
}

// ── Reconciliation engine ─────────────────────────────────────────────────────
function reconcile(documents) {
  const faturas = documents.filter(d => d.extracted?.tipo === "fatura" || d.extracted?.tipo === "recibo");
  const extratos = documents.filter(d => d.extracted?.tipo === "extrato");
  const results = [];

  for (const fat of faturas) {
    const val = fat.extracted?.valor_total;
    if (!val) continue;
    let best = null, bestDiff = Infinity;
    for (const ext of extratos) {
      for (const mov of (ext.extracted?.movimentos_bancarios || [])) {
        const diff = Math.abs(Math.abs(mov.valor) - val);
        if (diff < bestDiff) { bestDiff = diff; best = { extrato: ext, movimento: mov }; }
      }
    }
    const status = !best ? "sem_match" : bestDiff < 0.01 ? "exato" : bestDiff < val * 0.02 ? "aproximado" : "sem_match";
    results.push({ fatura: fat, match: best, diff: bestDiff, status });
  }
  return results;
}

// ── File → base64 ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Components ────────────────────────────────────────────────────────────────
function ConfidencePill({ level }) {
  const map = { alta: ["#4a9e6b", "● Alta"], media: ["#f59e0b", "◐ Média"], baixa: ["#e8734a", "○ Baixa"] };
  const [color, label] = map[level] || ["#6b7280", "? —"];
  return <span style={{ fontSize: 10, color, border: `1px solid ${color}44`, padding: "1px 7px", borderRadius: 2 }}>{label}</span>;
}

function DocCard({ doc, onSelect, selected }) {
  const tipo = doc.extracted?.tipo || "desconhecido";
  const meta = DOC_TYPES[tipo] || DOC_TYPES.desconhecido;
  const isLoading = doc.status === "processing";
  const isError = doc.status === "error";

  return (
    <div onClick={() => !isLoading && onSelect(doc)}
      style={{ background: selected ? "rgba(126,184,247,0.08)" : "#141720", border: `1px solid ${selected ? "#7eb8f766" : "#1e2230"}`, borderLeft: `3px solid ${isLoading ? "#2d3242" : isError ? "#e8734a" : meta.color}`, borderRadius: 4, padding: "14px 16px", cursor: isLoading ? "wait" : "pointer", transition: "all 0.15s", opacity: isLoading ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>{isLoading ? "⏳" : isError ? "⚠️" : meta.icon}</span>
          <div>
            <div style={{ fontSize: 10, color: isLoading ? "#6b7280" : meta.color, letterSpacing: 1, textTransform: "uppercase" }}>
              {isLoading ? "A processar..." : isError ? "Erro OCR" : meta.label}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.filename}</div>
          </div>
        </div>
        {doc.extracted && <ConfidencePill level={doc.extracted.confianca} />}
      </div>

      {isLoading && (
        <div style={{ height: 2, background: "#1a1d24", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "60%", background: "#7eb8f7", borderRadius: 1, animation: "slide 1.2s ease-in-out infinite" }}></div>
        </div>
      )}

      {doc.extracted && !isLoading && (
        <>
          <div style={{ fontSize: 13, color: "#c8cdd8", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{doc.extracted.descricao?.slice(0, 60)}{doc.extracted.descricao?.length > 60 ? "…" : ""}</div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6b7280" }}>
            {doc.extracted.data && <span>📅 {doc.extracted.data}</span>}
            {doc.extracted.valor_total != null && <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{fmt(doc.extracted.valor_total)}</span>}
            {doc.extracted.emitente?.nif && <span>NIF {doc.extracted.emitente.nif}</span>}
            {(doc.extracted.movimentos_bancarios?.length > 0) && <span>{doc.extracted.movimentos_bancarios.length} mov.</span>}
          </div>
        </>
      )}

      {isError && <div style={{ fontSize: 11, color: "#e8734a" }}>{doc.error}</div>}
    </div>
  );
}

function DetailPanel({ doc, onClose }) {
  if (!doc) return null;
  const ex = doc.extracted;
  const tipo = ex?.tipo || "desconhecido";
  const meta = DOC_TYPES[tipo] || DOC_TYPES.desconhecido;

  return (
    <div style={{ background: "#141720", border: "1px solid #2d3242", borderRadius: 6, padding: 24, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 11, color: meta.color, letterSpacing: 1 }}>{meta.label.toUpperCase()}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{ex?.numero || doc.filename}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 20 }}>×</button>
      </div>

      {ex && (
        <>
          {/* Emitente / Destinatário */}
          {(ex.emitente?.nome || ex.destinatario?.nome) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {ex.emitente?.nome && (
                <div style={{ background: "#1a1d24", borderRadius: 3, padding: 12 }}>
                  <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginBottom: 6 }}>EMITENTE</div>
                  <div style={{ fontSize: 12, color: "#e2e8f0" }}>{ex.emitente.nome}</div>
                  {ex.emitente.nif && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>NIF {ex.emitente.nif}</div>}
                  {ex.emitente.iban && <div style={{ fontSize: 10, color: "#7eb8f7", marginTop: 3, wordBreak: "break-all" }}>{ex.emitente.iban}</div>}
                </div>
              )}
              {ex.destinatario?.nome && (
                <div style={{ background: "#1a1d24", borderRadius: 3, padding: 12 }}>
                  <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginBottom: 6 }}>DESTINATÁRIO</div>
                  <div style={{ fontSize: 12, color: "#e2e8f0" }}>{ex.destinatario.nome}</div>
                  {ex.destinatario.nif && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>NIF {ex.destinatario.nif}</div>}
                </div>
              )}
            </div>
          )}

          {/* Valores */}
          {ex.valor_total != null && (
            <div style={{ background: "#1a1d24", borderRadius: 3, padding: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {ex.valor_base != null && <div style={{ fontSize: 11, color: "#6b7280" }}>Base: {fmt(ex.valor_base)}</div>}
                {ex.iva != null && <div style={{ fontSize: 11, color: "#6b7280" }}>IVA: {fmt(ex.iva)}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1 }}>TOTAL</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: meta.color }}>{fmt(ex.valor_total)}</div>
              </div>
            </div>
          )}

          {/* Linhas de fatura */}
          {ex.linhas?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginBottom: 8 }}>LINHAS DO DOCUMENTO</div>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead><tr style={{ borderBottom: "1px solid #2d3242" }}>
                  {["Descrição", "Qtd", "P.Unit.", "Total"].map(h => <th key={h} style={{ padding: "4px 8px", textAlign: "left", color: "#4b5563", fontWeight: 500 }}>{h}</th>)}
                </tr></thead>
                <tbody>{ex.linhas.map((l, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1a1d24" }}>
                    <td style={{ padding: "6px 8px", color: "#c8cdd8" }}>{l.descricao}</td>
                    <td style={{ padding: "6px 8px", color: "#9ca3af" }}>{l.quantidade}</td>
                    <td style={{ padding: "6px 8px", color: "#9ca3af" }}>{fmt(l.preco_unitario)}</td>
                    <td style={{ padding: "6px 8px", color: "#e2e8f0", fontWeight: 600 }}>{fmt(l.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Movimentos bancários */}
          {ex.movimentos_bancarios?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginBottom: 8 }}>MOVIMENTOS BANCÁRIOS ({ex.movimentos_bancarios.length})</div>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {ex.movimentos_bancarios.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 8px", borderBottom: "1px solid #1a1d24", fontSize: 12 }}>
                    <div>
                      <div style={{ color: "#c8cdd8" }}>{m.descricao}</div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{m.data}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: m.tipo === "credito" || m.valor > 0 ? "#4a9e6b" : "#e8734a" }}>
                      {m.tipo === "credito" || m.valor > 0 ? "+" : ""}{fmt(m.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR notes */}
          {ex.notas_ocr && (
            <div style={{ background: "#1a1d24", borderRadius: 3, padding: 10, fontSize: 11, color: "#6b7280", borderLeft: "3px solid #2d3242" }}>
              <span style={{ color: "#4b5563" }}>OCR: </span>{ex.notas_ocr}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("documentos");
  const [dragging, setDragging] = useState(false);
  const [reconciliation, setReconciliation] = useState([]);
  const [reconciling, setReconciling] = useState(false);
  const fileRef = useRef();

  const processFiles = useCallback(async (files) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/tiff"];
    const valid = [...files].filter(f => allowed.includes(f.type) || f.name.match(/\.(pdf|png|jpg|jpeg|webp|tiff?)$/i));
    if (!valid.length) return;

    const newDocs = valid.map(f => ({ id: uid(), filename: f.name, status: "processing", file: f, extracted: null, error: null }));
    setDocs(prev => [...prev, ...newDocs]);

    for (const docEntry of newDocs) {
      try {
        let base64, mimeType;
        // PDFs: send first page as image via canvas trick (send as PDF directly)
        mimeType = docEntry.file.type === "application/pdf" ? "application/pdf" : docEntry.file.type || "image/jpeg";
        // Claude accepts PDFs as documents, images as images
        if (mimeType === "application/pdf") {
          base64 = await fileToBase64(docEntry.file);
          // Use document type for PDFs
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1000,
              messages: [{
                role: "user",
                content: [
                  { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
                  { type: "text", text: `Analisa este documento financeiro português e extrai os dados estruturados.\n\nResponde APENAS com JSON válido, sem texto extra, sem markdown, sem \`\`\`.\n\nFormato obrigatório:\n{\n  "tipo": "fatura" | "recibo" | "extrato" | "desconhecido",\n  "numero": "string ou null",\n  "data": "YYYY-MM-DD ou null",\n  "emitente": { "nome": "string", "nif": "string ou null", "iban": "string ou null" },\n  "destinatario": { "nome": "string ou null", "nif": "string ou null" },\n  "valor_total": number ou null,\n  "valor_base": number ou null,\n  "iva": number ou null,\n  "descricao": "string resumindo o documento",\n  "linhas": [{ "descricao": "string", "quantidade": number, "preco_unitario": number, "total": number }],\n  "movimentos_bancarios": [{ "data": "YYYY-MM-DD", "descricao": "string", "valor": number, "tipo": "credito"|"debito" }],\n  "confianca": "alta" | "media" | "baixa",\n  "notas_ocr": "observações sobre qualidade ou ambiguidades"\n}` }
                ]
              }]
            })
          });
          const data = await resp.json();
          const text = data.content?.map(b => b.text || "").join("") || "";
          let extracted;
          try { extracted = JSON.parse(text.replace(/```json|```/g, "").trim()); }
          catch { extracted = { tipo: "desconhecido", descricao: docEntry.filename, confianca: "baixa", notas_ocr: "Parse error: " + text.slice(0, 80) }; }
          setDocs(prev => prev.map(d => d.id === docEntry.id ? { ...d, status: "done", extracted } : d));
        } else {
          base64 = await fileToBase64(docEntry.file);
          const extracted = await extractDocumentData(base64, mimeType, docEntry.filename);
          setDocs(prev => prev.map(d => d.id === docEntry.id ? { ...d, status: "done", extracted } : d));
        }
      } catch (e) {
        setDocs(prev => prev.map(d => d.id === docEntry.id ? { ...d, status: "error", error: e.message } : d));
      }
    }
  }, []);

  const runReconciliation = useCallback(() => {
    setReconciling(true);
    const doneDocs = docs.filter(d => d.status === "done");
    setTimeout(() => {
      setReconciliation(reconcile(doneDocs));
      setReconciling(false);
      setTab("reconciliacao");
    }, 600);
  }, [docs]);

  const doneDocs = docs.filter(d => d.status === "done");
  const processingDocs = docs.filter(d => d.status === "processing");
  const stats = {
    faturas: doneDocs.filter(d => d.extracted?.tipo === "fatura").length,
    recibos: doneDocs.filter(d => d.extracted?.tipo === "recibo").length,
    extratos: doneDocs.filter(d => d.extracted?.tipo === "extrato").length,
    total_valor: doneDocs.filter(d => d.extracted?.valor_total).reduce((s, d) => s + (d.extracted.valor_total || 0), 0),
  };

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0b0e13", minHeight: "100vh", color: "#c8cdd8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .fade-up { animation: fadeUp 0.3s ease forwards; }
        .tab { background:none; border:none; color:#4b5563; padding:8px 16px; cursor:pointer; font-family:inherit; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; border-bottom:2px solid transparent; transition:all 0.2s; }
        .tab.on { color:#7eb8f7; border-bottom-color:#7eb8f7; }
        .tab:hover { color:#9ca3af; }
        .drop-zone { border:2px dashed #2d3242; border-radius:8px; padding:48px; text-align:center; transition:all 0.2s; cursor:pointer; }
        .drop-zone.over { border-color:#7eb8f7; background:rgba(126,184,247,0.04); }
        ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:#1a1d24} ::-webkit-scrollbar-thumb{background:#2d3242;border-radius:3px}
        .rec-row { background:#141720; border:1px solid #1e2230; border-radius:4px; padding:16px 18px; display:flex; align-items:center; gap:16px; transition:border-color 0.2s; }
        .rec-row:hover { border-color:#2d3242; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#0d1018", borderBottom: "1px solid #1e2230", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#4a9e6b,#2d6b47)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⬡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", letterSpacing: 2 }}>DOC·SCAN</div>
            <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 3 }}>OCR · EXTRACÇÃO · RECONCILIAÇÃO</div>
          </div>
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid #1e2230", marginBottom: -1 }}>
          {[["documentos", "Documentos"], ["reconciliacao", "Reconciliação"]].map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#4b5563" }}>
          {processingDocs.length > 0 && <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #f59e0b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
            {processingDocs.length} a processar
          </span>}
          {doneDocs.length > 0 && <span style={{ color: "#4a9e6b" }}>✓ {doneDocs.length} processados</span>}
        </div>
      </div>

      {tab === "documentos" && (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 0, height: "calc(100vh - 54px)" }}>
          {/* Left panel */}
          <div style={{ padding: "24px 28px", overflowY: "auto" }}>
            {/* Stats row */}
            {doneDocs.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {[
                  ["🧾", "Faturas", stats.faturas, "#e8734a"],
                  ["📋", "Recibos", stats.recibos, "#4a9e6b"],
                  ["🏦", "Extratos", stats.extratos, "#4a7ec2"],
                  ["💶", "Valor Total", fmt(stats.total_valor), "#7eb8f7"],
                ].map(([icon, label, val, color]) => (
                  <div key={label} style={{ flex: 1, background: "#141720", border: "1px solid #1e2230", borderTop: `2px solid ${color}`, borderRadius: 4, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1 }}>{icon} {label.toUpperCase()}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 4 }}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div className={`drop-zone ${dragging ? "over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current.click()}
              style={{ marginBottom: 20 }}>
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.tif" style={{ display: "none" }} onChange={e => processFiles(e.target.files)} />
              <div style={{ fontSize: 32, marginBottom: 12 }}>{dragging ? "📂" : "📤"}</div>
              <div style={{ fontSize: 15, color: "#e2e8f0", marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                {dragging ? "Largar documentos aqui" : "Arrastar ou clicar para carregar documentos"}
              </div>
              <div style={{ fontSize: 12, color: "#4b5563" }}>PDF · PNG · JPG · WEBP · TIFF — faturas, recibos, extratos bancários</div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 8 }}>Claude Vision analisa e extrai automaticamente: NIF, IBAN, datas, valores, linhas de fatura, movimentos bancários</div>
            </div>

            {/* Document grid */}
            {docs.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {docs.map((doc, i) => (
                    <div key={doc.id} className="fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                      <DocCard doc={doc} onSelect={setSelected} selected={selected?.id === doc.id} />
                    </div>
                  ))}
                </div>
                {doneDocs.length >= 2 && (
                  <div style={{ marginTop: 24, textAlign: "center" }}>
                    <button onClick={runReconciliation} disabled={reconciling || processingDocs.length > 0}
                      style={{ background: reconciling ? "#1e2230" : "linear-gradient(135deg,#4a9e6b,#2d6b47)", border: "none", color: "#fff", padding: "12px 32px", borderRadius: 4, cursor: reconciling ? "wait" : "pointer", fontFamily: "inherit", fontSize: 12, letterSpacing: 1.5, fontWeight: 500, transition: "opacity 0.2s", opacity: processingDocs.length > 0 ? 0.5 : 1 }}>
                      {reconciling ? "⏳ A reconciliar..." : `⇌ RECONCILIAR ${doneDocs.length} DOCUMENTOS`}
                    </button>
                    {processingDocs.length > 0 && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>Aguardar conclusão do processamento</div>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right detail panel */}
          {selected && (
            <div style={{ borderLeft: "1px solid #1e2230", padding: 20, overflowY: "auto" }}>
              <DetailPanel doc={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      )}

      {tab === "reconciliacao" && (
        <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 2 }}>// MOTOR DE RECONCILIAÇÃO</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e8f0", marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>
              Cruzamento Faturas/Recibos ↔ Extractos Bancários
            </div>
          </div>

          {reconciliation.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⇌</div>
              <div style={{ fontSize: 14, color: "#6b7280" }}>Nenhuma reconciliação calculada ainda.</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Carregue documentos e clique em "Reconciliar".</div>
            </div>
          ) : (
            <>
              {/* Summary pills */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[
                  ["exato", "Exact Match"],
                  ["aproximado", "Match Aproximado (≤2%)"],
                  ["sem_match", "Sem Correspondência"],
                ].map(([status, label]) => {
                  const count = reconciliation.filter(r => r.status === status).length;
                  return (
                    <div key={status} style={{ background: `${MATCH_COLORS[status]}18`, border: `1px solid ${MATCH_COLORS[status]}44`, borderRadius: 3, padding: "6px 14px", fontSize: 11, color: MATCH_COLORS[status], display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{count}</span>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Reconciliation rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reconciliation.map((r, i) => {
                  const fatMeta = DOC_TYPES[r.fatura.extracted?.tipo] || DOC_TYPES.desconhecido;
                  const color = MATCH_COLORS[r.status];
                  return (
                    <div key={i} className="rec-row fade-up" style={{ borderLeft: `3px solid ${color}44`, animationDelay: `${i * 0.06}s` }}>
                      {/* Fatura side */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginBottom: 4 }}>DOCUMENTO</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{fatMeta.icon}</span>
                          <div>
                            <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "'DM Sans',sans-serif" }}>{r.fatura.extracted?.descricao?.slice(0, 45) || r.fatura.filename}</div>
                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, display: "flex", gap: 8 }}>
                              {r.fatura.extracted?.data && <span>{r.fatura.extracted.data}</span>}
                              {r.fatura.extracted?.emitente?.nome && <span>{r.fatura.extracted.emitente.nome}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: fatMeta.color, marginTop: 6 }}>
                          {fmt(r.fatura.extracted?.valor_total)}
                        </div>
                      </div>

                      {/* Match status */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 80 }}>
                        <div style={{ fontSize: 20, color }}>
                          {r.status === "exato" ? "⇌" : r.status === "aproximado" ? "≈" : "✗"}
                        </div>
                        <div style={{ fontSize: 9, color, letterSpacing: 0.5, textAlign: "center", marginTop: 2 }}>
                          {r.status === "exato" ? "EXACT" : r.status === "aproximado" ? `Δ ${fmt(r.diff)}` : "SEM MATCH"}
                        </div>
                      </div>

                      {/* Movimento side */}
                      {r.match ? (
                        <div style={{ flex: 1, textAlign: "right" }}>
                          <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1, marginBottom: 4 }}>MOVIMENTO BANCÁRIO</div>
                          <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "'DM Sans',sans-serif" }}>{r.match.movimento.descricao?.slice(0, 45)}</div>
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{r.match.movimento.data} · {r.match.extrato.filename}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#4a7ec2", marginTop: 6 }}>
                            {fmt(r.match.movimento.valor)}
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex: 1, textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "#4b5563" }}>Nenhum movimento correspondente encontrado no extracto</div>
                          <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>Verifique se o extracto bancário do período foi carregado</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Export note */}
              <div style={{ marginTop: 24, padding: "12px 16px", background: "#141720", border: "1px solid #1e2230", borderRadius: 4, fontSize: 11, color: "#6b7280", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>💡</span>
                <span>Os resultados da reconciliação podem ser exportados via <strong style={{ color: "#9ca3af" }}>SAF-T</strong> ou enviados directamente para o <strong style={{ color: "#9ca3af" }}>Sage for Accountants</strong> através do bridge local na LAN.</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
