## 1. Check Commit History

```bash
git log
```
very very important, everytime korang pull please tengok log and tengok apa yang orang lain ubah utk faham entire system ni
> Lepas buat `git log` and takleh type command, tekan `q` utk keluar log.

---

## 2. Save and Upload Your Changes

```bash
git add .
git commit -m "comment"
git push origin main
```

#### `git commit -m "comment"`

comment dalam commit ni kena bagitau specific tau yg korang buat apa sbb nnti keluar dekat log nak bagi orang lain faham apa yang korang ubah
comment ni akan keluar dlm git log untuk orang lain baca.

#### `git push origin main`
```bash
git push origin main
```

jgn lupa letak origin main dekat push dengan pull. taknak terbuat branch baru.

---

## 3. Get Latest Changes

```bash
git pull origin main
```

or

```bash
git pull
```
Bila nak buat kerja je, sentiasa pull supaya korang tak bekerja dengan code yang lama/dah rosak.
---

## 4. Check Current Status

```bash
git status
```
nak tengok file apa yg korang tukar
dengan file apa yang sync dengan git. --kadang ii dia tak sync so takyah kisah sgt. asalkan korang pull takda masalah.
---

## 5. Clear Terminal

```bash
cls
```
clear terminal.

---

# File Naming & Folder References

nnti aku letak file txt db dalam folder asset, pastu folder db comment dia nnti camni 
"added a database creation sql script into /asset/db"  -- maksudnya dalam folder asset, dalam folder db

```text
asset/
└── db/
    └── database.sql
```

korang akan nampak comment dalam log mcm ni
> added database creation SQL script into /asset/db

dekat dalam file asset, patu dalam file db

---

# Recommended Workflow

Before coding:

```bash
git pull origin main
git log
```

After coding:

```bash
git add .
git commit -m "your meaningful comment"
git push origin main
```

If patu check status

```bash
git status
```

---

# Q&A

jgn tanya plis.

