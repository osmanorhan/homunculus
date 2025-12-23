import { describe, expect, it } from 'vitest';
import type { MotorSkill } from '@homunculus-live/core';
import { MotorSkillRegistry } from '@homunculus-live/core';

const echoSkill: MotorSkill<string, string> = {
  id: 'echo',
  name: 'Echo',
  description: 'Returns input as-is.',
  async execute(input) {
    return input;
  },
};

const reverseSkill: MotorSkill<string, string> = {
  id: 'reverse',
  name: 'Reverse',
  description: 'Reverses the input string.',
  async execute(input) {
    return input.split('').reverse().join('');
  },
};

describe('MotorSkillRegistry', () => {
  it('registers and resolves skills by id', () => {
    const registry = new MotorSkillRegistry();
    registry.registerMany([echoSkill, reverseSkill]);

    expect(registry.has('echo')).toBe(true);
    expect(registry.get('reverse')?.name).toBe('Reverse');
    expect(registry.list()).toHaveLength(2);

    const resolved = registry.resolve(['reverse', 'missing', 'echo']);
    expect(resolved.map(skill => skill.id)).toEqual(['reverse', 'echo']);
  });
});

