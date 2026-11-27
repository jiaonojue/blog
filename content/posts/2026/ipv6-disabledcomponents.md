---
title: 备忘：IPv6 连不上时，除了网卡还要改注册表
date: 2026-11-26
category: fragment
tags: [备忘录, 网络, Windows]
summary: Windows 上 IPv6 明明开了却连不上，最常见的原因不是网卡设置，而是注册表里 DisabledComponents 被某个"优化工具"改成了非零值。这篇记一下怎么查、怎么改回 0。
sample: true
closing: 系统的默认值有它的道理，别轻易相信"一键优化"。
---

在 Windows 上折腾 IPv6，最容易踩的一个坑：网卡属性里 IPv6 明明是勾上的，`ipconfig` 里也看不到 IPv6 地址。查半天，最后发现是注册表里有个叫 `DisabledComponents` 的值被改过。

## 先确认现象

打开命令提示符，敲：

```powershell
ipconfig
```

看你的网卡下面有没有 `IPv6 地址` 这一行。如果只有 IPv4、没有 IPv6，而网卡属性里 IPv6 又是勾着的，那大概率就是注册表的问题。

也可以直接查：

```powershell
Get-NetAdapterBinding -ComponentID ms_tcpip6
```

`Enabled` 一列如果是 `True`，说明网卡层面是开着的，问题就在别处。

## DisabledComponents 是什么

Windows 的 IPv6 一共有两层开关：

1. **网卡绑定** —— 就是网络连接属性里那个「Internet 协议版本 6 (TCP/IPv6)」的勾。
2. **协议栈全局开关** —— 注册表里的 `DisabledComponents`。

第二层优先。它非零的时候，第一层怎么勾都没用。

位置：

```
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters
```

值名：`DisabledComponents`，类型 `REG_DWORD`。

## 为什么它会被改成非零

一些所谓的「系统优化工具」「游戏加速器」「网络修复脚本」，为了让网络"更快"，会把 IPv6 整个关掉。它们改的就是这个值。

常见的非零值：

| 值           | 含义                     |
| ------------ | ------------------------ |
| `0xFF` (255) | 除了回环，所有 IPv6 全关 |
| `0x20` (32)  | 优先使用 IPv4            |
| `0x10` (16)  | 关闭某些隧道接口         |

只要不是 `0`，行为就和默认不一样。

## 改回 0

**用命令行（推荐，管理员权限）**

```powershell
# 先看看现在是什么值
Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters' -Name DisabledComponents

# 改成 0
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters' -Name DisabledComponents -Value 0 -Type DWord
```

**用图形界面**

1. `Win + R`，输入 `regedit`，回车。
2. 地址栏粘贴：
   ```
   计算机\HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters
   ```
3. 找到 `DisabledComponents`，双击，把「数值数据」改成 `0`，基数选「十六进制」。
4. 如果这个值不存在，说明是系统默认（等于全开），不用动。

改完**必须重启**。这个值是开机时读的，改完不重启不生效。

## 改完还是不行

按顺序排查：

```powershell
# 1. 网卡绑定确实开着？
Get-NetAdapterBinding -ComponentID ms_tcpip6

# 2. 拿到 IPv6 地址了吗（fe80 开头的是链路本地，不算公网）
ipconfig | Select-String "IPv6"

# 3. 能不能通
ping -6 ipv6.baidu.com
```

如果 `ping` 通了但浏览器打不开 IPv6 网站，那是 DNS 的问题，和这个开关无关。

## 顺便说一句

如果你的网络环境本来就不提供 IPv6（很多老小区宽带就是这样），那 `DisabledComponents` 改成 0 也不会有 IPv6 地址。这种情况下 IPv4 照常用，不影响任何事。

真正需要 IPv6 的场景不多：某些 PT 站、某些游戏联机、某些远程访问。日常上网 IPv4 完全够。
