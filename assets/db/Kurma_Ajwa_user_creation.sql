

--GUNA SQL NI DALAM SYSTEM


-- Connect as SYS or another DBA account
CREATE USER KurmaAjwa IDENTIFIED BY oracle;

GRANT ALL PRIVILEGES TO KurmaAjwa;

-- Give unlimited space in the USERS tablespace
ALTER USER KurmaAjwa QUOTA UNLIMITED ON USERS;