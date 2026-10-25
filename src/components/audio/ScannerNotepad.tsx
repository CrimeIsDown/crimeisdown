import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import "pell/dist/pell.min.css";

export default function ScannerNotepad() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current!;
    let disposed = false;
    const controller = new AbortController();
    void import("pell").then(({ init, exec }) => {
      if (disposed) return;
      init({ element, onChange() {} });
      const content = element.querySelector<HTMLElement>(".pell-content")!;
      content.setAttribute("role", "textbox");
      content.setAttribute("aria-label", "Scanner notepad");
      content.setAttribute("aria-multiline", "true");
      // Keep rich clipboard formatting without inserting executable pasted markup.
      content.addEventListener(
        "paste",
        (event) => {
          event.preventDefault();
          const html = event.clipboardData?.getData("text/html");
          if (html)
            document.execCommand(
              "insertHTML",
              false,
              DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
            );
          else
            document.execCommand(
              "insertText",
              false,
              event.clipboardData?.getData("text/plain") || "",
            );
        },
        { signal: controller.signal },
      );
      element.addEventListener(
        "click",
        (event) => {
          const button = (
            event.target as HTMLElement
          ).closest<HTMLButtonElement>("button");
          if (!button || !["Link", "Image"].includes(button.title)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const value = window.prompt(
            "Enter the " + button.title.toLowerCase() + " URL",
          );
          if (!value) return;
          try {
            const url = new URL(value);
            if (
              !(
                button.title === "Image"
                  ? ["http:", "https:"]
                  : ["http:", "https:", "mailto:", "tel:"]
              ).includes(url.protocol)
            )
              return;
            content.focus();
            exec(
              button.title === "Image" ? "insertImage" : "createLink",
              url.href,
            );
          } catch {
            /* Leave notes unchanged if the entered URL is invalid. */
          }
        },
        { capture: true, signal: controller.signal },
      );
    });
    return () => {
      disposed = true;
      controller.abort();
      element.replaceChildren();
    };
  }, []);
  return (
    <div>
      <p>
        Use the text area for any notes you may need to take when listening to
        the scanner.
      </p>
      <div ref={host} />
      <p>
        <em>
          Refreshing the page or navigating away will clear anything you have
          written.
        </em>
      </p>
    </div>
  );
}
