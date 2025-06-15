import React, { useState } from 'react';

interface SimpleSearchComponentProps {
  id: string;
  labelText: string;
  exampleText?: string;
  ariaDescribedBy?: string;
  placeholder?: string;
  onSearch: (term: string) => void;
}

export function SimpleSearchComponent(props: SimpleSearchComponentProps) {
  const { id, labelText, exampleText, ariaDescribedBy, placeholder, onSearch } = props;
  const [searchTerm, setSearchTerm] = useState(''); 
  const [error, setError] = useState('');

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      setError(`${labelText} must not be empty`);
      return;
    }
    setError('');
    onSearch(searchTerm);
  };

  return (
    <form onSubmit={handleSearch}>
      <label htmlFor={id}>{labelText}</label>
      {exampleText && <p id="radio-id-desc" className="fst-italic mb-1">{exampleText}</p>}

      <div className="input-group">
        <input
          type="search"
          className="form-control"
          id={id}
          aria-describedby={
            [ariaDescribedBy, error && 'error'].filter(Boolean).join(' ')
          }
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </div>

      {error && <p id="error" className="text-bg-danger fw-bold mt-1 p-1">{error}</p>}
    </form>
  );
}