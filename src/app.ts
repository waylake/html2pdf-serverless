import express, { Express, Request, Response } from 'express';
import { PDFDocument } from 'pdf-lib';
import path from 'path';

// PDF 관련 인터페이스 정의
interface PdfOptions {
  format?: string;
  width?: number;
  height?: number;
  landscape?: boolean;
  scale?: number;
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  margin?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
  preferCSSPageSize?: boolean;
  timeout?: number;
}

// 오류 타입 정의
enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    details?: any;
  }
}

const app: Express = express();
app.use(express.json({ limit: '10mb' }));

// 정적 파일 제공 설정
app.use(express.static(path.join(__dirname, '../public')));

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
let puppeteer: any;
let chromium: any;

// 서버리스 환경에 따른 설정
if (isVercel) {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  puppeteer = require('puppeteer');
}

// 기본 PDF 옵션
const DEFAULT_PDF_OPTIONS: PdfOptions = {
  format: 'A4',
  printBackground: true,
  margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
  preferCSSPageSize: true,
  timeout: 50000, // Vercel 60초 제한 고려, 50초로 설정
};

// 입력 유효성 검증 함수
function validateInput(pages: any, options?: any): { valid: boolean; error?: ErrorResponse } {
  if (!Array.isArray(pages) || pages.length === 0) {
    return {
      valid: false,
      error: {
        error: {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Missing pages: must be a non-empty array of HTML strings.',
        }
      }
    };
  }

  if (options) {
    // 페이지 크기 설정 검증
    if (options.format && options.width && options.height) {
      return {
        valid: false,
        error: {
          error: {
            type: ErrorType.VALIDATION_ERROR,
            message: 'Cannot specify both format and width/height.',
          }
        }
      };
    }

    // 사용자 지정 크기 검증
    if ((options.width && !options.height) || (!options.width && options.height)) {
      return {
        valid: false,
        error: {
          error: {
            type: ErrorType.VALIDATION_ERROR,
            message: 'Both width and height must be specified together.',
          }
        }
      };
    }

    // 타임아웃 값 검증
    if (options.timeout && (typeof options.timeout !== 'number' || options.timeout <= 0 || options.timeout > 55000)) {
      return {
        valid: false,
        error: {
          error: {
            type: ErrorType.VALIDATION_ERROR,
            message: 'Timeout must be a positive number and less than 55000ms.',
          }
        }
      };
    }
  }

  return { valid: true };
}

// page 리소스 렌더링 및 PDF 생성
async function generatePagePdf(browser: any, html: string, options: PdfOptions): Promise<Buffer> {
  const page = await browser.newPage();
  const pdfOptions = { ...DEFAULT_PDF_OPTIONS, ...options };

  try {
    // 타임아웃 로직 구현
    const renderTimeout = pdfOptions.timeout || DEFAULT_PDF_OPTIONS.timeout;
    const renderPromise = page.setContent(html, { waitUntil: 'networkidle0', timeout: renderTimeout });
    
    await renderPromise;
    
    // 사용자 정의 페이지 크기 처리
    const pdfRenderOptions: any = { ...pdfOptions };
    
    // PDF 생성
    const pdfBuffer = await page.pdf(pdfRenderOptions);
    return pdfBuffer;
  } catch (error: any) {
    // 에러 유형별 처리
    if (error.name === 'TimeoutError') {
      throw {
        type: ErrorType.TIMEOUT_ERROR,
        message: 'Rendering timed out. Try simplifying your HTML or increasing the timeout value.',
        details: error.message
      };
    } else if (error.message && error.message.includes('net::')) {
      throw {
        type: ErrorType.RESOURCE_ERROR,
        message: 'Failed to load resources in the page.',
        details: error.message
      };
    }
    throw {
      type: ErrorType.RENDER_ERROR,
      message: 'Failed to render page to PDF.',
      details: error.message
    };
  } finally {
    await page.close();
  }
}

app.post('/generate-pdf', async (req: Request, res: Response) => {
  const { pages, options = {}, filename = 'document.pdf' } = req.body;
  
  // 입력 검증
  const validation = validateInput(pages, options);
  if (!validation.valid) {
    res.status(400).json(validation.error);
    return;
  }

  let browser: any;
  try {
    // 브라우저 실행 옵션
    const browserOptions = isVercel
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
        };

    browser = await puppeteer.launch(browserOptions);

    // PDF 생성
    const pdfBuffers: Buffer[] = [];
    for (let html of pages) {
      pdfBuffers.push(await generatePagePdf(browser, html, options));
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

    // 파일명 처리
    const outputFilename = filename || options.filename || 'document.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error: any) {
    if (browser) await browser.close();
    
    console.error('PDF generation error:', error);
    
    // 오류 응답 형식화
    const errorResponse: ErrorResponse = {
      error: {
        type: error.type || ErrorType.UNKNOWN_ERROR,
        message: error.message || 'Failed to generate PDF.',
        details: error.details || undefined
      }
    };
    
    res.status(500).json(errorResponse);
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API 정보 제공 엔드포인트
app.get('/api-info', (_req: Request, res: Response) => {
  res.json({ 
    message: 'HTML to PDF service is running.',
    version: '1.1.0',
    options: {
      format: 'A4 (default), Letter, Legal, Tabloid, Ledger, A0-A6',
      orientation: 'portrait (default) or landscape',
      margins: 'top, right, bottom, left in cm/mm/in',
      customSize: 'width and height in pixels',
      filename: 'output filename'
    }
  });
});

// OpenAPI 문서 제공
app.get('/api-docs', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/openapi.json'));
});

app.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`);
});

export default app;
