# 推送專案到 GitHub 的 PowerShell 腳本
# 使用方法: .\push-to-github.ps1

Write-Host "=== 準備推送專案到 GitHub ===" -ForegroundColor Green

# 檢查是否在正確的目錄
if (-not (Test-Path "package.json")) {
    Write-Host "錯誤: 請在 my-travel-app 目錄中執行此腳本" -ForegroundColor Red
    exit 1
}

# 檢查 Git 是否安裝
try {
    $gitVersion = git --version
    Write-Host "找到 Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "錯誤: 未找到 Git。請先安裝 Git: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# 檢查是否已初始化 Git 倉庫
if (-not (Test-Path ".git")) {
    Write-Host "初始化 Git 倉庫..." -ForegroundColor Yellow
    git init
} else {
    Write-Host "Git 倉庫已存在" -ForegroundColor Green
}

# 檢查是否有未提交的更改
$status = git status --porcelain
if ($status) {
    Write-Host "發現未提交的更改，正在添加文件..." -ForegroundColor Yellow
    git add .
    
    Write-Host "創建提交..." -ForegroundColor Yellow
    git commit -m "Initial commit: Vue travel app with Supabase"
} else {
    Write-Host "沒有未提交的更改" -ForegroundColor Green
}

# 檢查是否已有 remote
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "請在 GitHub 上創建新倉庫，然後執行以下命令：" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/您的用戶名/my-travel-app.git" -ForegroundColor Cyan
    Write-Host "  git branch -M main" -ForegroundColor Cyan
    Write-Host "  git push -u origin main" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "或者，如果您已經創建了 GitHub 倉庫，請輸入倉庫 URL：" -ForegroundColor Yellow
    $repoUrl = Read-Host "GitHub 倉庫 URL"
    if ($repoUrl) {
        git remote add origin $repoUrl
        git branch -M main
        Write-Host "正在推送到 GitHub..." -ForegroundColor Yellow
        git push -u origin main
        Write-Host "完成！專案已成功推送到 GitHub" -ForegroundColor Green
    }
} else {
    Write-Host "已連接到遠端倉庫: $remote" -ForegroundColor Green
    Write-Host "正在推送到 GitHub..." -ForegroundColor Yellow
    git branch -M main
    git push -u origin main
    Write-Host "完成！專案已成功推送到 GitHub" -ForegroundColor Green
}
