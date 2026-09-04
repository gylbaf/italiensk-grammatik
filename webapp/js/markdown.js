window.QuizApp = window.QuizApp || {};

(function () {
  "use strict";

  function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(line) {
    let s = escapeHtml(line);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return s;
  }

  function isTableLine(line) {
    return /^\s*\|.*\|\s*$/.test(line);
  }

  function renderTable(lines) {
    const rows = lines.map((l) =>
      l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
    );
    const filtered = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
    if (!filtered.length) return "";
    let html = '<table class="qmd-table">';
    filtered.forEach((row, idx) => {
      const tag = idx === 0 ? "th" : "td";
      html += "<tr>" + row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>";
    });
    html += "</table>";
    return html;
  }

  function toHtml(text) {
    if (!text) return "";
    const lines = text.split("\n");
    let html = "";
    let i = 0;
    while (i < lines.length) {
      if (lines[i].trim() === "") { i++; continue; }
      if (isTableLine(lines[i])) {
        const tableLines = [];
        while (i < lines.length && isTableLine(lines[i])) { tableLines.push(lines[i]); i++; }
        html += renderTable(tableLines);
        continue;
      }
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== "" && !isTableLine(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      html += '<div class="body-text">' + paraLines.map(inline).join("\n") + "</div>";
    }
    return html;
  }

  QuizApp.markdown = {
    escapeHtml,
    inline,
    isTableLine,
    renderTable,
    toHtml,
    mdToHtml: toHtml,
  };
})();
