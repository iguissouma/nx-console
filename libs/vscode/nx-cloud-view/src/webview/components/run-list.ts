import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RunDetails } from '../../lib/nx-cloud-service/models';
import { formatMilliseconds } from './ui/format-milliseconds-directive';

@customElement('run-list-element')
export class RunList extends LitElement {
  static styles = css`
    vscode-progress-ring {
      padding-top: 5rem;
      margin: auto;
    }
    vscode-data-grid-cell {
      align-content: center;
    }
    vscode-data-grid-cell:first-of-type {
      padding-left: 0;
    }
    .run-list-row {
      margin-bottom: 0.25rem;
    }
    .run-list-row:last-of-type {
      margin-bottom: 0;
    }
    .run-list-row .success-icon {
      padding-left: 0;
      display: inline;
      vertical-align: sub;
    }
    .run-list-row .command-text {
      display: inline;
      vertical-align: sub;
    }
    .run-list-row .duration-cell {
      text-align: center;
    }
    @media (max-width: 250px) {
      .duration-cell {
        display: none;
        width: 0px;
      }
    }
    .run-list-row .duration-text {
      color: var(--vscode-input-placeholderForeground);
      font-size: 0.75rem;
      display: inline;
      vertical-align: sub;
      margin-right: 0.5rem;
    }
    .run-list-row .no-padding {
      padding-left: 0;
      padding-right: 0;
    }
    .first-command-row {
      padding: 0.25rem 0;
      font-family: var(--vscode-editor-font-family);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .dot {
      border-radius: 9999px;
      display: inline-flex;
      height: 0.5rem;
      transition: background-color cubic-bezier(0.4, 0, 0.2, 1) 0.15s;
      width: 0.5rem;
      align-self: center;
    }
    .dot.yellow {
      background: var(--vscode-editorWarning-foreground);
    }
  `;

  @property({ type: Boolean })
  hasLoaded: boolean;

  @property({ type: Boolean })
  canAccess: boolean;

  @property({ type: Boolean })
  runsLoading: boolean;

  @property()
  runs: RunDetails[] = [];

  @property()
  firstCommands: string[] = [];

  render() {
    if (!this.hasLoaded) {
      return html` <vscode-progress-ring></vscode-progress-ring> `;
    }
    if (!this.canAccess) {
      return html`
        <callout-element
          icon="warning"
          message="This workspace has been claimed by a private organization. To view run
      details, please log in to Nx Cloud."
          actionText="Log In to Nx Cloud"
          @actionclicked="${() => this._loginButtonClicked()}"
        >
        </callout-element>
      `;
    }
    if (this.runs !== undefined && !this.runs.length) {
      return html`
        <callout-element
          icon="info"
          message="No recent runs detected for the current workspace. Here are some examples of what you could run:"
        >
          ${this.firstCommands.map((cmd) => this._getFirstCommandRow(cmd))}
        </callout-element>
      `;
    }
    if (this.runs === undefined || this.runsLoading) {
      return html` <vscode-progress-ring></vscode-progress-ring> `;
    }
    return html`
      <vscode-panels class="container">
        <vscode-panel-tab id="runs"
          >Runs
          ${this.runs?.length > 0
            ? html`<vscode-badge appearance="secondary"
                >${this.runs.length}</vscode-badge
              >`
            : undefined}
        </vscode-panel-tab>
        <vscode-panel-view id="runs">
          <vscode-data-grid
            id="run-list"
            aria-label="Run List"
            grid-template-columns="10% 70% 10% 10%"
          >
            ${this.runs?.map((run) => this._getRunListRow(run))}
          </vscode-data-grid>
        </vscode-panel-view>
      </vscode-panels>
    `;
  }

  private _getRunListRow(run: RunDetails) {
    return html`
      <vscode-data-grid-row class="run-list-row">
        ${this._getCacheSuccessIconCell(run.success, run.cacheHit)}

        <vscode-data-grid-cell grid-column="2">
          <span class="command-text"
            >${run.command}</span
          ></vscode-data-grid-cell
        >

        <vscode-data-grid-cell class="no-padding duration-cell" grid-column="3">
          <span class="duration-text">${formatMilliseconds(run.runTime)}</span>
        </vscode-data-grid-cell>
        <vscode-data-grid-cell
          class="no-padding"
          style="justify-self: center"
          grid-column="4"
        >
          <vscode-button
            appearance="icon"
            @click="${() => this._inspectButtonClicked(run.linkId)}"
          >
            <codicon-element icon="link-external"></codicon-element>
          </vscode-button>
        </vscode-data-grid-cell>
      </vscode-data-grid-row>
    `;
  }

  private _getFirstCommandRow(command: string) {
    return html`
      <div class="first-command-row">
        <div>${command}</div>
        <vscode-button
          appearance="icon"
          @click="${() => this._runFirstCommand(command)}"
        >
          <codicon-element icon="play"> </codicon-element>
        </vscode-button>
      </div>
    `;
  }

  private _getCacheSuccessIconCell(success: boolean, cacheHit: boolean) {
    let buttonHtml;
    let hoverText: string;
    if (success && cacheHit) {
      buttonHtml = html`<span class="dot" style="background: #307838"> </span>`;
      hoverText = 'Cache Hit';
    } else if (success) {
      buttonHtml = html`<span class="dot yellow"> </span>`;
      hoverText = 'Cache Miss';
    } else {
      buttonHtml = html`<span class="dot" style="background: grey"> </span>`;
      hoverText = 'Run Failure';
    }

    return html` <vscode-data-grid-cell title="${hoverText}" grid-column="1">
      <span class="success-icon">${buttonHtml}</span></vscode-data-grid-cell
    >`;
  }

  private _runFirstCommand(command: string) {
    const event = new CustomEvent<{ command: string }>(
      'run-first-command-event',
      {
        detail: {
          command,
        },
        bubbles: true,
        composed: true,
      }
    );
    this.dispatchEvent(event);
  }

  private _loginButtonClicked() {
    const event = new Event('login-event', {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  private _inspectButtonClicked(runLinkid: string) {
    const event = new CustomEvent<{ runLinkId: string }>('inspect-run-event', {
      detail: {
        runLinkId: runLinkid,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}
