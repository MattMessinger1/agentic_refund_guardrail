# MCP server example

Use this pattern when an MCP client should request refunds through your server.

The MCP tool accepts an `orderId`, `amount`, and `reason`, but the trusted values still come from your database before `refund-guard` creates the scoped refund tool.

- **What it demonstrates:** putting `refund-guard` inside an MCP server tool handler.
- **Copy this if:** you are exposing refund actions to an MCP client or agent runtime.
- **What it does not handle:** real persistence, auth, provider credentials, or cross-request database locking.
