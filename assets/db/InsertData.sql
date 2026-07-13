-- =====================================================================
-- SIMPLE SEED DATA — minimal reference rows plus 3 products (with your
-- already-uploaded image filenames) and some inventory to go with them.
--
-- Includes: 1 customer, 1 manager, 1 full-time worker, 1 part-time
-- worker, 1 vendor, 3 containers, 3 products, inventory assigning each
-- product into a container.
-- =====================================================================

-- ---------- CUSTOMER ----------
INSERT INTO CUSTOMERS (CustName, CustEmail, CustAddress, CustPhoneNum, username, password) VALUES
  ('Amir Hafiz', 'amir.hafiz@mail.com', 'No 12, Jalan Damai, Petaling Jaya', '012-3456701', 'amirh', 'pass123');

-- ---------- WORKERS ----------
-- 1 manager, 1 full-time, 1 part-time. Capture the manager's WorkID so
-- the other two can report to them.
DECLARE
  v_manager_id WORKERS.WorkID%TYPE;
  v_ft_id      WORKERS.WorkID%TYPE;
  v_pt_id      WORKERS.WorkID%TYPE;
BEGIN
  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Aisyah Rahman', '019-1112001', 'admin', 'admin123', 1, NULL)
    RETURNING WorkID INTO v_manager_id;

  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Hafiz Iskandar', '019-1112002', 'hafiz', 'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_ft_id;

  INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, IsManager, ManagerID)
    VALUES ('Syafiq Amran', '019-1112005', 'syafiq', 'pass123', 0, v_manager_id)
    RETURNING WorkID INTO v_pt_id;

  INSERT INTO FULL_TIME_WORKERS (WorkID, Salary, Bonus_Salary) VALUES (v_ft_id, 2800, 200);
  INSERT INTO PART_TIME_WORKERS (WorkID, SalaryPerHr) VALUES (v_pt_id, 9.5);

  COMMIT;
END;
/

-- ---------- VENDOR ----------
INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password) VALUES
  ('Al-Madinah Dates Trading', 'Lot 5, Jalan Industri 2, Klang', '03-33221001', 'almadinah', 'vend123');

-- ---------- CONTAINERS ----------
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container A', 'Blue');
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container B', 'Green');
INSERT INTO CONTAINERS (ContName, ContColour) VALUES ('Container C', 'Red');

COMMIT;

-- ---------- PRODUCTS + INVENTORY ----------
-- 3 products, each pointing at one of your already-uploaded image files
-- (these must already exist in uploads/products/ on disk — this script
-- only stores the filename reference, it doesn't touch the filesystem).
-- Each product is then given one inventory batch in a different
-- container. PurchID is left NULL since this stock isn't tied to any
-- purchase record — it's a manual/direct assignment.
DECLARE
  v_prod1_id PRODUCTS.ProdID%TYPE;
  v_prod2_id PRODUCTS.ProdID%TYPE;
  v_prod3_id PRODUCTS.ProdID%TYPE;

  v_contA_id CONTAINERS.ContID%TYPE;
  v_contB_id CONTAINERS.ContID%TYPE;
  v_contC_id CONTAINERS.ContID%TYPE;
BEGIN
  INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc, ImageFileName)
    VALUES ('Ajwa Dates 500g', 38.00, 'Dates', 42.00, 'Premium Madinah Ajwa',
            'prod-1783565361470-435240.jfif')
    RETURNING ProdID INTO v_prod1_id;

  INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc, ImageFileName)
    VALUES ('Safawi Dates 500g', 25.00, 'Dates', 29.00, 'Soft Safawi variety',
            'prod-1783565512469-141142.jfif')
    RETURNING ProdID INTO v_prod2_id;

  INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc, ImageFileName)
    VALUES ('Medjool Dates 500g', 45.00, 'Dates', 50.00, 'Large Medjool dates',
            'prod-1783565874316-452062.jfif')
    RETURNING ProdID INTO v_prod3_id;

  SELECT ContID INTO v_contA_id FROM CONTAINERS WHERE ContName = 'Container A';
  SELECT ContID INTO v_contB_id FROM CONTAINERS WHERE ContName = 'Container B';
  SELECT ContID INTO v_contC_id FROM CONTAINERS WHERE ContName = 'Container C';

  INSERT INTO INVENTORY (ProdID, ContID, PurchID, Qty, DateAssigned)
    VALUES (v_prod1_id, v_contA_id, NULL, 50, SYSDATE);

  INSERT INTO INVENTORY (ProdID, ContID, PurchID, Qty, DateAssigned)
    VALUES (v_prod2_id, v_contB_id, NULL, 40, SYSDATE);

  INSERT INTO INVENTORY (ProdID, ContID, PurchID, Qty, DateAssigned)
    VALUES (v_prod3_id, v_contC_id, NULL, 30, SYSDATE);

  COMMIT;
END;
/