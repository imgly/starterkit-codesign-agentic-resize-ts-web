// This product's loop policy: stop a run when tool calls keep failing the same way.

/** How much of an error's text identifies it, so a varying tail does not make a repeat look new. */
const KEY_LENGTH = 200;

/** Counts consecutive identical tool failures across all tools (a dead backend fails every tool). */
export class RepeatedErrorGuard {
  private key: string | undefined;
  private count = 0;
  private tools: string[] = [];
  /** Why the run should stop, once it should. */
  reason: string | undefined;

  constructor(private readonly limit = 5) {}

  /** Record one tool outcome; true when the run should stop. */
  record(tool: string, isError: boolean, text: string): boolean {
    if (this.limit <= 0) return false;
    const key = isError ? text.slice(0, KEY_LENGTH) : undefined;
    if (key === undefined || key !== this.key) {
      this.count = 0;
      this.tools = [];
    }
    this.key = key;
    if (key === undefined) return false;
    this.count += 1;
    if (!this.tools.includes(tool)) this.tools.push(tool);
    if (this.count < this.limit) return false;
    this.reason = `abandoned after ${this.count} consecutive failures of ${this.tools.join(', ')}: ${key}`;
    return true;
  }
}
