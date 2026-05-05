import { ViewModel } from "./base.js";
import { batchesApi } from "../models/batchesApi.js";

export class HistoryViewModel extends ViewModel {
  constructor() {
    super({ batches: [], page: 1, total: 0, isLoading: false });
  }

  async load() {
    this.set({ isLoading: true });
    try {
      const p = await batchesApi.list({ page: this.state.page, limit: 20 });
      this.set({ batches: p.items, total: p.total, isLoading: false });
    } catch {
      this.set({ isLoading: false });
    }
  }
}
