'use strict';
// echolog AI —— 本地 Ollama 一键把 Notes/ 下的选题展开成长文/视频脚本/推特串
// 不依赖任何外部 npm 包；用 Obsidian 内置的 requestUrl 调本地 ollama (http://localhost:11434)
// 适配 Obsidian Plugin API 1.0+

const obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
  ollamaUrl: 'http://localhost:11434',
  textModel: 'qwen3.5:9b',
  temperature: 0.5,
  numCtx: 16384,
};

// ---------- 三套展开模式的 prompt ----------

const PROMPTS = {
  longform: {
    name: '长文草稿（公众号/博客）',
    icon: '📝',
    system: `你是一位严谨又有读欲的写作者。要把读者给你的「选题草稿」展开成一篇可发布的长文。

【硬规则】
1. 第一人称冷静叙述，禁用空洞抽象词："充满""感受到""收获满满""治愈""惬意""精彩"等。禁用包装句式"3 个秘诀""教你 X 步""必看"。
2. 必须有具体场景、数字、对话、截图描述、代码片段等**硬细节**支撑；缺少时主动加 \`[此处需补充：xxx]\` 标记，不要凭空编。
3. 结构按选题里的"结构"字段展开，每段不超过 3 段落。
4. 文风偏「真实创业暴露 + AI 工程师视角 + 长期主义」。
5. 输出 markdown，可包含 ## 二级标题、列表、代码块、quote。

直接输出长文正文，不要前言"以下是..."、不要后记"希望对你有帮助"。`,
    user: (note) => `这是我准备展开的选题草稿（包含标题/钩子/角度/结构/形式/灵感来源等字段）：

${note}

请把它展开成一篇 1500-2500 字的中文长文。`,
  },

  video: {
    name: '1 分钟竖屏视频脚本',
    icon: '🎬',
    system: `你是一位短视频脚本作者。把读者的「选题草稿」改写成 60-90 秒抖音/视频号竖屏脚本。

【硬规则】
1. 前 3 秒必须有强钩子（数字、反常识、悬念、冲突），让人不滑走
2. 写成"画面 + 台词"两栏的脚本格式：
   \`[画面] xxx\`
   \`[台词] xxx\`
3. 每秒 4-5 个字的节奏（中文口语），全片 250-400 字台词
4. 结尾要有一个清晰的"留下来"动作（关注/互动问题/承诺下集）
5. 风格：真实 / 硬核 / 反成功学；禁用空洞煽情词

直接输出脚本，不要前言。`,
    user: (note) => `这是我准备拍摄的选题：

${note}

请改写成竖屏短视频脚本。`,
  },

  twitter: {
    name: '推特/X 串（thread）',
    icon: '🐦',
    system: `你是一位推特长串作者。把读者的「选题草稿」改写成 5-8 条推文的 thread。

【硬规则】
1. 第 1 条必须有强钩子（数字/反常识/具体场景/失败暴露），让人想点进 thread
2. 中间每条独立成立，提供 1 个具体洞察 + 数据/案例
3. 最后 1 条留 CTA（提问 / 关注暗示 / 下一步）
4. 中英都行，但全篇统一一种语言
5. 每条推文用 \`---\` 分隔，方便复制粘贴
6. 单条 ≤140 字（中文） / ≤280 字符（英文）

直接输出 thread。`,
    user: (note) => `这是我准备发的选题：

${note}

请改写成 5-8 条推特串。`,
  },

  hook_optimization: {
    name: '钩子优化（出 5 个备选）',
    icon: '🪝',
    system: `你是一位标题钩子专家。读者会给你一个选题，你要给他 5 个备选钩子（开头第一句）。

【硬规则】
1. 5 个钩子风格各异：数字钩 / 反常识钩 / 故事钩 / 矛盾钩 / 失败暴露钩
2. 每个钩子 ≤30 字，第一句独立成立
3. 禁用"如何""教你""3 个秘诀""必看"等包装词
4. 必须基于选题里的真实素材，不要凭空生成

输出格式：
1. [数字钩] xxx
2. [反常识钩] xxx
...

并简短解释每个钩子的"诱因"。`,
    user: (note) => `请为这个选题生成 5 个钩子备选：

${note}`,
  },
};

// ---------- Plugin 主类 ----------

class DailyBotAIPlugin extends obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new DailyBotAISettingTab(this.app, this));

    // 注册 4 个命令
    for (const [key, p] of Object.entries(PROMPTS)) {
      this.addCommand({
        id: `expand-${key}`,
        name: `${p.icon} 展开为：${p.name}`,
        editorCallback: async (editor, view) => {
          await this.expandWith(key, editor, view);
        },
      });
    }

    // 状态栏显示当前模型
    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText(`🤖 ${this.settings.textModel}`);

    // 侧边栏按钮（ribbon）
    this.addRibbonIcon('sparkles', 'echolog AI: 展开当前笔记', async () => {
      const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      if (!view) {
        new obsidian.Notice('请先打开一个 markdown 笔记');
        return;
      }
      const modal = new ExpandPickerModal(this.app, async (key) => {
        await this.expandWith(key, view.editor, view);
      });
      modal.open();
    });

    console.log('[echolog-ai] loaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    if (this.statusBar) this.statusBar.setText(`🤖 ${this.settings.textModel}`);
  }

  async expandWith(key, editor, view) {
    const prompt = PROMPTS[key];
    if (!prompt) return;
    const noteContent = editor.getValue();
    if (!noteContent.trim()) {
      new obsidian.Notice('当前笔记为空');
      return;
    }
    const notice = new obsidian.Notice(`${prompt.icon} ${this.settings.textModel} 正在展开...（这要 30s ~ 2min）`, 0);
    try {
      const draft = await this.callOllama(prompt.system, prompt.user(noteContent));
      // 在文末追加，不覆盖原有内容
      const sep = `\n\n---\n\n## ${prompt.icon} ${prompt.name}\n\n*由 echolog AI (${this.settings.textModel}) 生成 ${new Date().toLocaleString('zh-CN')}*\n\n`;
      editor.replaceRange(sep + draft + '\n', { line: editor.lineCount(), ch: 0 });
      notice.hide();
      new obsidian.Notice(`✅ 已追加：${prompt.name}`);
    } catch (err) {
      notice.hide();
      new obsidian.Notice(`❌ 失败：${err.message}`, 8000);
      console.error('[echolog-ai]', err);
    }
  }

  async callOllama(systemPrompt, userPrompt) {
    const url = `${this.settings.ollamaUrl}/api/chat`;
    const body = JSON.stringify({
      model: this.settings.textModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      options: {
        temperature: this.settings.temperature,
        num_ctx: this.settings.numCtx,
      },
    });
    // 用 obsidian 自带的 requestUrl 绕过 CORS
    const r = await obsidian.requestUrl({
      url,
      method: 'POST',
      contentType: 'application/json',
      body,
      throw: false,
    });
    if (r.status !== 200) {
      throw new Error(`Ollama HTTP ${r.status}: ${(r.text || '').slice(0, 200)}`);
    }
    const data = r.json;
    if (!data || !data.message || !data.message.content) {
      throw new Error('Ollama 返回格式不对');
    }
    return data.message.content;
  }
}

// ---------- 模式选择 modal ----------

class ExpandPickerModal extends obsidian.Modal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
  }
  onOpen() {
    this.contentEl.createEl('h2', { text: '选择展开模式' });
    for (const [key, p] of Object.entries(PROMPTS)) {
      const btn = this.contentEl.createEl('button', {
        text: `${p.icon}  ${p.name}`,
        cls: 'mod-cta',
      });
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.marginBottom = '8px';
      btn.style.padding = '12px';
      btn.style.textAlign = 'left';
      btn.addEventListener('click', async () => {
        this.close();
        await this.onPick(key);
      });
    }
  }
  onClose() { this.contentEl.empty(); }
}

// ---------- 设置面板 ----------

class DailyBotAISettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'echolog AI 设置' });

    new obsidian.Setting(containerEl)
      .setName('Ollama URL')
      .setDesc('本地 Ollama 地址，默认 http://localhost:11434')
      .addText(text => text
        .setValue(this.plugin.settings.ollamaUrl)
        .onChange(async (v) => { this.plugin.settings.ollamaUrl = v.trim(); await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName('文本模型')
      .setDesc('用于展开的 Ollama 模型，必须先 ollama pull 下来。推荐 qwen3.5:9b。')
      .addText(text => text
        .setValue(this.plugin.settings.textModel)
        .onChange(async (v) => { this.plugin.settings.textModel = v.trim(); await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName('Temperature')
      .setDesc('0 = 最稳健，1 = 最有创意。展开长文建议 0.5-0.7。')
      .addText(text => text
        .setValue(String(this.plugin.settings.temperature))
        .onChange(async (v) => {
          const n = parseFloat(v);
          if (Number.isFinite(n)) { this.plugin.settings.temperature = n; await this.plugin.saveSettings(); }
        }));

    new obsidian.Setting(containerEl)
      .setName('Context window')
      .setDesc('num_ctx，模型 context 长度。默认 16384。')
      .addText(text => text
        .setValue(String(this.plugin.settings.numCtx))
        .onChange(async (v) => {
          const n = parseInt(v, 10);
          if (Number.isFinite(n) && n > 0) { this.plugin.settings.numCtx = n; await this.plugin.saveSettings(); }
        }));
  }
}

module.exports = DailyBotAIPlugin;
