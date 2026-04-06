# Minimal Python example

No third-party payment SDK — uses a fake provider so you can run it immediately.

## Run

From the **repository root**:

```bash
pip install -e ".[dev]"
python examples/minimal-python/run.py
```

You should see one **approved** result and one **denied** result (`amount_exceeds_remaining` or `amount_exceeds_limit`).
