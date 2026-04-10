# LangChain Python example

Wrap `refund-guard` inside a LangChain tool so the model can ask for a refund without controlling trusted payment fields.

The model sees:

- `order_id`
- `amount`
- `reason`

The tool body loads amount paid, amount already refunded, transaction ID, SKU, and purchase date from your database.
