-- =====================================================================
-- UPDATED SCHEMA
-- Changes from your original file:
--   1. Each IDENTITY column now starts at a different value so IDs
--      don't all begin at 1.
--   2. ORDERS gets TrackingNo + OrderStatus for the shipment workflow.
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
    ContDate DATE,
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
    ContID NUMBER,

    CONSTRAINT FK_PRODUCT_CONTAINER
        FOREIGN KEY (ContID)
        REFERENCES CONTAINERS(ContID)
);

-- =====================================
-- INVENTORY
-- =====================================
CREATE TABLE INVENTORY (
    ProdID NUMBER,
    ContID NUMBER,
    Qty NUMBER DEFAULT 0 NOT NULL,

    CONSTRAINT PK_INVENTORY
        PRIMARY KEY (ProdID, ContID),

    CONSTRAINT FK_INV_PRODUCT
        FOREIGN KEY (ProdID)
        REFERENCES PRODUCTS(ProdID),

    CONSTRAINT FK_INV_CONTAINER
        FOREIGN KEY (ContID)
        REFERENCES CONTAINERS(ContID)
);

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
CREATE TABLE PURCHASE_PRODUCT (
    PurchID NUMBER,
    ProdID NUMBER,
    Qty NUMBER NOT NULL,

    CONSTRAINT PK_PURCHASE_PRODUCT
        PRIMARY KEY (PurchID, ProdID),

    CONSTRAINT FK_PP_PURCHASE
        FOREIGN KEY (PurchID)
        REFERENCES PURCHASE(PurchID),

    CONSTRAINT FK_PP_PRODUCT
        FOREIGN KEY (ProdID)
        REFERENCES PRODUCTS(ProdID)
);

