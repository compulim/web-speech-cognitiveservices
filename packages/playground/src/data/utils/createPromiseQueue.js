import createDeferred from './createDeferred';

export default function () {
  let shiftDeferred;
  const queue = [];

  const push = value => {
    if (shiftDeferred) {
      const { resolve } = shiftDeferred;

      shiftDeferred = null;
      resolve(value);
    } else {
      queue.push(value);
    }
  };

  const shift = () => {
    if (queue.length) {
      return Promise.resolve(queue.shift());
    } else {
      return (shiftDeferred || (shiftDeferred = createDeferred())).promise;
    }
  };

  return {
    push,
    shift
  }
}
