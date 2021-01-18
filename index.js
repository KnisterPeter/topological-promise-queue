class PromiseQueue {
  /**
   * @private
   * @type {number}
   */
  _max;

  /**
   * @private
   * @type {Promise<void>[]}
   */
  _queue = [];

  /**
   * @private
   * @type {undefined | (() => void)}
   */
  _resolve;

  /**
   * @private
   * @type {undefined | (() => void)}
   */
  _reject;

  /**
   * @private
   * @type {undefined | Promise<void>}
   */
  _promise;

  /**
   * @param {number} max
   */
  constructor(max) {
    this._max = max;
  }

  /**
   * @private
   */
  createPromise() {
    /** @type {Promise<void>} */
    this._promise = new Promise((_resolve, _reject) => {
      this._resolve = _resolve;
      this._reject = _reject;
    });
  }

  wait() {
    if (this._queue.length === this._max) {
      if (!this._promise) {
        this.createPromise();
      }
      return this._promise;
    }
    return undefined;
  }

  /**
   * @param {Promise<void>} item
   */
  async enqueue(item) {
    this._queue.push(item);

    item
      .finally(() => {
        this._queue.splice(this._queue.indexOf(item), 1);
      })
      .then(
        () => {
          if (this._resolve) {
            this._resolve();
          }
        },
        () => {
          if (this._reject) {
            this._reject();
          }
        }
      )
      .finally(() => {
        this._promise = undefined;
      });
  }
}

/**
 * @template ITEM
 * @param {ITEM} item
 * @returns {(edge: ([ITEM] | [ITEM, ITEM])) => Boolean}
 */
const isStart = (item) => (edge) => edge[0] === item;

/**
 * @template ITEM
 * @returns {(edge: [ITEM] | [ITEM,ITEM]) => ITEM}
 */
const getStart = () => (edge) => edge[0];

/**
 * @template ITEM
 * @param {ITEM} item
 * @returns {(edge: ([ITEM] | [ITEM, ITEM])) => Boolean}
 */
const isEnd = (item) => (edge) => edge[1] === item;

/**
 * @template ITEM
 * @returns {(edge: [ITEM] | [ITEM,ITEM]) => ITEM | undefined}
 */
const getEnd = () => (edge) => edge[1];

/**
 * @template ITEM
 * @returns {(item: ITEM | undefined) => item is ITEM}
 */
const isDefined = () =>
  /** @returns {item is ITEM} */
  (item) => Boolean(item);

/**
 * @template ITEM
 * @param {Object} options
 * @param {number} [options.concurrency]
 * @param {([ITEM] | [ITEM, ITEM])[]} options.edges
 * @param {(node: ITEM) => Promise<void>} options.runner
 */
export async function run({
  concurrency = Number.MAX_SAFE_INTEGER,
  edges,
  runner,
}) {
  const workerQueue = new PromiseQueue(concurrency);

  const starts = edges.map(getStart());
  const ends = edges.map(getEnd()).filter(isDefined());

  const roots = new Set([
    ...ends.filter((item) => !starts.includes(item)),
    ...edges.filter((item) => item.length === 1).map(getStart()),
  ]);

  /** @type {Map<ITEM, Promise<void>>} */
  const promises = new Map();
  /** @type {Set<Promise<void>>} */
  const helper = new Set();

  /** @type {ITEM[]} */
  const wip = Array.from(roots);
  while (wip.length > 0) {
    const item = wip.shift();
    if (!item) {
      throw new Error("Illegal state");
    }

    /** @type {() => void} */
    let resolve;
    /** @type {() => void} */
    let reject;
    /** @type {Promise<void>} */
    const promise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    promises.set(item, promise);

    const waitFor = edges
      .filter(isStart(item))
      .map(getEnd())
      .filter(isDefined())
      .map((end) => promises.get(end));
    helper.add(
      Promise.all(waitFor).then(async () => {
        let lock = workerQueue.wait();
        while (lock) {
          await lock;
          lock = workerQueue.wait();
        }

        const task = runner(item);
        await workerQueue.enqueue(task);
        task.then(resolve, reject);
      })
    );

    const activeItems = Array.from(promises.keys());
    edges
      .filter(isEnd(item))
      .map(getStart())
      .filter((start) =>
        // find items where all dependencies have
        // promises already
        edges
          .filter(isStart(start))
          .map(getEnd())
          .filter(isDefined())
          .every((dep) => activeItems.includes(dep))
      )
      .forEach((item) => wip.push(item));
  }

  await Promise.all([...promises.values(), ...helper.values()]);
}
