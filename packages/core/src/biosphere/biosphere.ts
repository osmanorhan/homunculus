/**
 * Biosphere: Agents communicate via semantic osmosis
 *
 * This is the biological approach to agent communication:
 * - Agents emit raw thoughts (natural language)
 * - Biosphere converts thoughts to pheromones (embeddings)
 * - Routes via semantic resonance (vector similarity)
 * - No JSON, no parsing, no errors
 *
 * Philosophy:
 * - Agents are neurons, not microservices
 * - Thoughts are action potentials, not packets
 * - Meaning emerges from resonance, not schema validation
 */

import type { Signal } from '../signal/signal.js';
import { defineMetaObserver, defineOrganicAgent, type OrganicAgent } from '../signal/organic-agent.js';
import { createSignal, resonates } from '../signal/signal.js';
import { cosineSimilarity } from '../signal/semantic-utils.js';
import { createSignalSynapse, type SignalSynapse } from '../synapse/signal-synapse.js';
import type { BiosphereEnvironment, EnvironmentSignal } from './environment.js';
export interface OrganicSpawner {
  seedFromGoal?(goal: string, existingAgents?: OrganicAgent[]): Promise<OrganicAgent[]>;
  spawnHelperForDistress(distressSignal: Signal, existingAgents?: OrganicAgent[]): Promise<OrganicAgent | null>;
  spawnBridgeAgent?(
    spec: BridgeAgentSpec,
    context: { signal: Signal; source: OrganicAgent; target: OrganicAgent; existingAgents: OrganicAgent[] },
  ): Promise<OrganicAgent | null>;
}

export interface BridgeAgentSpec {
  id: string;
  name: string;
  receptor_patterns: string[];
  threshold?: number;
  voice?: string;
}

export interface MetaObserverConfig {
  /**
   * Optional filter to decide whether a signal should be considered for distress.
   */
  shouldConsiderSignal?: (signal: Signal) => boolean;
}

export interface BiosphereConfig {
  /**
   * LLM client for embeddings and agent intelligence
   */
  llm: {
    embed(text: string): Promise<number[]>;
    chat(messages: Array<{ role: string; content: string }>): Promise<string>;
  };

  /**
   * Agent spawner for organic agent creation
   */
  spawner?: OrganicSpawner;

  /**
   * Observer for lifecycle events
   */
  observer?: BiosphereObserver;

  /**
   * Maximum ticks to run (default: infinite)
   */
  maxTicks?: number;

  /**
   * Delay between ticks in ms (default: 0)
   */
  tickDelay?: number;

  /**
   * Automatically birth a MetaObserver for distress detection
   */
  autoMetaObserver?: boolean;

  /**
   * Optional MetaObserver configuration (filters, etc.)
   */
  metaObserver?: MetaObserverConfig;

  /**
   * Optional environment that can emit reality feedback each tick.
   */
  environment?: BiosphereEnvironment;

  /**
   * Enable equilibrium detection (Minsky's Difference Engine)
   * When enabled, biosphere stops when goal tension is resolved
   */
  equilibriumDetection?: {
    enabled: boolean;
    detector?: any; // EquilibriumDetector instance
    scenario?: string; // Initial scenario for ideal state extraction
  };
}

export interface BiosphereObserver {
  onAgentBorn?(agent: OrganicAgent, tick: number): void;
  onSignalEmitted?(signal: Signal, tick: number): void;
  onSignalRouted?(signal: Signal, receivers: OrganicAgent[], tick: number): void;
  onAgentSpawned?(agent: OrganicAgent, trigger: Signal, tick: number): void;
}

export interface BiosphereState {
  tick: number;
  agents: Map<string, OrganicAgent>;
  signals: Signal[];
  receptorFieldCache: Map<string, number[]>;
  equilibrium?: {
    atEquilibrium: boolean;
    goalTension: number;
    momentum: number;
    coherence: number;
    decisionClarity: number;
    reasoning: string;
  };
}

/**
 * Biosphere: The semantic routing engine
 *
 * Agents emit natural language thoughts, biosphere routes via semantic osmosis:
 * - Agents emit natural language thoughts
 * - Biosphere embeds thoughts into vectors (pheromones)
 * - Routes via semantic similarity (cosine distance)
 * - Spawns agents organically in response to distress
 */
export class Biosphere {
  private readonly agents = new Map<string, OrganicAgent>();
  private readonly signalHistory: Signal[] = [];
  private readonly receptorFieldCache = new Map<string, number[]>();
  private readonly synapses = new Map<string, SignalSynapse>(); // Synaptic connections
  private readonly llm: BiosphereConfig['llm'];
  private readonly spawner?: OrganicSpawner;
  private readonly observer?: BiosphereObserver;
  private readonly maxTicks: number;
  private readonly tickDelay: number;
  private readonly environment?: BiosphereEnvironment;
  private readonly equilibriumConfig?: BiosphereConfig['equilibriumDetection'];
  private readonly birthQueue: Promise<void>[] = [];
  private seeded = false;
  private tick = 0;

  constructor(config: BiosphereConfig) {
    this.llm = config.llm;
    this.spawner = config.spawner;
    this.observer = config.observer;
    this.maxTicks = config.maxTicks ?? Number.POSITIVE_INFINITY;
    this.tickDelay = config.tickDelay ?? 0;
    this.environment = config.environment;
    this.equilibriumConfig = config.equilibriumDetection;

    if (config.autoMetaObserver !== false) {
      const meta = defineMetaObserver({ llm: this.llm, shouldConsiderSignal: config.metaObserver?.shouldConsiderSignal });
      this.birthQueue.push(this.birth(meta));
    }
  }

  /**
   * Birth an agent into the biosphere
   */
  async birth(agent: OrganicAgent): Promise<void> {
    this.agents.set(agent.id, agent);

    // Pre-compute receptor field embedding
    const receptorText = agent.receptorField.patterns.join('. ');
    const receptorVector = await this.llm.embed(receptorText);
    this.receptorFieldCache.set(agent.id, receptorVector);

    this.observer?.onAgentBorn?.(agent, this.tick);
  }

  /**
   * Death - remove an agent from the biosphere
   */
  death(agentId: string): void {
    this.agents.delete(agentId);
    this.receptorFieldCache.delete(agentId);
  }

  /**
   * Main lifecycle - agents emit and perceive in cycles
   */
  async *live(): AsyncGenerator<BiosphereState> {
    await this.flushBirthQueue();

    while (this.tick < this.maxTicks) {
      console.log(`\n=== Tick ${this.tick} - ${this.agents.size} agents ===`);

      // Let environment emit reality feedback before agents speak
      if (this.environment) {
        await this.emitEnvironmentSignals();
      }

      // Let all agents emit their thoughts (in parallel for speed)
      const emitPromises: Promise<void>[] = [];

      for (const agent of this.agents.values()) {
        const emitTask = (async () => {
          for await (const thought of agent.emit()) {
            await this.propagate(thought, agent);
          }
        })();
        emitPromises.push(emitTask);
      }

      // Wait for all agents to finish emitting this tick
      await Promise.all(emitPromises);

      console.log(`Tick ${this.tick} complete: ${this.signalHistory.length} total signals`);

      // Check equilibrium if enabled
      let equilibriumState;
      if (this.equilibriumConfig?.enabled && this.equilibriumConfig.detector && this.equilibriumConfig.scenario) {
        equilibriumState = await this.equilibriumConfig.detector.detect(
          this.equilibriumConfig.scenario,
          this.signalHistory,
          Array.from(this.agents.values()),
        );
      }

      // Emit state
      yield this.getState(equilibriumState);

      // Detect and intervene on stagnation
      if (equilibriumState?.isStagnant) {
        console.log(`\n⚠️  STAGNATION DETECTED - System appears deadlocked`);
        console.log(`Injecting intervention signal to force progress...\n`);

        await this.inject(
          [
            'SYSTEM INTERVENTION: The deliberation has reached a deadlock.',
            'You have been discussing the same issues without making progress.',
            'If you are waiting for information that does not exist, STATE clearly what is missing.',
            'Then make the BEST DECISION POSSIBLE with the information you currently have.',
            'Do not wait indefinitely. Decide based on available data and reasonable assumptions.',
          ].join(' '),
          'system',
        );

        // Continue one more round after intervention to see if it helps
        this.tick += 1;
        continue;
      }

      // Early exit if equilibrium reached
      if (equilibriumState?.atEquilibrium) {
        console.log(`\n═══════════════════════════════════════════════════════`);
        console.log(`EQUILIBRIUM REACHED: Difference engine satisfied`);
        console.log(`${equilibriumState.reasoning}`);
        console.log(`═══════════════════════════════════════════════════════\n`);
        break;
      }

      this.tick += 1;

      // Tick delay
      if (this.tickDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.tickDelay));
      }
    }
  }

  /**
   * Propagate a thought through the semantic space
   */
  private async propagate(thought: string, source: OrganicAgent): Promise<void> {
    await this.flushBirthQueue();

    // 1. Convert thought to pheromone (embedding)
    const pheromone = await this.llm.embed(thought);

    // 2. Create signal
    const signal: Signal = {
      ...createSignal({
        thought,
        emittedBy: source.id,
      }),
      pheromone,
    };

    this.signalHistory.push(signal);
    this.observer?.onSignalEmitted?.(signal, this.tick);

    // 3. Detect spawn intent semantically (not via magic string)
    const isSpawnIntent = await this.detectSpawnIntent(thought);
    if (isSpawnIntent) {
      await this.handleSpawnRequest(signal);
      return;
    }

    // 4. Find receivers via semantic resonance
    const receivers = await this.findResonance(signal);

    this.observer?.onSignalRouted?.(signal, receivers, this.tick);

    // 5. Propagate to receivers with adaptive coupling
    for (const receiver of receivers) {
      await this.propagateToReceiver(signal, source, receiver);
    }
  }

  /**
   * Emit signals produced by the environment (reality feedback).
   */
  private async emitEnvironmentSignals(): Promise<void> {
    const state = this.getState();
    let signals: EnvironmentSignal[] = [];

    try {
      signals = await this.environment!.tick(state);
    } catch (error) {
      console.error('Environment tick failed:', error);
      return;
    }

    for (const signal of signals) {
      await this.ingestEnvironmentSignal(signal);
    }
  }

  /**
   * Ingest an environment signal without synaptic coupling or bridging.
   */
  private async ingestEnvironmentSignal(signalInput: EnvironmentSignal): Promise<void> {
    const thought = signalInput.thought.trim();
    if (!thought) return;

    await this.flushBirthQueue();

    const pheromone = await this.llm.embed(thought);
    const signal: Signal = {
      ...createSignal({
        thought,
        emittedBy: signalInput.emittedBy ?? 'environment',
        inferredIntent: signalInput.inferredIntent,
        inferredTags: signalInput.inferredTags,
      }),
      pheromone,
    };

    this.signalHistory.push(signal);
    this.observer?.onSignalEmitted?.(signal, this.tick);

    const isSpawnIntent = await this.detectSpawnIntent(thought);
    if (isSpawnIntent) {
      await this.handleSpawnRequest(signal);
      return;
    }

    const receivers = await this.findResonance(signal);
    this.observer?.onSignalRouted?.(signal, receivers, this.tick);

    for (const receiver of receivers) {
      await receiver.perceive(signal);
    }
  }

  /**
   * Propagate signal to receiver with adaptive synaptic coupling
   *
   * Neuroscientific approach:
   * - Strong similarity (>0.8): Direct transmission (like gap junctions)
   * - Medium similarity (0.5-0.8): Synaptic transmission with adaptation
   * - Weak similarity (0.3-0.5): Spawn bridge agent (A → Bridge → B)
   * - Very weak (<0.3): No connection
   */
  private async propagateToReceiver(
    signal: Signal,
    source: OrganicAgent,
    receiver: OrganicAgent,
  ): Promise<void> {
    // Calculate semantic similarity
    const receiverVector = this.receptorFieldCache.get(receiver.id);
    if (!receiverVector) return;

    const similarity = cosineSimilarity(signal.pheromone, receiverVector);

    // Strong resonance: direct perception (no synapse needed)
    if (similarity > 0.8) {
      await receiver.perceive(signal);
      return;
    }

    // Medium resonance: synaptic transformation
    if (similarity > 0.5) {
      const synapse = await this.getOrCreateSynapse(source, receiver, similarity);
      const transformed = await synapse.transform(signal);
      await receiver.perceive(transformed);
      return;
    }

    // Weak resonance: need bridge agent
    if (similarity > 0.3) {
      await this.spawnBridgeAgent(signal, source, receiver, similarity);
      return;
    }

    // Too weak: no propagation
  }

  /**
   * Get existing synapse or create new one
   */
  private async getOrCreateSynapse(
    from: OrganicAgent,
    to: OrganicAgent,
    similarity: number,
  ): Promise<SignalSynapse> {
    const synapseId = `${from.id}→${to.id}`;

    // Return existing synapse
    if (this.synapses.has(synapseId)) {
      return this.synapses.get(synapseId)!;
    }

    // Create new synapse
    const synapse = createSignalSynapse({
      from: from.id,
      to: to.id,
      baseSimilarity: similarity,
      fromContext: from.receptorField.patterns,
      toContext: to.receptorField.patterns,
      llm: this.llm,
    });

    this.synapses.set(synapseId, synapse);
    console.log(
      `New synapse: ${from.name} → ${to.name} (similarity: ${similarity.toFixed(2)}, weight: ${synapse.getWeight().toFixed(2)})`,
    );

    return synapse;
  }

  /**
   * Find agents that resonate with this signal
   */
  private async findResonance(signal: Signal): Promise<OrganicAgent[]> {
    let receivers: OrganicAgent[] = [];

    for (const agent of this.agents.values()) {
      // Skip self
      if (agent.id === signal.emittedBy) continue;

      // Get cached receptor field embedding
      const receptorVector = this.receptorFieldCache.get(agent.id);
      if (!receptorVector) {
        console.warn(`No receptor field cached for agent ${agent.id}`);
        continue;
      }

      // Check resonance
      if (resonates(signal.pheromone, agent.receptorField, receptorVector)) {
        receivers.push(agent);
      }
    }

    // MINSKY'S AMBIENT AWARENESS:
    // If no strong resonance, find agents with weaker but meaningful connection
    // This prevents communication silos while maintaining specialization
    if (receivers.length === 0) {
      const ambientThreshold = 0.4; // Lower than default 0.6
      const maxAmbientReceivers = 3; // Limit to prevent exponential feedback
      const candidates: Array<{ agent: OrganicAgent; similarity: number }> = [];

      for (const agent of this.agents.values()) {
        if (agent.id === signal.emittedBy) continue;

        const receptorVector = this.receptorFieldCache.get(agent.id);
        if (!receptorVector) continue;

        const similarity = cosineSimilarity(signal.pheromone, receptorVector);
        if (similarity > ambientThreshold) {
          candidates.push({ agent, similarity });
        }
      }

      // Take top N most similar agents (prevent broadcasting to everyone)
      receivers = candidates
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxAmbientReceivers)
        .map(c => c.agent);

      if (receivers.length > 0) {
        console.log(`Ambient awareness: ${receivers.length} agents receiving signal (from ${candidates.length} candidates)`);
      }
    }

    return receivers;
  }

  /**
   * Handle spawn requests from MetaObserver
   */
  private async handleSpawnRequest(distressSignal: Signal): Promise<void> {
    if (!this.spawner) {
      console.warn('Spawn request received but no spawner configured');
      return;
    }

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`EMERGENCE: Generative spawn requested`);
    console.log(`Triggered by distress from: ${distressSignal.emittedBy}`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    try {
      const spawned = await this.spawner.spawnHelperForDistress(distressSignal, this.listAgents());
      if (!spawned) {
        console.warn('Spawner returned no helper agent');
        return;
      }

      // Built-in quorum: skip if we already have something similar
      const existing = await this.findSimilar(spawned.name);
      if (existing) {
        console.log(`Quorum: ${spawned.name} matches existing agent ${existing.name}, skipping spawn`);
        return;
      }

      // Birth into biosphere
      await this.birth(spawned);

      this.observer?.onAgentSpawned?.(spawned, distressSignal, this.tick);

      // Re-inject recent distress signals to spawned agent (semantic detection)
      const distressVector = await this.llm.embed('stuck, confusion, cannot proceed, contradiction, unable, conflicting');
      const recentDistress = this.signalHistory
        .filter(s => {
          const similarity = cosineSimilarity(s.pheromone, distressVector);
          return similarity > 0.7; // High semantic similarity to distress concepts
        })
        .slice(-3); // Last 3 distress signals

      for (const signal of recentDistress) {
        await spawned.perceive(signal);
      }
    } catch (error) {
      console.error('Failed to spawn helper agent:', error);
    }
  }

  /**
   * Inject an external signal into the biosphere
   */
  async inject(thought: string, sourceId = 'external'): Promise<void> {
    await this.flushBirthQueue();

    // Auto-seed initial agents from the first external signal
    if (!this.seeded && this.spawner) {
      await this.seedFromGoal(thought);
    }

    const pheromone = await this.llm.embed(thought);
    const signal: Signal = {
      ...createSignal({ thought, emittedBy: sourceId }),
      pheromone,
    };

    this.signalHistory.push(signal);
    this.observer?.onSignalEmitted?.(signal, this.tick);

    // Find receivers
    let receivers = await this.findResonance(signal);

    // External/system injections should bathe the whole society in context,
    // even if resonance is narrow. This guarantees initial scenarios reach everyone.
    const isExternal = sourceId === 'external' || sourceId === 'system';
    if (isExternal || receivers.length === 0) {
      receivers = this.listAgents().filter(agent => agent.id !== sourceId);
      if (receivers.length > 0) {
        console.log('Diffusion broadcast: delivering external signal to all agents');
      }
    }
    this.observer?.onSignalRouted?.(signal, receivers, this.tick);

    // Propagate
    for (const receiver of receivers) {
      await receiver.perceive(signal);
    }
  }

  /**
   * Get current state
   */
  private getState(equilibrium?: any): BiosphereState {
    return {
      tick: this.tick,
      agents: new Map(this.agents),
      signals: [...this.signalHistory],
      receptorFieldCache: new Map(this.receptorFieldCache),
      equilibrium,
    };
  }

  /**
   * Get signal history (for debugging)
   */
  getSignalHistory(): Signal[] {
    return [...this.signalHistory];
  }

  /**
   * Get all agents
   */
  getAgents(): Map<string, OrganicAgent> {
    return new Map(this.agents);
  }

  /**
   * Check if an agent of a specific type exists (for quorum sensing)
   * Uses semantic matching instead of string contains
   */
  async hasAgentType(agentType: string): Promise<boolean> {
    const targetVector = await this.llm.embed(agentType);

    for (const agent of this.agents.values()) {
      // Compare against agent name + receptor patterns
      const agentDescription = `${agent.name} ${agent.receptorField.patterns.join(' ')}`;
      const agentVector = await this.llm.embed(agentDescription);
      const similarity = cosineSimilarity(targetVector, agentVector);

      if (similarity > 0.75) {
        return true;
      }
    }

    return false;
  }

  /**
   * Seed initial agents from a goal/scenario using the generative spawner.
   */
  async seedFromGoal(goal: string): Promise<void> {
    if (!this.spawner?.seedFromGoal) return;
    const agents = await this.spawner.seedFromGoal(goal, this.listAgents());
    for (const agent of agents) {
      this.birthQueue.push(this.birth(agent));
    }
    await this.flushBirthQueue();
    this.seeded = true;
  }

  private async flushBirthQueue(): Promise<void> {
    if (this.birthQueue.length === 0) return;
    const tasks = [...this.birthQueue];
    this.birthQueue.length = 0;
    await Promise.all(tasks);
  }

  private listAgents(): OrganicAgent[] {
    return Array.from(this.agents.values());
  }

  private async findSimilar(name: string): Promise<OrganicAgent | undefined> {
    const targetVector = await this.llm.embed(name);

    let bestMatch: OrganicAgent | undefined;
    let bestSimilarity = 0;

    for (const agent of this.listAgents()) {
      // Compare against agent name + receptor patterns for semantic similarity
      const agentDescription = `${agent.name} ${agent.receptorField.patterns.join(' ')}`;
      const agentVector = await this.llm.embed(agentDescription);
      const similarity = cosineSimilarity(targetVector, agentVector);

      if (similarity > 0.75 && similarity > bestSimilarity) {
        bestMatch = agent;
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  /**
   * Spawn a bridge agent to connect two agents with weak resonance
   *
   * EMERGENT BRIDGING:
   * - LLM discovers what intermediate perspective would help
   * - Creates agent that resonates with BOTH source and target
   * - Forms cascade: A → Bridge → B (two synapses instead of one impossible one)
   *
   * Example:
   * - CEO (business language) → Bridge (translator) → Engineer (technical language)
   * - Bridge might be: "Product Manager" or "Technical Lead"
   */
  private async spawnBridgeAgent(
    signal: Signal,
    source: OrganicAgent,
    target: OrganicAgent,
    similarity: number,
  ): Promise<void> {
    if (!this.spawner) {
      console.log(
        `Bridge needed (${source.name} → ${target.name}, similarity: ${similarity.toFixed(2)}) but no spawner configured`,
      );
      return;
    }

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`BRIDGE NEEDED: Weak resonance detected`);
    console.log(`From: ${source.name} (${source.receptorField.patterns.join(', ')})`);
    console.log(`To: ${target.name} (${target.receptorField.patterns.join(', ')})`);
    console.log(`Similarity: ${similarity.toFixed(2)} (too weak for direct coupling)`);
    console.log(`Signal: "${signal.thought.slice(0, 100)}..."`);
    console.log(`═══════════════════════════════════════════════════════\n`);

    // Ask LLM what intermediate perspective would bridge the gap
    const bridgeSpec = await this.llm.chat([
      {
        role: 'system',
        content: [
          'You design bridge agents that connect incompatible perspectives.',
          '',
          'Given:',
          '- Source agent with specific vocabulary/concerns',
          '- Target agent with different vocabulary/concerns',
          '- A signal the target cannot understand',
          '',
          'Discover: What intermediate perspective would translate between them?',
          '',
          'The bridge agent should:',
          '- Resonate with BOTH source and target vocabularies',
          '- Act as semantic translator',
          '- Have natural expertise in both domains',
          '',
          'Examples:',
          '- CEO and Engineer: Product Manager (understands business + tech)',
          '- Musician and Physicist: Acoustician (understands harmony + waves)',
          '- Dreamer and Analyst: Psychologist (understands symbols + data)',
          '',
          'Return JSON with: id, name, receptor_patterns (covering both domains), voice',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Source: ${source.name}`,
          `Source concerns: ${source.receptorField.patterns.join(', ')}`,
          '',
          `Target: ${target.name}`,
          `Target concerns: ${target.receptorField.patterns.join(', ')}`,
          '',
          `Signal that cannot bridge:`,
          `"${signal.thought}"`,
          '',
          'What bridge agent would translate between these perspectives?',
          '',
          'Return JSON:',
          JSON.stringify({
            agent: {
              id: 'bridge-example',
              name: 'Bridge Example',
              receptor_patterns: ['source-vocab', 'target-vocab', 'bridging-concepts'],
              threshold: 0.5,
              voice: 'Describe expertise that spans both domains',
            },
          }),
        ].join('\n'),
      },
    ]);

    // Parse bridge spec
    try {
      const extracted = bridgeSpec.match(/```json\s*([\s\S]*?)\s*```/i)?.[1] || bridgeSpec;
      const parsed = JSON.parse(extracted) as { agent: BridgeAgentSpec };
      const blueprint = parsed.agent;

      if (!blueprint?.id || !Array.isArray(blueprint.receptor_patterns)) {
        console.warn('Invalid bridge spec from LLM');
        return;
      }

      // Check if similar bridge already exists (quorum sensing)
      const existing = await this.findSimilar(blueprint.name);
      if (existing) {
        console.log(`🔇 Bridge quorum: ${blueprint.name} matches existing ${existing.name}, skipping spawn`);
        return;
      }

      const bridge = this.spawner.spawnBridgeAgent
        ? await this.spawner.spawnBridgeAgent(blueprint, {
            signal,
            source,
            target,
            existingAgents: this.listAgents(),
          })
        : defineOrganicAgent({
            id: blueprint.id,
            name: blueprint.name,
            receptorField: {
              patterns: blueprint.receptor_patterns,
              threshold: blueprint.threshold ?? 0.5,
            },
            systemPrompt:
              blueprint.voice ??
              `You are ${blueprint.name}. You translate between ${source.name} and ${target.name} without losing meaning.`,
            llm: this.llm,
          });

      if (!bridge) {
        console.warn('Spawner failed to create bridge agent');
        return;
      }

      // Avoid duplicate ids
      if (this.agents.has(bridge.id)) {
        console.warn(`Bridge id already exists (${bridge.id}), skipping spawn`);
        return;
      }

      await this.birth(bridge);

      console.log(`\n Bridge spawned: ${bridge.name}`);
      console.log(`   Connects: ${source.name} ↔ ${bridge.name} ↔ ${target.name}`);
      console.log(`   Cascade: Two synapses instead of one impossible synapse\n`);

      // Inject signal into bridge (it will naturally propagate to target)
      await bridge.perceive(signal);
    } catch (error) {
      console.error('Failed to spawn bridge agent:', error);
    }
  }

  /**
   * Detect spawn intent semantically via embedding similarity
   *
   * TASK-AGNOSTIC EMERGENCE: Uses semantic vectors, not keyword matching.
   * Works across any domain - business, music, dreams, science.
   *
   * Intent examples:
   * - "Perhaps spawning a mediator would help"
   * - "We need a different perspective here"
   * - "A risk analyst viewpoint would resolve this"
   * - "This needs someone who understands harmonics"
   */
  private async detectSpawnIntent(thought: string): Promise<boolean> {
    // Embed the thought
    const thoughtVector = await this.llm.embed(thought);

    // Reference spawn intent patterns (semantic anchors)
    const spawnIntentAnchors = [
      'We need to spawn a helper agent',
      'Perhaps spawning a new perspective would help',
      'This situation requires a specialized agent',
      'A helper with specific expertise would resolve this',
    ];

    // Check semantic similarity to spawn intent
    for (const anchor of spawnIntentAnchors) {
      const anchorVector = await this.llm.embed(anchor);
      const similarity = cosineSimilarity(thoughtVector, anchorVector);

      // High similarity = spawn intent detected
      if (similarity > 0.75) {
        console.log(`Spawn intent detected (similarity: ${similarity.toFixed(2)} to "${anchor}")`);
        return true;
      }
    }

    return false;
  }
}
