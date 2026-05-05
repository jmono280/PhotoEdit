export class ViewModel {
  constructor(initial = {}) {
    this.state = initial;
    this.listeners = [];
  }

  subscribe(fn) {
    this.listeners.push(fn);
    fn(this.state);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(fn => fn(this.state));
  }
}
