import { useEffect, useState } from "react";

// Live search relies on this to avoid filtering on every keystroke.
export function useDebounce(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
