const esbuild = require('esbuild');

const buildOptions = {
  entryPoints: ['src/app.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/app.js',
  sourcemap: false, // 소스맵 비활성화로 용량 절약
  external: [
    // Puppeteer 관련 external 처리 (Vercel 환경에서 필요)
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium',
    // ReDoc 관련 external 처리
    'redoc-express'
  ],
  // Node.js 내장 모듈들도 external로 처리
  packages: 'external',
  // 트리 쉐이킹은 기본적으로 활성화됨
  // 데드 코드 제거
  drop: ['console', 'debugger'], // console.log와 debugger 제거
  // 포맷 최적화
  format: 'cjs',
  // 법적 주석 제거
  legalComments: 'none',
};

// 프로덕션 빌드
const buildProd = async () => {
  try {
    const result = await esbuild.build({
      ...buildOptions,
      minify: true,
      // 프로덕션에서는 더 강력한 최적화
      keepNames: false, // 함수명 유지 비활성화
    });
    
    console.log('✅ Ultra-compressed build completed successfully');
    
    // 빌드 크기 정보 출력
    const fs = require('fs');
    const stats = fs.statSync('dist/app.js');
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    console.log(`📦 Bundle size: ${fileSizeInKB} KB`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
};

// 개발 빌드 (watch 모드)
const buildDev = async () => {
  try {
    const ctx = await esbuild.context({
      ...buildOptions,
      minify: false,
      sourcemap: true, // 개발 모드에서는 소스맵 유지
      drop: [], // 개발 모드에서는 console.log 유지
    });
    
    await ctx.watch();
    console.log('👀 Watching for changes...');
  } catch (error) {
    console.error('❌ Watch build failed:', error);
    process.exit(1);
  }
};

// 명령행 인수에 따라 빌드 모드 결정
const mode = process.argv[2];

if (mode === 'watch') {
  buildDev();
} else {
  buildProd();
} 