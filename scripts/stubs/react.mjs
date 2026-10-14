// lib/dishes.js only uses cache(); outside a React render it is the identity.
export const cache = (fn) => fn;
export default { cache };
