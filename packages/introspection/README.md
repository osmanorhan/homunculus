# @homunculus/introspection

Phase 3 utilities for planning agent societies and detecting when a society has reached equilibrium. This package currently focuses on signal-based planning and a goal-satisfaction detector inspired by Minsky's difference engine.

## Features
- Signal society planner: emits a JSON plan describing agents to spawn for a given goal.
- Signal agent factory: materializes organic agents from a plan signal.
- Equilibrium detector: measures goal tension, momentum, coherence, and decision clarity to decide when thinking has converged.

## Exports
- `createSignalSocietyPlanner`
- `createSignalAgentFactory`
- `EquilibriumDetector`

## Usage

### Plan a signal society
```ts
import { createSignalSocietyPlanner } from '@homunculus/introspection';
import { LLMClient } from '@homunculus/semantic-engine';

const llm = new LLMClient({
  baseURL: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.LLM_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
});

const planner = createSignalSocietyPlanner({
  llm,
  maxAgents: 5,
  debug: true,
});

for await (const planSignal of planner.emit({
  id: 'goal-1',
  thought: 'Design an onboarding flow for a new developer tool.',
  emittedBy: 'user',
  timestamp: Date.now(),
})) {
  console.log(planSignal);
}
```

### Spawn agents from a plan
```ts
import { createSignalAgentFactory } from '@homunculus/introspection';
import { defineOrganicAgent } from '@homunculus/core';
import { LLMClient } from '@homunculus/semantic-engine';

const llm = new LLMClient({
  baseURL: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.LLM_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
});

const birth = (agent: ReturnType<typeof defineOrganicAgent>) => {
  // Register the agent in your biosphere.
  console.log('Born:', agent.id);
};

const factory = createSignalAgentFactory({ llm, birth, debug: true });

for await (const resultSignal of factory.emit({
  id: 'plan-1',
  thought: JSON.stringify({
    version: 'v1-signal',
    goal: 'Design an onboarding flow for a new developer tool.',
    agents: [
      {
        id: 'copy-guide',
        name: 'Copy Guide',
        receptor_patterns: ['copy', 'voice', 'microcopy'],
        threshold: 0.6,
        voice: 'Write crisp onboarding microcopy.',
      },
    ],
  }),
  emittedBy: 'planner',
  timestamp: Date.now(),
})) {
  console.log(resultSignal);
}
```

### Detect equilibrium
```ts
import { EquilibriumDetector } from '@homunculus/introspection';

const detector = new EquilibriumDetector({
  llm: {
    embed: async text => [],
    chat: async messages => 'A clear decision has been reached.',
  },
});

const state = await detector.detect('Decide launch plan', signals, agents);
console.log(state.atEquilibrium, state.reasoning);
```

## Notes
- The planner and factory are signal-first: they operate on `Signal.thought` strings and emit JSON payloads as signals.
- The equilibrium detector relies on LLM embeddings and chat to extract an ideal end state and compare it to recent signals.
