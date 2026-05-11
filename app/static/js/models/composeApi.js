import { request } from "../api.js";

export const composeApi = {
  create: (overlayType, baseFiles, prompt) => {
    const fd = new FormData();
    fd.append("overlay_type", overlayType);
    baseFiles.forEach(f => fd.append("files", f));
    fd.append("prompt", prompt);
    return request("/compose/", { method: "POST", body: fd });
  },
};
