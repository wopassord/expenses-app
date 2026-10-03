import { html } from '../lib/dom.js';

export function setupView({ error, owner = '', repo = 'expenses-data', busy = false } = {}) {
  return html`<div class="setup">
    <div class="setup-card card">
      <div class="brand brand-lg"><span class="brand-mark"></span>Ledger</div>
      <p class="muted">Your expenses live in a private GitHub repository. This page only talks to GitHub from your browser.</p>
      <form id="connect-form" novalidate>
        <label class="sfield"><span class="f-label">GitHub user</span>
          <input name="owner" value="${owner}" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
        <label class="sfield"><span class="f-label">Data repository</span>
          <input name="repo" value="${repo}" autocapitalize="off" spellcheck="false" required></label>
        <label class="sfield"><span class="f-label">Access token</span>
          <input name="token" type="password" autocomplete="current-password" placeholder="github_pat_…" required></label>
        ${error ? html`<p class="form-error" role="alert">${error}</p>` : ''}
        <button class="btn btn-primary btn-block" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Checking…' : 'Connect'}</button>
      </form>
      <details class="howto">
        <summary>How do I get a token?</summary>
        <ol>
          <li>GitHub → Settings → Developer settings → <b>Fine-grained tokens</b> → Generate new token.</li>
          <li>Repository access: <b>Only select repositories</b> → your data repo.</li>
          <li>Permissions → Repository → <b>Contents: Read and write</b>. Nothing else.</li>
          <li>Paste it here. It is stored only in this browser.</li>
        </ol>
      </details>
      <div class="divider"><span>or</span></div>
      <button class="btn btn-ghost btn-block" data-action="demo" type="button">Try the demo (data stays in this browser)</button>
    </div>
  </div>`;
}
