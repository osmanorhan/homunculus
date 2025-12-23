# @homunculus-live/core

Core primitives for the homunculus biological agent framework: organic agents, signals, synapses, and the biosphere router.

## Install
```bash
pnpm add @homunculus-live/core
```

## Quick start
```ts
import { Biosphere, defineOrganicAgent } from '@homunculus-live/core';
import { LLMClient } from '@homunculus-live/semantic-engine';

const llm = new LLMClient({
  baseURL: process.env.LLM_BASE_URL!,
  apiKey: process.env.LLM_API_KEY!,
  model: process.env.LLM_MODEL!,
});

const biosphere = new Biosphere({ llm });

const producer = defineOrganicAgent({
  id: 'producer',
  name: 'DataProducer',
  receptorField: {
    patterns: ['start', 'generate data'],
    threshold: 0.6,
  },
  systemPrompt: 'You generate random numbers when asked.',
  llm,
  async *emit() {
    yield `I generated a random number: ${Math.random()}`;
  },
});

const consumer = defineOrganicAgent({
  id: 'consumer',
  name: 'DataConsumer',
  receptorField: {
    patterns: ['random number', 'generated data'],
    threshold: 0.6,
  },
  systemPrompt: 'You acknowledge receiving data.',
  llm,
});

await biosphere.birth(producer);
await biosphere.birth(consumer);

await biosphere.inject('please generate some data');

for await (const state of biosphere.live()) {
  console.log(`Tick ${state.tick}: ${state.signals.length} signals`);
  if (state.tick >= 3) break;
}
```

## Key ideas
- **Signal**: Natural language thought + `pheromone` embedding for routing.
- **OrganicAgent**: Perceives signals and emits thoughts via LLM.
- **ReceptorField**: Natural language patterns an agent resonates with.
- **SignalSynapse**: Adaptive coupling that transforms signals across vocabularies.
- **Biosphere**: Embeds thoughts, routes via semantic resonance, and can spawn helpers.

## Exports
- `Biosphere`, `OrganicAgent`, `defineOrganicAgent`, `defineMetaObserver`
- `Signal`, `ReceptorField`, `createSignal`, `resonates`
- `SignalSynapse`, `createSignalSynapse`, `SynapticStrength`

## Notes
- ESM only; TypeScript declarations included.
- Pair with `@homunculus-live/semantic-engine` for embeddings and chat.
