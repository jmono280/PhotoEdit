import { request } from "../api.js";

export const batchesApi = {
  create: (files, prompt) => {
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    fd.append("prompt", prompt);
    return request("/batches/", { method: "POST", body: fd });
  },

  list: (params = {}) => request("/batches/?" + new URLSearchParams(params)),

  get: (id) => request("/batches/" + id),

  progress: (id) => request("/batches/" + id + "/progress"),

  delete: (id) => request("/batches/" + id, { method: "DELETE" }),
};
