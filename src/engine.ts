import https from 'https'
import type { IncomingHttpHeaders } from 'http'

import { convertObjectToCamelCase } from './util'

export type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  params?: Record<string, string>
  headers?: Record<string, string>
  body?: Record<string, any> // JSON only
}

export type RequestEngineOptions = {
  timeout?: number
  baseUrl?: string
  agent?: https.Agent
}

export type Response = {
  status: number
  body: Record<string, any>
  headers?: IncomingHttpHeaders
  error?: Error
}

export class RequestEngine {
  static agent: https.Agent = new https.Agent({
    keepAlive: true
  })

  timeout = 10000
  baseUrl?: string

  constructor(options: RequestEngineOptions = {}) {
    if (options.timeout) {
      this.timeout = options.timeout
    }

    if (options.baseUrl) {
      this.baseUrl = options.baseUrl
    }

    if (options.agent) {
      RequestEngine.agent = options.agent
    }
  }

  public async request(options: RequestOptions): Promise<Response> {
    const httpsOptions = {
      agent: RequestEngine.agent,
      method: options.method,
      headers: {
        ...options.headers,
        accept: 'application/json'
      }
    }

    const { url } = options
    let parsedUrl = url

    if (url.startsWith('https://')) {
      parsedUrl = url
    } else if (url.startsWith('/')) {
      parsedUrl = `${this.baseUrl || ''}${url}`
    } else {
      parsedUrl = `${this.baseUrl || ''}/${url}`
    }

    const endpoint = new URL(parsedUrl)

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        endpoint.searchParams.append(key, value)
      })
    }

    const request = new Promise<Response>((resolve, reject) => {
      const request = https.request(endpoint, httpsOptions, (response) => {
        response.setEncoding('utf8')

        let body = ''

        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => {
          const parsedBody = convertObjectToCamelCase(JSON.parse(body || '{}'))
          console.log(parsedBody, 'parsedBody')
          const status = response.statusCode || 500

          if (status >= 200 && status < 300) {
            return resolve({
              status,
              body: parsedBody,
              headers: response.headers
            })
          } else {
            return reject({
              status,
              body: parsedBody,
              error: parsedBody,
              headers: response.headers
            })
          }
        })
      })

      if (options.body) {
        request.write(JSON.stringify(options.body))
      }
      request.on('error', (error) => {
        return reject(error)
      })
      request.end()
    })

    const timeout = new Promise<Response>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id)
        reject({
          status: 408,
          error: 'Request timeout'
        })
      }, this.timeout)
    })

    return Promise.race([request, timeout])
  }
}
