/**
 * Generates a random alphanumeric ID.
 * Strong enough for unique agent IDs in this demo context.
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
