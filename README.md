# AI CREATURES 🥚✨

A tiny evolving creature that actually lives on your desktop.

**v0.3 personality** gives every Miko a persistent temperament that changes how it behaves.

## What already works

- Transparent, frameless Tauri desktop window
- Always-on-top creature window that stays out of the taskbar
- Creature wanders around the active monitor
- Mood/state machine: idle, curious, hungry, sleepy and happy
- Premium animated Miko: breathing, blinking, eye tracking, ear/tail motion and squash & stretch
- Six persistent personality archetypes: curious, affectionate, mischievous, glutton, shy and sleepy
- Personality changes movement, chatter, appetite, playfulness, bonding and autonomous actions
- Each Miko gets a small unique quirk and favorite snack
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
- LocalStorage for v0.3 state

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

### v0.4 — Life events
- Daily rhythm and real sleep/wake cycle
- Random discoveries and tiny events
- Small inventory and favorite objects
- Short event history

### v0.5 — AI Brain
- Ollama support
- Short and long-term memory
- Creature speech based on personality, not assistant behavior
- Optional cloud-model adapters

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
