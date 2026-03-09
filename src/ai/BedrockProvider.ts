import { createHmac, createHash } from 'crypto';
import { AIProvider } from './AIProvider';
import { AIProviderConfig, AIResponse } from '../types/ai';

// ─── AWS Signature V4 helpers (no SDK required) ─────────────────────────────

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function getAWSCreds(): { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string } {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables,\n' +
      'or configure an AWS credentials profile. Alternatively, use OpenRouter or Groq instead.'
    );
  }
  return { accessKeyId, secretAccessKey, sessionToken, region };
}

function signRequest(
  method: string,
  url: string,
  body: string,
  creds: ReturnType<typeof getAWSCreds>
): Record<string, string> {
  const { accessKeyId, secretAccessKey, sessionToken, region } = creds;
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const service = 'bedrock';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'host': host,
    'x-amz-date': amzDate,
    ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
  };

  const signedHeaderNames = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}`).join('\n') + '\n';

  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    '',
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
    'aws4_request'
  );

  const signature = hmac(signingKey, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  return {
    ...headers,
    Authorization: authorization,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export class BedrockProvider extends AIProvider {
  constructor(config: AIProviderConfig) {
    super(config);
  }

  async analyze(prompt: string, systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    let creds: ReturnType<typeof getAWSCreds>;
    try {
      creds = getAWSCreds();
    } catch (credErr: any) {
      throw new Error(credErr.message);
    }

    const { region } = creds;
    const model = this.config.model || 'anthropic.claude-3-sonnet-20240229-v1:0';

    // Bedrock uses the Converse API for all models (unified interface)
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`;

    const messages: any[] = [{ role: 'user', content: [{ text: prompt }] }];

    const bodyObj: any = {
      messages,
      ...(systemPrompt ? { system: [{ text: systemPrompt }] } : {}),
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
      },
    };

    const bodyStr = JSON.stringify(bodyObj);
    const signedHeaders = signRequest('POST', url, bodyStr, creds);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...signedHeaders,
          'content-length': Buffer.byteLength(bodyStr).toString(),
        },
        body: bodyStr,
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        // Surface actionable errors
        if (response.status === 403) {
          throw new Error(
            `AWS Bedrock access denied (403). Ensure:\n` +
            `1. Your IAM user/role has the "bedrock:InvokeModel" permission.\n` +
            `2. The model "${model}" is enabled in the Bedrock console for region "${region}".\n` +
            `3. Your AWS credentials are valid (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).`
          );
        }
        if (response.status === 404) {
          throw new Error(
            `Model "${model}" not found in region "${region}" (404).\n` +
            `Check the model ID in /config edit. Example: anthropic.claude-3-sonnet-20240229-v1:0`
          );
        }
        throw new Error(`AWS Bedrock Error (${response.status}): ${errText}`);
      }

      const data = await response.json() as any;

      // Converse API response shape
      const content = data?.output?.message?.content?.[0]?.text ?? '';
      const usage = data?.usage;

      return {
        content,
        usage: usage
          ? {
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          }
          : undefined,
      };
    } catch (err: any) {
      // Re-throw our already-formatted errors as-is
      if (err.message.startsWith('AWS Bedrock') || err.message.startsWith('Model "') || err.message.startsWith('AWS credentials')) {
        throw err;
      }
      throw new Error(`AWS Bedrock request failed: ${err.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Check env vars first (quick, no network)
      getAWSCreds();
      // Then test actual API connectivity
      await this.analyze('Hello', 'You are a helpful assistant. Reply with one word: Ready');
      return true;
    } catch {
      return false;
    }
  }
}
