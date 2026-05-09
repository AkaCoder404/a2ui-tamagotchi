# A2UI Tamagotchi

## One-sentence pitch
A Tamagotchi-style virtual pet where **every screen update is generated as A2UI JSON** by an LLM and rendered by a protocol-driven UI runtime (not hardcoded React screens).

## Short description (and why it’s generative UI)
This project is a **protocol-native** virtual pet:

- The backend runs deterministic game logic (stats, mood, unlocks), then calls Gemini to generate a **declarative A2UI message stream** (`surfaceUpdate`, `dataModelUpdate`, `beginRendering`).
- The frontend is an **A2UI renderer** that takes those messages and renders the scene using a component registry (including custom components like `scene`, `pet-avatar`, `thought-bubble`, `stat-bars`, `action-palette`, `inventory-slot`).

Why it’s generative UI (not “a chatbot in a trench coat”):

- The model is not returning chat text to be shown in a fixed UI; it’s producing **UI structure + props** as a protocol payload.
- The UI “shape” can change per state/action (components, layout, visuals), and the client simply **renders what the protocol describes**.
- Updates are streamed over SSE so the UI can progressively transition from “thinking…” to the final generated scene.

## Link to public GitHub repo
`https://github.com/AkaCoder404/a2ui-tamagotchi`

## Link to 2–3 minute demo video
Youtube: https://meet.google.com/qtc-jzmx-vui


## Protocols used
- **A2UI**: declarative UI messages (`surfaceUpdate`, `dataModelUpdate`, `beginRendering`)
- **SSE (Server-Sent Events)**: streaming the A2UI message sequence from backend to frontend
- **Google Gemini (Generative Language API)**: generates the A2UI JSON scenes

## Run locally
### Backend (Express + SSE)
```bash
export GEMINI_API_KEY="xxx"
npm run server
```

### Frontend (Vite + React)
```bash
npm run dev
```

Then open `http://localhost:5173`.