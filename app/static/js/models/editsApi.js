import { request } from "../api.js";

export const editsApi = {
  get: (id) => request("/edits/" + id),

  retry: (id) => request("/edits/" + id + "/retry", { method: "POST" }),

  fetchImageBlob: async (path) => {
    const res = await request(path);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
