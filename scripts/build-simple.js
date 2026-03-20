#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building Kode Minimal...');

// 确保dist目录存在
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 复制必要的文件
const filesToCopy = [
  'cli.js',
  'cli-acp.js',
  'yoga.wasm'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, '..', file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to dist/`);
  }
});

// 复制编译后的JS文件
const srcDir = path.join(__dirname, '..', 'src');
const outDir = path.join(__dirname, '..', 'dist', 'src');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

if (fs.existsSync(srcDir)) {
  copyDir(srcDir, outDir);
  console.log('Copied compiled source files to dist/src/');
}

console.log('Build completed!');
console.log('To run: node dist/cli.js');
console.log('Or install globally: npm install -g .');