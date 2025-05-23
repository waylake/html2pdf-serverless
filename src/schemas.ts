import { z } from 'zod';

// PDF 옵션 스키마
export const PdfOptionsSchema = z.object({
  format: z.enum(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger']).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  landscape: z.boolean().optional(),
  scale: z.number().min(0.1).max(2).optional(),
  printBackground: z.boolean().optional(),
  displayHeaderFooter: z.boolean().optional(),
  headerTemplate: z.string().optional(),
  footerTemplate: z.string().optional(),
  margin: z.object({
    top: z.union([z.string(), z.number()]).optional(),
    right: z.union([z.string(), z.number()]).optional(),
    bottom: z.union([z.string(), z.number()]).optional(),
    left: z.union([z.string(), z.number()]).optional(),
  }).optional(),
  preferCSSPageSize: z.boolean().optional(),
  timeout: z.number().min(1000).max(60000).optional(),
}).refine(
  (data) => {
    // format과 width/height는 동시에 사용할 수 없음
    if (data.format && (data.width || data.height)) {
      return false;
    }
    // width와 height는 함께 사용되어야 함
    if ((data.width && !data.height) || (!data.width && data.height)) {
      return false;
    }
    return true;
  },
  {
    message: "Cannot specify both format and width/height, and width/height must be used together",
  }
);

// 폰트 옵션 스키마
export const FontOptionsSchema = z.object({
  family: z.string().optional(),
  url: z.string().url().optional(),
  format: z.enum(['woff', 'woff2', 'ttf', 'otf']).optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  style: z.enum(['normal', 'italic', 'oblique']).optional(),
}).refine(
  (data) => {
    // family와 url은 함께 사용되어야 함
    if ((data.family && !data.url) || (!data.family && data.url)) {
      return false;
    }
    return true;
  },
  {
    message: "Font family and URL must be used together",
  }
);

// PDF 생성 요청 스키마
export const PdfRequestSchema = z.object({
  pages: z.array(z.string().min(1)).min(1, "Pages array must contain at least one HTML string"),
  filename: z.string().optional().default('document.pdf'),
  options: PdfOptionsSchema.optional(),
  font: FontOptionsSchema.optional(),
});

// 에러 타입 정의
export const ErrorTypeSchema = z.enum([
  'VALIDATION_ERROR',
  'RENDER_ERROR',
  'TIMEOUT_ERROR',
  'RESOURCE_ERROR',
  'UNKNOWN_ERROR'
]);

// 에러 응답 스키마
export const ErrorResponseSchema = z.object({
  error: z.object({
    type: ErrorTypeSchema,
    message: z.string(),
    details: z.any().optional(),
  }),
});

// 타입 추출
export type PdfOptions = z.infer<typeof PdfOptionsSchema>;
export type FontOptions = z.infer<typeof FontOptionsSchema>;
export type PdfRequest = z.infer<typeof PdfRequestSchema>;
export type ErrorType = z.infer<typeof ErrorTypeSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>; 