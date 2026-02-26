# Adjust Inventory – Testing Guide

**Feature**: Set a SKU’s total inventory quantity and record a reason (same backend as web: `POST /api/inventory/skus/{sku_id}/adjust-inventory`).  
**Spec**: [SPEC_SKU_EDIT_QUANTITY.md](./SPEC_SKU_EDIT_QUANTITY.md)

---

## How to open the flow

1. Open the app and log in.
2. Tap the **Adjust** tab (bottom tab bar).
3. Scan a SKU barcode (or enter code if your build supports it).
4. You land on **Adjust Inventory** with that SKU’s current quantity and fields for new quantity and reason.

---

## Required fields and validation

- **New quantity**: Integer ≥ 0. If invalid or negative, the app shows an error (e.g. “Quantity must be 0 or greater” or a 422 message from the server).
- **Reason for change**: Required, non-empty after trim. If empty, the app shows an error (e.g. “Reason is required” or server validation message).

---

## Success behavior

- After a successful save:
  - A success screen shows: “Inventory updated”, “{sku_code} is now set to {newQuantity} units.”
  - If the backend returned Shopify sync status:
    - Synced: “Synced to Shopify.” is appended.
    - Failed: “Shopify sync failed.” or “Shopify sync failed: {message}” is appended.
  - **Adjust another** returns you to the Adjust (scan) screen so you can scan another SKU.

---

## Manual test checklist

Use this to verify the Adjust flow end-to-end.

- [ ] **Happy path**  
  Open Adjust → scan valid SKU → Adjust Inventory loads with correct SKU and current quantity. Enter new quantity and reason → Save → success screen shows updated quantity; “Adjust another” returns to scan.

- [ ] **Validation – negative quantity**  
  Enter negative new quantity → Save → error shown (client or 422 message).

- [ ] **Validation – empty reason**  
  Leave reason blank → Save → error shown (client or 422 message).

- [ ] **Invalid / missing SKU**  
  Navigate to Adjust Inventory with invalid or non-existent `skuId` (if possible in your build) → appropriate error and a way back to scan (e.g. “Back to Scan”).

- [ ] **Shopify sync message (if backend returns it)**  
  After a successful save for a SKU that has Shopify linked, success message includes “Synced to Shopify” or “Shopify sync failed” as returned by the API.

- [ ] **Revert**  
  Change new quantity so it differs from current → “Revert” appears → tap Revert → new quantity resets to current.

- [ ] **401/403**  
  If session expires and the adjust request returns 401/403, user sees an auth-related message (e.g. “Please log in again”) instead of a generic error.

---

## API used

- **Endpoint**: `POST /api/inventory/skus/{sku_id}/adjust-inventory`
- **Body**: `{ "new_quantity": number, "reason": string }`
- **Response**: 200 with `success`, `message`, and `data` (e.g. `old_quantity`, `new_quantity`, `difference`, `shopify_synced`, `shopify_error`).

Same contract as the web app; see [SPEC_SKU_EDIT_QUANTITY.md](./SPEC_SKU_EDIT_QUANTITY.md) for full details.
