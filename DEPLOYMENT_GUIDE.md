# IELTS Tutor Vercel 部署指南

## 当前状态
✅ 代码已准备完毕
✅ Vercel CLI 已安装
✅ 依赖已安装

## 部署步骤

### 1. 登录 Vercel（在 Windows 终端执行）

打开 PowerShell 或 CMD，运行：
```bash
vercel login
```
会自动打开浏览器，完成登录。

### 2. 创建 Google Cloud Storage

访问：https://console.cloud.google.com/storage

**创建 Bucket：**
- 名称：`ielts-tutor-sessions`
- 位置：asia-east1（或其他区域）
- 存储类别：Standard
- 访问控制：统一

**创建服务账号：**
1. 访问：https://console.cloud.google.com/iam-admin/serviceaccounts
2. 点击"创建服务账号"
3. 名称：`ielts-tutor-storage`
4. 授予角色：`Storage Object Admin`
5. 创建密钥 → JSON 格式 → 下载

### 3. 初始化 Vercel 项目

在项目目录运行：
```bash
cd E:\ielts-tutor
vercel
```

按提示选择：
- Set up and deploy? **Y**
- Which scope? 选择你的账号
- Link to existing project? **N**
- Project name? **ielts-tutor**（或自定义）
- In which directory? **./**
- Override settings? **N**

### 4. 配置环境变量

访问 Vercel Dashboard：https://vercel.com/dashboard

进入项目 → Settings → Environment Variables

添加以下变量（所有环境都选上：Production, Preview, Development）：

| 变量名 | 值 |
|--------|-----|
| `VITE_API_KEY` | 你的 Gemini API Key |
| `GCS_PROJECT_ID` | Google Cloud 项目 ID（在 JSON 密钥中找到） |
| `GCS_BUCKET_NAME` | `ielts-tutor-sessions` |
| `GCS_CREDENTIALS` | 整个 JSON 密钥文件的内容（复制粘贴） |

### 5. 部署到生产环境

```bash
vercel --prod
```

部署完成后会显示你的网站地址，例如：
```
https://ielts-tutor-xxx.vercel.app
```

### 6. 测试部署

1. 访问你的 Vercel 网址
2. 测试 Casual Chat 模式（验证记忆功能）
3. 完成一次对话并保存
4. 检查 Google Cloud Storage 中是否有文件

## 故障排查

**问题：API 调用失败**
- 检查 Vercel 环境变量是否正确配置
- 确认 `GCS_CREDENTIALS` 是完整的 JSON 内容

**问题：无法保存会话**
- 检查服务账号权限是否为 "Storage Object Admin"
- 确认 bucket 名称正确

**问题：前端无法连接 Gemini**
- 检查 `VITE_API_KEY` 是否正确
- 在 Google Cloud Console 限制 API Key 只能从 Vercel 域名访问

## 本地开发

如果需要本地测试 Vercel Functions：
```bash
vercel dev
```

## 更新部署

修改代码后重新部署：
```bash
git add .
git commit -m "Update"
vercel --prod
```
