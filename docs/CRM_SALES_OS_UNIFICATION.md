# CRM ↔ Sales OS unification — design

**Status:** architecture spec (not implemented). **Today:** SQLite CRM and `SalesWorldFile` are independent; see [`ONBOARDING.md`](./ONBOARDING.md).

**Goal:** a single, explicit plan for connecting **imported CRM truth** to **decision-engine / slash UX** without breaking auditability or surprise writes.

---

## 1. Problem

- **CRM** (`SALES_DB_PATH`) holds **accounts, contacts, deals, mutations** after CSV import + apply — the operational source for GTM data quality.
- **Sales OS** (`loadSalesWorld()` → [`SalesWorldFile`](../src/sales/world/types.ts)) drives **`top-decisions`**, **Pair Debate**, **dossier** construction — today from **static JSON**.
- Teams **expect** `/debate` and ranking to reflect CRM reality; today they only reflect **whatever is in the world file**.

This doc defines **how** to align them without merging concepts blindly.

---

## 2. Design principles

1. **CRM remains authoritative for account/contact/deal records** that came from imports and mutations.
2. **World file** remains a valid **portable snapshot** for demos, CI, and air-gapped evals.
3. **Unification is opt-in per command** until stable: e.g. `--source=crm|world|auto`.
4. **No silent cross-writes**: exporting CRM → JSON is explicit; syncing back from JSON to CRM is a separate, policy-gated operation (if ever).
5. **Stable identifiers**: bridge layers map **domain** and/or **canonical account id** so the same company is addressable from both sides.

---

## 3. Identity model

| Concept | CRM (SQLite) | World JSON (`SalesWorldFile`) |
|---------|----------------|----------------------------------|
| Account | `accounts.id` (UUID or slug from builder) | `SalesAccount.id` (string slug, e.g. `acme-corp`) |
| Deal | `deals.id` | `SalesDeal.id` (e.g. `acme-expansion-2026`) |
| Link key | Prefer **registrable domain** normalized on `accounts` + `score_json` / column | N/A |

**Bridge key (recommended):** `registrable_domain` (e.g. `redwoodlogistics.com`) stored on CRM account (already derivable from import). World accounts should carry optional `external_ids: { domain, crm_account_id }` in a future schema extension **or** enforce slug = `slugify(domain)` for generated exports.

**Deal ids:** Either **preserve CRM deal id** in exported world rows, or generate `deal:{account_slug}:{motion}` with a mapping table in `state/crm-world-bridge.json` (deal id world ↔ deal id CRM).

---

## 4. Architecture options (choose per milestone)

### 4.1 Snapshot export (lowest risk) — **recommended Phase 1**

**Flow:** `crm-export-world` CLI reads `SalesRepository`, emits a **`SalesWorldFile`-compatible JSON** (accounts, contacts, deals, activities subset) to `state/sales-world.crm-snapshot.json` or overwrites `SALES_WORLD_JSON` when a flag is set.

**Pros:** Zero change to debate engine; **swap file** to point slash commands at CRM-backed snapshot.  
**Cons:** Stale until re-export; **not live**.

**Implementation sketch:**

- Module `src/sales/world/crmWorldExport.ts`
- Map DB rows → `SalesAccount`, `SalesContact`, `SalesDeal`, `SalesActivity` (field mapping doc in same PR).
- CLI: `nightshift sales crm-export-world --out state/sales-world.json`

### 4.2 Read-through resolver (medium) — **Phase 2**

**Flow:** `buildDossierPack(world, scope)` gains a **`WorldDataSource`** abstraction:

```text
interface WorldDataSource {
  loadWorld(): SalesWorldFile;           // existing
  loadDeal(dealId: string): SalesDeal | null;
  loadAccount(accountId: string): SalesAccount | null;
}
```

- **`JsonWorldDataSource`** — current behavior (`loadSalesWorld()`).
- **`CrmWorldDataSource`** — loads from `SalesRepository` + maps to `SalesDeal` / `SalesAccount` shapes (read-only).

`pairDebate` / `top-decisions` accept `--source crm` or env `SALES_DOSSIER_SOURCE=crm|json|auto` (`auto` = CRM if `SALES_DB_PATH` has deals, else JSON).

**Pros:** `/debate` can target **real CRM deals** without manual export.  
**Cons:** Shape mismatches must be tested; ranking engine inputs must stay stable.

### 4.3 Incremental sync + cache (higher) — **Phase 3+**

- On `apply-pending` success for deal-related mutations: enqueue **world slice update** (or invalidate snapshot).
- Optional **`state/crm-world-cache.json`** with etag/version for Discord slash fast path.

Only after 4.1 + 4.2 are proven.

---

## 5. Conflict and precedence rules

| Situation | Rule |
|-----------|------|
| Same `deal_id` in CRM and world | **CRM wins** for factual fields (stage, value) when `source=auto` and CRM row exists. |
| World-only deal (no CRM row) | Allowed for **hypothetical / pipeline** scenarios; ranker marks `provenance: world_only`. |
| Export overwrites file | **Explicit** CLI; never from slash commands by default. |

---

## 6. Discord / slash behavior (future)

- **`/debate`**: optional `deal_id` resolution — first CRM (if enabled), else world file.
- **Ephemeral message** when deal is **world-only**: “Not in CRM — snapshot only.”
- **No automatic CRM write** from slash outcomes; logging stays append-only (`pair-debate-outcomes.jsonl`).

---

## 7. Observability

- Log **`dossier_source`: `json` | `crm`** on each Pair Debate run.
- Metric counters: `debate_crm_sourced` vs `debate_json_sourced`.

---

## 8. Testing strategy

1. **Unit:** mapper tests DB row → `SalesDeal` shape.
2. **Integration:** `crm-export-world` output passes `validate-sales-world-shape.mjs`.
3. **E2E:** `pair-debate --source crm --deal <id>` with seeded SQLite from `examples/sample_leads.csv` or Marketry subset.

---

## 9. Non-goals (this design)

- **Bidirectional merge** from arbitrary world JSON back into CRM without review (too risky for v1).
- **Replacing** `SalesWorldFile` for CI/sample fixtures — samples stay in-repo.
- **Real-time multi-user CRM** — out of scope.

---

## 10. Rollout checklist (engineering)

- [ ] Phase 1: `crm-export-world` + docs + smoke: export → validate shape → `top-decisions --world <export>`.
- [ ] Phase 2: `CrmWorldDataSource` + `--source` flag on debate/rank CLIs.
- [ ] Phase 3: optional post-apply hook to refresh snapshot or invalidate cache.
- [ ] Discord: document which commands respect `SALES_DOSSIER_SOURCE`.

---

## 11. Related code (today)

| Area | Path |
|------|------|
| World types | `src/sales/world/types.ts`, `fileWorldStore.ts` |
| Dossier / debate | `src/sales/pairDebate/dossierBuilder.ts`, `pairDebateOrchestrator.ts` |
| Discord thin layer | `src/sales/discordOs/salesDiscordService.ts` |
| CRM repo | `src/sales/storage/salesRepository.ts` |
| CRM CLI | `src/sales/salesContext.ts`, `operations.ts` |

---

**Summary:** Unification is **export-first**, then **read-through CRM**, then **optional automation**. Same app, two surfaces **by design** until Phase 1 ships; this document is the contract for making them **one logical system** without losing the CRM audit trail.
