# MCP server example

Use this pattern when an MCP client should request refunds through your server.

The MCP tool accepts an `orderId`, `amount`, and `reason`, but the trusted values still come from your database before `refund-guard` creates the scoped refund tool.
