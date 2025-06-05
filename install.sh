#!/bin/bash

echo "🚀 开始安装 Telegram PWS Bot (TypeScript版)..."

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 18 或更高版本"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 18 或更高版本，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本检查通过: $(node -v)"

# 安装依赖
echo "📦 安装项目依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 复制环境变量文件
if [ ! -f ".env" ]; then
    echo "📝 创建环境变量文件..."
    cp env.example .env
    echo "✅ 已创建 .env 文件，请编辑此文件填写必要的配置"
    echo ""
    echo "必填配置项："
    echo "- Token: 机器人令牌"
    echo "- Admin: 管理员用户ID"
    echo "- Channel: 投稿频道"
    echo ""
    echo "请使用以下命令编辑配置："
    echo "nano .env"
    echo ""
else
    echo "⚠️  .env 文件已存在，跳过创建"
fi

# 构建项目
echo "🔨 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 项目构建失败"
    exit 1
fi

echo "✅ 项目构建完成"

# 创建日志目录
mkdir -p logs

echo ""
echo "🎉 安装完成！"
echo ""
echo "下一步："
echo "1. 编辑 .env 文件填写配置: nano .env"
echo "2. 启动机器人:"
echo "   - 开发模式: npm run dev"
echo "   - 生产模式: npm start"
echo "   - 使用 PM2: pm2 start ecosystem.config.js"
echo ""
echo "更多信息请查看 README.md" 