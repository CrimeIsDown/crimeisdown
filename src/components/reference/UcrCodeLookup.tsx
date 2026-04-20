import { useState } from "react";

import type { UcrCodeRow } from "@/lib/reference/data";
import { lookupUcrCode } from "@/lib/reference/search";

type Props = {
  rows: UcrCodeRow[];
};

export default function UcrCodeLookup({ rows }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const selected = lookupUcrCode(query, rows);
  const hasQuery = query.trim().length > 0;

  function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    if (!inputValue.trim()) {
      setError("UCR (Uniform Crime Reporting) Code must not be empty");
      return;
    }

    setError("");
    setQuery(inputValue.trim());
  }

  const valueFor = (value: string | undefined) => (hasQuery ? value || "" : "");

  return (
    <div id="ucr-search">
      <form onSubmit={handleSubmit}>
        <label htmlFor="ucr-id">UCR (Uniform Crime Reporting) Code</label>
        <p id="ucr-id-desc" className="fst-italic mb-1">Example: 041A</p>
        <div className="input-group">
          <input
            type="search"
            className={`form-control${error ? " error" : ""}`}
            id="ucr-id"
            aria-describedby="ucr-id-desc"
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
              <th scope="row">Primary Description</th>
              <td id="primary_desc">{valueFor(selected.primaryDesc)}</td>
            </tr>
            <tr>
              <th scope="row">Secondary Description</th>
              <td id="secondary_desc">{valueFor(selected.secondaryDesc)}</td>
            </tr>
            <tr>
              <th scope="row">Index Code?</th>
              <td id="index_code">{valueFor(selected.indexCode)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        The full list of UCR codes and information about them can be found in the
        <a
          href="http://directives.chicagopolice.org/forms/CPD-63.451_Table.pdf"
          target="_blank"
          rel="noreferrer"
        >
          CPD's Incident Reporting Guide
        </a>
        .
      </p>
    </div>
  );
}
