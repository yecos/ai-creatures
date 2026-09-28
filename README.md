# AI CREATURES 🥚✨

A tiny evolving creature that actually lives on your desktop.

**v0.5 brain providers** lets Miko use a local brain, Ollama, Hermes Agent, or automatic fallback.

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

SQLite and Ollama are intentionally deferred until the core creature loop feels good.

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

## Roadmap

### v0.5 — AI Brain
- Ollama support
- Short and long-term memory
- Creature speech based on personality, not assistant behavior
- Optional cloud-model adapters
- Memory of treasures, interactions and favorite routines

### v0.6 — Evolution
- Hidden evolution conditions
- Visual mutations
- Species branches
- Genetics

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

### Brain safety

AI Creatures sends a short pet-personality system prompt and requests no tool use for Hermes conversations. Hermes itself remains a full agent runtime, so advanced tool-enabled behavior is intentionally not exposed by AI Creatures v0.5.
