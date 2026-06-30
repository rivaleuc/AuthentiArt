# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
AuthentiArt — provenance authentication + a public registry, by GenLayer consensus.

Submit an item (artwork / collectible) with a provenance link. `authenticate`
has every validator independently fetch the provenance evidence and judge it
authentic / forgery / inconclusive with a confidence; the result is accepted
only when validators agree on the VERDICT (comparative equivalence). Authenticated
items are indexed by a normalized (title, creator) key so anyone can `lookup`
before buying.

The verb is "authenticate provenance → queryable registry" — the value is the
trustworthy read, gated by a consensus write over fetched evidence.
"""
import json
from genlayer import *

VERDICTS = ("authentic", "forgery", "inconclusive")


def norm_key(title: str, creator: str) -> str:
    return (str(title).strip().lower() + "|" + str(creator).strip().lower())[:160]


def normalize_auth(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    verdict = str(raw.get("verdict", "")).strip().lower()
    if verdict not in VERDICTS:
        verdict = "inconclusive"          # conservative default
    conf = raw.get("confidence")
    if not isinstance(conf, int) or isinstance(conf, bool):
        conf = 0
    conf = max(0, min(100, conf))
    reason = raw.get("reason")
    reason = reason[:500] if isinstance(reason, str) and reason.strip() else "no reason"
    return {"verdict": verdict, "confidence": conf, "reason": reason}


def validate_auth(data) -> bool:
    if not isinstance(data, dict):
        return False
    if data.get("verdict") not in VERDICTS:
        return False
    c = data.get("confidence")
    if not isinstance(c, int) or isinstance(c, bool) or c < 0 or c > 100:
        return False
    r = data.get("reason")
    return isinstance(r, str) and bool(r.strip())


class AuthentiArt(gl.Contract):
    items: TreeMap[str, str]
    index: TreeMap[str, str]      # normalized (title|creator) -> item id
    item_count: u256
    authentic_count: u256

    def __init__(self):
        self.item_count = u256(0)
        self.authentic_count = u256(0)

    @gl.public.write
    def submit_item(self, title: str, creator: str, provenance_url: str) -> str:
        title = str(title).strip()
        creator = str(creator).strip()
        provenance_url = str(provenance_url).strip()
        if not title or not creator or not provenance_url.startswith("http"):
            raise Exception("title, creator and http provenance_url required")
        key = str(int(self.item_count))
        rec = {
            "submitter": str(gl.message.sender_address),
            "title": title[:160],
            "creator": creator[:120],
            "provenance_url": provenance_url[:400],
            "norm": norm_key(title, creator),
            "state": "pending",        # pending -> authenticated
            "verdict": "",
            "confidence": 0,
            "reason": "",
        }
        self.items[key] = json.dumps(rec)
        self.item_count += u256(1)
        return key

    @gl.public.write
    def authenticate(self, item_id: str) -> dict:
        item_id = str(item_id)
        if item_id not in self.items:
            raise Exception("unknown item")
        it = json.loads(self.items[item_id])
        if it["state"] != "pending":
            raise Exception("already authenticated")
        res = self._authenticate(it["title"], it["creator"], it["provenance_url"])
        it["verdict"] = res["verdict"]
        it["confidence"] = res["confidence"]
        it["reason"] = res["reason"]
        it["state"] = "authenticated"
        self.items[item_id] = json.dumps(it)
        self.index[it["norm"]] = item_id
        if res["verdict"] == "authentic":
            self.authentic_count += u256(1)
        return {"item": item_id, "verdict": res["verdict"], "confidence": res["confidence"]}

    def _authenticate(self, title: str, creator: str, provenance_url: str) -> dict:
        def fetch_and_judge() -> str:
            live = "(provenance fetch failed)"
            try:
                live = gl.nondet.web.get(provenance_url).body.decode("utf-8")[:5000]
            except Exception:
                try:
                    live = gl.nondet.web.render(provenance_url, mode="text")[:5000]
                except Exception:
                    live = "(provenance fetch failed)"
            prompt = f"""You are an art authenticator examining provenance evidence.

ITEM: "{title}" by {creator}

PROVENANCE EVIDENCE (fetched now):
{live}

Judge authenticity: "authentic", "forgery", or "inconclusive", with a confidence 0-100.
Reply ONLY JSON: {{"verdict":"authentic|forgery|inconclusive","confidence":<int 0-100>,"reason":"<short>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_auth(raw))

        result = gl.eq_principle.prompt_comparative(
            fetch_and_judge,
            principle="The 'verdict' (authentic / forgery / inconclusive) must be identical across validators. Confidence may differ slightly; reason may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_auth(data):
            data = normalize_auth(data if isinstance(data, dict) else {})
        return data

    @gl.public.view
    def lookup(self, title: str, creator: str) -> dict:
        """Buyers query this before purchasing."""
        nk = norm_key(title, creator)
        if nk not in self.index:
            return {"known": False, "verdict": "", "confidence": 0}
        iid = self.index[nk]
        it = json.loads(self.items[iid])
        return {"known": True, "item_id": iid, "verdict": it["verdict"], "confidence": it["confidence"]}

    @gl.public.view
    def get_item(self, item_id: str) -> dict:
        item_id = str(item_id)
        if item_id not in self.items:
            return {"exists": False}
        it = json.loads(self.items[item_id])
        it["exists"] = True
        return it

    @gl.public.view
    def stats(self) -> dict:
        return {"total_items": int(self.item_count), "authentic": int(self.authentic_count)}
