# 將專案推送到 GitHub 的步驟

## 前置準備
1. 確保已安裝 Git（如果還沒安裝，請從 https://git-scm.com/download/win 下載）
2. 確保已註冊 GitHub 帳號

## 步驟 1: 初始化 Git 倉庫（如果還沒初始化）
```bash
cd my-travel-app
git init
```

## 步驟 2: 配置 Git（如果還沒配置）
```bash
git config --global user.name "您的名字"
git config --global user.email "您的email@example.com"
```

## 步驟 3: 添加所有文件並創建初始提交
```bash
git add .
git commit -m "Initial commit: Vue travel app with Supabase"
```

## 步驟 4: 在 GitHub 上創建新倉庫
1. 登入 GitHub
2. 點擊右上角的 "+" 按鈕，選擇 "New repository"
3. 輸入倉庫名稱（例如：`my-travel-app`）
4. 選擇 Public 或 Private
5. **不要**勾選 "Initialize this repository with a README"（因為我們已經有本地專案）
6. 點擊 "Create repository"

## 步驟 5: 連接本地倉庫到 GitHub 並推送
複製 GitHub 提供的命令（類似以下，但使用您的實際 URL）：
```bash
git remote add origin https://github.com/您的用戶名/my-travel-app.git
git branch -M main
git push -u origin main
```

或者如果使用 SSH：
```bash
git remote add origin git@github.com:您的用戶名/my-travel-app.git
git branch -M main
git push -u origin main
```

## 完成！
您的專案現在已經推送到 GitHub 了！
