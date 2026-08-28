export async function apiRequest(method: string, url: string, data?: unknown) {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const apiKey = localStorage.getItem("userApiKey");
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("userApiKey");
      window.dispatchEvent(new Event("userApiKeyChanged"));
    }
    const text = await res.text().catch(() => res.statusText);
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) message = parsed.message;
    } catch {}
    throw new Error(message);
  }
  
  return res;
}

export async function apiQuery(url: string) {
  const res = await apiRequest("GET", url);
  return res.json();
}
