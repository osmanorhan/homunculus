# @homunculus/primitives

Built-in primitive agents for homunculus to quickly assemble simple societies without custom wiring.

## Agents

- **SeeAgent**: receives `input` signals and emits normalized `perception` signals.
- **RememberAgent**: stores incoming `remember` signals into a memory store and emits `memory-stored` acks. Returns `{ agent, store }` so you can pair with RecallAgent.
- **RecallAgent**: on `recall` stimuli, emits the latest `memory` from the shared store.
- **ThinkAgent**: uses an injected `LLMClient` to transform stimuli with a prompt; emits `thought` signals (natural language).
- **SpeakAgent**: consumes `thought` signals, emits `utterance`, and calls an optional `onSpeak` callback.

## Usage

```ts
import { createSeeAgent, createRememberAgent, createRecallAgent, createThinkAgent, createSpeakAgent } from '@homunculus/primitives';
import { LLMClient } from '@homunculus/semantic-engine';

const llm = new LLMClient({ baseURL: process.env.LLM_BASE_URL!, apiKey: process.env.LLM_API_KEY!, model: process.env.LLM_MODEL! });

const seer = createSeeAgent({ tags: ['data'] });
const { agent: remember, store } = createRememberAgent({ tags: ['data'] });
const recall = createRecallAgent({ store, tags: ['data'] });
const thinker = createThinkAgent({ llm, prompt: 'Summarize briefly', tags: ['data'] });
const speaker = createSpeakAgent({ onSpeak: console.log });
```

Wire them into a `Biosphere` and let synapses form automatically.

## Scripts
- `pnpm build`
- `pnpm test`

## Notes
- No multimodal inputs yet; payloads are treated as `unknown` and passed through for transformation.
- ThinkAgent relies on `LLMClient.transform`; supply a provider-compatible client.
