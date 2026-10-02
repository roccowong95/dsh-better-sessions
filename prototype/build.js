#!/usr/bin/env node
/**
 * 把经过 node:test 单测的 lib/order.js 注入 client.js。
 *
 * 为什么需要它：client 半运行在浏览器模块表里，factory 收到的 `require` 只认
 * 已注册的模块 id（包名），读不到相对路径 —— 所以手写原型没法拆成多文件互相
 * import。真实插件是靠 tsdown 在构建时打包成一个 client.js；这个脚本就是那个
 * 打包步骤的最小替代品。
 *
 * 用法：改了 lib/order.js 之后跑 `node build.js`，然后靠 HMR 看效果。
 * 这样"被单测覆盖的代码"和"线上跑的代码"是同一份。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const orderPath = path.join(root, 'lib', 'order.js');
const clientPath = path.join(root, 'client.js');

const BEGIN = '/* @@ORDER-BEGIN@@ */';
const END = '/* @@ORDER-END@@ */';

const raw = fs.readFileSync(orderPath, 'utf8');

// 剥掉 'use strict'（client.js 在模块表闭包里，不需要）和 module.exports
const body = raw
  .replace(/^\s*'use strict'\s*\n/, '')
  .replace(/\nmodule\.exports\s*=\s*\{[\s\S]*?\}\s*$/, '\n')
  .trim();

if (!/\b(visibleOrder|reconcileManualOrder|pinCurrentBlank|moveBefore|orderByRecency)\b/.test(body)) {
  console.error('[build] order.js 里没找到预期的函数，中止');
  process.exit(1);
}

const client = fs.readFileSync(clientPath, 'utf8');
const beginAt = client.indexOf(BEGIN);
const endAt = client.indexOf(END);
if (beginAt === -1 || endAt === -1 || endAt < beginAt) {
  console.error('[build] client.js 里找不到注入标记，中止');
  process.exit(1);
}

const next = client.slice(0, beginAt + BEGIN.length)
  + '\n' + body + '\n'
  + client.slice(endAt);

if (next === client) {
  console.log('[build] client.js 已是最新，无需改动');
} else {
  fs.writeFileSync(clientPath, next);
  console.log('[build] 已把 lib/order.js 注入 client.js（' + body.split('\n').length + ' 行）');
}
