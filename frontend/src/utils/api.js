import axios from "axios";

const rawBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const hasApiSuffix = normalizedBaseUrl.endsWith("/api");
const apiBaseUrl = normalizedBaseUrl || undefined;
const apiWithSuffixBaseUrl = (() => {
  if (!normalizedBaseUrl) return "/api";
  return hasApiSuffix ? normalizedBaseUrl : `${normalizedBaseUrl}/api`;
})();

const pendingControllers = new Set();
const controllerKey = Symbol("axiosPendingController");

const attachRouteNormalizer = (instance) => {
  instance.interceptors.request.use((config) => {
    const url = config.url || "";
    if (!hasApiSuffix) {
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
};

let hasRedirectedToLogin = false;

const attachAuthRedirect = (instance) => {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const requestUrl = error.config?.url || "";

      if (
        status === 401 &&
        !requestUrl.includes("/api/authentication") &&
        !requestUrl.includes("/api/me") &&
        !hasRedirectedToLogin &&
        window.location.pathname !== "/"
      ) {
        hasRedirectedToLogin = true;
        window.location.href = "/";

        setTimeout(() => {
          hasRedirectedToLogin = false;
        }, 1000);
      }
      return Promise.reject(error);
    }
  );
};

const attachAbortTracking = (instance) => {
  instance.interceptors.request.use((config) => {
    const externalSignal = config.signal;
    const controller = new AbortController();
    pendingControllers.add(controller);

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else if (typeof externalSignal.addEventListener === "function") {
        externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    config.signal = controller.signal;
    config[controllerKey] = controller;
    return config;
  });

  const finalize = (config) => {
    const controller = config?.[controllerKey];
    if (controller) {
      pendingControllers.delete(controller);
      delete config[controllerKey];
    }
  };

  instance.interceptors.response.use(
    (response) => {
      finalize(response.config);
      return response;
    },
    (error) => {
      if (error.config) {
        finalize(error.config);
      }
      return Promise.reject(error);
    }
  );
};

const createCoreClient = () => axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
});

const api = createCoreClient();
attachRouteNormalizer(api);
attachAuthRedirect(api);
attachAbortTracking(api);

const analyticsApi = createCoreClient();
attachRouteNormalizer(analyticsApi);
attachAuthRedirect(analyticsApi);
attachAbortTracking(analyticsApi);

const notificationApi = axios.create({
  baseURL: apiWithSuffixBaseUrl,
  withCredentials: true,
  timeout: 15000,
});

const cancelAllPendingRequests = () => {
  if (pendingControllers.size === 0) return;
  for (const controller of pendingControllers) {
    controller.abort();
  }
  pendingControllers.clear();
};

export default api;
export { analyticsApi, notificationApi, cancelAllPendingRequests };
