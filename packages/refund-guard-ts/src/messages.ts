/** Default user-facing messages for each denial/error reason code. */
export const DENIAL_MESSAGES: Record<string, string> = {
  refund_window_expired: "The refund window for this order has closed.",
  amount_exceeds_limit: "Refund amount exceeds the original charge.",
  amount_exceeds_remaining: "This order has already been partially refunded.",
  amount_exceeds_policy_max: "Refund amount exceeds the policy limit for this item.",
  invalid_amount: "Please enter a valid refund amount.",
  already_refunded: "This order has already been refunded.",
  not_refundable: "This item is not refundable.",
  refund_reason_not_allowed: "This refund reason is not allowed for this item.",
  manual_approval_required: "This refund requires manual approval.",
  provider_error: "Refund could not be processed. Please contact support.",
};
