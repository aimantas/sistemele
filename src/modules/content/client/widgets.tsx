import { Link } from "react-router";
import { ErrorState, Spinner } from "@/app/ui";
import { useEntries } from "./api";
import { StateBadge, StateDate } from "./parts";

/** Dashboard card: the most recently edited pages and posts, with their status. */
export function RecentContentWidget() {
  const entries = useEntries({ limit: 6 });
  if (entries.error) return <ErrorState error={entries.error} retry={() => entries.refetch()} />;
  if (!entries.data) return <Spinner />;
  if (entries.data.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No pages or posts yet.{" "}
        <Link to="/app/content/posts?new=1" className="text-primary hover:underline">
          Write the first post
        </Link>
      </p>
    );
  }
  return (
    <ul className="grid gap-1">
      {entries.data.items.map((entry) => (
        <li key={entry.id}>
          <Link to={`/app/content/${entry.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 hover:bg-background">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{entry.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {entry.type === "page" ? "Page" : "Post"} · <StateDate entry={entry} />
              </span>
            </span>
            <StateBadge state={entry.state} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
