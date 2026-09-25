/** 爱易威 OpenAI 兼容接口调用示例（与 modelCallParams 参数一致） */

import {
  AIYIWEI_CHAT_MODEL,
  AIYIWEI_MAI_DS_R1_API_MODEL,
  AIYIWEI_DEEPSEEK_API_MODEL,
  MAI_DS_R1_ANALYSIS_SYSTEM,
  MAI_DS_R1_ANALYSIS_ADVANCED,
  MAI_DS_R1_ANALYSIS_EXAMPLE,
  MAI_DS_R1_ANALYSIS_TONE,
  DOUBAO_REPLY_EXAMPLE,
  DOUBAO_REPLY_TONE,
} from './promptTemplates';
import { REPLY_STYLE_SETTINGS_SUMMARY } from './replyStylePrompts';
import { AIYIWEI_CHAT_MODEL_ALT } from './modelRouting';

export const AIYIWEI_API_BASE = 'https://aiyiwei.vip/v1/chat/completions';

/** 路由后缀说明（与 OpenRouter 兼容，转发前自动剥离） */
export const AIYIWEI_ROUTING_DOC = `路由控制（任选其一，后缀优先级最高）：
· 模型后缀 :floor  → 价格最低  |  :nitro  → 速度最快  |  :stable  → 成功率最高
· 请求体 provider.sort：price | speed | success_rate（与后缀等价）
· Token 级 routing_priority：在爱易威控制台一次配置全局生效
本应用服务端默认自动追加 :stable（DeepSeek / MAI-DS-R1 / 豆包），降低「分组负载饱和」失败率。`;

/** DeepSeek V4 Flash · 深度分析（智能模式默认，:stable） */
export const AIYIWEI_PYTHON_DEEPSEEK_ANALYSIS = `import requests
import json

url = "${AIYIWEI_API_BASE}"
headers = {
    "Authorization": "Bearer 你的API_KEY",
    "Content-Type": "application/json"
}
# 方式① 模型后缀（推荐）— 与官方文档完全一致
# 注意：DeepSeek 不支持 response_format，须在 prompt 中要求 JSON
data = {
    "model": "${AIYIWEI_DEEPSEEK_API_MODEL}:stable",
    "messages": [
        {"role": "system", "content": "你是女性心理穿透分析师。必须严格返回 JSON，以 { 开头，不要 markdown 代码块"},
        {"role": "user", "content": "对方说：你是谁？ 抖音"}
    ],
    "temperature": 0.8,
    "top_p": 0.9,
    "max_tokens": 2800,
    "stream": False
}
# 方式② provider.sort（与后缀等价，二选一即可）
# data["model"] = "${AIYIWEI_DEEPSEEK_API_MODEL}"
# data["provider"] = {"sort": "success_rate"}

response = requests.post(url, headers=headers, json=data)
print(json.dumps(response.json(), indent=2, ensure_ascii=False))`;

/** DeepSeek V4 Flash · :floor / :nitro 路由 */
export const AIYIWEI_PYTHON_DEEPSEEK_ROUTING = `# :floor 价格最低  |  :nitro 速度最快
import requests

url = "${AIYIWEI_API_BASE}"
headers = {"Authorization": "Bearer 你的API_KEY", "Content-Type": "application/json"}

floor = requests.post(url, headers=headers, json={
    "model": "${AIYIWEI_DEEPSEEK_API_MODEL}:floor",
    "messages": [{"role": "user", "content": "分析：她说最近好累 抖音"}],
    "temperature": 0.8, "max_tokens": 2800, "stream": False
})
nitro = requests.post(url, headers=headers, json={
    "model": "${AIYIWEI_DEEPSEEK_API_MODEL}:nitro",
    "messages": [{"role": "user", "content": "分析：她说最近好累 抖音"}],
    "temperature": 0.8, "max_tokens": 2800, "stream": False
})
print("floor:", floor.json())
print("nitro:", nitro.json())`;

export const AIYIWEI_CURL_DEEPSEEK = `curl ${AIYIWEI_API_BASE} \\
  -H "Authorization: Bearer 你的API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${AIYIWEI_DEEPSEEK_API_MODEL}",
    "provider": {"sort": "price"},
    "messages": [{"role": "user", "content": "分析这段聊天…"}],
    "temperature": 0.8,
    "max_tokens": 2800
  }'`;

/** MAI-DS-R1 · 深度心理分析（:stable，支持 response_format） */
export const AIYIWEI_PYTHON_MAI_DS_R1 = `import requests
import json

url = "${AIYIWEI_API_BASE}"
headers = {
    "Authorization": "Bearer 你的API_KEY",
    "Content-Type": "application/json"
}
data = {
    "model": "${AIYIWEI_MAI_DS_R1_API_MODEL}:stable",
    "messages": [
        {"role": "system", "content": "你是女性心理穿透分析师，精准、简短、不鸡汤"},
        {"role": "user", "content": "对方说：你是谁？ 抖音"}
    ],
    "temperature": 0.8,
    "top_p": 0.9,
    "max_tokens": 2800,
    "stream": False,
    "response_format": {"type": "json_object"}
}
response = requests.post(url, headers=headers, json=data)
print(json.dumps(response.json(), indent=2, ensure_ascii=False))`;

/** MAI-DS-R1 · :floor / :nitro 路由示例 */
export const AIYIWEI_PYTHON_MAI_DS_R1_ROUTING = `# :floor 价格最低  |  :nitro 速度最快
import requests

url = "${AIYIWEI_API_BASE}"
headers = {"Authorization": "Bearer 你的API_KEY", "Content-Type": "application/json"}

floor = requests.post(url, headers=headers, json={
    "model": "${AIYIWEI_MAI_DS_R1_API_MODEL}:floor",
    "messages": [{"role": "user", "content": "分析：她说最近好累 抖音"}],
    "temperature": 0.8, "max_tokens": 800, "stream": False
})
nitro = requests.post(url, headers=headers, json={
    "model": "${AIYIWEI_MAI_DS_R1_API_MODEL}:nitro",
    "messages": [{"role": "user", "content": "分析：她说最近好累 抖音"}],
    "temperature": 0.8, "max_tokens": 800, "stream": False
})
print("floor:", floor.json())
print("nitro:", nitro.json())`;

export const AIYIWEI_CURL_MAI_DS_R1 = `curl ${AIYIWEI_API_BASE} \\
  -H "Authorization: Bearer 你的API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${AIYIWEI_MAI_DS_R1_API_MODEL}",
    "provider": {"sort": "price"},
    "messages": [{"role": "user", "content": "分析这段聊天…"}],
    "temperature": 0.8,
    "max_tokens": 2800,
    "response_format": {"type": "json_object"}
  }'`;

/** @deprecated 使用 AIYIWEI_PYTHON_DEEPSEEK_ANALYSIS */
export const AIYIWEI_PYTHON_ANALYSIS = AIYIWEI_PYTHON_DEEPSEEK_ANALYSIS;

export const AIYIWEI_PYTHON_CHAT = `import requests
import json

url = "${AIYIWEI_API_BASE}"
headers = {
    "Authorization": "Bearer 你的API_KEY",
    "Content-Type": "application/json"
}
# 豆包 Mini 260428 — 话术生成（本应用默认 :stable）
data = {
    "model": "${AIYIWEI_CHAT_MODEL}:stable",
    "messages": [
        {"role": "system", "content": "用自然口语回复，不官方、不油腻、像真人聊天，短句多、有语气"},
        {"role": "user", "content": "对方说：你是谁？ 抖音"}
    ],
    "temperature": 0.85,
    "top_p": 0.9,
    "max_tokens": 600,
    "stream": True
}
response = requests.post(url, headers=headers, json=data, stream=True)
for line in response.iter_lines():
    if line:
        print(line.decode("utf-8"))`;

export const AIYIWEI_PYTHON_CHAT_ALT = `import requests

url = "${AIYIWEI_API_BASE}"
headers = {"Authorization": "Bearer 你的API_KEY", "Content-Type": "application/json"}
# 豆包 Mini 260215 备选 — :nitro 优先速度
data = {
    "model": "${AIYIWEI_CHAT_MODEL_ALT}:nitro",
    "messages": [
        {"role": "system", "content": "用自然口语回复"},
        {"role": "user", "content": "对方说：哈哈，刷到你了 抖音"}
    ],
    "temperature": 0.85,
    "max_tokens": 600,
    "stream": False
}
# 等价写法：data = {"model": "${AIYIWEI_CHAT_MODEL_ALT}", "provider": {"sort": "speed"}, ...}
print(requests.post(url, headers=headers, json=data).json())`;

export const AIYIWEI_CURL_CHAT = `curl ${AIYIWEI_API_BASE} \\
  -H "Authorization: Bearer 你的API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${AIYIWEI_CHAT_MODEL}:floor",
    "messages": [{"role": "user", "content": "你好"}],
    "temperature": 0.85,
    "max_tokens": 600
  }'`;

/** 设置页展示的提示词模板摘要 */
export const AIYIWEI_PROMPT_TEMPLATE_SUMMARY = {
  deepseekAnalysis: {
    title: `DeepSeek V4 Flash（${AIYIWEI_DEEPSEEK_API_MODEL}）· 智能模式默认`,
    body: MAI_DS_R1_ANALYSIS_TONE,
    userExample: formatAnalysisExampleUser(MAI_DS_R1_ANALYSIS_EXAMPLE.user),
    outputExample: MAI_DS_R1_ANALYSIS_EXAMPLE.output,
    temperature: 0.8,
  },
  analysis: {
    title: `MAI-DS-R1（${AIYIWEI_MAI_DS_R1_API_MODEL}）· 深度心理穿透`,
    body: `${MAI_DS_R1_ANALYSIS_SYSTEM}\n\n${MAI_DS_R1_ANALYSIS_ADVANCED}`,
    userExample: formatAnalysisExampleUser(MAI_DS_R1_ANALYSIS_EXAMPLE.user),
    outputExample: MAI_DS_R1_ANALYSIS_EXAMPLE.output,
    temperature: 0.8,
  },
  chat: {
    title: `豆包 Mini（${AIYIWEI_CHAT_MODEL} / ${AIYIWEI_CHAT_MODEL_ALT}）· 14 风格话术`,
    body: `${DOUBAO_REPLY_TONE}\n\n${REPLY_STYLE_SETTINGS_SUMMARY}`,
    userExample: `${DOUBAO_REPLY_EXAMPLE.user}\n你的回复：`,
    outputExample: DOUBAO_REPLY_EXAMPLE.output,
    temperature: 0.85,
  },
};

function formatAnalysisExampleUser(raw: string): string {
  return `对方原话：${raw.replace(/\s+抖音$/, '')}（平台：抖音）`;
}
