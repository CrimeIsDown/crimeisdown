export function HelloWorld({ message, onClick }) {
  return <div>
    <button onClick={onClick}>Toggle</button>
    <div>you said: {message}</div>
    <small>cats</small>
  </div>;
}
