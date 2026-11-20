import { useEffect, useState } from "react";

/**
 * Developer mode: a switch in the sidebar (or ?dev=1 in the address) that
 * shows the developer panel on every admin page. Off by default; the choice
 * stays in this browser.
 */
const KEY = "sistemele.devmode";
const EVENT = "sistemele:devmode";

function read(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("dev") === "1") localStorage.setItem(KEY, "1");
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useDevMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [
    on,
    (next) => {
      try {
        if (next) localStorage.setItem(KEY, "1");
        else localStorage.removeItem(KEY);
      } catch {
        // Private mode: the switch still applies until the page reloads.
      }
      setOn(next);
      window.dispatchEvent(new Event(EVENT));
    },
  ];
}
