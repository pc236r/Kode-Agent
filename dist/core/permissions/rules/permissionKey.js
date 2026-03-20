import { BashTool } from '@tools/BashTool/BashTool';
import { SkillTool } from '@tools/ai/SkillTool/SkillTool';
import { SlashCommandTool } from '@tools/interaction/SlashCommandTool/SlashCommandTool';
import { WebFetchTool } from '@tools/network/WebFetchTool/WebFetchTool';
import { WebSearchTool } from '@tools/network/WebSearchTool/WebSearchTool';
export function getPermissionKey(tool, input, prefix) {
    switch (tool) {
        case BashTool:
            if (prefix) {
                return `${BashTool.name}(${prefix}:*)`;
            }
            return `${BashTool.name}(${typeof input.command === 'string' ? String(input.command).trim() : ''})`;
        case WebFetchTool: {
            try {
                const schema = WebFetchTool.inputSchema;
                const parsed = schema?.safeParse
                    ? schema.safeParse(input)
                    : { success: false };
                if (!parsed.success) {
                    return `${WebFetchTool.name}(input:${String(input)})`;
                }
                const url = parsed.data.url;
                return `${WebFetchTool.name}(domain:${new URL(url).hostname})`;
            }
            catch {
                return `${WebFetchTool.name}(input:${String(input)})`;
            }
        }
        case WebSearchTool: {
            const query = typeof input.query === 'string'
                ? String(input.query).trim()
                : '';
            if (!query)
                return WebSearchTool.name;
            return `${WebSearchTool.name}(${query})`;
        }
        case SlashCommandTool: {
            const command = typeof input.command === 'string' ? input.command.trim() : '';
            if (prefix) {
                return `${SlashCommandTool.name}(${prefix}:*)`;
            }
            return `${SlashCommandTool.name}(${command})`;
        }
        case SkillTool: {
            const raw = typeof input.skill === 'string' ? input.skill : '';
            const skill = raw.trim().replace(/^\//, '');
            if (prefix) {
                const p = prefix.trim().replace(/^\//, '');
                return `${SkillTool.name}(${p}:*)`;
            }
            return `${SkillTool.name}(${skill})`;
        }
        default:
            return tool.name;
    }
}
//# sourceMappingURL=permissionKey.js.map