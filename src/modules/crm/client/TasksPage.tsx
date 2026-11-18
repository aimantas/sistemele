import { ListTodo } from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "@/app/ui";
import { useOpenTasks } from "./api";
import { OpenTasksWidget } from "./widgets";

export default function TasksPage() {
  const tasks = useOpenTasks();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Tasks" description="Open follow-ups across all contacts, earliest due first. Add tasks from a contact's timeline." />
      {tasks.isLoading ? <Spinner /> : null}
      {tasks.error ? <ErrorState error={tasks.error} /> : null}
      {tasks.data?.length === 0 ? <EmptyState icon={<ListTodo />} title="Nothing to do" description="Tasks you add on a contact's timeline appear here." /> : null}
      {tasks.data?.length ? (
        <Card className="p-3">
          <OpenTasksWidget />
        </Card>
      ) : null}
    </div>
  );
}
