/* ============================================================
   reports.js
   Requires role-config.js loaded first (defines VALID_ROLES,
   NAV_ITEMS, ROLE_CONFIG, PAGE_ACCESS).
   ============================================================ */

(function () {

  const role = localStorage.getItem("role");

  if (!VALID_ROLES.includes(role)) {
    window.location.href = "/";
    return;
  }

  const pageKey = "reports";

  // This page is admin/fulltime only — bounce anyone else back to their
  // dashboard rather than showing an empty/broken report.
  if (!PAGE_ACCESS[pageKey] || !PAGE_ACCESS[pageKey].includes(role)) {
    window.location.href = "/admin/dashboard";
    return;
  }

  const config = ROLE_CONFIG[role];

  /* ---------- Brand / role pill ---------- */
  document.getElementById("rolePill").textContent = config.label;

  /* ---------- Sidebar nav (same pattern as dashboard.js) ---------- */
  const navEl = document.getElementById("sidebarNav");

  let navHtml = `<li><a href="${NAV_ITEMS.dashboard.href}" class="${pageKey === "dashboard" ? "active" : ""}">
                    <i class="fa ${NAV_ITEMS.dashboard.icon}"></i> ${NAV_ITEMS.dashboard.label}
                  </a></li>`;

  config.groups.forEach(group => {
    navHtml += `<li class="nav-group-label">${group.label}</li>`;
    group.keys.forEach(key => {
      const item = NAV_ITEMS[key];
      if (!item) return;
      navHtml += `<li><a href="${item.href}" id="nav-${key}" class="${pageKey === key ? "active" : ""}">
                    <i class="fa ${item.icon}"></i> ${item.label}
                    <span id="badge-${key}" style="display:none; margin-left:auto; background:#e74c3c; color:#fff; border-radius:10px; padding:1px 8px; font-size:11px; font-weight:700; line-height:1.6;"></span>
                    <span id="badge-${key}-2" style="display:none; margin-left:4px; background:#d4a017; color:#fff; border-radius:10px; padding:1px 8px; font-size:11px; font-weight:700; line-height:1.6;"></span>
                  </a></li>`;
    });
  });

  navHtml += `<li class="nav-group-label">Account</li>`;
  navHtml += `<li><a href="${NAV_ITEMS.profile.href}" class="${pageKey === "profile" ? "active" : ""}">
                <i class="fa ${NAV_ITEMS.profile.icon}"></i> ${NAV_ITEMS.profile.label}
              </a></li>`;

  navEl.innerHTML = navHtml;

  /* ---------- Logout ---------- */
  document.getElementById("logoutLink").addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    window.location.href = "/";
  });

  /* ---------- Shared palette ---------- */
  const PALETTE = ["#A8333D", "#C9A98A", "#3E7C4A", "#D4A017", "#5B7C99", "#8A7B6C", "#B25D6B", "#6B8E63"];
  const money = n => "RM " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num   = n => Number(n || 0).toLocaleString();

  async function getJSON(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Request failed");
    return data;
  }

  /* ---------- Stat cards ---------- */
  async function loadOverview() {
    const statGridEl = document.getElementById("statGrid");
    try {
      const { overview } = await getJSON("/api/reports/overview");
      statGridEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon"><i class="fa fa-money"></i></div>
          <div class="stat-value">${money(overview.total_revenue)}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card alt">
          <div class="stat-icon"><i class="fa fa-list-alt"></i></div>
          <div class="stat-value">${num(overview.total_orders)}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card alt">
          <div class="stat-icon"><i class="fa fa-line-chart"></i></div>
          <div class="stat-value">${money(overview.avg_order_value)}</div>
          <div class="stat-label">Avg Order Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon"><i class="fa fa-shopping-cart"></i></div>
          <div class="stat-value">${money(overview.total_spend)}</div>
          <div class="stat-label">Total Purchase Spend</div>
        </div>
        <div class="stat-card warn">
          <div class="stat-icon"><i class="fa fa-clock-o"></i></div>
          <div class="stat-value">${num(overview.processing_count)}</div>
          <div class="stat-label">Awaiting Shipment</div>
        </div>
        <div class="stat-card warn">
          <div class="stat-icon"><i class="fa fa-truck"></i></div>
          <div class="stat-value">${num(overview.in_delivery_count)}</div>
          <div class="stat-label">In Delivery</div>
        </div>`;
    } catch (err) {
      console.error("[REPORTS] overview:", err);
      statGridEl.innerHTML = `<div class="empty-note">Could not load overview stats.</div>`;
    }
  }

  /* ---------- Monthly sales (bar + line combo) ---------- */
  let monthlySalesChart;
  async function loadMonthlySales(months) {
    const canvas = document.getElementById("monthlySalesChart");
    try {
      const { monthly } = await getJSON(`/api/reports/monthly-sales?months=${months}`);
      if (monthlySalesChart) monthlySalesChart.destroy();
      monthlySalesChart = new Chart(canvas, {
        data: {
          labels: monthly.map(m => m.month),
          datasets: [
            {
              type: "bar",
              label: "Revenue (RM)",
              data: monthly.map(m => m.revenue),
              backgroundColor: "#A8333D",
              borderRadius: 4,
              yAxisID: "y"
            },
            {
              type: "line",
              label: "Orders",
              data: monthly.map(m => m.order_count),
              borderColor: "#5B7C99",
              backgroundColor: "#5B7C99",
              tension: 0.3,
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            y:  { position: "left",  beginAtZero: true, title: { display: true, text: "Revenue (RM)" } },
            y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: "Orders" } }
          }
        }
      });
    } catch (err) {
      console.error("[REPORTS] monthly sales:", err);
    }
  }

  /* ---------- Daily sales (line) ---------- */
  async function loadDailySales() {
    const canvas = document.getElementById("dailySalesChart");
    try {
      const { daily } = await getJSON("/api/reports/daily-sales?days=30");
      new Chart(canvas, {
        type: "line",
        data: {
          labels: daily.map(d => d.day.slice(5)),
          datasets: [{
            label: "Revenue (RM)",
            data: daily.map(d => d.revenue),
            borderColor: "#A8333D",
            backgroundColor: "rgba(168,51,61,0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (err) {
      console.error("[REPORTS] daily sales:", err);
    }
  }

  /* ---------- Order status (doughnut) ---------- */
  async function loadOrderStatus() {
    const canvas = document.getElementById("orderStatusChart");
    try {
      const { breakdown } = await getJSON("/api/reports/order-status");
      new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: breakdown.map(b => b.status || "Unknown"),
          datasets: [{
            data: breakdown.map(b => b.count),
            backgroundColor: PALETTE
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } }
        }
      });
    } catch (err) {
      console.error("[REPORTS] order status:", err);
    }
  }

  /* ---------- Top products (horizontal bar + table) ---------- */
  async function loadTopProducts() {
    const canvas = document.getElementById("topProductsChart");
    const tableEl = document.getElementById("topProductsTable");
    try {
      const { products } = await getJSON("/api/reports/top-products?limit=8");

      if (products.length === 0) {
        tableEl.innerHTML = `<p class="empty-note">No product sales yet.</p>`;
        return;
      }

      new Chart(canvas, {
        type: "bar",
        data: {
          labels: products.map(p => p.product_name),
          datasets: [{
            label: "Qty Sold",
            data: products.map(p => p.qty_sold),
            backgroundColor: "#C9A98A",
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });

      tableEl.innerHTML = `
        <table class="report-table">
          <thead>
            <tr><th>Product</th><th class="num">Qty</th><th class="num">Revenue</th></tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>${p.product_name}</td>
                <td class="num">${num(p.qty_sold)}</td>
                <td class="num">${money(p.revenue)}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    } catch (err) {
      console.error("[REPORTS] top products:", err);
      tableEl.innerHTML = `<p class="empty-note">Could not load top products.</p>`;
    }
  }

  /* ---------- Vendor spend (bar) ---------- */
  async function loadPurchaseReport(months) {
    const vendorCanvas = document.getElementById("vendorSpendChart");
    const trendCanvas  = document.getElementById("purchaseTrendChart");
    try {
      const { by_vendor, by_month } = await getJSON(`/api/reports/purchase-report?months=${months}`);

      new Chart(vendorCanvas, {
        type: "bar",
        data: {
          labels: by_vendor.map(v => v.vendor_name || "Unknown"),
          datasets: [{
            label: "Spend (RM)",
            data: by_vendor.map(v => v.spend),
            backgroundColor: "#3E7C4A",
            borderRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });

      new Chart(trendCanvas, {
        type: "line",
        data: {
          labels: by_month.map(m => m.month),
          datasets: [{
            label: "Spend (RM)",
            data: by_month.map(m => m.spend),
            borderColor: "#D4A017",
            backgroundColor: "rgba(212,160,23,0.12)",
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (err) {
      console.error("[REPORTS] purchase report:", err);
    }
  }

  /* ---------- Worker performance (grouped bar) ---------- */
  async function loadWorkerPerformance() {
    const canvas = document.getElementById("workerPerformanceChart");
    try {
      const { workers } = await getJSON("/api/reports/worker-performance");
      new Chart(canvas, {
        type: "bar",
        data: {
          labels: workers.map(w => w.worker_name),
          datasets: [
            { label: "Assigned",    data: workers.map(w => w.assigned_count),    backgroundColor: "#8A7B6C", borderRadius: 4 },
            { label: "In Delivery", data: workers.map(w => w.in_delivery_count), backgroundColor: "#D4A017", borderRadius: 4 },
            { label: "Delivered",   data: workers.map(w => w.delivered_count),   backgroundColor: "#3E7C4A", borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
    } catch (err) {
      console.error("[REPORTS] worker performance:", err);
    }
  }

  /* ---------- Wire up filter + initial load ---------- */
  const monthlyRangeEl = document.getElementById("monthlyRange");
  monthlyRangeEl.addEventListener("change", () => {
    loadMonthlySales(Number(monthlyRangeEl.value));
    loadPurchaseReport(Number(monthlyRangeEl.value));
  });

  loadOverview();
  loadMonthlySales(Number(monthlyRangeEl.value));
  loadDailySales();
  loadOrderStatus();
  loadTopProducts();
  loadPurchaseReport(Number(monthlyRangeEl.value));
  loadWorkerPerformance();

})();