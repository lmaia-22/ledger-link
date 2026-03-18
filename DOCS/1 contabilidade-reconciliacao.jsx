import { useState, useMemo } from "react";

const LANCAMENTOS = [
  { id: "L001", data: "2024-01-05", descricao: "Pagamento Fornecedor XYZ", valor: -1250.00, tipo: "saída", categoria: "Fornecedores", docRef: "FAT-2024-001", reconciliado: true },
  { id: "L002", data: "2024-01-08", descricao: "Recebimento Cliente ABC", valor: 3400.00, tipo: "entrada", categoria: "Clientes", docRef: "REC-2024-001", reconciliado: true },
  { id: "L003", data: "2024-01-12", descricao: "Despesa Material Escritório", valor: -87.50, tipo: "saída", categoria: "Despesas Gerais", docRef: "FAT-2024-002", reconciliado: true },
  { id: "L004", data: "2024-01-15", descricao: "Serviços de Consultoria", valor: 5200.00, tipo: "entrada", categoria: "Serviços", docRef: "REC-2024-002", reconciliado: true },
  { id: "L005", data: "2024-01-18", descricao: "Renda do Escritório", valor: -900.00, tipo: "saída", categoria: "Rendas", docRef: null, reconciliado: false },
  { id: "L006", data: "2024-01-22", descricao: "Extrato Bancário - Transferência", valor: -2300.00, tipo: "saída", categoria: "Transferências", docRef: "EXT-2024-001", reconciliado: true },
  { id: "L007", data: "2024-01-25", descricao: "Venda Produto Digital", valor: 750.00, tipo: "entrada", categoria: "Vendas", docRef: "FAT-2024-003", reconciliado: true },
  { id: "L008", data: "2024-01-28", descricao: "Seguro Empresarial", valor: -432.00, tipo: "saída", categoria: "Seguros", docRef: null, reconciliado: false },
  { id: "L009", data: "2024-02-02", descricao: "Recebimento Projeto Web", valor: 4800.00, tipo: "entrada", categoria: "Serviços", docRef: "REC-2024-003", reconciliado: true },
  { id: "L010", data: "2024-02-05", descricao: "Compra Equipamento", valor: -1890.00, tipo: "saída", categoria: "Imobilizado", docRef: "FAT-2024-004", reconciliado: true },
  { id: "L011", data: "2024-02-10", descricao: "Comissão Comercial", valor: -340.00, tipo: "saída", categoria: "Pessoal", docRef: null, reconciliado: false },
  { id: "L012", data: "2024-02-14", descricao: "Extrato Bancário - Juro", valor: 12.30, tipo: "entrada", categoria: "Financeiro", docRef: "EXT-2024-002", reconciliado: true },
];

const DOCUMENTOS = [
  { id: "FAT-2024-001", tipo: "Fatura", emitente: "Fornecedor XYZ, Lda", data: "2024-01-04", valor: 1250.00, descricao: "Serviços de Manutenção TI", estado: "pago", lancRef: "L001", ficheiro: "fatura_xyz_001.pdf" },
  { id: "FAT-2024-002", tipo: "Fatura", emitente: "Papelaria Central", data: "2024-01-11", valor: 87.50, descricao: "Material de Escritório", estado: "pago", lancRef: "L003", ficheiro: "fatura_papelaria_002.pdf" },
  { id: "FAT-2024-003", tipo: "Fatura", emitente: "Empresa Própria", data: "2024-01-25", valor: 750.00, descricao: "Licença Software Digital", estado: "pago", lancRef: "L007", ficheiro: "fatura_digital_003.pdf" },
  { id: "FAT-2024-004", tipo: "Fatura", emitente: "TechStore Portugal", data: "2024-02-04", valor: 1890.00, descricao: "Monitor 4K + Acessórios", estado: "pago", lancRef: "L010", ficheiro: "fatura_techstore_004.pdf" },
  { id: "REC-2024-001", tipo: "Recibo", emitente: "Cliente ABC, SA", data: "2024-01-08", valor: 3400.00, descricao: "Serviços Prestados Jan/2024", estado: "recebido", lancRef: "L002", ficheiro: "recibo_abc_001.pdf" },
  { id: "REC-2024-002", tipo: "Recibo", emitente: "Consultoria DEF", data: "2024-01-15", valor: 5200.00, descricao: "Consultoria Estratégica Q1", estado: "recebido", lancRef: "L004", ficheiro: "recibo_def_002.pdf" },
  { id: "REC-2024-003", tipo: "Recibo", emitente: "Cliente GHI, Lda", data: "2024-02-01", valor: 4800.00, descricao: "Desenvolvimento Web - Fase 2", estado: "recebido", lancRef: "L009", ficheiro: "recibo_ghi_003.pdf" },
  { id: "EXT-2024-001", tipo: "Extrato Bancário", emitente: "Banco Comercial Portugal", data: "2024-01-22", valor: 2300.00, descricao: "Transferência para Fornecedor", estado: "processado", lancRef: "L006", ficheiro: "extrato_jan_2024.pdf" },
  { id: "EXT-2024-002", tipo: "Extrato Bancário", emitente: "Banco Comercial Portugal", data: "2024-02-14", valor: 12.30, descricao: "Juro de Depósito a Prazo", estado: "processado", lancRef: "L012", ficheiro: "extrato_fev_2024.pdf" },
];

const tipoIcon = { "Fatura": "🧾", "Recibo": "📋", "Extrato Bancário": "🏦" };
const tipoColor = { "Fatura": "#e8734a", "Recibo": "#4a9e6b", "Extrato Bancário": "#4a7ec2" };

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedLanc, setSelectedLanc] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState(null);

  const totalEntradas = LANCAMENTOS.filter(l => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const totalSaidas = Math.abs(LANCAMENTOS.filter(l => l.tipo === "saída").reduce((s, l) => s + l.valor, 0));
  const reconciliados = LANCAMENTOS.filter(l => l.reconciliado).length;
  const porReconciliar = LANCAMENTOS.filter(l => !l.reconciliado).length;

  const lancamentosFiltrados = useMemo(() => {
    return LANCAMENTOS.filter(l => {
      if (filterTipo !== "todos" && l.tipo !== filterTipo) return false;
      if (filterEstado === "reconciliado" && !l.reconciliado) return false;
      if (filterEstado === "pendente" && l.reconciliado) return false;
      if (searchTerm && !l.descricao.toLowerCase().includes(searchTerm.toLowerCase()) && !l.id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [filterTipo, filterEstado, searchTerm]);

  const docsFiltrados = useMemo(() => {
    return DOCUMENTOS.filter(d => {
      if (searchTerm && !d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) && !d.id.toLowerCase().includes(searchTerm.toLowerCase()) && !d.emitente.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [searchTerm]);

  const getDocForLanc = (lancamento) => DOCUMENTOS.find(d => d.id === lancamento.docRef);
  const getLancForDoc = (doc) => LANCAMENTOS.find(l => l.id === doc.lancRef);

  const fmt = (v) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Math.abs(v));

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace", background: "#0d0f14", minHeight: "100vh", color: "#c8cdd8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #1a1d24; }
        ::-webkit-scrollbar-thumb { background: #2d3242; border-radius: 3px; }
        .tab-btn { background: transparent; border: 1px solid transparent; color: #6b7280; padding: 8px 18px; cursor: pointer; font-family: inherit; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; transition: all 0.2s; border-radius: 2px; }
        .tab-btn:hover { color: #c8cdd8; border-color: #2d3242; }
        .tab-btn.active { color: #7eb8f7; border-color: #7eb8f7; background: rgba(126,184,247,0.08); }
        .card { background: #141720; border: 1px solid #1e2230; border-radius: 4px; }
        .row-hover:hover { background: rgba(126,184,247,0.04) !important; cursor: pointer; }
        .badge { padding: 2px 8px; border-radius: 2px; font-size: 10px; letter-spacing: 0.5px; font-weight: 600; }
        .filter-btn { background: transparent; border: 1px solid #2d3242; color: #6b7280; padding: 5px 12px; cursor: pointer; font-family: inherit; font-size: 11px; border-radius: 2px; transition: all 0.2s; }
        .filter-btn:hover, .filter-btn.active { border-color: #7eb8f7; color: #7eb8f7; background: rgba(126,184,247,0.06); }
        .link-btn { background: transparent; border: 1px solid #3d4455; color: #9ca3af; padding: 4px 10px; cursor: pointer; font-family: inherit; font-size: 10px; border-radius: 2px; transition: all 0.2s; }
        .link-btn:hover { border-color: #7eb8f7; color: #7eb8f7; }
        .search-input { background: #1a1d24; border: 1px solid #2d3242; color: #c8cdd8; padding: 8px 14px 8px 36px; font-family: inherit; font-size: 12px; border-radius: 2px; width: 260px; outline: none; transition: border-color 0.2s; }
        .search-input:focus { border-color: #7eb8f7; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal { background: #141720; border: 1px solid #2d3242; border-radius: 6px; padding: 28px; width: 520px; max-height: 80vh; overflow-y: auto; }
        .connector-line { stroke: #7eb8f7; stroke-width: 1.5; stroke-dasharray: 4,3; opacity: 0.6; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .pulse { animation: pulse 2s infinite; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2230", padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#7eb8f7,#4a7ec2)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⬡</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", letterSpacing: 1 }}>LEDGER LINK</div>
              <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 2 }}>RECONCILIAÇÃO CONTABILÍSTICA</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["dashboard","lançamentos","documentos","reconciliação"].map(t => (
              <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#4b5563" }}>
            <div className="pulse" style={{ width: 6, height: 6, background: "#4a9e6b", borderRadius: "50%" }}></div>
            SISTEMA ACTIVO
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#4b5563", letterSpacing: 2, marginBottom: 4 }}>// VISÃO GERAL DO PERÍODO</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>Janeiro – Fevereiro 2024</div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Entradas", value: fmt(totalEntradas), color: "#4a9e6b", icon: "↑", sub: `${LANCAMENTOS.filter(l=>l.tipo==="entrada").length} lançamentos` },
                { label: "Total Saídas", value: fmt(totalSaidas), color: "#e8734a", icon: "↓", sub: `${LANCAMENTOS.filter(l=>l.tipo==="saída").length} lançamentos` },
                { label: "Reconciliados", value: `${reconciliados}/${LANCAMENTOS.length}`, color: "#7eb8f7", icon: "✓", sub: `${Math.round(reconciliados/LANCAMENTOS.length*100)}% do total` },
                { label: "Por Reconciliar", value: porReconciliar, color: "#f59e0b", icon: "!", sub: `Requer atenção` },
              ].map((kpi, i) => (
                <div key={i} className="card" style={{ padding: "18px 20px", borderLeft: `3px solid ${kpi.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" }}>{kpi.label}</div>
                    <div style={{ fontSize: 16, color: kpi.color }}>{kpi.icon}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, margin: "8px 0 4px" }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, color: "#4b5563" }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Two column layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Lançamentos recentes */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Lançamentos Recentes</div>
                {LANCAMENTOS.slice(-5).reverse().map(l => {
                  const doc = getDocForLanc(l);
                  return (
                    <div key={l.id} onClick={() => { setSelectedLanc(l); setActiveTab("lançamentos"); }}
                      className="row-hover"
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: "1px solid #1a1d24", cursor: "pointer" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.tipo === "entrada" ? "#4a9e6b" : "#e8734a", flexShrink: 0 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#c8cdd8" }}>{l.descricao}</div>
                        <div style={{ fontSize: 10, color: "#4b5563" }}>{l.data} · {l.categoria}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: l.tipo === "entrada" ? "#4a9e6b" : "#e8734a" }}>
                          {l.tipo === "entrada" ? "+" : "-"}{fmt(l.valor)}
                        </div>
                        {doc ? <div style={{ fontSize: 10, color: "#7eb8f7" }}>🔗 {doc.id}</div> : <div style={{ fontSize: 10, color: "#f59e0b" }}>⚠ sem doc</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Documentos por tipo */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Documentos por Tipo</div>
                {["Fatura", "Recibo", "Extrato Bancário"].map(tipo => {
                  const docs = DOCUMENTOS.filter(d => d.tipo === tipo);
                  const total = docs.reduce((s, d) => s + d.valor, 0);
                  const pct = Math.round(docs.length / DOCUMENTOS.length * 100);
                  return (
                    <div key={tipo} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{tipoIcon[tipo]}</span>
                          <span style={{ fontSize: 12, color: "#c8cdd8" }}>{tipo}</span>
                          <span className="badge" style={{ background: `${tipoColor[tipo]}22`, color: tipoColor[tipo] }}>{docs.length}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{fmt(total)}</span>
                      </div>
                      <div style={{ height: 3, background: "#1a1d24", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: tipoColor[tipo], borderRadius: 2, transition: "width 0.8s ease" }}></div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ borderTop: "1px solid #1e2230", paddingTop: 16, marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Estado de Reconciliação</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: reconciliados, height: 8, background: "#4a9e6b", borderRadius: "2px 0 0 2px" }}></div>
                    <div style={{ flex: porReconciliar, height: 8, background: "#f59e0b", borderRadius: "0 2px 2px 0" }}></div>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "#6b7280" }}>
                    <span>● <span style={{ color: "#4a9e6b" }}>{reconciliados} reconciliados</span></span>
                    <span>● <span style={{ color: "#f59e0b" }}>{porReconciliar} pendentes</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LANÇAMENTOS */}
        {activeTab === "lançamentos" && (
          <div className="fade-in">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", letterSpacing: 2 }}>// LIVRO DE LANÇAMENTOS</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>Todos os Movimentos</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 12 }}>⌕</span>
                  <input className="search-input" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {["todos","entrada","saída"].map(f => (
                  <button key={f} className={`filter-btn ${filterTipo === f ? "active" : ""}`} onClick={() => setFilterTipo(f)}>{f}</button>
                ))}
                {["todos","reconciliado","pendente"].map(f => (
                  <button key={f} className={`filter-btn ${filterEstado === f ? "active" : ""}`} onClick={() => setFilterEstado(f)}>{f}</button>
                ))}
              </div>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2d3242", background: "#1a1d24" }}>
                    {["ID","Data","Descrição","Categoria","Valor","Documento","Estado"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, color: "#6b7280", letterSpacing: 1, fontWeight: 500, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentosFiltrados.map((l, i) => {
                    const doc = getDocForLanc(l);
                    const isSelected = selectedLanc?.id === l.id;
                    return (
                      <tr key={l.id}
                        className="row-hover"
                        onClick={() => setSelectedLanc(isSelected ? null : l)}
                        onMouseEnter={() => setHoveredRow(l.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{ borderBottom: "1px solid #1a1d24", background: isSelected ? "rgba(126,184,247,0.07)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", transition: "background 0.15s" }}>
                        <td style={{ padding: "12px 16px", color: "#7eb8f7", fontFamily: "monospace", fontSize: 11 }}>{l.id}</td>
                        <td style={{ padding: "12px 16px", color: "#9ca3af" }}>{l.data}</td>
                        <td style={{ padding: "12px 16px", color: "#e2e8f0", fontFamily: "'IBM Plex Sans', sans-serif" }}>{l.descricao}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className="badge" style={{ background: "#1e2230", color: "#9ca3af", border: "1px solid #2d3242" }}>{l.categoria}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: l.tipo === "entrada" ? "#4a9e6b" : "#e8734a" }}>
                          {l.tipo === "entrada" ? "+" : "-"}{fmt(l.valor)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {doc ? (
                            <span onClick={e => { e.stopPropagation(); setSelectedDoc(doc); }}
                              style={{ color: "#7eb8f7", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                              <span>{tipoIcon[doc.tipo]}</span>
                              <span style={{ textDecoration: "underline" }}>{doc.id}</span>
                            </span>
                          ) : (
                            <span style={{ color: "#f59e0b", fontSize: 11 }}>⚠ Não associado</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span className="badge" style={{ background: l.reconciliado ? "#4a9e6b22" : "#f59e0b22", color: l.reconciliado ? "#4a9e6b" : "#f59e0b", border: `1px solid ${l.reconciliado ? "#4a9e6b44" : "#f59e0b44"}` }}>
                            {l.reconciliado ? "✓ reconciliado" : "⏳ pendente"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedLanc && (() => {
              const doc = getDocForLanc(selectedLanc);
              return (
                <div className="card fade-in" style={{ marginTop: 16, padding: 20, borderColor: "#7eb8f744", borderLeft: "3px solid #7eb8f7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Detalhe · {selectedLanc.id}</div>
                    <button onClick={() => setSelectedLanc(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 4 }}>LANÇAMENTO</div>
                      {[["ID", selectedLanc.id], ["Data", selectedLanc.data], ["Descrição", selectedLanc.descricao], ["Valor", (selectedLanc.tipo === "entrada" ? "+" : "-") + fmt(selectedLanc.valor)], ["Categoria", selectedLanc.categoria]].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12 }}>
                          <span style={{ color: "#6b7280", minWidth: 80 }}>{k}:</span>
                          <span style={{ color: "#c8cdd8" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 4 }}>DOCUMENTO ASSOCIADO</div>
                      {doc ? (
                        <>
                          {[["Tipo", `${tipoIcon[doc.tipo]} ${doc.tipo}`], ["Referência", doc.id], ["Emitente", doc.emitente], ["Data Doc.", doc.data], ["Valor", fmt(doc.valor)], ["Ficheiro", "📄 " + doc.ficheiro]].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12 }}>
                              <span style={{ color: "#6b7280", minWidth: 80 }}>{k}:</span>
                              <span style={{ color: "#c8cdd8" }}>{v}</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 8, padding: "6px 10px", background: "#4a9e6b11", border: "1px solid #4a9e6b33", borderRadius: 2, fontSize: 11, color: "#4a9e6b" }}>
                            ✓ Valores coincidem · Reconciliação válida
                          </div>
                        </>
                      ) : (
                        <div style={{ padding: "12px", background: "#f59e0b11", border: "1px solid #f59e0b33", borderRadius: 2, fontSize: 12, color: "#f59e0b" }}>
                          ⚠ Nenhum documento associado a este lançamento.<br />
                          <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "block" }}>Aceda ao separador Reconciliação para associar manualmente.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* DOCUMENTOS */}
        {activeTab === "documentos" && (
          <div className="fade-in">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", letterSpacing: 2 }}>// ARQUIVO DOCUMENTAL</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>Faturas, Recibos & Extratos</div>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 12 }}>⌕</span>
                <input className="search-input" placeholder="Pesquisar documentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {docsFiltrados.map(doc => {
                const lanc = getLancForDoc(doc);
                return (
                  <div key={doc.id} className="card row-hover fade-in" onClick={() => setSelectedDoc(doc)}
                    style={{ padding: 18, borderTop: `3px solid ${tipoColor[doc.tipo]}`, transition: "transform 0.15s, box-shadow 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{tipoIcon[doc.tipo]}</span>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: tipoColor[doc.tipo] }}>{doc.tipo.toUpperCase()}</div>
                          <div style={{ fontSize: 13, fontFamily: "monospace", color: "#7eb8f7" }}>{doc.id}</div>
                        </div>
                      </div>
                      <span className="badge" style={{ background: "#4a9e6b22", color: "#4a9e6b", border: "1px solid #4a9e6b44" }}>
                        ✓ {doc.estado}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#c8cdd8", fontFamily: "'IBM Plex Sans', sans-serif", marginBottom: 8 }}>{doc.descricao}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>{doc.emitente}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e2230", paddingTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#4b5563" }}>DATA</div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{doc.data}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#4b5563" }}>VALOR</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: tipoColor[doc.tipo] }}>{fmt(doc.valor)}</div>
                      </div>
                    </div>
                    {lanc && (
                      <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(126,184,247,0.06)", border: "1px solid rgba(126,184,247,0.15)", borderRadius: 2, fontSize: 11, color: "#7eb8f7", display: "flex", gap: 6, alignItems: "center" }}>
                        🔗 Lançamento: <strong>{lanc.id}</strong> · {lanc.descricao.substring(0, 25)}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RECONCILIAÇÃO */}
        {activeTab === "reconciliação" && (
          <div className="fade-in">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#4b5563", letterSpacing: 2 }}>// MOTOR DE RECONCILIAÇÃO</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>Cruzamento Lançamentos ↔ Documentos</div>
            </div>

            {/* Reconciled pairs */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a9e6b", letterSpacing: 2, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>✓ PARES RECONCILIADOS</span>
                <span style={{ background: "#4a9e6b22", color: "#4a9e6b", padding: "1px 8px", borderRadius: 2, fontSize: 10 }}>{LANCAMENTOS.filter(l => l.reconciliado).length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {LANCAMENTOS.filter(l => l.reconciliado).map(lanc => {
                  const doc = getDocForLanc(lanc);
                  if (!doc) return null;
                  const match = Math.abs(lanc.valor) === doc.valor;
                  return (
                    <div key={lanc.id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, borderLeft: "3px solid #4a9e6b22" }}>
                      {/* Lançamento */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1 }}>LANÇAMENTO</div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lanc.descricao}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#7eb8f7" }}>{lanc.id}</span>
                          <span style={{ fontSize: 10, color: "#6b7280" }}>{lanc.data}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: lanc.tipo === "entrada" ? "#4a9e6b" : "#e8734a" }}>
                            {lanc.tipo === "entrada" ? "+" : "-"}{fmt(lanc.valor)}
                          </span>
                        </div>
                      </div>

                      {/* Connector */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <div style={{ fontSize: 16, color: match ? "#4a9e6b" : "#f59e0b" }}>{match ? "⇌" : "⚠"}</div>
                        <div style={{ fontSize: 9, color: match ? "#4a9e6b" : "#f59e0b", letterSpacing: 0.5 }}>{match ? "OK" : "DIFF"}</div>
                      </div>

                      {/* Documento */}
                      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1 }}>DOCUMENTO</div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.descricao}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: tipoColor[doc.tipo] }}>{fmt(doc.valor)}</span>
                          <span style={{ fontSize: 10, color: "#6b7280" }}>{doc.data}</span>
                          <span style={{ fontSize: 11, color: tipoColor[doc.tipo] }}>{tipoIcon[doc.tipo]} {doc.id}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 18, color: "#4a9e6b", flexShrink: 0 }}>✓</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending */}
            <div>
              <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: 2, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠ LANÇAMENTOS POR RECONCILIAR</span>
                <span style={{ background: "#f59e0b22", color: "#f59e0b", padding: "1px 8px", borderRadius: 2, fontSize: 10 }}>{porReconciliar}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {LANCAMENTOS.filter(l => !l.reconciliado).map(lanc => (
                  <div key={lanc.id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, borderLeft: "3px solid #f59e0b44" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1 }}>LANÇAMENTO SEM DOCUMENTO</div>
                      <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>{lanc.descricao}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#7eb8f7" }}>{lanc.id}</span>
                        <span style={{ fontSize: 10, color: "#6b7280" }}>{lanc.data}</span>
                        <span className="badge" style={{ background: "#1e2230", color: "#9ca3af", border: "1px solid #2d3242" }}>{lanc.categoria}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: lanc.tipo === "entrada" ? "#4a9e6b" : "#e8734a" }}>
                          {lanc.tipo === "entrada" ? "+" : "-"}{fmt(lanc.valor)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="link-btn" onClick={() => alert(`Funcionalidade: Associar documento ao lançamento ${lanc.id}`)}>
                        + Associar Documento
                      </button>
                      <button className="link-btn" onClick={() => alert(`Funcionalidade: Criar documento para lançamento ${lanc.id}`)}>
                        + Criar Documento
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Doc Detail Modal */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>{tipoIcon[selectedDoc.tipo]}</span>
                <div>
                  <div style={{ fontSize: 11, color: tipoColor[selectedDoc.tipo], letterSpacing: 1 }}>{selectedDoc.tipo.toUpperCase()}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0", fontFamily: "monospace" }}>{selectedDoc.id}</div>
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>

            {[["Emitente", selectedDoc.emitente], ["Descrição", selectedDoc.descricao], ["Data", selectedDoc.data], ["Valor", fmt(selectedDoc.valor)], ["Estado", selectedDoc.estado], ["Ficheiro", "📄 " + selectedDoc.ficheiro]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #1e2230", fontSize: 13 }}>
                <span style={{ color: "#4b5563", minWidth: 90 }}>{k}</span>
                <span style={{ color: "#c8cdd8" }}>{v}</span>
              </div>
            ))}

            {(() => {
              const lanc = getLancForDoc(selectedDoc);
              return lanc ? (
                <div style={{ marginTop: 16, padding: 14, background: "rgba(126,184,247,0.06)", border: "1px solid rgba(126,184,247,0.2)", borderRadius: 4 }}>
                  <div style={{ fontSize: 10, color: "#7eb8f7", letterSpacing: 1, marginBottom: 8 }}>🔗 LANÇAMENTO ASSOCIADO</div>
                  {[["ID", lanc.id], ["Descrição", lanc.descricao], ["Data", lanc.data], ["Valor", (lanc.tipo === "entrada" ? "+" : "-") + fmt(lanc.valor)]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "#4b5563", minWidth: 80 }}>{k}:</span>
                      <span style={{ color: "#c8cdd8" }}>{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 16, padding: 12, background: "#f59e0b11", border: "1px solid #f59e0b33", borderRadius: 4, fontSize: 12, color: "#f59e0b" }}>
                  ⚠ Documento sem lançamento contabilístico associado
                </div>
              );
            })()}

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button onClick={() => setSelectedDoc(null)} style={{ flex: 1, padding: "9px", background: "#1e2230", border: "1px solid #2d3242", color: "#9ca3af", cursor: "pointer", borderRadius: 2, fontFamily: "inherit", fontSize: 12 }}>
                Fechar
              </button>
              <button style={{ flex: 1, padding: "9px", background: "rgba(126,184,247,0.1)", border: "1px solid #7eb8f755", color: "#7eb8f7", cursor: "pointer", borderRadius: 2, fontFamily: "inherit", fontSize: 12 }}>
                Abrir Ficheiro ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
