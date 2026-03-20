const NO_VALUE = Symbol("NO_VALUE");
export async function lastX(as) {
  let lastValue = NO_VALUE;
  for await (const a of as) {
    lastValue = a;
  }
  if (lastValue === NO_VALUE) {
    throw new Error("No items in generator");
  }
  return lastValue;
}
export async function* all(generators, concurrencyCap = Infinity) {
  const next = (generator) => {
    const promise = generator.next().then(({ done, value }) => ({
      done,
      value,
      generator,
      promise,
    }));
    return promise;
  };
  const waiting = [...generators];
  const promises = new Set();
  while (promises.size < concurrencyCap && waiting.length > 0) {
    const gen = waiting.shift();
    promises.add(next(gen));
  }
  while (promises.size > 0) {
    const { done, value, generator, promise } = await Promise.race(promises);
    promises.delete(promise);
    if (!done) {
      promises.add(next(generator));
      if (value !== undefined) {
        yield value;
      }
    } else if (waiting.length > 0) {
      const nextGen = waiting.shift();
      promises.add(next(nextGen));
    }
  }
}
//# sourceMappingURL=generators.js.map
