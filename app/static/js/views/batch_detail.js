import { BatchProgressViewModel } from "../viewmodels/batchProgressViewModel.js";
import { batchesApi } from "../models/batchesApi.js";
import { editsApi } from "../models/editsApi.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const main = document.querySelector("[data-batch-id]");
const batchId = main.dataset.batchId;
const vm = new BatchProgressViewModel(batchId);

const titleEl        = document.getElementById("batch-title");
const promptEl       = document.getElementById("prompt-display");
const progressBar    = document.getElementById("progress-bar");
const progressLabel  = document.getElementById("progress-label");
const progressCount  = document.getElementById("progress-count");
const grid           = document.getElementById("jobs-grid");
const overlaySection = document.getElementById("overlay-section");
const overlayImg     = document.getElementById("overlay-img");

const STATUS_TITLES = {
  pending: "Preparando lote…",
  processing: "Procesando lote…",
  completed: "Lote completado",
  partial: "Lote finalizado (parcial)",
  failed: "Lote fallido",
};

vm.subscribe(async state => {
  if (!state.progress) return;
  const p = state.progress;

  // Foto de referencia — mostrar una sola vez
  if (p.has_overlay && !overlaySection._loaded) {
    overlaySection._loaded = true;
    overlaySection.classList.remove("hidden");
    overlaySection.classList.add("block");
    editsApi.fetchImageBlob("/batches/" + batchId + "/overlay")
      .then(url => { overlayImg.src = url; })
      .catch(() => {});
  }

  // Título
  titleEl.textContent = STATUS_TITLES[p.status] || p.status;

  // Barra de progreso
  const done = p.completed + p.failed;
  const pct = p.total > 0 ? Math.round((done / p.total) * 100) : 0;
  progressBar.style.width = pct + "%";
  progressBar.className = [
    "h-2 rounded-full transition-all duration-500",
    p.status === "failed" ? "bg-red-500" :
    p.status === "completed" ? "bg-green-500" : "bg-blue-500",
  ].join(" ");

  // Label y contador
  const parts = [];
  if (p.completed) parts.push(`${p.completed} completada${p.completed !== 1 ? "s" : ""}`);
  if (p.failed)    parts.push(`${p.failed} fallida${p.failed !== 1 ? "s" : ""}`);
  if (p.processing) parts.push(`${p.processing} procesando`);
  if (p.pending)   parts.push(`${p.pending} pendiente${p.pending !== 1 ? "s" : ""}`);
  progressLabel.textContent = parts.join(" · ") || "Iniciando…";
  progressCount.textContent = `${done} / ${p.total}`;

  if (["completed", "partial", "failed"].includes(p.status)) {
    const batch = await batchesApi.get(batchId);
    promptEl.textContent = batch.prompt;
    await renderGrid(batch.jobs);
  } else {
    renderProcessing(p.jobs);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function badge(status) {
  const map = {
    pending:    "bg-gray-100 text-gray-600",
    processing: "bg-blue-100 text-blue-700",
    completed:  "bg-green-100 text-green-700",
    failed:     "bg-red-100 text-red-700",
  };
  return `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || "bg-gray-100 text-gray-600"}">${status}</span>`;
}

// ── renderProcessing: lista ligera mientras el batch aún corre ─────────────

function renderProcessing(jobs) {
  grid.innerHTML = "";
  const sorted = [...jobs].sort((a, b) => a.position - b.position);
  sorted.forEach(job => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-3";
    card.innerHTML = `
      <span class="text-sm font-medium truncate flex-1">${job.original_filename}</span>
      ${badge(job.status)}
    `;
    grid.appendChild(card);
  });
}

// ── renderGrid: before/after cuando el batch termina ──────────────────────

async function renderGrid(jobs) {
  grid.innerHTML = "";
  const sorted = [...jobs].sort((a, b) => a.position - b.position);

  sorted.forEach(job => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-sm overflow-hidden";

    if (job.status === "completed" && job.has_result) {
      card.innerHTML = `
        <div class="grid grid-cols-2 gap-px bg-gray-100">
          <div>
            <p class="text-xs text-center text-gray-400 py-0.5">Original</p>
            <img class="w-full h-48 object-contain bg-gray-50" alt="Original">
          </div>
          <div>
            <p class="text-xs text-center text-gray-400 py-0.5">Editada</p>
            <img class="w-full h-48 object-contain bg-gray-50" alt="Editada">
          </div>
        </div>
        <div class="p-3">
          <p class="text-sm font-medium truncate">${job.original_filename}</p>
          <p class="text-xs text-gray-400 mt-0.5">
            ${job.duration_ms ? (job.duration_ms / 1000).toFixed(1) + "s" : ""}
            ${job.cost_usd ? " · $" + parseFloat(job.cost_usd).toFixed(4) : ""}
          </p>
          <a class="dl-link mt-2 inline-block text-xs text-blue-600 hover:underline"
             download="result_${job.original_filename}">Descargar</a>
        </div>
      `;
      grid.appendChild(card);

      const [origImg, resultImg] = card.querySelectorAll("img");
      const dlLink = card.querySelector(".dl-link");

      editsApi.fetchImageBlob("/edits/" + job.id + "/original")
        .then(url => { origImg.src = url; })
        .catch(() => {});

      editsApi.fetchImageBlob("/edits/" + job.id + "/result")
        .then(url => {
          resultImg.src = url;
          dlLink.href = url;
        })
        .catch(() => {});

    } else if (job.status === "failed") {
      card.innerHTML = `
        <div class="p-4">
          <div class="flex items-start justify-between gap-2 mb-2">
            <p class="text-sm font-medium truncate flex-1">${job.original_filename}</p>
            ${badge("failed")}
          </div>
          <p class="text-xs text-red-600 mb-3 line-clamp-2">
            ${job.error_message || "Error desconocido"}
          </p>
          <button class="retry-btn text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded font-medium">
            Reintentar
          </button>
        </div>
      `;
      grid.appendChild(card);
      card.querySelector(".retry-btn").addEventListener("click", async function () {
        this.disabled = true;
        this.textContent = "Reintentando…";
        try {
          await editsApi.retry(job.id);
          window.location.reload();
        } catch {
          this.textContent = "Error al reintentar";
          this.disabled = false;
        }
      });

    } else {
      // pending / processing (edge case: batch finalizado con job en estado raro)
      card.innerHTML = `
        <div class="p-4 flex items-center justify-between gap-3">
          <p class="text-sm font-medium truncate flex-1">${job.original_filename}</p>
          ${badge(job.status)}
        </div>
      `;
      grid.appendChild(card);
    }
  });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

document.getElementById("logout").addEventListener("click", () => {
  authApi.logout();
  window.location = "/login";
});

vm.start();
window.addEventListener("beforeunload", () => vm.stop());
