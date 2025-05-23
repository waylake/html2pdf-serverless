import express, { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { PDFDocument } from 'pdf-lib';
import { ZodError } from 'zod';
import * as redoc from 'redoc-express';

import { PdfRequestSchema, PdfOptions, FontOptions, ErrorType, ErrorResponse } from './schemas';
import { openApiSpec } from './swagger';

const app: Express = express();

// Vercel 최적화 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
let puppeteer: any;
let chromium: any;

try {
  if (isVercel) {
    puppeteer = require('puppeteer-core');
    chromium = require('@sparticuz/chromium');
  } else {
    puppeteer = require('puppeteer');
  }
} catch (error) {
  // Puppeteer 로드 실패 시 무시
}

// Vercel 최적화된 PDF 옵션
const DEFAULT_PDF_OPTIONS: PdfOptions = {
  format: 'A4',
  printBackground: false,
  margin: { top: '0.5cm', right: '0.5cm', bottom: '0.5cm', left: '0.5cm' },
  preferCSSPageSize: false,
  timeout: 60000,
};

// 브라우저 옵션 설정
const getBrowserOptions = async () => {
  if (!isVercel) {
    return {
      headless: 'new',
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-first-run',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-web-resources',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--single-process',
      ],
      ignoreHTTPSErrors: true,
      timeout: 60000,
    };
  }

  // Vercel 환경 설정
  return {
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--single-process',
      '--no-zygote',
      '--memory-pressure-off',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
    timeout: 60000,
  };
};

// 에러 응답 생성 헬퍼
function createErrorResponse(type: ErrorType, message: string, details?: any): ErrorResponse {
  return {
    error: {
      type,
      message,
      details
    }
  };
}

// 폰트 다운로드 및 base64 변환 함수
async function downloadAndEncodeFont(fontOptions: FontOptions): Promise<string | null> {
  if (!fontOptions.family || !fontOptions.url) {
    return null;
  }

  try {
    console.log(`📥 폰트 다운로드 중: ${fontOptions.url}`);
    const response = await fetch(fontOptions.url, { 
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const fontBuffer = await response.arrayBuffer();
    
    // 폰트 크기 제한 (1MB)
    if (fontBuffer.byteLength > 1024 * 1024 * 2) {
      console.warn(`⚠️ 폰트가 너무 큼: ${fontBuffer.byteLength} bytes`);
      return null;
    }

    const base64Font = Buffer.from(fontBuffer).toString('base64');
    console.log(`✅ 폰트 다운로드 완료: ${fontBuffer.byteLength} bytes`);
    
    return base64Font;
  } catch (error: any) {
    console.error(`❌ 폰트 다운로드 실패: ${error.message}`);
    return null;
  }
}

// 폰트 CSS 생성 함수
function generateFontCSS(fontOptions: FontOptions, base64Data: string): string {
  const format = fontOptions.format || 'woff2';
  const weight = fontOptions.weight || 400;
  const style = fontOptions.style || 'normal';
  
  return `
    @font-face {
      font-family: '${fontOptions.family}';
      src: url('data:font/${format};base64,${base64Data}') format('${format}');
      font-weight: ${weight};
      font-style: ${style};
      font-display: swap;
    }`;
}

// HTML에 폰트 CSS 주입 함수
function injectFontCSS(html: string, fontCSS: string): string {
  // <head> 태그 안에 폰트 CSS 주입
  const headRegex = /<head[^>]*>/i;
  const match = html.match(headRegex);
  
  if (match) {
    const headTag = match[0];
    const insertPosition = match.index! + headTag.length;
    return html.slice(0, insertPosition) + 
           `\n<style>${fontCSS}</style>\n` + 
           html.slice(insertPosition);
  }
  
  // <head> 태그가 없으면 <html> 태그 다음에 추가
  const htmlRegex = /<html[^>]*>/i;
  const htmlMatch = html.match(htmlRegex);
  
  if (htmlMatch) {
    const htmlTag = htmlMatch[0];
    const insertPosition = htmlMatch.index! + htmlTag.length;
    return html.slice(0, insertPosition) + 
           `\n<head><style>${fontCSS}</style></head>\n` + 
           html.slice(insertPosition);
  }
  
  // HTML 구조가 없으면 맨 앞에 추가
  return `<style>${fontCSS}</style>\n${html}`;
}

// PDF 생성 함수
async function generatePagePdf(browser: any, html: string, options: PdfOptions): Promise<Buffer> {
  const page = await browser.newPage();
  
  try {
    // 최적화된 뷰포트 설정
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    
    // 선택적 리소스 차단 (폰트와 이미지는 허용)
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const resourceType = req.resourceType();
      const url = req.url();
      
      // 허용할 리소스 타입
      if (['document', 'script', 'stylesheet', 'font', 'image'].includes(resourceType)) {
        // CDN 폰트와 이미지는 허용
        if (resourceType === 'font' || resourceType === 'image' || 
            url.includes('fonts.googleapis.com') || 
            url.includes('fonts.gstatic.com') ||
            url.includes('cdn.jsdelivr.net') ||
            url.includes('cdnjs.cloudflare.com') ||
            url.includes('unpkg.com')) {
          req.continue();
        } else if (['document', 'script', 'stylesheet'].includes(resourceType)) {
          req.continue();
        } else {
          req.abort();
        }
      } else {
        // 기타 리소스는 차단 (media, websocket 등)
        req.abort();
      }
    });

    // JavaScript는 유지 (폰트 로딩에 필요할 수 있음)
    await page.setJavaScriptEnabled(true);
    
    // 캐시 비활성화
    await page.setCacheEnabled(false);

    const pdfOptions = { ...DEFAULT_PDF_OPTIONS, ...options };
    const renderTimeout = Math.min(pdfOptions.timeout || 60000, 60000);
    
    // 외부 리소스 로딩을 위해 대기 시간 증가
    await page.setContent(html, { 
      waitUntil: 'networkidle0', // 네트워크가 완전히 idle 될 때까지 대기
      timeout: renderTimeout 
    });
    
    // 폰트 로딩을 위한 추가 대기
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const pdfBuffer = await page.pdf({
      ...pdfOptions,
      omitBackground: !pdfOptions.printBackground,
    });
    
    return pdfBuffer;
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw createErrorResponse(
        'TIMEOUT_ERROR',
        'Rendering timed out. Try reducing content complexity or external resources.',
        error.message
      );
    } else if (error.message && error.message.includes('net::')) {
      throw createErrorResponse(
        'RESOURCE_ERROR',
        'Failed to load external resources (fonts/images).',
        error.message
      );
    }
    throw createErrorResponse(
      'RENDER_ERROR',
      'Failed to render page to PDF.',
      error.message
    );
  } finally {
    await page.close();
  }
}

// 비동기 핸들러 래퍼
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

app.post('/generate-pdf', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  if (!puppeteer) {
    return res.status(500).json(
      createErrorResponse('UNKNOWN_ERROR', 'Puppeteer is not available in this environment.')
    );
  }

  // Zod 검증
  const validatedData = PdfRequestSchema.parse(req.body);
  const { pages, options = {}, filename, font } = validatedData;

  // 페이지 수 제한 (로컬에서는 더 많이 허용)
  const maxPages = isVercel ? 10 : 30;
  if (pages.length > maxPages) {
    return res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', `Maximum ${maxPages} pages allowed.`)
    );
  }

  let browser: any;
  let fontCSS = '';
  
  try {
    // 폰트 처리
    if (font && font.family && font.url) {
      console.log(`🔤 폰트 처리 시작: ${font.family}`);
      const base64Font = await downloadAndEncodeFont(font);
      if (base64Font) {
        fontCSS = generateFontCSS(font, base64Font);
        console.log(`✅ 폰트 CSS 생성 완료`);
      } else {
        console.warn(`⚠️ 폰트 로드 실패, 기본 폰트 사용`);
      }
    }

    const browserOptions = await getBrowserOptions();
    browser = await puppeteer.launch(browserOptions);

    const maxConcurrency = Math.min(pages.length, isVercel ? 3 : 5);
    const pdfBuffers: Buffer[] = [];
    
    for (let i = 0; i < pages.length; i += maxConcurrency) {
      const chunk = pages.slice(i, i + maxConcurrency);
      const chunkPromises = chunk.map(async (html, index) => {
        // 폰트 CSS가 있으면 HTML에 주입
        const processedHtml = fontCSS ? injectFontCSS(html, fontCSS) : html;
        return generatePagePdf(browser, processedHtml, options);
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      pdfBuffers.push(...chunkResults);
      
      if (i + maxConcurrency < pages.length) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }

    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < pdfBuffers.length; i++) {
      const buf = pdfBuffers[i];
      const src = await PDFDocument.load(buf, { 
        ignoreEncryption: true,
        capNumbers: false,
        throwOnInvalidObject: false
      });
      const copiedPages = await mergedPdf.copyPages(src, src.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
      
      if (i % 3 === 0 && i > 0) {
        if (global.gc) {
          global.gc();
        }
      }
    }
    
    const mergedPdfBytes = await mergedPdf.save({
      useObjectStreams: false,
      addDefaultPage: false,
      objectsPerTick: 50
    });
    
    await browser.close();
    
    const processingTime = Date.now() - startTime;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Processing-Time', `${processingTime}ms`);
    res.setHeader('X-Pages-Processed', pages.length.toString());
    res.setHeader('X-Font-Used', font?.family || 'system');
    
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error: any) {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        // 브라우저 종료 오류 무시
      }
    }
    throw error;
  }
}));

// 루트 경로
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    message: 'HTML to PDF API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      generatePdf: '/generate-pdf',
      docs: '/docs',
      apiSpec: '/docs/spec.json'
    }
  });
});

// 헬스 체크
app.get('/health', (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'healthy',
    version: '2.0.0',
    environment: isVercel ? 'vercel' : 'local',
    timestamp: new Date().toISOString(),
    puppeteer: !!puppeteer ? 'available' : 'not available',
    features: {
      parallelProcessing: true,
      externalResources: true,
      cdnSupport: true,
      memoryOptimization: true
    },
    performance: {
      maxConcurrency: isVercel ? 3 : 5,
      renderTimeout: '60s',
      fontLoadWait: '500ms'
    },
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    limits: {
      maxPages: isVercel ? 10 : 30,
      timeout: '60s',
      memoryLimit: isVercel ? '1024MB' : 'unlimited'
    }
  });
});

// ReDoc API 문서
app.get('/docs/spec.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get('/docs', redoc.default({
  title: 'HTML to PDF API Documentation',
  specUrl: '/docs/spec.json',
  redocOptions: {
    theme: {
      colors: {
        primary: {
          main: '#667eea'
        }
      },
      typography: {
        fontSize: '14px',
        lineHeight: '1.5em',
        code: {
          fontSize: '13px'
        }
      }
    },
    hideDownloadButton: false,
    hideHostname: false,
    expandResponses: '200,201',
    requiredPropsFirst: true,
    sortPropsAlphabetically: true,
    showExtensions: true,
    noAutoAuth: true
  }
}));

// 에러 핸들링 미들웨어
const errorHandler: ErrorRequestHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error:', error);
  
  if (error instanceof ZodError) {
    const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json(
      createErrorResponse('VALIDATION_ERROR', errorMessage, error.errors)
    );
    return;
  }
  
  if (error.error && error.error.type) {
    res.status(500).json(error);
    return;
  }
  
  res.status(500).json(
    createErrorResponse('UNKNOWN_ERROR', 'Failed to generate PDF.', error.message)
  );
};

app.use(errorHandler);

// Vercel 배포용 포트 설정
const PORT = process.env.PORT || 3002;

// 서버 시작 (Vercel에서는 자동 처리)
if (!isVercel) {
  const server = app.listen(PORT, () => {
    // 서버 시작 로그 제거로 용량 절약
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      process.exit(1);
    }
  });
}

export default app;
