# Minimal Python example

No third-party payment SDK — uses a fake provider so you can run it immediately.

## Run

From the **repository root**:

```bash
pip install -e ".[dev]"
python examples/minimal-python/run.py
```

You should see two **approved** results, then one **denied** result (`invalid_amount`) once no refundable balance remains.
