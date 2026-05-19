let DATA = [];
let WEEKLY = [];
let REGIONAL = [];
let hatchBuilt = false;
let weeklyChartInstance = null;
let hatchPctChartInstance = null;
let breedChartInstance = null;
function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);

  if (isNaN(d.getTime())) return "—";

  return d.toISOString().split("T")[0];
}

function renderWeeklyChart() {
  const canvas = document.getElementById("weeklyChart");

  if (!canvas) return;

  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");

  weeklyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: WEEKLY.map((w) => "Wk " + w.Week),
      datasets: [
        {
          label: "DOA",
          data: WEEKLY.map((w) => w["Total DOA"]),
        },
      ],
    },
  });
}
function getWeeklyData() {
  return Object.values(
    DATA.reduce((acc, row) => {
      const week = row.Week;

      if (!acc[week]) {
        acc[week] = {
          Week: week,
          "Total DOA": 0,
        };
      }

      acc[week]["Total DOA"] += Number(row.DOA);

      return acc;
    }, {}),
  ).sort((a, b) => a.Week - b.Week);
}
function getRegionalData() {
  return Object.values(
    DATA.reduce((acc, row) => {
      const region = row.Region;

      if (!acc[region]) {
        acc[region] = {
          Region: region,
          "Total DOA": 0,
        };
      }

      acc[region]["Total DOA"] += Number(row.DOA);

      return acc;
    }, {}),
  );
}

async function loadData() {
  const response = await fetch(
    "https://script.google.com/macros/s/AKfycbw_5U3TyRdhmV9CP9vOushjOSnAjHakJ-2twvXC7g4D9E86OQS9AA_TBdurpobAIk-dOQ/exec",
  );

  DATA = await response.json();
  WEEKLY = getWeeklyData();
  REGIONAL = getRegionalData();
  console.log("Loaded rows:", DATA.length);

  initDashboard();
}
function renderRegionalBars() {
  const container = document.getElementById("region-bars");

  if (!container) return;

  const maxRegion = Math.max(...REGIONAL.map((r) => r["Total DOA"]));

  container.innerHTML = REGIONAL.map((r) => {
    const width = (r["Total DOA"] / maxRegion) * 100;

    return `
      <div class="region-row">
        <div class="region-label">${r.Region}</div>

        <div class="region-bar-wrap">
          <div
            class="region-bar"
            style="width:${width}%"
          ></div>
        </div>

        <div class="region-value">
          ${r["Total DOA"]}
        </div>
      </div>
    `;
  }).join("");
}
function openAddShipmentModal() {
  document.getElementById("shipment-modal").classList.remove("hidden");
}

function closeShipmentModal() {
  document.getElementById("shipment-modal").classList.add("hidden");
}
function getWeekNumber(dateString) {
  const date = new Date(dateString);

  const start = new Date(date.getFullYear(), 0, 1);

  const days = Math.floor((date - start) / 86400000);

  return Math.ceil((days + start.getDay() + 1) / 7);
}
async function saveShipment() {
  const shipment = {
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
  console.log(shipment);
  try {
    await fetch(
      "https://script.google.com/macros/s/AKfycbw_5U3TyRdhmV9CP9vOushjOSnAjHakJ-2twvXC7g4D9E86OQS9AA_TBdurpobAIk-dOQ/exec",
      {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(shipment),
      },
    );

    alert("Shipment saved");

    closeShipmentModal();
  } catch (err) {
    console.error(err);

    alert("Error saving shipment");
    DATA.push(shipment);
  }
}

// ADD TO ACTIVE DATA

// ─── KPIs ───────────────────────────────────────────────
function renderKPIs() {
  const totalDOA = DATA.reduce((sum, r) => sum + Number(r.DOA || 0), 0);

  const totalSurvived = DATA.reduce((sum, r) => {
    return sum + (Number(r["Orig Qty"] || 0) - Number(r.DOA || 0));
  }, 0);

  const validRows = DATA.filter((r) => {
    const qty = Number(r["Orig Qty"]);
    const doa = Number(r.DOA);

    return !isNaN(qty) && qty > 0 && !isNaN(doa);
  });

  const avgDOA =
    validRows.length > 0
      ? (
          validRows.reduce((sum, r) => {
            return sum + (Number(r.DOA) / Number(r["Orig Qty"])) * 100;
          }, 0) / validRows.length
        ).toFixed(1)
      : "0.0";

  // ← PUT IT HERE
  document.getElementById("kpi-avg-doa").textContent = avgDOA + "%";

  document.getElementById("kpi-doa").textContent = totalDOA;
  document.getElementById("kpi-survived").textContent = totalSurvived;
  document.getElementById("kpi-count").textContent = DATA.length;
}
// ─── REGIONAL BARS ───────────────────────────────────────
const maxRegion = Math.max(...REGIONAL.map((r) => r["Total DOA"]));
const regionContainer = document.getElementById("region-bars");
const sortedRegion = [...REGIONAL]
  .filter((r) => r["Total DOA"] > 0)
  .sort((a, b) => b["Total DOA"] - a["Total DOA"]);
sortedRegion.forEach((r) => {
  const pct = ((r["Total DOA"] / maxRegion) * 100).toFixed(1);
  const color =
    r["Total DOA"] > 400
      ? "#e05a4a"
      : r["Total DOA"] > 150
        ? "#d4934a"
        : "#4a8f45";
  regionContainer.innerHTML += `
    <div class="region-row">
      <div class="region-name">${r.Region}</div>
      <div class="region-track"><div class="region-fill" style="width:${pct}%;background:${color};"></div></div>
      <div class="region-val">${r["Total DOA"]}</div>
    </div>`;
});

// ─── SEARCH ─────────────────────────────────────────────
function doSearch() {
  const dateVal = document.getElementById("dateInput").value;
  const breed = document.getElementById("breedFilter").value;
  const region = document.getElementById("regionFilter").value;

  let results = DATA;
  if (dateVal) {
    results = results.filter((r) => {
      const rowDate = formatDate(r["Hatch Date"]);

      return rowDate === dateVal;
    });
  }
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

function renderTable(results, dateVal, breed, region) {
  const info = document.getElementById("results-info");
  const tbody = document.getElementById("results-tbody");

  if (results.length === 0) {
    const desc = dateVal ? `hatch date ${dateVal}` : "those filters";
    info.innerHTML = `No records found for ${desc}`;
    tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state"><div class="big">🐣</div><p>No shipments found for ${desc}</p></div></td></tr>`;
    return;
  }

  const totalDOARes = results.reduce((s, r) => s + r.DOA, 0);
  const totalQty = results.reduce((s, r) => s + r["Orig Qty"], 0);
  const filters = [
    dateVal && `hatch date <span>${dateVal}</span>`,
    breed && `breed <span>${breed}</span>`,
    region && `region <span>${region}</span>`,
  ].filter(Boolean);
  info.innerHTML = `Showing <span>${results.length}</span> records ${filters.length ? "— filtered by " + filters.join(", ") : "— all records"} · Total DOA: <span>${totalDOARes}</span> of <span>${totalQty}</span> shipped`;

  tbody.innerHTML = results
    .map((r) => {
      const color = doaColor(r["DOA %"]);
      const breedKey = r.Breed === "Rhode Island" ? "Rhode" : r.Breed;
      const rawPhone = String(r.Phone || "").replace(/\D/g, "");

      const phone =
        rawPhone.length === 10
          ? rawPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
          : "—";
      return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px;">${formatDate(r["Hatch Date"])}</td>
      <td class="td-name">${r["Customer Name"]}</td>
      <td style="font-size:12px;">${r.City}, ${r.State}</td>
      <td style="font-size:12px;color:var(--text3);">${r.Region}</td>
      <td><span class="badge badge-breed-${breedKey}">${r.Breed}</span></td>
      <td style="font-family:'DM Mono',monospace;">${r["Orig Qty"]}</td>
      <td style="font-family:'DM Mono',monospace;color:${color};">${r.DOA}</td>
      <td style="font-family:'DM Mono',monospace;color:var(--accent);">${r["Orig Qty"] - r.DOA}</td>
      <td>
        <div class="doa-bar-wrap">
          <div class="doa-bar-bg"><div class="doa-bar-fill" style="width:${((r.DOA / r["Orig Qty"]) * 100).toFixed(1)}%;background:${color};"></div></div>
          <div class="doa-pct" style="color:${color};">${((r.DOA / r["Orig Qty"]) * 100).toFixed(1)}%</div>
        </div>
      </td>
      <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3);">Wk ${r.Week}</td>
      <td style="font-size:12px;color:var(--text3);">${phone}</td>
      <td class="note-cell" title="${r.Notes}">${r.Notes || "—"}</td>
    </tr>`;
    })
    .join("");
}

// Allow pressing Enter to search
document.getElementById("dateInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

// Auto-search on filter change (without date req)
["breedFilter", "regionFilter"].forEach((id) => {
  document.getElementById(id).addEventListener("change", () => {
    const dateVal = document.getElementById("dateInput").value;
    const breed = document.getElementById("breedFilter").value;
    const region = document.getElementById("regionFilter").value;
    if (breed || region || dateVal) doSearch();
  });
});

// ─── VIEW TOGGLE ─────────────────────────────────────────
function switchView(v) {
  document.getElementById("loss-view").style.display =
    v === "loss" ? "block" : "none";
  document.getElementById("hatch-view").style.display =
    v === "hatch" ? "block" : "none";
  document.getElementById("btn-loss").classList.toggle("active", v === "loss");
  document
    .getElementById("btn-hatch")
    .classList.toggle("active", v === "hatch");
  if (v === "hatch") setTimeout(buildHatchView, 50);
}

// ─── HATCHABILITY DATA (from cols Y:AB) ─────────────────────────────

function buildHatchView() {
  if (hatchBuilt) return;
  hatchBuilt = true;

  const labels = HATCH_WEEKLY.map((w) => w.date);
  const hpcts = HATCH_WEEKLY.map((w) => w.hpct);

  // ── Hatchability % bar chart ────────────────────────────────────────
  const barColors = hpcts.map((p) =>
    p >= 75
      ? "rgba(127,196,122,0.75)"
      : p >= 65
        ? "rgba(212,147,74,0.75)"
        : "rgba(224,90,74,0.75)",
  );
  const pCtx = document.getElementById("hatchPctChart").getContext("2d");
  new Chart(pCtx, {
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
          label: "75% benchmark",
          data: Array(labels.length).fill(75),
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
        tooltip: {
          callbacks: {
            label: (c) =>
              c.datasetIndex === 0
                ? ` Hatch rate: ${c.raw}%`
                : " 75% benchmark",
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#556154", font: { size: 10, family: "DM Mono" } },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: "#556154",
            font: { size: 10 },
            callback: (v) => v + "%",
          },
          grid: { color: "rgba(255,255,255,0.04)" },
          border: { display: false },
        },
      },
    },
  });

  // ── Weekly detail table ──────────────────────────────────────────────
  const tbody = document.getElementById("hatch-table-body");
  tbody.innerHTML = HATCH_WEEKLY.map((w) => {
    const c = w.hpct >= 80 ? "#7fc47a" : w.hpct >= 65 ? "#d4934a" : "#e05a4a";
    const total = w.ship + w.delpu;
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:11px;">2026-${w.date}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;">${w.ship.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;">${w.delpu.toLocaleString()}</td>
      <td style="text-align:right;">
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:${c};font-weight:500;">${w.hpct.toFixed(1)}%</span>
      </td>
    </tr>`;
  }).join("");

  // ── Breed × channel grouped bar ─────────────────────────────────────
  const cornishShip = HATCH_WEEKLY.map((w) =>
    w.breeds.Cornish ? w.breeds.Cornish.ship : 0,
  );
  const cornishDel = HATCH_WEEKLY.map((w) =>
    w.breeds.Cornish ? w.breeds.Cornish.del : 0,
  );
  const rangerShip = HATCH_WEEKLY.map((w) =>
    w.breeds.Ranger ? w.breeds.Ranger.ship : 0,
  );
  const rangerDel = HATCH_WEEKLY.map((w) =>
    w.breeds.Ranger ? w.breeds.Ranger.del : 0,
  );

  const bcCtx = document.getElementById("breedChannelChart").getContext("2d");
  new Chart(bcCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Cornish — ship",
          data: cornishShip,
          backgroundColor: "#7fbde8",
          borderRadius: 3,
          stack: "cornish",
        },
        {
          label: "Cornish — del/PU",
          data: cornishDel,
          backgroundColor: "rgba(127,189,232,0.3)",
          borderRadius: 3,
          stack: "cornish",
        },
        {
          label: "Ranger — ship",
          data: rangerShip,
          backgroundColor: "#d4934a",
          borderRadius: 3,
          stack: "ranger",
        },
        {
          label: "Ranger — del/PU",
          data: rangerDel,
          backgroundColor: "rgba(212,147,74,0.3)",
          borderRadius: 3,
          stack: "ranger",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${c.raw.toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#556154", font: { size: 10, family: "DM Mono" } },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: {
            color: "#556154",
            font: { size: 10 },
            callback: (v) => (v / 1000).toFixed(0) + "k",
          },
          grid: { color: "rgba(255,255,255,0.05)" },
          border: { display: false },
        },
      },
    },
  });
  function normalizeDate(date) {
    return new Date(date).toISOString().split("T")[0];
  }
}
function initDashboard() {
  renderKPIs();
  renderWeeklyChart();
  renderRegionalBars();
  buildHatchView();
}
loadData();
