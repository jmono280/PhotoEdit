import { EditorViewModel } from "../viewmodels/editorViewModel.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const MAX = parseInt(document.body.dataset.maxImages || "20");
const vm = new EditorViewModel(MAX);

const previews  = document.getElementById("previews");
const dropzone  = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileCount = document.getElementById("file-count");
const errorEl   = document.getElementById("error");
const submitBtn = document.getElementById("submit");
const promptEl  = document.getElementById("prompt");
const refBtns   = document.querySelectorAll(".ref-btn");

const PROMPT_BASE = `Retouch this vehicle photo for Automania Buy Here Pay Here inventory in a clean, consistent dealership studio style.

**Preserve exactly:** the same real vehicle, original angle, camera viewpoint, placement, composition, crop, perspective, proportions, and paint color. Do not reposition, rotate, reframe, or redesign the vehicle. Do not alter body shape, panels, bumpers, lights, grille, wheels, tires, badges, mirrors, windows, handles, trim, or plate area.

**Lighting & finish:** soft, even, professional lighting. Sharp, clear, polished look with naturally balanced highlights, shadows, and reflections. Keep paint color accurate and realistic.

**Background:** replace with a clean, neutral, softly blurred studio background using HEX #d4d4d4 as the base color, consistent across all inventory photos regardless of the original scene. Keep it simple, elegant, and distraction-free. Expand naturally if needed to give the vehicle breathing room while preserving its original placement. Keep the floor realistic with a subtle natural shadow under the vehicle.

**Retouching:** remove only minor distractions (light dust, small scuffs, tiny paint imperfections). Keep edits subtle and natural — do not over-retouch or make the vehicle look fake.

**Do not add** any text, logos, signs, graphics, watermarks, stickers, frames, or banners. Only the vehicle on the uniform studio background.

Final result: the same real car in its exact original angle and position, professionally retouched on a uniform studio background. Not CGI, not overprocessed. Style: premium, consistent Buy Here Pay Here dealership inventory photo for Automania.`;

const PROMPT_NEW_ARRIVAL = `Retouch this vehicle photo for Automania Buy Here Pay Here inventory in a clean, consistent dealership studio style.

**Preserve exactly:** the same real vehicle, original angle, camera viewpoint, placement, composition, crop, perspective, proportions, and paint color. Do not reposition, rotate, reframe, or redesign the vehicle. Do not alter body shape, panels, bumpers, lights, grille, wheels, tires, badges, mirrors, windows, handles, trim, or plate area.

**Lighting & finish:** soft, even, professional lighting. Sharp, clear, polished look with naturally balanced highlights, shadows, and reflections. Keep paint color accurate and realistic.

**Background:** replace with a clean, neutral, softly blurred studio background using HEX #d4d4d4 as the base color, consistent across all inventory photos regardless of the original scene. Keep it simple, elegant, and distraction-free. Expand naturally if needed to give the vehicle breathing room while preserving its original placement. Keep the floor realistic with a subtle natural shadow under the vehicle.

**Reference image (3D pyramid "New Arrivals" cardboard sign on hood):** a reference image will be provided and must be placed on top of the vehicle's hood as a 3D triangular pyramid-shaped cardboard sign (tent card / A-frame style), standing upright on the hood surface. The sign should have two visible angled faces forming a peak at the top, like a folded cardboard card, with the reference image displayed clearly on the front-facing side and mirrored or repeated on the other visible side if the angle shows it. The sign must look like a solid, physical 3D cardboard object — not a flat sticker, decal, or overlay. Add subtle realistic shadows beneath the sign where it meets the hood, and match the lighting, reflections, and color temperature of the studio environment so it integrates naturally. If the photo angle does not show the hood (rear view, certain side angles), do not add the sign.

**Sign consistency rules (CRITICAL — must be identical in every image):** the cardboard sign must look exactly the same across every photo in the inventory, regardless of the original reference image format, dimensions, or aspect ratio. Always render the sign with these fixed specifications:
- **Shape:** equilateral triangular pyramid / tent card with two visible angled faces meeting at a sharp peak at the top, flat base resting on the hood.
- **Aspect ratio of each face:** consistent rectangular/portrait proportion (taller than wide), the same in every image. Crop, scale, or fit the reference image into this fixed face shape — never deform the sign to match the reference image's original format.
- **Material & finish:** matte cardboard texture, same color tone and thickness in every image.
- **Size:** consistent proportional size relative to the hood across all vehicles — large enough to be clearly visible but never covering the windshield, grille, or headlights. Use the hood width as the reference for scaling so the sign looks the same relative size on a small sedan or a large SUV.
- **Position:** always centered on the hood, equidistant from the windshield and the front edge of the hood, aligned with the vehicle's centerline.
- **Orientation:** the front-facing face of the sign always faces the camera directly, adjusted naturally to the vehicle's angle and perspective so it looks physically placed on the hood.
- **Reference image fitting:** the reference image must be centered and fully visible on the front face of the sign, scaled to fit the fixed face proportions without stretching or distorting it. If the reference image has a different aspect ratio than the sign face, fit it cleanly inside with neutral cardboard space around it rather than reshaping the sign.

The goal is that anyone browsing the full inventory sees the exact same cardboard sign on every car, only the reference image content varies.

**Retouching:** remove only minor distractions (light dust, small scuffs, tiny paint imperfections). Keep edits subtle and natural — do not over-retouch or make the vehicle look fake.

**Do not add** any text, logos, signs, graphics, watermarks, stickers, frames, or banners other than the provided reference image displayed on the 3D pyramid cardboard sign on the hood. Only the vehicle on the uniform studio background.

Final result: the same real car in its exact original angle and position, professionally retouched, with a consistent 3D cardboard "New Arrivals" pyramid sign on the hood when visible — identical in shape, size, material, and position across the entire inventory. Not CGI, not overprocessed. Style: premium, consistent Buy Here Pay Here dealership inventory photo for Automania.`;

const PROMPTS = {
  "":            PROMPT_BASE,
  "new_arrival": PROMPT_NEW_ARRIVAL,
};

function applyRefType(type) {
  vm.setReference(type || null);
  promptEl.value = PROMPTS[type] || PROMPT_BASE;
  vm.setPrompt(promptEl.value);
  refBtns.forEach(btn => {
    const active = btn.dataset.type === type;
    btn.classList.toggle("border-blue-500", active);
    btn.classList.toggle("border-gray-200", !active);
    btn.classList.toggle("bg-blue-50", active);
  });
}

// Default: new arrival selected
applyRefType("new_arrival");

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

  const n = state.files.length;
  fileCount.textContent = n ? "1 imagen seleccionada" : "";

  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }

  const ready = n > 0 && state.prompt.trim().length > 0 && state.status === "idle";
  submitBtn.disabled = !ready;
  submitBtn.textContent = state.status === "uploading" ? "Subiendo…" : "Procesar imagen";
});

// Reference type buttons
refBtns.forEach(btn => {
  btn.addEventListener("click", () => applyRefType(btn.dataset.type));
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
  fileInput.value = "";
});

promptEl.addEventListener("input", e => vm.setPrompt(e.target.value));
submitBtn.addEventListener("click", () => vm.submit());
document.getElementById("logout").addEventListener("click", () => {
  authApi.logout();
  window.location = "/login";
});
