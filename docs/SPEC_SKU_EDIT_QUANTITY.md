# Spec: SKU Edit Quantity (Adjust Inventory)

**Status**: Implemented (backend + frontend); mobile aligned.  
**Source**: ship-right-backend, ship-right-frontend.  
**Last updated**: February 2026

---

## 1. Overview

**SKU Edit Quantity** (also called **Adjust Inventory**) lets users set a SKU’s total inventory quantity to a new value and record a reason. The system updates the WMS, optionally syncs to Shopify, and logs the change for audit.

| Layer    | Role |
|----------|------|
| Backend  | Single source of truth: `POST /api/inventory/skus/{sku_id}/adjust-inventory` |
| Frontend | SKU detail page → “Edit” → modal (current qty, new qty, reason) → save |
| Mobile   | Adjust tab → scan SKU → Adjust screen (current qty, new qty, reason) → save |

---

## 2. Backend (Source of Truth)

### 2.1 Endpoint

- **Method/URL**: `POST /api/inventory/skus/{sku_id}/adjust-inventory`
- **Auth**: Required (Bearer).
- **Path**: `sku_id` = SKU UUID.

### 2.2 Request Body

```json
{
  "new_quantity": 15,
  "reason": "Physical count adjustment - found 5 extra units"
}
```

| Field          | Type   | Required | Rules |
|----------------|--------|----------|--------|
| `new_quantity` | number | Yes      | Integer, ≥ 0 |
| `reason`       | string | Yes      | Non-empty after trim |

- **Schema**: `InventoryAdjustmentRequest` in `backend/schemas/inventory.py`.
- **Validation**: 422 when quantity &lt; 0 or reason empty; 404 when SKU not found.

### 2.3 Success Response (200)

```json
{
  "success": true,
  "message": "Inventory adjusted successfully",
  "data": {
    "sku_id": "uuid",
    "sku_code": "SKU-123",
    "old_quantity": 10,
    "new_quantity": 15,
    "difference": 5,
    "reason": "Physical count adjustment...",
    "shopify_synced": true,
    "updated_at": "2026-02-24T18:00:00Z"
  }
}
```

- If Shopify sync fails but WMS update succeeds: `message` = `"Inventory adjusted in WMS, but Shopify sync failed"`, `data.shopify_synced` = `false`, `data.shopify_error` may be set.

### 2.4 Backend Behavior

1. Validate `new_quantity` ≥ 0 and `reason` non-empty.
2. Load SKU by `sku_id`; 404 if missing.
3. Update `SKU.inventory_quantity` to `new_quantity`.
4. Log to history (entity_type `sku`, description includes old → new and reason).
5. If SKU has `shopify_variant_id`, call Shopify GraphQL `inventorySetQuantities`; do not fail the request if Shopify fails.
6. Return success payload with `old_quantity`, `new_quantity`, `difference`, `shopify_synced`, `updated_at`.

**Files**: `backend/routers/inventory.py` (adjust endpoint), `backend/schemas/inventory.py` (request model), `backend/services/shopify_service.py` (set_inventory_quantity).

---

## 3. Frontend (Reference Implementation)

### 3.1 Entry Point

- **Screen**: Warehouse → SKUs → [SKU] → Detail page.
- **UI**: “Edit” button in the **Inventory Stats** card.

### 3.2 Edit Flow

1. User clicks “Edit” → modal opens.
2. Modal shows:
   - SKU code and name (read-only).
   - **Current quantity** (read-only).
   - **New quantity** (number input, ≥ 0).
   - Optional “Revert” to reset new quantity to current.
   - **Difference** (+/- units) when new ≠ current.
   - **Reason for change** (textarea, required).
   - Hint: “This will be logged in the history and synced to Shopify.”
3. User submits → client sends `POST .../adjust-inventory` with `new_quantity` and `reason`.
4. On success: close modal, refresh inventory (and history/notes), show success message (e.g. “Inventory updated successfully and synced to Shopify”).
5. On error: show validation or server error in modal (including 422 Pydantic detail).

### 3.3 Validation (Client)

- New quantity: integer, ≥ 0.
- Reason: required, non-empty after trim.

### 3.4 Files

- `frontend/components/inventory/EditInventoryModal.tsx` – modal UI and submit.
- `frontend/app/warehouse/skus/[id]/page.tsx` – “Edit” button, modal state, `onSuccess` refresh and toast.

---

## 4. Mobile (This App) – Requirements

### 4.1 Entry Point

- **Tab**: Adjust.
- **Flow**: User scans SKU (barcode) → navigate to **Adjust Inventory** screen with `skuId` in params.

### 4.2 Adjust Inventory Screen – Must Have

1. **Load SKU**
   - GET `/api/inventory/skus/{sku_id}` and optionally GET `.../locations` for current total.
   - Show loading until SKU is loaded; on error (e.g. 404) show message and “Back to Scan”.

2. **Display**
   - SKU code and name.
   - **Current quantity** (read-only).
   - **New quantity** (numeric input, ≥ 0).
   - **Reason for change** (multiline input, required).
   - Optional: show **difference** (+/- units) when new ≠ current.

3. **Submit**
   - Validate: new quantity integer ≥ 0; reason non-empty.
   - POST `/api/inventory/skus/{sku_id}/adjust-inventory` with `{ new_quantity, reason }`.
   - On success: show success state (e.g. “Inventory updated”, new quantity), with “Adjust another” back to scan.
   - On error: show server/validation error (including 422 body if available).

4. **Navigation**
   - From Adjust root (scan screen) → Adjust Inventory (with `skuId`).
   - Success → “Adjust another” returns to Adjust root.

### 4.3 Optional (Nice to Have)

- Show **Shopify sync status** in success message when backend returns `shopify_synced` / `shopify_error`.
- “Revert” control to reset new quantity to current.
- Handle 422 response body (array of `{ loc, msg }`) for clearer validation messages.

### 4.4 Files (Mobile)

- `src/screens/AdjustScreen.tsx` – Adjust root (scan).
- `src/screens/AdjustInventoryScreen.tsx` – form, API call, success state.
- `src/navigation/types.ts` – `AdjustStackParamList` with `AdjustInventory: { skuId: string }`.
- `src/api/client.ts` – shared API client (used by AdjustInventoryScreen).

---

## 5. Acceptance Criteria (All Platforms)

| # | Criteria | Backend | Frontend | Mobile |
|---|-----------|---------|----------|--------|
| 1 | Adjust endpoint accepts `new_quantity` and `reason`, validates, updates WMS, logs history | ✅ | — | — |
| 2 | Shopify sync attempted when variant linked; WMS success even if Shopify fails | ✅ | — | — |
| 3 | User can open edit/adjust from SKU context (detail page or scan) | — | ✅ | ✅ |
| 4 | Current quantity displayed; new quantity and reason required | — | ✅ | ✅ |
| 5 | Client validates quantity ≥ 0 and reason non-empty | — | ✅ | ✅ |
| 6 | On success, user sees confirmation and data refresh or “Adjust another” | — | ✅ | ✅ |
| 7 | On error, user sees clear message (validation or server) | — | ✅ | ✅ |

---

## 6. References

- Backend task summary: `ship-right-backend/docs/TASK_COMPLETE_SKU_INVENTORY_EDIT.md`
- Backend full doc: `ship-right-backend/docs/SKU_INVENTORY_EDIT_COMPLETE.md`
- Frontend modal: `ship-right-frontend/frontend/components/inventory/EditInventoryModal.tsx`
- Mobile implementation: `smart-ship-right-mobile/src/screens/AdjustInventoryScreen.tsx`
