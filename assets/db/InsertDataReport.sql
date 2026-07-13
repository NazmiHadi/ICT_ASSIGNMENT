-- =====================================================================
-- SEED DATA — populates enough history for the Reports page to show
-- real trends (monthly/daily sales, top products, purchase spend,
-- worker performance) instead of empty charts.
--
-- WHAT THIS DOES
--   1. Inserts base reference data if your tables are empty-ish:
--      customers, workers (+ full/part-time detail rows), vendors,
--      containers, products. Safe to skip this part if you already
--      have your own — see the "SKIP" note below.
--   2. Runs a PL/SQL block that generates ~12 months of ORDERS +
--      ORDER_PRODUCTS with a mild upward trend, realistic status
--      distribution (old orders Delivered, recent ones Processing),
--      and tracking numbers in the same KA-YYYYMMDD-###### -XXXX
--      format your app generates.
--   3. Generates ~8 months of PURCHASE + PURCHASE_PRODUCT, with older
--      purchases fully received (and mirrored into INVENTORY) and the
--      newest ones left partially/un-received — so the purchase
--      "receive" workflow still has live examples to test against.
--
-- HOW IDs ARE HANDLED
--   All PK columns are GENERATED ALWAYS AS IDENTITY, so this script
--   never inserts them directly. Instead, the generator block below
--   queries whatever customers/workers/vendors/products/containers
--   currently exist in your tables (via BULK COLLECT) and picks
--   randomly from those. That means:
--     - If you run part 1, it seeds fresh reference rows and the
--       generator uses those.
--     - If you already have your own customers/products/etc. and want
--       to skip part 1, the generator will happily use YOUR existing
--       rows instead — just delete/comment out part 1 below.
--
-- SAFE TO RE-RUN? Re-running part 1 will insert duplicate reference
-- rows (no uniqueness constraints on names), and re-running part 2/3
-- will add another 12/8 months on top of whatever's already there.
-- If you just want more data, that's fine — run it again.
-- =====================================================================

SET SERVEROUTPUT ON;

-- =====================================================================
-- PART 1 — base reference data (SKIP this whole part if you already
-- have your own customers/workers/vendors/containers/products and just
-- want orders/purchases generated against them)
-- =====================================================================

-- ---------- CUSTOMERS ----------
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Amir Hafiz',       'amir.hafiz@mail.com',    'No 12, Jalan Damai, Petaling Jaya',   '012-3456701', 'amirh',    'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Siti Nurhaliza',   'siti.nur@mail.com',      'No 45, Jalan Bunga Raya, Shah Alam',  '012-3456702', 'sitinur',  'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Kumar Selvam',     'kumar.selvam@mail.com',  'No 7, Lorong Kasturi, Klang',         '012-3456703', 'kumars',   'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Nur Aisyah',       'nur.aisyah@mail.com',    'No 88, Jalan Melati, Subang Jaya',    '012-3456704', 'nuraisyah','pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Tan Wei Ling',     'wei.ling@mail.com',      'No 3, Jalan Cempaka, Puchong',        '012-3456705', 'weiling',  'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Muhammad Faiz',    'faiz.rahman@mail.com',   'No 21, Jalan Anggerik, Cheras',       '012-3456706', 'faizr',    'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Lee Mei Chin',     'mei.chin@mail.com',      'No 56, Jalan Teratai, Ampang',        '012-3456707', 'meichin',  'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Ahmad Zulkifli',   'ahmad.z@mail.com',       'No 9, Jalan Kenanga, Kajang',         '012-3456708', 'ahmadz',   'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Priya Devi',       'priya.devi@mail.com',    'No 14, Jalan Seroja, Rawang',         '012-3456709', 'priyad',   'pass123');
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Farah Adilah',     'farah.adilah@mail.com',  'No 30, Jalan Mawar, Bangi',           '012-3456710', 'faraha',   'pass123');

-- ---------- WORKERS ----------
-- 1 manager, 3 full-time, 3 part-time. Capture the manager's WorkID so
-- the rest of the team can report to them.
DECLARE
  v_manager_id   WORKERS.WorkID%TYPE;
  v_ft1 WORKERS.WorkID%TYPE; v_ft2 WORKERS.WorkID%TYPE; v_ft3 WORKERS.WorkID%TYPE;
  v_pt1 WORKERS.WorkID%TYPE; v_pt2 WORKERS.WorkID%TYPE; v_pt3 WORKERS.WorkID%TYPE;
BEGIN
  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Aisyah Rahman', '019-1112001', 'admin', 'admin123', 1, NULL)
    RETURNING WorkID INTO v_manager_id;

  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Hafiz Iskandar', '019-1112002', 'hafiz', 'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_ft1;
  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Nurul Izzah',    '019-1112003', 'nurul',  'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_ft2;
  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Ravi Chandran',  '019-1112004', 'ravi',   'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_ft3;

  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Syafiq Amran',   '019-1112005', 'syafiq', 'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_pt1;
  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Wong Kar Yee',   '019-1112006', 'karyee', 'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_pt2;
  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Dinesh Kumar',   '019-1112007', 'dinesh', 'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_pt3;

  INSERT INTO FULL_TIME_WORKERS (WorkID, Salary, Bonus_Salary) VALUES (v_ft1, 2800, 200);
  INSERT INTO FULL_TIME_WORKERS (WorkID, Salary, Bonus_Salary) VALUES (v_ft2, 2900, 200);
  INSERT INTO FULL_TIME_WORKERS (WorkID, Salary, Bonus_Salary) VALUES (v_ft3, 2750, 150);

  INSERT INTO PART_TIME_WORKERS (WorkID, SalaryPerHr) VALUES (v_pt1, 9.5);
  INSERT INTO PART_TIME_WORKERS (WorkID, SalaryPerHr) VALUES (v_pt2, 9.5);
  INSERT INTO PART_TIME_WORKERS (WorkID, SalaryPerHr) VALUES (v_pt3, 10.0);

  COMMIT;
END;
/

-- ---------- VENDORS ----------
INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password) VALUES
  ('Al-Madinah Dates Trading',  'Lot 5, Jalan Industri 2, Klang',      '03-33221001', 'almadinah', 'vend123');
INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password) VALUES
  ('Nakhla Import Sdn Bhd',     'No 18, Jalan Perusahaan, Shah Alam',  '03-33221002', 'nakhla',    'vend123');
INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password) VALUES
  ('Barakah Fruits Supply',     'Lot 21, Kawasan Perindustrian, Klang','03-33221003', 'barakah',   'vend123');
INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password) VALUES
  ('Oasis Wholesale Trading',   'No 9, Jalan Sungai Buloh, Selangor',  '03-33221004', 'oasis',     'vend123');
INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password) VALUES
  ('Golden Palm Distributors',  'Lot 3, Jalan Kapar, Klang',           '03-33221005', 'goldenpalm','vend123');

-- ---------- CONTAINERS ----------
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container A', 'Blue');
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container B', 'Green');
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container C', 'Red');
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container D', 'Yellow');
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container E', 'Grey');

-- ---------- PRODUCTS ----------
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Ajwa Dates 500g',           38.00, 'Dates', 42.00, 'Premium Madinah Ajwa');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Ajwa Dates 1kg',            70.00, 'Dates', 78.00, 'Premium Madinah Ajwa');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Safawi Dates 500g',         25.00, 'Dates', 29.00, 'Soft Safawi variety');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Safawi Dates 1kg',          46.00, 'Dates', 52.00, 'Soft Safawi variety');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Mariami Dates 500g',        18.00, 'Dates', 21.00, 'Sweet Mariami dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Sukkary Dates 500g',        32.00, 'Dates', 36.00, 'Royal Sukkary dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Sukkary Dates 1kg',         60.00, 'Dates', 68.00, 'Royal Sukkary dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Khalas Dates 500g',         15.00, 'Dates', 18.00, 'Everyday Khalas dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Medjool Dates 500g',        45.00, 'Dates', 50.00, 'Large Medjool dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Medjool Dates 1kg',         85.00, 'Dates', 95.00, 'Large Medjool dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Dates Chocolate Box 250g',  28.00, 'Confectionery', 32.00, 'Chocolate-coated dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Stuffed Dates (Almond) 400g',33.00, 'Confectionery', 38.00, 'Almond-stuffed dates');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Date Syrup 350ml',          19.00, 'Syrup', 22.00, 'Pure date syrup');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Date Paste 500g',           22.00, 'Paste', 25.00, 'Natural date paste');
INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc) VALUES
  ('Festive Dates Hamper',      120.00,'Hamper', 135.00,'Assorted dates gift hamper');

COMMIT;

-- =====================================================================
-- PART 2 — ~12 months of ORDERS + ORDER_PRODUCTS
-- =====================================================================
DECLARE
  TYPE num_tab IS TABLE OF NUMBER;
  v_cust_ids  num_tab;
  v_work_ids  num_tab;
  v_prod_ids  num_tab;

  v_order_id     ORDERS.OrderID%TYPE;
  v_order_date   DATE;
  v_status       VARCHAR2(20);
  v_tracking     VARCHAR2(30);
  v_days_ago     NUMBER;
  v_orders_this_month NUMBER;
  v_num_products NUMBER;
  v_prod_idx     NUMBER;
  v_cust_id      NUMBER;
  v_work_id      NUMBER;
  v_prod_id      NUMBER;
  v_qty          NUMBER;

  -- track which products are already on the current order to avoid
  -- duplicate (OrderID, ProdID) rows
  TYPE used_tab IS TABLE OF BOOLEAN INDEX BY PLS_INTEGER;
  v_used used_tab;

  FUNCTION rand_hex4 RETURN VARCHAR2 IS
  BEGIN
    RETURN TO_CHAR(TRUNC(DBMS_RANDOM.VALUE(0, 65536)), 'FM0XXX');
  END;
BEGIN
  SELECT CustID BULK COLLECT INTO v_cust_ids FROM CUSTOMERS;
  SELECT WorkID BULK COLLECT INTO v_work_ids FROM WORKERS WHERE IsManager = 0;
  SELECT ProdID BULK COLLECT INTO v_prod_ids FROM PRODUCTS;

  IF v_cust_ids.COUNT = 0 OR v_work_ids.COUNT = 0 OR v_prod_ids.COUNT = 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'Need at least one customer, non-manager worker and product before generating orders.');
  END IF;

  -- month_offset 11 = 11 months ago ... 0 = current month
  FOR month_offset IN REVERSE 0..11 LOOP

    -- mild upward trend: older months quieter, recent months busier
    v_orders_this_month := TRUNC(DBMS_RANDOM.VALUE(8, 14)) + (11 - month_offset);

    FOR i IN 1..v_orders_this_month LOOP

      -- random day within that month (don't go past today for month_offset = 0)
      IF month_offset = 0 THEN
        v_order_date := TRUNC(SYSDATE) - TRUNC(DBMS_RANDOM.VALUE(0, EXTRACT(DAY FROM SYSDATE)));
      ELSE
        v_order_date := ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -month_offset)
                        + TRUNC(DBMS_RANDOM.VALUE(0, 27));
      END IF;

      v_days_ago := TRUNC(SYSDATE) - v_order_date;

      -- status distribution based on order age
      IF v_days_ago > 14 THEN
        v_status := 'Delivered';
      ELSIF v_days_ago > 5 THEN
        v_status := CASE WHEN DBMS_RANDOM.VALUE < 0.7 THEN 'Delivered' ELSE 'In Delivery' END;
      ELSIF v_days_ago > 1 THEN
        v_status := CASE WHEN DBMS_RANDOM.VALUE < 0.5 THEN 'In Delivery' ELSE 'Processing' END;
      ELSE
        v_status := 'Processing';
      END IF;

      v_cust_id := v_cust_ids(TRUNC(DBMS_RANDOM.VALUE(1, v_cust_ids.COUNT + 1)));
      v_work_id := v_work_ids(TRUNC(DBMS_RANDOM.VALUE(1, v_work_ids.COUNT + 1)));

      INSERT INTO ORDERS (OrderDate, CustID, WorkID, OrderStatus)
      VALUES (
        v_order_date,
        v_cust_id,
        v_work_id,
        v_status
      )
      RETURNING OrderID INTO v_order_id;

      IF v_status IN ('In Delivery', 'Delivered') THEN
        v_tracking := 'KA-' || TO_CHAR(v_order_date, 'YYYYMMDD') || '-'
                      || LPAD(TO_CHAR(v_order_id), 6, '0') || '-'
                      || UPPER(SUBSTR(rand_hex4, 1, 4));
        UPDATE ORDERS SET TrackingNo = v_tracking WHERE OrderID = v_order_id;
      END IF;

      -- 1 to 3 distinct products per order
      v_used.DELETE;
      v_num_products := TRUNC(DBMS_RANDOM.VALUE(1, 4));

      FOR p IN 1..v_num_products LOOP
        LOOP
          v_prod_idx := TRUNC(DBMS_RANDOM.VALUE(1, v_prod_ids.COUNT + 1));
          EXIT WHEN NOT v_used.EXISTS(v_prod_idx);
        END LOOP;
        v_used(v_prod_idx) := TRUE;
        v_prod_id := v_prod_ids(v_prod_idx);
        v_qty     := TRUNC(DBMS_RANDOM.VALUE(1, 6));

        INSERT INTO ORDER_PRODUCTS (OrderID, ProdID, Qty)
        VALUES (v_order_id, v_prod_id, v_qty);
      END LOOP;

    END LOOP;
  END LOOP;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('Orders generated successfully.');
END;
/

-- =====================================================================
-- PART 3 — ~8 months of PURCHASE + PURCHASE_PRODUCT (+ INVENTORY for
-- the portion already "received")
-- =====================================================================
DECLARE
  TYPE num_tab IS TABLE OF NUMBER;
  v_work_ids num_tab;
  v_vend_ids num_tab;
  v_prod_ids num_tab;
  v_cont_ids num_tab;

  v_purch_id       PURCHASE.PurchID%TYPE;
  v_purch_date     DATE;
  v_purchases_this_month NUMBER;
  v_num_products   NUMBER;
  v_prod_idx       NUMBER;
  v_qty            NUMBER;
  v_qty_received   NUMBER;
  v_days_ago       NUMBER;
  v_work_id        NUMBER;
  v_vend_id        NUMBER;
  v_prod_id        NUMBER;
  v_cont_id        NUMBER;

  TYPE used_tab IS TABLE OF BOOLEAN INDEX BY PLS_INTEGER;
  v_used used_tab;
BEGIN
  SELECT WorkID BULK COLLECT INTO v_work_ids FROM WORKERS WHERE IsManager = 0;
  SELECT VendID BULK COLLECT INTO v_vend_ids FROM VENDORS;
  SELECT ProdID BULK COLLECT INTO v_prod_ids FROM PRODUCTS;
  SELECT ContID BULK COLLECT INTO v_cont_ids FROM CONTAINERS;

  IF v_work_ids.COUNT = 0 OR v_vend_ids.COUNT = 0 OR v_prod_ids.COUNT = 0 OR v_cont_ids.COUNT = 0 THEN
    RAISE_APPLICATION_ERROR(-20002, 'Need at least one non-manager worker, vendor, product and container before generating purchases.');
  END IF;

  FOR month_offset IN REVERSE 0..7 LOOP

    v_purchases_this_month := TRUNC(DBMS_RANDOM.VALUE(2, 5));

    FOR i IN 1..v_purchases_this_month LOOP

      IF month_offset = 0 THEN
        v_purch_date := TRUNC(SYSDATE) - TRUNC(DBMS_RANDOM.VALUE(0, EXTRACT(DAY FROM SYSDATE)));
      ELSE
        v_purch_date := ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -month_offset)
                        + TRUNC(DBMS_RANDOM.VALUE(0, 27));
      END IF;

      v_days_ago := TRUNC(SYSDATE) - v_purch_date;

      v_work_id := v_work_ids(TRUNC(DBMS_RANDOM.VALUE(1, v_work_ids.COUNT + 1)));
      v_vend_id := v_vend_ids(TRUNC(DBMS_RANDOM.VALUE(1, v_vend_ids.COUNT + 1)));

      INSERT INTO PURCHASE (PurchDate, WorkID, VendID)
      VALUES (
        v_purch_date,
        v_work_id,
        v_vend_id
      )
      RETURNING PurchID INTO v_purch_id;

      v_used.DELETE;
      v_num_products := TRUNC(DBMS_RANDOM.VALUE(1, 4));

      FOR p IN 1..v_num_products LOOP
        LOOP
          v_prod_idx := TRUNC(DBMS_RANDOM.VALUE(1, v_prod_ids.COUNT + 1));
          EXIT WHEN NOT v_used.EXISTS(v_prod_idx);
        END LOOP;
        v_used(v_prod_idx) := TRUE;
        v_prod_id := v_prod_ids(v_prod_idx);

        v_qty := TRUNC(DBMS_RANDOM.VALUE(10, 60));

        -- older purchases: fully received. ~1-2 months old: partially
        -- received. current month: mostly still unreceived.
        IF v_days_ago > 45 THEN
          v_qty_received := v_qty;
        ELSIF v_days_ago > 14 THEN
          v_qty_received := TRUNC(v_qty * DBMS_RANDOM.VALUE(0.4, 1));
        ELSE
          v_qty_received := CASE WHEN DBMS_RANDOM.VALUE < 0.3
                                  THEN TRUNC(v_qty * DBMS_RANDOM.VALUE(0, 0.5))
                                  ELSE 0 END;
        END IF;

        INSERT INTO PURCHASE_PRODUCT (PurchID, ProdID, Qty, QtyReceived)
        VALUES (v_purch_id, v_prod_id, v_qty, v_qty_received);

        IF v_qty_received > 0 THEN
          v_cont_id := v_cont_ids(TRUNC(DBMS_RANDOM.VALUE(1, v_cont_ids.COUNT + 1)));

          INSERT INTO INVENTORY (ProdID, ContID, PurchID, Qty, DateAssigned)
          VALUES (
            v_prod_id,
            v_cont_id,
            v_purch_id,
            v_qty_received,
            v_purch_date + TRUNC(DBMS_RANDOM.VALUE(1, 5))
          );
        END IF;
      END LOOP;

    END LOOP;
  END LOOP;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE('Purchases generated successfully.');
END;
/