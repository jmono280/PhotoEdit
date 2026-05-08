import { ViewModel } from "./base.js";
import { composeApi } from "../models/composeApi.js";

export class ComposeViewModel extends ViewModel {
  constructor(maxImages = 20) {
    super({
      overlayFile: null,
      overlayPreview: null,
      baseFiles: [],
      prompt: "",
      status: "idle",
      error: null,
      maxImages,
    });
  }

  setOverlay(file) {
    if (this.state.overlayPreview) URL.revokeObjectURL(this.state.overlayPreview);
    this.set({
      overlayFile: file,
      overlayPreview: file ? URL.createObjectURL(file) : null,
      error: null,
    });
  }

  addBaseFiles(fileList) {
    const newOnes = Array.from(fileList).map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    const all = [...this.state.baseFiles, ...newOnes];
    if (all.length > this.state.maxImages) {
      this.set({ error: "Máximo " + this.state.maxImages + " imágenes base" });
      return;
    }
    this.set({ baseFiles: all, error: null });
  }

  removeBaseFile(id) {
    const f = this.state.baseFiles.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    this.set({ baseFiles: this.state.baseFiles.filter(x => x.id !== id) });
  }

  setPrompt(p) { this.set({ prompt: p }); }

  async submit() {
    if (!this.state.overlayFile) return this.set({ error: "Sube el elemento a agregar" });
    if (!this.state.baseFiles.length) return this.set({ error: "Sube al menos una imagen base" });
    if (!this.state.prompt.trim()) return this.set({ error: "Escribe un prompt" });
    this.set({ status: "uploading", error: null });
    try {
      const batch = await composeApi.create(
        this.state.overlayFile,
        this.state.baseFiles.map(f => f.file),
        this.state.prompt,
      );
      this.set({ status: "submitted" });
      window.location = "/batch/" + batch.id;
    } catch (e) {
      this.set({ status: "idle", error: e.message });
    }
  }
}
