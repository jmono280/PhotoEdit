import { request, setToken, clearToken } from "../api.js";

export const authApi = {
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: async (email, password) => {
    const r = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(r.access_token);
    return r;
  },

  me: () => request("/auth/me"),

  logout: () => clearToken(),
};
