import { EditorViewModel } from "../viewmodels/editorViewModel.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const MAX = parseInt(document.body.dataset.maxImages || "20");
const vm = new EditorViewModel(MAX);

const previews = document.getElementById("previews");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileCount = document.getElementById("file-count");
const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit");

vm.subscribe(state => {
  // Previews
  previews.innerHTML = "";
  state.files.forEach(f => {
    const card = document.createElement("div");
    card.className = "relative group";
    const img = document.createElement("img");
    img.src = f.previewUrl;
    img.className = "w-full h-24 object-cover rounded-lg";
    img.alt = f.file.name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = f.id;
    btn.className =
      "absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs " +
      "items-center justify-center hidden group-hover:flex";
    btn.textContent = "×";
    btn.onclick = () => vm.removeFile(f.id);
    card.appendChild(img);
    card.appendChild(btn);
    previews.appendChild(card);
  });

  // Contador
  const n = state.files.length;
  fileCount.textContent = n
    ? `${n} imagen${n !== 1 ? "es" : ""} (máx. ${state.maxImages})`
    : "";

  // Error
  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }

  // Submit
  const ready = n > 0 && state.prompt.trim().length > 0 && state.status === "idle";
  submitBtn.disabled = !ready;
  submitBtn.textContent = state.status === "uploading" ? "Subiendo…" : "Procesar lote";
});

// Drop zone
dropzone.onclick = () => fileInput.click();
dropzone.addEventListener("dragover", e => {
  e.preventDefault();
  dropzone.classList.add("bg-blue-50", "border-blue-400");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("bg-blue-50", "border-blue-400");
});
dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("bg-blue-50", "border-blue-400");
  vm.addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", e => {
  vm.addFiles(e.target.files);
  // Reset input so the same file can be re-added after remove
  fileInput.value = "";
});

const promptEl = document.getElementById("prompt");
promptEl.value = `Retouch this vehicle photo for Automania Buy Here Pay Here inventory in a clean, consistent dealership studio style.

**Preserve exactly:** the same real vehicle, original angle, camera viewpoint, placement, composition, crop, perspective, proportions, and paint color. Do not reposition, rotate, reframe, or redesign the vehicle. Do not alter body shape, panels, bumpers, lights, grille, wheels, tires, badges, mirrors, windows, handles, trim, or plate area.

**Lighting & finish:** soft, even, professional lighting. Sharp, clear, polished look with naturally balanced highlights, shadows, and reflections. Keep paint color accurate and realistic.

**Background:** replace with a clean, neutral, softly blurred studio background using HEX #d4d4d4 as the base color, consistent across all inventory photos regardless of the original scene. Keep it simple, elegant, and distraction-free. Expand naturally if needed to give the vehicle breathing room while preserving its original placement. Keep the floor realistic with a subtle natural shadow under the vehicle.

**Retouching:** remove only minor distractions (light dust, small scuffs, tiny paint imperfections). Keep edits subtle and natural — do not over-retouch or make the vehicle look fake.

**Do not add** any text, logos, signs, graphics, watermarks, stickers, frames, or banners. Only the vehicle on the uniform studio background.

Final result: the same real car in its exact original angle and position, professionally retouched. Not CGI, not overprocessed. Style: premium, consistent Buy Here Pay Here dealership inventory photo for Automania.`;
vm.setPrompt(promptEl.value);
promptEl.addEventListener("input", e => vm.setPrompt(e.target.value));
submitBtn.addEventListener("click", () => vm.submit());
document.getElementById("logout").addEventListener("click", () => {
  authApi.logout();
  window.location = "/login";
});
