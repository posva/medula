import { createSignal } from 'solid-js'

export default function Item(props: { label: string; done: boolean; onToggle: () => void }) {
  // component-local signal inside a <For>
  const [highlighted, setHighlighted] = createSignal(false)
  return (
    <li
      classList={{ done: props.done, highlighted: highlighted() }}
      onPointerEnter={() => setHighlighted(true)}
      onPointerLeave={() => setHighlighted(false)}
    >
      <label>
        <input type="checkbox" checked={props.done} onChange={() => props.onToggle()} />{' '}
        {props.label}
      </label>
    </li>
  )
}
