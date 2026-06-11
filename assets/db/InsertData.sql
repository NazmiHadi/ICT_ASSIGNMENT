-- =====================================
-- CONTAINERS
-- =====================================
INSERT INTO CONTAINERS (ContName, ContDate, ContColour) VALUES ('Container A', DATE '2025-01-10', 'Red');
INSERT INTO CONTAINERS (ContName, ContDate, ContColour) VALUES ('Container B', DATE '2025-02-15', 'Blue');
INSERT INTO CONTAINERS (ContName, ContDate, ContColour) VALUES ('Container C', DATE '2025-03-20', 'Green');

-- =====================================
-- PRODUCTS
-- (ContID 1, 2, 3 correspond to the containers inserted above)
-- =====================================
INSERT INTO PRODUCTS (ProdName, ProdDesc, Price, ProdType, SalesPrice, ContID)
VALUES ('Ajwa Dates 500g', 'Premium Ajwa dates from Madinah, vacuum packed.', 25.00, 'Dates', 29.90, 1);

INSERT INTO PRODUCTS (ProdName, ProdDesc, Price, ProdType, SalesPrice, ContID)
VALUES ('Ajwa Dates 1kg', 'Premium Ajwa dates, 1kg family pack.', 45.00, 'Dates', 52.90, 1);

INSERT INTO PRODUCTS (ProdName, ProdDesc, Price, ProdType, SalesPrice, ContID)
VALUES ('Date Syrup 350ml', 'Natural date syrup, no added sugar.', 12.00, 'Syrup', 15.90, 2);

INSERT INTO PRODUCTS (ProdName, ProdDesc, Price, ProdType, SalesPrice, ContID)
VALUES ('Chocolate Coated Dates 250g', 'Ajwa dates coated in dark chocolate.', 18.00, 'Snacks', 22.90, 2);

INSERT INTO PRODUCTS (ProdName, ProdDesc, Price, ProdType, SalesPrice, ContID)
VALUES ('Date Seed Coffee 200g', 'Roasted date seed powder, caffeine-free coffee alternative.', 20.00, 'Beverage', 24.90, 3);

-- =====================================
-- INVENTORY
-- (ProdID 1-5 correspond to products inserted above, in order)
-- =====================================
INSERT INTO INVENTORY (ProdID, ContID, Qty) VALUES (1, 1, 150);
INSERT INTO INVENTORY (ProdID, ContID, Qty) VALUES (2, 1, 80);
INSERT INTO INVENTORY (ProdID, ContID, Qty) VALUES (3, 2, 200);
INSERT INTO INVENTORY (ProdID, ContID, Qty) VALUES (4, 2, 60);
INSERT INTO INVENTORY (ProdID, ContID, Qty) VALUES (5, 3, 100);

COMMIT;