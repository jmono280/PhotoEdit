import { AuthViewModel } from "../viewmodels/authViewModel.js";

const vm = new AuthViewModel();
const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit");

vm.subscribe(state => {
  if (state.error) {
    errorEl.textContent = state.error;
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }
  submitBtn.disabled = state.isLoading;
  submitBtn.textContent = state.isLoading ? "Entrando…" : "Entrar";
});

document.getElementById("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  vm.login(email, password);
});
