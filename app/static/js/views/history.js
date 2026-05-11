import { HistoryViewModel } from "../viewmodels/historyViewModel.js";
import { authApi } from "../models/authApi.js";
import { getToken } from "../api.js";

if (!getToken()) { window.location = "/login"; throw new Error("auth"); }

const vm = new HistoryViewModel();
const listEl = document.getElementById("batch-list");
const emptyEl = document.getElementById("empty");
const userCardEl = document.getElementById("user-card");

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

function formatCost(val) {
  if (val == null) return "—";
  const n = parseFloat(val);
  if (n === 0) return "$0.00";
  if (n < 0.001) return "$" + n.toFixed(6);
  return "$" + n.toFixed(4);
}

vm.subscribe(state => {
  if (state.user && userCardEl) {
    userCardEl.classList.remove("hidden");
    userCardEl.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          ${(state.user.full_name || state.user.email || "?")[0].toUpperCase()}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${state.user.full_name || "—"}</p>
          <p class="text-xs text-gray-400 truncate">${state.user.email}</p>
        </div>
        <div class="ml-auto text-right shrink-0">
          <p class="text-xs text-gray-400">Total lotes</p>
          <p class="text-sm font-semibold text-gray-800">${state.total}</p>
        </div>
      </div>
    `;
  }

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
    const failed = batch.failed_count > 0
      ? `<span class="text-red-400">${batch.failed_count} fallidas</span>`
      : "";

    const row = document.createElement("div");
    row.className =
      "bg-white rounded-xl border border-gray-100 shadow-sm p-4 " +
      "cursor-pointer hover:shadow-md hover:border-gray-200 transition-all";

    row.innerHTML = `
      <div class="flex items-center gap-3 mb-2.5">
        <span class="text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${s.cls}">${s.text}</span>
        <span class="text-xs text-gray-400 shrink-0">${formatDate(batch.created_at)}</span>
        <span class="ml-auto text-xs font-semibold text-gray-700 shrink-0">${formatCost(batch.total_cost_usd)}</span>
      </div>
      <div class="flex items-center gap-4 text-xs text-gray-500">
        <span>${batch.total_images} imágenes</span>
        <span>${batch.completed_count} completadas</span>
        ${failed}
        <span class="ml-auto text-gray-300 text-base">→</span>
      </div>
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
