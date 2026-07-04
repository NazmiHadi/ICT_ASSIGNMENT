/* ============================================================
   page-guard.js — include on every admin sub-page AFTER role-config.js.
   Page must set window.PAGE_KEY before including this file:

     <script>window.PAGE_KEY = "inventory";</script>
     <script src="/admin/assets/js/role-config.js"></script>
     <script src="/admin/assets/js/page-guard.js"></script>

   Bug fixed: dashboard.js hardcoded currentPage = "/admin/dashboard",
   so comparisons against item.href (e.g. "/admin/inventory") never
   matched on the dashboard page, and every OTHER page that copy-pasted
   the same nav script had the same wrong constant — meaning whichever
   page's markup order put "inventory" first visually looked "active"
   by coincidence of stale hardcoding. Now pageKey === key is a real,
   page-specific comparison.
   ============================================================ */

(function () {
  const role = localStorage.getItem("role");
  const pageKey = window.PAGE_KEY;

  if (!VALID_ROLES.includes(role)) {
    window.location.href = "/login.html";
    return;
  }

  const allowedRoles = PAGE_ACCESS[pageKey] || [];
  if (!allowedRoles.includes(role)) {
    window.location.href = "/admin/dashboard";
    return;
  }

  window.currentRole = role;

  document.addEventListener("DOMContentLoaded", function () {
    renderSidebar();
    wireLogout();
    loadNavBadges();
  });

  function renderSidebar() {
    const navEl = document.getElementById("sidebarNav");
    if (!navEl) return;

    const config = ROLE_CONFIG[role];

    let html = `<li><a href="${NAV_ITEMS.dashboard.href}" class="${pageKey === "dashboard" ? "active" : ""}">
                  <i class="fa ${NAV_ITEMS.dashboard.icon}"></i> ${NAV_ITEMS.dashboard.label}
                </a></li>`;

    config.groups.forEach(group => {
      html += `<li class="nav-group-label">${group.label}</li>`;
      group.keys.forEach(key => {
        const item = NAV_ITEMS[key];
        if (!item) return;
        // Two badge slots per nav item: badge-<key> (red, e.g. "not
        // shipped"/"unassigned") and badge-<key>-2 (yellow, e.g. "not
        // delivered"). Both are hidden by default; loadNavBadges() only
        // reveals the ones a given nav item actually uses.
        html += `<li><a href="${item.href}" id="nav-${key}" class="${pageKey === key ? "active" : ""}">
                    <i class="fa ${item.icon}"></i> ${item.label}
                    <span id="badge-${key}" style="display:none; margin-left:auto; background:#e74c3c; color:#fff; border-radius:10px; padding:1px 8px; font-size:11px; font-weight:700; line-height:1.6;"></span>
                    <span id="badge-${key}-2" style="display:none; margin-left:4px; background:#d4a017; color:#fff; border-radius:10px; padding:1px 8px; font-size:11px; font-weight:700; line-height:1.6;"></span>
                  </a></li>`;
      });
    });

    // Profile link always appended for every role
    html += `<li class="nav-group-label">Account</li>`;
    html += `<li><a href="${NAV_ITEMS.profile.href}" class="${pageKey === "profile" ? "active" : ""}">
                <i class="fa ${NAV_ITEMS.profile.icon}"></i> ${NAV_ITEMS.profile.label}
              </a></li>`;

    navEl.innerHTML = html;

    const pill = document.getElementById("rolePill");
    if (pill) pill.textContent = config.label;
  }

  function wireLogout() {
    const link = document.getElementById("logoutLink");
    if (!link) return;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      localStorage.removeItem("role");
      localStorage.removeItem("userId");
      window.location.href = "/login.html";
    });
  }

  // ── loadNavBadges(): notification counts on sidebar nav items ─────────
  // "Manage Orders"      -> how many orders have no worker assigned yet
  //                         (single red badge)
  // "My Assigned Orders" -> how many of MY assigned orders haven't shipped
  //                         yet (red) and how many are shipped but not
  //                         delivered yet (yellow)
  // Badges only render if that nav item actually exists for this role
  // (badge spans only appear in the sidebar if NAV_ITEMS[key] was in this
  // role's config.groups), and only show once their count > 0.
  async function loadNavBadges() {
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

    const notShippedBadge   = document.getElementById("badge-orderAssignment");
    const notDeliveredBadge = document.getElementById("badge-orderAssignment-2");
    if (notShippedBadge || notDeliveredBadge) {
      const workerId = localStorage.getItem("userId");
      if (!workerId) return;
      try {
        const res  = await fetch(`/api/orders/pending-count?worker_id=${encodeURIComponent(workerId)}`);
        const data = await res.json();
        if (!data.success) return;

        if (notShippedBadge && data.not_shipped_count > 0) {
          notShippedBadge.textContent   = data.not_shipped_count;
          notShippedBadge.style.display = "inline-block";
        }
        if (notDeliveredBadge && data.not_delivered_count > 0) {
          notDeliveredBadge.textContent   = data.not_delivered_count;
          notDeliveredBadge.style.display = "inline-block";
        }
      } catch (err) {
        console.error("[NAV BADGE] Could not load pending shipment/delivery counts:", err);
      }
    }
  }
})();