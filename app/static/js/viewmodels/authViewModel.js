import { ViewModel } from "./base.js";
import { authApi } from "../models/authApi.js";

export class AuthViewModel extends ViewModel {
  constructor() {
    super({ user: null, error: null, isLoading: false });
  }

  async login(email, password) {
    this.set({ isLoading: true, error: null });
    try {
      await authApi.login(email, password);
      const user = await authApi.me();
      this.set({ user, isLoading: false });
      window.location = "/";
    } catch (e) {
      this.set({ error: e.message, isLoading: false });
    }
  }

  logout() {
    authApi.logout();
    window.location = "/login";
  }
}
