import { ViewModel } from "./base.js";
import { batchesApi } from "../models/batchesApi.js";

export class BatchProgressViewModel extends ViewModel {
  constructor(batchId) {
    super({ batchId, progress: null, isLoading: true, error: null });
    this.intervalId = null;
  }

  start() {
    this.poll();
    this.intervalId = setInterval(() => this.poll(), 1500);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async poll() {
    try {
      const p = await batchesApi.progress(this.state.batchId);
      this.set({ progress: p, isLoading: false });
      if (["completed", "partial", "failed"].includes(p.status)) {
        this.stop();
      }
    } catch (e) {
      this.set({ error: e.message, isLoading: false });
      this.stop();
    }
  }
}
