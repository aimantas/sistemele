import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import { api, queryString } from "@/app/lib/api";
import type { Activity, ActivityInput, Contact, ContactDetail, ContactInput, Deal, DealInput } from "../shared/schema";

/** CRM data hooks. Query keys start with "crm" so one invalidate refreshes the module. */
export const crmKeys = {
  all: ["crm"] as const,
  contacts: (params: object) => ["crm", "contacts", params] as const,
  contact: (id: string) => ["crm", "contact", id] as const,
  deals: (params: object = {}) => ["crm", "deals", params] as const,
  openTasks: ["crm", "tasks", "open"] as const,
};

export function useContacts(params: { q?: string; tag?: string; limit?: number; offset?: number }) {
  return useQuery({ queryKey: crmKeys.contacts(params), queryFn: () => api.get<Page<Contact>>(`/api/crm/contacts${queryString(params)}`), placeholderData: (previous) => previous });
}

export function useContact(id: string) {
  return useQuery({ queryKey: crmKeys.contact(id), queryFn: () => api.get<ContactDetail>(`/api/crm/contacts/${id}`) });
}

export function useDeals(params: { stage?: string; contactId?: string } = {}) {
  return useQuery({ queryKey: crmKeys.deals(params), queryFn: () => api.get<{ items: Deal[] }>(`/api/crm/deals${queryString(params)}`).then((data) => data.items) });
}

export function useOpenTasks() {
  return useQuery({ queryKey: crmKeys.openTasks, queryFn: () => api.get<{ items: Activity[] }>("/api/crm/activities?open=1").then((data) => data.items) });
}

function useInvalidateCrm() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: crmKeys.all }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]);
}

export function useSaveContact(id?: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (input: ContactInput) => (id ? api.patch<Contact>(`/api/crm/contacts/${id}`, input) : api.post<Contact>("/api/crm/contacts", input)),
    onSuccess: invalidate,
  });
}

export function useArchiveContact() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/crm/contacts/${id}`), onSuccess: invalidate });
}

export function useCreateDeal() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (input: DealInput) => api.post<Deal>("/api/crm/deals", input), onSuccess: invalidate });
}

export function useMoveDeal() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, stage, position }: { id: string; stage: string; position: number }) => api.post<Deal>(`/api/crm/deals/${id}/move`, { stage, position }),
    // Optimistic: the card stays where it was dropped while the request runs.
    onMutate: async ({ id, stage, position }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.deals() });
      const previous = queryClient.getQueryData<Deal[]>(crmKeys.deals());
      queryClient.setQueryData<Deal[]>(crmKeys.deals(), (deals) => deals?.map((deal) => (deal.id === id ? { ...deal, stage: stage as Deal["stage"], position } : deal)));
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(crmKeys.deals(), context?.previous),
    onSettled: invalidate,
  });
}

export function useAddActivity() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (input: ActivityInput) => api.post<Activity>("/api/crm/activities", input), onSuccess: invalidate });
}

export function useCompleteTask() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (id: string) => api.post(`/api/crm/activities/${id}/complete`), onSuccess: invalidate });
}
