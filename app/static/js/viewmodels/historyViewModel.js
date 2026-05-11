import { ViewModel } from "./base.js";
import { batchesApi } from "../models/batchesApi.js";
import { authApi } from "../models/authApi.js";

export class HistoryViewModel extends ViewModel {
  constructor() {
    super({ batches: [], page: 1, total: 0, user: null, isLoading: false });
  }

  async load() {
    this.set({ isLoading: true });
    try {
      const [p, user] = await Promise.all([
        batchesApi.list({ page: this.state.page, limit: 20 }),
        authApi.me(),
      ]);
      this.set({ batches: p.items, total: p.total, user, isLoading: false });
    } catch {
      this.set({ isLoading: false });
    }
  }
}
