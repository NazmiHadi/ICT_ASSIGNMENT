/* ============================================================
   dashboard.js
   Requires role-config.js loaded first (defines VALID_ROLES,
   NAV_ITEMS, ROLE_CONFIG, STAT_ITEMS, ACTION_ITEMS, PAGE_ACCESS).
   ============================================================ */

(function () {

  const role = localStorage.getItem("role");

  if (!VALID_ROLES.includes(role)) {
    window.location.href = "/login.html";
    return;
  }

  const pageKey = "dashboard"; // this file always represents the dashboard page
  const config = ROLE_CONFIG[role];

  /* ---------- Brand / role pill / heading ---------- */
  document.getElementById("rolePill").textContent = config.label;
  document.getElementById("welcomeHeading").textContent = config.heading;
  document.getElementById("welcomeSub").textContent = config.sub;

  /* ---------- Sidebar nav (bug fix: compare against pageKey, not a
     hardcoded string) ---------- */
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
                  </a></li>`;
    });
  });

  navHtml += `<li class="nav-group-label">Account</li>`;
  navHtml += `<li><a href="${NAV_ITEMS.profile.href}" class="${pageKey === "profile" ? "active" : ""}">
                <i class="fa ${NAV_ITEMS.profile.icon}"></i> ${NAV_ITEMS.profile.label}
              </a></li>`;

  navEl.innerHTML = navHtml;

  /* ---------- Stat cards ---------- */
  const statGridEl = document.getElementById("statGrid");
  if (config.stats.length === 0) {
    statGridEl.innerHTML = `<div class="notice-card">No statistics available for your role.</div>`;
  } else {
    statGridEl.innerHTML = config.stats.map(key => {
      const stat = STAT_ITEMS[key];
      if (!stat) return "";
      return `<div class="stat-card">
                <div class="stat-icon"><i class="fa ${stat.icon}"></i></div>
                <div class="stat-value" id="${stat.id}">0</div>
                <div class="stat-label">${stat.label}</div>
              </div>`;
    }).join("");
  }

  /* ---------- Quick action cards ---------- */
  const actionGridEl = document.getElementById("actionGrid");
  if (config.actions.length === 0) {
    actionGridEl.innerHTML = `<div class="notice-card">No quick actions available for your role.</div>`;
  } else {
    actionGridEl.innerHTML = config.actions.map(key => {
      const action = ACTION_ITEMS[key];
      if (!action) return "";
      return `<a href="${action.href}" class="action-card">
                <div class="action-icon"><i class="fa ${action.icon}"></i></div>
                <div>
                  <h4>${action.title}</h4>
                  <p>${action.desc}</p>
                </div>
                <i class="fa fa-angle-right go"></i>
              </a>`;
    }).join("");
  }

  /* ---------- Logout ---------- */
  document.getElementById("logoutLink").addEventListener("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    window.location.href = "/login.html";
  });

  /* ---------- Nav notification badges ----------
     "Manage Orders"      -> orders with no worker assigned yet
     "My Assigned Orders" -> my assigned orders that haven't shipped yet
     Same logic as page-guard.js's loadNavBadges() — duplicated here since
     the dashboard renders its sidebar via this separate script rather
     than page-guard.js. */
  (async function loadNavBadges() {
    const ordersBadge = document.getElementById("badge-orders");
    if (ordersBadge) {
      try {
        const res  = await fetch("/api/orders/unassigned-count");
        const data = await res.json();
        if (data.success && data.count > 0) {
          ordersBadge.textContent   = data.count;
          ordersBadge.style.display = "inline-block";
        }
      } catch (err) {
        console.error("[NAV BADGE] Could not load unassigned order count:", err);
      }
    }

    const assignBadge = document.getElementById("badge-orderAssignment");
    if (assignBadge) {
      const workerId = localStorage.getItem("userId");
      if (!workerId) return;
      try {
        const res  = await fetch(`/api/orders/pending-count?worker_id=${encodeURIComponent(workerId)}`);
        const data = await res.json();
        if (data.success && data.count > 0) {
          assignBadge.textContent   = data.count;
          assignBadge.style.display = "inline-block";
        }
      } catch (err) {
        console.error("[NAV BADGE] Could not load pending shipment count:", err);
      }
    }
  })();

  /* ---------- Wire up real numbers ----------
     fetch('/api/dashboard-stats?role=' + role)
       .then(res => res.json())
       .then(data => {
         Object.keys(data).forEach(key => {
           const el = document.getElementById(key);
           if (el) el.textContent = data[key];
         });
       });
  */

})();