# MCP server example

Use this pattern when an MCP client should request refunds through your server.

The MCP tool accepts an `orderId`, `amount`, and `reason`, but `orderId` is only a lookup hint. Resolve it through the authorized MCP session, tenant, or actor before `refund-guard` creates the scoped refund tool.

- **What it demonstrates:** putting `refund-guard` inside an MCP server tool handler after scoped order lookup.
- **Copy this if:** you are exposing refund actions to an MCP client or agent runtime.
- **What it does not handle:** real persistence, auth, provider credentials, or cross-request database locking.

`orderId` remains realistic for MCP, but order scope and ownership are app-owned responsibilities that must pass before `refund-guard` runs.
