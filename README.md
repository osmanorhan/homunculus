# homunculus - experimental framework

> **The Analogy Engine** - Self-organizing cognitive architecture where agents think like minds actually think

Signal-based agent framework where agents communicate via natural language thoughts routed through semantic resonance. No JSON, no schemas, no typed messages - just thoughts diffusing through a semantic space.

## Core Insight

> Intelligence isn't optimization. It's **felt resonance** between patterns. (Hofstadter)

## Architecture

Agents emit natural language thoughts
Biosphere routes via semantic similarity
Agents perceive and respond
System spawns helpers when stuck

```typescript
const biosphere = new Biosphere({
  llm,
  spawner: new GenerativeSpawner({ llm }),
  autoMetaObserver: true,  // Enables distress detection & agent spawning
});

await biosphere.inject('CEO scenario: launch in 48h, data leak found, $2M ad already running');

for await (const state of biosphere.live()) {
  console.log(`Tick ${state.tick}: ${state.agents.size} agents`);

  // System spawns agents organically when stuck
  if (state.equilibrium?.atEquilibrium) {
    console.log('Goal resolved!');
    break;
  }
}
```

## Packages

- `@homunculus-live/core` - Signal (natural language thoughts), OrganicAgent, Biosphere, SignalSynapse, GenerativeSpawner
- `@homunculus-live/semantic-engine` - LLM client (chat/embed)
- `@homunculus-live/primitives` - SignalIntentAnalyzer
- `@homunculus-live/introspection` - Signal society planning

## Quick Start

```bash
pnpm install
pnpm -r build

# Run CEO emergence example
cd examples/basic
export LLM_BASE_URL=http://localhost:11434/v1  # Ollama
export LLM_MODEL=qwen3:14b
pnpm start
```


## Status

- ✅ Phase 1: Signal Foundation (COMPLETE)
- ✅ Phase 2: SignalSynapse Layer (COMPLETE)
- ✅ Phase 3: Bridge Agent Spawning (COMPLETE)
- 🔄 Phase 4: Learning & Intuition (Next)
