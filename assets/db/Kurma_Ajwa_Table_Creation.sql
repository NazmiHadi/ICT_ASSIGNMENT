-- =====================================
-- CUSTOMER
-- =====================================
CREATE TABLE CUSTOMERS (
    CustID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
    WorkID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    WorkName VARCHAR2(100) NOT NULL,
    WorkPhoneNum VARCHAR2(20),
    username VARCHAR2(20) NOT NULL,
    password VARCHAR2(20) NOT NULL,

    -- Indicates whether this worker is a manager/admin
    IsManager NUMBER(1) DEFAULT 0 NOT NULL
        CHECK (IsManager IN (0,1)),

    ManagerID NUMBER,

    CONSTRAINT FK_WORKER_MANAGER
        FOREIGN KEY (ManagerID)
        REFERENCES WORKERS(WorkID)
);

-- =====================================
-- FULL TIME WORKERS
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
    VendID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    VendName VARCHAR2(100) NOT NULL,
    VendAddress VARCHAR2(200),
    VendPhoneNum VARCHAR2(20),

    -- Vendor login credentials
    username VARCHAR2(20),
    password VARCHAR2(20)
);

-- =====================================
-- CONTAINERS
-- =====================================
CREATE TABLE CONTAINERS (
    ContID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ContName VARCHAR2(100),
    ContDate DATE,
    ContColour VARCHAR2(50)
);

-- =====================================
-- PRODUCTS
-- =====================================
CREATE TABLE PRODUCTS (
    ProdID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
-- ORDERS
-- =====================================
CREATE TABLE ORDERS (
    OrderID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    OrderDate DATE DEFAULT SYSDATE,

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
    PurchID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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