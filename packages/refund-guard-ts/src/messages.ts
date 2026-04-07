/** Default user-facing messages for each denial/error reason code. */
export const DENIAL_MESSAGES: Record<string, string> = {
  refund_window_expired: "The refund window for this order has closed.",
  amount_exceeds_limit: "Refund amount exceeds the original charge.",
  amount_exceeds_remaining: "This order has already been partially refunded.",
  invalid_amount: "Please enter a valid refund amount.",
  already_refunded: "This order has already been refunded.",
  provider_error: "Refund could not be processed. Please contact support.",
};
