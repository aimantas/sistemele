/**
 * The repository this copy of Sistemėlė comes from. "Edit this page" on the
 * public demo and the admin panel's developer panel link files here. Point it
 * at your own fork or repository.
 */
export const REPOSITORY_URL = "https://github.com/aimantas/sistemele";

/** GitHub link for a repository path; folders end with "/". */
export function repositoryUrl(path: string): string {
  return `${REPOSITORY_URL}/${path.endsWith("/") ? "tree" : "blob"}/main/${path.replace(/\/$/u, "")}`;
}
