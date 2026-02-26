# Tasks: SKU Edit Quantity (Adjust Inventory) – Mobile

**Spec**: [SPEC_SKU_EDIT_QUANTITY.md](./SPEC_SKU_EDIT_QUANTITY.md)  
**Context**: Backend and frontend already implement SKU edit quantity; these tasks align and improve the mobile app.

---

## Task list

| ID | Task | Priority | Status |
|----|------|----------|--------|
| T1 | Verify API contract and error handling | High | Pending |
| T2 | Optional: Show Shopify sync status on success | Low | Pending |
| T3 | Optional: Revert new quantity to current | Low | Pending |
| T4 | Optional: Parse 422 validation errors for messages | Low | Pending |
| T5 | Document and manual test checklist | Medium | Pending |

---

## T1 – Verify API contract and error handling

**Goal**: Ensure mobile uses the same API and handles responses/errors as in the spec.

**Details**:

1. **Request**
   - Confirm `AdjustInventoryScreen` sends:
     - `POST /api/inventory/skus/{skuId}/adjust-inventory`
     - Body: `{ new_quantity: number, reason: string }`
     - `skuId` from route params (same as backend path).
   - Confirm `new_quantity` is integer (e.g. `parseInt(..., 10)`) and ≥ 0 before send.
   - Confirm `reason` is trimmed and non-empty before send.

2. **Success**
   - On 200, do not require a specific response shape for success (backend always returns `success: true` on 200).
   - Optional: read `response.data?.data` to show `old_quantity`, `new_quantity`, `difference`, or `shopify_synced` in UI (see T2).

3. **Errors**
   - 404: show “SKU not found” (or equivalent).
   - 422: show validation message; optionally parse `detail` (array or string) like frontend (see T4).
   - 401/403: show auth error (e.g. “Please log in again”).
   - 5xx / network: show generic failure; ensure `formatApiError` or equivalent is used so user sees a message.

**Acceptance**: Same endpoint and body as spec; no crash on 4xx/5xx; user always sees an error message when the request fails.

**Files**: `src/screens/AdjustInventoryScreen.tsx`, `src/utils/formatApiError.ts` (if used).

---

## T2 – Optional: Show Shopify sync status on success

**Goal**: After a successful adjust, show whether inventory was synced to Shopify (matches backend response).

**Details**:

1. After a successful `POST adjust-inventory`, read from response:
   - `data?.data?.shopify_synced` (boolean)
   - `data?.data?.shopify_error` (string, only when sync failed)
2. In the success state (e.g. “Inventory updated” card):
   - If `shopify_synced === true`: e.g. “Inventory updated and synced to Shopify.”
   - If `shopify_synced === false`: e.g. “Inventory updated. Shopify sync failed.” (optionally append `shopify_error` in dev or in a collapsible section.)

**Acceptance**: Success copy reflects Shopify sync status when backend returns it.

**Files**: `src/screens/AdjustInventoryScreen.tsx`.

---

## T3 – Optional: Revert new quantity to current

**Goal**: One-tap reset of “New quantity” to current quantity (like frontend “Revert”).

**Details**:

1. Add a control (e.g. “Revert to current” or icon) next to the new quantity input.
2. On press: set new quantity field to current quantity value.
3. Only show when new quantity differs from current (optional).

**Acceptance**: User can restore new quantity to current without re-typing.

**Files**: `src/screens/AdjustInventoryScreen.tsx`.

---

## T4 – Optional: Parse 422 validation errors for messages

**Goal**: Show clear validation messages when backend returns 422 (e.g. “Quantity cannot be negative”, “Reason is required”).

**Details**:

1. In the adjust-inventory request catch block, if `err.response?.status === 422`:
   - Read `err.response?.data?.detail`.
   - If array (Pydantic): map to a single string, e.g. `detail.map(d => d.msg || `${d.loc?.join('.')}: ${d.msg}`).join(', ')`.
   - If string: use as message.
2. Set the on-screen error state to this message so the user sees it instead of a generic “Request failed”.

**Acceptance**: 422 responses result in specific validation text when available.

**Files**: `src/screens/AdjustInventoryScreen.tsx`, optionally `src/utils/formatApiError.ts` if you centralize 422 handling there.

---

## T5 – Document and manual test checklist

**Goal**: Leave a short doc and a repeatable test plan for Adjust flow.

**Details**:

1. **Doc**
   - In `docs/` (e.g. `ADJUST_INVENTORY_TESTING.md` or a section in README), document:
     - How to open Adjust → scan SKU → land on Adjust Inventory.
     - Required fields and validation (quantity ≥ 0, reason required).
     - Expected success behavior and “Adjust another”.
     - That the same backend endpoint as web is used (link to spec).

2. **Checklist** (in that doc or in TASKS)
   - [ ] Open Adjust tab, scan valid SKU → Adjust Inventory screen loads with correct SKU and current quantity.
   - [ ] Submit with new quantity and reason → success screen; “Adjust another” returns to scan.
   - [ ] Submit with negative quantity → error shown (and optionally 422 message if T4 done).
   - [ ] Submit with empty reason → error shown.
   - [ ] Invalid or missing SKU ID → appropriate error and way back to scan.
   - [ ] (If T2 done) Success message reflects Shopify sync when backend returns it.

**Acceptance**: New dev or QA can follow the checklist and spec to verify the feature.

**Files**: `docs/ADJUST_INVENTORY_TESTING.md` (or similar), optionally `README.md`.

---

## Implementation order

1. **T1** – Do first (verification, no new UI).
2. **T5** – Doc and checklist (can be done in parallel or right after T1).
3. **T2, T3, T4** – Optional improvements in any order.

---

## Summary

- **Backend**: No changes; already implements `POST /api/inventory/skus/{sku_id}/adjust-inventory` with validation, WMS update, history, and Shopify sync.
- **Frontend**: No changes; already has Edit Inventory modal on SKU detail page.
- **Mobile**: Core flow is implemented (Adjust → scan → AdjustInventoryScreen → save). T1 + T5 ensure alignment and testability; T2–T4 are optional UX improvements.
