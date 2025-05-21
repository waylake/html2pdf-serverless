import express, { Express, Request, Response } from 'express';
import { PDFDocument } from 'pdf-lib';

const app: Express = express();
app.use(express.json({ limit: '10mb' }));

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
let puppeteer: any;
let chromium: any;

if (isVercel) {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  puppeteer = require('puppeteer');
}

// page 리소스 차단 없이, 필요한 모든 리소스 정상 로드
async function generatePagePdf(browser: any, html: string): Promise<Buffer> {
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      preferCSSPageSize: true,
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

app.post('/generate-pdf', async (req: Request, res: Response) => {
  let { pages } = req.body;
  if (!Array.isArray(pages) || pages.length === 0) {
    res.status(400).json({ error: 'Missing pages: must be a non-empty array of HTML strings.' });
    return;
  }

  let browser: any;
  try {
    browser = await puppeteer.launch(
      isVercel
        ? {
          args: [
            ...chromium.args,
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
          timeout: 60000,
        }
        : {
          headless: true,
          args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
          ignoreHTTPSErrors: true,
        }
    );

    // 한 번에 한 페이지씩 pdf 추출
    const pdfBuffers: Buffer[] = [];
    for (let html of pages) {
      pdfBuffers.push(await generatePagePdf(browser, html));
    }

    // pdf-lib으로 버퍼 병합
    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(src, src.getPageIndices());
      for (const p of copiedPages) mergedPdf.addPage(p);
    }
    const mergedPdfBytes = await mergedPdf.save();

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error) {
    if (browser) await browser.close();
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'HTML to PDF service is running.' });
});

app.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`);
});

export default app;
