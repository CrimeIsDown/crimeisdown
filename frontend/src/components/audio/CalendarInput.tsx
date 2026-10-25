import { useEffect, useRef, type InputHTMLAttributes } from "react";
import type { Instance } from "flatpickr/dist/types/instance";
import "flatpickr/dist/flatpickr.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onValueChange?: (value: string) => void;
  minuteIncrement?: number;
};
export default function CalendarInput({
  onValueChange,
  minuteIncrement = 60,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null),
    picker = useRef<Instance | undefined>(undefined),
    callback = useRef(onValueChange);
  callback.current = onValueChange;
  useEffect(() => {
    let disposed = false;
    void import("flatpickr").then(({ default: flatpickr }) => {
      if (disposed) return;
      picker.current = flatpickr(input.current!, {
        allowInput: true,
        enableTime: true,
        dateFormat: "Y-m-d\\TH:i",
        altInput: true,
        altFormat: "n/j/Y h:i K",
        minuteIncrement,
        onChange: (_dates, value) => callback.current?.(value),
      });
      const label = document.querySelector(
        `label[for="${input.current!.id}"]`,
      )?.textContent;
      if (label)
        picker.current.altInput?.setAttribute("aria-label", label.trim());
    });
    return () => {
      disposed = true;
      picker.current?.destroy();
      picker.current = undefined;
    };
  }, [minuteIncrement]);
  useEffect(() => {
    if (
      props.value !== undefined &&
      picker.current &&
      picker.current.input.value !== props.value
    )
      picker.current.setDate(String(props.value), false);
  }, [props.value]);
  return (
    <div className="input-group date">
      <input
        {...props}
        ref={input}
        type="text"
        onChange={(event) => callback.current?.(event.target.value)}
      />
      <button
        type="button"
        className="input-group-text"
        onClick={() => picker.current?.open()}
        aria-label="Choose date and time"
        title="Choose date and time"
      >
        <svg className="cid-icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">
          <path d="M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v32H448V128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM448 192H0V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192z" />
        </svg>
      </button>
    </div>
  );
}
