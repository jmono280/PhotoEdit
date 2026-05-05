import { HistoryViewModel } from "../viewmodels/historyViewModel.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const vm = new HistoryViewModel();
const listEl = document.getElementById("batch-list");
const emptyEl = document.getElementById("empty");

const STATUS_LABELS = {
  pending:    { text: "Pendiente",  cls: "bg-gray-100 text-gray-600" },
  processing: { text: "Procesando", cls: "bg-blue-100 text-blue-700" },
  completed:  { text: "Completado", cls: "bg-green-100 text-green-700" },
  partial:    { text: "Parcial",    cls: "bg-yellow-100 text-yellow-700" },
  failed:     { text: "Fallido",    cls: "bg-red-100 text-red-700" },
};

function formatDate(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

vm.subscribe(state => {
  if (state.isLoading) {
    listEl.innerHTML = `<p class="text-sm text-gray-400">Cargando…</p>`;
    emptyEl.classList.add("hidden");
    return;
  }

  if (!state.batches.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  listEl.innerHTML = "";

  state.batches.forEach(batch => {
    const s = STATUS_LABELS[batch.status] || { text: batch.status, cls: "bg-gray-100 text-gray-600" };

    const row = document.createElement("div");
    row.className =
      "bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 " +
      "cursor-pointer hover:shadow-md transition-shadow";

    row.innerHTML = `
      <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${s.cls}">${s.text}</span>
      <span class="flex-1 text-sm font-medium truncate">${batch.prompt}</span>
      <span class="text-xs text-gray-400 shrink-0">${batch.completed_count}/${batch.total_images}</span>
      <span class="text-xs text-gray-400 shrink-0">${formatDate(batch.created_at)}</span>
    `;

    row.addEventListener("click", () => { window.location = "/batch/" + batch.id; });
    listEl.appendChild(row);
  });
});

document.getElementById("logout").addEventListener("click", () => {
  authApi.logout();
  window.location = "/login";
});

vm.load();
