// 统一路径解析 —— 把「可写数据」根目录与「只读代码」根目录分开。
//
// 为什么：打包成 .app 后代码目录是只读的，vault / 状态 / 评分 / .env 必须落到
// 用户可写目录。设环境变量 ECHOLOG_DATA_DIR 指向可写目录即可；不设则回退到仓库根
// （源码方式运行行为完全不变，已部署实例无需迁移）。
//
//   源码运行：     不设 ECHOLOG_DATA_DIR → DATA_DIR = 仓库根
//   打包 .app：    ECHOLOG_DATA_DIR=~/echolog（GUI 注入）→ 数据全落这里
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.ECHOLOG_DATA_DIR
  ? path.resolve(process.env.ECHOLOG_DATA_DIR)
  : REPO_ROOT;

module.exports = {
  REPO_ROOT,                                                   // 只读代码根（prompts 等资源）
  DATA_DIR,                                                    // 可写数据根
  VAULT_DIR:           path.join(DATA_DIR, 'Daily_Vault'),
  FEISHU_STATE_FILE:   path.join(DATA_DIR, '.feishu_state.json'),
  TICKTICK_STATE_FILE: path.join(DATA_DIR, '.ticktick-state.json'),
  RATINGS_FILE:        path.join(DATA_DIR, '.diary_ratings.jsonl'),
  ENV_FILE:            path.join(DATA_DIR, '.env'),
  // prompts 默认在只读代码目录；打包版可用 ECHOLOG_PROMPTS_DIR 指到可写目录（GUI 编辑/新建版本用）
  PROMPTS_DIR: process.env.ECHOLOG_PROMPTS_DIR
    ? path.resolve(process.env.ECHOLOG_PROMPTS_DIR)
    : path.join(REPO_ROOT, 'prompts'),
};
