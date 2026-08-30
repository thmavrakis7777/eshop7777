/**
 * Loyalty reward constants — used by coupon issuance (lib/db/checkout.ts)
 * and the admin's default expiry (lib/admin/cms.ts). One source of number,
 * not a €50/5000 repeated independently in more than one place.
 */
export const LOYALTY_REWARD_THRESHOLD_CENTS = 5000;
export const LOYALTY_REWARD_VALUE_CENTS = 500;
export const LOYALTY_REWARD_DEFAULT_EXPIRY_DAYS = 60;
