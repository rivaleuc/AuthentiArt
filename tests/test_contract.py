"""AuthentiArt tests: normalization/verdict guards + submit→authenticate→lookup registry flow."""


def test_norm_key(contract):
    assert contract.norm_key("Mona Lisa", "Da Vinci") == "mona lisa|da vinci"
    assert contract.norm_key("  X ", " Y ") == "x|y"

def test_normalize_auth(contract):
    n = contract.normalize_auth
    assert n({"verdict": "authentic", "confidence": 90, "reason": "documented"})["verdict"] == "authentic"
    assert n({"verdict": "FORGERY", "confidence": 200, "reason": "x"})["confidence"] == 100
    assert n({})["verdict"] == "inconclusive"        # conservative default
    assert n("garbage")["confidence"] == 0

def test_validate_auth(contract):
    v = contract.validate_auth
    assert v({"verdict": "authentic", "confidence": 80, "reason": "ok"})
    assert not v({"verdict": "fake", "confidence": 1, "reason": "x"})
    assert not v({"verdict": "authentic", "confidence": "9", "reason": "x"})
    assert not v({"verdict": "authentic", "confidence": 9, "reason": "  "})


def _new(contract):
    return contract, contract.AuthentiArt()

def test_submit_requires_http(contract):
    mod, c = _new(contract)
    try:
        c.submit_item("Piece", "Artist", "not-a-url"); assert False, "should require http url"
    except Exception:
        pass

def test_authenticate_and_lookup(contract):
    mod, c = _new(contract)
    iid = c.submit_item("Sunflowers", "Van Gogh", "https://prov.example/sunflowers")
    out = c.authenticate(iid)
    assert out["verdict"] == "inconclusive"      # offline default
    it = c.get_item(iid)
    assert it["state"] == "authenticated"
    lk = c.lookup("sunflowers", "VAN GOGH")       # case-insensitive registry
    assert lk["known"] is True and lk["item_id"] == iid
    assert c.lookup("unknown", "nobody")["known"] is False

def test_authentic_increments_counter(contract):
    mod, c = _new(contract)
    iid = c.submit_item("Real Piece", "Master", "https://prov.example/x")
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {"verdict": "authentic", "confidence": 95, "reason": "fully documented"})
    c.authenticate(iid)
    assert c.get_item(iid)["verdict"] == "authentic"
    assert c.stats()["authentic"] == 1
    mod.gl.nondet.exec_prompt = staticmethod(lambda *a, **k: {})
