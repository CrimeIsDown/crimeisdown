import { useState } from "react";

export default function ScannerNotepad() {
  const [notes, setNotes] = useState("");

  return (
    <div>
      <p>Use the text area for any notes you may need to take when listening to the scanner.</p>
      <textarea
        className="form-control"
        rows={8}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Write notes here."
        aria-label="Scanner notepad"
      />
      <p><em>Refreshing the page or navigating away will clear anything you have written.</em></p>
    </div>
  );
}
