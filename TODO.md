# TODO
- 

## ADMIN
-
- dekat dalam inventory management, also letak purchaseid dekat dalam tu. cth 3 barang sampai harini. kita masukkan 2 barang harini dgn 1 barang esok dlm inventory. kena tau dari purchase mana 2 dengan 1 barang tu.
  


## CUSTOMER


## DATABASE

NPM INSTALL MULTER


## Kenapa ada recieve purhcase dengan manage inventory
Good question — but I'd say we still need it, for two reasons that are actually separate from "assigning inventory":
1. Viewing current stock levels
Receive Purchase doesn't show you inventory — it shows you purchase lines (this purchase, this product, how much is left to receive). It never answers "how much Ajwa dates do we have in Container B right now, across everything." That's what the Inventory page's table is for, and it's the only place that does it.
Actually, there's a wrinkle here worth flagging: since INVENTORY now stores one row per batch (per product + container + purchase), a product sitting in one container from three different purchases shows up as three separate rows. Right now the page just lists them all — there's no rolled-up total per product/container. So if someone's trying to answer "do we have enough stock to fulfill this order," they'd have to manually add up rows in their head. I'd suggest adding a summary/total row per product+container (while keeping the detailed batch rows underneath, so we don't lose the traceability we just built). Want me to add that?
2. Handling stock that doesn't come from a purchase
Receive Purchase only makes sense when there's a purchase to receive against. But plenty of real stock movements aren't purchases:

Opening/initial stock when the system first goes live
Damaged, spoiled, or lost stock (write-offs)
Miscounts / stock-take corrections
Customer returns going back into inventory

There's no PurchID for any of these — they need a manual entry path. That's what the "Set/Update Stock" form is actually for now (I relabeled it that way last time specifically to stop it being used as a substitute for receiving).
One follow-up thought given our part-time discussion
Now that part-timers have proper Receive Purchase access, the main reason they'd have needed the manual form (routine restocking) is covered by the real flow. Since the manual form is a SET (overwrite), not additive, leaving it open to everyone means someone could still put in a stray number that has no paper trail. Want me to restrict the manual add/update form to admin/full-time only, and leave part-time (and everyone) with view-only access on that page otherwise?