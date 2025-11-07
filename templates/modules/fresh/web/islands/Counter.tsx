/** @jsx h */
import { h } from "npm:preact@10";
import { useState } from "npm:preact@10/hooks";

interface CounterProps {
  start: number;
}

export default function Counter(props: CounterProps) {
  const [count, setCount] = useState(props.start);

  return (
    <div class="counter">
      <p class="counter-display">{count}</p>
      <div class="counter-buttons">
        <button onClick={() => setCount(count - 1)}>-1</button>
        <button onClick={() => setCount(count + 1)}>+1</button>
        <button onClick={() => setCount(props.start)}>Reset</button>
      </div>
    </div>
  );
}
