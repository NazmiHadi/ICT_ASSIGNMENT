/* ============================================================
   dashboard.js
   Role-based rendering for the KURMA AJWA dashboard.

   Expected values in localStorage.getItem("role"):
     "admin"     -> Manager (full access)
     "fulltime"  -> Full-time worker (staff)
     "parttime"  -> Part-time worker
     "vendor"    -> Vendor

   Any other / missing value redirects to login.
   ============================================================ */

(function () {

  /* ---------- 1. Auth guard ---------- */

  const VALID_ROLES = ["admin", "fulltime", "parttime", "vendor"];
  const role = localStorage.getItem("role");

  if (!VALID_ROLES.includes(role)) {
    window.location.href = "../login.html";
    return;
  }

  /* ---------- 2. Shared nav item definitions ----------
     Every possible link lives here once. Each role config
     below just lists which "keys" it is allowed to see.   */

  const NAV_ITEMS = {
    dashboard: { label: "Dashboard",          icon: "fa-th-large",      href: "/admin/dashboard" },
    workers:   { label: "Manage Workers",     icon: "fa-users",         href: "/admin/workers" },
    customers: { label: "Manage Customers",   icon: "fa-male",          href: "/admin/customers" },
    vendors:   { label: "Manage Vendors",     icon: "fa-handshake-o",   href: "/admin/vendors" },
    products:  { label: "Manage Products",    icon: "fa-tags",         href: "/admin/products" },
    containers:{ label: "Manage Containers",  icon: "fa-archive",      href: "/admin/containers" },
    inventory: { label: "Manage Inventory",   icon: "fa-cubes",        href: "/admin/inventory" },
    orders:    { label: "Manage Orders",      icon: "fa-list-alt",     href: "/admin/orders" },
    purchase:  { label: "Manage Purchases",   icon: "fa-shopping-cart",href: "/admin/purchase" }
  };

  /* ---------- 3. Stat card definitions ---------- */

  const STAT_ITEMS = {
    workers:   { id: "statWorkers",   icon: "fa-users",        label: "Total Workers" },
    customers: { id: "statCustomers", icon: "fa-male",         label: "Total Customers" },
    orders:    { id: "statOrders",    icon: "fa-list-alt",     label: "Total Orders" },
    products:  { id: "statProducts", icon: "fa-tags",         label: "Total Products" },
    vendors:   { id: "statVendors",   icon: "fa-handshake-o",  label: "Total Vendors" },
    inventory: { id: "statInventory", icon: "fa-cubes",        label: "Inventory Items" },
    purchase:  { id: "statPurchase",  icon: "fa-shopping-cart",label: "Total Purchases" }
  };

  /* ---------- 4. Quick action card definitions ---------- */

  const ACTION_ITEMS = {
    workers: {
      href: "workers", icon: "fa-user-plus",
      title: "Manage Workers",
      desc: "Add workers, assign managers, set full-time/part-time pay."
    },
    orders: {
      href: "orders", icon: "fa-cogs",
      title: "Manage Orders",
      desc: "Assign workers to orders and view ordered products."
    },
    products: {
      href: "products", icon: "fa-tags",
      title: "Manage Products",
      desc: "Add products, set price/sales price, link to a container."
    },
    inventory: {
      href: "inventory", icon: "fa-cubes",
      title: "Manage Inventory",
      desc: "View and update stock quantity per product/container."
    },
    purchase: {
      href: "purchase", icon: "fa-shopping-cart",
      title: "Manage Purchases",
      desc: "Record purchases from vendors and the products bought."
    },
    customers: {
      href: "customers", icon: "fa-male",
      title: "Manage Customers",
      desc: "View registered customers and their contact details."
    },
    vendors: {
      href: "vendors", icon: "fa-handshake-o",
      title: "Manage Vendors",
      desc: "View vendor details and link purchases to a vendor."
    },
    containers: {
      href: "containers", icon: "fa-archive",
      title: "Manage Containers",
      desc: "Track shipping containers and the products linked to them."
    }
  };

  /* ---------- 5. Role configuration ----------
     "nav"     -> sidebar links (besides dashboard, always included)
     "stats"   -> stat cards shown on the overview
     "actions" -> quick action cards shown on the overview
     "label"   -> role pill text
     "heading" -> page welcome heading/subtitle              */

  const ROLE_CONFIG = {

    admin: {
      label: "Manager",
      heading: "Welcome back, Admin",
      sub: "Here's a summary of your workers, customers, catalog and transactions.",
      groups: [
        { label: "People",          keys: ["workers", "customers", "vendors"] },
        { label: "Catalog & Stock", keys: ["products", "containers", "inventory"] },
        { label: "Transactions",    keys: ["orders", "purchase"] }
      ],
      stats:   ["workers", "customers", "orders", "products", "vendors"],
      actions: ["workers", "orders", "products", "inventory", "purchase", "customers"]
    },

    fulltime: {
      label: "Full-Time Worker",
      heading: "Welcome back",
      sub: "Here's a summary of customers, orders, inventory and purchases.",
      groups: [
        { label: "People",       keys: ["customers"] },
        { label: "Stock",        keys: ["inventory"] },
        { label: "Transactions", keys: ["orders", "purchase"] }
      ],
      stats:   ["customers", "orders", "inventory"],
      actions: ["orders", "inventory", "purchase", "customers"]
    },

    parttime: {
      label: "Part-Time Worker",
      heading: "Welcome back",
      sub: "Here's today's orders and current stock levels.",
      groups: [
        { label: "Daily Tasks", keys: ["orders", "inventory"] }
      ],
      stats:   ["orders", "inventory"],
      actions: ["orders", "inventory"]
    },

    vendor: {
      label: "Vendor",
      heading: "Welcome back",
      sub: "Here's a summary of your purchase transactions with us.",
      groups: [
        { label: "Transactions", keys: ["purchase"] }
      ],
      stats:   ["purchase"],
      actions: ["purchase"]
    }
  };

  const config = ROLE_CONFIG[role];

  /* ---------- 6. Render: brand / role pill / heading ---------- */

  document.getElementById("rolePill").textContent = config.label;
  document.getElementById("welcomeHeading").textContent = config.heading;
  document.getElementById("welcomeSub").textContent = config.sub;

  /* ---------- 7. Render: sidebar nav ---------- */

  const navEl = document.getElementById("sidebarNav");
  const currentPage = "/admin/dashboard"; // this file always represents the dashboard page

  let navHtml = `<li><a href="${NAV_ITEMS.dashboard.href}" class="${currentPage === "dashboard" ? "active" : ""}">
                    <i class="fa ${NAV_ITEMS.dashboard.icon}"></i> ${NAV_ITEMS.dashboard.label}
                  </a></li>`;

  config.groups.forEach(group => {
    navHtml += `<li class="nav-group-label">${group.label}</li>`;
    group.keys.forEach(key => {
      const item = NAV_ITEMS[key];
      if (!item) return;
      navHtml += `<li><a href="${item.href}" class="${currentPage === item.href ? "active" : ""}">
                    <i class="fa ${item.icon}"></i> ${item.label}
                  </a></li>`;
    });
  });

  navEl.innerHTML = navHtml;

  /* ---------- 8. Render: stat cards ---------- */

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

  /* ---------- 9. Render: quick action cards ---------- */

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

  /* ---------- 10. Logout ---------- */

  document.getElementById("logoutLink").addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });

  function logout() {
    localStorage.removeItem("role");
    window.location.href = "../login.html";
  }

  /* ---------- 11. Wire up real numbers ----------
     NOTE for backend integration:
     The stat values above should come from simple COUNT(*) queries
     against the tables that exist in the schema, scoped to whatever
     the current role is allowed to see (e.g. a vendor's purchase
     count should be filtered to that vendor's own VendorID).

     Example:

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