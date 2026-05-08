import { request } from "../api.js";

export const composeApi = {
  create: (overlayFile, baseFiles, prompt) => {
    const fd = new FormData();
    fd.append("overlay", overlayFile);
    baseFiles.forEach(f => fd.append("files", f));
    fd.append("prompt", prompt);
    return request("/compose/", { method: "POST", body: fd });
  },
};
