import { authApi } from "../models/authApi.js";

const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit");

document.getElementById("register-form").addEventListener("submit", async e => {
  e.preventDefault();
  errorEl.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creando cuenta…";

  try {
    await authApi.register({
      full_name: document.getElementById("full-name").value,
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
    });
    window.location = "/login";
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
    submitBtn.disabled = false;
    submitBtn.textContent = "Crear cuenta";
  }
});
