import { createContext } from "react";

/** Brand data for public page components (e.g. the logo on DocumentView). Provided by Layout. */
export const SiteBrandContext = createContext<{ name: string; logoUrl: string | null; logoMark: boolean }>({ name: "", logoUrl: null, logoMark: false });
