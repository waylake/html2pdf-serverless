import express, { Express, Request, Response } from 'express';

const app: Express = express();
app.use(express.json({ limit: '10mb' }));

// 환경에 따라 분기 처리
const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

let puppeteer: any;
let chromium: any;

if (isVercel) {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  puppeteer = require('puppeteer'); // 로컬에서는 puppeteer 사용
}

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'HTML to PDF service is running.' });
});

app.post('/generate-pdf', async (req: Request, res: Response) => {
  const { html } = req.body;

  if (!html) {
    res.status(400).json({ error: 'Missing HTML content in request.' });
    return
  }

  try {
    const browser = await puppeteer.launch(
      isVercel
        ? {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        }
        : {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    );

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

app.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`)
})

export default app;
