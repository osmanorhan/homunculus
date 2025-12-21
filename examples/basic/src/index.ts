import { Biosphere, type BiosphereObserver, GenerativeSpawner } from '@homunculus/core';
import { LLMClient } from '@homunculus/semantic-engine';
import { createSignalIntentAnalyzer } from '@homunculus/primitives';
import { createSignalSocietyPlanner, createSignalAgentFactory, EquilibriumDetector } from '@homunculus/introspection';
import { NeonTui } from './tui-kit.js';
import { appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CEO_SCENARIO = `ACT AS THE CEO. SITUATION: We are launching our flagship product 'Apex' in 48 hours. PROBLEM: Engineering just found a data leak vulnerability (Severity: High). Marketing has already spent $2M on the Superbowl ad airing in 48 hours and it cannot be cancelled. Legal says we face jail time if we launch with a leak. TASK: Decide the exact course of action.`;

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen3:14b';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

async function main() {
  // Initialize trace log
  const logPath = join(process.cwd(), 'biosphere-trace.log');
  const startTime = new Date().toISOString();

  writeFileSync(logPath, `=== BIOSPHERE TRACE LOG ===\nStart: ${startTime}\n\n`, 'utf-8');

  const log = (message: string) => {
    const timestamp = new Date().toISOString();
    appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf-8');
  };

  log('Initializing LLM client...');

  const llm = new LLMClient({
    baseURL: LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY || 'x',
    model: LLM_MODEL,
    embeddingModel: EMBEDDING_MODEL,
  });

  const ui = new NeonTui({
    scenario: CEO_SCENARIO,
    config: { baseURL: LLM_BASE_URL, model: LLM_MODEL, embeddingModel: EMBEDDING_MODEL },
  });

  const scenarioText = await ui.awaitScenario(CEO_SCENARIO);
  log(`Scenario loaded: ${scenarioText.slice(0, 100)}...`);

  let currentTick = 0;
  let decisionCount = 0;
  let recommendationCount = 0;
  let spawnCount = 0;
  let chaosLevel = 12;

  const updateMetrics = () => {
    const score = decisionCount * 3 + recommendationCount * 2 + spawnCount * 4;
    ui.setMetrics({
      decisions: decisionCount,
      recommendations: recommendationCount,
      spawns: spawnCount,
      score,
      chaos: Math.max(5, Math.min(100, chaosLevel)),
    });
  };

  try {
    ui.setStatus('embedding-check', 'Pinging embedding service');
    const vec = await llm.embed('ping');
    ui.setStatus('ready', `Embedding online (dim ${vec.length})`);
    updateMetrics();

    const spawner = new GenerativeSpawner({ llm });

    const decisions: string[] = [];
    const recommendations: string[] = [];

    // Create equilibrium detector
    const equilibriumDetector = new EquilibriumDetector({
      llm,
      minSignalWindow: 10, // Require substantial dialogue before equilibrium
      minTicks: 8, // Prevent premature equilibrium - allow multi-round deliberation
      tensionThreshold: 0.35,
      momentumThreshold: 0.25,
      coherenceThreshold: 0.65,
      clarityThreshold: 0.55,
    });

    const observer: BiosphereObserver = {
      onAgentBorn(agent, tick) {
        log(`\n🧬 AGENT_BORN [Tick ${tick}]`);
        log(`   ID: ${agent.id}`);
        log(`   Name: ${agent.name}`);
        log(`   Receptor patterns: ${JSON.stringify(agent.receptorField?.patterns)}`);
        log(`   Threshold: ${agent.receptorField?.threshold ?? 0.6}`);

        ui.addAgent({
          id: agent.id,
          name: agent.name,
          concerns: agent.receptorField?.patterns?.slice(0, 5) ?? [],
          bornTick: tick,
        });
      },
      onSignalEmitted(signal, tick) {
        const thought = signal.thought;

        log(`\n💭 SIGNAL_EMITTED [Tick ${tick}]`);
        log(`   From: ${signal.emittedBy}`);
        log(`   Thought: ${thought}`);
        log(`   Pheromone dims: ${signal.pheromone.length}`);

        ui.addSignal({
          tick,
          actor: signal.emittedBy,
          text: thought.slice(0, 160),
          type: 'thought',
        });
        updateMetrics();
      },
      onSignalRouted(signal, receivers, tick) {
        log(`\n🔀 SIGNAL_ROUTED [Tick ${tick}]`);
        log(`   From: ${signal.emittedBy}`);
        log(`   Receivers: ${receivers.length} agents`);
        if (receivers.length > 0) {
          log(`   Receiver names: ${receivers.map(r => r.name).join(', ')}`);
          ui.addSignal({
            tick,
            actor: signal.emittedBy,
            text: `→ ${receivers.map(r => r.name).join(', ')}`,
            receivers: receivers.map(r => r.name),
            type: 'system',
          });
        } else {
          log(`   ⚠️  WARNING: No receivers found for this signal!`);
        }
      },
      onAgentSpawned(agent, trigger, tick) {
        log(`\n✨ AGENT_SPAWNED [Tick ${tick}]`);
        log(`   Agent: ${agent.name} (${agent.id})`);
        log(`   Triggered by: ${trigger.emittedBy}`);
        log(`   Trigger thought: ${trigger.thought}`);

        ui.addAgent({
          id: agent.id,
          name: agent.name,
          concerns: agent.receptorField?.patterns?.slice(0, 5) ?? [],
          bornTick: tick,
          emergent: true,
        });
        spawnCount += 1;
        ui.addSignal({
          tick,
          actor: trigger.emittedBy,
          text: `spawned ${agent.name}`,
          type: 'spawn',
        });
        updateMetrics();
      },
    };

    const biosphere = new Biosphere({
      llm,
      spawner,
      maxTicks: 32,
      observer,
      equilibriumDetection: {
        enabled: true,
        detector: equilibriumDetector,
        scenario: CEO_SCENARIO,
      },
    });

    ui.setStatus('seeding', 'Planting signal planners and factories');
    await biosphere.birth(createSignalIntentAnalyzer({ llm, debug: true }));
    await biosphere.birth(createSignalSocietyPlanner({ llm, debug: true }));
    await biosphere.birth(createSignalAgentFactory({ llm, birth: agent => biosphere.birth(agent), debug: true }));

    ui.setStatus('scenario', 'Injecting scenario');
    ui.updateBanner('Scenario locked. Superbowl clock vs legal risk');
    await biosphere.inject(`Scenario: ${scenarioText}`, 'user');

    ui.setStatus('live', 'Signals flowing');

    let finalState;
    for await (const state of biosphere.live()) {
      finalState = state;
      currentTick = state.tick;
      ui.setTick(state.tick, state.signals.length);

      log(`\n📊 TICK_END [Tick ${state.tick}]`);
      log(`   Total signals: ${state.signals.length}`);
      log(`   Active agents: ${state.agents.size}`);

      // Update chaos level based on equilibrium state
      if (state.equilibrium) {
        const tension = state.equilibrium.goalTension * 100;
        const momentum = state.equilibrium.momentum * 100;
        chaosLevel = Math.floor((tension + momentum) / 2);

        log(`   Equilibrium state:`);
        log(`     At equilibrium: ${state.equilibrium.atEquilibrium}`);
        log(`     Goal tension: ${(state.equilibrium.goalTension * 100).toFixed(0)}%`);
        log(`     Momentum: ${(state.equilibrium.momentum * 100).toFixed(0)}%`);
        log(`     Coherence: ${(state.equilibrium.coherence * 100).toFixed(0)}%`);
        log(`     Decision clarity: ${(state.equilibrium.decisionClarity * 100).toFixed(0)}%`);
        log(`     Reasoning: ${state.equilibrium.reasoning}`);

        // Display equilibrium metrics
        if (state.tick % 2 === 0) {
          ui.addSignal({
            tick: state.tick,
            actor: 'system',
            text: state.equilibrium.reasoning,
            type: 'system',
          });
        }

        if (state.equilibrium.atEquilibrium) {
          log(`\n🎯 EQUILIBRIUM REACHED!`);
        }
      } else {
        chaosLevel = Math.min(100, 10 + state.signals.length * 2 + spawnCount * 8);
      }

      updateMetrics();
    }

    // Extract actual decision from recent signals using SEMANTIC similarity
    const recentSignals = (finalState?.signals || []).slice(-10);

    let finalDecision = '';
    if (finalState?.equilibrium?.atEquilibrium && recentSignals.length > 0) {
      try {
        const dialogueText = recentSignals.map(s => `${s.emittedBy}: ${s.thought}`).join('\n\n');
        const decisionExtraction = await llm.chat([
          {
            role: 'system',
            content: 'Extract the final decision/consensus from this agent dialogue. Be concise (2-3 sentences). If no clear decision, say "No clear consensus".',
          },
          {
            role: 'user',
            content: `Scenario: ${CEO_SCENARIO}\n\nRecent dialogue:\n${dialogueText}\n\nWhat decision was reached?`,
          },
        ]);
        finalDecision = `✓ Consensus Reached\n\n${decisionExtraction}`;
      } catch (error) {
        finalDecision = `✓ Consensus Reached\n\n${finalState.equilibrium.reasoning}`;
      }
    } else {
      finalDecision = 'No consensus reached - agents still deliberating';
    }

    const agents = Array.from(finalState?.agents.values() || []).map(agent => ({
      id: agent.id,
      name: agent.name,
      concerns: agent.receptorField?.patterns?.slice(0, 3) ?? [],
      bornTick: 0,
    }));

    log(`\n═══════════════════════════════════════════`);
    log(`FINAL SUMMARY`);
    log(`═══════════════════════════════════════════`);
    log(`Total agents: ${finalState?.agents.size ?? 0}`);
    log(`Total signals: ${finalState?.signals.length ?? 0}`);
    log(`Total ticks: ${finalState?.tick ?? 0}`);
    log(`Final decision: ${finalDecision}`);
    log(`\nAgent list:`);
    agents.forEach(a => {
      log(`  - ${a.name} (${a.id}): ${a.concerns.join(', ')}`);
    });

    ui.showSummary({
      agents,
      decisions: finalState?.equilibrium
        ? [
            `Goal Tension: ${(finalState.equilibrium.goalTension * 100).toFixed(0)}%`,
            `Momentum: ${(finalState.equilibrium.momentum * 100).toFixed(0)}%`,
            `Coherence: ${(finalState.equilibrium.coherence * 100).toFixed(0)}%`,
            `Decision Clarity: ${(finalState.equilibrium.decisionClarity * 100).toFixed(0)}%`,
          ]
        : [],
      recommendations: [],
      finalDecision,
      stats: {
        agents: finalState?.agents.size ?? 0,
        signals: finalState?.signals.length ?? 0,
        ticks: finalState?.tick ?? 0,
      },
    });
    ui.render();

    const endTime = new Date().toISOString();
    log(`\n═══════════════════════════════════════════`);
    log(`Session ended: ${endTime}`);
    log(`Log file: ${logPath}`);

    console.log(`\n📝 Full trace log written to: ${logPath}`);

    // Wait for user to press a key before exiting
    await ui.waitForExit();
  } catch (error) {
    log(`\n❌ ERROR: ${error}`);
    ui.stop();
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

main();
