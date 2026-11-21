/* Bus d'événements minimal. */
export class Bus {
  constructor() {
    this.listeners = new Map();
  }
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  emit(type, payload) {
    const arr = this.listeners.get(type);
    if (!arr) return;
    for (const fn of arr.slice()) fn(payload);
  }
}

export const bus = new Bus();
