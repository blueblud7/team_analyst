import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'
import type { ProviderName, Tier } from './models'
import { PROVIDER_CONFIG } from './config'

export function getModel(provider: ProviderName, tier: Tier): LanguageModelV1 {
  const cfg = PROVIDER_CONFIG[provider]
  const modelId = cfg.tiers[tier].model

  switch (provider) {
    case 'openai': {
      const client = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
      return client(modelId)
    }
    case 'anthropic': {
      const client = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
      return client(modelId)
    }
    case 'deepseek': {
      const client = createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY ?? '',
        baseURL: cfg.baseUrl,
      })
      return client(modelId)
    }
    case 'qwen': {
      const client = createOpenAI({
        apiKey: process.env.QWEN_API_KEY ?? '',
        baseURL: cfg.baseUrl,
      })
      return client(modelId)
    }
    case 'google': {
      const client = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY ?? '' })
      return client(modelId)
    }
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
