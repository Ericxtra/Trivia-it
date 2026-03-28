# 🛠️ Trivia IT Soporte — Guía de Deploy en Netlify

## Requisitos previos
- Cuenta gratuita en [netlify.com](https://netlify.com)
- Cuenta gratuita en [console.anthropic.com](https://console.anthropic.com) (para la API key)

---

## Paso 1 — Obtén tu API Key de Anthropic

1. Entra a https://console.anthropic.com
2. Ve a **API Keys** → **Create Key**
3. Copia la clave (empieza con `sk-ant-...`)
4. Guárdala, la necesitarás en el Paso 3

---

## Paso 2 — Sube el proyecto a Netlify

### Opción A: Arrastra y suelta (más fácil, sin cuenta de GitHub)

1. Entra a https://app.netlify.com
2. En tu dashboard, busca el área que dice **"drag and drop your site folder here"**
3. **Primero** debes hacer el build local:
   ```
   npm install
   npm run build
   ```
4. Arrastra la carpeta `build/` generada a Netlify
5. Netlify le asignará una URL automáticamente

### Opción B: Conecta con GitHub (recomendada para actualizaciones)

1. Sube esta carpeta a un repositorio de GitHub
2. En Netlify: **Add new site → Import an existing project**
3. Conecta tu repositorio
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`

---

## Paso 3 — Agrega tu API Key como variable de entorno

> ⚠️ IMPORTANTE: Sin este paso el juego no generará preguntas.

1. En Netlify, ve a tu sitio → **Site configuration → Environment variables**
2. Haz clic en **Add a variable**
3. Agrega:
   - **Key:** `REACT_APP_ANTHROPIC_KEY`
   - **Value:** tu clave `sk-ant-...`
4. Guarda y haz **redeploy** (Deploys → Trigger deploy)

---

## Paso 4 — ¡Comparte el link!

Tu app estará en una URL como:
```
https://trivia-it-soporte.netlify.app
```

Puedes personalizar el nombre del subdominio en:
**Site configuration → General → Site details → Change site name**

---

## Notas

- La tabla de resultados se guarda en el navegador de cada dispositivo (localStorage).
  Si quieres una tabla **compartida entre todos**, necesitas un backend (Firebase, Supabase, etc.) — avísale a Claude y te ayuda con eso.
- El juego funciona en móvil y desktop.
- Para agregarlo como acceso directo en iPhone/Android: abre el link en el navegador → "Agregar a pantalla de inicio".
