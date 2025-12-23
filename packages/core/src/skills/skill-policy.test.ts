import { describe, expect, it } from 'vitest';
import type { MotorSkill, SkillPolicy } from '@homunculus/core';
import { applySkillPolicy } from '@homunculus/core';

const echoSkill: MotorSkill<string, string> = {
  id: 'echo',
  name: 'Echo',
  description: 'Returns input as-is.',
  async execute(input) {
    return input;
  },
};

describe('applySkillPolicy', () => {
  it('allows execution when policy permits', async () => {
    const policy: SkillPolicy = {
      canExecute() {
        return { allowed: true };
      },
    };

    const guarded = applySkillPolicy(echoSkill, policy, { agentId: 'a1', agentName: 'Agent' });
    await expect(guarded.execute('ok')).resolves.toBe('ok');
  });

  it('denies execution when policy blocks', async () => {
    const policy: SkillPolicy = {
      canExecute() {
        return { allowed: false, reason: 'not approved' };
      },
    };

    const guarded = applySkillPolicy(echoSkill, policy, { agentId: 'a1', agentName: 'Agent' });
    await expect(guarded.execute('nope')).rejects.toThrow('Skill execution denied for "echo": not approved');
  });
});

