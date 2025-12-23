import {
  Biosphere,
  type BiosphereObserver,
  FrameRegistry,
  FrameSpawner,
  MotorSkillRegistry,
  type MotorSkill,
  type SkillPolicy,
} from '@homunculus/core';
import { LLMClient } from '@homunculus/semantic-engine';

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://192.168.1.105:11434/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen3:14b';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

const echoSkill: MotorSkill<string, string> = {
  id: 'echo',
  name: 'Echo',
  description: 'Returns input as-is.',
  async execute(input) {
    return input;
  },
};

const policy: SkillPolicy = {
  canExecute(context) {
    if (typeof context.input === 'string' && context.input.includes('approved')) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'requires approval token' };
  },
};

async function main() {
  const llm = new LLMClient({
    baseURL: LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'x',
    model: LLM_MODEL,
    embeddingModel: EMBEDDING_MODEL,
  });

  const frameRegistry = new FrameRegistry({ embed: llm.embed.bind(llm), minSimilarity: 0.1 });
  await frameRegistry.register({
    id: 'frame-specifier',
    description: 'Used at the start of a task to clarify requirements',
    systemPromptTemplate: 'You are a specifier. Task: ${goal}. Ask for missing details.',
    receptorPatterns: ['requirements', 'clarify', 'scope'],
    slots: {
      goal: { description: 'User task goal', required: true },
    },
  });

  await frameRegistry.register({
    id: 'frame-debugger',
    description: 'Used when tests are failing or logs are cryptic',
    systemPromptTemplate: 'You are a debugger. Error: ${error_message}. Suggest a next step.',
    receptorPatterns: ['error', 'fail', 'stacktrace', 'tests'],
    requiredMotorSkills: ['echo'],
    slots: {
      error_message: { description: 'Observed error output', required: true },
    },
  });

  const skillRegistry = new MotorSkillRegistry();
  skillRegistry.register(echoSkill);

  const spawner = new FrameSpawner({
    llm: { chat: llm.chat.bind(llm) },
    frameRegistry,
    skillRegistry,
    skillPolicy: policy,
    fillSlots: (frame, context) => {
      if (frame.id === 'frame-specifier') {
        return { goal: context.goal ?? 'unknown' };
      }
      if (frame.id === 'frame-debugger') {
        return { error_message: context.distressSignal?.thought ?? 'unknown error' };
      }
      return {};
    },
  });

  const observer: BiosphereObserver = {
    onAgentBorn(agent) {
      console.log(`Agent born: ${agent.name} (${agent.id})`);
    },
    onSignalEmitted(signal, tick) {
      console.log(`Tick ${tick} signal: ${signal.emittedBy} -> ${signal.thought}`);
    },
  };

  const biosphere = new Biosphere({
    llm: { chat: llm.chat.bind(llm), embed: llm.embed.bind(llm) },
    spawner,
    observer,
    maxTicks: 3,
    metaObserver: {
      shouldConsiderSignal: signal => signal.emittedBy === 'user' || signal.emittedBy === 'external',
    },
  });

  const goal = 'Clarify requirements for a login bug fix';
  await biosphere.inject(goal, 'user');

  await biosphere.inject(
    'I cannot proceed, tests are failing with a stacktrace. Perhaps spawning a helper would help.',
    'user',
  );

  let spawnedAgent;
  for await (const state of biosphere.live()) {
    spawnedAgent = Array.from(state.agents.values()).find(agent => agent.name === 'frame-debugger');
  }

  if (!spawnedAgent) {
    console.log('No debugger agent found.');
    return;
  }

  console.log(`Spawned agent: ${spawnedAgent.id}`);
  console.log(`Motor skills: ${spawnedAgent.motorSkills.map(skill => skill.id).join(', ')}`);

  const skill = spawnedAgent.motorSkills[0];
  if (!skill) return;

  try {
    await skill.execute('hello');
  } catch (error) {
    console.log(`Blocked as expected: ${(error as Error).message}`);
  }

  const result = await skill.execute('approved: hello');
  console.log(`Allowed result: ${result}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
