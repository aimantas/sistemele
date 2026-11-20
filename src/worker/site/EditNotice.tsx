/** Where a public page comes from, for the "Edit this page" notice. */
export interface EditHint {
  /** One sentence: what makes up this page and how to change it. */
  summary: string;
  /** The admin panel screen that edits it, when the page is content rather than code. */
  admin?: { label: string; href: string };
  /** Repository files, most relevant first. */
  files: Array<{ path: string; note: string }>;
}

export const REPO_URL = "https://github.com/aimantas/sistemele";

/** How the public site is organised, shown under every notice. */
const STRUCTURE: Array<{ path: string; note: string }> = [
  { path: "src/worker/site/", note: "core pages, layout and styles" },
  { path: "src/modules/", note: "one folder per module; its pages are in server/site.tsx" },
  { path: "docs/", note: "the guides behind /docs" },
];

const fileUrl = (path: string) => `${REPO_URL}/${path.endsWith("/") ? "tree" : "blob"}/main/${path.replace(/\/$/u, "")}`;

/**
 * A card at the end of the page that says how to change it: the admin panel
 * screen for content, the repository files for code. Shown on the public demo
 * and in local development only, never on your live site.
 */
export function EditNotice({ hint }: { hint: EditHint }) {
  return (
    <aside className="wrap edit-notice" aria-labelledby="edit-notice-title">
      <div className="edit-card">
        <div className="edit-head">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <div>
            <p id="edit-notice-title" className="edit-title">
              Edit this page
            </p>
            <p className="edit-summary">{hint.summary}</p>
          </div>
          {hint.admin ? (
            <a className="button" href={hint.admin.href}>
              {hint.admin.label}
            </a>
          ) : null}
        </div>
        <ul className="plain edit-files">
          {hint.files.map((file) => (
            <li key={file.path}>
              <a href={fileUrl(file.path)}>
                <code>{file.path}</code>
              </a>
              <span>{file.note}</span>
            </li>
          ))}
        </ul>
        <p className="edit-structure">
          <a href={REPO_URL}>aimantas/sistemele</a>
          {STRUCTURE.map((item) => (
            <span key={item.path}>
              <a href={fileUrl(item.path)}>
                <code>{item.path}</code>
              </a>{" "}
              {item.note}
            </span>
          ))}
          <a href="/docs/seo">How public pages work</a>
        </p>
      </div>
    </aside>
  );
}
