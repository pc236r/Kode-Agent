import { getCurrentProjectConfig, getGlobalConfig, getProjectMcpServerDefinitions, saveCurrentProjectConfig, saveGlobalConfig, addMcprcServerForTesting, removeMcprcServerForTesting, } from '@utils/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getCwd } from '@utils/state';
import { safeParseJSON } from '@utils/text/json';
import { getSessionPlugins } from '@utils/session/sessionPlugins';
import { parseJsonOrJsonc } from './internal/jsonc';
function expandTemplateString(value, pluginRoot) {
    return value.replace(/\$\{([^}]+)\}/g, (match, key) => {
        const k = String(key ?? '').trim();
        if (!k)
            return match;
        if (k === 'CLAUDE_PLUGIN_ROOT')
            return pluginRoot;
        const env = process.env[k];
        return env !== undefined ? env : match;
    });
}
function expandTemplateDeep(value, pluginRoot) {
    if (typeof value === 'string')
        return expandTemplateString(value, pluginRoot);
    if (Array.isArray(value))
        return value.map(v => expandTemplateDeep(v, pluginRoot));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = expandTemplateDeep(v, pluginRoot);
        }
        return out;
    }
    return value;
}
export function listPluginMCPServers() {
    const plugins = getSessionPlugins();
    if (plugins.length === 0)
        return {};
    const out = {};
    for (const plugin of plugins) {
        const pluginRoot = plugin.rootDir;
        const pluginName = plugin.name;
        const configs = [];
        for (const configPath of plugin.mcpConfigFiles ?? []) {
            try {
                const raw = readFileSync(configPath, 'utf8');
                const parsed = parseJsonOrJsonc(raw);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                    continue;
                const rawServers = parsed.mcpServers &&
                    typeof parsed.mcpServers === 'object' &&
                    !Array.isArray(parsed.mcpServers)
                    ? parsed.mcpServers
                    : parsed;
                if (!rawServers ||
                    typeof rawServers !== 'object' ||
                    Array.isArray(rawServers))
                    continue;
                const servers = {};
                for (const [name, cfg] of Object.entries(rawServers)) {
                    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg))
                        continue;
                    servers[name] = expandTemplateDeep(cfg, pluginRoot);
                }
                configs.push(servers);
            }
            catch {
                continue;
            }
        }
        const manifestRaw = plugin.manifest?.mcpServers;
        if (manifestRaw &&
            typeof manifestRaw === 'object' &&
            !Array.isArray(manifestRaw)) {
            const rawServers = manifestRaw.mcpServers &&
                typeof manifestRaw.mcpServers === 'object' &&
                !Array.isArray(manifestRaw.mcpServers)
                ? manifestRaw.mcpServers
                : manifestRaw;
            if (rawServers &&
                typeof rawServers === 'object' &&
                !Array.isArray(rawServers)) {
                const servers = {};
                for (const [name, cfg] of Object.entries(rawServers)) {
                    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg))
                        continue;
                    servers[name] = expandTemplateDeep(cfg, pluginRoot);
                }
                configs.push(servers);
            }
        }
        const merged = Object.assign({}, ...configs);
        for (const [serverName, cfg] of Object.entries(merged)) {
            const fullName = `plugin_${pluginName}_${serverName}`;
            out[fullName] = cfg;
        }
    }
    return out;
}
export function parseEnvVars(rawEnvArgs) {
    const parsedEnv = {};
    if (rawEnvArgs) {
        for (const envStr of rawEnvArgs) {
            const [key, ...valueParts] = envStr.split('=');
            if (!key || valueParts.length === 0) {
                throw new Error(`Invalid environment variable format: ${envStr}, environment variables should be added as: -e KEY1=value1 -e KEY2=value2`);
            }
            parsedEnv[key] = valueParts.join('=');
        }
    }
    return parsedEnv;
}
const VALID_SCOPES = ['project', 'global', 'mcprc', 'mcpjson'];
const EXTERNAL_SCOPES = [
    'project',
    'global',
    'mcprc',
    'mcpjson',
];
export function ensureConfigScope(scope) {
    if (!scope)
        return 'project';
    const scopesToCheck = process.env.USER_TYPE === 'external' ? EXTERNAL_SCOPES : VALID_SCOPES;
    if (!scopesToCheck.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}. Must be one of: ${scopesToCheck.join(', ')}`);
    }
    return scope;
}
export function addMcpServer(name, server, scope = 'project') {
    if (scope === 'mcprc') {
        if (process.env.NODE_ENV === 'test') {
            addMcprcServerForTesting(name, server);
        }
        else {
            const mcprcPath = join(getCwd(), '.mcprc');
            let mcprcConfig = {};
            if (existsSync(mcprcPath)) {
                try {
                    const mcprcContent = readFileSync(mcprcPath, 'utf-8');
                    const existingConfig = safeParseJSON(mcprcContent);
                    if (existingConfig && typeof existingConfig === 'object') {
                        mcprcConfig = existingConfig;
                    }
                }
                catch { }
            }
            mcprcConfig[name] = server;
            try {
                writeFileSync(mcprcPath, JSON.stringify(mcprcConfig, null, 2), 'utf-8');
            }
            catch (error) {
                throw new Error(`Failed to write to .mcprc: ${error}`);
            }
        }
    }
    else if (scope === 'mcpjson') {
        const mcpJsonPath = join(getCwd(), '.mcp.json');
        let config = { mcpServers: {} };
        if (existsSync(mcpJsonPath)) {
            try {
                const content = readFileSync(mcpJsonPath, 'utf-8');
                const parsed = safeParseJSON(content);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    config = parsed;
                }
            }
            catch { }
        }
        const rawServers = config.mcpServers;
        const servers = rawServers && typeof rawServers === 'object' && !Array.isArray(rawServers)
            ? rawServers
            : {};
        servers[name] = server;
        config.mcpServers = servers;
        try {
            writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to write to .mcp.json: ${error}`);
        }
    }
    else if (scope === 'global') {
        const config = getGlobalConfig();
        if (!config.mcpServers) {
            config.mcpServers = {};
        }
        config.mcpServers[name] = server;
        saveGlobalConfig(config);
    }
    else {
        const config = getCurrentProjectConfig();
        if (!config.mcpServers) {
            config.mcpServers = {};
        }
        config.mcpServers[name] = server;
        saveCurrentProjectConfig(config);
    }
}
export function removeMcpServer(name, scope = 'project') {
    if (scope === 'mcprc') {
        if (process.env.NODE_ENV === 'test') {
            removeMcprcServerForTesting(name);
        }
        else {
            const mcprcPath = join(getCwd(), '.mcprc');
            if (!existsSync(mcprcPath)) {
                throw new Error('No .mcprc file found in this directory');
            }
            try {
                const mcprcContent = readFileSync(mcprcPath, 'utf-8');
                const mcprcConfig = safeParseJSON(mcprcContent);
                if (!mcprcConfig ||
                    typeof mcprcConfig !== 'object' ||
                    !mcprcConfig[name]) {
                    throw new Error(`No MCP server found with name: ${name} in .mcprc`);
                }
                delete mcprcConfig[name];
                writeFileSync(mcprcPath, JSON.stringify(mcprcConfig, null, 2), 'utf-8');
            }
            catch (error) {
                if (error instanceof Error) {
                    throw error;
                }
                throw new Error(`Failed to remove from .mcprc: ${error}`);
            }
        }
    }
    else if (scope === 'mcpjson') {
        const mcpJsonPath = join(getCwd(), '.mcp.json');
        if (!existsSync(mcpJsonPath)) {
            throw new Error('No .mcp.json file found in this directory');
        }
        try {
            const content = readFileSync(mcpJsonPath, 'utf-8');
            const parsed = safeParseJSON(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Invalid .mcp.json format');
            }
            const rawServers = parsed.mcpServers;
            if (!rawServers ||
                typeof rawServers !== 'object' ||
                Array.isArray(rawServers)) {
                throw new Error('Invalid .mcp.json format (missing mcpServers)');
            }
            const servers = rawServers;
            if (!servers[name]) {
                throw new Error(`No MCP server found with name: ${name} in .mcp.json`);
            }
            delete servers[name];
            parsed.mcpServers = servers;
            writeFileSync(mcpJsonPath, JSON.stringify(parsed, null, 2), 'utf-8');
        }
        catch (error) {
            if (error instanceof Error)
                throw error;
            throw new Error(`Failed to remove from .mcp.json: ${error}`);
        }
    }
    else if (scope === 'global') {
        const config = getGlobalConfig();
        if (!config.mcpServers?.[name]) {
            throw new Error(`No global MCP server found with name: ${name}`);
        }
        delete config.mcpServers[name];
        saveGlobalConfig(config);
    }
    else {
        const config = getCurrentProjectConfig();
        if (!config.mcpServers?.[name]) {
            throw new Error(`No local MCP server found with name: ${name}`);
        }
        delete config.mcpServers[name];
        saveCurrentProjectConfig(config);
    }
}
export function listMCPServers() {
    const pluginServers = listPluginMCPServers();
    const globalConfig = getGlobalConfig();
    const projectFileConfig = getProjectMcpServerDefinitions().servers;
    const projectConfig = getCurrentProjectConfig();
    return {
        ...(pluginServers ?? {}),
        ...(globalConfig.mcpServers ?? {}),
        ...(projectFileConfig ?? {}),
        ...(projectConfig.mcpServers ?? {}),
    };
}
export function getMcpServer(name) {
    const projectConfig = getCurrentProjectConfig();
    const projectFileDefinitions = getProjectMcpServerDefinitions();
    const projectFileConfig = projectFileDefinitions.servers;
    const globalConfig = getGlobalConfig();
    if (projectConfig.mcpServers?.[name]) {
        return { ...projectConfig.mcpServers[name], scope: 'project' };
    }
    if (projectFileConfig?.[name]) {
        const source = projectFileDefinitions.sources[name];
        const scope = source === '.mcp.json' ? 'mcpjson' : 'mcprc';
        return { ...projectFileConfig[name], scope };
    }
    if (globalConfig.mcpServers?.[name]) {
        return { ...globalConfig.mcpServers[name], scope: 'global' };
    }
    return undefined;
}
export function getMcprcServerStatus(serverName) {
    const config = getCurrentProjectConfig();
    if (config.approvedMcprcServers?.includes(serverName)) {
        return 'approved';
    }
    if (config.rejectedMcprcServers?.includes(serverName)) {
        return 'rejected';
    }
    return 'pending';
}
//# sourceMappingURL=discovery.js.map