import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import KuzuPersistentDemo from "./components/KuzuPersistentDemo";
import "./index.css";

const Root = () => {
  const isKuzuDemo = typeof window !== "undefined" && window.location.hash === "#kuzu-demo";

  if (isKuzuDemo) {
    return <KuzuPersistentDemo />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
