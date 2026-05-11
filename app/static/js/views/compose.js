import { ComposeViewModel } from "../viewmodels/composeViewModel.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const MAX = parseInt(document.body.dataset.maxImages || "20");
const vm = new ComposeViewModel(MAX);

const baseZone     = document.getElementById("base-zone");
const baseInput    = document.getElementById("base-input");
const basePreviews = document.getElementById("base-previews");
const baseCount    = document.getElementById("base-count");
const promptEl     = document.getElementById("prompt");
const errorEl      = document.getElementById("error");
const submitBtn    = document.getElementById("submit");
const refBtns      = document.querySelectorAll(".ref-btn");

const PROMPT_BASE = `Retouch this vehicle photo for Automania Buy Here Pay Here inventory in a clean, consistent dealership studio style.

**Preserve exactly:** the same real vehicle, original angle, camera viewpoint, placement, composition, crop, perspective, proportions, and paint color. Do not reposition, rotate, reframe, or redesign the vehicle. Do not alter body shape, panels, bumpers, lights, grille, wheels, tires, badges, mirrors, windows, handles, trim, or plate area.

**Lighting & finish:** soft, even, professional lighting. Sharp, clear, polished look with naturally balanced highlights, shadows, and reflections. Keep paint color accurate and realistic.

**Background:** replace with a clean, neutral, softly blurred studio background using HEX #d4d4d4 as the base color, consistent across all inventory photos regardless of the original scene. Keep it simple, elegant, and distraction-free. Expand naturally if needed to give the vehicle breathing room while preserving its original placement. Keep the floor realistic with a subtle natural shadow under the vehicle.

**Retouching:** remove only minor distractions (light dust, small scuffs, tiny paint imperfections). Keep edits subtle and natural — do not over-retouch or make the vehicle look fake.

**Do not add** any text, logos, signs, graphics, watermarks, stickers, frames, or banners. Only the vehicle on the uniform studio background.

Final result: the same real car in its exact original angle and position, professionally retouched on a uniform studio background. Not CGI, not overprocessed. Style: premium, consistent Buy Here Pay Here dealership inventory photo for Automania.`;

const PROMPT_LICENCE_PLATE = `Retouch this vehicle photo for Automania Buy Here Pay Here inventory in a clean, consistent dealership studio style.

**Preserve exactly:** the same real vehicle, original angle, camera viewpoint, placement, composition, crop, perspective, proportions, and paint color. Do not reposition, rotate, reframe, or redesign the vehicle. Do not alter body shape, panels, bumpers, lights, grille, wheels, tires, badges, mirrors, windows, handles, trim, or plate area.

**Lighting & finish:** soft, even, professional lighting. Sharp, clear, polished look with naturally balanced highlights, shadows, and reflections. Keep paint color accurate and realistic.

**Background:** replace with a clean, neutral, softly blurred studio background using HEX #d4d4d4 as the base color, consistent across all inventory photos regardless of the original scene. Keep it simple, elegant, and distraction-free. Expand naturally if needed to give the vehicle breathing room while preserving its original placement. Keep the floor realistic with a subtle natural shadow under the vehicle.

**Retouching:** remove only minor distractions (light dust, small scuffs, tiny paint imperfections). Keep edits subtle and natural — do not over-retouch or make the vehicle look fake.

**Reference image (license plate):** a reference image will be provided and must be placed exactly where the vehicle's license plate normally sits — on the front license plate area when the photo shows the front of the car, and on the rear license plate area when the photo shows the back. Fit the reference image naturally into the existing plate mounting area, matching the plate's perspective, angle, scale, and tilt so it looks like a real plate on the vehicle. Blend the lighting and shadows of the reference image with the rest of the car so it integrates realistically. Do not place the reference image anywhere else on the vehicle, body, windows, or background. If the photo is a side view or any angle where no license plate area is visible, do not add the reference image.

**Do not add** any text, logos, signs, graphics, watermarks, stickers, frames, or banners other than the provided reference image in the license plate position. Only the vehicle on the uniform studio background.

Final result: the same real car in its exact original angle and position, professionally retouched, with the reference image naturally integrated in the license plate area when visible. Not CGI, not overprocessed. Style: premium, consistent Buy Here Pay Here dealership inventory photo for Automania.`;


const PROMPTS = {
  "":            PROMPT_BASE,
  "licence_plate": PROMPT_LICENCE_PLATE,
};

function applyRefType(type) {
  vm.setOverlayType(type);
  promptEl.value = PROMPTS[type] || PROMPT_BASE;
  vm.setPrompt(promptEl.value);
  refBtns.forEach(btn => {
    const active = btn.dataset.type === type;
    btn.classList.toggle("border-blue-500", active);
    btn.classList.toggle("border-gray-200", !active);
    btn.classList.toggle("bg-blue-50", active);
  });
}

// Default: placa selected
applyRefType("licence_plate");

vm.subscribe(state => {
  // Base previews
  basePreviews.innerHTML = "";
  state.baseFiles.forEach(f => {
    const card = document.createElement("div");
    card.className = "relative group";
    const img = document.createElement("img");
    img.src = f.previewUrl;
    img.className = "w-full h-40 object-contain rounded-lg bg-gray-100";
    img.alt = f.file.name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs " +
      "items-center justify-center hidden group-hover:flex";
    btn.textContent = "×";
    btn.onclick = () => vm.removeBaseFile(f.id);
    card.appendChild(img);
    card.appendChild(btn);
    basePreviews.appendChild(card);
  });

  const n = state.baseFiles.length;
  baseCount.textContent = n ? `${n} imagen${n !== 1 ? "es" : ""} base` : "";

  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }

  const ready = state.overlayType && n > 0 && state.prompt.trim() && state.status === "idle";
  submitBtn.disabled = !ready;
  submitBtn.textContent = state.status === "uploading" ? "Subiendo…" : "Procesar composición";
});

// Reference type buttons
refBtns.forEach(btn => {
  btn.addEventListener("click", () => applyRefType(btn.dataset.type));
});

// Base zone
baseZone.onclick = () => baseInput.click();
baseZone.addEventListener("dragover", e => { e.preventDefault(); baseZone.classList.add("border-blue-400", "bg-blue-50"); });
baseZone.addEventListener("dragleave", () => baseZone.classList.remove("border-blue-400", "bg-blue-50"));
baseZone.addEventListener("drop", e => {
  e.preventDefault();
  baseZone.classList.remove("border-blue-400", "bg-blue-50");
  vm.addBaseFiles(e.dataTransfer.files);
});
baseInput.addEventListener("change", e => {
  vm.addBaseFiles(e.target.files);
  baseInput.value = "";
});

promptEl.addEventListener("input", e => vm.setPrompt(e.target.value));
submitBtn.addEventListener("click", () => vm.submit());
document.getElementById("logout").addEventListener("click", () => {
  authApi.logout();
  window.location = "/login";
});
