import { ListTodo } from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "@/app/ui";
import { useOpenTasks } from "./api";
import { OpenTasksWidget } from "./widgets";

export default function TasksPage() {
  const tasks = useOpenTasks();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Tasks" />
      {tasks.isLoading ? <Spinner /> : null}
      {tasks.error ? <ErrorState error={tasks.error} /> : null}
      {tasks.data?.length === 0 ? <EmptyState icon={<ListTodo />} title="Nothing to do" description="Tasks you add on a lead's or contact's timeline appear here." /> : null}
      {tasks.data?.length ? (
        <Card className="p-3">
          <OpenTasksWidget />
        </Card>
      ) : null}
    </div>
  );
}
