/** Minimal event bus built on EventTarget. */
class Bus extends EventTarget {
  emit(type, detail = null) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  on(type, fn) {
    this.addEventListener(type, fn);
    return () => this.removeEventListener(type, fn);
  }
}

export const bus = new Bus();
