import PDFDocument from 'pdfkit';
export async function markdownToPdfBuffer(title, markdown, options) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.fontSize(20).fillColor('#1a1a2e').text(title, { align: 'center' });
        if (options?.subtitle) {
            doc.moveDown(0.3).fontSize(10).fillColor('#666666').text(options.subtitle, { align: 'center' });
        }
        doc.moveDown(1.5);
        doc.fontSize(11).fillColor('#333333');
        for (const line of markdown.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) {
                doc.moveDown(0.4);
                continue;
            }
            if (trimmed.startsWith('# ')) {
                doc.moveDown(0.6).fontSize(16).fillColor('#16213e').text(trimmed.slice(2));
                doc.fontSize(11).fillColor('#333333');
                continue;
            }
            if (trimmed.startsWith('## ')) {
                doc.moveDown(0.5).fontSize(14).fillColor('#0f3460').text(trimmed.slice(3));
                doc.fontSize(11).fillColor('#333333');
                continue;
            }
            if (trimmed.startsWith('### ')) {
                doc.moveDown(0.4).fontSize(12).fillColor('#533483').text(trimmed.slice(4));
                doc.fontSize(11).fillColor('#333333');
                continue;
            }
            if (trimmed.startsWith('> ')) {
                doc.fillColor('#555555').text(trimmed.slice(2), { indent: 20 });
                doc.fillColor('#333333');
                continue;
            }
            const plain = trimmed.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
            doc.text(plain.startsWith('- ') || plain.match(/^\d+\./) ? plain : plain, {
                indent: plain.startsWith('- ') || plain.match(/^\d+\./) ? 15 : 0,
            });
        }
        if (options?.footer) {
            doc.moveDown(1.5);
            doc.fontSize(9).fillColor('#888888').text(options.footer, { align: 'center' });
        }
        doc.end();
    });
}
