import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import { api, queryString } from "@/app/lib/api";
import type {
  Activity,
  ActivityInput,
  Contact,
  ContactDetail,
  ContactInput,
  Deal,
  DealInput,
  DealMove,
  DealPatch,
  Lead,
  LeadConvertInput,
  LeadDetail,
  LeadFilter,
  LeadInput,
  LeadPatch,
  Stage,
  StageInput,
  TeamMember,
} from "../shared/schema";

/** CRM data hooks. Query keys start with "crm" so one invalidate refreshes the module. */
export const crmKeys = {
  all: ["crm"] as const,
  contacts: (params: object) => ["crm", "contacts", params] as const,
  contact: (id: string) => ["crm", "contact", id] as const,
  deals: (params: object = {}) => ["crm", "deals", params] as const,
  leads: (params: object) => ["crm", "leads", params] as const,
  lead: (id: string) => ["crm", "lead", id] as const,
  stages: ["crm", "stages"] as const,
  openTasks: ["crm", "tasks", "open"] as const,
};

export type LeadPage = Page<Lead> & { counts: Record<LeadFilter | "due", number> };
export interface LeadQuery {
  status?: LeadFilter;
  ownerId?: string;
  source?: string;
  q?: string;
  due?: boolean;
  limit?: number;
  offset?: number;
}

export function useLeads(params: LeadQuery) {
  const { due, ...rest } = params;
  return useQuery({ queryKey: crmKeys.leads(params), queryFn: () => api.get<LeadPage>(`/api/crm/leads${queryString({ ...rest, due: due ? "1" : undefined })}`), placeholderData: (previous) => previous });
}

export function useLead(id: string) {
  return useQuery({ queryKey: crmKeys.lead(id), queryFn: () => api.get<LeadDetail>(`/api/crm/leads/${id}`) });
}

export function useContacts(params: { q?: string; tag?: string; limit?: number; offset?: number }) {
  return useQuery({ queryKey: crmKeys.contacts(params), queryFn: () => api.get<Page<Contact>>(`/api/crm/contacts${queryString(params)}`), placeholderData: (previous) => previous });
}

export function useContact(id: string) {
  return useQuery({ queryKey: crmKeys.contact(id), queryFn: () => api.get<ContactDetail>(`/api/crm/contacts/${id}`) });
}

export function useDeals(params: { stage?: string; contactId?: string; ownerId?: string } = {}) {
  return useQuery({ queryKey: crmKeys.deals(params), queryFn: () => api.get<{ items: Deal[] }>(`/api/crm/deals${queryString(params)}`).then((data) => data.items) });
}

export function useStages() {
  return useQuery({ queryKey: crmKeys.stages, queryFn: () => api.get<{ items: Stage[] }>("/api/crm/stages").then((data) => data.items), staleTime: 60_000 });
}

/** Active team members for owner pickers (core endpoint). */
export function useTeam() {
  return useQuery({ queryKey: ["core", "team"], queryFn: () => api.get<{ items: TeamMember[] }>("/api/team").then((data) => data.items), staleTime: 5 * 60_000 });
}

export function useOpenTasks() {
  return useQuery({ queryKey: crmKeys.openTasks, queryFn: () => api.get<{ items: Activity[] }>("/api/crm/activities?open=1").then((data) => data.items) });
}

function useInvalidateCrm() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: crmKeys.all }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]);
}

export function useSaveLead(id?: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (input: LeadInput | LeadPatch) => (id ? api.patch<Lead>(`/api/crm/leads/${id}`, input) : api.post<Lead>("/api/crm/leads", input)),
    onSuccess: invalidate,
  });
}

export function useConvertLead(id: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (input: LeadConvertInput) => api.post<{ lead: Lead; contact: Contact; deal: Deal | null }>(`/api/crm/leads/${id}/convert`, input), onSuccess: invalidate });
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

export function useUpdateDeal(id: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (input: DealPatch) => api.patch<Deal>(`/api/crm/deals/${id}`, input), onSuccess: invalidate });
}

/** Optimistic: the card stays where it was dropped while the request runs. `listKey` is the board's deals query params. */
export function useMoveDeal(listKey: object = {}) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, ...move }: DealMove & { id: string }) => api.post<Deal>(`/api/crm/deals/${id}/move`, move),
    onMutate: async ({ id, stage, position }) => {
      const key = crmKeys.deals(listKey);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Deal[]>(key);
      queryClient.setQueryData<Deal[]>(key, (deals) => deals?.map((deal) => (deal.id === id ? { ...deal, stage, position } : deal)));
      return { previous, key };
    },
    onError: (_error, _input, context) => (context ? queryClient.setQueryData(context.key, context.previous) : undefined),
    onSettled: invalidate,
  });
}

export function useSaveStage(id?: string) {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (input: StageInput) => (id ? api.patch<Stage>(`/api/crm/stages/${id}`, input) : api.post<Stage>("/api/crm/stages", input)), onSuccess: invalidate });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCrm();
  return useMutation({
    mutationFn: (ids: string[]) => api.post<{ items: Stage[] }>("/api/crm/stages/order", { ids }),
    onSuccess: (data) => (queryClient.setQueryData(crmKeys.stages, data.items), invalidate()),
  });
}

export function useDeleteStage() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: ({ id, moveTo }: { id: string; moveTo?: string }) => api.delete(`/api/crm/stages/${id}${queryString({ moveTo })}`), onSuccess: invalidate });
}

export function useAddActivity() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (input: ActivityInput) => api.post<Activity>("/api/crm/activities", input), onSuccess: invalidate });
}

export function useCompleteTask() {
  const invalidate = useInvalidateCrm();
  return useMutation({ mutationFn: (id: string) => api.post(`/api/crm/activities/${id}/complete`), onSuccess: invalidate });
}
