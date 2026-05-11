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
      referenceType: null,
    });
  }

  addFiles(fileList) {
    const file = fileList[0];
    if (!file) return;
    if (this.state.files[0]) URL.revokeObjectURL(this.state.files[0].previewUrl);
    this.set({
      files: [{ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }],
      error: null,
    });
  }

  removeFile(id) {
    const f = this.state.files.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    this.set({ files: this.state.files.filter(x => x.id !== id) });
  }

  setPrompt(p) { this.set({ prompt: p }); }

  setReference(type) { this.set({ referenceType: type, error: null }); }

  clearReference() { this.set({ referenceType: null }); }

  async submit() {
    if (!this.state.files.length) return this.set({ error: "Sube al menos una imagen" });
    if (!this.state.prompt.trim()) return this.set({ error: "Escribe un prompt" });
    this.set({ status: "uploading", error: null });
    try {
      const batch = this.state.referenceType
        ? await composeApi.create(
            this.state.referenceType,
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
