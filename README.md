# AI CREATURES 🥚✨

A tiny evolving creature that actually lives on your desktop.

**v0.6 evolution** lets Miko permanently change form according to the life it has actually lived.

## What already works

- Transparent, frameless Tauri desktop window
- Always-on-top creature window that stays out of the taskbar
- Creature wanders around the active monitor
- Mood/state machine: idle, curious, hungry, sleepy and happy
- Premium animated Miko: breathing, blinking, eye tracking, ear/tail motion and squash & stretch
- Six persistent personality archetypes: curious, affectionate, mischievous, glutton, shy and sleepy
- Personality changes movement, chatter, appetite, playfulness, bonding and autonomous actions
- Each Miko gets a small unique quirk and favorite snack
- Real local-time rhythm: morning, day, evening and night
- Autonomous treasure discoveries with common, unusual, rare and mystery items
- Persistent 10-item collection and a short life journal
- Return moments are recorded when you come back after being away
- Brain modes: Local, Auto, Hermes Agent and Ollama
- Hermes status check via the gateway API
- Automatic Hermes → Ollama fallback
- Stable Hermes session key for future long-term memory
- AI reactions use Miko's personality, stats, time, treasures and recent journal
- Direct mini-chat with Miko from the desktop panel
- Hermes model discovery through `/v1/models` so named profiles work cleanly
- Hidden evolution progression driven by level, bond, care history, personality and treasures
- Five normal evolution species plus one secret portal evolution
- Every evolved form has a visual identity and a gameplay passive
- Evolution is permanent and recorded in Miko's life journal
- Interaction effects: hearts, crumbs, stars and sleep particles
- Hunger, energy, happiness, bond, XP and levels
- Feed, play, pet and sleep interactions
- Local persistence between sessions
- Offline progress while the app is closed
- Browser fallback for frontend development
- GitHub Actions CI for every push and pull request

## Stack

- Tauri 2 / Rust
- React 19 + TypeScript
- Vite
- LocalStorage for creature state + Tauri app config for brain settings

The creature simulation stays fully functional without AI. Ollama and Hermes are optional brain providers.

## Run on Windows

### Requirements

1. Node.js 20+
2. Rust stable via rustup
3. Microsoft C++ Build Tools / Visual Studio Build Tools with **Desktop development with C++**
4. WebView2 Runtime (normally already installed on Windows 10/11)

### Start

```bash
npm install
npm run tauri dev
```

Frontend only:

```bash
npm install
npm run dev
```

## Controls

- Click creature: pet it
- Right click: open/close creature menu
- Double click: open/close menu

## Visual personality

Miko is currently a soft alien/slime creature with:

- reactive eyes that follow the pointer
- autonomous blinking and ear movement
- glowing antenna and belly
- animated tail
- squash-and-stretch reactions
- contextual particles for petting, eating, playing and sleeping

## Evolution

Miko does not evolve from a menu. The game scores how it has been raised and chooses the form that best matches its life.

Known forms:

- **Lumiko** — affectionate light form
- **Voltik** — energetic play form
- **Mossling** — calm nature/collector form
- **Noctiko** — lunar sleep form
- **Berryn** — food-loving form
- **Riftling** — secret anomaly linked to the portal shard

The exact scoring weights are intentionally not shown in the UI. A **Resonance** meter hints at evolution readiness without revealing the winning route.

Each form changes both appearance and behavior: bonding, play rewards, food effects, sleep recovery, happiness decay, movement or treasure discovery.

## Roadmap

### v0.7 — Ecosystem
- Multiple creatures
- Relationships
- Rivalry / friendship
- Breeding and inherited traits
- Cross-monitor travel

## Design principle

This is a **game that happens on your desktop**, not a productivity assistant with a mascot.


## Hermes Agent

AI Creatures can use Hermes Agent as Miko's optional brain.

Enable the Hermes API server in `~/.hermes/.env`:

```env
API_SERVER_ENABLED=true
API_SERVER_KEY=choose-a-local-key
```

Start Hermes:

```bash
hermes gateway
```

Then open **Miko → Cerebro**, choose **Hermes** or **Auto**, keep the default endpoint:

```text
http://127.0.0.1:8642/v1
```

and enter the same `API_SERVER_KEY`.

**Auto mode** tries Hermes first, then Ollama, then Miko continues with its built-in local behavior if neither provider is available.

For Ollama, the default endpoint is:

```text
http://127.0.0.1:11434/v1
```

The default model field is `qwen3.5:latest`, but it can be changed from Miko's brain panel.

### Hermes tool safety

Hermes' API server is a full agent runtime and can expose terminal, file, web and other tools. AI Creatures therefore checks Hermes' authenticated `/v1/toolsets` endpoint before using it.

By default:

- Hermes with **0 enabled toolsets** can be used as Miko's brain.
- Hermes with **active toolsets** is blocked.
- In **Auto** mode, a blocked/unavailable Hermes falls back to Ollama.
- The brain panel has an explicit advanced switch if you intentionally want to allow a tool-enabled Hermes instance.

For a dedicated Miko-only Hermes profile, configure the API-server platform with no tools and restart the gateway:

```yaml
platform_toolsets:
  api_server: []
```

You can verify what the running API server exposes with:

```bash
curl http://127.0.0.1:8642/v1/toolsets \
  -H "Authorization: Bearer $API_SERVER_KEY"
```

AI Creatures also sends a stable `X-Hermes-Session-Key` so Hermes memory providers can keep Miko's memory scope consistent between turns.
