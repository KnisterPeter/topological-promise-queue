# topological-promise-queue

Run promises in order of a directed acyclic graph

In a dependency graph like below, we need to run dependencies first:

```
     A
   /   \
  B     C
  |
  C
```

That means, order of execution would be first `C`, then `B`, then `A`.

---

The queue could run tasks in parallel, this means we will try to
reduce the time of execution as much as possible.

Given the following graph:

```
     A
   / | \
  B  C  D
```

This means, order of execution would be `B`, `C` and `D` in parallel, then `A`.

The amount of concurrency could be defined for limiting resource usage.

---

## Usage

```js
import { run } from "topological-promise-queue";

await run({
  concurrency: 10,
  edges: [
    // a depends on b
    ["a", "b"],
    // a depends on c
    ["a", "c"],
    // b depends on c
    ["b", "c"],
  ],
  async runner(node) {
    console.log(node);
    // this will output:
    // c
    // b
    // a
  },
});
```
