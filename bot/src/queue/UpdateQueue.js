class QueueFullError extends Error {
  constructor(message) {
    super(message);
    this.name = "QueueFullError";
  }
}

class UpdateQueue {
  constructor({ intervalMs = 1200, maxSize = 200, onTaskError } = {}) {
    this.intervalMs = intervalMs;
    this.maxSize = maxSize;
    this.onTaskError = typeof onTaskError === "function" ? onTaskError : () => {};

    this.queue = [];
    this.isProcessing = false;
    this.nextId = 1;
  }

  enqueue(task, metadata = {}) {
    if (typeof task !== "function") {
      throw new TypeError("Queue task must be a function");
    }

    if (this.queue.length >= this.maxSize) {
      throw new QueueFullError(`Queue is full (max ${this.maxSize})`);
    }

    const id = this.nextId;
    this.nextId += 1;

    this.queue.push({
      id,
      task,
      metadata,
      enqueuedAt: Date.now()
    });

    this._processNext();

    return {
      id,
      position: this.queue.length
    };
  }

  size() {
    return this.queue.length;
  }

  _processNext() {
    if (this.isProcessing) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.isProcessing = true;

    Promise.resolve()
      .then(() => next.task())
      .catch((error) => {
        this.onTaskError(error, next.metadata);
      })
      .finally(() => {
        setTimeout(() => {
          this.isProcessing = false;
          this._processNext();
        }, this.intervalMs);
      });
  }
}

module.exports = {
  UpdateQueue,
  QueueFullError
};
