<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.svg">
    <img src="docs/images/logo.svg" alt="DeepSeek Bot" width="260">
  </picture>
</p>

<div align="center">

# DS Bot Workspaces

### Coordinate in Bot chats. Execute in the right workspace. Verify separately.

**A workspace-execution fork of [DeepSeek Bot](https://github.com/Fei2411/DeepSeek-Bot), built on DeepSeek Harness—not a fork of the harness.**

[![Prerelease](https://img.shields.io/badge/release-0.1.6--workspaces.1-2563eb)](https://github.com/BluePointDigital/ds-bot-workspaces/releases/tag/v0.1.6-workspaces.1)
[![CI](https://github.com/BluePointDigital/ds-bot-workspaces/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/BluePointDigital/ds-bot-workspaces/actions/workflows/test.yml?query=branch%3Amain)
[![License](https://img.shields.io/badge/license-Apache_2.0-green)](LICENSE)

**[Download prerelease](https://github.com/BluePointDigital/ds-bot-workspaces/releases/tag/v0.1.6-workspaces.1)** · **[Deployment guide](ds-bot/deployment/README.md)** · **[Architecture & changes](WORKSPACE-BRIDGE.md)** · **[Verification & limits](ds-bot/deployment/VERIFICATION.md)**

English | [中文](README.zh.md)

</div>

> [!IMPORTANT]
> **This fork changes where delegated work runs.** Your long-lived Bots remain the coordination and reporting surface. Bounded assignments execute in ordinary, persistent chats inside the exact registered project workspace, with inspectable evidence and outcomes returned to the owning Bot.

## What is different about this fork?

| Area | Upstream DS Bot foundation | What this fork adds |
|---|---|---|
| **Execution context** | Long-lived Bots and group conversations | Stable execution chats in exact existing workspaces, with the actual project working directory |
| **Delegation** | Bot-to-Bot messaging and group handoffs | Bounded assignments with immutable scope/authority, current owner role/model/permissions, and real delegating-Bot attribution |
| **Traceability** | Persistent Bot conversations | Durable assignment keys, matching execution outcomes and owner callbacks; repeating a key does not resend work |
| **Stop & recovery** | DSH's session and tool infrastructure | New-dispatch pause, stop with retained inbox, uncertain interrupted work and no automatic replay |
| **Independent review** | Customizable Bot roles | Separate producer and Verifier workstreams; execution completion is not QA or client acceptance |
| **Repeatable setup** | Upstream plugin installation | Pinned GitHub release assets and checksums, opt-in configuration, preservation helpers, acceptance pilot and rollback guidance |

```mermaid
flowchart LR
    A["Owning Bot chat<br/>Coordinate & report"] -->|Bounded assignment| B["Registered project workspace<br/>Ordinary execution chat"]
    B -->|Outcome & evidence| A
    A -->|Separate QA assignment| C["Same project workspace<br/>Independent Verifier chat"]
    C -->|Verification result| A
```

### Four new workspace tools

`list_client_workstreams` → `open_client_workstream` → `assign_client_workstream` → `control_client_workstream`

Opening a stream does **not** dispatch work. Scope and authority stay fixed; a promised review never silently becomes publication permission.

### Install this fork—not the upstream npm package

1. Download **`ds-bot-0.1.6-workspaces.1.tgz`** and **`SHA256SUMS`** from the [prerelease](https://github.com/BluePointDigital/ds-bot-workspaces/releases/tag/v0.1.6-workspaces.1), then verify the checksum.
2. Follow the [deployment guide](ds-bot/deployment/README.md) to replace `ds-bot` in the selected profile, preserving existing configuration, Bot identities, permissions, schedules and pending work.
3. Explicitly enable `workspaceBridge: true` and disable upstream update offers with `updateCheck: false`. First activation pauses new dispatch; run the isolated acceptance pilot before deliberately enabling it.

> [!WARNING]
> **Staged-evaluation prerelease—not blanket production qualification.** The guard blocks DS Bot orchestration tools inside workers; it is **not** a universal shell/filesystem/API sandbox or tenant-isolation boundary. No automatic schedule migration, credential/state copying or backlog replay. Each deployment needs its own acceptance check. See [verification details](ds-bot/deployment/VERIFICATION.md).

---

## Upstream DS Bot overview

The original project's overview, screenshots and installation instructions are retained below for attribution and reference. **The upstream `ds-bot` npm package does not include this fork's workspace bridge.**

DeepSeek Bot (DS Bot) is a bot plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). It turns DSH into bots. You create your own bots, then talk and work with them.

![Say one sentence to Chief, and it sets up the bots and the group chat](docs/images/team.png)

## Install

First install DSH and set up at least one model in it. DS Bot uses the models from DSH.

**DSH Desktop (Windows, macOS)**

1. In the sidebar, select **Plugins** → **Add plugin**.
2. In **Package name or address**, enter `ds-bot`. In mainland China, set **Registry** to **Mainland China mirror**.
3. Select **Install**, then **Enable now**. If DSH says the change takes effect at the next start, quit DSH completely and open it again.

If npm is not reachable, in step 2 you can also enter the full path of `ds-bot-0.1.6.tgz` downloaded from [Releases](https://github.com/Fei2411/DeepSeek-Bot/releases), or `github:Fei2411/DeepSeek-Bot#v0.1.6&path:/ds-bot` (needs Git).

**DSH Web (Windows, macOS, Linux)**

Needs Node.js `22.19` or later, and pnpm.

```sh
npx @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add ds-bot
npx @deepseek-ai/dsh@0.2.0-rc.2 web
```

## Setup

I strongly recommend that you set up your other bots and group chats by just talking to a bot.

## Features

### Bot

You can do all your talking and work with one bot, in one window. You don't need to worry about the context behind it. The bot's details page shows its info, and there you can pick the model you want it to use. You can switch models at any time, but I still recommend that you keep one model for a bot for a long time, and switch only when you really need to.

Bots also have memory. A bot remembers what you like and uses it in later work. You can manage its memory on the bot's details page, or just tell the bot.

![Bot details: model, memory, usage](docs/images/details.png)

### Main bot

The main bot is your chief. It has very high rights: it manages the other bots and the group chats. The first time you open DS Bot, there is already a main bot called Chief. Talk to it, and it walks you through the setup.

In short: have a question? Ask the main bot.

### Group chats

DS Bot has group chats. A group chat is a great way to get several bots to work together, but it clearly costs more. So DS Bot does this: every group chat has an admin. The admin answers your messages by default and calls in the other bots for you. You can also @ a bot directly, and it answers you directly: type @ and pick the bot from the list. To give the bots another chat as context, use + → Reference a chat in the message box.

Any bot can hand work to another bot with @. That bot does the work on its own, and the group goes on. While it works, it keeps the group posted, and the group, the sidebar and its own chat show what it is doing. When it is done, it posts the result in the group, and the bot that asked for the work answers. To stop the work, open the group's details.

![Group chat: the admin, Chief, hands the work to Writer and Coder](docs/images/group.png)

### Capabilities

Settings → **Capabilities** is a shared library of MCP servers, skills and packs. Add a capability to a Bot in its settings; it is available from that Bot's next message in its own chat and group chats. A local MCP command that a Bot adds needs your approval before it can run. While other Bots use a capability, only you or a Main Bot can change or delete it.

### Usage

In **Settings** → **Usage**, you can see token usage by time, by bot and by model.

![Usage page](docs/images/usage.png)

## Data

All data stays on your own computer, in `bot/` and `sessions/` in the DSH home folder (`~/.dsh` by default). Uninstalling the plugin does not delete this data.

## Development

The plugin source is in [`ds-bot/`](ds-bot/). For options and internals, see [`ds-bot/README.md`](ds-bot/README.md). For development, tests and how the team works, see [CONTRIBUTING.md](CONTRIBUTING.md). For changes between versions, see [CHANGELOG.md](CHANGELOG.md).

## Acknowledgments

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): DS Bot is built on the DSH plugin system. Every bot is a DSH session and uses the DSH tools and models.
- [esbuild](https://esbuild.github.io/): bundles the plugin's interface code.
- Thanks to these projects for the ideas they published. DS Bot learned from their designs and does not contain their code:
  - [AgentMemoryRepo](https://github.com/AgentMemoryRepo/agentmemoryrepo): the Markdown format of Bot memory.
  - [OpenAI Codex](https://github.com/openai/codex): checkpoints that keep the user's messages next to the summary, and message anchors for chat search.
  - [OpenMausBot](https://github.com/milind-soni/OpenMausBot): group chat rounds and @mention relays.
  - [Hermes Agent](https://github.com/NousResearch/hermes-agent) and [Hermes Bot Mode](https://github.com/NousResearch/Hermes-Bot-Mode): one session per member per group chat, and handoffs that carry the earlier user messages.
  - [OpenCode](https://github.com/sst/opencode), [goose](https://github.com/block/goose), [pi](https://github.com/badlogic/pi-mono) and [Gemini CLI](https://github.com/google-gemini/gemini-cli): when to condense a long chat, and what a handoff note holds.
  - [obelisk](https://github.com/tommy0103/obelisk): chat search with a SQLite full-text index.
- Everyone who tries DS Bot, asks questions and reports bugs.

## License

[Apache License 2.0](LICENSE). Provided "as is", without any warranty. Third-party code and its license are listed in [NOTICE](NOTICE).

## Disclaimer

DS Bot is an independent community project. **It is not an official DeepSeek product**, and it is not affiliated with, endorsed by or sponsored by DeepSeek. "DeepSeek", "DeepSeek Harness" and the other names are trademarks of their owners. They are used here only to say what this plugin works with.

Bots use your own model quota, and they read and write files and run commands when you ask them to. Check important actions yourself.
