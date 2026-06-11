

--GUNA SQL NI DALAM SYSTEM


-- Connect as SYS or another DBA account
CREATE USER KurmaAjwa IDENTIFIED BY oracle;

-- Grant login permission
GRANT CREATE SESSION TO KurmaAjwa;

-- Grant common development privileges
GRANT CREATE TABLE TO KurmaAjwa;
GRANT CREATE VIEW TO KurmaAjwa;
GRANT CREATE SEQUENCE TO KurmaAjwa;
GRANT CREATE TRIGGER TO KurmaAjwa;
GRANT CREATE PROCEDURE TO KurmaAjwa;

-- Give unlimited space in the USERS tablespace
ALTER USER KurmaAjwa QUOTA UNLIMITED ON USERS;