import { EditorViewModel } from "../viewmodels/editorViewModel.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const MAX = parseInt(document.body.dataset.maxImages || "20");
const vm = new EditorViewModel(MAX);

const previews    = document.getElementById("previews");
const dropzone    = document.getElementById("dropzone");
const fileInput   = document.getElementById("file-input");
const fileCount   = document.getElementById("file-count");
const errorEl     = document.getElementById("error");
const submitBtn   = document.getElementById("submit");
const refZone     = document.getElementById("ref-zone");
const refInput    = document.getElementById("ref-input");
const refPreview  = document.getElementById("ref-preview");
const refPlaceholder = document.getElementById("ref-placeholder");
const refClear    = document.getElementById("ref-clear");

vm.subscribe(state => {
  // Previews
  previews.innerHTML = "";
  state.files.forEach(f => {
    const card = document.createElement("div");
    card.className = "relative group";
    const img = document.createElement("img");
    img.src = f.previewUrl;
    img.className = "w-full h-40 object-contain rounded-lg bg-gray-100";
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

  // Referencia
  if (state.referencePreview) {
    refPreview.src = state.referencePreview;
    refPreview.classList.remove("hidden");
    refPlaceholder.classList.add("hidden");
    refClear.classList.remove("hidden");
  } else {
    refPreview.classList.add("hidden");
    refPlaceholder.classList.remove("hidden");
    refClear.classList.add("hidden");
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

// Zona de referencia
refZone.onclick = (e) => {
  if (e.target !== refClear && e.target !== refInput && !e.target.closest("label")) refInput.click();
};
refZone.addEventListener("dragover", e => { e.preventDefault(); refZone.classList.add("border-blue-400", "bg-blue-50"); });
refZone.addEventListener("dragleave", () => refZone.classList.remove("border-blue-400", "bg-blue-50"));
refZone.addEventListener("drop", e => {
  e.preventDefault();
  refZone.classList.remove("border-blue-400", "bg-blue-50");
  if (e.dataTransfer.files[0]) vm.setReference(e.dataTransfer.files[0]);
});
refInput.addEventListener("change", e => {
  if (e.target.files[0]) vm.setReference(e.target.files[0]);
  refInput.value = "";
});
refClear.addEventListener("click", e => { e.stopPropagation(); vm.clearReference(); });

const promptEl = document.getElementById("prompt");
promptEl.value = `Retouch this vehicle photo for Automania Buy Here Pay Here inventory in a clean, consistent dealership studio style.

**Preserve exactly:** the same real vehicle, original angle, camera viewpoint, placement, composition, crop, perspective, proportions, and paint color. Do not reposition, rotate, reframe, or redesign the vehicle. Do not alter body shape, panels, bumpers, lights, grille, wheels, tires, badges, mirrors, windows, handles, trim, or plate area.

**Lighting & finish:** soft, even, professional lighting. Sharp, clear, polished look with naturally balanced highlights, shadows, and reflections. Keep paint color accurate and realistic.

**Background:** replace with a clean, neutral, softly blurred studio background using HEX #d4d4d4 as the base color, consistent across all inventory photos regardless of the original scene. Keep it simple, elegant, and distraction-free. Expand naturally if needed to give the vehicle breathing room while preserving its original placement. Keep the floor realistic with a subtle natural shadow under the vehicle.

**Retouching:** remove only minor distractions (light dust, small scuffs, tiny paint imperfections). Keep edits subtle and natural — do not over-retouch or make the vehicle look fake.

**Reference image (license plate):** a reference image will be provided and must be placed exactly where the vehicle's license plate normally sits — on the front license plate area when the photo shows the front of the car, and on the rear license plate area when the photo shows the back. Fit the reference image naturally into the existing plate mounting area, matching the plate's perspective, angle, scale, and tilt so it looks like a real plate on the vehicle. Blend the lighting and shadows of the reference image with the rest of the car so it integrates realistically. Do not place the reference image anywhere else on the vehicle, body, windows, or background. If the photo is a side view or any angle where no license plate area is visible, do not add the reference image.

**Do not add** any text, logos, signs, graphics, watermarks, stickers, frames, or banners other than the provided reference image in the license plate position. Only the vehicle on the uniform studio background.

Final result: the same real car in its exact original angle and position, professionally retouched, with the reference image naturally integrated in the license plate area when visible. Not CGI, not overprocessed. Style: premium, consistent Buy Here Pay Here dealership inventory photo for Automania.`;
vm.setPrompt(promptEl.value);
promptEl.addEventListener("input", e => vm.setPrompt(e.target.value));
submitBtn.addEventListener("click", () => vm.submit());
document.getElementById("logout").addEventListener("click", () => {
  authApi.logout();
  window.location = "/login";
});
