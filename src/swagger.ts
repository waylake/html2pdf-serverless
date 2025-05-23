export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'HTML to PDF Serverless API',
    description: `
# HTML to PDF 변환 API

이 API는 HTML 문자열을 고품질 PDF 문서로 변환하는 서버리스 서비스입니다.

## 주요 기능
- 🚀 **초고속 처리**: 병렬 처리와 최적화된 렌더링으로 빠른 PDF 생성
- 📄 **다중 페이지 지원**: 여러 HTML 페이지를 하나의 PDF로 병합
- 🎨 **풍부한 스타일링**: CSS, 웹폰트, 그라디언트 등 완전 지원
- ⚡ **메모리 최적화**: 대용량 문서도 안정적으로 처리
- 🔧 **유연한 옵션**: 페이지 크기, 여백, 방향 등 세밀한 제어

## 성능 최적화
- JavaScript 비활성화로 렌더링 속도 향상
- 리소스 차단으로 불필요한 네트워크 요청 제거
- 병렬 처리로 다중 페이지 동시 생성
- 메모리 관리 최적화로 안정성 확보

## 사용 제한
- **로컬 환경**: 최대 30페이지
- **Vercel 환경**: 최대 10페이지
- **타임아웃**: 60초
    `,
    version: '2.0.0-ultra-fast',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'https://html2pdf-serverless.vercel.app',
      description: '🚀 프로덕션 서버 (Vercel)'
    },
    {
      url: 'http://localhost:3002',
      description: '🛠️ 로컬 개발 서버'
    }
  ],
  tags: [
    {
      name: 'PDF Generation',
      description: 'HTML을 PDF로 변환하는 핵심 기능',
      externalDocs: {
        description: '더 많은 정보',
        url: 'https://github.com/your-repo'
      }
    },
    {
      name: 'Health Check',
      description: '서버 상태 및 성능 모니터링'
    }
  ],
  paths: {
    '/': {
      get: {
        tags: ['Health Check'],
        summary: '🏠 API 정보 조회',
        description: 'API의 기본 정보와 사용 가능한 엔드포인트를 반환합니다.',
        operationId: 'getApiInfo',
        responses: {
          '200': {
            description: 'API 정보 조회 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'HTML to PDF API'
                    },
                    version: {
                      type: 'string',
                      example: '2.0.0'
                    },
                    endpoints: {
                      type: 'object',
                      properties: {
                        health: {
                          type: 'string',
                          example: '/health'
                        },
                        generatePdf: {
                          type: 'string',
                          example: '/generate-pdf'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Health Check'],
        summary: '💚 서버 상태 확인',
        description: '서버의 현재 상태, 메모리 사용량, 성능 정보를 확인합니다.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: '서버 상태 정보',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          }
        }
      }
    },
    '/generate-pdf': {
      post: {
        tags: ['PDF Generation'],
        summary: '📄 HTML을 PDF로 변환',
        description: `
하나 이상의 HTML 문자열을 받아 고품질 PDF 문서로 변환합니다.

### 특징
- **병렬 처리**: 여러 페이지를 동시에 처리하여 속도 향상
- **메모리 최적화**: 대용량 문서도 안정적으로 처리
- **풍부한 옵션**: 페이지 크기, 여백, 방향 등 세밀한 제어
- **고품질 출력**: 웹폰트, CSS 스타일 완벽 지원

### 성능 팁
- \`printBackground: false\`로 설정하면 렌더링 속도 향상
- 불필요한 이미지나 외부 리소스 제거 권장
- 복잡한 JavaScript는 비활성화됨 (성능 최적화)
        `,
        operationId: 'generatePdf',
        requestBody: {
          description: 'PDF 생성 요청 정보',
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PdfRequest'
              },
              examples: {
                simple: {
                  summary: '간단한 예제',
                  description: '기본적인 HTML을 PDF로 변환',
                  value: {
                    pages: [
                      '<html><body><h1>Hello PDF!</h1><p>Simple example</p></body></html>'
                    ],
                    filename: 'simple.pdf',
                    options: {
                      format: 'A4',
                      printBackground: false
                    }
                  }
                },
                multiPage: {
                  summary: '다중 페이지 예제',
                  description: '여러 HTML 페이지를 하나의 PDF로 병합',
                  value: {
                    pages: [
                      '<html><body><h1>Page 1</h1><p>First page content</p></body></html>',
                      '<html><body><h1>Page 2</h1><p>Second page content</p></body></html>'
                    ],
                    filename: 'multi-page.pdf',
                    options: {
                      format: 'A4',
                      margin: {
                        top: '2cm',
                        right: '1cm',
                        bottom: '2cm',
                        left: '1cm'
                      }
                    }
                  }
                },
                styled: {
                  summary: '스타일링 예제',
                  description: 'CSS 스타일과 웹폰트가 적용된 PDF',
                  value: {
                    pages: [
                      `<html>
<head>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 40px; }
    .header { background: linear-gradient(45deg, #ff6b6b, #4ecdc4); color: white; padding: 20px; }
    .content { margin-top: 20px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header"><h1>Styled PDF</h1></div>
  <div class="content"><p>Beautiful styling with CSS</p></div>
</body>
</html>`
                    ],
                    filename: 'styled.pdf',
                    options: {
                      format: 'A4',
                      printBackground: true
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: '✅ PDF 파일 생성 성공',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary',
                  description: '생성된 PDF 파일'
                }
              }
            },
            headers: {
              'Content-Type': {
                schema: {
                  type: 'string',
                  example: 'application/pdf'
                },
                description: 'PDF 파일 타입'
              },
              'Content-Disposition': {
                schema: {
                  type: 'string',
                  example: 'attachment; filename="document.pdf"'
                },
                description: '다운로드 파일명'
              },
              'X-Processing-Time': {
                schema: {
                  type: 'string',
                  example: '1234ms'
                },
                description: '서버 처리 시간'
              },
              'X-Pages-Processed': {
                schema: {
                  type: 'string',
                  example: '5'
                },
                description: '처리된 페이지 수'
              },
              'X-Optimization-Level': {
                schema: {
                  type: 'string',
                  example: 'ultra-fast'
                },
                description: '적용된 최적화 레벨'
              }
            }
          },
          '400': {
            description: '❌ 잘못된 요청',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                examples: {
                  validation: {
                    summary: '유효성 검사 오류',
                    value: {
                      error: {
                        type: 'VALIDATION_ERROR',
                        message: 'Pages array must contain at least one HTML string'
                      }
                    }
                  },
                  pageLimit: {
                    summary: '페이지 수 제한 초과',
                    value: {
                      error: {
                        type: 'VALIDATION_ERROR',
                        message: 'Maximum 30 pages allowed.'
                      }
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: '❌ 서버 오류',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                },
                examples: {
                  render: {
                    summary: '렌더링 오류',
                    value: {
                      error: {
                        type: 'RENDER_ERROR',
                        message: 'Failed to render page to PDF.',
                        details: 'Invalid HTML structure'
                      }
                    }
                  },
                  timeout: {
                    summary: '타임아웃 오류',
                    value: {
                      error: {
                        type: 'TIMEOUT_ERROR',
                        message: 'Rendering timed out. Try reducing content complexity.'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      PdfRequest: {
        type: 'object',
        required: ['pages'],
        properties: {
          pages: {
            type: 'array',
            description: '📄 PDF로 변환할 HTML 문자열 배열',
            items: {
              type: 'string',
              minLength: 1,
              example: '<html><body><h1>Hello PDF!</h1></body></html>'
            },
            minItems: 1,
            maxItems: 30
          },
          filename: {
            type: 'string',
            description: '📁 다운로드 시 사용할 파일 이름',
            default: 'document.pdf',
            example: 'my-document.pdf',
            pattern: '^[^<>:"/\\|?*]+\\.pdf$'
          },
          options: {
            $ref: '#/components/schemas/PdfOptions'
          }
        },
        example: {
          pages: [
            '<html><body><h1>First Page</h1></body></html>',
            '<html><body><h1>Second Page</h1></body></html>'
          ],
          filename: 'example.pdf',
          options: {
            format: 'A4',
            printBackground: true
          }
        }
      },
      PdfOptions: {
        type: 'object',
        description: '🔧 PDF 생성 옵션',
        properties: {
          format: {
            type: 'string',
            description: '📏 용지 크기 (width/height와 동시 사용 불가)',
            enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger'],
            default: 'A4',
            example: 'A4'
          },
          width: {
            type: 'number',
            description: '📐 사용자 지정 페이지 너비 (픽셀)',
            minimum: 1,
            example: 800
          },
          height: {
            type: 'number',
            description: '📐 사용자 지정 페이지 높이 (픽셀)',
            minimum: 1,
            example: 1200
          },
          landscape: {
            type: 'boolean',
            description: '🔄 가로 방향 여부',
            default: false
          },
          scale: {
            type: 'number',
            description: '🔍 페이지 스케일',
            minimum: 0.1,
            maximum: 2.0,
            default: 1.0,
            example: 1.0
          },
          printBackground: {
            type: 'boolean',
            description: '🎨 배경 색상 및 이미지 인쇄 (false 권장 - 성능 향상)',
            default: false
          },
          displayHeaderFooter: {
            type: 'boolean',
            description: '📋 헤더와 푸터 표시 여부',
            default: false
          },
          headerTemplate: {
            type: 'string',
            description: '📄 헤더 HTML 템플릿',
            example: '<div style="font-size: 10px; text-align: center;">Header</div>'
          },
          footerTemplate: {
            type: 'string',
            description: '📄 푸터 HTML 템플릿',
            example: '<div style="font-size: 10px; text-align: center;">Page <span class="pageNumber"></span></div>'
          },
          margin: {
            type: 'object',
            description: '📏 페이지 여백',
            properties: {
              top: {
                oneOf: [
                  { type: 'string', example: '1cm' },
                  { type: 'number', example: 28.35 }
                ],
                description: '⬆️ 상단 여백'
              },
              right: {
                oneOf: [
                  { type: 'string', example: '1cm' },
                  { type: 'number', example: 28.35 }
                ],
                description: '➡️ 우측 여백'
              },
              bottom: {
                oneOf: [
                  { type: 'string', example: '1cm' },
                  { type: 'number', example: 28.35 }
                ],
                description: '⬇️ 하단 여백'
              },
              left: {
                oneOf: [
                  { type: 'string', example: '1cm' },
                  { type: 'number', example: 28.35 }
                ],
                description: '⬅️ 좌측 여백'
              }
            },
            example: {
              top: '2cm',
              right: '1cm',
              bottom: '2cm',
              left: '1cm'
            }
          },
          preferCSSPageSize: {
            type: 'boolean',
            description: '🎯 CSS 페이지 크기 우선 사용 (false 권장 - 성능 향상)',
            default: false
          },
          timeout: {
            type: 'number',
            description: '⏱️ 렌더링 타임아웃 (밀리초)',
            minimum: 1000,
            maximum: 60000,
            default: 60000,
            example: 30000
          }
        },
        example: {
          format: 'A4',
          landscape: false,
          printBackground: false,
          margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          },
          timeout: 30000
        }
      },
      HealthResponse: {
        type: 'object',
        description: '💚 서버 상태 정보',
        properties: {
          status: {
            type: 'string',
            example: 'healthy',
            description: '서버 상태'
          },
          version: {
            type: 'string',
            example: '2.0.0-ultra-fast',
            description: 'API 버전'
          },
          environment: {
            type: 'string',
            enum: ['local', 'vercel'],
            example: 'local',
            description: '실행 환경'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: '응답 시간'
          },
          puppeteer: {
            type: 'string',
            enum: ['available', 'not available'],
            example: 'available',
            description: 'Puppeteer 사용 가능 여부'
          },
          optimizations: {
            type: 'object',
            description: '🚀 적용된 최적화',
            properties: {
              parallelProcessing: { type: 'boolean', example: true },
              resourceBlocking: { type: 'boolean', example: true },
              javascriptDisabled: { type: 'boolean', example: true },
              backgroundOptimization: { type: 'boolean', example: true },
              fastRendering: { type: 'boolean', example: true },
              memoryOptimization: { type: 'boolean', example: true }
            }
          },
          performance: {
            type: 'object',
            description: '⚡ 성능 설정',
            properties: {
              maxConcurrency: { type: 'number', example: 5 },
              renderTimeout: { type: 'string', example: '60s' },
              waitTime: { type: 'string', example: '10ms' },
              pdfOptimizations: { type: 'string', example: 'enabled' }
            }
          },
          memory: {
            type: 'object',
            description: '💾 메모리 사용량',
            properties: {
              rss: { type: 'string', example: '45MB' },
              heapUsed: { type: 'string', example: '23MB' },
              heapTotal: { type: 'string', example: '35MB' }
            }
          },
          limits: {
            type: 'object',
            description: '📊 사용 제한',
            properties: {
              maxPages: { type: 'number', example: 30 },
              timeout: { type: 'string', example: '60s' },
              memoryLimit: { type: 'string', example: 'unlimited' }
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        description: '❌ 오류 응답',
        properties: {
          error: {
            type: 'object',
            required: ['type', 'message'],
            properties: {
              type: {
                type: 'string',
                enum: ['VALIDATION_ERROR', 'RENDER_ERROR', 'TIMEOUT_ERROR', 'RESOURCE_ERROR', 'UNKNOWN_ERROR'],
                description: '오류 타입',
                example: 'VALIDATION_ERROR'
              },
              message: {
                type: 'string',
                description: '오류 메시지',
                example: 'Pages array must contain at least one HTML string'
              },
              details: {
                description: '오류 상세 정보 (선택적)',
                example: 'Invalid HTML structure detected'
              }
            }
          }
        }
      }
    }
  }
}; 