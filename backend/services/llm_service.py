"""
LLM 服务 - 统一的 AI 模型调用接口
支持 小米MiMo / OpenAI / DeepSeek / Claude / 智谱 等多种模型
"""
import os
import json
import httpx
from pathlib import Path
from typing import List, Dict, Optional, AsyncGenerator

# 加载 .env 文件（不存在则跳过，Key 为空时需在 Settings 页面配置）
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"[LLM] Loaded .env from {env_path}")
    else:
        print(f"[LLM] .env not found at {env_path}, please configure API Key in Settings page")
except ImportError:
    print("[LLM] python-dotenv not installed, skipping .env loading")

# 各 provider 配置
PROVIDERS = {
    "xiaomi": {
        "base_url": "https://api.xiaomimimo.com/v1",
        "api_key_env": "XIAOMI_API_KEY",
        "models": ["mimo-v2.5", "mimo-v2.5-pro", "mimo-v2.5-asr"]
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini", "gpt-3.5-turbo"]
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "DEEPSEEK_API_KEY",
        "models": ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"]
    },
    "claude": {
        "base_url": "https://api.anthropic.com/v1",
        "api_key_env": "ANTHROPIC_API_KEY",
        "models": ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-3-5-sonnet-20241022"]
    },
    "zhipu": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key_env": "ZHIPU_API_KEY",
        "models": ["glm-4-plus", "glm-4", "glm-4-flash", "glm-4-long", "glm-4v-plus"]
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_env": "QWEN_API_KEY",
        "models": ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long", "qwen-vl-max"]
    },
    "moonshot": {
        "base_url": "https://api.moonshot.cn/v1",
        "api_key_env": "MOONSHOT_API_KEY",
        "models": ["moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"]
    },
    "doubao": {
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "api_key_env": "DOUBAO_API_KEY",
        "models": ["doubao-1.5-pro-256k", "doubao-1.5-lite-32k", "doubao-pro-256k"]
    },
    "baichuan": {
        "base_url": "https://api.baichuan-ai.com/v1",
        "api_key_env": "BAICHUAN_API_KEY",
        "models": ["Baichuan4", "Baichuan3-Turbo", "Baichuan2-Turbo"]
    },
    "minimax": {
        "base_url": "https://api.minimax.chat/v1",
        "api_key_env": "MINIMAX_API_KEY",
        "models": ["abab6.5-chat", "abab5.5-chat", "abab6.5s-chat"]
    },
    "ollama": {
        "base_url": "http://localhost:11434/v1",
        "api_key_env": "OLLAMA_API_KEY",
        "models": ["qwen2.5:7b", "llama3.1:8b", "deepseek-r1:7b", "gemma2:9b", "mistral:7b"]
    },
    "custom": {
        "base_url": "",
        "api_key_env": "CUSTOM_API_KEY",
        "models": []
    }
}


class LLMService:
    def __init__(self, provider: str = None, model: str = None):
        self.provider = provider or os.getenv("LLM_PROVIDER", "xiaomi")
        self.model = model or os.getenv("LLM_MODEL", "mimo-v2.5")
        self.base_url = os.getenv("LLM_BASE_URL", "")
        self.config = PROVIDERS.get(self.provider, PROVIDERS["xiaomi"])
        # API key: 先查 provider 专属 env，再查通用 LLM_API_KEY
        self.api_key = os.getenv(self.config["api_key_env"], "") or os.getenv("LLM_API_KEY", "")
    
    def reconfigure(self, provider: str = None, model: str = None, api_key: str = None, base_url: str = None):
        """运行时重新配置（来自前端 Settings 保存）"""
        if provider and provider in PROVIDERS:
            self.provider = provider
            # 基于 provider 默认 config 复制一份，避免污染全局
            self.config = {**PROVIDERS[provider]}
        if model:
            self.model = model
        if api_key is not None and api_key.strip():
            self.api_key = api_key
            os.environ["LLM_API_KEY"] = api_key
            if self.config.get("api_key_env"):
                os.environ[self.config["api_key_env"]] = api_key
        if base_url is not None and base_url.strip():
            self.base_url = base_url
            self.config["base_url"] = base_url
    
    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """普通对话（非流式）"""
        
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        base = self.base_url or self.config["base_url"]
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{base}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def chat_stream(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> AsyncGenerator[str, None]:
        """流式对话"""
        
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        base = self.base_url or self.config["base_url"]
        # 增加超时时间到 300 秒，支持长响应
        timeout = httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{base}/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                chunk = json.loads(line[6:])
                                choices = chunk.get("choices", [])
                                if choices and choices[0].get("delta", {}).get("content"):
                                    content = choices[0]["delta"]["content"]
                                    if content:
                                        yield content
                            except (json.JSONDecodeError, KeyError, IndexError) as e:
                                # 跳过解析错误的行
                                continue
            except httpx.ReadTimeout:
                print(f"[LLM] Stream timeout after 300s", flush=True)
                yield "\n\n⚠️ 响应超时，请重试"
            except httpx.ConnectError as e:
                print(f"[LLM] Connection error: {e}", flush=True)
                yield f"\n\n⚠️ 连接错误: {str(e)[:100]}"
            except Exception as e:
                print(f"[LLM] Stream error: {e}", flush=True)
                yield f"\n\n⚠️ 流式响应错误: {str(e)[:100]}"


# 单例
llm_service = LLMService()
