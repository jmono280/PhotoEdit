import { ViewModel } from "./base.js";
import { batchesApi } from "../models/batchesApi.js";
import { composeApi } from "../models/composeApi.js";

export class EditorViewModel extends ViewModel {
  constructor(maxImages = 20) {
    super({
      files: [],
      prompt: "",
      status: "idle",
      error: null,
      batchId: null,
      maxImages,
      referenceFile: null,
      referencePreview: null,
    });
  }

  addFiles(fileList) {
    const newOnes = Array.from(fileList).map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    const all = [...this.state.files, ...newOnes];
    if (all.length > this.state.maxImages) {
      this.set({ error: "Máximo " + this.state.maxImages + " imágenes" });
      return;
    }
    this.set({ files: all, error: null });
  }

  removeFile(id) {
    const f = this.state.files.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    this.set({ files: this.state.files.filter(x => x.id !== id) });
  }

  setPrompt(p) { this.set({ prompt: p }); }

  setReference(file) {
    if (this.state.referencePreview) URL.revokeObjectURL(this.state.referencePreview);
    this.set({
      referenceFile: file,
      referencePreview: file ? URL.createObjectURL(file) : null,
    });
  }

  clearReference() { this.setReference(null); }

  async submit() {
    if (!this.state.files.length) return this.set({ error: "Sube al menos una imagen" });
    if (!this.state.prompt.trim()) return this.set({ error: "Escribe un prompt" });
    this.set({ status: "uploading", error: null });
    try {
      const batch = this.state.referenceFile
        ? await composeApi.create(
            this.state.referenceFile,
            this.state.files.map(f => f.file),
            this.state.prompt,
          )
        : await batchesApi.create(
            this.state.files.map(f => f.file),
            this.state.prompt,
          );
      this.set({ status: "submitted", batchId: batch.id });
      window.location = "/batch/" + batch.id;
    } catch (e) {
      this.set({ status: "idle", error: e.message });
    }
  }
}
