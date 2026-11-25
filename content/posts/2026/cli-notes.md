---
title: 备忘：几个让我少走弯路的命令行
date: 2026-11-24
category: fragment
tags: [备忘录, git, npm]
summary: 不长记性，所以记在这里。都是些每次用都要想一下的东西：撤销提交、找回删掉的分支、看清楚 npm 装了什么。
sample: true
---

纯备忘，不解释原理。

## git：提交了但想改

```bash
# 上一次提交的说明写错了 —— 直接改，不进新的提交
git commit --amend -m "新的说明"

# 上一次提交漏了文件
git add 漏掉的.ts
git commit --amend --no-edit

# 想撤销上一次提交，但保留改动（最常用）
git reset --soft HEAD~1

# 想撤销上一次提交，并且连改动一起丢掉（危险）
git reset --hard HEAD~1
```

`--hard` 那个要小心。它不问你，直接扔。

## git：删掉的分支怎么找回来

```bash
# 先看所有操作记录
git reflog

# 找到那行 "commit: xxx"，然后
git checkout -b 恢复的分支名 <那一串哈希>
```

`reflog` 是本地记录，只在你自己电脑上有。换台机器就找不回来了。

## git：只想看某个文件最近改了什么

```bash
git log --oneline -- src/pages/Home.vue

# 看具体改了哪几行
git log -p -- src/pages/Home.vue
```

## npm：到底装了什么

```bash
# 直接依赖（package.json 里写的那几个）
npm ls --depth=0

# 为什么这个包会在这 —— 查依赖链
npm why 某个包名

# 哪些包有新版本
npm outdated
```

`npm why` 特别有用。有时候莫名其妙多出来一个包，用它一查就知道是谁带进来的。

## npm：装坏了怎么办

```bash
# 删掉依赖和锁文件，重装（网络问题时最有效）
rm -rf node_modules package-lock.json
npm install
```

Windows 上 `rm -rf` 换成：

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
```

## 看端口被谁占了

Windows：

```powershell
netstat -ano | findstr :5178
taskkill /PID <上面查到的PID> /F
```

macOS / Linux：

```bash
lsof -i :5178
kill -9 <PID>
```

## 文件批量改名（PowerShell）

```powershell
Get-ChildItem *.png | Rename-Item -NewName { $_.Name -replace '旧', '新' }
```

## 递归找某个字符串在哪些文件里

```bash
grep -rn "要搜的文字" src/
```

Windows 没有 grep 的话：

```powershell
Select-String -Path src\**\*.* -Pattern "要搜的文字"
```

---

用到了就补一条。这个列表大概会一直变长。
