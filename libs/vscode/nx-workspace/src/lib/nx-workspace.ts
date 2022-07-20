import {
  checkIsNxWorkspace,
  clearJsonCache,
  fileExists,
  getOutputChannel,
  getTelemetry,
  toWorkspaceFormat,
} from '@nx-console/server';
import { WorkspaceConfigurationStore } from '@nx-console/vscode/configuration';
import { join } from 'path';
import {
  firstValueFrom,
  from,
  iif,
  of,
  ReplaySubject,
  switchMap,
  tap,
} from 'rxjs';
import { window } from 'vscode';
import {
  getNxWorkspaceConfig,
  NxWorkspaceConfiguration,
} from './get-nx-workspace-config';

interface NxWorkspace {
  validWorkspaceJson: boolean;
  workspace: NxWorkspaceConfiguration;
  workspaceType: 'ng' | 'nx';
  configurationFilePath: string;
  workspacePath: string;
  isLerna: boolean;
  workspaceLayout: {
    appsDir: string;
    libsDir: string;
  };
}

const enum Status {
  not_started,
  in_progress,
  cached,
}

let cachedReplay = new ReplaySubject<NxWorkspace>();
let status: Status = Status.not_started;

export async function nxWorkspace(reset?: boolean): Promise<NxWorkspace> {
  if (reset) {
    status = Status.not_started;
    cachedReplay = new ReplaySubject<NxWorkspace>();
    const workspacePath = WorkspaceConfigurationStore.instance.get(
      'nxWorkspacePath',
      ''
    );
    // Clear out the workspace config path, needed for angular or older nx workspaces
    clearJsonCache('angular.json', workspacePath);
    clearJsonCache('workspace.json', workspacePath);
  }

  return firstValueFrom(
    iif(
      () => status === Status.not_started,
      of({}).pipe(
        tap(() => {
          status = Status.in_progress;
        }),
        switchMap(() => from(_workspace())),
        tap((workspace) => {
          cachedReplay.next(workspace);
          status = Status.cached;
        })
      ),
      cachedReplay
    )
  );
}

async function _workspace(): Promise<NxWorkspace> {
  const workspacePath = WorkspaceConfigurationStore.instance.get(
    'nxWorkspacePath',
    ''
  );

  const isAngularWorkspace = await fileExists(
    join(workspacePath, 'angular.json')
  );
  const isNxWorkspace = await checkIsNxWorkspace(workspacePath);
  const config = await getNxWorkspaceConfig(
    workspacePath,
    isAngularWorkspace ? 'angularCli' : 'nx',
    isNxWorkspace
  );

  const isLerna = await fileExists(join(workspacePath, 'lerna.json'));

  try {
    return {
      validWorkspaceJson: true,
      workspaceType: isAngularWorkspace ? 'ng' : 'nx',
      workspace: toWorkspaceFormat(config.workspaceConfiguration),
      configurationFilePath: config.configPath,
      isLerna,
      workspaceLayout: {
        appsDir:
          config.workspaceConfiguration.workspaceLayout?.appsDir ?? isLerna
            ? 'packages'
            : 'apps',
        libsDir:
          config.workspaceConfiguration.workspaceLayout?.libsDir ?? isLerna
            ? 'packages'
            : 'libs',
      },
      workspacePath,
    };
  } catch (e) {
    const humanReadableError = 'Invalid workspace: ' + workspacePath;
    window.showErrorMessage(humanReadableError, 'Show Error').then((value) => {
      if (value) {
        getOutputChannel().show();
      }
    });
    getOutputChannel().appendLine(humanReadableError);

    const stringifiedError = e.toString ? e.toString() : JSON.stringify(e);
    getOutputChannel().appendLine(stringifiedError);
    getTelemetry().exception(stringifiedError);

    // Default to nx workspace
    return {
      validWorkspaceJson: false,
      workspaceType: 'nx',
      workspace: {
        npmScope: '@nx-console',
        projects: {},
        version: 2,
      },
      configurationFilePath: '',
      workspacePath,
      isLerna: false,
      workspaceLayout: {
        appsDir: 'apps',
        libsDir: 'libs',
      },
    };
  }
}
