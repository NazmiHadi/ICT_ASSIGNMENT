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
        html += `<li><a href="${item.href}" class="${pageKey === key ? "active" : ""}">
                    <i class="fa ${item.icon}"></i> ${item.label}
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
})();