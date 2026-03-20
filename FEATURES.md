# SmartShipRight Mobile – Features & Alignment

This document maps the mobile app to **ShipRight frontend/backend** and to **ShipHero iOS mobile** ([User Guide](https://software-help.shiphero.com/hc/en-us/articles/8497107616269-User-Guide-to-the-ShipHero-iOS-Mobile-App)).

---

## ShipHero parity (reference)

| ShipHero feature | Mobile status | Backend / frontend reference |
|------------------|---------------|------------------------------|
| **Personal settings** (profile, switch user, log out) | ✅ Log out in Settings; user name/initials shown | `POST /api/auth/logout`, `GET /api/auth/me` |
| **Dashboard** (ready-to-ship, items to pick) | ✅ Picking start shows order stats (pending/picking/packed) | `GET /api/orders/stats/dashboard`, `GET /api/dashboard/overview` |
| **Single Item Batch** | ✅ Create flow: single_item batch, tote, pick list, scan, +1, complete | `POST /api/picking/batches/create-dynamic`, pick-list, scan_item, complete |
| **Multi-Item Batch** | ✅ Create flow: multi_item, totes, pick list, scan, order name, complete | Same; skip order supported |
| **Single Order** (one order per batch) | 📋 Backend: `POST /api/picking/batches/create/single-order`; mobile: not yet (select order → create batch) | Frontend: single-order batch creation |
| **Report Issue / Skip order** | ✅ Multi-item: “Skip order” with reason → order on hold | `POST /api/picking/batches/{id}/skip-order` |
| **Progress** (orders in batch, totes, items left) | ✅ Workflow strip + Picked/Remaining/Items stats | Batch progress in frontend `PickingProgress` |
| **Skipped items (Hospital)** | ✅ Banner when API returns `skipped_items` | Backend filters hospital SKUs; returns `skipped_items` |
| **Products** (search, edit, print, cycle count) | ✅ Adjust tab: scan SKU, set qty (adjust); Move SKU: move inventory | `POST /api/inventory/adjust`, `POST /api/inventory/move-sku`; cycle count via adjust |
| **User settings** (default order status, workstation) | 📋 Not in backend; optional future | — |
| **Packing** (scan tote, pack, print label) | 📋 Backend has `/api/shipping/packing/*`; mobile no Packing tab yet | Frontend: `app/packing/` |

---

## ShipRight backend APIs used by mobile

- **Auth:** `POST /api/auth/login`, logout (client-side); token + user persisted.
- **Picking:**  
  `GET /api/picking/batches`, `POST /api/picking/batches/create-dynamic`,  
  `GET /api/picking/batches/{id}/pick-list`, `POST /api/picking/batches/{id}/scan_item`,  
  `POST /api/picking/batches/{id}/complete`, `POST /api/picking/batches/{id}/reset`,  
  `DELETE /api/picking/batches/{id}`, `POST /api/picking/batches/{id}/skip-order`,  
  `GET /api/picking/totes/barcode/{barcode}`, `GET /api/picking/batches/available-orders`.
- **Orders:** `GET /api/orders/` (list), `GET /api/orders/stats/dashboard` (counts).
- **Inventory:** `POST /api/inventory/adjust`, `POST /api/inventory/move-sku`, SKU lookup, move history.
- **Dashboard:** `GET /api/dashboard/overview` (optional for richer stats).

---

## ShipRight frontend reference (for parity)

- **Picking:** `frontend/app/picking/page.tsx`, `app/picking/[batchId]/page.tsx`, `useBatchPicking`, `PickingProgress`, `ItemCard`, `SingleItemScanFlow`, `MultiItemScanFlow`, `SkippedDigitalItems`, `ItemHospitalModal`, skip order.
- **Orders:** `app/orders/manage/page.tsx` (filters, list), `app/orders/[id]/page.tsx` (detail).
- **Packing:** `app/packing/page.tsx`, `app/packing/[batchId]/page.tsx` (scan tote, pack, print).
- **Products / warehouse:** `app/warehouse/skus/`, `app/utils/adjust-inventory/page.tsx`, `app/utils/move-sku/page.tsx`.

---

## Implemented in this update

1. **Dashboard-style stats on Picking start** – Fetches `GET /api/orders/stats/dashboard` and shows pending / picking / packed (ready-to-ship style).
2. **Skip order (Report issue)** – In picking view for multi-item batches, “Skip order” on current item calls `POST /api/picking/batches/{id}/skip-order` with order_id and reason; order goes on hold.
3. **User in Settings** – Current user name and initials displayed in Settings; Sign out unchanged.
