import axios from "axios";

const rawBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");

const api = axios.create({
  baseURL: normalizedBaseUrl || undefined,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const url = config.url || "";
  if (!normalizedBaseUrl.endsWith("/api")) {
    return config;
  }

  if (url === "/api") {
    config.url = "/";
    return config;
  }

  if (url.startsWith("/api/")) {
    const stripped = url.replace(/^\/api/, "");
    config.url = stripped || "/";
  }

  return config;
});

// Track if we've already redirected to prevent loops
let hasRedirectedToLogin = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";

    // Only redirect to login if:
    // 1. Status is 401 (unauthorized)
    // 2. NOT the login endpoint itself
    // 3. NOT the /me endpoint (to avoid loop during initial check)
    // 4. Haven't already redirected
    // 5. Not already on the login page
    if (
      status === 401 &&
      !requestUrl.includes("/api/authentication") &&
      !requestUrl.includes("/api/me") &&
      !hasRedirectedToLogin &&
      window.location.pathname !== "/"
    ) {
      hasRedirectedToLogin = true;
      window.location.href = "/";
      
      // Reset flag after redirect completes
      setTimeout(() => {
        hasRedirectedToLogin = false;
      }, 1000);
    }
    return Promise.reject(error);
  }
);

export default api;
