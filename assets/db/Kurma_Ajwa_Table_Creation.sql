-- =====================================================================
-- UPDATED SCHEMA
-- Changes from your original file:
--   1. Each IDENTITY column now starts at a different value so IDs
--      don't all begin at 1.
--   2. ORDERS gets TrackingNo + OrderStatus for the shipment workflow.
--   3. PRODUCTS gets ImageFileName so product images can be stored and
--      served (fixes ORA-00904 from orderRoutes.js/productRoutes.js
--      querying p.ImageFileName against a table that didn't have it).
--
-- NOTE ON "LETTERS + NUMBERS" PKs:
-- Oracle's GENERATED ALWAYS AS IDENTITY only works on NUMBER columns,
-- so a primary key literally can't be things like "WK9192A" without
-- giving up native auto-increment (switching the PK to VARCHAR2 and
-- generating values with a trigger/sequence yourself, which also
-- breaks simple numeric FK joins everywhere in your app).
-- Since none of your FKs need letters, I kept all PKs numeric but
-- gave each table its own distinct starting range. I DID give the new
-- TrackingNo column a letter+number format (e.g. KA20260704-008123-4F7A)
-- since that's a free-text field, not a key, so it's the right place
-- for that combination.
--
-- NOTE: if PRODUCTS already exists in your database (i.e. you're not
-- running this whole script fresh), editing the CREATE TABLE below does
-- NOT retroactively add the column to your live table — run
-- alter_products_add_image.sql (ALTER TABLE PRODUCTS ADD ImageFileName
-- VARCHAR2(200);) against your existing schema instead.
-- =====================================================================

-- =====================================
-- CUSTOMER
-- =====================================
CREATE TABLE CUSTOMERS (
    CustID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 5001 INCREMENT BY 1) PRIMARY KEY,
    CustName VARCHAR2(100) NOT NULL,
    CustEmail VARCHAR2(100),
    CustAddress VARCHAR2(200),
    CustPhoneNum VARCHAR2(20),
    username VARCHAR2(20) NOT NULL,
    password VARCHAR2(20) NOT NULL
);

-- =====================================
-- WORKERS
-- =====================================
CREATE TABLE WORKERS (
    WorkID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 9192 INCREMENT BY 1) PRIMARY KEY,
    WorkName VARCHAR2(100) NOT NULL,
    WorkPhoneNum VARCHAR2(20),
    username VARCHAR2(20) NOT NULL,
    password VARCHAR2(20) NOT NULL,

    IsManager NUMBER(1) DEFAULT 0 NOT NULL
        CHECK (IsManager IN (0,1)),

    ManagerID NUMBER,

    CONSTRAINT FK_WORKER_MANAGER
        FOREIGN KEY (ManagerID)
        REFERENCES WORKERS(WorkID)
);

-- =====================================
-- FULL TIME WORKERS  (PK = FK to WORKERS, no identity needed)
-- =====================================
CREATE TABLE FULL_TIME_WORKERS (
    WorkID NUMBER PRIMARY KEY,
    Salary NUMBER(10,2),
    Bonus_Salary NUMBER(10,2),

    CONSTRAINT FK_FULLTIME_WORKER
        FOREIGN KEY (WorkID)
        REFERENCES WORKERS(WorkID)
);

-- =====================================
-- PART TIME WORKERS
-- =====================================
CREATE TABLE PART_TIME_WORKERS (
    WorkID NUMBER PRIMARY KEY,
    SalaryPerHr NUMBER(10,2),

    CONSTRAINT FK_PARTTIME_WORKER
        FOREIGN KEY (WorkID)
        REFERENCES WORKERS(WorkID)
);

-- =====================================
-- VENDORS
-- =====================================
CREATE TABLE VENDORS (
    VendID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 7001 INCREMENT BY 1) PRIMARY KEY,
    VendName VARCHAR2(100) NOT NULL,
    VendAddress VARCHAR2(200),
    VendPhoneNum VARCHAR2(20),

    username VARCHAR2(20),
    password VARCHAR2(20)
);

-- =====================================
-- CONTAINERS
-- =====================================
CREATE TABLE CONTAINERS (
    ContID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 3001 INCREMENT BY 1) PRIMARY KEY,
    ContName VARCHAR2(100),
    ContColour VARCHAR2(50)
);

-- =====================================
-- PRODUCTS
-- =====================================
CREATE TABLE PRODUCTS (
    ProdID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 2025 INCREMENT BY 1) PRIMARY KEY,
    ProdName VARCHAR2(100) NOT NULL,
    Price NUMBER(10,2) NOT NULL,
    ProdType VARCHAR2(50),
    SalesPrice NUMBER(10,2),
    ProdDesc VARCHAR2(50),

    -- Stored filename of the uploaded product image (e.g. "abc123.jpg"),
    -- served from /uploads/products/<ImageFileName>. NULL until an image
    -- is uploaded for that product.
    ImageFileName VARCHAR2(200)
);

-- NOTE: INVENTORY used to be created here, but it now references
-- PURCHASE (see below), so its definition has moved further down the
-- script, right after PURCHASE_PRODUCT, where PURCHASE already exists.

-- =====================================
-- ORDERS  (+ TrackingNo, OrderStatus)
-- =====================================
CREATE TABLE ORDERS (
    OrderID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 8001 INCREMENT BY 1) PRIMARY KEY,
    OrderDate DATE DEFAULT SYSDATE,

    -- NULL until the assigned worker ships it
    TrackingNo VARCHAR2(30),

    -- Processing      = order placed, no worker assigned yet / worker still packing
    -- In Delivery     = worker has shipped it, tracking no. exists
    -- Delivered       = confirmed delivered
    OrderStatus VARCHAR2(20) DEFAULT 'Processing' NOT NULL
        CHECK (OrderStatus IN ('Processing','In Delivery','Delivered')),

    CustID NUMBER NOT NULL,
    WorkID NUMBER,

    CONSTRAINT FK_ORDER_CUSTOMER
        FOREIGN KEY (CustID)
        REFERENCES CUSTOMERS(CustID),

    CONSTRAINT FK_ORDER_WORKER
        FOREIGN KEY (WorkID)
        REFERENCES WORKERS(WorkID)
);

-- =====================================
-- ORDER_PRODUCTS
-- =====================================
CREATE TABLE ORDER_PRODUCTS (
    OrderID NUMBER,
    ProdID NUMBER,
    Qty NUMBER NOT NULL,

    CONSTRAINT PK_ORDER_PRODUCTS
        PRIMARY KEY (OrderID, ProdID),

    CONSTRAINT FK_OP_ORDER
        FOREIGN KEY (OrderID)
        REFERENCES ORDERS(OrderID),

    CONSTRAINT FK_OP_PRODUCT
        FOREIGN KEY (ProdID)
        REFERENCES PRODUCTS(ProdID)
);

-- =====================================
-- PURCHASE
-- =====================================
CREATE TABLE PURCHASE (
    PurchID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 6001 INCREMENT BY 1) PRIMARY KEY,
    PurchDate DATE DEFAULT SYSDATE,

    WorkID NUMBER NOT NULL,
    VendID NUMBER NOT NULL,

    CONSTRAINT FK_PURCHASE_WORKER
        FOREIGN KEY (WorkID)
        REFERENCES WORKERS(WorkID),

    CONSTRAINT FK_PURCHASE_VENDOR
        FOREIGN KEY (VendID)
        REFERENCES VENDORS(VendID)
);

-- =====================================
-- PURCHASE_PRODUCT
-- =====================================
-- QtyReceived tracks how much of this purchase LINE has already been
-- moved into INVENTORY so far. A purchase of Qty=3 can be received into
-- inventory across several separate visits (e.g. 2 today, 1 tomorrow) —
-- QtyReceived keeps a running total so the remaining amount
-- (Qty - QtyReceived) is always known and workers can't over-receive.
CREATE TABLE PURCHASE_PRODUCT (
    PurchID NUMBER,
    ProdID NUMBER,
    Qty NUMBER NOT NULL,
    QtyReceived NUMBER DEFAULT 0 NOT NULL,

    CONSTRAINT PK_PURCHASE_PRODUCT
        PRIMARY KEY (PurchID, ProdID),

    CONSTRAINT FK_PP_PURCHASE
        FOREIGN KEY (PurchID)
        REFERENCES PURCHASE(PurchID),

    CONSTRAINT FK_PP_PRODUCT
        FOREIGN KEY (ProdID)
        REFERENCES PRODUCTS(ProdID),

    CONSTRAINT CHK_PP_RECEIVED_LE_QTY
        CHECK (QtyReceived <= Qty)
);

-- =====================================
-- INVENTORY
-- =====================================
-- Each row is one "batch" of stock: a specific product, sitting in a
-- specific container, that came from a specific purchase (PurchID).
-- This is what lets the app answer "which purchase did this stock come
-- from?" instead of just holding one blended total per product/container.
--
-- PurchID is nullable to allow manual stock adjustments that aren't
-- tied to any purchase (e.g. stock corrections). A surrogate InvID is
-- used as the primary key (instead of a composite key including the
-- nullable PurchID) because Oracle primary key columns cannot be NULL.
-- The UNIQUE constraint below still prevents duplicate rows for the
-- same product + container + purchase combination, so receiving into
-- the same container across multiple days accumulates onto one row
-- instead of creating duplicates.
CREATE TABLE INVENTORY (
    InvID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 4001 INCREMENT BY 1) PRIMARY KEY,
    ProdID NUMBER NOT NULL,
    ContID NUMBER NOT NULL,
    PurchID NUMBER,
    Qty NUMBER DEFAULT 0 NOT NULL,
    DateAssigned DATE DEFAULT SYSDATE,

    CONSTRAINT UQ_INV_PROD_CONT_PURCH
        UNIQUE (ProdID, ContID, PurchID),

    CONSTRAINT FK_INV_PRODUCT
        FOREIGN KEY (ProdID)
        REFERENCES PRODUCTS(ProdID),

    CONSTRAINT FK_INV_CONTAINER
        FOREIGN KEY (ContID)
        REFERENCES CONTAINERS(ContID),

    CONSTRAINT FK_INV_PURCHASE
        FOREIGN KEY (PurchID)
        REFERENCES PURCHASE(PurchID)
);

-- =====================================================================
-- 1) PRODUCTS ↔ ORDER_PRODUCTS
--    ProdID is part of the PK today, so it must get a surrogate key
--    before it can be nulled out.
-- =====================================================================
ALTER TABLE ORDER_PRODUCTS DROP CONSTRAINT PK_ORDER_PRODUCTS;

ALTER TABLE ORDER_PRODUCTS
  ADD OrderProductID NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1);

ALTER TABLE ORDER_PRODUCTS
  ADD CONSTRAINT PK_ORDER_PRODUCTS PRIMARY KEY (OrderProductID);

-- keeps one line per order+product even though ProdID can now be NULL
-- (multiple NULLs are allowed under a unique constraint in Oracle, so
-- this only guards against duplicate *real* product lines)
ALTER TABLE ORDER_PRODUCTS
  ADD CONSTRAINT UQ_OP_ORDER_PROD UNIQUE (OrderID, ProdID);

ALTER TABLE ORDER_PRODUCTS MODIFY ProdID NULL;

ALTER TABLE ORDER_PRODUCTS DROP CONSTRAINT FK_OP_PRODUCT;
ALTER TABLE ORDER_PRODUCTS
  ADD CONSTRAINT FK_OP_PRODUCT
  FOREIGN KEY (ProdID) REFERENCES PRODUCTS(ProdID)
  ON DELETE SET NULL;

-- Optional but recommended: once ProdID goes NULL, the order line item
-- has no name to show anymore. A snapshot column preserves what was
-- actually ordered, independent of whether the product still exists.
ALTER TABLE ORDER_PRODUCTS ADD ProdNameSnapshot VARCHAR2(100);
-- populate it going forward whenever a line is inserted (see route note below)

-- =====================================================================
-- 2) WORKERS ↔ ORDERS
--    WorkID is already a plain nullable FK column — no PK issue here.
-- =====================================================================
ALTER TABLE ORDERS DROP CONSTRAINT FK_ORDER_WORKER;
ALTER TABLE ORDERS
  ADD CONSTRAINT FK_ORDER_WORKER
  FOREIGN KEY (WorkID) REFERENCES WORKERS(WorkID)
  ON DELETE SET NULL;

-- =====================================================================
-- 3) VENDORS ↔ PURCHASE
--    VendID is currently NOT NULL, so that has to be relaxed first.
-- =====================================================================
ALTER TABLE PURCHASE MODIFY VendID NULL;

ALTER TABLE PURCHASE DROP CONSTRAINT FK_PURCHASE_VENDOR;
ALTER TABLE PURCHASE
  ADD CONSTRAINT FK_PURCHASE_VENDOR
  FOREIGN KEY (VendID) REFERENCES VENDORS(VendID)
  ON DELETE SET NULL;

ALTER TABLE ORDERS DROP CONSTRAINT FK_ORDER_WORKER;
ALTER TABLE ORDERS
  ADD CONSTRAINT FK_ORDER_WORKER
  FOREIGN KEY (WorkID) REFERENCES WORKERS(WorkID)
  ON DELETE SET NULL;