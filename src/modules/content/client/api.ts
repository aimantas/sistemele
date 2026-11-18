import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import { api, queryString } from "@/app/lib/api";
import type { Entry, EntryInput, EntryListQuery, EntryPatch, EntrySummary, PublishInput } from "../shared/schema";

/** Content data hooks. Query keys start with "content" so one invalidate refreshes the module. */
export const contentKeys = {
  all: ["content"] as const,
  entries: (params: object) => ["content", "entries", params] as const,
  entry: (id: string) => ["content", "entry", id] as const,
};

export function useEntries(params: EntryListQuery) {
  return useQuery({ queryKey: contentKeys.entries(params), queryFn: () => api.get<Page<EntrySummary>>(`/api/content/entries${queryString({ ...params })}`), placeholderData: (previous) => previous });
}

export function useEntry(id: string) {
  return useQuery({ queryKey: contentKeys.entry(id), queryFn: () => api.get<Entry>(`/api/content/entries/${id}`) });
}

function useInvalidateContent() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: contentKeys.all }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]);
}

export function useCreateEntry() {
  const invalidate = useInvalidateContent();
  return useMutation({ mutationFn: (input: EntryInput) => api.post<Entry>("/api/content/entries", input), onSuccess: invalidate });
}

export function useUpdateEntry(id: string) {
  const invalidate = useInvalidateContent();
  return useMutation({ mutationFn: (patch: EntryPatch) => api.patch<Entry>(`/api/content/entries/${id}`, patch), onSuccess: invalidate });
}

export type EntryAction = { action: "publish"; input?: PublishInput } | { action: "unpublish" | "archive" | "restore" };

export function useEntryAction(id: string) {
  const invalidate = useInvalidateContent();
  return useMutation({ mutationFn: (request: EntryAction) => api.post<Entry>(`/api/content/entries/${id}/${request.action}`, "input" in request ? (request.input ?? {}) : {}), onSuccess: invalidate });
}
