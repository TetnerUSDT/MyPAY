import { apiRequest as request } from "@/lib/queryClient";

export const apiRequest = request;

export async function apiQuery(url: string) {
  const response = await request("GET", url);
  return response.json();
}
