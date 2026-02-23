"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import * as ts from "typescript";

type Lang = "javascript" | "typescript";

const JS_TEMPLATE = `// JavaScript example
function add(a, b) {
  return a + b;
}
console.log("add(2,3) =", add(2,3));
`;

const TS_TEMPLATE = `// TypeScript example
type User = { id: number; name: string };

function greet(user: User): string {
  return "Hello " + user.name;
}

console.log(greet({ id: 1, name: "Kayhan" }));
`;

function transpileTypeScript(tsCode: string) {
  const out = ts.transpileModule(tsCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: true,
      esModuleInterop: true,
    },
  });
  return out.outputText;
}

function buildRunnerHtml(jsCode: string) {
  const escaped = jsCode.replace(/<\/script>/g, "<\\/script>");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Runner</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      background: #0b1220;
      color: #e5e7eb;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
      padding: 12px;
    }
    .line { white-space: pre-wrap; margin: 0 0 6px; line-height: 1.4; }
    .err { color: #ff6b6b; }
    .badge {
      display: inline-block; margin-bottom: 10px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      font-size: 12px; opacity: .9;
      padding: 4px 8px; border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.10);
    }
  </style>
</head>
<body>
  <div class="badge">Console</div>
  <div id="out"></div>

  <script>
    const out = document.getElementById("out");

    function print(msg, isErr=false){
      const p = document.createElement("div");
      p.className = "line" + (isErr ? " err" : "");
      p.textContent = msg;
      out.appendChild(p);
    }

    const _log = console.log;
    const _err = console.error;

    console.log = (...args) => { print(args.map(String).join(" ")); _log(...args); };
    console.error = (...args) => { print(args.map(String).join(" "), true); _err(...args); };

    window.onerror = (m) => { print(String(m), true); };

    try {
      ${escaped}
    } catch(e) {
      console.error(e?.stack || e?.message || String(e));
    }
  </script>
</body>
</html>`;
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function CodeEditor() {
  const [lang, setLang] = useState<Lang>("javascript");
  const [code, setCode] = useState(JS_TEMPLATE);

  const [autoRun, setAutoRun] = useState(false);
  const [status, setStatus] = useState<"ready" | "running" | "error">("ready");

  const [iframeSrcDoc, setIframeSrcDoc] = useState<string>(() =>
    buildRunnerHtml(JS_TEMPLATE)
  );

  const monacoRef = useRef<any>(null);
  const runTimerRef = useRef<number | null>(null);

  const template = useMemo(
    () => (lang === "typescript" ? TS_TEMPLATE : JS_TEMPLATE),
    [lang]
  );

  const onMount: OnMount = (_editor, monaco) => {
    monacoRef.current = monaco;

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      strict: true,
      noEmit: true,
    });
  };

  const runCode = () => {
    setStatus("running");
    try {
      const js = lang === "typescript" ? transpileTypeScript(code) : code;
      setIframeSrcDoc(buildRunnerHtml(js));
      setStatus("ready");
    } catch (e: any) {
      setIframeSrcDoc(buildRunnerHtml(`console.error(${JSON.stringify(e?.message || String(e))});`));
      setStatus("error");
    }
  };

  const resetCode = () => {
    setCode(template);
    const js = lang === "typescript" ? transpileTypeScript(template) : template;
    setIframeSrcDoc(buildRunnerHtml(js));
    setStatus("ready");
  };

  const clearOutput = () => {
    setIframeSrcDoc(buildRunnerHtml(`// cleared\n`));
    setStatus("ready");
  };

  const changeLang = (newLang: Lang) => {
    setLang(newLang);
    const next = newLang === "typescript" ? TS_TEMPLATE : JS_TEMPLATE;
    setCode(next);
    const js = newLang === "typescript" ? transpileTypeScript(next) : next;
    setIframeSrcDoc(buildRunnerHtml(js));
    setStatus("ready");
  };

  // Auto-run with debounce
  useEffect(() => {
    if (!autoRun) return;

    if (runTimerRef.current) window.clearTimeout(runTimerRef.current);
    runTimerRef.current = window.setTimeout(() => runCode(), 600);

    return () => {
      if (runTimerRef.current) window.clearTimeout(runTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, autoRun, lang]);

  const statusLabel =
    status === "ready" ? "Ready" : status === "running" ? "Running…" : "Error";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Page shell */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "white",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderBottom: "1px solid #e5e7eb",
            background:
              "linear-gradient(180deg, rgba(249,250,251,1), rgba(255,255,255,1))",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
              Code Playground
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Run JS/TS safely in an isolated iframe
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Status pill */}
            <span
              style={{
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background:
                  status === "error"
                    ? "rgba(239,68,68,.08)"
                    : status === "running"
                      ? "rgba(59,130,246,.10)"
                      : "rgba(16,185,129,.10)",
                color:
                  status === "error"
                    ? "#b91c1c"
                    : status === "running"
                      ? "#1d4ed8"
                      : "#047857",
                fontWeight: 700,
              }}
              title="Runner status"
            >
              {statusLabel}
            </span>

            {/* Language segmented */}
            <div
              style={{
                display: "flex",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                onClick={() => changeLang("javascript")}
                style={{
                  padding: "8px 10px",
                  fontWeight: 700,
                  fontSize: 12,
                  border: 0,
                  cursor: "pointer",
                  background: lang === "javascript" ? "#111827" : "transparent",
                  color: lang === "javascript" ? "white" : "#111827",
                }}
              >
                JavaScript
              </button>
              <button
                onClick={() => changeLang("typescript")}
                style={{
                  padding: "8px 10px",
                  fontWeight: 700,
                  fontSize: 12,
                  border: 0,
                  cursor: "pointer",
                  background: lang === "typescript" ? "#111827" : "transparent",
                  color: lang === "typescript" ? "white" : "#111827",
                }}
              >
                TypeScript
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={resetCode}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "white",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title="Reset code to template"
            >
              Reset
            </button>

            <button
              onClick={runCode}
              style={{
                padding: "8px 14px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              title="Run code"
            >
              ▶ Run
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.35fr 1fr",
            gap: 12,
            padding: 12,
          }}
        >
          {/* Editor Card */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              overflow: "hidden",
              background: "#0b1220",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <div style={{ color: "rgba(255,255,255,.9)", fontWeight: 800 }}>
                Editor
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "rgba(255,255,255,.8)",
                  fontSize: 12,
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoRun}
                  onChange={(e) => setAutoRun(e.target.checked)}
                />
                Auto-run
              </label>
            </div>

            <div style={{ height: 520 }}>
              <Editor
                height="100%"
                theme="vs-dark"
                language={lang}
                value={code}
                onChange={(v) => setCode(v ?? "")}
                onMount={onMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  tabSize: 2,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>
          </div>

          {/* Output Card */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              overflow: "hidden",
              background: "white",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              minHeight: 520,
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, color: "#111827" }}>Output</div>

              <button
                onClick={clearOutput}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
                title="Clear output"
              >
                Clear
              </button>
            </div>

            <div style={{ padding: 12 }}>
              <div
                style={{
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid #0b1220",
                  background: "#0b1220",
                }}
              >
                <iframe
                  title="runner"
                  sandbox="allow-scripts"
                  srcDoc={iframeSrcDoc}
                  style={{
                    width: "100%",
                    height: 430,
                    border: 0,
                    display: "block",
                    background: "#0b1220",
                  }}
                />
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                Tip: enable <b>Auto-run</b> to execute after you stop typing (debounced).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile stacking helper */}
      <style jsx>{`
        @media (max-width: 980px) {
          div[style*="grid-template-columns: 1.35fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}