// ================================================================
// CHICK TRACKER — Google Sheets live-data version
// ================================================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbxurxUASa9a69XYd7jWji3quFy0mHkKpeJ3zQjWMeucTgksEcGUAeXoQLYzBOVlPQ1zOw/exec";

// Automatically re-check the Google Sheet every 5 minutes.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

let DATA = [];
let HATCH_WEEKLY = [];
let SETTINGS = {};
let WEEKLY = [];
let REGIONAL = [];

let weeklyChartInstance = null;
let regionChartInstance = null;
let hatchPctChartInstance = null;
let breedChartInstance = null;

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().split("T")[0];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function calculateMonthlyDOAAverages(data) {
  const monthly = {};

  data.forEach((row) => {
    const date = new Date(row["Hatch Date"] || row.HatchDate);
    if (isNaN(date.getTime())) return;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const doa = Number(row.DOA || 0);
    const qty = Number(row["Orig Qty"] || row.OriginalQty || 0);

    if (!monthly[monthKey]) {
      monthly[monthKey] = { monthKey, totalDOA: 0, totalQty: 0 };
    }

    monthly[monthKey].totalDOA += doa;
    monthly[monthKey].totalQty += qty;
  });

  return Object.values(monthly)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => ({
      ...m,
      avgDOA: m.totalQty > 0 ? Number(((m.totalDOA / m.totalQty) * 100).toFixed(2)) : 0,
    }));
}

function getWeeklyData() {
  const grouped = {};

  DATA.forEach((row) => {
    const week = Number(row.Week || 0);
    if (!week) return;

    const doa = Number(row.DOA || 0);
    const qty = Number(row["Orig Qty"] || row.OriginalQty || 0);
    const hatchDate = new Date(row["Hatch Date"] || row.HatchDate);
    const year = !isNaN(hatchDate.getTime()) ? hatchDate.getFullYear() : "";
    const month = !isNaN(hatchDate.getTime())
      ? hatchDate.toLocaleString("default", { month: "short" })
      : "";
    const key = `${year}-${week}`;

    if (!grouped[key]) {
      grouped[key] = { Year: year, Week: week, Month: month, totalDOA: 0, totalQty: 0 };
    }

    grouped[key].totalDOA += doa;
    grouped[key].totalQty += qty;
  });

  return Object.values(grouped)
    .map((w) => ({
      ...w,
      "DOA %": w.totalQty > 0 ? Number(((w.totalDOA / w.totalQty) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => (a.Year - b.Year) || (a.Week - b.Week));
}

function getRegionalData() {
  return Object.values(
    DATA.reduce((acc, row) => {
      const region = row.Region || "Unknown";
      if (!acc[region]) acc[region] = { Region: region, "Total DOA": 0 };
      acc[region]["Total DOA"] += Number(row.DOA || 0);
      return acc;
    }, {}),
  );
}

async function loadData({ silent = false } = {}) {
  try {
    const separator = API_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${API_URL}${separator}_=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();

    // New API shape. A legacy array is still accepted for shipments only.
    if (Array.isArray(payload)) {
      DATA = payload;
      HATCH_WEEKLY = [];
      SETTINGS = {};
    } else {
      DATA = Array.isArray(payload.shipments) ? payload.shipments : [];
      HATCH_WEEKLY = Array.isArray(payload.hatchWeekly) ? payload.hatchWeekly : [];
      SETTINGS = payload.settings || {};
    }

    WEEKLY = getWeeklyData();
    REGIONAL = getRegionalData();

    initDashboard();
    console.log(`Loaded ${DATA.length} shipments and ${HATCH_WEEKLY.length} hatch weeks.`);

    if (!silent && payload.updatedAt) {
      console.log("Sheet data updated:", payload.updatedAt);
    }
  } catch (error) {
    console.error("Unable to load Google Sheet data:", error);
    if (!silent) {
      alert("Could not load live Google Sheet data. Check the Apps Script deployment and API_URL in app.js.");
    }
  }
}

function renderWeeklyChart() {
  const canvas = document.getElementById("weeklyChart");
  if (!canvas) return;

  if (weeklyChartInstance) weeklyChartInstance.destroy();

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, "rgba(239, 68, 68, 0.9)");
  gradient.addColorStop(1, "rgba(239, 68, 68, 0.18)");

  const monthly = calculateMonthlyDOAAverages(DATA);
  const currentMonthAvg = monthly[monthly.length - 1]?.avgDOA || 0;
  const previousMonthAvg = monthly[monthly.length - 2]?.avgDOA || 0;

  weeklyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: WEEKLY.map((w) => `${w.Month} · Wk ${w.Week}`),
      datasets: [
        {
          type: "bar",
          label: "Weekly DOA %",
          data: WEEKLY.map((w) => w["DOA %"]),
          backgroundColor: gradient,
          borderRadius: 10,
          borderSkipped: false,
          hoverBackgroundColor: "rgba(220, 38, 38, 1)",
          maxBarThickness: 34,
        },
        {
          type: "line",
          label: `Current Month Avg Ship (${currentMonthAvg}%)`,
          data: WEEKLY.map(() => currentMonthAvg),
          borderColor: "#60a5fa",
          backgroundColor: "#60a5fa",
          borderWidth: 3,
          tension: 0,
          pointRadius: 0,
        },
        {
          type: "line",
          label: `Previous Month Avg Ship (${previousMonthAvg}%)`,
          data: WEEKLY.map(() => previousMonthAvg),
          borderColor: "#9ca3af",
          backgroundColor: "#9ca3af",
          borderDash: [6, 6],
          borderWidth: 2,
          tension: 0,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#d1d5db" } },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.raw}${context.dataset.type === "bar" ? "%" : ""}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          ticks: { callback: (value) => value + "%" },
        },
      },
    },
  });
}

function renderRegionChart() {
  const canvas = document.getElementById("regionChart");
  if (!canvas) return;
  if (regionChartInstance) regionChartInstance.destroy();

  const ctx = canvas.getContext("2d");
  const sorted = [...REGIONAL].sort((a, b) => b["Total DOA"] - a["Total DOA"]);
  const labels = sorted.map((r) => r.Region);
  const values = sorted.map((r) => r["Total DOA"]);

  regionChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total DOA",
          data: values,
          borderRadius: 10,
          borderSkipped: false,
          backgroundColor: (context) => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return "rgba(239, 68, 68, 0.7)";
            const gradient = ctx.createLinearGradient(0, 0, chartArea.right, 0);
            gradient.addColorStop(0, "rgba(239, 68, 68, 0.95)");
            gradient.addColorStop(1, "rgba(239, 68, 68, 0.25)");
            return gradient;
          },
          hoverBackgroundColor: "rgba(220, 38, 38, 1)",
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#fff",
          bodyColor: "#d1d5db",
          padding: 12,
          cornerRadius: 12,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#9ca3af" },
        },
        y: { grid: { display: false }, ticks: { color: "#d1d5db" } },
      },
      animation: { duration: 800 },
    },
  });
}

function openAddShipmentModal() {
  document.getElementById("shipment-modal").classList.remove("hidden");
}

function closeShipmentModal() {
  document.getElementById("shipment-modal").classList.add("hidden");
}

function getWeekNumber(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

async function saveShipment() {
  const shipment = {
    action: "addShipment",
    "Hatch Date": document.getElementById("new-date").value,
    "Customer Name": document.getElementById("new-customer").value,
    City: document.getElementById("new-city").value,
    State: document.getElementById("new-state").value,
    Region: document.getElementById("new-region").value,
    Phone: document.getElementById("new-phone").value,
    Breed: document.getElementById("new-breed").value,
    "Orig Qty": Number(document.getElementById("new-qty").value),
    DOA: Number(document.getElementById("new-doa").value),
    Week: getWeekNumber(document.getElementById("new-date").value),
    Notes: document.getElementById("new-notes").value,
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(shipment),
    });

    closeShipmentModal();
    alert("Shipment saved to Google Sheets.");
    setTimeout(() => loadData({ silent: true }), 1200);
  } catch (error) {
    console.error(error);
    alert("Error saving shipment.");
  }
}

function renderKPIs() {
  const totalDOA = DATA.reduce((sum, r) => sum + Number(r.DOA || 0), 0);
  const totalQty = DATA.reduce((sum, r) => sum + Number(r["Orig Qty"] || 0), 0);
  const totalSurvived = totalQty - totalDOA;
  const avgDOA = totalQty > 0 ? ((totalDOA / totalQty) * 100).toFixed(1) : "0.0";

  document.getElementById("kpi-avg-doa").textContent = avgDOA + "%";
  document.getElementById("kpi-doa").textContent = formatNumber(totalDOA);
  document.getElementById("kpi-survived").textContent = formatNumber(totalSurvived);
  document.getElementById("kpi-count").textContent = formatNumber(DATA.length);
}

function renderHatchKPIs() {
  const valid = HATCH_WEEKLY.filter((w) => Number(w.eggsSet || 0) > 0);
  const totalEggs = valid.reduce((s, w) => s + Number(w.eggsSet || 0), 0);
  const totalHatched = valid.reduce((s, w) => s + Number(w.hatched || 0), 0);
  const totalShipped = HATCH_WEEKLY.reduce((s, w) => s + Number(w.ship || 0), 0);
  const totalDelPu = HATCH_WEEKLY.reduce((s, w) => s + Number(w.delpu || 0), 0);
  const totalBirds = totalShipped + totalDelPu;
  const avg = totalEggs > 0 ? (totalHatched / totalEggs) * 100 : 0;

  document.getElementById("kpi-hatch-avg").textContent = `${avg.toFixed(1)}%`;
  document.getElementById("kpi-hatch-avg-sub").textContent = `weighted season average · ${valid.length} hatch dates`;
  document.getElementById("kpi-birds-out").textContent = formatNumber(totalBirds);
  document.getElementById("kpi-shipped").textContent = formatNumber(totalShipped);
  document.getElementById("kpi-delpu").textContent = formatNumber(totalDelPu);
  document.getElementById("kpi-shipped-sub").textContent = `${totalBirds ? ((totalShipped / totalBirds) * 100).toFixed(1) : "0.0"}% of total birds out`;
  document.getElementById("kpi-delpu-sub").textContent = `${totalBirds ? ((totalDelPu / totalBirds) * 100).toFixed(1) : "0.0"}% of total birds out`;
}

function doSearch() {
  const dateVal = document.getElementById("dateInput").value;
  const breed = document.getElementById("breedFilter").value;
  const region = document.getElementById("regionFilter").value;

  let results = DATA;
  if (dateVal) results = results.filter((r) => formatDate(r["Hatch Date"]) === dateVal);
  if (breed) results = results.filter((r) => r.Breed === breed);
  if (region) results = results.filter((r) => r.Region === region);

  renderTable(results, dateVal, breed, region);
}

function clearSearch() {
  document.getElementById("dateInput").value = "";
  document.getElementById("breedFilter").value = "";
  document.getElementById("regionFilter").value = "";
  document.getElementById("results-info").textContent = "";
  document.getElementById("results-tbody").innerHTML =
    `<tr><td colspan="12"><div class="empty-state"><div class="big">🔍</div><p>Select a hatch date or filter to view shipment records</p></div></td></tr>`;
}

function doaColor(pct) {
  if (pct >= 75) return "#e05a4a";
  if (pct >= 40) return "#d4934a";
  if (pct >= 20) return "#d4c04a";
  return "#7fc47a";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTable(results, dateVal, breed, region) {
  const info = document.getElementById("results-info");
  const tbody = document.getElementById("results-tbody");

  if (results.length === 0) {
    const desc = dateVal ? `hatch date ${dateVal}` : "those filters";
    info.innerHTML = `No records found for ${desc}`;
    tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state"><div class="big">🐣</div><p>No shipments found for ${desc}</p></div></td></tr>`;
    return;
  }

  const totalDOARes = results.reduce((s, r) => s + Number(r.DOA || 0), 0);
  const totalQty = results.reduce((s, r) => s + Number(r["Orig Qty"] || 0), 0);
  const filters = [
    dateVal && `hatch date <span>${escapeHtml(dateVal)}</span>`,
    breed && `breed <span>${escapeHtml(breed)}</span>`,
    region && `region <span>${escapeHtml(region)}</span>`,
  ].filter(Boolean);

  info.innerHTML = `Showing <span>${results.length}</span> records ${filters.length ? "— filtered by " + filters.join(", ") : "— all records"} · Total DOA: <span>${formatNumber(totalDOARes)}</span> of <span>${formatNumber(totalQty)}</span> shipped`;

  tbody.innerHTML = results
    .map((r) => {
      const qty = Number(r["Orig Qty"] || 0);
      const doa = Number(r.DOA || 0);
      const pct = qty > 0 ? (doa / qty) * 100 : 0;
      const color = doaColor(pct);
      const breedKey = r.Breed === "Rhode Island" ? "Rhode" : r.Breed;
      const rawPhone = String(r.Phone || "").replace(/\D/g, "");
      const phone = rawPhone.length === 10 ? rawPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") : "—";

      return `<tr>
        <td style="font-family:'DM Mono',monospace;font-size:11px;">${formatDate(r["Hatch Date"])}</td>
        <td class="td-name">${escapeHtml(r["Customer Name"])}</td>
        <td style="font-size:12px;">${escapeHtml(r.City)}, ${escapeHtml(r.State)}</td>
        <td style="font-size:12px;color:var(--text3);">${escapeHtml(r.Region)}</td>
        <td><span class="badge badge-breed-${escapeHtml(breedKey)}">${escapeHtml(r.Breed)}</span></td>
        <td style="font-family:'DM Mono',monospace;">${formatNumber(qty)}</td>
        <td style="font-family:'DM Mono',monospace;color:${color};">${formatNumber(doa)}</td>
        <td style="font-family:'DM Mono',monospace;color:var(--accent);">${formatNumber(qty - doa)}</td>
        <td><div class="doa-bar-wrap"><div class="doa-bar-bg"><div class="doa-bar-fill" style="width:${Math.min(pct, 100).toFixed(1)}%;background:${color};"></div></div><div class="doa-pct" style="color:${color};">${pct.toFixed(1)}%</div></div></td>
        <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3);">Wk ${escapeHtml(r.Week)}</td>
        <td style="font-size:12px;color:var(--text3);">${phone}</td>
        <td class="note-cell" title="${escapeHtml(r.Notes)}">${escapeHtml(r.Notes || "—")}</td>
      </tr>`;
    })
    .join("");
}

function switchView(v) {
  document.getElementById("loss-view").style.display = v === "loss" ? "block" : "none";
  document.getElementById("hatch-view").style.display = v === "hatch" ? "block" : "none";
  document.getElementById("btn-loss").classList.toggle("active", v === "loss");
  document.getElementById("btn-hatch").classList.toggle("active", v === "hatch");
  if (v === "hatch") setTimeout(buildHatchView, 50);
}

function buildHatchView() {
  renderHatchKPIs();

  if (hatchPctChartInstance) hatchPctChartInstance.destroy();
  if (breedChartInstance) breedChartInstance.destroy();

  const labels = HATCH_WEEKLY.map((w) => w.date);
  const hpcts = HATCH_WEEKLY.map((w) => Number(w.hpct || 0));
  const benchmark = Number(SETTINGS.hatchBenchmark || 75);

  const barColors = hpcts.map((p) =>
    p >= benchmark
      ? "rgba(127,196,122,0.75)"
      : p >= benchmark - 10
        ? "rgba(212,147,74,0.75)"
        : "rgba(224,90,74,0.75)",
  );

  const pCanvas = document.getElementById("hatchPctChart");
  if (pCanvas) {
    hatchPctChartInstance = new Chart(pCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Hatchability %",
            data: hpcts,
            backgroundColor: barColors,
            borderRadius: 4,
            borderSkipped: false,
            order: 2,
          },
          {
            label: `${benchmark}% benchmark`,
            data: Array(labels.length).fill(benchmark),
            type: "line",
            borderColor: "rgba(90,159,212,0.6)",
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => c.datasetIndex === 0 ? ` Hatch rate: ${c.raw}%` : ` ${benchmark}% benchmark` } },
        },
        scales: {
          x: { ticks: { color: "#556154", font: { size: 10, family: "DM Mono" } }, grid: { display: false }, border: { display: false } },
          y: { min: 0, max: 100, ticks: { color: "#556154", font: { size: 10 }, callback: (v) => v + "%" }, grid: { color: "rgba(255,255,255,0.04)" }, border: { display: false } },
        },
      },
    });
  }

  const tbody = document.getElementById("hatch-table-body");
  if (tbody) {
    tbody.innerHTML = HATCH_WEEKLY.map((w) => {
      const pct = Number(w.hpct || 0);
      const c = pct >= benchmark ? "#7fc47a" : pct >= benchmark - 10 ? "#d4934a" : "#e05a4a";
      return `<tr>
        <td style="font-family:'DM Mono',monospace;font-size:11px;">${escapeHtml(w.date)}</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;">${formatNumber(w.ship)}</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;">${formatNumber(w.delpu)}</td>
        <td style="text-align:right;"><span style="font-family:'DM Mono',monospace;font-size:13px;color:${c};font-weight:500;">${pct.toFixed(1)}%</span></td>
      </tr>`;
    }).join("");
  }

  const cornishShip = HATCH_WEEKLY.map((w) => Number(w.breeds?.Cornish?.ship || 0));
  const cornishDel = HATCH_WEEKLY.map((w) => Number(w.breeds?.Cornish?.del || 0));
  const rangerShip = HATCH_WEEKLY.map((w) => Number(w.breeds?.Ranger?.ship || 0));
  const rangerDel = HATCH_WEEKLY.map((w) => Number(w.breeds?.Ranger?.del || 0));

  const bcCanvas = document.getElementById("breedChannelChart");
  if (bcCanvas) {
    breedChartInstance = new Chart(bcCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Cornish — ship", data: cornishShip, backgroundColor: "#7fbde8", borderRadius: 3, stack: "cornish" },
          { label: "Cornish — del/PU", data: cornishDel, backgroundColor: "rgba(127,189,232,0.3)", borderRadius: 3, stack: "cornish" },
          { label: "Ranger — ship", data: rangerShip, backgroundColor: "#d4934a", borderRadius: 3, stack: "ranger" },
          { label: "Ranger — del/PU", data: rangerDel, backgroundColor: "rgba(212,147,74,0.3)", borderRadius: 3, stack: "ranger" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${Number(c.raw).toLocaleString()}` } } },
        scales: {
          x: { ticks: { color: "#556154", font: { size: 10, family: "DM Mono" } }, grid: { display: false }, border: { display: false } },
          y: { ticks: { color: "#556154", font: { size: 10 }, callback: (v) => Number(v).toLocaleString() }, grid: { color: "rgba(255,255,255,0.05)" }, border: { display: false } },
        },
      },
    });
  }
}

function initDashboard() {
  renderKPIs();
  renderWeeklyChart();
  renderRegionChart();
  buildHatchView();
}

// Search interactions
const dateInput = document.getElementById("dateInput");
if (dateInput) {
  dateInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

["breedFilter", "regionFilter"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", () => {
      const dateVal = document.getElementById("dateInput").value;
      const breed = document.getElementById("breedFilter").value;
      const region = document.getElementById("regionFilter").value;
      if (breed || region || dateVal) doSearch();
    });
  }
});

loadData();
setInterval(() => loadData({ silent: true }), AUTO_REFRESH_MS);
