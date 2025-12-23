# @homunculus-live/primitives

Primitive building blocks for homunculus. This package currently ships a single agent: the signal intent analyzer.

## Agents

- **SignalIntentAnalyzer**: consumes raw signals (thought text) and emits a clarified natural-language intent summary.

## Usage

```ts
import { createSignalIntentAnalyzer } from '@homunculus-live/primitives';
import { LLMClient } from '@homunculus-live/semantic-engine';

const llm = new LLMClient({ baseURL: process.env.LLM_BASE_URL!, apiKey: process.env.LLM_API_KEY!, model: process.env.LLM_MODEL! });

const analyzer = createSignalIntentAnalyzer({ llm, debug: false });
```

Wire it into a `Biosphere` and let synapses form automatically.

## Scripts
- `pnpm build`
- `pnpm test`

## Notes
- The analyzer expects thought text and responds with a short natural-language intent summary.
