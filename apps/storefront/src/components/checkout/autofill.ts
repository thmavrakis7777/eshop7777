// Whether an input's change came from the browser filling it in (Chrome or
// Safari autofill, a password manager) rather than the customer typing
// (CHECKOUT_PREFILL_GOOGLE_SPEC.md A1). Either signal is enough:
//
// - The field isn't focused. Autofill fills every field of a saved profile
//   at once while the customer is still in the one they started from, so
//   every other field changes without ever being entered — or left, which
//   is why the checkout's save-on-blur never fired for them.
// - The change isn't a typing InputEvent. Chrome reports autofill as a plain
//   `input` Event, and "insertReplacementText" is how browsers report picking
//   a stored suggestion. Typing, pasting, deleting and dictation all arrive
//   as InputEvents with a real inputType, so none of them count.
export function isAutofillChange(e: React.ChangeEvent<HTMLInputElement>): boolean {
  if (document.activeElement !== e.target) return true;
  const native = e.nativeEvent;
  if (typeof InputEvent === "undefined" || !(native instanceof InputEvent)) return true;
  return !native.inputType || native.inputType === "insertReplacementText";
}
