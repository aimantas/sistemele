import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import type { BusinessProfile } from "@/shared/business";
import { api, queryString } from "@/app/lib/api";
import type { Quote, QuoteDetail, QuoteInput, QuoteListStatus, QuoteMarkInput, QuotePatch, QuoteSendInput, QuoteSendResult } from "../shared/schema";

/** Quote data hooks. Keys start with "quotes" so one invalidate refreshes the module. */
export const quoteKeys = {
  all: ["quotes"] as const,
  list: (params: object) => ["quotes", "list", params] as const,
  detail: (id: string) => ["quotes", "detail", id] as const,
};

export interface QuoteListParams {
  status?: QuoteListStatus;
  contactId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function useQuotes(params: QuoteListParams) {
  return useQuery({ queryKey: quoteKeys.list(params), queryFn: () => api.get<Page<Quote>>(`/api/quotes${queryString({ ...params })}`), placeholderData: (previous) => previous });
}

export function useQuote(id: string) {
  return useQuery({ queryKey: quoteKeys.detail(id), queryFn: () => api.get<QuoteDetail>(`/api/quotes/${id}`), enabled: Boolean(id) });
}

/** Seller profile: default VAT rate and the details printed on the quote. */
export function useBusinessProfile() {
  return useQuery({ queryKey: ["settings", "business"], queryFn: () => api.get<{ business: BusinessProfile }>("/api/settings/business"), select: (data) => data.business, staleTime: 60_000 });
}

/** Quotes change CRM (deal stages, timeline) and dashboard numbers too. */
function useInvalidateQuotes() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: quoteKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["crm"] }),
      queryClient.invalidateQueries({ queryKey: ["metrics"] }),
    ]);
}

export function useSaveQuote(id?: string) {
  const invalidate = useInvalidateQuotes();
  return useMutation({
    mutationFn: (input: QuoteInput | QuotePatch) => (id ? api.patch<QuoteDetail>(`/api/quotes/${id}`, input) : api.post<QuoteDetail>("/api/quotes", input)),
    onSuccess: invalidate,
  });
}

export function useDeleteQuote() {
  const invalidate = useInvalidateQuotes();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/quotes/${id}`), onSuccess: invalidate });
}

/** Status actions return the updated quote: show it at once, then refresh the rest. */
function useStoreQuote() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuotes();
  return (quote: QuoteDetail) => {
    queryClient.setQueryData(quoteKeys.detail(quote.id), quote);
    return invalidate();
  };
}

export function useSendQuote(id: string) {
  const store = useStoreQuote();
  return useMutation({ mutationFn: (input: QuoteSendInput) => api.post<QuoteSendResult>(`/api/quotes/${id}/send`, input), onSuccess: (result) => store(result.quote) });
}

export function useReviseQuote(id: string) {
  const store = useStoreQuote();
  return useMutation({ mutationFn: () => api.post<QuoteDetail>(`/api/quotes/${id}/revise`), onSuccess: store });
}

export function useMarkQuote(id: string) {
  const store = useStoreQuote();
  return useMutation({ mutationFn: (input: QuoteMarkInput) => api.post<QuoteDetail>(`/api/quotes/${id}/mark`, input), onSuccess: store });
}

export function useDuplicateQuote(id: string) {
  const invalidate = useInvalidateQuotes();
  return useMutation({ mutationFn: () => api.post<QuoteDetail>(`/api/quotes/${id}/duplicate`), onSuccess: invalidate });
}

/** Provided by the invoices module: POST /api/invoices/from-quote/:quoteId → the new invoice. */
export function useCreateInvoiceFromQuote(quoteId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuotes();
  return useMutation({
    mutationFn: () => api.post<{ id: string }>(`/api/invoices/from-quote/${quoteId}`),
    onSuccess: () => Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ["invoices"] })]),
  });
}
