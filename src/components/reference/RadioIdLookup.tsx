import { useState } from "react";

import type { RadioIdRow } from "@/lib/reference/data";
import { lookupRadioId } from "@/lib/reference/search";

type Props = {
  rows: RadioIdRow[];
};

export default function RadioIdLookup({ rows }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const selected = lookupRadioId(query, rows);
  const hasQuery = query.trim().length > 0;

  function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    if (!inputValue.trim()) {
      setError("Radio ID must not be empty");
      return;
    }

    setError("");
    setQuery(inputValue.trim());
  }

  const valueFor = (value: string | undefined) => (hasQuery ? value || "" : "");

  return (
    <div id="radio-search">
      <form onSubmit={handleSubmit}>
        <label htmlFor="radio-id">Radio ID</label>
        <p id="radio-id-desc" className="fst-italic mb-1">Example: 1234, 599, 2-1-8, 100X</p>
        <div className="input-group">
          <input
            type="search"
            className={`form-control${error ? " error" : ""}`}
            id="radio-id"
            aria-describedby="radio-id-desc"
            value={inputValue}
            autoComplete="off"
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </div>
        {error ? <p id="error" className="text-bg-danger fw-bold mt-2 p-1">{error}</p> : null}
      </form>
      <div className="results">
        <table className="table table-bordered table-condensed">
          <tbody>
            <tr>
              <th scope="row">Agency</th>
              <td id="agency">{valueFor(selected.agency)}</td>
            </tr>
            <tr>
              <th scope="row">Level 1 (Bureau)</th>
              <td id="level1">{valueFor(selected.level1)}</td>
            </tr>
            <tr>
              <th scope="row">Level 2 (Division)</th>
              <td id="level2">{valueFor(selected.level2)}</td>
            </tr>
            <tr>
              <th scope="row">Level 3 (Section)</th>
              <td id="level3">{valueFor(selected.level3)}</td>
            </tr>
            <tr>
              <th scope="row">Level 4 (Unit/Assignment)</th>
              <td id="level4">{valueFor(selected.level4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
