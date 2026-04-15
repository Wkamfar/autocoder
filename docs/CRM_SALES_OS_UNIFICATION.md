# CRM ↔ Sales OS unification — design

**Status:** architecture spec (not implemented). **Today:** SQLite CRM and `SalesWorldFile` are independent; see [`ONBOARDING.md`](./ONBOARDING.md).

**Goal:** connect **imported CRM truth** to **decision-engine / slash UX** without breaking auditability or surprise writes.

---

## 1. Problem

- **CRM** (`SALES_DB_PATH`) holds **accounts, contacts, deals, mutations** after CSV import + apply — operational source for GTM data quality.
- **Sales OS** (`loadSalesWorld()` → [`SalesWorldFile`](../src/sales/world/types.ts)) drives **`top-decisions`**, **Pair Debate**, **dossiers** — today from **static JSON**.
- Teams expect `/debate` and ranking to reflect CRM reality; today they only reflect **whatever is in the world file**.

---

## 2. Design principles

1. **CRM remains authoritative** for account/contact/deal records from imports and mutations.
2. **World file** stays a **portable snapshot** for demos, CI, fixtures, offline evals — **do not delete** the `SalesWorldFile` shape.
3. **Unification is explicit**: `--source=crm|world|auto` and env overrides (see **Deterministic `auto`** below). No silent mode switches.
4. **No silent cross-writes:** CRM → JSON export is **explicit CLI**; JSON → CRM is **out of scope** for early phases (and policy-gated if ever).
5. **Stable identifiers:** bridge **domain** + **account/deal ids** across layers.

---

## 3. Provenance taxonomy (first-class)

Use these labels in logs, dossier metadata, and (future) slash copy — not as silent behavior.

| Label | Meaning |
|-------|---------|
| **`world_only`** | Deal/account exists only in hand-edited or sample **world JSON** — **no** matching CRM row. Fine for demos; ranker/debate should surface provenance. |
| **`crm_backed`** | Dossier or ranking row resolved from **live SQLite** (`CrmWorldDataSource`, Phase 2+). |
| **`crm_snapshot`** | Content came from **`crm-export-world`** output — CRM was **authoritative at `exported_at`**; file may be **stale** until re-export. |

**Rule:** If CRM and a snapshot **disagree**, **CRM is truth** for facts; the snapshot is **stale** unless you re-export or use `source=crm` (Phase 2).

---

## 4. Identity model

| Concept | CRM (SQLite) | World JSON (`SalesWorldFile`) |
|---------|----------------|----------------------------------|
| Account | `accounts.id` | `SalesAccount.id` |
| Deal | `deals.id` | `SalesDeal.id` |
| Link key | **Registrable domain** on account (from import / `score_json`) | Optional `external_ids` on exported accounts (future) or slug = `slugify(domain)` |

**Deal id bridge:** Prefer **preserving CRM `deals.id`** in export. If a mapping file is needed, use **`state/crm-world-bridge.json`** (see **Bridge file lifecycle**).

---

## 5. Architecture options (milestones)

### Mandatory order

**Implement Phase 5.1 (`crm-export-world`) first. Do not start Phase 5.2 (read-through / `CrmWorldDataSource`) until Phase 5.1 is shipped, documented, and validated in smoke/CI.**

Teams often want to skip to “live CRM reads.” **Don’t.** Export-first reuses the existing Sales OS without hidden coupling.

### 5.1 Snapshot export — **Phase 1 only until proven**

**Flow:** CLI `crm-export-world` reads `SalesRepository`, writes a **`SalesWorldFile`-compatible** JSON (+ metadata — see **Export file envelope**).

**Pros:** Zero change to debate/rank code paths; point `SALES_WORLD_JSON` or `--world` at the export. **Cons:** Stale until re-export.

- Module: `src/sales/world/crmWorldExport.ts` (suggested).
- CLI: `nightshift sales crm-export-world --out <path>`

### 5.2 Read-through resolver — **Phase 2**

`buildDossierPack` / callers gain a **`WorldDataSource`** abstraction (`JsonWorldDataSource` vs `CrmWorldDataSource`). **Only after 5.1 is stable.**

### 5.3 Incremental sync / cache — **Phase 3+**

Post-`apply-pending` hooks, optional cache invalidation. **Only after 5.1 + 5.2.**

---

## 6. Deterministic `auto` resolution (Phase 2+)

When implementing `--source` / `SALES_DOSSIER_SOURCE`, **no guessing**. Order:

1. If CLI **`--source`** is **`crm`** or **`world`** → **obey it**.
2. Else if env **`SALES_DOSSIER_SOURCE`** is set to **`crm`**, **`world`**, or **`auto`** → use it (for **`auto`**, continue below).
3. Else if **`SALES_DB_PATH`** exists and **`deal_id` resolves in CRM** → use **CRM** (`crm_backed`).
4. Else → fall back to **`loadSalesWorld()`** / default world path (`world_only` or **`crm_snapshot`** if file was an export — infer from file metadata if present).

This makes provenance **debuggable** and avoids silent magic.

---

## 7. Minimum CRM → world export shape

Exports must not devolve into “whatever makes tests pass.” Every **`crm-export-world`** run must populate at least:

| Area | Required fields (conceptual) | Maps to |
|------|------------------------------|---------|
| **Envelope** | `schema_version`, `exported_at` (ISO-8601), `source` = literal **`crm_snapshot`**, `crm_export_version` (monotonic integer or semver) | Root JSON alongside `accounts` / `contacts` / `deals` / `activities` ([`validate-sales-world-shape.mjs`](../scripts/validate-sales-world-shape.mjs) allows extra root keys if `accounts`…`activities` remain valid). |
| **Account** | `id`, `name` | `SalesAccount` |
| **Account (bridge)** | domain or `external_ids.crm_account_id` | Ties world row to CRM / imports |
| **Deal** | `id`, `account_id`, `stage` | `SalesDeal` (required by validator) |
| **Deal (economics)** | `value_cents` / currency when present in CRM | `SalesDeal` |
| **Deal (motion)** | last touch / timing when mappable | `last_touch_days_ago`, `decision_deadline`, etc. |
| **Activities** | enough rows to preserve **recent touch** narrative when CRM has activity data | `SalesActivity` |

**Version stamp (root object):**

```json
{
  "schema_version": "1",
  "exported_at": "2026-04-15T12:00:00.000Z",
  "source": "crm_snapshot",
  "crm_export_version": 1,
  "accounts": [],
  "contacts": [],
  "deals": [],
  "activities": []
}
```

Bump **`crm_export_version`** when export field mappings change. **`schema_version`** bumps when the **envelope** or required arrays change.

---

## 8. Bridge file lifecycle (`state/crm-world-bridge.json`)

| Question | Answer |
|----------|--------|
| **What is it?** | **Derived cache** — **not** source of truth. |
| **Who writes it?** | **`crm-export-world`** (Phase 1), when id mapping world↔CRM is needed. |
| **When regenerated?** | Every successful export that emits mappings (or: single file overwritten per export). |
| **Authoritative?** | **No.** CRM DB wins; bridge is for **resolution and debugging**. |

---

## 9. Conflict and precedence

| Situation | Rule |
|-----------|------|
| CRM row vs snapshot file | **CRM wins** for facts (stage, value, contacts). |
| World-only deal | **`world_only`** — allowed for hypotheticals; label clearly in UI/logs. |
| Export overwrites disk file | **Explicit CLI only** — never from slash commands by default. |

---

## 10. Discord / slash (future)

- **`/debate`:** resolve `deal_id` using the same **deterministic `auto`** stack when Phase 2 lands.
- Ephemeral hint when **`world_only`**: e.g. “Not in CRM — world fixture only.”
- **No slash → CRM writes** for outcomes; append logs only.

---

## 11. Observability

- Log **`dossier_provenance`**: `world_only` | `crm_backed` | `crm_snapshot`.
- Counters: `debate_crm_sourced` vs `debate_json_sourced` vs `debate_snapshot_sourced`.

---

## 12. Recommended adoption path (teams)

1. Import CSV into CRM (`import-csv` → `apply-pending`).
2. Run **`crm-export-world`** to a checked path (e.g. `state/sales-world.crm-snapshot.json`).
3. Run Sales OS against that file: `top-decisions --world …`, `pair-debate --world … --deal …`.
4. **Validate dossier quality** (right accounts, stages, economics).
5. **Only then** implement **`CrmWorldDataSource`** (Phase 2) and deterministic **`auto`**.

---

## 13. Debugging

| Symptom | Check |
|---------|--------|
| **`/debate` doesn’t reflect CRM imports** | You are probably on **world JSON**. Confirm **`--source`** / **`SALES_DOSSIER_SOURCE`**, and whether you **exported** after import. |
| **Stale rankings vs CRM** | Snapshot **`crm_snapshot`** is old — **re-run `crm-export-world`** or move to **`source=crm`** (Phase 2). |
| **Deal id not found** | **Bridge** `state/crm-world-bridge.json` and CRM `deals.id` — typo vs export mapping. |
| **CRM vs world disagree** | **CRM is truth** for facts; world/snapshot is **stale or hypothetical** unless `crm_backed`. |

---

## 14. Testing strategy

1. Unit: DB row → `SalesDeal` / `SalesAccount` mapping.
2. Integration: export output passes **`validate-sales-world-shape.mjs`** and contains **envelope** fields.
3. E2E (Phase 2): `pair-debate --source crm --deal <id>` against seeded SQLite.

---

## 15. What not to do

- Skip export-first and jump to read-through.
- Let **slash** commands **mutate** CRM.
- Let **world JSON quietly “correct”** CRM (CRM wins).
- Build **bidirectional sync** before Phase 1 proves value.

---

## 16. Rollout checklist (engineering)

- [ ] **Phase 1:** `crm-export-world` + envelope + minimum shape + bridge file rules + docs + smoke: export → validate → `top-decisions --world <export>`.
- [ ] **Phase 2:** `CrmWorldDataSource` + deterministic **`auto`** + CLI flags.
- [ ] **Phase 3:** optional post-apply snapshot refresh / cache.
- [ ] Discord: document **`SALES_DOSSIER_SOURCE`** behavior.

---

## 17. Phase 1 implementation checklist (`crm-export-world`)

**Goal:** one CLI command produces a valid world-shaped JSON from `SALES_DB_PATH` that Pair Debate can consume via `--world`.

| # | Task | Acceptance |
|---|------|--------------|
| 1 | Add `crmWorldExport.ts`: query accounts/contacts/deals/activities from `SalesRepository` | Rows round-trip without SQL errors on typical DB |
| 2 | Map to `SalesAccount` / `SalesContact` / `SalesDeal` / `SalesActivity` | Matches [`types.ts`](../src/sales/world/types.ts) |
| 3 | Emit root **envelope**: `schema_version`, `exported_at`, `source: "crm_snapshot"`, `crm_export_version` | Present in every export |
| 4 | Preserve **minimum shape** (§7) | Validator passes; dossier has name, stage, value when CRM has data |
| 5 | Write optional **`state/crm-world-bridge.json`** when id mapping non-trivial | File is **overwrite** per export; documented as cache |
| 6 | CLI `nightshift sales crm-export-world --out <path>` | Exits 0; creates file |
| 7 | Wire **`npm run build`** + smoke: export temp DB → validate shape → `top-decisions --world` | CI green |
| 8 | Document in [`ONBOARDING.md`](./ONBOARDING.md) one-liner: “after CRM seed, export then point `--world` at snapshot” | New dev path updated |

---

## 18. Related code (today)

| Area | Path |
|------|------|
| World types | `src/sales/world/types.ts`, `fileWorldStore.ts` |
| Dossier / debate | `src/sales/pairDebate/dossierBuilder.ts`, `pairDebateOrchestrator.ts` |
| Discord | `src/sales/discordOs/salesDiscordService.ts` |
| CRM repo | `src/sales/storage/salesRepository.ts` |
| World shape CI | `scripts/validate-sales-world-shape.mjs` |

---

**Summary:** Unify in order: **export CRM truth into the world shape the Sales OS already understands**, then **optional live CRM reads**, then **automation**. Explicit provenance, **no silent cross-writes**, **CRM authoritative** for facts.
