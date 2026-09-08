function calculatePnL(trade) {
  if (trade.exit === null || trade.exit === undefined) return null;
  const direction = trade.side === "long" ? 1 : -1;
  return (trade.exit - trade.entry) * direction * trade.quantity * trade.multiplier - trade.fees;
}
const formatNumber = value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
function formatPnL(value, currency) {
  if (value === null) return "Open";
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value)} ${currency}`;
}
function readNumber(id, optional = false) {
  const raw = $(id).value.trim();
  if (!raw && optional) return null;
  if (!raw) throw new Error(`Please enter ${id}.`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${id}.`);
  return value;
}
function readTradeForm() {
  const trade = {
    id: editingId || crypto.randomUUID(),
    symbol: normalizeSymbol($("trade-symbol").value),
    side: $("side").value,
    date: $("trade-date").value,
    exitDate: $("exit-date").value || null,
    entry: readNumber("entry"),
    target: readNumber("target", true),
    exit: readNumber("exit", true),
    quantity: readNumber("quantity"),
    multiplier: readNumber("multiplier"),
    fees: readNumber("fees"),
    currency: $("currency").value.trim().toUpperCase(),
    notes: $("notes").value.trim()
  };
  if (!validTrade(trade)) throw new Error("Check date, currency, quantity, multiplier, fees.");
  return trade;
}
function updatePreview() {
  const preview = $("pnl-preview"); preview.className = "";
  try {
    const trade = readTradeForm();
    const pnl = calculatePnL(trade);
    preview.textContent = pnl === null ? "Open trade" : formatPnL(pnl, trade.currency);
    if (pnl !== null) preview.className = pnl >= 0 ? "positive" : "negative";
  } catch { preview.textContent = "Enter trade details"; }
}
function resetTradeForm() {
  editingId = null; $("trade-form").reset();
  $("trade-symbol").value = state.selected;
  $("trade-date").value = localDate();
  $("currency").value = state.selected.startsWith("HKEX:") ? "HKD" : "USD";
  $("trade-title").textContent = "Add trade";
  $("submit-trade").textContent = "Save trade";
  formDirty = false; updatePreview();
}
function editTrade(trade) {
  if (formDirty && !confirm("Discard unsaved form changes?")) return;
  editingId = trade.id;
  const fields = {
    "trade-symbol": trade.symbol, "trade-date": trade.date, side: trade.side,
    entry: trade.entry, target: trade.target ?? "", exit: trade.exit ?? "",
    "exit-date": trade.exitDate ?? "", quantity: trade.quantity, multiplier: trade.multiplier,
    fees: trade.fees, currency: trade.currency, notes: trade.notes
  };
  for (const [id, value] of Object.entries(fields)) $(id).value = value;
  $("trade-title").textContent = "Edit trade";
  $("submit-trade").textContent = "Update trade";
  formDirty = false; updatePreview();
}
function renderJournal() {
  const body = $("journal-body"); body.replaceChildren();
  const trades = state.trades.filter(trade => !$("current-only").checked || trade.symbol === state.selected)
    .slice().sort((a, b) => b.date.localeCompare(a.date));
  $("journal-count").textContent = `${trades.length} shown · ${state.trades.length} saved`;
  $("journal-empty").hidden = trades.length > 0;
  for (const trade of trades) {
    const row = document.createElement("tr");
    const pnl = calculatePnL(trade);
    const values = [
      trade.date, trade.exitDate || "—", trade.symbol, trade.side.toUpperCase(),
      `${formatNumber(trade.quantity)} × ${formatNumber(trade.multiplier)}`,
      formatNumber(trade.entry), trade.target == null ? "—" : formatNumber(trade.target),
      trade.exit === null ? "—" : formatNumber(trade.exit), formatPnL(pnl, trade.currency)
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td"); cell.textContent = value;
      if (index === 2) cell.title = trade.notes || "No notes";
      if (index === 8 && pnl !== null) cell.className = pnl >= 0 ? "positive" : "negative";
      row.appendChild(cell);
    });
    const actions = document.createElement("td");
    const buttons = document.createElement("div"); buttons.className = "row";
    buttons.append(
      makeButton("Chart", () => selectSymbol(trade.symbol)),
      makeButton("Edit", () => editTrade(trade)),
      makeButton("Delete", () => {
        if (!confirm(`Delete this ${trade.symbol} trade?`)) return;
        state.trades = state.trades.filter(item => item.id !== trade.id);
        if (editingId === trade.id) resetTradeForm();
        persist(); renderJournal();
      }, "danger")
    );
    actions.appendChild(buttons); row.appendChild(actions); body.appendChild(row);
  }
}
$("trade-form").addEventListener("input", () => { formDirty = true; updatePreview(); });
$("trade-form").addEventListener("change", () => { formDirty = true; updatePreview(); });
$("trade-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const trade = readTradeForm();
    if (trade.symbol.endsWith("!")) throw new Error("Use a dated futures contract, not a continuous ! symbol.");
    if (editingId) state.trades = state.trades.map(item => item.id === editingId ? trade : item);
    else state.trades.push(trade);
    persist(); renderJournal(); resetTradeForm();
    toast(persistenceBlocked ? "Session only — export a backup." : "Trade saved.");
  } catch (error) { toast(error.message); }
});
$("reset-trade").addEventListener("click", () => {
  if (formDirty && !confirm("Discard unsaved form changes?")) return;
  resetTradeForm();
});
$("current-only").addEventListener("change", renderJournal);
window.addEventListener("beforeunload", event => {
  if (!formDirty) return;
  event.preventDefault(); event.returnValue = "";
});
$("symbol-input").value = state.selected;
$("current-symbol").textContent = state.selected;
renderMarkets(); renderIndicatorControls(); renderWatchlist();
resetTradeForm(); renderJournal(); renderChart(); loadQuote();
