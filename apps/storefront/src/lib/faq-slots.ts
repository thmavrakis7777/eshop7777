/**
 * How many empty Q/A slots the category form offers.
 *
 * Its own module because both sides need it: the admin form renders the
 * slots, and saveCategoryAction (a "use server" file, which can only export
 * async functions) reads them back.
 *
 * The form always renders at least as many slots as the category already
 * has, and the server reads every slot the form sent, so a category with
 * more FAQs than this (Αντικλείδια once had 6 against 5 slots) is never
 * trimmed by a save.
 */
export const FAQ_SLOTS = 8;
