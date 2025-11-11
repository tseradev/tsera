/** @jsx h */
/**
 * Interactive counter island component.
 *
 * A client-side interactive component that displays a counter with
 * increment, decrement, and reset functionality. This component is
 * hydrated on the client side as a Fresh island.
 *
 * @module
 */
import { h, useState } from "../../../deps/preact.ts";

/**
 * Props for the Counter component.
 */
interface CounterProps {
  /** Initial counter value */
  start: number;
}

/**
 * Counter island component.
 *
 * @param props - Component props containing the initial counter value
 * @returns JSX element representing the counter interface
 */
export default function Counter(props: CounterProps) {
  const [count, setCount] = useState(props.start);

  return (
    <div class="counter">
      <p class="counter-display">{count}</p>
      <div class="counter-buttons">
        <button type="button" onClick={() => setCount(count - 1)}>-1</button>
        <button type="button" onClick={() => setCount(count + 1)}>+1</button>
        <button type="button" onClick={() => setCount(props.start)}>Reset</button>
      </div>
    </div>
  );
}

