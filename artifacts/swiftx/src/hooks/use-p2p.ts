import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiQuery, apiRequest } from "@/lib/api";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiQuery("/api/auth/me"),
    staleTime: 60_000,
  });
}

export function useAds(filters: { side?: "buy" | "sell"; asset_balance_id?: string; amount?: string; payment_method_id?: string }) {
  return useQuery({
    queryKey: ["/api/p2p/ads", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.side) params.set("side", filters.side);
      if (filters.asset_balance_id && filters.asset_balance_id !== "all") params.set("asset_balance_id", filters.asset_balance_id);
      if (filters.amount && filters.amount !== "all") params.set("amount", filters.amount);
      if (filters.payment_method_id && filters.payment_method_id !== "all") params.set("payment_method_id", filters.payment_method_id);
      return apiQuery(`/api/p2p/ads?${params.toString()}`);
    },
    refetchInterval: 15000,
  });
}

export function useMyAds() {
  return useQuery({
    queryKey: ["/api/p2p/my-ads"],
    queryFn: () => apiQuery("/api/p2p/my-ads"),
  });
}

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/p2p/ads", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
    }
  });
}

export function useUpdateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/p2p/ads/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
    }
  });
}

export function useDeleteAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/p2p/ads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/my-ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
    }
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["/api/p2p/orders"],
    queryFn: () => apiQuery("/api/p2p/orders"),
    refetchInterval: 15000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["/api/p2p/orders", id],
    queryFn: () => apiQuery(`/api/p2p/orders/${id}`),
    refetchInterval: 5000,
    enabled: !!id,
  });
}

export function useOrderMessages(id: string) {
  return useQuery({
    queryKey: ["/api/p2p/orders", id, "messages"],
    queryFn: () => apiQuery(`/api/p2p/orders/${id}/messages`),
    refetchInterval: 3000,
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/p2p/orders", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
    }
  });
}

export function useOrderAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, data }: { action: string; data?: any }) => apiRequest("POST", `/api/p2p/orders/${id}/${action}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", id] });
    }
  });
}

export function useSendMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => apiRequest("POST", `/api/p2p/orders/${id}/messages`, { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders", id, "messages"] });
    }
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["/api/p2p/payment-methods"],
    queryFn: () => apiQuery("/api/p2p/payment-methods"),
  });
}

export function useUserPaymentMethods() {
  return useQuery({
    queryKey: ["/api/p2p/user-payment-methods"],
    queryFn: () => apiQuery("/api/p2p/user-payment-methods"),
  });
}

export function useCreateUserPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/p2p/user-payment-methods", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/user-payment-methods"] });
    }
  });
}

export function useUpdateUserPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/p2p/user-payment-methods/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/user-payment-methods"] });
    }
  });
}

export function useDeleteUserPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/p2p/user-payment-methods/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/user-payment-methods"] });
    }
  });
}

export function useCryptoBalances() {
  return useQuery({
    queryKey: ["/api/user/crypto-balances"],
    queryFn: () => apiQuery("/api/user/crypto-balances"),
  });
}
