# Minimal Python example

No third-party payment SDK — uses a fake provider so you can run it immediately.

- **What it demonstrates:** the smallest Python flow: create a scoped tool, refund part of the balance, refund the rest, then deny once nothing remains.
- **Copy this if:** you want to see the core API without agent frameworks, databases, or payment SDKs.
- **What it does not handle:** real order loading, real provider calls, auth, or cross-request persistence.

## Run

From the **repository root**:

```bash
pip install -e ".[dev]"
python examples/minimal-python/run.py
```

You should see two **approved** results, then one **denied** result (`invalid_amount`) once no refundable balance remains.
