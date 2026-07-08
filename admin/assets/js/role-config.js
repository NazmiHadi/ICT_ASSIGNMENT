/* ============================================================
   role-config.js — single source of truth for nav + access.
   Load BEFORE dashboard.js or page-guard.js on every page.
   ============================================================ */

const VALID_ROLES = ["admin", "fulltime", "parttime", "vendor"];

const NAV_ITEMS = {
  dashboard:      { label: "Dashboard",         icon: "fa-th-large",      href: "/admin/dashboard" },
  workers:        { label: "Manage Workers",    icon: "fa-users",         href: "/admin/workers" },
  customers:      { label: "Manage Customers",  icon: "fa-male",          href: "/admin/customers" },
  vendors:        { label: "Manage Vendors",    icon: "fa-handshake-o",   href: "/admin/vendors" },
  products:       { label: "Manage Products",   icon: "fa-tags",          href: "/admin/products" },
  containers:     { label: "Manage Containers", icon: "fa-archive",       href: "/admin/containers" },
  inventory:      { label: "Manage Inventory",  icon: "fa-cubes",         href: "/admin/inventory" },
  orders:         { label: "Manage Orders",     icon: "fa-list-alt",      href: "/admin/orders" },
  orderAssignment:{ label: "My Assigned Orders",icon: "fa-clipboard",     href: "/admin/orderAssignment" },
  purchase:       { label: "Manage Purchases",  icon: "fa-shopping-cart", href: "/admin/purchase" },
  profile:        { label: "My Profile",        icon: "fa-user",          href: "/admin/profile" }
};

/* Sidebar groups per role. "profile" deliberately left out of groups —
   every page's guard adds it to the bottom of the nav automatically. */
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
      { label: "Transactions", keys: ["orders", "orderAssignment", "purchase"] }
    ],
    stats:   ["customers", "orders", "inventory"],
    actions: ["orders", "orderAssignment", "inventory", "purchase", "customers"]
  },
  parttime: {
    label: "Part-Time Worker",
    heading: "Welcome back",
    sub: "Here's your assigned orders, current stock levels, and purchases waiting to be received.",
    groups: [
      { label: "Daily Tasks", keys: ["orderAssignment"] },
      { label: "Stock",       keys: ["inventory", "purchase"] }
    ],
    stats:   ["orders", "inventory"],
    actions: ["orderAssignment", "inventory"]
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

const STAT_ITEMS = {
  workers:   { id: "statWorkers",   icon: "fa-users",        label: "Total Workers" },
  customers: { id: "statCustomers", icon: "fa-male",         label: "Total Customers" },
  orders:    { id: "statOrders",    icon: "fa-list-alt",     label: "Total Orders" },
  products:  { id: "statProducts",  icon: "fa-tags",         label: "Total Products" },
  vendors:   { id: "statVendors",   icon: "fa-handshake-o",  label: "Total Vendors" },
  inventory: { id: "statInventory", icon: "fa-cubes",        label: "Inventory Items" },
  purchase:  { id: "statPurchase",  icon: "fa-shopping-cart",label: "Total Purchases" }
};

const ACTION_ITEMS = {
  workers: { href: "workers", icon: "fa-user-plus", title: "Manage Workers",
    desc: "Add workers, assign managers, set full-time/part-time pay." },
  orders: { href: "orders", icon: "fa-cogs", title: "Manage Orders",
    desc: "Assign workers to orders and view ordered products." },
  orderAssignment: { href: "orderAssignment", icon: "fa-clipboard-list", title: "My Assigned Orders",
    desc: "View the orders that have been assigned to you." },
  products: { href: "products", icon: "fa-tags", title: "Manage Products",
    desc: "Add products, set price/sales price, link to a container." },
  inventory: { href: "inventory", icon: "fa-cubes", title: "Manage Inventory",
    desc: "View and update stock quantity per product/container." },
  purchase: { href: "purchase", icon: "fa-shopping-cart", title: "Manage Purchases",
    desc: "Record purchases from vendors and the products bought." },
  customers: { href: "customers", icon: "fa-male", title: "Manage Customers",
    desc: "View registered customers and their contact details." },
  vendors: { href: "vendors", icon: "fa-handshake-o", title: "Manage Vendors",
    desc: "View vendor details and link purchases to a vendor." },
  containers: { href: "containers", icon: "fa-archive", title: "Manage Containers",
    desc: "Track shipping containers and the products linked to them." }
};

/* Access control: which roles may load each page directly by URL. */
const PAGE_ACCESS = {
  dashboard:       ["admin", "fulltime", "parttime", "vendor"],
  workers:         ["admin"],
  customers:       ["admin", "fulltime"],
  vendors:         ["admin"],
  products:        ["admin"],
  containers:      ["admin"],
  inventory:       ["admin", "fulltime", "parttime"],
  orders:          ["admin", "fulltime"],
  orderAssignment: ["admin", "fulltime", "parttime"],
  purchase:        ["admin", "fulltime", "parttime", "vendor"],
  profile:         ["admin", "fulltime", "parttime", "vendor"]
};