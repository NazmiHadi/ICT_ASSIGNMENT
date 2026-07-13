
-- =====================================
-- CUSTOMERS
-- =====================================
CREATE TABLE CUSTOMERS (
    CustID       NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 5001 INCREMENT BY 1) PRIMARY KEY,
    CustName     VARCHAR2(100) NOT NULL,
    CustEmail    VARCHAR2(100),
    CustAddress  VARCHAR2(200),
    CustPhoneNum VARCHAR2(20),
    username     VARCHAR2(20)  NOT NULL,
    password     VARCHAR2(20)  NOT NULL
);

-- =====================================
-- WORKERS
-- =====================================
CREATE TABLE WORKERS (
    WorkID       NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 9192 INCREMENT BY 1) PRIMARY KEY,
    WorkName     VARCHAR2(100) NOT NULL,
    WorkPhoneNum VARCHAR2(20),
    username     VARCHAR2(20)  NOT NULL,
    password     VARCHAR2(20)  NOT NULL,
    IsManager    NUMBER(1)     DEFAULT 0 NOT NULL
                     CHECK (IsManager IN (0,1)),
    ManagerID    NUMBER,

    CONSTRAINT FK_WORKER_MANAGER
        FOREIGN KEY (ManagerID) REFERENCES WORKERS(WorkID)
);

-- =====================================
-- FULL TIME WORKERS
-- =====================================
CREATE TABLE FULL_TIME_WORKERS (
    WorkID       NUMBER PRIMARY KEY,
    Salary       NUMBER(10,2),
    Bonus_Salary NUMBER(10,2),

    CONSTRAINT FK_FULLTIME_WORKER
        FOREIGN KEY (WorkID) REFERENCES WORKERS(WorkID)
);

-- =====================================
-- PART TIME WORKERS
-- =====================================
CREATE TABLE PART_TIME_WORKERS (
    WorkID      NUMBER PRIMARY KEY,
    SalaryPerHr NUMBER(10,2),

    CONSTRAINT FK_PARTTIME_WORKER
        FOREIGN KEY (WorkID) REFERENCES WORKERS(WorkID)
);

-- =====================================
-- VENDORS
-- =====================================
CREATE TABLE VENDORS (
    VendID       NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 7001 INCREMENT BY 1) PRIMARY KEY,
    VendName     VARCHAR2(100) NOT NULL,
    VendAddress  VARCHAR2(200),
    VendPhoneNum VARCHAR2(20),
    username     VARCHAR2(20),
    password     VARCHAR2(20)
);

-- =====================================
-- CONTAINERS
-- =====================================
CREATE TABLE CONTAINERS (
    ContID    NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 3001 INCREMENT BY 1) PRIMARY KEY,
    ContName  VARCHAR2(100),
    ContColour VARCHAR2(50)
);

-- =====================================
-- PRODUCTS
-- =====================================
CREATE TABLE PRODUCTS (
    ProdID        NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 2025 INCREMENT BY 1) PRIMARY KEY,
    ProdName      VARCHAR2(100) NOT NULL,
    Price         NUMBER(10,2)  NOT NULL,
    ProdType      VARCHAR2(50),
    SalesPrice    NUMBER(10,2),
    ProdDesc      VARCHAR2(500),
    ImageFileName VARCHAR2(200)
);

-- =====================================
-- ORDERS
-- =====================================
CREATE TABLE ORDERS (
    OrderID     NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 8001 INCREMENT BY 1) PRIMARY KEY,
    OrderDate   DATE          DEFAULT SYSDATE,
    TrackingNo  VARCHAR2(30),
    OrderStatus VARCHAR2(20)  DEFAULT 'Processing' NOT NULL
                    CHECK (OrderStatus IN ('Processing','In Delivery','Delivered')),
    CustID      NUMBER        NOT NULL,
    WorkID      NUMBER,                          -- nullable: assigned later

    CONSTRAINT FK_ORDER_CUSTOMER
        FOREIGN KEY (CustID)  REFERENCES CUSTOMERS(CustID),

    CONSTRAINT FK_ORDER_WORKER
        FOREIGN KEY (WorkID)  REFERENCES WORKERS(WorkID)
        ON DELETE SET NULL    -- if worker is deleted, WorkID becomes NULL
);

-- =====================================
-- ORDER_PRODUCTS
-- =====================================
-- Uses a surrogate PK (OrderProductID) so ProdID can be nullable.
-- ProdNameSnapshot preserves the product name even if the product is
-- later deleted from PRODUCTS.
CREATE TABLE ORDER_PRODUCTS (
    OrderProductID  NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    OrderID         NUMBER        NOT NULL,
    ProdID          NUMBER,                      -- nullable: SET NULL on product delete
    ProdNameSnapshot VARCHAR2(100),              -- snapshot of name at time of order
    Qty             NUMBER        NOT NULL,

    -- Prevent duplicate product lines on the same order.
    -- Oracle allows multiple NULLs in a UNIQUE constraint, so deleted
    -- products (ProdID = NULL) don't conflict with each other.
    CONSTRAINT UQ_OP_ORDER_PROD
        UNIQUE (OrderID, ProdID),

    CONSTRAINT FK_OP_ORDER
        FOREIGN KEY (OrderID) REFERENCES ORDERS(OrderID),

    CONSTRAINT FK_OP_PRODUCT
        FOREIGN KEY (ProdID)  REFERENCES PRODUCTS(ProdID)
        ON DELETE SET NULL
);

-- =====================================
-- PURCHASE
-- =====================================
CREATE TABLE PURCHASE (
    PurchID   NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 6001 INCREMENT BY 1) PRIMARY KEY,
    PurchDate DATE   DEFAULT SYSDATE,
    WorkID    NUMBER NOT NULL,
    VendID    NUMBER,                            -- nullable: SET NULL on vendor delete

    CONSTRAINT FK_PURCHASE_WORKER
        FOREIGN KEY (WorkID) REFERENCES WORKERS(WorkID),

    CONSTRAINT FK_PURCHASE_VENDOR
        FOREIGN KEY (VendID) REFERENCES VENDORS(VendID)
        ON DELETE SET NULL
);

-- =====================================
-- PURCHASE_PRODUCT
-- =====================================
CREATE TABLE PURCHASE_PRODUCT (
    PurchID     NUMBER,
    ProdID      NUMBER,
    Qty         NUMBER DEFAULT 0 NOT NULL,
    QtyReceived NUMBER DEFAULT 0 NOT NULL,

    CONSTRAINT PK_PURCHASE_PRODUCT
        PRIMARY KEY (PurchID, ProdID),

    CONSTRAINT FK_PP_PURCHASE
        FOREIGN KEY (PurchID) REFERENCES PURCHASE(PurchID),

    CONSTRAINT FK_PP_PRODUCT
        FOREIGN KEY (ProdID)  REFERENCES PRODUCTS(ProdID),

    CONSTRAINT CHK_PP_RECEIVED_LE_QTY
        CHECK (QtyReceived <= Qty)
);

-- =====================================
-- INVENTORY
-- =====================================
CREATE TABLE INVENTORY (
    InvID        NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 4001 INCREMENT BY 1) PRIMARY KEY,
    ProdID       NUMBER NOT NULL,
    ContID       NUMBER NOT NULL,
    PurchID      NUMBER,                         -- nullable: manual stock adjustments
    Qty          NUMBER DEFAULT 0 NOT NULL,
    DateAssigned DATE   DEFAULT SYSDATE,

    CONSTRAINT UQ_INV_PROD_CONT_PURCH
        UNIQUE (ProdID, ContID, PurchID),

    CONSTRAINT FK_INV_PRODUCT
        FOREIGN KEY (ProdID)  REFERENCES PRODUCTS(ProdID),

    CONSTRAINT FK_INV_CONTAINER
        FOREIGN KEY (ContID)  REFERENCES CONTAINERS(ContID),

    CONSTRAINT FK_INV_PURCHASE
        FOREIGN KEY (PurchID) REFERENCES PURCHASE(PurchID)
);

COMMIT;
