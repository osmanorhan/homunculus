# @homunculus/semantic-engine

Provider-agnostic LLM client + semantic distance utilities for homunculus.

## Install
```bash
pnpm add @homunculus/semantic-engine
```

## LLM Client
```ts
import { LLMClient } from '@homunculus/semantic-engine';

const llm = new LLMClient({
  baseURL: process.env.LLM_BASE_URL!,
  apiKey: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL!, // chat/transform model
  embeddingModel: process.env.LLM_EMBED_MODEL, // optional override
});

const vector = await llm.embed('hello world');
const reply = await llm.chat([{ role: 'user', content: 'Say hi' }]);
const transformed = await llm.transform('Reformat JSON', { foo: 'bar' });
```

## Semantic Distance
```ts
import { calculateSemanticDistance } from '@homunculus/semantic-engine';
import { createEmitter, createReceptor } from '@homunculus/core';

const emitter = createEmitter({ intent: 'numbers', tags: ['data'] });
const receptor = createReceptor({ desire: 'numbers', tags: ['data'] });
const distance = await calculateSemanticDistance(emitter, receptor, llm, {
  tagWeight: 0.4,
  skipEmbeddings: true,
});
```

### Behavior
- Combines tag overlap and cosine similarity of embeddings.
- Embeddings are fetched lazily via `LLMClient.embed` and cached on signatures.
- `skipEmbeddings` forces tag-only distance (recommended for low-cost matching).
- Weighted blend defaults: tagWeight=0.4, embeddingWeight=0.6.

## Notes
- ESM only, TypeScript declarations included.
- OpenAI-compatible endpoints (OpenAI, Anthropic-compatible, local) via `baseURL`.
