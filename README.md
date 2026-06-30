# AuthentiArt

**Provenance authentication + a public registry, by GenLayer validator consensus.**

Submit an item (artwork / collectible) with a provenance link. `authenticate` has every validator
independently fetch the provenance evidence and judge it **authentic / forgery / inconclusive** with a
confidence; the result is accepted only when validators agree on the **verdict** (comparative
equivalence). Authenticated items are indexed by a normalized (title, creator) key so anyone can
`lookup` before buying.

The verb is **"authenticate provenance → queryable registry"** — the value is the trustworthy read,
gated by a consensus write over fetched evidence.

- **Contract (Bradbury, chain 4221):** `0x30C40e41832D979a7CB4C595E146Eb889fF6f7aB`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x30C40e41832D979a7CB4C595E146Eb889fF6f7aB

---

## Why GenLayer is essential

Authenticating provenance means reading documents/listings on the open web and exercising expert
judgment — impossible on a bare EVM. GenLayer has validators independently examine the evidence and
agree on the verdict, producing a tamper-evident authenticity registry buyers can trust.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Submit | `submit_item(title, creator, provenance_url)` | Registers an item for authentication. |
| Authenticate | `authenticate(id)` | Consensus verdict authentic/forgery/inconclusive + confidence. |
| Look up | `lookup(title, creator)` / `get_item(id)` / `stats()` | Buyer-facing registry read. |

### Correctness check

`_authenticate` wraps the judgment in **`gl.eq_principle.prompt_comparative`** — principle: *"the
verdict (authentic / forgery / inconclusive) must be identical across validators."* `validate_auth`
enforces the verdict enum + 0–100 confidence + reason; `normalize_auth` defaults the unclear case to
**inconclusive**. Authenticated items are indexed by `norm_key(title, creator)` for case-insensitive
lookup. Unit-tested incl. submit→authenticate→lookup + an authentic-counter run.

## Architecture

```
AuthentiArt/
├── contracts/authenti_art.py  ← GenLayer Intelligent Contract (consensus authentication + registry)
├── tests/                     ← pytest: norm_key, verdict guards, authenticate + lookup flow
└── app/                       ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                 museum gold theme, certificate gallery with authenticity seals + registry lookup
```

## Tests

```bash
cd AuthentiArt
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `norm_key`, `normalize_auth` / `validate_auth`, a full **submit → authenticate → lookup** run,
and an authentic-counter increment (shim auto-inits `TreeMap`). **On-chain smoke-tested:** `submit_item`
write + `get_item` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/authenti_art.py
```
