# Photo Edit AI — Frontend

Interfaz web sin framework ni build step. HTML con Tailwind CDN + JavaScript vanilla modular (ES modules nativos del navegador). El mismo servidor FastAPI sirve las páginas HTML y la API REST.

---

## Cómo levantar

El frontend no tiene servidor propio. Corre integrado con el backend:

```bash
cd photo-edit-ai
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

Abrir `http://localhost:8001` en el navegador.

> El `--reload` activa hot-reload del servidor Python. Los cambios en JS y HTML se reflejan al recargar la página del navegador (F5) sin reiniciar nada.

---

## Páginas disponibles

| Ruta | Template | View script |
|---|---|---|
| `/login` | `login.html` | `views/login.js` |
| `/register` | `register.html` | `views/register.js` |
| `/` | `editor.html` | `views/editor.js` |
| `/history` | `history.html` | `views/history.js` |
| `/batch/{id}` | `batch_detail.html` | `views/batch_detail.js` |

Las rutas `/`, `/history` y `/batch/{id}` redirigen automáticamente a `/login` si no hay token en `sessionStorage`.

---

## Estructura de archivos

```
app/
├── templates/
│   ├── base.html              Layout principal (Tailwind CDN, bloque view_script)
│   ├── login.html
│   ├── register.html
│   ├── editor.html
│   ├── history.html
│   └── batch_detail.html
└── static/
    ├── css/
    │   └── styles.css         Estilos extra (Tailwind cubre casi todo)
    └── js/
        ├── api.js             ÚNICO archivo con fetch() — gestiona JWT y errores
        ├── models/            Wrappers de endpoints de la API
        │   ├── authApi.js
        │   ├── batchesApi.js
        │   └── editsApi.js
        ├── viewmodels/        Estado de la UI — sin DOM, sin fetch()
        │   ├── base.js
        │   ├── authViewModel.js
        │   ├── editorViewModel.js
        │   ├── batchProgressViewModel.js
        │   └── historyViewModel.js
        └── views/             Bootstrap de cada página — solo DOM + bind
            ├── login.js
            ├── register.js
            ├── editor.js
            ├── history.js
            └── batch_detail.js
```

---

## Arquitectura MVVM

```
Template HTML   →  estructura y IDs del DOM
View (views/)   →  lee IDs del DOM, crea el VM, suscribe, bindea eventos
ViewModel       →  mantiene state, llama al Model, notifica cambios
Model (models/) →  llama a api.js con los parámetros correctos
api.js          →  única capa con fetch(), añade JWT, maneja 401
```

**Regla de capas:**

- `views/*.js` puede tocar `document.*` y `window.location`
- `viewmodels/*.js` no toca el DOM (excepto `window.location` para navegar)
- `models/*.js` no llama `fetch()` directamente — solo importa de `api.js`
- `api.js` es el único lugar con `fetch()`

---

## Herencia de templates

`base.html` define la estructura raíz. Cada template hijo solo sobreescribe dos bloques:

```html
{% block content %}
  <!-- HTML de la página -->
{% endblock %}

{% block view_script %}nombre_del_script{% endblock %}
```

`base.html` construye automáticamente el `<script>` del view:

```html
<script type="module" src="/static/js/views/{% block view_script %}{% endblock %}.js"></script>
```

Para scripts inline adicionales (ej: pasar datos del servidor al JS), usar `{% block extra_scripts %}`:

```html
{% block extra_scripts %}
<script>window.__MI_VAR__ = "{{ valor_de_jinja }}";</script>
{% endblock %}
```

Actualmente `batch_detail.html` **no usa** `extra_scripts` — lee el `batch_id` del atributo `data-batch-id` del elemento `<main>`, que Jinja2 rellena directamente en el HTML:

```html
<main data-batch-id="{{ batch_id }}">
```

```js
// batch_detail.js
const batchId = document.querySelector("[data-batch-id]").dataset.batchId;
```

---

## Cómo funciona cada capa

### api.js

Añade automáticamente el JWT a todas las requests y gestiona errores globales:

```js
// JSON — Content-Type se añade automáticamente
request("/auth/login", { method: "POST", body: JSON.stringify({...}) })

// Multipart — FormData detectado, no añade Content-Type
request("/batches/", { method: "POST", body: formData })

// Descargar imagen (devuelve la Response sin parsear)
const res = await request("/edits/{id}/result");
const blob = await res.blob();
```

Si el servidor devuelve 401, `api.js` limpia el token y redirige a `/login` automáticamente.

---

### models/

Wrappers semánticos sobre `api.js`. No tienen estado. Ejemplo:

```js
// batchesApi.js
create: (files, prompt) => {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  fd.append("prompt", prompt);
  return request("/batches/", { method: "POST", body: fd });
}
```

```js
// editsApi.js — carga imagen autenticada y devuelve object URL para <img src>
fetchImageBlob: async (path) => {
  const res = await request(path);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
```

---

### viewmodels/

Clase base `ViewModel` con patrón observer:

```js
const vm = new EditorViewModel(20);

// subscribe llama fn inmediatamente con el estado actual
// y devuelve una función para cancelar la suscripción
const unsub = vm.subscribe(state => {
  // re-render reactivo
});

vm.setPrompt("make it vintage"); // → notifica a todos los listeners
```

**EditorViewModel** — gestiona la lista de archivos para el lote:

```js
vm.addFiles(fileList)     // acepta FileList del input o del drop
vm.removeFile(id)         // revoca el object URL (libera memoria)
vm.setPrompt(text)
vm.submit()               // POST /batches/ → redirige a /batch/{id}
```

**BatchProgressViewModel** — polling automático:

```js
const vm = new BatchProgressViewModel(batchId);
vm.start();   // poll inmediato + setInterval 1500ms
vm.stop();    // limpia el intervalo (se llama solo al completar)

// Se detiene automáticamente cuando status ∈ {completed, partial, failed}
window.addEventListener("beforeunload", () => vm.stop());
```

**HistoryViewModel** — lista paginada:

```js
const vm = new HistoryViewModel();
vm.load();   // GET /batches/?page=1&limit=20
```

---

### views/

Bootstrap mínimo: crear el VM, suscribir el render, bindear eventos del DOM.

Patrón de guarda de auth al inicio del módulo:

```js
import { getToken } from "../api.js";
if (!getToken()) { window.location = "/login"; throw new Error("auth"); }
```

El `throw` detiene la ejecución del módulo si no hay sesión, evitando efectos secundarios.

---

## Flujo de autenticación

```
1. Usuario escribe email + password en /login
2. login.js → AuthViewModel.login()
3. authApi.login() → POST /auth/login → recibe JWT
4. api.js: setToken(jwt) → sessionStorage["access_token"]
5. authApi.me() → GET /auth/me → confirma identidad
6. window.location = "/"
```

El token vive en `sessionStorage` — se borra al cerrar la pestaña. Para cerrar sesión explícitamente: `authApi.logout()` llama `clearToken()`.

---

## Flujo de subida de un lote

```
1. Usuario arrastra imágenes al drop zone
2. editor.js: vm.addFiles(e.dataTransfer.files)
3. EditorViewModel crea {id, file, previewUrl} por cada archivo
4. subscribe re-renderiza el grid de previews + contador
5. Usuario escribe el prompt → vm.setPrompt()
6. Click "Procesar lote" → vm.submit()
7. batchesApi.create(files, prompt) → POST /batches/ (responde en <200ms)
8. window.location = "/batch/" + batch.id
```

---

## Flujo de progreso del lote

```
1. /batch/{id} carga → batch_detail.js lee data-batch-id del DOM
2. BatchProgressViewModel.start() → poll inmediato + intervalo 1500ms
3. Cada poll: GET /batches/{id}/progress → actualiza barra + label
4. Mientras procesa: renderProcessing() — lista simple con badges
5. Al completar: batchesApi.get(id) → EditBatchDetailOut con jobs
6. renderGrid(batch.jobs):
   - completed + has_result: card before/after (imágenes con auth)
   - failed: card con error_message + botón Reintentar
7. Polling se detiene solo. vm.stop() también en beforeunload.
```

Las imágenes se cargan con `editsApi.fetchImageBlob()` que pasa el JWT en el header — el endpoint `/edits/{id}/result` requiere autenticación.

---

## Añadir una página nueva

1. Crear `app/templates/nueva.html` extendiendo `base.html`
2. Crear `app/static/js/views/nueva.js`
3. Añadir la ruta en `app/routers/pages.py`
4. Si la página requiere auth, añadir al inicio de `nueva.js`:

```js
import { getToken } from "../api.js";
if (!getToken()) { window.location = "/login"; throw new Error("auth"); }
```

5. Si necesita un nuevo endpoint de API, crear el model en `models/nuevaApi.js` importando solo de `api.js`

---

## Depurar en DevTools

**Network tab:**
- Filtrar por `Fetch/XHR` para ver solo las llamadas a la API
- `POST /batches/` debe responder en < 200 ms con status 201
- `GET /batches/{id}/progress` aparece cada 1.5 s; desaparece cuando el batch termina
- Las imágenes de resultado se cargan como `GET /edits/{id}/result` con header `Authorization`

**Console:**
- Cero errores en rojo es el objetivo
- Los errores de módulo (`Failed to load module`) indican un import roto — revisar rutas relativas (`../` vs `./`)

**Application → Session Storage:**
- `access_token` debe aparecer tras el login
- Borrarlo manualmente simula el logout y fuerza redirect a `/login`

**Sources tab:**
- Los ES modules se muestran como archivos individuales
- Se puede poner breakpoints directamente en `viewmodels/` y `views/`
