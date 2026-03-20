import { spawn } from 'child_process';
import { existsSync, mkdirSync, realpathSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { dirname, isAbsolute, resolve } from 'path';
import which from 'which';
import { logError } from '@utils/log';
import { appendTaskOutput, getTaskOutputFilePath, touchTaskOutputFile, } from '@utils/log/taskOutputStore';
function whichSync(bin) {
    try {
        return which.sync(bin, { nothrow: true }) ?? null;
    }
    catch {
        return null;
    }
}
function whichOrSelf(bin) {
    return whichSync(bin) ?? bin;
}
function spawnWithExited(options) {
    const child = spawn(options.cmd[0], options.cmd.slice(1), {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['inherit', 'pipe', 'pipe'],
        windowsHide: true,
    });
    child.exited = new Promise(resolve => {
        const done = () => resolve();
        child.once('exit', done);
        child.once('error', done);
    });
    return child;
}
function maybeAnnotateMacosSandboxStderr(stderr, sandbox) {
    if (!stderr)
        return stderr;
    if (!sandbox || sandbox.enabled !== true)
        return stderr;
    const platform = sandbox.__platformOverride ?? process.platform;
    if (platform !== 'darwin')
        return stderr;
    if (stderr.includes('[sandbox]'))
        return stderr;
    const lower = stderr.toLowerCase();
    const looksLikeSandboxViolation = stderr.includes('KODE_SANDBOX') ||
        (lower.includes('sandbox-exec') &&
            (lower.includes('deny') || lower.includes('operation not permitted'))) ||
        (lower.includes('operation not permitted') && lower.includes('sandbox'));
    if (!looksLikeSandboxViolation)
        return stderr;
    return [
        stderr.trimEnd(),
        '',
        '[sandbox] This failure looks like a macOS sandbox denial. Adjust sandbox settings (e.g. /sandbox or .kode/settings.json) to grant the minimal required access.',
    ].join('\n');
}
function hasGlobPattern(value) {
    return (value.includes('*') ||
        value.includes('?') ||
        value.includes('[') ||
        value.includes(']'));
}
export function normalizeLinuxSandboxPath(input, options) {
    const cwd = options?.cwd ?? process.cwd();
    const homeDir = options?.homeDir ?? homedir();
    let resolved = input;
    if (input === '~')
        resolved = homeDir;
    else if (input.startsWith('~/'))
        resolved = homeDir + input.slice(1);
    else if (input.startsWith('./') || input.startsWith('../'))
        resolved = resolve(cwd, input);
    else if (!isAbsolute(input))
        resolved = resolve(cwd, input);
    if (hasGlobPattern(resolved)) {
        const prefix = resolved.split(/[*?[\]]/)[0];
        if (prefix && prefix !== '/') {
            const dir = prefix.endsWith('/') ? prefix.slice(0, -1) : dirname(prefix);
            try {
                const real = realpathSync(dir);
                const suffix = resolved.slice(dir.length);
                return real + suffix;
            }
            catch { }
        }
        return resolved;
    }
    try {
        resolved = realpathSync(resolved);
    }
    catch { }
    return resolved;
}
export function buildLinuxBwrapFilesystemArgs(options) {
    const cwd = options.cwd ?? process.cwd();
    const homeDir = options.homeDir ?? homedir();
    const args = [];
    const writeConfig = options.writeConfig;
    if (writeConfig) {
        args.push('--ro-bind', '/', '/');
        const allowedRoots = [];
        if (existsSync('/tmp/kode')) {
            args.push('--bind', '/tmp/kode', '/tmp/kode');
            allowedRoots.push('/tmp/kode');
        }
        for (const raw of writeConfig.allowOnly ?? []) {
            const resolved = normalizeLinuxSandboxPath(raw, { cwd, homeDir });
            if (resolved.startsWith('/dev/'))
                continue;
            if (!existsSync(resolved))
                continue;
            args.push('--bind', resolved, resolved);
            allowedRoots.push(resolved);
        }
        const denyWithinAllow = [
            ...(writeConfig.denyWithinAllow ?? []),
            ...(options.extraDenyWithinAllow ?? []),
        ];
        for (const raw of denyWithinAllow) {
            const resolved = normalizeLinuxSandboxPath(raw, { cwd, homeDir });
            if (resolved.startsWith('/dev/'))
                continue;
            if (!existsSync(resolved))
                continue;
            const withinAllowed = allowedRoots.some(root => resolved === root || resolved.startsWith(root + '/'));
            if (!withinAllowed)
                continue;
            args.push('--ro-bind', resolved, resolved);
        }
    }
    else {
        args.push('--bind', '/', '/');
    }
    const denyRead = [...(options.readConfig?.denyOnly ?? [])];
    if (existsSync('/etc/ssh/ssh_config.d'))
        denyRead.push('/etc/ssh/ssh_config.d');
    for (const raw of denyRead) {
        const resolved = normalizeLinuxSandboxPath(raw, { cwd, homeDir });
        if (resolved.startsWith('/dev/'))
            continue;
        if (!existsSync(resolved))
            continue;
        if (statSync(resolved).isDirectory())
            args.push('--tmpfs', resolved);
        else
            args.push('--ro-bind', '/dev/null', resolved);
    }
    return args;
}
export function buildLinuxBwrapCommand(options) {
    const args = [];
    args.push('--die-with-parent', '--new-session', '--unshare-pid', '--unshare-uts', '--unshare-ipc');
    if (options.needsNetworkRestriction)
        args.push('--unshare-net');
    args.push(...buildLinuxBwrapFilesystemArgs({
        cwd: options.cwd,
        homeDir: options.homeDir,
        readConfig: options.readConfig,
        writeConfig: options.writeConfig,
    }));
    args.push('--dev', '/dev', '--setenv', 'SANDBOX_RUNTIME', '1', '--setenv', 'TMPDIR', '/tmp/kode');
    if (!options.enableWeakerNestedSandbox)
        args.push('--proc', '/proc');
    args.push('--', options.binShellPath, '-c', options.command);
    return [options.bwrapPath, ...args];
}
function buildSandboxEnvAssignments(options) {
    const httpProxyPort = options?.httpProxyPort;
    const socksProxyPort = options?.socksProxyPort;
    const platform = options?.platform ?? process.platform;
    const env = ['SANDBOX_RUNTIME=1', 'TMPDIR=/tmp/kode'];
    if (!httpProxyPort && !socksProxyPort)
        return env;
    const noProxy = [
        'localhost',
        '127.0.0.1',
        '::1',
        '*.local',
        '.local',
        '169.254.0.0/16',
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
    ].join(',');
    env.push(`NO_PROXY=${noProxy}`);
    env.push(`no_proxy=${noProxy}`);
    if (httpProxyPort) {
        env.push(`HTTP_PROXY=http://localhost:${httpProxyPort}`);
        env.push(`HTTPS_PROXY=http://localhost:${httpProxyPort}`);
        env.push(`http_proxy=http://localhost:${httpProxyPort}`);
        env.push(`https_proxy=http://localhost:${httpProxyPort}`);
    }
    if (socksProxyPort) {
        env.push(`ALL_PROXY=socks5h://localhost:${socksProxyPort}`);
        env.push(`all_proxy=socks5h://localhost:${socksProxyPort}`);
        if (platform === 'darwin') {
            env.push(`GIT_SSH_COMMAND="ssh -o ProxyCommand='nc -X 5 -x localhost:${socksProxyPort} %h %p'"`);
        }
        env.push(`FTP_PROXY=socks5h://localhost:${socksProxyPort}`);
        env.push(`ftp_proxy=socks5h://localhost:${socksProxyPort}`);
        env.push(`RSYNC_PROXY=localhost:${socksProxyPort}`);
        env.push(`DOCKER_HTTP_PROXY=http://localhost:${httpProxyPort || socksProxyPort}`);
        env.push(`DOCKER_HTTPS_PROXY=http://localhost:${httpProxyPort || socksProxyPort}`);
        if (httpProxyPort) {
            env.push('CLOUDSDK_PROXY_TYPE=https');
            env.push('CLOUDSDK_PROXY_ADDRESS=localhost');
            env.push(`CLOUDSDK_PROXY_PORT=${httpProxyPort}`);
        }
        env.push(`GRPC_PROXY=socks5h://localhost:${socksProxyPort}`);
        env.push(`grpc_proxy=socks5h://localhost:${socksProxyPort}`);
    }
    return env;
}
function escapeRegexForSandboxGlobPattern(pattern) {
    return ('^' +
        pattern
            .replace(/[.^$+{}()|\\]/g, '\\$&')
            .replace(/\[([^\]]*?)$/g, '\\[$1')
            .replace(/\*\*\//g, '__GLOBSTAR_SLASH__')
            .replace(/\*\*/g, '__GLOBSTAR__')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/__GLOBSTAR_SLASH__/g, '(.*/)?')
            .replace(/__GLOBSTAR__/g, '.*') +
        '$');
}
function getMacosTmpDirWriteAllowPaths() {
    const tmpdirValue = process.env.TMPDIR;
    if (!tmpdirValue)
        return [];
    if (!tmpdirValue.match(/^\/(private\/)?var\/folders\/[^/]{2}\/[^/]+\/T\/?$/))
        return [];
    const base = tmpdirValue.replace(/\/T\/?$/, '');
    if (base.startsWith('/private/var/'))
        return [base, base.replace('/private', '')];
    if (base.startsWith('/var/'))
        return [base, '/private' + base];
    return [base];
}
function buildMacosSandboxDenyUnlinkRules(paths, logTag) {
    const lines = [];
    for (const raw of paths) {
        const normalized = normalizeLinuxSandboxPath(raw);
        if (hasGlobPattern(normalized)) {
            const regex = escapeRegexForSandboxGlobPattern(normalized);
            lines.push('(deny file-write-unlink', `  (regex ${JSON.stringify(regex)})`, `  (with message "${logTag}"))`);
            const prefix = normalized.split(/[*?[\]]/)[0];
            if (prefix && prefix !== '/') {
                const literal = prefix.endsWith('/')
                    ? prefix.slice(0, -1)
                    : dirname(prefix);
                lines.push('(deny file-write-unlink', `  (literal ${JSON.stringify(literal)})`, `  (with message "${logTag}"))`);
            }
            continue;
        }
        lines.push('(deny file-write-unlink', `  (subpath ${JSON.stringify(normalized)})`, `  (with message "${logTag}"))`);
    }
    return lines;
}
function buildMacosSandboxFileReadRules(readConfig, logTag) {
    if (!readConfig)
        return ['(allow file-read*)'];
    const lines = ['(allow file-read*)'];
    for (const raw of readConfig.denyOnly ?? []) {
        const normalized = normalizeLinuxSandboxPath(raw);
        if (hasGlobPattern(normalized)) {
            const regex = escapeRegexForSandboxGlobPattern(normalized);
            lines.push('(deny file-read*', `  (regex ${JSON.stringify(regex)})`, `  (with message "${logTag}"))`);
        }
        else {
            lines.push('(deny file-read*', `  (subpath ${JSON.stringify(normalized)})`, `  (with message "${logTag}"))`);
        }
    }
    lines.push(...buildMacosSandboxDenyUnlinkRules(readConfig.denyOnly ?? [], logTag));
    return lines;
}
function buildMacosSandboxFileWriteRules(writeConfig, logTag) {
    if (!writeConfig)
        return ['(allow file-write*)'];
    const lines = [];
    lines.push('(allow file-write*', `  (literal "/dev/null")`, `  (with message "${logTag}"))`);
    for (const raw of getMacosTmpDirWriteAllowPaths()) {
        const normalized = normalizeLinuxSandboxPath(raw);
        lines.push('(allow file-write*', `  (subpath ${JSON.stringify(normalized)})`, `  (with message "${logTag}"))`);
    }
    for (const raw of writeConfig.allowOnly ?? []) {
        const normalized = normalizeLinuxSandboxPath(raw);
        if (hasGlobPattern(normalized)) {
            const regex = escapeRegexForSandboxGlobPattern(normalized);
            lines.push('(allow file-write*', `  (regex ${JSON.stringify(regex)})`, `  (with message "${logTag}"))`);
        }
        else {
            lines.push('(allow file-write*', `  (subpath ${JSON.stringify(normalized)})`, `  (with message "${logTag}"))`);
        }
    }
    for (const raw of writeConfig.denyWithinAllow ?? []) {
        const normalized = normalizeLinuxSandboxPath(raw);
        if (hasGlobPattern(normalized)) {
            const regex = escapeRegexForSandboxGlobPattern(normalized);
            lines.push('(deny file-write*', `  (regex ${JSON.stringify(regex)})`, `  (with message "${logTag}"))`);
        }
        else {
            lines.push('(deny file-write*', `  (subpath ${JSON.stringify(normalized)})`, `  (with message "${logTag}"))`);
        }
    }
    lines.push(...buildMacosSandboxDenyUnlinkRules(writeConfig.denyWithinAllow ?? [], logTag));
    return lines;
}
export function buildMacosSandboxExecCommand(options) {
    const logTag = 'KODE_SANDBOX';
    const profileLines = [
        '(version 1)',
        `(deny default (with message "${logTag}"))`,
        '',
        '; Kode sandbox-exec profile (reference CLI compatible)',
        '',
        '(allow process*)',
        '(allow sysctl-read)',
        '(allow mach-lookup)',
        '',
        '; Network',
    ];
    const allowUnixSockets = options.allowUnixSockets ?? [];
    if (!options.needsNetworkRestriction) {
        profileLines.push('(allow network*)');
    }
    else {
        if (options.allowLocalBinding) {
            profileLines.push('(allow network-bind (local ip "localhost:*"))');
            profileLines.push('(allow network-inbound (local ip "localhost:*"))');
            profileLines.push('(allow network-outbound (local ip "localhost:*"))');
        }
        if (options.allowAllUnixSockets) {
            profileLines.push('(allow network* (subpath "/"))');
        }
        else if (allowUnixSockets.length > 0) {
            for (const socketPath of allowUnixSockets) {
                const normalized = normalizeLinuxSandboxPath(socketPath);
                profileLines.push(`(allow network* (subpath ${JSON.stringify(normalized)}))`);
            }
        }
        if (options.httpProxyPort !== undefined) {
            profileLines.push(`(allow network-bind (local ip "localhost:${options.httpProxyPort}"))`);
            profileLines.push(`(allow network-inbound (local ip "localhost:${options.httpProxyPort}"))`);
            profileLines.push(`(allow network-outbound (remote ip "localhost:${options.httpProxyPort}"))`);
        }
        if (options.socksProxyPort !== undefined) {
            profileLines.push(`(allow network-bind (local ip "localhost:${options.socksProxyPort}"))`);
            profileLines.push(`(allow network-inbound (local ip "localhost:${options.socksProxyPort}"))`);
            profileLines.push(`(allow network-outbound (remote ip "localhost:${options.socksProxyPort}"))`);
        }
    }
    profileLines.push('');
    profileLines.push('; File read');
    profileLines.push(...buildMacosSandboxFileReadRules(options.readConfig, logTag));
    profileLines.push('');
    profileLines.push('; File write');
    profileLines.push(...buildMacosSandboxFileWriteRules(options.writeConfig, logTag));
    const profile = profileLines.join('\n');
    const envAssignments = buildSandboxEnvAssignments({
        httpProxyPort: options.httpProxyPort,
        socksProxyPort: options.socksProxyPort,
        platform: 'darwin',
    });
    const envPrefix = envAssignments.length
        ? `export ${envAssignments.join(' ')} && `
        : '';
    return [
        options.sandboxExecPath,
        '-p',
        profile,
        options.binShellPath,
        '-c',
        `${envPrefix}${options.command}`,
    ];
}
export function renderBackgroundShellStatusAttachment(attachment) {
    const parts = [];
    if (attachment.stdoutLineDelta > 0) {
        const n = attachment.stdoutLineDelta;
        parts.push(`${n} line${n > 1 ? 's' : ''} of stdout`);
    }
    if (attachment.stderrLineDelta > 0) {
        const n = attachment.stderrLineDelta;
        parts.push(`${n} line${n > 1 ? 's' : ''} of stderr`);
    }
    if (parts.length === 0)
        return '';
    return `Background bash ${attachment.taskId} has new output: ${parts.join(', ')}. Read ${attachment.outputFile} to see output.`;
}
export function renderBashNotification(notification) {
    const status = notification.status;
    const exitCode = notification.exitCode;
    const summarySuffix = status === 'completed'
        ? `completed${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}`
        : status === 'failed'
            ? `failed${exitCode !== undefined ? ` with exit code ${exitCode}` : ''}`
            : 'was killed';
    return [
        '<bash-notification>',
        `<shell-id>${notification.taskId}</shell-id>`,
        `<output-file>${notification.outputFile}</output-file>`,
        `<status>${status}</status>`,
        `<summary>Background command "${notification.description}" ${summarySuffix}.</summary>`,
        'Read the output file to retrieve the output.',
        '</bash-notification>',
    ].join('\n');
}
export class BunShell {
    cwd;
    isAlive = true;
    currentProcess = null;
    abortController = null;
    backgroundProcesses = new Map();
    constructor(cwd) {
        this.cwd = cwd;
    }
    static instance = null;
    static restart() {
        if (BunShell.instance) {
            BunShell.instance.close();
            BunShell.instance = null;
        }
    }
    static getInstance() {
        if (!BunShell.instance || !BunShell.instance.isAlive) {
            BunShell.instance = new BunShell(process.cwd());
        }
        return BunShell.instance;
    }
    static getShellCmdForPlatform(platform, command, env = process.env) {
        if (platform === 'win32') {
            const comspec = typeof env.ComSpec === 'string' && env.ComSpec.length > 0
                ? env.ComSpec
                : 'cmd';
            return [comspec, '/c', command];
        }
        const sh = existsSync('/bin/sh') ? '/bin/sh' : 'sh';
        return [sh, '-c', command];
    }
    getShellCmd(command) {
        return BunShell.getShellCmdForPlatform(process.platform, command, process.env);
    }
    buildSandboxCmd(command, sandbox) {
        if (!sandbox.enabled)
            return null;
        const platform = sandbox.__platformOverride ?? process.platform;
        const needsNetworkRestriction = sandbox.needsNetworkRestriction !== undefined
            ? sandbox.needsNetworkRestriction
            : sandbox.allowNetwork === true
                ? false
                : true;
        const writeConfig = sandbox.writeConfig ??
            (sandbox.writableRoots && sandbox.writableRoots.length > 0
                ? { allowOnly: sandbox.writableRoots.filter(Boolean) }
                : undefined);
        const readConfig = sandbox.readConfig;
        const hasReadRestrictions = (readConfig?.denyOnly?.length ?? 0) > 0;
        const hasWriteRestrictions = writeConfig !== undefined;
        const hasNetworkRestrictions = needsNetworkRestriction === true;
        if (!hasReadRestrictions &&
            !hasWriteRestrictions &&
            !hasNetworkRestrictions) {
            return null;
        }
        const binShell = sandbox.binShell ?? (whichSync('bash') ? 'bash' : 'sh');
        const binShellPath = whichOrSelf(binShell);
        const cwd = sandbox.chdir || this.cwd;
        if (platform === 'linux') {
            const bwrapPath = sandbox.__bwrapPathOverride !== undefined
                ? sandbox.__bwrapPathOverride
                : (whichSync('bwrap') ?? whichSync('bubblewrap'));
            if (!bwrapPath) {
                return null;
            }
            try {
                mkdirSync('/tmp/kode', { recursive: true });
            }
            catch { }
            const cmd = buildLinuxBwrapCommand({
                bwrapPath,
                command,
                needsNetworkRestriction,
                readConfig,
                writeConfig,
                enableWeakerNestedSandbox: sandbox.enableWeakerNestedSandbox,
                binShellPath,
                cwd,
            });
            return { cmd };
        }
        if (platform === 'darwin') {
            const sandboxExecPath = sandbox.__sandboxExecPathOverride !== undefined
                ? sandbox.__sandboxExecPathOverride
                : existsSync('/usr/bin/sandbox-exec')
                    ? '/usr/bin/sandbox-exec'
                    : whichSync('sandbox-exec');
            if (!sandboxExecPath) {
                return null;
            }
            try {
                mkdirSync('/tmp/kode', { recursive: true });
            }
            catch { }
            try {
                mkdirSync('/private/tmp/kode', { recursive: true });
            }
            catch { }
            return {
                cmd: buildMacosSandboxExecCommand({
                    sandboxExecPath,
                    binShellPath,
                    command,
                    needsNetworkRestriction,
                    httpProxyPort: sandbox.httpProxyPort,
                    socksProxyPort: sandbox.socksProxyPort,
                    allowUnixSockets: sandbox.allowUnixSockets,
                    allowAllUnixSockets: sandbox.allowAllUnixSockets,
                    allowLocalBinding: sandbox.allowLocalBinding,
                    readConfig,
                    writeConfig,
                }),
            };
        }
        return null;
    }
    isSandboxInitFailure(stderr) {
        const s = stderr.toLowerCase();
        return (s.includes('bwrap:') ||
            s.includes('bubblewrap') ||
            (s.includes('namespace') && s.includes('failed')));
    }
    startStreamReader(stream, append) {
        if (!stream)
            return;
        try {
            ;
            stream.setEncoding?.('utf8');
        }
        catch { }
        stream.on('data', chunk => {
            append(typeof chunk === 'string'
                ? chunk
                : Buffer.isBuffer(chunk)
                    ? chunk.toString('utf8')
                    : String(chunk));
        });
        stream.on('error', err => {
            logError(`Stream read error: ${err}`);
        });
    }
    createCancellableTextCollector(stream, options) {
        let text = '';
        const collectText = options?.collectText !== false;
        if (!stream) {
            return {
                getText: () => text,
                done: Promise.resolve(),
                cancel: async () => { },
            };
        }
        let cancelled = false;
        let resolveDone = null;
        const done = new Promise(resolve => {
            resolveDone = resolve;
        });
        const finish = () => {
            if (!resolveDone)
                return;
            resolveDone();
            resolveDone = null;
        };
        const onData = (chunk) => {
            if (cancelled)
                return;
            const s = typeof chunk === 'string'
                ? chunk
                : Buffer.isBuffer(chunk)
                    ? chunk.toString('utf8')
                    : String(chunk);
            if (collectText)
                text += s;
            options?.onChunk?.(s);
        };
        const onEnd = () => {
            cleanup();
            finish();
        };
        const onClose = () => {
            cleanup();
            finish();
        };
        const cleanup = () => {
            stream.off('data', onData);
            stream.off('end', onEnd);
            stream.off('close', onClose);
            stream.off('error', onError);
        };
        const onError = (err) => {
            if (!cancelled) {
                logError(`Stream read error: ${err}`);
            }
            cleanup();
            finish();
        };
        try {
            ;
            stream.setEncoding?.('utf8');
        }
        catch { }
        stream.on('data', onData);
        stream.once('end', onEnd);
        stream.once('close', onClose);
        stream.once('error', onError);
        return {
            getText: () => text,
            done,
            cancel: async () => {
                if (cancelled)
                    return;
                cancelled = true;
                cleanup();
                finish();
            },
        };
    }
    static makeBackgroundTaskId() {
        return `b${randomUUID().replace(/-/g, '').slice(0, 6)}`;
    }
    execPromotable(command, abortSignal, timeout, options) {
        const DEFAULT_TIMEOUT = 120_000;
        const commandTimeout = timeout ?? DEFAULT_TIMEOUT;
        const startedAt = Date.now();
        const sandbox = options?.sandbox;
        const shouldAttemptSandbox = sandbox?.enabled === true;
        const executionCwd = shouldAttemptSandbox && sandbox?.chdir ? sandbox.chdir : this.cwd;
        if (abortSignal?.aborted) {
            return {
                get status() {
                    return 'killed';
                },
                background: () => null,
                kill: () => { },
                result: Promise.resolve({
                    stdout: '',
                    stderr: 'Command aborted before execution',
                    code: 145,
                    interrupted: true,
                }),
            };
        }
        const sandboxCmd = shouldAttemptSandbox
            ? this.buildSandboxCmd(command, sandbox)
            : null;
        if (shouldAttemptSandbox && sandbox?.require && !sandboxCmd) {
            return {
                get status() {
                    return 'killed';
                },
                background: () => null,
                kill: () => { },
                result: Promise.resolve({
                    stdout: '',
                    stderr: 'System sandbox is required but unavailable (missing bubblewrap or unsupported platform).',
                    code: 2,
                    interrupted: false,
                }),
            };
        }
        const cmdToRun = sandboxCmd ? sandboxCmd.cmd : this.getShellCmd(command);
        const internalAbortController = new AbortController();
        this.abortController = internalAbortController;
        let status = 'running';
        let backgroundProcess = null;
        let backgroundTaskId = null;
        let stdout = '';
        let stderr = '';
        let wasAborted = false;
        let wasBackgrounded = false;
        let timeoutHandle = null;
        let timedOut = false;
        let onTimeoutCb = null;
        const countNonEmptyLines = (chunk) => chunk.split('\n').filter(line => line.length > 0).length;
        const spawnedProcess = spawnWithExited({ cmd: cmdToRun, cwd: executionCwd });
        this.currentProcess = spawnedProcess;
        const onAbort = () => {
            if (status === 'backgrounded')
                return;
            wasAborted = true;
            try {
                internalAbortController.abort();
            }
            catch { }
            try {
                spawnedProcess.kill();
            }
            catch { }
            if (backgroundProcess)
                backgroundProcess.interrupted = true;
        };
        const clearForegroundGuards = () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            if (abortSignal) {
                abortSignal.removeEventListener('abort', onAbort);
            }
        };
        if (abortSignal) {
            abortSignal.addEventListener('abort', onAbort, { once: true });
            if (abortSignal.aborted)
                onAbort();
        }
        const stdoutCollector = this.createCancellableTextCollector(spawnedProcess.stdout, {
            collectText: false,
            onChunk: chunk => {
                stdout += chunk;
                options?.onStdoutChunk?.(chunk);
                if (backgroundProcess) {
                    backgroundProcess.stdout = stdout;
                    appendTaskOutput(backgroundProcess.id, chunk);
                    backgroundProcess.stdoutLineCount += countNonEmptyLines(chunk);
                }
            },
        });
        const stderrCollector = this.createCancellableTextCollector(spawnedProcess.stderr, {
            collectText: false,
            onChunk: chunk => {
                stderr += chunk;
                options?.onStderrChunk?.(chunk);
                if (backgroundProcess) {
                    backgroundProcess.stderr = stderr;
                    appendTaskOutput(backgroundProcess.id, chunk);
                    backgroundProcess.stderrLineCount += countNonEmptyLines(chunk);
                }
            },
        });
        timeoutHandle = setTimeout(() => {
            if (status !== 'running')
                return;
            if (onTimeoutCb) {
                onTimeoutCb(background);
                return;
            }
            timedOut = true;
            try {
                spawnedProcess.kill();
            }
            catch { }
            try {
                internalAbortController.abort();
            }
            catch { }
        }, commandTimeout);
        const background = (bashId) => {
            if (backgroundTaskId)
                return { bashId: backgroundTaskId };
            if (status !== 'running')
                return null;
            backgroundTaskId = bashId ?? BunShell.makeBackgroundTaskId();
            const outputFile = touchTaskOutputFile(backgroundTaskId);
            if (stdout)
                appendTaskOutput(backgroundTaskId, stdout);
            if (stderr)
                appendTaskOutput(backgroundTaskId, stderr);
            status = 'backgrounded';
            wasBackgrounded = true;
            clearForegroundGuards();
            backgroundProcess = {
                id: backgroundTaskId,
                command,
                stdout,
                stderr,
                stdoutCursor: 0,
                stderrCursor: 0,
                stdoutLineCount: countNonEmptyLines(stdout),
                stderrLineCount: countNonEmptyLines(stderr),
                lastReportedStdoutLines: 0,
                lastReportedStderrLines: 0,
                code: null,
                interrupted: false,
                killed: false,
                timedOut: false,
                completionStatusSentInAttachment: false,
                notified: false,
                startedAt,
                timeoutAt: Number.POSITIVE_INFINITY,
                process: spawnedProcess,
                abortController: internalAbortController,
                timeoutHandle: null,
                cwd: executionCwd,
                outputFile,
            };
            this.backgroundProcesses.set(backgroundTaskId, backgroundProcess);
            this.currentProcess = null;
            this.abortController = null;
            return { bashId: backgroundTaskId };
        };
        const kill = () => {
            status = 'killed';
            try {
                spawnedProcess.kill();
            }
            catch { }
            try {
                internalAbortController.abort();
            }
            catch { }
            if (backgroundProcess) {
                backgroundProcess.interrupted = true;
                backgroundProcess.killed = true;
            }
        };
        const result = (async () => {
            try {
                await spawnedProcess.exited;
                if (status === 'running' || status === 'backgrounded')
                    status = 'completed';
                if (backgroundProcess) {
                    backgroundProcess.code = spawnedProcess.exitCode ?? 0;
                    backgroundProcess.interrupted =
                        backgroundProcess.interrupted ||
                            wasAborted ||
                            internalAbortController.signal.aborted;
                }
                if (!wasBackgrounded) {
                    await Promise.race([
                        Promise.allSettled([stdoutCollector.done, stderrCollector.done]),
                        new Promise(resolve => setTimeout(resolve, 250)),
                    ]);
                    await Promise.allSettled([
                        stdoutCollector.cancel(),
                        stderrCollector.cancel(),
                    ]);
                }
                const interrupted = wasAborted ||
                    abortSignal?.aborted === true ||
                    internalAbortController.signal.aborted === true ||
                    timedOut;
                let code = spawnedProcess.exitCode;
                if (!Number.isFinite(code)) {
                    code = interrupted ? 143 : 0;
                }
                const stderrWithTimeout = timedOut
                    ? [`Command timed out`, stderr].filter(Boolean).join('\n')
                    : stderr;
                const stderrAnnotated = sandboxCmd
                    ? maybeAnnotateMacosSandboxStderr(stderrWithTimeout, sandbox)
                    : stderrWithTimeout;
                return {
                    stdout,
                    stderr: stderrAnnotated,
                    code: code,
                    interrupted,
                };
            }
            finally {
                clearForegroundGuards();
                if (this.currentProcess === spawnedProcess) {
                    this.currentProcess = null;
                    this.abortController = null;
                }
            }
        })();
        const execHandle = {
            get status() {
                return status;
            },
            background,
            kill,
            result,
        };
        execHandle.onTimeout = cb => {
            onTimeoutCb = cb;
        };
        result
            .then(r => {
            if (!backgroundProcess || !backgroundTaskId)
                return;
            backgroundProcess.code = r.code;
            backgroundProcess.interrupted = r.interrupted;
        })
            .catch(() => {
            if (!backgroundProcess)
                return;
            backgroundProcess.code = backgroundProcess.code ?? 2;
        });
        return execHandle;
    }
    async exec(command, abortSignal, timeout, options) {
        const DEFAULT_TIMEOUT = 120_000;
        const commandTimeout = timeout ?? DEFAULT_TIMEOUT;
        this.abortController = new AbortController();
        let wasAborted = false;
        const onAbort = () => {
            wasAborted = true;
            try {
                this.abortController?.abort();
            }
            catch { }
            try {
                this.currentProcess?.kill();
            }
            catch { }
        };
        if (abortSignal) {
            abortSignal.addEventListener('abort', onAbort, { once: true });
        }
        const sandbox = options?.sandbox;
        const shouldAttemptSandbox = sandbox?.enabled === true;
        const executionCwd = shouldAttemptSandbox && sandbox?.chdir ? sandbox.chdir : this.cwd;
        const runOnce = async (cmd, cwdOverride) => {
            this.currentProcess = spawnWithExited({
                cmd,
                cwd: cwdOverride ?? executionCwd,
            });
            const stdoutCollector = this.createCancellableTextCollector(this.currentProcess.stdout, { onChunk: options?.onStdoutChunk });
            const stderrCollector = this.createCancellableTextCollector(this.currentProcess.stderr, { onChunk: options?.onStderrChunk });
            let timeoutHandle = null;
            const timeoutPromise = new Promise(resolve => {
                timeoutHandle = setTimeout(() => resolve('timeout'), commandTimeout);
            });
            const result = await Promise.race([
                this.currentProcess.exited.then(() => 'completed'),
                timeoutPromise,
            ]);
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
            if (result === 'timeout') {
                try {
                    this.currentProcess.kill();
                }
                catch { }
                try {
                    this.abortController.abort();
                }
                catch { }
                try {
                    await this.currentProcess.exited;
                }
                catch { }
                await Promise.race([
                    Promise.allSettled([stdoutCollector.done, stderrCollector.done]),
                    new Promise(resolve => setTimeout(resolve, 250)),
                ]);
                await Promise.allSettled([
                    stdoutCollector.cancel(),
                    stderrCollector.cancel(),
                ]);
                return {
                    stdout: '',
                    stderr: 'Command timed out',
                    code: 143,
                    interrupted: true,
                };
            }
            await Promise.race([
                Promise.allSettled([stdoutCollector.done, stderrCollector.done]),
                new Promise(resolve => setTimeout(resolve, 250)),
            ]);
            await Promise.allSettled([
                stdoutCollector.cancel(),
                stderrCollector.cancel(),
            ]);
            const stdout = stdoutCollector.getText();
            const stderr = stderrCollector.getText();
            const interrupted = wasAborted ||
                abortSignal?.aborted === true ||
                this.abortController?.signal.aborted === true;
            const exitCode = this.currentProcess.exitCode ?? (interrupted ? 143 : 0);
            return {
                stdout,
                stderr,
                code: exitCode,
                interrupted,
            };
        };
        try {
            if (shouldAttemptSandbox) {
                const sandboxCmd = this.buildSandboxCmd(command, sandbox);
                if (!sandboxCmd) {
                    if (sandbox?.require) {
                        return {
                            stdout: '',
                            stderr: 'System sandbox is required but unavailable (missing bubblewrap or unsupported platform).',
                            code: 2,
                            interrupted: false,
                        };
                    }
                    const fallback = await runOnce(this.getShellCmd(command));
                    return {
                        ...fallback,
                        stderr: `[sandbox] unavailable, ran without isolation.\n${fallback.stderr}`.trim(),
                    };
                }
                const sandboxed = await runOnce(sandboxCmd.cmd);
                sandboxed.stderr = maybeAnnotateMacosSandboxStderr(sandboxed.stderr, sandbox);
                if (!sandboxed.interrupted &&
                    sandboxed.code !== 0 &&
                    this.isSandboxInitFailure(sandboxed.stderr) &&
                    !sandbox?.require) {
                    const fallback = await runOnce(this.getShellCmd(command));
                    return {
                        ...fallback,
                        stderr: `[sandbox] failed to start, ran without isolation.\n${fallback.stderr}`.trim(),
                    };
                }
                return sandboxed;
            }
            return await runOnce(this.getShellCmd(command));
        }
        catch (error) {
            if (this.abortController.signal.aborted) {
                this.currentProcess?.kill();
                return {
                    stdout: '',
                    stderr: 'Command was interrupted',
                    code: 143,
                    interrupted: true,
                };
            }
            const errorStr = error instanceof Error ? error.message : String(error);
            logError(`Shell execution error: ${errorStr}`);
            return {
                stdout: '',
                stderr: errorStr,
                code: 2,
                interrupted: false,
            };
        }
        finally {
            if (abortSignal) {
                abortSignal.removeEventListener('abort', onAbort);
            }
            this.currentProcess = null;
            this.abortController = null;
        }
    }
    execInBackground(command, timeout, options) {
        const DEFAULT_TIMEOUT = 120_000;
        const commandTimeout = timeout ?? DEFAULT_TIMEOUT;
        const abortController = new AbortController();
        const sandbox = options?.sandbox;
        const sandboxCmd = sandbox?.enabled === true ? this.buildSandboxCmd(command, sandbox) : null;
        const executionCwd = sandbox?.enabled === true && sandbox?.chdir ? sandbox.chdir : this.cwd;
        if (sandbox?.enabled === true && sandbox?.require && !sandboxCmd) {
            throw new Error('System sandbox is required but unavailable (missing bubblewrap or unsupported platform).');
        }
        const cmdToRun = sandboxCmd ? sandboxCmd.cmd : this.getShellCmd(command);
        const bashId = BunShell.makeBackgroundTaskId();
        const outputFile = touchTaskOutputFile(bashId);
        const process = spawnWithExited({ cmd: cmdToRun, cwd: executionCwd });
        const timeoutHandle = setTimeout(() => {
            abortController.abort();
            backgroundProcess.timedOut = true;
            process.kill();
        }, commandTimeout);
        const backgroundProcess = {
            id: bashId,
            command,
            stdout: '',
            stderr: '',
            stdoutCursor: 0,
            stderrCursor: 0,
            stdoutLineCount: 0,
            stderrLineCount: 0,
            lastReportedStdoutLines: 0,
            lastReportedStderrLines: 0,
            code: null,
            interrupted: false,
            killed: false,
            timedOut: false,
            completionStatusSentInAttachment: false,
            notified: false,
            startedAt: Date.now(),
            timeoutAt: Date.now() + commandTimeout,
            process,
            abortController,
            timeoutHandle,
            cwd: executionCwd,
            outputFile,
        };
        const countNonEmptyLines = (chunk) => chunk.split('\n').filter(line => line.length > 0).length;
        this.startStreamReader(process.stdout, chunk => {
            backgroundProcess.stdout += chunk;
            appendTaskOutput(bashId, chunk);
            backgroundProcess.stdoutLineCount += countNonEmptyLines(chunk);
        });
        this.startStreamReader(process.stderr, chunk => {
            backgroundProcess.stderr += chunk;
            appendTaskOutput(bashId, chunk);
            backgroundProcess.stderrLineCount += countNonEmptyLines(chunk);
        });
        process.exited.then(() => {
            backgroundProcess.code = process.exitCode ?? 0;
            backgroundProcess.interrupted =
                backgroundProcess.interrupted || abortController.signal.aborted;
            if (sandbox?.enabled === true) {
                backgroundProcess.stderr = maybeAnnotateMacosSandboxStderr(backgroundProcess.stderr, sandbox);
            }
            if (backgroundProcess.timeoutHandle) {
                clearTimeout(backgroundProcess.timeoutHandle);
                backgroundProcess.timeoutHandle = null;
            }
        });
        this.backgroundProcesses.set(bashId, backgroundProcess);
        return { bashId };
    }
    getBackgroundOutput(shellId) {
        const proc = this.backgroundProcesses.get(shellId);
        if (!proc)
            return null;
        const running = proc.code === null && !proc.interrupted;
        return {
            stdout: proc.stdout,
            stderr: proc.stderr,
            code: proc.code,
            interrupted: proc.interrupted,
            killed: proc.killed,
            timedOut: proc.timedOut,
            running,
            command: proc.command,
            cwd: proc.cwd,
            startedAt: proc.startedAt,
            timeoutAt: proc.timeoutAt,
            outputFile: proc.outputFile,
        };
    }
    readBackgroundOutput(bashId, options) {
        const proc = this.backgroundProcesses.get(bashId);
        if (!proc)
            return null;
        const stdoutDelta = proc.stdout.slice(proc.stdoutCursor);
        const stderrDelta = proc.stderr.slice(proc.stderrCursor);
        proc.stdoutCursor = proc.stdout.length;
        proc.stderrCursor = proc.stderr.length;
        const stdoutLines = stdoutDelta === '' ? 0 : stdoutDelta.split('\n').length;
        const stderrLines = stderrDelta === '' ? 0 : stderrDelta.split('\n').length;
        let stdoutToReturn = stdoutDelta;
        let stderrToReturn = stderrDelta;
        const filter = options?.filter?.trim();
        if (filter) {
            const regex = new RegExp(filter, 'i');
            stdoutToReturn = stdoutDelta
                .split('\n')
                .filter(line => regex.test(line))
                .join('\n');
            stderrToReturn = stderrDelta
                .split('\n')
                .filter(line => regex.test(line))
                .join('\n');
        }
        const status = proc.killed
            ? 'killed'
            : proc.code === null
                ? 'running'
                : proc.code === 0
                    ? 'completed'
                    : 'failed';
        return {
            shellId: bashId,
            command: proc.command,
            cwd: proc.cwd,
            startedAt: proc.startedAt,
            timeoutAt: proc.timeoutAt,
            status,
            exitCode: proc.code,
            stdout: stdoutToReturn,
            stderr: stderrToReturn,
            stdoutLines,
            stderrLines,
            ...(filter ? { filterPattern: filter } : {}),
        };
    }
    killBackgroundShell(shellId) {
        const proc = this.backgroundProcesses.get(shellId);
        if (!proc)
            return false;
        try {
            proc.interrupted = true;
            proc.killed = true;
            proc.abortController.abort();
            proc.process.kill();
            if (proc.timeoutHandle) {
                clearTimeout(proc.timeoutHandle);
                proc.timeoutHandle = null;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    listBackgroundShells() {
        return Array.from(this.backgroundProcesses.values());
    }
    pwd() {
        return this.cwd;
    }
    async setCwd(cwd) {
        const resolved = isAbsolute(cwd) ? cwd : resolve(this.cwd, cwd);
        if (!existsSync(resolved)) {
            throw new Error(`Path "${resolved}" does not exist`);
        }
        this.cwd = resolved;
    }
    killChildren() {
        this.abortController?.abort();
        this.currentProcess?.kill();
        for (const bg of Array.from(this.backgroundProcesses.keys())) {
            this.killBackgroundShell(bg);
        }
    }
    close() {
        this.isAlive = false;
        this.killChildren();
    }
    flushBashNotifications() {
        const processes = Array.from(this.backgroundProcesses.values());
        const statusFor = (proc) => proc.killed
            ? 'killed'
            : proc.code === null
                ? 'running'
                : proc.code === 0
                    ? 'completed'
                    : 'failed';
        const notifications = [];
        for (const proc of processes) {
            if (proc.notified)
                continue;
            const status = statusFor(proc);
            if (status === 'running')
                continue;
            notifications.push({
                type: 'bash_notification',
                taskId: proc.id,
                description: proc.command,
                outputFile: proc.outputFile || getTaskOutputFilePath(proc.id),
                status,
                ...(proc.code !== null ? { exitCode: proc.code } : {}),
            });
            proc.notified = true;
        }
        return notifications;
    }
    flushBackgroundShellStatusAttachments() {
        const processes = Array.from(this.backgroundProcesses.values());
        const statusFor = (proc) => proc.killed
            ? 'killed'
            : proc.code === null
                ? 'running'
                : proc.code === 0
                    ? 'completed'
                    : 'failed';
        const progressAttachments = [];
        for (const proc of processes) {
            if (statusFor(proc) !== 'running')
                continue;
            const stdoutDelta = proc.stdoutLineCount - proc.lastReportedStdoutLines;
            const stderrDelta = proc.stderrLineCount - proc.lastReportedStderrLines;
            if (stdoutDelta === 0 && stderrDelta === 0)
                continue;
            proc.lastReportedStdoutLines = proc.stdoutLineCount;
            proc.lastReportedStderrLines = proc.stderrLineCount;
            progressAttachments.push({
                type: 'task_progress',
                taskId: proc.id,
                stdoutLineDelta: stdoutDelta,
                stderrLineDelta: stderrDelta,
                outputFile: proc.outputFile || getTaskOutputFilePath(proc.id),
            });
        }
        return progressAttachments;
    }
}
//# sourceMappingURL=shell.js.map