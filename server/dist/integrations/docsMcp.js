/**
 * Google Docs MCP — publish mission reports when MISSION_DOCS skill is enabled.
 *
 * Env: DOCS_MCP_SERVER_URL, DOCS_MCP_API_KEY
 * Optional Google OAuth on MCP server: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */
export function markdownToSections(markdown) {
    const sections = [];
    const lines = markdown.split('\n');
    let currentHeading = 'Mission Debrief';
    let buffer = [];
    let inBlockquote = false;
    const flush = (style = 'paragraph') => {
        const body = buffer.join('\n').trim();
        if (body)
            sections.push({ heading: currentHeading, body, style });
        buffer = [];
    };
    for (const line of lines) {
        if (line.startsWith('# ')) {
            flush();
            currentHeading = line.slice(2).trim();
            sections.push({ heading: currentHeading, body: '', style: 'heading' });
            continue;
        }
        if (line.startsWith('## ')) {
            flush();
            currentHeading = line.slice(3).trim();
            continue;
        }
        if (line.startsWith('### ')) {
            flush();
            currentHeading = line.slice(4).trim();
            continue;
        }
        if (line.startsWith('> ')) {
            if (!inBlockquote) {
                flush();
                inBlockquote = true;
            }
            buffer.push(line.slice(2));
            continue;
        }
        if (inBlockquote && line.trim() === '') {
            flush('blockquote');
            inBlockquote = false;
            continue;
        }
        if (inBlockquote) {
            buffer.push(line);
            continue;
        }
        if (line.match(/^[-*] /)) {
            buffer.push(line);
            continue;
        }
        if (line.match(/^\d+\. /)) {
            buffer.push(line);
            continue;
        }
        if (line.trim() === '') {
            flush(buffer.some((l) => l.match(/^[-*] /)) ? 'bullet_list' : 'paragraph');
            continue;
        }
        buffer.push(line);
    }
    flush(inBlockquote ? 'blockquote' : buffer.some((l) => l.match(/^[-*] /)) ? 'bullet_list' : 'paragraph');
    return sections.filter((s) => s.body || s.style === 'heading');
}
async function callMcpTool(tool, payload) {
    const mcpUrl = process.env.DOCS_MCP_SERVER_URL?.trim();
    if (!mcpUrl)
        return null;
    try {
        const res = await fetch(`${mcpUrl.replace(/\/$/, '')}/tools/${tool}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.DOCS_MCP_API_KEY ?? ''}`,
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            console.error(`[Docs MCP] ${tool} failed:`, await res.text());
            return null;
        }
        return (await res.json());
    }
    catch (err) {
        console.error(`[Docs MCP] ${tool} error:`, err);
        return null;
    }
}
export async function createMissionDocViaMcp(input) {
    const data = await callMcpTool('create_mission_document', { ...input });
    if (!data)
        return null;
    const url = data.doc_url ?? data.url;
    return typeof url === 'string' ? url : null;
}
export async function publishMissionReport(input) {
    const mcpUrl = process.env.DOCS_MCP_SERVER_URL?.trim();
    if (!mcpUrl) {
        console.warn('[Docs MCP] DOCS_MCP_SERVER_URL not set — in-app report only');
        return null;
    }
    const sections = markdownToSections(input.markdown);
    // Primary: single-shot create with full markdown (MCP server renders headings/tables)
    const created = await createMissionDocViaMcp({
        title: input.title,
        sections,
        userId: input.userId,
        reportId: input.reportId,
        docType: 'WEEKLY_AUDIT',
        markdown: input.markdown,
    });
    if (created)
        return created;
    // Fallback: standard MCP tool chain (create → fill → share)
    const doc = await callMcpTool('create_document', {
        title: input.title,
        user_id: input.userId,
    });
    const docId = doc?.document_id ?? doc?.doc_id ?? doc?.id;
    if (typeof docId !== 'string')
        return null;
    await callMcpTool('insert_heading', { document_id: docId, text: input.title, level: 1 });
    await callMcpTool('insert_paragraph', {
        document_id: docId,
        text: `Mission debrief for ${input.userName}`,
    });
    for (const section of sections) {
        if (section.style === 'heading')
            continue;
        await callMcpTool('insert_heading', { document_id: docId, text: section.heading, level: 2 });
        const tool = section.style === 'blockquote'
            ? 'insert_blockquote'
            : section.style === 'bullet_list'
                ? 'insert_bullet_list'
                : 'insert_paragraph';
        await callMcpTool(tool, { document_id: docId, text: section.body });
    }
    const shared = await callMcpTool('share_document', {
        document_id: docId,
        role: 'reader',
    });
    const url = shared?.doc_url ?? shared?.url ?? doc?.doc_url ?? doc?.url;
    return typeof url === 'string' ? url : null;
}
export async function appendToMissionDoc(docId, section) {
    const data = await callMcpTool('append_section', { doc_id: docId, section });
    return data !== null;
}
