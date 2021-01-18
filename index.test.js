import { run } from "./index.js";

test("run should call runners in a DAG in dependency order", async () => {
  /** @type {string[]} */
  const collected = [];

  await run({
    edges: [
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ],
    async runner(node) {
      collected.push(node);
    },
  });

  expect(collected).toEqual(["c", "b", "a"]);
});

test("run should leaf nodes first", async () => {
  /** @type {string[]} */
  const collected = [];

  await run({
    edges: [["a"], ["b"]],
    async runner(node) {
      collected.push(node);
    },
  });

  expect(collected).toEqual(["a", "b"]);
});

test("run should wait for next items before execution", async () => {
  expect.hasAssertions();

  /** @type {string[]} */
  const collected = [];

  await run({
    edges: [
      ["a", "b"],
      ["a", "c"],
    ],
    async runner(node) {
      if (node === "a") {
        expect(collected).toEqual(expect.arrayContaining(["b", "c"]));
      } else {
        const timeout = Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, timeout));
        collected.push(node);
      }
    },
  });
});

test("run should fail if a subtask fails", async () => {
  expect.hasAssertions();

  try {
    await run({
      edges: [
        ["a", "b"],
        ["a", "c"],
      ],
      async runner(node) {
        if (node === "b") {
          throw new Error("Fail for b");
        }
      },
    });
  } catch (e) {
    expect(e).toEqual(expect.objectContaining({ message: "Fail for b" }));
  }
});

test("run should be bound to a given number of parallel tasks", async () => {
  expect.hasAssertions();

  let n = 0;

  await run({
    concurrency: 1,
    edges: [["a"], ["b"], ["c"], ["d"]],
    async runner() {
      n++;
      expect(n).toBeLessThanOrEqual(1);

      const timeout = Math.random() * 50;
      await new Promise((resolve) => setTimeout(resolve, timeout));
      n--;
    },
  });
});

test("run should run parallel tasks", async () => {
  expect.hasAssertions();

  let n = 0;
  let multipleTasks = false;

  await run({
    concurrency: 2,
    edges: [["a"], ["b"], ["c"], ["d"]],
    async runner() {
      n++;
      multipleTasks ||= n > 1;

      const timeout = Math.random() * 50;
      await new Promise((resolve) => setTimeout(resolve, timeout));
      n--;
    },
  });

  expect(multipleTasks).toBeTruthy();
});
