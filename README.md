# PWS - Telegram投稿机器人 (TypeScript版)

![](https://img.shields.io/badge/license-MIT-green.svg)
![](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![](https://img.shields.io/badge/Node.js-18+-green.svg)

这是一个基于 TypeScript 重构优化的 Telegram 投稿机器人，帮助订阅者向频道投稿，支持多图投稿、稿件附加评论、夜间自动消音推送、多语言、黑名单等功能。

## ✨ 特性

- 🔧 **TypeScript 重构**: 完全使用 TypeScript 重写，提供更好的类型安全和开发体验
- 📝 **多格式投稿**: 支持文字、图片、视频等多种格式投稿
- 🖼️ **多图投稿**: 支持 MediaGroup 多图同时投稿
- 💬 **稿件评论**: 管理员可以为稿件添加评论
- 🌙 **夜间静音**: 支持夜间自动静音推送 (00:00-06:50)
- 🌍 **多语言**: 支持中文简体、中文繁体
- 🚫 **黑名单**: 支持用户黑名单功能
- 💾 **数据持久化**: 使用 LowDB 进行数据存储
- 🔄 **会话管理**: 支持管理员与用户的对话功能

## 🚀 安装

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 克隆项目

```bash
git clone <repository-url>
cd telegram-pwsbot-ts
npm install
```

### 配置环境变量

复制环境变量模板文件：

```bash
cp env.example .env
```

编辑 `.env` 文件，填写必要的配置：

```bash
vim .env
```

**必填参数：**

- `Token`: 机器人令牌，通过 [@botfather](https://t.me/botfather) 获取
- `Admin`: 管理员用户ID，通过 [@userinfobot](https://t.me/userinfobot) 获取
- `Channel`: 投稿频道，格式为 `@频道ID`

**可选参数：**

- `AutoMute`: 夜间静音时区，如 `Asia/Shanghai`
- `Lang`: 语言设置，支持 `zh-CN`、`zh-TW`

## 🏃‍♂️ 运行

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm run build
npm start
```

### 使用 PM2 (推荐)

```bash
# 安装 PM2
npm install pm2 -g

# 启动项目
pm2 start npm --name "pwsbot" -- start

# 重启项目
pm2 restart pwsbot
```

## 📋 部署步骤

1. **设置审稿群**：将机器人添加到审稿群，在群内使用 `/setgroup` 命令设置当前群为审稿群
2. **添加到频道**：将机器人添加为频道管理员
3. **测试功能**：私聊机器人发送 `/start` 测试基本功能

## 🎮 命令列表

### 用户命令 (私聊)

| 命令 | 说明 |
|------|------|
| `/start` | 显示投稿说明 |
| `/version` | 显示机器人版本信息 |

### 管理员命令 (审稿群)

| 命令 | 说明 |
|------|------|
| `/setgroup` | 设置当前群为审稿群 |
| `/ok [评论]` | 通过稿件，可附加评论 |
| `/no <理由>` | 拒绝稿件，需提供理由 |
| `/re <内容>` | 与用户对话回复 |
| `/ban [理由]` | 拉黑用户 |
| `/unban` | 解除拉黑 |
| `/unre` | 结束对话状态 |
| `/echo <内容>` | 单次回复用户 |
| `/pwshelp` | 显示命令帮助 |

## 🏗️ 项目结构

```
telegram-pwsbot-ts/
├── src/
│   ├── core/           # 核心模块
│   │   ├── config.ts   # 配置管理
│   │   └── bot.ts      # 机器人实例
│   ├── handlers/       # 处理器
│   │   ├── MessageHandler.ts    # 消息处理基类
│   │   └── CommandHandler.ts    # 命令处理器
│   ├── models/         # 数据模型
│   │   ├── Database.ts          # 数据库基类
│   │   ├── Submission.ts        # 投稿模型
│   │   ├── BlackList.ts         # 黑名单模型
│   │   └── ReplySession.ts      # 会话模型
│   ├── utils/          # 工具类
│   │   ├── Lang.ts     # 语言管理
│   │   └── Helper.ts   # 辅助工具
│   ├── types/          # 类型定义
│   │   └── index.ts    # 主要类型接口
│   └── main.ts         # 入口文件
├── lang/               # 语言文件
│   ├── zh-CN.json      # 中文简体
│   └── zh-TW.json      # 中文繁体
├── package.json
├── tsconfig.json
├── .eslintrc.json
└── README.md
```

## 🔧 开发

### 脚本命令

```bash
# 构建项目
npm run build

# 开发模式 (热重载)
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 修复代码格式
npm run lint:fix

# 清理构建文件
npm run clean

# 测试运行
npm run test
```

### 技术栈

- **TypeScript**: 类型安全的 JavaScript
- **Node.js**: 运行时环境
- **node-telegram-bot-api**: Telegram Bot API 库
- **LowDB**: 轻量级 JSON 数据库
- **dotenv**: 环境变量管理
- **ESLint**: 代码质量检查

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请通过以下方式联系：

- 提交 GitHub Issue
- 联系项目维护者

---

**注意**: 每次修改 `.env` 配置文件后，都需要重新启动项目才能生效。 