import type { MotorSkill } from './motor-skill.js';

/**
 * In-memory registry for motor skills (effectors).
 *
 * Framework-level only: no persistence or task-specific skills.
 */
export class MotorSkillRegistry {
  private readonly skills = new Map<string, MotorSkill>();

  list(): MotorSkill[] {
    return Array.from(this.skills.values());
  }

  get(id: string): MotorSkill | undefined {
    return this.skills.get(id);
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  register(skill: MotorSkill): void {
    this.skills.set(skill.id, skill);
  }

  registerMany(skills: MotorSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Resolve skill ids to concrete skills (missing ids are skipped).
   */
  resolve(ids: string[]): MotorSkill[] {
    return ids.map(id => this.skills.get(id)).filter((skill): skill is MotorSkill => Boolean(skill));
  }
}

