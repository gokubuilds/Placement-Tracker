import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.models import ModelTarget, GeminiAPIEndpoint, ModelType

async def test_model(model_name):
    c = LocalAgentConfig()
    c.models = [
        ModelTarget(
            name=model_name,
            types=[ModelType.TEXT],
            endpoint=GeminiAPIEndpoint(base_url=None, http_headers=None)
        )
    ]
    c.api_key = os.environ.get("GEMINI_API_KEY")
    try:
        async with Agent(c) as a:
            res = await a.chat("hello")
            print(f"Success for {model_name}: {await res.text()}")
            return True
    except Exception as e:
        print(f"Error for {model_name}: {e}")
        return False

async def main():
    await test_model("gemini-2.0-flash")
    await test_model("gemini-2.5-flash")
    await test_model("gemini-1.5-flash")
    await test_model("gemini-1.5-pro")

if __name__ == "__main__":
    asyncio.run(main())
